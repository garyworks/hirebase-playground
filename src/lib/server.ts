import {
  validateRequest,
  upstreamRequest,
  ValidationError,
  record,
} from "./validation";
import { redact, metadataHeaders, errorMessage, type Result } from "./response";
import { sampleFor } from "./samples";
export type ServerContext = {
  apiKey?: string;
  ownerMode?: boolean;
  fetcher?: typeof fetch;
};
const mimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/html",
]);
export function localRequestAllowed(request: Request) {
  const host = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return false;
  const authority = request.headers.get("host") ?? new URL(request.url).host;
  let authorityHost: string;
  try {
    authorityHost = new URL(`${new URL(request.url).protocol}//${authority}`)
      .hostname;
  } catch {
    return false;
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(authorityHost))
    return false;
  const origin = request.headers.get("origin");
  return (
    !!origin &&
    origin === `${new URL(request.url).protocol}//${authority}` &&
    ["same-origin", "none", null].includes(
      request.headers.get("sec-fetch-site"),
    )
  );
}

export function railwayRequestAllowed(request: Request, domain: string) {
  return (
    request.headers.get("host") === domain &&
    request.headers.get("origin") === `https://${domain}` &&
    ["same-origin", "none", null].includes(
      request.headers.get("sec-fetch-site"),
    )
  );
}

export async function execute(
  payload: unknown,
  context: ServerContext,
  file?: File,
): Promise<Result> {
  const start = performance.now();
  const result = (
    data: unknown,
    status = 200,
    source: Result["source"] = "local",
    headers: Record<string, string> = {},
    error?: string,
  ): Result => {
    const safe = redact(data, context.apiKey);
    const safeHeaders = redact(headers, context.apiKey).data as Record<
      string,
      string
    >;
    return {
      source,
      status,
      durationMs: Math.round(performance.now() - start),
      headers: safeHeaders,
      ...safe,
      error: redact(error, context.apiKey).data as string | undefined,
      operationId: redact(
        record(payload) && typeof payload.operationId === "string"
          ? payload.operationId
          : "unknown",
        context.apiKey,
      ).data as string,
      requestedAt: new Date().toISOString(),
    };
  };
  try {
    if (
      !record(payload) ||
      typeof payload.operationId !== "string" ||
      !["sample", "live"].includes(String(payload.mode))
    )
      throw new ValidationError("Provide operationId, mode and input.");
    const { operation, input } = validateRequest(
      payload.operationId,
      payload.input,
    );
    if (payload.mode === "sample")
      return result(sampleFor(operation, input), 200, "sample");
    if (operation.access === "unavailable")
      return result(
        { detail: operation.note },
        501,
        "local",
        {},
        "Provider documents this capability as not available yet.",
      );
    if (operation.access === "sample")
      return result(
        { detail: operation.note },
        403,
        "local",
        {},
        "This operation is sample-only in this playground.",
      );
    if (operation.access === "owner" && !context.ownerMode)
      return result(
        {
          detail:
            "Set HIREBASE_OWNER_MODE=true locally and restart. Never expose this server publicly.",
        },
        403,
        "local",
        {},
        "Local owner mode is disabled.",
      );
    if (!context.apiKey && operation.family !== "Reference data")
      return result(
        {
          detail: "Add HIREBASE_API_KEY to .env.local.",
        },
        503,
        "local",
        {},
        "API key is not configured.",
      );
    if (
      operation.file &&
      (!file ||
        !mimeTypes.has(file.type) ||
        file.size === 0 ||
        file.size > 5 * 1024 * 1024)
    )
      throw new ValidationError(
        "Choose one PDF, DOC/DOCX, TXT or HTML file with the correct MIME type, up to 5 MB.",
      );
    const upstream = upstreamRequest(operation, input);
    const headers: Record<string, string> = { accept: "application/json" };
    if (context.apiKey) headers["x-api-key"] = context.apiKey;
    let body: BodyInit | undefined;
    if (operation.file && file) {
      const form = new FormData();
      form.set("file", file);
      body = form;
    } else if (
      operation.method !== "GET" &&
      Object.keys(upstream.body ?? {}).length
    ) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(upstream.body);
    }
    const response = await (context.fetcher ?? fetch)(
      `https://api.hirebase.org${upstream.path}`,
      {
        method: operation.method,
        headers,
        body,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(45000),
      },
    );
    const text = await readLimited(response, 8 * 1024 * 1024);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        detail: text.slice(0, 5000) || "Empty upstream response",
        non_json: true,
      };
    }
    const meta = metadataHeaders(response.headers);
    return result(
      data,
      response.status,
      "live",
      meta,
      errorMessage(response.status, meta),
    );
  } catch (error) {
    if (error instanceof ValidationError)
      return result(
        { detail: error.message },
        422,
        "local",
        {},
        "Validation failed. No upstream request was sent.",
      );
    return result(
      {
        detail:
          "Network error, timeout, redirect, or oversized response. No automatic retry was attempted.",
      },
      502,
      "local",
      {},
      "Could not reach Hirebase.",
    );
  }
}
export async function readLimited(message: Request | Response, max: number) {
  const reader = message.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new ValidationError("Payload exceeds the playground size limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let pos = 0;
  for (const c of chunks) {
    bytes.set(c, pos);
    pos += c.length;
  }
  return new TextDecoder().decode(bytes);
}
