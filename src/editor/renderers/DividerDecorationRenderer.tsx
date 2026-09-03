import { useId, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function DividerDecorationRenderer({ config, onConfigChange }: ComponentRendererProps) {
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const style = (config.style as string) || "single";
  const opacity = (config.opacity as number) ?? 1;
  const gap = (config.gap as number) ?? 3;
  const lineStyle = (config.lineStyle as string) || "solid";

  const uid = useId().replace(/:/g, "");
  const gradientId = `divider-grad-${uid}`;

  const dashArray =
    lineStyle === "dashed"
      ? "8 4"
      : lineStyle === "dotted"
        ? "2 4"
        : "none";

  const autoFitH = style === "double"
    ? Math.ceil(strokeWidth * 2 + gap + 4)
    : Math.ceil(strokeWidth + 4);

  const lastReportedH = useRef(0);
  useEffect(() => {
    if (!onConfigChange) return;
    if (autoFitH !== lastReportedH.current) {
      lastReportedH.current = autoFitH;
      onConfigChange("_autoFitSize", { height: autoFitH });
    }
  }, [autoFitH, onConfigChange]);

  if (style === "double") {
    const y1 = 50 - gap / 2;
    const y2 = 50 + gap / 2;
    return (
      <DecorationWrapper config={config}>
        <Box sx={{ width: "100%", height: "100%", opacity }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
            <line x1="0" y1={y1} x2="100" y2={y1} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1={y2} x2="100" y2={y2} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </Box>
      </DecorationWrapper>
    );
  }

  if (style === "gradient") {
    return (
      <DecorationWrapper config={config}>
        <Box sx={{ width: "100%", height: "100%", opacity }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={stroke} stopOpacity="0" />
                <stop offset="50%" stopColor={stroke} stopOpacity="1" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="50" x2="100" y2="50" stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </Box>
      </DecorationWrapper>
    );
  }

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <line x1="0" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
