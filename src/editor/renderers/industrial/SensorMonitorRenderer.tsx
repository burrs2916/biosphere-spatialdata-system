/**
 * SensorMonitorRenderer — 传感器实时监控面板
 *
 * 与 SprayControlToolbarRenderer 对齐的数据流：
 *   edge-conductor (0x061e 30s推送) → WebSocket → deviceStore.devices
 *     → 本组件从 useDeviceStore 读取，按 productCode 过滤传感器
 *
 * 与 SensorGridRenderer 的区别：
 *   - SensorGridRenderer: 依赖 DataOrchestrator API 拉取（config.data），非实时
 *   - SensorMonitorRenderer: 直接订阅 deviceStore（WebSocket 推送），实时更新
 *
 * 场景绑定策略：
 *   通过 config.selectedDeviceIds 绑定集控器（productCode=18），
 *   自动发现其下属分控器（productCode=18001）的所有传感器
 *   （productCode ∈ [18010-18015, 18020-18031]）
 *
 *   config.deviceScope 控制范围模式：
 *     "bound"（默认）→ 上述严格绑定；留空 = 不显示任何设备
 *     "all"          → 覆盖设备表中全部集控器（设备状态监控大屏使用，动态发现不写死 ID）
 *
 * 卡片信息分层：
 *   - 图标 + 名称 + 设备ID
 *   - 实时值（大字号）+ 单位
 *   - mini sparkline（近60个采样点，前端缓存）
 *   - 状态灯（在线/离线/告警）
 *   - 父设备（分控器）信息
 */
import { useMemo, useRef, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import { useDeviceStore } from "../../../store/deviceStore";
import { useThrottledDevices } from "../../../hooks/useThrottledDevices";
import type { ComponentRendererProps } from "../../../types/editor";
import { DEFAULT_PRODUCT_CODE_MAPPING } from "../../../devices/edgeConductorDefaults";
import { DeviceComponentRenderer } from "../deviceVariants/DeviceComponentRenderer";
import {
  isSubControllerDevice,
  isMainControllerDevice,
} from "../../../devices/productCodePredicates";
import { resolveDeviceScope, resolveMainControllerIds } from "./deviceScope";

// ─── 传感器颜色映射（与 registerDeviceComponents.ts 完全一致） ───
// 这样传感器实时监控中的画像颜色和组件库拖出来的完全一致
// 支持数字 productCode (如 "18026") 和字符串 productCode (如 "FY002-Alarm-Infrared")
const SENSOR_COLOR_MAP: Record<string, { bodyColor: string; screenColor: string; borderColor: string }> = {
  // 数值型传感器（字符串 productCode）
  "FY002-Sensor-Dust":     { bodyColor: "#78909C", screenColor: "#5A9ED6", borderColor: "#546E7A" },
  "FY002-Sensor-CO":       { bodyColor: "#00695C", screenColor: "#5A9ED6", borderColor: "#004D40" },
  "FY002-Sensor-CH4":      { bodyColor: "#1565C0", screenColor: "#5A9ED6", borderColor: "#0D47A1" },
  "FY002-Sensor-Temp":     { bodyColor: "#E65100", screenColor: "#5A9ED6", borderColor: "#BF360C" },
  "FY002-Sensor-WindPress":{ bodyColor: "#00838F", screenColor: "#5A9ED6", borderColor: "#006064" },
  "FY002-Sensor-Wind":     { bodyColor: "#0277BD", screenColor: "#5A9ED6", borderColor: "#01579B" },
  // 报警型传感器（字符串 productCode）
  "FY002-Alarm-Infrared":     { bodyColor: "#6A1B9A", screenColor: "#5A9ED6", borderColor: "#4A148C" },
  "FY002-Alarm-Touch":        { bodyColor: "#4A7C8A", screenColor: "#5A9ED6", borderColor: "#37474F" },
  "FY002-Alarm-Dust":         { bodyColor: "#6D4C41", screenColor: "#5A9ED6", borderColor: "#3E2723" },
  "FY002-Alarm-Flame":        { bodyColor: "#37474F", screenColor: "#5A9ED6", borderColor: "#1C242A" },
  "FY002-Alarm-Temperature":  { bodyColor: "#FF8F00", screenColor: "#5A9ED6", borderColor: "#E65100" },
  "FY002-Alarm-CO":           { bodyColor: "#AD1457", screenColor: "#5A9ED6", borderColor: "#880E4F" },
  "FY002-Alarm-TopCoal":      { bodyColor: "#424242", screenColor: "#5A9ED6", borderColor: "#212121" },
  "FY002-Alarm-CoalCutterPosition":{ bodyColor: "#F9A825", screenColor: "#5A9ED6", borderColor: "#F57F17" },
  "FY002-Alarm-FrameMovement":{ bodyColor: "#2E7D32", screenColor: "#5A9ED6", borderColor: "#1B5E20" },
  "FY002-Alarm-FrameDrop":    { bodyColor: "#5D4037", screenColor: "#5A9ED6", borderColor: "#3E2723" },
  "FY002-Alarm-Vibration":    { bodyColor: "#4527A0", screenColor: "#5A9ED6", borderColor: "#311B92" },
  "FY002-Alarm-Smoke":        { bodyColor: "#5D4037", screenColor: "#5A9ED6", borderColor: "#3E2723" },
  // 数字 productCode → 颜色（兼容 deviceStore 中数字格式的 productCode）
  "18010": { bodyColor: "#0277BD", screenColor: "#5A9ED6", borderColor: "#01579B" }, // 风速
  "18011": { bodyColor: "#00838F", screenColor: "#5A9ED6", borderColor: "#006064" }, // 风压
  "18012": { bodyColor: "#1565C0", screenColor: "#5A9ED6", borderColor: "#0D47A1" }, // CH4
  "18013": { bodyColor: "#00695C", screenColor: "#5A9ED6", borderColor: "#004D40" }, // CO
  "18014": { bodyColor: "#E65100", screenColor: "#5A9ED6", borderColor: "#BF360C" }, // 温度
  "18015": { bodyColor: "#78909C", screenColor: "#5A9ED6", borderColor: "#546E7A" }, // 粉尘
  "18020": { bodyColor: "#F9A825", screenColor: "#5A9ED6", borderColor: "#F57F17" }, // 割煤机
  "18021": { bodyColor: "#2E7D32", screenColor: "#5A9ED6", borderColor: "#1B5E20" }, // 移架
  "18022": { bodyColor: "#5D4037", screenColor: "#5A9ED6", borderColor: "#3E2723" }, // 落架
  "18023": { bodyColor: "#424242", screenColor: "#5A9ED6", borderColor: "#212121" }, // 放顶煤
  "18024": { bodyColor: "#5D4037", screenColor: "#5A9ED6", borderColor: "#3E2723" }, // 烟雾
  "18025": { bodyColor: "#FF8F00", screenColor: "#5A9ED6", borderColor: "#E65100" }, // 温度
  "18026": { bodyColor: "#6A1B9A", screenColor: "#5A9ED6", borderColor: "#4A148C" }, // 红外
  "18027": { bodyColor: "#4A7C8A", screenColor: "#5A9ED6", borderColor: "#37474F" }, // 触控
  "18028": { bodyColor: "#4527A0", screenColor: "#5A9ED6", borderColor: "#311B92" }, // 振动
  "18029": { bodyColor: "#6D4C41", screenColor: "#5A9ED6", borderColor: "#3E2723" }, // 粉尘
  "18030": { bodyColor: "#AD1457", screenColor: "#5A9ED6", borderColor: "#880E4F" }, // CO
  "18031": { bodyColor: "#37474F", screenColor: "#5A9ED6", borderColor: "#1C242A" }, // 火焰
};
const DEFAULT_SENSOR_COLORS = { bodyColor: "#607D8B", screenColor: "#5A9ED6", borderColor: "#455A64" };

/** 根据 productCode 获取传感器颜色（与组件库一致）
 *  支持数字字符串（如 "18026"）和字符串 productCode（如 "FY002-Alarm-Infrared"）
 */
function getSensorColors(productCode: string): { bodyColor: string; screenColor: string; borderColor: string } {
  // 1) 直接匹配（数字字符串或完整字符串）
  if (SENSOR_COLOR_MAP[productCode]) return SENSOR_COLOR_MAP[productCode];
  // 2) 模糊匹配（包含关键字）
  if (productCode.includes("Infrared")) return SENSOR_COLOR_MAP["FY002-Alarm-Infrared"];
  if (productCode.includes("Touch")) return SENSOR_COLOR_MAP["FY002-Alarm-Touch"];
  if (productCode.includes("Flame")) return SENSOR_COLOR_MAP["FY002-Alarm-Flame"];
  if (productCode.includes("WindPress")) return SENSOR_COLOR_MAP["FY002-Sensor-WindPress"];
  if (productCode.includes("Wind")) return SENSOR_COLOR_MAP["FY002-Sensor-Wind"];
  if (productCode.includes("Smoke")) return SENSOR_COLOR_MAP["FY002-Alarm-Smoke"];
  if (productCode.includes("CH4")) return SENSOR_COLOR_MAP["FY002-Sensor-CH4"];
  if (productCode.includes("CO")) return SENSOR_COLOR_MAP["FY002-Sensor-CO"];
  if (productCode.includes("Temp")) return SENSOR_COLOR_MAP["FY002-Sensor-Temp"];
  if (productCode.includes("Dust")) return SENSOR_COLOR_MAP["FY002-Sensor-Dust"];
  if (productCode.includes("Vibration")) return SENSOR_COLOR_MAP["FY002-Alarm-Vibration"];
  if (productCode.includes("FrameMovement")) return SENSOR_COLOR_MAP["FY002-Alarm-FrameMovement"];
  if (productCode.includes("FrameDrop")) return SENSOR_COLOR_MAP["FY002-Alarm-FrameDrop"];
  if (productCode.includes("TopCoal")) return SENSOR_COLOR_MAP["FY002-Alarm-TopCoal"];
  if (productCode.includes("CoalCutter")) return SENSOR_COLOR_MAP["FY002-Alarm-CoalCutterPosition"];
  return DEFAULT_SENSOR_COLORS;
}

// ─── 协议层传感器元数据（与 edgeConductorDefaults.ts 对齐） ───

/** 频率传感器：6 种，有连续数值 + 单位 */
const FREQ_SENSORS: Record<number, { key: string; label: string; unit: string; color: string }> = {
  18010: { key: "wind_speed",    label: "风速", unit: "m/s",   color: "#4fc3f7" },
  18011: { key: "wind_pressure", label: "风压", unit: "Pa",     color: "#5e9eff" },
  18012: { key: "ch4",           label: "CH₄", unit: "%LEL",   color: "#ab47bc" },
  18013: { key: "co",            label: "CO",  unit: "ppm",    color: "#ef5350" },
  18014: { key: "temperature",   label: "温度", unit: "℃",     color: "#ff7043" },
  18015: { key: "dust",          label: "粉尘", unit: "mg/m³", color: "#8d6e63" },
};

/** 报警传感器：12 种，绑定在分控器上，开关量 */
const ALARM_SENSORS: Record<number, { key: string; label: string }> = {
  18020: { key: "coal_cutter",     label: "割煤机" },
  18021: { key: "frame_movement",  label: "移架" },
  18022: { key: "frame_drop",      label: "落架" },
  18023: { key: "top_coal",        label: "放顶煤" },
  18024: { key: "smoke",           label: "烟雾" },
  18025: { key: "temp_alarm",      label: "温度" },
  18026: { key: "infrared",        label: "红外" },
  18027: { key: "touch",           label: "触控" },
  18028: { key: "vibration",       label: "振动" },
  18029: { key: "dust_alarm",      label: "粉尘" },
  18030: { key: "co_alarm",        label: "CO" },
  18031: { key: "flame",           label: "火焰" },
};

// 集控器判定统一走 devices/productCodePredicates（双形态兼容）

// 反向映射：字符串 productCode → 数字 productCode
// deviceStore 中的 device.productCode 是字符串格式（如 "FY002-Sensor-Wind"），
// 需要通过反向映射转回数字 productCode 来匹配 FREQ_SENSORS / ALARM_SENSORS
const STRING_TO_NUM_PC: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const [num, str] of Object.entries(DEFAULT_PRODUCT_CODE_MAPPING)) {
    m[str] = Number(num);
  }
  return m;
})();

