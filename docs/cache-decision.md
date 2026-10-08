# Persistent metadata cache

The original client had an in-memory Map that disappeared with a Worker instance. The connector now uses the existing Sites D1 capability through db/cache.ts and the small MetadataCache interface. No external cache vendor, paid service or additional account is introduced.

One table stores bounded JSON records for search pages and sounds, with separate cache keys and expiry times. This avoids duplicate schema and storage policy. Search results seed sound records. Successful validated metadata is cached; errors and credentials are not. A missing/corrupt database returns cache_unavailable. Cache metadata in tool results makes reuse and freshness observable.

Drizzle generates schema migrations. The Sites persistence skill specifically requires prepared statements on the raw D1 binding for application queries, so the runtime adapter follows that requirement rather than the general Drizzle query preference. Binding types stay inside db/cache.ts and the Worker composition entrypoint. Tests run the generated migration against real local D1 with Miniflare and reopen its persisted database. Provider traffic is replaced only through the injected fetch seam.

No background scheduler or distributed lock is added. Concurrent cold misses can each call Freesound. Cleanup happens on writes; expiry prevents stale reads even before cleanup. TTLs and a 512-row cap keep temporary copies limited. Audio bytes remain on the provider CDN.
