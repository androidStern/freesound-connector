# Changelog

## 2.2.0 — 2026-10-08

- Added `get_audio`: fetches a sound preview server-side and returns a native MCP audio block with exact provenance and byte length. No extra Freesound key, public media endpoint, or UI.
- Removed the reusable download helper's old 12 MiB cap. Neither audio path imposes an application file-size cap.
- Added credential-free client decoding example and tests for binary transport, concurrent tool calls, downloads larger than the former cap, authorization, unsafe responses, cancellation, and errors.
- Documented asynchronous delivery versus progressive playback and the remaining ChatGPT Intelligent UI verification requirement. Metadata caching is unchanged; audio bytes are not cached.

Upgrade from 2.1.0: retain the same Site, plugin, secret and D1 database. No migrations or new permissions. Refresh the plugin's tool list if `get_audio` is missing. Existing four tools retain their contracts.

## 2.1.0 — 2026-10-08

- Branded 1200 × 630 Site thumbnail based on the Song Machines robot workshop, with Freesound Connector as the primary identity.
- Simple update prompt and full agent upgrade procedure for existing private Sites, including installations without a local checkout.
- `connection_status` now reports the installed release and canonical repository/update links. MCP initialization uses the same version as package.json and tells agents where to find the upgrade guide when the user requests an update.
- Versioned stable releases, clean template archives, checksums, and maintainer release instructions.
- Installation guidance prioritizes the in-chat Install card and treats its plugin URL as a fallback.

Upgrade from 2.0.0: no new secret, permissions, database migrations, cache reset, UI, or plugin installation is required. Keep the same Site and generated plugin. Existing clients may need to refresh tool discovery to see the richer `connection_status` description/output schema. The original status fields and four tool names remain available.

## 2.0.0 — 2026-10-08

Initial public source template (commit `43f351e7a81cffdc8893680b1a1cf2f63eb58a99`, published before numbered GitHub releases): tools-only Freesound connector, private Sites hosting, Sites OAuth, CC0-by-default search, metadata and preview tools, durable bounded D1 cache, and guided setup without requiring browser automation.
