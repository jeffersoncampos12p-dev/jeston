export interface MetricSample {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface Span {
  end(error?: unknown): void;
  setAttribute(name: string, value: string | number | boolean): void;
}

export interface TraceAdapter {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span;
}

export interface MetricsRegistry {
  increment(name: string, value?: number, labels?: Record<string, string>): void;
  observe(name: string, value: number, labels?: Record<string, string>): void;
  snapshot(): MetricSample[];
  reset(): void;
}

export function createMetricsRegistry(): MetricsRegistry {
  const samples: MetricSample[] = [];
  return {
    increment(name, value = 1, labels = {}) {
      samples.push({ name, value, labels: { ...labels }, timestamp: Date.now() });
    },
    observe(name, value, labels = {}) {
      samples.push({ name, value, labels: { ...labels }, timestamp: Date.now() });
    },
    snapshot() {
      return samples.map((sample) => ({ ...sample, labels: { ...sample.labels } }));
    },
    reset() {
      samples.length = 0;
    }
  };
}

export function createNoopTracer(): TraceAdapter {
  return {
    startSpan(_name, _attributes) {
      const attributes: Record<string, string | number | boolean> = {};
      return {
        setAttribute(name, value) {
          attributes[name] = value;
        },
        end(_error) {
          void attributes;
        }
      };
    }
  };
}

export async function withSpan<T>(tracer: TraceAdapter, name: string, operation: (span: Span) => Promise<T>, attributes: Record<string, string | number | boolean> = {}): Promise<T> {
  const span = tracer.startSpan(name, attributes);
  try {
    const result = await operation(span);
    span.end();
    return result;
  } catch (error) {
    span.end(error);
    throw error;
  }
}
