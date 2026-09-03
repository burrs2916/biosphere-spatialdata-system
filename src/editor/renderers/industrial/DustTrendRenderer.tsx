/**
 * DustTrendRenderer - 粉尘浓度趋势图（深度绑定粉尘传感器）
 *
 * 数据流：
 *   config.selectedDeviceIds -> 集控器(pc=18)
 *     -> 分控器(pc=18001, parentDeviceId in 集控器ID集)
 *       -> 粉尘传感器(pc=18015, parentDeviceId in 分控器ID集)
 *         -> 0x061e 30s推送 -> deviceStore.devices -> 本组件提取 finalValue
 *         -> GreptimeDB sensor_samples -> querySensorHistory API -> 历史数据合并（支持聚合采样）
 *
 * 核心特性：
 *   1. 层级发现：集控器->分控器->粉尘传感器（与 SensorMonitorRenderer 一致）
 *   2. 三级空状态：未绑定集控器 / 无粉尘传感器 / 有传感器无数据
 *   3. 传感器画像浮层：右上角可点击画像，选中则渲染其趋势折线
 *   4. 时间轴 X 轴：type:"time"，每个传感器独立 [timestamp, value] 数据点
 *   5. 告警阈值线：alarmHigh 红色虚线 + 预警线(80%) 橙色虚线
 *   6. 滑动窗口：bufferRef 存储 [timestamp, value]，固定 60 点（~30min）
 *   7. 最新数据点：末端高亮圆点 + 脉冲动画
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { echarts } from "../echarts/echartsCore";
import { useDeviceStore } from "../../../store/deviceStore";
import { useThrottledDevices } from "../../../hooks/useThrottledDevices";
import { logger } from "../../../utils/logger";
import { DeviceComponentRenderer } from "../deviceVariants/DeviceComponentRenderer";
import type { ComponentRendererProps } from "../../../types/editor";
import { querySensorHistory } from "../../../services/historyApi";
import type { SensorRecord } from "../../../services/historyApi";
import {
  discoverMainControllerIds,
  isSubControllerDevice,
} from "../../../devices/productCodePredicates";

// ═══════════════════════════════════════════════════════════════════
// 常量 & 类型
// ═══════════════════════════════════════════════════════════════════

// 集控器/分控器判定统一走 devices/productCodePredicates（双形态兼容）
const DUST_FREQ_PC = new Set(["18015", "FY002-Sensor-Dust"]);
const DUST_ALARM_PC = new Set(["18029", "FY002-Alarm-Dust"]);

/** 粉尘传感器颜色映射（与 SensorMonitorRenderer 完全一致） */
const DUST_COLORS: Record<string, { bodyColor: string; screenColor: string; borderColor: string }> = {
  "18015": { bodyColor: "#78909C", screenColor: "#5A9ED6", borderColor: "#546E7A" },
  "18029": { bodyColor: "#6D4C41", screenColor: "#5A9ED6", borderColor: "#3E2723" },
  "FY002-Sensor-Dust": { bodyColor: "#78909C", screenColor: "#5A9ED6", borderColor: "#546E7A" },
  "FY002-Alarm-Dust": { bodyColor: "#6D4C41", screenColor: "#5A9ED6", borderColor: "#3E2723" },
};

/** 折线图颜色（每个传感器分配一个，与画像选中状态联动） */
const DUST_CHART_COLORS = ["#5A9ED6", "#8d6e63", "#90A4AE", "#A1887F", "#B0BEC5"];

/** 传感器设备类型（从 deviceStore 读取的 DeviceInstance 子集） */
interface DustSensorDevice {
  deviceId: string;
  productCode: string;
  online: boolean;
  fault?: boolean;
  parentDeviceId?: string;
  metadata: {
    realtime?: Record<string, { value: unknown; timestamp: number; quality?: string }>;
    minRange?: number;
    maxRange?: number;
    alarmLow?: number;
    alarmHigh?: number;
    alias?: string;
    productName?: string;
    [k: string]: unknown;
  };
}

/** 滑动窗口条目：[timestamp, value] 对 */
interface SparkHistory {
  points: [number, number][]; // [timestamp_ms, value]
  maxLen: number;
}

// ═══════════════════════════════════════════════════════════════════
// 工具函数（与 SensorMonitorRenderer 对齐）
// ═══════════════════════════════════════════════════════════════════

/** 从 deviceStore 设备对象中提取传感器实时值
 *  优先级：finalValue（后端 0x061e 已换算的物理量浮点） > sensorValue（4B 原始 uint 兜底）
 */
