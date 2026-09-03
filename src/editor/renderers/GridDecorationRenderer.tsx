import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function GridDecorationRenderer({ config }: ComponentRendererProps) {
  const stroke = (config.stroke as string) || "rgba(255,255,255,0.1)";
  const strokeWidth = (config.strokeWidth as number) ?? 1;
  const spacing = (config.spacing as number) ?? 20;
  const lineStyle = (config.lineStyle as string) || "solid";
  const opacity = (config.opacity as number) ?? 1;

  const dashArray =
    lineStyle === "dashed"
      ? "8 4"
      : lineStyle === "dotted"
        ? "2 4"
        : "none";

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (let x = spacing; x < 100; x += spacing) {
    lines.push({ x1: x, y1: 0, x2: x, y2: 100 });
  }
  for (let y = spacing; y < 100; y += spacing) {
    lines.push({ x1: 0, y1: y, x2: 100, y2: y });
  }

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
