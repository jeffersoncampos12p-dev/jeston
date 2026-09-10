# Vercel and Netlify deployment adapters

Ryvax now exposes one normalized deployment manifest and two platform emitters. The compiler remains the source of truth: the adapters consume `.meu/manifest.json` and generated bundles; they do not rediscover application source files or create a second router.

## Architecture

```text
pages/ or app/ source
        |
        v
ryvax build -> .meu/manifest.json + route bundles
        |
        v
normalizeBuildManifest()
        |
        +--> buildVercel()  -> .vercel/output/
        |
        +--> buildNetlify() -> dist/public + dist/netlify/functions/
```

The normalized manifest contains routes, route segments, route kinds, dynamic/catch-all flags, a single dispatcher function, runtime, assets, and explicit empty arrays for redirects, rewrites, and headers. Those arrays are intentionally empty because the current Ryvax `RouteManifest` has no first-class redirect, rewrite, or header definitions beyond per-page headers and application configuration. The adapter does not invent platform rules for information that the compiler does not represent.

## Runtime decision

Both adapters currently emit the **Node.js runtime**. The build fails when `runtime: 'edge'` is requested because the current compiler does not statically prove that route bundles, dependencies, middleware, actions, and server rendering are Edge-compatible. Netlify Edge Functions run on Deno, and Vercel Edge functions have different runtime constraints; silently converting a Node bundle would change application behavior.

The existing `createFetchHandler` is reusable for Fetch-shaped Node functions and records `runtime: 'node'` in the request context. `createEdgeHandler` remains available for an explicitly Edge-oriented integration, but it is not selected by either adapter today.

## Vercel

The Vercel adapter emits the version 3 Build Output API structure:

```text
.vercel/output/
├── config.json
├── ryvax-build-manifest.json
├── static/
└── functions/
    └── ryvax.func/
        ├── .vc-config.json
        ├── index.mjs
        ├── manifest.json
        └── routes/
```

`config.json` uses Build Output API version 3 and sends requests to the generated `ryvax` function. The function metadata declares Node.js 20. The dispatcher is the existing Ryvax HTTP server, so route matching, methods, status codes, headers, request cancellation, API serialization, and page rendering continue to be owned by Ryvax.

Build and deploy the prebuilt output with:

```bash
npm install
npm run build:vercel
vercel deploy --prebuilt
```

The output directory can be changed with `ryvax build:vercel --out-dir <directory>`. The adapter cleans the output before writing it, making repeated builds deterministic.

## Netlify

The Netlify adapter emits a publish directory, one Node-compatible Netlify Function, a function manifest, and `netlify.toml`:

```text
dist/
├── netlify.toml
├── ryvax-build-manifest.json
├── public/
└── netlify/
    └── functions/
        └── ryvax/
            ├── index.mjs
            ├── manifest.json
            └── routes/
```

The generated `netlify.toml` configures `public` as the publish directory and `netlify/functions` as the functions directory. A catch-all rewrite forwards requests to the function. Static assets are copied before the function fallback, so the platform can serve them without invoking the dispatcher.

Build and deploy with:

```bash
npm install
npm run build:netlify
netlify deploy --dir dist --prod
```

The generated function receives a Web `Request` and returns a Web `Response`, but it explicitly uses the Node runtime path. It is not emitted as a Netlify Edge Function.

## CLI

The existing `ryvax build` command is unchanged. New commands build the normal production artifact first and then emit platform output:

```bash
ryvax build:vercel [--out-dir .vercel/output]
ryvax build:netlify [--out-dir dist]
```

The project generator includes corresponding scripts in generated applications:

```json
{
  "scripts": {
    "build:vercel": "ryvax build:vercel",
    "build:netlify": "ryvax build:netlify"
  }
}
```

## Validation and failure behavior

The adapter fails before producing a successful result when the source manifest is absent, contains no routes, a generated bundle is missing, or Edge is requested without an Edge-compatible compiler. Errors identify the deployment operation and include a corrective action. Builds remove stale output first, and the test suite exercises a repeated build to prevent obsolete artifacts from surviving.

The adapters do not currently infer or emit:

| Capability | Current status | Reason |
| --- | --- | --- |
| Node SSR | Supported | Uses the Ryvax Node server and generated route bundles. |
| API methods | Supported | Dispatcher reads named method exports and emits `Allow`. |
| Dynamic and catch-all routes | Supported | The normalized manifest preserves route segments and the Ryvax matcher remains authoritative. |
| Public assets | Supported | `public/` and generated static output are copied to platform static directories. |
| Headers | Partial | Framework security headers and page headers remain runtime-owned; no platform-level header file is invented. |
| Redirects and rewrites | Not represented | The current `RouteManifest` has no redirect/rewrite definitions; `REQUIRES_CONFIRMATION` for a future source contract. |
| Edge functions | Not emitted | Compatibility is not proven by the current compiler. |
| WebSockets | Not guaranteed | Serverless function output does not preserve a long-lived WebSocket listener. |
| Persistent filesystem | Not guaranteed | Vercel and Netlify function filesystems are ephemeral. |

## Troubleshooting

**`Could not read .meu/manifest.json`.** Run `ryvax build` or use one of the new adapter commands, which runs the normal production build before emitting output.

**`Missing generated bundle`.** Remove `.meu/`, run a clean install if dependencies changed, and rebuild. Do not edit the generated manifest by hand.

**Edge compatibility error.** Keep the deployment on Node. An Edge adapter requires a future compiler mode that analyzes imports, runtime APIs, external dependencies, actions, and server rendering separately.

**A redirect or custom rewrite is missing.** Add a first-class redirect/rewrite definition to the framework compiler before extending the platform adapters. Do not encode a platform-specific rule directly in generated output.

**A function cannot find a package at runtime.** The generated function requires the application deployment to provide the declared Ryvax package and its runtime dependencies. The adapter does not copy the entire development `node_modules` directory or leak `.env`, `.env.local`, `.git`, credentials, or private keys into public output.

## Official platform references

[1]: https://vercel.com/docs/build-output-api "Vercel Build Output API"
[2]: https://vercel.com/docs/build-output-api/configuration "Vercel Build Output API configuration"
[3]: https://docs.netlify.com/build/functions/get-started/ "Netlify Functions getting started"
[4]: https://docs.netlify.com/build/edge-functions/overview/ "Netlify Edge Functions overview"
[5]: https://github.com/kvantjs/ryvax.js/blob/main/src/deployment-build.ts "Ryvax deployment builder implementation"
