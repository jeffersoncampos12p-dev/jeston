# Benchmark: Jeston 0.2.0 vs. Next.js 16.3.4

## Conclusion

Jeston 0.2.0 reduced hot-path server overhead without removing SSR, SSG, API routes, middleware, HTTP caching, security headers, or configurable observability. In the same minimal application used in the previous benchmark, optimized Jeston reached **5,250 RPS for SSR HTML** versus **801 RPS for the Next.js Pages Router**, and **5,225 RPS for JSON API traffic** versus **2,078 RPS for Next.js**.

This remains a microbenchmark. It demonstrates runtime behavior under a simple workload, but it does not prove universal superiority for complex React applications, databases, images, streaming, Server Components, or CDNs.

## Implemented optimizations

The server no longer recompiles route patterns for every request. Patterns are compiled when `createAppServer` is called and then reused.

Route bundles are loaded once and kept in a local process cache, allowing Node.js module caching to do its work. Development remains compatible with HMR because the CLI recreates the server after each rebuild.

The per-request copy of `process.env` was removed. The environment merged with `framework.config.ts` is computed once per server. Security headers are also combined once and applied directly to each response.

The compiler builds route bundles in parallel. File discovery is sorted to keep manifests deterministic and improve build caching.

Completion logging is disabled by default when `NODE_ENV=production` to reduce console I/O. Detailed development logging remains available. `observability.requestLogging` can override the behavior, while `X-Request-Id` remains enabled by default and can be disabled with `observability.requestId: false`.

## Methodology

The test ran on Linux amd64 with Node.js `v22.13.0`, optimized Jeston, and Next.js `16.3.4` using the Pages Router. Each application exposed an on-demand `/` page and an `/api/health` route. Both servers ran in production mode over loopback with 25 concurrent workers, 100 warmup requests, and a 10-second window per target.

The main Jeston measurement disabled request IDs and request logging to avoid comparing Jeston console I/O against a Next.js server that did not log every request.

## Main 10-second run

| Route | Framework | RPS | P50 | P95 | Maximum | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/` | Jeston 0.2.0 | **5,250.28** | **3.912 ms** | **8.932 ms** | 29.094 ms | 0 |
| `/` | Next.js Pages Router | 801.17 | 29.399 ms | 45.967 ms | 220.906 ms | 0 |
| `/api/health` | Jeston 0.2.0 | **5,224.60** | **4.028 ms** | **8.530 ms** | 26.363 ms | 0 |
| `/api/health` | Next.js Pages Router | 2,078.33 | 10.866 ms | 20.701 ms | 48.529 ms | 0 |

Compared with the previous Jeston result, SSR throughput increased by approximately **189%** and JSON throughput by approximately **200%**.

## Stability repetitions

Three additional three-second runs used the same concurrency. Jeston reported no errors in any run.

| Run | Jeston SSR | Next.js SSR | Jeston API | Next.js API |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4,262.81 RPS | 890.45 RPS | 4,259.51 RPS | 2,164.69 RPS |
| 2 | 4,223.00 RPS | 932.19 RPS | 4,049.41 RPS | 2,174.78 RPS |
| 3 | 4,022.57 RPS | 1,006.53 RPS | 4,357.65 RPS | 2,193.78 RPS |

The average was approximately **4,169 RPS for Jeston SSR** versus **943 RPS for Next.js**, and **4,222 RPS for the Jeston API** versus **2,178 RPS for Next.js**.

## Limits of the conclusion

This measurement did not include React Client Components, Server Components, streaming, hydration, databases, authentication, uploads, image optimization, CDNs, TLS, reverse proxies, or distributed caching. Next.js offers a broader integrated React surface; Jeston offers a smaller and more explicit surface.

The defensible conclusion is: **Jeston 0.2.0 substantially reduced its runtime overhead and outperformed the minimal Next.js Pages Router application in this local SSR and API scenario while retaining framework features.** A production decision should still use the same complete application in both frameworks.

## Reproduction

```bash
cd /home/ubuntu/benchmark-suite
node http-bench.mjs / 10000 25
node http-bench.mjs /api/health 10000 25
```
