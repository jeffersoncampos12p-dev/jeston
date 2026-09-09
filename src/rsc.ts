import { promises as fs } from 'node:fs';
import { builtinModules } from 'node:module';

export type ModuleBoundary = 'server' | 'client' | 'shared';

export interface ModuleAnalysis {
  file: string;
  boundary: ModuleBoundary;
  imports: string[];
  invalidClientImports: string[];
}

export class ModuleBoundaryError extends Error {
  constructor(public readonly file: string, public readonly imports: string[]) {
    super(`Invalid Client Component boundary in ${file}: server-only imports ${imports.join(', ')}. Move the import to a Server Component or expose a server action.`);
    this.name = 'ModuleBoundaryError';
  }
}

export async function analyzeModule(file: string): Promise<ModuleAnalysis> {
  const source = await fs.readFile(file, 'utf8');
  const boundary: ModuleBoundary = /^\s*["']use client["']/.test(source) ? 'client' : /^\s*["']use server["']/.test(source) ? 'server' : 'shared';
  const imports = [...source.matchAll(/(?:import(?:[^'"`]+from\s*)?|require\(\s*)['"]([^'"`]+)['"]/g)].map((match) => match[1]).filter((value): value is string => Boolean(value));
  const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
  const invalidClientImports = boundary === 'client' ? imports.filter((value) => builtins.has(value) || value === 'fs/promises' || value === 'child_process') : [];
  return { file, boundary, imports, invalidClientImports };
}

export async function assertValidClientModule(file: string): Promise<ModuleAnalysis> {
  const analysis = await analyzeModule(file);
  if (analysis.invalidClientImports.length > 0) throw new ModuleBoundaryError(file, analysis.invalidClientImports);
  return analysis;
}

export function assertRscSerializable(value: unknown, path = '$'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (Number.isFinite(value)) return; throw new TypeError(`RSC value at ${path} is not finite`); }
  if (Array.isArray(value)) { value.forEach((item, index) => assertRscSerializable(item, `${path}[${index}]`)); return; }
  if (typeof value === 'object') { for (const [key, item] of Object.entries(value as Record<string, unknown>)) assertRscSerializable(item, `${path}.${key}`); return; }
  throw new TypeError(`RSC value at ${path} is not serializable`);
}
