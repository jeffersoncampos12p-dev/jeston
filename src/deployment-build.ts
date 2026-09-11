import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import type { RouteDefinition, RouteManifest, Runtime } from './types.js';

export type DeploymentRuntime = 'node' | 'edge';

export interface DeploymentFunction {
  id: string;
  entry: string;
  routes: string[];
  runtime: DeploymentRuntime;
  methods: string[];
}

export interface NormalizedBuildManifest {
  version: 1;
  framework: 'ryvax';
  runtime: DeploymentRuntime;
  assets: string[];
  routes: Array<Pick<RouteDefinition, 'id' | 'kind' | 'pathname' | 'pattern' | 'segments' | 'dynamic' | 'catchAll'>>;
  functions: DeploymentFunction[];
  redirects: never[];
  rewrites: never[];
  headers: never[];
  sourceManifest: string;
}

export interface AdapterBuildOptions {
  rootDir: string;
  outDir?: string;
  runtime?: DeploymentRuntime;
  clean?: boolean;
}

export interface AdapterBuildResult {
  target: 'vercel' | 'netlify' | 'docker';
  outDir: string;
  manifest: NormalizedBuildManifest;
}

export class DeploymentBuildError extends Error {
  constructor(message: string, readonly details: { route?: string; file?: string; runtime?: string; cause?: string; fix?: string } = {}) {
    super(`Framework deployment error\n\n${message}`);
    this.name = 'DeploymentBuildError';
  }
}

export function normalizeBuildManifest(routeManifest: RouteManifest, sourceManifest = '.meu/manifest.json', runtime: DeploymentRuntime = 'node'): NormalizedBuildManifest {
  if (runtime === 'edge') throw new DeploymentBuildError('The current Ryvax compiler does not prove Edge compatibility for route bundles.', { runtime, fix: 'Use the Node runtime or provide an explicitly Edge-compatible route compiler.' });
  const routes = routeManifest.routes.map(({ id, kind, pathname, pattern, segments, dynamic, catchAll }) => ({ id, kind, pathname, pattern, segments, dynamic, catchAll }));
  if (!routes.length) throw new DeploymentBuildError('The build manifest contains no routes.', { fix: 'Add a page or API route before building a deployment artifact.' });
  return {
    version: 1,
    framework: 'ryvax',
    runtime,
    assets: ['public/**', '.meu/static/**'],
    routes,
    functions: [{ id: 'ryvax', entry: 'index.mjs', routes: routes.map((route) => route.pathname), runtime, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }],
    redirects: [],
    rewrites: [],
    headers: [],
    sourceManifest
  };
}

