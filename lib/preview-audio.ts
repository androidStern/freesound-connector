import { mediaUrlSchema, type Preview, type Result } from "./sample-contract";

/** Downloads a resolved preview without credentials, redirects, or an application file-size cap. */
export async function downloadPreviewAudio(
  preview: Preview,
  runtime: { readonly fetch: typeof fetch; readonly now: () => number },
  options: { readonly signal?: AbortSignal } = {},
): Promise<Result<Uint8Array<ArrayBuffer>>> {
  const destination = mediaUrlSchema.safeParse(preview.url);
  if (!destination.success || !new URL(destination.data).pathname.startsWith("/previews/")) {
    return { ok: false, error: { code: "invalid_response", message: "The preview has an unapproved media destination.", status: 502 } };
  }
  const timeout = AbortSignal.timeout(60000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const response = await runtime.fetch(destination.data, {
      credentials: "omit", redirect: "manual", signal,
      headers: { Accept: preview.mime_type },
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) {
        const header = response.headers.get("Retry-After");
        const seconds = header === null ? 60 : /^\d+(\.\d+)?$/.test(header) ? Number(header) : (Date.parse(header) - runtime.now()) / 1000;
        return { ok: false, error: { code: "rate_limited", message: "Freesound preview HTTP 429. Retry after the indicated delay.", status: 429, retry_after_seconds: Number.isFinite(seconds) ? Math.max(0, seconds) : 60 } };
      }
      return { ok: false, error: {
        code: response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : response.status === 404 ? "unavailable_preview" : "upstream",
        message: response.status >= 300 && response.status < 400 ? "The preview redirected; no redirect was followed." : `Freesound preview HTTP ${response.status}.`,
        status: response.status >= 300 && response.status < 400 ? 502 : response.status,
      } };
    }
    const type = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
    const allowed = preview.format === "mp3" ? ["audio/mpeg", "audio/mp3"] : ["audio/ogg", "application/ogg"];
    if (!type || ![...allowed, "application/octet-stream"].includes(type)) {
      await response.body?.cancel();
      return { ok: false, error: { code: "invalid_response", message: "The preview returned a non-audio content type.", status: 502 } };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const isAudio = preview.format === "mp3"
      ? bytes.length >= 3 && ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
      : bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
    if (!isAudio) return { ok: false, error: { code: "invalid_response", message: "The preview body is empty or does not match its audio format.", status: 502 } };
    return { ok: true, value: bytes };
  } catch {
    if (options.signal?.aborted) return { ok: false, error: { code: "cancelled", message: "Audio retrieval was cancelled.", status: 499 } };
    if (timeout.aborted) return { ok: false, error: { code: "timeout", message: "Audio retrieval timed out.", status: 504 } };
    return { ok: false, error: { code: "upstream", message: "The preview could not be retrieved from Freesound.", status: 502 } };
  }
}
