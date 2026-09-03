import { componentRegistry, lazy } from "./registryCore";
import { ANIMATION_DEFAULTS, ANIMATION_SCHEMA } from "./renderers/decorationAnimation";
import { generateStaticProductDefinitions, NUMERIC_SENSOR_UNITS } from "../devices/edgeConductorDefaults";


/**
 * 动态注册设备组件到组件库
 *
 * 根据 DeviceStore 中的 ProductDefinition 动态生成组件定义，
 * 替代之前的 17 个硬编码设备模板。
 *
 * 调用时机：
 * - DeviceStore 加载完设备数据后
 * - DeviceStore reload 后
 */
export function registerDeviceComponents(products: import("../types/device").ProductDefinition[]): void {
  // 合并策略：只移除本次 products 中"显式列出"的旧组件，保留静态注册的兜底组件
  // 这样在预览窗口中即使 deviceStore 没数据，静态注册的 FY002-* 也不会被清空
  const incomingCodes = new Set(products.map((p) => p.productCode));
  const existing = componentRegistry.getByCategory("device");
  for (const comp of existing) {
    // type 形如 "device:FY002-MainController"，提取 productCode
    const code = comp.type.startsWith("device:") ? comp.type.slice("device:".length) : comp.type;
    if (incomingCodes.has(code)) {
      componentRegistry.unregister(comp.type);
    }
    // 清理旧的 EC-* 组件（productCodeMapping 未匹配时生成的临时 productCode，现已被默认映射替代）
    if (code.startsWith("EC-")) {
      componentRegistry.unregister(comp.type);
    }
  }

  // 按 ProductDefinition 动态注册
  for (const product of products) {
    const variant = product.defaultVariant ?? "pin";
    // 注册用的默认尺寸：优先使用适合自由画布的大变体（control-panel/card），
    // 而非 pin 标记变体，确保拖入画布时组件大小合理
    const freeVariant = product.variants?.find((v) =>
      ["control-panel", "card"].includes(v.id)
    );
    const defaultSize = freeVariant?.defaultSize
      ?? product.variants?.find((v) => v.id === variant)?.defaultSize
      ?? { width: 200, height: 150 };

    componentRegistry.register({
      type: `device:${product.productCode}`,
      name: product.productName,
      icon: "thumbnail",
      description: product.productCode.includes("-Alarm-Touch")
        ? `${product.productName} — 触控报警传感器，支持触发状态/电池预警/喷雾参数配置`
        : product.productCode.includes("-Alarm-")
        ? `${product.productName} — 报警传感器，支持触发状态/电池预警/喷雾参数配置`
        : `${product.productName} — 拖出后可在属性面板绑定具体设备实例`,
      category: "device",
      version: "1.0.0",
      builtIn: true,
      enabled: true,
      capabilities: { resizable: true, rotatable: false, draggable: true, connectable: true, embeddable: false },
      defaultSize,
      defaultConfig: {
        deviceId: "",
        productCode: product.productCode,
        variant,
        // ─── 颜色：按设备类型设置默认配色 ───
        ...(
          product.category === "main" ? { bodyColor: "#D93A3A", screenColor: "#5A9ED6", borderColor: "#B82F2F" }
          : product.category === "sub" ? { bodyColor: "#D8DCDE", screenColor: "#1A1F24", borderColor: "#989CA0" }
          : product.category === "sensor" ? (
            product.productCode.includes("-Alarm-Infrared") ? { bodyColor: "#6A1B9A", screenColor: "#5A9ED6", borderColor: "#4A148C" }
            : product.productCode.includes("-Alarm-Touch") ? { bodyColor: "#4A7C8A", screenColor: "#5A9ED6", borderColor: "#37474F" }
            : product.productCode.includes("-Alarm-Dust") ? { bodyColor: "#6D4C41", screenColor: "#5A9ED6", borderColor: "#3E2723" }
            : product.productCode.includes("-Sensor-Dust") ? { bodyColor: "#78909C", screenColor: "#5A9ED6", borderColor: "#546E7A" }
            : product.productCode.includes("-Sensor-CO") ? { bodyColor: "#00695C", screenColor: "#5A9ED6", borderColor: "#004D40" }
            : product.productCode.includes("-Sensor-CH4") ? { bodyColor: "#1565C0", screenColor: "#5A9ED6", borderColor: "#0D47A1" }
            : product.productCode.includes("-Sensor-Temp") ? { bodyColor: "#E65100", screenColor: "#5A9ED6", borderColor: "#BF360C" }
            : product.productCode.includes("-Alarm-Flame") ? { bodyColor: "#37474F", screenColor: "#5A9ED6", borderColor: "#1C242A" }
            : product.productCode.includes("-Alarm-Temperature") ? { bodyColor: "#FF8F00", screenColor: "#5A9ED6", borderColor: "#E65100" }
            : product.productCode.includes("-Alarm-CO") ? { bodyColor: "#AD1457", screenColor: "#5A9ED6", borderColor: "#880E4F" }
            : product.productCode.includes("-Alarm-TopCoal") ? { bodyColor: "#424242", screenColor: "#5A9ED6", borderColor: "#212121" }
            : product.productCode.includes("-Alarm-CoalCutter") ? { bodyColor: "#F9A825", screenColor: "#5A9ED6", borderColor: "#F57F17" }
            : product.productCode.includes("-Alarm-FrameMovement") ? { bodyColor: "#2E7D32", screenColor: "#5A9ED6", borderColor: "#1B5E20" }
            : product.productCode.includes("-Alarm-FrameDrop") ? { bodyColor: "#5D4037", screenColor: "#5A9ED6", borderColor: "#3E2723" }
            : product.productCode.includes("-Alarm-Vibration") ? { bodyColor: "#4527A0", screenColor: "#5A9ED6", borderColor: "#311B92" }
            : product.productCode.includes("-Sensor-WindPress") ? { bodyColor: "#00838F", screenColor: "#5A9ED6", borderColor: "#006064" }
            : product.productCode.includes("-Sensor-Wind") ? { bodyColor: "#0277BD", screenColor: "#5A9ED6", borderColor: "#01579B" }
            : { bodyColor: "#607D8B", screenColor: "#5A9ED6", borderColor: "#455A64" }
          )
          : { bodyColor: "#607D8B", screenColor: "#5A9ED6", borderColor: "#455A64" }
        ),
      },
      renderer: lazy(() => import("./renderers/deviceVariants/DeviceComponentRenderer").then(m => ({ default: m.DeviceComponentRenderer }))),
      configSchema: (() => {
        const isAlarm = product.productCode.includes("-Alarm-");
        const isNumericSensor = product.category === "sensor" && !isAlarm;
        const isMain = product.category === "main";
        const isSub = product.category === "sub";

        // ─── 公共字段：所有设备共享 ───
        const baseSchema: import("../types/editor").ConfigField[] = [
          {
            key: "productCode",
            label: "产品识别码",
            type: "text",
            group: "设备",
            placeholder: "如 18013",
          },
          {
            key: "deviceId",
            label: "绑定设备",
            type: "deviceSelect",
            group: "设备",
          },
          {
            key: "variant",
            label: "视觉变体",
            type: "select",
            group: "设备",
            options: (product.variants ?? [{ id: "pin", name: "标记" }]).map((v) => ({
              label: v.name,
              value: v.id,
            })),
          },
        ];

        // ─── 颜色：数值传感器不暴露（颜色由产品元数据决定） ───
        const colorSchema: import("../types/editor").ConfigField[] = isNumericSensor
          ? []
          : [
              { key: "bodyColor", label: "面板色", type: "color", group: "样式" },
              { key: "screenColor", label: "屏幕色", type: "color", group: "样式" },
              { key: "borderColor", label: "边框色", type: "color", group: "样式" },
            ];

        // ─── 内容选择：列出后端 tags，用户选择展示哪些 ───
        // 报警传感器只有 alarm + batteryWarning 两个 tag，仍保留多选以便扩展内置项
        const contentSchema: import("../types/editor").ConfigField[] = [
          {
            key: "faceContent",
            label: isAlarm ? "面板显示" : "面板内容",
            type: "tagMultiSelect",
            group: "内容",
            dynamicOptions: () => {
              const tags = product.tags ?? [];
              if (tags.length === 0) return undefined;
              return [
                { label: isAlarm ? "（自动：触发状态）" : "（自动：产品名 + 设备ID）", value: "__default__" },
                ...tags.map((t) => ({ label: `${t.name}${t.unit ? ` (${t.unit})` : ""}`, value: t.id })),
              ];
            },
          },
          {
            key: "screenContent",
            label: isAlarm ? "屏幕显示" : "屏幕内容",
            type: "tagMultiSelect",
            group: "内容",
            dynamicOptions: () => {
              const tags = product.tags ?? [];
              if (tags.length === 0) return undefined;
              return [
                { label: isAlarm ? "（自动：触发 + 电池）" : "（自动：状态 + 关键值）", value: "__default__" },
                ...tags.map((t) => ({ label: `${t.name}${t.unit ? ` (${t.unit})` : ""}`, value: t.id })),
              ];
            },
          },
        ];

        // ─── 集控器基本信息（0x0607 协议） ───
        // 字段：wirelessAddress / windDirection / scene / routeInterval / wirelessSpeed /
        //       supportCount / repeaterCount / subControllerGroupCount / runMode /
        //       useXi / useDing / coalMachineDelayTime / alias
        const mainInfoSchema: import("../types/editor").ConfigField[] = isMain
          ? [
              {
                key: "wirelessAddress",
                label: "无线地址",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 255,
                placeholder: "0-255",
              },
              {
                key: "windDirection",
                label: "风向",
                type: "select",
                group: "基本信息",
                options: [
                  { label: "下风向", value: 0 },
                  { label: "上风向", value: 1 },
                  { label: "上下风向", value: 2 },
                ],
              },
              {
                key: "scene",
                label: "场景",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 255,
                placeholder: "场景编号",
              },
              {
                key: "routeInterval",
                label: "路由间隔",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 255,
                placeholder: "单位：s",
              },
              {
                key: "wirelessSpeed",
                label: "无线速率",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 255,
              },
              {
                key: "supportCount",
                label: "支架数",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 255,
              },
              {
                key: "repeaterCount",
                label: "中继器数",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 255,
              },
              {
                key: "subControllerGroupCount",
                label: "分控器组数",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 255,
              },
              {
                key: "runMode",
                label: "运行模式",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 255,
              },
              {
                key: "useXi",
                label: "启用移架",
                type: "toggle",
                group: "基本信息",
              },
              {
                key: "useDing",
                label: "启用顶板",
                type: "toggle",
                group: "基本信息",
              },
              {
                key: "coalMachineDelayTime",
                label: "采煤机延时",
                type: "number",
                group: "基本信息",
                min: 0,
                max: 65535,
                placeholder: "单位：s",
              },
              {
                key: "alias",
                label: "别名",
                type: "text",
                group: "基本信息",
                placeholder: "设备别名",
              },
            ]
          : [];

        // ─── 分控器配置（0x060a 协议） ───
        // 字段：repeater / routeInterval / alias
        // 注：controllerId / controllerType / alarmSensorInfo 由后端按无线地址规则推断，不暴露
        const subConfigSchema: import("../types/editor").ConfigField[] = isSub
          ? [
              {
                key: "repeater",
                label: "中继器",
                type: "number",
                group: "分控器配置",
                min: 0,
                max: 255,
                placeholder: "中继器编号",
              },
              {
                key: "routeInterval",
                label: "路由间隔",
                type: "number",
                group: "分控器配置",
                min: 0,
                max: 255,
                placeholder: "单位：s",
              },
              {
                key: "alias",
                label: "别名",
                type: "text",
                group: "分控器配置",
                placeholder: "设备别名",
              },
            ]
          : [];

        // ─── 数值传感器量程/阈值/校准（0x060f 添加传感器）───
        // 协议字段：minRange(4B) / maxRange(4B) / alarmLow(4B) / alarmHigh(4B) / calibrationZero(4B)
        //   字段名依据：命令码映射.json 0x060f.dataSchema.itemFields
        //   这些是**配置参数**（服务器→设备写入），不是实时数据。
        //   不出现在"内容选择器"（仅实时字段参与），只在 configSchema 的"量程配置/报警阈值/校准"组。
        // 单位推断：从 NUMERIC_SENSOR_UNITS 获取（CH4=%LEL / CO=ppm / 粉尘=mg/m³ / 温度=℃ / 风速=m/s / 风压=Pa）
        // 量程上下限范围（协议 uint 4B 范围 0..2^32-1=4294967295）→ 实际物理量程取 0..100000
        const numericUnit = isNumericSensor ? NUMERIC_SENSOR_UNITS[product.productCode] ?? "" : "";
        const rangePH = numericUnit ? ` (${numericUnit})` : "";
        const rangePlaceholder = (text: string) => `${text}${rangePH}`;
        const sensorRangeSchema: import("../types/editor").ConfigField[] = isNumericSensor
          ? [
              {
                key: "minRange",
                label: `量程下限${rangePH}`,
                type: "number",
                group: "量程配置",
                min: 0,
                placeholder: rangePlaceholder("最小量程"),
              },
              {
                key: "maxRange",
                label: `量程上限${rangePH}`,
                type: "number",
                group: "量程配置",
                min: 0,
                placeholder: rangePlaceholder("最大量程"),
              },
              {
                key: "alarmLow",
                label: `报警下限${rangePH}`,
                type: "number",
                group: "报警阈值",
                min: 0,
                placeholder: rangePlaceholder("低于此值报警"),
              },
              {
                key: "alarmHigh",
                label: `报警上限${rangePH}`,
                type: "number",
                group: "报警阈值",
                min: 0,
                placeholder: rangePlaceholder("高于此值报警"),
              },
              {
                key: "calibrationZero",
                label: "零点校准",
                type: "number",
                group: "校准",
                placeholder: "零点校准值（0x060f 4B 整数）",
              },
            ]
          : [];

        // ─── 报警传感器不直接配置"喷雾配置" ───
        // 0x0614 协议的接收方是分控器/集控器，不是报警传感器
        // 报警传感器（红外/触控/烟雾/温度/CO/火焰/粉尘/落架/放顶煤/移架/割煤机/清洗煤壁）
        // 只是触发源，没有喷头；喷雾联动配置由分控器按 sensorType 统一管理
        // 因此所有报警传感器的 configSchema 不再包含"喷雾配置"分组
        return [
          ...baseSchema,
          ...colorSchema,
          ...contentSchema,
          ...mainInfoSchema,
          ...subConfigSchema,
          ...sensorRangeSchema,
        ];
      })(),
    });
  }

  // ─── 设备组件合并 ANIMATION_SCHEMA ───
  // 设备 SVG 内部动画（呼吸/脉动/触发闪烁等，由 sensorType + isOffline 驱动）
  // 与通用动画组（入场/循环/线条效果，由 CSS animation 驱动）互不冲突：
  // 前者是 SVG <animate> 标签，后者是 CSS @keyframes。
  // 注入 ANIMATION_SCHEMA 让用户可以在属性面板配置入场动画和线条效果。
  const deviceDefs = componentRegistry.getByCategory("device");
  for (const def of deviceDefs) {
    def.defaultConfig = { ...def.defaultConfig, ...ANIMATION_DEFAULTS };
    def.configSchema = [...(def.configSchema || []), ...ANIMATION_SCHEMA];
  }
}

/** 批量注册设备模板组件 — 使用静态产品定义直接注册，确保所有窗口都能找到设备组件 */
export function registerDeviceTemplateComponents(): void {
  // 注意：不能使用 require()，Vite ESM 环境不支持
  // 直接使用顶层 import 的 generateStaticProductDefinitions
  const products = generateStaticProductDefinitions();
  console.log("[Registry] Statically registering device components:", products.length);
  registerDeviceComponents(products);
}
