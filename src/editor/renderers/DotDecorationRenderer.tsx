import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

function renderShape(shape: string, fill: string, stroke: string, strokeWidth: number): React.ReactElement {
  const sw = strokeWidth;
  const hasStroke = sw > 0 && stroke !== "transparent";

  switch (shape) {
    case "square":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <rect
            x={hasStroke ? sw : 0} y={hasStroke ? sw : 0}
            width={hasStroke ? 100 - sw * 2 : 100} height={hasStroke ? 100 - sw * 2 : 100}
            fill={fill} stroke={hasStroke ? stroke : "none"} strokeWidth={sw}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      );
    case "triangle":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <polygon points="50,5 95,95 5,95" fill={fill} stroke={hasStroke ? stroke : "none"} strokeWidth={sw} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      );
    case "diamond":
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <polygon points="50,5 95,50 50,95 5,50" fill={fill} stroke={hasStroke ? stroke : "none"} strokeWidth={sw} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      );
    case "cross": {
      const t = 25;
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
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <path d={crossPath} fill={fill} stroke={hasStroke ? stroke : "none"} strokeWidth={sw} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      );
    }
    case "star": {
      const cx = 50, cy = 50, outerR = 45, innerR = 18;
      const pathParts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * i) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        pathParts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
      }
      pathParts.push("Z");
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <path d={pathParts.join(" ")} fill={fill} stroke={hasStroke ? stroke : "none"} strokeWidth={sw} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      );
    }
    case "circle":
    default:
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <circle cx="50" cy="50" r={hasStroke ? 50 - sw / 2 : 50} fill={fill} stroke={hasStroke ? stroke : "none"} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
        </svg>
      );
  }
}

export function DotDecorationRenderer({ config }: ComponentRendererProps) {
  const fill = (config.fill as string) || "#2196F3";
  const stroke = (config.stroke as string) || "transparent";
  const strokeWidth = (config.strokeWidth as number) ?? 0;
  const shape = (config.shape as string) || "circle";
  const opacity = (config.opacity as number) ?? 1;

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
        {renderShape(shape, fill, stroke, strokeWidth)}
      </Box>
    </DecorationWrapper>
  );
}
