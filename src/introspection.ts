import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { RouteManifest } from './types.js';

export interface ProjectGraphRoute {
  id: string;
  pathname: string;
  kind: string;
  dynamic: boolean;
  catchAll: boolean;
  segments: string[];
  layouts: number;
  boundaries: string[];
}

export interface ProjectGraph {
  schemaVersion: 1;
  rootDir: string;
  runtime: string;
  capabilities: RouteManifest['capabilities'];
  routeCount: number;
  apiRouteCount: number;
  pageRouteCount: number;
  dynamicRouteCount: number;
  actionCount: number;
  routes: ProjectGraphRoute[];
}

export interface Diagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  suggestions: string[];
}

export function createProjectGraph(manifest: RouteManifest, rootDir: string): ProjectGraph {
  const routes = manifest.routes.map((route) => ({
    id: route.id,
    pathname: route.pathname,
    kind: route.kind,
    dynamic: route.dynamic,
    catchAll: route.catchAll,
    segments: route.segments,
    layouts: route.layouts?.length ?? 0,
    boundaries: [
      route.errorBoundary ? 'error' : undefined,
      route.forbiddenBoundary ? 'forbidden' : undefined,
      route.unauthorizedBoundary ? 'unauthorized' : undefined,
      route.loadingBoundary ? 'loading' : undefined
    ].filter((value): value is string => Boolean(value))
  }));
  return {
    schemaVersion: 1,
    rootDir: resolve(rootDir),
    runtime: manifest.runtime ?? 'node',
    capabilities: manifest.capabilities,
    routeCount: routes.length,
    apiRouteCount: routes.filter((route) => route.kind === 'api').length,
    pageRouteCount: routes.filter((route) => route.kind !== 'api').length,
    dynamicRouteCount: routes.filter((route) => route.dynamic).length,
    actionCount: manifest.actions?.length ?? 0,
    routes
  };
}

export function diagnoseManifest(manifest: RouteManifest, rootDir: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const ids = new Set<string>();
  const paths = new Map<string, string>();
  for (const route of manifest.routes) {
    if (ids.has(route.id)) diagnostics.push({ code: 'RYX-1001', severity: 'error', message: `Duplicate route id: ${route.id}`, file: route.file, suggestions: ['Regenerate the manifest after removing duplicate route files.'] });
    ids.add(route.id);
    const previous = paths.get(route.pathname);
    if (previous && previous !== route.id) diagnostics.push({ code: 'RYX-1002', severity: 'error', message: `Ambiguous route pathname: ${route.pathname}`, file: route.file, suggestions: [`Inspect both ${previous} and ${route.id}.`] });
    paths.set(route.pathname, route.id);
    if (!existsSync(route.bundle)) diagnostics.push({ code: 'RYX-1003', severity: 'error', message: `Generated route bundle is missing: ${route.pathname}`, file: route.file, suggestions: ['Run a clean `ryvax build` and inspect the generated output directory.'] });
    if (route.kind === 'api' && route.layouts?.length) diagnostics.push({ code: 'RYX-1004', severity: 'warning', message: `API route has page layouts attached: ${route.pathname}`, file: route.file, suggestions: ['Move layouts to a page route or remove the accidental nesting.'] });
  }
  if (manifest.routes.length === 0) diagnostics.push({ code: 'RYX-1005', severity: 'warning', message: 'No routes were found in the generated manifest.', file: join(rootDir, 'pages'), suggestions: ['Create pages/index.ts or app/page.ts and run `ryvax build`.'] });
  return diagnostics;
}
