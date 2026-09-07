# Changelog

## [1.1.0] - 2026-09-07

This is the single integrated platform release. It combines runtime hardening, cache semantics, HTTP contracts, isolated builds, CLI diagnostics, documentation, and protected npm publishing.

### Runtime and contracts

- Strengthened `RequestContext` with method, request ID, deadline, timeout, and documented abort semantics.
- Added additive response metadata for status text, stream signals, and tags.
- Extended `AppConfig` with cache entry limits, metrics, health/readiness paths, and health timeout configuration.
- Extended health, cache, job, storage, and metrics contracts with optional signals, tags, idempotency metadata, flush, and bounded close operations while preserving existing methods.

### HTTP server

- Malformed JSON now returns a consistent API `400` response instead of being treated as text.
- Automatic `OPTIONS` returns `Allow` for routes with exported methods; `HEAD` safely reuses `GET` when no explicit handler exists and never sends a body.
- Node streaming observes abort/close, preserves explicit content headers, cancels iterators, and avoids waiting forever on backpressure.
- Optional `/health` and `/ready` endpoints expose registry reports with `503` for non-`ok` status.

### Cache, compiler, and CLI

- Added real local stale-while-revalidate behavior, fresh reads, revalidation deduplication, tags, invalidation counters, LRU-style entry limits, and cache statistics.
- Builds use process-unique staging, atomic directory replacement, stable route bundle suffixes, runtime/capability manifest fields, and explicit output directories.
- Added `--out-dir` to `dev`, `build`, and `start`, strict argument validation, a more useful `doctor`, and collision-resistant concurrent build behavior.

### Verification and documentation

- Added tests for malformed JSON `400`, `Allow`/`OPTIONS`, `HEAD`, stream abort, stale cache/revalidation/tags/limits, CLI arguments/doctor, and isolated concurrent builds.
- CI continues to test Node.js 20, 22, and 24, and now verifies package contents, packed-package import smoke, and security audit without inventing unavailable lint or format tools.
- Publication workflow is protected by `workflow_dispatch`, the `production` environment, and npm Trusted Publishing/OIDC; this line is not published by the implementation task.

## [1.0.0] - 2026-09-06

- Documented the public API with a semantic-versioning compatibility contract.
- Added parameterized SQL with PostgreSQL and SQLite adapters.
- Added role and permission authorization with local rate limiting.
- Added a health/readiness registry and cache, jobs, storage, and metrics contracts.
- Stabilized the React full-stack core with SSR, SSG, streaming, authentication, and production security.

## [0.4.0] - 2026-09-06

- Added configurable body limits and HTTP 413 responses for oversized payloads.
- Added configurable request timeouts in the Node server.
- Added HMAC-SHA-256 sessions, secure cookies, and CSRF tokens.
- Added a typed SaaS starter and a Node 20/22/24 CI matrix.
- Added security policy, contribution guide, code of conduct, adapters, and roadmap documentation.

## [0.3.0] - 2026-09-06

- Added React-first SSR, SSG, and hydration.
- Added streaming SSR with `renderToPipeableStream`.
- Added `hydrate` and `mount` helpers in `@hedronjs/jeston/client`.
- Added a complete React CLI template.
- Added a reproducible React benchmark against the Next.js Pages Router.

[1.1.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v1.1.0
[1.0.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v1.0.0
[0.4.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v0.4.0
[0.3.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v0.3.0
