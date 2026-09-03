import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function DiagonalDecorationRenderer({ config }: ComponentRendererProps) {
  const stroke = (config.stroke as string) || "rgba(255,255,255,0.1)";
  const strokeWidth = (config.strokeWidth as number) ?? 1;
  const spacing = (config.spacing as number) ?? 10;
  const angle = (config.angle as number) ?? 45;
  const lineStyle = (config.lineStyle as string) || "solid";
  const opacity = (config.opacity as number) ?? 1;

  const dashArray =
    lineStyle === "dashed"
      ? "8 4"
      : lineStyle === "dotted"
        ? "2 4"
        : "none";

  const rad = (angle * Math.PI) / 180;
  const tanA = Math.abs(Math.tan(rad));
  const effectiveSpacing = Math.max(spacing, strokeWidth + 2);

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  if (angle > 0 && angle < 90) {
    const step = effectiveSpacing / Math.sin(rad);
    const stepY = effectiveSpacing / Math.cos(rad);
    const totalStep = Math.min(step, stepY);

    for (let offset = -200; offset <= 300; offset += totalStep) {
      const x1 = offset;
      const y1 = 0;
      const x2 = offset + 100 * tanA;
      const y2 = 100;
      lines.push({ x1, y1, x2, y2 });
    }
  } else if (angle === 90) {
    for (let x = 0; x <= 100; x += effectiveSpacing) {
      lines.push({ x1: x, y1: 0, x2: x, y2: 100 });
    }
  } else if (angle === 0) {
    for (let y = 0; y <= 100; y += effectiveSpacing) {
      lines.push({ x1: 0, y1: y, x2: 100, y2: y });
    }
  } else {
    const absAngle = ((angle % 360) + 360) % 360;
    const normalizedAngle = absAngle > 180 ? absAngle - 360 : absAngle;
    const nRad = (normalizedAngle * Math.PI) / 180;
    const step = effectiveSpacing / Math.abs(Math.sin(nRad));

    for (let offset = -200; offset <= 300; offset += step) {
      lines.push({ x1: offset, y1: 0, x2: offset - 100 * Math.abs(tanA), y2: 100 });
    }
  }

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
