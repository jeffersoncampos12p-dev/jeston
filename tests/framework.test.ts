import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileToRoutePath, matchRoute } from '../src/router.js';
import { ResponseCache } from '../src/cache.js';
import { composeMiddleware, validateBody, z } from '../src/middleware.js';
import { buildProject } from '../src/compiler.js';
import { createAppServer } from '../src/server.js';
import { createEdgeHandler } from '../src/edge.js';
import { loadConfig } from '../src/config.js';
import { createLogger, createRequestId } from '../src/logger.js';
import { createCsrfToken, createSessionToken, verifyCsrfToken, verifySessionToken } from '../src/auth.js';
import { createRateLimiter, hasPermission, hasRole, requirePermission } from '../src/authz.js';
import { createHealthRegistry } from '../src/platform.js';
import { identifier, sql, type SqlClient } from '../src/sql.js';
import { createMigrationRunner } from '../src/migrations.js';
import { InMemoryJobQueue } from '../src/jobs.js';
import { createCircuitBreaker, withRetry } from '../src/resilience.js';
import { assertSafeUrl } from '../src/security.js';

test('signs sessions, rejects tampering, and validates CSRF with constant-time comparison', () => {
  const secret = 'a'.repeat(32);
  const token = createSessionToken({ sub: 'user_1', exp: Math.floor(Date.now() / 1000) + 60 }, secret);
  assert.equal(verifySessionToken(token, secret)?.sub, 'user_1');
  assert.equal(verifySessionToken(`${token}x`, secret), null);
  const csrf = createCsrfToken('session_1', secret);
  assert.equal(verifyCsrfToken(csrf, 'session_1', secret), true);
  assert.equal(verifyCsrfToken(csrf, 'session_2', secret), false);
});

test('provides parameterized SQL, authorization, and deterministic health checks', async () => {
  const query = sql`select * from users where id = ${'user_1'}`;
  assert.deepEqual(query, { text: 'select * from users where id = $1', values: ['user_1'] });
  assert.equal(identifier('users'), '"users"');
  assert.throws(() => identifier('users;drop table users'));
  const claims = { sub: 'user_1', exp: 9999999999, roles: ['editor'], permissions: ['post:write'] };
  assert.equal(hasRole(claims, 'editor'), true);
  assert.equal(hasPermission(claims, 'post:write'), true);
  assert.equal(requirePermission(claims, 'post:write').sub, 'user_1');
  assert.throws(() => requirePermission(claims, 'billing:write'));
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.check('ip').allowed, true);
  assert.equal(limiter.check('ip').allowed, true);
  assert.equal(limiter.check('ip').allowed, false);
  const health = createHealthRegistry();
  health.register('database', () => ({ status: 'ok' }));
  assert.equal((await health.report()).status, 'ok');
});

test('converts files into static, dynamic, and catch-all routes', () => {
  const pages = '/tmp/app/pages';
  assert.deepEqual(fileToRoutePath('/tmp/app/pages/index.ts', pages).pathname, '/');
  assert.deepEqual(fileToRoutePath('/tmp/app/pages/users/[id].tsx', pages).segments, ['users', ':id']);
  assert.deepEqual(fileToRoutePath('/tmp/app/pages/docs/[...slug].ts', pages).segments, ['docs', '*slug']);
});

test('matches and decodes dynamic parameters', () => {
  const route = { id: 'users_id', kind: 'ssr' as const, pathname: '/users/:id', pattern: '/users/:id', file: '', bundle: '', segments: ['users', ':id'], dynamic: true, catchAll: false };
  assert.deepEqual(matchRoute(route, '/users/ana%20silva')?.params, { id: 'ana silva' });
});

test('expires cache entries by TTL', async () => {
  const cache = new ResponseCache();
  cache.set('key', 'value', 0.01);
  assert.equal(cache.get('key'), 'value');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get('key'), undefined);
});

test('supports stale cache entries, tag invalidation, and stampede protection', async () => {
  const cache = new ResponseCache();
  let calls = 0;
  const compute = () => cache.remember('profile', async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { id: 'user_1' };
  }, { ttl: 0.001, staleWhileRevalidate: 0.05, tags: ['user:user_1'] });
  const [first, second] = await Promise.all([compute(), compute()]);
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
  assert.deepEqual(cache.get('profile'), { id: 'user_1' });
  assert.equal(cache.invalidateTag('user:user_1'), 1);
  assert.equal(cache.get('profile'), undefined);
});

test('composes middleware and validates request bodies', async () => {
  const handler = composeMiddleware([
    validateBody(z.object({ name: z.string().min(2) }))
  ], async (context) => ({ json: { ok: true, body: context.body } }));
  const base = { request: {} as never, response: {} as never, signal: new AbortController().signal, url: new URL('http://localhost'), params: {}, query: new URLSearchParams(), headers: {}, body: { name: 'Ana' }, runtime: 'node' as const, state: {}, env: {} };
  assert.deepEqual(await handler(base), { json: { ok: true, body: { name: 'Ana' } } });
  const invalid = { ...base, body: { name: 'A' } };
  assert.equal((await handler(invalid)).status, 422);
});