/** 从 productCode（字符串或数字）获取数字 productCode */
function toNumProductCode(pc: string | number): number {
  const n = Number(pc);
  if (!Number.isNaN(n) && (FREQ_SENSORS[n] !== undefined || ALARM_SENSORS[n] !== undefined)) {
    return n;
  }
  // 字符串格式（如 "FY002-Sensor-Wind"）→ 反向映射
  return STRING_TO_NUM_PC[String(pc)] ?? NaN;
}

/** 判断 productCode 是否为频率传感器 */
function isFreqSensor(pc: string | number): pc is number {
  const n = toNumProductCode(pc);
  return FREQ_SENSORS[n] !== undefined;
}
/** 判断 productCode 是否为报警传感器 */
function isAlarmSensor(pc: string | number): boolean {
  const n = toNumProductCode(pc);
  return ALARM_SENSORS[n] !== undefined;
}

// ─── 设备类型（从 deviceStore 读取的 DeviceInstance 子集） ───

interface SensorDevice {
  deviceId: string;
  productCode: string;
  online: boolean;
  /** 故障态：后端 status="fault" 时 online=true 但 fault=true（通讯故障/未连接/断网） */
  fault?: boolean;
  faultReason?: string;
  parentDeviceId?: string;
  metadata: {
    realtime?: Record<string, { value: unknown; timestamp: number; quality?: string }>;
    minRange?: number;
    maxRange?: number;
    alarmLow?: number;
    alarmHigh?: number;
    calibrationZero?: number;
    [k: string]: unknown;
  };
}

// ─── Sparkline 历史缓存 ───

interface SparkHistory {
  values: number[];
  maxLen: number;
}

const SPARK_MAX_POINTS = 60; // 60 个采样点（约 30 分钟，每 30s 推送一次）

/** 从 deviceStore 设备对象中提取传感器实时值
 *  优先级：finalValue（后端 0x061e 已换算的物理量浮点） > sensorValue（4B 原始 uint 兜底）
 *  协议依据：edge-conductor data_processor.rs:727-735 后端按 productCode 换算后推送 finalValue
 *            0x060f 报警阈值是已换算的浮点物理量，必须用 finalValue 才能直接对比
 */
