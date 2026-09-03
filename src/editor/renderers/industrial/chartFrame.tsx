/**
 * chartFrame —— 共享 echart 外框（日志监控视图 3 个新组件复用）
 *
 * 与 AlarmTrendStacked 外框保持视觉一致（同一暗色工业大屏风格）。
 * 抽取后：3 个 echart 组件各自的 renderer 主体只需关心 option 计算。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export function ChartFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
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
        {subtitle && (
          <Typography sx={{ fontSize: 10, color: "rgba(176,190,197,0.5)", ml: "auto" }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</Box>
    </Box>
  );
}

export function ChartCenter({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
      {children}
    </Box>
  );
}

/** 复用：最近 24 小时时间范围（ISO 字符串） */
export function recentTimeRangeIso(hours: number) {
  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: now.toISOString() };
}
