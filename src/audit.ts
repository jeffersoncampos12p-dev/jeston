import { randomUUID } from 'node:crypto';

export interface AuditEvent {
  id: string;
  type: string;
  at: string;
  actorId?: string;
  requestId?: string;
  target?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AuditSink {
  write(event: AuditEvent): Promise<void> | void;
}

export class AuditLog {
  private readonly events: AuditEvent[] = [];
  constructor(private readonly sink?: AuditSink, private readonly maxEvents = 10_000) {}

  async record(event: Omit<AuditEvent, 'id' | 'at'>): Promise<AuditEvent> {
    const full: AuditEvent = { ...event, id: randomUUID(), at: new Date().toISOString() };
    this.events.push(full);
    while (this.events.length > this.maxEvents) this.events.shift();
    await this.sink?.write(full);
    return full;
  }

  list(filter: { type?: string; actorId?: string } = {}): AuditEvent[] {
    return this.events.filter((event) => (!filter.type || event.type === filter.type) && (!filter.actorId || event.actorId === filter.actorId)).map((event) => ({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined }));
  }
}
