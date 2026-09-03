/**
 * OperationResultDonut - 操作结果分布环形图
 *
 * 数据源：/api/history/log-monitor/operations（按 scope.device_ids 过滤）
 * 聚合：client 侧按 result groupBy count（ok / fail / partial / pending）
 * UI：ECharts donut + 中心"成功率 %"数字（与 LogOverviewCards "指令成功率"卡呼应）
 *
 * 价值：比"操作成功率: 92.5%"单数字更直观——一眼看到 ok/fail/partial/pending 的占比关系。
 *
 * 重用约定：与同视图 echarts 共享 chartFrame。
 */
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useEffect, useMemo, useState } from "react";
import {
  echarts,
  calcFontScale,
  chartFontSizes,
} from "../echarts/echartsCore";
import type { ComponentRendererProps } from "../../../types/editor";
import { useLogMonitorStore, buildQueryScope } from "../../../store/logMonitorStore";
import {
  queryLogMonitorOperations,
} from "../../../services/logMonitorApi";
import { logger } from "../../../utils/logger";
import { ChartFrame, ChartCenter, recentTimeRangeIso } from "./chartFrame";

interface Slice {
  name: string;
  value: number;
  color: string;
  resultKey: string;
}

const RESULT_PALETTE: Record<string, string> = {
  ok: "#4caf50",
  fail: "#ef4444",
  partial: "#F8B448",
  pending: "#5A9ED6",
};

const RESULT_LABEL: Record<string, string> = {
  ok: "成功",
  fail: "失败",
  partial: "部分",
  pending: "等待",
};

export default function OperationResultDonut({
  config,
  width,
  height,
}: ComponentRendererProps) {
  const title = (config.title as string) ?? "操作结果分布";
  const limit = (config.limit as number) ?? 1000;

  const [slices, setSlices] = useState<Slice[]>([]);
  const [total, setTotal] = useState(0);
  const [okCount, setOkCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sceneDeviceIds = useLogMonitorStore((s) => s.sceneDeviceIds);
  const scopeMode = useLogMonitorStore((s) => s.scopeMode);
  const selectedDeviceIds = useLogMonitorStore((s) => s.selectedDeviceIds);
  const refreshNonce = useLogMonitorStore((s) => s.refreshNonce);
  const logLevel = useLogMonitorStore((s) => s.logLevel);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const range = recentTimeRangeIso(24);
        const scope = buildQueryScope({ selectedDeviceIds, scopeMode, sceneDeviceIds });
        // 日志级别 → result 映射（与操作日志表一致：错误→fail / 信息→ok / 警告·全部→不映射）
        let resultFilter: string | undefined;
        if (logLevel === "error") resultFilter = "fail";
        else if (logLevel === "info") resultFilter = "ok";
        const resp = await queryLogMonitorOperations({
          from: range.from,
          to: range.to,
          scope,
          result: resultFilter,
          limit,
          offset: 0,
        });
        if (cancelled) return;

        const counts = new Map<string, number>();
        let totalLocal = 0;
        for (const op of resp.data) {
          const r = ((op as { result?: string }).result ?? "unknown").toLowerCase();
          counts.set(r, (counts.get(r) ?? 0) + 1);
          totalLocal++;
        }

        const sorted: Slice[] = ["ok", "fail", "partial", "pending"]
          .filter((k) => (counts.get(k) ?? 0) > 0)
          .map((k) => ({
            name: RESULT_LABEL[k],
            value: counts.get(k) ?? 0,
            color: RESULT_PALETTE[k],
            resultKey: k,
          }));

        setSlices(sorted);
        setTotal(totalLocal);
        setOkCount(counts.get("ok") ?? 0);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("OperationResultDonut", "load failed", { error: msg });
        setError(msg);
        setSlices([]);
        setTotal(0);
        setOkCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneDeviceIds, scopeMode, selectedDeviceIds, limit, refreshNonce, logLevel]);

  const option = useMemo(() => {
    const scale = calcFontScale(width, height);
    const fs = chartFontSizes(scale);
    const successRate = total > 0 ? Math.round((okCount / total) * 1000) / 10 : 0;

    return {
      title: { show: false },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(22,38,62,0.95)",
        borderColor: "rgba(100,180,255,0.35)",
        textStyle: { color: "#e0e8f0", fontSize: fs.tooltip },
        formatter: (p: unknown) => {
          const it = p as { name: string; value: number; percent: number; color: string };
          return `<div style="font-size:11px"><span style="color:${it.color}">●</span> ${it.name}<br/>次数: <b>${it.value}</b> (${it.percent.toFixed(1)}%)</div>`;
        },
      },
      legend: {
        bottom: 8,
        left: "center",
        textStyle: { color: "rgba(255,255,255,0.7)", fontSize: fs.legend },
        itemGap: 12,
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          name: "结果",
          type: "pie",
          radius: ["52%", "72%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "rgba(22,38,62,0.95)", borderWidth: 1 },
          label: { show: false },
          emphasis: {
            label: { show: true, color: "#fff", fontSize: fs.label },
            itemStyle: { shadowBlur: 12 },
          },
          data: slices.map((s) => ({
            name: s.name,
            value: s.value,
            itemStyle: { color: s.color },
          })),
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "36%",
          style: {
            text: `${successRate}%`,
            fill: successRate >= 90 ? "#4caf50" : successRate >= 70 ? "#F8B448" : "#ef4444",
            fontSize: fs.title + 4,
            fontWeight: 700,
          },
        },
        {
          type: "text",
          left: "center",
          top: "50%",
          style: {
            text: "成功率",
            fill: "rgba(255,255,255,0.55)",
            fontSize: fs.axisLabelSmall,
          },
        },
      ],
      animation: true,
      animationDuration: 600,
    };
  }, [slices, width, height, total, okCount]);

  return (
    <ChartFrame title={title} subtitle="近 24 小时">
      {loading ? (
        <ChartCenter><CircularProgress size={24} sx={{ color: "rgba(90,158,214,0.7)" }} /></ChartCenter>
      ) : error ? (
        <ChartCenter><Typography sx={{ fontSize: 12, color: "#ef4444" }}>{error}</Typography></ChartCenter>
      ) : slices.length === 0 ? (
        <ChartCenter><Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.4)" }}>暂无结果数据</Typography></ChartCenter>
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
