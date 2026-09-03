/**
 * 设备摆位（DevicePlacement）类型定义
 *
 * 描述：设备在某个场景视图中的位置和行为。
 * 运行时存独立 store，序列化时合并到 SceneView。
 *
 * 位置支持多态：
 * - cad：CAD 原始坐标（跟随图纸/校准变化）
 * - pixel：像素坐标（自由摆放，不依赖 CAD）
 * - geo：经纬度坐标（V2 地图组件）
 */
export interface DevicePlacement {
  id: string;
  deviceId: string;
  /** 可选：落在哪个组件上（如 CAD 组件 ID），null 表示自由摆放 */
  parentComponentId?: string;
  position:
    | { type: "cad"; x: number; y: number }
    | { type: "pixel"; x: number; y: number };
  scale?: number;
  rotation?: number;
  iconOverride?: string;
  /** 点击设备时的 Faceplate 引用 */
  faceplateRef?:
    | { type: "inline" }
    | { type: "componentGroupTemplate"; id: string }
    | { type: "component"; id: string };
  labelVisible?: boolean;
}

/** 编辑状态下的吸附模式 */
export type PlacementSnapMode = "free" | "smart" | "cad" | "grid";

/** 批量生成的摆位参数 */
export interface AutoPlacementConfig {
  deviceIds: string[];
  /** 沿一条折线等距分布 */
  alongPath?: Array<{ x: number; y: number }>;
  /** 网格排列 */
  grid?: { cols: number; spacingX: number; spacingY: number };
  /** 沿线排列 */
  line?: { startX: number; startY: number; endX: number; endY: number };
}