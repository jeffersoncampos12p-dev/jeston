export interface DeploymentCapabilities {
  runtime: 'node' | 'edge' | 'bun';
  streaming: boolean;
  filesystem: 'persistent' | 'ephemeral' | 'none';
  cache: 'local' | 'remote' | 'platform';
  cron: boolean;
  websocket: boolean;
  maxDurationMs?: number;
  env: 'process' | 'bindings' | 'both';
}

export interface DeploymentAdapter {
  id: string;
  version: string;
  capabilities: DeploymentCapabilities;
  build(options: { rootDir: string; outDir: string }): Promise<string>;
  validate?(features: string[]): { ok: boolean; errors: string[]; warnings: string[] };
}

export const nodeDeploymentCapabilities: DeploymentCapabilities = {
  runtime: 'node', streaming: true, filesystem: 'persistent', cache: 'local', cron: true, websocket: true, env: 'process'
};

export const edgeDeploymentCapabilities: DeploymentCapabilities = {
  runtime: 'edge', streaming: true, filesystem: 'none', cache: 'platform', cron: false, websocket: false, maxDurationMs: 30_000, env: 'bindings'
};

const requirements: Record<string, (capabilities: DeploymentCapabilities) => boolean> = {
  streaming: (cap) => cap.streaming,
  filesystem: (cap) => cap.filesystem !== 'none',
  cron: (cap) => cap.cron,
  websocket: (cap) => cap.websocket,
  durableCache: (cap) => cap.cache !== 'local'
};

export function validateDeploymentCapabilities(capabilities: DeploymentCapabilities, features: string[]) {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const feature of features) {
    const check = requirements[feature];
    if (!check) { warnings.push(`Unknown deployment feature: ${feature}`); continue; }
    if (!check(capabilities)) errors.push(`Deployment target ${capabilities.runtime} does not support ${feature}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
