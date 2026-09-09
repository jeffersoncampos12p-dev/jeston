import type { ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';

export const defaultSecurityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:"
};

export function createCspNonce(): string {
  return randomBytes(18).toString('base64url');
}

export function createSecureSecurityHeaders(nonce = createCspNonce(), options: { trustedTypes?: boolean } = {}): Record<string, string> {
  const trustedTypes = options.trustedTypes ? "; require-trusted-types-for 'script'; trusted-types jeston" : '';
  return {
    ...defaultSecurityHeaders,
    'Content-Security-Policy': `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; img-src 'self' data: https:; connect-src 'self' ws: wss:${trustedTypes}`
  };
}

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

export interface SafeUrlPolicy {
  allowedHosts?: string[];
  allowedProtocols?: string[];
  allowPrivateNetwork?: boolean;
}

export function assertSafeUrl(input: string | URL, policy: SafeUrlPolicy = {}): URL {
  const url = input instanceof URL ? input : new URL(input);
  const protocols = policy.allowedProtocols ?? ['https:'];
  if (!protocols.includes(url.protocol)) throw new Error(`Blocked upstream protocol: ${url.protocol}`);
  if (policy.allowedHosts && !policy.allowedHosts.includes(url.hostname)) throw new Error(`Blocked upstream host: ${url.hostname}`);
  if (!policy.allowPrivateNetwork && isPrivateHostname(url.hostname)) throw new Error(`Blocked private upstream host: ${url.hostname}`);
  return url;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}
