import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

/* 箭头装饰组件 — 自定义线条式箭头
   与同组的"线条"装饰相同结构：水平/垂直线 + 三角箭头头（单/双向）
   注：之前未使用 SVG 参考实现。 */

export function ArrowDecorationRenderer({ config, onConfigChange }: ComponentRendererProps) {
  const stroke = (config.color1 as string) || (config.color as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const direction = (config.direction as string) || "right";
  const arrowType = (config.arrowType as string) || "single";
  const arrowSize = (config.arrowSize as number) ?? 10;
  const lineStyle = (config.lineStyle as string) || "solid";
  const opacity = (config.opacity as number) ?? 1;

  const dashArray =
    lineStyle === "dashed"
      ? "8 4"
      : lineStyle === "dotted"
        ? "2 4"
        : "none";

  const isVertical = direction === "up" || direction === "down";
  const autoFitH = isVertical ? undefined : Math.ceil(arrowSize + strokeWidth + 4);
  const autoFitW = isVertical ? Math.ceil(arrowSize + strokeWidth + 4) : undefined;

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

  const getRotation = () => {
    switch (direction) {
      case "up": return -90;
      case "down": return 90;
      case "left": return 180;
      case "right": default: return 0;
    }
  };

  const renderArrowHead = (tipX: number, tipY: number, reverse = false) => {
    const size = arrowSize;
    const halfAngle = 30 * Math.PI / 180;
    const dx = size * Math.cos(halfAngle);
    const dy = size * Math.sin(halfAngle);
    if (reverse) {
      return `M ${tipX + dx} ${tipY - dy} L ${tipX} ${tipY} L ${tipX + dx} ${tipY + dy} Z`;
    }
    return `M ${tipX - dx} ${tipY - dy} L ${tipX} ${tipY} L ${tipX - dx} ${tipY + dy} Z`;
  };

  const startX = arrowType === "double" ? 15 : 0;
  const endX = arrowType === "double" ? 85 : 100;
  const midY = 50;
  const pathD = `M ${startX} ${midY} L ${endX} ${midY}`;
  const arrowHeadD = renderArrowHead(endX, midY);
  const arrowTailD = arrowType === "double" ? renderArrowHead(startX, midY, true) : "";

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <g transform={`rotate(${getRotation()} 50 50)`}>
            <path d={pathD} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={arrowHeadD} stroke={stroke} strokeWidth={strokeWidth} fill={stroke} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {arrowType === "double" && (
              <path d={arrowTailD} stroke={stroke} strokeWidth={strokeWidth} fill={stroke} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            )}
          </g>
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
