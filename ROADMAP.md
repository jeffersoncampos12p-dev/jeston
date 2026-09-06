# Jeston roadmap

The goal of Jeston is to become a durable React-first platform for SaaS and complex full-stack applications. The roadmap describes engineering work, not guaranteed dates.

## Jeston 1.0 — stable foundation

- Stable documented TypeScript contracts.
- React SSR, SSG, hydration, and streaming.
- File-based pages and API routes.
- Signed sessions, CSRF, security headers, body limits, and request timeouts.
- SQL, health, cache, jobs, storage, and metrics contracts.
- CI across supported Node.js LTS releases.

## Jeston 1.x — platform

- Official PostgreSQL, Redis, object-storage, queue, and observability adapters.
- OAuth/OIDC, MFA, password reset, and session rotation packages.
- Database migration tooling and schema workflows.
- Distributed cache invalidation and rate limiting.
- Background jobs, schedules, retries, idempotency, and dead-letter handling.
- More complete React streaming and Suspense workflows.

## Jeston 1.x — production

- Multi-instance deployment guides and reference infrastructure.
- OpenTelemetry integrations and production dashboards.
- Security audits and dependency policies.
- Upgrade codemods and migration guides.
- Real SaaS reference applications with tested failure scenarios.

## After 1.0

Jeston will use semantic versioning. Minor and patch releases preserve documented contracts; breaking changes require a major release and migration documentation.
