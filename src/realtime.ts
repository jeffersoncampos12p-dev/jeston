export interface RealtimeEvent<T = unknown> {
  topic: string;
  payload: T;
  id: string;
  createdAt: number;
}

export interface RealtimeSubscription<T = unknown> {
  readonly topic: string;
  next(options?: { signal?: AbortSignal }): Promise<RealtimeEvent<T>>;
  close(): void;
}

export interface PubSubAdapter {
  publish<T>(topic: string, payload: T): Promise<RealtimeEvent<T>>;
  subscribe<T = unknown>(topic: string, options?: { signal?: AbortSignal }): RealtimeSubscription<T>;
  close(): void;
}

export function createMemoryPubSub(): PubSubAdapter {
  const queues = new Map<string, Array<RealtimeEvent>>();
  const waiters = new Map<string, Array<(event: RealtimeEvent) => void>>();
  let closed = false;
  return {
    async publish<T>(topic: string, payload: T) {
      if (closed) throw new Error('Ryvax pub/sub is closed');
      const event: RealtimeEvent<T> = { topic, payload, id: crypto.randomUUID(), createdAt: Date.now() };
      const waiter = waiters.get(topic)?.shift();
      if (waiter) waiter(event);
      else (queues.get(topic) ?? (queues.set(topic, []), queues.get(topic)!)).push(event);
      return event;
    },
    subscribe<T = unknown>(topic: string, options: { signal?: AbortSignal } = {}) {
      let active = true;
      const next = (): Promise<RealtimeEvent<T>> => {
        if (!active) return Promise.reject(new Error('Ryvax subscription is closed'));
        const queued = queues.get(topic)?.shift();
        if (queued) return Promise.resolve(queued as RealtimeEvent<T>);
        return new Promise<RealtimeEvent<T>>((resolve, reject) => {
          const onAbort = () => { cleanup(); reject(options.signal?.reason ?? new Error('Subscription aborted')); };
          const cleanup = () => options.signal?.removeEventListener('abort', onAbort);
          if (options.signal?.aborted) { onAbort(); return; }
          options.signal?.addEventListener('abort', onAbort, { once: true });
          (waiters.get(topic) ?? (waiters.set(topic, []), waiters.get(topic)!)).push((event) => { cleanup(); resolve(event as RealtimeEvent<T>); });
        });
      };
      return { topic, next, close() { active = false; } };
    },
    close() { closed = true; queues.clear(); waiters.clear(); }
  };
}
