export interface RetryPolicy {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export async function withRetry<T>(operation: (attempt: number) => Promise<T>, policy: RetryPolicy = {}): Promise<T> {
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, policy.baseDelayMs ?? 50);
  const maxDelayMs = Math.max(baseDelayMs, policy.maxDelayMs ?? 2_000);
  const jitter = Math.max(0, Math.min(1, policy.jitter ?? 0.2));
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxAttempts || policy.shouldRetry?.(error, attempt) === false) throw error;
      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const delay = Math.round(exponential * (1 - jitter + Math.random() * jitter * 2));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

export interface CircuitBreaker<T> {
  execute(operation: () => Promise<T>): Promise<T>;
  state(): 'closed' | 'open' | 'half-open';
  reset(): void;
}

export function createCircuitBreaker<T>(options: CircuitBreakerOptions = {}): CircuitBreaker<T> {
  const threshold = Math.max(1, options.failureThreshold ?? 5);
  const resetTimeoutMs = Math.max(1, options.resetTimeoutMs ?? 30_000);
  let failures = 0;
  let openedAt = 0;
  let halfOpen = false;
  return {
    async execute(operation) {
      if (openedAt > 0 && Date.now() - openedAt < resetTimeoutMs) throw new Error('Circuit breaker is open');
      if (openedAt > 0) halfOpen = true;
      try {
        const result = await operation();
        failures = 0;
        openedAt = 0;
        halfOpen = false;
        return result;
      } catch (error) {
        failures += 1;
        if (halfOpen || failures >= threshold) openedAt = Date.now();
        throw error;
      }
    },
    state() {
      if (!openedAt) return 'closed';
      return Date.now() - openedAt >= resetTimeoutMs ? 'half-open' : 'open';
    },
    reset() {
      failures = 0;
      openedAt = 0;
      halfOpen = false;
    }
  };
}

export interface FetchPolicy extends RetryPolicy {
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetch?: typeof fetch;
}

export async function fetchWithPolicy(input: RequestInfo | URL, init: RequestInit = {}, policy: FetchPolicy = {}): Promise<Response> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Upstream request timed out')), policy.timeoutMs ?? 10_000);
    try {
      const response = await (policy.fetch ?? fetch)(input, { ...init, signal: init.signal ?? controller.signal });
      const length = Number(response.headers.get('content-length') ?? 0);
      if (policy.maxResponseBytes !== undefined && length > policy.maxResponseBytes) throw new Error('Upstream response exceeds the configured limit');
      return response;
    } finally {
      clearTimeout(timer);
    }
  }, policy);
}
