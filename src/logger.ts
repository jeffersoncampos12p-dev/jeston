import { randomUUID } from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'pretty' | 'json';
export type LogMeta = Record<string, unknown>;

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  service?: string;
  destination?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  redact?: string[];
}

const priorities: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const sensitiveKeys = ['password', 'passwd', 'token', 'secret', 'authorization', 'cookie', 'set-cookie', 'api-key', 'apikey'];

export class Logger {
  readonly level: LogLevel;
  readonly format: LogFormat;
  readonly service?: string;
  private readonly destination: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  private readonly redactKeys: Set<string>;
  private readonly bindings: LogMeta;

  constructor(options: LoggerOptions = {}, bindings: LogMeta = {}) {
    this.level = options.level ?? 'info';
    this.format = options.format ?? 'pretty';
    this.service = options.service;
    this.destination = options.destination ?? console;
    this.redactKeys = new Set([...sensitiveKeys, ...(options.redact ?? [])].map((key) => key.toLowerCase()));
    this.bindings = bindings;
  }

  child(bindings: LogMeta): Logger {
    const child = new Logger({ level: this.level, format: this.format, service: this.service, destination: this.destination, redact: [...this.redactKeys] }, { ...this.bindings, ...bindings });
    return child;
  }

  debug(message: string, meta?: LogMeta): void { this.write('debug', message, meta); }
  info(message: string, meta?: LogMeta): void { this.write('info', message, meta); }
  warn(message: string, meta?: LogMeta): void { this.write('warn', message, meta); }
  isEnabled(level: LogLevel): boolean { return priorities[level] >= priorities[this.level]; }
  error(message: string, meta?: LogMeta | Error, extra?: LogMeta): void {
    const metadata = meta instanceof Error ? { ...extra, error: serializeError(meta) } : meta;
    this.write('error', message, metadata);
  }

  private write(level: LogLevel, message: string, meta?: LogMeta): void {
    if (priorities[level] < priorities[this.level]) return;
    const timestamp = new Date().toISOString();
    const fields = redact({ ...this.bindings, ...(meta ?? {}) }, this.redactKeys) as LogMeta;
    const payload = { timestamp, level, ...(this.service ? { service: this.service } : {}), message, ...fields };
    if (this.format === 'json') {
      this.destination[level](JSON.stringify(payload));
      return;
    }
    const suffix = Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : '';
    this.destination[level](`${timestamp} ${level.toUpperCase()} ${this.service ? `[${this.service}] ` : ''}${message}${suffix}`);
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

export function createRequestId(value?: string): string {
  return value?.trim() || randomUUID();
}

function redact(value: unknown, keys: Set<string>, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, keys, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[keys.has(key.toLowerCase()) ? '[REDACTED]' : key] = keys.has(key.toLowerCase()) ? '[REDACTED]' : redact(item, keys, seen);
  return result;
}

function serializeError(error: Error): LogMeta {
  return { name: error.name, message: error.message, stack: error.stack };
}
