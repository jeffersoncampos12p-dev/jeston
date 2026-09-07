# Jeston by Hedron

Package: `@hedronjs/jeston` · CLI: `jeston`

**Jeston** is a React-first full-stack framework for building SaaS products, web applications, APIs, and internal platforms with Node.js and TypeScript. It provides file-based routing, React SSR, SSG, hydration, streaming, API routes, esbuild compilation, HMR over SSE, caching, security headers, middleware, validation, SQL contracts, authentication primitives, health checks, and provider adapters.

> Jeston keeps the runtime explicit. Each layer can be replaced without requiring a proprietary hosting platform.

## Installation

```bash
npx jeston create my-app
cd my-app
npm install
npm run dev
```

For a production-oriented SaaS starter:

```bash
npx jeston create my-saas --template=saas
```

The starter includes React SSR, hydration, API health, a signed-session endpoint, TypeScript strict mode, security limits, and extension points for database, Redis, and storage adapters.

## Production foundation

Jeston propagates an `AbortSignal` through every `RequestContext`, so handlers and dependencies can stop work when a client disconnects. Request bodies are bounded before they are retained in memory, health checks support per-check deadlines, and server shutdown drains active connections before enforcing a configurable timeout.

The built-in response cache supports TTL, stale-while-revalidate windows, tags, tag invalidation, and `remember()` deduplication for concurrent misses. Use a distributed adapter for multi-instance deployments; the local cache is intentionally process-scoped.

Run `jeston doctor` from an application directory to inspect the Node.js version, project files, framework configuration, and package dependency before development or deployment.

## Architecture

| Layer | Responsibility | Implementation |
| --- | --- | --- |
| Discovery | Converts files into routes and parameters | `src/router.ts` |
| Compilation | Generates server and browser ESM bundles | `src/compiler.ts` + esbuild |
| Runtime | Executes SSR, SSG, API routes, and static assets | `src/server.ts` |
| Platform | Provides auth, SQL, schemas, cache, health, and security primitives | `src/auth.ts`, `src/sql.ts`, `src/platform.ts` |
| Experience | Creates, develops, builds, exports, deploys, and starts projects | `src/cli/index.ts` |
| Adapters | Connects databases, caches, queues, storage, metrics, and providers | Public interfaces in `src/` |

```text
pages/**/*.{ts,tsx,js,jsx}
          |
          v
    route discovery
          |
          v
    manifest + ESM bundles
       |          |          |
       v          v          v
    Node SSR   API routes   browser client
```

## React-first rendering

A page can return any `ReactNode`:

```tsx
export default function Page() {
  return <main><h1>Workspace</h1></main>;
}
```

Jeston uses `react-dom/server` for SSR and supports static generation, hydration, and streaming. Legacy pages that return HTML strings remain supported.

```tsx
import { hydrate, installHmr } from '@hedronjs/jeston/client';
import { App } from './App.js';

hydrate(<App />);
installHmr();
```

For progressive responses, return `react` from an API handler. Jeston uses `renderToPipeableStream` to start sending markup before the complete tree is serialized.

## File-based routing

The `pages/` directory is the source of truth for routing.

| File | URL | Type |
| --- | --- | --- |
| `pages/index.tsx` | `/` | Page |
| `pages/about.tsx` | `/about` | Page |
| `pages/users/[id].tsx` | `/users/:id` | Dynamic page |
| `pages/docs/[...slug].tsx` | `/docs/*slug` | Catch-all page |
| `pages/api/health.ts` | `/api/health` | API route |

Dynamic values are decoded and available through `context.params`. Query values are available through `context.query`.

## API routes

Export one handler per HTTP method or a `default` handler.

```ts
import type { ApiHandler } from '@hedronjs/jeston';

export const POST: ApiHandler = async ({ body }) => ({
  status: 201,
  json: { created: true, input: body }
});
```

`RequestContext` contains the Node request and response objects, URL, params, query, headers, parsed body, environment, runtime, and mutable request state. Responses support `json`, `body`, `redirect`, `stream`, and `react`.

## SQL and database adapters

Jeston provides a provider-neutral SQL contract. Applications can use PostgreSQL, SQLite, Prisma, Drizzle, or a community adapter without changing route code.

```ts
import { createPostgresAdapter, sql } from '@hedronjs/jeston';

const db = createPostgresAdapter(pool);
const statement = sql`select id, email from users where id = ${userId}`;
const result = await db.query(statement.text, statement.values);
```

The `sql` tag keeps values separate from SQL text. Use `identifier` only for validated structural names. Adapters expose transaction callbacks.

```ts
await db.transaction(async (transaction) => {
  await transaction.query('update accounts set balance = balance - $1 where id = $2', [amount, fromId]);
  await transaction.query('update accounts set balance = balance + $1 where id = $2', [amount, toId]);
});
```

Use migrations, indexes, pooling, backups, least-privilege credentials, and query timeouts in production. Jeston does not hide database operational responsibility behind a magical abstraction.

## Authentication and authorization

Jeston provides cryptographic primitives rather than a hosted identity provider. Applications remain responsible for login policy, password hashing, OAuth integration, MFA, user storage, recovery, and secret rotation.

