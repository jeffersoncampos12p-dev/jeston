import { promises as fs } from 'node:fs';
import { dirname, extname, basename, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import chokidar, { type FSWatcher } from 'chokidar';
import { fileToRoutePath, sortRoutes } from './router.js';
import { renderPage } from './render.js';
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
    throw new Error(`pages/ directory not found at ${pagesDir}`);
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
  return files.sort((a, b) => a.localeCompare(b));
}

/**
 * Builds into a process-unique staging directory and swaps it into place only
 * after every bundle, manifest, and generated page is complete.
 */
export async function buildProject(options: BuildOptions): Promise<RouteManifest> {
  const rootDir = resolve(options.rootDir);
  const outputDir = resolve(rootDir, options.outDir ?? '.meu');
  const stagingDir = join(dirname(outputDir), `.${basename(outputDir)}.build-${process.pid}-${randomUUID()}`);
  const pagesDir = resolve(rootDir, 'pages');
  const mode = options.mode ?? 'development';
  await fs.mkdir(dirname(outputDir), { recursive: true });
  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.mkdir(join(stagingDir, 'routes'), { recursive: true });

  try {
    const sourceFiles = await discoverRouteFiles(rootDir);
    const routes = await Promise.all(sourceFiles.map(async (file): Promise<RouteDefinition> => {
      const routeInfo = fileToRoutePath(file, pagesDir);
      const relativeFile = relative(pagesDir, file).split(sep).join('/');
      const kind = relativeFile.startsWith('api/') ? 'api' : 'ssr';
      const id = relativeFile.replace(/\.[^.]+$/, '').replaceAll(sep, '/');
      const bundle = resolve(stagingDir, 'routes', `${slugify(id)}-${stableHash(id)}.mjs`);
      await esbuild.build({
        entryPoints: [file],
        outfile: bundle,
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node20',
        jsx: 'automatic',
        jsxImportSource: 'react',
        packages: 'external',
        sourcemap: options.sourcemap ?? mode === 'development',
        minify: options.minify ?? mode === 'production',
        legalComments: 'none',
        logLevel: 'warning'
      });
      return {
        id,
        kind,
        pathname: routeInfo.pathname,
        pattern: routeInfo.pathname,
        file: resolve(file),
        bundle,
        segments: routeInfo.segments,
        dynamic: routeInfo.dynamic,
        catchAll: routeInfo.catchAll
      };
    }));

    const clientEntry = await findClientEntry(rootDir);
    const client = clientEntry ? { entry: await buildClient(clientEntry, stagingDir, options) } : undefined;
    const generatedAt = process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
      : new Date().toISOString();
    const manifest: RouteManifest = {
      generatedAt,
      runtime: options.runtime ?? 'node',
      outputDir,
      capabilities: {
        api: routes.some((route) => route.kind === 'api'),
        ssr: routes.some((route) => route.kind !== 'api'),
        ssg: routes.some((route) => route.kind !== 'api'),
        streaming: true,
        client: Boolean(client)
      },
      routes: sortRoutes(routes),
      ...(client ? { client } : {})
    };
    await generateStaticPages(manifest, stagingDir, mode);
    const portableManifest = rebaseManifest(manifest, stagingDir, outputDir);
    await fs.writeFile(join(stagingDir, 'manifest.json'), JSON.stringify(portableManifest, null, 2) + '\n');
    await replaceDirectory(stagingDir, outputDir);
    return portableManifest;
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

export async function exportStaticSite(rootDir: string, outDir = 'dist'): Promise<string> {
  const root = resolve(rootDir);
  const target = resolve(root, outDir);
  const buildDir = join(root, `.jeston-export-${process.pid}-${randomUUID()}`);
  try {
    const manifest = await buildProject({ rootDir: root, outDir: buildDir, mode: 'production', minify: true, sourcemap: false });
    await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(target, { recursive: true });
    await copyDirectoryIfExists(join(buildDir, 'static'), target);
    await copyDirectoryIfExists(join(root, 'public'), target);
    await fs.writeFile(join(target, 'manifest.json'), JSON.stringify({ generatedAt: manifest.generatedAt, capabilities: manifest.capabilities, routes: manifest.routes.map(({ id, pathname, kind }) => ({ id, pathname, kind })) }, null, 2) + '\n');
    return target;
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
}

export async function prepareDeploy(rootDir: string, outDir = 'dist'): Promise<string> {
  const root = resolve(rootDir);
  const target = resolve(root, outDir);
  const buildDir = join(root, `.jeston-deploy-${process.pid}-${randomUUID()}`);
  try {
    const manifest = await buildProject({ rootDir: root, outDir: buildDir, mode: 'production', minify: true, sourcemap: false });
    await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(join(target, '.meu'), { recursive: true });
    await copyDirectory(join(buildDir, 'routes'), join(target, '.meu', 'routes'));
    await copyDirectoryIfExists(join(buildDir, 'static'), join(target, '.meu', 'static'));
    await copyDirectoryIfExists(join(root, 'public'), join(target, 'public'));
    const portableManifest = {
      ...manifest,
      outputDir: join(target, '.meu'),
      routes: manifest.routes.map((route) => ({ ...route, file: route.file.replace(root, target), bundle: route.bundle.replace(buildDir, join(target, '.meu')) }))
    };
    await fs.writeFile(join(target, '.meu', 'manifest.json'), JSON.stringify(portableManifest, null, 2) + '\n');
    await fs.writeFile(join(target, 'server.mjs'), deployServerSource());
  await fs.writeFile(join(target, 'package.json'), JSON.stringify({ type: 'module', private: true, scripts: { start: 'node server.mjs' }, dependencies: { '@kvantjs/jeston': '^1.1.0', react: '^19.2.8', 'react-dom': '^19.2.8' }, engines: { node: '>=20' } }, null, 2) + '\n');
    return target;
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
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
    jsx: 'automatic',
    jsxImportSource: 'react',
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
    const paths = route.dynamic ? module.getStaticPaths ? await module.getStaticPaths() : [] : [{}];
    for (const params of paths) {
      const pathname = route.dynamic ? materializePath(route.segments, params) : route.pathname;
      const context = createBuildContext(pathname);
      context.params = params;
      const props = await module.getStaticProps(context);
      const html = renderPage(await module.default(props, context));
      const outputDir = join(outDir, 'static', pathname === '/' ? '' : pathname.slice(1));
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(join(outputDir, 'index.html'), html);
    }
  }
}

async function replaceDirectory(stagingDir: string, outputDir: string): Promise<void> {
  const backupDir = `${outputDir}.previous-${process.pid}-${randomUUID()}`;
  let movedExisting = false;
  try {
    try {
      await fs.rename(outputDir, backupDir);
      movedExisting = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await fs.rename(stagingDir, outputDir);
  } finally {
    if (movedExisting) await fs.rm(backupDir, { recursive: true, force: true });
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

function rebaseManifest(manifest: RouteManifest, from: string, to: string): RouteManifest {
  return {
    ...manifest,
    outputDir: to,
    routes: manifest.routes.map((route) => ({ ...route, bundle: route.bundle.replace(from, to) })),
    ...(manifest.client ? { client: { entry: manifest.client.entry.replace(from, to) } } : {})
  };
}

function deployServerSource(): string {
  return `import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, createAppServer } from '@kvantjs/jeston';
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
    signal: new AbortController().signal,
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

function stableHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
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
