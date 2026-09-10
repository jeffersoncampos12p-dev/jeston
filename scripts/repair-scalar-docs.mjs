import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const docs = join(root, 'docs', 'site');
const groups = [
  ['Start', [['/', 'Ryvax Documentation', 'index.mdx'], ['/start/installation', 'Installation', 'start/installation.mdx'], ['/start/first-app', 'First app', 'start/first-app.mdx'], ['/start/saas-starter', 'SaaS starter', 'start/saas-starter.mdx'], ['/start/untitled-page', 'Additional page', 'untitled-page.mdx']]],
  ['Core', [['/core/architecture', 'Architecture', 'core/architecture.mdx'], ['/core/react-ssr', 'React SSR and hydration', 'core/react-ssr.mdx'], ['/core/routing', 'Routing', 'core/routing.mdx'], ['/core/api-routes', 'API routes', 'core/api-routes.mdx'], ['/core/configuration', 'Configuration', 'core/configuration.mdx'], ['/core/execution-and-streaming', 'Execution and streaming', 'core/execution-and-streaming.mdx'], ['/core/react-server-components', 'React Server Components', 'core/react-server-components.mdx']]],
  ['Platform', [['/platform/sql', 'SQL', 'platform/sql.mdx'], ['/platform/auth', 'Authentication', 'platform/auth.mdx'], ['/platform/security', 'Security', 'platform/security.mdx'], ['/platform/cache-jobs-storage', 'Cache, jobs, and storage', 'platform/cache-jobs-storage.mdx'], ['/platform/health-observability', 'Health and observability', 'platform/health-observability.mdx'], ['/platform/ai-agents', 'AI agents', 'platform/ai-agents.mdx']]],
  ['Reference', [['/reference/types', 'Types', 'reference/types.mdx'], ['/reference/cli', 'CLI', 'reference/cli.mdx'], ['/reference/http-contracts', 'HTTP contracts', 'reference/http-contracts.mdx'], ['/reference/adapters', 'Adapters', 'reference/adapters.mdx'], ['/reference/compatibility', 'Compatibility', 'reference/compatibility.mdx'], ['/reference/integrations', 'Integrations', 'reference/integrations.mdx']]],
  ['Operations', [['/operations/deployment', 'Deployment', 'operations/deployment.mdx'], ['/operations/production', 'Production', 'operations/production.mdx'], ['/operations/migrations', 'Migrations', 'operations/migrations.mdx'], ['/operations/benchmark', 'Benchmark', 'operations/benchmark.mdx'], ['/operations/jobs-and-shutdown', 'Jobs and shutdown', 'operations/jobs-and-shutdown.mdx'], ['/operations/release-checks', 'Release checks', 'operations/release-checks.mdx'], ['/operations/ecosystem', 'Ecosystem', 'operations/ecosystem.mdx']]]
];

for (const [, pages] of groups) {
  for (const [, , file] of pages) {
    const path = join(docs, file);
    const source = await fs.readFile(path, 'utf8');
    const withReferences = source.replace(/^## Related topics\n[\s\S]*?(?=^## References\n)/gm, '');
    const cleaned = withReferences.includes('## References') ? withReferences : withReferences.replace(/^## Related topics\n[\s\S]*$/m, '');
    await fs.writeFile(path, cleaned);
  }
}

const routes = {};
for (const [group, pages] of groups) {
  const children = {};
  for (const [route, title, file] of pages) {
    children[route] = { type: 'page', title, filepath: `docs/site/${file}`, showInSidebar: true, layout: { sidebar: true } };
  }
  routes[`/${group.toLowerCase()}`] = { type: 'group', title: group, children };
}
const config = {
  $schema: 'https://registry.scalar.com/@scalar/schemas/config',
  scalar: '2.0.0',
  info: { title: 'Ryvax by Kvant', description: 'React-first full-stack TypeScript framework for deterministic APIs, SSR, streaming, SQL, authentication, jobs, observability, and AI agents.' },
  assetsDir: 'docs/site/images',
  siteConfig: {
    theme: 'default',
    layout: { sidebar: true, toc: true, pageTitle: true, pageActions: true, search: { enabled: true } },
    logo: { lightMode: 'docs/site/images/6144.png', darkMode: 'docs/site/images/6145.png' },
    head: { meta: [{ name: 'description', content: 'Ryvax framework documentation' }], links: [{ rel: 'icon', href: 'docs/site/images/6143.png' }] },
    routing: { redirects: [{ from: '/start', to: '/' }] }
  },
  navigation: {
    header: [
      { type: 'link', title: 'GitHub', to: 'https://github.com/kvantjs/ryvax.js' },
      { type: 'link', title: 'npm', to: 'https://www.npmjs.com/package/@kvantjs/ryvax.js' },
      { type: 'link', title: 'Changelog', to: 'https://github.com/kvantjs/ryvax.js/blob/main/CHANGELOG.md' },
      { type: 'link', title: 'Issues', to: 'https://github.com/kvantjs/ryvax.js/issues' }
    ],
    routes
  }
};
await fs.writeFile(join(root, 'scalar.config.json'), JSON.stringify(config, null, 2) + '\n');
console.log(`Repaired ${groups.length} sidebar groups and ${groups.flatMap(([, pages]) => pages).length} visible pages.`);
