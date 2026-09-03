import { useRef, useEffect } from "react";
import {
  type ViewportTransform,
  canvasToScreen,
  getVisibleCanvasRect,
  getEffectiveGridSize,
} from "../../utils/viewportTransform";

interface CanvasGridProps {
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  viewport: ViewportTransform;
  visible: boolean;
  containerWidth: number;
  containerHeight: number;
  isDark: boolean;
  minorColor: string;
  majorColor: string;
  opacity: number;
  brightness: number;
}

const DEFAULT_MINOR_DARK = "rgba(255,255,255,0.08)";
const DEFAULT_MINOR_LIGHT = "rgba(0,0,0,0.08)";
const DEFAULT_MAJOR_DARK = "rgba(255,255,255,0.18)";
const DEFAULT_MAJOR_LIGHT = "rgba(0,0,0,0.18)";

const _colorParseCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
if (_colorParseCanvas) {
  _colorParseCanvas.width = 1;
  _colorParseCanvas.height = 1;
}
const _colorParseCtx = _colorParseCanvas?.getContext("2d") ?? null;

function applyColorModifiers(color: string, opacity: number, brightness: number): string {
  if (!_colorParseCtx) {
    return color;
  }
  _colorParseCtx.clearRect(0, 0, 1, 1);
  _colorParseCtx.globalAlpha = 1;
  _colorParseCtx.fillStyle = color;
  _colorParseCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = _colorParseCtx.getImageData(0, 0, 1, 1).data;
  const nr = Math.min(255, Math.round(r * brightness));
  const ng = Math.min(255, Math.round(g * brightness));
  const nb = Math.min(255, Math.round(b * brightness));
  const na = Math.min(1, (a / 255) * opacity);
  return `rgba(${nr},${ng},${nb},${na})`;
}

