import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import * as esbuild from 'esbuild';
import type { AppConfig } from './types.js';

export async function loadConfig(rootDir: string): Promise<AppConfig> {
  const resolvedRoot = resolve(rootDir);
  const env = await loadEnvFiles(resolvedRoot);
  const configFile = await findConfigFile(resolvedRoot);
  if (!configFile) return { rootDir: resolvedRoot, env };
  const result = await esbuild.build({
    entryPoints: [configFile],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    write: false,
    logLevel: 'silent'
  });
  const source = result.outputFiles[0]?.text;
  if (!source) throw new Error(`Could not compile ${configFile}`);
  const imported = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`) as { default?: AppConfig } & AppConfig;
  const userConfig = imported.default ?? imported;
  return { ...userConfig, rootDir: resolvedRoot, env: { ...env, ...userConfig.env } };
}

async function findConfigFile(rootDir: string): Promise<string | undefined> {
  for (const name of ['framework.config.ts', 'framework.config.mts', 'framework.config.js', 'framework.config.mjs']) {
    const file = join(rootDir, name);
    try {
      await fs.access(file);
      return file;
    } catch {
      // Finds the next extension.
    }
  }
  return undefined;
}

async function loadEnvFiles(rootDir: string): Promise<Record<string, string | undefined>> {
  const result: Record<string, string | undefined> = {};
  for (const name of ['.env', '.env.local']) {
    try {
      const source = await fs.readFile(join(rootDir, name), 'utf8');
      for (const line of source.split(/\r?\n/)) {
        const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
        if (!match) continue;
        const raw = match[2] ?? '';
        const key = match[1];
        if (key) result[key] = raw.replace(/^(['"])(.*)\1$/, '$2');
      }
    } catch {
      // .env file is optional.
    }
  }
  return result;
}
