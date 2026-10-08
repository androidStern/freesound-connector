# Freesound Connector by Song Machines

![Freesound Connector by Song Machines](public/screenshot.jpeg)

A personal, hosted Freesound MCP. Search sounds, retrieve metadata and resolve preview audio from your assistants. Each person deploys their own private ChatGPT Site, stores their own Freesound key once, and installs that Site's private plugin. No sample browser, sequencer, dashboard, MCP App, or other custom UI is included.

## Give this to your agent

> Read https://github.com/androidStern/freesound-connector and follow README.md and AGENTS.md to deploy my private Freesound Connector by Song Machines. Handle setup and guide me through saving my key in Sites settings and installing my plugin. Never ask me to paste the key into chat.

This is the public source template. Each person deploys their own private Site and generated plugin; the repository does not connect users to the maintainer's instance.

You do not have to fork a repository or use a terminal. Your agent can download the source. It needs Sites deployment tools in ChatGPT web or desktop. Browser automation is optional. An agent with only shell access can prepare the project, but cannot claim it deployed a Site without a supported publishing capability.

## Update your connector

With your connector available in the chat, say:

> Update my Freesound Connector.

The connector reports its installed version and links the agent to this repository's update guide. In a fresh chat without that context, use:

> Read https://github.com/androidStern/freesound-connector and follow UPDATING.md to update my existing Freesound Connector to the latest stable release.

Your agent does the update, testing, and deployment. Your existing Site, plugin, saved key, private access, and database are retained. Ordinary updates do not require creating another Freesound application or reinstalling the plugin. Complete an account connection or platform approval only if the platform requests it. The agent needs Sites publishing tools as it did during installation.

Updates are opt-in. Publishing a GitHub release does not change anyone's deployed instance. See [releases](https://github.com/androidStern/freesound-connector/releases), [what changed](CHANGELOG.md), and [the agent update guide](UPDATING.md). If already on the latest release, the agent should tell you and avoid an unnecessary redeployment.

## Instructions for the deploying agent

For any update/upgrade request, including "update my free sound connector", follow [UPDATING.md](UPDATING.md) instead of repeating the onboarding below. Never create another Site just because the local source is missing.

Follow these steps actively. Do not respond with this checklist and ask the user to implement it. Present one small user action at a time; resume technical work when they confirm it is done. Never ask them to paste their key into chat, upload a credential file, or send a screenshot of their credentials.

### 1. Check capabilities and create their private instance

Read AGENTS.md and the current installed Sites building, hosting and MCP instructions. Find native Sites deployment and plugin installation tools. If they are unavailable, explain this exact prerequisite: open this setup conversation in ChatGPT web or desktop with the Sites plugin available, then paste the same prompt. Do not substitute a paid host, localhost, local MCP configuration, or a shared server.

