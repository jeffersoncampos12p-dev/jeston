#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildProject, discoverRouteFiles, exportStaticSite, loadManifest, prepareDeploy, watchProject } from '../compiler.js';
import { createAppServer, createHmrHub } from '../server.js';
import { loadConfig } from '../config.js';

const [command = 'help', ...rawArgs] = process.argv.slice(2);

try {
  if (command === 'create') await createCommand(rawArgs);
  else if (command === 'dev') await runCommand('development', rawArgs);
  else if (command === 'build') await runCommand('production', rawArgs);
  else if (command === 'export') await exportCommand(rawArgs);
  else if (command === 'deploy') await deployCommand(rawArgs);
  else if (command === 'start') await startCommand(rawArgs);
  else if (command === 'doctor') await doctorCommand(rawArgs);
  else if (command === 'help' || command === '--help' || command === '-h') printHelp();
  else throw new Error(`Unknown command "${command}". Run "jeston --help" for usage.`);
} catch (error) {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

async function createCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { template: 'value', 'no-tailwind': 'boolean', help: 'boolean' });
  if (parsed.flags.help) { printHelp(); return; }
  const projectName = parsed.positionals[0];
  if (!projectName || parsed.positionals.length > 1) throw new Error('Provide exactly one project name: npx jeston create my-app');
  const useTailwind = parsed.flags['no-tailwind'] !== true;
  const templateArg = parsed.flags.template === true ? undefined : parsed.flags.template ?? 'react';
  if (templateArg !== 'react' && templateArg !== 'saas') throw new Error('Invalid template. Use --template=react or --template=saas');
  const target = resolve(process.cwd(), projectName);
  if (existsSync(target)) throw new Error(`The directory ${projectName} already exists`);
  await fs.mkdir(target, { recursive: true });
  await writeTemplate(target, projectName, useTailwind, templateArg);
  console.log(`\nProject ${projectName} created.`);
  console.log(`\n  cd ${projectName}`);
  console.log('  npm install');
  console.log('  npm run dev\n');
}

async function runCommand(mode: 'development' | 'production', args: string[]): Promise<void> {
  const parsed = parseArgs(args, { port: 'value', 'out-dir': 'value', help: 'boolean' });
  if (parsed.flags.help) { printHelp(); return; }
  const rootDir = resolve(process.cwd());
  const port = parsePort(parsed.flags.port) ?? (Number(process.env.PORT) || 3000);
  const outDir = resolveOutDir(rootDir, parsed.flags['out-dir']);
  const userConfig = await loadConfig(rootDir);
  if (mode === 'production') {
    const manifest = await buildProject({ rootDir, outDir, mode, minify: true, sourcemap: false });
    console.log(`Build complete: ${manifest.routes.length} routes in ${outDir}.`);
    return;
  }

  const hmr = createHmrHub();
  let app = createAppServer(await buildProject({ rootDir, outDir, mode }), { ...userConfig, rootDir, port }, hmr);
  await app.listen(port);
  console.log(`Jeston running at http://localhost:${port}`);
  console.log(`Output directory: ${outDir}`);
  console.log('HMR active at /_meu/hmr');
  const watch = await watchProject({ rootDir, outDir, mode }, async (manifest) => {
    const refreshedConfig = await loadConfig(rootDir);
    await app.close();
    app = createAppServer(manifest, { ...refreshedConfig, rootDir, port }, hmr);
    await app.listen(port);
    hmr.broadcast();
    console.log(`Rebuild complete: ${manifest.routes.length} routes.`);
  });
  const shutdown = async () => {
    await watch.close();
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  await new Promise<void>(() => undefined);
}

async function startCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { port: 'value', 'out-dir': 'value', help: 'boolean' });
  if (parsed.flags.help) { printHelp(); return; }
  const rootDir = resolve(process.cwd());
  const port = parsePort(parsed.flags.port) ?? (Number(process.env.PORT) || 3000);
  const outDir = resolveOutDir(rootDir, parsed.flags['out-dir']);
  const manifest = await loadManifest(rootDir, outDir);
  const userConfig = await loadConfig(rootDir);
  const app = createAppServer(manifest, { ...userConfig, rootDir, port });
  await app.listen(port);
  console.log(`Jeston running in production at http://localhost:${port}`);
  console.log(`Manifest: ${join(outDir, 'manifest.json')}`);
  await new Promise<void>(() => undefined);
}

