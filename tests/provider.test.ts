import { describe, test, expect } from "vitest";
import { createFreesoundClient } from "../lib/freesound";
import { searchSchema, mediaUrlSchema } from "../lib/sample-contract";
import { MemoryMetadataCache } from "../lib/metadata-cache";
const raw = { id: 317096, name: "hat open2.wav", username: "shpira", duration: 1.00002, tags: ["hat", "open"], url: "https://freesound.org/people/shpira/sounds/317096/", license: "http://creativecommons.org/publicdomain/zero/1.0/", previews: { "preview-hq-mp3": "https://cdn.freesound.org/previews/317/317096_656142-hq.mp3" }, images: {} };
function provider(response: (url: URL, init?: RequestInit) => Response) {
  let now = 0; const requests: URL[] = []; const waits: number[] = [];
    const client = createFreesoundClient("server-only-test-key", { fetch: async (input, init) => { const url = new URL(String(input)); requests.push(url); expect(init?.headers).toEqual({ Authorization: "Token server-only-test-key", Accept: "application/json" }); expect(init?.redirect).toBe("manual"); return response(url, init); }, now: () => now, sleep: async ms => { waits.push(ms); now += ms; } }, new MemoryMetadataCache());
  return { client, requests, waits };
}
describe("Freesound policy through upstream seam", () => {
  test("uses current endpoint, CC0 default, pagination, general queries and bounded cache", async () => {
    const p = provider(() => Response.json({ count: 44, next: "https://freesound.org/apiv2/search/?page=2", previous: null, results: [raw] }));
    const input = searchSchema.parse({ query: "forest birds", min_duration: 0.3, max_duration: 4 });
    const a = await p.client.search(input); expect(a.ok).toBe(true); if (!a.ok) return;
    expect(p.requests[0]?.pathname).toBe("/apiv2/search/"); expect(p.requests[0]?.searchParams.get("filter")).toBe('license:"Creative Commons 0" duration:[0.3 TO 4]'); expect(a.value.next_page).toBe(2); expect(a.value.results[0]?.license.exact).toBe(raw.license);
    await p.client.search(input); expect(p.requests).toHaveLength(1);
  });
  test("distinguishes no results and explicit expanded licensing", async () => {
    const p = provider(() => Response.json({ count: 0, next: null, previous: null, results: [] })); const r = await p.client.search(searchSchema.parse({ query: "unmatched", license: "all" })); expect(r).toMatchObject({ ok: true, value: { count: 0, results: [] } }); expect(p.requests[0]?.searchParams.get("filter")).toBe(null);
  });
  test.each([401, 403, 404])("reports HTTP %i and redacts upstream credential reflection", async status => {
    const p = provider(() => Response.json({ detail: "Rejected server-only-test-key" }, { status })); const r = await p.client.getSound(317096); expect(r.ok).toBe(false); expect(JSON.stringify(r)).not.toContain("server-only-test-key"); expect(r).toMatchObject({ error: { status } });
  });
  test("respects a long Retry-After without prematurely retrying", async () => {
    const p = provider(() => Response.json({ detail: "throttled" }, { status: 429, headers: { "Retry-After": "90" } })); const r = await p.client.getSound(317096); expect(r).toMatchObject({ error: { code: "rate_limited", retry_after_seconds: 90 } }); expect(p.requests).toHaveLength(1);
  });
  test("retries a short Retry-After then resolves authoritative preview", async () => {
    let i = 0; const p = provider(() => i++ === 0 ? Response.json({ detail: "throttled" }, { status: 429, headers: { "Retry-After": "1" } }) : Response.json(raw)); const r = await p.client.getPreview({ sound_id: 317096, quality: "hq", format: "mp3", refresh: false }); expect(p.waits).toEqual([1000]); expect(r).toMatchObject({ ok: true, value: { encoding: "lossy-preview", mime_type: "audio/mpeg", sound_id: 317096, expires_at: null } });
  });
  test("missing and unsafe media is an explicit failure", async () => {
    const p = provider(() => Response.json({ ...raw, previews: { "preview-hq-mp3": "https://evil.example/audio.mp3" } })); expect(await p.client.getPreview({ sound_id: 317096, quality: "hq", format: "mp3", refresh: false })).toMatchObject({ error: { code: "unavailable_preview" } });
  });
  test("rejects oversized upstream responses", async () => { const p = provider(() => new Response("", { headers: { "Content-Length": "3000000" } })); expect(await p.client.getSound(1)).toMatchObject({ error: { code: "oversized" } }); });
  test("status is fresh and never includes credentials", async () => { const p = provider(() => Response.json({ count: 1, results: [{ id: 1 }] })); await p.client.status(); await p.client.status(); expect(p.requests).toHaveLength(2); expect(JSON.stringify(await p.client.status())).not.toContain("server-only-test-key"); });
  test("invalid ranges and proxy destinations fail validation", () => { expect(searchSchema.safeParse({ query: "hi hat", min_duration: 4, max_duration: 1 }).success).toBe(false); for (const url of ["http://cdn.freesound.org/previews/1/a.mp3", "https://freesound.org/login/", "https://cdn.freesound.org/previews/1/a.mp3?token=x", "https://127.0.0.1/previews/1/a.mp3"]) expect(mediaUrlSchema.safeParse(url).success).toBe(false); });
});
