import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DoneIcon from "@mui/icons-material/Done";
import PanToolAltIcon from "@mui/icons-material/PanToolAlt";
import { fitTextToBox, measureTextSize } from "../../utils/fitText";
import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import Moveable from "react-moveable";
import type { SceneComponent, ComponentRendererProps } from "../../types/editor";
import { useEditorStore } from "../../store/editorStore";
import logger from "../../utils/logger";
import { componentRegistry } from "../registry";
import { rendererCache } from "../plugins";
import { FallbackRenderer } from "../renderers";
import { EditorContextMenu } from "../components/EditorContextMenu";
import { useComponentDataBinding } from "../hooks/useComponentDataBinding";
import { useSpatialRendererContext } from "../hooks/useSpatialRendererContext";
import { useDataSourceStore } from "../../store/datasourceStore";
import { dataSourceEventBus } from "../../datasource/events";

interface EditorCanvasComponentProps {
  component: SceneComponent;
  isSelected: boolean;
  isHovered: boolean;
  layerLocked: boolean;
  isCanvasDragOver: boolean;
  previewMode: boolean;
  onSelect: (id: string, multi?: boolean) => void;
  onHover: (id: string | null) => void;
}

export function EditorCanvasComponent({
  component,
  isSelected,
  isHovered,
  layerLocked,
  isCanvasDragOver,
  previewMode,
  onSelect,
  onHover,
}: EditorCanvasComponentProps) {
  const updateComponentTransform = useEditorStore((s) => s.updateComponentTransform);
  const updateComponentConfig = useEditorStore((s) => s.updateComponentConfig);
  const allComponents = useEditorStore((s) => s.components);

  useComponentDataBinding(component.id);

  const dataSourceId = component.config.dataSourceId as string | undefined;

  useEffect(() => {
    if (!dataSourceId) return;

    const handler = (payload: { sourceId: string; data: unknown; extracted?: Record<string, unknown> }) => {
      if (payload.sourceId !== dataSourceId) return;

      const store = useEditorStore.getState();
      const comp = store.components.find((c) => c.id === component.id);
      if (!comp) return;

      let boundData: Record<string, unknown> = {};

      if (payload.extracted && typeof payload.extracted === "object") {
        for (const [, v] of Object.entries(payload.extracted)) {
          if (v && typeof v === "object") {
            Object.assign(boundData, v as Record<string, unknown>);
          } else {
            boundData.value = v;
          }
        }
      } else if (payload.data && typeof payload.data === "object") {
        const data = payload.data as Record<string, unknown>;
        if (data.values && typeof data.values === "object") {
          boundData = { ...(data.values as Record<string, unknown>) };
        } else {
          for (const [k, v] of Object.entries(data)) {
            if (k !== "sourceId" && k !== "timestamp" && typeof v !== "function") {
              boundData[k] = Array.isArray(v) ? v[0] : v;
            }
          }
        }
      }

      if (Object.keys(boundData).length > 0) {
        store.updateComponentConfig(component.id, { data: boundData });
      }
    };

    const unsub = dataSourceEventBus.on("data:updated", handler);

    const cache = useDataSourceStore.getState().dataCache[dataSourceId];
    if (cache && typeof cache === "object") {
      const boundData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(cache)) {
        boundData[k] = Array.isArray(v) ? v[0] : v;
      }
      if (Object.keys(boundData).length > 0) {
        useEditorStore.getState().updateComponentConfig(component.id, { data: boundData });
      }
    }

    return unsub;
  }, [dataSourceId, component.id]);

  const spatialContext = useSpatialRendererContext(component.config.crs as import("../../types/spatial").CRSType | undefined);

  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      if (key === "_autoFitSize" && value && typeof value === "object") {
        const size = value as { width: number; height: number };
        updateComponentTransform(component.id, { width: size.width, height: size.height });
        return;
      }
      updateComponentConfig(component.id, { [key]: value });

      if (component.type === "text") {
        const cfg = component.config;
        const text = (cfg.content as string) || "文本内容";
        const fontFamily = (cfg.fontFamily as string) || "inherit";
        const lineHeight = (cfg.lineHeight as number) || 1.5;
        const letterSpacing = (cfg.letterSpacing as number) || 0;
        const padding = (cfg.padding as number) ?? 8;
        const borderEnabled = (cfg.borderEnabled as boolean) || false;
        const borderWidth = borderEnabled ? ((cfg.borderWidth as number) || 1) : 0;

        if (key === "fontSize" && typeof value === "number") {
          if (cfg.autoFit) {
            updateComponentConfig(component.id, { autoFit: false });
          }
          const availW = component.transform.width - padding * 2 - borderWidth * 2;
          const textSize = measureTextSize({ text, fontFamily, fontSize: value, lineHeight, letterSpacing, containerWidth: availW > 0 ? availW : undefined });
          const newW = textSize.width + padding * 2 + borderWidth * 2;
          const newH = textSize.height + padding * 2 + borderWidth * 2;
          if (newW >= 20 && newH >= 20) {
            updateComponentTransform(component.id, { width: Math.ceil(newW), height: Math.ceil(newH) });
          }
        }

        const layoutKeys = new Set(["padding", "borderEnabled", "borderWidth", "lineHeight", "letterSpacing", "fontFamily", "content"]);
        if (layoutKeys.has(key)) {
          const newCfg = { ...cfg, [key]: value };
          const newText = (newCfg.content as string) || "文本内容";
          const newPadding = (newCfg.padding as number) ?? 8;
          const newBorderEnabled = (newCfg.borderEnabled as boolean) || false;
          const newBorderWidth = newBorderEnabled ? ((newCfg.borderWidth as number) || 1) : 0;
          const newLineHeight = (newCfg.lineHeight as number) || 1.5;
          const newLetterSpacing = (newCfg.letterSpacing as number) || 0;
          const newFontFamily = (newCfg.fontFamily as string) || "inherit";
          const availW = component.transform.width - newPadding * 2 - newBorderWidth * 2;
          const availH = component.transform.height - newPadding * 2 - newBorderWidth * 2;
          if (availW > 0 && availH > 0) {
            const newFontSize = fitTextToBox({
              text: newText,
              fontFamily: newFontFamily,
              availW,
              availH,
              lineHeight: newLineHeight,
              letterSpacing: newLetterSpacing,
            });
            const oldFontSize = (cfg.fontSize as number) || 16;
            if (newFontSize !== oldFontSize) {
              updateComponentConfig(component.id, { fontSize: newFontSize });
            }
          }
        }
      }
    },
    [component.id, component.type, component.config, component.transform.width, component.transform.height, updateComponentConfig, updateComponentTransform],
  );
  const targetRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRendererInteractionLocked, setIsRendererInteractionLocked] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [frame, setFrame] = useState({
    translate: [component.transform.x, component.transform.y],
    size: [component.transform.width, component.transform.height],
  });

  const { transform, locked, type, config, zIndex } = component;
  const { x, y, width, height, rotation } = transform;
  const definition = componentRegistry.get(type);
  const showBorder = isSelected || isHovered;
  const isCustomFitMode = type === "map-cad" && config.fitMode === "custom";
  const isCadViewAdjusting = isCustomFitMode && isRendererInteractionLocked;
  const isInteractable = !layerLocked && !locked && isSelected && !isCanvasDragOver && !isRendererInteractionLocked;

  const elementGuidelines = useMemo(() => {
    return allComponents
      .filter((c) => c.id !== component.id && c.visible)
      .map((c) => ({
        element: `[data-comp-id="${c.id}"]`,
      }));
  }, [allComponents, component.id]);

  useEffect(() => {
    setFrame({
      translate: [x, y],
      size: [width, height],
    });
    if (moveableRef.current) {
      moveableRef.current.updateRect();
    }
  }, [x, y, width, height, rotation]);

  useEffect(() => {
    if (!isSelected || !isCustomFitMode || previewMode) {
      setIsRendererInteractionLocked(false);
    }
  }, [isSelected, isCustomFitMode, previewMode]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(component.id, e.shiftKey);
    },
    [component.id, onSelect]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(component.id);
      setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
    },
    [component.id, onSelect]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isRendererInteractionLocked) {
        return;
      }
      logger.info("EditorCanvasComponent", "outerBox mousedown", { componentId: component.id, target: (e.target as HTMLElement).tagName, isCustomFitMode, isRendererInteractionLocked, pointerEvents: (e.target as HTMLElement).style.pointerEvents });
    },
    [component.id, isCustomFitMode, isRendererInteractionLocked]
  );

  const handleToggleCadViewAdjust = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(component.id, e.shiftKey);
    setIsRendererInteractionLocked((prev) => !prev);
  }, [component.id, onSelect]);

  const handleDragStart = useCallback(
    ({ set }: any) => {
      logger.info("EditorCanvasComponent", "Moveable dragStart", { componentId: component.id, isCustomFitMode });
      setIsDragging(true);
      set?.(frame.translate);
    },
    [frame.translate, component.id, isCustomFitMode]
  );

  const handleDrag = useCallback(
    ({ target, beforeTranslate }: any) => {
      const newX = beforeTranslate[0];
      const newY = beforeTranslate[1];
      target.style.transform = `translate(${newX}px, ${newY}px)`;
      setFrame((prev) => ({ ...prev, translate: [newX, newY] }));
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    logger.info("EditorCanvasComponent", "Moveable dragEnd", { componentId: component.id });
    setIsDragging(false);
    updateComponentTransform(component.id, { x: frame.translate[0], y: frame.translate[1] });
  }, [component.id, frame.translate, updateComponentTransform]);

  const handleResizeStart = useCallback(
    ({ setOrigin, dragStart }: any) => {
      logger.info("EditorCanvasComponent", "Moveable resizeStart", { componentId: component.id });
      setIsResizing(true);
      setOrigin?.(["%", "%"]);
      dragStart?.set(frame.translate);
    },
    [frame.translate, component.id]
  );

  const handleResize = useCallback(
    ({ target, width, height, drag }: any) => {
      const beforeTranslate = drag.beforeTranslate;
      const newX = beforeTranslate[0];
      const newY = beforeTranslate[1];
      const newW = Math.max(width, 20);
      const newH = Math.max(height, 20);
      target.style.width = `${newW}px`;
      target.style.height = `${newH}px`;
      target.style.transform = `translate(${newX}px, ${newY}px)`;
      setFrame({ translate: [newX, newY], size: [newW, newH] });

      if (component.type === "text") {
        const cfg = component.config;
        const text = (cfg.content as string) || "文本内容";
        const fontFamily = (cfg.fontFamily as string) || "inherit";
        const lineHeight = (cfg.lineHeight as number) || 1.5;
        const letterSpacing = (cfg.letterSpacing as number) || 0;
        const padding = (cfg.padding as number) ?? 8;
        const borderEnabled = (cfg.borderEnabled as boolean) || false;
        const borderWidth = borderEnabled ? ((cfg.borderWidth as number) || 1) : 0;
        const availW = newW - padding * 2 - borderWidth * 2;
        const availH = newH - padding * 2 - borderWidth * 2;
        if (availW > 0 && availH > 0) {
          const newFontSize = fitTextToBox({ text, fontFamily, availW, availH, lineHeight, letterSpacing });
          const oldFontSize = (cfg.fontSize as number) || 16;
          if (newFontSize !== oldFontSize) {
            updateComponentConfig(component.id, { fontSize: newFontSize });
          }
        }
      }
    },
    [component.id, component.type, component.config, updateComponentConfig]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    const newW = Math.max(frame.size[0], 20);
    const newH = Math.max(frame.size[1], 20);
    updateComponentTransform(component.id, {
      x: frame.translate[0],
      y: frame.translate[1],
      width: newW,
      height: newH,
    });
    if (component.type === "text") {
      const latestConfig = useEditorStore.getState().components.find(c => c.id === component.id)?.config;
      if (latestConfig?.autoFit) {
        updateComponentConfig(component.id, { autoFit: false });
      }
    }
  }, [component.id, component.type, frame.translate, frame.size, updateComponentTransform, updateComponentConfig]);

  const [Renderer, setRenderer] = useState<React.ComponentType<ComponentRendererProps> | null>(
    () => rendererCache.get(type) || definition?.renderer.cached || null
  );

  useEffect(() => {
    const cached = rendererCache.get(type);
    if (cached) {
      setRenderer(() => cached);
      return;
    }
    if (definition?.renderer.loader) {
      rendererCache.load(type).then((loaded) => {
        setRenderer(() => loaded || FallbackRenderer);
      });
    }
  }, [type, definition?.type]);

  return (
    <>
      <Box
        ref={targetRef}
        data-comp-id={component.id}
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          zIndex,
          transform: `translate(${x}px, ${y}px)`,
          cursor: previewMode ? "default" : isCadViewAdjusting ? "grabbing" : isCustomFitMode ? "grab" : isInteractable ? (isDragging ? "grabbing" : "grab") : "default",
          outline: previewMode
            ? "none"
            : showBorder
              ? isSelected
                ? "2px solid #1976d2"
                : "1px dashed rgba(25,118,210,0.5)"
              : "none",
          outlineOffset: "0px",
          userSelect: "none",
          pointerEvents: isCanvasDragOver ? "none" : "auto",
          transition: isDragging || isResizing ? "none" : "outline-color 0.15s",
          "&:hover": previewMode ? {} : {
            outline: layerLocked || locked ? undefined : "1px dashed rgba(25,118,210,0.5)",
          },
        }}
        onClick={previewMode ? undefined : handleClick}
        onContextMenu={previewMode ? undefined : handleContextMenu}
        onMouseDown={previewMode ? undefined : handleMouseDown}
        onMouseEnter={previewMode ? undefined : () => onHover(component.id)}
        onMouseLeave={previewMode ? undefined : () => onHover(null)}
      >
        <Box sx={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
          {Renderer ? (
            <Renderer
              config={config}
              componentId={component.id}
              mode={previewMode ? "preview" : "edit"}
              width={width}
              height={height}
              onConfigChange={handleConfigChange}
              contentInteractionActive={isCadViewAdjusting}
              onInteractionLockChange={setIsRendererInteractionLocked}
              spatialContext={spatialContext}
            />
          ) : <FallbackRenderer config={config} componentId={component.id} />}
          {previewMode && <Box sx={{ position: "absolute", inset: 0, zIndex: 1 }} />}
        </Box>

        {!previewMode && isSelected && isCustomFitMode && (
          <Tooltip title={isCadViewAdjusting ? "退出图纸调整" : "调整图纸视图"}>
            <IconButton
              size="small"
              onClick={handleToggleCadViewAdjust}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              sx={{
                position: "absolute",
                top: -30,
                right: 0,
                width: 24,
                height: 24,
                zIndex: 10000,
                color: "#fff",
                backgroundColor: isCadViewAdjusting ? "#1976d2" : "rgba(25,118,210,0.85)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                "&:hover": {
                  backgroundColor: isCadViewAdjusting ? "#1565c0" : "#1976d2",
                },
              }}
            >
              {isCadViewAdjusting ? <DoneIcon sx={{ fontSize: 15 }} /> : <PanToolAltIcon sx={{ fontSize: 15 }} />}
            </IconButton>
          </Tooltip>
        )}

        {!previewMode && isSelected && (
          <Box
            sx={{
              position: "absolute",
              top: -22,
              left: 0,
              fontSize: 11,
              color: "#fff",
              backgroundColor: "#1976d2",
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              whiteSpace: "nowrap",
              maxWidth: width,
              overflow: "hidden",
              textOverflow: "ellipsis",
              pointerEvents: "none",
            }}
          >
            {component.name}
          </Box>
        )}
      </Box>

      {!previewMode && isSelected && !isRendererInteractionLocked && targetRef.current && (
        <Moveable
          ref={moveableRef as any}
          target={targetRef.current}
          draggable={isInteractable}
          resizable={isInteractable}
          snappable={isInteractable}
          snapThreshold={5}
          verticalGuidelines={[960]}
          horizontalGuidelines={[540]}
          elementGuidelines={elementGuidelines}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
        />
      )}

      {!previewMode && (
      <EditorContextMenu
        position={contextMenu}
        componentId={component.id}
        onClose={() => setContextMenu(null)}
      />
      )}
    </>
  );
}
