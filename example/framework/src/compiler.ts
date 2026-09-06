import { promises as fs } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import chokidar, { type FSWatcher } from 'chokidar';
import { fileToRoutePath, sortRoutes } from './router.js';
import type { BuildOptions, PageModule, RequestContext, RouteDefinition, RouteManifest } from './types.js';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);

export interface WatchHandle {
  watcher: FSWatcher;
  close(): Promise<void>;
}

export async function discoverRouteFiles(rootDir: string): Promise<string[]> {
  const pagesDir = resolve(rootDir, 'pages');
  try {
    await fs.access(pagesDir);
  } catch {
    throw new Error(`Directory pages/ not found em ${pagesDir}`);
  }
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (SOURCE_EXTENSIONS.has(extname(entry.name)) && !entry.name.startsWith('_')) files.push(fullPath);
    }
  }
  await visit(pagesDir);
  return files;
}

export async function buildProject(options: BuildOptions): Promise<RouteManifest> {
  const rootDir = resolve(options.rootDir);
  const outDir = resolve(rootDir, options.outDir ?? '.meu');
  const pagesDir = resolve(rootDir, 'pages');
  const mode = options.mode ?? 'development';
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(join(outDir, 'routes'), { recursive: true });

  const sourceFiles = await discoverRouteFiles(rootDir);
  const routes: RouteDefinition[] = [];
  for (const file of sourceFiles) {
    const routeInfo = fileToRoutePath(file, pagesDir);
    const relativeFile = relative(pagesDir, file).split(sep).join('/');
    const kind = relativeFile.startsWith('api/') ? 'api' : 'ssr';
    const id = relativeFile.replace(/\.[^.]+$/, '').replaceAll(sep, '/');
    const bundle = resolve(outDir, 'routes', `${slugify(id)}.mjs`);
    await esbuild.build({
      entryPoints: [file],
      outfile: bundle,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      packages: 'external',
      sourcemap: options.sourcemap ?? mode === 'development',
      minify: options.minify ?? mode === 'production',
      legalComments: 'none',
      logLevel: 'warning'
    });
    routes.push({
      id,
      kind,
      pathname: routeInfo.pathname,
      pattern: routeInfo.pathname,
      file: resolve(file),
      bundle,
      segments: routeInfo.segments,
      dynamic: routeInfo.dynamic,
      catchAll: routeInfo.catchAll
    });
  }

  const clientEntry = await findClientEntry(rootDir);
  const client = clientEntry ? { entry: await buildClient(clientEntry, outDir, options) } : undefined;
  const manifest: RouteManifest = { generatedAt: new Date().toISOString(), routes: sortRoutes(routes), ...(client ? { client } : {}) };
  await fs.writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await generateStaticPages(manifest, outDir, mode);
  return manifest;
}

export async function exportStaticSite(rootDir: string, outDir = 'dist'): Promise<string> {
  const root = resolve(rootDir);
  const target = resolve(root, outDir);
  const buildDir = resolve(root, '.meu-export');
  await fs.rm(target, { recursive: true, force: true });
  const manifest = await buildProject({ rootDir: root, outDir: '.meu-export', mode: 'production', minify: true, sourcemap: false });
  await fs.mkdir(target, { recursive: true });
  await copyDirectory(join(buildDir, 'static'), target);
  await copyDirectoryIfExists(join(root, 'public'), target);
  await fs.writeFile(join(target, 'manifest.json'), JSON.stringify({ generatedAt: manifest.generatedAt, routes: manifest.routes.map(({ id, pathname, kind }) => ({ id, pathname, kind })) }, null, 2));
  await fs.rm(buildDir, { recursive: true, force: true });
  return target;
}

export async function prepareDeploy(rootDir: string, outDir = 'dist'): Promise<string> {
  const root = resolve(rootDir);
  const target = resolve(root, outDir);
  const buildDir = resolve(root, '.meu-deploy');
  await fs.rm(target, { recursive: true, force: true });
  const manifest = await buildProject({ rootDir: root, outDir: '.meu-deploy', mode: 'production', minify: true, sourcemap: false });
  await fs.mkdir(join(target, '.meu'), { recursive: true });
  await copyDirectory(join(buildDir, 'routes'), join(target, '.meu', 'routes'));
  await copyDirectoryIfExists(join(buildDir, 'static'), join(target, '.meu', 'static'));
  await copyDirectoryIfExists(join(root, 'public'), join(target, 'public'));
  const portableManifest = { ...manifest, routes: manifest.routes.map((route) => ({ ...route, file: route.file.replace(root, target), bundle: route.bundle.replace(buildDir, join(target, '.meu')) })) };
  await fs.writeFile(join(target, '.meu', 'manifest.json'), JSON.stringify(portableManifest, null, 2));
  await fs.writeFile(join(target, 'server.mjs'), deployServerSource());
  await fs.writeFile(join(target, 'package.json'), JSON.stringify({ type: 'module', private: true, scripts: { start: 'node server.mjs' }, dependencies: { 'jeston': '^0.1.0' }, engines: { node: '>=20' } }, null, 2) + '\n');
  await fs.rm(buildDir, { recursive: true, force: true });
  return target;
}

