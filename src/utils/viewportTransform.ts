export interface ViewportTransform {
  scale: number;
  offset: { x: number; y: number };
}

export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  vp: ViewportTransform,
): { screenX: number; screenY: number } {
  return {
    screenX: canvasX * vp.scale + vp.offset.x,
    screenY: canvasY * vp.scale + vp.offset.y,
  };
}

export function screenToCanvas(
  screenX: number,
  screenY: number,
  vp: ViewportTransform,
): { canvasX: number; canvasY: number } {
  return {
    canvasX: (screenX - vp.offset.x) / vp.scale,
    canvasY: (screenY - vp.offset.y) / vp.scale,
  };
}

export function getVisibleCanvasRect(
  vp: ViewportTransform,
  containerWidth: number,
  containerHeight: number,
): { left: number; top: number; right: number; bottom: number } {
  return {
    left: -vp.offset.x / vp.scale,
    top: -vp.offset.y / vp.scale,
    right: (-vp.offset.x + containerWidth) / vp.scale,
    bottom: (-vp.offset.y + containerHeight) / vp.scale,
  };
}

const MIN_SCREEN_PX = 3;
const MAX_SCREEN_PX = 200;

export interface GridConfig {
  minorStep: number;
  majorStep: number;
  showMajor: boolean;
}

export function getEffectiveGridSize(
  gridSize: number,
  scale: number,
): GridConfig {
  const screenPx = gridSize * scale;

  let multiplier = 1;
  if (screenPx < MIN_SCREEN_PX) {
    while (gridSize * multiplier * scale < MIN_SCREEN_PX) {
      multiplier *= 2;
      if (multiplier > 1000) break;
    }
  } else if (screenPx > MAX_SCREEN_PX) {
    while (gridSize * multiplier * scale > MAX_SCREEN_PX && multiplier >= 1) {
      multiplier = Math.floor(multiplier / 2);
      if (multiplier < 1) { multiplier = 1; break; }
    }
    if (gridSize * multiplier * scale > MAX_SCREEN_PX) {
      const frac = MAX_SCREEN_PX / (gridSize * scale);
      multiplier = Math.max(1, Math.round(frac * 2) / 2);
    }
  }

  const minorStep = gridSize * multiplier;
  const majorStep = minorStep * 5;
  const showMajor = majorStep * scale >= 16;

  return { minorStep, majorStep, showMajor };
}

export function getCSSTransform(vp: ViewportTransform): string {
  return `translate3d(${vp.offset.x}px, ${vp.offset.y}px, 0) scale3d(${vp.scale}, ${vp.scale}, 1)`;
}

export type AdaptationType = "scale" | "full-x" | "full-y" | "full-screen" | "none";

export interface AdaptedViewport {
  scale: number;
  offset: { x: number; y: number };
}

export function calculateAdaptedViewport(
  containerW: number,
  containerH: number,
  canvasW: number,
  canvasH: number,
  adaptationType: AdaptationType,
): AdaptedViewport {
  const isFullPreview = adaptationType === "full-screen";
  const padding = isFullPreview ? 0 : 80;
  const availW = containerW - padding;
  const availH = containerH - padding;

  let scale: number;
  switch (adaptationType) {
    case "full-x":
      scale = availW / canvasW;
      break;
    case "full-y":
      scale = availH / canvasH;
      break;
    case "full-screen":
      scale = Math.max(availW / canvasW, availH / canvasH);
      break;
    case "none":
      scale = 1;
      break;
    case "scale":
    default:
      scale = Math.min(availW / canvasW, availH / canvasH, 1);
      break;
  }

  const offsetX = (containerW - canvasW * scale) / 2;
  const offsetY = (containerH - canvasH * scale) / 2;
  return { scale, offset: { x: offsetX, y: offsetY } };
}
