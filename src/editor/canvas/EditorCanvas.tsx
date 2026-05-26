import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import AddIcon from "@mui/icons-material/Add";
import { useRef, useCallback, useEffect, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { useViewport, useCanvasResize } from "../hooks/useViewport";
import { useSceneEventBridge } from "../hooks/useSceneEventBridge";
import { EditorCanvasComponent } from "./EditorCanvasComponent";
import EditorRuler from "./EditorRuler";
import { flattenLayerTree } from "../../types/editor";
import { componentRegistry } from "../registry";
import { convertFileSrc } from "@tauri-apps/api/core";
import logger from "../../utils/logger";

function toAssetUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) return path;
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

interface EditorCanvasProps {
  previewMode?: boolean;
}

export function EditorCanvas({ previewMode: previewModeProp }: EditorCanvasProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const components = useEditorStore((s) => s.components);
  const layers = useEditorStore((s) => s.layers);
  const viewport = useEditorStore((s) => s.viewport);
  const selectedIds = useEditorStore((s) => s.selection.selectedIds);
  const hoveredId = useEditorStore((s) => s.selection.hoveredId);

  const activeTool = useEditorStore((s) => s.activeTool);
  const canvasConfig = useEditorStore((s) => s.canvasConfig);
  const isPreviewStore = useEditorStore((s) => s.previewMode);
  const isPreview = previewModeProp ?? isPreviewStore;
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const setHoveredComponent = useEditorStore((s) => s.setHoveredComponent);
  const setViewport = useEditorStore((s) => s.setViewport);

  useSceneEventBridge(containerRef);

  const [isDragOver, setIsDragOver] = useState(false);

  const {
    zoomIn,
    zoomOut,
    resetViewport,
    handleWheel,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  } = useViewport();

  const containerSize = useCanvasResize(containerRef);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (isPreview) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel, isPreview]);

  const viewportInitializedRef = useRef(false);
  const prevCanvasSizeRef = useRef({ width: canvasConfig.width, height: canvasConfig.height });
  const prevContainerSizeRef = useRef({ width: 0, height: 0 });
  const isPreviewPrevRef = useRef(false);

  const calculateAdaptedViewport = useCallback((
    containerW: number,
    containerH: number,
    canvasW: number,
    canvasH: number,
    adaptationType: string,
  ) => {
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
  }, []);

  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0 && !viewportInitializedRef.current) {
      const adaptationType = isPreview ? "full-screen" : canvasConfig.adaptationType;
      const vp = calculateAdaptedViewport(
        containerSize.width, containerSize.height,
        canvasConfig.width, canvasConfig.height,
        adaptationType,
      );
      setViewport(vp);
      viewportInitializedRef.current = true;
      isPreviewPrevRef.current = isPreview;
      prevCanvasSizeRef.current = { width: canvasConfig.width, height: canvasConfig.height };
    }
  }, [containerSize.width, containerSize.height, canvasConfig.width, canvasConfig.height, canvasConfig.adaptationType, isPreview, setViewport, calculateAdaptedViewport]);

  useEffect(() => {
    if (!viewportInitializedRef.current) return;
    const prev = prevCanvasSizeRef.current;
    if (prev.width !== canvasConfig.width || prev.height !== canvasConfig.height) {
      prevCanvasSizeRef.current = { width: canvasConfig.width, height: canvasConfig.height };
      if (containerSize.width > 0 && containerSize.height > 0) {
        const vp = calculateAdaptedViewport(
          containerSize.width, containerSize.height,
          canvasConfig.width, canvasConfig.height,
          canvasConfig.adaptationType,
        );
        setViewport(vp);
      }
    }
  }, [canvasConfig.width, canvasConfig.height, canvasConfig.adaptationType, containerSize.width, containerSize.height, setViewport, calculateAdaptedViewport]);

  useEffect(() => {
    if (!viewportInitializedRef.current) return;
    const prev = prevContainerSizeRef.current;
    if (containerSize.width > 0 && containerSize.height > 0 &&
        (prev.width !== containerSize.width || prev.height !== containerSize.height)) {
      prevContainerSizeRef.current = { width: containerSize.width, height: containerSize.height };
      const adaptationType = isPreview ? "full-screen" : canvasConfig.adaptationType;
      const vp = calculateAdaptedViewport(
        containerSize.width, containerSize.height,
        canvasConfig.width, canvasConfig.height,
        adaptationType,
      );
      setViewport(vp);
    }
  }, [containerSize.width, containerSize.height, canvasConfig.width, canvasConfig.height, canvasConfig.adaptationType, isPreview, setViewport, calculateAdaptedViewport]);

  useEffect(() => {
    if (isPreviewPrevRef.current === isPreview) return;
    isPreviewPrevRef.current = isPreview;
    if (!viewportInitializedRef.current) return;
    if (containerSize.width > 0 && containerSize.height > 0) {
      const adaptationType = isPreview ? "full-screen" : canvasConfig.adaptationType;
      const vp = calculateAdaptedViewport(
        containerSize.width, containerSize.height,
        canvasConfig.width, canvasConfig.height,
        adaptationType,
      );
      setViewport(vp);
    }
  }, [isPreview, containerSize.width, containerSize.height, canvasConfig.width, canvasConfig.height, canvasConfig.adaptationType, setViewport, calculateAdaptedViewport]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const isComp = !!target.closest("[data-comp-id]");
      const isMoveable = !!target.closest(".moveable-control-box");
      logger.info("EditorCanvas", "handleCanvasClick", {
        tagName: target.tagName,
        className: target.className?.toString?.()?.slice(0, 80),
        isComp,
        isMoveable,
        willDeselect: !isComp && !isMoveable,
      });
      if (isComp || isMoveable) {
        return;
      }
      deselectAll();
    },
    [deselectAll]
  );

  const [dragPreview, setDragPreview] = useState<{
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    const vp = useEditorStore.getState().viewport;
    const canvasX = (clientX - containerRect.left - vp.offset.x) / vp.scale;
    const canvasY = (clientY - containerRect.top - vp.offset.y) / vp.scale;
    return { x: canvasX, y: canvasY };
  }, []);

  const ensureDefaultLayer = useCallback(() => {
    const state = useEditorStore.getState();
    const firstLayer = state.layers.find(l => l.type === "layer");
    if (firstLayer) return firstLayer.id;
    const addLayer = useEditorStore.getState().addLayer;
    const newLayer = addLayer("默认图层");
    return newLayer.id;
  }, []);

  const findLayerAtPosition = useCallback((canvasX: number, canvasY: number) => {
    const state = useEditorStore.getState();
    const tolerance = 50;
    if (
      canvasX < -tolerance ||
      canvasY < -tolerance ||
      canvasX > state.canvasConfig.width + tolerance ||
      canvasY > state.canvasConfig.height + tolerance
    ) {
      return null;
    }
    if (state.activeLayerId) {
      const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
      if (activeLayer?.type === "layer") {
        return state.activeLayerId;
      }
      if (activeLayer?.type === "group") {
        const childLayer = state.layers.find(
          l => l.type === "layer" && l.parentId === activeLayer.id
        );
        if (childLayer) return childLayer.id;
      }
    }
    const firstLayer = state.layers.find(l => l.type === "layer");
    if (firstLayer) return firstLayer.id;
    return null;
  }, []);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      const store = useEditorStore.getState();
      if (store.draggedComponentType) {
        store.setDraggedComponentType(null);
      }
      setIsDragOver(false);
      setDragPreview(null);
    };
    document.addEventListener("dragend", handleGlobalDragEnd);
    return () => document.removeEventListener("dragend", handleGlobalDragEnd);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const compType = useEditorStore.getState().draggedComponentType;
    if (!compType) return;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    const compType = useEditorStore.getState().draggedComponentType;
    if (!compType) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    if (pos) {
      const def = componentRegistry.get(compType);
      if (def) {
        setDragPreview({
          type: compType,
          x: pos.x - def.defaultSize.width / 2,
          y: pos.y - def.defaultSize.height / 2,
          width: def.defaultSize.width,
          height: def.defaultSize.height,
        });
      }
    }
  }, [screenToCanvas]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && containerRef.current && containerRef.current.contains(relatedTarget)) {
      return;
    }
    setIsDragOver(false);
    setDragPreview(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragPreview(null);

    const storeState = useEditorStore.getState();
    const compType =
      storeState.draggedComponentType ||
      e.dataTransfer?.getData("application/x-component-type") ||
      "";
    storeState.setDraggedComponentType(null);
    if (!compType) return;

    const definition = componentRegistry.get(compType);
    if (!definition) return;

    const pos = screenToCanvas(e.clientX, e.clientY);
    if (!pos) return;

    let dw = definition.defaultSize.width;
    let dh = definition.defaultSize.height;
    let extraConfig: Record<string, unknown> | undefined;

    if (compType === "text") {
      const cc = storeState.canvasConfig;
      const shortSide = Math.min(cc.width, cc.height);
      const adaptiveFontSize = Math.max(10, Math.round(shortSide / 60));
      dw = Math.round(cc.width * 0.15);
      dh = Math.round(cc.height * 0.08);
      extraConfig = { fontSize: adaptiveFontSize };
    }

    const canvasX = Math.max(0, pos.x - dw / 2);
    const canvasY = Math.max(0, pos.y - dh / 2);

    let targetLayerId = findLayerAtPosition(pos.x, pos.y);
    if (!targetLayerId) {
      targetLayerId = ensureDefaultLayer();
    }
    if (!targetLayerId) return;

    const newComponent = storeState.addComponent(compType, targetLayerId, {
      x: canvasX,
      y: canvasY,
    });

    if (newComponent) {
      storeState.setActiveLayer(targetLayerId);

      if (compType === "text") {
        storeState.updateComponentConfig(newComponent.id, extraConfig!);
        storeState.updateComponentTransform(newComponent.id, {
          width: dw,
          height: dh,
        });
      }
    }
  }, [screenToCanvas, findLayerAtPosition, ensureDefaultLayer]);

  const sortedLayers = flattenLayerTree(layers).filter((l) => l.type === "layer");

  const canvasCursor =
    activeTool === "pan"
      ? "grab"
      : activeTool === "zoom-in"
        ? "zoom-in"
        : activeTool === "zoom-out"
          ? "zoom-out"
          : "default";

  const scalePercent = Math.round(viewport.scale * 100);

  const getCanvasBackgroundStyle = useCallback(() => {
    const bg = canvasConfig.background;
    if (bg.type === "solid") return { backgroundColor: bg.color };
    if (bg.type === "gradient") {
      const dir = bg.gradient.direction;
      if (dir === "radial") return { background: `radial-gradient(circle, ${bg.gradient.colors[0]}, ${bg.gradient.colors[1]})` };
      const cssDir = dir.replace(/-/g, " ");
      return { background: `linear-gradient(${cssDir}, ${bg.gradient.colors[0]}, ${bg.gradient.colors[1]})` };
    }
    if (bg.type === "image" && bg.imageUrl) return { backgroundImage: `url(${toAssetUrl(bg.imageUrl)})`, backgroundSize: bg.imageFit || "cover", backgroundPosition: "center" };
    return { backgroundColor: (theme: any) => theme.palette.mode === "dark" ? "#0f0f1a" : "#ffffff" };
  }, [canvasConfig.background]);

  const hasAnyBackgroundContent = useCallback(() => {
    const bg = canvasConfig.background;
    if (bg.type === "image" && bg.imageUrl) return true;
    if (bg.type === "video" && bg.videoUrl) return true;
    if (bg.type === "gradient") return true;
    return false;
  }, [canvasConfig.background]);

  const getGridStyle = useCallback(() => {
    if (!canvasConfig.grid.visible) return {};
    const size = canvasConfig.grid.size;
    return {
      backgroundImage: [
        `linear-gradient(to right, rgba(128,128,128,0.15) 1px, transparent 1px)`,
        `linear-gradient(to bottom, rgba(128,128,128,0.15) 1px, transparent 1px)`,
      ].join(", "),
      backgroundSize: `${size}px ${size}px`,
    };
  }, [canvasConfig.grid.visible, canvasConfig.grid.size]);

  const canvasContent = (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: isPreview
          ? "transparent"
          : (theme) =>
              theme.palette.mode === "dark"
                ? isDragOver ? "#2e2e42" : "#2a2a3a"
                : isDragOver ? "#d0d0da" : "#d8d8e0",
        cursor: isPreview ? "default" : canvasCursor,
        transition: "background-color 0.2s",
        outline: !isPreview && isDragOver
          ? (theme) => `2px dashed ${theme.palette.primary.main}`
          : "none",
        outlineOffset: -2,
      }}
      onPointerDown={isPreview ? undefined : handleCanvasPointerDown}
      onPointerMove={isPreview ? undefined : handleCanvasPointerMove}
      onPointerUp={isPreview ? undefined : handleCanvasPointerUp}
      onClick={isPreview ? undefined : handleCanvasClick}
      onDragEnter={isPreview ? undefined : handleDragEnter}
      onDragOver={isPreview ? undefined : handleDragOver}
      onDragLeave={isPreview ? undefined : handleDragLeave}
      onDrop={isPreview ? undefined : handleDrop}
    >
      {!isPreview && (
      <Box
        sx={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <Typography
          variant="caption"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 0.75,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: 0.3,
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(30,30,42,0.85)"
                : "rgba(255,255,255,0.85)",
            color: "text.secondary",
            backdropFilter: "blur(8px)",
            border: 1,
            borderColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.06)",
          }}
        >
          {canvasConfig.width} × {canvasConfig.height}
        </Typography>
      </Box>
      )}

      {!isPreview && (
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: (theme) =>
            theme.palette.mode === "dark"
              ? `radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)`
              : `radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          pointerEvents: "none",
        }}
      />
      )}

      <Box
        ref={canvasRef}
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          transformOrigin: "0 0",
          transform: `translate(${viewport.offset.x}px, ${viewport.offset.y}px) scale(${viewport.scale})`,
          width: canvasConfig.width,
          height: canvasConfig.height,
          ...getCanvasBackgroundStyle(),
          borderRadius: isPreview ? 0 : 1,
          boxShadow: isPreview
            ? "none"
            : (theme) =>
                theme.palette.mode === "dark"
                  ? "0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.6)"
                  : "0 0 0 1px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.1)",
        }}
      >
        {canvasConfig.background.type === "video" && canvasConfig.background.videoUrl && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              overflow: "hidden",
              zIndex: 0,
              pointerEvents: "none",
            }}
          >
            <video
              src={toAssetUrl(canvasConfig.background.videoUrl)}
              autoPlay={canvasConfig.background.videoAutoplay}
              muted={canvasConfig.background.videoMuted}
              loop={canvasConfig.background.videoLoop}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </Box>
        )}
        {canvasConfig.grid.visible && !hasAnyBackgroundContent() && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              ...getGridStyle(),
              zIndex: 1,
            }}
          />
        )}
        {sortedLayers
          .filter((layer) => layer.visible)
          .map((layer) => (
            <Box
              key={layer.id}
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: isDragOver ? "none" : layer.locked ? "none" : "auto",
                opacity: layer.opacity,
                mixBlendMode: (layer.blendMode || "normal") as any,
              }}
              data-layer-id={layer.id}
            >
              {components
                .filter((comp) => comp.layerId === layer.id && comp.visible)
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((comp) => (
                  <EditorCanvasComponent
                    key={comp.id}
                    component={comp}
                    isSelected={!isPreview && selectedIds.includes(comp.id)}
                    isHovered={!isPreview && hoveredId === comp.id}
                    layerLocked={layer.locked}
                    isCanvasDragOver={isDragOver}
                    previewMode={isPreview}
                    onSelect={selectComponent}
                    onHover={setHoveredComponent}
                  />
                ))}
            </Box>
          ))}
      </Box>

      {!isPreview && isDragOver && dragPreview && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            transformOrigin: "0 0",
            transform: `translate(${viewport.offset.x}px, ${viewport.offset.y}px) scale(${viewport.scale})`,
            pointerEvents: "none",
            zIndex: 9998,
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: dragPreview.x,
              top: dragPreview.y,
              width: dragPreview.width,
              height: dragPreview.height,
              border: "2px dashed",
              borderColor: "primary.main",
              borderRadius: 1,
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(25,118,210,0.12)"
                  : "rgba(25,118,210,0.08)",
              opacity: 0.8,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                top: -18,
                left: 0,
                fontSize: 10,
                color: "primary.main",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {componentRegistry.get(dragPreview.type)?.name || dragPreview.type}
            </Typography>
          </Box>
        </Box>
      )}

      {!isPreview && (
      <Box
        sx={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(30,30,42,0.92)"
              : "rgba(255,255,255,0.92)",
          borderRadius: 2,
          px: 1,
          py: 0.25,
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "0 2px 12px rgba(0,0,0,0.5)"
              : "0 2px 12px rgba(0,0,0,0.08)",
          backdropFilter: "blur(12px)",
          border: 1,
          borderColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.06)",
          zIndex: 20,
        }}
      >
        <Tooltip title="缩小">
          <IconButton size="small" onClick={zoomOut}>
            <ZoomOutIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Typography
          variant="caption"
          sx={{
            minWidth: 44,
            textAlign: "center",
            fontWeight: 500,
            cursor: "pointer",
            userSelect: "none",
            fontSize: 11,
            color: "text.secondary",
          }}
          onClick={() => resetViewport(containerSize.width, containerSize.height)}
        >
          {scalePercent}%
        </Typography>
        <Tooltip title="放大">
          <IconButton size="small" onClick={zoomIn}>
            <ZoomInIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="适应画布">
          <IconButton size="small" onClick={() => resetViewport(containerSize.width, containerSize.height)}>
            <FitScreenIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      )}

      {!isPreview && components.length === 0 && !hasAnyBackgroundContent() && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            transformOrigin: "0 0",
            transform: `translate(${viewport.offset.x}px, ${viewport.offset.y}px) scale(${viewport.scale})`,
            width: canvasConfig.width,
            height: canvasConfig.height,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "text.secondary",
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.03)",
                border: 1,
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.06)",
              }}
            >
              <AddIcon sx={{ fontSize: 32, opacity: 0.3 }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, opacity: 0.6 }}>
              从左侧组件中心拖拽组件到画布
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.35, display: "block" }}>
              或点击组件直接添加到当前图层
            </Typography>
          </Box>
        </Box>
      )}
      </Box>
    );

  return isPreview ? (
    canvasContent
  ) : (
    <EditorRuler canvasWidth={canvasConfig.width} canvasHeight={canvasConfig.height} rulerVisible={canvasConfig.ruler.visible}>
      {canvasContent}
    </EditorRuler>
  );
}
