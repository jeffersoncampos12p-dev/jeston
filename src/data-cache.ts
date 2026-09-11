import type { CacheAdapter } from './platform.js';

export type DataCacheScope = 'public' | 'private' | 'request';

export interface DataCacheOptions {
  /** Fresh lifetime in seconds. `revalidate` is an equivalent descriptive alias. */
  ttl?: number;
  revalidate?: number;
  staleWhileRevalidate?: number;
  tags?: string[];
  scope?: DataCacheScope;
  varyKey?: string;
  signal?: AbortSignal;
}

export interface DataCacheStats {
  hits: number;
  misses: number;
  deduplicated: number;
  revalidations: number;
  invalidations: number;
}

export interface DataCache {
  get<T>(key: string, options?: DataCacheOptions): Promise<T | undefined>;
  remember<T>(key: string, fn: () => Promise<T>, options?: DataCacheOptions): Promise<T>;
  preload<T>(key: string, fn: () => Promise<T>, options?: DataCacheOptions): Promise<void>;
  revalidateTag(tag: string): Promise<number>;
  revalidatePath(path: string): Promise<number>;
  stats(): DataCacheStats;
  clear(): void;
}

export function createDataCache(adapter: CacheAdapter, requestStore = new Map<string, unknown>()): DataCache {
  const inFlight = new Map<string, Promise<unknown>>();
  const tags = new Map<string, Set<string>>();
  const keys = new Set<string>();
  const counters = { hits: 0, misses: 0, deduplicated: 0, revalidations: 0, invalidations: 0 };
  const keyFor = (key: string, options: DataCacheOptions = {}) => {
    const scope = options.scope ?? 'public';
    if (scope === 'private' && !options.varyKey) throw new Error(`Private cache key "${key}" requires varyKey`);
    return `${scope}:${options.varyKey ?? ''}:${key}`;
  };
  const rememberTags = (fullKey: string, values: string[] | undefined) => {
    keys.add(fullKey);
    for (const tag of new Set(values ?? [])) {
      const members = tags.get(tag) ?? new Set<string>();
      members.add(fullKey);
      tags.set(tag, members);
    }
  };
  const deleteKey = async (fullKey: string) => {
    requestStore.delete(fullKey);
    await adapter.delete(fullKey);
    keys.delete(fullKey);
    for (const [tag, members] of tags) {
      members.delete(fullKey);
      if (members.size === 0) tags.delete(tag);
    }
  };
  const getLocalOrAdapter = async <T>(fullKey: string, options: DataCacheOptions): Promise<T | undefined> => {
    if (options.scope === 'request') return requestStore.get(fullKey) as T | undefined;
    return adapter.get<T>(fullKey);
  };
  const start = async <T>(fullKey: string, fn: () => Promise<T>, options: DataCacheOptions): Promise<T> => {
    const existing = inFlight.get(fullKey) as Promise<T> | undefined;
    if (existing) {
      counters.deduplicated += 1;
      return existing;
    }
    counters.revalidations += 1;
    const operation = Promise.resolve().then(async () => {
      if (options.signal?.aborted) throw options.signal.reason ?? new Error('Data cache operation aborted');
      const value = await fn();
      if (options.scope === 'request') requestStore.set(fullKey, value);
      else await adapter.set(fullKey, value, options.ttl ?? options.revalidate);
      rememberTags(fullKey, options.tags);
      return value;
    }).finally(() => {
      if (inFlight.get(fullKey) === operation) inFlight.delete(fullKey);
    });
    inFlight.set(fullKey, operation);
    return operation;
  };
  return {
    async get<T>(key: string, options: DataCacheOptions = {}): Promise<T | undefined> {
      const fullKey = keyFor(key, options);
      const value = await getLocalOrAdapter<T>(fullKey, options);
      if (value === undefined) counters.misses += 1;
      else counters.hits += 1;
      return value;
    },
    async remember<T>(key: string, fn: () => Promise<T>, options: DataCacheOptions = {}): Promise<T> {
      const fullKey = keyFor(key, options);
      const value = await getLocalOrAdapter<T>(fullKey, options);
      if (value !== undefined) {
        counters.hits += 1;
        return value;
      }
      counters.misses += 1;
      return start(fullKey, fn, options);
    },
    async preload<T>(key: string, fn: () => Promise<T>, options: DataCacheOptions = {}): Promise<void> {
      const fullKey = keyFor(key, options);
      void start(fullKey, fn, options).catch(() => undefined);
    },
    async revalidateTag(tag) {
      const local = [...(tags.get(tag) ?? [])];
      await Promise.all(local.map((key) => deleteKey(key)));
      const external = adapter.invalidateTag ? await adapter.invalidateTag(tag) : 0;
      const count = local.length + external;
      counters.invalidations += count;
      return count;
    },
    async revalidatePath(path) {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      const local = [...keys].filter((key) => key.includes(normalized));
      await Promise.all(local.map((key) => deleteKey(key)));
      const external = adapter.invalidateTag ? await adapter.invalidateTag(`path:${normalized}`) : 0;
      const count = local.length + external;
      counters.invalidations += count;
      return count;
    },
    stats() { return { ...counters }; },
    clear() {
      requestStore.clear();
      keys.clear();
      tags.clear();
      inFlight.clear();
    }
  };
}

export function createMemoryCacheAdapter(): CacheAdapter {
  const values = new Map<string, { value: unknown; expiresAt?: number }>();
  const tagIndex = new Map<string, Set<string>>();
  return {
    async get<T>(key: string) {
      const entry = values.get(key);
      if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) { values.delete(key); return undefined; }
      return entry?.value as T | undefined;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) { values.set(key, { value, expiresAt: ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined }); },
    async delete(key) { values.delete(key); },
    async invalidateTag(tag) {
      const members = tagIndex.get(tag) ?? new Set<string>();
      for (const key of members) values.delete(key);
      tagIndex.delete(tag);
      return members.size;
    },
    async clear() { values.clear(); tagIndex.clear(); }
  };
}
