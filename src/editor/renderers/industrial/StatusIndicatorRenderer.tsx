import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ComponentRendererProps } from "../../../types/editor";

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
 * 状态指示灯 — 工业大屏风格
 *
 * 支持两种 config 格式：
 * - 新格式：statusMode, dataField, normalColor, alarmColor, offlineColor
 * - 旧格式：status, label, color, blink
 *
 * 三种状态：正常（绿色呼吸）、异常（红色呼吸）、离线/未安装（灰色静态）
 */
export function StatusIndicatorRenderer({ config, width = 80, height = 80 }: ComponentRendererProps) {
  // ─── 兼容新旧 config 格式 ───
  const label = (config.label as string) || (config.text as string) || "";
  const statusMode = (config.statusMode as string) ?? "static";
  const dataField = config.dataField as string | undefined;
  const liveData = config.data as Record<string, unknown> | undefined;
  const dataSourceId = config.dataSourceId as string | undefined;

  // 颜色配置
  const normalColor = (config.normalColor as string) || (config.color as string) || "#22c55e";
  const alarmColor = (config.alarmColor as string) || "#ef4444";
  const offlineColor = (config.offlineColor as string) || "#6b7280";

  // 阈值
  const alarmThreshold = (config.alarmThreshold as number) ?? 1;

  // ─── 判断状态 ───
  let status: "normal" | "alarm" | "offline" = "normal";

  if ((statusMode === "datasource" || dataSourceId) && liveData && dataField) {
    const v = getNestedValue(liveData, dataField);
    if (v === null || v === undefined) {
      status = "offline";
    } else if (typeof v === "number") {
      status = v >= alarmThreshold ? "alarm" : "normal";
    } else if (typeof v === "string") {
      if (v === "正常" || v === "normal" || v === "0" || v === "online" || v === "running") status = "normal";
      else if (v === "异常" || v === "alarm" || v === "1" || v === "fault" || v === "error") status = "alarm";
      else if (v === "离线" || v === "offline" || v === "2") status = "offline";
      else status = "normal";
    } else if (typeof v === "boolean") {
      status = v ? "alarm" : "normal";
    }
  } else if (liveData && !dataField) {
    // 兼容：data 中直接有 status 或 online 字段
    const s = liveData.status as string | undefined;
    const online = liveData.online as boolean | undefined;
    const fault = liveData.fault as boolean | undefined;
    if (fault) status = "alarm";
    else if (online === false) status = "offline";
    else if (s === "fault" || s === "alarm") status = "alarm";
    else if (s === "offline") status = "offline";
    else status = "normal";
  } else {
    // 旧格式静态模式
    const staticStatus = (config.status as string) ?? (config.staticStatus as string) ?? "normal";
    if (staticStatus === "running" || staticStatus === "normal" || staticStatus === "online") status = "normal";
    else if (staticStatus === "alarm" || staticStatus === "fault" || staticStatus === "error") status = "alarm";
    else if (staticStatus === "offline") status = "offline";
    else status = "normal";
  }

  const color = status === "normal" ? normalColor : status === "alarm" ? alarmColor : offlineColor;
  const breathe = status !== "offline";

  // ─── 尺寸计算 ───
  const dotSize = Math.min(width, height) * 0.35;
  const fontSize = Math.max(10, Math.min(width, height) * 0.12);
  const isWide = width > height * 3;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: isWide ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isWide ? 1.5 : 0.5,
        position: "relative",
      }}
    >
      {/* 指示灯 */}
      <Box
        sx={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          backgroundColor: color,
          position: "relative",
          boxShadow: breathe
            ? `0 0 ${dotSize * 0.6}px ${color}88, 0 0 ${dotSize * 1.2}px ${color}44`
            : "none",
          animation: breathe
            ? `statusBreathe 2s ease-in-out infinite`
            : "none",
          "@keyframes statusBreathe": {
            "0%, 100%": {
              opacity: 1,
              boxShadow: `0 0 ${dotSize * 0.5}px ${color}88, 0 0 ${dotSize}px ${color}44`,
            },
            "50%": {
              opacity: 0.5,
              boxShadow: `0 0 ${dotSize * 0.25}px ${color}66, 0 0 ${dotSize * 0.5}px ${color}22`,
            },
          },
          // 外圈脉冲环
          "&::after": breathe ? {
            content: '""',
            position: "absolute",
            top: "-30%",
            left: "-30%",
            width: "160%",
            height: "160%",
            borderRadius: "50%",
            border: `1px solid ${color}33`,
            animation: `statusPulse 2.5s ease-out infinite`,
            "@keyframes statusPulse": {
              "0%": { transform: "scale(0.8)", opacity: 0.8 },
              "100%": { transform: "scale(1.6)", opacity: 0 },
            },
          } : undefined,
        }}
      />

      {/* 标签 */}
      {label && (
        <Typography
          sx={{
            fontSize,
            color: `${color}cc`,
            fontWeight: 500,
            textAlign: "center",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
}
