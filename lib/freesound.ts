import { z } from "zod";
import { mediaUrlSchema, soundSchema, searchOutputSchema, previewSchema, type Sound, type Result, type Failure, type Preview, type SearchResult } from "./sample-contract";
import type { searchSchema, previewInputSchema } from "./sample-contract";
import { MemoryMetadataCache, type MetadataCache, type CacheEntry } from "./metadata-cache";
import { downloadPreviewAudio } from "./preview-audio";

const fields = "id,name,username,duration,tags,url,license,previews,images";
const rawSoundSchema = z.object({ id: soundSchema.shape.id, name: z.string().max(1000), username: z.string().max(200), duration: z.number().finite().nonnegative(), tags: z.array(z.string().max(200)).max(100), url: z.string(), license: z.string().max(500), previews: z.record(z.string(), z.string()).default({}), images: z.record(z.string(), z.string()).default({}) });
const rawSearchSchema = z.object({ count: z.number().int().nonnegative(), next: z.string().nullable(), previous: z.string().nullable(), results: z.array(rawSoundSchema).max(40) });
export interface ProviderRuntime { fetch: typeof fetch; now: () => number; sleep: (ms: number) => Promise<void> }
const fail = (code: Failure["code"], message: string, status: number): Result<never> => ({ ok: false, error: { code, message, status } });
function normalizeSound(raw: z.infer<typeof rawSoundSchema>): Result<Sound> {
  const previews: Record<string, string> = {}, images: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw.previews)) if (mediaUrlSchema.safeParse(value).success) previews[key] = value;
  for (const [key, value] of Object.entries(raw.images)) if (key.startsWith("waveform") && mediaUrlSchema.safeParse(value).success) images[key] = value;
  const exact = raw.license;
  const cc0 = /\/publicdomain\/zero\//.test(exact) || exact === "Creative Commons 0";
  const nc = /\/by-nc\//.test(exact) || exact === "Attribution NonCommercial";
  const by = /\/by\//.test(exact) || exact === "Attribution";
  const licenseUrl = /^https?:\/\/creativecommons.org\//.test(exact) ? exact : null;
  const license = { exact, label: cc0 ? "CC0" : nc ? "CC BY-NC" : by ? "CC BY" : exact, url: licenseUrl, attribution_required: !cc0 };
  const parsed = soundSchema.safeParse({ id: raw.id, name: raw.name, creator: raw.username, duration: raw.duration, tags: raw.tags, source_page: raw.url, license, previews, waveform_images: images, attribution: `${raw.name} by ${raw.username} — ${raw.url} — ${exact}` });
  return parsed.success ? { ok: true, value: parsed.data } : fail("invalid_response", "Freesound returned invalid sound metadata.", 502);
}
/** Server-only client: credential closes over the upstream adapter, never enters output. */
export function createFreesoundClient(key: string | undefined, runtime: ProviderRuntime, cache: MetadataCache = new MemoryMetadataCache()) {
  const configured = !!key?.trim();
  const redact = (text: string) => (key ? text.replaceAll(key, "[redacted]") : text).replace(/\b(?:Token|Bearer)\s+\S+/gi, "[redacted]").replace(/[A-Za-z0-9_-]{28,}/g, "[redacted]").slice(0, 240);
  async function request(path: string, params: URLSearchParams, options: { readonly signal?: AbortSignal } = {}): Promise<Result<unknown>> {
    if (!configured) return fail("unconfigured", "Freesound is not configured in the Site secret store.", 503);
    const url = new URL(path, "https://freesound.org"); url.search = params.toString();
    const deadline = runtime.now() + 16000;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        options.signal?.throwIfAborted();
        const timeout = AbortSignal.timeout(Math.min(7000, Math.max(1, deadline - runtime.now())));
        const response = await runtime.fetch(url, { headers: { Authorization: `Token ${key}`, Accept: "application/json" }, redirect: "manual", signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout });
        if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); return fail("upstream", "Freesound redirected an API request; credentials were not forwarded.", 502); }
        const bytes = await readLimited(response, 2 * 1024 * 1024);
        if (!bytes.ok) return bytes;
        let value: unknown; try { value = JSON.parse(new TextDecoder().decode(bytes.value)); } catch { return fail("invalid_response", "Freesound returned a non-JSON response.", 502); }
        if (response.ok) return { ok: true, value };
        const detail = z.object({ detail: z.string() }).safeParse(value);
        const message = `Freesound HTTP ${response.status}: ${detail.success ? redact(detail.data.detail) : "request failed"}`;
        const retryHeader = response.headers.get("Retry-After");
        const retrySeconds = retryHeader === null ? 1 : /^\d+(\.\d+)?$/.test(retryHeader) ? Number(retryHeader) : Math.max(0, (Date.parse(retryHeader) - runtime.now()) / 1000);
        if (response.status === 429) {
          if (attempt < 2 && Number.isFinite(retrySeconds) && retrySeconds <= 2 && runtime.now() + retrySeconds * 1000 < deadline) { await runtime.sleep(retrySeconds * 1000); continue; }
          return { ok: false, error: { code: "rate_limited", message, status: 429, retry_after_seconds: Number.isFinite(retrySeconds) ? retrySeconds : 60 } };
        }
        if (response.status >= 500 && attempt < 2 && runtime.now() + 500 < deadline) { await runtime.sleep(250 * (attempt + 1)); continue; }
        return fail(response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : response.status === 404 ? "not_found" : "upstream", message, response.status >= 500 ? 502 : response.status);
      } catch (cause) {
        if (options.signal?.aborted) return fail("cancelled", "Freesound request was cancelled.", 499);
        if (attempt < 2 && runtime.now() + 500 < deadline) { await runtime.sleep(250 * (attempt + 1)); continue; }
        const detail = cause instanceof Error ? redact(cause.message) : "network failure";
        return fail("timeout", `Freesound request timed out or the upstream network failed: ${detail}`, 504);
      }
    }
    return fail("upstream", "Freesound request failed.", 502);
  }
  const searchTtl = 15 * 60 * 1000, soundTtl = 60 * 60 * 1000;
  const info = (entry: CacheEntry, hit: boolean) => ({ hit, stored_at: new Date(entry.storedAt).toISOString(), expires_at: new Date(entry.expiresAt).toISOString() });
  async function cached<T>(cacheKey: string, schema: z.ZodType<T>, refresh: boolean): Promise<Result<{ value: T; entry: CacheEntry } | undefined>> {
    if (!configured) return fail("unconfigured", "Add FREESOUND_API_KEY as a secret in Sites settings, then redeploy.", 503);
    if (refresh) return { ok: true, value: undefined };
    const result = await cache.get(cacheKey, runtime.now());
    if (!result.ok || !result.value) return result.ok ? { ok: true, value: undefined } : result;
    const parsed = schema.safeParse(result.value.value);
    return parsed.success ? { ok: true, value: { value: parsed.data, entry: result.value } } : fail("cache_unavailable", "Cached metadata is invalid. Retry with refresh: true.", 503);
  }
  async function search(input: z.output<typeof searchSchema>): Promise<Result<SearchResult>> {
    const licenses = { cc0: 'license:"Creative Commons 0"', attribution: 'license:"Attribution"', "attribution-noncommercial": 'license:"Attribution NonCommercial"', all: "" };
    const filter = [licenses[input.license], input.min_duration !== undefined || input.max_duration !== undefined ? `duration:[${input.min_duration ?? "*"} TO ${input.max_duration ?? "*"}]` : ""].filter(Boolean).join(" ");
    const params = new URLSearchParams({ query: input.query, page: String(input.page), page_size: String(input.page_size), sort: input.sort, fields });
    if (filter) params.set("filter", filter);
    const cacheKey = `search:v2:${params.toString()}`;
    const prior = await cached(cacheKey, searchOutputSchema, input.refresh);
    if (!prior.ok) return prior;
    if (prior.value) return { ok: true, value: { ...prior.value.value, cache: info(prior.value.entry, true) } };
    const result = await request("/apiv2/search/", params);
    if (!result.ok) return result;
    const parsed = rawSearchSchema.safeParse(result.value); if (!parsed.success) return fail("invalid_response", "Freesound returned invalid search results.", 502);
    const results: Sound[] = [];
    for (const raw of parsed.data.results) { const s = normalizeSound(raw); if (!s.ok) return s; results.push(s.value); }
    // Return integer cursors, never forward opaque upstream URLs or credentials.
    const value = searchOutputSchema.parse({ count: parsed.data.count, page: input.page, page_size: input.page_size, next_page: parsed.data.next ? input.page + 1 : null, previous_page: parsed.data.previous ? input.page - 1 : null, results });
    const now = runtime.now();
    const entry = { key: cacheKey, value, storedAt: now, expiresAt: now + searchTtl };
    const stored = await cache.put([entry, ...results.map(sound => ({ key: `sound:v2:${sound.id}`, value: sound, storedAt: now, expiresAt: now + soundTtl }))], now);
    return stored.ok ? { ok: true, value: { ...value, cache: info(entry, false) } } : stored;
  }
  async function getSound(id: number, options: { readonly refresh?: boolean; readonly signal?: AbortSignal } = {}): Promise<Result<Sound>> {
    const cacheKey = `sound:v2:${id}`;
    const prior = await cached(cacheKey, soundSchema, options.refresh ?? false);
    if (!prior.ok) return prior;
    if (prior.value) return { ok: true, value: { ...prior.value.value, cache: info(prior.value.entry, true) } };
    const result = await request(`/apiv2/sounds/${id}/`, new URLSearchParams({ fields }), options);
    if (!result.ok) return result;
    const raw = rawSoundSchema.safeParse(result.value);
    if (!raw.success) return fail("invalid_response", "Freesound returned invalid sound metadata.", 502);
    const sound = normalizeSound(raw.data);
    if (!sound.ok) return sound;
    const now = runtime.now();
    const entry = { key: cacheKey, value: sound.value, storedAt: now, expiresAt: now + soundTtl };
    const stored = await cache.put([entry], now);
    return stored.ok ? { ok: true, value: { ...sound.value, cache: info(entry, false) } } : stored;
  }
  async function getPreview(input: z.output<typeof previewInputSchema>, options: { readonly signal?: AbortSignal } = {}): Promise<Result<Preview>> {
    const result = await getSound(input.sound_id, { refresh: input.refresh, signal: options.signal }); if (!result.ok) return result;
    const sound = result.value;
    const alternatives = [`preview-${input.quality}-${input.format}`, `preview-${input.quality === "hq" ? "lq" : "hq"}-${input.format}`, `preview-hq-${input.format === "mp3" ? "ogg" : "mp3"}`, `preview-lq-${input.format === "mp3" ? "ogg" : "mp3"}`];
    const chosen = alternatives.find(k => !!sound.previews[k]); if (!chosen) return fail("unavailable_preview", "This Freesound sound has no supported preview.", 404);
    const format = chosen.endsWith("mp3") ? "mp3" : "ogg";
    return { ok: true, value: previewSchema.parse({ source: "freesound", sound_id: sound.id, name: sound.name, url: sound.previews[chosen], format, mime_type: format === "mp3" ? "audio/mpeg" : "audio/ogg", quality: chosen.includes("-hq-") ? "hq" : "lq", encoding: "lossy-preview", duration: sound.duration, creator: sound.creator, source_page: sound.source_page, license: sound.license, attribution: sound.attribution, expires_at: null, delivery: "direct-cdn", cache: sound.cache }) };
  }
  async function getAudio(input: z.output<typeof previewInputSchema>, options: { readonly signal?: AbortSignal } = {}): Promise<Result<{ readonly preview: Preview; readonly bytes: Uint8Array<ArrayBuffer> }>> {
    const preview = await getPreview(input, options);
    if (!preview.ok) return preview;
    const audio = await downloadPreviewAudio(preview.value, runtime, options);
    return audio.ok ? { ok: true, value: { preview: preview.value, bytes: audio.value } } : audio;
  }
  async function status() {
    const result = await request("/apiv2/search/", new URLSearchParams({ query: "hi hat", page_size: "1", fields: "id" }));
    const database = await cache.check();
    return { cache_ready: database.ok, cache_failure: database.ok ? null : database.error, configured, live_request_succeeded: result.ok, checked_at: new Date(runtime.now()).toISOString(), failure: result.ok ? null : result.error };
  }
  return { search, getSound, getPreview, getAudio, status };
}
export async function readLimited(response: Pick<Response, "headers" | "body">, limit: number): Promise<Result<Uint8Array<ArrayBuffer>>> {
  if (Number(response.headers.get("Content-Length") ?? 0) > limit) { await response.body?.cancel(); return fail("oversized", "The response exceeds the size limit.", 413); }
  const reader = response.body?.getReader(); if (!reader) return fail("invalid_response", "The upstream response has no body.", 502);
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > limit) { await reader.cancel(); return fail("oversized", "The response exceeds the size limit.", 413); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return { ok: true, value: bytes };
}
