import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function StarDecorationRenderer({ config }: ComponentRendererProps) {
  const fill = (config.fill as string) || "rgba(33, 150, 243, 0.3)";
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const points = (config.points as number) ?? 5;
  const innerRatio = (config.innerRatio as number) ?? 0.4;
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
  const outerR = 45;
  const innerR = outerR * innerRatio;

  const pathParts: string[] = [];
  const totalPoints = points * 2;

  for (let i = 0; i < totalPoints; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pathParts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  pathParts.push("Z");

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <path
            d={pathParts.join(" ")}
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
