import type { ServerResponse } from 'node:http';

export const defaultSecurityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:"
};

export function applySecurityHeaders(response: ServerResponse, custom: Record<string, string> = {}): void {
  for (const [name, value] of Object.entries({ ...defaultSecurityHeaders, ...custom })) {
    response.setHeader(name, value);
  }
}

export function setCacheHeaders(response: ServerResponse, options: {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  private?: boolean;
}): void {
  const visibility = options.private ? 'private' : 'public';
  const directives = [`${visibility}`, `max-age=${Math.max(0, options.maxAge ?? 0)}`];
  if (options.sMaxAge !== undefined && !options.private) directives.push(`s-maxage=${Math.max(0, options.sMaxAge)}`);
  if (options.staleWhileRevalidate !== undefined) directives.push(`stale-while-revalidate=${Math.max(0, options.staleWhileRevalidate)}`);
  response.setHeader('Cache-Control', directives.join(', '));
}