async function exportCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { 'out-dir': 'value', help: 'boolean' });
  if (parsed.flags.help) { printHelp(); return; }
  const outDir = resolveOutDir(resolve(process.cwd()), parsed.flags['out-dir'], 'dist');
  const output = await exportStaticSite(resolve(process.cwd()), outDir);
  console.log(`Static export completed at ${output}`);
}

async function deployCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { 'out-dir': 'value', help: 'boolean' });
  if (parsed.flags.help) { printHelp(); return; }
  const outDir = resolveOutDir(resolve(process.cwd()), parsed.flags['out-dir'], 'dist');
  const output = await prepareDeploy(resolve(process.cwd()), outDir);
  console.log(`Node deployment package completed at ${output}`);
  console.log(`Configure the start command as "node ${join(outDir, 'server.mjs')}".`);
}

async function doctorCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args, { 'out-dir': 'value', help: 'boolean' });
  if (parsed.flags.help) { printHelp(); return; }
  const rootDir = resolve(process.cwd());
  const outDir = resolveOutDir(rootDir, parsed.flags['out-dir']);
  const checks: Array<[string, boolean, string]> = [];
  const major = Number(process.versions.node.split('.')[0]);
  checks.push(['Node.js', major >= 20, `v${process.versions.node} (requires Node.js 20+)`]);
  checks.push(['package.json', existsSync(join(rootDir, 'package.json')), rootDir]);
  checks.push(['lockfile', existsSync(join(rootDir, 'package-lock.json')) || existsSync(join(rootDir, 'pnpm-lock.yaml')) || existsSync(join(rootDir, 'yarn.lock')), 'npm, pnpm, or yarn lockfile']);
  checks.push(['node_modules', existsSync(join(rootDir, 'node_modules')), 'run npm ci if absent']);
  const pagesExist = existsSync(join(rootDir, 'pages'));
  checks.push(['pages/', pagesExist, pagesExist ? join(rootDir, 'pages') : 'required for build']);
  const configNames = ['framework.config.ts', 'framework.config.mts', 'framework.config.js', 'framework.config.mjs'];
  checks.push(['framework config', configNames.some((name) => existsSync(join(rootDir, name))), 'optional']);
  if (existsSync(join(rootDir, 'package.json'))) {
    try {
      const packageJson = JSON.parse(await fs.readFile(join(rootDir, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> };
      const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
      checks.push(['Jeston dependency', Object.keys(dependencies).some((name) => name === '@hedronjs/jeston' || name === 'jeston'), 'package.json dependencies']);
      checks.push(['build script', typeof packageJson.scripts?.build === 'string', 'package.json scripts.build']);
    } catch {
      checks.push(['package.json syntax', false, 'invalid JSON']);
    }
  }
  if (pagesExist) {
    try {
      const files = await discoverRouteFiles(rootDir);
      checks.push(['route discovery', files.length > 0, `${files.length} route source file(s)`]);
    } catch (error) {
      checks.push(['route discovery', false, error instanceof Error ? error.message : String(error)]);
    }
  }
  const manifestPath = join(outDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = await loadManifest(rootDir, outDir);
      checks.push(['build manifest', manifest.routes.length > 0, `${manifest.routes.length} route(s), runtime ${manifest.runtime ?? 'node'}`]);
    } catch {
      checks.push(['build manifest', false, `${manifestPath} is not valid JSON`]);
    }
  } else {
    checks.push(['build manifest', false, `${manifestPath} not found; run jeston build`]);
  }
  console.log('Jeston doctor\n');
  for (const [name, passed, detail] of checks) console.log(`${passed ? 'PASS' : 'WARN'}  ${name}: ${detail}`);
  if (checks.some(([name, passed]) => !passed && (name === 'Node.js' || name === 'package.json' || name === 'pages/' || name === 'node_modules'))) process.exitCode = 1;
}

