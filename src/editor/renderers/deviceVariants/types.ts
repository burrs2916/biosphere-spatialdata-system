/**
 * 设备 Variant 渲染器公共类型
 */
import type { DeviceInstance, ProductDefinition } from "../../../types/device";
import type { AnimationConfig } from "../decorationAnimation";

/** 颜色配置（与边框装饰组件组 color1/color2 语义对齐） */
export interface DeviceStyleConfig {
  bodyColor?: string;
  screenColor?: string;
  borderColor?: string;
}

/**
 * 内容展示配置：用户从后端 ProductTag 列表中选出来的字段
 * - faceTags：贴在面板上的字段（与设备外壳同色背景）
 * - screenTags：贴在屏幕上的字段（与屏幕同色背景）
 * - layout：排列方式
 * - undefined = "自动"，由渲染器根据设备类型决定默认显示
 */
export interface DeviceContentConfig {
  faceTags?: string[];
  screenTags?: string[];
}

export interface DeviceVariantRendererProps {
  device: DeviceInstance;
  product?: ProductDefinition;
  width: number;
  height: number;
  mode?: "edit" | "preview" | "live";
  styleConfig?: DeviceStyleConfig;
  /**
   * 通用动画 / 线条效果配置（与边框装饰组件组 ANIMATION_SCHEMA 字段一一对应）
   * 设备组件与边框装饰一样，支持 14 种动画 + 14 种线条效果
   */
  animationConfig?: AnimationConfig;
  /**
   * 内容展示配置：用户从后端 tags 列表中选出来的字段
   */
  contentConfig?: DeviceContentConfig;
  /**
   * 是否处于"等待数据源返回"的中间态：
   *  - deviceId 已绑 + deviceStore 还在加载 + 该设备未在 store 中
   *  - 此时 status 应为 "pending"（黄点脉冲），不视为"离线"
   */
  isPending?: boolean;
  /**
   * 是否处于"产品模板/产品演示"形态（deviceId 为空，只有 productCode）：
   *  - 用于组件库截图（产品宣传图）& 画布上只拖了产品未绑实例
   *  - 画布上：未绑定显示为离线视觉（灰色机身 + 灰点），提示"未绑定 = 不可用"
   *  - 与"绑定后但数据源说离线" 区分
   */
  isTemplate?: boolean;
  /**
   * 强制显示为在线视觉（设备库/导航栏使用）：
   *  - 设备库左侧导航栏的设备项无视真实 online/offline 状态，统一绿色
   *  - 避免和画布上未绑定的"灰色"组件混淆
   *  - 优先级：forceOnline > isTemplate > device.online
   */
  forceOnline?: boolean;
  /**
   * 缩略图截图时隐藏屏幕内容（状态点/文字/数值），只显示纯外壳
   */
  hideScreenContent?: boolean;
}

/** 状态色 */
export const STATUS_COLOR = (online: boolean) => (online ? "#4caf50" : "#9e9e9e");
export const ALARM_COLOR = "#f44336";
export const WARN_COLOR = "#ff9800";

/** 从 device.metadata 中取数值的工具函数（V2 会改为从 runtimeStore 取）*/
export function getMetadataValue(device: DeviceInstance, key: string): unknown {
  return device.metadata?.[key];
}

export function getMetadataNumber(device: DeviceInstance, key: string, fallback = 0): number {
  const v = getMetadataValue(device, key);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

export function getMetadataBool(device: DeviceInstance, key: string): boolean {
  const v = getMetadataValue(device, key);
  return v === true || v === 1 || v === "true";
}

/** 量程取值（默认 [0, 100]）*/
export function getRange(device: DeviceInstance): [number, number] {
  const r = device.metadata?.range;
  if (Array.isArray(r) && r.length >= 2 && typeof r[0] === "number" && typeof r[1] === "number") {
    return [r[0] as number, r[1] as number];
  }
  return [0, 100];
}