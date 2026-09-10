import type { ApiHandler } from '@kvantjs/ryvax.js';

export const GET: ApiHandler = async ({ env }) => ({
  json: { ok: true, service: 'pulseboard', framework: 'ryvax', runtime: 'node', environment: env.NODE_ENV ?? 'development', timestamp: new Date().toISOString() },
  headers: { 'Cache-Control': 'no-store' }
});
