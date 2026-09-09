import { randomUUID } from 'node:crypto';
import { withRetry } from './resilience.js';
import type { Job, JobQueue } from './platform.js';

export interface JobOptions {
  delayMs?: number;
  idempotencyKey?: string;
  maxAttempts?: number;
  retryDelayMs?: number;
}

export interface DeadLetterJob<T = unknown> extends Job<T> {
  error: string;
  failedAt: Date;
}

export interface InMemoryJobQueueOptions {
  concurrency?: number;
  handler?: (job: Job) => Promise<void>;
}

export class InMemoryJobQueue implements JobQueue {
  private readonly pending: Array<Job & { options: JobOptions }> = [];
  private readonly idempotency = new Map<string, Job>();
  private readonly deadLetters: DeadLetterJob[] = [];
  private active = 0;
  private closed = false;
  private readonly concurrency: number;
  private readonly handler?: (job: Job) => Promise<void>;

  constructor(options: InMemoryJobQueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.handler = options.handler;
  }

  async enqueue<T>(name: string, payload: T, options: JobOptions = {}): Promise<Job<T>> {
    if (this.closed) throw new Error('Job queue is closed');
    if (options.idempotencyKey) {
      const existing = this.idempotency.get(options.idempotencyKey);
      if (existing) return existing as Job<T>;
    }
    const job: Job<T> = { id: randomUUID(), name, payload, attempts: 0, createdAt: new Date() };
    this.pending.push({ ...job, options });
    if (options.idempotencyKey) this.idempotency.set(options.idempotencyKey, job);
    setTimeout(() => void this.drain(), Math.max(0, options.delayMs ?? 0)).unref();
    return job;
  }

  async process(): Promise<void> {
    await this.drain();
  }

  deadLettersSnapshot(): DeadLetterJob[] {
    return [...this.deadLetters];
  }

  async close(): Promise<void> {
    this.closed = true;
    this.pending.length = 0;
  }

  private async drain(): Promise<void> {
    while (!this.closed && this.active < this.concurrency) {
      const next = this.pending.shift();
      if (!next) return;
      this.active += 1;
      void this.execute(next).finally(() => {
        this.active -= 1;
        void this.drain();
      });
    }
  }

  private async execute(job: Job & { options: JobOptions }): Promise<void> {
    if (!this.handler) return;
    const maxAttempts = Math.max(1, job.options.maxAttempts ?? 3);
    try {
      await withRetry(async (attempt) => {
        job.attempts = attempt;
        await this.handler!(job);
      }, { maxAttempts, baseDelayMs: job.options.retryDelayMs ?? 50, shouldRetry: () => true });
    } catch (error) {
      this.deadLetters.push({ ...job, error: error instanceof Error ? error.message : String(error), failedAt: new Date() });
    }
  }
}