function extractSensorValue(device: DustSensorDevice): number | undefined {
  const rt = device.metadata?.realtime;
  if (!rt) return undefined;
  const fv = rt.finalValue?.value;
  if (fv !== undefined && fv !== null) {
    const n = Number(fv);
    if (Number.isFinite(n)) return n;
  }
  const v = rt.sensorValue?.value;
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 获取最新数据时间戳 */
function getLatestTimestamp(device: DustSensorDevice): number | undefined {
  const rt = device.metadata?.realtime;
  if (!rt) return undefined;
  const fv = rt.finalValue?.timestamp;
  const sv = rt.sensorValue?.timestamp;
  const candidates = [fv, sv].filter((t) => t !== undefined && Number.isFinite(t)) as number[];
  if (candidates.length === 0) return undefined;
  return Math.max(...candidates);
}

/** 数据陈旧度判断（协议 0x061e 30s 周期） */
function evaluateStaleness(
  lastTimestamp: number | undefined,
  now: number,
): { isStale: boolean; isVeryStale: boolean; ageSec: number } {
  if (!lastTimestamp) return { isStale: false, isVeryStale: false, ageSec: -1 };
  const ageSec = Math.max(0, Math.round((now - lastTimestamp) / 1000));
  return { isStale: ageSec >= 30, isVeryStale: ageSec >= 60, ageSec };
}

/** 报警阈值判断 */
function evaluateAlarmRange(
  value: number | undefined,
  md: { alarmLow?: number; alarmHigh?: number },
): { overHigh: boolean; underLow: boolean } {
  const result = { overHigh: false, underLow: false };
  if (value === undefined || !Number.isFinite(value)) return result;
  if (md.alarmHigh !== undefined && Number.isFinite(md.alarmHigh) && value > md.alarmHigh) result.overHigh = true;
  if (md.alarmLow !== undefined && Number.isFinite(md.alarmLow) && value < md.alarmLow) result.underLow = true;
  return result;
}

function getSensorColor(pc: string) {
  return DUST_COLORS[pc] ?? { bodyColor: "#607D8B", screenColor: "#5A9ED6", borderColor: "#455A64" };
}

function isDustSensor(pc: string): boolean {
  return DUST_FREQ_PC.has(pc) || DUST_ALARM_PC.has(pc);
}

function isDustFreqSensor(pc: string): boolean {
  return DUST_FREQ_PC.has(pc);
}

// ═══════════════════════════════════════════════════════════════════════════════

// 主组件
// ═══════════════════════════════════════════════════════════════════

export function DustTrendRenderer({ config }: ComponentRendererProps) {
  const title = (config.title as string) ?? "粉尘浓度趋势";
  const smooth = (config.smooth as boolean) ?? true;
  const areaStyle = (config.showArea as boolean) ?? ((config.areaStyle as boolean) ?? true);
  const showDataZoom = (config.showDataZoom as boolean) ?? true;
  const yAxisName = (config.yAxisName as string) ?? "mg/m³";
  const showSensorPortraits = (config.showSensorPortraits as boolean) ?? true;
  const valuePrecision = (config.valuePrecision as number) ?? 2;
  const warningRatio = (config.warningRatio as number) ?? 0.8;
  const historyEnabled = (config.historyEnabled as boolean) ?? true;
  const historyRange = (config.historyRange as string) ?? "1h";
  const historyAgg = (config.historyAgg as string) ?? "auto";
  const historyAutoRefresh = (config.historyAutoRefresh as boolean) ?? true;
  const yAxisMin = config.yAxisMin as number | null | undefined;
  const yAxisMax = config.yAxisMax as number | null | undefined;

  const rawSelectedIds = (config.selectedDeviceIds as string[]) ?? [];
  const devicesMap = useThrottledDevices(500);
  const getEffectiveOnline = useDeviceStore((s) => s.getEffectiveOnline);
  const sendCommand = useDeviceStore((s) => s.sendCommand);

  // UI tick - 1s 间隔确保状态及时刷新
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── 组件挂载时主动发送 0x061d 获取实时状态 ───
  // 不等 30s 定时器，立即触发一次，确保数据尽快到达
  useEffect(() => {
    // 集控器动态发现：未绑定 = 不显示任何设备（需绑定集控器后才下发 0x061d）
    const mcIds = discoverMainControllerIds(devicesMap, rawSelectedIds);
    if (mcIds.length === 0) return;
    logger.info("DustTrendRenderer", "组件挂载，主动发送 0x061d 获取实时状态", { mcIds });
    for (const id of mcIds) {
      void sendCommand(id, "061d").then((result) => {
        if (!result.success) {
          logger.warn("DustTrendRenderer", "0x061d 主动获取失败", { deviceId: id, code: result.code, msg: result.msg });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 层级发现：集控器->分控器->粉尘传感器 ───
  const { mainControllerIds, subControllerCount, dustSensors } = useMemo(() => {
    // 集控器动态发现：未绑定 = 不显示任何设备（需绑定集控器后才显示其下属分控器/传感器）
    const mcIds = discoverMainControllerIds(devicesMap, rawSelectedIds);

    const subIds = new Set<string>();
    for (const [, d] of Object.entries(devicesMap)) {
      const dev = d as Record<string, unknown>;
      const parentId = dev.parentDeviceId as string | undefined;
      if (isSubControllerDevice(dev) && parentId && mcIds.includes(parentId)) {
        subIds.add((dev.deviceId as string) ?? "");
      }
    }

    const sensors: DustSensorDevice[] = [];
    for (const [id, d] of Object.entries(devicesMap)) {
      const dev = d as Record<string, unknown>;
      const pc = String(dev.productCode ?? "");
      const parentId = dev.parentDeviceId as string | undefined;

      const isChildOfSub = parentId && subIds.has(parentId);
      const isChildOfMc = parentId && mcIds.includes(parentId);

      if (isDustSensor(pc) && (isChildOfSub || isChildOfMc)) {
        const md = (dev.metadata ?? {}) as Record<string, unknown>;
        const realtime = (md.realtime ?? {}) as Record<string, { value: unknown; timestamp: number; quality?: string }>;
        sensors.push({
          deviceId: id,
          productCode: pc,
          online: getEffectiveOnline(id),
          fault: Boolean((md as Record<string, unknown>)?.fault),
          parentDeviceId: parentId,
          metadata: {
            realtime,
            minRange: md.minRange as number | undefined,
            maxRange: md.maxRange as number | undefined,
            alarmLow: md.alarmLow as number | undefined,
            alarmHigh: md.alarmHigh as number | undefined,
            alias: md.alias as string | undefined,
            productName: dev.productName as string | undefined,
          },
        });
      }
    }

    return { mainControllerIds: mcIds, subControllerCount: subIds.size, dustSensors: sensors };
  }, [rawSelectedIds, devicesMap, getEffectiveOnline]);

  // ─── 频率型传感器（有数值数据的） ───
  const freqSensors = useMemo(() => dustSensors.filter((s) => isDustFreqSensor(s.productCode)), [dustSensors]);

  // ─── 选中传感器状态：控制哪些传感器的趋势线被渲染 ───
  // 默认全部选中；用户可点击画像切换
  const [selectedSensorIds, setSelectedSensorIds] = useState<Set<string>>(new Set());
  const [userInteracted, setUserInteracted] = useState(false);

  // 当传感器列表变化时，初始化选中状态（默认全选）
  useEffect(() => {
    if (!userInteracted) {
      setSelectedSensorIds(new Set(freqSensors.map((s) => s.deviceId)));
    }
  }, [freqSensors, userInteracted]);

  const toggleSensor = useCallback((deviceId: string) => {
    setUserInteracted(true);
    setSelectedSensorIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }, []);

  // ─── 滑动窗口：存储 [timestamp, value] ───
  const bufferRef = useRef<Map<string, SparkHistory>>(new Map());
  for (const sensor of freqSensors) {
    const v = extractSensorValue(sensor);
    if (v !== undefined) {
      const entry = bufferRef.current.get(sensor.deviceId);
      if (entry) {
        const lastPoint = entry.points[entry.points.length - 1];
        if (!lastPoint || lastPoint[1] !== v) {
          entry.points.push([Date.now(), v]);
          if (entry.points.length > 60) {
            entry.points.shift();
          }
        }
      } else {
        bufferRef.current.set(sensor.deviceId, {
          points: [[Date.now(), v]],
          maxLen: 60,
        });
      }
    }
  }

  // 清理已消失的传感器 buffer
  const currentSensorIds = new Set(freqSensors.map((s) => s.deviceId));
  for (const id of bufferRef.current.keys()) {
    if (!currentSensorIds.has(id)) bufferRef.current.delete(id);
  }

  // ─── 历史数据（GreptimeDB） ───
  const [historyData, setHistoryData] = useState<Map<string, [number, number][]>>(new Map());
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // 计算历史查询时间范围
  const getHistoryTimeRange = useCallback((range: string) => {
    const now = Date.now();
    const ranges: Record<string, number> = {
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };
    const ms = ranges[range] ?? ranges["1h"];
    return {
      from: new Date(now - ms).toISOString(),
      to: new Date(now).toISOString(),
    };
  }, []);

  // 根据数据精度配置和时间范围，决定 agg 和 step 参数
  const getAggParams = useCallback((range: string, aggMode: string) => {
    if (aggMode === "none") return { agg: undefined, step: undefined };
    if (aggMode === "5m") return { agg: "avg", step: "5m" };
    if (aggMode === "1h") return { agg: "avg", step: "1h" };
    // auto 模式：根据时间范围自动选择
    const autoMap: Record<string, { agg: string; step: string }> = {
      "30m": { agg: "avg", step: "1m" },
      "1h": { agg: "avg", step: "1m" },
      "6h": { agg: "avg", step: "5m" },
      "24h": { agg: "avg", step: "1h" },
      "7d": { agg: "avg", step: "1h" },
    };
    const strategy = autoMap[range] ?? { agg: "avg", step: "5m" };
    return { agg: strategy.agg, step: strategy.step };
  }, []);

  // 加载历史数据
  const loadHistoryData = useCallback(async (sensorIds: string[]) => {
    if (!historyEnabled || sensorIds.length === 0) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { from, to } = getHistoryTimeRange(historyRange);
      const { agg, step } = getAggParams(historyRange, historyAgg);
      const newHistoryMap = new Map<string, [number, number][]>();
      for (const sensorId of sensorIds) {
        try {
          const resp = await querySensorHistory({
            device_id: sensorId,
            type: "dust",
            from,
            to,
            limit: 2000,
            ...(agg ? { agg } : {}),
            ...(step ? { step } : {}),
          });
          const points: [number, number][] = (resp.data || [])
            .filter((r: SensorRecord) => r.value !== undefined && r.timestamp)
            .map((r: SensorRecord) => {
              const ts = typeof r.timestamp === "string" ? new Date(r.timestamp).getTime() : Number(r.timestamp);
              return [ts, Number(r.value)] as [number, number];
            })
            .sort((a, b) => a[0] - b[0]);
          if (points.length > 0) {
            newHistoryMap.set(sensorId, points);
          }
        } catch (err) {
          logger.warn("DustTrendRenderer", `加载传感器 ${sensorId} 历史数据失败`, { error: err });
        }
      }
      setHistoryData(newHistoryMap);
      logger.info("DustTrendRenderer", "历史数据加载完成", {
        sensorCount: newHistoryMap.size,
        totalPoints: Array.from(newHistoryMap.values()).reduce((sum, pts) => sum + pts.length, 0),
      });
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : String(err));
      logger.error("DustTrendRenderer", "历史数据加载失败", { error: err });
    } finally {
      setHistoryLoading(false);
    }
  }, [historyEnabled, historyRange, historyAgg, getHistoryTimeRange, getAggParams]);

  // 组件挂载或配置变化时加载历史数据
  useEffect(() => {
    if (!historyEnabled || freqSensors.length === 0) return;
    const sensorIds = freqSensors.map((s) => s.deviceId);
    void loadHistoryData(sensorIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEnabled, historyRange, freqSensors.map((s) => s.deviceId).join(",")]);

  // 自动刷新历史数据（每5分钟）
  useEffect(() => {
    if (!historyEnabled || !historyAutoRefresh || freqSensors.length === 0) return;
    const interval = setInterval(() => {
      const sensorIds = freqSensors.map((s) => s.deviceId);
      void loadHistoryData(sensorIds);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEnabled, historyAutoRefresh, historyRange, freqSensors.map((s) => s.deviceId).join(",")]);

  // ─── 三级空状态判断 ───
  const isUnbound = rawSelectedIds.length === 0 && mainControllerIds.length === 0;
  const hasNoSensors = mainControllerIds.length > 0 && dustSensors.length === 0;
  const hasSensorsNoData = freqSensors.length > 0 && freqSensors.every((s) => !s.metadata.realtime || Object.keys(s.metadata.realtime).length === 0);
  const hasRealData = freqSensors.some((s) => {
    const v = extractSensorValue(s);
    return v !== undefined;
  });

  // ─── 诊断日志：传感器发现 & 数据状态 ───
  const lastLogRef = useRef<string>("");
  useEffect(() => {
    const sensorSummary = dustSensors.map((s) => {
      const rt = s.metadata?.realtime ?? {};
      const rtKeys = Object.keys(rt);
      const fv = rt.finalValue;
      const sv = rt.sensorValue;
      const extracted = extractSensorValue(s);
      return {
        deviceId: s.deviceId,
        productCode: s.productCode,
        parentDeviceId: s.parentDeviceId,
        online: s.online,
        isFreq: isDustFreqSensor(s.productCode),
        realtimeKeys: rtKeys,
        finalValue: fv ? { value: fv.value, timestamp: fv.timestamp } : undefined,
        sensorValue: sv ? { value: sv.value, timestamp: sv.timestamp } : undefined,
        extractedValue: extracted,
      };
    });
    const logKey = JSON.stringify({
      count: dustSensors.length,
      freqCount: freqSensors.length,
      hasRealData,
      sensors: sensorSummary.map((s) => `${s.deviceId}:${s.extractedValue ?? "null"}`),
    });
    // 只在状态变化时记录（避免 1s tick 导致刷屏）
    if (logKey !== lastLogRef.current) {
      lastLogRef.current = logKey;
      logger.warn("DustTrendRenderer", "传感器诊断", {
        componentId: "comp_tunnel_5",
        isUnbound,
        hasNoSensors,
        hasSensorsNoData,
        hasRealData,
        mainControllerIds,
        subControllerCount,
        dustSensorCount: dustSensors.length,
        freqSensorCount: freqSensors.length,
        sensors: sensorSummary,
      });
    }
  }, [dustSensors, freqSensors, hasRealData, isUnbound, hasNoSensors, hasSensorsNoData, mainControllerIds, subControllerCount]);

  // ─── 传感器统计 ───
  const now = Date.now();
  const sensorStats = useMemo(() => {
    let online = 0, alarm = 0, offline = 0;
    for (const s of dustSensors) {
      const value = extractSensorValue(s);
      const alarmRange = evaluateAlarmRange(value, s.metadata);
      if (alarmRange.overHigh || alarmRange.underLow) { alarm++; continue; }
      if (s.fault) { alarm++; continue; }
      if (s.online) online++;
      else offline++;
    }
    return { total: dustSensors.length, online, alarm, offline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dustSensors, now]);

  // ─── ECharts option（时间轴 + 选中传感器折线） ───
  const option = useMemo(() => {
    if (!hasRealData) return null;

    const buffers = bufferRef.current;

    const seriesList: unknown[] = [];
    let seriesIndex = 0;

    // 按频率型传感器在列表中的顺序分配颜色
    for (let i = 0; i < freqSensors.length; i++) {
      const sensor = freqSensors[i];
      const buf = buffers.get(sensor.deviceId);
      if (!buf || buf.points.length < 1) continue;

      // 未选中的传感器不渲染
      if (!selectedSensorIds.has(sensor.deviceId)) continue;

      const color = DUST_CHART_COLORS[i % DUST_CHART_COLORS.length];
      const sensorName = getSensorLabel(sensor, i);
      // 合并历史数据和实时数据
      const histPoints = historyData.get(sensor.deviceId) || [];
      const realtimePoints = buf?.points || [];
      // 去重：实时数据时间戳大于历史数据最后一个点的时间戳时才追加
      const histLastTs = histPoints.length > 0 ? histPoints[histPoints.length - 1][0] : 0;
      const mergedRealtime = realtimePoints.filter((p) => p[0] > histLastTs);
      const data = [...histPoints, ...mergedRealtime];

      const seriesDef: Record<string, unknown> = {
        name: sensorName,
        type: "line",
        data,
        smooth,
        symbol: "circle",
        symbolSize: 3,
        showSymbol: false,
        lineStyle: { width: 1.8, color },
        itemStyle: { color },
        areaStyle: areaStyle
          ? {
              color: {
                type: "linear",
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: color + "33" },
                  { offset: 1, color: color + "05" },
                ],
              },
            }
          : undefined,
        // 最新数据点高亮
        markPoint: {
          symbol: "circle",
          symbolSize: 6,
          silent: true,
          data: [{
            coord: data[data.length - 1],
            itemStyle: { color, borderColor: "#fff", borderWidth: 1, shadowBlur: 8, shadowColor: color },
          }],
        },
      };

      // 告警阈值参考线（仅第一个被渲染的 series 添加）
      if (seriesIndex === 0) {
        const markLineData: unknown[] = [];
        const allAlarmHighs = freqSensors
          .map((s) => s.metadata.alarmHigh)
          .filter((v) => v !== undefined && Number.isFinite(v)) as number[];
        const allAlarmLows = freqSensors
          .map((s) => s.metadata.alarmLow)
          .filter((v) => v !== undefined && Number.isFinite(v)) as number[];

        if (allAlarmHighs.length > 0) {
          const maxHigh = Math.max(...allAlarmHighs);
          markLineData.push({
            yAxis: maxHigh,
            lineStyle: { color: "#ef4444", type: "dashed" as const, width: 1 },
            label: { show: true, formatter: `上限 ${maxHigh}`, color: "#ef4444", fontSize: 9, position: "insideEndTop" as const },
          });
          // 预警线（alarmHigh × warningRatio）
          const warningVal = maxHigh * warningRatio;
          markLineData.push({
            yAxis: warningVal,
            lineStyle: { color: "#f59e0b", type: "dashed" as const, width: 0.8, opacity: 0.6 },
            label: { show: true, formatter: `预警 ${warningVal.toFixed(1)}`, color: "#f59e0b", fontSize: 8, position: "insideEndTop" as const },
          });
        }
        if (allAlarmLows.length > 0) {
          const minLow = Math.min(...allAlarmLows);
          markLineData.push({
            yAxis: minLow,
            lineStyle: { color: "#ef4444", type: "dashed" as const, width: 1 },
            label: { show: true, formatter: `下限 ${minLow}`, color: "#ef4444", fontSize: 9, position: "insideEndBottom" as const },
          });
        }
        if (markLineData.length > 0) {
          seriesDef.markLine = { silent: true, symbol: "none", data: markLineData };
        }
      }

      seriesList.push(seriesDef);
      seriesIndex++;
    }

    return {
      title: { show: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(22,38,62,0.95)",
        borderColor: "rgba(100,180,255,0.35)",
        textStyle: { color: "#e0e8f0", fontSize: 11 },
        formatter: (params: unknown) => {
          const arr = params as Array<{ seriesName: string; value: [number, number]; color: string }>;
          if (!Array.isArray(arr) || arr.length === 0) return "";
          const ts = new Date(arr[0].value[0]).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
          let html = `<div style="font-size:10px;color:rgba(255,255,255,0.6);margin-bottom:4px">${ts}</div>`;
          for (const p of arr) {
            html += `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span style="color:${p.color}">${p.seriesName}</span><span style="color:#fff;font-weight:700;margin-left:auto">${p.value[1].toFixed(valuePrecision)} mg/m³</span></div>`;
          }
          return html;
        },
      },
      grid: {
        left: 44,
        right: 12,
        top: 10,
        bottom: 24,
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.6)",
          fontSize: 10,
          formatter: (val: number) => {
            return new Date(val).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: yAxisName,
        nameTextStyle: { color: "rgba(255,255,255,0.6)", fontSize: 10, padding: [0, 30, 0, 0] },
        axisLine: { show: false },
        axisLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
        scale: true,
        ...(yAxisMin != null && Number.isFinite(yAxisMin) ? { min: yAxisMin } : {}),
        ...(yAxisMax != null && Number.isFinite(yAxisMax) ? { max: yAxisMax } : {}),
      },
      dataZoom: showDataZoom ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series: seriesList,
      // 实时流式趋势图：关闭补间动画，避免每轮数据刷新(500ms)都跑 200ms tween，
      // 4K 下 echarts 画布(DPR=2 背板可达 7680 宽)重绘开销大；关动画后每次 setOption 仅一次轻量重绘，
      // 曲线仍实时跳变更新，对监控大屏无视觉功能损失。
      animation: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRealData, freqSensors, selectedSensorIds, smooth, areaStyle, showDataZoom, yAxisName, yAxisMin, yAxisMax, warningRatio, valuePrecision, now, historyData]);

  // ═══════════════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════════════

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(22,38,62,0.92) 0%, rgba(16,28,48,0.95) 100%)",
        border: "1px solid rgba(120,144,156,0.4)",
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
          py: 0.6,
          borderBottom: "1px solid rgba(120,144,156,0.3)",
          background: "linear-gradient(90deg, rgba(120,144,156,0.12), transparent)",
          flexShrink: 0,
        }}
      >
        <Box sx={{ width: 3, height: 14, background: "#B0BEC5", borderRadius: 0.5 }} />
        <Typography sx={{ fontSize: 13, color: "#B0BEC5", fontWeight: 700, letterSpacing: 1 }}>
          {title}
        </Typography>
        {historyLoading && (
          <Typography sx={{ fontSize: 9, color: "#FFC107", ml: 0.5 }}>加载历史…</Typography>
        )}
        {historyError && (
          <Tooltip title={historyError} arrow>
            <Typography sx={{ fontSize: 9, color: "#ef4444", ml: 0.5, cursor: "help" }}>历史数据错误</Typography>
          </Tooltip>
        )}
        {dustSensors.length > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
            <StatChip label="在线" value={sensorStats.online} color="#4caf50" />
            {sensorStats.alarm > 0 && <StatChip label="告警" value={sensorStats.alarm} color="#ef4444" />}
            {sensorStats.offline > 0 && <StatChip label="离线" value={sensorStats.offline} color="#6b7280" />}
          </Box>
        )}
      </Box>

      {/* ─── 三级空状态 ─── */}
      {isUnbound && (
        <EmptyState
          icon="🔗"
          title="请绑定集控器"
          description="在右侧属性面板选择集控器，自动发现其下属粉尘传感器"
        />
      )}

      {!isUnbound && hasNoSensors && (
        <EmptyState
          icon="🌫"
          title="未检测到粉尘传感器"
          description={`已发现 ${subControllerCount} 个分控器，但未检测到频率型粉尘传感器(productCode=18015)。请确认分控器下已配置粉尘传感器。`}
        />
      )}

      {!isUnbound && !hasNoSensors && hasSensorsNoData && !hasRealData && (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {/* 右上角画像浮层（等待数据态） */}
          {showSensorPortraits && dustSensors.length > 0 && (
            <SensorPortraitOverlay
              sensors={dustSensors}
              freqSensors={freqSensors}
              valuePrecision={valuePrecision}
              selectedIds={selectedSensorIds}
              onToggle={toggleSensor}
            />
          )}
          <EmptyState
            icon="⏳"
            title="等待实时数据推送"
            description="已发现粉尘传感器，等待 0x061e 协议推送实时数据（周期 30s）…"
            compact
          />
        </Box>
      )}

      {/* ─── 正常状态：折线图 + 右上角画像浮层 ─── */}
      {(hasRealData || (!isUnbound && !hasNoSensors && !hasSensorsNoData)) && (
        <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
          {/* 折线图 */}
          {option ? (
            <ReactEChartsCore
              echarts={echarts}
              option={option}
              style={{ width: "100%", height: "100%" }}
              notMerge={true}
              lazyUpdate={true}
            />
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                采集数据中…
              </Typography>
            </Box>
          )}

          {/* 右上角传感器画像浮层 */}
          {showSensorPortraits && dustSensors.length > 0 && (
            <SensorPortraitOverlay
              sensors={dustSensors}
              freqSensors={freqSensors}
              valuePrecision={valuePrecision}
              selectedIds={selectedSensorIds}
              onToggle={toggleSensor}
            />
          )}

          {/* 左下角提示（无选中传感器时） */}
          {selectedSensorIds.size === 0 && hasRealData && (
            <Box sx={{
              position: "absolute", left: "50%", top: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center", pointerEvents: "none",
            }}>
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                点击右上角传感器画像以显示趋势线
              </Typography>
            </Box>
          )}
        </Box>
      )}

    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 子组件
// ═══════════════════════════════════════════════════════════════════

/** 统计 chip */
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: color, boxShadow: `0 0 4px ${color}aa` }} />
      <Typography sx={{ fontSize: 10, color: "#90A4AE" }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color, fontWeight: 700, fontFamily: "monospace" }}>{value}</Typography>
    </Box>
  );
}

