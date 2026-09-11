export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface RuntimeCapabilities {
  runtime: 'node' | 'edge';
  node: boolean;
  filesystem: boolean;
  websocket: boolean;
  streaming: boolean;
  backgroundJobs: boolean;
  persistentStorage: boolean;
  maxDurationMs?: number;
}

export function getRuntimeCapabilities(runtime: 'node' | 'edge' = 'node'): RuntimeCapabilities {
  return runtime === 'edge'
    ? { runtime, node: false, filesystem: false, websocket: false, streaming: true, backgroundJobs: false, persistentStorage: false, maxDurationMs: 30_000 }
    : { runtime, node: true, filesystem: true, websocket: true, streaming: true, backgroundJobs: true, persistentStorage: true };
}

export function assertRuntimeCapability(capabilities: RuntimeCapabilities, capability: keyof Omit<RuntimeCapabilities, 'runtime' | 'maxDurationMs'>): void {
  if (!capabilities[capability]) throw new Error(`Ryvax runtime ${capabilities.runtime} does not support capability: ${capability}`);
}

export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs?: number;
  detail?: string;
  tags?: string[];
}

export interface HealthCheckContext {
  signal: AbortSignal;
}

export type HealthCheck = (context?: HealthCheckContext) => HealthCheckResult | Promise<HealthCheckResult>;

export interface HealthReportOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface HealthReport {
  status: HealthStatus;
  checks: Record<string, HealthCheckResult>;
  timestamp: string;
}

export interface HealthRegistry {
  register(name: string, check: HealthCheck): () => boolean;
  report(options?: HealthReportOptions): Promise<HealthReport>;
}

export function createHealthRegistry(): HealthRegistry {
  const checks = new Map<string, HealthCheck>();
  return {
    register(name: string, check: HealthCheck) {
      if (!/^[a-z][a-z0-9_-]{1,62}$/.test(name)) throw new Error('Ryvax health: nome de check inválido');
      checks.set(name, check);
      return () => checks.delete(name);
    },
    async report(options: HealthReportOptions = {}): Promise<HealthReport> {
      const timeoutMs = Math.max(1, options.timeoutMs ?? 5_000);
      const results = await Promise.all([...checks.entries()].map(async ([name, check]) => {
        const started = performance.now();
        const controller = new AbortController();
        const onAbort = () => controller.abort(options.signal?.reason ?? new Error('Health report aborted'));
        options.signal?.addEventListener('abort', onAbort, { once: true });
        let timer: NodeJS.Timeout | undefined;
        try {
          timer = setTimeout(() => controller.abort(new Error(`Health check timed out after ${timeoutMs}ms`)), timeoutMs);
          const result = await Promise.race([
            Promise.resolve().then(() => check({ signal: controller.signal })),
            new Promise<never>((_, reject) => {
              const rejectAbort = () => reject(controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Health check aborted'));
              if (controller.signal.aborted) rejectAbort();
              else controller.signal.addEventListener('abort', rejectAbort, { once: true });
            })
          ]);
          return [name, { ...result, latencyMs: Number((performance.now() - started).toFixed(2)) }] as const;
        } catch (error) {
          return [name, {
            status: 'down' as const,
            latencyMs: Number((performance.now() - started).toFixed(2)),
            detail: error instanceof Error ? error.message : 'check failed'
          }] as const;
        } finally {
          if (timer) clearTimeout(timer);
          options.signal?.removeEventListener('abort', onAbort);
        }
      }));
      const values = Object.fromEntries(results);
      const status: HealthStatus = Object.values(values).some((item) => item.status === 'down')
        ? 'down'
        : Object.values(values).some((item) => item.status === 'degraded') ? 'degraded' : 'ok';
      return { status, checks: values, timestamp: new Date().toISOString() };
    }
  };
}

/** Minimal async cache contract. Existing adapters remain valid; optional methods add richer semantics. */
export interface CacheAdapter {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getFresh?<T = unknown>(key: string): Promise<T | undefined>;
  invalidateTag?(tag: string): Promise<number>;
  clear?(): Promise<void>;
  close?(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<void>;
}

export interface Job<T = unknown> {
  id: string;
  name: string;
  payload: T;
  attempts: number;
  createdAt: Date;
  availableAt?: Date;
  idempotencyKey?: string;
  tags?: string[];
  maxAttempts?: number;
}

export interface JobQueue {
  enqueue<T>(name: string, payload: T, options?: {
    delayMs?: number;
    idempotencyKey?: string;
    tags?: string[];
    maxAttempts?: number;
    signal?: AbortSignal;
  }): Promise<Job<T>>;
  close(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<void>;
}

export interface StorageAdapter {
  put(key: string, body: AsyncIterable<Uint8Array> | Uint8Array, options?: { contentType?: string; signal?: AbortSignal; tags?: string[] }): Promise<{ key: string; url?: string }>;
  get(key: string, options?: { signal?: AbortSignal }): Promise<AsyncIterable<Uint8Array> | null>;
  delete(key: string, options?: { signal?: AbortSignal }): Promise<void>;
}

export interface MetricsAdapter {
  counter(name: string, value?: number, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
  gauge?(name: string, value: number, labels?: Record<string, string>): void;
  flush?(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<void>;
  close?(options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<void>;
}
