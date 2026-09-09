import type { CacheAdapter } from './platform.js';

export type DataCacheScope = 'public' | 'private' | 'request';

export interface DataCacheOptions {
  ttl?: number;
  tags?: string[];
  scope?: DataCacheScope;
  varyKey?: string;
}

export interface DataCache {
  get<T>(key: string, options?: DataCacheOptions): Promise<T | undefined>;
  remember<T>(key: string, fn: () => Promise<T>, options?: DataCacheOptions): Promise<T>;
  revalidateTag(tag: string): Promise<number>;
  revalidatePath(path: string): Promise<number>;
}

export function createDataCache(adapter: CacheAdapter, requestStore = new Map<string, unknown>()): DataCache {
  const keyFor = (key: string, options: DataCacheOptions = {}) => {
    const scope = options.scope ?? 'public';
    if (scope === 'private' && !options.varyKey) throw new Error(`Private cache key "${key}" requires varyKey`);
    return `${scope}:${options.varyKey ?? ''}:${key}`;
  };
  return {
    async get<T>(key: string, options: DataCacheOptions = {}) {
      const fullKey = keyFor(key, options);
      if (options.scope === 'request') return requestStore.get(fullKey) as T | undefined;
      return adapter.get<T>(fullKey);
    },
    async remember<T>(key: string, fn: () => Promise<T>, options: DataCacheOptions = {}) {
      const fullKey = keyFor(key, options);
      const local = options.scope === 'request' ? requestStore.get(fullKey) as T | undefined : await adapter.get<T>(fullKey);
      if (local !== undefined) return local;
      const value = await fn();
      if (options.scope === 'request') requestStore.set(fullKey, value);
      else await adapter.set(fullKey, value, options.ttl);
      return value;
    },
    async revalidateTag(tag) { return adapter.invalidateTag ? adapter.invalidateTag(tag) : 0; },
    async revalidatePath(path) { return adapter.invalidateTag ? adapter.invalidateTag(`path:${path}`) : 0; }
  };
}

export function createMemoryCacheAdapter(): CacheAdapter {
  const values = new Map<string, { value: unknown; expiresAt?: number }>();
  return {
    async get<T>(key: string) { const entry = values.get(key); if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) { values.delete(key); return undefined; } return entry?.value as T | undefined; },
    async set<T>(key: string, value: T, ttlSeconds?: number) { values.set(key, { value, expiresAt: ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined }); },
    async delete(key) { values.delete(key); },
    async clear() { values.clear(); }
  };
}
