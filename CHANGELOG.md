# Changelog

## 2.1.0 — 2026-10-08

- Branded 1200 × 630 Site thumbnail based on the Song Machines robot workshop, with Freesound Connector as the primary identity.
- Simple update prompt and full agent upgrade procedure for existing private Sites, including installations without a local checkout.
- `connection_status` now reports the installed release and canonical repository/update links. MCP initialization uses the same version as package.json and tells agents where to find the upgrade guide when the user requests an update.
- Versioned stable releases, clean template archives, checksums, and maintainer release instructions.
- Installation guidance prioritizes the in-chat Install card and treats its plugin URL as a fallback.

Upgrade from 2.0.0: no new secret, permissions, database migrations, cache reset, UI, or plugin installation is required. Keep the same Site and generated plugin. Existing clients may need to refresh tool discovery to see the richer `connection_status` description/output schema. The original status fields and four tool names remain available.

## 2.0.0 — 2026-10-08

Initial public source template (commit `43f351e7a81cffdc8893680b1a1cf2f63eb58a99`, published before numbered GitHub releases): tools-only Freesound connector, private Sites hosting, Sites OAuth, CC0-by-default search, metadata and preview tools, durable bounded D1 cache, and guided setup without requiring browser automation.
