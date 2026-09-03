import { componentRegistry, lazy } from "./registryCore";

/**
 * 注册所有 ECharts 图表组件
 * 每个图表类型独立注册，名称与 ECharts 官方保持一致
 */
export function registerChartComponents(): void {

  // ─── 柱状图 ───
  componentRegistry.register({
    type: "echart-bar",
    name: "柱状图",
    icon: "bar_chart",
    description: "ECharts 柱状图，支持纵向/横向、渐变、圆角等配置",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      orientation: "vertical",
      categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      values: [120, 200, 150, 80, 70, 110, 130],
      seriesName: "数据",
      barWidth: "50%",
      borderRadius: 4,
      showLabel: false,
      gradient: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/BarChartRenderer").then(m => ({ default: m.BarChartRenderer }))),
    events: [{ id: "click", name: "点击" }, { id: "dataChanged", name: "数据更新" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "orientation", label: "方向", type: "select", options: [{ label: "纵向", value: "vertical" }, { label: "横向", value: "horizontal" }], group: "内容" },
      { key: "categories", label: "分类数据", type: "json", group: "内容", placeholder: '["A","B","C"]' },
      { key: "values", label: "数值数据", type: "json", group: "内容", placeholder: "[10,20,30]" },
      { key: "seriesName", label: "系列名", type: "text", group: "内容" },
      { key: "barWidth", label: "柱宽", type: "text", group: "样式" },
      { key: "borderRadius", label: "圆角", type: "number", min: 0, group: "样式" },
      { key: "showLabel", label: "显示标签", type: "toggle", group: "样式" },
      { key: "gradient", label: "渐变色", type: "toggle", group: "样式" },
      { key: "showTitle", label: "显示标题", type: "toggle", group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 折线图分组 — 5 个独立组件，各自有专属属性面板
  // ═══════════════════════════════════════════════════════════════

  // ─── 堆叠折线图 ───
  componentRegistry.register({
    type: "echart-line-stacked",
    name: "堆叠折线图",
    icon: "stacked_line_chart",
    description: "多系列堆叠展示",
    category: "line-chart",
    version: "3.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      smooth: true,
      areaStyle: true,
      areaOpacity: 0.25,
      stack: "total",
      showSymbol: false,
      lineWidth: 2,
      xAxisType: "category",
      yAxisType: "value",
      seriesNames: ["邮件营销", "联盟广告", "视频广告", "直接访问", "搜索引擎"],
      seriesData: [
        [120, 132, 101, 134, 90, 230, 210],
        [220, 182, 191, 234, 290, 330, 310],
        [150, 232, 201, 154, 190, 330, 410],
        [320, 332, 301, 334, 390, 330, 320],
        [820, 932, 901, 934, 1290, 1330, 1320],
      ],
      xAxisData: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/LineChartRenderer").then(m => ({ default: m.LineChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "xAxisData", label: "X轴数据", type: "json", group: "基础", placeholder: '["Mon","Tue","Wed"]' },
      { key: "seriesData", label: "系列数据", type: "json", group: "基础", placeholder: "[[100,200,300]]" },
      { key: "seriesNames", label: "系列名称", type: "json", group: "基础", placeholder: '["系列1","系列2"]' },
      { key: "smooth", label: "平滑曲线", type: "toggle", group: "基础" },
      { key: "areaStyle", label: "面积填充", type: "toggle", group: "基础" },
      { key: "areaOpacity", label: "面积透明度", type: "slider", min: 0, max: 1, step: 0.05, group: "基础" },
      { key: "stack", label: "堆叠标识", type: "text", group: "基础", placeholder: "相同标识会堆叠" },

      { key: "lineWidth", label: "线条宽度", type: "number", min: 1, max: 10, group: "线条样式" },
      { key: "lineColor", label: "线条颜色", type: "color", group: "线条样式" },

      { key: "showSymbol", label: "显示数据点", type: "toggle", group: "数据点" },
      { key: "symbolType", label: "点形状", type: "select", group: "数据点",
        options: [
          { label: "圆形", value: "circle" }, { label: "矩形", value: "rect" },
          { label: "三角形", value: "triangle" }, { label: "菱形", value: "diamond" },
          { label: "无", value: "none" },
        ] },
      { key: "symbolSize", label: "点大小", type: "number", min: 1, max: 20, group: "数据点" },

      { key: "xAxisType", label: "X轴类型", type: "select", group: "轴配置",
        options: [
          { label: "类目轴", value: "category" }, { label: "时间轴", value: "time" },
          { label: "数值轴", value: "value" }, { label: "对数轴", value: "log" },
        ] },
      { key: "yAxisType", label: "Y轴类型", type: "select", group: "轴配置",
        options: [{ label: "数值轴", value: "value" }, { label: "对数轴", value: "log" }] },

      { key: "showDataZoom", label: "数据缩放", type: "toggle", group: "交互" },

      { key: "theme", label: "主题", type: "select", group: "主题",
        options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }] },
    ],
  });

  // ─── 极坐标折线图 ───
  componentRegistry.register({
    type: "echart-line-polar",
    name: "极坐标折线图",
    icon: "radar",
    description: "极坐标系双数值轴",
    category: "line-chart",
    version: "3.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 400 },
    defaultConfig: {
      theme: "dark",
      smooth: true,
      areaStyle: false,
      showSymbol: true,
      symbolSize: 4,
      lineWidth: 2,
      polarEnable: true,
      polarRadius: ["10%", "75%"],
      seriesNames: ["极坐标数据"],
      seriesData: [[[0, 50], [30, 80], [60, 60], [90, 90], [120, 70], [150, 85], [180, 55], [210, 75], [240, 65], [270, 88], [300, 72], [330, 60]]],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/LineChartRenderer").then(m => ({ default: m.LineChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "seriesData", label: "系列数据", type: "json", group: "基础", placeholder: "[[[0,50],[30,80]]]" },
      { key: "seriesNames", label: "系列名称", type: "json", group: "基础", placeholder: '["系列1"]' },
      { key: "smooth", label: "平滑曲线", type: "toggle", group: "基础" },
      { key: "areaStyle", label: "面积填充", type: "toggle", group: "基础" },

      { key: "lineWidth", label: "线条宽度", type: "number", min: 1, max: 10, group: "线条样式" },
      { key: "lineColor", label: "线条颜色", type: "color", group: "线条样式" },

      { key: "showSymbol", label: "显示数据点", type: "toggle", group: "数据点" },
      { key: "symbolType", label: "点形状", type: "select", group: "数据点",
        options: [
          { label: "圆形", value: "circle" }, { label: "矩形", value: "rect" },
          { label: "三角形", value: "triangle" }, { label: "菱形", value: "diamond" },
          { label: "无", value: "none" },
        ] },
      { key: "symbolSize", label: "点大小", type: "number", min: 1, max: 20, group: "数据点" },

      { key: "polarRadius", label: "极坐标半径", type: "json", group: "极坐标", placeholder: '["0%","75%"]' },

      { key: "theme", label: "主题", type: "select", group: "主题",
        options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }] },
    ],
  });

  // ─── 数据集折线图 ───
  componentRegistry.register({
    type: "echart-line-dataset",
    name: "数据集折线图",
    icon: "data_usage",
    description: "Dataset + Transform 数据驱动",
    category: "line-chart",
    version: "3.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      smooth: true,
      areaStyle: false,
      datasetSource: [
        ["product", "2015", "2016", "2017"],
        ["Matcha Latte", 43.3, 85.8, 93.7],
        ["Milk Tea", 83.1, 73.4, 55.1],
        ["Cheese Cocoa", 86.4, 65.2, 82.5],
      ],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/LineChartRenderer").then(m => ({ default: m.LineChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "smooth", label: "平滑曲线", type: "toggle", group: "基础" },
      { key: "areaStyle", label: "面积填充", type: "toggle", group: "基础" },

      { key: "lineWidth", label: "线条宽度", type: "number", min: 1, max: 10, group: "线条样式" },
      { key: "lineColor", label: "线条颜色", type: "color", group: "线条样式" },

      { key: "datasetSource", label: "数据源", type: "json", group: "Dataset", placeholder: '[["product","2015"],["A",100]]' },
      { key: "datasetTransform", label: "数据转换", type: "json", group: "Dataset", placeholder: '[{"type":"filter","config":{"dimension":1,"value":"A"}}]' },

      { key: "showDataZoom", label: "数据缩放", type: "toggle", group: "交互" },

      { key: "theme", label: "主题", type: "select", group: "主题",
        options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }] },
    ],
  });

  // ─── 迷你图矩阵 ───
  componentRegistry.register({
    type: "echart-line-sparkline",
    name: "迷你图矩阵",
    icon: "grid_view",
    description: "多图矩阵布局",
    category: "line-chart",
    version: "3.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      smooth: true,
      showSymbol: false,
      areaStyle: false,
      lineWidth: 1,
      sparklineGrids: [
        { left: "5%", top: "10%", width: "40%", height: "30%" },
        { left: "55%", top: "10%", width: "40%", height: "30%" },
        { left: "5%", top: "55%", width: "40%", height: "30%" },
        { left: "55%", top: "55%", width: "40%", height: "30%" },
      ],
      seriesNames: ["温度", "湿度", "压力", "流量"],
      seriesData: [
        [22, 23, 24, 25, 26, 24, 23],
        [45, 50, 55, 60, 58, 52, 48],
        [101, 102, 103, 104, 105, 103, 102],
        [12, 15, 18, 20, 17, 14, 11],
      ],
      xAxisData: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/LineChartRenderer").then(m => ({ default: m.LineChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "xAxisData", label: "X轴数据", type: "json", group: "基础", placeholder: '["Mon","Tue","Wed"]' },
      { key: "seriesData", label: "系列数据", type: "json", group: "基础", placeholder: "[[100,200,300]]" },
      { key: "seriesNames", label: "系列名称", type: "json", group: "基础", placeholder: '["系列1","系列2"]' },
      { key: "smooth", label: "平滑曲线", type: "toggle", group: "基础" },
      { key: "areaStyle", label: "面积填充", type: "toggle", group: "基础" },

      { key: "lineWidth", label: "线条宽度", type: "number", min: 1, max: 10, group: "线条样式" },
      { key: "lineColor", label: "线条颜色", type: "color", group: "线条样式" },

      { key: "sparklineGrids", label: "多图布局", type: "json", group: "Sparkline", placeholder: '[{"left":"5%","top":"5%","width":"40%","height":"30%"}]' },

      { key: "theme", label: "主题", type: "select", group: "主题",
        options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }] },
    ],
  });

  // ─── 饼图 ───
  componentRegistry.register({
    type: "echart-pie",
    name: "饼图",
    icon: "pie_chart",
    description: "ECharts 饼图，支持南丁格尔玫瑰图、环形图",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 350, height: 300 },
    defaultConfig: {
      theme: "dark",
      data: [
        { name: "A", value: 1048 }, { name: "B", value: 735 },
        { name: "C", value: 580 }, { name: "D", value: 484 }, { name: "E", value: 300 },
      ],
      roseType: false,
      radius: ["35%", "65%"],
      center: ["50%", "50%"],
      showLabel: true,
      labelPosition: "outside",
      borderRadius: 6,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/PieChartRenderer").then(m => ({ default: m.PieChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容", placeholder: '[{"name":"A","value":100}]' },
      { key: "roseType", label: "玫瑰图", type: "select", options: [{ label: "关闭", value: false }, { label: "半径", value: "radius" }, { label: "面积", value: "area" }], group: "样式" },
      { key: "radius", label: "半径", type: "json", group: "样式", placeholder: '["35%","65%"]' },
      { key: "center", label: "中心", type: "json", group: "样式", placeholder: '["50%","50%"]' },
      { key: "showLabel", label: "显示标签", type: "toggle", group: "样式" },
      { key: "labelPosition", label: "标签位置", type: "select", options: [{ label: "外部", value: "outside" }, { label: "内部", value: "inside" }, { label: "中心", value: "center" }], group: "样式" },
      { key: "borderRadius", label: "圆角", type: "number", min: 0, group: "样式" },
      { key: "showTitle", label: "显示标题", type: "toggle", group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 散点图 ───
  componentRegistry.register({
    type: "echart-scatter",
    name: "散点图",
    icon: "scatter_plot",
    description: "ECharts 散点图，用于数据分布与相关性分析",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      data: [[10, 8.04], [8, 6.95], [13, 7.58], [9, 8.81], [11, 8.33], [14, 9.96], [6, 7.24], [4, 4.26], [12, 10.84], [7, 4.82]],
      symbolSize: 10,
      seriesName: "散点",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/ScatterChartRenderer").then(m => ({ default: m.ScatterChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容", placeholder: "[[x,y],...]" },
      { key: "symbolSize", label: "点大小", type: "number", min: 1, group: "样式" },
      { key: "seriesName", label: "系列名", type: "text", group: "内容" },
      { key: "showTitle", label: "显示标题", type: "toggle", group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 雷达图 ───
  componentRegistry.register({
    type: "echart-radar",
    name: "雷达图",
    icon: "radar",
    description: "ECharts 雷达图，多维度指标对比",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 350, height: 300 },
    defaultConfig: {
      theme: "dark",
      indicator: [
        { name: "Sales", max: 100 }, { name: "Admin", max: 100 },
        { name: "Tech", max: 100 }, { name: "Support", max: 100 },
        { name: "Dev", max: 100 }, { name: "Marketing", max: 100 },
      ],
      seriesData: [
        { value: [80, 70, 90, 60, 85, 75], name: "预算" },
        { value: [60, 80, 65, 90, 70, 85], name: "实际" },
      ],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/RadarChartRenderer").then(m => ({ default: m.RadarChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "indicator", label: "指标", type: "json", group: "内容", placeholder: '[{"name":"指标","max":100}]' },
      { key: "seriesData", label: "数据", type: "json", group: "内容", placeholder: '[{"value":[...],"name":"..."}]' },
      { key: "showTitle", label: "显示标题", type: "toggle", group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 仪表盘分组：5个独立组件 ───

  // 1. 基础仪表盘 — 通用数值展示
  componentRegistry.register({
    type: "echart-gauge-basic",
    name: "基础仪表盘",
    icon: "speed",
    description: "通用仪表盘，支持自定义范围、单位、颜色",
    category: "gauge",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 250, height: 220 },
    defaultConfig: {
      theme: "dark",
      gaugeStyle: "modern",
      value: 68,
      valuePrecision: 0,
      alarmColor: true,
      refreshInterval: 5000,
      min: 0,
      max: 100,
      unit: "",
      gaugeName: "",
      splitNumber: 10,
      showPointer: true,
      showProgress: true,
      progressWidth: 18,
      pointerWidth: 4,
      startAngle: 220,
      endAngle: -40,
      dataSourceId: "",
      dataMode: "static",
      dataField: "",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/GaugeChartRenderer").then(m => ({ default: m.GaugeChartRenderer }))),
    events: [{ id: "click", name: "点击" }, { id: "valueChanged", name: "值变化" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "dataSourceId", label: "数据源", type: "datasource", group: "数据源" },
      { key: "dataMode", label: "数据模式", type: "select", group: "数据源",
        options: [{ label: "静态数据", value: "static" }, { label: "实时数据", value: "realtime" }] },
      { key: "dataField", label: "数据字段", type: "datafield", group: "数据源", hidden: (c) => c.dataMode !== "realtime" || !c.dataSourceId },
      { key: "value", label: "当前值", type: "number", group: "数据", hidden: (c) => c.dataMode === "realtime" },
      { key: "min", label: "最小值", type: "number", group: "数据" },
      { key: "max", label: "最大值", type: "number", group: "数据" },
      { key: "unit", label: "单位", type: "text", group: "数据", placeholder: "如: °C, %, m/s" },
      { key: "gaugeName", label: "仪表名称", type: "text", group: "数据" },
      { key: "splitNumber", label: "分割段数", type: "number", min: 1, max: 20, group: "样式" },
      { key: "showPointer", label: "显示指针", type: "toggle", group: "样式" },
      { key: "showProgress", label: "显示进度条", type: "toggle", group: "样式" },
      { key: "progressWidth", label: "进度条宽度", type: "number", min: 4, max: 40, group: "样式" },
      { key: "pointerWidth", label: "指针宽度", type: "number", min: 1, max: 10, group: "样式" },
      { key: "startAngle", label: "起始角度", type: "number", group: "样式" },
      { key: "endAngle", label: "结束角度", type: "number", group: "样式" },
      { key: "gaugeStyle", label: "风格", type: "select", group: "样式", options: [{ label: "工业风", value: "industrial" }, { label: "现代风", value: "modern" }] },
      { key: "valuePrecision", label: "小数位数", type: "number", min: 0, max: 3, group: "数据" },
      { key: "alarmColor", label: "超限变色", type: "toggle", group: "样式" },
      { key: "refreshInterval", label: "刷新间隔(ms)", type: "number", min: 1000, group: "数据源", hidden: (c) => c.dataMode !== "realtime" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
    ],
  });

  // 2. 三色分段仪表盘 — 工业风格（绿→蓝→红）
  componentRegistry.register({
    type: "echart-gauge-industrial",
    name: "三色仪表盘",
    icon: "speed",
    description: "工业风格仪表盘，绿→蓝→红三色分段，带发光效果",
    category: "gauge",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 250, height: 220 },
    defaultConfig: {
      theme: "dark",
      gaugeStyle: "industrial",
      value: 35,
      valuePrecision: 0,
      alarmColor: true,
      refreshInterval: 5000,
      min: 0,
      max: 100,
      unit: "%",
      gaugeName: "粉尘浓度",
      splitNumber: 10,
      showPointer: true,
      pointerWidth: 2,
      startAngle: 220,
      endAngle: -40,
      dataSourceId: "",
      dataMode: "static",
      dataField: "",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/GaugeChartRenderer").then(m => ({ default: m.GaugeChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "dataSourceId", label: "数据源", type: "datasource", group: "数据源" },
      { key: "dataMode", label: "数据模式", type: "select", group: "数据源",
        options: [{ label: "静态数据", value: "static" }, { label: "实时数据", value: "realtime" }] },
      { key: "dataField", label: "数据字段", type: "datafield", group: "数据源", hidden: (c) => c.dataMode !== "realtime" || !c.dataSourceId },
      { key: "value", label: "当前值", type: "number", group: "数据", hidden: (c) => c.dataMode === "realtime" },
      { key: "min", label: "最小值", type: "number", group: "数据" },
      { key: "max", label: "最大值", type: "number", group: "数据" },
      { key: "unit", label: "单位", type: "text", group: "数据" },
      { key: "gaugeName", label: "仪表名称", type: "text", group: "数据" },
      { key: "splitNumber", label: "分割段数", type: "number", min: 1, max: 20, group: "样式" },
      { key: "showPointer", label: "显示指针", type: "toggle", group: "样式" },
      { key: "pointerWidth", label: "指针宽度", type: "number", min: 1, max: 10, group: "样式" },
      { key: "startAngle", label: "起始角度", type: "number", group: "样式" },
      { key: "endAngle", label: "结束角度", type: "number", group: "样式" },
      { key: "gaugeStyle", label: "风格", type: "select", group: "样式", options: [{ label: "工业风", value: "industrial" }, { label: "现代风", value: "modern" }] },
      { key: "valuePrecision", label: "小数位数", type: "number", min: 0, max: 3, group: "数据" },
      { key: "alarmColor", label: "超限变色", type: "toggle", group: "样式" },
      { key: "refreshInterval", label: "刷新间隔(ms)", type: "number", min: 1000, group: "数据源", hidden: (c) => c.dataMode !== "realtime" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
    ],
  });

  // 3. 传感器仪表盘 — 预设传感器参数
  componentRegistry.register({
    type: "echart-gauge-sensor",
    name: "传感器仪表盘",
    icon: "sensors",
    description: "预设传感器参数（风速/风压/CO/CH4/温度/粉尘/流量），一键切换",
    category: "gauge",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 180 },
    defaultConfig: {
      theme: "dark",
      gaugeStyle: "industrial",
      value: 0,
      sensorPreset: "windSpeed",
      valuePrecision: 1,
      alarmColor: true,
      refreshInterval: 5000,
      splitNumber: 10,
      showPointer: true,
      pointerWidth: 2,
      startAngle: 220,
      endAngle: -40,
      dataSourceId: "",
      dataMode: "static",
      dataField: "",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/GaugeChartRenderer").then(m => ({ default: m.GaugeChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "dataSourceId", label: "数据源", type: "datasource", group: "数据源" },
      { key: "dataMode", label: "数据模式", type: "select", group: "数据源",
        options: [{ label: "静态数据", value: "static" }, { label: "实时数据", value: "realtime" }] },
      { key: "dataField", label: "数据字段", type: "datafield", group: "数据源", hidden: (c) => c.dataMode !== "realtime" || !c.dataSourceId },
      { key: "sensorPreset", label: "传感器类型", type: "select", group: "数据", options: [
        { label: "风速 (0.4~15 m/s)", value: "windSpeed" },
        { label: "风压 (30~110 Pa)", value: "windPressure" },
        { label: "CO (0~100 ppm)", value: "co" },
        { label: "CH4 (0~999 ppm)", value: "ch4" },
        { label: "温度 (0~100 °C)", value: "temperature" },
        { label: "粉尘 (0~10 mg/m³)", value: "dust" },
        { label: "流量 (0~100 m³/h)", value: "flowRate" },
      ] },
      { key: "value", label: "当前值", type: "number", group: "数据", hidden: (c) => c.dataMode === "realtime" },
      { key: "splitNumber", label: "分割段数", type: "number", min: 1, max: 20, group: "样式" },
      { key: "showPointer", label: "显示指针", type: "toggle", group: "样式" },
      { key: "pointerWidth", label: "指针宽度", type: "number", min: 1, max: 10, group: "样式" },
      { key: "gaugeStyle", label: "风格", type: "select", group: "样式", options: [{ label: "工业风", value: "industrial" }, { label: "现代风", value: "modern" }] },
      { key: "valuePrecision", label: "小数位数", type: "number", min: 0, max: 3, group: "数据" },
      { key: "alarmColor", label: "超限变色", type: "toggle", group: "样式" },
      { key: "refreshInterval", label: "刷新间隔(ms)", type: "number", min: 1000, group: "数据源", hidden: (c) => c.dataMode !== "realtime" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
    ],
  });

  // 4. 进度条仪表盘 — 现代风格，渐变进度
  componentRegistry.register({
    type: "echart-gauge-progress",
    name: "进度条仪表盘",
    icon: "data_usage",
    description: "现代风格仪表盘，渐变色进度条，适合百分比展示",
    category: "gauge",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 250, height: 250 },
    defaultConfig: {
      theme: "dark",
      gaugeStyle: "modern",
      value: 75,
      valuePrecision: 0,
      alarmColor: true,
      refreshInterval: 5000,
      min: 0,
      max: 100,
      unit: "%",
      gaugeName: "完成率",
      showPointer: false,
      showProgress: true,
      progressWidth: 20,
      splitNumber: 10,
      startAngle: 220,
      endAngle: -40,
      dataSourceId: "",
      dataMode: "static",
      dataField: "",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/GaugeChartRenderer").then(m => ({ default: m.GaugeChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "dataSourceId", label: "数据源", type: "datasource", group: "数据源" },
      { key: "dataMode", label: "数据模式", type: "select", group: "数据源",
        options: [{ label: "静态数据", value: "static" }, { label: "实时数据", value: "realtime" }] },
      { key: "dataField", label: "数据字段", type: "datafield", group: "数据源", hidden: (c) => c.dataMode !== "realtime" || !c.dataSourceId },
      { key: "value", label: "当前值", type: "number", group: "数据", hidden: (c) => c.dataMode === "realtime" },
      { key: "min", label: "最小值", type: "number", group: "数据" },
      { key: "max", label: "最大值", type: "number", group: "数据" },
      { key: "unit", label: "单位", type: "text", group: "数据" },
      { key: "gaugeName", label: "仪表名称", type: "text", group: "数据" },
      { key: "progressWidth", label: "进度条宽度", type: "number", min: 4, max: 40, group: "样式" },
      { key: "showPointer", label: "显示指针", type: "toggle", group: "样式" },
      { key: "splitNumber", label: "分割段数", type: "number", min: 1, max: 20, group: "样式" },
      { key: "startAngle", label: "起始角度", type: "number", group: "样式" },
      { key: "endAngle", label: "结束角度", type: "number", group: "样式" },
      { key: "gaugeStyle", label: "风格", type: "select", group: "样式", options: [{ label: "工业风", value: "industrial" }, { label: "现代风", value: "modern" }] },
      { key: "valuePrecision", label: "小数位数", type: "number", min: 0, max: 3, group: "数据" },
      { key: "alarmColor", label: "超限变色", type: "toggle", group: "样式" },
      { key: "refreshInterval", label: "刷新间隔(ms)", type: "number", min: 1000, group: "数据源", hidden: (c) => c.dataMode !== "realtime" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
    ],
  });

  // 5. 百分比仪表盘 — 半圆，纯百分比展示
  componentRegistry.register({
    type: "echart-gauge-percent",
    name: "百分比仪表盘",
    icon: "percent",
    description: "半圆仪表盘，0-100% 百分比展示，简洁风格",
    category: "gauge",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 140 },
    defaultConfig: {
      theme: "dark",
      gaugeStyle: "modern",
      value: 60,
      valuePrecision: 0,
      alarmColor: true,
      refreshInterval: 5000,
      min: 0,
      max: 100,
      unit: "%",
      gaugeName: "",
      showPointer: true,
      showProgress: true,
      progressWidth: 15,
      pointerWidth: 3,
      splitNumber: 5,
      startAngle: 180,
      endAngle: 0,
      center: ["50%", "72%"],
      dataSourceId: "",
      dataMode: "static",
      dataField: "",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/GaugeChartRenderer").then(m => ({ default: m.GaugeChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "dataSourceId", label: "数据源", type: "datasource", group: "数据源" },
      { key: "dataMode", label: "数据模式", type: "select", group: "数据源",
        options: [{ label: "静态数据", value: "static" }, { label: "实时数据", value: "realtime" }] },
      { key: "dataField", label: "数据字段", type: "datafield", group: "数据源", hidden: (c) => c.dataMode !== "realtime" || !c.dataSourceId },
      { key: "value", label: "当前值", type: "number", group: "数据", hidden: (c) => c.dataMode === "realtime" },
      { key: "gaugeName", label: "仪表名称", type: "text", group: "数据" },
      { key: "progressWidth", label: "进度条宽度", type: "number", min: 4, max: 40, group: "样式" },
      { key: "showPointer", label: "显示指针", type: "toggle", group: "样式" },
      { key: "pointerWidth", label: "指针宽度", type: "number", min: 1, max: 10, group: "样式" },
      { key: "splitNumber", label: "分割段数", type: "number", min: 1, max: 20, group: "样式" },
      { key: "gaugeStyle", label: "风格", type: "select", group: "样式", options: [{ label: "工业风", value: "industrial" }, { label: "现代风", value: "modern" }] },
      { key: "valuePrecision", label: "小数位数", type: "number", min: 0, max: 3, group: "数据" },
      { key: "alarmColor", label: "超限变色", type: "toggle", group: "样式" },
      { key: "refreshInterval", label: "刷新间隔(ms)", type: "number", min: 1000, group: "数据源", hidden: (c) => c.dataMode !== "realtime" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
    ],
  });

  // ─── 工业监控分组 ───

  // 1. 状态指示灯
  componentRegistry.register({
    type: "industrial-status-light",
    name: "状态指示灯",
    icon: "circle",
    description: "呼吸灯状态指示（绿正常/红异常/灰未装），对标 sprayv2 breathe 效果",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 80, height: 80 },
    defaultConfig: {
      label: "",
      statusMode: "static",
      staticStatus: "normal",
      normalColor: "#22c55e",
      alarmColor: "#ef4444",
      offlineColor: "#6b7280",
      alarmThreshold: 1,
      dataSourceId: "",
      dataField: "",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/StatusIndicatorRenderer").then(m => ({ default: m.StatusIndicatorRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "label", label: "标签文字", type: "text", group: "基础", placeholder: "如：烟雾" },
      { key: "statusMode", label: "状态模式", type: "select", group: "数据源",
        options: [{ label: "静态", value: "static" }, { label: "数据源", value: "datasource" }] },
      { key: "dataSourceId", label: "数据源", type: "datasource", group: "数据源", hidden: (c) => c.statusMode !== "datasource" },
      { key: "dataField", label: "数据字段", type: "datafield", group: "数据源", hidden: (c) => c.statusMode !== "datasource" || !c.dataSourceId },
      { key: "staticStatus", label: "静态状态", type: "select", group: "数据源", hidden: (c) => c.statusMode !== "static",
        options: [{ label: "正常（绿）", value: "normal" }, { label: "异常（红）", value: "alarm" }, { label: "未装（灰）", value: "offline" }] },
      { key: "alarmThreshold", label: "告警阈值", type: "number", group: "数据源", hidden: (c) => c.statusMode !== "datasource", placeholder: ">=此值为异常" },
      { key: "normalColor", label: "正常颜色", type: "color", group: "样式" },
      { key: "alarmColor", label: "异常颜色", type: "color", group: "样式" },
      { key: "offlineColor", label: "未装颜色", type: "color", group: "样式" },
    ],
  });

  // 2b. 场景统计聚合卡片（从 deviceStore 聚合实时数据，替代硬编码假数据的 industrial-data-card）
  componentRegistry.register({
    type: "industrial-stats-card",
    name: "场景统计卡片",
    icon: "analytics",
    description: "从 deviceStore 聚合实时设备数据的统计卡片（在线数/告警数/流量等）",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 60 },
    defaultConfig: {
      statType: "online_devices",
      cardName: "在线设备",
      iconType: "online",
      unit: "台",
      color: "#4caf50",
      theme: "dark",
      precision: 2,
      noDataPlaceholder: "—",
      selectedDeviceIds: [],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/IndustrialStatsCardRenderer").then(m => ({ default: m.IndustrialStatsCardRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "statType", label: "聚合类型", type: "select", group: "数据源", options: [
        { label: "在线设备", value: "online_devices" },
        { label: "喷雾总数(无)", value: "spray_count" },
        { label: "告警数", value: "alarm_count" },
        { label: "今日用水", value: "water_usage_today" },
        { label: "主管压力(无)", value: "main_pressure" },
        { label: "瞬时流量", value: "instant_flow" },
        { label: "总管流量(旧)", value: "total_flow" },
        { label: "集控器在线", value: "main_controllers_online" },
        { label: "运行中(喷洒)", value: "running_count" },
        { label: "故障", value: "fault_count" },
        { label: "通信率", value: "comm_rate" },
        { label: "昨日喷雾(无)", value: "spray_count_yesterday" },
        { label: "累计用水", value: "water_usage_total" },
        { label: "运行时长(无)", value: "running_hours" },
        { label: "节能率(无)", value: "energy_saving_rate" },
      ] },
      { key: "cardName", label: "卡片名称", type: "text", group: "基础" },
      { key: "iconType", label: "图标", type: "select", group: "基础", options: [
        { label: "温度 🌡", value: "temperature" }, { label: "烟雾 💨", value: "smoke" },
        { label: "红外 📡", value: "infrared" }, { label: "触控 ✋", value: "touch" },
        { label: "粉尘 🌫", value: "dust" }, { label: "在线 📶", value: "online" },
        { label: "集控器 🖥", value: "controller" }, { label: "运行 ⚡", value: "running" },
        { label: "故障 ⚠", value: "fault" }, { label: "信号 📶", value: "signal" },
        { label: "喷雾 💧", value: "spray" }, { label: "告警 🔔", value: "alarm" },
        { label: "水 🌊", value: "water" }, { label: "压力 ⏲", value: "pressure" },
        { label: "流量 〰", value: "flow" }, { label: "能效 ⚡", value: "energy" },
        { label: "时间 ⏰", value: "time" }, { label: "自定义 📊", value: "custom" },
      ] },
      { key: "unit", label: "单位", type: "text", group: "基础", placeholder: "如: 台, %, m³" },
      { key: "color", label: "颜色", type: "color", group: "样式" },
      { key: "theme", label: "主题", type: "select", group: "样式", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }] },
      { key: "precision", label: "小数位数", type: "number", group: "数据源", min: 0, max: 4 },
      // ━━━ 设备绑定（仅对设备域 statType 生效：瞬时流量/今日用水/累计用水） ━━━
      { key: "selectedDeviceIds", label: "绑定集控器（留空=不显示）", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18", "FY002-MainController"] },
        hidden: (c) => !["total_flow", "instant_flow", "water_usage_today", "water_usage_total"].includes(String(c.statType)),
        help: "仅对 瞬时流量/今日用水/累计用水 生效：留空 = 显示 —；勾选集控器后，仅聚合所选集控器子树内的流量计（虚拟流量计挂集控器下，自动覆盖）",
      },
      { key: "showProgress", label: "显示进度条", type: "toggle", group: "样式" },
      { key: "progressValue", label: "进度值", type: "number", group: "样式", min: 0, max: 100, hidden: (c) => !c.showProgress },
    ],
  });

  // 2c. 粉尘浓度趋势图（从 deviceStore 订阅粉尘传感器实时值）
  componentRegistry.register({
    type: "industrial-dust-trend",
    name: "粉尘浓度趋势",
    icon: "show_chart",
    description: "深度绑定粉尘传感器的趋势图，支持层级发现、画像集成、告警阈值线，GreptimeDB 历史数据接入",
    category: "industrial",
    version: "3.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 600, height: 400 },
    defaultConfig: {
      title: "粉尘浓度趋势",
      smooth: true,
      areaStyle: true,
      showDataZoom: true,
      yAxisName: "mg/m³",
      selectedDeviceIds: [],
      showSensorPortraits: true,
      valuePrecision: 2,
      warningRatio: 0.8,
      historyEnabled: true,
      historyRange: "1h",
      historyAgg: "auto",
      historyAutoRefresh: true,
      yAxisMin: null,
      yAxisMax: null,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/DustTrendRenderer").then(m => ({ default: m.DustTrendRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "selectedDeviceIds", label: "绑定集控器", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18", "FY002-MainController"] },
      },
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "_dataSourceInfo", label: "数据源连接", type: "dataSourceInfo", group: "数据源" },
      { key: "historyEnabled", label: "接入历史数据", type: "toggle", group: "数据源", help: "开启后从 GreptimeDB 加载历史数据，与实时数据合并显示" },
      { key: "historyRange", label: "历史时间范围", type: "select", group: "数据源", options: [{ value: "30m", label: "最近30分钟" }, { value: "1h", label: "最近1小时" }, { value: "6h", label: "最近6小时" }, { value: "24h", label: "最近24小时" }, { value: "7d", label: "最近7天" }], help: "加载的历史数据时间窗口（从 GreptimeDB 查询）" },
      { key: "historyAgg", label: "数据精度", type: "select", group: "数据源",
        options: [
          { value: "auto", label: "自动（推荐）" },
          { value: "none", label: "原始数据" },
          { value: "5m", label: "5分钟均值" },
          { value: "1h", label: "1小时均值" },
        ],
        help: "自动模式根据时间范围选择最佳聚合策略（30m/1h=原始，6h=5分钟，24h/7d=1小时）" },
      { key: "historyAutoRefresh", label: "自动刷新历史", type: "toggle", group: "数据源", help: "每5分钟自动重新加载历史数据" },
      { key: "showSensorPortraits", label: "传感器画像", type: "toggle", group: "显示" },
      { key: "valuePrecision", label: "小数位数", type: "number", group: "数据源", min: 0, max: 4 },
      { key: "warningRatio", label: "预警比例", type: "number", group: "数据源", min: 0.5, max: 0.99, step: 0.05,
        help: "浓度达到报警阈值的此比例时显示预警线（如0.8=80%）" },
      { key: "yAxisMin", label: "Y轴最小值", type: "number", group: "轴",
        help: "留空则自适应" },
      { key: "yAxisMax", label: "Y轴最大值", type: "number", group: "轴",
        help: "留空则自适应" },
      { key: "smooth", label: "平滑曲线", type: "toggle", group: "样式" },
      { key: "areaStyle", label: "面积填充", type: "toggle", group: "样式" },
      { key: "showDataZoom", label: "数据缩放", type: "toggle", group: "样式" },
      { key: "yAxisName", label: "Y轴名称", type: "text", group: "轴" },
    ],
  });

  // 2c-2. 煤机位置趋势曲线（综采工作面，复用 DustTrend 的 deviceStore 实时 + GreptimeDB 历史模式）
  // 数据来源：edge-conductor 把 0x061e 的 coalMachine.coalPosition 落库到 sensor_samples(sensor_type="coalMachine.coalPosition")。
  componentRegistry.register({
    type: "industrial-shearer-curve",
    name: "煤机位置曲线",
    icon: "show_chart",
    description: "综采煤机位置趋势曲线，订阅集控器 coalMachine.coalPosition 实时值 + GreptimeDB 历史，等价于老项目 showzc 的煤机曲线",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 900, height: 170 },
    defaultConfig: {
      title: "煤机位置曲线",
      smooth: true,
      showArea: true,
      showDataZoom: true,
      yAxisName: "位置(号)",
      selectedDeviceIds: [],
      valuePrecision: 0,
      historyEnabled: true,
      historyRange: "6h",
      historyAgg: "auto",
      historyAutoRefresh: true,
      yAxisMin: null,
      yAxisMax: null,
      showLegend: true,
      showDirection: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/ShearerPositionCurveRenderer").then(m => ({ default: m.ShearerPositionCurveRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "selectedDeviceIds", label: "绑定集控器", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18", "FY002-MainController"] },
        help: "留空=不显示，需选择集控器（绑定后自动发现其下属分控器/传感器）" },
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "_dataSourceInfo", label: "数据源连接", type: "dataSourceInfo", group: "数据源" },
      { key: "historyEnabled", label: "接入历史数据", type: "toggle", group: "数据源", help: "开启后从 GreptimeDB 加载历史数据，与实时数据合并显示" },
      { key: "historyRange", label: "历史时间范围", type: "select", group: "数据源", options: [{ value: "30m", label: "最近30分钟" }, { value: "1h", label: "最近1小时" }, { value: "6h", label: "最近6小时" }, { value: "24h", label: "最近24小时" }, { value: "7d", label: "最近7天" }], help: "加载的历史数据时间窗口（从 GreptimeDB 查询）" },
      { key: "historyAgg", label: "数据精度", type: "select", group: "数据源",
        options: [
          { value: "auto", label: "自动（推荐）" },
          { value: "none", label: "原始数据" },
          { value: "5m", label: "5分钟均值" },
          { value: "1h", label: "1小时均值" },
        ],
        help: "自动模式根据时间范围选择最佳聚合策略（30m/1h=原始，6h=5分钟，24h/7d=1小时）" },
      { key: "historyAutoRefresh", label: "自动刷新历史", type: "toggle", group: "数据源", help: "每5分钟自动重新加载历史数据" },
      { key: "valuePrecision", label: "小数位数", type: "number", group: "数据源", min: 0, max: 4 },
      { key: "yAxisMin", label: "Y轴最小值", type: "number", group: "轴", help: "留空则自适应" },
      { key: "yAxisMax", label: "Y轴最大值", type: "number", group: "轴", help: "留空则自适应" },
      { key: "smooth", label: "平滑曲线", type: "toggle", group: "样式" },
      { key: "showArea", label: "面积填充", type: "toggle", group: "样式" },
      { key: "showDataZoom", label: "数据缩放", type: "toggle", group: "样式" },
      { key: "showLegend", label: "显示图例", type: "toggle", group: "样式",
        help: "绑定多台集控器时用于区分各条曲线（图例显示集控器 ID）" },
      { key: "showDirection", label: "显示运行方向", type: "toggle", group: "样式",
        help: "标题栏显示煤机运行方向（上行/下行，来自 0x061e motionDirection）" },
      { key: "yAxisName", label: "Y轴名称", type: "text", group: "轴" },
    ],
  });

  // 2c-3. 综采工作面支架状态表（对标 sprayv2/showzc 的"工作面状态" + "支架状态表"）
  // 数据来源：绑定集控器子树内各分控器的 0x061e batteryWarning 位域
  //   （低字节 bit0 割煤机位置 / bit1 移架 / bit2 落架 / bit3 放顶煤，OR 聚合）
  //   + 该集控器子树下的各报警传感器设备（-Alarm-*）触发/电池状态；复用 deviceStatus.parseAlarmBitField。
  // 设备发现：严格绑定（selectedDeviceIds 留空=不显示，需选择综采集控器）。
  componentRegistry.register({
    type: "industrial-support-status",
    name: "支架状态表",
    icon: "table_chart",
    description: "综采工作面支架状态表：聚合显示煤机位置/移架/落架/放顶煤状态，并列出各支架报警传感器的触发/电池状态",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 900, height: 360 },
    defaultConfig: {
      title: "支架状态表",
      selectedDeviceIds: [],
      showAggregates: true,
      showBattery: true,
      accentColor: "#5A9ED6",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/SupportStatusRenderer").then((m) => ({ default: m.SupportStatusRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "selectedDeviceIds", label: "绑定集控器", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18", "FY002-MainController"] },
        help: "留空=不显示，需选择集控器（绑定后自动发现其下属分控器/传感器）" },
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "showAggregates", label: "显示聚合状态灯", type: "toggle", group: "样式",
        help: "标题下方的四个状态灯（割煤机位置/移架/落架/放顶煤，来自分控器 batteryWarning 位域）" },
      { key: "showBattery", label: "显示电池列", type: "toggle", group: "样式" },
      { key: "accentColor", label: "主题色", type: "color", group: "样式" },
    ],
  });

  // 2d. 粉尘浓度预警报警面板（从 deviceStore 订阅粉尘传感器实时值，三级预警/报警）
  componentRegistry.register({
    type: "industrial-dust-alarm-panel",
    name: "粉尘预警报警面板",
    icon: "warning_amber",
    description: "粉尘浓度预警报警面板，支持三级状态（正常/预警/报警）、浓度占比条、4K大屏自适应",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 910, height: 380 },
    defaultConfig: {
      title: "粉尘浓度预警报警",
      selectedDeviceIds: [],
      warningRatio: 0.8,
      valuePrecision: 2,
      theme: "dark",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/DustAlarmPanelRenderer").then(m => ({ default: m.DustAlarmPanelRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "selectedDeviceIds", label: "绑定集控器", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18", "FY002-MainController"] },
      },
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "warningRatio", label: "预警比例", type: "number", group: "数据源", min: 0.5, max: 0.99, step: 0.05,
        help: "浓度达到报警阈值的此比例时触发预警（如0.8=80%）" },
      { key: "valuePrecision", label: "小数位数", type: "number", group: "数据源", min: 0, max: 4 },
      { key: "theme", label: "主题", type: "select", group: "样式", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }] },
    ],
  });

  // 4. 滚动状态表格
  // 专门针对边缘计算（http 类型数据源）做的适配：属性栏
  //   数据源  → 只列 http 类型数据源
  //   设备勾选 → 调 GET /api/devices/ 拿到全量设备 + 产品元数据，用户手勾选
  //   列字段映射 → 键(表头) + 值(设备字段) 的键值对，自由组合
  // 渲染器：直接消费 deviceStore 里的设备实时状态，不再依赖 dataField
  componentRegistry.register({
    type: "industrial-scrolling-table",
    name: "滚动状态表格",
    icon: "table_rows",
    description: "边缘计算驱动的设备滚动状态表格，从 deviceStore 实时取数据，支持设备勾选 + 键值对字段映射",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 200 },
    defaultConfig: {
      scrollSpeed: 30,
      scrollDirection: "vertical",
      maxRows: 20,
      // 列从勾选设备的 metadata.realtime 字段动态生成（无需手动配置）
      headerBgColor: "#1a3a6e",
      rowBgColor: "rgba(79,195,247,0.08)",
      textColor: "#ffffff",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/ScrollingTableRenderer").then(m => ({ default: m.ScrollingTableRenderer }))),
    events: [{ id: "click", name: "点击" }, { id: "rowClick", name: "行点击" }],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      // ── 数据源 ──
      // 该组件固定使用"边缘计算"（http 类型）数据源，无需用户在属性栏选择
      // Renderer / DeviceMultiSelectField 会自动从 useDataSourceStore 找第一个 http 类型数据源
      // 这里留一个 readonly 标签供 UI 提示
      {
        key: "__edgeComputingLabel",
        label: "数据源",
        type: "text",
        group: "数据源",
        defaultValue: "边缘计算（自动）",
        // 标记为只读 — EditorPropertyPanel 的 text case 会识别这个 readonly
        readOnly: true,
        // 不持久化（__ 开头）
        // _persist: false,
      },
      {
        key: "selectedDeviceIds",
        label: "勾选要显示的设备",
        type: "deviceMultiSelect",
        group: "数据源",
        // 设备列表由 Renderer/DeviceMultiSelectField 自动从边缘计算数据源拉取
        // 用户在表格里勾选要展示的设备
      },
      {
        key: "productCodeFilter",
        label: "产品码过滤（可选，逗号分隔）",
        type: "text",
        group: "数据源",
        placeholder: "留空=全部, 例: 18001,18007",
      },
      {
        key: "deviceScope",
        label: "设备范围",
        type: "select",
        group: "数据源",
        options: [
          { label: "绑定设备（留空=不显示）", value: "bound" },
          { label: "全部设备（忽略绑定）", value: "all" },
        ],
        defaultValue: "bound",
        help: "默认「绑定设备」：严格按上面勾选的设备显示。选「全部设备」则覆盖设备表中所有设备，适合全局监控大屏。",
      },
      {
        key: "maxRows",
        label: "最大行数",
        type: "number",
        min: 1, max: 100,
        group: "数据源",
        defaultValue: 20,
      },

      // ── 表格（字段映射：valueOptions 从 API 返回的设备 metadata 动态获取） ──
      // 用户在"勾选设备"中选择设备后，此处的字段下拉会自动列出
      // 该设备的 metadata + realtime 字段，无需硬编码
      {
        key: "columnMappings",
        label: "列字段映射（键=表头, 值=设备字段）",
        type: "keyValueMapping",
        group: "表格",
        keyLabel: "表头",
        valueLabel: "设备字段",
        help: "字段列表从勾选设备的 API 返回数据动态生成",
      },

      // ── 滚动 ──
      { key: "scrollSpeed", label: "滚动速度(px/s)", type: "number", min: 10, max: 200, group: "滚动", defaultValue: 30 },
      {
        key: "scrollDirection", label: "滚动方向", type: "select", group: "滚动", defaultValue: "vertical",
        options: [
          { label: "垂直", value: "vertical" },
          { label: "水平", value: "horizontal" },
        ],
      },

      // ── 样式 ──
      { key: "headerBgColor", label: "表头底色", type: "color", group: "样式" },
      { key: "rowBgColor",    label: "行底色",   type: "color", group: "样式" },
      { key: "textColor",     label: "文字色",   type: "color", group: "样式" },
    ],
  });

  // 5. 喷雾控制工具栏
  componentRegistry.register({
    type: "industrial-spray-control-toolbar",
    name: "喷雾控制工具栏",
    icon: "settings",
    description: "喷雾系统控制操作按钮组（全选/强喷/强停/自动/参数设置），对标 sprayv2 map_tool_outbox",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // 操作型组件：预览/发布模式下也要支持点击+悬浮
    defaultSize: { width: 640, height: 280 },
    defaultConfig: {
      sceneMode: "tunnel", // tunnel | bridge | mining | scene5
      hasPermission: true,
      deviceCode: "",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/SprayControlToolbarRenderer").then(m => ({ default: m.SprayControlToolbarRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [
      { id: "selectAll", name: "全选" },
      { id: "selectNone", name: "全不选" },
      { id: "sprayStart", name: "强喷模式" },
      { id: "sprayStop", name: "强停模式" },
      { id: "autoMode", name: "自动模式" },
      { id: "getStatus", name: "获取状态" },
      { id: "settings", name: "参数设置" },
      { id: "loopStart", name: "开始循环" },
      { id: "loopStop", name: "结束循环" },
    ],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      // ━━━ 基础 ━━━
      { key: "sceneMode", label: "场景模式", type: "select", group: "基础",
        options: [
          { label: "巷道喷雾", value: "tunnel" },
          { label: "廊桥喷雾", value: "bridge" },
          { label: "综采喷雾", value: "mining" },
          { label: "循环喷雾", value: "cycle" },
        ],
        defaultValue: "tunnel",
        help: "不同场景对应不同的控制策略和按钮组合",
      },
      { key: "hasPermission", label: "有控制权限", type: "toggle", group: "基础", defaultValue: true },

      // ━━━ 设备绑定（协议：0614/0619/061b 命令均发给集控器） ━━━
      { key: "selectedDeviceIds", label: "绑定集控器（留空=不显示）", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18", "FY002-MainController"] },
        help: "留空 = 不显示任何设备；勾选集控器后，仅显示并下控所选集控器及其下属分控器/传感器。所有控制命令均通过集控器下发",
      },
      // 分控器选择集成到工具栏渲染器中（操作时临时决定，非组件配置）
      // 传感器喷雾参数通过属性面板动态渲染（协议0614，按实际发现传感器类型分组）
    ],
  });

  // 6. 视频播放器
  componentRegistry.register({
    type: "industrial-video-player",
    name: "视频播放器",
    icon: "videocam",
    description: "WebRTC/HTTP 视频流播放，支持全屏和截图，对标 sprayv2 视频监控",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      videoUrl: "",
      videoTitle: "视频监控",
      autoPlay: true,
      showControls: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/VideoPlayerRenderer").then(m => ({ default: m.VideoPlayerRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "videoTitle", label: "标题", type: "text", group: "基础", placeholder: "如：巷道入口监控" },
      { key: "videoUrl", label: "视频URL", type: "text", group: "视频源", placeholder: "http://xxx/stream 或 webrtc://xxx" },
      { key: "autoPlay", label: "自动播放", type: "toggle", group: "播放控制" },
      { key: "showControls", label: "显示控制按钮", type: "toggle", group: "播放控制" },
    ],
  });

  // 7. 定时列表卡片
  componentRegistry.register({
    type: "industrial-timing-card",
    name: "定时列表卡片",
    icon: "schedule",
    description: "绑定集控器，对其下属分控器进行定时喷雾设置（0x0620/0x0621），支持集控器全局时间设置（0x0617）",
    category: "industrial",
    version: "2.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // 操作型组件：预览/发布模式下也要支持点击+悬浮
    defaultSize: { width: 300, height: 360 },
    defaultConfig: {
      hasPermission: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/TimingCardRenderer").then(m => ({ default: m.TimingCardRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [
      { id: "fetchSubWorkTime", name: "获取分控器时间" },
      { id: "setSubWorkTime", name: "设置分控器时间" },
      { id: "setMainWorkTime", name: "设置集控器时间" },
    ],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      // ━━━ 基础 ━━━
      { key: "hasPermission", label: "有控制权限", type: "toggle", group: "基础", defaultValue: true },
      // ━━━ 设备绑定（协议：0620/0621 命令均发给集控器，position 指定分控器） ━━━
      { key: "selectedDeviceIds", label: "绑定集控器", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18"] },
        help: "选择集控器，对其下属分控器进行定时喷雾设置",
      },
    ],
  });

  // 9. 传感器网格
  componentRegistry.register({
    type: "industrial-sensor-grid",
    name: "传感器列表",
    icon: "grid_view",
    description: "API驱动的传感器列表，拖入画布后配置数据源即可自动渲染。自动从设备列表中过滤传感器，按频率型/报警型分组展示",
    category: "industrial",
    version: "2.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 600, height: 500 },
    defaultConfig: {
      title: "传感器列表",
      columns: 6,
      dataSourceId: "",
      dataField: "devices",
      showEmptySlots: false,
      accentColor: "#4fc3f7",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/SensorGridRenderer").then(m => ({ default: m.SensorGridRenderer }))),
    events: [{ id: "click", name: "点击" }, { id: "sensorClick", name: "传感器点击" }],
    actions: [],
    dataSchema: { sourceType: "api" },
    configSchema: [
      { key: "dataSourceId", label: "数据源", type: "datasource", group: "数据源" },
      { key: "dataField", label: "数据字段", type: "datafield", group: "数据源", hidden: (c) => !c.dataSourceId },
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "columns", label: "列数", type: "number", min: 3, max: 12, group: "布局" },
      { key: "showEmptySlots", label: "显示空槽位", type: "toggle", group: "布局" },
      { key: "accentColor", label: "主题色", type: "color", group: "样式" },
    ],
  });

  // 10. 传感器实时监控面板
  // 与 industrial-sensor-grid 区别：
  //   - sensor-grid 依赖 DataOrchestrator API 拉取（config.dataSourceId），非实时
  //   - sensor-monitor 直接订阅 deviceStore（WebSocket 推送），实时刷新
  //   - 通过 selectedDeviceIds 绑定集控器，自动发现下属传感器
  componentRegistry.register({
    type: "industrial-sensor-monitor",
    name: "传感器实时监控",
    icon: "sensors",
    description: "实时传感器监控面板（WebSocket 推送）。通过绑定集控器自动发现其下属分控器的所有传感器，按类型/父设备分组展示，含 sparkline 历史趋势和卡片展开详情",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // 操作型组件：预览/发布模式下也要支持点击+悬浮（hover Tooltip 弹卡详情）
    defaultSize: { width: 600, height: 500 },
    defaultConfig: {
      title: "传感器监控",
      selectedDeviceIds: [],
      columns: 4,
      accentColor: "#4fc3f7",
      showSparkline: true,
      groupBy: "type",
      showOffline: true,
      showFault: true,
      valuePrecision: 2,
      refreshInterval: 1,
      cardStyle: "compact",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/SensorMonitorRenderer").then(m => ({ default: m.SensorMonitorRenderer }))),
    events: [{ id: "click", name: "点击" }, { id: "sensorClick", name: "传感器点击" }],
    actions: [],
    dataSchema: { sourceType: "websocket" },
    configSchema: [
      // ─── 设备 ───
      { key: "selectedDeviceIds", label: "绑定集控器", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18"] },
        help: "选择要监控的集控器（支持多选），组件会自动发现其下属分控器的所有传感器",
      },
      { key: "deviceScope", label: "设备范围", type: "select", group: "设备",
        options: [
          { label: "绑定设备（留空=不显示）", value: "bound" },
          { label: "全部设备（忽略绑定）", value: "all" },
        ],
        help: "默认「绑定设备」：严格按上面勾选的集控器显示。选「全部设备」则监控设备表中所有集控器，适合全局监控大屏。",
      },
      // ─── 基础 ───
      { key: "title", label: "标题", type: "text", group: "基础" },
      // ─── 布局 ───
      { key: "columns", label: "列数", type: "number", min: 2, max: 12, group: "布局" },
      { key: "groupBy", label: "分组方式", type: "select", group: "布局",
        options: [
          { label: "按类型（频率/报警）", value: "type" },
          { label: "按父设备（分控器）", value: "parent" },
          { label: "不分组", value: "none" },
        ] },
      { key: "cardStyle", label: "卡片样式", type: "select", group: "布局",
        options: [
          { label: "紧凑（含画像+数值）", value: "compact" },
          { label: "仅数值（无画像）", value: "minimal" },
        ],
        help: "紧凑模式左侧显示传感器画像，极简模式仅显示数值",
      },
      { key: "showSparkline", label: "显示趋势线", type: "toggle", group: "布局" },
      // ─── 筛选 ───
      { key: "showOffline", label: "显示离线设备", type: "toggle", group: "筛选",
        help: "关闭后离线传感器不显示在面板中",
      },
      { key: "showFault", label: "显示故障设备", type: "toggle", group: "筛选",
        help: "关闭后通讯故障传感器不显示在面板中（仅隐藏不影响数据）",
      },
      // ─── 数据 ───
      { key: "valuePrecision", label: "数值精度", type: "number", min: 0, max: 4, group: "数据",
        help: "频率传感器数值的小数位数",
      },
      { key: "refreshInterval", label: "刷新间隔(秒)", type: "number", min: 1, max: 30, group: "数据",
        help: "UI 刷新频率（不影响 WebSocket 推送频率）",
      },
      // ─── 样式 ───
      { key: "accentColor", label: "主题色", type: "color", group: "样式" },
    ],
  });

  // 11. 设备拓扑树（集控器→分控器→传感器 卡片树 + 连线）
  componentRegistry.register({
    type: "industrial-device-tree",
    name: "设备拓扑树",
    icon: "account_tree",
    description: "以设备组件组动态渲染的画像，按 集控器→分控器→传感器 层级构成卡片树，并用连线表达从属关系。从设备表实时发现拓扑，不写死任何设备 ID",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: false,
    defaultSize: { width: 900, height: 600 },
    defaultConfig: {
      title: "设备拓扑",
      selectedDeviceIds: [],
      deviceScope: "all",
      accentColor: "#4fc3f7",
      showLabels: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/DeviceTreeRenderer").then(m => ({ default: m.DeviceTreeRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [],
    dataSchema: { sourceType: "websocket" },
    configSchema: [
      { key: "selectedDeviceIds", label: "绑定集控器", type: "deviceMultiSelect", group: "设备",
        deviceFilter: { productCode: ["18"] },
        help: "选择要展示的集控器（支持多选），组件会自动发现其下属分控器与传感器",
      },
      { key: "deviceScope", label: "设备范围", type: "select", group: "设备",
        options: [
          { label: "绑定设备（留空=不显示）", value: "bound" },
          { label: "全部设备（忽略绑定）", value: "all" },
        ],
        help: "默认「全部设备」：展示设备表中所有集控器及其下属设备，适合全局监控大屏。",
      },
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "showLabels", label: "显示名称标签", type: "toggle", group: "布局",
        help: "关闭后只显示设备画像，不显示名称/ID 标签",
      },
      { key: "accentColor", label: "主题色", type: "color", group: "样式",
        help: "卡片边框与连线的主题色",
      },
    ],
  });

  // ─── 热力图 ───
  componentRegistry.register({
    type: "echart-heatmap",
    name: "热力图",
    icon: "grid_on",
    description: "ECharts 热力图，数据密度与分布可视化",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      xAxisData: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      yAxisData: ["Morn", "Noon", "Eve", "Night"],
      data: [[0,0,50],[0,1,30],[0,2,70],[0,3,20],[1,0,60],[1,1,40],[1,2,80],[1,3,30],[2,0,55],[2,1,35],[2,2,65],[2,3,25],[3,0,45],[3,1,25],[3,2,75],[3,3,35],[4,0,50],[4,1,30],[4,2,60],[4,3,20],[5,0,70],[5,1,50],[5,2,85],[5,3,40],[6,0,40],[6,1,20],[6,2,55],[6,3,15]],
      min: 0,
      max: 100,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/HeatmapChartRenderer").then(m => ({ default: m.HeatmapChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "xAxisData", label: "X轴", type: "json", group: "内容" },
      { key: "yAxisData", label: "Y轴", type: "json", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容", placeholder: "[[x,y,val],...]" },
      { key: "min", label: "最小值", type: "number", group: "数据" },
      { key: "max", label: "最大值", type: "number", group: "数据" },
      { key: "showTitle", label: "显示标题", type: "toggle", group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 矩形树图 ───
  componentRegistry.register({
    type: "echart-treemap",
    name: "矩形树图",
    icon: "view_compact",
    description: "ECharts 矩形树图，层级数据占比可视化",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      data: [
        { name: "A", value: 40, children: [{ name: "A1", value: 20 }, { name: "A2", value: 20 }] },
        { name: "B", value: 30, children: [{ name: "B1", value: 15 }, { name: "B2", value: 15 }] },
        { name: "C", value: 20 },
        { name: "D", value: 10 },
      ],
      breadcrumb: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/TreemapChartRenderer").then(m => ({ default: m.TreemapChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容" },
      { key: "breadcrumb", label: "面包屑导航", type: "toggle", group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 旭日图 ───
  componentRegistry.register({
    type: "echart-sunburst",
    name: "旭日图",
    icon: "wb_sunny",
    description: "ECharts 旭日图，多层级数据径向可视化",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 350, height: 300 },
    defaultConfig: {
      theme: "dark",
      data: [
        { name: "A", value: 40, children: [{ name: "A1", value: 20 }, { name: "A2", value: 20 }] },
        { name: "B", value: 30, children: [{ name: "B1", value: 15 }, { name: "B2", value: 15 }] },
        { name: "C", value: 30, children: [{ name: "C1", value: 10 }, { name: "C2", value: 20 }] },
      ],
      radius: ["10%", "85%"],
      sort: "desc",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/SunburstChartRenderer").then(m => ({ default: m.SunburstChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容" },
      { key: "radius", label: "半径", type: "json", group: "样式" },
      { key: "sort", label: "排序", type: "select", options: [{ label: "降序", value: "desc" }, { label: "升序", value: "asc" }], group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 箱线图 ───
  componentRegistry.register({
    type: "echart-boxplot",
    name: "箱线图",
    icon: "candlestick_chart",
    description: "ECharts 箱线图，数据分布统计（五数概括法）",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      categories: ["A", "B", "C", "D", "E"],
      data: [[655,850,940,980,1070],[760,800,845,885,960],[620,750,810,870,950],[670,780,830,910,990],[730,850,920,960,1020]],
      outliers: [],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/BoxplotChartRenderer").then(m => ({ default: m.BoxplotChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "categories", label: "分类", type: "json", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容", placeholder: "[[min,Q1,median,Q3,max],...]" },
      { key: "outliers", label: "异常值", type: "json", group: "内容", placeholder: "[[x,y],...]" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── K线图 ───
  componentRegistry.register({
    type: "echart-candlestick",
    name: "K线图",
    icon: "trending_up",
    description: "ECharts K线图，股票/期货等金融数据",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 500, height: 350 },
    defaultConfig: {
      theme: "dark",
      xAxisData: ["2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07"],
      data: [[2320,2420,2280,2385],[2385,2450,2320,2400],[2400,2480,2350,2420],[2420,2460,2380,2405],[2405,2490,2390,2470],[2470,2520,2440,2490],[2490,2550,2460,2510]],
      showDataZoom: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/CandlestickChartRenderer").then(m => ({ default: m.CandlestickChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "xAxisData", label: "日期", type: "json", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容", placeholder: "[[open,close,low,high],...]" },
      { key: "showDataZoom", label: "数据缩放", type: "toggle", group: "交互" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 漏斗图 ───
  componentRegistry.register({
    type: "echart-funnel",
    name: "漏斗图",
    icon: "filter_alt",
    description: "ECharts 漏斗图，转化率/流程分析",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 350, height: 300 },
    defaultConfig: {
      theme: "dark",
      data: [
        { name: "展现", value: 100 }, { name: "点击", value: 80 },
        { name: "访问", value: 60 }, { name: "咨询", value: 40 }, { name: "成交", value: 20 },
      ],
      sort: "descending",
      orient: "vertical",
      funnelAlign: "center",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/FunnelChartRenderer").then(m => ({ default: m.FunnelChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容" },
      { key: "sort", label: "排序", type: "select", options: [{ label: "降序", value: "descending" }, { label: "升序", value: "ascending" }], group: "样式" },
      { key: "orient", label: "方向", type: "select", options: [{ label: "垂直", value: "vertical" }, { label: "水平", value: "horizontal" }], group: "样式" },
      { key: "funnelAlign", label: "对齐", type: "select", options: [{ label: "居中", value: "center" }, { label: "左", value: "left" }, { label: "右", value: "right" }], group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 桑基图 ───
  componentRegistry.register({
    type: "echart-sankey",
    name: "桑基图",
    icon: "account_tree",
    description: "ECharts 桑基图，能量/物料/资金流动分析",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 500, height: 300 },
    defaultConfig: {
      theme: "dark",
      nodes: [{ name: "a" },{ name: "b" },{ name: "c" },{ name: "d" },{ name: "e" }],
      links: [{ source: "a", target: "b", value: 5 },{ source: "a", target: "c", value: 3 },{ source: "b", target: "d", value: 4 },{ source: "c", target: "d", value: 2 },{ source: "c", target: "e", value: 1 },{ source: "b", target: "e", value: 1 }],
      orient: "horizontal",
      draggable: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/SankeyChartRenderer").then(m => ({ default: m.SankeyChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "nodes", label: "节点", type: "json", group: "内容" },
      { key: "links", label: "链接", type: "json", group: "内容" },
      { key: "orient", label: "方向", type: "select", options: [{ label: "水平", value: "horizontal" }, { label: "垂直", value: "vertical" }], group: "样式" },
      { key: "draggable", label: "可拖拽", type: "toggle", group: "交互" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 关系图 ───
  componentRegistry.register({
    type: "echart-graph",
    name: "关系图",
    icon: "hub",
    description: "ECharts 关系图，节点与边的网络拓扑",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 350 },
    defaultConfig: {
      theme: "dark",
      nodes: [
        { name: "Node 1", symbolSize: 40, category: 0 },
        { name: "Node 2", symbolSize: 30, category: 1 },
        { name: "Node 3", symbolSize: 30, category: 1 },
        { name: "Node 4", symbolSize: 25, category: 2 },
        { name: "Node 5", symbolSize: 25, category: 2 },
      ],
      links: [
        { source: "Node 1", target: "Node 2" }, { source: "Node 1", target: "Node 3" },
        { source: "Node 2", target: "Node 4" }, { source: "Node 3", target: "Node 5" },
        { source: "Node 4", target: "Node 5" },
      ],
      categories: [{ name: "核心" },{ name: "一级" },{ name: "二级" }],
      layout: "force",
      roam: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/GraphChartRenderer").then(m => ({ default: m.GraphChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "nodes", label: "节点", type: "json", group: "内容" },
      { key: "links", label: "边", type: "json", group: "内容" },
      { key: "categories", label: "分类", type: "json", group: "内容" },
      { key: "layout", label: "布局", type: "select", options: [{ label: "力导向", value: "force" }, { label: "环形", value: "circular" }, { label: "无", value: "none" }], group: "样式" },
      { key: "roam", label: "可漫游", type: "toggle", group: "交互" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 树图 ───
  componentRegistry.register({
    type: "echart-tree",
    name: "树图",
    icon: "device_hub",
    description: "ECharts 树图，层级结构可视化",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 500, height: 350 },
    defaultConfig: {
      theme: "dark",
      data: { name: "根", children: [{ name: "A", children: [{ name: "A1" },{ name: "A2" }] },{ name: "B", children: [{ name: "B1" },{ name: "B2" }] }] },
      orient: "LR",
      edgeShape: "curve",
      expandAndCollapse: true,
      initialTreeDepth: 2,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/TreeChartRenderer").then(m => ({ default: m.TreeChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容" },
      { key: "orient", label: "方向", type: "select", options: [{ label: "从左到右", value: "LR" }, { label: "从右到左", value: "RL" }, { label: "从上到下", value: "TB" }, { label: "从下到上", value: "BT" }], group: "样式" },
      { key: "edgeShape", label: "边形状", type: "select", options: [{ label: "曲线", value: "curve" }, { label: "折线", value: "polyline" }], group: "样式" },
      { key: "expandAndCollapse", label: "可折叠", type: "toggle", group: "交互" },
      { key: "initialTreeDepth", label: "初始展开深度", type: "number", min: 1, group: "交互" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 主题河流图 ───
  componentRegistry.register({
    type: "echart-themeriver",
    name: "主题河流图",
    icon: "waves",
    description: "ECharts 主题河流图，时序多主题演变可视化",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 500, height: 300 },
    defaultConfig: {
      theme: "dark",
      data: [
        ["2024-01",10,"A"],["2024-01",15,"B"],["2024-01",8,"C"],
        ["2024-02",12,"A"],["2024-02",18,"B"],["2024-02",10,"C"],
        ["2024-03",15,"A"],["2024-03",12,"B"],["2024-03",14,"C"],
        ["2024-04",18,"A"],["2024-04",8,"B"],["2024-04",16,"C"],
        ["2024-05",14,"A"],["2024-05",20,"B"],["2024-05",12,"C"],
      ],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/ThemeRiverChartRenderer").then(m => ({ default: m.ThemeRiverChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容", placeholder: "[[time,value,theme],...]" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 平行坐标图 ───
  componentRegistry.register({
    type: "echart-parallel",
    name: "平行坐标图",
    icon: "vertical_align_center",
    description: "ECharts 平行坐标图，多维数据对比分析",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 500, height: 300 },
    defaultConfig: {
      theme: "dark",
      parallelAxis: [
        { dim: 0, name: "Price" }, { dim: 1, name: "Net Weight" },
        { dim: 2, name: "Amount" }, { dim: 3, name: "Score", min: 0, max: 100 },
      ],
      data: [[12.99,100,82,77],[9.99,80,77,69],[20,120,60,85],[15,110,71,72],[30,150,90,88]],
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/ParallelChartRenderer").then(m => ({ default: m.ParallelChartRenderer }))),
    events: [{ id: "click", name: "点击" }, { id: "brushSelected", name: "框选" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "parallelAxis", label: "坐标轴", type: "json", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 地图 ───
  componentRegistry.register({
    type: "echart-map",
    name: "地图",
    icon: "public",
    description: "ECharts 地图，区域数据可视化",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 500, height: 400 },
    defaultConfig: {
      theme: "dark",
      mapName: "china",
      data: [{ name: "北京", value: 200 },{ name: "上海", value: 180 },{ name: "广东", value: 150 },{ name: "四川", value: 120 },{ name: "浙江", value: 100 }],
      roam: true,
      visualMapMin: 0,
      visualMapMax: 200,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/MapChartRenderer").then(m => ({ default: m.MapChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "mapName", label: "地图名", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容" },
      { key: "roam", label: "可漫游", type: "toggle", group: "交互" },
      { key: "visualMapMin", label: "色阶最小值", type: "number", group: "数据" },
      { key: "visualMapMax", label: "色阶最大值", type: "number", group: "数据" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 线图(航线) ───
  componentRegistry.register({
    type: "echart-lines",
    name: "线图",
    icon: "timeline",
    description: "ECharts 线图/航线图，地理轨迹与流动效果",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 500, height: 400 },
    defaultConfig: {
      theme: "dark",
      mapName: "china",
      linesData: [{ coords: [[116.46,39.92],[121.48,31.22]] },{ coords: [[116.46,39.92],[104.06,30.67]] },{ coords: [[121.48,31.22],[113.23,23.16]] }],
      pointsData: [{ name: "北京", value: [116.46,39.92] },{ name: "上海", value: [121.48,31.22] },{ name: "成都", value: [104.06,30.67] },{ name: "广州", value: [113.23,23.16] }],
      effectShow: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/LinesChartRenderer").then(m => ({ default: m.LinesChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "mapName", label: "地图名", type: "text", group: "内容" },
      { key: "linesData", label: "线数据", type: "json", group: "内容" },
      { key: "pointsData", label: "点数据", type: "json", group: "内容" },
      { key: "effectShow", label: "流动效果", type: "toggle", group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 涟漪散点图 ───
  componentRegistry.register({
    type: "echart-effectscatter",
    name: "涟漪散点图",
    icon: "bubble_chart",
    description: "ECharts 涟漪散点图，突出关键数据点",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      data: [{ name: "A", value: [10,20,50] },{ name: "B", value: [30,40,30] },{ name: "C", value: [50,60,80] },{ name: "D", value: [70,30,60] }],
      symbolSize: 15,
      showEffect: true,
      rippleBrushType: "stroke",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/EffectScatterChartRenderer").then(m => ({ default: m.EffectScatterChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "data", label: "数据", type: "json", group: "内容" },
      { key: "symbolSize", label: "点大小", type: "number", min: 5, group: "样式" },
      { key: "showEffect", label: "涟漪效果", type: "toggle", group: "样式" },
      { key: "rippleBrushType", label: "涟漪类型", type: "select", options: [{ label: "描边", value: "stroke" }, { label: "填充", value: "fill" }], group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 象形柱图 ───
  componentRegistry.register({
    type: "echart-pictorialbar",
    name: "象形柱图",
    icon: "view_week",
    description: "ECharts 象形柱图，使用图形符号填充柱体",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      categories: ["A", "B", "C", "D", "E"],
      values: [60, 80, 45, 90, 70],
      max: 100,
      symbol: "rect",
      symbolRepeat: true,
      symbolSize: [12, 6],
      symbolMargin: 2,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/PictorialBarChartRenderer").then(m => ({ default: m.PictorialBarChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "内容" },
      { key: "categories", label: "分类", type: "json", group: "内容" },
      { key: "values", label: "数值", type: "json", group: "内容" },
      { key: "max", label: "最大值", type: "number", group: "数据" },
      { key: "symbol", label: "图形", type: "select", options: [{ label: "矩形", value: "rect" }, { label: "圆形", value: "circle" }, { label: "三角形", value: "triangle" }, { label: "菱形", value: "diamond" }], group: "样式" },
      { key: "symbolRepeat", label: "重复填充", type: "toggle", group: "样式" },
      { key: "symbolSize", label: "图形尺寸", type: "json", group: "样式", placeholder: "[12,6]" },
      { key: "symbolMargin", label: "间距", type: "number", min: 0, group: "样式" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
      { key: "option", label: "自定义配置", type: "json", group: "高级" },
    ],
  });

  // ─── 自定义图表 ───
  componentRegistry.register({
    type: "echart-custom",
    name: "自定义图表",
    icon: "code",
    description: "ECharts 自定义系列，完全自定义 renderItem 渲染逻辑",
    category: "chart",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 400, height: 300 },
    defaultConfig: {
      theme: "dark",
      option: {
        xAxis: { type: "category", data: ["A", "B", "C", "D"] },
        yAxis: { type: "value" },
        series: [{ type: "custom", data: [120, 200, 150, 80] }],
      },
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/echarts/CustomChartRenderer").then(m => ({ default: m.CustomChartRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateData", name: "更新数据" }, { id: "updateConfig", name: "更新配置" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "option", label: "ECharts配置", type: "json", group: "内容" },
      { key: "theme", label: "主题", type: "select", options: [{ label: "暗色", value: "dark" }, { label: "亮色", value: "light" }], group: "样式" },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式" },
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 装饰组件（统一复用 DecorationWrapper + AnimationConfig 体系）
  // ═══════════════════════════════════════════════════════════════

  const ANIMATION_TYPE_OPTIONS = [
    { label: "无", value: "none" },
    { label: "脉冲", value: "pulse" },
    { label: "闪烁", value: "blink" },
    { label: "旋转", value: "rotate" },
    { label: "弹跳", value: "bounce" },
    { label: "淡入", value: "fadeIn" },
    { label: "摇摆", value: "swing" },
    { label: "果冻", value: "jelly" },
    { label: "震动", value: "shake" },
    { label: "呼吸", value: "breathe" },
    { label: "翻转", value: "flip" },
    { label: "浮动", value: "float" },
    { label: "心跳", value: "heartbeat" },
    { label: "漩涡", value: "vortex" },
  ];

  const LINE_EFFECT_OPTIONS = [
    { label: "无", value: "none" },
    { label: "发光", value: "glow" },
    { label: "流光", value: "flow" },
    { label: "霓虹", value: "neon" },
    { label: "荧光", value: "fluorescent" },
    { label: "光波", value: "lightWave" },
    { label: "绘制", value: "draw" },
    { label: "彩虹", value: "rainbow" },
    { label: "电流", value: "electric" },
    { label: "呼吸发光", value: "breatheGlow" },
    { label: "渐变流光", value: "gradientFlow" },
    { label: "脉冲波", value: "pulseWave" },
    { label: "闪烁", value: "sparkle" },
    { label: "虚线流", value: "dashFlow" },
  ];

  const baseAnimationFields = [
    { key: "animation", label: "动画效果", type: "select" as const, group: "动画", options: ANIMATION_TYPE_OPTIONS, defaultValue: "none" },
    { key: "animationDuration", label: "动画时长(s)", type: "number" as const, group: "动画", min: 0.5, max: 10, step: 0.5, defaultValue: 2 },
    { key: "lineEffect", label: "线条效果", type: "select" as const, group: "线条", options: LINE_EFFECT_OPTIONS, defaultValue: "none" },
    { key: "lineEffectColor", label: "效果颜色", type: "color" as const, group: "线条", defaultValue: "#4fc3f7" },
    { key: "lineEffectIntensity", label: "效果强度", type: "number" as const, group: "线条", min: 0, max: 10, defaultValue: 3 },
    { key: "lineEffectSpeed", label: "效果速度(s)", type: "number" as const, group: "线条", min: 0.5, max: 10, step: 0.5, defaultValue: 3 },
    { key: "lineEffectWidth", label: "效果宽度", type: "number" as const, group: "线条", min: 0, max: 10, defaultValue: 2 },
  ];

  // ─── 科技边框 ───
  componentRegistry.register({
    type: "tech-border-decoration",
    name: "科技边框",
    icon: "crop_square",
    description: "SVG 科技风边框（支持 corner / full / double 三种风格），继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 600, height: 400 },
    defaultConfig: {
      stroke: "#4fc3f7",
      fill: "rgba(79,195,247,0.05)",
      strokeWidth: 1.5,
      cornerSize: 15,
      style: "corner",
      opacity: 1,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/TechBorderDecorationRenderer").then(m => ({ default: m.TechBorderDecorationRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "stroke", label: "线条颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "fill", label: "填充颜色", type: "color", group: "样式", defaultValue: "rgba(79,195,247,0.05)" },
      { key: "strokeWidth", label: "线宽", type: "number", min: 0.5, group: "样式", defaultValue: 1.5 },
      { key: "cornerSize", label: "边角尺寸", type: "number", min: 5, group: "样式", defaultValue: 15 },
      { key: "style", label: "风格", type: "select", group: "样式", defaultValue: "corner",
        options: [{ label: "仅角", value: "corner" }, { label: "完整", value: "full" }, { label: "双层", value: "double" }] },
      { key: "opacity", label: "透明度", type: "number", min: 0, max: 1, group: "样式", defaultValue: 1 },
      ...baseAnimationFields,
    ],
  });

  // ─── 角部装饰 ───
  componentRegistry.register({
    type: "corner-decoration",
    name: "角部装饰",
    icon: "highlight_alt",
    description: "四角装饰线（bracket / l-shape 风格），继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 100, height: 100 },
    defaultConfig: {
      stroke: "#4fc3f7",
      size: 15,
      strokeWidth: 2,
      position: "all",
      style: "bracket",
      opacity: 1,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/CornerDecorationRenderer").then(m => ({ default: m.CornerDecorationRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "stroke", label: "线条颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "size", label: "尺寸", type: "number", min: 5, group: "样式", defaultValue: 15 },
      { key: "strokeWidth", label: "线宽", type: "number", min: 0.5, group: "样式", defaultValue: 2 },
      { key: "position", label: "位置", type: "select", group: "样式", defaultValue: "all",
        options: [
          { label: "四角", value: "all" },
          { label: "左上", value: "top-left" }, { label: "右上", value: "top-right" },
          { label: "左下", value: "bottom-left" }, { label: "右下", value: "bottom-right" },
          { label: "顶部", value: "top" }, { label: "底部", value: "bottom" },
          { label: "左侧", value: "left" }, { label: "右侧", value: "right" },
        ] },
      { key: "style", label: "风格", type: "select", group: "样式", defaultValue: "bracket",
        options: [{ label: "方括号", value: "bracket" }, { label: "L型", value: "l-shape" }] },
      { key: "opacity", label: "透明度", type: "number", min: 0, max: 1, group: "样式", defaultValue: 1 },
      ...baseAnimationFields,
    ],
  });

  // ─── 标题框（顶部光晕）───
  componentRegistry.register({
    type: "top-glow-title-frame",
    name: "顶部光晕标题框",
    icon: "vertical_align_top",
    description: "大屏标题：上主线（渐变填充 + glow）+ 下副线（细弱渐变）+ 文字（描边发光），一次性淡入入场。无端帽/中心装饰菱形（彻底消除 3 个光斑）",
    category: "decoration",
    version: "4.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 600, height: 80 },
    defaultConfig: { text: "标题", color: "#ffffff", fontSize: 26, letterSpacing: 6, stroke: "#4fc3f7" },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/TopGlowTitleFrameRenderer").then(m => ({ default: m.TopGlowTitleFrameRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      // 内容
      { key: "text", label: "标题文字", type: "text", group: "内容", defaultValue: "标题" },

      // 排版
      { key: "color", label: "文字颜色", type: "color", group: "排版", defaultValue: "#ffffff" },
      { key: "fontSize", label: "字号", type: "number", min: 12, group: "排版", defaultValue: 26 },
      { key: "letterSpacing", label: "字间距", type: "number", min: 0, step: 0.5, group: "排版", defaultValue: 6 },
      { key: "textStrokeColor", label: "文字描边色", type: "color", group: "排版", defaultValue: "#0a1f3d" },
      { key: "textStrokeWidth", label: "文字描边粗细", type: "slider", min: 0, max: 4, step: 0.25, group: "排版", defaultValue: 2 },
      { key: "textGlowEnabled", label: "文字外发光", type: "toggle", group: "排版", defaultValue: true },
      { key: "textGlowColor", label: "文字发光色", type: "color", group: "排版", defaultValue: "#4fc3f7" },
      { key: "textGlowIntensity", label: "文字发光强度", type: "slider", min: 0, max: 8, step: 0.5, group: "排版", defaultValue: 2.5 },

      // 上主线
      { key: "stroke", label: "线条颜色", type: "color", group: "上主线", defaultValue: "#4fc3f7" },
      { key: "strokeWidth", label: "主线粗细", type: "slider", min: 0.5, max: 8, step: 0.5, group: "上主线", defaultValue: 2 },
      { key: "linePosition", label: "主线纵向位置(0顶-100底)", type: "slider", min: 0, max: 100, step: 2, group: "上主线", defaultValue: 22 },
      { key: "lineLength", label: "主线长度占宽比(%)", type: "slider", min: 20, max: 100, step: 2, group: "上主线", defaultValue: 90 },

      // 下副线
      { key: "subLineEnabled", label: "显示下副线", type: "toggle", group: "下副线", defaultValue: true },
      { key: "subLinePosition", label: "下副线纵向位置(0顶-100底)", type: "slider", min: 0, max: 100, step: 2, group: "下副线", defaultValue: 75 },
      { key: "subLineOpacity", label: "下副线透明度", type: "slider", min: 0, max: 1, step: 0.05, group: "下副线", defaultValue: 0.25 },

      // 发光
      { key: "glowEnabled", label: "装饰发光", type: "toggle", group: "发光", defaultValue: true },
      { key: "glowColor", label: "发光色", type: "color", group: "发光", defaultValue: "#4fc3f7" },
      { key: "glowIntensity", label: "发光强度", type: "slider", min: 0, max: 10, step: 0.5, group: "发光", defaultValue: 4 },

      ...baseAnimationFields,
    ],
  });

  // ─── 区域装饰边框 ───
  componentRegistry.register({
    type: "region-frame",
    name: "区域装饰边框",
    icon: "crop_din",
    description: "圆角矩形区域装饰边框，含四角 L 形装饰、角点光、边缘流光、顶部标签",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 630, height: 1600 },
    defaultConfig: { label: "REGION", labelColor: "#4fc3f7", indexText: "01", stroke: "#4fc3f7", strokeWidth: 1.5 },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/RegionFrameRenderer").then(m => ({ default: m.RegionFrameRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      // 标签
      { key: "label", label: "区域名称", type: "text", group: "标签", defaultValue: "REGION" },
      { key: "labelColor", label: "标签颜色", type: "color", group: "标签", defaultValue: "#4fc3f7" },
      { key: "labelFontSize", label: "标签字号", type: "number", min: 8, group: "标签", defaultValue: 14 },
      { key: "labelPosition", label: "标签位置", type: "select", options: [
        { label: "左上", value: "top-left" },
        { label: "中上", value: "top-center" },
        { label: "右上", value: "top-right" },
      ], group: "标签", defaultValue: "top-left" },
      { key: "showLabel", label: "显示区域名称", type: "toggle", group: "标签", defaultValue: true },
      { key: "showIndex", label: "显示编号", type: "toggle", group: "标签", defaultValue: true },
      { key: "indexText", label: "编号文字", type: "text", group: "标签", defaultValue: "01" },
      { key: "indexColor", label: "编号颜色", type: "color", group: "标签", defaultValue: "#4fc3f7" },

      // 边框
      { key: "stroke", label: "边框颜色", type: "color", group: "边框", defaultValue: "#4fc3f7" },
      { key: "strokeWidth", label: "边框线宽", type: "slider", min: 0.5, max: 6, step: 0.5, group: "边框", defaultValue: 1.5 },
      { key: "borderRadius", label: "圆角", type: "slider", min: 0, max: 30, step: 1, group: "边框", defaultValue: 8 },

      // 四角 L
      { key: "cornerLength", label: "L 形长度", type: "slider", min: 20, max: 120, step: 4, group: "四角装饰", defaultValue: 40 },
      { key: "cornerThickness", label: "L 形粗细", type: "slider", min: 1, max: 8, step: 0.5, group: "四角装饰", defaultValue: 2.5 },
      { key: "cornerSize", label: "L 末端斜线", type: "slider", min: 0, max: 24, step: 2, group: "四角装饰", defaultValue: 12 },
      { key: "cornerStyle", label: "L 端头样式", type: "select", options: [
        { label: "圆头", value: "rounded" },
        { label: "方头", value: "sharp" },
      ], group: "四角装饰", defaultValue: "rounded" },
      { key: "showCornerDots", label: "显示角点光", type: "toggle", group: "四角装饰", defaultValue: true },
      { key: "cornerDotSize", label: "角点尺寸", type: "slider", min: 2, max: 12, step: 0.5, group: "四角装饰", defaultValue: 4 },

      // 发光/动画
      { key: "glowEnabled", label: "整体发光", type: "toggle", group: "发光", defaultValue: true },
      { key: "glowColor", label: "发光色", type: "color", group: "发光", defaultValue: "#4fc3f7" },
      { key: "glowIntensity", label: "发光强度", type: "slider", min: 0, max: 10, step: 0.5, group: "发光", defaultValue: 3 },
      { key: "pulse", label: "呼吸动画", type: "toggle", group: "发光", defaultValue: true },
      { key: "neonFlicker", label: "霓虹闪烁", type: "toggle", group: "发光", defaultValue: false },
      { key: "flowLight", label: "流光动画", type: "toggle", group: "发光", defaultValue: true },
      { key: "flowSpeed", label: "流光速度(ms)", type: "number", min: 1000, step: 500, group: "发光", defaultValue: 4000 },

      ...baseAnimationFields,
    ],
  });

  // ─── 标题框（左侧指示器）───
  componentRegistry.register({
    type: "left-indicator-title-frame",
    name: "左侧指示器标题框",
    icon: "align_horizontal_left",
    description: "左侧带指示条的标题框，继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 600, height: 60 },
    defaultConfig: { text: "标题", color: "#4fc3f7", fontSize: 20, indicatorColor: "#4fc3f7", indicatorWidth: 4 },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/LeftIndicatorTitleFrameRenderer").then(m => ({ default: m.LeftIndicatorTitleFrameRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "text", label: "标题文字", type: "text", group: "内容", defaultValue: "标题" },
      { key: "color", label: "文字颜色", type: "color", group: "样式", defaultValue: "#ffffff" },
      { key: "fontSize", label: "字号", type: "number", min: 12, group: "样式", defaultValue: 20 },
      { key: "indicatorColor", label: "指示条颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "indicatorWidth", label: "指示条宽度", type: "number", min: 1, group: "样式", defaultValue: 4 },
      ...baseAnimationFields,
    ],
  });

  // ─── 标题框（渐变条）───
  componentRegistry.register({
    type: "gradient-bar-title-frame",
    name: "渐变条标题框",
    icon: "linear_scale",
    description: "底部带渐变条的标题框，继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 600, height: 60 },
    defaultConfig: { text: "标题", color: "#ffffff", fontSize: 20, gradientColor: "#4fc3f7" },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/GradientBarTitleFrameRenderer").then(m => ({ default: m.GradientBarTitleFrameRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "text", label: "标题文字", type: "text", group: "内容", defaultValue: "标题" },
      { key: "color", label: "文字颜色", type: "color", group: "样式", defaultValue: "#ffffff" },
      { key: "fontSize", label: "字号", type: "number", min: 12, group: "样式", defaultValue: 20 },
      { key: "gradientColor", label: "渐变颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      ...baseAnimationFields,
    ],
  });

  // ─── 标题框（科技角部）───
  componentRegistry.register({
    type: "tech-corner-title-frame",
    name: "科技角部标题框",
    icon: "code",
    description: "科技风角部包裹的标题框，继承统一动画/线条属性，支持填充和发光效果",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 600, height: 60 },
    defaultConfig: {
      text: "标题",
      color: "#4fc3f7",
      fontSize: 20,
      stroke: "#4fc3f7",
      strokeWidth: 1.5,
      fillColor: "rgba(79,195,247,0.05)",
      fillOpacity: 0.1,
      cornerSize: 15,
      cornerOffset: 2,
      opacity: 1,
      glowEnabled: true,
      glowColor: "#4fc3f7",
      padding: 0,
      borderRadius: 0,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/TechCornerTitleFrameRenderer").then(m => ({ default: m.TechCornerTitleFrameRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      // 内容组
      { key: "text", label: "标题文字", type: "text", group: "内容", defaultValue: "标题" },
      { key: "fontSize", label: "字号", type: "number", min: 12, group: "内容", defaultValue: 20 },
      { key: "color", label: "文字颜色", type: "color", group: "内容", defaultValue: "#4fc3f7" },
      
      // 样式组
      { key: "stroke", label: "线条颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "strokeWidth", label: "线条粗细", type: "slider", min: 0.5, max: 10, step: 0.5, group: "样式", defaultValue: 1.5 },
      { key: "fillColor", label: "填充颜色", type: "color", group: "样式", defaultValue: "rgba(79,195,247,0.05)" },
      { key: "fillOpacity", label: "填充透明度", type: "slider", min: 0, max: 1, step: 0.05, group: "样式", defaultValue: 0.1 },
      { key: "backgroundColor", label: "背景色", type: "color", group: "样式", defaultValue: "transparent" },
      { key: "opacity", label: "整体透明度", type: "slider", min: 0, max: 1, step: 0.05, group: "样式", defaultValue: 1 },
      
      // 边角组
      { key: "cornerSize", label: "边角尺寸", type: "number", min: 5, group: "边角", defaultValue: 15 },
      { key: "cornerOffset", label: "边角偏移", type: "number", min: 0, group: "边角", defaultValue: 2 },
      
      // 发光组
      { key: "glowEnabled", label: "发光启用", type: "toggle", group: "发光", defaultValue: true },
      { key: "glowColor", label: "发光颜色", type: "color", group: "发光", defaultValue: "#4fc3f7" },
      { key: "glowIntensity", label: "发光强度", type: "number", min: 0, max: 10, group: "发光", defaultValue: 3 },
      
      // 布局组
      { key: "padding", label: "内边距", type: "slider", min: 0, max: 60, step: 2, group: "布局", defaultValue: 0 },
      { key: "borderRadius", label: "圆角", type: "number", min: 0, max: 40, group: "布局", defaultValue: 0 },
      
      ...baseAnimationFields,
    ],
  });

  // ─── 标题框（菱形中心）───
  componentRegistry.register({
    type: "center-diamond-title-frame",
    name: "菱形中心标题框",
    icon: "diamond",
    description: "中间带菱形装饰的标题框，继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 600, height: 60 },
    defaultConfig: { text: "标题", color: "#4fc3f7", fontSize: 20, accentColor: "#4fc3f7" },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/CenterDiamondTitleFrameRenderer").then(m => ({ default: m.CenterDiamondTitleFrameRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "text", label: "标题文字", type: "text", group: "内容", defaultValue: "标题" },
      { key: "color", label: "文字颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "fontSize", label: "字号", type: "number", min: 12, group: "样式", defaultValue: 20 },
      { key: "accentColor", label: "装饰颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      ...baseAnimationFields,
    ],
  });

  // ─── 数据卡片装饰 ───
  componentRegistry.register({
    type: "metric-card-decoration",
    name: "数据卡片装饰",
    icon: "analytics",
    description: "大屏通用数据指标卡片，继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 120 },
    defaultConfig: { title: "指标", value: "0", unit: "", color: "#4fc3f7" },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/MetricCardDecorationRenderer").then(m => ({ default: m.MetricCardDecorationRenderer }))),
    events: [{ id: "click", name: "点击" }],
    actions: [{ id: "updateValue", name: "更新数值" }],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "指标名", type: "text", group: "内容", defaultValue: "指标" },
      { key: "value", label: "数值", type: "text", group: "内容", defaultValue: "0" },
      { key: "unit", label: "单位", type: "text", group: "内容", defaultValue: "" },
      { key: "color", label: "主色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      ...baseAnimationFields,
    ],
  });

  // ─── 状态指示灯装饰 ───
  componentRegistry.register({
    type: "status-light-decoration",
    name: "状态指示灯装饰",
    icon: "radio_button_checked",
    description: "通用状态指示灯（红/绿/黄/灰），继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 60, height: 60 },
    defaultConfig: { status: "normal", color: "#4caf50", size: 30, label: "在线" },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/StatusLightDecorationRenderer").then(m => ({ default: m.StatusLightDecorationRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "status", label: "状态", type: "select", group: "内容", defaultValue: "normal",
        options: [
          { label: "正常", value: "normal" }, { label: "告警", value: "alarm" },
          { label: "离线", value: "offline" }, { label: "警告", value: "warning" },
        ] },
      { key: "color", label: "颜色", type: "color", group: "样式", defaultValue: "#4caf50" },
      { key: "size", label: "尺寸", type: "number", min: 10, group: "样式", defaultValue: 30 },
      { key: "label", label: "标签", type: "text", group: "内容", defaultValue: "在线" },
      ...baseAnimationFields,
    ],
  });

  // ─── 进度条装饰 ───
  componentRegistry.register({
    type: "progress-bar-decoration",
    name: "进度条装饰",
    icon: "linear_scale",
    description: "通用进度条，继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 20 },
    defaultConfig: { value: 50, max: 100, color: "#4fc3f7", bgColor: "rgba(255,255,255,0.1)", showText: true },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/ProgressBarDecorationRenderer").then(m => ({ default: m.ProgressBarDecorationRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "value", label: "当前值", type: "number", group: "内容", defaultValue: 50 },
      { key: "max", label: "最大值", type: "number", group: "内容", defaultValue: 100 },
      { key: "color", label: "进度颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "bgColor", label: "背景颜色", type: "color", group: "样式", defaultValue: "rgba(255,255,255,0.1)" },
      { key: "showText", label: "显示文字", type: "toggle", group: "样式", defaultValue: true },
      ...baseAnimationFields,
    ],
  });

  // ─── 圆形进度装饰 ───
  componentRegistry.register({
    type: "circular-progress-decoration",
    name: "圆形进度装饰",
    icon: "donut_large",
    description: "通用圆形进度环，继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 120, height: 120 },
    defaultConfig: { value: 50, max: 100, color: "#4fc3f7", bgColor: "rgba(255,255,255,0.1)", thickness: 6, showText: true },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
    renderer: lazy(() => import("./renderers/CircularProgressDecorationRenderer").then(m => ({ default: m.CircularProgressDecorationRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "value", label: "当前值", type: "number", group: "内容", defaultValue: 50 },
      { key: "max", label: "最大值", type: "number", group: "内容", defaultValue: 100 },
      { key: "color", label: "进度颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "bgColor", label: "背景颜色", type: "color", group: "样式", defaultValue: "rgba(255,255,255,0.1)" },
      { key: "thickness", label: "环厚度", type: "number", min: 1, group: "样式", defaultValue: 6 },
      { key: "showText", label: "显示文字", type: "toggle", group: "样式", defaultValue: true },
      ...baseAnimationFields,
    ],
  });

  // ─── 扫描线装饰 ───
  componentRegistry.register({
    type: "scan-line-decoration",
    name: "扫描线装饰",
    icon: "flash_on",
    description: "扫描光效装饰（流动光带），继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 300, height: 200 },
    defaultConfig: { color: "#4fc3f7", scanColor: "#ffffff", direction: "vertical" },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/ScanLineDecorationRenderer").then(m => ({ default: m.ScanLineDecorationRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "color", label: "边框颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "scanColor", label: "扫描颜色", type: "color", group: "样式", defaultValue: "#ffffff" },
      { key: "direction", label: "方向", type: "select", group: "样式", defaultValue: "vertical",
        options: [{ label: "垂直", value: "vertical" }, { label: "水平", value: "horizontal" }] },
      ...baseAnimationFields,
    ],
  });

  // ─── 虚线框装饰 ───
  componentRegistry.register({
    type: "dashed-box-decoration",
    name: "虚线框装饰",
    icon: "check_box_outline_blank",
    description: "虚线矩形边框，继承统一动画/线条属性",
    category: "decoration",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    defaultSize: { width: 200, height: 200 },
    defaultConfig: { stroke: "#4fc3f7", strokeWidth: 1.5, dashArray: "6 4", fill: "transparent", cornerSize: 0 },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/DashedBoxDecorationRenderer").then(m => ({ default: m.DashedBoxDecorationRenderer }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "stroke", label: "线条颜色", type: "color", group: "样式", defaultValue: "#4fc3f7" },
      { key: "fill", label: "填充颜色", type: "color", group: "样式", defaultValue: "transparent" },
      { key: "strokeWidth", label: "线宽", type: "number", min: 0.5, group: "样式", defaultValue: 1.5 },
      { key: "dashArray", label: "虚线样式", type: "text", group: "样式", defaultValue: "6 4" },
      { key: "cornerSize", label: "圆角", type: "number", min: 0, group: "样式", defaultValue: 0 },
      ...baseAnimationFields,
    ],
  });

  // ═══════════════════════════════════════════════════════════════
  // 日志监控视图组件
  // ═══════════════════════════════════════════════════════════════

  // Log Filter Panel - 日志筛选面板
  componentRegistry.register({
    type: "industrial-log-filter-panel",
    name: "日志筛选面板",
    icon: "filter_list",
    description: "日志监控筛选面板，支持时间范围、设备、级别、事件类型筛选与CSV导出",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // 操作型组件：筛选输入/导出按钮在预览/发布模式下需保留点击
    defaultSize: { width: 280, height: 480 },
    defaultConfig: {
      title: "日志筛选",
      showExport: true,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/LogFilterPanel").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "showExport", label: "显示导出按钮", type: "toggle", group: "显示" },
    ],
  });

  // Operation Log Table - 操作日志表格
  componentRegistry.register({
    type: "industrial-operation-log-table",
    name: "操作日志表格",
    icon: "list_alt",
    description: "分页展示操作日志，支持展开详情、结果颜色区分、分页控件",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // 表格内含分页/展开按钮，预览/发布模式下需保留交互
    defaultSize: { width: 800, height: 400 },
    defaultConfig: {
      title: "操作日志",
      autoQuery: true,
      pageSize: 20,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/OperationLogTable").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "autoQuery", label: "自动查询", type: "toggle", group: "行为" },
      { key: "pageSize", label: "每页条数", type: "number", group: "分页", min: 5, max: 200 },
    ],
  });

  // Device Event Table - 设备事件表格
  componentRegistry.register({
    type: "industrial-device-event-table",
    name: "设备事件表格",
    icon: "event_note",
    description: "分页展示设备事件，级别颜色区分、分页控件",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // 表格内含分页按钮，预览/发布模式下需保留交互
    defaultSize: { width: 800, height: 400 },
    defaultConfig: {
      title: "设备事件",
      autoQuery: true,
      pageSize: 20,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/DeviceEventTable").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "autoQuery", label: "自动查询", type: "toggle", group: "行为" },
      { key: "pageSize", label: "每页条数", type: "number", group: "分页", min: 5, max: 200 },
    ],
  });

  // System Event Table - 系统事件表格
  componentRegistry.register({
    type: "industrial-system-event-table",
    name: "系统事件表格",
    icon: "system_update_alt",
    description: "分页展示系统事件，级别颜色区分、分页控件",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // 表格内含分页按钮，预览/发布模式下需保留交互
    defaultSize: { width: 800, height: 400 },
    defaultConfig: {
      title: "系统事件",
      autoQuery: true,
      pageSize: 20,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/SystemEventTable").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "autoQuery", label: "自动查询", type: "toggle", group: "行为" },
      { key: "pageSize", label: "每页条数", type: "number", group: "分页", min: 5, max: 200 },
    ],
  });

  // Log Overview Cards - 日志监控视图「场景状态概览卡」
  componentRegistry.register({
    type: "industrial-log-overview-cards",
    name: "日志概览卡",
    icon: "dashboard",
    description: "本场景设备在线/离线、指令成功率、近24h故障、重要告警四张概览卡",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: false, // 纯展示卡，无需交互
    defaultSize: { width: 1920, height: 120 },
    defaultConfig: {},
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/LogOverviewCards").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [],
  });

  // 日志监控视图「粉尘浓度趋势图」（专用 log-monitor 链路，type=dust0614）
  componentRegistry.register({
    type: "industrial-log-dust-trend",
    name: "粉尘浓度趋势图",
    icon: "show_chart",
    description: "本场景粉尘传感器(dust0614)浓度历史趋势，含告警/预警阈值线，走 log-monitor 专用链路",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // echarts tooltip/hover 需保持交互
    defaultSize: { width: 1460, height: 540 },
    defaultConfig: {
      title: "粉尘浓度趋势",
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/LogMonitorDustTrend").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
    ],
  });

  // 日志监控视图「分析洞察报告」（专用 log-monitor/report 端点，消费主视图设备池）
  componentRegistry.register({
    type: "industrial-log-analysis-insight",
    name: "分析洞察报告",
    icon: "analytics",
    description: "聚合操作/事件/粉尘/喷雾数据生成健康评分、异常摘要、粉尘-喷雾关联、设备健康榜与决策建议，走 log-monitor 专用 report 端点",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: false, // 纯展示，无交互
    defaultSize: { width: 1900, height: 430 },
    defaultConfig: {
      title: "分析洞察报告",
      dustThreshold: 10,
      sprayWindowSec: 300,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/LogAnalysisInsight").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "dustThreshold", label: "粉尘报警阈值(mg/m³)", type: "number", group: "分析参数", min: 1, max: 50, step: 0.5 },
      { key: "sprayWindowSec", label: "关联窗口(秒)", type: "number", group: "分析参数", min: 30, max: 1800, step: 30 },
    ],
  });

  // ─────────────────────────────────────────────────────────────────────
  // 日志监控视图升级组件（2026-08-21）：
  // 引入 echarts 把日志的 4 类原始字段聚合为可视化（alarm-trend-stacked
  // 为 event_level 三色堆叠面积 + 命令/结果两个 donut）。数据源 =
  // logMonitorApi（scene 作用域自动注入）。
  // 注：旧版 AlarmTrendChart（单色 error bar）与 LogStatsCards 已于 2026-08-22
  // 删除——前者被 alarm-trend-stacked 严格超集替代，后者与 overview-cards 重复。
  // ─────────────────────────────────────────────────────────────────────

  // 操作命令分布 Donut（按 command_code 聚合）
  componentRegistry.register({
    type: "industrial-operation-cmd-donut",
    name: "操作命令分布图",
    icon: "donut_large",
    description: "按 0x06xx 协议命令聚合操作日志的环形图，中心显示总命令数",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // echarts 环形图 hover tooltip 需保持交互
    defaultSize: { width: 600, height: 400 },
    defaultConfig: {
      title: "操作命令分布",
      limit: 1000,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/OperationCommandDonut").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "limit", label: "采样条数", type: "number", group: "数据源", min: 100, max: 5000, step: 100 },
    ],
  });

  // 操作结果分布 Donut（ok/fail/partial/pending + 中心成功率）
  componentRegistry.register({
    type: "industrial-operation-result-donut",
    name: "操作结果分布图",
    icon: "donut_large",
    description: "按 result 字段聚合（成功/失败/部分/等待）的环形图，中心显示成功率",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // echarts 环形图 hover tooltip 需保持交互
    defaultSize: { width: 600, height: 400 },
    defaultConfig: {
      title: "操作结果分布",
      limit: 1000,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/OperationResultDonut").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "limit", label: "采样条数", type: "number", group: "数据源", min: 100, max: 5000, step: 100 },
    ],
  });

  // 事件级别堆叠面积（升级 alarm-trend：info/warn/error 三层 24h 时序）
  componentRegistry.register({
    type: "industrial-alarm-trend-stacked",
    name: "事件级别趋势图",
    icon: "stacked_line_chart",
    description: "设备事件按 event_level × 小时堆叠面积（info/warn/error 三色）",
    category: "industrial",
    version: "1.0.0",
    builtIn: true,
    enabled: true,
    requiresInteraction: true, // echarts 堆叠面积图 hover tooltip 需保持交互
    defaultSize: { width: 1200, height: 400 },
    defaultConfig: {
      title: "事件级别趋势",
      hours: 24,
      limit: 5000,
    },
    capabilities: { resizable: true, rotatable: false, draggable: true, connectable: false, embeddable: false },
    renderer: lazy(() => import("./renderers/industrial/AlarmTrendStacked").then(m => ({ default: m.default }))),
    events: [],
    actions: [],
    dataSchema: { sourceType: "static", staticData: {} },
    configSchema: [
      { key: "title", label: "标题", type: "text", group: "基础" },
      { key: "hours", label: "统计时长(小时)", type: "number", group: "数据源", min: 1, max: 168 },
      { key: "limit", label: "采样条数", type: "number", group: "数据源", min: 1000, max: 20000, step: 500 },
    ],
  });

}
