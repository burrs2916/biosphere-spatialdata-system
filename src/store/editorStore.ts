import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import logger from "../utils/logger";
import { useDevicePlacementStore } from "./devicePlacementStore";
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
import { calculateAdaptedViewport } from "../utils/viewportTransform";

interface DirtyState {
  isDirty: boolean;
  markDirty: () => void;
  markClean: () => void;
}

export const useDirtyStore = create<DirtyState>()((set) => ({
  isDirty: false,
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
}));

export type EditorTool = "select" | "pan" | "zoom-in" | "zoom-out";

export type AdaptationType = "scale" | "full-x" | "full-y" | "full-screen" | "none";
export type CanvasOrientation = "landscape" | "portrait";

export interface CanvasGridConfig {
  visible: boolean;
  size: number;
  snapToGrid: boolean;
  dragStep: number;
  resizeStep: number;
  minorColor: string;
  majorColor: string;
  opacity: number;
  brightness: number;
}

export interface CanvasRulerConfig {
  visible: boolean;
}

export type GuideLineStyle = "solid" | "dashed" | "dotted";

export type GuideLinePreset = "center" | "edges" | "center-edges" | "custom";

export interface CanvasGuideConfig {
  visible: boolean;
  color: string;
  opacity: number;
  lineWidth: number;
  lineStyle: GuideLineStyle;
  preset: GuideLinePreset;
  customVertical: number[];
  customHorizontal: number[];
  snapToGuide: boolean;
  snapToElement: boolean;
  snapThreshold: number;
  draggable: boolean;
  showLabel: boolean;
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
    zoomStep: number;
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
    minorColor: "",
    majorColor: "",
    opacity: 1,
    brightness: 1,
  },
  ruler: {
    visible: true,
  },
  guide: {
    visible: true,
    color: "#ff3b30",
    opacity: 0.6,
    lineWidth: 1,
    lineStyle: "dashed",
    preset: "center",
    customVertical: [],
    customHorizontal: [],
    snapToGuide: true,
    snapToElement: true,
    snapThreshold: 5,
    draggable: false,
    showLabel: false,
  },
  viewport: {
    minScale: 0.1,
    maxScale: 5,
    zoomStep: 0.15,
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
  /** 当前正在被拖动的设备 ID（用于设备库拖到画布的流程） */
  draggedDeviceId: string | null;
  canvasConfig: CanvasConfig;
  containerSize: { width: number; height: number };
  history: HistoryEntry[];
  historyIndex: number;
  maxHistory: number;
  clipboard: SceneComponent[];
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
  // 实时数据专用写入：只合并 config，不记历史、不标脏（非用户编辑，避免撤销栈被淹没 + 保存状态抖动 + 额外重渲染）
  applyRealtimeData: (id: string, data: Record<string, unknown>) => void;
  batchUpdateComponent: (id: string, updates: { config?: Record<string, unknown>; transform?: Partial<Transform> }) => void;
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
  setContainerSize: (width: number, height: number) => void;
  panTo: (x: number, y: number) => void;

  setActiveTool: (tool: EditorTool) => void;
  setDraggedComponentType: (type: string | null) => void;
  setDraggedDeviceId: (deviceId: string | null) => void;
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

function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

let _configHistoryTimer: ReturnType<typeof setTimeout> | null = null;
let _transformHistoryTimer: ReturnType<typeof setTimeout> | null = null;
const TRANSFORM_HISTORY_DELAY = 400;

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
    draggedDeviceId: null as string | null,
    canvasConfig: { ...DEFAULT_CANVAS_CONFIG },
    containerSize: { width: 0, height: 0 },
    history: [] as HistoryEntry[],
    historyIndex: -1,
    maxHistory: 50,
    clipboard: [] as SceneComponent[],
    eventBindings: [] as EventBinding[],
    previewMode: false,
    views: [{ id: "default", name: "默认视图", components: [], layers: [], canvasConfig: deepClone(DEFAULT_CANVAS_CONFIG), viewport: deepClone(DEFAULT_VIEWPORT), eventBindings: [] }],
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
        useDirtyStore.getState().markDirty();
      });

      return component;
    },

    removeComponent: (id) => {
      get().pushHistory("delete");
      set((draft: EditorState) => {
        draft.components = draft.components.filter((c: SceneComponent) => c.id !== id);
        draft.selection.selectedIds = draft.selection.selectedIds.filter((sid: string) => sid !== id);
        useDirtyStore.getState().markDirty();
      });
    },

    updateComponent: (id, updates) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const idx = draft.components.findIndex((c: SceneComponent) => c.id === id);
        if (idx !== -1) {
          Object.assign(draft.components[idx], updates);
          useDirtyStore.getState().markDirty();
        }
      });
    },

    updateComponentTransform: (id, transform) => {
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          Object.assign(comp.transform, transform);
          useDirtyStore.getState().markDirty();
        }
      });
      if (_transformHistoryTimer) clearTimeout(_transformHistoryTimer);
      _transformHistoryTimer = setTimeout(() => {
        get().pushHistory("update");
        _transformHistoryTimer = null;
      }, TRANSFORM_HISTORY_DELAY);
    },

    updateComponentConfig: (id, config) => {
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          comp.config = { ...comp.config, ...config };
          useDirtyStore.getState().markDirty();
        }
      });
      if (_configHistoryTimer) clearTimeout(_configHistoryTimer);
      _configHistoryTimer = setTimeout(() => {
        get().pushHistory("update");
        _configHistoryTimer = null;
      }, 300);
    },

    batchUpdateComponent: (id, updates) => {
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (!comp) return;
        if (updates.config) {
          comp.config = { ...comp.config, ...updates.config };
        }
        if (updates.transform) {
          Object.assign(comp.transform, updates.transform);
        }
        useDirtyStore.getState().markDirty();
      });
      if (_configHistoryTimer) clearTimeout(_configHistoryTimer);
      _configHistoryTimer = setTimeout(() => {
        get().pushHistory("update");
        _configHistoryTimer = null;
      }, 300);
    },

    // 实时数据写入：合并 config，但跳过 pushHistory / markDirty（实时馈送不是用户编辑，
    // 否则 4K 大屏每 tick 都会污染撤销栈、抖动保存状态并触发额外重渲染 → 卡顿）。
    applyRealtimeData: (id, data) => {
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          comp.config = { ...comp.config, ...data };
        }
      });
    },

    moveComponentToLayer: (id, layerId) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          comp.layerId = layerId;
          useDirtyStore.getState().markDirty();
        }
      });
    },

    reorderComponent: (id, zIndex) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const comp = draft.components.find((c: SceneComponent) => c.id === id);
        if (comp) {
          comp.zIndex = zIndex;
          useDirtyStore.getState().markDirty();
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
        useDirtyStore.getState().markDirty();
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
        useDirtyStore.getState().markDirty();
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
        useDirtyStore.getState().markDirty();
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
        
        useDirtyStore.getState().markDirty();
      });
    },

    updateLayer: (id, updates) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const idx = draft.layers.findIndex((l: LayerNode) => l.id === id);
        if (idx !== -1) {
          Object.assign(draft.layers[idx], updates);
          useDirtyStore.getState().markDirty();
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

        useDirtyStore.getState().markDirty();
      });
    },

    reorderLayer: (id, order) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const layer = draft.layers.find((l: LayerNode) => l.id === id);
        if (layer) {
          layer.order = order;
          useDirtyStore.getState().markDirty();
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
          useDirtyStore.getState().markDirty();
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
          useDirtyStore.getState().markDirty();
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
        useDirtyStore.getState().markDirty();
      });
    },

    removeEventBinding: (id) => {
      get().pushHistory("delete");
      set((draft: EditorState) => {
        draft.eventBindings = draft.eventBindings.filter((b: EventBinding) => b.id !== id);
        useDirtyStore.getState().markDirty();
      });
    },

    updateEventBinding: (id, updates) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        const idx = draft.eventBindings.findIndex((b: EventBinding) => b.id === id);
        if (idx !== -1) {
          Object.assign(draft.eventBindings[idx], updates);
          useDirtyStore.getState().markDirty();
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
        const oldScale = draft.viewport.scale;
        const newScale = Math.min(oldScale + draft.canvasConfig.viewport.zoomStep, draft.canvasConfig.viewport.maxScale);
        const roundedScale = Math.round(newScale * 100) / 100;
        const centerX = (draft.canvasConfig.width * oldScale) / 2 + draft.viewport.offset.x;
        const centerY = (draft.canvasConfig.height * oldScale) / 2 + draft.viewport.offset.y;
        draft.viewport.offset.x = centerX - (draft.canvasConfig.width * roundedScale) / 2;
        draft.viewport.offset.y = centerY - (draft.canvasConfig.height * roundedScale) / 2;
        draft.viewport.scale = roundedScale;
      });
    },

    zoomOut: () => {
      set((draft: EditorState) => {
        const oldScale = draft.viewport.scale;
        const newScale = Math.max(oldScale - draft.canvasConfig.viewport.zoomStep, draft.canvasConfig.viewport.minScale);
        const roundedScale = Math.round(newScale * 100) / 100;
        const centerX = (draft.canvasConfig.width * oldScale) / 2 + draft.viewport.offset.x;
        const centerY = (draft.canvasConfig.height * oldScale) / 2 + draft.viewport.offset.y;
        draft.viewport.offset.x = centerX - (draft.canvasConfig.width * roundedScale) / 2;
        draft.viewport.offset.y = centerY - (draft.canvasConfig.height * roundedScale) / 2;
        draft.viewport.scale = roundedScale;
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
      const cs = get().containerSize;
      const cW = containerWidth || cs.width;
      const cH = containerHeight || cs.height;
      if (cW && cH) {
        const vp = calculateAdaptedViewport(cW, cH, cc.width, cc.height, cc.adaptationType);
        set((draft: EditorState) => {
          draft.viewport = { scale: vp.scale, offset: { x: vp.offset.x, y: vp.offset.y } };
        });
      } else {
        set((draft: EditorState) => {
          draft.viewport = { ...DEFAULT_VIEWPORT };
        });
      }
    },

    setContainerSize: (width, height) => {
      set((draft: EditorState) => {
        draft.containerSize = { width, height };
      });
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

    setDraggedDeviceId: (deviceId) => {
      set((draft: EditorState) => {
        draft.draggedDeviceId = deviceId;
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
        merged.background = { ...DEFAULT_CANVAS_CONFIG.background, ...draft.canvasConfig.background, ...updates.background };
        if (updates.background?.gradient || draft.canvasConfig.background?.gradient) {
          merged.background.gradient = { ...DEFAULT_CANVAS_CONFIG.background.gradient, ...draft.canvasConfig.background.gradient, ...updates.background?.gradient };
        }
        merged.grid = { ...DEFAULT_CANVAS_CONFIG.grid, ...draft.canvasConfig.grid, ...updates.grid };
        merged.ruler = { ...DEFAULT_CANVAS_CONFIG.ruler, ...draft.canvasConfig.ruler, ...updates.ruler };
        merged.guide = { ...DEFAULT_CANVAS_CONFIG.guide, ...draft.canvasConfig.guide, ...updates.guide };
        merged.viewport = { ...DEFAULT_CANVAS_CONFIG.viewport, ...draft.canvasConfig.viewport, ...updates.viewport };
        draft.canvasConfig = merged;
        useDirtyStore.getState().markDirty();
      });
    },

    setCanvasSize: (width, height) => {
      get().pushHistory("update");
      set((draft: EditorState) => {
        draft.canvasConfig.width = width;
        draft.canvasConfig.height = height;
        draft.canvasConfig.orientation = width >= height ? "landscape" : "portrait";
        const maxDim = Math.max(width, height);
        let recommendedMaxScale = 5;
        if (maxDim > 10000) recommendedMaxScale = 10;
        else if (maxDim > 5000) recommendedMaxScale = 8;
        if (draft.canvasConfig.viewport.maxScale === DEFAULT_CANVAS_CONFIG.viewport.maxScale
            || draft.canvasConfig.viewport.maxScale < recommendedMaxScale) {
          draft.canvasConfig.viewport.maxScale = recommendedMaxScale;
        }
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
        useDirtyStore.getState().markDirty();
      });
    },

    undo: () => {
      const state = get();
      if (state.historyIndex < 0) return;
      const entry = state.history[state.historyIndex];
      if (!entry) return;

      const currentComponents = JSON.parse(JSON.stringify(state.components));
      const currentLayers = JSON.parse(JSON.stringify(state.layers)) as LayerNode[];
      const currentCanvasConfig = JSON.parse(JSON.stringify(state.canvasConfig)) as CanvasConfig;

      set((draft: EditorState) => {
        draft.history[draft.historyIndex].after = currentComponents;
        draft.history[draft.historyIndex].layersAfter = currentLayers;
        draft.history[draft.historyIndex].canvasConfigAfter = currentCanvasConfig;

        draft.components = JSON.parse(JSON.stringify(entry.before));
        if (entry.layersBefore) {
          draft.layers = JSON.parse(JSON.stringify(entry.layersBefore));
        }
        if (entry.canvasConfigBefore) {
          draft.canvasConfig = JSON.parse(JSON.stringify(entry.canvasConfigBefore));
        }
        draft.historyIndex = draft.historyIndex - 1;
        useDirtyStore.getState().markDirty();
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
        if (entry.canvasConfigAfter) {
          draft.canvasConfig = JSON.parse(JSON.stringify(entry.canvasConfigAfter));
        }
        draft.historyIndex = newIndex;
        useDirtyStore.getState().markDirty();
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
      const snapshot = structuredClone(state.components);
      const layersSnapshot = structuredClone(state.layers) as LayerNode[];
      const canvasConfigSnapshot = structuredClone(state.canvasConfig) as CanvasConfig;
      const entry: HistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        timestamp: Date.now(),
        type,
        before: snapshot,
        after: snapshot,
        layersBefore: layersSnapshot,
        layersAfter: layersSnapshot,
        canvasConfigBefore: canvasConfigSnapshot,
        canvasConfigAfter: canvasConfigSnapshot,
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
        useDirtyStore.getState().markDirty();
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
        useDirtyStore.getState().markClean();
        draft.eventBindings = [];
        draft.canvasConfig = deepClone(DEFAULT_CANVAS_CONFIG);
        draft.viewport = deepClone(DEFAULT_VIEWPORT);
        draft.views = [{ id: "default", name: "默认视图", components: validComponents, layers, canvasConfig: deepClone(DEFAULT_CANVAS_CONFIG), viewport: deepClone(DEFAULT_VIEWPORT), eventBindings: [] }];
        draft.activeViewId = "default";
        draft.globalComponents = [];

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
        const defaultLayer = createDefaultLayer("默认图层", "layer", null, true);
        draft.components = [];
        draft.layers = [defaultLayer];
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.activeLayerId = defaultLayer.id;
        useDirtyStore.getState().markClean();
        draft.eventBindings = [];
        draft.canvasConfig = deepClone(DEFAULT_CANVAS_CONFIG);
        draft.viewport = deepClone(DEFAULT_VIEWPORT);
        draft.previewMode = false;
        draft.views = [{ id: "default", name: "默认视图", components: [], layers: [defaultLayer], canvasConfig: deepClone(DEFAULT_CANVAS_CONFIG), viewport: deepClone(DEFAULT_VIEWPORT), eventBindings: [] }];
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
      logger.info("EditorStore", "loadSceneWithViews called", {
        viewsCount: views.length,
        globalComponentsCount: globalComponents.length,
        activeViewId,
      });
      set((draft: EditorState) => {
        draft.views = views;
        draft.globalComponents = globalComponents;
        draft.activeViewId = activeViewId;
        const activeView = views.find((v) => v.id === activeViewId) || views[0];
        if (activeView) {
          draft.components = activeView.components;
          draft.layers = activeView.layers;
          draft.canvasConfig = activeView.canvasConfig ? deepClone(activeView.canvasConfig) : { ...DEFAULT_CANVAS_CONFIG };
          draft.viewport = activeView.viewport ? deepClone(activeView.viewport) : { ...DEFAULT_VIEWPORT };
          draft.eventBindings = activeView.eventBindings ? deepClone(activeView.eventBindings) : [];
          // 🔍 DIAGNOSTIC: 输出每个组件的类型信息
          logger.info("EditorStore", "Active view components loaded", {
            viewId: activeView.id,
            viewName: activeView.name,
            componentsCount: activeView.components.length,
            componentTypes: activeView.components.map((c) => ({ id: c.id, type: c.type, name: c.name })),
          });
        } else {
          draft.components = [];
          draft.layers = [];
          draft.canvasConfig = deepClone(DEFAULT_CANVAS_CONFIG);
          draft.viewport = deepClone(DEFAULT_VIEWPORT);
          draft.eventBindings = [];
        }
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.history = [];
        draft.historyIndex = -1;
        useDirtyStore.getState().markClean();
        const defaultLayer = draft.layers.find((l) => l.isDefault);
        draft.activeLayerId = defaultLayer?.id || (draft.layers.length > 0 ? draft.layers[0].id : null);
      });
      // 加载所有视图的设备摆位到 devicePlacementStore（独立 store，不进 history）
      const placementStore = useDevicePlacementStore.getState();
      for (const v of views) {
        placementStore.hydrateView(v.id, v.devicePlacements ?? []);
      }
    },

    exportSceneWithViews: () => {
      const state = get();
      const placementStore = useDevicePlacementStore.getState();
      const views = state.views.map((v) => {
        const placements = deepClone(placementStore.getPlacements(v.id));
        if (v.id === state.activeViewId) {
          return {
            ...v,
            components: deepClone(state.components),
            layers: deepClone(state.layers),
            canvasConfig: deepClone(state.canvasConfig),
            viewport: deepClone(state.viewport),
            eventBindings: deepClone(state.eventBindings),
            devicePlacements: placements,
          };
        }
        return {
          ...v,
          components: v.components ? deepClone(v.components) : [],
          layers: v.layers ? deepClone(v.layers) : [],
          canvasConfig: v.canvasConfig ? deepClone(v.canvasConfig) : undefined,
          viewport: v.viewport ? deepClone(v.viewport) : undefined,
          eventBindings: v.eventBindings ? deepClone(v.eventBindings) : [],
          devicePlacements: placements,
        };
      });
      return {
        views,
        globalComponents: deepClone(state.globalComponents),
        activeViewId: state.activeViewId,
      };
    },

    addView: (name) => {
      set((draft: EditorState) => {
        const currentView = draft.views.find((v) => v.id === draft.activeViewId);
        if (currentView) {
          currentView.components = draft.components;
          currentView.layers = draft.layers;
          currentView.canvasConfig = draft.canvasConfig;
          currentView.viewport = draft.viewport;
          currentView.eventBindings = draft.eventBindings;
        }
        const viewId = `view-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const defaultLayer = createDefaultLayer("默认图层", "layer", null, true);
        const newCanvasConfig = draft.canvasConfig;
        const newViewport = draft.viewport;
        draft.views.push({ id: viewId, name, components: [], layers: [defaultLayer], canvasConfig: newCanvasConfig, viewport: newViewport, eventBindings: [] });
        draft.activeViewId = viewId;
        draft.components = [];
        draft.layers = [defaultLayer];
        draft.canvasConfig = newCanvasConfig;
        draft.viewport = newViewport;
        draft.eventBindings = [];
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.history = [];
        draft.historyIndex = -1;
        draft.activeLayerId = defaultLayer.id;
        useDirtyStore.getState().markDirty();
      });
      return get().activeViewId;
    },

    removeView: (viewId) => {
      set((draft: EditorState) => {
        if (draft.views.length <= 1) return;
        const idx = draft.views.findIndex((v) => v.id === viewId);
        if (idx === -1) return;
        if (draft.activeViewId === viewId) {
          draft.views.splice(idx, 1);
          const nextView = draft.views[Math.min(idx, draft.views.length - 1)];
          draft.activeViewId = nextView.id;
          draft.components = nextView.components || [];
          draft.layers = nextView.layers || [];
          draft.canvasConfig = nextView.canvasConfig ? { ...nextView.canvasConfig } : { ...DEFAULT_CANVAS_CONFIG };
          draft.viewport = nextView.viewport ? { ...nextView.viewport, offset: { ...nextView.viewport.offset } } : { ...DEFAULT_VIEWPORT };
          draft.eventBindings = nextView.eventBindings ? [...nextView.eventBindings] : [];
          draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
          const defaultLayer = draft.layers.find((l) => l.isDefault);
          draft.activeLayerId = defaultLayer?.id || (draft.layers.length > 0 ? draft.layers[0].id : null);
        } else {
          const activeView = draft.views.find((v) => v.id === draft.activeViewId);
          if (activeView) {
            activeView.components = draft.components;
            activeView.layers = draft.layers;
            activeView.canvasConfig = draft.canvasConfig;
            activeView.viewport = draft.viewport;
            activeView.eventBindings = draft.eventBindings;
          }
          draft.views.splice(idx, 1);
        }
        useDirtyStore.getState().markDirty();
      });
    },

    switchView: (viewId) => {
      const prevViewId = get().activeViewId;
      set((draft: EditorState) => {
        const currentView = draft.views.find((v) => v.id === draft.activeViewId);
        if (currentView) {
          currentView.components = draft.components;
          currentView.layers = draft.layers;
          currentView.canvasConfig = { ...draft.canvasConfig };
        }
        const targetView = draft.views.find((v) => v.id === viewId);
        if (!targetView) return;
        draft.activeViewId = viewId;
        draft.components = targetView.components || [];
        draft.layers = targetView.layers || [];
        if (targetView.canvasConfig) {
          draft.canvasConfig = { ...targetView.canvasConfig };
        }
        draft.selection = { selectedIds: [], hoveredId: null, isMultiSelect: false };
        draft.history = [];
        draft.historyIndex = -1;
        const defaultLayer = draft.layers.find((l) => l.isDefault);
        draft.activeLayerId = defaultLayer?.id || (draft.layers.length > 0 ? draft.layers[0].id : null);
      });
      logger.info("EditorStore", "switchView", {
        from: prevViewId,
        to: viewId,
        newViewport: get().viewport,
        newCanvasConfig: { width: get().canvasConfig.width, height: get().canvasConfig.height },
        componentCount: get().components.length,
      });
    },

    renameView: (viewId, name) => {
      set((draft: EditorState) => {
        const view = draft.views.find((v) => v.id === viewId);
        if (view) {
          view.name = name;
          useDirtyStore.getState().markDirty();
        }
      });
    },

    getActiveView: () => {
      const state = get();
      return state.views.find((v) => v.id === state.activeViewId);
    },
  }))
);

// 开发模式暴露到 window，方便 Console 调试
if (typeof window !== "undefined") {
  (window as any).__editorStore = useEditorStore;
}
