import { create } from "zustand";
import type { ComponentCategory, ComponentCategoryNode, ComponentPluginItem } from "../types/component";
import { DEFAULT_COMPONENT_CATEGORY } from "../types/component";
import { buildCategoryTree, countAllPlugins } from "../utils/componentTree";
import { componentRegistry } from "../editor/registry";
import { logger } from "../utils/logger";

interface ComponentStore {
  categories: ComponentCategory[];
  categoryTree: ComponentCategoryNode[];
  plugins: ComponentPluginItem[];
  enabledPlugins: ComponentPluginItem[];
  isLoading: boolean;
  error: string | null;
  activeCategoryId: string | null;

  loadCategories: () => Promise<void>;
  loadPlugins: () => Promise<void>;
  refresh: () => Promise<void>;

  createCategory: (partial?: Partial<ComponentCategory>) => Promise<ComponentCategory | null>;
  updateCategory: (id: string, updates: Partial<ComponentCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  togglePlugin: (id: string, enabled: boolean) => Promise<void>;
  movePluginToCategory: (pluginId: string, categoryId: string) => Promise<void>;
  installPlugin: (manifest: any) => Promise<void>;
  uninstallPlugin: (id: string) => Promise<void>;

  setActiveCategoryId: (id: string | null) => void;
}

function dbPluginToItem(p: any): ComponentPluginItem {
  return {
    id: p.id,
    type: p.pluginType ?? p.type,
    name: p.name,
    version: p.version,
    description: p.description,
    icon: p.icon,
    category: p.category,
    builtIn: p.builtIn,
    enabled: p.enabled,
    author: p.author,
  };
}

function dbCategoryToModel(c: any): ComponentCategory {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    sortOrder: c.sortOrder ?? c.sort_order ?? 0,
    parentId: c.parentId ?? c.parent_id ?? undefined,
    description: c.description,
    createdAt: c.createdAt ?? c.created_at ?? 0,
    updatedAt: c.updatedAt ?? c.updated_at ?? 0,
  };
}

