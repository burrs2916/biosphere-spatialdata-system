/**
 * AlarmTrendStacked - 事件级别堆叠面积（升级版 alarm-trend）
 *
 * 数据源：/api/history/log-monitor/events（按 scope.device_ids 过滤）
 * 聚合：client 侧按 ts（hour bucket） × event_level（info/warn/error）groupBy count
 * UI：ECharts stacked area（三层 info/warn/error）× 24h 时间轴
 *
 * 与旧版 AlarmTrendChart 区别（后者已于 2026-08-22 删除）：
 *   - 旧版：单色 bar（error only，hour count）
 *   - 本组件：堆叠 area（info/warn/error 三层，hour count）—— **严格超集**
 *
 * 重用约定：与同视图 echarts 共享 chartFrame。
 */
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useEffect, useMemo, useState } from "react";
import {
  echarts,
  PALETTE,
  createAreaGradient,
  calcFontScale,
  chartFontSizes,
} from "../echarts/echartsCore";
import type { ComponentRendererProps } from "../../../types/editor";
import { useLogMonitorStore, buildQueryScope } from "../../../store/logMonitorStore";
import {
  queryLogMonitorEvents,
} from "../../../services/logMonitorApi";
import type { DeviceEvent } from "../../../services/historyApi";
import { logger } from "../../../utils/logger";
import { ChartFrame, ChartCenter, recentTimeRangeIso } from "./chartFrame";

interface Bucket {
  hour: string;
  info: number;
  warn: number;
  error: number;
}

const LEVEL_PALETTE = {
  info: "#5A9ED6",
  warn: "#F8B448",
  error: "#ef4444",
} as const;

export default function AlarmTrendStacked({
  config,
  width,
  height,
}: ComponentRendererProps) {
  const title = (config.title as string) ?? "事件级别趋势";
  const hours = (config.hours as number) ?? 24;
  const limit = (config.limit as number) ?? 5000;

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sceneDeviceIds = useLogMonitorStore((s) => s.sceneDeviceIds);
  const scopeMode = useLogMonitorStore((s) => s.scopeMode);
  const selectedDeviceIds = useLogMonitorStore((s) => s.selectedDeviceIds);
  const storeTimeRange = useLogMonitorStore((s) => s.timeRange);
  const refreshNonce = useLogMonitorStore((s) => s.refreshNonce);
  const logLevel = useLogMonitorStore((s) => s.logLevel);
  const eventType = useLogMonitorStore((s) => s.eventType);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = recentTimeRangeIso(hours);
        const resp = await queryLogMonitorEvents({
          from: range.from,
          to: range.to,
          scope: buildQueryScope({ selectedDeviceIds, scopeMode, sceneDeviceIds }),
          // 与事件表一致：级别/类型跟随左侧筛选（全部=不传）
          type: eventType !== "all" ? eventType : undefined,
          level: logLevel !== "all" ? logLevel : undefined,
          limit,
          offset: 0,
        });
        if (cancelled) return;
        setBuckets(bucketByHourLevel(resp.data, range.from, range.to));
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("AlarmTrendStacked", "load failed", { error: msg });
        setError(msg);
        setBuckets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, sceneDeviceIds, scopeMode, selectedDeviceIds, limit, storeTimeRange.from, storeTimeRange.to, refreshNonce, logLevel, eventType]);

  const option = useMemo(() => {
    const scale = calcFontScale(width, height);
    const fs = chartFontSizes(scale);

    const categories = buckets.map((b) => b.hour);
    const infoArr = buckets.map((b) => b.info);
    const warnArr = buckets.map((b) => b.warn);
    const errArr = buckets.map((b) => b.error);

    return {
      title: { show: false },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(22,38,62,0.95)",
        borderColor: "rgba(100,180,255,0.35)",
        textStyle: { color: "#e0e8f0", fontSize: fs.tooltip },
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(90,158,214,0.08)" } },
        formatter: (params: unknown) => {
          const arr = params as Array<{ axisValue: string; seriesName: string; value: number; color: string }>;
          if (!Array.isArray(arr) || arr.length === 0) return "";
          const total = arr.reduce((s, x) => s + (x.value ?? 0), 0);
          const lines = arr.map(
            (x) => `<span style="color:${x.color}">●</span> ${x.seriesName}: <b>${x.value}</b>`,
          );
          return `<div style="font-size:11px">${arr[0].axisValue}<br/>${lines.join("<br/>")}<br/>合计: <b>${total}</b></div>`;
        },
      },
      legend: {
        top: 6,
        right: 12,
        textStyle: { color: "rgba(255,255,255,0.7)", fontSize: fs.legend },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 8,
      },
      grid: { left: 40, right: 16, top: 32, bottom: 28 },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.6)",
          fontSize: fs.axisLabelSmall,
          rotate: categories.length > 16 ? 0 : 0,
          interval: categories.length > 16 ? 1 : 0,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "事件数",
        nameTextStyle: { color: "rgba(255,255,255,0.5)", fontSize: fs.axisLabelSmall },
        axisLine: { show: false },
        axisLabel: { color: "rgba(255,255,255,0.6)", fontSize: fs.axisLabelSmall },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        minInterval: 1,
      },
      color: [LEVEL_PALETTE.info, LEVEL_PALETTE.warn, LEVEL_PALETTE.error],
      series: [
        {
          name: "info",
          type: "line",
          stack: "level",
          data: infoArr,
          smooth: true,
          symbol: "none",
          areaStyle: { color: createAreaGradient(LEVEL_PALETTE.info, 0.35) },
          lineStyle: { width: 1.5, color: LEVEL_PALETTE.info },
        },
        {
          name: "warn",
          type: "line",
          stack: "level",
          data: warnArr,
          smooth: true,
          symbol: "none",
          areaStyle: { color: createAreaGradient(LEVEL_PALETTE.warn, 0.35) },
          lineStyle: { width: 1.5, color: LEVEL_PALETTE.warn },
        },
        {
          name: "error",
          type: "line",
          stack: "level",
          data: errArr,
          smooth: true,
          symbol: "none",
          areaStyle: { color: createAreaGradient(LEVEL_PALETTE.error, 0.4) },
          lineStyle: { width: 1.5, color: LEVEL_PALETTE.error },
        },
      ],
      animation: true,
      animationDuration: 500,
      // 静音未使用色引用
      palette: PALETTE,
    } as unknown as Record<string, unknown>;
  }, [buckets, width, height]);

  return (
    <ChartFrame title={title} subtitle={`近 ${hours} 小时`}>
      {loading ? (
        <ChartCenter><CircularProgress size={24} sx={{ color: "rgba(90,158,214,0.7)" }} /></ChartCenter>
      ) : error ? (
        <ChartCenter><Typography sx={{ fontSize: 12, color: "#ef4444" }}>{error}</Typography></ChartCenter>
      ) : buckets.length === 0 ? (
        <ChartCenter><Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.4)" }}>暂无事件数据</Typography></ChartCenter>
      ) : (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ width: "100%", height: "100%" }}
          notMerge={true}
          lazyUpdate={true}
        />
      )}
    </ChartFrame>
  );
}

