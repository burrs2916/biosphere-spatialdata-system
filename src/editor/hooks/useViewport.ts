import { useCallback, useRef, useEffect, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import type { Point } from "../../types/editor";

export function useViewport() {
  const viewport = useEditorStore((s) => s.viewport);
  const canvasConfig = useEditorStore((s) => s.canvasConfig);
  const setViewport = useEditorStore((s) => s.setViewport);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const resetViewport = useEditorStore((s) => s.resetViewport);
  const panTo = useEditorStore((s) => s.panTo);

  const isPanning = useRef(false);
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        const newScale = Math.min(
          Math.max(viewport.scale + delta, canvasConfig.viewport.minScale),
          canvasConfig.viewport.maxScale
        );

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleRatio = newScale / viewport.scale;
        const newOffsetX = mouseX - (mouseX - viewport.offset.x) * scaleRatio;
        const newOffsetY = mouseY - (mouseY - viewport.offset.y) * scaleRatio;

        setViewport({
          scale: Math.round(newScale * 100) / 100,
          offset: { x: newOffsetX, y: newOffsetY },
        });
      } else {
        setViewport({
          offset: {
            x: viewport.offset.x - e.deltaX,
            y: viewport.offset.y - e.deltaY,
          },
        });
      }
    },
    [viewport, setViewport]
  );

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning.current = true;
        lastPanPoint.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    },
    []
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return;

      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };

      setViewport({
        offset: {
          x: viewport.offset.x + dx,
          y: viewport.offset.y + dy,
        },
      });
    },
    [viewport.offset, setViewport]
  );

  const handleCanvasPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return {
    viewport,
    zoomIn,
    zoomOut,
    resetViewport,
    panTo,
    handleWheel,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  };
}

export function useCanvasResize(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return containerSize;
}
