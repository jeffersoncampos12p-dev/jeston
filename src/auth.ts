import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export interface SessionClaims {
  sub: string;
  exp: number;
  iat?: number;
  [claim: string]: unknown;
}

export interface SessionCookieOptions {
  name?: string;
  maxAge?: number;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
  httpOnly?: boolean;
}

const DEFAULT_COOKIE: Required<SessionCookieOptions> = {
  name: 'jeston_session',
  maxAge: 60 * 60 * 24 * 7,
  secure: true,
  sameSite: 'lax',
  path: '/',
  httpOnly: true
};

export function createSessionToken(claims: SessionClaims, secret: string): string {
  if (!secret || secret.length < 32) throw new Error('Jeston auth: the session secret must be at least 32 characters long');
  const encoded = encode(JSON.stringify(claims));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)): SessionClaims | null {
  if (!token || !secret || secret.length < 32) return null;
  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;
  const encoded = token.slice(0, separator);
  const received = token.slice(separator + 1);
  const expected = sign(encoded, secret);
  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(decode(encoded)) as SessionClaims;
    if (!claims.sub || !Number.isFinite(claims.exp) || claims.exp <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export function getSession(request: IncomingMessage, secret: string, options: SessionCookieOptions = {}): SessionClaims | null {
  const config = { ...DEFAULT_COOKIE, ...options };
  return verifySessionToken(parseCookies(request.headers.cookie ?? '')[config.name], secret);
}

export function setSessionCookie(claims: SessionClaims, secret: string, options: SessionCookieOptions = {}): string {
  const config = { ...DEFAULT_COOKIE, ...options };
  const token = createSessionToken(claims, secret);
  const attributes = [`${config.name}=${encodeURIComponent(token)}`, `Path=${config.path}`, `Max-Age=${Math.max(0, config.maxAge)}`, `SameSite=${capitalize(config.sameSite)}`];
  if (config.httpOnly) attributes.push('HttpOnly');
  if (config.secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function clearSessionCookie(options: SessionCookieOptions = {}): string {
  return setCookieValue('', { ...options, maxAge: 0 });
}

export function createCsrfToken(sessionId: string, secret: string): string {
  if (!sessionId) throw new Error('Jeston auth: sessionId is required para CSRF');
  return sign(`csrf:${sessionId}`, secret);
}

export function verifyCsrfToken(token: string | undefined, sessionId: string, secret: string): boolean {
  if (!token || !sessionId || !secret) return false;
  const expected = createCsrfToken(sessionId, secret);
  return token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function setCookieValue(value: string, options: SessionCookieOptions): string {
  const config = { ...DEFAULT_COOKIE, ...options };
  const attributes = [`${config.name}=${value}`, `Path=${config.path}`, `Max-Age=${Math.max(0, config.maxAge)}`, `SameSite=${capitalize(config.sameSite)}`];
  if (config.httpOnly) attributes.push('HttpOnly');
  if (config.secure) attributes.push('Secure');
  return attributes.join('; ');
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
