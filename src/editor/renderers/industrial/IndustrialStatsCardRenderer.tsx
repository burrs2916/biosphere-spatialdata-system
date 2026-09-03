/**
 * IndustrialStatsCardRenderer — 场景统计聚合卡片
 *
 * 与 DataCardRenderer 的区别：
 *   - DataCardRenderer: 通用卡片，从 config.data / staticValue 读取值（外部注入或硬编码）
 *   - IndustrialStatsCardRenderer: 场景专用，从 deviceStore 聚合实时设备数据
 *
 * 数据流：
 *   edge-conductor (0x061e/0x0626/0x0627 推送) → WebSocket → deviceStore.devices
 *     → 本组件通过 statType 配置决定聚合逻辑，实时计算在线数/告警数/流量等
 *
 * 协议无数据字段的 statType（main_pressure 等）显示 "—" 占位符；
 * spray_count 从 logMonitorStore 的近 24h 操作样本统计喷雾指令数（0x0619/0x061b/0x0628）。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useMemo, useState, useEffect, useRef } from "react";
import { useDeviceStore } from "../../../store/deviceStore";
import { useThrottledDevices } from "../../../hooks/useThrottledDevices";
import { parseControllerState, isAnySpraying } from "../deviceVariants/deviceStatus";
import {
  queryLogMonitorOperations,
  GLOBAL_SCOPE,
} from "../../../services/logMonitorApi";
import type { OperationLog } from "../../../services/historyApi";
import type { ComponentRendererProps } from "../../../types/editor";
import {
  discoverMainControllerIds,
  isMainControllerDevice,
  isSubControllerDevice,
} from "../../../devices/productCodePredicates";

// ─── 喷雾指令数数据缓存（独立于 logMonitorStore，主视图专用）───
// 主视图的 spray_count 卡需要"全矿近24h 喷雾指令数"，与日志监控视图的 scene/global scope 解耦，
// 故自管一份缓存 + 定时器，不污染 logMonitorStore 状态。
const SPRAY_OPS_TTL = 60_000; // 60s 刷新一次
let sprayOpsCache: { data: OperationLog[]; at: number } | null = null;
let sprayOpsInflight: Promise<void> | null = null;

async function ensureSprayOps(): Promise<OperationLog[]> {
  const now = Date.now();
  if (sprayOpsCache && now - sprayOpsCache.at < SPRAY_OPS_TTL) {
    return sprayOpsCache.data;
  }
  if (!sprayOpsInflight) {
    sprayOpsInflight = (async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      try {
        const resp = await queryLogMonitorOperations({
          from: from.toISOString(),
          to: to.toISOString(),
          scope: GLOBAL_SCOPE,
          limit: 1000,
          offset: 0,
        });
        sprayOpsCache = { data: (resp.data ?? []) as OperationLog[], at: Date.now() };
      } catch {
        // 查询失败时保留旧缓存（若有），避免卡面反复跳 0
        if (!sprayOpsCache) sprayOpsCache = { data: [], at: Date.now() };
      } finally {
        sprayOpsInflight = null;
      }
    })();
  }
  await sprayOpsInflight;
  return sprayOpsCache?.data ?? [];
}

/** 主视图喷雾指令数：挂载即拉一次，之后每 60s 刷新；返回近24h全矿喷雾指令原始数据 */
function useSprayCountData(): OperationLog[] {
  const [data, setData] = useState<OperationLog[]>(sprayOpsCache?.data ?? []);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const d = await ensureSprayOps();
      if (alive) setData(d);
    };
    void tick();
    const timer = setInterval(tick, SPRAY_OPS_TTL);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return data;
}

// ─── statType 定义 ───

