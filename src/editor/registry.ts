import type { ComponentDefinition, RendererLoader } from "../types/editor";

class ComponentRegistryImpl {
  private definitions = new Map<string, ComponentDefinition>();

  register(definition: ComponentDefinition): void {
    if (this.definitions.has(definition.type)) {
      console.warn(`[ComponentRegistry] Component type "${definition.type}" is already registered, overwriting.`);
    }
    this.definitions.set(definition.type, definition);
  }

  unregister(type: string): boolean {
    return this.definitions.delete(type);
  }

  get(type: string): ComponentDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): ComponentDefinition[] {
    return Array.from(this.definitions.values());
  }

  getByCategory(category: string): ComponentDefinition[] {
    return this.getAll().filter((d) => d.category === category);
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    this.definitions.forEach((d) => categories.add(d.category));
    return Array.from(categories);
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  async loadRenderer(type: string): Promise<React.ComponentType<any> | null> {
    const def = this.definitions.get(type);
    if (!def) return null;
    if (def.renderer.cached) return def.renderer.cached;
    try {
      const mod = await def.renderer.loader();
      def.renderer.cached = mod.default;
      return mod.default;
    } catch (err) {
      console.error(`[ComponentRegistry] Failed to load renderer for "${type}":`, err);
      return null;
    }
  }

  getEnabled(): ComponentDefinition[] {
    return this.getAll().filter((d) => d.enabled !== false);
  }
}

export const componentRegistry = new ComponentRegistryImpl();

const lazy = (loader: RendererLoader): ComponentDefinition["renderer"] => ({
  loader,
});

