import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function CrossDecorationRenderer({ config }: ComponentRendererProps) {
  const fill = (config.fill as string) || "#2196F3";
  const stroke = (config.stroke as string) || "transparent";
  const strokeWidth = (config.strokeWidth as number) ?? 0;
  const thickness = (config.thickness as number) ?? 10;
  const opacity = (config.opacity as number) ?? 1;

  const hasStroke = strokeWidth > 0 && stroke !== "transparent";
  const t = thickness;
  const ht = t / 2;

  const crossPath = [
    `M ${50 - ht} 5`,
    `L ${50 + ht} 5`,
    `L ${50 + ht} ${50 - ht}`,
    `L 95 ${50 - ht}`,
    `L 95 ${50 + ht}`,
    `L ${50 + ht} ${50 + ht}`,
    `L ${50 + ht} 95`,
    `L ${50 - ht} 95`,
    `L ${50 - ht} ${50 + ht}`,
    `L 5 ${50 + ht}`,
    `L 5 ${50 - ht}`,
    `L ${50 - ht} ${50 - ht}`,
    "Z",
  ].join(" ");

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <path
            d={crossPath}
            fill={fill}
            stroke={hasStroke ? stroke : "none"}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
