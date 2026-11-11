import { execute, localRequestAllowed, readLimited } from "@/lib/server";
import { record } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!localRequestAllowed(request))
    return Response.json(
      {
        error:
          "Only same-origin requests to the local playground are permitted.",
      },
      { status: 403, headers },
    );
  try {
    let payload: unknown;
    let file: File | undefined;
    if (
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      // Bound bytes before multipart parsing; uploaded file data is never saved locally.
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (!reader) throw new Error("Missing body");
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 6 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("Upload exceeds 6 MB request limit");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const c of chunks) {
        bytes.set(c, at);
        at += c.length;
      }
      const form = await new Response(bytes, {
        headers: { "content-type": request.headers.get("content-type")! },
      }).formData();
      if (
        form.getAll("file").length > 1 ||
        [...form.keys()].some((k) => !["file", "payload"].includes(k))
      )
        throw new Error("Exactly one file is permitted");
      payload = JSON.parse(String(form.get("payload")));
      const item = form.get("file");
      if (item instanceof File) file = item;
    } else {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new Error("JSON content type required");
      payload = JSON.parse(await readLimited(request, 256 * 1024));
    }
    if (!record(payload) || payload.mode !== "live") {
      return Response.json(
        { error: "This playground accepts live requests only." },
        { status: 400, headers },
      );
    }
    const result = await execute(
      payload,
      {
        apiKey: process.env.HIREBASE_API_KEY?.trim(),
        ownerMode: process.env.HIREBASE_OWNER_MODE === "true",
      },
      file,
    );
    return Response.json(result, { status: result.status, headers });
  } catch {
    return Response.json(
      { error: "Invalid request body, file count or payload size." },
      { status: 400, headers },
    );
  }
}
