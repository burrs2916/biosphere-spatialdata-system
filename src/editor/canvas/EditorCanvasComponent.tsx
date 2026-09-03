import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DoneIcon from "@mui/icons-material/Done";
import PanToolAltIcon from "@mui/icons-material/PanToolAlt";
import { fitTextToBox, measureTextSize } from "../../utils/fitText";
import { useCallback, useRef, useState, useEffect, memo, useMemo } from "react";
import Moveable from "react-moveable";
import type { SceneComponent, ComponentRendererProps, EventBinding } from "../../types/editor";
import { resolveInteractivity } from "../utils/resolveInteractivity";
import { useEditorStore } from "../../store/editorStore";
import logger from "../../utils/logger";
import { componentRegistry } from "../registry";
import { rendererCache } from "../plugins/PluginLoader";
import { FallbackRenderer } from "../renderers/FallbackRenderer";
import { DeviceComponentRenderer } from "../renderers/deviceVariants/DeviceComponentRenderer";
import { ComponentFrame } from "../renderers/ComponentFrame";

// 组件级边框覆盖层排除清单：
// - region-frame（36/37/38/40 等结构性外框，自身即边框）
// - top-glow-title-frame（标题栏自带原生边框）
// - cad-enhancer（CAD 地图装饰角标，避免双重装饰）
// - datav-border / datav-decoration / decoration-*（纯装饰组件，自行绘制）
// - *_12_frame（旧独立底部数据边框，迁移中删除；残留时也排除）
const FRAME_EXCLUDED_TYPES = new Set<string>([
  "region-frame",
  "top-glow-title-frame",
  "cad-enhancer",
]);
function isFrameExcluded(t: string): boolean {
  if (FRAME_EXCLUDED_TYPES.has(t)) return true;
  if (
    t.startsWith("datav-border") ||
    t.startsWith("datav-decoration") ||
    t.startsWith("decoration-") ||
    t.endsWith("_12_frame")
  ) {
    return true;
  }
  return false;
}
import { EditorContextMenu } from "../components/EditorContextMenu";
import { useComponentDataBinding } from "../hooks/useComponentDataBinding";
import { useSpatialRendererContext } from "../hooks/useSpatialRendererContext";
import { useDataSourceStore } from "../../store/datasourceStore";
import { dataSourceEventBus } from "../../datasource/events";
import { getGuidePositions } from "./CanvasGuideLines";
import { useEventDispatcher } from "../context/SceneEditorContext";

interface EditorCanvasComponentProps {
  component: SceneComponent;
  isSelected: boolean;
  isHovered: boolean;
  layerLocked: boolean;
  isCanvasDragOver: boolean;
  previewMode: boolean;
  eventBindings?: EventBinding[];
  onSelect: (id: string, multi?: boolean) => void;
  onHover: (id: string | null) => void;
}

