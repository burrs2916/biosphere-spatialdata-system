/**
 * ShearerPositionCurveRenderer - 煤机位置趋势曲线（综采工作面）
 *
 * 数据流（与 DustTrendRenderer 一致，但聚焦单一集控器级 tag）：
 *   config.selectedDeviceIds -> 集控器(pc=18)
 *     -> 0x061e 顶层 coalPosition/motionDirection 字段 -> deviceStore.devices.metadata.realtime
 *        -> 提取 coalMachine.coalPosition 实时值（滑动窗口 60 点）
 *     -> GreptimeDB sensor_samples(sensor_type="coalMachine.coalPosition") -> querySensorHistory API -> 历史合并
 *
 * 与老项目 sprayv2/showzc 的 chart_meijiquxian(煤机曲线) 等价：
 *   老项目 listval 历史 10 点 + getMeijiPos 定时轮询滑动窗口；
 *   本组件复用 DustTrend 模式（deviceStore 实时 + GreptimeDB 历史），且历史深度由 historyRange 决定。
 *
 * 落库侧见 edge-conductor data_processor.rs(W6 bypass)：
 *   每帧 0x061e 解析后写 sensor_samples(coalMachine.coalPosition / coalMachine.motionDirection)。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { echarts } from "../echarts/echartsCore";
import { useDeviceStore } from "../../../store/deviceStore";
import { useThrottledDevices } from "../../../hooks/useThrottledDevices";
import { logger } from "../../../utils/logger";
import type { ComponentRendererProps } from "../../../types/editor";
import { querySensorHistory } from "../../../services/historyApi";
import type { SensorRecord } from "../../../services/historyApi";

// ═══════════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════════

const MAIN_CONTROLLER_PC = new Set(["18", "FY002-MainController"]);
const TAG_POSITION = "coalMachine.coalPosition";
const TAG_DIRECTION = "coalMachine.motionDirection";
const CHART_COLORS = ["#5A9ED6", "#8d6e63", "#90A4AE", "#A1887F", "#B0BEC5", "#4DB6AC"];
const DIRECTION_LABEL: Record<number, string> = { 0: "停止", 1: "上风向", 2: "下风向" };

/** 集控器（煤机位置上报设备）精简视图 */
interface McDevice {
  deviceId: string;
  productCode: string;
  online: boolean;
  parentDeviceId?: string;
}

/** 滑动窗口条目：[timestamp, value] */
interface SparkHistory {
  points: [number, number][];
  maxLen: number;
}

