import { expect, test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createFreesoundClient, type ProviderRuntime } from "../lib/freesound";
import { MemoryMetadataCache } from "../lib/metadata-cache";
import { previewInputSchema } from "../lib/sample-contract";
import { readAudioToolResult } from "../lib/sample-adapter";
import { handleSampleRequest } from "../lib/sample-server";

const sound = {
  id: 317096, name: "hat open2.wav", username: "shpira", duration: 1.00002,
  tags: ["hat", "open"], url: "https://freesound.org/people/shpira/sounds/317096/",
  license: "http://creativecommons.org/publicdomain/zero/1.0/",
  previews: { "preview-hq-mp3": "https://cdn.freesound.org/previews/317/317096_656142-hq.mp3" }, images: {},
};
const input = previewInputSchema.parse({ sound_id: sound.id });
const smallAudio = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]);
function provider(media: (init?: RequestInit) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const runtime: ProviderRuntime = {
    now: () => 0, sleep: async () => {},
    fetch: async (url, init) => {
      const request = new Request(url, init); requests.push(request);
      if (request.url.startsWith("https://freesound.org/apiv2/")) return Response.json(sound);
      expect(request.url).toBe(sound.previews["preview-hq-mp3"]);
      expect(request.headers.get("Authorization")).toBeNull();
      expect(request.credentials).toBe("omit");
      expect(request.redirect).toBe("manual");
      return media(init);
    },
  };
  return { runtime, requests, client: createFreesoundClient("server-only-test-key", runtime) };
}

test("audio larger than the former 12 MiB cap is returned unchanged; only metadata is cached", async () => {
  const bytes = new Uint8Array(13 * 1024 * 1024); bytes.set(smallAudio);
  const p = provider(() => new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(bytes.length) } }));
  const result = await p.client.getAudio(input);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(Buffer.from(result.value.bytes).equals(Buffer.from(bytes))).toBe(true);
  expect(result.value.preview).toMatchObject({ sound_id: sound.id, creator: sound.username, encoding: "lossy-preview", license: { exact: sound.license } });
  await p.client.getAudio(input);
  expect(p.requests.filter(request => new URL(request.url).pathname.startsWith("/apiv2/"))).toHaveLength(1);
  expect(p.requests.filter(request => new URL(request.url).pathname.startsWith("/previews/"))).toHaveLength(2);
});

test.each([
  [401, "unauthorized"], [403, "forbidden"], [404, "unavailable_preview"], [500, "upstream"],
])("audio HTTP %i is an explicit error", async (status, code) => {
  const p = provider(() => new Response("do not return this body", { status: Number(status) }));
  expect(await p.client.getAudio(input)).toMatchObject({ ok: false, error: { code, status } });
});

test("audio rate limits preserve Retry-After without repeating the download", async () => {
  const p = provider(() => new Response(null, { status: 429, headers: { "Retry-After": "90" } }));
  expect(await p.client.getAudio(input)).toMatchObject({ error: { code: "rate_limited", retry_after_seconds: 90 } });
  expect(p.requests).toHaveLength(2);
});

test("audio redirects and login HTML are rejected, including HTML mislabeled as audio", async () => {
  for (const response of [
    new Response(null, { status: 302, headers: { Location: "https://evil.example/login" } }),
    new Response("<html>Login</html>", { headers: { "Content-Type": "text/html" } }),
    new Response("<html>Login</html>", { headers: { "Content-Type": "audio/mpeg" } }),
    new Response(null, { headers: { "Content-Type": "audio/mpeg" } }),
  ]) {
    const p = provider(() => response);
    const result = await p.client.getAudio(input);
    expect(result.ok).toBe(false);
    expect(p.requests).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("Login");
  }
});

test("caller cancellation and network failures remain redacted typed failures", async () => {
  const controller = new AbortController();
  const cancelled = provider(init => { controller.abort(); init?.signal?.throwIfAborted(); return new Response(smallAudio); });
  expect(await cancelled.client.getAudio(input, { signal: controller.signal })).toMatchObject({ error: { code: "cancelled" } });
  const failed = provider(() => { throw new Error("server-only-test-key must not enter the result"); });
  const result = await failed.client.getAudio(input);
  expect(result).toMatchObject({ error: { code: "upstream" } });
  expect(JSON.stringify(result)).not.toContain("server-only-test-key");
});