export type StatType =
  | "online_devices"          // getEffectiveOnline=true 的设备数
  | "spray_count"             // 近24h 喷雾指令数(0x0619/0x061b/0x0628)，来自 logMonitorStore.statsOps
  | "alarm_count"             // alarm/fault/sensorStatusCode异常 设备数
  | "water_usage_today"       // 流量计(18040) rt.totalFlow 之和 (m³)
  | "main_pressure"           // 协议0x0627只推startStatus无压力值 → "—"
  | "total_flow"              // 流量计(18040) rt.instantFlow 之和 (L/s)
  | "main_controllers_online" // productCode=18 且 getEffectiveOnline=true
  | "running_count"           // 分控器(18001)正在喷洒数(controllerState位域)
  | "fault_count"             // metadata.fault=true 的设备数（含分控器/传感器）
  | "comm_rate"               // 在线设备数/总设备数 × 100%
  | "spray_count_yesterday"   // 协议无字段 → "—"
  | "water_usage_total"       // 流量计(18040) rt.totalFlow 之和（同water_usage_today）
  | "running_hours"           // 协议无字段 → "—"
  | "energy_saving_rate";     // 协议无字段 → "—"

/** 协议无数据字段、永远显示 "—" 的 statType 集合（spray_count 已改接 logMonitorStore，不在此列） */
const NO_DATA_STATS: Set<string> = new Set([
  "main_pressure",
  "spray_count_yesterday",
  "running_hours",
  "energy_saving_rate",
]);

// ─── 设备类型 productCode ───
// 集控器/分控器判定统一走 devices/productCodePredicates（双形态兼容）
const FLOWMETER_PC = new Set(["18040", "FY002-FlowMeter"]);

// 设备域 statType：聚合范围受 config.selectedDeviceIds 严格绑定约束
//（留空 = 显示 "—"，与全仓工业组件的严格绑定模型一致）；
// 其余 statType（在线数/告警数/通信率等）为全矿统计，不受绑定影响。
const DEVICE_SCOPED_STATS = new Set(["total_flow", "instant_flow", "water_usage_today", "water_usage_total"]);

// ─── 聚合 hook ───

interface AggregatedResult {
  value: string;
  hasData: boolean;
  /** 是否为告警类卡片（值>0时脉冲） */
  isAlarm: boolean;
}

