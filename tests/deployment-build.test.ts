import { strict as assert } from 'node:assert';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { buildProject } from '../src/compiler.js';
import { buildDocker, buildNetlify, buildVercel, DeploymentBuildError, normalizeBuildManifest } from '../src/deployment-build.js';

test('deployment adapters emit deterministic Vercel and Netlify artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ryvax-adapter-'));
  try {
    await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
    await mkdir(join(root, 'pages'), { recursive: true });
    await writeFile(join(root, 'pages', 'index.ts'), 'export default () => "home";');
    await mkdir(join(root, 'pages', 'users'), { recursive: true });
    await writeFile(join(root, 'pages', 'users', '[id].ts'), 'export default ({ id }) => id;');
    await writeFile(join(root, 'pages', 'api.ts'), 'export const GET = () => ({ json: { ok: true } });');
    await mkdir(join(root, 'public'), { recursive: true });
    await writeFile(join(root, 'public', 'robots.txt'), 'User-agent: *');
    await buildProject({ rootDir: root, mode: 'production', minify: true, sourcemap: false });

    const vercel = await buildVercel({ rootDir: root });
    const netlify = await buildNetlify({ rootDir: root });
    const docker = await buildDocker({ rootDir: root });
    const vercelConfig = JSON.parse(await readFile(join(vercel.outDir, 'config.json'), 'utf8')) as { version: number; routes: unknown[] };
    assert.equal(vercelConfig.version, 3);
    assert.equal(vercelConfig.routes.length, 1);
    assert.equal(await readFile(join(vercel.outDir, 'static', 'robots.txt'), 'utf8'), 'User-agent: *');
    assert.equal(await readFile(join(netlify.outDir, 'public', 'robots.txt'), 'utf8'), 'User-agent: *');
    assert.match(await readFile(join(netlify.outDir, 'netlify.toml'), 'utf8'), /functions = "netlify\/functions"/);
    assert.ok((await readdir(join(vercel.outDir, 'functions', 'ryvax.func'))).includes('index.mjs'));
    assert.ok((await readdir(join(netlify.outDir, 'netlify', 'functions', 'ryvax'))).includes('index.mjs'));
    const dockerfile = await readFile(join(docker.outDir, 'Dockerfile'), 'utf8');
    assert.match(dockerfile, /USER node/);
    assert.match(dockerfile, /HEALTHCHECK/);
    assert.match(dockerfile, /npm ci --omit=dev/);
    assert.equal(await readFile(join(docker.outDir, '.dockerignore'), 'utf8'), 'node_modules\n.git\n*.log\n');

    await buildVercel({ rootDir: root });
    assert.equal(await readFile(join(root, '.vercel', 'output', 'config.json'), 'utf8'), await readFile(join(vercel.outDir, 'config.json'), 'utf8'));
    assert.throws(() => normalizeBuildManifest({ generatedAt: '', routes: [] }, 'manifest.json', 'edge'), (error: unknown) => error instanceof DeploymentBuildError && /Edge compatibility/.test(String(error)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
