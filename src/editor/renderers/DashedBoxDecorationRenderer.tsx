import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function DashedBoxDecorationRenderer({ config }: ComponentRendererProps) {
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const dashLength = (config.dashLength as number) ?? 8;
  const gapLength = (config.gapLength as number) ?? 4;
  const borderRadius = (config.borderRadius as number) ?? 0;
  const fill = (config.fill as string) || "none";
  const opacity = (config.opacity as number) ?? 1;

  const r = borderRadius;
  const sw = strokeWidth / 2;

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity, overflow: "visible" }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          <rect
            x={sw}
            y={sw}
            width={100 - strokeWidth}
            height={100 - strokeWidth}
            rx={r}
            ry={r}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${gapLength}`}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