/** 从设备实时 tag 中提取煤机位置数值 */
function extractPosition(dev: Record<string, unknown> | undefined): number | undefined {
  const rt = (dev?.metadata as Record<string, unknown> | undefined)?.realtime as
    | Record<string, { value: unknown; timestamp?: number }>
    | undefined;
  if (!rt) return undefined;
  const v = rt[TAG_POSITION]?.value;
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ═══════════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════════

export function ShearerPositionCurveRenderer({ config }: ComponentRendererProps) {
  const title = (config.title as string) ?? "煤机位置曲线";
  const smooth = (config.smooth as boolean) ?? true;
  const areaStyle = (config.showArea as boolean) ?? true;
  const showDataZoom = (config.showDataZoom as boolean) ?? true;
  const yAxisName = (config.yAxisName as string) ?? "位置(号)";
  const valuePrecision = (config.valuePrecision as number) ?? 0;
  const historyEnabled = (config.historyEnabled as boolean) ?? true;
  const historyRange = (config.historyRange as string) ?? "6h";
  const historyAgg = (config.historyAgg as string) ?? "auto";
  const historyAutoRefresh = (config.historyAutoRefresh as boolean) ?? true;
  const yAxisMin = config.yAxisMin as number | null | undefined;
  const yAxisMax = config.yAxisMax as number | null | undefined;
  const showLegend = (config.showLegend as boolean) ?? true;
  const showDirection = (config.showDirection as boolean) ?? true;

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
  useEffect(() => {
    if (rawSelectedIds.length === 0) return;
    const mcIds = rawSelectedIds.filter((id) => {
      const d = devicesMap[id] as Record<string, unknown> | undefined;
      return d ? MAIN_CONTROLLER_PC.has(String(d.productCode ?? "")) : false;
    });
    if (mcIds.length === 0) return;
    logger.info("ShearerPositionCurve", "组件挂载，主动发送 0x061d", { mcIds });
    for (const id of mcIds) void sendCommand(id, "061d");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 发现集控器：严格绑定，仅纳入已勾选的集控器（未绑定=不显示）───
  const mcDevices = useMemo(() => {
    const sel = rawSelectedIds;
    const list: McDevice[] = [];
    for (const [id, d] of Object.entries(devicesMap)) {
      const dev = d as Record<string, unknown>;
      const pc = String(dev.productCode ?? "");
      if (!MAIN_CONTROLLER_PC.has(pc)) continue;
      if (!sel.includes(id)) continue;
      list.push({
        deviceId: id,
        productCode: pc,
        online: getEffectiveOnline(id),
        parentDeviceId: dev.parentDeviceId as string | undefined,
      });
    }
    return list;
  }, [rawSelectedIds, devicesMap, getEffectiveOnline]);

  // ─── 实时滑动窗口 ───
  const bufferRef = useRef<Map<string, SparkHistory>>(new Map());
  for (const dev of mcDevices) {
    const v = extractPosition(devicesMap[dev.deviceId] as Record<string, unknown> | undefined);
    if (v !== undefined) {
      const pt: [number, number] = [Date.now(), v];
      const entry = bufferRef.current.get(dev.deviceId);
      if (entry) {
        const last = entry.points[entry.points.length - 1];
        if (!last || last[1] !== v) {
          entry.points.push(pt);
          if (entry.points.length > 60) entry.points.shift();
        }
      } else {
        bufferRef.current.set(dev.deviceId, { points: [pt], maxLen: 60 });
      }
    }
  }
  const curIds = new Set(mcDevices.map((d) => d.deviceId));
  for (const id of bufferRef.current.keys()) {
    if (!curIds.has(id)) bufferRef.current.delete(id);
  }

  // ─── 历史数据（GreptimeDB） ───
  const [history, setHistory] = useState<Map<string, [number, number][]>>(new Map());
  const [loading, setLoading] = useState(false);

  const getRange = useCallback((r: string) => {
    const now = Date.now();
    const ms: Record<string, number> = {
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };
    const m = ms[r] ?? ms["6h"];
    return { from: new Date(now - m).toISOString(), to: new Date(now).toISOString() };
  }, []);

  const getAgg = useCallback((r: string, a: string) => {
    if (a === "none") return { agg: undefined, step: undefined };
    if (a === "5m") return { agg: "avg", step: "5m" };
    if (a === "1h") return { agg: "avg", step: "1h" };
    const auto: Record<string, { agg: string; step: string }> = {
      "30m": { agg: "avg", step: "1m" },
      "1h": { agg: "avg", step: "1m" },
      "6h": { agg: "avg", step: "5m" },
      "24h": { agg: "avg", step: "1h" },
      "7d": { agg: "avg", step: "1h" },
    };
    return auto[r] ?? { agg: "avg", step: "5m" };
  }, []);

  const loadHistory = useCallback(async () => {
    if (!historyEnabled || mcDevices.length === 0) return;
    setLoading(true);
    try {
      const { from, to } = getRange(historyRange);
      const { agg, step } = getAgg(historyRange, historyAgg);
      // 按 sensor_type 查询（不限定 device_id，返回所有上报煤机位置的集控器）
      const resp = await querySensorHistory({
        type: TAG_POSITION,
        from,
        to,
        limit: 3000,
        ...(agg ? { agg } : {}),
        ...(step ? { step } : {}),
      });
      const map = new Map<string, [number, number][]>();
      for (const r of (resp.data || []) as SensorRecord[]) {
        if (r.value === undefined || !r.timestamp) continue;
        const ts = typeof r.timestamp === "string" ? new Date(r.timestamp).getTime() : Number(r.timestamp);
        const did = r.device_id ?? "unknown";
        const arr = map.get(did) ?? [];
        arr.push([ts, Number(r.value)]);
        map.set(did, arr);
      }
      for (const arr of map.values()) arr.sort((a, b) => a[0] - b[0]);
      setHistory(map);
      logger.info("ShearerPositionCurve", "历史数据加载完成", {
        deviceCount: map.size,
        totalPoints: Array.from(map.values()).reduce((s, p) => s + p.length, 0),
      });
    } catch (e) {
      logger.warn("ShearerPositionCurve", "历史数据加载失败", { error: e });
    } finally {
      setLoading(false);
    }
  }, [historyEnabled, historyRange, historyAgg, getRange, getAgg, mcDevices.map((d) => d.deviceId).join(",")]);

  useEffect(() => {
    if (!historyEnabled || mcDevices.length === 0) return;
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEnabled, historyRange, mcDevices.map((d) => d.deviceId).join(",")]);

  useEffect(() => {
    if (!historyEnabled || !historyAutoRefresh || mcDevices.length === 0) return;
    const i = setInterval(() => void loadHistory(), 5 * 60 * 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyEnabled, historyAutoRefresh, historyRange, mcDevices.map((d) => d.deviceId).join(",")]);

  // ─── 最新位置 / 方向 ───
  const latest = useMemo(() => {
    let pos: number | undefined;
    let dir: number | undefined;
    for (const dev of mcDevices) {
      const d = devicesMap[dev.deviceId] as Record<string, unknown> | undefined;
      const rt = (d?.metadata as Record<string, unknown> | undefined)?.realtime as
        | Record<string, { value: unknown }>
        | undefined;
      const p = rt?.[TAG_POSITION]?.value;
      const dr = rt?.[TAG_DIRECTION]?.value;
      if (p !== undefined && p !== null && Number.isFinite(Number(p))) pos = Number(p);
      if (dr !== undefined && dr !== null && Number.isFinite(Number(dr))) dir = Number(dr);
    }
    return { pos, dir };
  }, [mcDevices, devicesMap]);

  const hasReal = mcDevices.some((dev) => extractPosition(devicesMap[dev.deviceId] as Record<string, unknown> | undefined) !== undefined);

  // ─── ECharts option ───
  const option = useMemo(() => {
    if (!hasReal) return null;
    const seriesList: unknown[] = [];
    let idx = 0;
    for (const dev of mcDevices) {
      const buf = bufferRef.current.get(dev.deviceId);
      if (!buf || buf.points.length < 1) continue;
      const color = CHART_COLORS[idx % CHART_COLORS.length];
      const hist = history.get(dev.deviceId) || [];
      const histLast = hist.length > 0 ? hist[hist.length - 1][0] : 0;
      const merged = buf.points.filter((p) => p[0] > histLast);
      const data = [...hist, ...merged];
      if (data.length === 0) continue;
      seriesList.push({
        name: dev.deviceId,
        type: "line",
        data,
        smooth,
        showSymbol: false,
        symbolSize: 3,
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
        markPoint: {
          symbol: "circle",
          symbolSize: 6,
          silent: true,
          data: [{ coord: data[data.length - 1], itemStyle: { color, borderColor: "#fff", borderWidth: 1, shadowBlur: 8, shadowColor: color } }],
        },
      });
      idx++;
    }
    if (seriesList.length === 0) return null;
    return {
      title: { show: false },
      legend: showLegend ? {
        top: 2, right: 8, type: "scroll",
        icon: "roundRect", itemWidth: 10, itemHeight: 4,
        textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 10 },
      } : undefined,
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
            html += `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span style="color:${p.color}">${p.seriesName}</span><span style="color:#fff;font-weight:700;margin-left:auto">${p.value[1].toFixed(valuePrecision)}</span></div>`;
          }
          return html;
        },
      },
      grid: { left: 44, right: 12, top: showLegend ? 24 : 10, bottom: 24 },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.6)",
          fontSize: 10,
          formatter: (val: number) => new Date(val).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" }),
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
      // 实时流式曲线：关闭补间动画（同 DustTrendRenderer P4），避免每轮刷新跑 tween 重绘 4K 画布。
      animation: false,
    };
  }, [hasReal, mcDevices, smooth, areaStyle, showDataZoom, showLegend, yAxisName, yAxisMin, yAxisMax, valuePrecision, history]);

  const dirText = latest.dir !== undefined ? DIRECTION_LABEL[latest.dir] ?? String(latest.dir) : "—";

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
      {/* 标题栏 */}
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
        <Box sx={{ width: 3, height: 14, background: "#5A9ED6", borderRadius: 0.5 }} />
        <Typography sx={{ fontSize: 13, color: "#B0BEC5", fontWeight: 700, letterSpacing: 1 }}>{title}</Typography>
        {latest.pos !== undefined && (
          <Typography sx={{ fontSize: 11, color: "#5A9ED6", fontWeight: 700, ml: 0.5, fontFamily: "monospace" }}>
            位置 {latest.pos.toFixed(valuePrecision)}
          </Typography>
        )}
        {showDirection && (
          <Typography sx={{ fontSize: 10, color: "#90A4AE", ml: 0.5 }}>方向 {dirText}</Typography>
        )}
        {loading && <Typography sx={{ fontSize: 9, color: "#FFC107", ml: "auto" }}>加载历史…</Typography>}
      </Box>

      {/* 主体 */}
      {mcDevices.length === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            等待集控器推送煤机位置(0x061e)…
          </Typography>
        </Box>
      ) : option ? (
        <ReactEChartsCore echarts={echarts} option={option} style={{ width: "100%", height: "100%" }} notMerge={true} lazyUpdate={true} />
      ) : (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>采集数据中…</Typography>
        </Box>
      )}
    </Box>
  );
}