/** 空状态提示 */
function EmptyState({ icon, title, description, compact = false }: {
  icon: string; title: string; description: string; compact?: boolean;
}) {
  return (
    <Box
      sx={{
        flex: compact ? 0 : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: compact ? 1.5 : 4,
        px: 2,
        textAlign: "center",
      }}
    >
      <Typography sx={{ fontSize: compact ? 20 : 32, mb: 0.5 }}>{icon}</Typography>
      <Typography sx={{ fontSize: compact ? 12 : 14, color: "#a0d0e8", fontWeight: 600, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: compact ? 10 : 11, color: "#90A4AE", maxWidth: 360, lineHeight: 1.5 }}>
        {description}
      </Typography>
    </Box>
  );
}

/**
 * 传感器画像浮层 - 右上角垂直排列，可点击选择
 * 选中状态：边框高亮 + 折线颜色条
 * 未选中状态：半透明灰边框
 */
function SensorPortraitOverlay({ sensors, freqSensors, valuePrecision, selectedIds, onToggle }: {
  sensors: DustSensorDevice[];
  freqSensors: DustSensorDevice[];
  valuePrecision: number;
  selectedIds: Set<string>;
  onToggle: (deviceId: string) => void;
}) {
  return (
    <Box
      sx={{
        position: "absolute",
        top: 4,
        right: 4,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        padding: 0.5,
        borderRadius: 1,
        background: "rgba(40,58,82,0.92)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(160,190,220,0.4)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        maxWidth: 120,
        zIndex: 10,
      }}
    >
      {sensors.map((sensor) => {
        const freqIndex = freqSensors.findIndex((s) => s.deviceId === sensor.deviceId);
        const isSelected = selectedIds.has(sensor.deviceId);
        const chartColor = freqIndex >= 0 ? DUST_CHART_COLORS[freqIndex % DUST_CHART_COLORS.length] : undefined;

        return (
          <SensorPortraitMini
            key={sensor.deviceId}
            sensor={sensor}
            valuePrecision={valuePrecision}
            isSelected={isSelected}
            chartColor={chartColor}
            onClick={() => onToggle(sensor.deviceId)}
          />
        );
      })}
    </Box>
  );
}

