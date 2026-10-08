import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createLibraryClient } from "../lib/sample-adapter";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.LIBRARY_TEST_URL;
if (!base) throw new Error("LIBRARY_TEST_URL is required.");
const local = new URL(base).hostname.endsWith(".localhost") || new URL(base).hostname === "127.0.0.1";
// An OAuth access token must come from an already-authorized MCP client. A Sites
// service/bypass token has no user identity and cannot authorize these tools.
const headers: Record<string, string> = local ? { "oai-authenticated-user-id": "local-test", "oai-authenticated-user-email": "local-test@sites.test" } : process.env.LIBRARY_MCP_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.LIBRARY_MCP_ACCESS_TOKEN}` } : {};
const client = new Client({ name: "Freesound Connector verification", version: "1" });
await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", base), { requestInit: { headers } }));
try {
  const list = await client.listTools();
  const invoke = async (name: string, args: Record<string, unknown>) => { const r = await client.callTool({ name, arguments: args }); if (r.isError) throw new Error(`Tool ${name} failed`); return r.structuredContent; };
  const library = createLibraryClient({ callTool: invoke });
  const status = await invoke("connection_status", {});
  const search = await library.search({ query: "open hi hat", max_duration: 4 });
  const sound = await library.metadata(317096);
  const preview = await library.preview(sound.id);
  const bytes = await library.fetchAudio(preview);
  const broad = await library.search({ query: "forest birds", max_duration: 20, page_size: 2 });
  const repeated = await library.search({ query: "open hi hat", max_duration: 4 });
  if (!repeated.cache?.hit) throw new Error("Repeated search did not hit the persistent cache.");
  if (client.getServerCapabilities()?.resources) throw new Error("Unexpected UI resources.");
  const unauthorized = await fetch(new URL("/mcp", base), { method: "POST", headers: { Accept: "application/json, text/event-stream", "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "get_preview", arguments: { sound_id: sound.id } } }), redirect: "manual" });
  if (unauthorized.status === 200) throw new Error("Anonymous tool access was not rejected.");
  const report = { surface: local ? "local workerd" : "deployed Site with authorized MCP OAuth", checked_at: new Date().toISOString(), tools: list.tools.map(t => t.name), status, search_count: search.count, general_search_count: broad.count, sound, preview, preview_bytes: bytes.byteLength, repeated_cache: repeated.cache, unauthorized_status: unauthorized.status };
  await mkdir("outputs", { recursive: true }); await writeFile(local ? "outputs/live-local.json" : "outputs/live-deployed.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ surface: report.surface, tools: report.tools, status, search_count: search.count, general_search_count: broad.count, sound_id: sound.id, preview_bytes: bytes.byteLength, unauthorized_status: unauthorized.status }));
} finally { await client.close(); }