function useAggregatedStat(statType: string, precision = 2, sprayOps: OperationLog[] = [], selectedDeviceIds: string[] = []): AggregatedResult {
  // 订阅节流后的 devices 快照（默认 500ms 合并一次），避免每条设备消息触发整卡重渲染
  const devicesMap = useThrottledDevices<Record<string, unknown>>(500);
  const getEffectiveOnline = useDeviceStore((s) => s.getEffectiveOnline);

  return useMemo(() => {
    // 协议无数据字段
    if (NO_DATA_STATS.has(statType)) {
      return { value: "—", hasData: false, isAlarm: false };
    }

    const allDevices = Object.values(devicesMap);

    // ─── 设备域 statType：严格绑定 scope ───
    // selectedDeviceIds 空 → 不显示任何设备（严格模型）；绑定集控器 → discoverMainControllerIds
    // 定位集控器根并展开完整子树（虚拟流量计 {主控ID}_flowmeter 挂主控下，天然被覆盖），
    // 仅聚合子树内的流量计。
    let scope: Set<string> | null = null;
    if (DEVICE_SCOPED_STATS.has(statType)) {
      if (!selectedDeviceIds || selectedDeviceIds.length === 0) {
        return { value: "—", hasData: false, isAlarm: false };
      }
      const roots = new Set<string>(
        discoverMainControllerIds(devicesMap as Record<string, unknown>, selectedDeviceIds),
      );
      if (roots.size === 0) {
        return { value: "—", hasData: false, isAlarm: false };
      }
      scope = new Set<string>();
      for (const d of allDevices) {
        const dev = d as { deviceId?: string; parentDeviceId?: string };
        const id = dev.deviceId ?? "";
        let hit = roots.has(id);
        let pid: string | undefined = dev.parentDeviceId;
        let guard = 0;
        while (!hit && pid && guard < 16) {
          if (roots.has(pid)) { hit = true; break; }
          const parent = devicesMap[pid] as { parentDeviceId?: string } | undefined;
          pid = parent?.parentDeviceId;
          guard++;
        }
        if (hit) scope.add(id);
      }
    }

    switch (statType) {
      case "spray_count": {
        // 来源：主视图自管的近24h全矿喷雾指令缓存（useSprayCountData，每60s刷新，与日志监控视图解耦）。
        // command_code ∈ {0619, 061b, 0628} 计为喷雾指令。
        const SPRAY_CMD = new Set(["0619", "061b", "0628"]);
        const since = Date.now() - 24 * 60 * 60 * 1000;
        let count = 0;
        for (const o of sprayOps) {
          const cc = String((o as { command_code?: unknown }).command_code ?? "").toLowerCase();
          if (!SPRAY_CMD.has(cc)) continue;
          const ts = new Date(String((o as { timestamp?: unknown }).timestamp ?? "")).getTime();
          if (!Number.isNaN(ts) && ts >= since) count++;
        }
        return { value: String(count), hasData: true, isAlarm: false };
      }

      case "online_devices": {
        const count = allDevices.filter((d) => getEffectiveOnline((d as any).deviceId)).length;
        return { value: String(count), hasData: true, isAlarm: false };
      }

      case "alarm_count": {
        let count = 0;
        for (const d of allDevices) {
          const dev = d as Record<string, unknown>;
          const md = dev.metadata as Record<string, unknown> | undefined;
          const rt = (md?.realtime ?? {}) as Record<string, { value: unknown }>;
          // 报警触发
          const alarm = rt.alarm?.value;
          if (alarm === true || alarm === 1) { count++; continue; }
          // 故障
          const fault = md?.fault;
          if (fault === true) { count++; continue; }
          // 传感器状态码异常（bit0~bit6 任一非0表示异常）
          const ssc = rt.sensorStatusCode?.value;
          if (ssc !== undefined && ssc !== null) {
            const code = Number(ssc);
            if (Number.isFinite(code) && code > 0) { count++; continue; }
          }
        }
        return { value: String(count), hasData: true, isAlarm: count > 0 };
      }

      case "water_usage_today":
      case "water_usage_total": {
        // 严格绑定：仅聚合 scope 内的流量计（scope 由上方设备域守卫保证非空）
        const flowmeters = allDevices.filter((d) =>
          FLOWMETER_PC.has(String((d as any).productCode ?? ""))
          && (!scope || scope.has(String((d as any).deviceId ?? "")))
        );
        let total = 0;
        let found = false;
        for (const fm of flowmeters) {
          const rt = ((fm as any).metadata?.realtime ?? {}) as Record<string, { value: unknown }>;
          const v = rt.totalFlow?.value;
          if (v !== undefined && v !== null) {
            const n = Number(v);
            if (Number.isFinite(n)) {
              total += n;
              found = true;
            }
          }
        }
        if (!found) return { value: "—", hasData: false, isAlarm: false };
        // totalFlow 单位 L → m³（除以1000）
        return { value: (total / 1000).toFixed(precision), hasData: true, isAlarm: false };
      }

      case "total_flow":
      case "instant_flow": {
        // 语义说明：instant_flow/total_flow 均取 rt.instantFlow（瞬时流量，L/min），
        // total_flow 为历史遗留命名（老配置在用），instant_flow 为语义化别名。
        // 严格绑定：仅聚合 scope 内的流量计。
        const flowmeters = allDevices.filter((d) =>
          FLOWMETER_PC.has(String((d as any).productCode ?? ""))
          && (!scope || scope.has(String((d as any).deviceId ?? "")))
        );
        let total = 0;
        let found = false;
        for (const fm of flowmeters) {
          const rt = ((fm as any).metadata?.realtime ?? {}) as Record<string, { value: unknown }>;
          const v = rt.instantFlow?.value;
          if (v !== undefined && v !== null) {
            const n = Number(v);
            if (Number.isFinite(n)) {
              total += n;
              found = true;
            }
          }
        }
        if (!found) return { value: "—", hasData: false, isAlarm: false };
        // instantFlow 单位 L/min → L/s（除以60）
        return { value: (total / 60).toFixed(precision), hasData: true, isAlarm: false };
      }

      case "main_controllers_online": {
        const count = allDevices.filter((d) =>
          isMainControllerDevice(d)
          && getEffectiveOnline((d as any).deviceId)
        ).length;
        return { value: String(count), hasData: true, isAlarm: false };
      }

      case "running_count": {
        // 分控器(18001)正在喷洒数：解析 controllerState 位域（协议 0x061e）
        // 复用 deviceStatus.parseControllerState/isAnySpraying（已覆盖 bit0~bit7 全部喷洒位：
        // 前喷/后喷/清洗/前强喷/后强喷/前清洗），与 SubControllerCard 等渲染器语义一致。
        // 注意位域负逻辑：bit0/1/2 = 0 表示喷，bit5/6/7 = 1 表示强喷/清洗。
        const subs = allDevices.filter((d) =>
          isSubControllerDevice(d)
        );
        let count = 0;
        for (const sub of subs) {
          const md = ((sub as any).metadata ?? {}) as Record<string, any>;
          const rt = (md.realtime ?? {}) as Record<string, { value: unknown }>;
          const rawVal = rt.controllerState?.value;
          // 类型兜底：value 可能是字符串或 number，统一 parseInt
          const rawNum = typeof rawVal === "number"
            ? rawVal
            : (rawVal !== undefined && rawVal !== null ? parseInt(String(rawVal), 10) : NaN);
          if (Number.isFinite(rawNum)) {
            const state = parseControllerState(rawNum);
            if (isAnySpraying(state)) {
              count++;
            }
          }
        }
        return { value: String(count), hasData: true, isAlarm: false };
      }

      case "fault_count": {
        // 仅统计集控器(productCode=18)的故障数
        // 协议层：集控器只有 online/offline 两种状态，不会产生 fault=true
        // fault 状态仅用于子设备（分控器通讯故障、传感器断网等）
        // 此处加 MAIN_CONTROLLER_PC 过滤，避免子设备故障被误计入"集控器-故障"
        const count = allDevices.filter((d) => {
          const md = (d as any).metadata;
          return isMainControllerDevice(d)
            && md?.fault === true;
        }).length;
        return { value: String(count), hasData: true, isAlarm: count > 0 };
      }

      case "comm_rate": {
        const total = allDevices.length;
        if (total === 0) return { value: "—", hasData: false, isAlarm: false };
        const online = allDevices.filter((d) => getEffectiveOnline((d as any).deviceId)).length;
        return { value: Math.round((online / total) * 100) + "%", hasData: true, isAlarm: false };
      }

      default:
        return { value: "—", hasData: false, isAlarm: false };
    }
  }, [statType, devicesMap, getEffectiveOnline, precision, sprayOps, selectedDeviceIds]);
}

