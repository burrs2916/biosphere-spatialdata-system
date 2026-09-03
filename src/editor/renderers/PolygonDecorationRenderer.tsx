import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function PolygonDecorationRenderer({ config }: ComponentRendererProps) {
  const fill = (config.fill as string) || "rgba(33, 150, 243, 0.3)";
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const sides = (config.sides as number) ?? 6;
  const borderStyle = (config.borderStyle as string) || "solid";
  const opacity = (config.opacity as number) ?? 1;

  const hasStroke = strokeWidth > 0 && borderStyle !== "none";
  const dashArray =
    borderStyle === "dashed"
      ? "8 4"
      : borderStyle === "dotted"
        ? "2 4"
        : "none";

  const cx = 50;
  const cy = 50;
  const r = 45;

  const points = Array.from({ length: sides }, (_, i) => {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x},${y}`;
  }).join(" ");

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <polygon
            points={points}
            fill={fill}
            stroke={hasStroke ? stroke : "none"}
            strokeWidth={hasStroke ? strokeWidth : 0}
            strokeDasharray={hasStroke ? dashArray : "none"}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
