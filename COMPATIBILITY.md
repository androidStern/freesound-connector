# Verification and compatibility

Freesound Connector by Song Machines 2.0.0 supplies data tools only. It has no custom UI, render tool, sample browser, sequencer or MCP Apps resource.

| Surface | Tools | Verification |
| --- | --- | --- |
| Official MCP SDK over Streamable HTTP | Yes | Initialization, exact four-tool discovery, authentication rejection and validation tested |
| ChatGPT web, generated Sites plugin | Verified | Version 2: four tools, live status, search, repeated-query cache hit, metadata and preview resolution |
| ChatGPT mobile / desktop | Platform-dependent | Not independently tested |
| Codex desktop / cloud | Platform-dependent | Not independently tested; installed plugin exposure depends on host/account |
| Codex CLI / IDE | Separate supported connection required | Not independently tested; do not overwrite existing MCP settings |
| Other remote MCP clients | Requires compatible Sites OAuth support | Not independently tested |
| Custom UI / arbitrary HTML tool bridge | Not provided | No UI capability or resource advertised |

Local suite: 16 tests covering provider responses, redaction, Retry-After, validation, MCP discovery and denied access, and real local D1 persistence across worker restarts. Cache tests cover expiry, refresh, distinct query settings, seeding preview metadata, bounded capacity and missing database errors. Typecheck and production build pass.

Maintainer's live check on 2026-10-07: the installed ChatGPT web plugin returned configured/live/cache readiness true. Two identical CC0 snare searches returned a miss followed by a hit with unchanged timestamps; the hosted D1 table independently confirmed the stored records. The production Worker bundle also retrieved an actual 20,349-byte Freesound preview through a tool-only client in a local live-provider test. Anonymous deployed MCP requests were rejected. Per-deployment details and post-redeploy checks remain in the owner's private handoff.

Fresh users still need to create or reuse their own Freesound credential, save it in their own Site secret settings, and install/connect their own generated plugin. Browser automation is not required. Form labels were checked against official Freesound source; the Sites settings link and controls were inspected in ChatGPT web. This does not claim an end-to-end test under a second person's account.

Deploying agents must record their actual live connection checks, preview retrieval and post-redeploy cache persistence. Do not copy a maintainer's pass result as proof for a new deployment.
