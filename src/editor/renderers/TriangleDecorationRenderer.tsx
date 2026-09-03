import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function TriangleDecorationRenderer({ config }: ComponentRendererProps) {
  const fill = (config.fill as string) || "rgba(33, 150, 243, 0.3)";
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const direction = (config.direction as string) || "up";
  const borderStyle = (config.borderStyle as string) || "solid";
  const opacity = (config.opacity as number) ?? 1;

  const hasStroke = strokeWidth > 0 && borderStyle !== "none";
  const dashArray =
    borderStyle === "dashed"
      ? "8 4"
      : borderStyle === "dotted"
        ? "2 4"
        : "none";

  const getPoints = () => {
    switch (direction) {
      case "up": return "50,5 95,95 5,95";
      case "down": return "5,5 95,5 50,95";
      case "left": return "95,5 95,95 5,50";
      case "right": return "5,5 5,95 95,50";
      default: return "50,5 95,95 5,95";
    }
  };

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <polygon
            points={getPoints()}
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
