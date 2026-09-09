import { performance } from 'node:perf_hooks';

const url = process.argv[2] ?? 'http://127.0.0.1:3000/';
const requests = Number(process.argv[3] ?? 100);
const warmup = Number(process.argv[4] ?? 10);
for (let index = 0; index < warmup; index += 1) await fetch(url);
const durations = [];
let errors = 0;
const started = performance.now();
for (let index = 0; index < requests; index += 1) {
  const tick = performance.now();
  try { const response = await fetch(url); if (!response.ok) errors += 1; await response.arrayBuffer(); }
  catch { errors += 1; }
  durations.push(performance.now() - tick);
}
const elapsed = performance.now() - started;
durations.sort((a, b) => a - b);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.floor(durations.length * value))] ?? 0;
console.log(JSON.stringify({ url, requests, warmup, errors, throughput: requests / (elapsed / 1000), p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), elapsedMs: elapsed }, null, 2));
