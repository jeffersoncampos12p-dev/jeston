export interface SseOptions<T> {
  signal?: AbortSignal;
  maxEvents?: number;
  serialize?: (value: T) => string;
  event?: string;
}

export interface BoundedStreamOptions {
  signal?: AbortSignal;
  maxChunks?: number;
  maxBytes?: number;
}

const encoder = new TextEncoder();

export function encodeSse(value: unknown, options: { event?: string; id?: string; retry?: number } = {}): Uint8Array {
  const lines = [
    ...(options.event ? [`event: ${options.event}`] : []),
    ...(options.id ? [`id: ${options.id}`] : []),
    ...(options.retry !== undefined ? [`retry: ${options.retry}`] : []),
    `data: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
    ''
  ];
  return encoder.encode(lines.join('\n') + '\n');
}

export async function* createSseStream<T>(source: AsyncIterable<T>, options: SseOptions<T> = {}): AsyncIterable<Uint8Array> {
  const iterator = source[Symbol.asyncIterator]();
  const serialize = options.serialize ?? ((value: T) => typeof value === 'string' ? value : JSON.stringify(value));
  let count = 0;
  try {
    while (options.maxEvents === undefined || count < options.maxEvents) {
      if (options.signal?.aborted) return;
      const next = await iterator.next();
      if (next.done) return;
      count += 1;
      yield encodeSse(serialize(next.value), { event: options.event });
    }
  } finally {
    await iterator.return?.();
  }
}

export async function* boundedStream(source: AsyncIterable<Uint8Array>, options: BoundedStreamOptions = {}): AsyncIterable<Uint8Array> {
  let chunks = 0;
  let bytes = 0;
  for await (const chunk of source) {
    if (options.signal?.aborted) return;
    chunks += 1;
    bytes += chunk.byteLength;
    if (options.maxChunks !== undefined && chunks > options.maxChunks) throw new Error(`Ryvax stream exceeded maxChunks=${options.maxChunks}`);
    if (options.maxBytes !== undefined && bytes > options.maxBytes) throw new Error(`Ryvax stream exceeded maxBytes=${options.maxBytes}`);
    yield chunk;
  }
}