function extractSensorValue(device: SensorDevice): number | undefined {
  const rt = device.metadata?.realtime;
  if (!rt) return undefined;
  // 1) 优先读 finalValue（后端 0x061e 已换算的浮点物理量）
  const fv = rt.finalValue?.value;
  if (fv !== undefined && fv !== null) {
    const n = Number(fv);
    if (Number.isFinite(n)) return n;
  }
  // 2) fallback：原始 sensorValue（前端会按"原始值"角标提示）
  const v = rt.sensorValue?.value;
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 从 deviceStore 设备对象中提取报警传感器触发状态
 * 后端 0x061e 推送两个相关字段：
 *   - alarm (bool): 真实触发状态（true=已触发）
 *   - alarmSensorInfo (bool): 固定 true，表示已注册（非触发状态）
 * 前端应读 alarm 字段，旧代码误读 alarmSensorInfo 导致永远显示"正常"
 */
function extractAlarmTriggered(device: SensorDevice): boolean {
  const rt = device.metadata?.realtime;
  if (!rt) return false;
  const v = rt.alarm?.value;
  return v === true || v === 1;
}

/** 从 deviceStore 设备对象中提取电池预警状态（报警传感器专用） */
function extractBatteryWarning(device: SensorDevice): boolean {
  const rt = device.metadata?.realtime;
  if (!rt) return false;
  const v = rt.batteryWarning?.value;
  return v === true || v === 1;
}

/** 从 deviceStore 设备对象中提取 sensorStatusCode（2字节位域） */
function extractSensorStatusCode(device: SensorDevice): number {
  const rt = device.metadata?.realtime;
  if (!rt) return 0;
  const v = rt.sensorStatusCode?.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 频率型传感器报警阈值判断（与 0x060f 配置的 alarmLow/alarmHigh 对比）
 *  注意：阈值是已换算的浮点物理量，value 是后端已推的 finalValue（也已换算），可直接比较
 *  返回：{ overHigh: 超上限红 / underLow: 超下限红 / outOfRange: 超量程（minRange/maxRange）橙 }
 */
function evaluateAlarmRange(
  value: number | undefined,
  md: { minRange?: number; maxRange?: number; alarmLow?: number; alarmHigh?: number },
): { overHigh: boolean; underLow: boolean; outOfRange: boolean } {
  const result = { overHigh: false, underLow: false, outOfRange: false };
  if (value === undefined || !Number.isFinite(value)) return result;
  if (md.alarmHigh !== undefined && Number.isFinite(md.alarmHigh) && value > md.alarmHigh) result.overHigh = true;
  if (md.alarmLow !== undefined && Number.isFinite(md.alarmLow) && value < md.alarmLow) result.underLow = true;
  if (md.maxRange !== undefined && Number.isFinite(md.maxRange) && value > md.maxRange) result.outOfRange = true;
  if (md.minRange !== undefined && Number.isFinite(md.minRange) && value < md.minRange) result.outOfRange = true;
  return result;
}

/** 数据陈旧度判断（协议 0x061e 30s 周期；30s+ 无更新 = 陈旧；60s+ = 严重陈旧） */
function evaluateStaleness(
  lastTimestamp: number | undefined,
  now: number,
): { isStale: boolean; isVeryStale: boolean; ageSec: number } {
  if (!lastTimestamp) return { isStale: false, isVeryStale: false, ageSec: -1 };
  const ageSec = Math.max(0, Math.round((now - lastTimestamp) / 1000));
  return {
    isStale: ageSec >= 30,
    isVeryStale: ageSec >= 60,
    ageSec,
  };
}

// ─── Sparkline 渲染 ───

function Sparkline({ values, color, width = 80, height = 24 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) {
    return (
      <Box sx={{ width, height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>—</Typography>
      </Box>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  // 渐变填充区域
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polygon points={areaPoints} fill={color} opacity={0.15} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
      {/* 最新点 */}
      {values.length > 0 && (
        <circle
          cx={(values.length - 1) * stepX}
          cy={height - ((values[values.length - 1] - min) / range) * (height - 2) - 1}
          r={1.8}
          fill={color}
        />
      )}
    </svg>
  );
}

// ─── 主组件 ───

export function SensorMonitorRenderer({ config }: ComponentRendererProps) {
  const title = (config.title as string) || "传感器监控";
  const accentColor = (config.accentColor as string) || "#4fc3f7";
  const columns = (config.columns as number) ?? 4;
  const showSparkline = (config.showSparkline as boolean) ?? true;
  const groupBy = (config.groupBy as "type" | "parent" | "none") ?? "type";
  const showOffline = (config.showOffline as boolean) ?? true;
  const showFault = (config.showFault as boolean) ?? true;
  const valuePrecision = (config.valuePrecision as number) ?? 2;
  const refreshInterval = (config.refreshInterval as number) ?? 1;
  const cardStyle = (config.cardStyle as "compact" | "minimal") ?? "compact";

  // 设备 store 中的加载状态 + reload 方法（用于手动刷新按钮）
  const isLoading = useDeviceStore((s) => s.isLoading);
  const reload = useDeviceStore((s) => s.reload);
  const handleManualRefresh = () => {
    void reload();
  };

  // 绑定的集控器 ID 列表
  const rawSelectedIds = (config.selectedDeviceIds as string[]) ?? [];
  // 设备范围模式：缺省 bound（严格绑定）；设备状态监控大屏模板显式设 all = 覆盖全矿
  const deviceScope = resolveDeviceScope(config);

  // 从 deviceStore 读取所有设备
  const devicesMap = useThrottledDevices(500);
  const getEffectiveOnline = useDeviceStore((s) => s.getEffectiveOnline);

  // UI tick，确保状态变化后及时刷新（由 refreshInterval 控制）
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick(n => n + 1), refreshInterval * 1000);
    return () => clearInterval(t);
  }, [refreshInterval]);

  // ─── 确定目标集控器 ───
  // bound（默认，严格绑定）：未绑定集控器 = 不显示任何设备；绑定后仅显示其下属分控器/传感器
  // all（大屏模板显式设置）：动态发现设备表中全部集控器，不写死任何设备 ID
  const mainControllerIds = useMemo(
    () => resolveMainControllerIds(devicesMap, rawSelectedIds, deviceScope),
    [rawSelectedIds, devicesMap, deviceScope],
  );

  // ─── 发现所有传感器（按集控器→分控器→传感器层级） ───
  const { sensors, sensorsByParent } = useMemo(() => {
    const result: SensorDevice[] = [];
    const byParent: Map<string, SensorDevice[]> = new Map();

    // 收集所有绑定的集控器及其下属分控器的 ID
    const relevantIds = new Set<string>();
    for (const mcId of mainControllerIds) {
      relevantIds.add(mcId);
    }
    // 找到这些集控器下的分控器
    for (const [id, d] of Object.entries(devicesMap)) {
      const dev = d as Record<string, unknown>;
      const parentId = dev.parentDeviceId as string | undefined;
      // 分控器判定走统一谓词（兼容 18001 与 FY002-SubController-Spray 双形态）
      if (isSubControllerDevice(dev) && parentId && mainControllerIds.includes(parentId)) {
        relevantIds.add(id);
      }
    }
    // 找到这些分控器下的传感器
    for (const [id, d] of Object.entries(devicesMap)) {
      const dev = d as Record<string, unknown>;
      const pc = String(dev.productCode ?? "");
      const parentId = dev.parentDeviceId as string | undefined;
      // 传感器：productCode 匹配频率传感器或报警传感器
      // isFreqSensor/isAlarmSensor 内部通过 toNumProductCode 支持字符串和数字两种格式
      const isSensor = isFreqSensor(pc) || isAlarmSensor(pc);
      if (isSensor && parentId && relevantIds.has(parentId)) {
        const md = (dev.metadata ?? {}) as Record<string, unknown>;
        const realtime = (md.realtime ?? {}) as Record<string, { value: unknown; timestamp: number; quality?: string }>;
        const sensorDevice: SensorDevice = {
          deviceId: id,
          productCode: pc,
          online: getEffectiveOnline(id),
          fault: Boolean((md as Record<string, unknown>)?.fault),
          faultReason: ((md as Record<string, unknown>)?.faultReason as string) ?? undefined,
          parentDeviceId: parentId,
          metadata: {
            realtime,
            minRange: md.minRange as number | undefined,
            maxRange: md.maxRange as number | undefined,
            alarmLow: md.alarmLow as number | undefined,
            alarmHigh: md.alarmHigh as number | undefined,
            calibrationZero: md.calibrationZero as number | undefined,
          },
        };
        result.push(sensorDevice);
        const arr = byParent.get(parentId) ?? [];
        arr.push(sensorDevice);
        byParent.set(parentId, arr);
      }
    }
    return { sensors: result, sensorsByParent: byParent };
  }, [rawSelectedIds, mainControllerIds, devicesMap]);

  // ─── Sparkline 历史缓存（ref，避免重渲染） ───
  const sparkRef = useRef<Map<string, SparkHistory>>(new Map());
  // 每次渲染时更新缓存（读取最新值）
  for (const s of sensors) {
    if (isFreqSensor(s.productCode)) {
      const v = extractSensorValue(s);
      if (v !== undefined) {
        const entry = sparkRef.current.get(s.deviceId);
        if (entry) {
          // 只有值变化或时间间隔足够才推入
          const last = entry.values[entry.values.length - 1];
          if (last !== v) {
            entry.values.push(v);
            if (entry.values.length > SPARK_MAX_POINTS) entry.values.shift();
          }
        } else {
          sparkRef.current.set(s.deviceId, { values: [v], maxLen: SPARK_MAX_POINTS });
        }
      }
    }
  }

  // ─── 按类型分组 + 筛选（showOffline/showFault） ───
  const filteredSensors = useMemo(() => {
    let list = sensors;
    if (!showOffline) list = list.filter(s => s.online);
    if (!showFault) list = list.filter(s => !s.fault);
    return list;
  }, [sensors, showOffline, showFault]);

  const grouped = useMemo(() => {
    const freq: SensorDevice[] = [];
    const alarm: SensorDevice[] = [];
    for (const s of filteredSensors) {
      if (isFreqSensor(s.productCode)) freq.push(s);
      else if (isAlarmSensor(s.productCode)) alarm.push(s);
    }
    return { freq, alarm };
  }, [filteredSensors]);

  // ─── 汇总统计 ───
  // 状态优先级：告警(红) > 故障(橙) > 在线(绿) > 离线(灰)
  // 后端 status="fault" 时 online=true 但 fault=true，需单独统计
  const stats = useMemo(() => {
    let online = 0, alarm = 0, fault = 0, offline = 0;
    for (const s of filteredSensors) {
      if (isAlarmSensor(s.productCode) && extractAlarmTriggered(s)) { alarm++; continue; }
      if (s.fault) { fault++; continue; }
      if (s.online) online++;
      else offline++;
    }
    return { total: filteredSensors.length, online, alarm, fault, offline };
  }, [filteredSensors]);

  // ─── 父设备名称映射 ───
  const parentNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, d] of Object.entries(devicesMap)) {
      const dev = d as Record<string, unknown>;
      if (isSubControllerDevice(dev)) {
        // 从 metadata 或顶层取名称
        const name = (dev.name as string) ?? (dev.deviceName as string) ?? `分控器${id.slice(-4)}`;
        m.set(id, name);
      } else if (isMainControllerDevice(dev)) {
        const name = (dev.name as string) ?? (dev.deviceName as string) ?? `集控器${id.slice(-4)}`;
        m.set(id, name);
      }
    }
    return m;
  }, [devicesMap]);

  const hasData = sensors.length > 0;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(10,20,40,0.95) 0%, rgba(8,15,30,0.98) 100%)",
        border: `1px solid ${accentColor}33`,
        borderRadius: 1.5,
      }}
    >
      {/* ─── 标题栏 ─── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${accentColor}22`,
          background: `linear-gradient(90deg, ${accentColor}0d, transparent)`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ width: 3, height: 14, background: accentColor, borderRadius: 0.5 }} />
        <Typography sx={{ fontSize: 13, color: accentColor, fontWeight: 700, letterSpacing: 1 }}>
          {title}
        </Typography>

        {hasData && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, ml: "auto" }}>
            <StatBadge label="总数" value={stats.total} color="#8899aa" />
            <StatBadge label="在线" value={stats.online} color="#4caf50" />
            {stats.fault > 0 && <StatBadge label="故障" value={stats.fault} color="#ef4444" />}
            {stats.alarm > 0 && <StatBadge label="告警" value={stats.alarm} color="#ef4444" />}
            <StatBadge label="离线" value={stats.offline} color="#6b7280" />
            {/* 手动刷新按钮：拉取最新设备清单 + 触发 WebSocket 订阅重连 */}
            <Tooltip title="手动拉取最新设备状态（清空缓存）" arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={handleManualRefresh}
                  disabled={isLoading}
                  sx={{
                    p: 0.3, color: accentColor,
                    animation: isLoading ? "spin 1s linear infinite" : "none",
                    "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                    "&:hover": { bgcolor: `${accentColor}22` },
                    "&.Mui-disabled": { color: "#556677" },
                  }}
                >
                  {isLoading ? <CircularProgress size={12} sx={{ color: "inherit" }} /> : (
                    <Box component="span" sx={{ fontSize: 14, lineHeight: 1, display: "inline-block", transform: "scaleX(-1)" }}>↻</Box>
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* ─── 绑定提示 ─── */}
      {mainControllerIds.length === 0 && (
        <Box sx={{ p: 2, textAlign: "center" }}>
          <Typography sx={{ fontSize: 12, color: "#556677" }}>
            请在右侧属性面板绑定集控器
          </Typography>
        </Box>
      )}

      {/* ─── 内容区 ─── */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", p: 1 }}>
        {!hasData && mainControllerIds.length > 0 ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12, color: "#556677" }}>
              暂无传感器设备（集控器下尚未发现传感器）
            </Typography>
          </Box>
        ) : groupBy === "parent" ? (
          // 按父设备分组（标题 = 分控器名，强化层级归属感）
          Array.from(sensorsByParent.entries()).map(([parentId, list]) => (
            <SensorSection
              key={parentId}
              title={parentNames.get(parentId) ?? `分控器${parentId.slice(-4)}`}
              subtitle={`SUB · ${parentId.slice(-6)}`}
              sensors={list}
              accentColor={accentColor}
              columns={columns}
              showSparkline={showSparkline}
              sparkRef={sparkRef}
              cardStyle={cardStyle}
              valuePrecision={valuePrecision}
              groupId={parentId}
            />
          ))
        ) : groupBy === "none" ? (
          // 不分组，全部平铺
          <SensorSection
            title=""
            subtitle=""
            sensors={filteredSensors}
            accentColor={accentColor}
            columns={columns}
            showSparkline={showSparkline}
            sparkRef={sparkRef}
            cardStyle={cardStyle}
            valuePrecision={valuePrecision}
          />
        ) : (
          // 按类型分组
          <>
            {grouped.freq.length > 0 && (
              <SensorSection
                title="频率传感器"
                subtitle="NUMERIC · 实时数值"
                sensors={grouped.freq}
                accentColor={accentColor}
                columns={columns}
                showSparkline={showSparkline}
                sparkRef={sparkRef}
                cardStyle={cardStyle}
                valuePrecision={valuePrecision}
                groupId="FREQ"
              />
            )}
            {grouped.alarm.length > 0 && (
              <SensorSection
                title="报警传感器"
                subtitle="ALARM · 开关量"
                sensors={grouped.alarm}
                accentColor={accentColor}
                columns={columns}
                showSparkline={showSparkline}
                sparkRef={sparkRef}
                cardStyle={cardStyle}
                valuePrecision={valuePrecision}
                groupId="ALARM"
              />
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

/** 统计徽章（标题区用：label + 数值，简洁风格） */
function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
      <Typography sx={{ fontSize: 10, color: "#667788" }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color, fontWeight: 700, fontFamily: "monospace" }}>{value}</Typography>
    </Box>
  );
}

