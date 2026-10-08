import { z } from "zod";
import type { CacheEntry, MetadataCache } from "../lib/metadata-cache";
import type { Result } from "../lib/sample-contract";

const rowSchema = z.object({ key: z.string(), payload: z.string().max(1_048_576), stored_at: z.number().int(), expires_at: z.number().int() });
const unavailable = (): Result<never> => ({ ok: false, error: { code: "cache_unavailable", message: "The Site database cache is unavailable. Check the DB binding and deployed migrations.", status: 503 } });

/** Sites D1 adapter. Drizzle owns migrations; Sites requires raw prepared queries at runtime. */
export function createD1MetadataCache(db: D1Database | undefined): MetadataCache {
  return {
    async get(key, now) {
      if (!db) return unavailable();
      try {
        const row = await db.prepare("SELECT key, payload, stored_at, expires_at FROM freesound_cache WHERE key = ? AND expires_at > ?").bind(key, now).first();
        if (!row) return { ok: true, value: undefined };
        const parsed = rowSchema.safeParse(row);
        if (!parsed.success || parsed.data.expires_at <= parsed.data.stored_at) return unavailable();
        const value: unknown = JSON.parse(parsed.data.payload);
        return { ok: true, value: { key: parsed.data.key, value, storedAt: parsed.data.stored_at, expiresAt: parsed.data.expires_at } };
      } catch { return unavailable(); }
    },
    async put(entries: readonly CacheEntry[], now: number) {
      if (!db || entries.length > 41) return unavailable();
      try {
        const writes: D1PreparedStatement[] = [];
        for (const entry of entries) {
          const payload = JSON.stringify(entry.value);
          if (!payload || new TextEncoder().encode(payload).length > 1_048_576) return unavailable();
          writes.push(db.prepare("INSERT INTO freesound_cache (key, payload, stored_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, stored_at = excluded.stored_at, expires_at = excluded.expires_at WHERE excluded.stored_at >= freesound_cache.stored_at").bind(entry.key, payload, entry.storedAt, entry.expiresAt));
        }
        writes.push(db.prepare("DELETE FROM freesound_cache WHERE expires_at <= ?").bind(now));
        writes.push(db.prepare("DELETE FROM freesound_cache WHERE key IN (SELECT key FROM freesound_cache ORDER BY stored_at DESC, key LIMIT -1 OFFSET 512)"));
        const results = await db.batch(writes);
        return results.every(result => result.success) ? { ok: true, value: undefined } : unavailable();
      } catch { return unavailable(); }
    },
    async check() {
      if (!db) return unavailable();
      try { await db.prepare("SELECT key FROM freesound_cache LIMIT 1").first(); return { ok: true, value: undefined }; }
      catch { return unavailable(); }
    },
  };
}