export function CanvasGrid({
  canvasWidth,
  canvasHeight,
  gridSize,
  viewport,
  visible,
  containerWidth,
  containerHeight,
  isDark,
  minorColor,
  majorColor,
  opacity,
  brightness,
}: CanvasGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const propsRef = useRef({ canvasWidth, canvasHeight, gridSize, viewport, visible, containerWidth, containerHeight, isDark, minorColor, majorColor, opacity, brightness });
  propsRef.current = { canvasWidth, canvasHeight, gridSize, viewport, visible, containerWidth, containerHeight, isDark, minorColor, majorColor, opacity, brightness };

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const p = propsRef.current;
      if (!canvas || !p.visible) return;
      if (p.containerWidth <= 0 || p.containerHeight <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      const pixelW = Math.ceil(p.containerWidth * dpr);
      const pixelH = Math.ceil(p.containerHeight * dpr);

      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, pixelW, pixelH);

      const grid = getEffectiveGridSize(p.gridSize, p.viewport.scale);
      const { minorStep, majorStep, showMajor } = grid;

      /** 倍率：当画布大（如 8K）+ 自适应缩放小，gridSize=20 会被倍率成 80/160/320...
       *  倍率越大，说明实际显示的"网格步长"在画布单位下越大，
       *  此时增强主网格线亮度，让用户在视觉上感知到画布尺寸的变化 */
      const multiplier = Math.max(1, Math.round(minorStep / p.gridSize));
      // 倍率 1 → 1.0x，2 → 1.3x，4 → 1.6x，8 → 1.9x，16+ → 2.2x（封顶）
      const majorBrightnessBoost = Math.min(2.2, 1 + Math.log2(multiplier) * 0.3);

      const resolvedMinor = applyColorModifiers(
        p.minorColor || (p.isDark ? DEFAULT_MINOR_DARK : DEFAULT_MINOR_LIGHT),
        p.opacity,
        p.brightness,
      );
      const resolvedMajor = applyColorModifiers(
        p.majorColor || (p.isDark ? DEFAULT_MAJOR_DARK : DEFAULT_MAJOR_LIGHT),
        Math.min(1, p.opacity * majorBrightnessBoost),
        p.brightness * majorBrightnessBoost,
      );

      const topLeft = canvasToScreen(0, 0, p.viewport);
      const bottomRight = canvasToScreen(p.canvasWidth, p.canvasHeight, p.viewport);
      const clipX = topLeft.screenX * dpr;
      const clipY = topLeft.screenY * dpr;
      const clipW = (bottomRight.screenX - topLeft.screenX) * dpr;
      const clipH = (bottomRight.screenY - topLeft.screenY) * dpr;

      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, clipY, clipW, clipH);
      ctx.clip();

      const vis = getVisibleCanvasRect(p.viewport, p.containerWidth, p.containerHeight);

      const scaleDpr = p.viewport.scale * dpr;
      const minorStepPx = Math.max(1, Math.round(minorStep * scaleDpr));
      const adjMinorStep = minorStepPx / scaleDpr;

      const adjStartX = Math.max(0, Math.floor(vis.left / adjMinorStep) * adjMinorStep);
      const adjEndX = Math.min(p.canvasWidth, Math.ceil(vis.right / adjMinorStep) * adjMinorStep + adjMinorStep);
      const adjStartY = Math.max(0, Math.floor(vis.top / adjMinorStep) * adjMinorStep);
      const adjEndY = Math.min(p.canvasHeight, Math.ceil(vis.bottom / adjMinorStep) * adjMinorStep + adjMinorStep);

      const isOnMajor = (val: number) =>
        Math.abs(val - Math.round(val / majorStep) * majorStep) < adjMinorStep * 0.5;

      const firstPxX = Math.round(canvasToScreen(adjStartX, 0, p.viewport).screenX * dpr) + 0.5;
      const firstPxY = Math.round(canvasToScreen(0, adjStartY, p.viewport).screenY * dpr) + 0.5;

      ctx.lineWidth = 1;

      ctx.strokeStyle = resolvedMinor;
      ctx.beginPath();
      for (let i = 0, x = adjStartX; x <= adjEndX; x += adjMinorStep, i++) {
        if (Math.abs(x) < 0.01) continue;
        if (showMajor && isOnMajor(x)) continue;
        ctx.moveTo(firstPxX + i * minorStepPx, 0);
        ctx.lineTo(firstPxX + i * minorStepPx, pixelH);
      }
      for (let i = 0, y = adjStartY; y <= adjEndY; y += adjMinorStep, i++) {
        if (Math.abs(y) < 0.01) continue;
        if (showMajor && isOnMajor(y)) continue;
        ctx.moveTo(0, firstPxY + i * minorStepPx);
        ctx.lineTo(pixelW, firstPxY + i * minorStepPx);
      }
      ctx.stroke();

      if (showMajor) {
        ctx.strokeStyle = resolvedMajor;
        ctx.beginPath();
        for (let i = 0, x = adjStartX; x <= adjEndX; x += adjMinorStep, i++) {
          if (Math.abs(x) < 0.01) continue;
          if (!isOnMajor(x)) continue;
          ctx.moveTo(firstPxX + i * minorStepPx, 0);
          ctx.lineTo(firstPxX + i * minorStepPx, pixelH);
        }
        for (let i = 0, y = adjStartY; y <= adjEndY; y += adjMinorStep, i++) {
          if (Math.abs(y) < 0.01) continue;
          if (!isOnMajor(y)) continue;
          ctx.moveTo(0, firstPxY + i * minorStepPx);
          ctx.lineTo(pixelW, firstPxY + i * minorStepPx);
        }
        ctx.stroke();
      }

      ctx.restore();
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [canvasWidth, canvasHeight, gridSize, viewport, visible, containerWidth, containerHeight, isDark, minorColor, majorColor, opacity, brightness]);

  return (
    <canvas
      ref={canvasRef}
      width={0}
      height={0}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: Math.max(containerWidth, 0),
        height: Math.max(containerHeight, 0),
        pointerEvents: "none",
        zIndex: 1,
        display: visible ? "block" : "none",
      }}
    />
  );
}
