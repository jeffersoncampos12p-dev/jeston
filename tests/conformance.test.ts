import { strict as assert } from 'node:assert';
import { rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { buildProject } from '../src/compiler.js';
import { createProjectGraph, diagnoseManifest } from '../src/introspection.js';
import { buildDocker } from '../src/deployment-build.js';

const fixture = resolve(new URL('../fixtures/reference-app/', import.meta.url).pathname);

test('reference fixture conforms to build, routes, API, streaming and deployment contracts', async () => {
  try {
    const manifest = await buildProject({ rootDir: fixture, mode: 'production', minify: true, sourcemap: false });
    const graph = createProjectGraph(manifest, fixture);
    assert.equal(graph.routeCount, 5);
    assert.equal(graph.apiRouteCount, 2);
    assert.equal(graph.pageRouteCount, 3);
    assert.equal(graph.dynamicRouteCount, 0);
    assert.deepEqual(diagnoseManifest(manifest, fixture), []);
    assert.ok(manifest.routes.some((route) => route.pathname === '/'));
    assert.ok(manifest.routes.some((route) => route.pathname === '/api/health'));
    assert.ok(manifest.routes.some((route) => route.pathname === '/api/events'));
    assert.match(await readFile(join(fixture, '.meu', 'routes.d.ts'), 'utf8'), /api\/health/);
    const docker = await buildDocker({ rootDir: fixture });
    assert.match(await readFile(join(docker.outDir, 'Dockerfile'), 'utf8'), /USER node/);
  } finally {
    await rm(join(fixture, '.meu'), { recursive: true, force: true });
    await rm(join(fixture, '.ryvax-cache'), { recursive: true, force: true });
    await rm(join(fixture, 'dist'), { recursive: true, force: true });
  }
});
