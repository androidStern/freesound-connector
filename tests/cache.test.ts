import { test, expect } from "vitest";
import { Miniflare } from "miniflare";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createD1MetadataCache } from "../db/cache";
import { createFreesoundClient } from "../lib/freesound";
import { searchSchema, previewInputSchema } from "../lib/sample-contract";

const sound = { id: 317096, name: "hat open2.wav", username: "shpira", duration: 1.00002, tags: ["hat"], url: "https://freesound.org/people/shpira/sounds/317096/", license: "http://creativecommons.org/publicdomain/zero/1.0/", previews: { "preview-hq-mp3": "https://cdn.freesound.org/previews/317/317096_656142-hq.mp3" }, images: {} };
test("D1 cache persists across worker restarts, distinguishes pages/filters, seeds previews, expires and refreshes", async () => {
  const path = await mkdtemp(join(tmpdir(), "freesound-cache-"));
  const start = () => new Miniflare({ modules: true, script: "export default { fetch() { return new Response('test'); } }", d1Databases: ["DB"], d1Persist: path, compatibilityDate: "2026-05-15" });
  let worker = start();
  try {
    let db = await worker.getD1Database("DB");
    for (const file of (await readdir("drizzle")).filter(f => f.endsWith(".sql")).sort()) {
      const sql = await readFile(join("drizzle", file), "utf8");
      for (const statement of sql.split("--> statement-breakpoint").filter(s => s.trim())) await db.prepare(statement).run();
    }
    let now = 1_800_000_000_000, calls = 0;
    const runtime = { now: () => now, sleep: async () => {}, fetch: async (input: RequestInfo | URL) => {
      calls++;
      return Response.json(new URL(String(input)).pathname === "/apiv2/search/" ? { count: 50, next: "https://freesound.org/apiv2/search/?page=2", previous: null, results: [sound] } : sound);
    } };
    let cache = createD1MetadataCache(db);
    let client = createFreesoundClient("fixture-key", runtime, cache);
    const query = searchSchema.parse({ query: "hi hat" });
    expect(await client.search(query)).toMatchObject({ ok: true, value: { cache: { hit: false } } });
    expect(await client.getPreview(previewInputSchema.parse({ sound_id: 317096 }))).toMatchObject({ ok: true, value: { cache: { hit: true }, encoding: "lossy-preview" } });
    expect(calls).toBe(1);
    await worker.dispose(); worker = start(); db = await worker.getD1Database("DB");
    cache = createD1MetadataCache(db); client = createFreesoundClient("fixture-key", runtime, cache);
    expect(await client.search(query)).toMatchObject({ ok: true, value: { cache: { hit: true } } }); expect(calls).toBe(1);
    await client.search(searchSchema.parse({ query: "hi hat", page: 2 }));
    await client.search(searchSchema.parse({ query: "hi hat", license: "all" }));
    await client.search(searchSchema.parse({ query: "hi hat", page_size: 3 }));
    await client.search(searchSchema.parse({ query: "hi hat", max_duration: 1 }));
    await client.search(searchSchema.parse({ query: "hi hat", sort: "created_desc" })); expect(calls).toBe(6);
    now += 15 * 60 * 1000 + 1;
    expect(await client.search(query)).toMatchObject({ ok: true, value: { cache: { hit: false } } }); expect(calls).toBe(7);
    await client.getSound(317096, { refresh: true }); expect(calls).toBe(8);
    expect(await cache.check()).toEqual({ ok: true, value: undefined });
    // Bounded capacity is enforced by real D1 SQL, including multi-record writes.
    for (let i = 0; i < 14; i++) {
      expect(await cache.put(Array.from({ length: 40 }, (_, n) => ({ key: `fixture:${i * 40 + n}`, value: { safe: true }, storedAt: now + i, expiresAt: now + 10000 })), now)).toMatchObject({ ok: true });
    }
    const count = await db.prepare("SELECT count(*) AS n FROM freesound_cache").first("n"); expect(count).toBe(512);
    expect(await cache.get("fixture:559", now + 10001)).toMatchObject({ ok: true, value: undefined });
  } finally { await worker.dispose(); await rm(path, { recursive: true, force: true }); }
}, 30000);

test("missing database is an explicit failure, not a silent cache miss", async () => {
  const cache = createD1MetadataCache(undefined);
  expect(await cache.get("sound:v2:1", 0)).toMatchObject({ ok: false, error: { code: "cache_unavailable", status: 503 } });
});