/** 单个传感器迷你画像（右上角浮层中） */
function SensorPortraitMini({ sensor, valuePrecision, isSelected, chartColor, onClick }: {
  sensor: DustSensorDevice;
  valuePrecision: number;
  isSelected: boolean;
  chartColor?: string;
  onClick: () => void;
}) {
  const isFreq = isDustFreqSensor(sensor.productCode);
  const value = isFreq ? extractSensorValue(sensor) : undefined;
  const alarmRange = isFreq ? evaluateAlarmRange(value, sensor.metadata) : { overHigh: false, underLow: false };
  const colors = getSensorColor(sensor.productCode);

  // 陈旧度
  const latestTs = getLatestTimestamp(sensor);
  const staleness = evaluateStaleness(latestTs, Date.now());

  // 状态
  const isAlarm = alarmRange.overHigh || alarmRange.underLow || sensor.fault;
  const statusColor = isAlarm ? "#ef4444" : staleness.isVeryStale ? "#ffc107" : sensor.online ? "#4caf50" : "#6b7280";
  const statusText = alarmRange.overHigh ? "超限" : alarmRange.underLow ? "超限" : sensor.fault ? "故障" : staleness.isVeryStale ? "陈旧" : sensor.online ? "正常" : "离线";

  // 显示值
  const displayValue = isFreq
    ? (value !== undefined ? value.toFixed(valuePrecision) : (sensor.online ? "--" : "离线"))
    : (sensor.online ? "正常" : "离线");

  // 报警型传感器触发状态
  const rt = sensor.metadata?.realtime;
  const alarmTriggered = !isFreq && rt?.alarm?.value === true;

  // 频率型但无数据时不能选中
  const canSelect = isFreq && value !== undefined;

  return (
    <Tooltip
      arrow
      placement="left"
      enterDelay={300}
      title={
        <Box sx={{ p: 0.3, minWidth: 130 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.3, pb: 0.3, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: statusColor, boxShadow: `0 0 4px ${statusColor}aa` }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
              {isFreq ? "粉尘(频率)" : "粉尘(报警)"}
            </Typography>
            <Typography sx={{ fontSize: 9, color: statusColor, fontWeight: 600, ml: "auto" }}>{statusText}</Typography>
          </Box>
          {isFreq && value !== undefined && (
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.3, my: 0.3 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: isAlarm ? "#ef4444" : "#78909C", fontFamily: "monospace", lineHeight: 1 }}>
                {value.toFixed(valuePrecision)}
              </Typography>
              <Typography sx={{ fontSize: 9, color: "#b0bec5" }}>mg/m³</Typography>
            </Box>
          )}
          {!isFreq && (
            <Typography sx={{ fontSize: 11, color: alarmTriggered ? "#ef4444" : "#4caf50", fontWeight: 600 }}>
              {alarmTriggered ? "已触发" : "正常"}
            </Typography>
          )}
          {(sensor.metadata.alarmHigh !== undefined || sensor.metadata.alarmLow !== undefined) && (
            <Box sx={{ fontSize: 9, color: "#90A4AE", mt: 0.3 }}>
              {sensor.metadata.alarmHigh !== undefined && `上限: ${sensor.metadata.alarmHigh}  `}
              {sensor.metadata.alarmLow !== undefined && `下限: ${sensor.metadata.alarmLow}`}
            </Box>
          )}
          {canSelect && (
            <Box sx={{ fontSize: 8, color: isSelected ? chartColor : "#90A4AE", mt: 0.3, pt: 0.3, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              {isSelected ? "● 已选中 - 点击取消" : "○ 未选中 - 点击显示"}
            </Box>
          )}
        </Box>
      }
    >
      <Box
        onClick={canSelect ? onClick : undefined}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.4,
          px: 0.4,
          py: 0.3,
          borderRadius: 0.8,
          cursor: canSelect ? "pointer" : "default",
          background: isSelected
            ? `${chartColor}30`
            : isAlarm
              ? "rgba(239,68,68,0.15)"
              : "rgba(255,255,255,0.1)",
          border: `1.5px solid ${isSelected ? (chartColor ?? "#B0BEC5") + "cc" : isAlarm ? "#ef444466" : "rgba(160,190,220,0.25)"}`,
          opacity: canSelect ? (isSelected ? 1 : 0.85) : 0.65,
          transition: "all 0.2s",
          "&:hover": canSelect ? {
            opacity: 1,
            background: isSelected ? `${chartColor}40` : "rgba(160,190,220,0.2)",
            borderColor: isSelected ? (chartColor ?? "#B0BEC5") + "ee" : "rgba(160,190,220,0.5)",
          } : {},
        }}
      >
        {/* 迷你画像 */}
        <Box sx={{ width: 26, height: 40, flexShrink: 0, overflow: "hidden", borderRadius: 0.3, filter: "brightness(1.3)" }}>
          <DeviceComponentRenderer
            config={{
              deviceId: sensor.deviceId,
              productCode: sensor.productCode,
              variant: "control-panel",
              ...colors,
              animation: sensor.online && !sensor.fault ? "breathe" : undefined,
              animationDuration: 2000,
            }}
            componentId={`dust-trend-portrait-${sensor.deviceId}`}
            width={26}
            height={40}
            mode="preview"
          />
        </Box>

        {/* 数值 + 状态 */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.05, minWidth: 0, flex: 1, overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.3, flexWrap: "nowrap", overflow: "hidden" }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "monospace",
                color: isAlarm ? "#ef4444" : isSelected ? "#e8eef5" : "#b0bec5",
                lineHeight: 1.1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayValue}
            </Typography>
            {isFreq && value !== undefined && (
              <Typography sx={{ fontSize: 7, color: "#b0bec5", flexShrink: 0 }}>mg/m³</Typography>
            )}
            <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: statusColor, boxShadow: `0 0 3px ${statusColor}88`, flexShrink: 0, ml: "auto" }} />
          </Box>
          {isSelected && chartColor && (
            <Box sx={{ width: 10, height: 2, borderRadius: 1, background: chartColor, flexShrink: 0 }} />
          )}
        </Box>
      </Box>
    </Tooltip>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

function getSensorLabel(sensor: DustSensorDevice | undefined, index: number): string {
  if (!sensor) return `粉尘#${index + 1}`;
  const alias = sensor.metadata?.alias as string | undefined;
  const productName = sensor.metadata?.productName as string | undefined;
  if (alias && alias.trim()) return alias.trim();
  if (productName && productName.trim()) return productName.trim();

  const id = sensor.deviceId || "";
  const parts = id.split("_");
  if (parts.length >= 3) {
    const ctrlId = parts[parts.length - 2];
    const sensorPart = parts[parts.length - 1];
    return `粉尘#${ctrlId}-${sensorPart.replace("f", "")}`;
  }
  return `粉尘#${index + 1}`;
}
