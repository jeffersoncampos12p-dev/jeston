# Contrato de compatibilidade Jeston 1.x

Starting with Jeston 1.0.0, the documented exports in `@hedronjs/jeston` e `@hedronjs/jeston/client` follow semantic versioning. A minor version may add APIs; it may not remove or change the meaning of a documented API. Bug fixes and security patches are released as patch versions.

## Stable API

The following are stable: `PageModule`, `ApiHandler`, `RequestContext`, `ResponseLike`, `AppConfig`, `DatabaseAdapter`, o renderer React, `hydrate`, `mount`, `createSessionToken`, `verifySessionToken`, `createCsrfToken`, `verifyCsrfToken`, os contratos SQL (`SqlClient`, `sql`, `identifier`) e as interfaces de plataforma (`CacheAdapter`, `JobQueue`, `StorageAdapter`, `MetricsAdapter`, `createHealthRegistry`).

## Deprecations

An API will be marked deprecated for at least one major release when a replacement exists. Documentation will explain the alternative, the introduction version, and the planned removal version. Internal APIs in `dist` that are not documented are not public contracts.

## Security

Security patches may be released immediately. Hedron does not guarantee the absence of vulnerabilities; it guarantees a private reporting, analysis, remediation, and responsible communication process described in `SECURITY.md`.

## Suporte

The 1.x line targets Node.js LTS versions supported by the repository CI matrix. Each release must publish a changelog, tests, an npm artifact, and migration notes when necessary.