test('buildProject generates a manifest and executable bundle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-'));
  await mkdir(join(root, 'pages', 'api'), { recursive: true });
  await writeFile(join(root, 'pages', 'index.ts'), 'export default () => "<h1>ok</h1>";');
  await writeFile(join(root, 'pages', 'api', 'health.ts'), 'export function GET() { return { json: { ok: true } }; }');
  const manifest = await buildProject({ rootDir: root, mode: 'production' });
  assert.equal(manifest.routes.length, 2);
  assert.equal(JSON.parse(await readFile(join(root, '.meu', 'manifest.json'), 'utf8')).routes.length, 2);
  await rm(root, { recursive: true, force: true });
});

test('HTTP server executes SSR, API, SSG, assets, and security headers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-http-'));
  await mkdir(join(root, 'node_modules'), { recursive: true });
  await symlink(join(process.cwd(), 'node_modules', 'react'), join(root, 'node_modules', 'react'), 'junction');
  await mkdir(join(root, 'pages', 'api'), { recursive: true });
  await mkdir(join(root, 'pages', 'users'), { recursive: true });
  await mkdir(join(root, 'public'), { recursive: true });
  await writeFile(join(root, 'public', 'app.css'), 'body { color: red; }');
  await writeFile(join(root, 'pages', 'index.ts'), `export const getStaticProps = async () => ({ title: 'SSG real' }); export default (props) => '<h1>' + props.title + '</h1>';`);
  await writeFile(join(root, 'pages', 'react.tsx'), `import { createElement } from 'react'; export default () => createElement('main', { id: 'react-app' }, createElement('h1', null, 'React real'));`);
  await writeFile(join(root, 'pages', 'users', '[id].ts'), `export async function getServerSideProps(ctx) { return { id: ctx.params.id }; } export default (props) => '<p>User:' + props.id + '</p>';`);
  await writeFile(join(root, 'pages', 'api', 'echo.ts'), `export const middleware = [async (ctx, next) => { ctx.state.fromMiddleware = true; return next(); }]; export async function POST(ctx) { return { status: 201, json: { received: ctx.body, middleware: ctx.state.fromMiddleware } }; }`);
  await writeFile(join(root, 'pages', 'api', 'react-stream.tsx'), `import { createElement } from 'react'; export function GET() { return { react: createElement('section', { id: 'streamed' }, createElement('strong', null, 'React stream')) }; }`);

  const manifest = await buildProject({ rootDir: root, mode: 'production' });
  const app = createAppServer(manifest, { rootDir: root, limits: { bodyBytes: 64 } });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /SSG real/);
    assert.equal(page.headers.get('x-content-type-options'), 'nosniff');

    const dynamic = await fetch(`${base}/users/ana%20silva`);
    assert.equal(dynamic.status, 200);
    assert.match(await dynamic.text(), /User:ana silva/);

    const react = await fetch(`${base}/react`);
    assert.equal(react.status, 200);
    assert.match(await react.text(), /<main id="react-app"><h1>React real<\/h1><\/main>/);

    const api = await fetch(`${base}/api/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
    assert.equal(api.status, 201);
    assert.deepEqual(await api.json(), { received: { ok: true }, middleware: true });

    const oversized = await fetch(`${base}/api/echo`, { method: 'POST', body: 'x'.repeat(128) });
    assert.equal(oversized.status, 413);

    const streamed = await fetch(`${base}/api/react-stream`);
    assert.equal(streamed.status, 200);
    assert.equal(streamed.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(await streamed.text(), /<section id="streamed"><strong>React stream<\/strong><\/section>/);

    const asset = await fetch(`${base}/app.css`);
    assert.equal(asset.headers.get('content-type'), 'text/css; charset=utf-8');
    assert.match(await asset.text(), /color: red/);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('reuses route bundles and allows request IDs and request logging to be disabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-module-cache-'));
  await mkdir(join(root, 'pages', 'api'), { recursive: true });
  await writeFile(join(root, 'pages', 'api', 'module-load.ts'), `const state = globalThis as typeof globalThis & { __jestonModuleLoads?: number }; state.__jestonModuleLoads = (state.__jestonModuleLoads ?? 0) + 1; export function GET() { return { json: { loads: state.__jestonModuleLoads } }; }`);
  const manifest = await buildProject({ rootDir: root, mode: 'production' });
  const app = createAppServer(manifest, { rootDir: root, observability: { requestId: false, requestLogging: false } });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/module-load`;
  try {
    const first = await fetch(url);
    const second = await fetch(url);
    assert.equal(first.headers.get('x-request-id'), null);
    assert.deepEqual(await first.json(), { loads: 1 });
    assert.deepEqual(await second.json(), { loads: 1 });
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('Edge adapter executes an API route through the Fetch API', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-edge-'));
  await mkdir(join(root, 'pages', 'api'), { recursive: true });
  await writeFile(join(root, 'pages', 'api', 'status.ts'), 'export function GET() { return { json: { edge: true } }; }');
  const manifest = await buildProject({ rootDir: root, mode: 'development' });
  const response = await createEdgeHandler(manifest)(new Request('https://edge.test/api/status'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { edge: true });
  await rm(root, { recursive: true, force: true });
});

test('loads framework.config.ts and environment files without requiring tsx in the consumer project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-config-'));
  await writeFile(join(root, '.env'), 'APP_SECRET="from-env"\n');
  await writeFile(join(root, 'framework.config.ts'), 'export default { cache: { enabled: true, defaultTtl: 12 }, env: { APP_NAME: "configured" } };');
  const config = await loadConfig(root);
  assert.equal(config.cache?.defaultTtl, 12);
  assert.equal(config.env?.APP_SECRET, 'from-env');
  assert.equal(config.env?.APP_NAME, 'configured');
  await rm(root, { recursive: true, force: true });
});

