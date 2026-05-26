import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import logger from "../utils/logger";
import type {
  SceneComponent,
  LayerNode,
  ViewportState,
  SelectionState,
  HistoryEntry,
  Point,
  Transform,
  EventBinding,
  CanvasBackground,
} from "../types/editor";
import {
  createDefaultSceneComponent,
  createDefaultLayer,
  getLayerDescendants,
} from "../types/editor";
import { componentRegistry } from "../editor/registry";

export type EditorTool = "select" | "pan" | "zoom-in" | "zoom-out";

export type AdaptationType = "scale" | "full-x" | "full-y" | "full-screen" | "none";
export type CanvasOrientation = "landscape" | "portrait";

export interface CanvasGridConfig {
  visible: boolean;
  size: number;
  snapToGrid: boolean;
  dragStep: number;
  resizeStep: number;
}

export interface CanvasRulerConfig {
  visible: boolean;
}

export interface CanvasGuideConfig {
  visible: boolean;
}

export interface CanvasConfig {
  width: number;
  height: number;
  orientation: CanvasOrientation;
  adaptationType: AdaptationType;
  lockAspectRatio: boolean;
  background: CanvasBackground;
  grid: CanvasGridConfig;
  ruler: CanvasRulerConfig;
  guide: CanvasGuideConfig;
  viewport: {
    minScale: number;
    maxScale: number;
  };
}

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  width: 1920,
  height: 1080,
  orientation: "landscape",
  adaptationType: "scale",
  lockAspectRatio: false,
  background: {
    type: "solid",
    color: "#ffffff",
    gradient: {
      direction: "to-bottom",
      colors: ["#1a1a2e", "#16213e"],
    },
    imageUrl: "",
    imageFit: "cover",
    videoUrl: "",
    videoAutoplay: true,
    videoMuted: true,
    videoLoop: true,
  },
  grid: {
    visible: true,
    size: 20,
    snapToGrid: false,
    dragStep: 1,
    resizeStep: 1,
  },
  ruler: {
    visible: true,
  },
  guide: {
    visible: true,
  },
  viewport: {
    minScale: 0.1,
    maxScale: 5,
  },
};

export interface EditorState {
  components: SceneComponent[];
  layers: LayerNode[];
  viewport: ViewportState;
  selection: SelectionState;
  activeTool: EditorTool;
  activeLayerId: string | null;
  draggedComponentType: string | null;
  canvasConfig: CanvasConfig;
  history: HistoryEntry[];
  historyIndex: number;
  maxHistory: number;
  clipboard: SceneComponent[];
  isDirty: boolean;
  eventBindings: EventBinding[];
  previewMode: boolean;
  views: import("../types/scene").SceneView[];
  activeViewId: string;
  globalComponents: SceneComponent[];
}

export interface EditorActions {
  addComponent: (type: string, layerId?: string, position?: Partial<Point>) => SceneComponent | null;
  removeComponent: (id: string) => void;
  updateComponent: (id: string, updates: Partial<SceneComponent>) => void;
  updateComponentTransform: (id: string, transform: Partial<Transform>) => void;
  updateComponentConfig: (id: string, config: Record<string, unknown>) => void;
  moveComponentToLayer: (id: string, layerId: string) => void;
  reorderComponent: (id: string, zIndex: number) => void;
  duplicateComponent: (id: string) => SceneComponent | null;
  getComponentsByLayer: (layerId: string) => SceneComponent[];
  getComponent: (id: string) => SceneComponent | undefined;