/** 传感器分组区域
 *  标题区充分利用：分控器名 + 完整编号 + 各状态传感器统计
 *  - 在线 N (绿) | 告警 N (红) | 超限 N (红) | 故障 N (橙) | 陈旧 N (黄) | 离线 N (灰)
 *  - 仅显示数量>0 的状态 chip，避免空白
 */
function SensorSection({
  title,
  subtitle,
  sensors,
  accentColor,
  columns,
  showSparkline,
  sparkRef,
  cardStyle = "compact",
  valuePrecision = 2,
  // 可选：分组标识（parent 分组 = 分控器ID，type 分组 = "freq"/"alarm"）
  groupId,
}: {
  title: string;
  subtitle: string;
  sensors: SensorDevice[];
  accentColor: string;
  columns: number;
  showSparkline: boolean;
  sparkRef: React.MutableRefObject<Map<string, SparkHistory>>;
  cardStyle?: "compact" | "minimal";
  valuePrecision?: number;
  groupId?: string;
}) {
  // 统计各状态传感器数量（仅当有 title 时计算，空分组无意义）
  const stats = useMemo(() => {
    const acc = { online: 0, alarm: 0, overLimit: 0, fault: 0, stale: 0, offline: 0 };
    const now = Date.now();
    for (const s of sensors) {
      const rt = s.metadata?.realtime;
      const lastUpdate = Math.max(
        Number(s.metadata?.lastHeartbeat ?? 0) || 0,
        Number(rt?.finalValue?.timestamp ?? 0) || 0,
        Number(rt?.sensorValue?.timestamp ?? 0) || 0,
        Number(rt?.alarm?.timestamp ?? 0) || 0,
        Number(rt?.batteryWarning?.timestamp ?? 0) || 0,
        Number(rt?.sensorStatusCode?.timestamp ?? 0) || 0,
      ) || 0;
      const ageSec = lastUpdate ? Math.round((now - lastUpdate) / 1000) : 0;

      // 报警型
      if (rt?.alarm?.value === true || rt?.alarm?.value === 1) {
        acc.alarm++;
        continue;
      }
      // 超限（仅频率型有意义，但 alarmType 任意都统计）
      // 注：此处只能通过 card 计算精确 alarmRange，为简化仅统计 statusCode 表示的硬件级异常
      if (rt?.sensorStatusCode?.value && (Number(rt.sensorStatusCode.value) & 0x60) !== 0) {
        acc.overLimit++;
        continue;
      }
      // 通讯故障
      if (s.fault) {
        acc.fault++;
        continue;
      }
      // 严重陈旧
      if (ageSec >= 60) {
        acc.stale++;
        continue;
      }
      // 离线
      if (!s.online) {
        acc.offline++;
        continue;
      }
      // 默认：在线
      acc.online++;
    }
    return acc;
  }, [sensors]);

  // 状态 chip 列表（按优先级，只显示 count>0）
  const statChips: Array<{ key: keyof typeof stats; label: string; color: string; bg: string; border: string }> = [
    { key: "alarm",     label: "告警",   color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.4)" },
    { key: "overLimit", label: "超限",   color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.4)" },
    { key: "fault",     label: "故障",   color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.4)" },
    { key: "stale",     label: "陈旧",   color: "#ffc107", bg: "rgba(255,193,7,0.12)",  border: "rgba(255,193,7,0.4)" },
    { key: "offline",   label: "离线",   color: "#6b7280", bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.4)" },
    { key: "online",    label: "在线",   color: "#4caf50", bg: "rgba(76,175,80,0.12)",  border: "rgba(76,175,80,0.4)" },
  ];
  const visibleChips = statChips.filter(c => stats[c.key] > 0);

  return (
    <Box sx={{ mb: 1.2 }}>
      {/* 标题区：分控器名 + 编号 + 状态统计 chip + 传感器总数 */}
      {title && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 0.6,
            mb: 0.6,
            px: 0.6,
            py: 0.3,
            // 父设备分组时使用更醒目的标题块
            ...(sensors.length > 0
              ? {
                  bgcolor: "rgba(100,160,210,0.08)",
                  borderLeft: `3px solid ${accentColor}`,
                  borderRadius: 0.5,
                }
              : {}),
          }}
        >
          {/* 分控器名 + 副标题（缩写分类） */}
          <Typography sx={{ fontSize: 12, color: accentColor, fontWeight: 700, letterSpacing: 0.5 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: 10, color: "#a8c8e0", fontFamily: "monospace", letterSpacing: 0.5 }}>
              {subtitle}
            </Typography>
          )}
          {groupId && !subtitle && (
            <Typography sx={{ fontSize: 10, color: "#a8c8e0", fontFamily: "monospace", letterSpacing: 0.5 }}>
              {groupId}
            </Typography>
          )}
          {/* 状态统计 chip（按优先级排列，只显示数量>0） */}
          {visibleChips.length > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 1, flexWrap: "wrap" }}>
              {visibleChips.map(c => (
                <Box
                  key={c.key}
                  sx={{
                    display: "flex", alignItems: "center", gap: 0.4,
                    px: 0.7, py: 0.15,
                    borderRadius: 0.6,
                    bgcolor: c.bg,
                    border: `1px solid ${c.border}`,
                    fontSize: 11,
                    color: c.color,
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: c.color, boxShadow: `0 0 4px ${c.color}aa` }} />
                  <span style={{ fontSize: 10 }}>{c.label}</span>
                  <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{stats[c.key]}</span>
                </Box>
              ))}
            </Box>
          )}
          {/* 总数（最右） */}
          <Typography sx={{ fontSize: 11, color: "#a8c8e0", ml: "auto", fontFamily: "monospace", fontWeight: 600 }}>
            共 {sensors.length}
          </Typography>
        </Box>
      )}

      {/* 网格 */}
      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 0.8 }}>
        {sensors.map((s, idx) => (
          <SensorCard
            key={s.deviceId || idx}
            sensor={s}
            accentColor={accentColor}
            showSparkline={showSparkline}
            sparkRef={sparkRef}
            cardStyle={cardStyle}
            valuePrecision={valuePrecision}
          />
        ))}
      </Box>
    </Box>
  );
}