export function registerBuiltinComponents(): void {
  componentRegistry.register({
    type: "text",
    name: "文本",
    icon: "text_fields",
    description: "文本组件，支持富文本",
    category: "basic",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 60 },
    defaultConfig: {
      content: "文本内容",
      fontSize: 16,
      fontWeight: "normal",
      color: "#ffffff",
      textAlign: "left",
      lineHeight: 1.5,
    },
    capabilities: {
      resizable: true,
      rotatable: true,
      draggable: true,
      connectable: true,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/TextRenderer").then(m => ({ default: m.TextRenderer }))),
    events: [
      { id: "click", name: "点击" },
    ],
    configSchema: [
      { key: "content", label: "文本内容", type: "textarea", group: "内容" },
      { key: "fontSize", label: "字号", type: "number", min: 8, max: 200, group: "样式" },
      { key: "fontWeight", label: "字重", type: "select", options: [
        { label: "正常", value: "normal" },
        { label: "粗体", value: "bold" },
        { label: "细体", value: "lighter" },
      ], group: "样式" },
      { key: "color", label: "颜色", type: "color", group: "样式" },
      { key: "textAlign", label: "对齐", type: "select", options: [
        { label: "左对齐", value: "left" },
        { label: "居中", value: "center" },
        { label: "右对齐", value: "right" },
      ], group: "样式" },
    ],
  });

  componentRegistry.register({
    type: "image",
    name: "图片",
    icon: "image",
    description: "图片组件",
    category: "basic",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 300, height: 200 },
    defaultConfig: {
      source: "",
      fit: "cover",
      borderRadius: 0,
    },
    capabilities: {
      resizable: true,
      rotatable: true,
      draggable: true,
      connectable: false,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/ImageRenderer").then(m => ({ default: m.ImageRenderer }))),
    configSchema: [
      { key: "source", label: "图片", type: "file", group: "内容" },
      { key: "fit", label: "填充模式", type: "select", options: [
        { label: "覆盖", value: "cover" },
        { label: "包含", value: "contain" },
        { label: "拉伸", value: "fill" },
      ], group: "内容" },
      { key: "borderRadius", label: "圆角", type: "number", min: 0, max: 100, group: "样式" },
    ],
  });

  componentRegistry.register({
    type: "shape",
    name: "形状",
    icon: "crop_square",
    description: "基础形状，矩形/圆形/线条",
    category: "basic",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 150 },
    defaultConfig: {
      shapeType: "rect",
      fill: "rgba(33, 150, 243, 0.3)",
      stroke: "#2196F3",
      strokeWidth: 2,
      borderRadius: 0,
    },
    capabilities: {
      resizable: true,
      rotatable: true,
      draggable: true,
      connectable: false,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/ShapeRenderer").then(m => ({ default: m.ShapeRenderer }))),
    configSchema: [
      { key: "shapeType", label: "形状类型", type: "select", options: [
        { label: "矩形", value: "rect" },
        { label: "圆形", value: "circle" },
        { label: "线条", value: "line" },
      ], group: "内容" },
      { key: "fill", label: "填充色", type: "color", group: "样式" },
      { key: "stroke", label: "边框色", type: "color", group: "样式" },
      { key: "strokeWidth", label: "边框宽度", type: "number", min: 0, max: 20, group: "样式" },
      { key: "borderRadius", label: "圆角", type: "number", min: 0, max: 100, group: "样式" },
    ],
  });

  componentRegistry.register({
    type: "echart",
    name: "ECharts图表",
    icon: "bar_chart",
    description: "ECharts 数据可视化图表",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      option: {},
      theme: "default",
      renderer: "canvas",
    },
    capabilities: {
      resizable: true,
      rotatable: false,
      draggable: true,
      connectable: true,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/EchartRenderer").then(m => ({ default: m.EchartRenderer }))),
    events: [
      { id: "click", name: "点击" },
      { id: "dataChanged", name: "数据更新" },
    ],
    actions: [
      { id: "updateData", name: "更新数据" },
      { id: "updateConfig", name: "更新配置" },
    ],
    dataSchema: {
      sourceType: "static",
      staticData: {},
    },
    configSchema: [
      { key: "theme", label: "主题", type: "select", options: [
        { label: "默认", value: "default" },
        { label: "暗色", value: "dark" },
      ], group: "样式" },
      { key: "option", label: "图表配置", type: "json", group: "内容" },
    ],
  });

  componentRegistry.register({
    type: "metric",
    name: "指标卡",
    icon: "speed",
    description: "数据指标卡片",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 120 },
    defaultConfig: {
      title: "指标名称",
      value: "--",
      unit: "",
      trend: "none",
      color: "#2196F3",
    },
    capabilities: {
      resizable: true,
      rotatable: false,
      draggable: true,
      connectable: true,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/MetricRenderer").then(m => ({ default: m.MetricRenderer }))),
    events: [
      { id: "click", name: "点击" },
      { id: "valueChanged", name: "值变化" },
    ],
    actions: [
      { id: "updateData", name: "更新数据" },
    ],
    dataSchema: {
      sourceType: "static",
      staticData: { value: "--" },
    },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "value", label: "值", type: "text", group: "内容" },
      { key: "unit", label: "单位", type: "text", group: "内容" },
      { key: "color", label: "主题色", type: "color", group: "样式" },
    ],
  });

  componentRegistry.register({
    type: "map-tile",
    name: "瓦片地图",
    icon: "map",
    description: "2D 瓦片地图，支持 OSM/天地图/高德等瓦片服务",
    category: "map",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 800, height: 600 },
    defaultConfig: {
      tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      crs: "EPSG:3857",
      center: [116.397, 39.908],
      zoom: 10,
      minZoom: 0,
      maxZoom: 18,
      pitch: 0,
      bearing: 0,
      showControls: true,
    },
    capabilities: {
      resizable: true,
      rotatable: false,
      draggable: true,
      connectable: true,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/TileMapRenderer").then(m => ({ default: m.TileMapRenderer }))),
    events: [
      { id: "click", name: "点击" },
      { id: "regionClick", name: "区域点击" },
      { id: "zoomChange", name: "缩放变化" },
      { id: "moveEnd", name: "移动结束" },
    ],
    actions: [
      { id: "flyTo", name: "飞行到" },
      { id: "fitBounds", name: "适配范围" },
      { id: "addLayer", name: "添加图层" },
      { id: "removeLayer", name: "移除图层" },
    ],
    configSchema: [
      { key: "mapLibraryId", label: "已发布瓦片图库", type: "mapLibrary", mapType: "tile", group: "数据源" },
      { key: "tileUrl", label: "瓦片地址", type: "text", group: "数据源" },
      { key: "crs", label: "坐标系", type: "select", options: [
        { label: "EPSG:3857 (Web墨卡托)", value: "EPSG:3857" },
        { label: "EPSG:4326 (WGS84)", value: "EPSG:4326" },
        { label: "EPSG:4490 (CGCS2000)", value: "EPSG:4490" },
      ], group: "数据源" },
      { key: "center", label: "中心点", type: "text", group: "视口" },
      { key: "zoom", label: "缩放级别", type: "number", min: 0, max: 22, group: "视口" },
      { key: "minZoom", label: "最小缩放", type: "number", min: 0, max: 22, group: "视口" },
      { key: "maxZoom", label: "最大缩放", type: "number", min: 0, max: 22, group: "视口" },
      { key: "pitch", label: "倾斜角", type: "number", min: 0, max: 85, group: "视口" },
      { key: "bearing", label: "旋转角", type: "number", min: -180, max: 180, group: "视口" },
      { key: "showControls", label: "显示控件", type: "toggle", group: "交互" },
    ],
  });

  componentRegistry.register({
    type: "map-cad",
    name: "CAD图纸",
    icon: "architecture",
    description: "CAD 图纸查看组件，支持 DXF/DWG 格式",
    category: "map",
    version: "3.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 800, height: 600 },
    defaultConfig: {
      mapLibraryId: "",
      backgroundColor: "#1a1a2e",
      lineColor: "#4fc3f7",
      backgroundOpacity: 1,
      contentOpacity: 1,
      fitMode: "contain",
      showBorder: false,
      borderColor: "#666666",
      borderWidth: 1,
      cameraState: null,
    },
    capabilities: {
      resizable: true,
      rotatable: false,
      draggable: true,
      connectable: true,
      embeddable: true,
    },
    renderer: lazy(() => import("./renderers/CADMapRenderer").then(m => ({ default: m.CADMapRenderer }))),
    events: [
      { id: "click", name: "点击" },
      { id: "entityClick", name: "实体点击" },
      { id: "documentLoaded", name: "文档加载完成" },
    ],
    actions: [
      { id: "zoomToFit", name: "适配视图" },
      { id: "highlight", name: "高亮实体" },
    ],
    configSchema: [
      { key: "mapLibraryId", label: "已发布地图", type: "mapLibrary", mapType: "cad", group: "数据源" },
      { key: "fitMode", label: "适配模式", type: "select", options: [
        { label: "填充", value: "contain" },
        { label: "铺满", value: "cover" },
        { label: "拉伸", value: "stretch" },
        { label: "自定义", value: "custom" },
      ], group: "布局" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "backgroundOpacity", label: "背景透明度", type: "slider", min: 0, max: 1, step: 0.05, group: "样式" },
      { key: "lineColor", label: "线条颜色", type: "color", group: "样式" },
      { key: "contentOpacity", label: "图纸透明度", type: "slider", min: 0, max: 1, step: 0.05, group: "样式" },
      { key: "showBorder", label: "显示边框", type: "toggle", group: "边框" },
      { key: "borderColor", label: "边框颜色", type: "color", group: "边框", hidden: (c) => !c.showBorder },
      { key: "borderWidth", label: "边框宽度", type: "number", min: 1, max: 5, step: 1, group: "边框", hidden: (c) => !c.showBorder },
    ],
  });

  componentRegistry.register({
    type: "map-blueprint",
    name: "图片蓝图",
    icon: "wallpaper",
    description: "图片蓝图/平面图，支持图片配准叠加到地图",
    category: "map",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 800, height: 600 },
    defaultConfig: {
      imageUrl: "",
      bounds: { min: { x: 116.2, y: 39.7 }, max: { x: 116.5, y: 40.0 } },
      opacity: 1,
      showBaseMap: true,
      baseMapUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    },
    capabilities: {
      resizable: true,
      rotatable: false,
      draggable: true,
      connectable: true,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/BlueprintMapRenderer").then(m => ({ default: m.BlueprintMapRenderer }))),
    events: [
      { id: "click", name: "点击" },
      { id: "regionClick", name: "区域点击" },
    ],
    actions: [
      { id: "flyTo", name: "飞行到" },
      { id: "updateImage", name: "更新图片" },
    ],
    configSchema: [
      { key: "mapLibraryId", label: "已发布蓝图图库", type: "mapLibrary", mapType: "blueprint", group: "数据源" },
      { key: "imageUrl", label: "图片地址", type: "text", group: "数据源" },
      { key: "bounds", label: "坐标范围", type: "json", group: "配准" },
      { key: "opacity", label: "透明度", type: "number", min: 0, max: 1, step: 0.1, group: "样式" },
      { key: "showBaseMap", label: "显示底图", type: "toggle", group: "底图" },
      { key: "baseMapUrl", label: "底图地址", type: "text", group: "底图" },
    ],
  });

  componentRegistry.register({
    type: "map-globe",
    name: "三维地球",
    icon: "public",
    description: "三维地球组件，支持 3D Tiles、地形、三维模型",
    category: "map",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 800, height: 600 },
    defaultConfig: {
      ionAccessToken: "",
      terrainEnabled: true,
      imageryProvider: "osm",
      center: [116.397, 39.908],
      zoom: 10,
      pitch: -30,
      bearing: 0,
    },
    capabilities: {
      resizable: true,
      rotatable: false,
      draggable: true,
      connectable: true,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/GlobeMapRenderer").then(m => ({ default: m.GlobeMapRenderer }))),
    events: [
      { id: "click", name: "点击" },
      { id: "entityClick", name: "实体点击" },
      { id: "cameraChanged", name: "相机变化" },
    ],
    actions: [
      { id: "flyTo", name: "飞行到" },
      { id: "add3DTiles", name: "添加3DTiles" },
      { id: "addEntity", name: "添加实体" },
    ],
    configSchema: [
      { key: "ionAccessToken", label: "Ion Token", type: "text", group: "数据源" },
      { key: "terrainEnabled", label: "启用地形", type: "toggle", group: "数据源" },
      { key: "imageryProvider", label: "影像底图", type: "select", options: [
        { label: "OpenStreetMap", value: "osm" },
        { label: "天地图", value: "tianditu" },
        { label: "无底图", value: "none" },
      ], group: "数据源" },
      { key: "center", label: "中心点", type: "text", group: "视口" },
      { key: "zoom", label: "缩放级别", type: "number", min: 0, max: 20, group: "视口" },
      { key: "pitch", label: "倾斜角", type: "number", min: -90, max: 0, group: "视口" },
    ],
  });

  componentRegistry.register({
    type: "map-heatmap",
    name: "热力地图",
    icon: "whatshot",
    description: "热力图/数据可视化地图，支持热力、轨迹、聚合等",
    category: "map",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 800, height: 600 },
    defaultConfig: {
      baseMapUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      heatmapRadius: 30,
      heatmapIntensity: 1,
      heatmapOpacity: 0.8,
      data: [],
    },
    capabilities: {
      resizable: true,
      rotatable: false,
      draggable: true,
      connectable: true,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/HeatmapMapRenderer").then(m => ({ default: m.HeatmapMapRenderer }))),
    events: [
      { id: "click", name: "点击" },
      { id: "pointClick", name: "数据点点击" },
    ],
    actions: [
      { id: "updateData", name: "更新数据" },
      { id: "flyTo", name: "飞行到" },
      { id: "setStyle", name: "设置样式" },
    ],
    dataSchema: {
      sourceType: "static",
      staticData: [],
    },
    configSchema: [
      { key: "baseMapUrl", label: "底图地址", type: "text", group: "底图" },
      { key: "heatmapRadius", label: "热力半径", type: "number", min: 5, max: 100, group: "样式" },
      { key: "heatmapIntensity", label: "热力强度", type: "number", min: 0.1, max: 5, step: 0.1, group: "样式" },
      { key: "heatmapOpacity", label: "透明度", type: "number", min: 0, max: 1, step: 0.1, group: "样式" },
    ],
  });

  componentRegistry.register({
    type: "video",
    name: "视频",
    icon: "videocam",
    description: "视频播放组件",
    category: "media",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      source: "",
      autoplay: false,
      muted: true,
      controls: true,
    },
    capabilities: {
      resizable: true,
      rotatable: false,
      draggable: true,
      connectable: false,
      embeddable: false,
    },
    renderer: lazy(() => import("./renderers/VideoRenderer").then(m => ({ default: m.VideoRenderer }))),
    events: [
      { id: "play", name: "播放" },
      { id: "pause", name: "暂停" },
      { id: "ended", name: "结束" },
    ],
    actions: [
      { id: "play", name: "播放" },
      { id: "pause", name: "暂停" },
    ],
    configSchema: [
      { key: "source", label: "视频源", type: "text", group: "内容" },
      { key: "autoplay", label: "自动播放", type: "toggle", group: "播放" },
      { key: "muted", label: "静音", type: "toggle", group: "播放" },
      { key: "controls", label: "显示控件", type: "toggle", group: "播放" },
    ],
  });
}
