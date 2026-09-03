/**
 * DeviceTooltip — 设备浮层信息框（hover 触发）
 *
 * 两种视觉风格：
 * - "default"：白色背景，通用信息浮层
 * - "tech"：深色科技感背景，适合传感器等小面板设备的 faceItems 展示
 *
 * 显示位置：默认上方，space 不够则自动切换方向。
 */
import React, { useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { TooltipField } from "./deviceStatus";

export type TooltipPlacement = "top" | "top-right" | "right" | "bottom" | "left";
export type TooltipVariant = "default" | "tech";

interface DeviceTooltipProps {
  fields: TooltipField[];
  /** 屏幕/外壳状态视觉，用于色点 */
  statusColor: string;
  /** 容器 ref，用于计算是否被遮挡 */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** 浮层位置（默认 top） */
  preferredPlacement?: TooltipPlacement;
  /** 视觉风格：default=白色通用, tech=深色科技感 */
  variant?: TooltipVariant;
}

/** 科技感深色主题样式 */
const TECH_STYLES = {
  container: {
    bgcolor: "rgba(8, 18, 38, 0.94)",
    color: "#e0f0ff",
    borderRadius: 2,
    border: "1px solid rgba(0, 220, 180, 0.25)",
    boxShadow: "0 0 12px rgba(0, 220, 180, 0.15), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(0, 220, 180, 0.08)",
    p: 1.5,
  },
  title: {
    color: "#00dcc0",
    borderBottom: "1px solid rgba(0, 220, 180, 0.15)",
  },
  label: {
    color: "rgba(140, 200, 220, 0.7)",
  },
  value: {
    color: "#e0f0ff",
  },
  statusValue: {
    color: "#00ffc8",
    textShadow: "0 0 6px rgba(0, 255, 200, 0.4)",
  },
  dot: {
    boxShadow: "0 0 6px currentColor",
  },
  scanline: {
    background: "linear-gradient(180deg, transparent 0%, rgba(0, 220, 180, 0.03) 50%, transparent 100%)",
  },
} as const;

/** 默认白色主题样式 */
const DEFAULT_STYLES = {
  container: {
    bgcolor: "rgba(255, 255, 255, 0.98)",
    color: "text.primary",
    borderRadius: 1.5,
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    p: 1.25,
  },
  title: {
    color: "text.primary",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  },
  label: {
    color: "text.secondary",
  },
  value: {
    color: "text.primary",
  },
  statusValue: {
    color: "inherit",
  },
  dot: {},
  scanline: {},
} as const;

export function DeviceTooltip({
  fields,
  statusColor,
  anchorRef,
  preferredPlacement = "top",
  variant = "default",
}: DeviceTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<TooltipPlacement>(preferredPlacement);
  const isTech = variant === "tech";
  const theme = isTech ? TECH_STYLES : DEFAULT_STYLES;

  // 测量并选定方向
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tip = tooltipRef.current;
    if (!anchor || !tip) return;
    const aRect = anchor.getBoundingClientRect();
    const tRect = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (preferredPlacement === "top" && aRect.top - tRect.height < 8) {
      setPlacement(aRect.right + tRect.width < vw ? "right" : "bottom");
    } else if (preferredPlacement === "top-right" && aRect.top - tRect.height < 8) {
      setPlacement(aRect.right + tRect.width < vw ? "right" : "bottom");
    } else if (preferredPlacement === "right" && aRect.right + tRect.width > vw) {
      setPlacement(aRect.bottom + tRect.height < vh ? "bottom" : "top");
    } else if (preferredPlacement === "bottom" && aRect.bottom + tRect.height > vh) {
      setPlacement(aRect.left - tRect.width > 0 ? "left" : "top");
    } else if (preferredPlacement === "left" && aRect.left - tRect.width < 0) {
      setPlacement(aRect.bottom + tRect.height < vh ? "bottom" : "right");
    }
  }, [preferredPlacement, fields, anchorRef]);

  if (fields.length === 0) return null;

  const titleField = fields.find((f) => f.primary);
  const otherFields = fields.filter((f) => !f.primary);

  // 科技感主题的箭头指示器
  const arrowColor = isTech ? "rgba(0, 220, 180, 0.6)" : "rgba(0,0,0,0.08)";
  const arrowSize = isTech ? 10 : 6;
  const gap = isTech ? 2 : 10;

  return (
    <Box
      ref={tooltipRef}
      sx={{
        position: "absolute",
        zIndex: 1300,
        pointerEvents: "none",
        minWidth: isTech ? 200 : 180,
        maxWidth: isTech ? 320 : 280,
        fontSize: 12,
        lineHeight: 1.4,
        fontFamily: isTech
          ? "'SF Mono', 'Fira Code', 'Consolas', monospace"
          : "system-ui, -apple-system, sans-serif",
        ...theme.container,
        ...(placement === "top" && { bottom: `calc(100% + ${gap}px)`, left: "50%", transform: "translateX(-50%)" }),
        ...(placement === "top-right" && { bottom: `calc(100% + ${gap}px)`, right: 0 }),
        ...(placement === "bottom" && { top: `calc(100% + ${gap}px)`, left: "50%", transform: "translateX(-50%)" }),
        ...(placement === "right" && { left: `calc(100% + ${gap}px)`, top: "50%", transform: "translateY(-50%)" }),
        ...(placement === "left" && { right: `calc(100% + ${gap}px)`, top: "50%", transform: "translateY(-50%)" }),
        // 科技感：入场动画
        ...(isTech && {
          animation: "techTooltipIn 0.2s ease-out",
          "@keyframes techTooltipIn": {
            "0%": { opacity: 0, transform: placement === "top" ? "translateX(-50%) translateY(4px)" : placement === "top-right" ? "translateY(4px)" : placement === "bottom" ? "translateX(-50%) translateY(-4px)" : placement === "right" ? "translateY(-50%) translateX(-4px)" : "translateY(-50%) translateX(4px)" },
            "100%": { opacity: 1, transform: placement === "top" ? "translateX(-50%) translateY(0)" : placement === "top-right" ? "translateY(0)" : placement === "bottom" ? "translateX(-50%) translateY(0)" : placement === "right" ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(0)" },
          },
        }),
      }}
    >
      {/* 科技感：扫描线效果 */}
      {isTech && (
        <Box sx={{
          position: "absolute", inset: 0, borderRadius: 2, pointerEvents: "none",
          ...theme.scanline,
          backgroundSize: "100% 4px",
        }} />
      )}

      {/* 科技感：方向箭头 */}
      {isTech && (
        <Box sx={{
          position: "absolute",
          width: 0, height: 0,
          ...(placement === "top" && {
            bottom: -arrowSize, left: "50%", transform: "translateX(-50%)",
            borderLeft: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid transparent`,
            borderTop: `${arrowSize}px solid ${arrowColor}`,
          }),
          ...(placement === "top-right" && {
            bottom: -arrowSize, right: 16,
            borderLeft: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid transparent`,
            borderTop: `${arrowSize}px solid ${arrowColor}`,
          }),
          ...(placement === "bottom" && {
            top: -arrowSize, left: "50%", transform: "translateX(-50%)",
            borderLeft: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid ${arrowColor}`,
          }),
          ...(placement === "right" && {
            left: -arrowSize, top: "50%", transform: "translateY(-50%)",
            borderTop: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid transparent`,
            borderRight: `${arrowSize}px solid ${arrowColor}`,
          }),
          ...(placement === "left" && {
            right: -arrowSize, top: "50%", transform: "translateY(-50%)",
            borderTop: `${arrowSize}px solid transparent`,
            borderBottom: `${arrowSize}px solid transparent`,
            borderLeft: `${arrowSize}px solid ${arrowColor}`,
          }),
        }} />
      )}

      {titleField && (
        <Box sx={{
          display: "flex", alignItems: "center", gap: 0.75,
          mb: 0.5, pb: 0.5,
          borderBottom: `1px solid ${isTech ? "rgba(0, 220, 180, 0.15)" : "rgba(0,0,0,0.08)"}`,
        }}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: "50%",
              bgcolor: statusColor, flexShrink: 0,
              ...(isTech ? { boxShadow: `0 0 6px ${statusColor}`, animation: "techDotPulse 2s ease-in-out infinite" } : {}),
              "@keyframes techDotPulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.5 },
              },
            }}
          />
          <Typography sx={{
            fontSize: isTech ? 11 : 12,
            fontWeight: 700,
            color: isTech ? "#00dcc0" : "text.primary",
            ...(isTech ? { textShadow: "0 0 8px rgba(0, 220, 180, 0.3)" } : {}),
          }}>
            {titleField.value}
          </Typography>
        </Box>
      )}
      {otherFields.map((f, idx) => (
        <Box
          key={f.key}
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 0.75,
            py: 0.3,
            fontSize: isTech ? 11 : 11.5,
            ...(isTech && idx > 0 ? { borderTop: "1px solid rgba(0, 220, 180, 0.06)" } : {}),
          }}
        >
          <Typography component="span" sx={{
            fontSize: isTech ? 10 : 11.5,
            color: isTech ? "rgba(140, 200, 220, 0.65)" : "text.secondary",
            minWidth: isTech ? 52 : 56,
            flexShrink: 0,
            fontWeight: isTech ? 500 : 400,
          }}>
            {f.label}
          </Typography>
          <Typography
            component="span"
            sx={{
              fontSize: isTech ? 11 : 11.5,
              color: f.key === "status"
                ? (isTech ? "#00ffc8" : statusColor)
                : (isTech ? "#e0f0ff" : "text.primary"),
              fontWeight: f.key === "status" ? 700 : 400,
              wordBreak: "break-all",
              ...(f.key === "status" && isTech ? { textShadow: "0 0 6px rgba(0, 255, 200, 0.4)" } : {}),
              ...(isTech ? { fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" } : {}),
            }}
          >
            {f.value}{f.unit ? ` ${f.unit}` : ""}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
