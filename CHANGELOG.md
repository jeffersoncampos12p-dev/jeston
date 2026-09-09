# Changelog

## [Unreleased]

- Added a transactional SQL migration runner with checksums, status, rollback, and a migration scaffold command.
- Added retry with jitter, circuit breakers, bounded upstream fetch policy, and SSRF URL validation.
- Added an in-memory job queue reference with idempotency, retries, concurrency, and dead-letter capture.
- Added provider-agnostic metrics and tracing contracts for OpenTelemetry integration.
- Added `jeston routes` and expanded `jeston migrate` CLI support.

## [2.0.0] - 2026-09-07

This consolidated release introduces the production platform foundation described in the Jeston upgrade plan. `RequestContext` now includes a required `AbortSignal`; applications implementing the interface manually must add `signal` when migrating from 1.x.

- Added request cancellation through `AbortSignal` in Node and Edge request contexts.
- Added bounded graceful shutdown with socket draining and a configurable shutdown timeout.
- Added health-check deadlines with deterministic failure reports.
- Added cache policies for stale-while-revalidate, tags, tag invalidation, and concurrent-miss deduplication.
- Added the `jeston doctor` CLI diagnostic command.
- Added transactional SQL migrations with checksums, status reporting, rollback, and `jeston migrate create` scaffolding.
- Added retry with jitter, circuit breakers, bounded upstream fetch policy, and SSRF URL validation.
- Added a reference job queue with idempotency, concurrency, retries, and dead-letter capture.
- Added provider-neutral metrics and tracing contracts for OpenTelemetry integration.
- Added the `jeston routes` diagnostic command and the Kvant ownership/package namespace migration.

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
- Added `hydrate` and `mount` helpers in `@kvantjs/jeston/client`.
- Added a complete React CLI template.
- Added a reproducible React benchmark against the Next.js Pages Router.

[2.0.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v2.0.0
[1.0.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v1.0.0
[0.4.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v0.4.0
[0.3.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v0.3.0
