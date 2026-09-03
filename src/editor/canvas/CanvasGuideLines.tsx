import { useRef, useEffect, useCallback } from "react";
import {
  type ViewportTransform,
  canvasToScreen,
  getVisibleCanvasRect,
} from "../../utils/viewportTransform";
import type { CanvasGuideConfig } from "../../store/editorStore";
import { useEditorStore } from "../../store/editorStore";

interface CanvasGuideLinesProps {
  canvasWidth: number;
  canvasHeight: number;
  viewport: ViewportTransform;
  containerWidth: number;
  containerHeight: number;
  guide: CanvasGuideConfig;
}

function getDashPattern(lineStyle: string, lineWidth: number): number[] {
  switch (lineStyle) {
    case "dashed":
      return [lineWidth * 6, lineWidth * 3];
    case "dotted":
      return [lineWidth * 2, lineWidth * 2];
    default:
      return [];
  }
}

export function getGuidePositions(
  preset: CanvasGuideConfig["preset"],
  canvasWidth: number,
  canvasHeight: number,
  customVertical: number[],
  customHorizontal: number[],
): { vertical: number[]; horizontal: number[] } {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  if (preset === "center" || preset === "center-edges") {
    vertical.push(canvasWidth / 2);
    horizontal.push(canvasHeight / 2);
  }
  if (preset === "edges" || preset === "center-edges") {
    vertical.push(0, canvasWidth);
    horizontal.push(0, canvasHeight);
  }
  if (preset === "custom") {
    vertical.push(...customVertical);
    horizontal.push(...customHorizontal);
  }
  return { vertical, horizontal };
}

