import type { CacheEntry, CachePolicy } from './types.js';

export interface ResponseCacheOptions {
  maxEntries?: number;
  onMetric?: (name: 'hit' | 'miss' | 'stale_hit' | 'revalidate' | 'eviction' | 'invalidation', value?: number) => void;
}

export interface ResponseCacheStats {
  entries: number;
  hits: number;
  misses: number;
  staleHits: number;
  revalidations: number;
  evictions: number;
  invalidations: number;
}

export class ResponseCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;
  private readonly onMetric?: ResponseCacheOptions['onMetric'];
  private readonly counters = { hits: 0, misses: 0, staleHits: 0, revalidations: 0, evictions: 0, invalidations: 0 };

  constructor(options: ResponseCacheOptions = {}) {
    this.maxEntries = options.maxEntries === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(options.maxEntries));
    this.onMetric = options.onMetric;
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.record('miss');
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.record('miss');
      return undefined;
    }
    this.touch(key, entry);
    if ((entry.staleAt ?? entry.expiresAt) <= Date.now()) this.record('stale_hit');
    else this.record('hit');
    return entry.value as T;
  }

  getFresh<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || (entry.staleAt ?? entry.expiresAt) <= Date.now()) {
      if (entry && entry.expiresAt <= Date.now()) this.entries.delete(key);
      this.record('miss');
      return undefined;
    }
    this.touch(key, entry);
    this.record('hit');
    return entry.value as T;
  }

  set<T>(key: string, value: T, policyOrTtl: CachePolicy | number = 0): void {
    const policy: CachePolicy = typeof policyOrTtl === 'number' ? { ttl: policyOrTtl } : policyOrTtl;
    const now = Date.now();
    const ttl = Math.max(0, policy.ttl ?? 0) * 1000;
    const staleWhileRevalidate = Math.max(0, policy.staleWhileRevalidate ?? 0) * 1000;
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: now + ttl + staleWhileRevalidate,
      staleAt: now + ttl,
      tags: policy.tags ? [...new Set(policy.tags)] : undefined
    });
    this.evictIfNeeded();
  }

  async remember<T>(key: string, fn: () => Promise<T>, policy: CachePolicy = {}): Promise<T> {
    const fresh = this.getFresh<T>(key);
    if (fresh !== undefined) return fresh;

    const stale = this.entries.get(key);
    if (stale && stale.expiresAt > Date.now()) {
      this.startComputation(key, fn, policy);
      return stale.value as T;
    }

    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    return this.startComputation(key, fn, policy);
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  invalidateTag(tag: string): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.tags?.includes(tag)) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.counters.invalidations += removed;
      this.onMetric?.('invalidation', removed);
    }
    return removed;
  }

  /** Invalidates page/data entries whose cache key contains the path boundary. */
  invalidatePath(path: string): number {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    let removed = 0;
    for (const key of this.entries.keys()) {
      if (key.includes(normalized)) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.counters.invalidations += removed;
      this.onMetric?.('invalidation', removed);
    }
    return removed;
  }

  revalidateTag(tag: string): number {
    return this.invalidateTag(tag);
  }

  revalidatePath(path: string): number {
    return this.invalidatePath(path);
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  size(): number {
    return this.entries.size;
  }

  getStats(): ResponseCacheStats {
    return { entries: this.entries.size, ...this.counters };
  }

  private startComputation<T>(key: string, fn: () => Promise<T>, policy: CachePolicy): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    this.counters.revalidations += 1;
    this.onMetric?.('revalidate');
    const computation = Promise.resolve().then(fn).then((value) => {
      this.set(key, value, policy);
      return value;
    }).finally(() => {
      if (this.inFlight.get(key) === computation) this.inFlight.delete(key);
    });
    this.inFlight.set(key, computation);
    return computation;
  }

  private touch(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      this.counters.evictions += 1;
      this.onMetric?.('eviction');
    }
  }

  private record(name: 'hit' | 'miss' | 'stale_hit' | 'revalidate' | 'eviction' | 'invalidation', value = 1): void {
    if (name === 'hit') this.counters.hits += value;
    if (name === 'miss') this.counters.misses += value;
    if (name === 'stale_hit') this.counters.staleHits += value;
    this.onMetric?.(name, value);
  }
}
