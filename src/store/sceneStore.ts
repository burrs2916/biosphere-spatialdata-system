import { create } from "zustand";
import type { SceneDSL, SceneCategory } from "../types/scene";
import { createDefaultScene, createSceneFromTemplate, SCENE_TEMPLATES } from "../types/scene";
import { sceneApi } from "../services/tauri";
import { logger } from "../utils/logger";

const DEFAULT_CATEGORY_ID = "cat_default";

const DEFAULT_CATEGORY: SceneCategory = {
  id: DEFAULT_CATEGORY_ID,
  name: "默认分组",
  icon: "folder",
  color: "#757575",
  sortOrder: -1,
  description: "未指定分类的场景",
  createdAt: Math.floor(Date.now() / 1000),
  updatedAt: Math.floor(Date.now() / 1000),
};

interface SceneState {
  scenes: SceneDSL[];
  categories: SceneCategory[];
  activeSceneId: string | null;
  isLoading: boolean;
  error: string | null;

  loadScenes: () => Promise<void>;
  loadCategories: () => Promise<void>;
  setActiveScene: (id: string) => void;
  getActiveScene: () => SceneDSL | null;

  createScene: (partial?: Partial<SceneDSL>, templateId?: string) => Promise<SceneDSL>;
  updateScene: (id: string, updates: Partial<SceneDSL>) => Promise<void>;
  deleteScene: (id: string) => Promise<void>;
  duplicateScene: (id: string) => Promise<SceneDSL | null>;