export async function buildVercel(options: AdapterBuildOptions): Promise<AdapterBuildResult> {
  const rootDir = resolve(options.rootDir);
  const outDir = resolve(rootDir, options.outDir ?? '.vercel/output');
  const sourceDir = resolve(rootDir, '.meu');
  const sourceManifest = await readRouteManifest(sourceDir);
  const normalized = normalizeBuildManifest(sourceManifest, '.meu/manifest.json', options.runtime ?? 'node');
  await cleanAndCreate(outDir, options.clean !== false);
  await copyIfExists(join(rootDir, 'public'), join(outDir, 'static'));
  await copyIfExists(join(sourceDir, 'static'), join(outDir, 'static'));
  const functionDir = join(outDir, 'functions', 'ryvax.func');
  await fs.mkdir(functionDir, { recursive: true });
  await copyRouteBundles(sourceManifest, functionDir);
  await fs.writeFile(join(functionDir, 'manifest.json'), JSON.stringify(toPortableManifest(sourceManifest, functionDir), null, 2) + '\n');
  await fs.writeFile(join(functionDir, 'index.mjs'), vercelHandlerSource());
  await fs.writeFile(join(functionDir, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs20.x', handler: 'index.mjs', launcherType: 'Nodejs' }, null, 2) + '\n');
  await fs.writeFile(join(outDir, 'config.json'), JSON.stringify(vercelConfig(normalized), null, 2) + '\n');
  await fs.writeFile(join(outDir, 'ryvax-build-manifest.json'), JSON.stringify(normalized, null, 2) + '\n');
  return { target: 'vercel', outDir, manifest: normalized };
}

export async function buildNetlify(options: AdapterBuildOptions): Promise<AdapterBuildResult> {
  const rootDir = resolve(options.rootDir);
  const outDir = resolve(rootDir, options.outDir ?? 'dist');
  const sourceDir = resolve(rootDir, '.meu');
  const sourceManifest = await readRouteManifest(sourceDir);
  const normalized = normalizeBuildManifest(sourceManifest, '.meu/manifest.json', options.runtime ?? 'node');
  await cleanAndCreate(outDir, options.clean !== false);
  const publishDir = join(outDir, 'public');
  await copyIfExists(join(rootDir, 'public'), publishDir);
  await copyIfExists(join(sourceDir, 'static'), publishDir);
  const functionDir = join(outDir, 'netlify', 'functions', 'ryvax');
  await fs.mkdir(functionDir, { recursive: true });
  await copyRouteBundles(sourceManifest, functionDir);
  await fs.writeFile(join(functionDir, 'manifest.json'), JSON.stringify(toPortableManifest(sourceManifest, functionDir), null, 2) + '\n');
  await fs.writeFile(join(functionDir, 'index.mjs'), netlifyHandlerSource());
  await fs.writeFile(join(outDir, 'netlify.toml'), netlifyConfig());
  await fs.writeFile(join(outDir, 'ryvax-build-manifest.json'), JSON.stringify(normalized, null, 2) + '\n');
  return { target: 'netlify', outDir, manifest: normalized };
}

export async function buildDocker(options: AdapterBuildOptions): Promise<AdapterBuildResult> {
  const rootDir = resolve(options.rootDir);
  const outDir = resolve(rootDir, options.outDir ?? 'dist/docker');
  const sourceDir = resolve(rootDir, '.meu');
  const sourceManifest = await readRouteManifest(sourceDir);
  const normalized = normalizeBuildManifest(sourceManifest, '.meu/manifest.json', options.runtime ?? 'node');
  await cleanAndCreate(outDir, options.clean !== false);
  await copyIfExists(join(rootDir, 'public'), join(outDir, 'public'));
  await copyIfExists(join(sourceDir, 'static'), join(outDir, 'static'));
  await copyRouteBundles(sourceManifest, outDir);
  await fs.writeFile(join(outDir, 'ryvax-build-manifest.json'), JSON.stringify(normalized, null, 2) + '\n');
  await fs.writeFile(join(outDir, 'Dockerfile'), dockerfileSource());
  await fs.writeFile(join(outDir, '.dockerignore'), 'node_modules\n.git\n*.log\n');
  return { target: 'docker', outDir, manifest: normalized };
}

async function readRouteManifest(sourceDir: string): Promise<RouteManifest> {
  try { return JSON.parse(await fs.readFile(join(sourceDir, 'manifest.json'), 'utf8')) as RouteManifest; }
  catch { throw new DeploymentBuildError(`Could not read ${join(sourceDir, 'manifest.json')}.`, { fix: 'Run `ryvax build` before building a platform adapter.' }); }
}

async function copyRouteBundles(manifest: RouteManifest, destination: string): Promise<void> {
  const routeDir = join(destination, 'routes');
  await fs.mkdir(routeDir, { recursive: true });
  const boundaries = manifest.routes.flatMap((route) => [route.errorBoundary, route.forbiddenBoundary, route.unauthorizedBoundary, route.loadingBoundary].filter((item): item is string => Boolean(item)));
  const all = [
    ...manifest.routes.map((route) => route.bundle),
    ...manifest.routes.flatMap((route) => route.layouts ?? []),
    ...boundaries,
    ...(manifest.notFound ? [manifest.notFound] : []),
    ...(manifest.actions?.map((action) => action.bundle) ?? [])
  ];
  for (const source of new Set(all)) {
    try { await fs.copyFile(source, join(routeDir, `${safeName(source)}.mjs`)); }
    catch { throw new DeploymentBuildError(`Missing generated bundle: ${source}`, { file: source, fix: 'Run a clean Ryvax build and inspect .meu/manifest.json.' }); }
  }
}

function toPortableManifest(manifest: RouteManifest, functionDir: string): RouteManifest {
  const all = new Map<string, string>();
  const lookup = (source: string) => all.get(source) ?? `routes/${safeName(source)}.mjs`;
  for (const route of manifest.routes) all.set(route.bundle, lookup(route.bundle));
  for (const route of manifest.routes) for (const path of [...(route.layouts ?? []), route.errorBoundary, route.forbiddenBoundary, route.unauthorizedBoundary, route.loadingBoundary].filter((item): item is string => Boolean(item))) all.set(path, lookup(path));
  if (manifest.notFound) all.set(manifest.notFound, lookup(manifest.notFound));
  for (const action of manifest.actions ?? []) all.set(action.bundle, lookup(action.bundle));
  return {
    ...manifest,
    outputDir: functionDir,
    routes: manifest.routes.map((route) => ({ ...route, bundle: lookup(route.bundle), ...(route.layouts ? { layouts: route.layouts.map(lookup) } : {}), ...(route.errorBoundary ? { errorBoundary: lookup(route.errorBoundary) } : {}), ...(route.forbiddenBoundary ? { forbiddenBoundary: lookup(route.forbiddenBoundary) } : {}), ...(route.unauthorizedBoundary ? { unauthorizedBoundary: lookup(route.unauthorizedBoundary) } : {}), ...(route.loadingBoundary ? { loadingBoundary: lookup(route.loadingBoundary) } : {}) })),
    ...(manifest.notFound ? { notFound: lookup(manifest.notFound) } : {}),
    ...(manifest.actions ? { actions: manifest.actions.map((action) => ({ ...action, bundle: lookup(action.bundle) })) } : {})
  };
}

function vercelConfig(manifest: NormalizedBuildManifest) {
  return { version: 3, routes: [{ src: '^/(.*)$', dest: '/api/ryvax' }], framework: { version: 'ryvax-2' }, metadata: { runtime: manifest.runtime, routes: manifest.routes.length } };
}

function netlifyConfig(): string {
  return `[build]\n  publish = "public"\n  functions = "netlify/functions"\n\n[[redirects]]\n  from = "/*"\n  to = "/.netlify/functions/ryvax"\n  status = 200\n  force = false\n`;
}

function dockerfileSource(): string {
  return `FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/.meu ./.meu
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.mjs"]
`;
}

function vercelHandlerSource(): string {
  return `import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '@kvantjs/ryvax.js';

const rootDir = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(rootDir, 'manifest.json'), 'utf8'));
const resolveBundle = (value) => resolve(rootDir, value);
for (const route of manifest.routes) {
  route.bundle = resolveBundle(route.bundle);
  if (route.layouts) route.layouts = route.layouts.map(resolveBundle);
  if (route.slots) route.slots = Object.fromEntries(Object.entries(route.slots).map(([name, value]) => [name, resolveBundle(value)]));
  for (const key of ['errorBoundary', 'forbiddenBoundary', 'unauthorizedBoundary', 'loadingBoundary']) if (route[key]) route[key] = resolveBundle(route[key]);
}
if (manifest.notFound) manifest.notFound = resolveBundle(manifest.notFound);
if (manifest.actions) manifest.actions = manifest.actions.map((action) => ({ ...action, bundle: resolveBundle(action.bundle) }));
const app = createAppServer(manifest, { rootDir });
export default (request, response) => app.server.emit('request', request, response);
`;
}

function netlifyHandlerSource(): string {
  return `import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFetchHandler } from '@kvantjs/ryvax.js';

const rootDir = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(rootDir, 'manifest.json'), 'utf8'));
const resolveBundle = (value) => resolve(rootDir, value);
for (const route of manifest.routes) {
  route.bundle = resolveBundle(route.bundle);
  if (route.layouts) route.layouts = route.layouts.map(resolveBundle);
  if (route.slots) route.slots = Object.fromEntries(Object.entries(route.slots).map(([name, value]) => [name, resolveBundle(value)]));
  for (const key of ['errorBoundary', 'forbiddenBoundary', 'unauthorizedBoundary', 'loadingBoundary']) if (route[key]) route[key] = resolveBundle(route[key]);
}
if (manifest.notFound) manifest.notFound = resolveBundle(manifest.notFound);
if (manifest.actions) manifest.actions = manifest.actions.map((action) => ({ ...action, bundle: resolveBundle(action.bundle) }));
const handler = createFetchHandler(manifest, { rootDir }, undefined, 'node');
export default (request, _context) => handler(request);
`;
}

function safeName(file: string): string { return file.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'bundle'; }
async function cleanAndCreate(outDir: string, clean: boolean): Promise<void> { if (clean) await fs.rm(outDir, { recursive: true, force: true }); await fs.mkdir(outDir, { recursive: true }); }
async function copyIfExists(source: string, destination: string): Promise<void> { try { await fs.cp(source, destination, { recursive: true, force: true }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }

export const deploymentBuildRuntime: Runtime = 'node';
