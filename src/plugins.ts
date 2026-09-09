export type PluginPermission = 'routes' | 'actions' | 'database' | 'storage' | 'observability' | 'config';

export interface JestonPluginContext {
  rootDir: string;
  manifest?: unknown;
  capabilities: readonly PluginPermission[];
}

export interface JestonPlugin {
  name: string;
  version: string;
  permissions?: PluginPermission[];
  setup?(context: JestonPluginContext): void | Promise<void>;
  onBuild?(manifest: unknown, context: JestonPluginContext): unknown | Promise<unknown>;
  onRequest?(context: unknown): void | Promise<void>;
  close?(): void | Promise<void>;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, JestonPlugin>();
  register(plugin: JestonPlugin): () => boolean {
    if (!/^[a-z][a-z0-9._-]{1,62}$/.test(plugin.name)) throw new Error(`Invalid Jeston plugin name: ${plugin.name}`);
    if (this.plugins.has(plugin.name)) throw new Error(`Jeston plugin already registered: ${plugin.name}`);
    this.plugins.set(plugin.name, plugin);
    return () => this.plugins.delete(plugin.name);
  }
  list(): JestonPlugin[] { return [...this.plugins.values()].map((plugin) => ({ ...plugin, permissions: plugin.permissions ? [...plugin.permissions] : undefined })); }
  async setup(context: JestonPluginContext): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const capabilities = plugin.permissions ?? [];
      if (capabilities.some((permission) => !context.capabilities.includes(permission))) throw new Error(`Plugin ${plugin.name} requests unsupported permissions: ${capabilities.filter((permission) => !context.capabilities.includes(permission)).join(', ')}`);
      await plugin.setup?.({ ...context, capabilities });
    }
  }
  async onBuild(manifest: unknown, context: JestonPluginContext): Promise<unknown> {
    let result = manifest;
    for (const plugin of this.plugins.values()) result = await plugin.onBuild?.(result, context) ?? result;
    return result;
  }
  async close(): Promise<void> { for (const plugin of [...this.plugins.values()].reverse()) await plugin.close?.(); }
}
