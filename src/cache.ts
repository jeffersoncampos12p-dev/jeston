import type { CacheEntry, CachePolicy } from './types.js';

export class ResponseCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  getFresh<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || (entry.staleAt ?? entry.expiresAt) <= Date.now()) return undefined;
    return entry.value as T;
  }

  set<T>(key: string, value: T, policyOrTtl: CachePolicy | number = 0): void {
    const policy: CachePolicy = typeof policyOrTtl === 'number' ? { ttl: policyOrTtl } : policyOrTtl;
    const now = Date.now();
    const ttl = Math.max(0, policy.ttl ?? 0) * 1000;
    const staleWhileRevalidate = Math.max(0, policy.staleWhileRevalidate ?? 0) * 1000;
    this.entries.set(key, {
      value,
      expiresAt: now + ttl + staleWhileRevalidate,
      staleAt: now + ttl,
      tags: policy.tags ? [...new Set(policy.tags)] : undefined
    });
  }

  async remember<T>(key: string, fn: () => Promise<T>, policy: CachePolicy = {}): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const computation = Promise.resolve().then(fn).then((value) => {
      this.set(key, value, policy);
      return value;
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, computation);
    return computation;
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
    return removed;
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  size(): number {
    return this.entries.size;
  }
}
