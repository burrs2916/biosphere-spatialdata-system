import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function RingDecorationRenderer({ config }: ComponentRendererProps) {
  const stroke = (config.stroke as string) || "#2196F3";
  const ringWidth = (config.ringWidth as number) ?? 6;
  const opacity = (config.opacity as number) ?? 1;
  const borderStyle = (config.borderStyle as string) || "solid";
  const fill = (config.fill as string) || "none";
  const strokeWidth = (config.strokeWidth as number) ?? 0;

  const strokeDasharray =
    borderStyle === "dashed"
      ? "8 4"
      : borderStyle === "dotted"
        ? "2 4"
        : borderStyle === "dash-dot"
          ? "12 4 2 4"
          : "none";

  const hasStroke = strokeWidth > 0;

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity, overflow: "visible" }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ overflow: "visible" }}>
          <circle
            cx="50" cy="50"
            r={Math.max(1, 50 - ringWidth / 2)}
            fill={fill}
            stroke={stroke}
            strokeWidth={ringWidth}
            strokeDasharray={strokeDasharray}
            vectorEffect="non-scaling-stroke"
          />
          {hasStroke && (
            <circle
              cx="50" cy="50"
              r={Math.max(1, 50 - ringWidth / 2 - ringWidth / 2 - strokeWidth / 2)}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={0.5}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