export async function buildClient(entry: string, outDir: string, options: BuildOptions): Promise<string> {
  const staticDir = join(outDir, 'static');
  await fs.mkdir(staticDir, { recursive: true });
  const output = join(staticDir, 'client.js');
  await esbuild.build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    sourcemap: options.sourcemap ?? true,
    minify: options.minify ?? false,
    logLevel: 'warning'
  });
  return output;
}

export async function watchProject(options: BuildOptions, onBuild: (manifest: RouteManifest) => void | Promise<void>): Promise<WatchHandle> {
  const rootDir = resolve(options.rootDir);
  let timer: NodeJS.Timeout | undefined;
  let building = false;
  let queued = false;
  const rebuild = async () => {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    try {
      const manifest = await buildProject({ ...options, mode: 'development', watch: true });
      await onBuild(manifest);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        void rebuild();
      }
    }
  };
  const watcher = chokidar.watch([
    join(rootDir, 'pages'),
    join(rootDir, 'src'),
    join(rootDir, 'framework.config.*'),
    join(rootDir, '.env'),
    join(rootDir, '.env.local')
  ], { ignoreInitial: true });
  watcher.on('all', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rebuild(), 80);
  });
  await rebuild();
  return {
    watcher,
    async close() {
      if (timer) clearTimeout(timer);
      await watcher.close();
    }
  };
}

export async function loadManifest(rootDir: string, outDir = '.meu'): Promise<RouteManifest> {
  const file = join(resolve(rootDir, outDir), 'manifest.json');
  return JSON.parse(await fs.readFile(file, 'utf8')) as RouteManifest;
}

async function findClientEntry(rootDir: string): Promise<string | undefined> {
  for (const candidate of ['src/client.ts', 'src/client.tsx', 'client.ts', 'client.tsx']) {
    const file = join(rootDir, candidate);
    try {
      await fs.access(file);
      return file;
    } catch {
      // Continua procurando.
    }
  }
  return undefined;
}

async function generateStaticPages(manifest: RouteManifest, outDir: string, mode: 'development' | 'production'): Promise<void> {
  if (mode !== 'production') return;
  for (const route of manifest.routes.filter((candidate) => candidate.kind !== 'api')) {
    const module = await import(`${pathToFileURL(route.bundle).href}?static=${Date.now()}`) as PageModule;
    if (!module.getStaticProps) continue;
    const paths = route.dynamic
      ? module.getStaticPaths ? await module.getStaticPaths() : []
      : [{}];
    for (const params of paths) {
      const pathname = route.dynamic ? materializePath(route.segments, params) : route.pathname;
      const context = createBuildContext(pathname);
      context.params = params;
      const props = await module.getStaticProps(context);
      const html = await module.default(props, context);
      const outputDir = join(outDir, 'static', pathname === '/' ? '' : pathname.slice(1));
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(join(outputDir, 'index.html'), html);
    }
  }
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else await fs.copyFile(from, to);
  }
}

async function copyDirectoryIfExists(source: string, target: string): Promise<void> {
  try { await fs.access(source); } catch { return; }
  await copyDirectory(source, target);
}

function deployServerSource(): string {
  return `import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, createAppServer } from 'jeston';
const rootDir = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const manifest = await loadManifest(rootDir, '.meu');
const app = createAppServer(manifest, { rootDir, port, poweredBy: false });
await app.listen(port, process.env.HOST || '0.0.0.0');
console.log('Jeston production server listening on ' + port);
`;
}

function createBuildContext(pathname: string): RequestContext {
  return {
    request: {} as RequestContext['request'],
    response: {} as RequestContext['response'],
    url: new URL(`http://static.local${pathname}`),
    params: {},
    query: new URLSearchParams(),
    headers: {},
    body: undefined,
    runtime: 'node',
    state: {},
    env: process.env
  };
}

function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'index';
}

function materializePath(segments: string[], params: Record<string, string | string[]>): string {
  const parts = segments.flatMap((segment) => {
    if (!segment.startsWith(':') && !segment.startsWith('*')) return [segment];
    const name = segment.replace(/^\*/, '').replace(/^:/, '').replace(/\?$/, '');
    const value = params[name];
    if (value === undefined) return [];
    return Array.isArray(value) ? value.map(encodeURIComponent) : [encodeURIComponent(value)];
  });
  return `/${parts.join('/')}`.replace(/\/+/g, '/') || '/';
}
