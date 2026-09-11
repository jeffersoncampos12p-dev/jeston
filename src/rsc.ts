import { promises as fs } from 'node:fs';
import { builtinModules } from 'node:module';

export type ModuleBoundary = 'server' | 'client' | 'shared';

export interface ModuleAnalysis {
  file: string;
  boundary: ModuleBoundary;
  imports: string[];
  invalidClientImports: string[];
  invalidClientSecrets: string[];
}

export class ModuleBoundaryError extends Error {
  readonly code = 'RYX-2041';
  readonly severity = 'error' as const;
  readonly suggestions: string[];

  constructor(public readonly file: string, public readonly imports: string[], public readonly secrets: string[] = []) {
    const problems = [
      imports.length ? `server-only imports ${imports.join(', ')}` : '',
      secrets.length ? `server secrets ${secrets.join(', ')}` : ''
    ].filter(Boolean).join('; ');
    super(`Invalid Client Component boundary in ${file}: ${problems}. Move server work to a Server Component or expose a validated server action.`);
    this.name = 'ModuleBoundaryError';
    this.suggestions = [
      'Move the server-only dependency behind a server boundary.',
      'Expose only an explicit, validated server function.',
      'Use a public environment variable prefix for values safe to ship to browsers.'
    ];
  }

  toJSON(): { code: string; severity: 'error'; file: string; message: string; suggestions: string[] } {
    return { code: this.code, severity: this.severity, file: this.file, message: this.message, suggestions: this.suggestions };
  }
}

export async function analyzeModule(file: string): Promise<ModuleAnalysis> {
  const source = await fs.readFile(file, 'utf8');
  const boundary: ModuleBoundary = /^\s*["']use client["']/.test(source) ? 'client' : /^\s*["']use server["']/.test(source) ? 'server' : 'shared';
  const imports = [...source.matchAll(/(?:import(?:[^'"`]+from\s*)?|require\(\s*)['"]([^'"`]+)['"]/g)].map((match) => match[1]).filter((value): value is string => Boolean(value));
  const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
  const invalidClientImports = boundary === 'client' ? imports.filter((value) => builtins.has(value) || value === 'fs/promises' || value === 'child_process') : [];
  const envNames = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]).filter((value): value is string => Boolean(value));
  const invalidClientSecrets = boundary === 'client'
    ? envNames.filter((value) => !value.startsWith('PUBLIC_') && !value.startsWith('NEXT_PUBLIC_'))
    : [];
  return { file, boundary, imports, invalidClientImports, invalidClientSecrets: [...new Set(invalidClientSecrets)] };
}

export async function assertValidClientModule(file: string): Promise<ModuleAnalysis> {
  const analysis = await analyzeModule(file);
  if (analysis.invalidClientImports.length > 0 || analysis.invalidClientSecrets.length > 0) {
    throw new ModuleBoundaryError(file, analysis.invalidClientImports, analysis.invalidClientSecrets);
  }
  return analysis;
}

export function assertRscSerializable(value: unknown, path = '$'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (Number.isFinite(value)) return; throw new TypeError(`RSC value at ${path} is not finite`); }
  if (Array.isArray(value)) { value.forEach((item, index) => assertRscSerializable(item, `${path}[${index}]`)); return; }
  if (typeof value === 'object') { for (const [key, item] of Object.entries(value as Record<string, unknown>)) assertRscSerializable(item, `${path}.${key}`); return; }
  throw new TypeError(`RSC value at ${path} is not serializable`);
}
