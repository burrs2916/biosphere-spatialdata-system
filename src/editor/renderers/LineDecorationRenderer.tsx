import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function LineDecorationRenderer({ config, onConfigChange }: ComponentRendererProps) {
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 3;
  const lineStyle = (config.lineStyle as string) || "solid";
  const direction = (config.direction as string) || "horizontal";
  const opacity = (config.opacity as number) ?? 1;

  const dashArray =
    lineStyle === "dashed"
      ? "8 4"
      : lineStyle === "dotted"
        ? "2 4"
        : "none";

  const isVertical = direction === "vertical";
  const autoFitH = isVertical ? undefined : Math.ceil(strokeWidth + 4);
  const autoFitW = isVertical ? Math.ceil(strokeWidth + 4) : undefined;

  const lastReported = useRef({ h: 0, w: 0 });
  useEffect(() => {
    if (!onConfigChange) return;
    const size: { width?: number; height?: number } = {};
    if (autoFitH != null && autoFitH !== lastReported.current.h) {
      lastReported.current.h = autoFitH;
      size.height = autoFitH;
    }
    if (autoFitW != null && autoFitW !== lastReported.current.w) {
      lastReported.current.w = autoFitW;
      size.width = autoFitW;
    }
    if (size.width || size.height) {
      onConfigChange("_autoFitSize", size);
    }
  }, [autoFitH, autoFitW, onConfigChange]);

  const renderLine = () => {
    switch (direction) {
      case "vertical":
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
            <line x1="50" y1="0" x2="50" y2="100" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        );
      case "diagonal-tl-br":
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
            <line x1="0" y1="0" x2="100" y2="100" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        );
      case "diagonal-tr-bl":
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
            <line x1="100" y1="0" x2="0" y2="100" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        );
      case "horizontal":
      default:
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
            <line x1="0" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        );
    }
  };

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        {renderLine()}
      </Box>
    </DecorationWrapper>
  );
}
