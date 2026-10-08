import type { Result } from "./sample-contract";

/** Temporary public metadata only. Secrets and audio bytes never enter this store. */
export type CacheEntry = { key: string; value: unknown; storedAt: number; expiresAt: number };
/** Persistent implementations translate storage failures into safe typed results. */
export interface MetadataCache {
  get(key: string, now: number): Promise<Result<CacheEntry | undefined>>;
  put(entries: readonly CacheEntry[], now: number): Promise<Result<void>>;
  check(): Promise<Result<void>>;
}
/** Local test adapter; production always uses Sites D1. */
export class MemoryMetadataCache implements MetadataCache {
  private readonly entries = new Map<string, CacheEntry>();
  async get(key: string, now: number): Promise<Result<CacheEntry | undefined>> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt <= now) this.entries.delete(key);
    return { ok: true, value: entry && entry.expiresAt > now ? entry : undefined };
  }
  async put(entries: readonly CacheEntry[], now: number): Promise<Result<void>> {
    for (const [key, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(key);
    for (const entry of entries) this.entries.set(entry.key, entry);
    while (this.entries.size > 512) {
      const first = this.entries.keys().next().value;
      if (first !== undefined) this.entries.delete(first);
    }
    return { ok: true, value: undefined };
  }
  async check(): Promise<Result<void>> { return { ok: true, value: undefined }; }
}
