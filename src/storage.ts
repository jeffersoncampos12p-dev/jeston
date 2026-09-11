import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

export interface StorageObjectMetadata {
  key: string;
  size: number;
  contentType?: string;
  etag: string;
  createdAt: string;
}

export interface FileStorageAdapter<TUrl = string> {
  put(key: string, body: AsyncIterable<Uint8Array> | Uint8Array, options?: { contentType?: string; signal?: AbortSignal; maxBytes?: number }): Promise<StorageObjectMetadata & { url: TUrl }>;
  get(key: string, options?: { signal?: AbortSignal }): Promise<{ body: AsyncIterable<Uint8Array>; metadata: StorageObjectMetadata } | null>;
  delete(key: string, options?: { signal?: AbortSignal }): Promise<void>;
  signedUrl(key: string, expiresInSeconds?: number): Promise<TUrl>;
}

function safeKey(root: string, key: string): string {
  if (!key || key.includes('\0')) throw new Error('Storage key is invalid');
  const target = resolve(root, key);
  const boundary = root.endsWith(sep) ? root : root + sep;
  if (target !== root && !target.startsWith(boundary)) throw new Error('Storage key escapes the configured root');
  return target;
}

async function bytesOf(body: AsyncIterable<Uint8Array> | Uint8Array, signal?: AbortSignal, maxBytes = 50 * 1024 * 1024): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    if (body.byteLength > maxBytes) throw new Error(`Storage object exceeds maxBytes=${maxBytes}`);
    return body;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of body) {
    if (signal?.aborted) throw signal.reason ?? new Error('Storage upload aborted');
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error(`Storage object exceeds maxBytes=${maxBytes}`);
    chunks.push(chunk);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export function createLocalStorage(rootDir: string): FileStorageAdapter {
  const root = resolve(rootDir);
  const metadataPath = (key: string) => safeKey(root, `${key}.metadata.json`);
  return {
    async put(key, body, options = {}) {
      const file = safeKey(root, key);
      const bytes = await bytesOf(body, options.signal, options.maxBytes);
      const metadata: StorageObjectMetadata = { key, size: bytes.byteLength, ...(options.contentType ? { contentType: options.contentType } : {}), etag: createHash('sha256').update(bytes).digest('hex'), createdAt: new Date().toISOString() };
      await fs.mkdir(dirname(file), { recursive: true });
      await fs.writeFile(file, bytes);
      await fs.writeFile(metadataPath(key), JSON.stringify(metadata));
      return { ...metadata, url: `file://${file}` };
    },
    async get(key, options = {}) {
      const file = safeKey(root, key);
      try {
        const [bytes, metadata] = await Promise.all([fs.readFile(file), fs.readFile(metadataPath(key), 'utf8')]);
        if (options.signal?.aborted) throw options.signal.reason ?? new Error('Storage download aborted');
        const parsed = JSON.parse(metadata) as StorageObjectMetadata;
        return { metadata: parsed, body: (async function* () { yield new Uint8Array(bytes); })() };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async delete(key, options = {}) {
      if (options.signal?.aborted) throw options.signal.reason ?? new Error('Storage delete aborted');
      await Promise.all([fs.rm(safeKey(root, key), { force: true }), fs.rm(metadataPath(key), { force: true })]);
    },
    async signedUrl(key, expiresInSeconds = 300) {
      if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) throw new Error('expiresInSeconds must be positive');
      safeKey(root, key);
      const token = createHash('sha256').update(`${key}:${Math.floor(Date.now() / 1000) + expiresInSeconds}`).digest('hex');
      return `ryvax-local://${encodeURIComponent(key)}?expires=${expiresInSeconds}&token=${token}`;
    }
  };
}
