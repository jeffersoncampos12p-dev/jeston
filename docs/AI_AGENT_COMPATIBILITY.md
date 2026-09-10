# AI Agent Compatibility Matrix

This matrix identifies high-probability mistakes made by coding agents and the concrete Ryvax rule that prevents each mistake.

| Área | Erro provável da IA | Regra do framework | Prevenção operacional |
| --- | --- | --- | --- |
| Routing | Criar React Router ou assumir Next.js. | Route discovery is owned by `pages/` and `app/`. | Inspect the tree; use `npx ryvax routes --json`. |
| Routing | Criar `app/foo.tsx` as a page. | App pages must be `app/**/page.*`; API routes must be `route.*`. | Check the basename before creating the file. |
| Routing | Usar `{ id }` sem conferir a rota. | Dynamic segments use `[id]`; values arrive in `context.params`. | Test a concrete URL and inspect the manifest. |
| Routing | Colocar a lógica de fallback em uma rota catch-all. | Static, dynamic, and catch-all precedence is deterministic. | Add negative tests for 404 and overlapping routes. |
| Rendering | Colocar data request-dependent em `getStaticProps`. | `getServerSideProps(context)` receives request context. | Choose SSR for request data; use static hooks only for build-time data. |
| Rendering | Importar código server-only em client module. | `'use client'` modules are validated at build time. | Keep boundaries explicit and run `npm run build`. |
| API | Exportar Express router or a default unrelated handler. | API modules export method handlers or a typed `default`. | Use `ApiHandler` and `ResponseLike`. |
| API | Ignorar body validation and status codes. | Handler owns explicit validation, status, headers, and JSON. | Test malformed input, 401, 403, 404, and 405. |
| API | Parsear parâmetros com outra biblioteca de router. | Use `context.params`, `context.query`, and `context.url`. | Inspect `RequestContext` before coding. |
| API | Não propagar cancelamento. | `RequestContext.signal` aborts on disconnect, timeout, or shutdown. | Pass signal to database, fetch, stream, and job boundaries. |
| Imports | Importar `src/server` from the package name. | Only package.json exports are public. | Use `.`, `./client`, `./web`, `./seo`, or `./adapters`. |
| File structure | Editar `.meu/`, `dist/`, manifest, or bundles. | These are generated artifacts. | Change source and regenerate with the CLI. |
| File structure | Criar `next.config.*`, `vite.config.*`, or a second router. | Ryvax has its own compiler and `framework.config.*`. | Reject unrelated framework scaffolding. |
| Config | Inventar environment variables or config keys. | `AppConfig` is defined in `src/types.ts`. | Verify the key in `AppConfig` and `loadConfig`. |
| Config | Esquecer `.env.local` precedence. | `.env` and `.env.local` are loaded by Ryvax. | Keep secrets outside source and validate at startup. |
| Build | Usar `next build`, `vite build`, or a guessed script. | `npm run build` runs the project script and Ryvax build. | Read package.json first. |
| Build | Iniciar sem gerar o manifest. | `start` reads a built manifest. | Run build first or use `ryvax deploy`. |
| Runtime | Bind only to localhost in a container. | Server defaults to `0.0.0.0`; port uses `--port` or `PORT`. | Expose 3000 and verify from outside the container. |
| Runtime | Cache private responses with `revalidate`. | Revalidation caches page output. | Do not cache authorization-dependent data without policy. |
| Security | Serialize secrets into page props. | Browser payloads must not contain secrets. | Keep credentials in `context.env` and server boundaries. |
| Operations | Claim completion without checks. | Typecheck, tests, build, and route inspection are available. | Run the full applicable validation sequence and report it. |

## Minimum validation sequence

```bash
npm run typecheck
npm test
npm run build
npx ryvax routes --json
npx ryvax doctor
```

For a running application, additionally verify a known page, a known API endpoint, an unknown URL, and an unsupported API method. Do not treat a successful process start as proof that routing and runtime contracts are correct.

## Evidence boundary

This matrix describes rules supported by the current package manifest, CLI, router, compiler, server, types, tests, and repository documentation. It does not claim support for an external platform, database, AI provider, or deployment service unless that capability is explicitly configured and tested by the application.

## References

[1]: https://github.com/kvantjs/ryvax.js/blob/main/package.json "Ryvax package manifest"
[2]: https://github.com/kvantjs/ryvax.js/blob/main/src/types.ts "Ryvax public TypeScript contracts"
[3]: https://github.com/kvantjs/ryvax.js/blob/main/src/router.ts "Ryvax route matching implementation"
[4]: https://github.com/kvantjs/ryvax.js/blob/main/src/compiler.ts "Ryvax compiler implementation"
[5]: https://github.com/kvantjs/ryvax.js/blob/main/src/server.ts "Ryvax HTTP server implementation"
[6]: https://github.com/kvantjs/ryvax.js/blob/main/tests/framework.test.ts "Ryvax framework tests"
