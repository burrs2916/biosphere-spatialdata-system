import type { ComponentDefinition, RendererLoader, PluginManifest } from "../../types/editor";
import { componentRegistry } from "../registry";

type LoadingStatus = "idle" | "loading" | "loaded" | "error";

interface CacheEntry {
  status: LoadingStatus;
  renderer: React.ComponentType<any> | null;
  error: string | null;
  promise: Promise<void> | null;
}

class RendererCacheImpl {
  private cache = new Map<string, CacheEntry>();

  get(type: string): React.ComponentType<any> | null {
    const entry = this.cache.get(type);
    return entry?.renderer ?? null;
  }

  set(type: string, renderer: React.ComponentType<any>): void {
    this.cache.set(type, {
      status: "loaded",
      renderer,
      error: null,
      promise: null,
    });
  }

  getStatus(type: string): LoadingStatus {
    return this.cache.get(type)?.status ?? "idle";
  }

  getError(type: string): string | null {
    return this.cache.get(type)?.error ?? null;
  }

  async load(type: string): Promise<React.ComponentType<any> | null> {
    const existing = this.cache.get(type);
    if (existing) {
      if (existing.status === "loaded") return existing.renderer;
      if (existing.status === "loading" && existing.promise) {
        await existing.promise;
        return this.cache.get(type)?.renderer ?? null;
      }
      if (existing.status === "error") return null;
    }

    const definition = componentRegistry.get(type);
    if (!definition) {
      this.cache.set(type, {
        status: "error",
        renderer: null,
        error: `Component type "${type}" not registered`,
        promise: null,
      });
      return null;
    }

    let resolveLoad: () => void;
    const loadPromise = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });

    this.cache.set(type, {
      status: "loading",
      renderer: null,
      error: null,
      promise: loadPromise,
    });

    try {
      const mod = await definition.renderer.loader();
      definition.renderer.cached = mod.default;
      this.cache.set(type, {
        status: "loaded",
        renderer: mod.default,
        error: null,
        promise: null,
      });
      resolveLoad!();
      return mod.default;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.cache.set(type, {
        status: "error",
        renderer: null,
        error: errorMsg,
        promise: null,
      });
      resolveLoad!();
      return null;
    }
  }

  invalidate(type: string): void {
    this.cache.delete(type);
    const definition = componentRegistry.get(type);
    if (definition) {
      definition.renderer.cached = undefined;
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const rendererCache = new RendererCacheImpl();


class PluginLoaderImpl {
  private initialized = false;
  private dbPlugins: ComponentDefinition[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadBuiltinPlugins();

    try {
      await this.syncBuiltinPluginsToDatabase();
    } catch (err) {
      console.warn("[PluginLoader] Failed to sync built-in plugins to database:", err);
    }

    try {
      await this.loadDatabasePlugins();
    } catch (err) {
      console.warn("[PluginLoader] Failed to load database plugins:", err);
    }

    this.initialized = true;
  }

  private async loadBuiltinPlugins(): Promise<void> {
    const { registerBuiltinComponents } = await import("../registry");
    registerBuiltinComponents();
    console.log("[PluginLoader] Built-in plugins loaded");
  }

  private async syncBuiltinPluginsToDatabase(): Promise<void> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const existing = await invoke<any[]>("get_all_component_plugins");
      const existingTypes = new Set(existing.map((p: any) => p.type));

      const allDefs = componentRegistry.getAll();
      let synced = 0;
      for (const def of allDefs) {
        if (!def.builtIn) continue;
        if (existingTypes.has(def.type)) continue;

        const payload = {
          pluginType: def.type,
          name: def.name,
          version: def.version || "1.0.0",
          description: def.description,
          icon: typeof def.icon === "string" ? def.icon : "widgets",
          category: def.category.startsWith("ccat_") ? def.category : `ccat_${def.category}`,
          defaultSize: JSON.stringify(def.defaultSize),
          defaultConfig: JSON.stringify(def.defaultConfig),
          capabilities: JSON.stringify(def.capabilities),
          configSchema: def.configSchema ? JSON.stringify(def.configSchema) : "[]",
          events: def.events ? JSON.stringify(def.events) : "[]",
          actions: def.actions ? JSON.stringify(def.actions) : "[]",
          dataSchema: def.dataSchema ? JSON.stringify(def.dataSchema) : undefined,
          rendererEntry: undefined,
          rendererFormat: "builtin",
          dependencies: "[]",
          permissions: "[]",
          builtIn: true,
        };

        try {
          await invoke("create_component_plugin", { payload });
          synced++;
        } catch (err) {
          console.warn(`[PluginLoader] Failed to sync built-in plugin "${def.type}":`, err);
        }
      }

      if (synced > 0) {
        console.log(`[PluginLoader] Synced ${synced} built-in plugins to database`);
      }
    } catch (err) {
      console.warn("[PluginLoader] Built-in plugin sync skipped:", err);
    }
  }

  private async loadDatabasePlugins(): Promise<void> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const plugins = await invoke<any[]>("get_enabled_component_plugins");

      for (const plugin of plugins) {
        if (plugin.builtIn) continue;

        const definition = this.dbPluginToDefinition(plugin);
        if (definition) {
          componentRegistry.register(definition);
          this.dbPlugins.push(definition);
        }
      }

      console.log(`[PluginLoader] Loaded ${this.dbPlugins.length} database plugins`);
    } catch (err) {
      console.warn("[PluginLoader] Database plugin loading skipped:", err);
    }
  }

  private dbPluginToDefinition(plugin: any): ComponentDefinition | null {
    try {
      let defaultSize = { width: 200, height: 150 };
      try {
        defaultSize = JSON.parse(plugin.defaultSize || "{}");
      } catch {}

      let defaultConfig: Record<string, unknown> = {};
      try {
        defaultConfig = JSON.parse(plugin.defaultConfig || "{}");
      } catch {}

      let capabilities = {
        resizable: true,
        rotatable: true,
        draggable: true,
        connectable: false,
        embeddable: false,
      };
      try {
        capabilities = JSON.parse(plugin.capabilities || "{}");
      } catch {}

      let configSchema = undefined;
      try {
        const parsed = JSON.parse(plugin.configSchema || "[]");
        if (Array.isArray(parsed) && parsed.length > 0) configSchema = parsed;
      } catch {}

      let events = undefined;
      try {
        const parsed = JSON.parse(plugin.events || "[]");
        if (Array.isArray(parsed) && parsed.length > 0) events = parsed;
      } catch {}

      let actions = undefined;
      try {
        const parsed = JSON.parse(plugin.actions || "[]");
        if (Array.isArray(parsed) && parsed.length > 0) actions = parsed;
      } catch {}

      let dataSchema = undefined;
      try {
        if (plugin.dataSchema) dataSchema = JSON.parse(plugin.dataSchema);
      } catch {}

      const rendererEntry = plugin.rendererEntry;
      const rendererFormat = plugin.rendererFormat;

      let loader: RendererLoader;
      if (rendererEntry) {
        loader = () => import(/* @vite-ignore */ rendererEntry);
      } else if (rendererFormat === "schema" || !rendererEntry) {
        loader = () =>
          import("../renderers/SchemaDrivenRenderer").then((m) => ({
            default: m.SchemaDrivenRenderer,
          }));
      } else {
        loader = () =>
          import("../renderers/FallbackRenderer").then((m) => ({
            default: m.FallbackRenderer,
          }));
      }

      if (configSchema && configSchema.length > 0) {
        defaultConfig.__configSchema = configSchema;
        defaultConfig.__componentName = plugin.name;
      }

      return {
        type: plugin.type,
        name: plugin.name,
        icon: plugin.icon || "widgets",
        description: plugin.description,
        category: plugin.category || "custom",
        version: plugin.version || "1.0.0",
        defaultSize,
        defaultConfig,
        capabilities,
        configSchema,
        renderer: { loader },
        events,
        actions,
        dataSchema,
        builtIn: plugin.builtIn || false,
        enabled: plugin.enabled !== false,
      };
    } catch (err) {
      console.error(`[PluginLoader] Failed to parse plugin "${plugin?.type}":`, err);
      return null;
    }
  }

  async installPlugin(manifest: PluginManifest): Promise<ComponentDefinition | null> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");

      const payload = {
        pluginType: manifest.type,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        icon: manifest.icon,
        category: manifest.category,
        defaultSize: JSON.stringify(manifest.defaultSize),
        defaultConfig: JSON.stringify(manifest.defaultConfig),
        capabilities: JSON.stringify(manifest.capabilities),
        configSchema: manifest.configSchema ? JSON.stringify(manifest.configSchema) : undefined,
        events: manifest.events ? JSON.stringify(manifest.events) : undefined,
        actions: manifest.actions ? JSON.stringify(manifest.actions) : undefined,
        dataSchema: manifest.dataSchema ? JSON.stringify(manifest.dataSchema) : undefined,
        rendererEntry: manifest.renderer.entry,
        rendererFormat: manifest.renderer.format,
        dependencies: manifest.dependencies ? JSON.stringify(manifest.dependencies) : undefined,
        permissions: manifest.permissions ? JSON.stringify(manifest.permissions) : undefined,
        author: manifest.author,
        homepage: manifest.homepage,
        thumbnail: manifest.thumbnail,
      };

      const saved = await invoke<any>("create_component_plugin", { payload });

      const definition = this.dbPluginToDefinition(saved);
      if (definition) {
        componentRegistry.register(definition);
        this.dbPlugins.push(definition);
      }

      return definition;
    } catch (err) {
      console.error("[PluginLoader] Failed to install plugin:", err);
      return null;
    }
  }

  async uninstallPlugin(pluginId: string): Promise<boolean> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_component_plugin", { id: pluginId });

      const idx = this.dbPlugins.findIndex((d) => d.type === pluginId);
      if (idx >= 0) {
        const def = this.dbPlugins[idx];
        componentRegistry.unregister(def.type);
        rendererCache.invalidate(def.type);
        this.dbPlugins.splice(idx, 1);
      }

      return true;
    } catch (err) {
      console.error("[PluginLoader] Failed to uninstall plugin:", err);
      return false;
    }
  }

  async togglePlugin(pluginId: string, enabled: boolean): Promise<boolean> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("toggle_component_plugin", { id: pluginId, enabled });

      const def = componentRegistry.get(pluginId);
      if (def) {
        def.enabled = enabled;
      }

      return true;
    } catch (err) {
      console.error("[PluginLoader] Failed to toggle plugin:", err);
      return false;
    }
  }

  getDatabasePlugins(): ComponentDefinition[] {
    return [...this.dbPlugins];
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const pluginLoader = new PluginLoaderImpl();
