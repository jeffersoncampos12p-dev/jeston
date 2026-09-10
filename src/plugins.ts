export type PluginPermission = 'routes' | 'actions' | 'database' | 'storage' | 'observability' | 'config';

export interface RyvaxPluginContext {
  rootDir: string;
  manifest?: unknown;
  capabilities: readonly PluginPermission[];
}

export interface RyvaxPlugin {
  name: string;
  version: string;
  permissions?: PluginPermission[];
  setup?(context: RyvaxPluginContext): void | Promise<void>;
  onBuild?(manifest: unknown, context: RyvaxPluginContext): unknown | Promise<unknown>;
  onRequest?(context: unknown): void | Promise<void>;
  close?(): void | Promise<void>;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, RyvaxPlugin>();
  register(plugin: RyvaxPlugin): () => boolean {
    if (!/^[a-z][a-z0-9._-]{1,62}$/.test(plugin.name)) throw new Error(`Invalid Ryvax plugin name: ${plugin.name}`);
    if (this.plugins.has(plugin.name)) throw new Error(`Ryvax plugin already registered: ${plugin.name}`);
    this.plugins.set(plugin.name, plugin);
    return () => this.plugins.delete(plugin.name);
  }
  list(): RyvaxPlugin[] { return [...this.plugins.values()].map((plugin) => ({ ...plugin, permissions: plugin.permissions ? [...plugin.permissions] : undefined })); }
  async setup(context: RyvaxPluginContext): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const capabilities = plugin.permissions ?? [];
      if (capabilities.some((permission) => !context.capabilities.includes(permission))) throw new Error(`Plugin ${plugin.name} requests unsupported permissions: ${capabilities.filter((permission) => !context.capabilities.includes(permission)).join(', ')}`);
      await plugin.setup?.({ ...context, capabilities });
    }
  }
  async onBuild(manifest: unknown, context: RyvaxPluginContext): Promise<unknown> {
    let result = manifest;
    for (const plugin of this.plugins.values()) result = await plugin.onBuild?.(result, context) ?? result;
    return result;
  }
  async close(): Promise<void> { for (const plugin of [...this.plugins.values()].reverse()) await plugin.close?.(); }
}
