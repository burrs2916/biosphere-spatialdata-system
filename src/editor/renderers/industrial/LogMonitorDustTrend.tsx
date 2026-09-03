/**
 * LogMonitorDustTrend - 日志监控视图「粉尘浓度趋势图」
 *
 * 与通用历史 DustTrendRenderer 的区别：
 *  - 本组件走 log-monitor 专用链路（queryLogMonitorSensors），scene 作用域自动注入，
 *    与日志监控视图其它 6 个渲染器同源，互不污染通用 history。
 *  - 不依赖 deviceStore 层级发现（集控器→分控器→粉尘传感器），直接按 sensor_type="dust0614"
 *    查询本场景设备池（sceneDeviceIds）的粉尘浓度历史。
 *  - 图表渲染逻辑（ECharts 折线 + 告警阈值线 + 滑动窗口）复用 DustTrendRenderer 思路。
 *
 * 数据流：
 *  logMonitorStore.scopeMode + sceneDeviceIds -> deriveScope -> LogScope
 *    -> queryLogMonitorSensors(type="dust0614") -> sensor_samples(final_value AS value)
 *    -> ECharts 折线 + 告警阈值线 + 60 点滑动窗口
 *
 * 协议真源：sensor_type="dust0614" 即粉尘浓度（mg/m³），见命令码映射 / 字段解析规则。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { echarts } from "../echarts/echartsCore";
import { useLogMonitorStore, buildQueryScope } from "../../../store/logMonitorStore";
import { queryLogMonitorSensors } from "../../../services/logMonitorApi";
import type { SensorRecord } from "../../../services/historyApi";
import { logger } from "../../../utils/logger";

// ═══════════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════════

/** 粉尘传感器在 sensor_samples 中的真实 sensor_type 字符串（来自运行态 DB 实测） */
const DUST_SENSOR_TYPE = "dust0614";

/** 滑动窗口最大点数（~30min @ 30s 推送） */
const MAX_POINTS = 60;

/** 告警阈值（mg/m³）：粉尘报警上限 依据煤矿安全规程，此处取行业常用阈值 */
const ALARM_HIGH = 10; // mg/m³ 报警上限
const ALARM_WARN_RATIO = 0.8; // 预警线 = 80% 上限

/** 折线图配色（多设备时分配） */
const LINE_COLORS = ["#5A9ED6", "#8d6e63", "#90A4AE", "#A1887F", "#B0BEC5"];

// ═══════════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════════

interface DustPoint {
  deviceId: string;
  ts: number; // ms
  value: number;
}

// ═══════════════════════════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════════════════════════

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// ═══════════════════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════════════════

