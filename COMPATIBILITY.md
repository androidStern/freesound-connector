# Verification and compatibility

Freesound Connector by Song Machines 2.2.0 supplies data tools only. The bundled Site thumbnail is a static branding asset. It has no custom UI, render tool, sample browser, sequencer or MCP Apps resource.

| Surface | Tools | Verification |
| --- | --- | --- |
| Official MCP SDK over Streamable HTTP | Yes | Initialization, exact five-tool discovery, authentication rejection and validation tested |
| ChatGPT web, generated Sites plugin | Verified | 2.0.0: four tools, live status, search, repeated-query cache hit, metadata and preview resolution |
| ChatGPT mobile / desktop | Platform-dependent | Mobile Intelligent UI direct-CDN loading was reported blocked by CSP. New native `get_audio` delivery to its generated widget is not independently verified. |
| Codex desktop | Verified | 2.0.0 installed plugin: live status, CC0 search and metadata; later per-release checks are recorded in the instance handoff |
| Codex cloud | Platform-dependent | Not independently tested; installed plugin exposure depends on host/account |
| Codex CLI / IDE | Separate supported connection required | Not independently tested; do not overwrite existing MCP settings |
| Other remote MCP clients | Requires compatible Sites OAuth support | Not independently tested |
| Custom UI / arbitrary HTML tool bridge | Not provided | No UI capability or resource advertised |

Local suite: 27 tests covering provider responses, redaction, Retry-After, validation, MCP discovery and denied access, and real local D1 persistence across worker restarts. Cache tests cover expiry, refresh, distinct query settings, seeding preview metadata, bounded capacity and missing database errors. Typecheck passes; run the supported production build before publishing.

2.1.0 local verification also checks that MCP initialization reports the package version, server instructions point to the update guide, and connection_status returns validated release metadata even when no Freesound key is configured. The build includes the exact 1200 × 630 thumbnail. A natural-language update is an agent workflow requiring Sites publishing access, not a new MCP tool or an autonomous updater. Follow UPDATING.md and record real deployment checks for each instance.

Maintainer's live check on 2026-10-07: the installed ChatGPT web plugin returned configured/live/cache readiness true. Two identical CC0 snare searches returned a miss followed by a hit with unchanged timestamps; the hosted D1 table independently confirmed the stored records. The production Worker bundle also retrieved an actual 20,349-byte Freesound preview through a tool-only client in a local live-provider test. Anonymous deployed MCP requests were rejected. Per-deployment details and post-redeploy checks remain in the owner's private handoff.

Fresh users still need to create or reuse their own Freesound credential, save it in their own Site secret settings, and install/connect their own generated plugin. Browser automation is not required. Form labels were checked against official Freesound source; the Sites settings link and controls were inspected in ChatGPT web. This does not claim an end-to-end test under a second person's account.

Deploying agents must record their actual live connection checks, preview retrieval and post-redeploy cache persistence. Do not copy a maintainer's pass result as proof for a new deployment.

2.2.0 adds `get_audio` as native MCP audio content with separate structured provenance. Tests verify exact byte transfer through the official SDK and HTTP handler, an audio download larger than the former 12 MiB cap, concurrent tool calls while an audio download is pending, no key on CDN requests, redirects/login HTML rejection, HTTP errors, Retry-After, cancellation, and anonymous-access rejection. Audio bytes are not cached.

A local HTTP MCP round trip on 2026-10-08 fetched real sound 317096 from the live Freesound CDN using metadata obtained through the installed authenticated connector. It returned 20,349 MP3 bytes (SHA-256 `6503048f340fb4ea2d00f51d63e7fc513583b3f9a74f6081d80770db52d90be7`), no ordinary text blocks, and the exact provenance. FFmpeg decoded it successfully: 44.1 kHz stereo, approximately one second. This proves the implementation and live CDN transfer; it does not prove the ChatGPT mobile Intelligent UI bridge exposes native audio to generated widgets.