/** 传感器卡片 */
function SensorCard({
  sensor,
  accentColor,
  showSparkline,
  sparkRef,
  cardStyle = "compact",
  valuePrecision = 2,
}: {
  sensor: SensorDevice;
  accentColor: string;
  showSparkline: boolean;
  sparkRef: React.MutableRefObject<Map<string, SparkHistory>>;
  cardStyle?: "compact" | "minimal";
  valuePrecision?: number;
}) {
  // hover 弹出详细信息（不再用 Popover 二次点击弹出，避免多一步交互）
  // 卡片自身只保留视觉信号（异常角标 + 实时数值 + sparkline + 状态点）
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const pcNum = toNumProductCode(sensor.productCode);
  const freqMeta = FREQ_SENSORS[pcNum];
  const alarmMeta = ALARM_SENSORS[pcNum];
  const isFreq = !!freqMeta;
  const isAlarm = !!alarmMeta;
  const metaLabel = freqMeta?.label ?? alarmMeta?.label ?? `传感器#${pcNum}`;

  const online = sensor.online;
  const fault = sensor.fault; // 后端 status="fault" 时 online=true 但 fault=true
  const alarmTriggered = isAlarm && extractAlarmTriggered(sensor);
  const batteryWarning = isAlarm && extractBatteryWarning(sensor);
  const value = isFreq ? extractSensorValue(sensor) : undefined;
  const statusCode = extractSensorStatusCode(sensor);

  // 报警阈值判断（频率型 + 已配置阈值时）
  const alarmRange = isFreq ? evaluateAlarmRange(value, sensor.metadata) : { overHigh: false, underLow: false, outOfRange: false };
  // 是否使用了 finalValue（后端已换算）
  const hasFinalValue = sensor.metadata?.realtime?.finalValue?.value !== undefined && sensor.metadata?.realtime?.finalValue?.value !== null;
  // 是否使用了原始 sensorValue 兜底
  const isRawValue = value !== undefined && !hasFinalValue;

  // realtime 数据（用于取各字段 timestamp）
  const rt = sensor.metadata?.realtime;
  // 最后更新时间（按数据来源优先级合并）：
  //   1) 设备心跳（lastHeartbeat）：所有设备都有，最权威的"何时还活着"
  //   2) 频率型字段：finalValue / sensorValue 的 timestamp
  //   3) 报警型字段：alarm / batteryWarning / sensorStatusCode 的 timestamp
  // 任一字段被后端推送都会更新对应 timestamp；用 max 取最新一次推送的时间
  const lastUpdate = Math.max(
    Number(sensor.metadata?.lastHeartbeat ?? 0) || 0,
    Number(rt?.finalValue?.timestamp ?? 0) || 0,
    Number(rt?.sensorValue?.timestamp ?? 0) || 0,
    Number(rt?.alarm?.timestamp ?? 0) || 0,
    Number(rt?.batteryWarning?.timestamp ?? 0) || 0,
    Number(rt?.sensorStatusCode?.timestamp ?? 0) || 0,
  ) || undefined;
  const now = Date.now();
  const staleness = evaluateStaleness(lastUpdate, now);
  const lastUpdateStr = lastUpdate
    ? new Date(lastUpdate).toLocaleTimeString("zh-CN", { hour12: false })
    : "无数据";
  // 陈旧度文字（用于角标 + Tooltip）
  const stalenessLabel = !lastUpdate
    ? "从未上报"
    : staleness.ageSec >= 60
      ? `${Math.floor(staleness.ageSec / 60)}分${staleness.ageSec % 60}秒前`
      : `${staleness.ageSec}秒前`;

  // 状态色 + 状态文字统一（避免"在线 + 正常"这种重复标注）
  // 优先级：超限(红) > 告警(红) > 电池预警(黄) > 故障(橙) > 严重陈旧(黄) > 离线(灰) > 正常(绿)
  let statusText: string;
  let statusColor: string;
  if (alarmRange.overHigh) {
    statusText = "超上限"; statusColor = "#ef4444";
  } else if (alarmRange.underLow) {
    statusText = "超下限"; statusColor = "#ef4444";
  } else if (alarmRange.outOfRange) {
    statusText = "超量程"; statusColor = "#ff9800";
  } else if (alarmTriggered) {
    statusText = "告警"; statusColor = "#ef4444";
  } else if (batteryWarning) {
    statusText = "电池预警"; statusColor = "#ffc107";
  } else if (fault) {
    statusText = "故障"; statusColor = "#ef4444";
  } else if (staleness.isVeryStale) {
    statusText = `陈旧 ${stalenessLabel}`; statusColor = "#ffc107";
  } else if (!online) {
    statusText = "离线"; statusColor = "#6b7280";
  } else {
    // 在线 + 无任何异常 = 正常
    statusText = "正常"; statusColor = "#4caf50";
  }
  // 传感器主题色
  const sensorColor = freqMeta?.color ?? accentColor;
  // 边框色优先级（与状态色一致，但离线/正常时弱化）
  const borderColor = alarmRange.overHigh || alarmRange.underLow || alarmTriggered
    ? "#ef444488"
    : batteryWarning
      ? "#ffc107aa"
      : fault
        ? "#ef444488"
        : staleness.isVeryStale
          ? "rgba(255,193,7,0.5)"
          : online
            ? `${sensorColor}22`
            : "rgba(255,255,255,0.05)";
  // 是否需要红色脉冲动画（告警/超限/电池预警）
  const needsPulse = (alarmRange.overHigh || alarmRange.underLow || alarmTriggered || batteryWarning) && online;

  // sparkline 数据
  const sparkValues = sparkRef.current.get(sensor.deviceId)?.values ?? [];

  // 显示值
  const displayValue = useMemo(() => {
    if (isFreq) {
      if (value !== undefined) return value.toFixed(valuePrecision);
      if (fault) return "故障";
      return online ? "--" : "离线";
    }
    // 报警型
    if (alarmTriggered) return "报警";
    if (batteryWarning) return "低电";
    if (fault) return "故障";
    if (online) return "正常";
    return "离线";
  }, [isFreq, value, online, fault, alarmTriggered, batteryWarning]);

  return (
    <Box>
      <Tooltip
        // hover 弹出详细信息（替代原 Popover 二次点击，避免多一步交互）
        // 卡片自身只保留视觉信号：分控器归属 + 异常角标 + 实时数值 + sparkline + 状态点
        arrow placement="top"
        enterDelay={300}
        leaveDelay={150}
        open={tooltipOpen}
        onOpen={() => setTooltipOpen(true)}
        onClose={() => setTooltipOpen(false)}
        title={
          <Box sx={{ p: 0.5, minWidth: 180, maxWidth: 320 }}>
            {/* 标题：状态点 + 传感器名 + 状态文字 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, pb: 0.5, borderBottom: `1px solid ${sensorColor}22` }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: statusColor, boxShadow: `0 0 5px ${statusColor}aa`, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff", flex: 1 }}>{metaLabel}</Typography>
              <Typography sx={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>{statusText}</Typography>
            </Box>

            {/* 实时值（频率型大字号） */}
            {isFreq && value !== undefined && (
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, my: 0.6 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: alarmRange.overHigh || alarmRange.underLow ? "#ef4444" : sensorColor, fontFamily: "'DIN Alternate', 'JetBrains Mono', monospace", lineHeight: 1 }}>
                  {value.toFixed(valuePrecision)}
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#aabbcc" }}>{freqMeta?.unit}</Typography>
                {isRawValue && (
                  <Typography sx={{ fontSize: 8, color: "#ffc107", ml: 0.5, px: 0.3, py: 0, bgcolor: "rgba(255,193,7,0.15)", border: "1px solid rgba(255,193,7,0.3)", borderRadius: 0.2 }}>原值</Typography>
                )}
              </Box>
            )}

            {/* 报警型状态文字已合并到标题 statusText 中，不再重复显示 */}

            {/* 异常摘要（超限 / 通讯故障 / 陈旧） */}
            {(alarmRange.overHigh || alarmRange.underLow || alarmRange.outOfRange || fault || staleness.isStale) && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2, mb: 0.5 }}>
                {alarmRange.overHigh && (
                  <Typography sx={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
                    ▲ 超上限（&gt;{sensor.metadata.alarmHigh}{freqMeta?.unit}）
                  </Typography>
                )}
                {alarmRange.underLow && (
                  <Typography sx={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
                    ▼ 超下限（&lt;{sensor.metadata.alarmLow}{freqMeta?.unit}）
                  </Typography>
                )}
                {alarmRange.outOfRange && (
                  <Typography sx={{ fontSize: 10, color: "#ff9800" }}>
                    △ 超量程（{sensor.metadata.minRange ?? 0}~{sensor.metadata.maxRange ?? "--"}{freqMeta?.unit}）
                  </Typography>
                )}
                {fault && <Typography sx={{ fontSize: 10, color: "#ff9800" }}>● 通讯故障</Typography>}
                {staleness.isStale && (
                  <Typography sx={{ fontSize: 10, color: staleness.isVeryStale ? "#ff5252" : "#ffc107" }}>
                    ⚠ 数据 {stalenessLabel} 未更新（协议 0x061e 周期 30s）
                  </Typography>
                )}
              </Box>
            )}

            {/* 报警阈值摘要（频率型有阈值配置时） */}
            {isFreq && (sensor.metadata.alarmLow !== undefined || sensor.metadata.alarmHigh !== undefined || sensor.metadata.minRange !== undefined) && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, p: 0.5, mb: 0.5, borderRadius: 0.5, bgcolor: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {sensor.metadata.alarmLow !== undefined && (
                  <Typography sx={{ fontSize: 9, color: "#aabbcc" }}>
                    <Box component="span" sx={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", bgcolor: alarmRange.underLow ? "#ef4444" : "#4fc3f7", mr: 0.3, verticalAlign: "middle" }} />
                    下限 <b style={{ color: alarmRange.underLow ? "#ef4444" : "#bbccdd" }}>{sensor.metadata.alarmLow}</b>
                  </Typography>
                )}
                {sensor.metadata.alarmHigh !== undefined && (
                  <Typography sx={{ fontSize: 9, color: "#aabbcc" }}>
                    <Box component="span" sx={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", bgcolor: alarmRange.overHigh ? "#ef4444" : "#4fc3f7", mr: 0.3, verticalAlign: "middle" }} />
                    上限 <b style={{ color: alarmRange.overHigh ? "#ef4444" : "#bbccdd" }}>{sensor.metadata.alarmHigh}</b>
                  </Typography>
                )}
                {sensor.metadata.minRange !== undefined && sensor.metadata.maxRange !== undefined && (
                  <Typography sx={{ fontSize: 9, color: "#778899" }}>
                    量程 {sensor.metadata.minRange}~{sensor.metadata.maxRange}{freqMeta?.unit}
                  </Typography>
                )}
              </Box>
            )}

            {/* 状态码按位小图标（仅异常时） */}
            {statusCode !== 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.3, mb: 0.5 }}>
                {[
                  { bit: 0x01, icon: "⚙", label: "未设置" },
                  { bit: 0x02, icon: "📖", label: "读配置错误" },
                  { bit: 0x04, icon: "✎", label: "写配置错误" },
                  { bit: 0x08, icon: "🔌", label: "未连接设备" },
                  { bit: 0x10, icon: "📡", label: "断网" },
                  { bit: 0x20, icon: "▲", label: "超预设置" },
                  { bit: 0x40, icon: "⛔", label: "超量程" },
                ].filter(b => statusCode & b.bit).map(b => (
                  <Box
                    key={b.bit}
                    sx={{
                      fontSize: 9, px: 0.4, py: 0.05, borderRadius: 0.3,
                      bgcolor: (b.bit & 0x18) ? "rgba(239,68,68,0.2)" : "rgba(255,152,0,0.2)",
                      color: (b.bit & 0x18) ? "#ef4444" : "#ff9800",
                      border: `1px solid ${(b.bit & 0x18) ? "#ef4444" : "#ff9800"}`,
                    }}
                  >
                    {b.icon} {b.label}
                  </Box>
                ))}
              </Box>
            )}

            {/* 详细参数：设备ID、电池预警、分控器ID、最后更新（显示完整，不省略） */}
            <Box sx={{ fontSize: 10, color: "#8899aa", display: "flex", flexDirection: "column", gap: 0.15, pt: 0.5, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                <span>设备ID</span>
                <span style={{ fontFamily: "monospace", color: "#bbccdd" }}>{sensor.deviceId}</span>
              </Box>
              {isAlarm && (
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <span>电池预警</span>
                  <span style={{ color: batteryWarning ? "#ffc107" : "#bbccdd" }}>{batteryWarning ? "是 ⚠" : "否"}</span>
                </Box>
              )}
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                <span>分控器ID</span>
                <span style={{ fontFamily: "monospace", color: "#bbccdd" }}>{sensor.parentDeviceId ?? "--"}</span>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                <span>最后更新</span>
                <span style={{ fontFamily: "monospace", color: staleness.isStale ? (staleness.isVeryStale ? "#ff5252" : "#ffc107") : "#bbccdd" }}>
                  {staleness.isStale ? `${stalenessLabel}（陈旧）` : lastUpdateStr}
                </span>
              </Box>
            </Box>
          </Box>
        }
      >
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: 0.6,
          p: 0.6,
          cursor: "default", // hover Tooltip 即可查看详情，不再需要点击
          borderRadius: 1,
          // 固定高度保证网格内卡片对齐（避免报警型/频率型高度不一致）
          minHeight: 96,
          // 背景色优先级：超限(红) > 告警(红) > 故障(橙) > 在线(主题色) > 离线(灰)
          background: alarmRange.overHigh || alarmRange.underLow || alarmTriggered
            ? "rgba(239,68,68,0.12)"
            : batteryWarning
              ? "rgba(255,193,7,0.1)"
              : fault
                ? "rgba(255,152,0,0.08)"
                : online
                  ? `${sensorColor}08`
                  : "rgba(255,255,255,0.02)",
          border: `1px solid ${borderColor}`,
          // 超限/告警/电池预警时使用红色脉冲边框动画（强调视觉）
          animation: needsPulse
            ? "sensorAlarmPulse 1.4s ease-in-out infinite"
            : "none",
          transition: "all 0.2s",
          position: "relative",
          "@keyframes sensorAlarmPulse": {
            "0%,100%": {
              boxShadow: `0 0 0 0 ${alarmRange.overHigh || alarmRange.underLow || alarmTriggered ? "rgba(239,68,68,0.4)" : "rgba(255,193,7,0.3)"}`,
            },
            "50%": {
              boxShadow: `0 0 0 4px ${alarmRange.overHigh || alarmRange.underLow || alarmTriggered ? "rgba(239,68,68,0.05)" : "rgba(255,193,7,0.05)"}`,
            },
          },
          "&:hover": {
            background: alarmRange.overHigh || alarmRange.underLow || alarmTriggered
              ? "rgba(239,68,68,0.18)"
              : batteryWarning
                ? "rgba(255,193,7,0.15)"
                : fault
                  ? "rgba(255,152,0,0.12)"
                  : `${sensorColor}12`,
            borderColor: alarmRange.overHigh || alarmRange.underLow || alarmTriggered
              ? "#ef4444aa"
              : batteryWarning
                ? "#ffc107cc"
                : fault
                  ? "#ff9800aa"
                  : `${sensorColor}66`,
          },
        }}
      >
        {cardStyle === "compact" && (
          <Box sx={{ width: 72, height: 108, flexShrink: 0, overflow: "hidden", borderRadius: 0.5, alignSelf: "center" }}>
            <DeviceComponentRenderer
              config={{
                deviceId: sensor.deviceId,
                productCode: sensor.productCode,
                variant: "control-panel",
                // 颜色与组件库保持一致（按 productCode 匹配）
                ...getSensorColors(sensor.productCode),
                animation: online && !fault ? "breathe" : undefined,
                animationDuration: 2000,
              }}
              componentId={`sensor-monitor-${sensor.deviceId}`}
              width={72}
              height={108}
              mode="preview"
            />
          </Box>
        )}

        {/* 右侧：信息区
            卡片本体只保留核心信号：异常角标 + 实时数值 + sparkline + 最后更新
            分控器归属、状态点、状态文字、详细参数都进 hover Tooltip，避免常驻重复 */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.3, minWidth: 0, overflow: "hidden", justifyContent: "space-between" }}>
          {/* 第 1 行：异常角标（仅频率型超限时显示，居右） */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, minHeight: 14, justifyContent: "flex-end" }}>
            {isFreq && alarmRange.overHigh && (
              <Tooltip title={`超上限（>${sensor.metadata.alarmHigh}${freqMeta?.unit ?? ""}）`} arrow>
                <Box sx={{ px: 0.4, py: 0.05, borderRadius: 0.3, bgcolor: "rgba(239,68,68,0.25)", border: "1px solid #ef4444", fontSize: 8, color: "#ef4444", fontWeight: 700, flexShrink: 0 }}>超</Box>
              </Tooltip>
            )}
            {isFreq && alarmRange.underLow && (
              <Tooltip title={`超下限（<${sensor.metadata.alarmLow}${freqMeta?.unit ?? ""}）`} arrow>
                <Box sx={{ px: 0.4, py: 0.05, borderRadius: 0.3, bgcolor: "rgba(239,68,68,0.25)", border: "1px solid #ef4444", fontSize: 8, color: "#ef4444", fontWeight: 700, flexShrink: 0 }}>低</Box>
              </Tooltip>
            )}
            {isFreq && alarmRange.outOfRange && (
              <Tooltip title={`超量程（${sensor.metadata.minRange ?? 0}~${sensor.metadata.maxRange ?? "--"}${freqMeta?.unit ?? ""}）`} arrow>
                <Box sx={{ px: 0.4, py: 0.05, borderRadius: 0.3, bgcolor: "rgba(255,152,0,0.2)", border: "1px solid #ff9800", fontSize: 8, color: "#ff9800", fontWeight: 700, flexShrink: 0 }}>量</Box>
              </Tooltip>
            )}
          </Box>

          {/* 第二行：实时数值（频率型）或状态（报警型）— 卡片主信息，不再显示名称（已移到 hover/点击） */}
          {isFreq && (
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.3, mt: 0.2 }}>
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: alarmRange.overHigh || alarmRange.underLow
                    ? "#ef4444"
                    : alarmTriggered
                      ? "#ef4444"
                      : fault
                        ? "#ff9800"
                        : online
                          ? sensorColor
                          : "#556677",
                  fontFamily: "'DIN Alternate', 'JetBrains Mono', monospace",
                  lineHeight: 1.1,
                }}
              >
                {displayValue}
              </Typography>
              {value !== undefined && freqMeta && (
                <Typography sx={{ fontSize: 9, color: "#778899" }}>
                  {freqMeta.unit}
                </Typography>
              )}
              {isRawValue && value !== undefined && (
                <Tooltip title="后端未推送 finalValue，显示的是原始 uint（未换算）" arrow>
                  <Box sx={{ px: 0.3, py: 0, borderRadius: 0.2, bgcolor: "rgba(255,193,7,0.15)", border: "1px solid rgba(255,193,7,0.3)", fontSize: 7, color: "#ffc107", fontWeight: 600, ml: 0.3 }}>原值</Box>
                </Tooltip>
              )}
            </Box>
          )}
          {!isFreq && (
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: statusColor, // 与 Tooltip 状态点/状态文字完全一致
                lineHeight: 1.2,
                mt: 0.2,
              }}
            >
              {displayValue}
            </Typography>
          )}

          {/* 第三行：sparkline（频率型且开启）或占位空间（保持高度一致） */}
          {isFreq && showSparkline ? (
            <Box>
              <Sparkline values={sparkValues} color={sensorColor} width={82} height={16} />
            </Box>
          ) : (
            <Box sx={{ height: 16 }} />
          )}

          {/* 第四行：陈旧度/最后更新时间（量程已移到点击 Popover） */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, mt: "auto" }}>
            {/* 陈旧度提示：30s+ 黄色字 / 60s+ 加叹号 */}
            {staleness.isStale ? (
              <Tooltip title={`数据 ${staleness.ageSec} 秒未更新（协议 0x061e 周期 30s，可能设备掉线）`} arrow>
                <Box
                  sx={{
                    ml: "auto", flexShrink: 0,
                    fontSize: 8, fontFamily: "monospace", fontWeight: 600,
                    color: staleness.isVeryStale ? "#ff5252" : "#ffc107",
                    display: "flex", alignItems: "center", gap: 0.2,
                  }}
                >
                  {staleness.isVeryStale && "⚠"}
                  {stalenessLabel}
                </Box>
              </Tooltip>
            ) : (
              <Typography sx={{ fontSize: 8, color: "#445566", fontFamily: "monospace", ml: "auto", flexShrink: 0 }}>
                {lastUpdateStr}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
      </Tooltip>
    </Box>
  );
}
