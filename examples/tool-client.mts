// Supply an MCP SDK Client that is ALREADY connected through Sites OAuth.
// The Freesound key belongs only to the hosted Site's secret store.
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createLibraryClient, readAudioToolResult } from '../lib/sample-adapter';

export async function retrieveSample(mcp: Client, query = 'snare') {
  const library = createLibraryClient({
    async callTool(name, args) {
      const result = await mcp.callTool({ name, arguments: args });
      if (result.isError) throw new Error(`Connector tool ${name} failed`);
      return result.structuredContent;
    },
  });
  const page = await library.search({ query, license: 'cc0', page_size: 12 });
  const sound = page.results[0];
  if (!sound) return undefined;
  // Keep the WHOLE MCP result: structuredContent alone omits the audio bytes.
  const result = readAudioToolResult(await mcp.callTool({ name: 'get_audio', arguments: { sound_id: sound.id } }));
  if (!result.ok) throw new Error(result.error.message);
  const { audio, provenance } = result.value;
  // Browser prototype: decode with its own AudioContext after a user gesture,
  // then replace the instrument buffer only after decoding succeeds.
  // Tool-only clients can save/process these bytes without browser globals.
  return { audio, provenance };
}
