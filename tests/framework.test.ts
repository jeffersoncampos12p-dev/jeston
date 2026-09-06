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

test('assina sessões, rejeita adulteração e valida CSRF com comparação segura', () => {
  const secret = 'a'.repeat(32);
  const token = createSessionToken({ sub: 'user_1', exp: Math.floor(Date.now() / 1000) + 60 }, secret);
  assert.equal(verifySessionToken(token, secret)?.sub, 'user_1');
  assert.equal(verifySessionToken(`${token}x`, secret), null);
  const csrf = createCsrfToken('session_1', secret);
  assert.equal(verifyCsrfToken(csrf, 'session_1', secret), true);
  assert.equal(verifyCsrfToken(csrf, 'session_2', secret), false);
});

test('converte arquivos em rotas estáticas, dinâmicas e catch-all', () => {
  const pages = '/tmp/app/pages';
  assert.deepEqual(fileToRoutePath('/tmp/app/pages/index.ts', pages).pathname, '/');
  assert.deepEqual(fileToRoutePath('/tmp/app/pages/users/[id].tsx', pages).segments, ['users', ':id']);
  assert.deepEqual(fileToRoutePath('/tmp/app/pages/docs/[...slug].ts', pages).segments, ['docs', '*slug']);
});

test('faz match e decodifica parâmetros dinâmicos', () => {
  const route = { id: 'users_id', kind: 'ssr' as const, pathname: '/users/:id', pattern: '/users/:id', file: '', bundle: '', segments: ['users', ':id'], dynamic: true, catchAll: false };
  assert.deepEqual(matchRoute(route, '/users/ana%20silva')?.params, { id: 'ana silva' });
});

test('expira entradas de cache por TTL', async () => {
  const cache = new ResponseCache();
  cache.set('key', 'value', 0.01);
  assert.equal(cache.get('key'), 'value');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get('key'), undefined);
});

test('compõe middleware e valida body', async () => {
  const handler = composeMiddleware([
    validateBody(z.object({ name: z.string().min(2) }))
  ], async (context) => ({ json: { ok: true, body: context.body } }));
  const base = { request: {} as never, response: {} as never, url: new URL('http://localhost'), params: {}, query: new URLSearchParams(), headers: {}, body: { name: 'Ana' }, runtime: 'node' as const, state: {}, env: {} };
  assert.deepEqual(await handler(base), { json: { ok: true, body: { name: 'Ana' } } });
  const invalid = { ...base, body: { name: 'A' } };
  assert.equal((await handler(invalid)).status, 422);
});

test('buildProject gera manifest e bundle executável', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-'));
  await mkdir(join(root, 'pages', 'api'), { recursive: true });
  await writeFile(join(root, 'pages', 'index.ts'), 'export default () => "<h1>ok</h1>";');
  await writeFile(join(root, 'pages', 'api', 'health.ts'), 'export function GET() { return { json: { ok: true } }; }');
  const manifest = await buildProject({ rootDir: root, mode: 'production' });
  assert.equal(manifest.routes.length, 2);
  assert.equal(JSON.parse(await readFile(join(root, '.meu', 'manifest.json'), 'utf8')).routes.length, 2);
  await rm(root, { recursive: true, force: true });
});

test('servidor HTTP executa SSR, API, SSG, assets e cabeçalhos de segurança', async () => {
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

test('reutiliza bundles de rota e permite desligar request id e request logging', async () => {
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

test('adaptador Edge executa uma API route através da Fetch API', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-edge-'));
  await mkdir(join(root, 'pages', 'api'), { recursive: true });
  await writeFile(join(root, 'pages', 'api', 'status.ts'), 'export function GET() { return { json: { edge: true } }; }');
  const manifest = await buildProject({ rootDir: root, mode: 'development' });
  const response = await createEdgeHandler(manifest)(new Request('https://edge.test/api/status'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { edge: true });
  await rm(root, { recursive: true, force: true });
});

test('carrega framework.config.ts e .env sem depender de tsx no projeto consumidor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jeston-config-'));
  await writeFile(join(root, '.env'), 'APP_SECRET="from-env"\n');
  await writeFile(join(root, 'framework.config.ts'), 'export default { cache: { enabled: true, defaultTtl: 12 }, env: { APP_NAME: "configured" } };');
  const config = await loadConfig(root);
  assert.equal(config.cache?.defaultTtl, 12);
  assert.equal(config.env?.APP_SECRET, 'from-env');
  assert.equal(config.env?.APP_NAME, 'configured');
  await rm(root, { recursive: true, force: true });
});

test('logger respeita nível, formato JSON e oculta dados sensíveis', () => {
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