interface ParsedArgs { positionals: string[]; flags: Record<string, string | true | undefined>; }
type FlagSpec = 'boolean' | 'value';

function parseArgs(args: string[], allowed: Record<string, FlagSpec>): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | true | undefined> = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) continue;
    if (!argument.startsWith('-')) { positionals.push(argument); continue; }
    if (!argument.startsWith('--')) throw new Error(`Invalid argument "${argument}". Use long options such as --port 3000.`);
    const raw = argument.slice(2);
    const equals = raw.indexOf('=');
    const name = equals >= 0 ? raw.slice(0, equals) : raw;
    const inline = equals >= 0 ? raw.slice(equals + 1) : undefined;
    const spec = allowed[name];
    if (!spec) throw new Error(`Unknown option "--${name}".`);
    if (spec === 'boolean') {
      if (inline !== undefined) throw new Error(`Option --${name} does not take a value.`);
      flags[name] = true;
      continue;
    }
    const value = inline ?? args[++index];
    if (!value || value.startsWith('-')) throw new Error(`Option --${name} requires a value.`);
    flags[name] = value;
  }
  return { positionals, flags };
}

function parsePort(value: string | true | undefined): number | undefined {
  if (value === undefined || value === true) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port "${value}". Use an integer from 0 to 65535.`);
  return port;
}

function resolveOutDir(rootDir: string, value: string | true | undefined, fallback = '.meu'): string {
  const selected = value === undefined || value === true ? fallback : value;
  if (!selected || selected === '.' || selected === '..') throw new Error('The --out-dir value must name a dedicated output directory.');
  const output = resolve(rootDir, selected);
  if (output === rootDir || output.startsWith(`${rootDir}${process.platform === 'win32' ? '\\' : '/'}.git`)) throw new Error('The output directory cannot be the project root or .git.');
  return output;
}

async function writeTemplate(target: string, projectName: string, useTailwind: boolean, template: 'react' | 'saas'): Promise<void> {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: projectName,
      private: true,
      type: 'module',
      scripts: useTailwind
        ? { dev: 'npm run css:build && jeston dev', build: 'npm run css:build && jeston build', deploy: 'npm run css:build && jeston deploy', start: 'jeston start', 'css:build': 'tailwindcss -i ./src/styles.css -o ./public/styles.css --minify', typecheck: 'tsc --noEmit' }
        : { dev: 'jeston dev', build: 'jeston build', deploy: 'jeston deploy', start: 'jeston start', typecheck: 'tsc --noEmit' },
      dependencies: { '@hedronjs/jeston': '^1.1.0', react: '^19.2.8', 'react-dom': '^19.2.8' },
      devDependencies: { '@types/node': '^22.0.0', '@types/react': '^19.2.18', '@types/react-dom': '^19.2.7', tsx: '^4.19.0', typescript: '^5.7.0', ...(useTailwind ? { tailwindcss: '^3.4.0', postcss: '^8.4.0', autoprefixer: '^10.4.0' } : {}) }
    }, null, 2) + '\n',
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true, types: ['node'] }, include: ['pages', 'src', 'framework.config.ts'] }, null, 2) + '\n',
    'framework.config.ts': `import type { AppConfig } from '@hedronjs/jeston';\n\nexport default {\n  cache: { enabled: true, defaultTtl: 0, staleWhileRevalidate: 60 },\n  poweredBy: false,\n  observability: { requestLogging: false }\n} satisfies AppConfig;\n`,
    'pages/index.tsx': `import { App } from '../src/App.js';\n\nexport const revalidate = 60;\nexport const getStaticProps = async () => ({ title: 'High-performance SaaS' });\nexport default (props: { title: string }) => <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>{props.title}</title><link rel="stylesheet" href="/styles.css" /></head><body><div id="root"><App title={props.title} /></div><script type="module" src="/_meu/static/client.js"></script></body></html>;\n`,
    'src/App.tsx': `export function App({ title }: { title: string }) {\n  return <main className="shell"><span className="eyebrow">Jeston by Hedron · React-first</span><h1>{title}</h1><p>SSR, hydration, typed APIs, SSG, and HMR for complete SaaS products.</p><a href="/api/health">Check the API →</a></main>;\n}\n`,
    'pages/api/health.ts': `import type { ApiHandler } from '@hedronjs/jeston';\n\nexport const GET: ApiHandler = async ({ env }) => ({ json: { ok: true, service: 'saas', node: process.version, environment: env.NODE_ENV ?? 'development' } });\n`,
    'src/client.tsx': `import { hydrate, installHmr } from '@hedronjs/jeston/client';\nimport { App } from './App.js';\n\nhydrate(<App title="High-performance SaaS" />);\ninstallHmr();\n`,
    'public/styles.css': `:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #e2e8f0; background: #020617; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; }\n.shell { max-width: 760px; margin: 0 auto; padding: 15vh 24px; }\n.eyebrow { color: #38bdf8; text-transform: uppercase; letter-spacing: .14em; font-size: .75rem; font-weight: 700; }\nh1 { font-size: clamp(3rem, 8vw, 6.8rem); line-height: .95; letter-spacing: -.07em; margin: 1rem 0 1.5rem; }\np { max-width: 560px; color: #94a3b8; font-size: 1.2rem; line-height: 1.7; }\na { display: inline-block; margin-top: 1.5rem; color: #020617; background: #38bdf8; padding: .85rem 1.1rem; border-radius: .7rem; text-decoration: none; font-weight: 700; }\n`,
    'src/env.d.ts': `/// <reference types="node" />\n`,
    '.env.example': `NODE_ENV=development\nDATABASE_URL=\n`,
    '.gitignore': `node_modules/\n.meu/\n.env\ndist/\n`
  };
  if (template === 'saas') {
    files['pages/api/session.ts'] = `import { getSession } from '@hedronjs/jeston';\nimport type { ApiHandler } from '@hedronjs/jeston';\n\nexport const GET: ApiHandler = ({ request, env }) => { const session = getSession(request, env.JESTON_SESSION_SECRET ?? ''); return { json: { authenticated: Boolean(session), userId: session?.sub ?? null } }; };\n`;
    files['.env.example'] = `NODE_ENV=development\nJESTON_SESSION_SECRET=replace-with-at-least-32-random-characters\nDATABASE_URL=\nREDIS_URL=\n`;
    files['README.md'] = `# ${projectName}\n\nReact-first SaaS starter created with Jeston by Hedron.\n\n## Development\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nThe starter includes React SSR, hydration, an API health endpoint, a signed-session inspection endpoint, security limits, and extension points for database, cache, and storage adapters. Never use the example secret in production.\n`;
  }
  if (useTailwind) {
    files['src/styles.css'] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }\n.shell { max-width: 760px; margin: 0 auto; padding: 15vh 24px; }\n`;
    files['tailwind.config.ts'] = `import type { Config } from 'tailwindcss';\nexport default { content: ['./pages/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] } satisfies Config;\n`;
    files['postcss.config.cjs'] = `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`;
  }
  for (const [file, contents] of Object.entries(files)) {
    const destination = join(target, file);
    await fs.mkdir(join(destination, '..'), { recursive: true });
    await fs.writeFile(destination, contents);
  }
}

function printHelp(): void {
  console.log(`Jeston\n\nCommands:\n  jeston create <name> [--template react|saas] [--no-tailwind]\n  jeston dev [--port 3000] [--out-dir .meu]\n  jeston build [--out-dir .meu]\n  jeston start [--port 3000] [--out-dir .meu]\n  jeston export [--out-dir dist]\n  jeston deploy [--out-dir dist]\n  jeston doctor [--out-dir .meu]\n  jeston --help\n\nOptions require values where shown. Unknown options and malformed ports are errors.\nBuild outputs are isolated by --out-dir; use different directories for concurrent processes.`);
}
