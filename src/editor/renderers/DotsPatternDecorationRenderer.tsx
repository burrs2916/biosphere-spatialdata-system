import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function DotsPatternDecorationRenderer({ config }: ComponentRendererProps) {
  const fill = (config.fill as string) || "rgba(255,255,255,0.15)";
  const dotSize = (config.dotSize as number) ?? 2;
  const spacing = (config.spacing as number) ?? 12;
  const shape = (config.shape as string) || "circle";
  const opacity = (config.opacity as number) ?? 1;

  const r = dotSize;
  const s = dotSize * 2;

  const dots: { cx: number; cy: number }[] = [];
  for (let x = spacing; x < 100; x += spacing) {
    for (let y = spacing; y < 100; y += spacing) {
      dots.push({ cx: x, cy: y });
    }
  }

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          {dots.map((d, i) => {
            if (shape === "square") {
              return <rect key={i} x={d.cx - r} y={d.cy - r} width={s} height={s} fill={fill} />;
            }
            if (shape === "diamond") {
              return <rect key={i} x={d.cx - r} y={d.cy - r} width={s} height={s} fill={fill} transform={`rotate(45 ${d.cx} ${d.cy})`} />;
            }
            return <circle key={i} cx={d.cx} cy={d.cy} r={r} fill={fill} />;
          })}
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
