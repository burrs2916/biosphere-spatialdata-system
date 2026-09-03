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
  viewport?: import("../types/editor").ViewportState;
  eventBindings?: import("../types/editor").EventBinding[];
  /** 该视图中的设备摆位（V1 组态联动） */
  devicePlacements?: import("./devicePlacement").DevicePlacement[];
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
  {
    id: "device-status",
    name: "设备状态监控大屏",
    description: "专用于展示全矿设备在线/离线/故障/告警状态的监控大屏，开箱即用",
    icon: "monitoring",
    defaults: {
      coordinateSystem: "EPSG:3857",
      layers: [],
      camera: { center: { x: 0, y: 0 }, zoom: 1, bearing: 0, pitch: 0 },
      tags: ["设备", "监控", "状态"],
      // 预置一个主视图 + 设备状态组件骨架
      views: [
        {
          id: "view_default",
          name: "设备状态总览",
          layers: [
            {
              id: "layer_default",
              name: "默认图层",
              type: "layer",
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: "normal",
              parentId: null,
              children: [],
              order: 0,
              expanded: true,
              isDefault: true,
            },
          ],
          viewport: { scale: 0.426, offset: { x: 40, y: 181 } },
          eventBindings: [],
          devicePlacements: [],
          canvasConfig: {
            width: 3840,
            height: 2160,
            orientation: "landscape",
            adaptationType: "scale",
            lockAspectRatio: false,
            background: {
              type: "gradient",
              color: "#1a2a4a",
              gradient: { direction: "radial", colors: ["#1e3a6b", "#0a1525"] },
              imageUrl: "",
              imageFit: "cover",
              videoUrl: "",
              videoAutoplay: true,
              videoMuted: true,
              videoLoop: true,
            },
            grid: {
              visible: true,
              size: 40,
              snapToGrid: false,
              dragStep: 1,
              resizeStep: 1,
              minorColor: "rgba(79,195,247,0.08)",
              majorColor: "rgba(79,195,247,0.18)",
              opacity: 0.6,
              brightness: 1,
            },
            ruler: { visible: true },
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
            viewport: { minScale: 0.1, maxScale: 5, zoomStep: 0.15 },
          },
          components: [
            {
              id: "comp_ds_tree",
              type: "industrial-device-tree",
              name: "设备拓扑树",
              transform: { x: 0, y: 0, width: 3840, height: 2160, rotation: 0, scale: { x: 1, y: 1 } },
              layerId: "layer_default",
              zIndex: 2,
              locked: false,
              visible: true,
              config: {
                deviceScope: "all",
                selectedDeviceIds: [],
                accentColor: "#4fc3f7",
                showLabels: true,
              },
            },
          ],
        },
      ],
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
