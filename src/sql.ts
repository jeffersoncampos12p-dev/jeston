export interface SqlResult<T = unknown> {
  rows: T[];
  rowCount?: number;
}

export interface SqlClient {
  query<T = unknown>(text: string, values?: readonly unknown[]): Promise<SqlResult<T>>;
  transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T>;
}

export interface SqliteStatement {
  all<T = unknown>(...values: unknown[]): T[];
  get<T = unknown>(...values: unknown[]): T | undefined;
  run(...values: unknown[]): { changes: number; lastInsertRowid?: number | bigint };
}

export interface SqliteDatabase {
  prepare(text: string): SqliteStatement;
  transaction<T>(work: () => T): T;
}

export function createPostgresAdapter(client: {
  query<T = unknown>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
  connect?: () => Promise<{ query<T = unknown>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number }>; release(): void }>;
}): SqlClient {
  const query = async <T>(text: string, values: readonly unknown[] = []): Promise<SqlResult<T>> => client.query<T>(text, values);
  return {
    query,
    async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
      if (!client.connect) return work({ query, transaction: async () => { throw new Error('Jeston SQL: transação não suportada por este client'); } });
      const connection = await client.connect();
      try {
        await connection.query('BEGIN');
        const transactionClient: SqlClient = { query: (text, values = []) => connection.query(text, values), transaction: async (nested) => nested(transactionClient) };
        const result = await work(transactionClient);
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

export function createSqliteAdapter(database: SqliteDatabase): SqlClient {
  return {
    async query<T = unknown>(text: string, values: readonly unknown[] = []) {
      const statement = database.prepare(text);
      if (/^\s*(select|pragma|with)\b/i.test(text)) {
        const rows = statement.all<T>(...values);
        return { rows, rowCount: rows.length };
      }
      const result = statement.run(...values);
      return { rows: [], rowCount: result.changes };
    },
    async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
      let result!: T;
      const transactionResult = database.transaction(() => work(thisSqliteClient(database)));
      result = await transactionResult;
      return result;
    }
  };
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): { text: string; values: unknown[] } {
  return { text: strings.reduce((text, part, index) => `${text}${part}${index < values.length ? `$${index + 1}` : ''}`, ''), values };
}

export function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Jeston SQL: identificador inválido: ${value}`);
  return `"${value}"`;
}

function thisSqliteClient(database: SqliteDatabase): SqlClient {
  return createSqliteAdapter(database);
}
