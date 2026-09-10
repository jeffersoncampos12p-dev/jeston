# Ryvax roadmap

The goal of Ryvax is to be a durable, React-first platform boundary for SaaS products, APIs, internal tools, and other complex full-stack applications. The roadmap describes engineering intent, not guaranteed dates, capacity, or performance claims.

## Current 1.x foundation

The repository currently provides:

- Stable documented TypeScript contracts for pages, API routes, request context, responses, configuration, SQL, cache, jobs, storage, health, and metrics.
- React SSR, SSG, hydration, HTML/React streaming, file-based pages, dynamic routes, and API routes.
- Request abort propagation, body limits, request deadlines, safe `HEAD`, automatic `OPTIONS`/`Allow`, bounded shutdown, and JSON `400` handling for malformed JSON.
- Local response cache support for fresh reads, stale-while-revalidate, deduplication, tags, invalidation, entry limits, and basic metrics.
- Deterministic route discovery, process-unique staging, isolated `--out-dir` builds, capability/runtime manifest metadata, export, and deploy artifacts.
- Health/readiness endpoints when a registry is configured, structured logs, request IDs, metrics hooks, and an actionable CLI doctor.
- A public integration registry and searchable provider catalog covering database, cache, queue, storage, auth, frontend, AI, observability, testing, and deployment families.

These capabilities are foundations, not a promise that a single process can serve every scale. Production teams must benchmark and operate the database, queue, cache, proxy, runtime, and application together.

## 1.x platform priorities

- Official, independently reviewed PostgreSQL, Redis, object-storage, queue, and observability adapters.
- OAuth/OIDC, MFA, password reset, session rotation, and documented identity integration boundaries.
- Database migration tooling and schema workflows that remain provider-neutral.
- Distributed cache invalidation and rate limiting with explicit consistency and failure semantics.
- Queue workers, schedules, retries, idempotency, dead-letter handling, and operational dashboards.
- More complete React streaming and Suspense workflows with cancellation tests.
- Reference patterns for AI agents, evaluation, training orchestration, streaming progress, and durable checkpoints without coupling Ryvax to a model vendor.
- Official adapter packages with contract tests, peer-dependency isolation, compatibility matrices, security policies, and provider-specific operational support.
- A React Server Components adapter boundary for Flight serialization, client references, server actions, and evolving React protocols while keeping the HTTP core stable.

## Production maturity

- Multi-instance deployment guides and reference infrastructure for Node 20+.
- OpenTelemetry integrations, metrics exporters, and production dashboards.
- Security audits, dependency policies, and reproducible package verification.
- Upgrade codemods, migration guides, and compatibility tests for documented APIs.
- Real SaaS reference applications with tested failure scenarios, load tests, and published methodology.
- A sustainable ecosystem program with maintainers, RFCs, community adapters, integration certification, support tiers, and future operational support from framework and infrastructure specialists.

## What is deliberately not promised

Ryvax does not promise a fixed number of applications, a universal latency target, automatic model training, a hosted identity provider, or a performance multiplier without benchmarks. Those statements would be misleading without a workload, topology, and reproducible measurement.

Ryvax follows semantic versioning: minor and patch releases preserve documented contracts; breaking changes require a major release and migration documentation.
