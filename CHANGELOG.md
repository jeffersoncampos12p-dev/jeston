# Changelog

## [Unreleased]

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

[Unreleased]: https://github.com/jeffersoncampos12p-dev/jeston/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v1.0.0
[0.4.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v0.4.0
[0.3.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v0.3.0
