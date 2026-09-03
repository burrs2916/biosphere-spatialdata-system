/**
 * LogAnalysisInsight - 日志监控视图「分析洞察报告」
 *
 * 第 8 个渲染器，消费 logMonitorStore.report（来自后端 /api/history/log-monitor/report）。
 * 与概览卡/趋势图/表格并行，是整个日志监控视图的"结论层"：
 *   - 综合健康评分（健康评分算法：故障率×40% + 粉尘超标率×30% + 指令成功率×30%）
 *   - 异常摘要（故障/告警/粉尘超标时长/峰均浓度/指令成功率）
 *   - 粉尘—喷雾关联分析（超标时刻窗口内喷雾触发命中率）
 *   - 设备健康榜（最稳定 / 最需关注）
 *   - 决策建议（规则引擎生成的文本）
 *
 * 数据来源：logMonitorStore.queryReport()（挂载 + 中央 30s 刷新触发）。
 * 导出 Markdown：logMonitorStore.exportReport()（走 Tauri save dialog）。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useEffect, useMemo } from "react";
import type { ComponentRendererProps } from "../../../types/editor";
import { useLogMonitorStore } from "../../../store/logMonitorStore";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.8,
        p: 1.2,
        borderRadius: 1.5,
        border: "1px solid rgba(120,144,156,0.22)",
        background: "rgba(13,19,26,0.5)",
        minWidth: 0,
      }}
    >
      <Typography
        sx={{ fontSize: 12, fontWeight: 700, color: "#B0BEC5", letterSpacing: 1 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Typography sx={{ fontSize: 9.5, color: "rgba(176,190,197,0.6)" }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 17,
          fontWeight: 700,
          color: color ?? "#E0E6ED",
          lineHeight: 1.15,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function LogAnalysisInsight(_props: ComponentRendererProps) {
  const report = useLogMonitorStore((s) => s.report);
  const reportLoading = useLogMonitorStore((s) => s.reportLoading);
  const reportError = useLogMonitorStore((s) => s.reportError);
  const refreshNonce = useLogMonitorStore((s) => s.refreshNonce);
  const queryReport = useLogMonitorStore((s) => s.queryReport);
  const sceneDeviceIds = useLogMonitorStore((s) => s.sceneDeviceIds);
  const scopeMode = useLogMonitorStore((s) => s.scopeMode);

  // 挂载 + 每 30s 中央刷新触发重算
  useEffect(() => {
    void queryReport();
  }, [queryReport, refreshNonce]);

  const healthColor = useMemo(() => {
    if (!report) return "#90a4ae";
    const sc = report.health_score;
    if (sc >= 90) return "#4caf50";
    if (sc >= 70) return "#ffb74d";
    return "#ef5350";
  }, [report]);

  const hasBinding = scopeMode === "global" || sceneDeviceIds.length > 0;

  if (reportLoading && !report) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(13,19,26,0.6)",
          borderRadius: 1.5,
          border: "1px solid rgba(120,144,156,0.25)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={16} sx={{ color: "#5A9ED6" }} />
          <Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.7)" }}>
            正在生成分析洞察报告…
          </Typography>
        </Box>
      </Box>
    );
  }

  if (reportError) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(13,19,26,0.6)",
          borderRadius: 1.5,
          border: "1px solid rgba(239,83,80,0.3)",
        }}
      >
        <Typography sx={{ fontSize: 12, color: "#ef5350" }}>
          报告生成失败：{reportError}
        </Typography>
      </Box>
    );
  }

  if (!report) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(13,19,26,0.6)",
          borderRadius: 1.5,
          border: "1px solid rgba(120,144,156,0.25)",
        }}
      >
        <Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.6)" }}>
          {hasBinding ? "暂无报告数据" : "主视图未绑定数据源，无可分析数据"}
        </Typography>
      </Box>
    );
  }

  const s = report.summary;
  const c = report.correlation;

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
        overflow: "auto",
        p: 1,
        gap: 1,
      }}
    >
      {/* 综合健康评分横幅 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 1,
          borderRadius: 1.5,
          background: `${healthColor}14`,
          border: `1px solid ${healthColor}55`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography sx={{ fontSize: 11, color: "rgba(176,190,197,0.7)" }}>
            综合健康评分
          </Typography>
          <Typography sx={{ fontSize: 30, fontWeight: 800, color: healthColor, lineHeight: 1 }}>
            {report.health_score}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "rgba(176,190,197,0.6)" }}>
            / 100
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.2,
            py: 0.3,
            borderRadius: 1,
            fontSize: 13,
            fontWeight: 700,
            color: healthColor,
            background: `${healthColor}1f`,
            border: `1px solid ${healthColor}66`,
          }}
        >
          {report.health_level}
        </Box>
      </Box>

      {/* 异常摘要 */}
      <Section title="异常摘要">
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
          <Metric label="故障次数" value={`${s.fault_count}`} color={s.fault_count > 0 ? "#ef5350" : "#4caf50"} />
          <Metric label="重要告警" value={`${s.alarm_count}`} color={s.alarm_count > 0 ? "#ffa726" : "#4caf50"} />
          <Metric label="超标时长" value={`${s.dust_exceed_minutes}min`} color={s.dust_exceed_minutes > 0 ? "#ffa726" : "#4caf50"} />
          <Metric label="指令成功率" value={`${s.cmd_success_rate}%`} color={s.cmd_success_rate >= 90 ? "#4caf50" : "#ef5350"} />
          <Metric label="粉尘均值" value={`${s.dust_avg}mg/m³`} />
          <Metric label="粉尘峰值" value={`${s.dust_peak}mg/m³`} color={s.dust_peak >= 10 ? "#ef5350" : "#4caf50"} />
          <Metric label="故障设备" value={`${s.fault_devices}台`} />
          <Metric label="指令总数" value={`${s.total_ops}`} />
        </Box>
      </Section>

      {/* 粉尘—喷雾关联分析 */}
      <Section title="粉尘—喷雾关联分析">
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Metric label="粉尘超标时刻" value={`${c.dust_exceed_events}`} />
          <Metric label="窗口内喷雾触发" value={`${c.spray_triggered_within_window}`} color="#5A9ED6" />
          <Metric
            label="关联命中率"
            value={c.hit_rate === null ? "N/A" : `${c.hit_rate}%`}
            color={c.hit_rate !== null && c.hit_rate < 80 ? "#ffa726" : "#4caf50"}
          />
        </Box>
        <Typography sx={{ fontSize: 10, color: "rgba(176,190,197,0.55)" }}>
          粉尘超标时刻前后 ±{useLogMonitorStore.getState().sprayWindowSec}s 内出现喷雾触发即判定为有效联动
        </Typography>
      </Section>

      {/* 设备健康榜 */}
      <Section title="设备健康榜">
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Box
              sx={{
                px: 0.8,
                py: 0.2,
                borderRadius: 0.8,
                fontSize: 10,
                fontWeight: 700,
                color: "#ef5350",
                background: "rgba(239,83,80,0.12)",
                border: "1px solid rgba(239,83,80,0.4)",
                flexShrink: 0,
              }}
            >
              最需关注
            </Box>
            <Typography
              sx={{
                fontSize: 11.5,
                color: "rgba(224,230,237,0.9)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {report.device_health.most_attention.length > 0
                ? report.device_health.most_attention.join("、")
                : "无"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Box
              sx={{
                px: 0.8,
                py: 0.2,
                borderRadius: 0.8,
                fontSize: 10,
                fontWeight: 700,
                color: "#4caf50",
                background: "rgba(76,175,80,0.12)",
                border: "1px solid rgba(76,175,80,0.4)",
                flexShrink: 0,
              }}
            >
              最稳定
            </Box>
            <Typography
              sx={{
                fontSize: 11.5,
                color: "rgba(224,230,237,0.9)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {report.device_health.most_stable.length > 0
                ? report.device_health.most_stable.join("、")
                : "无"}
            </Typography>
          </Box>
        </Box>
      </Section>

      {/* 决策建议 */}
      <Section title="决策建议">
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {report.recommendations.length === 0 ? (
            <Typography sx={{ fontSize: 11.5, color: "rgba(176,190,197,0.7)" }}>
              本时段无异常，无需干预
            </Typography>
          ) : (
            report.recommendations.map((rec, i) => (
              <Box key={i} sx={{ display: "flex", gap: 0.6, alignItems: "flex-start" }}>
                <Typography sx={{ fontSize: 11.5, color: "#ffa726", flexShrink: 0 }}>
                  ▸
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "rgba(224,230,237,0.9)", lineHeight: 1.4 }}>
                  {rec}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Section>
    </Box>
  );
}
