import type { DatabaseAdapter } from './types.js';

export function createPrismaAdapter(client: {
  [model: string]: {
    findMany(args?: unknown): Promise<unknown[]>;
    findUnique(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
  };
}): DatabaseAdapter {
  const model = (table: string) => {
    const delegate = client[table];
    if (!delegate) throw new Error(`Modelo Prisma not found: ${table}`);
    return delegate;
  };
  return {
    async findMany<T = unknown>(table: string, query: Record<string, unknown> = {}): Promise<T[]> {
      return await model(table).findMany({ where: query }) as T[];
    },
    async findUnique<T = unknown>(table: string, query: Record<string, unknown>): Promise<T | null> {
      return await model(table).findUnique({ where: query }) as T | null;
    },
    async create<T = unknown>(table: string, data: Record<string, unknown>): Promise<T> {
      return await model(table).create({ data }) as T;
    },
    async update<T = unknown>(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T> {
      return await model(table).update({ where, data }) as T;
    },
    async delete<T = unknown>(table: string, where: Record<string, unknown>): Promise<T> {
      return await model(table).delete({ where }) as T;
    }
  };
}

export function createSupabaseAdapter(client: {
  from(table: string): {
    select(columns?: string): { match(query: Record<string, unknown>): Promise<{ data: unknown[] | null; error: Error | null }> };
    insert(data: Record<string, unknown>): { select(): Promise<{ data: unknown[] | null; error: Error | null }> };
    update(data: Record<string, unknown>): { match(query: Record<string, unknown>): { select(): Promise<{ data: unknown[] | null; error: Error | null }> } };
    delete(): { match(query: Record<string, unknown>): { select(): Promise<{ data: unknown[] | null; error: Error | null }> } };
  };
}): DatabaseAdapter {
  const unwrap = async <T>(operation: Promise<{ data: T | null; error: Error | null }>): Promise<T> => {
    const result = await operation;
    if (result.error) throw result.error;
    return result.data as T;
  };
  return {
    async findMany<T = unknown>(table: string, query: Record<string, unknown> = {}): Promise<T[]> {
      return await unwrap<unknown[]>(client.from(table).select('*').match(query)) as T[];
    },
    async findUnique<T = unknown>(table: string, query: Record<string, unknown>): Promise<T | null> {
      const rows = await unwrap<unknown[]>(client.from(table).select('*').match(query));
      return (rows[0] ?? null) as T | null;
    },
    async create<T = unknown>(table: string, data: Record<string, unknown>): Promise<T> {
      const rows = await unwrap<unknown[]>(client.from(table).insert(data).select());
      return rows[0] as T;
    },
    async update<T = unknown>(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T> {
      const rows = await unwrap<unknown[]>(client.from(table).update(data).match(where).select());
      return rows[0] as T;
    },
    async delete<T = unknown>(table: string, where: Record<string, unknown>): Promise<T> {
      const rows = await unwrap<unknown[]>(client.from(table).delete().match(where).select());
      return rows[0] as T;
    }
  };
}

export function createMemoryAdapter(initial: Record<string, Record<string, unknown>[]> = {}): DatabaseAdapter {
  const tables = new Map(Object.entries(initial).map(([name, rows]) => [name, [...rows]]));
  const get = (table: string) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  };
  const matches = (row: Record<string, unknown>, query: Record<string, unknown>) => Object.entries(query).every(([key, value]) => row[key] === value);
  return {
    async findMany<T = unknown>(table: string, query: Record<string, unknown> = {}): Promise<T[]> { return get(table).filter((row) => matches(row, query)) as T[]; },
    async findUnique<T = unknown>(table: string, query: Record<string, unknown>): Promise<T | null> { return (get(table).find((row) => matches(row, query)) ?? null) as T | null; },
    async create<T = unknown>(table: string, data: Record<string, unknown>): Promise<T> { const row = { id: crypto.randomUUID(), ...data }; get(table).push(row); return row as T; },
    async update<T = unknown>(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T> { const row = get(table).find((item) => matches(item, where)); if (!row) throw new Error('Record not found'); Object.assign(row, data); return row as T; },
    async delete<T = unknown>(table: string, where: Record<string, unknown>): Promise<T> { const rows = get(table); const index = rows.findIndex((item) => matches(item, where)); if (index < 0) throw new Error('Record not found'); return rows.splice(index, 1)[0] as T; }
  };
}
