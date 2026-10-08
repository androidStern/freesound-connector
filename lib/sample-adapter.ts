import { z } from "zod";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { searchOutputSchema, soundSchema, previewSchema, audioDescriptorSchema, failureSchema, type SearchInput, type SearchResult, type Sound, type Preview, type AudioDescriptor, type Result } from "./sample-contract";
import { downloadPreviewAudio } from "./preview-audio";

/** Transport carries no Freesound credential. MCP clients supply their own authorized tool invoker. */
export interface LibraryTransport { callTool(name: string, args: Record<string, unknown>): Promise<unknown>; fetchAudio?(preview: Preview): Promise<ArrayBuffer> }
/** Works in Node and browser clients. Binary is downloaded separately from tool text. */
export function createLibraryClient(transport: LibraryTransport) {
  return {
    async search(input: SearchInput): Promise<SearchResult> { return searchOutputSchema.parse(await transport.callTool("search_sounds", input)); },
    async metadata(soundId: number): Promise<Sound> { return soundSchema.parse(await transport.callTool("get_sound", { sound_id: soundId })); },
    async preview(soundId: number): Promise<Preview> { return previewSchema.parse(await transport.callTool("get_preview", { sound_id: soundId })); },
    async fetchAudio(preview: Preview): Promise<ArrayBuffer> { return transport.fetchAudio ? transport.fetchAudio(preview) : fetchPreviewAudio(preview); },
  };
}
export type LibraryClient = ReturnType<typeof createLibraryClient>;
/** Optional direct-CDN delivery. Rejects with a redacted error when the browser/provider denies access. */
export async function fetchPreviewAudio(preview: Preview): Promise<ArrayBuffer> {
  const result = await downloadPreviewAudio(preview, { fetch: globalThis.fetch.bind(globalThis), now: Date.now });
  if (!result.ok) throw new Error(result.error.message);
  return result.value.buffer;
}

/** Decode the complete get_audio MCP result in Node or a browser; never fetch its provenance URL. */
export function readAudioToolResult(value: unknown): Result<{ readonly audio: ArrayBuffer; readonly provenance: AudioDescriptor }> {
  const invalid = (message: string): Result<never> => ({ ok: false, error: { code: "invalid_response", message, status: 502 } });
  const parsed = CallToolResultSchema.safeParse(value);
  if (!parsed.success) return invalid("The client did not supply a complete MCP tool result.");
  if (parsed.data.isError) {
    for (const content of parsed.data.content) {
      if (content.type !== "text") continue;
      try {
        const failure = z.object({ error: failureSchema }).safeParse(JSON.parse(content.text));
        if (failure.success) return { ok: false, error: failure.data.error };
      } catch { /* Error text is not always JSON. */ }
    }
    return invalid("The audio tool returned an error.");
  }
  const provenance = audioDescriptorSchema.safeParse(parsed.data.structuredContent);
  const blocks = parsed.data.content.filter(content => content.type === "audio");
  const block = blocks[0];
  if (!provenance.success || blocks.length !== 1 || !block || block.mimeType !== provenance.data.mime_type) {
    return invalid("The host did not deliver one native audio block with matching provenance.");
  }
  try {
    const binary = atob(block.data);
    if (binary.length !== provenance.data.byte_length) return invalid("The audio result is incomplete.");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { ok: true, value: { audio: bytes.buffer, provenance: provenance.data } };
  } catch { return invalid("The audio result has invalid binary encoding."); }
}
