import { test, expect } from "vitest";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { handleSampleRequest } from "../lib/sample-server";
import packageManifest from "../package.json";
import { statusSchema } from "../lib/sample-contract";

test("official SDK initializes and discovers four tools without any UI resource without provider access", async () => {
  const client = new Client({ name: "library-test", version: "1" });
  const transport = new StreamableHTTPClientTransport(new URL("https://private.example/mcp"), { fetch: async (input, init) => { const request = new Request(input, init); const response = await handleSampleRequest(request, undefined); if (!response) throw new Error("Route missing"); return response; } });
  await client.connect(transport); const list = await client.listTools(); expect(list.tools.map(t => t.name)).toEqual(["search_sounds", "get_sound", "get_preview", "connection_status"]);
  expect(client.getServerVersion()?.version).toBe(packageManifest.version);
  expect(client.getInstructions()).toContain("https://github.com/androidStern/freesound-connector/blob/main/UPDATING.md");
  for (const tool of list.tools) expect(tool._meta).toBeUndefined();
  expect(client.getServerCapabilities()?.resources).toBeUndefined();
  await expect(client.listResources()).rejects.toThrow("Method not found");
  await expect(client.callTool({ name: "search_sounds", arguments: { query: "hi hat" } })).rejects.toThrow(); await client.close();
});
test("private API denies anonymous access and cross-origin requests", async () => {
  const denied = await handleSampleRequest(new Request("https://private.example/mcp", { method: "POST", body: JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"get_sound",arguments:{sound_id:1}}}) }), "server-only-test-key"); expect(denied?.status).toBe(401);
  const forged = await handleSampleRequest(new Request("https://private.example/mcp", { method: "POST", headers: { Origin: "https://evil.example", "oai-authenticated-user-id": "local-test" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_sound", arguments: { sound_id: 1 } } }) }), "server-only-test-key"); expect(forged?.status).toBe(403);
});
test("authenticated connection status returns unconfigured; invalid input is visible", async () => {
  const call = (name: string, args: object) => handleSampleRequest(new Request("https://private.example/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "oai-authenticated-user-id": "local-test" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) }), undefined);
  const result = await call("connection_status", {});
  const body = z.object({ result: z.object({ structuredContent: statusSchema }) }).parse(await result.json());
  const status = body.result.structuredContent;
  expect(status).toMatchObject({ configured: false, live_request_succeeded: false, release: {
    version: packageManifest.version,
    repository_url: "https://github.com/androidStern/freesound-connector",
    releases_url: "https://github.com/androidStern/freesound-connector/releases",
    update_instructions_url: "https://github.com/androidStern/freesound-connector/blob/main/UPDATING.md",
  } });
  const invalid = await call("get_sound", { sound_id: -1 }); expect(await invalid?.json()).toMatchObject({ result: { isError: true } });
});
