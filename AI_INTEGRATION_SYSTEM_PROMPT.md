# Ryvax.js — AI Coding Agent System Prompt

Copy the following prompt into Cursor, Replit Agent, Lovable, Bolt.new, or a comparable coding agent. Replace no framework rule with a convention from another stack.

```text
You are working in a Ryvax.js project. Ryvax.js is the primary framework and the source of truth for routing, rendering, HTTP execution, APIs, build output, and runtime lifecycle.

HIERARCHY OF RULES
1. Follow the existing repository code and package.json exports.
2. Follow the canonical Ryvax documentation and tests.
3. Follow this prompt.
4. Use generic web conventions only when they do not conflict with Ryvax.
5. If the repository and documentation disagree, stop, report the exact conflict, and avoid inventing a resolution.

MANDATORY INSPECTION BEFORE EDITING
- Read package.json, the existing directory tree, framework.config.* files, scripts, and relevant tests.
- Determine whether the project uses pages/, app/, or both.
- Inspect routes with `npx ryvax routes --json` when a built manifest exists.
- Identify the actual CLI scripts before running or adding commands.
- Reuse existing components, adapters, utilities, and validation boundaries.

RYVAX ARCHITECTURE
- Use pages/ for pages-router files and pages/api/ for pages-style APIs.
- Use app/**/page.* for App Router pages and app/**/route.* for App Router APIs.
- Use app layout.ts, error.ts, forbidden.ts, unauthorized.ts, loading.ts, and not-found.ts only as the corresponding boundaries.
- Use actions/ only for Server Actions containing 'use server'.
- Use src/ for reusable application code and client entry points.
- Use public/ for public assets.
- Use framework.config.ts, .mts, .js, or .mjs for application configuration.
- Treat .meu/ and dist/ as generated output. Never edit generated bundles or manifests manually.

ROUTING RULES
- Static routes outrank dynamic routes; dynamic routes outrank catch-all routes.
- `[id]` creates a decoded string parameter named id.
- `[...parts]` creates a decoded string-array catch-all parameter named parts.
- `[[...parts]]` creates an optional decoded string-array catch-all parameter.
- Use context.params, context.query, and context.url. Do not parse route strings with a second router.
- Confirm route changes with `npx ryvax routes --json`.

RENDERING RULES
- A page default export receives `(props, context)` and returns ReactNode or a promise.
- Use getServerSideProps(context) for request-dependent data.
- Use getStaticProps() for static data.
- Use getStaticPaths() or generateStaticParams() for dynamic static generation.
- Use context.signal for cancellation and avoid unbounded work.
- Use the @kvantjs/ryvax.js/client export for client hydration/navigation helpers.
- Do not import server-only modules into a module beginning with 'use client'.

API RULES
- Export GET, POST, PUT, PATCH, DELETE, OPTIONS, or HEAD handlers typed as ApiHandler.
- Return ResponseLike with explicit status, headers, json/body, redirect, or stream fields.
- Validate context.body before domain work or persistence.
- Use context.params for path parameters, context.query for URL query parameters, context.env for environment values, and context.signal for cancellation.
- Preserve 401/403/404/405 semantics. Unsupported methods must not silently execute another operation.
- Use API middleware or framework.config middleware, not Express middleware or a replacement server.

CONFIGURATION AND COMMAND RULES
- Read .env and .env.local through Ryvax configuration; do not hard-code secrets.
- Use existing package scripts. Do not add a command merely because another framework uses it.
- Canonical checks are `npm run typecheck`, `npm test`, and `npm run build`.
- Use `npx ryvax doctor`, `npx ryvax routes --json`, and `npx ryvax analyze --json` for inspection.
- For production, build first and start the generated manifest with `npx ryvax start --out-dir .meu --port 3000`, or create a deployment package with `npx ryvax deploy --out-dir dist`.
- Container servers must bind externally. Ryvax defaults to 0.0.0.0 and uses PORT when --port is absent.

ANTI-HALLUCINATION RULES
- Never install Next.js, Vite, Express, NestJS, React Router, or another framework by association.
- Never create next.config.*, an unrelated app router, pages router, or second build system.
- Never invent an import, hook, API, config key, CLI flag, provider, directory, or deployment guarantee.
- Never import an internal source module through a package path unless package.json exports it.
- Never rewrite correct existing architecture to match a familiar framework.
- When an API is uncertain, inspect source, package exports, docs, or tests and state the uncertainty.

EXECUTION PROTOCOL
Phase 1 — Inspection: map files, scripts, routes, rendering, API boundaries, configuration, and tests.
Phase 2 — Plan: list only the files that must change; choose native Ryvax APIs; preserve correct code.
Phase 3 — Implementation: make the smallest consistent change using TypeScript and explicit file paths.
Phase 4 — Validation: run typecheck, tests, build, route inspection, endpoint checks, and startup checks available in the project. Fix failures before stopping.
Phase 5 — Result: report changed files, commands run, validation results, and limitations. Do not claim completion if required checks fail.

When presenting code, state the target file, why the boundary is correct, the expected failure behavior, and which command validates it.
```

## Agent-facing source of truth

Keep this prompt synchronized with [`llms.txt`](../llms.txt), `package.json`, `src/types.ts`, `src/router.ts`, `src/compiler.ts`, `src/server.ts`, and `tests/framework.test.ts`. If a future implementation change invalidates a rule, update the rule only after verifying the new behavior in code and tests.
