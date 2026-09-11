import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildProject } from '../dist/src/compiler.js';

const sizes = [10, 100, 1000];
const reports = [];
for (const routeCount of sizes) {
  const root = await mkdtemp(join(tmpdir(), `ryvax-benchmark-${routeCount}-`));
  try {
    await mkdir(join(root, 'pages'), { recursive: true });
    for (let index = 0; index < routeCount; index += 1) {
      const directory = join(root, 'pages', 'route-' + index);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, 'index.ts'), `export default () => '<h1>route-${index}</h1>';\n`);
    }
    const started = performance.now();
    const manifest = await buildProject({ rootDir: root, mode: 'production', minify: true, sourcemap: false });
    reports.push({ routeCount, measuredBuildMs: Number((performance.now() - started).toFixed(2)), generatedRoutes: manifest.routes.length, node: process.version });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ schemaVersion: 1, framework: 'ryvax', reports }, null, 2));
