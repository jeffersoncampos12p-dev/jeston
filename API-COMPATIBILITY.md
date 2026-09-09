# Contrato de compatibilidade Jeston 1.x

Starting with Jeston 1.0.0, the documented exports in `@kvantjs/jeston` and `@kvantjs/jeston/client` follow semantic versioning. A minor version may add APIs; it may not remove or change the meaning of a documented API. Bug fixes and security patches are released as patch versions.

## Stable API

The stable surface includes `PageModule`, `ApiHandler`, `RequestContext`, `ResponseLike`, `AppConfig`, `DatabaseAdapter`, the React renderer, `hydrate`, `mount`, session and CSRF helpers, SQL contracts (`SqlClient`, `sql`, `identifier`), and platform interfaces (`CacheAdapter`, `JobQueue`, `StorageAdapter`, `MetricsAdapter`, `createHealthRegistry`).

Existing fields and methods remain valid. New request metadata, optional response fields, cache policies, metrics hooks, health endpoints, job options, adapter lifecycle methods, manifest metadata, `PageModule.generateStaticParams`, app layouts, loading/parallel-slot and typed authorization/error/not-found boundaries, generated route declarations, Server Actions with optional CSRF/timeout controls, client router helpers, web/SEO primitives, plugins, scoped data cache, and cache revalidation aliases are additive. The `app/` and `actions/` conventions are opt-in; existing `pages/` applications remain supported. A provider adapter may implement only the original required methods and still satisfy the compatibility contract.

## Runtime semantics

The Node server's documented behavior includes bounded request bodies, abort propagation, request deadlines, malformed JSON as HTTP `400`, method negotiation through `Allow`, bodyless `HEAD`, abort-aware streaming, and bounded shutdown. Applications must not rely on request-scoped work continuing after `RequestContext.signal` is aborted.

The local cache is process-scoped and disposable. Its stale-while-revalidate, tags, deduplication, and entry-limit behavior is part of the local implementation contract; distributed adapters may have different consistency and eviction semantics and must document them.

## Deprecations

An API will be marked deprecated for at least one major release when a replacement exists. Documentation will explain the alternative, the introduction version, and the planned removal version. Internal APIs in `dist` that are not documented are not public contracts.

## Security and support

Security patches may be released immediately. Kvant does not guarantee the absence of vulnerabilities; it maintains private reporting, analysis, remediation, and responsible communication as described in `SECURITY.md`. The 1.x line targets Node.js versions supported by the repository CI matrix: 20, 22, and 24.
