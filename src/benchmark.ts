import { promises as fs } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { buildProject, loadManifest } from './compiler.js';
import { createProjectGraph, diagnoseManifest } from './introspection.js';

export interface ProjectBenchmark {
  schemaVersion: 1;
  framework: 'ryvax';
  node: string;
  mode: 'production';
  rootDir: string;
  buildMs: number;
  routeCount: number;
  bundleCount: number;
  bundleBytes: number;
  graph: ReturnType<typeof createProjectGraph>;
  diagnostics: ReturnType<typeof diagnoseManifest>;
}

export async function benchmarkProject(rootDir: string, options: { outDir?: string; minify?: boolean } = {}): Promise<ProjectBenchmark> {
  const started = performance.now();
  const manifest = await buildProject({
    rootDir: resolve(rootDir),
    mode: 'production',
    outDir: options.outDir,
    minify: options.minify ?? true,
    sourcemap: false
  });
  const buildMs = Number((performance.now() - started).toFixed(2));
  const files = [...manifest.routes.map((route) => route.bundle), ...(manifest.actions ?? []).map((action) => action.bundle)];
  const sizes = await Promise.all(files.map(async (file) => (await fs.stat(file)).size));
  return {
    schemaVersion: 1,
    framework: 'ryvax',
    node: process.version,
    mode: 'production',
    rootDir: resolve(rootDir),
    buildMs,
    routeCount: manifest.routes.length,
    bundleCount: files.length,
    bundleBytes: sizes.reduce((sum, size) => sum + size, 0),
    graph: createProjectGraph(manifest, rootDir),
    diagnostics: diagnoseManifest(manifest, rootDir)
  };
}

export async function benchmarkManifest(rootDir: string, outDir = '.meu'): Promise<ProjectBenchmark | undefined> {
  try {
    const manifest = await loadManifest(resolve(rootDir), outDir);
    const files = [...manifest.routes.map((route) => route.bundle), ...(manifest.actions ?? []).map((action) => action.bundle)];
    const sizes = await Promise.all(files.map(async (file) => (await fs.stat(file)).size));
    return {
      schemaVersion: 1,
      framework: 'ryvax',
      node: process.version,
      mode: 'production',
      rootDir: resolve(rootDir),
      buildMs: 0,
      routeCount: manifest.routes.length,
      bundleCount: files.length,
      bundleBytes: sizes.reduce((sum, size) => sum + size, 0),
      graph: createProjectGraph(manifest, rootDir),
      diagnostics: diagnoseManifest(manifest, rootDir)
    };
  } catch {
    return undefined;
  }
}
