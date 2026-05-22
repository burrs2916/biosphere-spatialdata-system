import type { ComponentType } from "react";

export type BackgroundType = "solid" | "gradient" | "image" | "video";
export type GradientDirection = "to-right" | "to-bottom" | "to-bottom-right" | "to-bottom-left" | "radial";
export type ImageFit = "cover" | "contain" | "fill" | "none";

export interface CanvasBackground {
  type: BackgroundType;
  color: string;
  gradient: {
    direction: GradientDirection;
    colors: [string, string];
  };
  imageUrl: string;
  imageFit: ImageFit;
  videoUrl: string;
  videoAutoplay: boolean;
  videoMuted: boolean;
  videoLoop: boolean;
}

export interface ComponentCapabilities {
  resizable: boolean;
  rotatable: boolean;
  draggable: boolean;
  connectable: boolean;
  embeddable: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: { x: number; y: number };
}

export interface EventDefinition {
  id: string;
  name: string;
  description?: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description?: string;
}

export type DataBindingType = "value" | "style" | "visibility" | "action";

export interface DataBinding {
  id: string;
  sourceId: string;
  field: string;
  targetProperty: string;
  transform?: string;
  type: DataBindingType;
}

export interface EventBinding {
  id: string;
  sourceComponentId: string;
  sourceEvent: string;
  targetComponentId: string;
  targetAction: string;
  params?: Record<string, unknown>;
  condition?: string;
}

export interface DataSchema {
  sourceType: "static" | "api" | "websocket" | "database";
  staticData?: unknown;
  apiConfig?: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: unknown;
    refreshInterval?: number;
  };
  websocketConfig?: {
    url: string;
    protocols?: string[];
  };
  transform?: string;
}

export interface ComponentRendererProps {
  config: Record<string, unknown>;
  componentId: string;
  mode?: "preview" | "edit";
  width?: number;
  height?: number;
  onConfigChange?: (key: string, value: unknown) => void;
  contentInteractionActive?: boolean;
  onInteractionLockChange?: (locked: boolean) => void;
}

export type RendererLoader = () => Promise<{ default: ComponentType<ComponentRendererProps> }>;

export interface RendererDescriptor {
  loader: RendererLoader;
  cached?: ComponentType<ComponentRendererProps>;
}

export interface PluginManifest {
  type: string;
  name: string;
  icon: string;
  description?: string;
  category: string;
  version: string;
  defaultSize: Size;
  defaultConfig: Record<string, unknown>;
  capabilities: ComponentCapabilities;
  configSchema?: ConfigField[];
  renderer: {
    entry: string;
    format: "module" | "umd" | "schema" | "builtin";
    lazy?: boolean;
  };
  events?: EventDefinition[];
  actions?: ActionDefinition[];
  dataSchema?: DataSchema;
  dependencies?: { name: string; version: string; global?: string }[];
  permissions?: string[];
  author?: string;
  homepage?: string;
  thumbnail?: string;
  builtIn?: boolean;
  enabled?: boolean;
}

export interface SceneComponent {
  id: string;
  type: string;
  name: string;

  transform: Transform;
  layerId: string;
  zIndex: number;
  locked: boolean;
  visible: boolean;

  config: Record<string, unknown>;
  style?: Record<string, unknown>;

  bindings?: DataBinding[];
  events?: EventBinding[];

  children?: string[];
  parentId?: string | null;
}

export interface ComponentDefinition {
  type: string;
  name: string;
  icon: string;
  description?: string;
  category: string;
  version: string;
  defaultSize: Size;
  defaultConfig: Record<string, unknown>;
  capabilities: ComponentCapabilities;
  configSchema?: ConfigField[];
  renderer: RendererDescriptor;
  events?: EventDefinition[];
  actions?: ActionDefinition[];
  dataSchema?: DataSchema;
  builtIn?: boolean;
  enabled?: boolean;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "color" | "toggle" | "slider" | "textarea" | "json" | "file" | "group" | "mapLibrary";
  defaultValue?: unknown;
  options?: { label: string; value: unknown }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  group?: string;
  hidden?: (config: Record<string, unknown>) => boolean;
  fields?: ConfigField[];
  mapType?: "cad" | "tile" | "blueprint" | "globe" | "heatmap";
}

export interface LayerNode {
  id: string;
  name: string;
  type: "layer" | "group";
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode?: string;
  parentId: string | null;
  children: string[];
  order: number;
  expanded: boolean;
  color?: string;
  metadata?: Record<string, unknown>;
  isDefault?: boolean;
  isBackground?: boolean;
  background?: CanvasBackground;
}

export const CATEGORY_LABELS: Record<string, string> = {
  basic: "基础组件",
  chart: "图表组件",
  map: "地图组件",
  media: "媒体组件",
  decoration: "装饰组件",
  custom: "自定义组件",
};

export interface ViewportState {
  scale: number;
  offset: { x: number; y: number };
}

export interface SelectionState {
  selectedIds: string[];
  hoveredId: string | null;
  isMultiSelect: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  type: "add" | "update" | "delete" | "batch";
  before: SceneComponent[];
  after: SceneComponent[];
  layersBefore?: LayerNode[];
  layersAfter?: LayerNode[];
}

export function createDefaultTransform(override?: Partial<Transform>): Transform {
  return {
    x: override?.x ?? 0,
    y: override?.y ?? 0,
    width: override?.width ?? 200,
    height: override?.height ?? 150,
    rotation: override?.rotation ?? 0,
    scale: override?.scale ?? { x: 1, y: 1 },
  };
}

export function createDefaultSceneComponent(
  definition: ComponentDefinition,
  layerId: string,
  position?: Partial<Point>
): SceneComponent {
  return {
    id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    type: definition.type,
    name: definition.name,
    transform: createDefaultTransform({
      ...definition.defaultSize,
      ...position,
    }),
    layerId,
    zIndex: 0,
    locked: false,
    visible: true,
    config: { ...definition.defaultConfig },
  };
}

export function createDefaultLayer(
  name?: string,
  type: "layer" | "group" = "layer",
  parentId: string | null = null,
  isDefault: boolean = false
): LayerNode {
  return {
    id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: name || (type === "group" ? "新建分组" : "新建图层"),
    type,
    visible: true,
    locked: false,
    opacity: 1,
    parentId,
    children: [],
    order: 0,
    expanded: true,
    isDefault,
  };
}

export function flattenLayerTree(layers: LayerNode[]): LayerNode[] {
  const result: LayerNode[] = [];
  const map = new Map(layers.map((l) => [l.id, l]));
  const visited = new Set<string>();

  const walk = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = map.get(id);
    if (!node) return;
    result.push(node);
    const sortedChildren = node.children
      .map((cid) => map.get(cid))
      .filter((c): c is LayerNode => !!c)
      .sort((a, b) => a.order - b.order);
    for (const child of sortedChildren) {
      walk(child.id);
    }
  };

  const roots = layers.filter((l) => l.parentId === null).sort((a, b) => a.order - b.order);
  for (const root of roots) {
    walk(root.id);
  }

  return result;
}

export function getLayerDescendants(layers: LayerNode[], layerId: string): string[] {
  const ids: string[] = [layerId];
  const map = new Map(layers.map((l) => [l.id, l]));
  const node = map.get(layerId);
  if (!node) return ids;
  const walk = (children: string[]) => {
    for (const childId of children) {
      ids.push(childId);
      const child = map.get(childId);
      if (child) walk(child.children);
    }
  };
  walk(node.children);
  return ids;
}
