import { z } from "zod";

export const soundIdSchema = z.number().int().positive().max(2147483647);
export const cacheInfoSchema = z.object({ hit: z.boolean(), stored_at: z.string().datetime(), expires_at: z.string().datetime() });
export const searchSchema = z.object({
  refresh: z.boolean().default(false),
  query: z.string().trim().min(1).max(200),
  page: z.number().int().min(1).max(1000).default(1),
  page_size: z.number().int().min(1).max(40).default(12),
  sort: z.enum(["score", "duration_asc", "duration_desc", "created_desc", "created_asc", "downloads_desc", "downloads_asc", "rating_desc", "rating_asc"]).default("score"),
  license: z.enum(["cc0", "attribution", "attribution-noncommercial", "all"]).default("cc0"),
  min_duration: z.number().finite().min(0).max(3600).optional(),
  max_duration: z.number().finite().min(0).max(3600).optional(),
}).strict().refine(v => v.min_duration === undefined || v.max_duration === undefined || v.min_duration <= v.max_duration, { message: "Minimum duration must not exceed maximum duration." });
export type SearchInput = z.input<typeof searchSchema>;
export const mediaUrlSchema = z.string().url().refine(value => {
  const u = new URL(value);
  return u.protocol === "https:" && ["cdn.freesound.org", "freesound.org"].includes(u.hostname) && !u.port && !u.username && !u.password && !u.search && !u.hash && /^\/(previews|displays)\//.test(u.pathname);
});
const sourceUrlSchema = z.string().url().refine(value => {
  const u = new URL(value); return u.protocol === "https:" && u.hostname === "freesound.org" && /^\/people\/[^/]+\/sounds\/\d+\/$/.test(u.pathname) && !u.search;
});
export const soundSchema = z.object({
  cache: cacheInfoSchema.optional(),
  id: soundIdSchema, name: z.string().max(1000), creator: z.string().max(200),
  duration: z.number().finite().nonnegative(), tags: z.array(z.string().max(200)).max(100),
  source_page: sourceUrlSchema,
  license: z.object({ exact: z.string().max(500), label: z.string(), url: z.string().url().nullable(), attribution_required: z.boolean() }),
  previews: z.record(z.string(), mediaUrlSchema), waveform_images: z.record(z.string(), mediaUrlSchema),
  attribution: z.string().max(2000),
});
export type Sound = z.infer<typeof soundSchema>;
export const searchOutputSchema = z.object({ cache: cacheInfoSchema.optional(), count: z.number().int().nonnegative(), page: z.number().int(), page_size: z.number().int(), next_page: z.number().int().nullable(), previous_page: z.number().int().nullable(), results: z.array(soundSchema) });
export type SearchResult = z.infer<typeof searchOutputSchema>;
export const previewInputSchema = z.object({ refresh: z.boolean().default(false), sound_id: soundIdSchema, quality: z.enum(["hq", "lq"]).default("hq"), format: z.enum(["mp3", "ogg"]).default("mp3") }).strict();
export const previewSchema = z.object({
  cache: cacheInfoSchema.optional(),
  source: z.literal("freesound"), sound_id: soundIdSchema, name: z.string(), url: mediaUrlSchema,
  format: z.enum(["mp3", "ogg"]), mime_type: z.enum(["audio/mpeg", "audio/ogg"]), quality: z.enum(["hq", "lq"]),
  encoding: z.literal("lossy-preview"), duration: z.number().nonnegative(), creator: z.string(), source_page: sourceUrlSchema,
  license: soundSchema.shape.license, attribution: z.string(), expires_at: z.string().nullable(), delivery: z.literal("direct-cdn"),
});
export type Preview = z.infer<typeof previewSchema>;
/** Provenance accompanying the native MCP audio block; cache describes metadata only. */
export const audioDescriptorSchema = previewSchema.extend({ delivery: z.literal("mcp-audio"), byte_length: z.number().int().positive() });
export type AudioDescriptor = z.infer<typeof audioDescriptorSchema>;
export const failureSchema = z.object({ code: z.enum(["cache_unavailable", "unconfigured", "unauthorized", "forbidden", "not_found", "rate_limited", "upstream", "timeout", "cancelled", "invalid_response", "unavailable_preview", "oversized", "invalid_input"]), message: z.string(), status: z.number().int(), retry_after_seconds: z.number().nonnegative().optional() });
export type Failure = z.infer<typeof failureSchema>;
export type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };
export const statusSchema = z.object({
  cache_ready: z.boolean(), cache_failure: failureSchema.nullable(), configured: z.boolean(),
  live_request_succeeded: z.boolean(), checked_at: z.string(), failure: failureSchema.nullable(),
  release: z.object({ version: z.string(), repository_url: z.string().url(), releases_url: z.string().url(), update_instructions_url: z.string().url() }),
});
