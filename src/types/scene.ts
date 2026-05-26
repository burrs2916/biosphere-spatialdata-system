import type { CRSType, SpatialBoundingBox, CameraConfig, SpatialSourceConfig } from "./spatial";
import type { SceneComponent, LayerNode } from "./editor";

export type SceneStatus = "draft" | "published" | "archived";

export interface SceneCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  parentId?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SceneView {
  id: string;
  name: string;
  icon?: string;
  components: SceneComponent[];
  layers: LayerNode[];
  canvasConfig?: import("../store/editorStore").CanvasConfig;
}

export interface SceneDSL {
  id: string;
  name: string;
  description?: string;

  coordinateSystem: CRSType;
  camera: CameraConfig;
  bounds?: SpatialBoundingBox;

  layers: SceneLayer[];
  bindings: SceneBinding[];
  variables?: SceneVariable[];
  viewportSyncRules?: import("../editor/spatial/ViewportSyncService").ViewportSyncRule[];
  layout: LayoutItem[];

  globalComponents?: SceneComponent[];
  views?: SceneView[];
  activeViewId?: string;

  editorComponents?: SceneComponent[];
  editorLayers?: LayerNode[];
  canvasConfig?: import("../store/editorStore").CanvasConfig;

  categoryId?: string;
  tags: string[];
  thumbnail?: string;

  status: SceneStatus;
  publishedAt?: number;

  metadata: Record<string, unknown>;

  createdAt: number;
  updatedAt: number;
}

export interface SceneLayer {
  id: string;
  name: string;
  type: SceneLayerType;
  dimension: "2d" | "3d";
  source: SpatialSourceConfig;
  visible: boolean;
  zIndex: number;
  opacity?: number;
  minZoom?: number;
  maxZoom?: number;
  style?: SceneLayerStyle;
  metadata?: Record<string, unknown>;
}

export type SceneLayerType =
  | "tile"
  | "vector"
  | "geojson"
  | "cad"
  | "image"
  | "3d-model"
  | "devices"
  | "topology"
  | "heatmap"
  | "chart"
  | "metric"
  | "table"
  | "text"
  | "video";

export type SpatialLayerType = "tile" | "vector" | "geojson" | "cad" | "image" | "3d-model";
export type DataOverlayLayerType = "devices" | "topology" | "heatmap";
export type WidgetOverlayLayerType = "chart" | "metric" | "table" | "text" | "video";

export const SPATIAL_LAYER_TYPES: SpatialLayerType[] = ["tile", "vector", "geojson", "cad", "image", "3d-model"];
export const DATA_OVERLAY_LAYER_TYPES: DataOverlayLayerType[] = ["devices", "topology", "heatmap"];
export const WIDGET_OVERLAY_LAYER_TYPES: WidgetOverlayLayerType[] = ["chart", "metric", "table", "text", "video"];

export function isSpatialLayer(type: SceneLayerType): type is SpatialLayerType {
  return SPATIAL_LAYER_TYPES.includes(type as SpatialLayerType);
}

export function isDataOverlayLayer(type: SceneLayerType): type is DataOverlayLayerType {
  return DATA_OVERLAY_LAYER_TYPES.includes(type as DataOverlayLayerType);
}

export function isWidgetOverlayLayer(type: SceneLayerType): type is WidgetOverlayLayerType {
  return WIDGET_OVERLAY_LAYER_TYPES.includes(type as WidgetOverlayLayerType);
}

export interface SceneLayerStyle {
  color?: string;
  opacity?: number;
  lineWidth?: number;
  fill?: boolean;
  icon?: string;
  fontSize?: number;
  fontWeight?: string;
}

export interface SceneBinding {
  id: string;
  componentId: string;
  dataSource: string;
  metricName: string;
  adapterType?: string;
  dataSourceConfig?: Record<string, unknown>;
  transform?: SceneTransformConfig;
  refreshInterval?: number;
  action?: "set" | "update" | "append" | "highlight" | "hide" | "show" | "remove" | "navigate" | "custom";
}

export interface SceneVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'date' | 'datetime';
  defaultValue: unknown;
  currentValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  description?: string;
  scope?: 'scene' | 'global';
}

export interface SceneTransformConfig {
  type: "map" | "filter" | "aggregate" | "custom";
  expression?: string;
  function?: string;
}

export interface LayoutItem {
  componentId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  locked?: boolean;
}

export interface RuntimeState {
  sceneId: string;
  timestamp: string;
  values: Map<string, unknown>;
  status: "active" | "paused" | "error";
}

export interface SceneConfig {
  coordinateSystem: CRSType;
  bounds?: SpatialBoundingBox;
  camera?: CameraConfig;
}

export interface SceneEvent {
  type: "click" | "hover" | "select" | "update" | "move" | "zoom" | "measure";
  layerId: string;
  featureId?: string;
  data?: unknown;
  timestamp: string;
}

export interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  preview?: string;
  defaults: Partial<SceneDSL>;
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: "blank",
    name: "空白场景",
    description: "从零开始创建场景",
    icon: "note_add",
    defaults: {},
  },
  {
    id: "map-2d",
    name: "2D 地图",
    description: "基于瓦片地图的二维场景",
    icon: "map",
    defaults: {
      coordinateSystem: "EPSG:3857",
      layers: [],
      camera: {
        center: { x: 116.397, y: 39.908 },
        zoom: 10,
        bearing: 0,
        pitch: 0,
      },
    },
  },
  {
    id: "monitor-dashboard",
    name: "监控仪表盘",
    description: "实时数据监控仪表盘场景",
    icon: "dashboard",
    defaults: {
      coordinateSystem: "EPSG:3857",
      layers: [],
      tags: ["监控", "仪表盘"],
    },
  },
  {
    id: "engineering-cad",
    name: "工程图纸",
    description: "CAD/BIM 图纸查看场景",
    icon: "architecture",
    defaults: {
      coordinateSystem: "local",
      layers: [],
      camera: {
        center: { x: 0, y: 0 },
        zoom: 1,
        bearing: 0,
        pitch: 0,
      },
    },
  },
];

export function createDefaultSceneLayer(partial?: Partial<SceneLayer>): SceneLayer {
  return {
    id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: "新图层",
    type: "tile",
    dimension: "2d",
    source: {
      type: "tile",
      urlTemplate: "",
      minZoom: 0,
      maxZoom: 18,
    },
    visible: true,
    zIndex: 0,
    opacity: 1,
    ...partial,
  };
}

export function createDefaultScene(partial?: Partial<SceneDSL>): SceneDSL {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `scene_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: "未命名场景",
    coordinateSystem: "EPSG:3857",
    camera: {
      center: { x: 0, y: 0 },
      zoom: 1,
      bearing: 0,
      pitch: 0,
    },
    layers: [],
    bindings: [],
    layout: [],
    tags: [],
    status: "draft",
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function createSceneFromTemplate(template: SceneTemplate, partial?: Partial<SceneDSL>): SceneDSL {
  return createDefaultScene({
    ...template.defaults,
    name: template.name,
    ...partial,
  });
}
