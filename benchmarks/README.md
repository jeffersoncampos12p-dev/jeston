# Ryvax benchmarks

The HTTP harness reports throughput, p50, p95, p99, error count, warmup count, and elapsed time. It does not claim general framework superiority. Record Node.js version, operating system, CPU, memory, route work, payload, concurrency model, and whether the run is loopback or networked alongside every result.

```bash
node benchmarks/http-harness.mjs http://127.0.0.1:3000/ 1000 100
```

Comparisons are valid only when the competing applications perform equivalent work and use the same runtime, payload, warmup, request count, and measurement method.
