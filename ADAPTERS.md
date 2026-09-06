# Adapter architecture

Jeston keeps the runtime, routing, SSR, API, security, and public TypeScript contracts in `@hedronjs/jeston`. External integrations should live in independently versioned adapters so a provider dependency cannot break every application.

| Area | Planned package | Responsibility |
| --- | --- | --- |
| Auth | `@hedronjs/jeston-auth` | Sessions, OAuth/OIDC, MFA, and authorization |
| Database | `@hedronjs/jeston-db` | PostgreSQL, Prisma, Drizzle, and transactions |
| Cache | `@hedronjs/jeston-redis` | Distributed cache, locks, and rate limiting |
| Storage | `@hedronjs/jeston-storage` | S3, R2, Supabase Storage, and uploads |
| Jobs | `@hedronjs/jeston-jobs` | Queues, retries, idempotency, and schedules |
| Observability | `@hedronjs/jeston-observability` | Metrics, tracing, logs, and health checks |
| Payments | `@hedronjs/jeston-payments` | Stripe, webhooks, and idempotency |

Each adapter must document its Node matrix, peer dependencies, security policy, integration tests, failure behavior, and migration strategy. The core must not import provider SDKs directly.
