import { create } from "zustand";
import type { SceneDSL, SceneCategory } from "../types/scene";
import { createDefaultScene, createSceneFromTemplate, SCENE_TEMPLATES } from "../types/scene";
import { sceneApi } from "../services/tauri";
import { logger } from "../utils/logger";
import {
  useDevicePlacementStore,
  setDevicePlacementChangeListener,
} from "./devicePlacementStore";

const DEFAULT_CATEGORY_ID = "cat_default";
const DEFAULT_SCENE_ID = "scene_default";
const DEFAULT_SCENE_NAME = "设备状态监控大屏";

/** === 增强：placement ↔ scene 双向同步状态 === */
let placementSyncInitialized = false;

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
      // === 增强：启动 placement ↔ scene 双向同步（只启动一次） ===
      initDevicePlacementSync();
      // === 增强：loadScenes 后若已有 active scene，把其 views 灌入 placementStore（不破坏旧流程） ===
      const activeId = get().activeSceneId;
      if (activeId) {
        const active = migratedScenes.find((s) => s.id === activeId);
        if (active?.views) {
          const ps = useDevicePlacementStore.getState();
          for (const v of active.views) {
            ps.hydrateView(v.id, v.devicePlacements ?? []);
          }
        }
      }

      // === 设备状态监控大屏（默认场景）初始化 ===
      // 单例保证：按 ID 判定，不依赖 UI 挂载（解决侧边栏折叠时不创建的问题）。
      // - 不存在 → 用 device-status 模板创建（自带组件骨架）
      // - 已存在但名为「默认场景」或缺少视图 → 原地改名 + 缺视图则补齐骨架（不删记录）
      const dsTemplate = SCENE_TEMPLATES.find((t) => t.id === "device-status");
      if (dsTemplate) {
        const prevActive = get().activeSceneId;
        const existing = get().scenes.find((s) => s.id === DEFAULT_SCENE_ID);
        if (!existing) {
          await get().createScene(
            { id: DEFAULT_SCENE_ID, name: DEFAULT_SCENE_NAME, categoryId: DEFAULT_CATEGORY_ID },
            "device-status",
          );
        } else {
          // 判定是否需要升级/补齐（仅针对系统专属默认场景 scene_default，用户自建场景 ID 不同不会命中）：
          //  - 名为「默认场景」→ 原地改名
          //  - 缺视图 → 补齐骨架
          //  - 含旧版设备状态大屏标记（统计卡 / 传感器面板 / 滚动表格）→ 模板已重设计为设备拓扑树，整体同步
          const views = existing.views ?? [];
          const hasOldMarkers = views.some((v) =>
            (v.components ?? []).some(
              (c) =>
                c.type === "industrial-stats-card" ||
                c.type === "industrial-sensor-monitor" ||
                c.type === "industrial-scrolling-table" ||
                // 旧版顶部标题栏：最终模板已移除标题，残留者整体同步为纯设备树
                c.type === "top-glow-title-frame",
            ),
          );
          const needsUpgrade = existing.name === "默认场景" || views.length === 0 || hasOldMarkers;
          if (needsUpgrade) {
            const full = createSceneFromTemplate(dsTemplate, {
              id: DEFAULT_SCENE_ID,
              name: DEFAULT_SCENE_NAME,
              categoryId: DEFAULT_CATEGORY_ID,
            });
            await get().updateScene(DEFAULT_SCENE_ID, {
              name: DEFAULT_SCENE_NAME,
              views: full.views,
              activeViewId: full.activeViewId ?? "view_default",
              canvasConfig: full.canvasConfig ?? existing.canvasConfig,
            });
          }
        }
        // 恢复加载前的激活场景（createScene 会顺带激活新建的大屏）
        if (prevActive) get().setActiveScene(prevActive);
      }
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
    // === 增强：激活场景后把该场景所有 view 的 devicePlacements 灌入 placementStore ===
    // （增强不破坏：旧逻辑只更新 activeSceneId，不感知 placement）
    const scene = get().scenes.find((s) => s.id === id);
    if (scene?.views) {
      const placementStore = useDevicePlacementStore.getState();
      for (const v of scene.views) {
        placementStore.hydrateView(v.id, v.devicePlacements ?? []);
      }
    }
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
      const currentActiveSceneId = get().activeSceneId;
      if (currentActiveSceneId === id) {
        const editorState = useEditorStore.getState();
        if (originalScene.views && originalScene.views.length > 0) {
          const activeVId = originalScene.activeViewId || originalScene.views[0].id;
          editorState.loadSceneWithViews(originalScene.views, originalScene.globalComponents || [], activeVId);
        } else if (originalScene.editorComponents && originalScene.editorLayers) {
          const canvasConfig = originalScene.canvasConfig ? { ...originalScene.canvasConfig } : undefined;
          const views = [{ id: "default", name: "默认视图", components: originalScene.editorComponents, layers: originalScene.editorLayers, canvasConfig }];
          editorState.loadSceneWithViews(views, [], "default");
        }
      }
      throw err;
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
      views: source.views ? JSON.parse(JSON.stringify(source.views)) : undefined,
      globalComponents: source.globalComponents ? JSON.parse(JSON.stringify(source.globalComponents)) : undefined,
      editorComponents: source.editorComponents ? JSON.parse(JSON.stringify(source.editorComponents)) : undefined,
      editorLayers: source.editorLayers ? JSON.parse(JSON.stringify(source.editorLayers)) : undefined,
      canvasConfig: source.canvasConfig ? JSON.parse(JSON.stringify(source.canvasConfig)) : undefined,
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
      // === 增强：保存前把当前 placementStore 的摆位回写到 SceneView.devicePlacements ===
      // （保证落盘 JSON 包含 devicePlacements；不破坏：原 scene.views 为空时也不报错）
      const ps = useDevicePlacementStore.getState();
      const synced: SceneDSL = {
        ...scene,
        views: scene.views?.map((v) => ({
          ...v,
          devicePlacements: ps.getPlacements(v.id) ?? [],
        })),
        updatedAt: Math.floor(Date.now() / 1000),
      };
      await sceneApi.update(synced);
      set((state) => ({
        scenes: state.scenes.map((s) => (s.id === synced.id ? synced : s)),
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

/**
 * === 增强：placement ↔ scene 双向同步（回写方向） ===
 *
 * 启动一次：placementStore 变更时把最新摆位写回 active scene 的
 * SceneView.devicePlacements（仅内存；saveScene 时同步落盘）。
 *
 * 不破坏：原 store 行为、SceneView 结构都不变，仅多了一层同步钩子。
 */
function initDevicePlacementSync(): void {
  if (placementSyncInitialized) return;
  placementSyncInitialized = true;

  setDevicePlacementChangeListener((viewId, placements) => {
    const { scenes, activeSceneId } = useSceneStore.getState();
    if (!activeSceneId) return;
    const scene = scenes.find((s) => s.id === activeSceneId);
    if (!scene?.views) return;
    // 只在 active scene 包含该 view 时回写（避免别的 scene 误改）
    const idx = scene.views.findIndex((v) => v.id === viewId);
    if (idx < 0) return;
    // 浅比较：内容相同则不触发 set（避免无谓渲染）
    const same = JSON.stringify(scene.views[idx].devicePlacements ?? []) === JSON.stringify(placements);
    if (same) return;
    const newViews = scene.views.slice();
    newViews[idx] = { ...newViews[idx], devicePlacements: placements };
    useSceneStore.setState({
      scenes: scenes.map((s) => (s.id === activeSceneId ? { ...s, views: newViews } : s)),
    });
  });
}

// 开发模式暴露到 window
if (typeof window !== "undefined") {
  (window as any).__sceneStore = useSceneStore;
}
