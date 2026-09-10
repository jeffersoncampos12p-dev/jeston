import { buildNetlify, buildVercel } from './deployment-build.js';
import { edgeDeploymentCapabilities, nodeDeploymentCapabilities, validateDeploymentCapabilities, type DeploymentAdapter } from './adapters.js';

function adapter(id: string, capabilities: DeploymentAdapter['capabilities'], instructions: string, build?: (options: { rootDir: string; outDir: string }) => Promise<string>): DeploymentAdapter {
  return {
    id,
    version: '1.0.0',
    capabilities,
    async build(options) { return build ? build(options) : `${options.outDir} (${instructions})`; },
    validate(features) { return validateDeploymentCapabilities(capabilities, features); }
  };
}

export const deploymentAdapters = {
  node: adapter('node', nodeDeploymentCapabilities, 'node server.mjs'),
  docker: adapter('docker', { ...nodeDeploymentCapabilities, filesystem: 'ephemeral' }, 'Dockerfile + node server.mjs'),
  cloudflare: adapter('cloudflare', edgeDeploymentCapabilities, 'Fetch handler'),
  vercel: adapter('vercel', { ...edgeDeploymentCapabilities, runtime: 'node', filesystem: 'ephemeral', env: 'both' }, 'Vercel Build Output API', async ({ rootDir, outDir }) => (await buildVercel({ rootDir, outDir })).outDir),
  netlify: adapter('netlify', { ...edgeDeploymentCapabilities, runtime: 'node', filesystem: 'ephemeral', env: 'both' }, 'Netlify function', async ({ rootDir, outDir }) => (await buildNetlify({ rootDir, outDir })).outDir),
  cloudRun: adapter('cloud-run', { ...nodeDeploymentCapabilities, filesystem: 'ephemeral', env: 'both' }, 'container listening on PORT')
} as const;

export type DeploymentTarget = keyof typeof deploymentAdapters;
export function getDeploymentAdapter(target: DeploymentTarget): DeploymentAdapter { return deploymentAdapters[target]; }