/**
 * 将事件列表按小时桶 × 级别（info/warn/error）分桶
 * 生成从 from 到 to 的完整小时序列（即使某小时无事件也显示0）
 */
function bucketByHourLevel(
  events: DeviceEvent[],
  fromIso: string,
  toIso: string,
): Bucket[] {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (isNaN(from) || isNaN(to) || to <= from) return [];

  // 对齐到整点
  const startHour = new Date(from);
  startHour.setMinutes(0, 0, 0);
  const buckets: Bucket[] = [];
  const bucketMap = new Map<number, number>();

  let cursor = startHour.getTime();
  while (cursor <= to) {
    const d = new Date(cursor);
    const pad = (n: number) => String(n).padStart(2, "0");
    const label = `${pad(d.getHours())}:00`;
    buckets.push({ hour: label, info: 0, warn: 0, error: 0 });
    bucketMap.set(cursor, buckets.length - 1);
    cursor += 60 * 60 * 1000;
    if (buckets.length > 168) break; // 安全上限：7天
  }

  for (const ev of events) {
    // 后端事件原始字段为 ts（logMonitorApi 不做 ts→timestamp 归一化），timestamp 仅作兼容兜底
    const tsRaw = (ev as Record<string, unknown>).ts ?? (ev as Record<string, unknown>).timestamp;
    const t = typeof tsRaw === "number"
      ? (tsRaw < 1e12 ? tsRaw * 1000 : tsRaw)
      : new Date(String(tsRaw)).getTime();
    if (isNaN(t)) continue;
    const hourBucket = new Date(t);
    hourBucket.setMinutes(0, 0, 0);
    const idx = bucketMap.get(hourBucket.getTime());
    if (idx === undefined) continue;
    // 后端事件原始字段为 event_level（logMonitorApi 不做字段归一化），level 仅作兼容兜底
    const lvl = String(
      (ev as Record<string, unknown>).event_level ?? (ev as Record<string, unknown>).level ?? "",
    ).toLowerCase();
    if (lvl === "info" || lvl === "warn" || lvl === "error") {
      const b = buckets[idx] as unknown as Record<string, number>;
      b[lvl] = (b[lvl] ?? 0) + 1;
    }
  }

  return buckets;
}
