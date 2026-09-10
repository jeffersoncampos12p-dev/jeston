import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SqlClient } from './sql.js';

export interface MigrationFile {
  id: string;
  name: string;
  upPath: string;
  downPath?: string;
}

export interface AppliedMigration {
  id: string;
  name: string;
  checksum: string;
  appliedAt: string;
}

export interface MigrationRunnerOptions {
  client: SqlClient;
  directory: string;
  tableName?: string;
}

export interface MigrationRunner {
  list(): Promise<MigrationFile[]>;
  status(): Promise<{ pending: MigrationFile[]; applied: AppliedMigration[] }>;
  up(): Promise<AppliedMigration[]>;
  down(): Promise<AppliedMigration | undefined>;
}

export function createMigrationRunner(options: MigrationRunnerOptions): MigrationRunner {
  const table = options.tableName ?? 'ryvax_migrations';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error(`Invalid migration table name: ${table}`);

  async function ensureTable(): Promise<void> {
    await options.client.query(`CREATE TABLE IF NOT EXISTS "${table}" (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, checksum VARCHAR(128) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  }

  async function list(): Promise<MigrationFile[]> {
    const names = (await readdir(options.directory)).filter((name) => /^\d+[-_][A-Za-z0-9_-]+\.up\.sql$/.test(name)).sort();
    return names.map((upFile) => {
      const match = /^(\d+[-_][A-Za-z0-9_-]+)\.up\.sql$/.exec(upFile)!;
      const id = match[1]!;
      return { id, name: id.replace(/^\d+[-_]/, ''), upPath: join(options.directory, upFile), downPath: join(options.directory, `${id}.down.sql`) };
    });
  }

  async function applied(): Promise<AppliedMigration[]> {
    await ensureTable();
    const result = await options.client.query<{ id: string; name: string; checksum: string; applied_at: string }>(`SELECT id, name, checksum, applied_at FROM "${table}" ORDER BY id`);
    return result.rows.map((row) => ({ id: row.id, name: row.name, checksum: row.checksum, appliedAt: row.applied_at }));
  }

  async function status() {
    const files = await list();
    const records = await applied();
    const appliedIds = new Set(records.map((record) => record.id));
    return { pending: files.filter((file) => !appliedIds.has(file.id)), applied: records };
  }

  async function up(): Promise<AppliedMigration[]> {
    const files = await list();
    const records = await applied();
    const known = new Map(records.map((record) => [record.id, record]));
    const completed: AppliedMigration[] = [];
    for (const file of files) {
      const source = await readFile(file.upPath, 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const previous = known.get(file.id);
      if (previous) {
        if (previous.checksum !== checksum) throw new Error(`Migration checksum mismatch: ${file.id}`);
        continue;
      }
      const record = await options.client.transaction(async (client) => {
        await client.query(source);
        const appliedAt = new Date().toISOString();
        await client.query(`INSERT INTO "${table}" (id, name, checksum, applied_at) VALUES ($1, $2, $3, $4)`, [file.id, file.name, checksum, appliedAt]);
        return { id: file.id, name: file.name, checksum, appliedAt };
      });
      completed.push(record);
    }
    return completed;
  }

  async function down(): Promise<AppliedMigration | undefined> {
    const files = await list();
    const records = await applied();
    const last = records.at(-1);
    if (!last) return undefined;
    const file = files.find((candidate) => candidate.id === last.id);
    if (!file?.downPath) throw new Error(`Down migration not found: ${last.id}`);
    const source = await readFile(file.downPath, 'utf8');
    return options.client.transaction(async (client) => {
      await client.query(source);
      await client.query(`DELETE FROM "${table}" WHERE id = $1`, [last.id]);
      return last;
    });
  }

  return { list, status, up, down };
}
