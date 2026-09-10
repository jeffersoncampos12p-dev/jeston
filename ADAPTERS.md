# Adapter architecture

Ryvax keeps the runtime, routing, SSR, API, security, and public TypeScript contracts in `@kvantjs/ryvax.js`. External integrations should live in independently versioned adapters so a provider dependency cannot break every application.

| Area | Planned package | Responsibility |
| --- | --- | --- |
| Auth | `@kvantjs/ryvax.js-auth` | Sessions, OAuth/OIDC, MFA, and authorization |
| Database | `@kvantjs/ryvax.js-db` | PostgreSQL, Prisma, Drizzle, and transactions |
| Cache | `@kvantjs/ryvax.js-redis` | Distributed cache, locks, and rate limiting |
| Storage | `@kvantjs/ryvax.js-storage` | S3, R2, Supabase Storage, and uploads |
| Jobs | `@kvantjs/ryvax.js-jobs` | Queues, retries, idempotency, and schedules |
| Observability | `@kvantjs/ryvax.js-observability` | Metrics, tracing, logs, and health checks |
| Payments | `@kvantjs/ryvax.js-payments` | Stripe, webhooks, and idempotency |

Each adapter must document its Node matrix, peer dependencies, security policy, integration tests, failure behavior, and migration strategy. The core must not import provider SDKs directly.
