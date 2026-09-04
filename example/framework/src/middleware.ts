import type { Middleware, RequestContext, ResponseLike } from './types.js';
import { z, type ZodType } from 'zod';

export function composeMiddleware(middlewares: Middleware[], terminal: (context: RequestContext) => ResponseLike | Promise<ResponseLike>): (context: RequestContext) => Promise<ResponseLike> {
  return async function dispatch(context: RequestContext): Promise<ResponseLike> {
    let index = -1;
    const run = async (position: number): Promise<ResponseLike> => {
      if (position <= index) throw new Error('next() chamado mais de uma vez');
      index = position;
      const middleware = position === middlewares.length ? undefined : middlewares[position];
      if (!middleware) return terminal(context);
      return middleware(context, () => run(position + 1));
    };
    return run(0);
  };
}

export interface AuthUser {
  id: string;
  [key: string]: unknown;
}

export interface AuthOptions {
  verify: (token: string, context: RequestContext) => AuthUser | Promise<AuthUser | null> | null;
  optional?: boolean;
  cookieName?: string;
}

export function authMiddleware(options: AuthOptions): Middleware {
  return async (context, next) => {
    const authorization = context.headers.authorization;
    const cookieToken = parseCookies(context.headers.cookie ?? '')[options.cookieName ?? 'token'];
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : cookieToken;
    if (!token) {
      if (options.optional) return next();
      return { status: 401, json: { error: 'Autenticação necessária' } };
    }
    const user = await options.verify(token, context);
    if (!user) return { status: 401, json: { error: 'Credenciais inválidas' } };
    context.state.user = user;
    return next();
  };
}

export function validateBody<T>(schema: ZodType<T>): Middleware {
  return async (context, next) => {
    const result = schema.safeParse(context.body);
    if (!result.success) return { status: 422, json: { error: 'Payload inválido', issues: result.error.flatten() } };
    context.body = result.data;
    return next();
  };
}

export function validateQuery<T extends z.ZodRawShape>(schema: z.ZodObject<T>): Middleware {
  return async (context, next) => {
    const result = schema.safeParse(Object.fromEntries(context.query.entries()));
    if (!result.success) return { status: 422, json: { error: 'Query inválida', issues: result.error.flatten() } };
    Object.assign(context.state, { query: result.data });
    return next();
  };
}

function parseCookies(value: string): Record<string, string> {
  return Object.fromEntries(value.split(';').map((part) => {
    const [key, ...rest] = part.trim().split('=');
    return [key ?? '', decodeURIComponent(rest.join('='))];
  }).filter(([key]) => key));
}

export { z };