export const EditorCanvasComponent = memo(function EditorCanvasComponent({
  component,
  isSelected,
  isHovered,
  layerLocked,
  isCanvasDragOver,
  previewMode,
  eventBindings,
  onSelect,
  onHover,
}: EditorCanvasComponentProps) {
  const updateComponentTransform = useEditorStore((s) => s.updateComponentTransform);
  const updateComponentConfig = useEditorStore((s) => s.updateComponentConfig);
  const allComponents = useEditorStore((s) => s.components);
  const canvasConfig = useEditorStore((s) => s.canvasConfig);

  useComponentDataBinding(component.id);

  // 组件定义（提前读取，下方多处使用）
  const definition = componentRegistry.get(component.type);

  // 预览模式下检测组件是否应启用交互
  //   isInteractive：基于 eventBindings 决定（默认装饰型组件无绑定时为 false）
  //   requiresInteraction：组件 definition 显式声明自己是"操作型"（强喷/强停/视频播放/定时控制等），
  //     即使没有 eventBindings 也要在预览/发布模式下保持交互能力。
  const { isInteractive } = useMemo(
    () => resolveInteractivity(component.id, eventBindings ?? []),
    [component.id, eventBindings],
  );
  const effectiveInteractive = isInteractive || !!definition?.requiresInteraction;

  const dataSourceId = component?.config?.dataSourceId as string | undefined;

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
              boundData[k] = v;
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
        boundData[k] = v;
      }
      if (Object.keys(boundData).length > 0) {
        useEditorStore.getState().updateComponentConfig(component.id, { data: boundData });
      }
    }

    return unsub;
  }, [dataSourceId, component.id]);

  const spatialContext = useSpatialRendererContext(component.config.crs as import("../../types/spatial").CRSType | undefined);

  const batchUpdateComponent = useEditorStore((s) => s.batchUpdateComponent);

  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      if (key === "_autoFitSize" && value && typeof value === "object") {
        const size = value as { width?: number; height?: number };
        const updates: Record<string, number> = {};
        if (size.width != null && size.width > 0) updates.width = size.width;
        if (size.height != null && size.height > 0) updates.height = size.height;
        if (Object.keys(updates).length > 0) {
          updateComponentTransform(component.id, updates);
        }
        return;
      }

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
          const configUpdate: Record<string, unknown> = { [key]: value };
          if (cfg.autoFit) configUpdate.autoFit = false;
          const availW = component.transform.width - padding * 2 - borderWidth * 2;
          const textSize = measureTextSize({ text, fontFamily, fontSize: value, lineHeight, letterSpacing, containerWidth: availW > 0 ? availW : undefined });
          const newW = textSize.width + padding * 2 + borderWidth * 2;
          const newH = textSize.height + padding * 2 + borderWidth * 2;
          if (newW >= 20 && newH >= 20) {
            batchUpdateComponent(component.id, { config: configUpdate, transform: { width: Math.ceil(newW), height: Math.ceil(newH) } });
          } else {
            updateComponentConfig(component.id, configUpdate);
          }
          return;
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
            const configUpdate: Record<string, unknown> = { [key]: value };
            if (newFontSize !== oldFontSize) configUpdate.fontSize = newFontSize;
            updateComponentConfig(component.id, configUpdate);
          } else {
            updateComponentConfig(component.id, { [key]: value });
          }
          return;
        }
      }

      updateComponentConfig(component.id, { [key]: value });
    },
    [component.id, component.type, component.config, component.transform, updateComponentConfig, updateComponentTransform, batchUpdateComponent],
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

  // 调试日志：仅在组件定义找不到时输出
  if (!definition && type.startsWith("device:")) {
    console.warn("[EditorCanvasComponent] Device component definition not found:", type);
    console.log("[EditorCanvasComponent] All registered device types:", componentRegistry.getByCategory("device").map(d => d.type));
    console.log("[EditorCanvasComponent] All registered types:", componentRegistry.getAll().map(d => d.type));
  }
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

  const eventDispatcher = useEventDispatcher();

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (eventDispatcher) {
        eventDispatcher.emitComponentEvent(component.id, "onClick", {
          componentId: component.id,
          type: "click",
          screenX: e.clientX,
          screenY: e.clientY,
        });
      }
    },
    [component.id, eventDispatcher]
  );

  const handlePreviewDblClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (eventDispatcher) {
        eventDispatcher.emitComponentEvent(component.id, "onDblClick", {
          componentId: component.id,
          type: "dblclick",
          screenX: e.clientX,
          screenY: e.clientY,
        });
      }
    },
    [component.id, eventDispatcher]
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
    [width, height],
  );

  const handleDragEnd = useCallback(() => {
    logger.info("EditorCanvasComponent", "Moveable dragEnd", { componentId: component.id });
    setIsDragging(false);
    const newX = frame.translate[0];
    const newY = frame.translate[1];

    updateComponentTransform(component.id, { x: newX, y: newY });
  }, [
    component.id,
    frame.translate,
    updateComponentTransform,
  ]);

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
      const minW = definition?.minSize?.width ?? 20;
      const minH = definition?.minSize?.height ?? 20;
      const newW = Math.max(width, minW);
      const newH = Math.max(height, minH);
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
    [component.id, component.type, component.config, updateComponentConfig, definition?.minSize],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    const minW = definition?.minSize?.width ?? 20;
    const minH = definition?.minSize?.height ?? 20;
    const newW = Math.max(frame.size[0], minW);
    const newH = Math.max(frame.size[1], minH);
    if (component.type === "text") {
      const latestConfig = useEditorStore.getState().components.find((c) => c.id === component.id)?.config;
      const configUpdate: Record<string, unknown> = {};
      if (latestConfig?.autoFit) configUpdate.autoFit = false;
      batchUpdateComponent(component.id, {
        transform: { x: frame.translate[0], y: frame.translate[1], width: newW, height: newH },
        config: Object.keys(configUpdate).length > 0 ? configUpdate : undefined,
      });
    } else {
      updateComponentTransform(component.id, {
        x: frame.translate[0],
        y: frame.translate[1],
        width: newW,
        height: newH,
      });
    }
  }, [
    component.id,
    component.type,
    frame.translate,
    frame.size,
    updateComponentTransform,
    batchUpdateComponent,
    definition?.minSize,
  ]);

  const guidePositions = useMemo(() => {
    if (!canvasConfig.guide.visible || !canvasConfig.guide.snapToGuide) {
      return { vertical: [], horizontal: [] };
    }
    return getGuidePositions(canvasConfig.guide.preset, canvasConfig.width, canvasConfig.height, canvasConfig.guide.customVertical, canvasConfig.guide.customHorizontal);
  }, [canvasConfig.guide.visible, canvasConfig.guide.snapToGuide, canvasConfig.guide.preset, canvasConfig.width, canvasConfig.height, canvasConfig.guide.customVertical, canvasConfig.guide.customHorizontal]);

  const moveableSnappable = isInteractable && (canvasConfig.guide.snapToGuide || canvasConfig.guide.snapToElement || canvasConfig.grid.snapToGrid);
  const moveableSnapThreshold = canvasConfig.guide.snapToGuide ? canvasConfig.guide.snapThreshold : (canvasConfig.grid.snapToGrid ? canvasConfig.grid.size : 5);

  const [Renderer, setRenderer] = useState<React.ComponentType<ComponentRendererProps> | null>(
    () => {
      const cached = rendererCache.get(type) || definition?.renderer.cached || null;
      console.log("[EditorCanvasComponent] 🔍 Initial renderer for", type, ":", cached ? "FOUND" : "NULL");
      return cached;
    }
  );

  useEffect(() => {
    const cached = rendererCache.get(type);
    if (cached) {
      console.log("[EditorCanvasComponent] 🔍 Using cached renderer for", type);
      setRenderer(() => cached);
      return;
    }
    // 关键：重新从 componentRegistry 查 definition，避免闭包过期问题
    // 如果组件刚被注册（或延迟加载），这里能拿到最新的 definition
    const currentDefinition = componentRegistry.get(type);
    // 🔍 DIAGNOSTIC: 详细日志输出到日志文件
    logger.info("EditorCanvasComponent", "Component render attempt", {
      componentId: component.id,
      type,
      hasCached: !!cached,
      hasDefinition: !!currentDefinition,
      hasLoader: !!currentDefinition?.renderer.loader,
      allRegisteredTypes: componentRegistry.getAll().map((d) => d.type),
      registeredCount: componentRegistry.getAll().length,
    });
    if (currentDefinition?.renderer.loader) {
      console.log("[EditorCanvasComponent] 🔍 Loading renderer for", type, "...");
      rendererCache.load(type).then((loaded) => {
        console.log("[EditorCanvasComponent] 🔍 Renderer loaded for", type, ":", loaded ? "SUCCESS" : "FAILED");
        logger.info("EditorCanvasComponent", "Renderer loaded", {
          componentId: component.id,
          type,
          success: !!loaded,
        });
        setRenderer(() => loaded || FallbackRenderer);
      });
      return;
    }
    // 修复：对于 device:* 类型但 componentRegistry 中没有定义的情况，
    // 直接使用 DeviceComponentRenderer（通用设备组件渲染器）。
    // 这是因为真实设备的产品码（如 EC-18）不一定在静态产品定义中，
    // 但只要 deviceStore.products 里有对应 productCode 的元数据，
    // 渲染器就能从 metadata 中推断 category 并正常渲染。
    if (type.startsWith("device:")) {
      logger.info("EditorCanvasComponent", "Using DeviceComponentRenderer", {
        componentId: component.id,
        type,
      });
      setRenderer(() => DeviceComponentRenderer as unknown as React.ComponentType<ComponentRendererProps>);
      return;
    }
    // #region debug-point comp-tunnel-render-error
    // 修复：definition 为 undefined 且不是 device:* 时，主动 setRenderer 为 FallbackRenderer，
    // 避免 Renderer 永远为 null 导致 FallbackRenderer 通过 componentId 显示"未知组件"。
    logger.warn("EditorCanvasComponent", "Component type NOT registered - using FallbackRenderer", {
      componentId: component.id,
      type,
      hasDefinition: !!currentDefinition,
      hasLoader: !!currentDefinition?.renderer.loader,
      allRegisteredTypes: componentRegistry.getAll().map((d) => d.type),
    });
    console.warn("[EditorCanvasComponent] ❌ Component type not registered:", {
      type,
      hasDefinition: !!currentDefinition,
      hasLoader: !!currentDefinition?.renderer.loader,
      allRegisteredTypes: componentRegistry.getAll().map((d) => d.type),
    });
    setRenderer(() => FallbackRenderer);
    // #endregion debug-point comp-tunnel-render-error
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
          cursor: previewMode
            ? (effectiveInteractive ? "pointer" : "default")
            : isCadViewAdjusting ? "grabbing" : isCustomFitMode ? "grab" : isInteractable ? (isDragging ? "grabbing" : "grab") : "default",
          outline: previewMode
            ? "none"
            : showBorder
              ? isSelected
                ? "2px solid #1976d2"
                : "1px dashed rgba(25,118,210,0.5)"
              : "none",
          outlineOffset: "0px",
          userSelect: "none",
          pointerEvents: isCanvasDragOver
            ? "none"
            : previewMode
              ? (effectiveInteractive ? "auto" : "none")
              : "auto",
          transition: isDragging || isResizing ? "none" : "outline-color 0.15s",
          "&:hover": previewMode
            ? (effectiveInteractive ? { filter: "brightness(1.08)", transition: "filter 0.15s" } : {})
            : {
                outline: layerLocked || locked ? undefined : "1px dashed rgba(25,118,210,0.5)",
              },
        }}
        onClick={
          previewMode
            ? (effectiveInteractive ? handlePreviewClick : undefined)
            : handleClick
        }
        onDoubleClick={
          previewMode
            ? (effectiveInteractive ? handlePreviewDblClick : undefined)
            : undefined
        }
        onContextMenu={previewMode ? undefined : handleContextMenu}
        onMouseDown={previewMode ? undefined : handleMouseDown}
        onMouseEnter={previewMode ? undefined : () => onHover(component.id)}
        onMouseLeave={previewMode ? undefined : () => onHover(null)}
      >
        <Box sx={{ position: "relative", width: "100%", height: "100%", overflow: type.startsWith("decoration-") || type.startsWith("datav-") || type.startsWith("device:") ? "visible" : "hidden" }}>
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
              editorSelected={isSelected}
            />
          ) : <FallbackRenderer config={config} componentId={component.id} />}
        </Box>

        {/* 组件级边框装饰覆盖层：每个内容组件自带边框 / 四角 / 发光 / 动画 / 流光，
            替代被删除的独立底部数据边框（comp_*_12_frame）。pointer-events:none 不阻挡交互。 */}
        {!isFrameExcluded(type) && (
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <ComponentFrame frameConfig={config?.frame as Record<string, unknown> | undefined} componentId={component.id} width={width} height={height} />
          </Box>
        )}

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
          keepRatio={component.type === "datav-border-1" || component.type === "datav-decoration-12"}
          throttleDrag={canvasConfig.grid.snapToGrid ? canvasConfig.grid.dragStep : 0}
          throttleResize={canvasConfig.grid.snapToGrid ? canvasConfig.grid.resizeStep : 0}
          minWidth={definition?.minSize?.width ?? 20}
          minHeight={definition?.minSize?.height ?? 20}
          snappable={moveableSnappable}
          snapThreshold={moveableSnapThreshold}
          snapGridWidth={canvasConfig.grid.snapToGrid ? canvasConfig.grid.size : 0}
          snapGridHeight={canvasConfig.grid.snapToGrid ? canvasConfig.grid.size : 0}
          verticalGuidelines={guidePositions.vertical}
          horizontalGuidelines={guidePositions.horizontal}
          elementGuidelines={canvasConfig.guide.snapToElement ? elementGuidelines : []}
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
});
