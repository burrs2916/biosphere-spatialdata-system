import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function RectDecorationRenderer({ config }: ComponentRendererProps) {
  const fill = (config.fill as string) || "rgba(33, 150, 243, 0.3)";
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const borderRadius = (config.borderRadius as number) ?? 0;
  const borderStyle = (config.borderStyle as string) || "solid";
  const opacity = (config.opacity as number) ?? 1;

  const hasStroke = strokeWidth > 0 && borderStyle !== "none";
  const dashArray =
    borderStyle === "dashed"
      ? "8 4"
      : borderStyle === "dotted"
        ? "2 4"
        : "none";

  const sw = hasStroke ? strokeWidth / 2 : 0;
  const r = borderRadius;

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity, overflow: "visible" }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <rect
            x={sw} y={sw}
            width={100 - sw * 2} height={100 - sw * 2}
            rx={r} ry={r}
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
