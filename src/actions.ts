import { createHash } from 'node:crypto';
import type { ActionDefinition } from './types.js';

export interface ActionContext {
  signal?: AbortSignal;
  request?: Request;
  env?: Record<string, string | undefined>;
  state?: Record<string, unknown>;
}

export interface ActionRegistryOptions {
  maxPayloadBytes?: number;
  allowedOrigins?: string[];
  csrf?: { header?: string; expectedToken?: string };
  timeoutMs?: number;
}

export interface ActionInvokeOptions extends ActionContext {
  origin?: string;
  host?: string;
  payload?: unknown;
}

export class ActionError extends Error {
  constructor(public readonly status: number, message: string, public readonly code = 'ACTION_ERROR') {
    super(message);
    this.name = 'ActionError';
  }
}

export function stableActionId(file: string, exportName: string): string {
  return createHash('sha256').update(`${file}\0${exportName}`).digest('hex').slice(0, 24);
}

export function assertSerializable(value: unknown, path = '$'): void {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new ActionError(400, `Action value at ${path} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSerializable(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) assertSerializable(item, `${path}.${key}`);
    return;
  }
  throw new ActionError(400, `Action value at ${path} is not serializable`);
}

export function createActionRegistry(definitions: ActionDefinition[], options: ActionRegistryOptions = {}) {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  return {
    async invoke(id: string, payload: unknown, invokeOptions: ActionInvokeOptions = {}): Promise<unknown> {
      const definition = byId.get(id);
      if (!definition) throw new ActionError(404, 'Action not found', 'ACTION_NOT_FOUND');
      assertSerializable(payload, '$payload');
      if (invokeOptions.origin && invokeOptions.host) {
        const origin = new URL(invokeOptions.origin).origin;
        const expected = new URL(`http://${invokeOptions.host}`).origin;
        const allowed = options.allowedOrigins ?? [expected];
        if (origin !== expected && !allowed.includes(origin)) throw new ActionError(403, 'Action origin is not allowed', 'ACTION_ORIGIN_DENIED');
      }
      if (options.csrf?.expectedToken && invokeOptions.request) {
        const header = options.csrf.header ?? 'x-csrf-token';
        if (invokeOptions.request.headers.get(header) !== options.csrf.expectedToken) throw new ActionError(403, 'Invalid CSRF token', 'ACTION_CSRF_INVALID');
      }
      const module = await import(definition.bundle) as Record<string, unknown>;
      const action = module[definition.exportName];
      if (typeof action !== 'function') throw new ActionError(500, 'Action implementation is unavailable', 'ACTION_IMPLEMENTATION_MISSING');
      const work = Promise.resolve().then(() => action(payload, invokeOptions));
      const result = options.timeoutMs && options.timeoutMs > 0
        ? await Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new ActionError(408, 'Action timed out', 'ACTION_TIMEOUT')), options.timeoutMs))])
        : await work;
      assertSerializable(result, '$result');
      return result;
    }
  };
}