For a normal new installation, resolve the [latest stable release](https://github.com/androidStern/freesound-connector/releases/latest), read its release notes, and use its exact tag/commit source. The public GitHub API at `https://api.github.com/repos/androidStern/freesound-connector/releases/latest` works without a GitHub account. Prefer the attached clean template ZIP and verify its SHA-256 against the release's SHA256SUMS file. Do not use an unreleased main branch or a prerelease unless the user explicitly requests it. Read README.md and AGENTS.md from that selected release before proceeding; record the tag and resolved commit in the private handoff.

Inspect `.openai/hosting.json`. The distribution template has no `project_id`. Register one new Site in the user's account with the title **Freesound Connector by Song Machines**, then save the returned project ID. On retries and updates, reuse that exact ID; do not create duplicates. Keep owner-private access. Declare `capabilities: ["mcp"]`, `d1: "DB"`, and `r2: null`. Sites provisions its database; no separate Cloudflare account is needed.

Use the installed Sites workflow with this supported Vinext/Workers project. Select the execution profile for the current environment, install dependencies, run typecheck and tests, build, and deploy through Sites. Include the existing Drizzle migration; do not rewrite an applied migration or create tables at runtime. This first deployment works without a key: discovery works and `connection_status` reports `configured: false`. Record the actual deployed URL and exact MCP/plugin IDs returned by Sites.

Preserve the bundled `public/screenshot.jpeg` in the deployment artifact. It is the Site's branded thumbnail, not an interactive UI. Do not replace it with an automatic capture of the connector's plain response. A Site thumbnail and the plugin's listing icon are separate platform assets.

Before asking for a new key, inspect the hosted environment variable metadata. A secret's value may be returned as null because it is masked; this does not mean it is missing. If already configured, test the live connection when authorized, and preserve a valid existing key. Never rotate, overwrite, or revoke a credential without the user's request.

### 2. Guide the user to Freesound credentials

Give this direct clickable link: **[Freesound API credentials](https://freesound.org/apiv2/apply/)**. It redirects to Freesound sign-in if needed. The user signs in, or uses **Join now** and completes account verification themselves.

Ask them to reuse credentials already created for their own instance if present. Otherwise give this exact form guidance:

1. Find **Create new API credentials**.
2. **Name\***: `Freesound Connector by Song Machines`.
3. **URL**: their actual deployed Site URL. Supply it ready to copy.
4. **Callback URL**: leave blank. This connector uses token authentication and does not implement Freesound OAuth.
5. **Description\***: `A private personal MCP connector for searching Freesound, reading sound metadata and auditioning previews through my AI assistants.` Tell them to adapt this truthfully to their use.
6. Ask them to review Freesound's API terms. If they agree, they check its acceptance box and click **Request new access credentials**.
7. In the credentials table, copy the value under **Client secret/Api key**. This is the API key; there is no second secret to obtain. The Client id is not used by this connector.

The credentials URL and column are documented by [Freesound](https://freesound.org/docs/api/authentication.html). Form labels were checked against Freesound's [official form source](https://github.com/MTG/freesound/blob/master/apiv2/forms.py) and [credentials page template](https://github.com/MTG/freesound/blob/master/templates/api/credentials.html), 2026-10-07. Signed-in UI can change. If labels differ, ask the user for the nonsecret field/button labels they see; never ask for the credential table itself or pretend you inspected their screen.

### 3. Guide secret entry in Sites settings

Give a direct settings link when possible. The verified web route is `https://chatgpt.com/space/sites/PROJECT_ID/settings`, substituting only the actual project ID returned by Sites. Prefer a settings URL returned by the platform if available. Do not reuse the template author's ID.

Also give the fallback: open **[Sites](https://chatgpt.com/sites)**, find **Freesound Connector by Song Machines**, open its **More actions** menu, and select **Settings**. Under **Environment variables**, click **Add variable**. Enter `FREESOUND_API_KEY` in **Key**, enable its **Secret** switch before entering the credential, and paste the copied credential into **Value**. Complete any save action shown; this web settings version saves valid edits automatically. These labels and the direct settings route were inspected on 2026-10-07. If the interface changes, ask for nonsecret button labels; do not require computer use.

Tell the user: **“Paste the key in Sites settings, not here. Tell me ‘saved’ when you have saved it.”** Do not ask them to repeat their key. If the settings page cannot save secrets for their account, report that specific platform blocker; do not invent a custom credential-collection form.

After they confirm, inspect secret metadata only. Redeploy the same approved Site version so the new secret configuration takes effect. Never print the hosted value. If a key already exists, preserve it unless the user requested replacement. [Sites secret settings](https://learn.chatgpt.com/docs/sites#configure-runtime-environment-values).

### 4. Hand them their own installation card and link

Call Sites `get_site` with `include_mcp_connection: true`. Use the returned plugin ID with the native plugin suggestion/installation tool. Also supply the actual plugin page link. The verified pattern is `https://chatgpt.com/plugins/PLUGIN_ID`; use only their returned ID. The page must refer to **their** Site's generated plugin.

When the installation card is visible, say: **“Click Install on the card here, then Connect if shown, and complete the account authorization. Tell me when it is connected.”** Present the exact plugin link as a fallback to that same card, not as another required step. Some accounts combine these steps. Leave account selection, consent and approval controls to the user. The fallback is **Plugins → Personal → Created by you → Freesound Connector by Song Machines**.

Sites creates the associated plugin; do not build a second plugin, publish it to a directory, or use `codex mcp add/login` for this native Sites installation. A connected plugin does not grant arbitrary HTML access to its tools. [Official installation workflow](https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites).

For an existing installation being updated, use its **Manage → Refresh tools** control if discovery still shows removed tools. Renaming the Site alone may leave the plugin's old name: **Manage → Manage app → App name → Edit** and **App description → Edit** update that metadata. These owner controls were verified on 2026-10-07. If the agent cannot operate them, give the user their exact plugin link and only the necessary click instructions. A new deployment should already use the requested title.

### 5. Verify and hand over

After connection, refresh available tool discovery and run `connection_status`, a CC0 search, `get_sound`, and `get_preview` through the actual deployed connection. A successful status has `configured`, `live_request_succeeded`, and `cache_ready` all true. Repeat the exact search and verify `cache.hit: true` with unchanged `stored_at`. Validate a preview by fetching its CDN URL without any credential. No original-file download is implied.

Check anonymous deployed tool calls are rejected. Verify initialization lists exactly four tools and no UI capabilities/resources. Test cache persistence after a same-version redeploy when supported. No generated token, forged identity header, public-sharing change, or service bypass may be used to make this pass. Local tests are separately labeled.

If their connected tool is not available in the current agent runtime, do not claim success. Give this prompt for a fresh supported chat with the connector selected: **“Check my Freesound connection, search for CC0 open hi hats, and resolve one preview.”** Record exactly which live verification remains unperformed.

Create a private, secret-free `RETURN-HANDOFF.md` for their instance with real Site/MCP/plugin/settings links, project/plugin IDs, installed version, upstream release tag and resolved commit, deployed saved-version ID, the four tools, one actual sound result, successful checks and unresolved client limitations. Include the short update prompt and canonical update-guide URL. Keep it out of the distributable template. Finish with their installation link and a useful first prompt, not a long developer checklist. Do not promise automatic installation synchronization to every client.

## Tools

| Tool | Example input | Result |
| --- | --- | --- |
| `search_sounds` | `{"query":"open hi hat","page":1,"page_size":12,"license":"cc0","max_duration":4}` | Count, next/previous page, real sound metadata and cache timestamps |
| `get_sound` | `{"sound_id":317096}` | ID, name, creator, duration, tags, source URL, exact license, attribution, available previews and waveforms |
| `get_preview` | `{"sound_id":317096,"quality":"hq","format":"mp3"}` | Typed compressed preview descriptor, CDN URL and provenance |
| `connection_status` | `{}` | Configuration, live provider success, timestamp, D1 readiness, installed release, update-guide URL, redacted errors |

Search supports relevance (`sort: "score"`), duration, date, downloads and rating sorting. Page size defaults to 12, maximum 40. Licenses are `cc0` (default), `attribution`, `attribution-noncommercial`, or `all`; broaden only when explicitly requested. Optional duration bounds are seconds. Search, metadata and preview tools accept `refresh: true` for an explicitly fresh request.

Example provenance: sound **317096**, **hat open2.wav** by **shpira**, duration **1.00002 s**, source https://freesound.org/people/shpira/sounds/317096/, exact license http://creativecommons.org/publicdomain/zero/1.0/. Its HQ MP3 is a compressed preview, not the original WAV. Resolve by ID again when needed; do not persist a media URL as the only identifier.

## Architecture and cache

The private Site hosts Streamable HTTP at `/mcp`. Sites OAuth controls client access. The Worker sends the Freesound key only in an `Authorization: Token` header to `freesound.org`. The key is never an MCP argument, plugin password, database value or frontend setting.

Sites D1 stores validated metadata only: search pages for 15 minutes, sound metadata for one hour. Search results populate the per-sound cache, avoiding another API request to resolve those previews. The exact search parameters form the page key. The cache is bounded to 512 entries, at most 1 MiB each; expired entries are never served and are cleaned on subsequent writes. It persists across Worker restarts and ordinary redeploys. Simultaneous first-time misses can still make multiple provider requests; this is not a distributed request scheduler. Storage failures are explicit, rather than silently bypassing the cache and spending quota.

Audio goes directly from Freesound's approved CDN to the consuming client. There is no audio proxy, R2 mirror, custom UI, or MCP Apps resource. `lib/sample-adapter.ts` and `examples/tool-client.mts` show credential-free use by an already-authorized MCP client. A future prototype supplies its own UI and authorized tool transport.

## Development

Node >=22.13. Use `npm run install:ci`, `npm run typecheck`, `npm test`, and `npm run build`. Sites' installed workflow configures the execution profile and owns publishing. D1 schema is in `db/schema.ts`; migrations are generated with `npm run db:generate` and checked into Git. Runtime access uses prepared D1 statements as required by the Sites starter. Tests exercise real local D1 through Miniflare, plus MCP initialization/discovery and provider failures through explicit seams.

For local live checks, use an ignored `.dev.vars` containing the keys shown as placeholders in `.env.example`. Production setup does not require giving the agent the Freesound key. No secret file or local evidence belongs in a release. Run `npm run export:template` to produce a clean source directory and ZIP without credentials, deployment IDs or the private handoff. Exporting is not publishing a GitHub repository.

Maintainers: follow [RELEASING.md](docs/RELEASING.md) to publish a versioned source release and then update an existing private instance using the same public upgrade guide.

## Limits, licenses and support

Your deployment uses your Freesound account's quota. Standard limits are 60 requests/minute and 2,000/rolling 24 hours; HTTP 429 and Retry-After are handled. Cache hits avoid upstream calls. Consult [Freesound throttling](https://freesound.org/docs/api/overview.html#throttling) for current limits.

Individual sample licenses govern use of each sound. Freesound's [API terms](https://freesound.org/help/tos_api/) separately govern API access, caching and commercial use; CC0 does not remove those API conditions. This connector makes bounded temporary metadata copies and preserves provenance. It does not modify your Freesound account or implement OAuth-only original downloads.

Sites availability and permissions vary by account/workspace. ChatGPT and Codex plugin support, custom UI support and installation synchronization are separate matters. This project supplies data tools only. Other remote MCP clients must support Sites' OAuth and its returned resource URL; those clients require their own authorization and must never receive the Freesound key.

See COMPATIBILITY.md for the actual verification record. Do not generalize one tested client to every OpenAI surface. This is an independent Song Machines project; it is not an official Freesound or OpenAI connector.
