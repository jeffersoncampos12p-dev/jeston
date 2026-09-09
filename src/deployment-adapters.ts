import { edgeDeploymentCapabilities, nodeDeploymentCapabilities, validateDeploymentCapabilities, type DeploymentAdapter } from './adapters.js';

function adapter(id: string, capabilities: DeploymentAdapter['capabilities'], instructions: string): DeploymentAdapter {
  return { id, version: '1.0.0', capabilities, async build({ outDir }) { return `${outDir} (${instructions})`; }, validate(features) { return validateDeploymentCapabilities(capabilities, features); } };
}

export const deploymentAdapters = {
  node: adapter('node', nodeDeploymentCapabilities, 'node server.mjs'),
  docker: adapter('docker', { ...nodeDeploymentCapabilities, filesystem: 'ephemeral' }, 'Dockerfile + node server.mjs'),
  cloudflare: adapter('cloudflare', edgeDeploymentCapabilities, 'Fetch handler'),
  vercel: adapter('vercel', { ...edgeDeploymentCapabilities, runtime: 'node', filesystem: 'ephemeral', env: 'both' }, 'serverless function'),
  netlify: adapter('netlify', { ...edgeDeploymentCapabilities, runtime: 'node', filesystem: 'ephemeral', env: 'both' }, 'Netlify function'),
  cloudRun: adapter('cloud-run', { ...nodeDeploymentCapabilities, filesystem: 'ephemeral', env: 'both' }, 'container listening on PORT')
} as const;

export type DeploymentTarget = keyof typeof deploymentAdapters;
export function getDeploymentAdapter(target: DeploymentTarget): DeploymentAdapter { return deploymentAdapters[target]; }