  createCategory: (partial?: Partial<SceneCategory>) => Promise<SceneCategory>;
  updateCategory: (id: string, updates: Partial<SceneCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  saveScene: (scene: SceneDSL) => Promise<void>;
  publishScene: (id: string) => Promise<void>;
  unpublishScene: (id: string) => Promise<void>;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  scenes: [],
  categories: [],
  activeSceneId: null,
  isLoading: false,
  error: null,

  loadScenes: async () => {
    set({ isLoading: true, error: null });
    try {
      const scenes = await sceneApi.list();
      const { invoke } = await import("@tauri-apps/api/core");
      const migratedScenes = await Promise.all(
        scenes.map(async (scene) => {
          if (scene.thumbnail && !scene.thumbnail.startsWith("data:") && !scene.thumbnail.startsWith("linear-gradient(") && (scene.thumbnail.startsWith("/") || scene.thumbnail.startsWith("file://"))) {
            try {
              const dataUrl = await invoke<string>("read_file_as_data_url", { filePath: scene.thumbnail });
              logger.info("SceneStore", "Migrated local path to data URL", { sceneId: scene.id, oldPath: scene.thumbnail });
              return { ...scene, thumbnail: dataUrl };
            } catch (err) {
              logger.warn("SceneStore", "Failed to migrate thumbnail, keeping original", { sceneId: scene.id, error: String(err) });
            }
          }
          return scene;
        })
      );
      logger.info("SceneStore", "Scenes loaded", { count: migratedScenes.length });
      set({ scenes: migratedScenes, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("SceneStore", "Failed to load scenes", { error: msg });
      set({ error: msg, isLoading: false });
    }
  },

  loadCategories: async () => {
    try {
      let categories = await sceneApi.listCategories();

      const hasDefault = categories.some((c) => c.id === DEFAULT_CATEGORY_ID);
      if (!hasDefault) {
        try {
          await sceneApi.saveCategory(DEFAULT_CATEGORY);
          categories = [DEFAULT_CATEGORY, ...categories];
        } catch {
          categories = [DEFAULT_CATEGORY, ...categories];
        }
      }

      set({ categories });
    } catch (err) {
      set({ categories: [DEFAULT_CATEGORY], error: err instanceof Error ? err.message : String(err) });
    }
  },

  setActiveScene: (id: string) => {
    set({ activeSceneId: id });
  },

  getActiveScene: () => {
    const { scenes, activeSceneId } = get();
    if (!activeSceneId) return null;
    return scenes.find((s) => s.id === activeSceneId) ?? null;
  },

  createScene: async (partial?: Partial<SceneDSL>, templateId?: string) => {
    let scene: SceneDSL;
    if (templateId) {
      const template = SCENE_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        scene = createSceneFromTemplate(template, partial);
      } else {
        scene = createDefaultScene(partial);
      }
    } else {
      scene = createDefaultScene(partial);
    }

    if (!scene.categoryId) {
      scene.categoryId = DEFAULT_CATEGORY_ID;
    }

    try {
      await sceneApi.create(scene);
      logger.info("SceneStore", "Scene created via API", { sceneId: scene.id, name: scene.name, thumbnail: scene.thumbnail });
      set((state) => ({
        scenes: [scene, ...state.scenes],
        activeSceneId: scene.id,
      }));
      return scene;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  updateScene: async (id: string, updates: Partial<SceneDSL>) => {
    const { scenes } = get();
    const index = scenes.findIndex((s) => s.id === id);
    if (index === -1) return;

    const originalScene = scenes[index];
    const updatedScene = {
      ...originalScene,
      ...updates,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === id ? updatedScene : s)),
    }));

    try {
      await sceneApi.update(updatedScene);
      logger.info("SceneStore", "Scene updated via API", { sceneId: id, thumbnail: updatedScene.thumbnail });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("SceneStore", "Failed to update scene via API", { sceneId: id, error: msg });
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === id ? originalScene : s)),
        error: msg,
      }));
      const { useEditorStore } = await import("./editorStore");
      const editorState = useEditorStore.getState();
      if (originalScene.views && originalScene.views.length > 0) {
        const activeVId = originalScene.activeViewId || originalScene.views[0].id;
        editorState.loadSceneWithViews(originalScene.views, originalScene.globalComponents || [], activeVId);
      } else if (originalScene.editorComponents && originalScene.editorLayers) {
        const views = [{ id: "default", name: "默认视图", components: originalScene.editorComponents, layers: originalScene.editorLayers }];
        editorState.loadSceneWithViews(views, [], "default");
      }
      if (originalScene.canvasConfig) {
        editorState.setCanvasConfig(originalScene.canvasConfig);
      }
    }
  },

  deleteScene: async (id: string) => {
    const { scenes, activeSceneId } = get();
    const sceneToDelete = scenes.find((s) => s.id === id);
    if (!sceneToDelete) return;

    set((state) => ({
      scenes: state.scenes.filter((s) => s.id !== id),
      activeSceneId: activeSceneId === id ? null : state.activeSceneId,
    }));

    try {
      await sceneApi.delete(id);
    } catch (err) {
      set((state) => ({
        scenes: [sceneToDelete, ...state.scenes].sort((a, b) => b.updatedAt - a.updatedAt),
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  },

  duplicateScene: async (id: string) => {
    const { scenes } = get();
    const source = scenes.find((s) => s.id === id);
    if (!source) return null;

    const now = Date.now();
    const duplicated: SceneDSL = {
      ...source,
      id: `scene_${now}_${Math.random().toString(36).substring(2, 8)}`,
      name: `${source.name} (副本)`,
      status: "draft",
      createdAt: Math.floor(now / 1000),
      updatedAt: Math.floor(now / 1000),
    };

    try {
      await sceneApi.create(duplicated);
      set((state) => ({
        scenes: [duplicated, ...state.scenes],
      }));
      return duplicated;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  createCategory: async (partial?: Partial<SceneCategory>) => {
    const now = Math.floor(Date.now() / 1000);
    const category: SceneCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name: "新分组",
      icon: "folder",
      sortOrder: get().categories.length,
      createdAt: now,
      updatedAt: now,
      ...partial,
    };

    try {
      await sceneApi.saveCategory(category);
      set((state) => ({
        categories: [...state.categories, category],
      }));
      return category;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  updateCategory: async (id: string, updates: Partial<SceneCategory>) => {
    const { categories } = get();
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) return;

    const updatedCategory = {
      ...categories[index],
      ...updates,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? updatedCategory : c)),
    }));

    try {
      await sceneApi.saveCategory(updatedCategory);
    } catch (err) {
      set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? categories[index] : c)),
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  },

  deleteCategory: async (id: string) => {
    if (id === DEFAULT_CATEGORY_ID) return;

    const { categories, scenes } = get();
    const categoryToDelete = categories.find((c) => c.id === id);
    if (!categoryToDelete) return;

    const affectedScenes = scenes.filter((s) => s.categoryId === id);
    const updatedScenes = affectedScenes.map((s) => ({
      ...s,
      categoryId: DEFAULT_CATEGORY_ID,
    }));

    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      scenes: state.scenes.map((s) => {
        const updated = updatedScenes.find((u) => u.id === s.id);
        return updated || s;
      }),
    }));

    try {
      await sceneApi.deleteCategory(id);
      for (const scene of updatedScenes) {
        await sceneApi.update(scene);
      }
    } catch (err) {
      set((state) => ({
        categories: [categoryToDelete, ...state.categories].sort((a, b) => a.sortOrder - b.sortOrder),
        scenes: state.scenes.map((s) => {
          const original = scenes.find((o) => o.id === s.id);
          return original || s;
        }),
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  },

  saveScene: async (scene: SceneDSL) => {
    try {
      await sceneApi.update(scene);
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === scene.id ? scene : s)),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  publishScene: async (id: string) => {
    const { scenes } = get();
    const scene = scenes.find((s) => s.id === id);
    if (!scene) return;

    const updatedScene: SceneDSL = {
      ...scene,
      status: "published",
      publishedAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };

    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === id ? updatedScene : s)),
    }));

    try {
      await sceneApi.update(updatedScene);
      logger.info("SceneStore", "Scene published", { sceneId: id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("SceneStore", "Failed to publish scene", { sceneId: id, error: msg });
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === id ? scene : s)),
        error: msg,
      }));
    }
  },

  unpublishScene: async (id: string) => {
    const { scenes } = get();
    const scene = scenes.find((s) => s.id === id);
    if (!scene) return;

    const updatedScene: SceneDSL = {
      ...scene,
      status: "draft",
      updatedAt: Math.floor(Date.now() / 1000),
    };

    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === id ? updatedScene : s)),
    }));

    try {
      await sceneApi.update(updatedScene);
      logger.info("SceneStore", "Scene unpublished", { sceneId: id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("SceneStore", "Failed to unpublish scene", { sceneId: id, error: msg });
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === id ? scene : s)),
        error: msg,
      }));
    }
  },
}));