export function CanvasGuideLines({
  canvasWidth,
  canvasHeight,
  viewport,
  containerWidth,
  containerHeight,
  guide,
}: CanvasGuideLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{
    type: "vertical" | "horizontal";
    index: number;
    startPos: number;
  } | null>(null);

  const { vertical, horizontal } = getGuidePositions(
    guide.preset,
    canvasWidth,
    canvasHeight,
    guide.customVertical,
    guide.customHorizontal,
  );

  const drawStateRef = useRef({ canvasWidth, canvasHeight, viewport, containerWidth, containerHeight, guide, vertical, horizontal });
  drawStateRef.current = { canvasWidth, canvasHeight, viewport, containerWidth, containerHeight, guide, vertical, horizontal };

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const s = drawStateRef.current;
      if (!canvas || !s.guide.visible) return;
      if (s.containerWidth <= 0 || s.containerHeight <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      const pixelW = Math.ceil(s.containerWidth * dpr);
      const pixelH = Math.ceil(s.containerHeight * dpr);

      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, pixelW, pixelH);

      const alpha = Math.max(0, Math.min(1, s.guide.opacity));
      const lw = Math.max(0.5, s.guide.lineWidth);
      const dash = getDashPattern(s.guide.lineStyle, lw);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.guide.color;
      ctx.lineWidth = lw * dpr;
      ctx.setLineDash(dash.map((d) => d * dpr));

      const vis = getVisibleCanvasRect(s.viewport, s.containerWidth, s.containerHeight);

      for (const vx of s.vertical) {
        const { screenX } = canvasToScreen(vx, 0, s.viewport);
        const px = Math.round(screenX * dpr) + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, pixelH);
        ctx.stroke();
      }

      for (const hy of s.horizontal) {
        const { screenY } = canvasToScreen(0, hy, s.viewport);
        const py = Math.round(screenY * dpr) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(pixelW, py);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      if (s.guide.showLabel) {
        ctx.globalAlpha = Math.max(alpha, 0.7);
        const fontSize = 11 * dpr;
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = s.guide.color;

        for (const vx of s.vertical) {
          const { screenX } = canvasToScreen(vx, 0, s.viewport);
          const px = screenX * dpr;
          const py = Math.max(fontSize + 4 * dpr, canvasToScreen(0, vis.top, s.viewport).screenY * dpr + fontSize + 4 * dpr);
          const label = `x: ${Math.round(vx)}`;
          const tw = ctx.measureText(label).width;
          ctx.globalAlpha = alpha * 0.85;
          ctx.fillStyle = s.guide.color;
          ctx.fillRect(px - tw / 2 - 3 * dpr, py - fontSize - 2 * dpr, tw + 6 * dpr, fontSize + 4 * dpr);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(label, px, py);
        }

        for (const hy of s.horizontal) {
          const { screenY } = canvasToScreen(0, hy, s.viewport);
          const px = Math.max(4 * dpr, canvasToScreen(vis.left, 0, s.viewport).screenX * dpr + 4 * dpr);
          const py = screenY * dpr;
          const label = `y: ${Math.round(hy)}`;
          const tw = ctx.measureText(label).width;
          ctx.globalAlpha = alpha * 0.85;
          ctx.fillStyle = s.guide.color;
          ctx.fillRect(px - 2 * dpr, py - fontSize / 2 - 2 * dpr, tw + 6 * dpr, fontSize + 4 * dpr);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(label, px + 1 * dpr, py);
        }
      }

      ctx.restore();
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [canvasWidth, canvasHeight, viewport, containerWidth, containerHeight, guide]);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!guide.draggable || !guide.visible) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const threshold = 6;

      for (let i = 0; i < vertical.length; i++) {
        const { screenX } = canvasToScreen(vertical[i], 0, viewport);
        if (Math.abs(mx - screenX) < threshold) {
          dragRef.current = { type: "vertical", index: i, startPos: vertical[i] };
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      for (let i = 0; i < horizontal.length; i++) {
        const { screenY } = canvasToScreen(0, horizontal[i], viewport);
        if (Math.abs(my - screenY) < threshold) {
          dragRef.current = { type: "horizontal", index: i, startPos: horizontal[i] };
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    },
    [guide.draggable, guide.visible, vertical, horizontal, viewport],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const { setCanvasConfig, canvasConfig } = useEditorStore.getState();

      const drag = dragRef.current;

      if (drag.type === "vertical") {
        const canvasX = (mx - viewport.offset.x) / viewport.scale;
        if (canvasConfig.guide.preset === "custom") {
          const newCustom = [...canvasConfig.guide.customVertical];
          if (drag.index < newCustom.length) {
            newCustom[drag.index] = Math.round(canvasX);
          }
          setCanvasConfig({
            guide: { ...canvasConfig.guide, customVertical: newCustom },
          });
        } else {
          const allVertical = getGuidePositions(canvasConfig.guide.preset, canvasWidth, canvasHeight, canvasConfig.guide.customVertical, canvasConfig.guide.customHorizontal).vertical;
          const newPositions = allVertical.map((v, idx) => (idx === drag.index ? Math.round(canvasX) : v));
          const presetPositions = getGuidePositions(canvasConfig.guide.preset, canvasWidth, canvasHeight, [], []).vertical;
          const customPositions = newPositions.filter((p) => !presetPositions.includes(p));
          const allHorizontal = getGuidePositions(canvasConfig.guide.preset, canvasWidth, canvasHeight, [], []).horizontal;
          setCanvasConfig({
            guide: {
              ...canvasConfig.guide,
              preset: "custom",
              customVertical: customPositions,
              customHorizontal: allHorizontal,
            },
          });
        }
      } else {
        const canvasY = (my - viewport.offset.y) / viewport.scale;
        if (canvasConfig.guide.preset === "custom") {
          const newCustom = [...canvasConfig.guide.customHorizontal];
          if (drag.index < newCustom.length) {
            newCustom[drag.index] = Math.round(canvasY);
          }
          setCanvasConfig({
            guide: { ...canvasConfig.guide, customHorizontal: newCustom },
          });
        } else {
          const allHorizontal = getGuidePositions(canvasConfig.guide.preset, canvasWidth, canvasHeight, canvasConfig.guide.customVertical, canvasConfig.guide.customHorizontal).horizontal;
          const newPositions = allHorizontal.map((h, idx) => (idx === drag.index ? Math.round(canvasY) : h));
          const presetPositions = getGuidePositions(canvasConfig.guide.preset, canvasWidth, canvasHeight, [], []).horizontal;
          const customPositions = newPositions.filter((p) => !presetPositions.includes(p));
          const allVertical = getGuidePositions(canvasConfig.guide.preset, canvasWidth, canvasHeight, [], []).vertical;
          setCanvasConfig({
            guide: {
              ...canvasConfig.guide,
              preset: "custom",
              customHorizontal: customPositions,
              customVertical: allVertical,
            },
          });
        }
      }
    },
    [viewport, canvasWidth, canvasHeight],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Document-level event listeners for hit-test dragging (avoids blocking component interaction)
  useEffect(() => {
    if (!guide.draggable || !guide.visible) return;

    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mouseup", handleMouseUp, true);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("mouseup", handleMouseUp, true);
    };
  }, [guide.draggable, guide.visible, handleMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <>
      {guide.visible && (
        <style>{`.moveable-controlbox .guideline { display: none !important; }`}</style>
      )}
      <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, width: Math.max(containerWidth, 0), height: Math.max(containerHeight, 0), pointerEvents: "none", zIndex: 2 }}>
        <canvas
          ref={canvasRef}
          width={0}
          height={0}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            display: guide.visible ? "block" : "none",
          }}
        />
      </div>
    </>
  );
}
