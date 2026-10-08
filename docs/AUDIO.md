# Actual audio through MCP

Call `get_audio` with `{ "sound_id": 317096 }`. Optional `quality` (`hq` / `lq`), `format` (`mp3` / `ogg`), and `refresh` work like `get_preview`. The server resolves the ID using Freesound metadata and downloads the available compressed preview. It sends the upstream key only to the Freesound API, never to the audio CDN.

The result has two parts:

```json
{
  "content": [{ "type": "audio", "mimeType": "audio/mpeg", "data": "<base64 audio bytes>" }],
  "structuredContent": {
    "delivery": "mcp-audio",
    "sound_id": 317096,
    "encoding": "lossy-preview",
    "byte_length": 20349
  }
}
```

This shortened example omits the remaining structured fields: name, creator, duration, exact license, attribution, source page, source preview URL, format, quality, expiry and metadata-cache timestamps. Sound 317096 is **hat open2.wav** by **shpira**, licensed **CC0**, source https://freesound.org/people/shpira/sounds/317096/. The returned MP3 is a compressed preview, despite the sound's original filename.

Preserve the **entire** MCP result. Passing only `structuredContent` discards the audio. `readAudioToolResult` in `lib/sample-adapter.ts` validates the result, converts the native audio block into an `ArrayBuffer`, and returns its provenance. `examples/tool-client.mts` demonstrates search → get_audio → bytes with an already-authorized MCP SDK client. It works without browser globals such as `window` or `AudioContext`.

For a browser instrument, call `AudioContext.resume()` from a user gesture, then `decodeAudioData(audio.slice(0))`. Replace the current buffer only after decoding succeeds. Preserve the sound ID and provenance in project state. This project does not bundle an instrument or UI. If the host does not expose the native audio block to its widget, report that limitation; do not silently fall back to a CSP-blocked URL or paste base64 into chat text.

## What streaming means here

Fetching is asynchronous: a pending audio download does not prevent other tool calls from completing. It does not imply that a caller can play a partially received MCP audio result.

The [MCP audio content format](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#audio-content) represents a complete base64 audio block. [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#receiving-messages) can deliver progress notifications before the final result. That is not a standard stream of playable audio chunks. The protocol's [streaming tool results proposal](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/117) remained open when checked on 2026-10-08.

Developer-authored MCP Apps can implement [repeated chunked tool calls](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/patterns.md#reading-large-amounts-of-data-via-chunked-tool-calls), but that requires matching client code. It is not an automatic streaming mode for ChatGPT's generated Intelligent UI. This connector intentionally uses the standard complete audio result without a custom chunk protocol or background job system.

## Storage, limits and authentication

- Search and sound metadata use the existing D1 cache. `cache` timestamps in an audio descriptor refer to metadata, not audio bytes. Each `get_audio` downloads its selected preview.
- There is no application audio file-size cap. The old direct-download helper's 12 MiB cap is removed too. Clients and hosting platforms can still impose their own response, memory and timeout limits; “no application cap” does not promise unlimited files. Base64 increases transfer size by roughly one third.
- The audio fetch has a 60-second network timeout and propagates caller cancellation. HTTP 429 preserves Retry-After; errors are explicit and redacted.
- Only previews resolved from a sound ID are fetched. Redirects, unapproved destinations, login HTML and mismatched audio content are rejected. No client supplies an arbitrary proxy URL.
- Sites OAuth still authorizes the MCP call. No public audio route is added. The Freesound key stays in the hosted secret store.

Native MCP audio transfer and exposure to a generated widget are separate host capabilities. Check COMPATIBILITY.md and the private instance handoff for actual host verification. Do not describe a local SDK round trip as a ChatGPT mobile playback test.
