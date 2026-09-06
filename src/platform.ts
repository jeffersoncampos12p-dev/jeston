export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs?: number;
  detail?: string;
}

export type HealthCheck = () => HealthCheckResult | Promise<HealthCheckResult>;

export interface HealthReport {
  status: HealthStatus;
  checks: Record<string, HealthCheckResult>;
  timestamp: string;
}

export function createHealthRegistry() {
  const checks = new Map<string, HealthCheck>();
  return {
    register(name: string, check: HealthCheck) {
      if (!/^[a-z][a-z0-9_-]{1,62}$/.test(name)) throw new Error('Jeston health: name de check invalid');
      checks.set(name, check);
      return () => checks.delete(name);
    },
    async report(): Promise<HealthReport> {
      const results = await Promise.all([...checks.entries()].map(async ([name, check]) => {
        const started = performance.now();
        try {
          const result = await check();
          return [name, { ...result, latencyMs: Number((performance.now() - started).toFixed(2)) }] as const;
        } catch (error) {
          return [name, { status: 'down' as const, latencyMs: Number((performance.now() - started).toFixed(2)), detail: error instanceof Error ? error.message : 'check failed' }] as const;
        }
      }));
      const values = Object.fromEntries(results);
      const status: HealthStatus = Object.values(values).some((item) => item.status === 'down') ? 'down' : Object.values(values).some((item) => item.status === 'degraded') ? 'degraded' : 'ok';
      return { status, checks: values, timestamp: new Date().toISOString() };
    }
  };
}

export interface CacheAdapter {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Job<T = unknown> {
  id: string;
  name: string;
  payload: T;
  attempts: number;
  createdAt: Date;
}

export interface JobQueue {
  enqueue<T>(name: string, payload: T, options?: { delayMs?: number; idempotencyKey?: string }): Promise<Job<T>>;
  close(): Promise<void>;
}

export interface StorageAdapter {
  put(key: string, body: AsyncIterable<Uint8Array> | Uint8Array, options?: { contentType?: string }): Promise<{ key: string; url?: string }>;
  get(key: string): Promise<AsyncIterable<Uint8Array> | null>;
  delete(key: string): Promise<void>;
}

export interface MetricsAdapter {
  counter(name: string, value?: number, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
}
