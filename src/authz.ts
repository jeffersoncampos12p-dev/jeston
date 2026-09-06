import type { SessionClaims } from './auth.js';

export interface AuthorizationClaims extends SessionClaims {
  roles?: string[];
  permissions?: string[];
}

export function hasRole(claims: AuthorizationClaims | null | undefined, role: string): boolean {
  return Boolean(claims?.roles?.includes(role));
}

export function hasPermission(claims: AuthorizationClaims | null | undefined, permission: string): boolean {
  return Boolean(claims?.permissions?.includes(permission) || claims?.roles?.includes('admin'));
}

export function requireRole(claims: AuthorizationClaims | null | undefined, role: string): AuthorizationClaims {
  if (!hasRole(claims, role)) throw new AuthorizationError(403, `Role necessária: ${role}`);
  return claims!;
}

export function requirePermission(claims: AuthorizationClaims | null | undefined, permission: string): AuthorizationClaims {
  if (!hasPermission(claims, permission)) throw new AuthorizationError(403, `Permissão necessária: ${permission}`);
  return claims!;
}

export class AuthorizationError extends Error {
  constructor(readonly status: 401 | 403, message = 'Não autorizado') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  const maxKeys = options.maxKeys ?? 10_000;
  if (options.limit < 1 || options.windowMs < 1) throw new Error('Jeston rate limit: limit e windowMs devem ser positivos');
  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const current = entries.get(key);
      if (!current || current.resetAt <= now) {
        if (entries.size >= maxKeys) entries.delete(entries.keys().next().value as string);
        const next = { count: 1, resetAt: now + options.windowMs };
        entries.set(key, next);
        return { allowed: true, remaining: options.limit - 1, resetAt: next.resetAt };
      }
      current.count += 1;
      return { allowed: current.count <= options.limit, remaining: Math.max(0, options.limit - current.count), resetAt: current.resetAt };
    },
    clear() { entries.clear(); }
  };
}
