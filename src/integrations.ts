import type { AppConfig, Runtime } from './types.js';

export type IntegrationCategory =
  | 'database'
  | 'cache'
  | 'queue'
  | 'storage'
  | 'observability'
  | 'auth'
  | 'frontend'
  | 'ai'
  | 'deployment'
  | 'testing';

export interface IntegrationContext {
  config: AppConfig;
  runtime: Runtime;
  env: Record<string, string | undefined>;
  signal: AbortSignal;
  logger?: { info(message: string, fields?: Record<string, unknown>): void; warn(message: string, fields?: Record<string, unknown>): void };
}

export interface RyvaxIntegration<TOptions = unknown> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: IntegrationCategory;
  readonly description: string;
  readonly homepage?: string;
  readonly peerDependencies?: Record<string, string>;
  readonly runtimes?: Runtime[];
  setup?(context: IntegrationContext, options?: TOptions): void | Promise<void>;
  teardown?(context: IntegrationContext): void | Promise<void>;
}

export interface IntegrationRegistration<TOptions = unknown> {
  integration: RyvaxIntegration<TOptions>;
  options?: TOptions;
}

export interface IntegrationRegistry {
  register<TOptions>(integration: RyvaxIntegration<TOptions>, options?: TOptions): () => boolean;
  get(id: string): RyvaxIntegration | undefined;
  list(category?: IntegrationCategory): RyvaxIntegration[];
  setup(context: IntegrationContext): Promise<void>;
  teardown(context: IntegrationContext): Promise<void>;
}

export function createIntegrationRegistry(registrations: IntegrationRegistration[] = []): IntegrationRegistry {
  const entries = new Map<string, IntegrationRegistration>();
  const register = <TOptions>(integration: RyvaxIntegration<TOptions>, options?: TOptions): (() => boolean) => {
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(integration.id)) throw new Error(`Ryvax integration: invalid id "${integration.id}"`);
    if (!/^\d+\.\d+\.\d+$/.test(integration.version)) throw new Error(`Ryvax integration: invalid version for "${integration.id}"`);
    if (entries.has(integration.id)) throw new Error(`Ryvax integration: duplicate id "${integration.id}"`);
    entries.set(integration.id, { integration, options });
    return () => entries.delete(integration.id);
  };
  for (const registration of registrations) register(registration.integration, registration.options);

  return {
    register,
    get(id) { return entries.get(id)?.integration; },
    list(category) {
      return [...entries.values()].map(({ integration }) => integration).filter((integration) => !category || integration.category === category);
    },
    async setup(context) {
      for (const { integration, options } of entries.values()) {
        if (integration.runtimes && !integration.runtimes.includes(context.runtime)) continue;
        await integration.setup?.(context, options);
      }
    },
    async teardown(context) {
      for (const { integration } of [...entries.values()].reverse()) await integration.teardown?.(context);
    }
  };
}

export interface IntegrationCatalogEntry {
  id: string;
  name: string;
  category: IntegrationCategory;
  status: 'official' | 'community' | 'planned' | 'experimental';
  contract: string;
  homepage?: string;
}

/** Provider-neutral roadmap catalog. Entries are discoverability metadata, not bundled SDKs. */
export const integrationCatalog: readonly IntegrationCatalogEntry[] = [
  ...['postgresql', 'mysql', 'sqlite', 'mariadb', 'cockroachdb', 'planetscale', 'neon', 'turso', 'supabase', 'prisma', 'drizzle'].map((id) => ({ id: `db-${id}`, name: id, category: 'database' as const, status: 'planned' as const, contract: 'DatabaseAdapter' })),
  ...['redis', 'valkey', 'upstash', 'memcached', 'dragonfly'].map((id) => ({ id: `cache-${id}`, name: id, category: 'cache' as const, status: 'planned' as const, contract: 'CacheAdapter' })),
  ...['bullmq', 'rabbitmq', 'kafka', 'sqs', 'pubsub', 'nats', 'temporal', 'inngest'].map((id) => ({ id: `jobs-${id}`, name: id, category: 'queue' as const, status: 'planned' as const, contract: 'JobQueue' })),
  ...['s3', 'r2', 'gcs', 'azure-blob', 'minio', 'uploadthing'].map((id) => ({ id: `storage-${id}`, name: id, category: 'storage' as const, status: 'planned' as const, contract: 'StorageAdapter' })),
  ...['opentelemetry', 'prometheus', 'grafana', 'datadog', 'sentry', 'axiom', 'honeycomb'].map((id) => ({ id: `observability-${id}`, name: id, category: 'observability' as const, status: 'planned' as const, contract: 'MetricsAdapter' })),
  ...['auth0', 'clerk', 'workos', 'okta', 'keycloak', 'zitadel', 'descope'].map((id) => ({ id: `auth-${id}`, name: id, category: 'auth' as const, status: 'planned' as const, contract: 'Session and authorization APIs' })),
  ...['tailwind', 'shadcn', 'radix', 'mui', 'chakra', 'mantine', 'storybook', 'vite', 'playwright', 'vitest'].map((id) => ({ id: `frontend-${id}`, name: id, category: 'frontend' as const, status: 'planned' as const, contract: 'Client and build integration' })),
  ...['openai', 'anthropic', 'google-ai', 'mistral', 'ollama', 'vercel-ai', 'langchain', 'llamaindex', 'vector-db'].map((id) => ({ id: `ai-${id}`, name: id, category: 'ai' as const, status: 'experimental' as const, contract: 'Streaming, tools, jobs, and tracing' })),
  ...['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'fly', 'railway', 'render', 'netlify', 'cloudflare'].map((id) => ({ id: `deploy-${id}`, name: id, category: 'deployment' as const, status: 'planned' as const, contract: 'Portable production deployment' }))
] as const;

export function findIntegrations(query: string, category?: IntegrationCategory): IntegrationCatalogEntry[] {
  const normalized = query.trim().toLowerCase();
  return integrationCatalog.filter((entry) => (!category || entry.category === category) && (!normalized || `${entry.id} ${entry.name} ${entry.contract}`.toLowerCase().includes(normalized)));
}
