# Adapter architecture

Jeston keeps the runtime, routing, SSR, API, security, and public TypeScript contracts in `@kvantjs/jeston`. External integrations should live in independently versioned adapters so a provider dependency cannot break every application.

| Area | Planned package | Responsibility |
| --- | --- | --- |
| Auth | `@kvantjs/jeston-auth` | Sessions, OAuth/OIDC, MFA, and authorization |
| Database | `@kvantjs/jeston-db` | PostgreSQL, Prisma, Drizzle, and transactions |
| Cache | `@kvantjs/jeston-redis` | Distributed cache, locks, and rate limiting |
| Storage | `@kvantjs/jeston-storage` | S3, R2, Supabase Storage, and uploads |
| Jobs | `@kvantjs/jeston-jobs` | Queues, retries, idempotency, and schedules |
| Observability | `@kvantjs/jeston-observability` | Metrics, tracing, logs, and health checks |
| Payments | `@kvantjs/jeston-payments` | Stripe, webhooks, and idempotency |

Each adapter must document its Node matrix, peer dependencies, security policy, integration tests, failure behavior, and migration strategy. The core must not import provider SDKs directly.
