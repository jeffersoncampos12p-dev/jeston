export type RequestPhase = 'request' | 'middleware' | 'data' | 'render' | 'stream' | 'response';

export interface RequestPhaseSample {
  phase: RequestPhase;
  startedAt: number;
  durationMs?: number;
  attributes?: Record<string, string | number | boolean>;
  error?: string;
}

export interface RequestTrace {
  requestId: string;
  start(phase: RequestPhase, attributes?: Record<string, string | number | boolean>): () => RequestPhaseSample;
  record(phase: RequestPhase, durationMs: number, attributes?: Record<string, string | number | boolean>): void;
  fail(phase: RequestPhase, error: unknown, durationMs?: number): void;
  snapshot(): RequestPhaseSample[];
}

export function createRequestTrace(requestId: string, clock: () => number = () => performance.now()): RequestTrace {
  const samples: RequestPhaseSample[] = [];
  return {
    requestId,
    start(phase, attributes) {
      const startedAt = clock();
      return () => {
        const sample = { phase, startedAt, durationMs: Number((clock() - startedAt).toFixed(2)), ...(attributes ? { attributes: { ...attributes } } : {}) };
        samples.push(sample);
        return sample;
      };
    },
    record(phase, durationMs, attributes) {
      samples.push({ phase, startedAt: clock(), durationMs, ...(attributes ? { attributes: { ...attributes } } : {}) });
    },
    fail(phase, error, durationMs) {
      samples.push({ phase, startedAt: clock(), ...(durationMs === undefined ? {} : { durationMs }), error: error instanceof Error ? error.message : String(error) });
    },
    snapshot() { return samples.map((sample) => ({ ...sample, ...(sample.attributes ? { attributes: { ...sample.attributes } } : {}) })); }
  };
}

export async function withRequestPhase<T>(trace: RequestTrace, phase: RequestPhase, operation: () => Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T> {
  const finish = trace.start(phase, attributes);
  try {
    const result = await operation();
    finish();
    return result;
  } catch (error) {
    trace.fail(phase, error);
    throw error;
  }
}
