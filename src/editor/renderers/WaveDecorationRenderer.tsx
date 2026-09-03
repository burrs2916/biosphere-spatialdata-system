import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function WaveDecorationRenderer({ config, onConfigChange }: ComponentRendererProps) {
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const amplitude = (config.amplitude as number) ?? 10;
  const wavelength = (config.wavelength as number) ?? 30;
  const lineStyle = (config.lineStyle as string) || "solid";
  const fill = (config.fill as string) || "none";
  const opacity = (config.opacity as number) ?? 1;

  const dashArray =
    lineStyle === "dashed"
      ? "8 4"
      : lineStyle === "dotted"
        ? "2 4"
        : "none";

  const ampNorm = Math.min(amplitude, 45);
  const hasFill = fill && fill !== "none";
  const autoFitH = hasFill
    ? Math.ceil(ampNorm * 2 + strokeWidth + 4)
    : Math.ceil(ampNorm * 2 + strokeWidth + 4);

  const lastReportedH = useRef(0);
  useEffect(() => {
    if (!onConfigChange) return;
    if (autoFitH !== lastReportedH.current) {
      lastReportedH.current = autoFitH;
      onConfigChange("_autoFitSize", { height: autoFitH });
    }
  }, [autoFitH, onConfigChange]);

  const vbW = 100;
  const vbH = 100;
  const midY = 50;

  const numWaves = Math.max(2, Math.ceil(vbW / wavelength));
  const effectiveWL = vbW / numWaves;

  let d = `M 0 ${midY}`;
  const step = 0.5;
  for (let x = 0; x <= vbW; x += step) {
    const y = midY + ampNorm * Math.sin((2 * Math.PI * x) / effectiveWL);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  const fillPath = fill && fill !== "none"
    ? d + ` L ${vbW} ${vbH} L 0 ${vbH} Z`
    : "";

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
          {fillPath && <path d={fillPath} fill={fill} />}
          <path
            d={d}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
