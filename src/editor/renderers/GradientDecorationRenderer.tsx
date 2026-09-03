import { useId, useEffect } from "react";
import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";
import { DecorationWrapper } from "./DecorationWrapper";

const KEYFRAMES = `
@keyframes deco-grad-shift {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0%); }
}
@keyframes deco-grad-shift-v {
  0% { transform: translateY(-50%); }
  100% { transform: translateY(0%); }
}
@keyframes deco-grad-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

let styleInjected = false;
function injectGradientStyle() {
  if (styleInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-deco-gradient", "true");
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
  styleInjected = true;
}

export function GradientDecorationRenderer({ config }: ComponentRendererProps) {
  const from = (config.gradientFrom as string) || "#2196F3";
  const to = (config.gradientTo as string) || "#FF9800";
  const direction = (config.direction as string) || "to-right";
  const opacity = (config.opacity as number) ?? 1;
  const borderRadius = (config.borderRadius as number) ?? 0;
  const stroke = (config.stroke as string) || "none";
  const strokeWidth = (config.strokeWidth as number) ?? 0;
  const animated = (config.animated as boolean) ?? false;
  const speed = (config.speed as number) ?? 3000;

  const uid = useId().replace(/:/g, "");
  const gradientId = `deco-grad-${uid}`;
  const animGradId = `deco-grad-anim-${uid}`;

  useEffect(() => { injectGradientStyle(); }, []);

  const r = borderRadius;
  const hasStroke = strokeWidth > 0 && stroke !== "none";
  const sw = hasStroke ? strokeWidth / 2 : 0;

  const isRadial = direction === "radial";
  const isVertical = direction === "to-bottom" || direction === "to-top";

  const getStaticGradient = () => {
    if (isRadial) {
      return (
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </radialGradient>
      );
    }
    let x1 = "0", y1 = "0", x2 = "1", y2 = "0";
    switch (direction) {
      case "to-right": x1 = "0"; y1 = "0"; x2 = "1"; y2 = "0"; break;
      case "to-left": x1 = "1"; y1 = "0"; x2 = "0"; y2 = "0"; break;
      case "to-bottom": x1 = "0"; y1 = "0"; x2 = "0"; y2 = "1"; break;
      case "to-top": x1 = "0"; y1 = "1"; x2 = "0"; y2 = "0"; break;
      case "to-right-bottom": x1 = "0"; y1 = "0"; x2 = "1"; y2 = "1"; break;
      case "to-left-bottom": x1 = "1"; y1 = "0"; x2 = "0"; y2 = "1"; break;
    }
    return (
      <linearGradient id={gradientId} x1={x1} y1={y1} x2={x2} y2={y2}>
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
    );
  };

  const getAnimatedGradient = () => {
    if (isRadial) {
      return (
        <radialGradient id={animGradId} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor={from} />
          <stop offset="25%" stopColor={to} />
          <stop offset="50%" stopColor={from} />
          <stop offset="75%" stopColor={to} />
          <stop offset="100%" stopColor={from} />
        </radialGradient>
      );
    }
    return (
      <linearGradient id={animGradId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={from} />
        <stop offset="25%" stopColor={to} />
        <stop offset="50%" stopColor={from} />
        <stop offset="75%" stopColor={to} />
        <stop offset="100%" stopColor={from} />
      </linearGradient>
    );
  };

  const renderStatic = () => (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <defs>{getStaticGradient()}</defs>
      <rect
        x={sw} y={sw}
        width={100 - sw * 2} height={100 - sw * 2}
        rx={r} ry={r}
        fill={`url(#${gradientId})`}
        stroke={hasStroke ? stroke : "none"}
        strokeWidth={hasStroke ? strokeWidth : 0}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );

  const renderAnimated = () => {
    if (isRadial) {
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id={animGradId} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" stopColor={from} />
              <stop offset="33%" stopColor={to} />
              <stop offset="66%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </radialGradient>
          </defs>
          <rect
            x={sw} y={sw}
            width={100 - sw * 2} height={100 - sw * 2}
            rx={r} ry={r}
            fill={`url(#${animGradId})`}
            stroke={hasStroke ? stroke : "none"}
            strokeWidth={hasStroke ? strokeWidth : 0}
            vectorEffect="non-scaling-stroke"
            style={{
              animation: `deco-grad-rotate ${speed * 3}ms linear infinite`,
              transformOrigin: "50% 50%",
            }}
          />
        </svg>
      );
    }

    const animName = isVertical ? "deco-grad-shift-v" : "deco-grad-shift";

    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>{getAnimatedGradient()}</defs>
        <clipPath id={`clip-${uid}`}>
          <rect x={sw} y={sw} width={100 - sw * 2} height={100 - sw * 2} rx={r} ry={r} />
        </clipPath>
        <g clipPath={`url(#clip-${uid})`}>
          <rect
            x={isVertical ? sw : -50}
            y={isVertical ? -50 : sw}
            width={isVertical ? 100 - sw * 2 : 200}
            height={isVertical ? 200 : 100 - sw * 2}
            fill={`url(#${animGradId})`}
            style={{
              animation: `${animName} ${speed}ms linear infinite`,
            }}
          />
        </g>
        {hasStroke && (
          <rect
            x={sw} y={sw}
            width={100 - sw * 2} height={100 - sw * 2}
            rx={r} ry={r}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    );
  };

  return (
    <DecorationWrapper config={config}>
      <Box sx={{ width: "100%", height: "100%", opacity, overflow: "visible" }}>
        {animated ? renderAnimated() : renderStatic()}
      </Box>
    </DecorationWrapper>
  );
}
