import { operations, type Operation } from "./catalog";
import { type Fields, type Field } from "./fields";
export class ValidationError extends Error {}
export function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function fail(path: string, message: string): never {
  throw new ValidationError(`${path}: ${message}`);
}
function validateField(v: unknown, f: Field, path: string): void {
  if (v === undefined) {
    if (f.required) fail(path, "required");
    return;
  }
  if (f.type === "string") {
    if (typeof v !== "string" || v.length > 12000 || !v.trim())
      fail(path, "expected a nonempty string (maximum 12,000 characters)");
    if (f.enum && !f.enum.includes(v))
      fail(path, `choose ${f.enum.join(", ")}`);
    if (f.pattern && !new RegExp(f.pattern).test(v))
      fail(path, "invalid format");
    if (
      f.pattern?.includes("\\d{4}") &&
      !path.endsWith("month") &&
      (!Number.isFinite(Date.parse(v)) ||
        new Date(v).toISOString().slice(0, 10) !== v.slice(0, 10))
    )
      fail(path, "invalid calendar date");
  } else if (f.type === "number") {
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      (f.min !== undefined && v < f.min) ||
      (f.max !== undefined && v > f.max)
    )
      fail(path, `expected a number from ${f.min} to ${f.max}`);
    if (
      /(?:page|limit|offset|skip|days_ago|sample_size|months|max_jobs_per_day)$/.test(
        path,
      ) &&
      !Number.isInteger(v)
    )
      fail(path, "must be an integer");
  } else if (f.type === "boolean") {
    if (typeof v !== "boolean") fail(path, "expected a JSON boolean");
  } else if (f.type === "object") {
    validateFields(v, f.fields ?? {}, path);
  } else if (f.type === "vectors") {
    if (
      !Array.isArray(v) ||
      v.length < 1 ||
      v.length > 10 ||
      v.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== 768 ||
          row.some((x) => typeof x !== "number" || !Number.isFinite(x)),
      )
    )
      fail(path, "expected 1–10 arrays of exactly 768 finite numbers");
  } else {
    // The provider documents string-or-array unions for these particular filters.
    if (
      f.type === "strings" &&
      typeof v === "string" &&
      /(?:company_slug|industry|sub_industry|signals)$/.test(path)
    ) {
      validateField(v, { type: "string", enum: f.enum }, path);
      return;
    }
    if (
      !Array.isArray(v) ||
      (f.min !== undefined && v.length < f.min) ||
      (f.max !== undefined && v.length > f.max)
    )
      fail(path, `expected an array (${f.min ?? 0}–${f.max ?? 100} entries)`);
    v.forEach((x, i) =>
      f.type === "objects"
        ? validateFields(x, f.fields ?? {}, `${path}[${i}]`)
        : validateField(x, { type: "string", enum: f.enum }, `${path}[${i}]`),
    );
  }
}
export function validateFields(
  value: unknown,
  fields: Fields,
  path = "request",
): asserts value is Record<string, unknown> {
  if (!record(value)) fail(path, "expected an object");
  for (const k of Object.keys(value))
    if (!Object.hasOwn(fields, k))
      fail(`${path}.${k}`, "unknown or unsupported field");
  for (const [k, f] of Object.entries(fields))
    validateField(value[k], f, `${path}.${k}`);
  if (
    typeof value.min === "number" &&
    typeof value.max === "number" &&
    value.min > value.max
  )
    fail(path, "min must not exceed max");
  if (value.hide_seen_jobs === "true" && !value.user_id)
    fail(
      path,
      "hide_seen_jobs requires user_id; obtaining that ID is undocumented",
    );
}
export function validateRequest(
  operationId: string,
  input: unknown,
): { operation: Operation; input: Record<string, unknown> } {
  const operation = operations.find((o) => o.id === operationId);
  if (!operation) fail("operation", "not allowlisted");
  validateFields(input, operation.fields);
  const data = structuredClone(input);
  if (operation.pagination === "lexical") {
    if (!record(data.vector) && !record(data.lexical))
      fail("neural", "vector or lexical is required");
    if (
      record(data.vector) &&
      !["query", "job_ids", "artifact_id", "vectors"].some(
        (k) => data.vector && Object.hasOwn(data.vector, k),
      )
    )
      fail("vector", "provide query, job_ids, artifact_id or vectors");
    data.lexical = {
      page: 1,
      limit: 5,
      ...(record(data.lexical) ? data.lexical : {}),
    };
  } else if (operation.pagination === "root") {
    data.page ??= 1;
    data.limit ??= 5;
  }
  if (operation.id === "estimate") data.limit ??= 5;
  if (
    operation.id === "historical" &&
    !Object.entries(data).some(
      ([k, v]) =>
        k !== "sample_size" && (Array.isArray(v) ? v.length > 0 : !!v),
    )
  )
    fail("historical", "at least one nonempty archive filter is required");
  if (operation.id === "salary" && !data.public_url && !data.job_title)
    fail("salary", "public_url or job_title is required");
  if (data.notify === true)
    fail("notify", "email notifications are disabled in this playground");
  if (
    operation.id === "lookup" &&
    (data.urls as string[]).some((x) => {
      try {
        return (
          x.length > 2048 || !["http:", "https:"].includes(new URL(x).protocol)
        );
      } catch {
        return true;
      }
    })
  )
    fail(
      "urls",
      "expected HTTP(S) posting URLs, each at most 2,048 characters",
    );
  if (operation.id === "expired" || operation.id === "expired-export") {
    const since = Date.parse(data.since as string);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (since < today.getTime() - 14 * 86400000 || since > Date.now())
      fail("since", "must be within the last 14 days and not in the future");
  }
  for (const [from, to] of [
    ["date_posted_from", "date_posted_to"],
    ["date_expired_from", "date_expired_to"],
    ["ingested_after", "ingested_before"],
    ["from", "to"],
  ])
    if (
      typeof data[from] === "string" &&
      typeof data[to] === "string" &&
      Date.parse(data[from]) > Date.parse(data[to])
    )
      fail(from, `must not be after ${to}`);
  if (operation.id === "daily" && Boolean(data.from) !== Boolean(data.to))
    fail(
      "dates",
      "provide both from and to, or omit both for provider defaults",
    );
  if (
    operation.id === "daily" &&
    data.from &&
    data.to &&
    Date.parse(data.to as string) - Date.parse(data.from as string) >
      89 * 86400000
  )
    fail("dates", "maximum 90 inclusive days");
  return { operation, input: data };
}
export function upstreamRequest(
  operation: Operation,
  input: Record<string, unknown>,
) {
  const values = { ...input };
  const path = operation.path.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    delete values[key];
    return encodeURIComponent(String(value ?? `{${key}}`));
  });
  const query = new URLSearchParams();
  if (operation.method === "GET")
    for (const [k, v] of Object.entries(values)) query.set(k, String(v));
  return {
    method: operation.method,
    path: path + (query.size ? `?${query}` : ""),
    body: operation.method === "GET" ? undefined : values,
  };
}
