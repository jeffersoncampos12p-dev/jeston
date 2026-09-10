# React benchmark: Ryvax 0.3.0 vs. Next.js 16.3.4

## Executive result

Ryvax 0.3.0 used a React-first runtime with SSR, `react-dom/server`, and native React streaming. In the measured loopback scenario, Ryvax reached **4,812.67 RPS for React SSR** versus **771.46 RPS for the Next.js Pages Router**. On the JSON endpoint, Ryvax reached **4,652.52 RPS** versus **1,955.57 RPS** for Next.js.

The result demonstrates low overhead for Ryvax React SSR in this minimal workload. It does not prove universal superiority. Next.js provides a broader React platform with Server Components, integrated streaming in more scenarios, image optimization, caching, and a mature ecosystem.

## Methodology

The test ran on Linux amd64 with Node.js `v22.13.0`, Ryvax 0.3.0, and Next.js `16.3.4`. Both applications had a dynamic `/` route and `/api/health`. The Ryvax route returned real React elements and was rendered by Ryvax. The Next route used the Pages Router and `getServerSideProps`.

The client used 25 concurrent workers, 100 warmup requests, and a 10-second loopback window per target without TLS, database, proxy, or compression. Ryvax disabled request logging and request IDs to avoid comparing console I/O and UUID generation against a Next server that did not log every request.

## Results

| Route | Framework | Requests | RPS | P50 | P95 | Maximum | Errors |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | Ryvax 0.3.0 React SSR | 48,136 | **4,812.67** | **4.218 ms** | **9.761 ms** | 33.956 ms | 0 |
| `/` | Next.js Pages Router | 7,731 | 771.46 | 30.806 ms | 46.314 ms | 261.320 ms | 0 |
| `/api/health` | Ryvax 0.3.0 | 46,535 | **4,652.52** | **4.341 ms** | **10.039 ms** | 25.928 ms | 0 |
| `/api/health` | Next.js Pages Router | 19,576 | 1,955.57 | 11.399 ms | 21.832 ms | 89.373 ms | 0 |

Ryvax achieved approximately **6.24 times the measured SSR throughput** and **2.38 times the measured JSON throughput** in this specific setup. The conclusion is limited to the application, configuration, and machine described here.

## Limitations

The benchmark did not measure Server Components, complex client components, heavy hydration, Suspense streaming, databases, authentication, uploads, images, CDNs, TLS, distributed cache, multiple instances, or Web Vitals. A production evaluation should use the same complete SaaS application in both frameworks and repeat the test on clean machines.

The technically correct conclusion is that Ryvax 0.3.0 provided a functional React-first foundation with SSR, SSG, hydration, and streaming, and showed lower overhead in this minimal React benchmark.

## References

[1]: https://github.com/kvantjs/ryvax.js "Ryvax by Kvant repository"
[2]: https://react.dev/reference/react-dom/server/renderToPipeableStream "React renderToPipeableStream reference"
[3]: https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering "Next.js server-side rendering documentation"