```ts
import { createSessionToken, verifySessionToken, requirePermission } from '@hedronjs/jeston';

const secret = process.env.JESTON_SESSION_SECRET!;
const token = createSessionToken({
  sub: user.id,
  exp: Math.floor(Date.now() / 1000) + 86_400,
  roles: ['member'],
  permissions: ['billing:read']
}, secret);

const claims = verifySessionToken(token, secret);
requirePermission(claims, 'billing:read');
```

Use CSRF tokens for state-changing browser requests that use cookies. Use HTTPS, Secure/HttpOnly/SameSite cookies, and a randomly generated secret with at least 32 characters.

`createRateLimiter` is an in-process primitive for a single instance. Multi-instance deployments should use a Redis or gateway adapter.

## Security and production limits

Jeston limits request bodies to 1 MiB by default and returns HTTP 413 for oversized payloads. Requests have a two-minute timeout by default.

```ts
export default {
  poweredBy: false,
  limits: {
    bodyBytes: 2 * 1024 * 1024,
    requestTimeoutMs: 60_000
  }
};
```

The runtime sends security headers including `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and a conservative CSP. Applications can replace or extend these values.

## Health and observability

Use `createHealthRegistry` to register checks for databases, caches, queues, and external services.

```ts
import { createHealthRegistry } from '@hedronjs/jeston';

const health = createHealthRegistry();
health.register('database', async () => {
  await db.query('select 1');
  return { status: 'ok' };
});

const report = await health.report();
```

Reports include overall `ok`, `degraded`, or `down` status, each check result, latency, and an ISO timestamp. Request IDs are enabled by default. Structured logs support `debug`, `info`, `warn`, and `error`, JSON or pretty output, child fields, and sensitive-key redaction.

## Platform contracts

The core exposes interfaces for `CacheAdapter`, `JobQueue`, `StorageAdapter`, and `MetricsAdapter`. This design keeps the core small while supporting official and community integrations for Redis, S3, queues, payments, and OpenTelemetry.

| Area | Recommended adapter family |
| --- | --- |
| Database | PostgreSQL, SQLite, Prisma, Drizzle |
| Cache | Redis or managed cache |
| Storage | S3-compatible object storage |
| Jobs | Durable queue with retries and dead-letter handling |
| Observability | OpenTelemetry, Prometheus, or provider exporter |

## Configuration

Jeston loads `framework.config.ts`, `framework.config.mts`, `framework.config.js`, or `framework.config.mjs`. TypeScript configuration is compiled with esbuild before loading. `.env` and `.env.local` values are available without replacing variables already defined by the process.

```ts
import type { AppConfig } from '@hedronjs/jeston';

export default {
  poweredBy: false,
  cache: { enabled: true, defaultTtl: 30, staleWhileRevalidate: 60 },
  observability: { requestId: true, requestLogging: false }
} satisfies AppConfig;
```

## CLI commands

| Command | Result |
| --- | --- |
| `jeston create <name>` | Creates a React TypeScript application |
| `jeston create <name> --template=saas` | Creates the SaaS starter |
| `jeston create <name> --no-tailwind` | Omits Tailwind files |
| `jeston dev --port 3000` | Builds, starts, and watches the application |
| `jeston build` | Builds production bundles and SSG pages |
| `jeston export --out-dir dist` | Generates a static site for a CDN |
| `jeston deploy --out-dir dist` | Generates a portable Node deployment package |
| `jeston start --port 3000` | Starts the production manifest |

## Deployment

The `deploy` command creates a conventional Node artifact with `server.mjs`, `.meu/manifest.json`, route bundles, public files, and a minimal package manifest.

```bash
npm run deploy
PORT=8080 node dist/server.mjs
```

Use `npm run deploy` as the build command and `node dist/server.mjs` as the start command on platforms that separate these stages. Node.js 20 or newer is required.

When a platform supports only static hosting, use `jeston export`. Only SSG pages are exported; API routes, SSR, and dynamic pages without generated paths require the Node runtime.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

To run the included example:

```bash
cd example
npm install ../
../node_modules/.bin/jeston build
../node_modules/.bin/jeston start
```

## Performance model

The runtime caches route modules after the first import and compiles route patterns once when the server is created. The compiler builds page bundles in parallel and sorts file discovery for deterministic builds. Request completion logging is disabled by default in production to reduce hot-path I/O.

These optimizations do not replace workload-specific benchmarks. Measure complete applications with the same database, cache, proxy, TLS, concurrency, and failure scenarios before making framework claims.

## Repository quality gates

Every release should pass typecheck, the full test suite, production build, generated-app validation, npm audit, and a smoke test. CI covers Node.js 20, 22, and 24.

## Jeston 1.0 compatibility

Jeston 1.0 freezes the documented public contracts and follows semantic versioning. Minor releases add backward-compatible features, patch releases fix bugs and security issues, and major releases may introduce breaking changes. Read `API-COMPATIBILITY.md`, `SECURITY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md` before upgrading.

## References

[1]: https://nodejs.org/api/http.html "Node.js HTTP API"
[2]: https://esbuild.github.io/api/ "esbuild JavaScript API"
[3]: https://www.typescriptlang.org/docs/ "TypeScript Handbook"
[4]: https://react.dev/ "React Documentation"
[5]: https://zod.dev/ "Zod Documentation"
[6]: https://tailwindcss.com/docs/installation "Tailwind CSS Installation"