export const useComponentStore = create<ComponentStore>((set, get) => ({
  categories: [],
  categoryTree: [],
  plugins: [],
  enabledPlugins: [],
  isLoading: false,
  error: null,
  activeCategoryId: null,

  loadCategories: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const raw = await invoke<any[]>("get_component_categories");
      const categories = raw.map(dbCategoryToModel);

      const hasCustom = categories.some((c) => c.id === "ccat_custom");
      if (!hasCustom) {
        categories.push(DEFAULT_COMPONENT_CATEGORY);
      }

      const { plugins } = get();
      const categoryTree = buildCategoryTree(categories, plugins);

      set({ categories, categoryTree });
    } catch (err) {
      logger.warn("ComponentStore", "Failed to load categories from DB", { error: String(err) });
      const { plugins } = get();
      const categories: ComponentCategory[] = [DEFAULT_COMPONENT_CATEGORY];
      const categoryTree = buildCategoryTree(categories, plugins);
      set({ categories, categoryTree });
    }
  },

  loadPlugins: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const [allRaw, enabledRaw] = await Promise.all([
        invoke<any[]>("get_all_component_plugins"),
        invoke<any[]>("get_enabled_component_plugins"),
      ]);

      const plugins = allRaw.map(dbPluginToItem);
      const enabledPlugins = enabledRaw.map(dbPluginToItem);

      const { categories } = get();
      const categoryTree = buildCategoryTree(categories, plugins);

      set({ plugins, enabledPlugins, categoryTree });
    } catch (err) {
      logger.warn("ComponentStore", "Failed to load plugins from DB, falling back to registry", { error: String(err) });
      const allDefs = componentRegistry.getAll();
      const plugins: ComponentPluginItem[] = allDefs.map((d) => ({
        id: d.type,
        type: d.type,
        name: d.name,
        version: d.version || "1.0.0",
        description: d.description,
        icon: typeof d.icon === "string" ? d.icon : undefined,
        category: d.category,
        builtIn: d.builtIn ?? false,
        enabled: d.enabled !== false,
      }));
      const enabledPlugins = plugins.filter((p) => p.enabled);
      const { categories } = get();
      const categoryTree = buildCategoryTree(categories, plugins);
      set({ plugins, enabledPlugins, categoryTree });
    }
  },

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      await get().loadCategories();
      await get().loadPlugins();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  createCategory: async (partial?: Partial<ComponentCategory>) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const id = partial?.id ?? `ccat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const payload = {
        id,
        name: partial?.name ?? "新分组",
        icon: partial?.icon,
        color: partial?.color ?? "#90CAF9",
        sortOrder: partial?.sortOrder ?? get().categories.length,
        description: partial?.description,
      };
      await invoke("create_component_category", { payload });

      await get().loadCategories();
      const created = get().categories.find((c) => c.id === id);
      return created ?? null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  updateCategory: async (id: string, updates: Partial<ComponentCategory>) => {
    const { categories } = get();
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) return;

    const prev = categories[index];
    set({
      categories: categories.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: Math.floor(Date.now() / 1000) } : c
      ),
    });

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("update_component_category", {
        payload: {
          id,
          name: updates.name,
          icon: updates.icon,
          color: updates.color,
          sortOrder: updates.sortOrder,
          parentId: updates.parentId,
          description: updates.description,
        },
      });
      await get().loadCategories();
    } catch (err) {
      set({
        categories: categories.map((c) => (c.id === id ? prev : c)),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  deleteCategory: async (id: string) => {
    const builtInPrefixes = ["ccat_basic", "ccat_chart", "ccat_map", "ccat_media", "ccat_decoration"];
    if (builtInPrefixes.some((prefix) => id.startsWith(prefix))) return;

    const { categories, categoryTree } = get();

    const findNode = (nodes: ComponentCategoryNode[]): ComponentCategoryNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(categoryTree);
    if (node && countAllPlugins(node) > 0) return;

    const prev = categories.find((c) => c.id === id);
    set({ categories: categories.filter((c) => c.id !== id) });

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_component_category", { id });
      await get().loadCategories();
    } catch (err) {
      if (prev) {
        set({
          categories: [...get().categories, prev].sort((a, b) => a.sortOrder - b.sortOrder),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },

  togglePlugin: async (id: string, enabled: boolean) => {
    const { plugins } = get();
    set({
      plugins: plugins.map((p) => (p.id === id ? { ...p, enabled } : p)),
      enabledPlugins: plugins.filter((p) => (p.id === id ? enabled : p.enabled)),
    });

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("toggle_component_plugin", { id, enabled });
      const def = componentRegistry.get(
        plugins.find((p) => p.id === id)?.type ?? ""
      );
      if (def) def.enabled = enabled;
      await get().loadPlugins();
    } catch (err) {
      set({
        plugins: plugins,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  movePluginToCategory: async (pluginId: string, categoryId: string) => {
    const { plugins } = get();
    set({
      plugins: plugins.map((p) =>
        p.id === pluginId ? { ...p, category: categoryId } : p
      ),
    });

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("move_plugin_to_category", { pluginId, category: categoryId });
      await get().refresh();
    } catch (err) {
      set({ plugins, error: err instanceof Error ? err.message : String(err) });
    }
  },

  installPlugin: async (manifest: any) => {
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
        rendererEntry: manifest.renderer?.entry,
        rendererFormat: manifest.renderer?.format,
        dependencies: manifest.dependencies ? JSON.stringify(manifest.dependencies) : undefined,
        permissions: manifest.permissions ? JSON.stringify(manifest.permissions) : undefined,
        author: manifest.author,
        homepage: manifest.homepage,
        thumbnail: manifest.thumbnail,
      };
      await invoke("create_component_plugin", { payload });
      await get().refresh();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  uninstallPlugin: async (id: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_component_plugin", { id });

      const { plugins } = get();
      const plugin = plugins.find((p) => p.id === id);
      if (plugin) {
        componentRegistry.unregister(plugin.type);
      }

      await get().refresh();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  setActiveCategoryId: (id: string | null) => {
    set({ activeCategoryId: id });
  },
}));
