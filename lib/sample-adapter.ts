import { searchOutputSchema, soundSchema, previewSchema, mediaUrlSchema, type SearchInput, type SearchResult, type Sound, type Preview } from "./sample-contract";

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
export async function fetchPreviewAudio(preview: Preview): Promise<ArrayBuffer> {
  mediaUrlSchema.parse(preview.url);
  return downloadAudio(preview.url, preview.mime_type, "omit");
}
async function downloadAudio(url: string, mime: string, credentials: RequestCredentials): Promise<ArrayBuffer> {
  const response = await fetch(url, { credentials, redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Preview could not be retrieved (HTTP ${response.status}).`);
  const type = response.headers.get("Content-Type")?.split(";")[0];
  if (![mime, "audio/mp3", "application/ogg", "application/octet-stream"].includes(type ?? "")) throw new Error("Preview returned non-audio content.");
  const limit = 12 * 1024 * 1024;
  if (Number(response.headers.get("Content-Length") ?? 0) > limit) throw new Error("Sample is larger than 12 MB.");
  const reader = response.body?.getReader(); if (!reader) throw new Error("Preview has no audio data.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > limit) { await reader.cancel(); throw new Error("Sample is larger than 12 MB."); } chunks.push(part.value); }
  const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; } return bytes.buffer;
}