test('logger respects levels and JSON format and redacts sensitive data', () => {
  const lines: string[] = [];
  const logger = createLogger({ level: 'info', format: 'json', service: 'test', destination: { debug: () => undefined, info: (line) => lines.push(line), warn: () => undefined, error: () => undefined } });
  logger.debug('ignored');
  logger.info('started', { token: 'secret-value', nested: { password: 'hidden' }, requestId: 'req-1' });
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]!);
  assert.equal(event.level, 'info');
  assert.equal(event.service, 'test');
  assert.equal(event['[REDACTED]'], '[REDACTED]');
  assert.equal(event.nested['[REDACTED]'], '[REDACTED]');
  assert.equal(createRequestId('client-request'), 'client-request');
  assert.ok(createRequestId());
});

test('health checks time out without blocking the complete report', async () => {
  const health = createHealthRegistry();
  health.register('slow', () => new Promise(() => undefined));
  const report = await health.report({ timeoutMs: 5 });
  assert.equal(report.status, 'down');
  assert.match(report.checks.slow?.detail ?? '', /timed out/);
});

test('protects upstream requests from private network targets', () => {
  assert.throws(() => assertSafeUrl('http://127.0.0.1/internal'));
  assert.throws(() => assertSafeUrl('https://example.com', { allowedHosts: ['api.example.com'] }));
  assert.equal(assertSafeUrl('https://api.example.com', { allowedHosts: ['api.example.com'] }).hostname, 'api.example.com');
});

test('retries transient work and opens a circuit after repeated failures', async () => {
  let attempts = 0;
  const result = await withRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('temporary');
    return 'ok';
  }, { maxAttempts: 3, baseDelayMs: 0 });
  assert.equal(result, 'ok');
  const breaker = createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
  await assert.rejects(() => breaker.execute(async () => { throw new Error('down'); }));
  await assert.rejects(() => breaker.execute(async () => { throw new Error('down'); }));
  assert.equal(breaker.state(), 'open');
  await assert.rejects(() => breaker.execute(async () => 'blocked'), /open/);
});

test('processes jobs with retries, idempotency, and dead letters', async () => {
  let calls = 0;
  const queue = new InMemoryJobQueue({ handler: async () => { calls += 1; if (calls < 2) throw new Error('temporary'); } });
  const first = await queue.enqueue('email', { to: 'user@example.com' }, { idempotencyKey: 'email-1', maxAttempts: 2, retryDelayMs: 0 });
  const duplicate = await queue.enqueue('email', { to: 'user@example.com' }, { idempotencyKey: 'email-1' });
  assert.equal(first.id, duplicate.id);
  await queue.process();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, 2);
  await queue.close();
});

test('runs versioned migrations transactionally and detects checksum changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-migrations-'));
  await writeFile(join(root, '0001_users.up.sql'), 'CREATE TABLE users (id TEXT);');
  await writeFile(join(root, '0001_users.down.sql'), 'DROP TABLE users;');
  const executed: string[] = [];
  const rows: Array<{ id: string; name: string; checksum: string; applied_at: string }> = [];
  const client: SqlClient = {
    async query<T = unknown>(text: string, values: readonly unknown[] = []) {
      executed.push(text);
      if (/SELECT id/.test(text)) return { rows: rows as T[], rowCount: rows.length };
      if (/INSERT INTO/.test(text)) rows.push({ id: String(values[0]), name: String(values[1]), checksum: String(values[2]), applied_at: String(values[3]) });
      if (/DELETE FROM/.test(text)) rows.splice(0, 1);
      return { rows: [] as T[], rowCount: 1 };
    },
    async transaction<T>(work: (transactionClient: SqlClient) => Promise<T>) { return work(client); }
  };
  const runner = createMigrationRunner({ directory: root, client });
  assert.equal((await runner.up()).length, 1);
  assert.equal((await runner.status()).pending.length, 0);
  await writeFile(join(root, '0001_users.up.sql'), 'CREATE TABLE users (id TEXT, email TEXT);');
  await assert.rejects(() => runner.up(), /checksum mismatch/);
  assert.ok(executed.length > 0);
  await rm(root, { recursive: true, force: true });
});
