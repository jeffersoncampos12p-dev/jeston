import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const source = join(root, 'path', 'to', 'docs');
const target = join(root, 'docs', 'site');
const files = [
  'index.mdx', 'untitled-page.mdx',
  ...['start', 'core', 'platform', 'reference', 'operations'].flatMap((section) => [])
];
const navigation = {
  Start: ['index', 'start/installation', 'start/first-app', 'start/saas-starter'],
  Core: ['core/architecture', 'core/react-ssr', 'core/routing', 'core/api-routes', 'core/configuration', 'core/execution-and-streaming', 'core/react-server-components'],
  Platform: ['platform/sql', 'platform/auth', 'platform/security', 'platform/cache-jobs-storage', 'platform/health-observability', 'platform/ai-agents'],
  Reference: ['reference/types', 'reference/cli', 'reference/http-contracts', 'reference/adapters', 'reference/compatibility', 'reference/integrations'],
  Operations: ['operations/deployment', 'operations/production', 'operations/migrations', 'operations/benchmark', 'operations/jobs-and-shutdown', 'operations/release-checks', 'operations/ecosystem']
};

async function walk(dir) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

await mkdir(target, { recursive: true });
for (const file of await walk(source)) {
  const rel = relative(source, file);
  if (rel === 'docs.json') continue;
  const destination = join(target, rel);
  await mkdir(dirname(destination), { recursive: true });
  if (rel.startsWith('images/')) await cp(file, destination);
  else if (rel.endsWith('.mdx')) await writeFile(destination, await readFile(file, 'utf8'));
}

const routes = {};
for (const [group, pages] of Object.entries(navigation)) {
  routes[`/${group.toLowerCase()}`] = {
    type: 'group', title: group,
    children: Object.fromEntries(pages.map((page, index) => [index === 0 ? '' : `/${page.split('/').slice(1).join('/')}`, {
      type: 'page', title: page.split('/').at(-1).replaceAll('-', ' '), filepath: `docs/site/${page}.mdx`
    }]))
  };
}
routes['/'] = { type: 'page', title: 'Ryvax Documentation', filepath: 'docs/site/index.mdx' };

const config = {
  $schema: 'https://registry.scalar.com/@scalar/schemas/config',
  scalar: '2.0.0',
  info: {
    title: 'Ryvax by Kvant',
    description: 'React-first full-stack TypeScript framework for deterministic APIs, SSR, streaming, SQL, authentication, jobs, observability, and AI agents.'
  },
  assetsDir: 'docs/site/images',
  siteConfig: {
    theme: 'default',
    logo: { lightMode: 'docs/site/images/6144.png', darkMode: 'docs/site/images/6145.png' },
    head: { meta: [{ name: 'description', content: 'Ryvax framework documentation' }], links: [{ rel: 'icon', href: 'docs/site/images/6143.png' }] },
    routing: { redirects: [{ from: '/start', to: '/' }] }
  },
  navigation: {
    header: [
      { type: 'link', title: 'GitHub', to: 'https://github.com/kvantjs/ryvax.js' },
      { type: 'link', title: 'npm', to: 'https://www.npmjs.com/package/@kvantjs/ryvax.js' }
    ],
    routes
  }
};
await writeFile(join(root, 'scalar.config.json'), JSON.stringify(config, null, 2) + '\n');
await writeFile(join(root, 'docs', 'MIGRATION.md'), '# Documentation migration\n\nThis directory is the canonical Scalar Docs source for Ryvax. The pages and images were migrated from `path/to/docs`, preserving the original MDX content and navigation topics. The legacy Mintlify source remains in the repository for review until the external Scalar project is connected and published.\n');
console.log(`Migrated ${Object.values(navigation).flat().length + 2} pages and assets into docs/site; wrote scalar.config.json.`);