export default function LogMonitorDustTrend(_props: { config?: Record<string, unknown> }) {
  const scopeMode = useLogMonitorStore((s) => s.scopeMode);
  const sceneDeviceIds = useLogMonitorStore((s) => s.sceneDeviceIds);
  const selectedDeviceIds = useLogMonitorStore((s) => s.selectedDeviceIds);
  const timeRange = useLogMonitorStore((s) => s.timeRange);
  const refreshNonce = useLogMonitorStore((s) => s.refreshNonce);

  const [points, setPoints] = useState<DustPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  /** 喷雾触发时刻（spray.front_spray 0→1 边沿），用于叠加标记 */
  const [sprayTriggers, setSprayTriggers] = useState<number[]>([]);

  // 按 deviceId 分组的滑动窗口（保持每个设备一条折线）
  const buffersRef = useRef<Map<string, [number, number][]>>(new Map());

  const from = timeRange?.from ?? "";
  const to = timeRange?.to ?? "";

  const fetchData = useCallback(async () => {
    if (!from || !to) {
      setError("时间范围未设置");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const scope = buildQueryScope({ selectedDeviceIds, scopeMode, sceneDeviceIds });
      const resp = await queryLogMonitorSensors({
        from,
        to,
        scope,
        type: DUST_SENSOR_TYPE,
        limit: 5000,
      });
      const raw: SensorRecord[] = resp.data ?? [];
      const parsed: DustPoint[] = raw
        .filter((p) => p.value !== undefined && p.timestamp)
        .map((p) => {
          const ts =
            typeof p.timestamp === "string"
              ? new Date(p.timestamp).getTime()
              : Number(p.timestamp);
          return {
            deviceId: String(p.device_id ?? "unknown"),
            ts,
            value: Number(p.value),
          };
        })
        .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.value));

      // 更新每个设备的滑动窗口
      const buffers = buffersRef.current;
      for (const p of parsed) {
        let buf = buffers.get(p.deviceId);
        if (!buf) {
          buf = [];
          buffers.set(p.deviceId, buf);
        }
        buf.push([p.ts, p.value]);
        if (buf.length > MAX_POINTS) buf.splice(0, buf.length - MAX_POINTS);
      }
      // 清理不再出现的设备
      const liveIds = new Set(parsed.map((p) => p.deviceId));
      for (const id of Array.from(buffers.keys())) {
        if (!liveIds.has(id)) buffers.delete(id);
      }

      // 扁平化回 point 列表（供图表 option 构造使用）
      const flat: DustPoint[] = [];
      for (const [id, buf] of buffers) {
        for (const [ts, value] of buf) flat.push({ deviceId: id, ts, value });
      }
      flat.sort((a, b) => a.ts - b.ts);
      setPoints(flat);

      // 并行查询喷雾状态（spray.front_spray），提取 0→1 边沿作为触发标记
      try {
        const sprayResp = await queryLogMonitorSensors({
          from,
          to,
          scope,
          type: "spray.front_spray",
          limit: 5000,
        });
        const sprayRaw: SensorRecord[] = sprayResp.data ?? [];
        // 按 ts 升序找 0→1 边沿
        const sorted = sprayRaw
          .map((p) => ({
            ts:
              typeof p.timestamp === "string"
                ? new Date(p.timestamp).getTime()
                : Number(p.timestamp),
            v: Number(p.value),
          }))
          .filter((p) => Number.isFinite(p.ts))
          .sort((a, b) => a.ts - b.ts);
        const edges: number[] = [];
        let prev = 0;
        for (let i = 0; i < sorted.length; i++) {
          const v = sorted[i].v;
          if (i > 0 && prev <= 0 && v > 0) {
            edges.push(sorted[i].ts);
          }
          prev = v;
        }
        setSprayTriggers(edges);
      } catch (sprayErr) {
        // 喷雾标记失败不影响粉尘主线
        const smsg = sprayErr instanceof Error ? sprayErr.message : String(sprayErr);
        logger.warn("[LogMonitorDustTrend] spray query failed:", smsg);
        setSprayTriggers([]);
      }

      setLastUpdated(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("[LogMonitorDustTrend] query failed:", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [from, to, scopeMode, sceneDeviceIds, selectedDeviceIds]);

  // 初始 + 时间范围/场景/刷新触发查询
  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshNonce]);

  // 构造 ECharts option
  const option = useMemo(() => {
    const deviceIds = Array.from(new Set(points.map((p) => p.deviceId)));
    const series = deviceIds.map((id, idx) => {
      const data = points
        .filter((p) => p.deviceId === id)
        .map((p) => [p.ts, p.value] as [number, number]);
      return {
        name: id,
        type: "line",
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color: LINE_COLORS[idx % LINE_COLORS.length] },
        itemStyle: { color: LINE_COLORS[idx % LINE_COLORS.length] },
        areaStyle: { opacity: 0.08, color: LINE_COLORS[idx % LINE_COLORS.length] },
        data,
      };
    });

    return {
      backgroundColor: "transparent",
      grid: { left: 48, right: 16, top: 28, bottom: 28 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(20,28,38,0.92)",
        borderColor: "rgba(90,158,214,0.4)",
        textStyle: { color: "#E0E6ED", fontSize: 11 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const ts = params[0].value[0];
          let s = `${formatTime(ts)}<br/>`;
          for (const p of params) {
            s += `${p.marker}${p.seriesName}: <b>${Number(p.value[1]).toFixed(2)}</b> mg/m³<br/>`;
          }
          return s;
        },
      },
      legend: {
        show: deviceIds.length > 1,
        type: "scroll",
        top: 0,
        textStyle: { color: "rgba(176,190,197,0.8)", fontSize: 10 },
        data: deviceIds,
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "rgba(120,144,156,0.4)" } },
        axisLabel: {
          color: "rgba(176,190,197,0.6)",
          fontSize: 10,
          formatter: (v: number) => formatTime(v),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "mg/m³",
        nameTextStyle: { color: "rgba(176,190,197,0.6)", fontSize: 10 },
        axisLine: { lineStyle: { color: "rgba(120,144,156,0.4)" } },
        axisLabel: { color: "rgba(176,190,197,0.6)", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(120,144,156,0.15)" } },
      },
      series: [
        ...series,
        // 告警阈值线（markLine 挂在第一条 series）
        ...(series.length > 0
          ? []
          : []),
      ],
      // 阈值线单独用 graphic 不便，改用 markLine 注入到第一条 series
      ...(series.length > 0
        ? {}
        : {}),
    } as any;
  }, [points]);

  // 把阈值线 + 喷雾触发标记注入 option（markLine/markPoint 需挂在 series 上）
  const finalOption = useMemo(() => {
    if (!option || !option.series || option.series.length === 0) return option;
    const opt = JSON.parse(JSON.stringify(option));
    opt.series[0] = {
      ...opt.series[0],
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { type: "dashed" },
        data: [
          {
            yAxis: ALARM_HIGH,
            lineStyle: { color: "#ef5350", width: 1.5 },
            label: {
              formatter: `报警 ${ALARM_HIGH} mg/m³`,
              color: "#ef5350",
              fontSize: 10,
              position: "insideEndTop",
            },
          },
          {
            yAxis: ALARM_HIGH * ALARM_WARN_RATIO,
            lineStyle: { color: "#ffa726", width: 1 },
            label: {
              formatter: `预警 ${(ALARM_HIGH * ALARM_WARN_RATIO).toFixed(1)} mg/m³`,
              color: "#ffa726",
              fontSize: 10,
              position: "insideEndTop",
            },
          },
        ],
      },
      // 喷雾触发标记点（垂直连线，落在顶部，便于关联粉尘超标时刻）
      ...(sprayTriggers.length > 0
        ? {
            markPoint: {
              silent: true,
              symbol: "pin",
              symbolSize: 26,
              itemStyle: { color: "rgba(90,158,214,0.9)" },
              label: {
                show: true,
                formatter: "喷",
                color: "#fff",
                fontSize: 9,
              },
              data: sprayTriggers.map((ts) => ({
                xAxis: ts,
                yAxis: ALARM_HIGH,
              })),
            },
          }
        : {}),
    };
    return opt;
  }, [option, sprayTriggers]);

  // 空状态判断
  const hasData = points.length > 0;
  const deviceCount = new Set(points.map((p) => p.deviceId)).size;
  const latestValue = points.length > 0 ? points[points.length - 1].value : undefined;
  const isAlarm = latestValue !== undefined && latestValue >= ALARM_HIGH;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "rgba(13,19,26,0.6)",
        borderRadius: 1.5,
        border: "1px solid rgba(120,144,156,0.25)",
        overflow: "hidden",
      }}
    >
      {/* 头部 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          borderBottom: "1px solid rgba(120,144,156,0.2)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#E0E6ED" }}>
            粉尘浓度趋势
          </Typography>
          {deviceCount > 0 && (
            <Typography sx={{ fontSize: 10, color: "rgba(176,190,197,0.6)" }}>
              {deviceCount} 个传感器
            </Typography>
          )}
          {sprayTriggers.length > 0 && (
            <Typography sx={{ fontSize: 10, color: "#5A9ED6" }}>
              喷雾触发 {sprayTriggers.length} 次
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {latestValue !== undefined && (
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                color: isAlarm ? "#ef5350" : "#4caf50",
              }}
            >
              {latestValue.toFixed(2)} mg/m³
            </Typography>
          )}
          {loading && (
            <Typography sx={{ fontSize: 10, color: "rgba(176,190,197,0.5)" }}>
              加载中…
            </Typography>
          )}
          {lastUpdated > 0 && !loading && (
            <Typography sx={{ fontSize: 9, color: "rgba(176,190,197,0.4)" }}>
              {formatTime(lastUpdated)}
            </Typography>
          )}
        </Box>
      </Box>

      {/* 图表区 */}
      <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
        {hasData ? (
          <ReactEChartsCore
            echarts={echarts}
            option={finalOption}
            notMerge
            lazyUpdate
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
            }}
          >
            {error ? (
              <Typography sx={{ fontSize: 12, color: "#ef5350" }}>
                查询失败：{error}
              </Typography>
            ) : loading ? (
              <Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.6)" }}>
                正在加载粉尘数据…
              </Typography>
            ) : deviceCount === 0 ? (
              <Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.6)" }}>
                本场景无粉尘传感器数据
              </Typography>
            ) : (
              <Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.6)" }}>
                暂无粉尘浓度记录
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