  addLayer: (name?: string, parentId?: string | null) => LayerNode;
  addLayerGroup: (name?: string, parentId?: string | null) => LayerNode;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<LayerNode>) => void;
  moveLayerToParent: (id: string, parentId: string | null, order?: number) => void;
  reorderLayer: (id: string, order: number) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  toggleLayerExpanded: (id: string) => void;
  getLayer: (id: string) => LayerNode | undefined;
  getRootLayers: () => LayerNode[];
  getLayerTree: () => LayerNode[];

  addEventBinding: (binding: EventBinding) => void;
  removeEventBinding: (id: string) => void;
  updateEventBinding: (id: string, updates: Partial<EventBinding>) => void;

  selectComponent: (id: string, multi?: boolean) => void;
  deselectAll: () => void;
  selectAll: () => void;
  setHoveredComponent: (id: string | null) => void;
  getSelectedComponents: () => SceneComponent[];

  setViewport: (viewport: Partial<ViewportState>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  resetViewport: (containerWidth?: number, containerHeight?: number) => void;
  panTo: (x: number, y: number) => void;

  setActiveTool: (tool: EditorTool) => void;
  setDraggedComponentType: (type: string | null) => void;
  setActiveLayer: (layerId: string | null) => void;
  setCanvasConfig: (updates: Partial<CanvasConfig>) => void;
  setCanvasSize: (width: number, height: number) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushHistory: (type: HistoryEntry["type"]) => void;

  copySelected: () => void;
  pasteClipboard: () => void;

  loadScene: (components: SceneComponent[], layers: LayerNode[]) => void;
  loadSceneWithViews: (views: import("../types/scene").SceneView[], globalComponents: SceneComponent[], activeViewId: string) => void;
  exportScene: () => { components: SceneComponent[]; layers: LayerNode[] };
  exportSceneWithViews: () => { views: import("../types/scene").SceneView[]; globalComponents: SceneComponent[]; activeViewId: string };
  clearScene: () => void;
  setPreviewMode: (preview: boolean) => void;

  addView: (name: string) => string;
  removeView: (viewId: string) => void;
  switchView: (viewId: string) => void;
  renameView: (viewId: string, name: string) => void;
  getActiveView: () => import("../types/scene").SceneView | undefined;
}

const DEFAULT_VIEWPORT: ViewportState = {
  scale: 1,
  offset: { x: 0, y: 0 },
};

const ZOOM_STEP = 0.15;

export type EditorStore = EditorState & EditorActions;

