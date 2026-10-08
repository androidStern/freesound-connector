# Publishing a connector release

The public repository distributes source and branding. Each user's private Site is a separate deployment. Pushing source or publishing a release does not update those Sites. Updating a Site reuses its generated plugin.

## Prepare and verify

1. Work from a clean checkout of the public source. Keep `.openai/hosting.json` free of project IDs. Keep instance handoffs, credentials, logs, and hosted configuration outside the distributable files.
2. Update package.json and the root package entries in package-lock.json together. The MCP server imports its version from package.json. Use `vMAJOR.MINOR.PATCH` release tags; use a major release for incompatible tool contracts, and explain required migration steps.
3. Update CHANGELOG.md, UPDATING.md, README.md, AGENTS.md, and compatibility notes as needed. Include explicit data-migration/recovery instructions for releases that change the database. Never edit an applied migration.
4. Preserve `public/screenshot.jpeg` at 1200 × 630. It should communicate Freesound Connector first and Song Machines second at thumbnail size. Keep asset provenance in docs/BRANDING.md. Site thumbnails and plugin icons are separate assets.
5. Run `npm run typecheck`, `npm test`, and the supported Sites build. Confirm the built static assets contain the thumbnail. Verify the five tools, actual native audio delivery, version reporting, and authentication boundaries through meaningful tests. Do not add a UI or new permissions just for an update.
6. Stage the intended source/assets, then run `npm run export:template`. The exporter copies tracked files and emits a clean template manifest. Inspect the exported ZIP and scan source/build/archive/logs without printing sensitive matches. Confirm it contains the update guide and thumbnail, and no secret values, instance IDs, handoffs, dependencies, or build state.

## Publish the exact release

With user authorization to publish, commit the reviewed source and push it to the public repository. Create an immutable annotated `vVERSION` tag on that commit; never move a published tag. Attach the exported ZIP named `freesound-connector-vVERSION.zip` and a `SHA256SUMS` file to the GitHub release. Generate the checksum from the exact ZIP bytes that are uploaded. Include a short description of the change, required migration steps, verified checks, and the update prompt. Use a file or structured argument for release notes so actual newlines are preserved.

For a stable release, ensure it is published (not draft/prerelease) and discoverable through GitHub's latest-release endpoint. Check the downloaded release asset's checksum after publication. A checksum detects transfer mismatch; it is not an independent signature or an audit of the source. Do not invent a release URL or claim publication before GitHub confirms it.

To update a maintainer's private instance, follow UPDATING.md against the same published release a user would receive. Preserve the instance's hosting manifest and all hosted settings. Publish through native Sites tools, then verify the real authenticated connector and the Site thumbnail. Retain the previous Site version for recovery.

## Announce the update

Provide the release link and this prompt wherever the maintainer chooses to announce it:

> Read https://github.com/androidStern/freesound-connector and follow UPDATING.md to update my existing Freesound Connector to the latest stable release.

In a chat that already has the connector available, users can simply say **"Update my Freesound Connector."** The connector's status and MCP instructions point to the guide. The agent still needs Sites publishing tools and the owner's access. Do not post announcements, send messages, or schedule background updates without the user's authorization.
