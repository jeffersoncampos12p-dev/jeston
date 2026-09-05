import { relative, sep } from 'node:path';
import type { RouteDefinition, RouteParams } from './types.js';

const EXTENSIONS = /\.(tsx?|jsx?|mts|cts)$/;

export interface MatchedRoute {
  route: RouteDefinition;
  params: RouteParams;
}

export function fileToRoutePath(file: string, pagesDir: string): {
  pathname: string;
  segments: string[];
  dynamic: boolean;
  catchAll: boolean;
} {
  const relativeFile = relative(pagesDir, file).split(sep).join('/').replace(EXTENSIONS, '');
  const rawSegments = relativeFile.split('/').filter(Boolean);
  const last = rawSegments.at(-1);
  if (last === 'index') rawSegments.pop();
  const segments: string[] = [];
  let dynamic = false;
  let catchAll = false;

  for (const segment of rawSegments) {
    if (segment.startsWith('[[...') && segment.endsWith(']]')) {
      const name = segment.slice(5, -2);
      segments.push(`*${name}?`);
      dynamic = true;
      catchAll = true;
    } else if (segment.startsWith('[...') && segment.endsWith(']')) {
      const name = segment.slice(4, -1);
      segments.push(`*${name}`);
      dynamic = true;
      catchAll = true;
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      const name = segment.slice(1, -1);
      segments.push(`:${name}`);
      dynamic = true;
    } else {
      segments.push(segment);
    }
  }

  const pathname = `/${segments.join('/')}`.replace(/\/+/g, '/') || '/';
  return { pathname, segments, dynamic, catchAll };
}

export function routePattern(segments: string[]): RegExp {
  if (segments.length === 0) return /^\/$/;
  const source = segments.map((segment) => {
    if (segment.startsWith('*') && segment.endsWith('?')) return '(?:/(.*))?';
    if (segment.startsWith('*')) return '/(.+)';
    if (segment.startsWith(':')) return '/([^/]+)';
    return `/${escapeRegex(segment)}`;
  }).join('');
  return new RegExp(`^${source}/?$`);
}

export function matchRoute(route: RouteDefinition, pathname: string): MatchedRoute | null {
  const match = routePattern(route.segments).exec(pathname);
  return match ? paramsFromMatch(route, match) : null;
}

export function matchRouteWithPattern(route: RouteDefinition, pattern: RegExp, pathname: string): MatchedRoute | null {
  const match = pattern.exec(pathname);
  if (!match) return null;
  return paramsFromMatch(route, match);
}

function paramsFromMatch(route: RouteDefinition, match: RegExpExecArray): MatchedRoute {
  const params: RouteParams = {};
  let captureIndex = 1;
  for (const segment of route.segments) {
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(match[captureIndex++] ?? '');
    } else if (segment.startsWith('*')) {
      const value = match[captureIndex++];
      if (value !== undefined) params[segment.replace(/^\*/, '').replace(/\?$/, '')] = value.split('/').map(decodeURIComponent);
    }
  }
  return { route, params };
}

export function sortRoutes(routes: RouteDefinition[]): RouteDefinition[] {
  return [...routes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'api' ? -1 : 1;
    if (a.dynamic !== b.dynamic) return a.dynamic ? 1 : -1;
    if (a.catchAll !== b.catchAll) return a.catchAll ? 1 : -1;
    return a.pathname.localeCompare(b.pathname);
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