export const useEditorStore = create<EditorStore>()(
  immer((set, get) => ({
    components: [] as SceneComponent[],
    layers: [] as LayerNode[],
    viewport: { ...DEFAULT_VIEWPORT },
    selection: { selectedIds: [] as string[], hoveredId: null as string | null, isMultiSelect: false },
    activeTool: "select" as EditorTool,
    activeLayerId: null as string | null,
    draggedComponentType: null as string | null,
    canvasConfig: { ...DEFAULT_CANVAS_CONFIG },
    history: [] as HistoryEntry[],
    historyIndex: -1,
    maxHistory: 50,
    clipboard: [] as SceneComponent[],
    isDirty: false,
    eventBindings: [] as EventBinding[],
    previewMode: false,
    views: [{ id: "default", name: "默认视图", components: [], layers: [] }],
    activeViewId: "default",
    globalComponents: [],

    addComponent: (type, layerId, position) => {
      const definition = componentRegistry.get(type);
      if (!definition) return null;

      const state = get();
      let targetLayerId: string | undefined = layerId;
      
      if (!targetLayerId) {
        targetLayerId = state.activeLayerId || undefined;
      }

      if (targetLayerId) {
        const targetLayer = state.layers.find(l => l.id === targetLayerId);
        if (targetLayer?.type === "group") {
          const firstChildLayer = state.layers.find(
            l => l.type === "layer" && l.parentId === targetLayerId
          );
          if (firstChildLayer) {
            targetLayerId = firstChildLayer.id;
          } else {
            targetLayerId = state.layers.find(l => l.type === "layer")?.id;
          }
        }
      }
      
      if (!targetLayerId && state.layers.length > 0) {
        targetLayerId = state.layers.find(l => l.type === "layer")?.id;
      }
      
      if (!targetLayerId) return null;

      const component = createDefaultSceneComponent(definition, targetLayerId, position);

      get().pushHistory("add");

      set((draft: EditorState) => {
        const maxZ = draft.components
          .filter((c: SceneComponent) => c.layerId === targetLayerId)
          .reduce((max: number, c: SceneComponent) => Math.max(max, c.zIndex), 0);
        component.zIndex = maxZ + 1;
        draft.components.push(component);
        draft.selection.selectedIds = [component.id];
        draft.isDirty = true;
      });

      return component;
    },

    removeComponent: (id) => {
      get().pushHistory("delete");
      set((draft: EditorState) => {
        draft.components = draft.components.filter((c: SceneComponent) => c.id !== id);
        draft.selection.selectedIds = draft.selection.selectedIds.filter((sid: string) => sid !== id);
        draft.isDirty = true;
      });
    },

    updateComponent: (id, updates) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const idx = draft.components.findIndex((c: SceneComponent) => c.id === id);
        if (idx !== -1) {
          Object.assign(draft.components[idx], updates);
          draft.isDirty = true;
        }
      });
    },

    updateComponentTransform: (id, transform) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          Object.assign(comp.transform, transform);
          draft.isDirty = true;
        }
      });
    },

    updateComponentConfig: (id, config) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          comp.config = { ...comp.config, ...config };
          draft.isDirty = true;
        }
      });
    },

    moveComponentToLayer: (id, layerId) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          comp.layerId = layerId;
          draft.isDirty = true;
        }
      });
    },

    reorderComponent: (id, zIndex) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          comp.zIndex = zIndex;
          draft.isDirty = true;
        }
      });
    },

    duplicateComponent: (id) => {
      const state = get();
      const comp = state.components.find((c: SceneComponent) => c.id === id);
      if (!comp) return null;

      const newComp: SceneComponent = {
        ...JSON.parse(JSON.stringify(comp)),
        id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: `${comp.name} (副本)`,
        transform: {
          ...comp.transform,
          x: comp.transform.x + 20,
          y: comp.transform.y + 20,
        },
      };

      get().pushHistory("add");

      set((draft: EditorState) => {
        draft.components.push(newComp);
        draft.selection.selectedIds = [newComp.id];
        draft.isDirty = true;
      });

      return newComp;
    },

    getComponentsByLayer: (layerId) => {
      const state = get();
      const descendantIds = getLayerDescendants(state.layers, layerId);
      return state.components.filter((c: SceneComponent) => descendantIds.includes(c.layerId));
    },

    getComponent: (id) => {
      return get().components.find((c: SceneComponent) => c.id === id);
    },

    addLayer: (name, parentId = null) => {
      const layer = createDefaultLayer(name, "layer", parentId);
      get().pushHistory("add");
      set((draft: EditorState) => {
        const siblings = parentId
          ? draft.layers.filter((l: LayerNode) => l.parentId === parentId)
          : draft.layers.filter((l: LayerNode) => l.parentId === null);
        layer.order = siblings.length;
        draft.layers.push(layer);
        if (parentId) {
          const parent = draft.layers.find((l: LayerNode) => l.id === parentId);
          if (parent) {
            parent.children.push(layer.id);
          }
        }
        draft.isDirty = true;
      });
      return layer;
    },

    addLayerGroup: (name, parentId = null) => {
      const layer = createDefaultLayer(name, "group", parentId);
      get().pushHistory("add");
      set((draft: EditorState) => {
        const siblings = parentId
          ? draft.layers.filter((l: LayerNode) => l.parentId === parentId)
          : draft.layers.filter((l: LayerNode) => l.parentId === null);
        layer.order = siblings.length;
        draft.layers.push(layer);
        if (parentId) {
          const parent = draft.layers.find((l: LayerNode) => l.id === parentId);
          if (parent) {
            parent.children.push(layer.id);
          }
        }
        draft.isDirty = true;
      });
      return layer;
    },

    removeLayer: (id) => {
      get().pushHistory("delete");
      set((draft: EditorState) => {
        const layer = draft.layers.find((l: LayerNode) => l.id === id);
        if (layer?.isDefault) return;
        
        const descendantIds = getLayerDescendants(draft.layers, id);
        draft.components = draft.components.filter(
          (c: SceneComponent) => !descendantIds.includes(c.layerId)
        );
        const parent = draft.layers.find((l: LayerNode) => l.children.includes(id));
        if (parent) {
          parent.children = parent.children.filter((cid: string) => cid !== id);
        }
        draft.layers = draft.layers.filter(
          (l: LayerNode) => !descendantIds.includes(l.id)
        );
        
        if (draft.activeLayerId === id) {
          const defaultLayer = draft.layers.find((l: LayerNode) => l.isDefault);
          draft.activeLayerId = defaultLayer?.id || null;
        }
        
        draft.isDirty = true;
      });
    },

    updateLayer: (id, updates) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const idx = draft.layers.findIndex((l: LayerNode) => l.id === id);
        if (idx !== -1) {
          Object.assign(draft.layers[idx], updates);
          draft.isDirty = true;
        }
      });
    },

    moveLayerToParent: (id, parentId, order) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const layer = draft.layers.find((l: LayerNode) => l.id === id);
        if (!layer) return;

        const oldParent = draft.layers.find((l: LayerNode) => l.children.includes(id));
        if (oldParent) {
          oldParent.children = oldParent.children.filter((cid: string) => cid !== id);
        }

        layer.parentId = parentId;
        if (parentId) {
          const newParent = draft.layers.find((l: LayerNode) => l.id === parentId);
          if (newParent) {
            newParent.children.push(id);
            newParent.children.sort((a: string, b: string) => {
              const childA = draft.layers.find((l: LayerNode) => l.id === a);
              const childB = draft.layers.find((l: LayerNode) => l.id === b);
              return (childA?.order ?? 0) - (childB?.order ?? 0);
            });
          }
        }

        if (order !== undefined) {
          layer.order = order;
        } else {
          const siblings = parentId
            ? draft.layers.filter((l: LayerNode) => l.parentId === parentId)
            : draft.layers.filter((l: LayerNode) => l.parentId === null);
          layer.order = siblings.length - 1;
        }

        draft.isDirty = true;
      });
    },

    reorderLayer: (id, order) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const layer = draft.layers.find((l: LayerNode) => l.id === id);
        if (layer) {
          layer.order = order;
          draft.isDirty = true;
        }
      });
    },

    toggleLayerVisibility: (id) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const layer = draft.layers.find((l: LayerNode) => l.id === id);
        if (layer) {
          const newVisible = !layer.visible;
          layer.visible = newVisible;
          if (layer.type === "group") {
            const descendantIds = getLayerDescendants(draft.layers, id);
            for (const did of descendantIds) {
              if (did === id) continue;
              const child = draft.layers.find((l: LayerNode) => l.id === did);
              if (child) child.visible = newVisible;
            }
          }
          draft.isDirty = true;
        }
      });
    },

    toggleLayerLock: (id) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const layer = draft.layers.find((l: LayerNode) => l.id === id);
        if (layer) {
          const newLocked = !layer.locked;
          layer.locked = newLocked;
          if (layer.type === "group") {
            const descendantIds = getLayerDescendants(draft.layers, id);
            for (const did of descendantIds) {
              if (did === id) continue;
              const child = draft.layers.find((l: LayerNode) => l.id === did);
              if (child) child.locked = newLocked;
            }
          }
          draft.isDirty = true;
        }
      });
    },

    toggleLayerExpanded: (id) => {
      set((draft: EditorState) => {
        const layer = draft.layers.find((l: LayerNode) => l.id === id);
        if (layer) {
          layer.expanded = !layer.expanded;
        }
      });
    },

    getLayer: (id) => {
      return get().layers.find((l: LayerNode) => l.id === id);
    },

    getRootLayers: () => {
      return get().layers
        .filter((l: LayerNode) => l.parentId === null)
        .sort((a: LayerNode, b: LayerNode) => a.order - b.order);
    },

    getLayerTree: () => {
      return get().layers;
    },

    addEventBinding: (binding) => {
      get().pushHistory("add");
      set((draft: EditorState) => {
        draft.eventBindings.push(binding);
        draft.isDirty = true;
      });
    },

    removeEventBinding: (id) => {
      get().pushHistory("delete");
      set((draft: EditorState) => {
        draft.eventBindings = draft.eventBindings.filter((b: EventBinding) => b.id !== id);
        draft.isDirty = true;
      });
    },

    updateEventBinding: (id, updates) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const idx = draft.eventBindings.findIndex((b: EventBinding) => b.id === id);
        if (idx !== -1) {
          Object.assign(draft.eventBindings[idx], updates);
          draft.isDirty = true;
        }
      });
    },

    selectComponent: (id, multi = false) => {
      set((draft: EditorState) => {
        if (multi) {
          const idx = draft.selection.selectedIds.indexOf(id);
          if (idx !== -1) {
            draft.selection.selectedIds.splice(idx, 1);
          } else {
            draft.selection.selectedIds.push(id);
          }
          draft.selection.isMultiSelect = true;
        } else {
          draft.selection.selectedIds = [id];
          draft.selection.isMultiSelect = false;
        }
      });
    },

    deselectAll: () => {
      set((draft: EditorState) => {
        draft.selection.selectedIds = [];
        draft.selection.isMultiSelect = false;
      });
    },

    selectAll: () => {
      set((draft: EditorState) => {
        draft.selection.selectedIds = draft.components.map((c: SceneComponent) => c.id);
        draft.selection.isMultiSelect = true;
      });
    },

    setHoveredComponent: (id) => {
      logger.debug("EditorStore", "setHoveredComponent", { id });
      set((draft: EditorState) => {
        draft.selection.hoveredId = id;
      });
    },

    getSelectedComponents: () => {
      const state = get();
      return state.components.filter((c: SceneComponent) => state.selection.selectedIds.includes(c.id));
    },

    setViewport: (viewport) => {
      set((draft: EditorState) => {
        Object.assign(draft.viewport, viewport);
      });
    },

    zoomIn: () => {
      set((draft: EditorState) => {
        const newScale = Math.min(draft.viewport.scale + ZOOM_STEP, draft.canvasConfig.viewport.maxScale);
        draft.viewport.scale = Math.round(newScale * 100) / 100;
      });
    },

    zoomOut: () => {
      set((draft: EditorState) => {
        const newScale = Math.max(draft.viewport.scale - ZOOM_STEP, draft.canvasConfig.viewport.minScale);
        draft.viewport.scale = Math.round(newScale * 100) / 100;
      });
    },

    zoomToFit: () => {
      set((draft: EditorState) => {
        draft.viewport.scale = 1;
        draft.viewport.offset = { x: 0, y: 0 };
      });
    },

    resetViewport: (containerWidth?, containerHeight?) => {
      const cc = get().canvasConfig;
      const cw = cc.width;
      const ch = cc.height;
      if (containerWidth && containerHeight) {
        const padding = 80;
        const availW = containerWidth - padding;
        const availH = containerHeight - padding;

        let scale: number;
        switch (cc.adaptationType) {
          case "full-x":
            scale = availW / cw;
            break;
          case "full-y":
            scale = availH / ch;
            break;
          case "full-screen":
            scale = Math.max(availW / cw, availH / ch);
            break;
          case "none":
            scale = 1;
            break;
          case "scale":
          default:
            scale = Math.min(availW / cw, availH / ch, 1);
            break;
        }

        const offsetX = (containerWidth - cw * scale) / 2;
        const offsetY = (containerHeight - ch * scale) / 2;
        set((draft: EditorState) => {
          draft.viewport = { ...DEFAULT_VIEWPORT, scale, offset: { x: offsetX, y: offsetY } };
        });
      } else {
        set((draft: EditorState) => {
          draft.viewport = { ...DEFAULT_VIEWPORT };
        });
      }
    },

    panTo: (x, y) => {
      set((draft: EditorState) => {
        draft.viewport.offset = { x, y };
      });
    },

    setActiveTool: (tool) => {
      set((draft: EditorState) => {
        draft.activeTool = tool;
      });
    },

    setDraggedComponentType: (type) => {
      set((draft: EditorState) => {
        draft.draggedComponentType = type;
      });
    },

    setActiveLayer: (layerId) => {
      set((draft: EditorState) => {
        draft.activeLayerId = layerId;
      });
    },

    setCanvasConfig: (updates) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const merged = { ...DEFAULT_CANVAS_CONFIG, ...draft.canvasConfig, ...updates };
        if (updates.background) {
          merged.background = { ...DEFAULT_CANVAS_CONFIG.background, ...draft.canvasConfig.background, ...updates.background };
          if (updates.background.gradient) {
            merged.background.gradient = { ...DEFAULT_CANVAS_CONFIG.background.gradient, ...draft.canvasConfig.background.gradient, ...updates.background.gradient };
          }
        }
        if (updates.grid) {
          merged.grid = { ...DEFAULT_CANVAS_CONFIG.grid, ...draft.canvasConfig.grid, ...updates.grid };
        }
        if (updates.ruler) {
          merged.ruler = { ...DEFAULT_CANVAS_CONFIG.ruler, ...draft.canvasConfig.ruler, ...updates.ruler };
        }
        if (updates.guide) {
          merged.guide = { ...DEFAULT_CANVAS_CONFIG.guide, ...draft.canvasConfig.guide, ...updates.guide };
        }
        if (updates.viewport) {
          merged.viewport = { ...DEFAULT_CANVAS_CONFIG.viewport, ...draft.canvasConfig.viewport, ...updates.viewport };
        }
        draft.canvasConfig = merged;
        draft.isDirty = true;
      });
    },

    setCanvasSize: (width, height) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        draft.canvasConfig.width = width;
        draft.canvasConfig.height = height;
        for (const comp of draft.components) {
          const compRight = comp.transform.x + (comp.transform.width || 0);
          const compBottom = comp.transform.y + (comp.transform.height || 0);
          if (compRight > width) {
            comp.transform.x = Math.max(0, width - (comp.transform.width || 0));
          }
          if (compBottom > height) {
            comp.transform.y = Math.max(0, height - (comp.transform.height || 0));
          }
        }
        draft.isDirty = true;
      });
    },

    undo: () => {
      const state = get();
      if (state.historyIndex < 0) return;
      const entry = state.history[state.historyIndex];
      if (!entry) return;

      const currentComponents = JSON.parse(JSON.stringify(state.components));
      const currentLayers = JSON.parse(JSON.stringify(state.layers)) as LayerNode[];

      set((draft: EditorState) => {
        draft.history[draft.historyIndex].after = currentComponents;
        draft.history[draft.historyIndex].layersAfter = currentLayers;

        draft.components = JSON.parse(JSON.stringify(entry.before));
        if (entry.layersBefore) {
          draft.layers = JSON.parse(JSON.stringify(entry.layersBefore));
        }
        draft.historyIndex = draft.historyIndex - 1;
        draft.isDirty = true;
        const validIds = new Set(draft.components.map((c: SceneComponent) => c.id));
        draft.selection.selectedIds = draft.selection.selectedIds.filter((id: string) => validIds.has(id));
      });
    },

    redo: () => {
      const state = get();
      const newIndex = state.historyIndex + 1;
      if (newIndex >= state.history.length) return;
      const entry = state.history[newIndex];
      if (!entry) return;
      set((draft: EditorState) => {
        draft.components = JSON.parse(JSON.stringify(entry.after));
        if (entry.layersAfter) {
          draft.layers = JSON.parse(JSON.stringify(entry.layersAfter));
        }
        draft.historyIndex = newIndex;
        draft.isDirty = true;
        const validIds = new Set(draft.components.map((c: SceneComponent) => c.id));
        draft.selection.selectedIds = draft.selection.selectedIds.filter((id: string) => validIds.has(id));
      });
    },

    canUndo: () => get().historyIndex >= 0,
    canRedo: () => {
      const state = get();
      return state.historyIndex < state.history.length - 1;
    },

    pushHistory: (type) => {
      const state = get();
      const snapshot = JSON.parse(JSON.stringify(state.components));
      const layersSnapshot = JSON.parse(JSON.stringify(state.layers)) as LayerNode[];
      const entry: HistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        timestamp: Date.now(),
        type,
        before: snapshot,
        after: snapshot,
        layersBefore: layersSnapshot,
        layersAfter: layersSnapshot,
      };
      const newIndex = state.historyIndex + 1;
      const truncated = state.history.slice(0, newIndex);
      truncated.push(entry);
      if (truncated.length > state.maxHistory) {
        truncated.shift();
      }
      set((draft: EditorState) => {
        draft.history = truncated;
        draft.historyIndex = draft.history.length - 1;
      });
    },

    copySelected: () => {
      const state = get();
      const selected = state.components.filter((c: SceneComponent) => state.selection.selectedIds.includes(c.id));
      set((draft: EditorState) => {
        draft.clipboard = JSON.parse(JSON.stringify(selected));
      });
    },

    pasteClipboard: () => {
      const state = get();
      if (state.clipboard.length === 0) return;

      const pasted: SceneComponent[] = state.clipboard.map((comp: SceneComponent) => ({
        ...JSON.parse(JSON.stringify(comp)),
        id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: `${comp.name} (副本)`,
        transform: {
          ...comp.transform,
          x: comp.transform.x + 20,
          y: comp.transform.y + 20,
        },
      }));

      get().pushHistory("add");

      set((draft: EditorState) => {
        draft.components.push(...pasted);
        draft.selection.selectedIds = pasted.map((c: SceneComponent) => c.id);
        draft.isDirty = true;
      });
    },

    loadScene: (components, layers) => {
      logger.warn("EditorStore", "loadScene called, clearing selection", { componentCount: components.length });
      set((draft: EditorState) => {
        const layerIds = new Set(layers.map((l) => l.id));
        const validComponents = components.filter((c) => layerIds.has(c.layerId));
        draft.components = validComponents;
        draft.layers = layers;
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.history = [];
        draft.historyIndex = -1;
        draft.isDirty = false;
        draft.eventBindings = [];
        
        const defaultLayer = layers.find(l => l.isDefault);
        if (defaultLayer) {
          draft.activeLayerId = defaultLayer.id;
        } else if (layers.length > 0) {
          draft.activeLayerId = layers[0].id;
        } else {
          draft.activeLayerId = null;
        }
      });
    },

    exportScene: () => {
      const state = get();
      return {
        components: JSON.parse(JSON.stringify(state.components)),
        layers: JSON.parse(JSON.stringify(state.layers)),
      };
    },

    clearScene: () => {
      logger.warn("EditorStore", "clearScene called, clearing selection");
      set((draft: EditorState) => {
        draft.components = [];
        draft.layers = [];
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.activeLayerId = null;
        draft.isDirty = false;
        draft.eventBindings = [];
        draft.canvasConfig = { ...DEFAULT_CANVAS_CONFIG };
        draft.previewMode = false;
        draft.views = [{ id: "default", name: "默认视图", components: [], layers: [] }];
        draft.activeViewId = "default";
        draft.globalComponents = [];
      });
    },

    setPreviewMode: (preview) => {
      if (preview) logger.warn("EditorStore", "setPreviewMode(true) called, clearing selection");
      set((draft: EditorState) => {
        draft.previewMode = preview;
        if (preview) {
          draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        }
      });
    },

    loadSceneWithViews: (views, globalComponents, activeViewId) => {
      set((draft: EditorState) => {
        draft.views = views;
        draft.globalComponents = globalComponents;
        draft.activeViewId = activeViewId;
        const activeView = views.find((v) => v.id === activeViewId) || views[0];
        if (activeView) {
          draft.components = activeView.components;
          draft.layers = activeView.layers;
        }
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.history = [];
        draft.historyIndex = -1;
        draft.isDirty = false;
        draft.eventBindings = [];
        const defaultLayer = draft.layers.find((l) => l.isDefault);
        draft.activeLayerId = defaultLayer?.id || (draft.layers.length > 0 ? draft.layers[0].id : null);
      });
    },

    exportSceneWithViews: () => {
      const state = get();
      const views = state.views.map((v) => {
        if (v.id === state.activeViewId) {
          return { ...v, components: JSON.parse(JSON.stringify(state.components)), layers: JSON.parse(JSON.stringify(state.layers)) };
        }
        return { ...v, components: v.components ? JSON.parse(JSON.stringify(v.components)) : [], layers: v.layers ? JSON.parse(JSON.stringify(v.layers)) : [] };
      });
      return {
        views,
        globalComponents: JSON.parse(JSON.stringify(state.globalComponents)),
        activeViewId: state.activeViewId,
      };
    },

    addView: (name) => {
      set((draft: EditorState) => {
        const currentView = draft.views.find((v) => v.id === draft.activeViewId);
        if (currentView) {
          currentView.components = draft.components;
          currentView.layers = draft.layers;
        }
        const viewId = `view-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const defaultLayer = createDefaultLayer("默认图层", "layer", null, true);
        draft.views.push({ id: viewId, name, components: [], layers: [defaultLayer] });
        draft.activeViewId = viewId;
        draft.components = [];
        draft.layers = [defaultLayer];
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.history = [];
        draft.historyIndex = -1;
        draft.activeLayerId = defaultLayer.id;
        draft.isDirty = true;
      });
      return get().activeViewId;
    },

    removeView: (viewId) => {
      set((draft: EditorState) => {
        if (draft.views.length <= 1) return;
        const idx = draft.views.findIndex((v) => v.id === viewId);
        if (idx === -1) return;
        draft.views.splice(idx, 1);
        if (draft.activeViewId === viewId) {
          const nextView = draft.views[Math.min(idx, draft.views.length - 1)];
          draft.activeViewId = nextView.id;
          draft.components = nextView.components || [];
          draft.layers = nextView.layers || [];
          draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
          const defaultLayer = draft.layers.find((l) => l.isDefault);
          draft.activeLayerId = defaultLayer?.id || (draft.layers.length > 0 ? draft.layers[0].id : null);
        }
        draft.isDirty = true;
      });
    },

    switchView: (viewId) => {
      set((draft: EditorState) => {
        const currentView = draft.views.find((v) => v.id === draft.activeViewId);
        if (currentView) {
          currentView.components = draft.components;
          currentView.layers = draft.layers;
        }
        const targetView = draft.views.find((v) => v.id === viewId);
        if (!targetView) return;
        draft.activeViewId = viewId;
        draft.components = targetView.components || [];
        draft.layers = targetView.layers || [];
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.history = [];
        draft.historyIndex = -1;
        const defaultLayer = draft.layers.find((l) => l.isDefault);
        draft.activeLayerId = defaultLayer?.id || (draft.layers.length > 0 ? draft.layers[0].id : null);
      });
    },

    renameView: (viewId, name) => {
      set((draft: EditorState) => {
        const view = draft.views.find((v) => v.id === viewId);
        if (view) {
          view.name = name;
          draft.isDirty = true;
        }
      });
    },

    getActiveView: () => {
      const state = get();
      return state.views.find((v) => v.id === state.activeViewId);
    },
  }))
);
