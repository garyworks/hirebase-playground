export type Result = {
  source: "sample" | "live" | "local";
  status: number;
  durationMs: number;
  headers: Record<string, string>;
  data: unknown;
  redactions: string[];
  error?: string;
  operationId: string;
  requestedAt: string;
};
export function errorMessage(
  status: number,
  headers: Record<string, string>,
): string | undefined {
  if (status === 429 && headers["x-billing-code"] === "limit_exceeded")
    return "Plan quota exhausted. Do not retry with backoff. Reduce the requested limit to remaining units or wait for the billing reset.";
  if (status === 429)
    return `Rate limited. Wait ${headers["retry-after"] ?? "the provider-specified number of"} seconds before manually retrying.`;
  if (status === 401)
    return "Authentication failed. Check HIREBASE_API_KEY in .env.local and restart the server.";
  if (status === 403)
    return "This feature is unavailable to this account or requires an add-on.";
  if (status === 402)
    return "Provider payment failed. No automatic retry or purchase will be made.";
  if (status === 422 || status === 400)
    return "Request rejected. Review validation details and the endpoint contract.";
  if (status === 404)
    return "The requested record was not found or is not yet available.";
  if (status >= 500)
    return "The provider could not complete this request. Retry manually when ready.";
}
export function metadataHeaders(headers: Headers) {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    if (
      /^(hirebase-usage-|x-ratelimit-|x-billing-)/.test(k) ||
      ["retry-after", "x-request-id", "request-id", "content-type"].includes(k)
    )
      out[k] = v;
  });
  return out;
}
export function redact(
  data: unknown,
  key = "",
): { data: unknown; redactions: string[] } {
  const redactions: string[] = [];
  function walk(v: unknown, path: string): unknown {
    if (typeof v === "string")
      return key && v.includes(key)
        ? (redactions.push(path), v.split(key).join("[REDACTED API KEY]"))
        : v;
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => {
          const safeKey =
            key && k.includes(key)
              ? k.split(key).join("[REDACTED API KEY]")
              : k;
          const p = `${path}.${safeKey}`;
          if (safeKey !== k) redactions.push(p);
          if (
            /^(contact_email|contact_phone|email|emails|phone_number|phone_numbers|phone|resume_url|download_url|checkout_url|stripe_customer_id|secret|signing_secret|api_key|x-api-key|authorization|header)$/i.test(
              k,
            ) &&
            x !== null
          ) {
            redactions.push(p);
            return [k, "[REDACTED]"];
          }
          return [safeKey, walk(x, p)];
        }),
      );
    return v;
  }
  return { data: walk(data, "response"), redactions };
}
export function uniqueJobs(
  rows: Record<string, unknown>[],
  previousIds: string[] = [],
) {
  const seen = new Set(previousIds);
  return rows.filter((row) => {
    const key = String(row._id ?? row.id ?? "");
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function plainText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
