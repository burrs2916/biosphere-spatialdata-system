import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

export function CornerDecorationRenderer({ config }: ComponentRendererProps) {
  const stroke = (config.stroke as string) || "#2196F3";
  const size = (config.size as number) ?? 15;
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const position = (config.position as string) || "all";
  const style = (config.style as string) || "bracket";
  const opacity = (config.opacity as number) ?? 1;

  const showTopLeft = position === "all" || position === "top-left" || position === "top" || position === "left";
  const showTopRight = position === "all" || position === "top-right" || position === "top" || position === "right";
  const showBottomLeft = position === "all" || position === "bottom-left" || position === "bottom" || position === "left";
  const showBottomRight = position === "all" || position === "bottom-right" || position === "bottom" || position === "right";

  const s = size;

  const getCornerPath = (corner: string) => {
    if (style === "l-shape") {
      switch (corner) {
        case "tl": return `M 0 0 L ${s} 0 L ${s} ${s}`;
        case "tr": return `M 100 0 L ${100 - s} 0 L ${100 - s} ${s}`;
        case "bl": return `M 0 100 L ${s} 100 L ${s} ${100 - s}`;
        case "br": return `M 100 100 L ${100 - s} 100 L ${100 - s} ${100 - s}`;
      }
    }

    switch (corner) {
      case "tl": return `M 0 ${s} L ${s} ${s} L ${s} 0`;
      case "tr": return `M 100 ${s} L ${100 - s} ${s} L ${100 - s} 0`;
      case "bl": return `M 0 ${100 - s} L ${s} ${100 - s} L ${s} 100`;
      case "br": return `M 100 ${100 - s} L ${100 - s} ${100 - s} L ${100 - s} 100`;
    }
    return "";
  };

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", position: "relative", opacity }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          {showTopLeft && (
            <path d={getCornerPath("tl")} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
          {showTopRight && (
            <path d={getCornerPath("tr")} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
          {showBottomLeft && (
            <path d={getCornerPath("bl")} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
          {showBottomRight && (
            <path d={getCornerPath("br")} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      </Box>
    </DecorationWrapper>
  );
}
