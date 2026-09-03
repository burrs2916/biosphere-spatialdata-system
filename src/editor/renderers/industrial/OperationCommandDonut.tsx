/**
 * OperationCommandDonut - 操作命令分布环形图
 *
 * 数据源：/api/history/log-monitor/operations（按 scope.device_ids 过滤）
 * 聚合：client 侧按 command_code groupBy count
 * UI：ECharts donut + 中心"今日命令数"数字 + 自动按 command_code 着色
 *
 * 重用约定：
 * - logMonitorStore + logMonitorApi（已支持 scene scope）
 * - 复用 echartsCore 的 PALETTE / calcFontScale / chartFontSizes
 * - 与同视图其它 echart 共享 chartFrame 外框
 */
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useEffect, useMemo, useState } from "react";
import {
  echarts,
  PALETTE,
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

interface CmdSlice {
  name: string;
  value: number;
}

// 协议命令中文标签（按 MEMORY/协议.txt 真源；缺则回退到 code 本身）
const COMMAND_LABEL: Record<string, string> = {
  "060e": "获取传感器设置",
  "0619": "喷雾控制 v1",
  "061b": "循环喷洒设置",
  "0628": "喷雾控制 v2",
};

function labelOf(code: string): string {
  if (!code) return "未知";
  const k = code.toLowerCase();
  return COMMAND_LABEL[k] ? `${k} ${COMMAND_LABEL[k]}` : k;
}

export default function OperationCommandDonut({
  config,
  width,
  height,
}: ComponentRendererProps) {
  const title = (config.title as string) ?? "操作命令分布";
  const limit = (config.limit as number) ?? 1000;

  const [slices, setSlices] = useState<CmdSlice[]>([]);
  const [total, setTotal] = useState(0);
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

        const map = new Map<string, number>();
        for (const op of resp.data) {
          const code = (op as { command_code?: string }).command_code ?? "";
          if (!code) continue;
          map.set(code, (map.get(code) ?? 0) + 1);
        }
        const arr = Array.from(map, ([name, value]) => ({ name: labelOf(name), value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 12); // Top12，剩余合并为"其它"以保持焦点
        const used = arr.reduce((s, x) => s + x.value, 0);
        const rest = (resp.data?.length ?? 0) - used;
        if (rest > 0) arr.push({ name: "其它", value: rest });

        setSlices(arr);
        setTotal(resp.data?.length ?? 0);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("OperationCommandDonut", "load failed", { error: msg });
        setError(msg);
        setSlices([]);
        setTotal(0);
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
        itemGap: 8,
        itemWidth: 8,
        itemHeight: 8,
      },
      color: [
        PALETTE.primary, PALETTE.blue, PALETTE.cyan, PALETTE.orange,
        PALETTE.purple, PALETTE.green, PALETTE.teal, PALETTE.sky,
        PALETTE.lavender, PALETTE.red, "#b8c6db", "#8b9bb4",
      ],
      series: [
        {
          name: "命令",
          type: "pie",
          radius: ["52%", "72%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "rgba(22,38,62,0.95)", borderWidth: 1 },
          label: { show: false },
          emphasis: {
            label: { show: true, color: "#fff", fontSize: fs.label },
            itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,193,222,0.5)" },
          },
          data: slices,
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "38%",
          style: {
            text: String(total),
            fill: "#fff",
            fontSize: fs.title + 4,
            fontWeight: 700,
          },
        },
        {
          type: "text",
          left: "center",
          top: "50%",
          style: {
            text: "总命令数",
            fill: "rgba(255,255,255,0.55)",
            fontSize: fs.axisLabelSmall,
          },
        },
      ],
      animation: true,
      animationDuration: 600,
    };
  }, [slices, width, height, total]);

  return (
    <ChartFrame title={title} subtitle="近 24 小时">
      {loading ? (
        <ChartCenter><CircularProgress size={24} sx={{ color: "rgba(90,158,214,0.7)" }} /></ChartCenter>
      ) : error ? (
        <ChartCenter><Typography sx={{ fontSize: 12, color: "#ef4444" }}>{error}</Typography></ChartCenter>
      ) : slices.length === 0 ? (
        <ChartCenter><Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.4)" }}>暂无命令数据</Typography></ChartCenter>
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
