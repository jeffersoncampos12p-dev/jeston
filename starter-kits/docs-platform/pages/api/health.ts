import type { ApiHandler } from '@kvantjs/ryvax.js';
import { setupStatus } from '../../src/services.js';

export const GET: ApiHandler = async ({ env }) => ({
  json: { ok: true, service: 'ryvax-docs-platform', framework: 'ryvax', runtime: 'node', ...setupStatus(env), timestamp: new Date().toISOString() },
  headers: { 'Cache-Control': 'no-store' }
});