async function connectedClient(runtime: ProviderRuntime) {
  const client = new Client({ name: "audio-test", version: "1" });
  const cache = new MemoryMetadataCache();
  await client.connect(new StreamableHTTPClientTransport(new URL("https://private.example/mcp"), {
    fetch: (url, init) => handleSampleRequest(new Request(url, init), "server-only-test-key", cache, runtime),
    requestInit: { headers: { "oai-authenticated-user-id": "local-test" } },
  }));
  return client;
}

test("Streamable HTTP transfers an embedded audio file and provenance without base64 in text or structured content", async () => {
  const p = provider(() => new Response(smallAudio, { headers: { "Content-Type": "audio/mpeg" } }));
  const client = await connectedClient(p.runtime);
  try {
    const result = await client.callTool({ name: "get_audio", arguments: { sound_id: sound.id } });
    const decoded = readAudioToolResult(result);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(new Uint8Array(decoded.value.audio)).toEqual(smallAudio);
    expect(decoded.value.provenance).toMatchObject({ delivery: "mcp-audio", byte_length: smallAudio.length, sound_id: sound.id, license: { exact: sound.license } });
    expect(result.content).toEqual([{ type: "resource", resource: { uri: "freesound-preview://317096/hq.mp3", mimeType: "audio/mpeg", blob: Buffer.from(smallAudio).toString("base64") } }]);
    expect(JSON.stringify(result.structuredContent)).not.toContain(Buffer.from(smallAudio).toString("base64"));
    expect(await client.callTool({ name: "get_audio", arguments: { sound_id: -1 } })).toMatchObject({ isError: true });
    expect(await client.callTool({ name: "get_audio", arguments: { sound_id: sound.id, url: "https://evil.example" } })).toMatchObject({ isError: true });
    expect(readAudioToolResult({ ...result, content: [] })).toMatchObject({ error: { code: "invalid_response" } });
    expect(readAudioToolResult({ ...result, content: [{ type: "audio", mimeType: "audio/mpeg", data: Buffer.from(smallAudio).toString("base64") }] }).ok).toBe(true);
    expect(readAudioToolResult({ ...result, content: [{ type: "resource", resource: { uri: "freesound-preview://1/hq.mp3", mimeType: "audio/mpeg", blob: Buffer.from(smallAudio).toString("base64") } }] })).toMatchObject({ error: { code: "invalid_response" } });
  } finally { await client.close(); }
});

test("a pending audio download does not prevent another tool call from completing", async () => {
  let releaseAudio: (() => void) | undefined;
  let reportStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { reportStarted = resolve; });
  const p = provider(() => new Promise<Response>(resolve => {
    releaseAudio = () => resolve(new Response(smallAudio, { headers: { "Content-Type": "audio/mpeg" } }));
    reportStarted?.();
  }));
  const client = await connectedClient(p.runtime);
  let audio: ReturnType<Client["callTool"]> | undefined;
  try {
    audio = client.callTool({ name: "get_audio", arguments: { sound_id: sound.id } });
    await started;
    const status = await client.callTool({ name: "connection_status", arguments: {} });
    expect(status.structuredContent).toMatchObject({ live_request_succeeded: true });
    releaseAudio?.();
    expect(readAudioToolResult(await audio).ok).toBe(true);
  } finally { releaseAudio?.(); await audio; await client.close(); }
});

test("anonymous get_audio is rejected before provider access", async () => {
  const p = provider(() => new Response(smallAudio));
  const response = await handleSampleRequest(new Request("https://private.example/mcp", {
    method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_audio", arguments: { sound_id: sound.id } } }),
  }), "server-only-test-key", new MemoryMetadataCache(), p.runtime);
  expect(response.status).toBe(401);
  expect(p.requests).toHaveLength(0);
});
