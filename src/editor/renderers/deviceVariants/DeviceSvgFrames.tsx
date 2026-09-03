/**
 * DeviceSvgFrames — barrel re-export
 *
 * 设备 SVG 外壳渲染（已拆分为 4 个组件文件）。
 * 本文件仅做 re-export + Frame 选择器逻辑。
 *
 * 消费者无需修改 import 路径：
 *   import { PinFrame, getPinIconType } from "./DeviceSvgFrames";
 *   import { getDeviceFrame } from "./DeviceSvgFrames";
 */

import React from "react";

// ─── 共享基础 ───
export {
  OFFLINE_PALETTE,
  resolveColors,
  GenericDeviceFrame,
  ScreenContent,
  StatusDot,
} from "./frames/ScreenComponents";
export type {
  BaseDeviceFrameProps,
  SensorFrameProps,
  ScreenContentProps,
} from "./frames/ScreenComponents";

// ─── 集控器 / 分控器 ───
export {
  MainControllerFrame,
  SubControllerFrame,
  MC_VW,
  MC_VH,
  SC_VW,
  SC_VH,
} from "./frames/ControllerFrames";
export type {
  MainControllerFrameProps,
  SubControllerFrameProps,
} from "./frames/ControllerFrames";

// ─── 传感器 ───
export {
  SensorFrame,
  SENSOR_VW,
  SENSOR_VH,
} from "./frames/SensorFrame";

// ─── 图钉标记 ───
export {
  PinFrame,
  PIN_VW,
  PIN_VH,
  PIN_DROP_PATH,
} from "./frames/PinFrame";
export type {
  PinFrameProps,
} from "./frames/PinFrame";

// ─── Frame 选择器 ──────────────────────────────────────────
import { MainControllerFrame } from "./frames/ControllerFrames";
import { SubControllerFrame } from "./frames/ControllerFrames";
import { SensorFrame } from "./frames/SensorFrame";
import { GenericDeviceFrame } from "./frames/ScreenComponents";
import type { PinFrameProps } from "./frames/PinFrame";

export type DeviceCategory = "main" | "sub" | "sensor" | "auxiliary";

export function getDeviceFrame(category: DeviceCategory | string, productCode?: string): React.ComponentType<any> {
  // 独立辅助设备（流量计/压力泵）：非传感器，复用 SensorFrame 仅作卡片渲染容器
  if (category === "auxiliary" && (productCode === "FY002-FlowMeter" || productCode === "FY002-Pump")) {
    return SensorFrame;
  }
  // 信号采集器（18002 无线 / 18003 有线）：复用 SensorFrame 渲染工业采集器外观
  if (category === "sub" && (productCode === "FY002-Collector-Wireless" || productCode === "FY002-Collector-Wired")) {
    return SensorFrame;
  }
  switch (category) {
    case "main":
      return MainControllerFrame;
    case "sub":
      return SubControllerFrame;
    case "sensor":
      return SensorFrame;
    default:
      return GenericDeviceFrame;
  }
}

export function getPinIconType(category: DeviceCategory | string, productCode?: string): PinFrameProps["iconType"] {
  // ─── 独立设备优先匹配（不复用 -Alarm- / -Sensor- 通用分支） ───
  // 清洗煤壁传感器（18035）：独立报警型，不归入 alarmSensors 位域
  if (productCode?.includes("-CleanWall")) return "alarm_clean_wall";
  // 流量计（18040）：独立设备类型（非传感器）
  if (productCode === "FY002-FlowMeter") return "flow_meter";
  // 压力泵（18041）：独立设备类型（非传感器）
  if (productCode === "FY002-Pump") return "pump";
  // 信号采集器：无线（18002）/ 有线（18003）
  if (productCode === "FY002-Collector-Wireless") return "collector_wireless";
  if (productCode === "FY002-Collector-Wired") return "collector_wired";

  if (productCode?.includes("-Alarm-")) {
    // 2026-06-15：按 productCode 拆 10 个报警型变体（与 edgeConductorDefaults.ts 字符串对齐）
    if (productCode?.includes("-Touch")) return "touch";
    if (productCode?.includes("-Infrared")) return "infrared";
    if (productCode?.includes("-CoalCutter")) return "alarm_coal_cutter";
    if (productCode?.includes("-FrameMovement")) return "alarm_frame_move";
    if (productCode?.includes("-FrameDrop")) return "alarm_frame_drop";
    if (productCode?.includes("-TopCoal")) return "alarm_top_coal";
    if (productCode?.includes("-Smoke")) return "alarm_smoke";
    if (productCode?.includes("-Temperature")) return "alarm_temp";
    if (productCode?.includes("-Vibration")) return "alarm_vibration";
    if (productCode?.includes("-Dust")) return "alarm_dust";
    if (productCode?.includes("-CO")) return "alarm_co";
    if (productCode?.includes("-Flame")) return "alarm_flame";
    return "alarm";
  }
  // 2026-06-17：数值型粉尘（18015，-Sensor-Dust）专用 2D pin 形态
  if (productCode?.includes("-Sensor-Dust")) return "dust";
  // 2026-06-20：数值型 CO（18013，-Sensor-CO）专用 2D pin 形态
  if (productCode?.includes("-Sensor-CO")) return "numeric_co";
  // 2026-06-20：数值型 CH4（18012，-Sensor-CH4）专用 2D pin 形态
  if (productCode?.includes("-Sensor-CH4")) return "numeric_ch4";
  // 2026-06-22：数值型温度（18014，-Sensor-Temp）专用 2D pin 形态
  if (productCode?.includes("-Sensor-Temp")) return "numeric_temp";
  // 2026-06-22：数值型风速（18010，-Sensor-Wind）专用 2D pin 形态
  if (productCode?.includes("-Sensor-WindPress")) return "numeric_wind_press";
  if (productCode?.includes("-Sensor-Wind")) return "numeric_wind";
  switch (category) {
    case "main": return "main";
    case "sub": return "sub";
    case "sensor": return "sensor";
    default: return "generic";
  }
}
