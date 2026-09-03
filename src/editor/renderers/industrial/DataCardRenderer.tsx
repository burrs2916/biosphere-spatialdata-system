import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useMemo, useState, useEffect, useRef } from "react";
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
 * 数据状态卡片 — 工业大屏风格 v2
 *
 * 优化项：
 * - 更精致的渐变背景和边框光效
 * - 数值变化时的脉冲动画
 * - 故障/告警卡片脉冲发光
 * - 数据源连接状态指示
 * - 更好的进度条视觉效果
 * - hover 微交互
 */
export function DataCardRenderer({ config, width = 200, height = 80 }: ComponentRendererProps) {
  // ─── 兼容新旧 config 格式 ───
  const cardName = (config.cardName as string) || (config.label as string) || "温度";
  const iconType = (config.iconType as string) || (config.icon as string) || "temperature";
  const displayMode = (config.displayMode as string) ?? "value";
  const accentColor = (config.color as string) || "#4fc3f7";
  const theme = (config.theme as string) || "dark";
  const showProgress = (config.showProgress as boolean) ?? false;
  const progressValue = (config.progressValue as number) ?? 0;

  // 数据源绑定
  const dataSourceId = config.dataSourceId as string | undefined;
  const dataField = config.dataField as string | undefined;
  const liveData = config.data as Record<string, unknown> | undefined;

  // 静态值兼容
  const staticValue = (config.staticValue as string) || (config.value as string) || "35";
  const unit = (config.unit as string) ?? "";

  // ─── 获取实时值 ───
  let displayValue = staticValue;
  let hasLiveData = false;
  if (dataSourceId && liveData && dataField) {
    const v = getNestedValue(liveData, dataField);
    if (v !== null && v !== undefined) {
      displayValue = String(v);
      hasLiveData = true;
    }
  }
  if (!dataField && liveData && liveData.value !== undefined) {
    displayValue = String(liveData.value);
    hasLiveData = true;
  }

  const isStatusMode = displayMode === "status";
  const hasValue = displayValue !== "" && displayValue !== "null" && displayValue !== "undefined";

  // ─── 值变化脉冲动画 ───
  const [pulse, setPulse] = useState(false);
  const prevValue = useRef(displayValue);
  useEffect(() => {
    if (prevValue.current !== displayValue) {
      prevValue.current = displayValue;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [displayValue]);

  // ─── 是否是告警/故障类卡片 ───
  const isAlarmCard = useMemo(() => {
    const v = Number(displayValue);
    if (iconType === "alarm" || iconType === "fault" || iconType === "warning") return v > 0;
    return false;
  }, [iconType, displayValue]);

  // ─── 图标 SVG（纯色，不含 accentColor 动态拼接，避免频繁重建）───
  const iconSvg = useMemo(() => {
    const icons: Record<string, string> = {
      temperature: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 0 0-3 3v7.28a5 5 0 1 0 6 0V5a3 3 0 0 0-3-3z"/><circle cx="12" cy="17" r="2" fill="currentColor" stroke="none"/></svg>`,
      smoke: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 18c0-2 2-3 2-5s-2-3-2-5"/><path d="M12 18c0-2 2-3 2-5s-2-3-2-5"/><path d="M18 18c0-2 2-3 2-5s-2-3-2-5"/></svg>`,
      infrared: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-10-10h4m12 0h4"/><path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83m0-14.14l-2.83 2.83m-8.48 8.48l-2.83 2.83"/></svg>`,
      touch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 11a2 2 0 0 1 4 0v5a8 8 0 0 1-8 8h-2c-2.5 0-4-1-5.5-2.5L3 18"/></svg>`,
      dust: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="10" r="1.5" fill="currentColor"/><circle cx="14" cy="8" r="1" fill="currentColor"/><circle cx="11" cy="14" r="1.5" fill="currentColor"/><circle cx="16" cy="13" r="1" fill="currentColor"/><circle cx="6" cy="16" r="1" fill="currentColor"/><circle cx="18" cy="17" r="1.5" fill="currentColor"/></svg>`,
      online: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>`,
      controller: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6m-6 3h6m-6 3h4"/><circle cx="17" cy="17" r="1.5" fill="currentColor"/></svg>`,
      running: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
      fault: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      signal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 20V4"/></svg>`,
      spray: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
      alarm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
      water: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
      pressure: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
      flow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
      energy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
      time: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      custom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
    };
    return icons[iconType] || icons.custom;
  }, [iconType]);

  // ─── 尺寸计算 ───
  const isWide = width > height * 2.5;
  const iconSize = isWide
    ? Math.max(20, Math.min(height * 0.55, 40))
    : Math.max(16, Math.min(width, height) * 0.22);
  const labelSize = isWide
    ? Math.max(10, Math.min(height * 0.18, 14))
    : Math.max(10, Math.min(width, height) * 0.1);
  const valueSize = isWide
    ? Math.max(20, Math.min(height * 0.42, 44))
    : Math.max(16, Math.min(width, height) * 0.24);

  const progress = showProgress ? Math.max(0, Math.min(100, progressValue)) : 0;

  // ─── 值颜色 ───
  const valueColor = useMemo(() => {
    if (isStatusMode) return hasValue ? "#ef4444" : "#22c55e";
    if (isAlarmCard) return "#ef4444";
    return "#ffffff";
  }, [isStatusMode, hasValue, isAlarmCard]);

  // ─── 渲染 ───
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: isWide ? "row" : "column",
        alignItems: "center",
        justifyContent: isWide ? "flex-start" : "center",
        gap: isWide ? 1.2 : 0.4,
        padding: isWide ? "8px 14px" : "8px 10px",
        position: "relative",
        overflow: "hidden",
        borderRadius: 2,
        background: theme === "dark"
          ? `linear-gradient(145deg, rgba(15,25,45,0.92) 0%, rgba(8,16,32,0.96) 60%, rgba(12,22,42,0.9) 100%)`
          : `linear-gradient(145deg, rgba(240,245,255,0.95) 0%, rgba(230,240,250,0.98) 100%)`,
        border: `1px solid ${accentColor}${isAlarmCard ? "55" : "20"}`,
        cursor: "default",
        transition: "border-color 0.3s, box-shadow 0.3s",
        "&:hover": {
          borderColor: `${accentColor}44`,
          boxShadow: `0 0 12px ${accentColor}15, inset 0 0 20px ${accentColor}08`,
        },
        // 顶部装饰线
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "8%",
          right: "8%",
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${accentColor}${isAlarmCard ? "88" : "55"}, transparent)`,
          borderRadius: 1,
        },
        // 底部微光
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: showProgress ? 6 : 1,
          background: showProgress
            ? "transparent"
            : `linear-gradient(90deg, transparent, ${accentColor}18, transparent)`,
        },
      }}
    >
      {/* 告警脉冲边框 */}
      {isAlarmCard && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: 2,
            border: `1.5px solid #ef444444`,
            animation: "alarmPulse 2s ease-in-out infinite",
            pointerEvents: "none",
            "@keyframes alarmPulse": {
              "0%, 100%": { borderColor: "#ef444422", boxShadow: "0 0 4px #ef444411" },
              "50%": { borderColor: "#ef444466", boxShadow: "0 0 16px #ef444422" },
            },
          }}
        />
      )}

      {/* 图标区域 */}
      <Box
        sx={{
          width: iconSize,
          height: iconSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: accentColor,
          opacity: 0.85,
          filter: `drop-shadow(0 0 4px ${accentColor}44)`,
          "& svg": {
            width: "100%",
            height: "100%",
          },
        }}
        dangerouslySetInnerHTML={{ __html: iconSvg }}
      />

      {/* 文字区域 */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: isWide ? "flex-start" : "center",
          justifyContent: "center",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* 标签 */}
        <Typography
          sx={{
            fontSize: labelSize,
            color: theme === "dark" ? `${accentColor}99` : `${accentColor}bb`,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.3,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {cardName}
        </Typography>

        {/* 数值行 */}
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 0.4,
            lineHeight: 1,
          }}
        >
          <Typography
            sx={{
              fontSize: valueSize,
              color: valueColor,
              fontWeight: 700,
              whiteSpace: "nowrap",
              fontFamily: "'DIN Alternate', 'Roboto Mono', 'SF Mono', monospace",
              textShadow: pulse
                ? `0 0 ${valueSize * 0.5}px ${accentColor}66`
                : `0 0 ${valueSize * 0.2}px ${accentColor}22`,
              transition: "text-shadow 0.4s ease",
              // 值变化时短暂放大
              transform: pulse ? "scale(1.05)" : "scale(1)",
              transformOrigin: "left center",
              animation: pulse ? "valuePop 0.4s ease-out" : "none",
              "@keyframes valuePop": {
                "0%": { transform: "scale(1.08)", opacity: 0.8 },
                "100%": { transform: "scale(1)", opacity: 1 },
              },
            }}
          >
            {displayValue}
          </Typography>
          {unit && !isStatusMode && (
            <Typography
              component="span"
              sx={{
                fontSize: labelSize * 0.95,
                color: theme === "dark" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                fontWeight: 400,
                ml: 0.3,
              }}
            >
              {unit}
            </Typography>
          )}
        </Box>
      </Box>

      {/* 数据源状态点 */}
      {dataSourceId && (
        <Box
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: hasLiveData ? "#4caf50" : "#ff9800",
            boxShadow: hasLiveData
              ? "0 0 4px #4caf5066"
              : "0 0 4px #ff980066",
            opacity: 0.8,
          }}
        />
      )}

      {/* 进度条 */}
      {showProgress && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        >
          <Box
            sx={{
              width: `${progress}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${accentColor}55, ${accentColor}cc, ${accentColor})`,
              transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              borderRadius: "0 1px 0 0",
              boxShadow: `0 0 6px ${accentColor}44`,
            }}
          />
        </Box>
      )}

      {/* 角落装饰（左下） */}
      <Box
        sx={{
          position: "absolute",
          bottom: showProgress ? 3 : 4,
          left: 4,
          width: 8,
          height: 1,
          background: `${accentColor}30`,
          borderRadius: 0.5,
        }}
      />
    </Box>
  );
}
