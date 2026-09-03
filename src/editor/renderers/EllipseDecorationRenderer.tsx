import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function EllipseDecorationRenderer({ config, width, height }: ComponentRendererProps) {
  const fill = (config.fill as string) || "rgba(33, 150, 243, 0.3)";
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const borderStyle = (config.borderStyle as string) || "solid";
  const opacity = (config.opacity as number) ?? 1;

  const hasStroke = strokeWidth > 0 && borderStyle !== "none";
  const dashArray =
    borderStyle === "dashed"
      ? "8 4"
      : borderStyle === "dotted"
        ? "2 4"
        : "none";

  const w = width || 200;
  const h = height || 120;
  const cx = w / 2;
  const cy = h / 2;
  const sw = hasStroke ? strokeWidth / 2 : 0;
  const rx = Math.max(1, cx - sw);
  const ry = Math.max(1, cy - sw);

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity, overflow: "visible" }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <ellipse
            cx={cx} cy={cy}
            rx={rx} ry={ry}
            fill={fill}
            stroke={hasStroke ? stroke : "none"}
            strokeWidth={hasStroke ? strokeWidth : 0}
            strokeDasharray={hasStroke ? dashArray : "none"}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
