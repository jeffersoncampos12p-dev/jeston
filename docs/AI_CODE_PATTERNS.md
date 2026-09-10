# Canonical AI Code Patterns

These patterns are deliberately small. Copy the structure, then adapt domain names and validation to the application. Do not add abstractions until the existing pattern is insufficient.

## Page

**Use case:** server-rendered page.

**File:** `pages/index.tsx`

```tsx
import type { PageModule } from '@kvantjs/ryvax.js';

type Props = { title: string };

const page: PageModule<Props> = {
  default: ({ title }) => <main><h1>{title}</h1></main>,
  getStaticProps: async () => ({ title: 'Ryvax application' })
};

export default page.default;
```

Use `getServerSideProps(context)` when data depends on the request. Do not create a second page router.

## Dynamic page

**File:** `pages/projects/[id].tsx`

```tsx
import type { PageModule } from '@kvantjs/ryvax.js';

type Props = { id: string };

const page: PageModule<Props> = {
  default: ({ id }) => <main><h1>Project {id}</h1></main>,
  getServerSideProps: async ({ params }) => ({ id: String(params.id) })
};

export default page.default;
```

`params.id` is decoded by the framework. Validate it before using it as a database key or authorization subject.

## API endpoint

**File:** `pages/api/health.ts`

```ts
import type { ApiHandler } from '@kvantjs/ryvax.js';

export const GET: ApiHandler = ({ env }) => ({
  status: 200,
  json: { ok: true, environment: env.NODE_ENV ?? 'development' }
});
```

For a write endpoint, validate `context.body`, authorize the caller, then return an explicit status and JSON shape. Use `context.signal` for cancellable work.

## App Router API

**File:** `app/api/projects/route.ts`

```ts
import type { ApiHandler } from '@kvantjs/ryvax.js';

export const GET: ApiHandler = async ({ query }) => ({
  status: 200,
  json: { filter: query.get('filter'), items: [] }
});
```

Use `app/**/route.*` only in an App Router tree. Do not mix route conventions without first inspecting the existing project.

## Layout

**File:** `app/layout.tsx`

```tsx
import type { LayoutComponent } from '@kvantjs/ryvax.js';

const layout: LayoutComponent = ({ children }) => (
  <html lang="en"><body>{children}</body></html>
);

export default layout;
```

Layouts are App Router boundaries and are applied from outermost to innermost. A `pages/` route does not acquire an App Router layout.

## Error boundary

**File:** `app/error.tsx`

```tsx
import type { BoundaryComponent } from '@kvantjs/ryvax.js';

const errorBoundary: BoundaryComponent = ({ error }) => (
  <main><h1>Request failed</h1><pre>{String(error ?? 'Unknown error')}</pre></main>
);

export default errorBoundary;
```

Use `forbidden.tsx` and `unauthorized.tsx` for their respective status boundaries. Use `not-found.tsx` for the App Router not-found response.

## Server Action

**File:** `actions/projects.ts`

```ts
'use server';

export async function createProject(input: { name: string }) {
  if (!input.name.trim()) throw new Error('Project name is required');
  return { name: input.name.trim() };
}
```

The compiler discovers the file only when it contains `'use server'` and exported functions. Configure action origins, CSRF, and size/time limits through `framework.config.*`. Never accept unvalidated input.

## Client entry

**File:** `src/client.tsx`

```tsx
import { hydrate, installHmr } from '@kvantjs/ryvax.js/client';
import { App } from './App.js';

hydrate(<App />);
installHmr();
```

The compiler discovers this conventional client entry and writes `/_meu/static/client.js`. Keep server-only imports out of client modules.

## Configuration

**File:** `framework.config.ts`

```ts
import type { AppConfig } from '@kvantjs/ryvax.js';

export default {
  host: '0.0.0.0',
  port: 3000,
  poweredBy: false,
  observability: { requestLogging: false },
  limits: { requestTimeoutMs: 120_000 }
} satisfies AppConfig;
```

The loader also reads `.env` and `.env.local`. Keep secrets in environment injection, not in this file or page props.

## Migration

```bash
npx ryvax migrate create add_projects
```

This creates paired files under `migrations/`: `NNNN_add_projects.up.sql` and `NNNN_add_projects.down.sql`. Replace the placeholders with reviewed SQL and keep the forward/rollback relationship explicit.

## Build and deploy

```bash
npm run typecheck
npm test
npm run build
npx ryvax routes --json
npx ryvax deploy --out-dir dist
node dist/server.mjs
```

Static-only deployment uses `npx ryvax export --out-dir dist`. The Node deployment package includes `.meu/`, `public/`, `server.mjs`, and a generated package manifest. Build once and deploy the artifact that passed validation.

## Common anti-patterns

- Installing Next.js to obtain file-based routing.
- Adding React Router to replace the compiler.
- Creating API handlers as Express callbacks.
- Importing `@kvantjs/ryvax.js/src/server` instead of a declared package export.
- Editing `.meu/manifest.json` or generated route bundles.
- Using `getStaticProps` for request-specific secrets or authorization.
- Returning a generic 200 response for a failed validation or authorization check.
- Omitting `AbortSignal` from long-running work.
- Adding a provider or database dependency without a repository boundary and configuration contract.

## References

[1]: https://github.com/kvantjs/ryvax.js/blob/main/src/types.ts "Ryvax TypeScript contracts"
[2]: https://github.com/kvantjs/ryvax.js/blob/main/src/router.ts "Ryvax routing implementation"
[3]: https://github.com/kvantjs/ryvax.js/blob/main/src/compiler.ts "Ryvax compiler implementation"
[4]: https://github.com/kvantjs/ryvax.js/blob/main/src/cli/index.ts "Ryvax CLI implementation"
[5]: https://github.com/kvantjs/ryvax.js/blob/main/tests/framework.test.ts "Ryvax framework tests"
