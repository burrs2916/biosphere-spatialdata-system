import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { useEffect } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, PALETTE, CHART_BOX_SX, calcFontScale, chartFontSizes, calcDevicePixelRatio } from "./echartsCore";
import { useEchartOptions, SENSOR_PRESETS } from "./useEchartOptions";
import { useDataSourceStore } from "../../../store/datasourceStore";
import type { ComponentRendererProps } from "../../../types/editor";

/** 在色带 stops 上按比例取渐变色（中心数值颜色跟随当前值所在色段，低值红区语义自动正确） */
function colorAtRatio(stops: [number, string][], ratio: number): string {
  if (!stops || stops.length === 0) return "#fff";
  const r = Math.min(1, Math.max(0, ratio));
  const parse = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  if (r <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (r <= stops[i][0]) {
      const [r0, c0] = stops[i - 1];
      const [r1, c1] = stops[i];
      const t = (r - r0) / Math.max(1e-6, r1 - r0);
      const a = parse(c0);
      const b = parse(c1);
      const mix = a.map((x, k) => Math.round(x + (b[k] - x) * t));
      return `#${mix.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return stops[stops.length - 1][1];
}

/** 从嵌套对象中按路径取值 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 仪表盘 — 对标 sprayv2 工业风格 + 响应式字体 + 数据源联动
 */
export function GaugeChartRenderer({ config, width, height }: ComponentRendererProps) {
  const isDark = (config.theme as string) !== "light";

  // 数据源联动
  const dataMode = (config.dataMode as string) ?? "static";
  const liveData = config.data as Record<string, unknown> | undefined;
  const dataField = config.dataField as string | undefined;
  const dataSourceId = config.dataSourceId as string | undefined;
  const refreshInterval = (config.refreshInterval as number) ?? 5000;

  // P1 修复：realtime 模式此前为断链假实现（全工程无人向 config.data 注入数据）。
  // 现直连取数原语：订阅 datasourceStore.dataCache + 组件级轮询 fetchViaScheduler
  //（经适配器拉取 → _handleFetchResult 回写缓存 → 本组件响应式重渲染）。
  // A 修复（二轮）：轮询与取值条件分离——选了数据源即开始拉取（否则字段下拉列表
  // 依赖轮询结果、而轮询又依赖已选字段，形成鸡生蛋死锁，用户永远选不了字段）。
  const pollOn = dataMode === "realtime" && !!dataSourceId;
  const cachedEntry = useDataSourceStore((s) =>
    pollOn ? s.dataCache[dataSourceId as string] : undefined,
  );
  const fetchViaScheduler = useDataSourceStore((s) => s.fetchViaScheduler);
  const connStatus = useDataSourceStore((s) =>
    pollOn ? s.connectionStatuses[dataSourceId as string]?.status : undefined,
  );
  const lastFetchedAt = useDataSourceStore((s) =>
    pollOn ? s.dataSources.find((d) => d.id === dataSourceId)?.lastFetchedAt : undefined,
  );
  useEffect(() => {
    if (!pollOn) return;
    const poll = () => {
      void Promise.resolve(fetchViaScheduler(dataSourceId!)).catch(() => {});
    };
    poll();
    const id = setInterval(poll, Math.max(1000, refreshInterval));
    return () => clearInterval(id);
  }, [pollOn, dataSourceId, refreshInterval, fetchViaScheduler]);

  // 实时数据模式：优先 dataCache（数据源提取字段），回退外部注入的 config.data（兼容旧通道）
  let liveValue: number | undefined;
  if (dataMode === "realtime" && dataField) {
    const source = (cachedEntry ?? liveData) as Record<string, unknown> | undefined;
    if (source) {
      const v = getNestedValue(source, dataField);
      if (typeof v === "number") liveValue = v;
      else if (typeof v === "string") liveValue = parseFloat(v) || 0;
    }
  }

  const value = liveValue ?? (config.value as number) ?? 68;
  const min = (config.min as number) ?? 0;
  const max = (config.max as number) ?? 100;
  const unit = (config.unit as string) || "";
  const gaugeName = (config.gaugeName as string) || "";
  const sensorPreset = (config.sensorPreset as string) || "";
  const splitNumber = (config.splitNumber as number) ?? 10;
  const showPointer = (config.showPointer as boolean) ?? true;
  const pointerWidth = (config.pointerWidth as number) ?? 2;
  const startAngle = (config.startAngle as number) ?? 220;
  const endAngle = (config.endAngle as number) ?? -40;
  const radius = (config.radius as string) ?? "68%";
  const center = (config.center as [string, string]) ?? ["50%", "60%"];
  const style = (config.gaugeStyle as string) ?? "industrial"; // industrial | modern
  const showProgress = (config.showProgress as boolean) ?? true;
  const progressWidth = (config.progressWidth as number) ?? 18;
  // P3：数值精度（浮点不再显示 12.333333）+ 超限变色
  const valuePrecision = (config.valuePrecision as number) ?? 0;
  const alarmColor = (config.alarmColor as boolean) ?? true;

  // 响应式字体缩放
  const scale = calcFontScale(width, height);
  const fs = chartFontSizes(scale);
  const dpr = calcDevicePixelRatio(width, height);

  // 传感器预设覆盖
  const preset = sensorPreset ? SENSOR_PRESETS[sensorPreset] : null;
  const effectiveMin = preset?.min ?? min;
  const effectiveMax = preset?.max ?? max;
  const effectiveUnit = preset?.unit ?? unit;
  // D：gaugeName 为空时自动用预设名（传感器仪表盘一眼可读）
  const effectiveGaugeName = gaugeName || preset?.label || "";

  // F 防呆：min/max 填反时自动交换
  const safeMin = Math.min(effectiveMin, effectiveMax);
  const safeMax = Math.max(effectiveMin, effectiveMax);

  const isIndustrial = style === "industrial";

  // sprayv2 工业风三色分段：绿→蓝→红
  const industrialColorStops: [number, string][] = [
    [0.2, "#228b22"],
    [0.8, "#48b"],
    [1, "#ff4500"],
  ];
  const colorStops = preset?.colorStops || industrialColorStops;

  // 超限变色（B 修复）：中心数值颜色跟随当前值所在色带渐变取色——
  // 标准三色表 ≥80% 趋红；流量预设低值红区同样正确（替代旧"≥0.8 硬编码红"）。
  // alarmColor 关闭时回退主题色。
  const valueRatio = safeMax > safeMin
    ? Math.min(1, Math.max(0, (value - safeMin) / (safeMax - safeMin)))
    : 0;
  const detailColor = alarmColor
    ? colorAtRatio(colorStops, valueRatio)
    : (isDark ? "#fff" : "#333");

  // 缩放后的仪表盘元素尺寸
  const scaledPointerWidth = Math.max(1, Math.round(pointerWidth * scale));
  const scaledAxisLineWidth = isIndustrial ? Math.max(1, Math.round(2 * scale)) : progressWidth;
  const scaledSplitLineLength = isIndustrial ? Math.max(1, Math.round(2 * scale)) : 14;
  const scaledAxisTickLength = isIndustrial ? Math.max(3, Math.round(6 * scale)) : 8;
  const scaledAnchorSize = isIndustrial ? Math.max(4, Math.round(8 * scale)) : 14;
  const scaledShadowBlur = Math.round(10 * scale);

  const baseOption: Record<string, unknown> = {
    series: [{
      type: "gauge",
      center,
      radius,
      startAngle,
      endAngle,
      min: safeMin,
      max: safeMax,
      splitNumber,

      // ── 轴线（外环）— sprayv2: width 2 + 发光 ──
      axisLine: {
        lineStyle: {
          width: scaledAxisLineWidth,
          color: colorStops,
          ...(isIndustrial ? {
            shadowColor: "#fff",
            shadowBlur: scaledShadowBlur,
          } : {}),
        },
      },

      // ── 刻度 — sprayv2: splitNumber 5, length 6, color auto ──
      axisTick: {
        splitNumber: 5,
        length: scaledAxisTickLength,
        distance: isIndustrial ? -Math.round(2 * scale) : -progressWidth,
        lineStyle: {
          color: "auto",
          width: 1,
        },
      },

      // ── 分隔线 — sprayv2: width 2, color '#fff', length 2, 发光 ──
      splitLine: {
        show: true,
        length: scaledSplitLineLength,
        distance: isIndustrial ? -Math.round(2 * scale) : -progressWidth,
        lineStyle: {
          width: Math.max(1, Math.round(2 * scale)),
          color: isIndustrial ? "#fff" : "auto",
          ...(isIndustrial ? {
            shadowColor: "#fff",
            shadowBlur: scaledShadowBlur,
          } : {}),
        },
      },

      // ── 轴标签 — sprayv2: show false ──
      axisLabel: {
        show: !isIndustrial,
        distance: Math.round(8 * scale),
        color: isDark ? "rgba(255,255,255,0.5)" : "#999",
        fontSize: fs.axisLabelSmall,
      },

      // ── 指针 — sprayv2: width 2, color auto, 发光 ──
      pointer: {
        show: showPointer,
        length: "60%",
        width: scaledPointerWidth,
        itemStyle: {
          color: "auto",
          ...(isIndustrial ? { shadowColor: "#fff", shadowBlur: Math.round(6 * scale) } : {}),
        },
      },

      // ── 进度条（modern 风格） ──
      ...(isIndustrial ? {} : {
        progress: {
          show: showProgress,
          width: progressWidth,
          itemStyle: {
            color: {
              type: "linear" as const,
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: "#228b22" },
                { offset: 0.5, color: PALETTE.primary },
                { offset: 1, color: "#ff4500" },
              ],
            },
          },
        },
      }),

      // ── 中心锚点 — sprayv2: 小圆点 ──
      anchor: {
        show: showPointer,
        size: scaledAnchorSize,
        showAbove: true,
        itemStyle: {
          borderWidth: isIndustrial ? Math.max(1, Math.round(2 * scale)) : 4,
          borderColor: isIndustrial ? "#fff" : PALETTE.primary,
          ...(isIndustrial ? { shadowColor: "#fff", shadowBlur: Math.round(6 * scale) } : {}),
        },
      },

      // ── 标题 — sprayv2: fontSize 10, bolder, '#fff', offsetCenter [0,'100%'] ──
      title: {
        show: !!effectiveGaugeName,
        offsetCenter: [0, isIndustrial ? "100%" : "80%"],
        fontSize: fs.gaugeTitle,
        fontWeight: isIndustrial ? "bolder" : "normal",
        color: isDark ? "#fff" : "#666",
      },

      // ── 数值 — sprayv2: fontSize 14, bolder, offsetCenter [0,'0%']；精度 + 超限变色 ──
      detail: {
        valueAnimation: true,
        fontSize: fs.gaugeDetail,
        fontWeight: "bolder",
        offsetCenter: [0, isIndustrial ? "0%" : "50%"],
        formatter: (v: unknown) => {
          const num = typeof v === "number" ? v : parseFloat(String(v));
          return `${Number.isFinite(num) ? num.toFixed(valuePrecision) : String(v)}${effectiveUnit}`;
        },
        color: detailColor,
      },

      data: [{ value, name: effectiveGaugeName }],
    }],
  };

  const option = useEchartOptions(config, baseOption, scale);

  // E：实时状态点 —— 绿=拉取正常 / 黄=连接中 / 红=失败 / 灰=未绑字段，悬停看最近拉取时间
  const statusMeta = !dataField
    ? { color: "#90A4AE", text: "实时模式：请先选择数据字段" }
    : connStatus === "connected"
      ? { color: "#3CCB7F", text: "实时数据 · 拉取正常" }
      : connStatus === "connecting"
        ? { color: "#FFC107", text: "实时数据 · 连接中" }
        : connStatus === "error" || connStatus === "failed"
          ? { color: "#ff5252", text: "实时数据 · 拉取失败，显示的是最后一次成功值" }
          : { color: "#90A4AE", text: "实时数据 · 等待首次拉取" };
  const statusTitle = `${statusMeta.text}${lastFetchedAt ? ` · 最近拉取 ${new Date(lastFetchedAt).toLocaleTimeString()}` : ""}`;

  return (
    <Box sx={{ ...CHART_BOX_SX, position: "relative" }}>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme={isDark ? "industrial-dark" : undefined}
        notMerge
        lazyUpdate
        opts={{ devicePixelRatio: dpr }}
        style={{ width: "100%", height: "100%" }}
      />
      {pollOn && (
        <Tooltip title={statusTitle} placement="left">
          <Box
            sx={{
              position: "absolute",
              top: 6,
              right: 8,
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: statusMeta.color,
              boxShadow: `0 0 4px ${statusMeta.color}`,
              pointerEvents: "auto",
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}
