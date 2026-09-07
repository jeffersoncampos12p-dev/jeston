import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as http from 'node:http';
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
import { identifier, sql } from '../src/sql.js';
import { createIntegrationRegistry, findIntegrations, integrationCatalog } from '../src/integrations.js';

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

test('cache serves stale values while revalidating and enforces the entry limit', async () => {
  const cache = new ResponseCache({ maxEntries: 2 });
  cache.set('first', 'one', { ttl: 0.001, staleWhileRevalidate: 0.1, tags: ['group'] });
  cache.set('second', 'two', { ttl: 1 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  let calls = 0;
  const stale = await cache.remember('first', async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 'fresh';
  }, { ttl: 1, tags: ['group'] });
  assert.equal(stale, 'one');
  assert.equal(calls, 1);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get('first'), 'fresh');
  cache.set('third', 'three', 1);
  assert.equal(cache.size(), 2);
  assert.equal(cache.get('second'), undefined);
  assert.equal(cache.invalidateTag('group'), 1);
});

test('HTTP server returns malformed JSON as 400 and implements OPTIONS and HEAD safely', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-http-contracts-'));
  await mkdir(join(root, 'pages', 'api'), { recursive: true });
  await writeFile(join(root, 'pages', 'api', 'contracts.ts'), `export function GET() { return { json: { ok: true } }; } export function POST(ctx) { return { json: { body: ctx.body } }; }`);
  const manifest = await buildProject({ rootDir: root, mode: 'production' });
  const app = createAppServer(manifest, { rootDir: root });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/contracts`;
  try {
    const malformed = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Malformed JSON body' });
    const options = await fetch(url, { method: 'OPTIONS' });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get('allow'), 'GET, POST, HEAD, OPTIONS');
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal(head.headers.get('content-type'), 'application/json; charset=utf-8');
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP streaming stops when the client aborts and does not keep a response open', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-http-stream-'));
  await mkdir(join(root, 'pages', 'api'), { recursive: true });
  await writeFile(join(root, 'pages', 'api', 'stream.ts'), `export async function GET() { async function* chunks() { for (let i = 0; i < 100; i += 1) { await new Promise(r => setTimeout(r, 5)); yield new TextEncoder().encode(String(i)); } } return { stream: chunks() }; }`);
  const manifest = await buildProject({ rootDir: root, mode: 'production' });
  const app = createAppServer(manifest, { rootDir: root });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await new Promise<void>((resolve, reject) => {
      const client = http.request(`http://127.0.0.1:${address.port}/api/stream`, (response) => {
        response.once('data', () => { client.destroy(); });
        response.once('close', () => resolve());
      });
      client.once('error', (error) => { if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(error); });
      client.end();
    });
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('CLI doctor validates a project and rejects unknown arguments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-cli-'));
  await mkdir(join(root, 'pages'), { recursive: true });
  await mkdir(join(root, 'node_modules'), { recursive: true });
  await writeFile(join(root, 'pages', 'index.ts'), 'export default () => "ok";');
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { build: 'jeston build' }, dependencies: { '@hedronjs/jeston': '1.1.0' } }));
  const cli = join(process.cwd(), 'node_modules', '.bin', 'tsx');
  const source = join(process.cwd(), 'src', 'cli', 'index.ts');
  try {
    const doctor = spawnSync(cli, [source, 'doctor', '--out-dir', '.build'], { cwd: root, encoding: 'utf8' });
    assert.equal(doctor.status, 0);
    assert.match(doctor.stdout, /Jeston doctor/);
    assert.match(doctor.stdout, /PASS  Node\.js/);
    const invalid = spawnSync(cli, [source, 'build', '--unknown'], { cwd: root, encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Unknown option/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('concurrent builds with isolated output directories produce independent manifests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-build-isolation-'));
  await mkdir(join(root, 'pages'), { recursive: true });
  await writeFile(join(root, 'pages', 'index.ts'), 'export default () => "<h1>isolated</h1>";');
  try {
    const [first, second] = await Promise.all([
      buildProject({ rootDir: root, outDir: '.build-a', mode: 'production' }),
      buildProject({ rootDir: root, outDir: '.build-b', mode: 'production' })
    ]);
    assert.equal(first.routes.length, 1);
    assert.equal(second.routes.length, 1);
    assert.notEqual(first.outputDir, second.outputDir);
    assert.equal((JSON.parse(await readFile(join(root, '.build-a', 'manifest.json'), 'utf8')) as { routes: unknown[] }).routes.length, 1);
    assert.equal((JSON.parse(await readFile(join(root, '.build-b', 'manifest.json'), 'utf8')) as { routes: unknown[] }).routes.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('registers, filters, and tears down integrations deterministically', async () => {
  const events: string[] = [];
  const registry = createIntegrationRegistry();
  const remove = registry.register({
    id: 'test-observability',
    name: 'Test observability',
    version: '1.0.0',
    category: 'observability',
    description: 'Test integration',
    setup: () => { events.push('setup'); },
    teardown: () => { events.push('teardown'); }
  });
  await registry.setup({ config: {}, runtime: 'node', env: {}, signal: new AbortController().signal });
  await registry.teardown({ config: {}, runtime: 'node', env: {}, signal: new AbortController().signal });
  assert.deepEqual(events, ['setup', 'teardown']);
  assert.equal(remove(), true);
  assert.equal(registry.get('test-observability'), undefined);
});

test('exposes a searchable provider-neutral integration catalog', () => {
  assert.ok(integrationCatalog.length >= 70);
  assert.ok(findIntegrations('postgres').some((entry) => entry.id === 'db-postgresql'));
  assert.ok(findIntegrations('', 'ai').every((entry) => entry.category === 'ai'));
});
