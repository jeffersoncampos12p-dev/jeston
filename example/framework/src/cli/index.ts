#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildProject, exportStaticSite, loadManifest, prepareDeploy, watchProject } from '../compiler.js';
import { createAppServer, createHmrHub } from '../server.js';
import { loadConfig } from '../config.js';

const [command = 'help', ...args] = process.argv.slice(2);

try {
  if (command === 'create') await createCommand(args);
  else if (command === 'dev') await runCommand('development', args);
  else if (command === 'build') await runCommand('production', args);
  else if (command === 'export') await exportCommand(args);
  else if (command === 'deploy') await deployCommand(args);
  else if (command === 'start') await startCommand(args);
  else printHelp();
} catch (error) {
  console.error(`\nErro: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

async function createCommand(args: string[]): Promise<void> {
  const projectName = args.find((arg) => !arg.startsWith('-'));
  if (!projectName) throw new Error('Informe o nome do projeto: npx jeston create meu-app');
  const useTailwind = !args.includes('--no-tailwind');
  const target = resolve(process.cwd(), projectName);
  if (existsSync(target)) throw new Error(`O diretório ${projectName} já existe`);
  await fs.mkdir(target, { recursive: true });
  await writeTemplate(target, projectName, useTailwind);
  console.log(`\nProjeto ${projectName} criado.`);
  console.log(`\n  cd ${projectName}`);
  console.log('  npm install');
  console.log('  npm run dev\n');
}

async function runCommand(mode: 'development' | 'production', args: string[]): Promise<void> {
  const rootDir = resolve(process.cwd());
  const port = numberArg(args, '--port') ?? (Number(process.env.PORT) || 3000);
  const userConfig = await loadConfig(rootDir);
  if (mode === 'production') {
    const manifest = await buildProject({ rootDir, mode, minify: true, sourcemap: false });
    console.log(`Build concluído: ${manifest.routes.length} rotas.`);
    return;
  }

  const hmr = createHmrHub();
  let app = createAppServer(await buildProject({ rootDir, mode }), { ...userConfig, rootDir, port }, hmr);
  await app.listen(port);
  console.log(`Jeston em http://localhost:${port}`);
  console.log('HMR ativo via /_meu/hmr');
  const watch = await watchProject({ rootDir, mode }, async (manifest) => {
    const refreshedConfig = await loadConfig(rootDir);
    await app.close();
    app = createAppServer(manifest, { ...refreshedConfig, rootDir, port }, hmr);
    await app.listen(port);
    hmr.broadcast();
    console.log(`Rebuild concluído: ${manifest.routes.length} rotas.`);
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
  const rootDir = resolve(process.cwd());
  const port = numberArg(args, '--port') ?? (Number(process.env.PORT) || 3000);
  const manifest = await loadManifest(rootDir);
  const userConfig = await loadConfig(rootDir);
  const app = createAppServer(manifest, { ...userConfig, rootDir, port });
  await app.listen(port);
  console.log(`Jeston em produção em http://localhost:${port}`);
  await new Promise<void>(() => undefined);
}

async function exportCommand(args: string[]): Promise<void> {
  const outDir = stringArg(args, '--out-dir') ?? 'dist';
  const output = await exportStaticSite(resolve(process.cwd()), outDir);
  console.log(`Exportação estática concluída em ${output}`);
}

async function deployCommand(args: string[]): Promise<void> {
  const outDir = stringArg(args, '--out-dir') ?? 'dist';
  const output = await prepareDeploy(resolve(process.cwd()), outDir);
  console.log(`Pacote de deploy Node concluído em ${output}`);
  console.log('Configure o build command como "npm run deploy" e o start command como "npm start".');
}

async function writeTemplate(target: string, projectName: string, useTailwind: boolean): Promise<void> {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: projectName,
      private: true,
      type: 'module',
      scripts: useTailwind
        ? { dev: 'npm run css:build && jeston dev', build: 'npm run css:build && jeston build', deploy: 'npm run css:build && jeston deploy', start: 'jeston start', 'css:build': 'tailwindcss -i ./src/styles.css -o ./public/styles.css --minify', typecheck: 'tsc --noEmit' }
        : { dev: 'jeston dev', build: 'jeston build', deploy: 'jeston deploy', start: 'jeston start', typecheck: 'tsc --noEmit' },
      dependencies: { 'jeston': '^0.1.0' },
      devDependencies: { '@types/node': '^22.0.0', tsx: '^4.19.0', typescript: '^5.7.0', ...(useTailwind ? { tailwindcss: '^3.4.0', postcss: '^8.4.0', autoprefixer: '^10.4.0' } : {}) }
    }, null, 2) + '\n',
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true, types: ['node'] }, include: ['pages', 'src', 'framework.config.ts'] }, null, 2) + '\n',
    'framework.config.ts': `import type { AppConfig } from 'jeston';\n\nexport default {\n  cache: { enabled: true, defaultTtl: 0, staleWhileRevalidate: 60 },\n  poweredBy: false\n} satisfies AppConfig;\n`,
    'pages/index.tsx': `import type { PageModule } from 'jeston';\n\nexport const revalidate = 60;\n\nexport const getStaticProps = async () => ({\n  title: 'SaaS de alta performance',\n  framework: 'Jeston'\n});\n\nconst page: PageModule = {\n  async default(props) {\n    return \`<!doctype html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>\${props.title}</title>\n    <link rel="stylesheet" href="/styles.css" />\n  </head>\n  <body>\n    <main class="shell">\n      <span class="eyebrow">\${props.framework}</span>\n      <h1>Construa seu próximo produto.</h1>\n      <p>SSR, SSG, APIs tipadas e HMR em uma base TypeScript pequena e extensível.</p>\n      <a href="/api/health">Verifique a API →</a>\n    </main>\n  </body>\n</html>\`;\n  }\n};\n\nexport default page.default;\n`,
    'pages/api/health.ts': `import type { ApiHandler } from 'jeston';\n\nexport const GET: ApiHandler = async ({ env }) => ({\n  json: { ok: true, service: 'saas', node: process.version, environment: env.NODE_ENV ?? 'development' }\n});\n`,
    'src/client.ts': `import { installHmr } from 'jeston/client';\n\ninstallHmr();\n`,
    'public/styles.css': `:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #e2e8f0; background: #020617; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; }\n.shell { max-width: 760px; margin: 0 auto; padding: 15vh 24px; }\n.eyebrow { color: #38bdf8; text-transform: uppercase; letter-spacing: .14em; font-size: .75rem; font-weight: 700; }\nh1 { font-size: clamp(3rem, 8vw, 6.8rem); line-height: .95; letter-spacing: -.07em; margin: 1rem 0 1.5rem; }\np { max-width: 560px; color: #94a3b8; font-size: 1.2rem; line-height: 1.7; }\na { display: inline-block; margin-top: 1.5rem; color: #020617; background: #38bdf8; padding: .85rem 1.1rem; border-radius: .7rem; text-decoration: none; font-weight: 700; }\n`,
    'src/env.d.ts': `/// <reference types="node" />\n`,
    '.env.example': `NODE_ENV=development\nDATABASE_URL=\n`,
    '.gitignore': `node_modules/\n.meu/\n.env\ndist/\n`
  };
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

function numberArg(args: string[], name: string): number | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

function stringArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`Jeston\n\nComandos:\n  jeston create <nome> [--no-tailwind]\n  jeston dev [--port 3000]\n  jeston build\n  jeston export [--out-dir dist]\n  jeston deploy [--out-dir dist]\n  jeston start [--port 3000]`);
}