// ─── 图标 SVG 映射（与 DataCardRenderer 完全一致） ───

const ICON_SVG_MAP: Record<string, string> = {
  temperature: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 0 0-3 3v7.28a5 5 0 1 0 6 0V5a3 3 0 0 0-3-3z"/><circle cx="12" cy="17" r="2" fill="currentColor" stroke="none"/></svg>`,
  smoke: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 18c0-2 2-3 2-5s-2-3-2-5"/><path d="M12 18c0-2 2-3 2-5s-2-3-2-5"/><path d="M18 18c0-2 2-3 2-5s-2-3-2-5"/></svg>`,
  infrared: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-10-10h4m12 0h4"/><path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83m0-14.14l-2.83 2.83m-8.48 8.48l-2.83 2.83"/></svg>`,
  touch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 11a2 2 0 0 1 4 0v5a8 8 0 0 1-8 8h-2c-2.5 0-4-1-5.5-2.5L3 18"/></svg>`,
  dust: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="10" r="1.5" fill="currentColor"/><circle cx="14" cy="8" r="1" fill="currentColor"/><circle cx="11" cy="14" r="1.5" fill="currentColor"/><circle cx="16" cy="13" r="1" fill="currentColor"/><circle cx="6" cy="16" r="1" fill="currentColor"/><circle cx="18" cy="17" r="1.5" fill="currentColor"/></svg>`,
  online: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>`,
  controller: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6m-6 3h6m-6 3h4"/><circle cx="17" cy="17" r="1.5" fill="currentColor"/></svg>`,
  running: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  fault: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  signal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/></svg>`,
  spray: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  alarm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  water: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  pressure: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  flow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  energy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  time: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  custom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
};

// ─── 渲染器 ───

/**
 * 场景统计聚合卡片 — 工业大屏风格
 *
 * 与 DataCardRenderer 外观一致，数据来源从 deviceStore 聚合
 */
export function IndustrialStatsCardRenderer({ config, width = 200, height = 80 }: ComponentRendererProps) {
  const statType = (config.statType as string) || "online_devices";
  const cardName = (config.cardName as string) || "统计";
  const iconType = (config.iconType as string) || "online";
  const accentColor = (config.color as string) || "#4fc3f7";
  const theme = (config.theme as string) || "dark";
  const unit = (config.unit as string) ?? "";
  const showProgress = (config.showProgress as boolean) ?? false;
  const progressValue = (config.progressValue as number) ?? 0;
  const precision = (config.precision as number) ?? 2;
  // 严格绑定：仅对设备域 statType（瞬时流量/今日用水/累计用水）生效
  const selectedDeviceIds = (config.selectedDeviceIds as string[]) ?? [];

  // ─── 从 deviceStore 聚合实时值 ───
  const sprayOps = useSprayCountData();
  const { value: displayValue, hasData, isAlarm } = useAggregatedStat(statType, precision, sprayOps, selectedDeviceIds);

  // ─── 值变化脉冲动画 ───
  const [pulse, setPulse] = useState(false);
  const prevValue = useRef(displayValue);
  useEffect(() => {
    if (prevValue.current !== displayValue) {
      prevValue.current = displayValue;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [displayValue]);

  // ─── 告警/故障类卡片脉冲 ───
  const isAlarmCard = useMemo(() => {
    if (isAlarm) return true;
    if (iconType === "alarm" || iconType === "fault" || iconType === "warning") {
      const v = Number(displayValue);
      return v > 0;
    }
    return false;
  }, [iconType, displayValue, isAlarm]);

  // ─── 图标 SVG ───
  const iconSvg = useMemo(() => {
    return ICON_SVG_MAP[iconType] || ICON_SVG_MAP.custom;
  }, [iconType]);

  // ─── 尺寸计算 ───
  const isWide = width > height * 2.5;
  const iconSize = isWide
    ? Math.max(20, Math.min(height * 0.55, 40))
    : Math.max(16, Math.min(width, height) * 0.22);
  const labelSize = isWide
    ? Math.max(10, Math.min(height * 0.18, 14))
    : Math.max(10, Math.min(width, height) * 0.1);
  const valueSize = isWide
    ? Math.max(20, Math.min(height * 0.42, 44))
    : Math.max(16, Math.min(width, height) * 0.24);

  const progress = showProgress ? Math.max(0, Math.min(100, progressValue)) : 0;

  // ─── 值颜色 ───
  const valueColor = useMemo(() => {
    if (!hasData) return "rgba(255,255,255,0.25)"; // 无数据时半透明
    if (isAlarmCard) return "#ef4444";
    return "#ffffff";
  }, [hasData, isAlarmCard]);

  // ─── 渲染 ───
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: isWide ? "row" : "column",
        alignItems: "center",
        justifyContent: isWide ? "flex-start" : "center",
        gap: isWide ? 1.2 : 0.4,
        padding: isWide ? "8px 14px" : "8px 10px",
        position: "relative",
        overflow: "hidden",
        borderRadius: 2,
        background: theme === "dark"
          ? `linear-gradient(145deg, rgba(15,25,45,0.92) 0%, rgba(8,16,32,0.96) 60%, rgba(12,22,42,0.9) 100%)`
          : `linear-gradient(145deg, rgba(240,245,255,0.95) 0%, rgba(230,240,250,0.98) 100%)`,
        border: `1px solid ${accentColor}${isAlarmCard ? "55" : "20"}`,
        cursor: "default",
        transition: "border-color 0.3s, box-shadow 0.3s",
        "&:hover": {
          borderColor: `${accentColor}44`,
          boxShadow: `0 0 12px ${accentColor}15, inset 0 0 20px ${accentColor}08`,
        },
        // 顶部装饰线
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "8%",
          right: "8%",
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${accentColor}${isAlarmCard ? "88" : "55"}, transparent)`,
          borderRadius: 1,
        },
        // 底部微光
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: showProgress ? 6 : 1,
          background: showProgress
            ? "transparent"
            : `linear-gradient(90deg, transparent, ${accentColor}18, transparent)`,
        },
      }}
    >
      {/* 告警脉冲边框 */}
      {isAlarmCard && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: 2,
            border: `1.5px solid #ef444444`,
            animation: "alarmPulse 2s ease-in-out infinite",
            pointerEvents: "none",
            "@keyframes alarmPulse": {
              "0%, 100%": { borderColor: "#ef444422", boxShadow: "0 0 4px #ef444411" },
              "50%": { borderColor: "#ef444466", boxShadow: "0 0 16px #ef444422" },
            },
          }}
        />
      )}

      {/* 图标区域 */}
      <Box
        sx={{
          width: iconSize,
          height: iconSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: accentColor,
          opacity: 0.85,
          filter: `drop-shadow(0 0 4px ${accentColor}44)`,
          "& svg": {
            width: "100%",
            height: "100%",
          },
        }}
        dangerouslySetInnerHTML={{ __html: iconSvg }}
      />

      {/* 文字区域 */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: isWide ? "flex-start" : "center",
          justifyContent: "center",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* 标签 */}
        <Typography
          sx={{
            fontSize: labelSize,
            color: theme === "dark" ? `${accentColor}99` : `${accentColor}bb`,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.3,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {cardName}
        </Typography>

        {/* 数值行 */}
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 0.4,
            lineHeight: 1,
          }}
        >
          <Typography
            sx={{
              fontSize: valueSize,
              color: valueColor,
              fontWeight: 700,
              whiteSpace: "nowrap",
              fontFamily: "'DIN Alternate', 'Roboto Mono', 'SF Mono', monospace",
              textShadow: pulse
                ? `0 0 ${valueSize * 0.5}px ${accentColor}66`
                : `0 0 ${valueSize * 0.2}px ${accentColor}22`,
              transition: "text-shadow 0.4s ease",
              transform: pulse ? "scale(1.05)" : "scale(1)",
              transformOrigin: "left center",
              animation: pulse ? "valuePop 0.4s ease-out" : "none",
              "@keyframes valuePop": {
                "0%": { transform: "scale(1.08)", opacity: 0.8 },
                "100%": { transform: "scale(1)", opacity: 1 },
              },
            }}
          >
            {displayValue}
          </Typography>
          {unit && hasData && (
            <Typography
              component="span"
              sx={{
                fontSize: labelSize * 0.95,
                color: theme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                fontWeight: 400,
                ml: 0.3,
              }}
            >
              {unit}
            </Typography>
          )}
        </Box>
      </Box>

      {/* deviceStore 数据状态点 */}
      <Box
        sx={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: hasData ? "#4caf50" : "#ff9800",
          boxShadow: hasData
            ? "0 0 4px #4caf5066"
            : "0 0 4px #ff980066",
          opacity: 0.8,
        }}
      />

      {/* 进度条 */}
      {showProgress && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        >
          <Box
            sx={{
              width: `${progress}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${accentColor}55, ${accentColor}cc, ${accentColor})`,
              transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              borderRadius: "0 1px 0 0",
              boxShadow: `0 0 6px ${accentColor}44`,
            }}
          />
        </Box>
      )}

      {/* 角落装饰（左下） */}
      <Box
        sx={{
          position: "absolute",
          bottom: showProgress ? 3 : 4,
          left: 4,
          width: 8,
          height: 1,
          background: `${accentColor}30`,
          borderRadius: 0.5,
        }}
      />
    </Box>
  );
}
