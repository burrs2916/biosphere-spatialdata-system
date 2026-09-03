import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import AddIcon from "@mui/icons-material/Add";
import CropFreeIcon from "@mui/icons-material/CropFree";
import { useRef, useCallback, useEffect, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { getEffectiveGridSize } from "../../utils/viewportTransform";
import { useEditorStore } from "../../store/editorStore";
import { useDeviceStore } from "../../store/deviceStore";
import { useDeviceMappingStore } from "../../store/deviceMappingStore";
import { useDevicePlacementStore, generatePlacementId } from "../../store/devicePlacementStore";
import { useViewport, useCanvasResize } from "../hooks/useViewport";
import { useSceneEventBridge } from "../hooks/useSceneEventBridge";
import { EditorCanvasComponent } from "./EditorCanvasComponent";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { flattenLayerTree } from "../../types/editor";
import { componentRegistry } from "../registry";
import { convertFileSrc } from "@tauri-apps/api/core";
import { CanvasGuideLines } from "./CanvasGuideLines";
import EditorRuler from "./EditorRuler";
import { CanvasGrid } from "./CanvasGrid";
import { SceneDeviceOverlay } from "./SceneDeviceOverlay";
import { useTheme } from "@mui/material/styles";
import { DEFAULT_PRODUCT_CODE_MAPPING } from "../../devices/edgeConductorDefaults";

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
  const activeViewId = useEditorStore((s) => s.activeViewId);
  const selectedIds = useEditorStore((s) => s.selection.selectedIds);
  const hoveredId = useEditorStore((s) => s.selection.hoveredId);
  const canvasConfig = useEditorStore((s) => s.canvasConfig);
  const previewModeState = useEditorStore((s) => s.previewMode);
  const eventBindings = useEditorStore((s) => s.eventBindings);

  const isPreview = previewModeProp ?? previewModeState;

  const activeTool = useEditorStore((s) => s.activeTool);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const setHoveredComponent = useEditorStore((s) => s.setHoveredComponent);
  const setViewport = useEditorStore((s) => s.setViewport);

  const sortedLayers = flattenLayerTree(layers).filter((l) => l.type === "layer");

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
    if (!container || isPreview) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel, isPreview]);

  const viewportInitializedRef = useRef(false);
  const prevCanvasSizeRef = useRef({ width: canvasConfig.width, height: canvasConfig.height });
  const prevContainerSizeRef = useRef({ width: 0, height: 0 });
  const isPreviewPrevRef = useRef(false);

  /** 画布尺寸变更提示（4K/8K 切换时让用户感知）*/
  const [sizeChangeToast, setSizeChangeToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

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
        // 通知用户画布尺寸已变更（含真实缩放比，便于感知 4K/8K 差异）
        const scalePct = Math.round(vp.scale * 100);
        setSizeChangeToast({
          open: true,
          message: `画布尺寸已变更：${canvasConfig.width} × ${canvasConfig.height}  ·  当前缩放 ${scalePct}%`,
        });
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
      logger.debug("EditorCanvas", "handleCanvasClick", {
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
    const compType =
      useEditorStore.getState().draggedComponentType ||
      e.dataTransfer?.getData("application/x-component-type") ||
      "";
    if (!compType) return;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    const compType =
      useEditorStore.getState().draggedComponentType ||
      e.dataTransfer?.getData("application/x-component-type") ||
      "";
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

    // === DIAGNOSTIC: Drop 入口日志 ===
    logger.info("EditorCanvas", "Drop event triggered", {
      hasDataTransfer: !!e.dataTransfer,
      draggedDeviceIdFromStore: storeState.draggedDeviceId,
      draggedDeviceIdFromData: e.dataTransfer?.getData("application/x-device-id"),
      draggedComponentTypeFromStore: storeState.draggedComponentType,
      draggedComponentTypeFromData: e.dataTransfer?.getData("application/x-component-type"),
      allDataTypes: e.dataTransfer?.types,
    });

    // —— 分支 1：设备拖入（来自 DevicePalettePanel）——
    const draggedDeviceId =
      storeState.draggedDeviceId ||
      e.dataTransfer?.getData("application/x-device-id") ||
      "";
    if (draggedDeviceId) {
      storeState.setDraggedDeviceId(null);
      const device = useDeviceStore.getState().getDevice(draggedDeviceId);
      if (!device) {
        logger.warn("EditorCanvas", "Dropped device not found in store", { draggedDeviceId });
        return;
      }
      const pos = screenToCanvas(e.clientX, e.clientY);
      if (!pos) return;

      // ─── 应用产品码映射：数字编码 → 字符串编码 ───
      const mappedCode = DEFAULT_PRODUCT_CODE_MAPPING[Number(device.productCode)] ?? device.productCode;

      // 读取产品定义和映射配置（使用映射后的编码查找）
      const productMap = useDeviceStore.getState().products;
      const product = productMap[mappedCode] || productMap[device.productCode]; // 兼容两种编码
      const mapping = useDeviceMappingStore.getState().getMapping(mappedCode) || useDeviceMappingStore.getState().getMapping(device.productCode);
      const draggedVariant = e.dataTransfer?.getData("application/x-device-variant") || "";

      // 如果映射了组件类型，使用映射的组件；否则按约定自动选择
      const useMappedComponent = mapping?.componentType && componentRegistry.get(mapping.componentType);
      // ─── 约定优于配置：按 productCode 查找动态注册的设备组件 ───
      const autoCompType = `device:${mappedCode}`;
      const autoCompDef = componentRegistry.get(autoCompType);
      const hasAutoComponent = !!autoCompDef;

      // === DIAGNOSTIC: 检查组件注册状态 ===
      logger.info("EditorCanvas", "Device drop diagnostic", {
        productCode: device.productCode,
        mappedCode,
        autoCompType,
        hasAutoComponent,
        registeredDeviceTypes: componentRegistry.getByCategory("device").slice(0, 5).map(d => d.type),
        allDeviceTypesCount: componentRegistry.getByCategory("device").length,
      });

      const compType = useMappedComponent
        ? mapping!.componentType
        : hasAutoComponent
          ? autoCompType
          : "device";
      const variantId = draggedVariant || product?.defaultVariant || "control-panel";
      const variantDef = product?.variants?.find((v) => v.id === variantId);

      // 尺寸：根据画布尺寸动态调整
      const cc = storeState.canvasConfig;

      // 基础尺寸：优先用组件注册的大变体尺寸，再回退到变体定义，最后用合理默认值
      const freeVariant = product?.variants?.find((v) =>
        ["control-panel", "card"].includes(v.id)
      );
      const baseW = autoCompDef?.defaultSize?.width ?? freeVariant?.defaultSize.width ?? variantDef?.defaultSize.width ?? 200;
      const baseH = autoCompDef?.defaultSize?.height ?? freeVariant?.defaultSize.height ?? variantDef?.defaultSize.height ?? 150;

      // 按画布尺寸等比缩放：基础尺寸以 1920×1080 为基准设计，再缩小一半使初始尺寸适中
      const scaleW = cc.width / 1920 / 2;
      const scaleH = cc.height / 1080 / 2;
      const w = useMappedComponent
        ? mapping!.defaultSize.width
        : Math.max(80, Math.round(baseW * scaleW));
      const h = useMappedComponent
        ? mapping!.defaultSize.height
        : Math.max(60, Math.round(baseH * scaleH));

      // 在当前活动图层（或默认图层）创建组件
      let targetLayerId = findLayerAtPosition(pos.x, pos.y);
      if (!targetLayerId) targetLayerId = ensureDefaultLayer();
      if (!targetLayerId) return;

      const newComp = storeState.addComponent(compType, targetLayerId, {
        x: Math.max(0, pos.x - w / 2),
        y: Math.max(0, pos.y - h / 2),
      });
      if (newComp) {
        storeState.setActiveLayer(targetLayerId);

        // 构建组件配置
        const compConfig: Record<string, unknown> = {
          deviceId: device.deviceId,
          productCode: device.productCode,
        };
        if (useMappedComponent) {
          // 映射模式：设置 variant + 应用 Tag 绑定默认值
          compConfig.variant = variantId;
          // 将映射的 tagBindings 转化为组件初始配置
          if (mapping!.tagBindings.length > 0) {
            compConfig._deviceMapping = {
              mappingId: mapping!.id,
              productCode: device.productCode,
              tagBindings: mapping!.tagBindings,
              controlBindings: mapping!.controlBindings,
            };
          }
        } else {
          // 约定模式：自动设置 variant + 按 product tags 自动绑定
          compConfig.variant = variantId;
          // 按 ProductDefinition 的 tags 自动生成绑定约定
          if (product?.tags && product.tags.length > 0) {
            compConfig._deviceMapping = {
              productCode: device.productCode,
              tagBindings: product.tags.map((tag) => ({
                tagId: tag.id,
                tagPath: tag.id,
                componentProperty: tag.id.replace(/\./g, "_"),
                direction: tag.writable ? "bidirectional" as const : "read" as const,
              })),
              // === 修复 P3-bug：原 controlBindings 字段名错位（"command" 应为 "event" + "valueTemplate"） ===
              // 约定：boolean tag → onToggle 事件，{event.value} 模板
              //      数值 tag → onChange 事件，{event.value} 模板
              controlBindings: product.tags
                .filter((tag) => tag.writable)
                .map((tag) => ({
                  id: `cb_${tag.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  event: tag.dataType === "boolean" ? "onToggle" : "onChange",
                  tagId: tag.id,
                  valueTemplate: "{event.value}",
                })),
            };
          }
        }

        storeState.updateComponentConfig(newComp.id, compConfig);
        storeState.updateComponentTransform(newComp.id, { width: w, height: h });
        storeState.selectComponent(newComp.id, false);

        // === 把设备摆位写入 devicePlacementStore ===
        // 由 changeListener 通知 sceneStore 把摆位回写到 SceneView.devicePlacements（仅内存）
        // 落盘由 sceneStore.saveScene 显式触发
        const placementStore = useDevicePlacementStore.getState();
        if (activeViewId && !placementStore.isDevicePlaced(activeViewId, device.deviceId)) {
          placementStore.addPlacement(activeViewId, {
            id: generatePlacementId(device.deviceId),
            deviceId: device.deviceId,
            position: {
              type: "pixel",
              x: Math.max(0, pos.x - w / 2),
              y: Math.max(0, pos.y - h / 2),
            },
            labelVisible: true,
          });
          logger.info("EditorCanvas", "Device placement added", {
            viewId: activeViewId,
            deviceId: device.deviceId,
          });
        }
      }
      logger.info("EditorCanvas", "Device component placed", {
        deviceId: draggedDeviceId,
        componentType: compType,
        variant: variantId,
        mapped: !!useMappedComponent,
      });
      return;
    }

    // —— 分支 2：普通组件拖入 ——
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

    const cc = storeState.canvasConfig;

    // 设备组件：根据画布尺寸等比缩放，再缩小一半使初始尺寸适中
    if (compType.startsWith("device:")) {
      const scaleW = cc.width / 1920 / 2;
      const scaleH = cc.height / 1080 / 2;
      dw = Math.max(80, Math.round(definition.defaultSize.width * scaleW));
      dh = Math.max(60, Math.round(definition.defaultSize.height * scaleH));
    }

    if (compType === "text") {
      const shortSide = Math.min(cc.width, cc.height);
      const adaptiveFontSize = Math.max(10, Math.round(shortSide / 60));
      dw = Math.round(cc.width * 0.15);
      dh = Math.round(cc.height * 0.08);
      extraConfig = { fontSize: adaptiveFontSize };
    }

    // 标题框类装饰组件：根据画布尺寸自适应
    if (compType.startsWith("decoration-title-")) {
      dw = Math.round(cc.width * 0.35);
      dh = Math.max(40, Math.round(cc.height * 0.055));

      // 居中菱形框：菱形尺寸按组件高度自适应
      if (compType === "decoration-title-center-diamond") {
        const compH = dh;
        const dsx = Math.max(4, Math.round(compH * 0.11));
        const dsy = Math.max(6, Math.round(compH * 0.18));
        const gap = Math.max(12, Math.round(dw * 0.055));
        const dll = Math.max(6, Math.round(compH * 0.25));
        extraConfig = { diamondSizeX: dsx, diamondSizeY: dsy, diamondGap: gap, decoLineLength: dll };
      }
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

      if (extraConfig) {
        storeState.updateComponentConfig(newComponent.id, extraConfig);
      }

      // 非默认尺寸时更新 transform
      if (dw !== definition.defaultSize.width || dh !== definition.defaultSize.height) {
        storeState.updateComponentTransform(newComponent.id, {
          width: dw,
          height: dh,
        });
      }
    }
  }, [screenToCanvas, findLayerAtPosition, ensureDefaultLayer]);

  const canvasCursor =
    activeTool === "pan"
      ? "grab"
      : activeTool === "zoom-in"
        ? "zoom-in"
        : activeTool === "zoom-out"
          ? "zoom-out"
          : "default";

  const scalePercent = Math.round(viewport.scale * 100);

  /** 真实网格步长（画布单位，跟随缩放自动倍率）*/
  const effectiveGrid = getEffectiveGridSize(canvasConfig.grid.size, viewport.scale);

  /** 设置缩放到 1:1（实际像素）*/
  const setActualSize = useCallback(() => {
    if (!containerSize.width || !containerSize.height) return;
    const cx = containerSize.width / 2;
    const cy = containerSize.height / 2;
    setViewport({
      scale: 1,
      offset: {
        x: cx - canvasConfig.width / 2,
        y: cy - canvasConfig.height / 2,
      },
    });
  }, [containerSize.width, containerSize.height, canvasConfig.width, canvasConfig.height, setViewport]);

  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

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
          <Box component="span" sx={{ mx: 0.75, opacity: 0.5 }}>·</Box>
          {scalePercent}%
          <Box component="span" sx={{ mx: 0.75, opacity: 0.5 }}>·</Box>
          网格 {Math.round(effectiveGrid.minorStep)}px
        </Typography>
      </Box>
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

        {/* 背景装饰层：暗角 + 飘动光点（仅非预览模式 + 画布无背景图/视频时显示） */}
        {!isPreview && !hasAnyBackgroundContent() && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: -1,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            {/* 1) 暗角（径向渐变让中心稍亮、四角更深 — 圆形渐变，不引入"横""竖"） */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at center, rgba(30,58,107,0) 0%, rgba(10,21,37,0.35) 60%, rgba(0,0,0,0.65) 100%)",
              }}
            />
            {/* 2) 飘动光点（30 个圆形光斑，缓慢漂移 + 闪烁 — 圆形，不引入线条） */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                "& .bg-particle": {
                  position: "absolute",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(79,195,247,0.95) 0%, rgba(79,195,247,0.2) 60%, transparent 100%)",
                  boxShadow: "0 0 8px rgba(79,195,247,0.6)",
                  animation: "bgParticleDrift 18s linear infinite, bgParticleTwinkle 4s ease-in-out infinite",
                  opacity: 0.7,
                },
                "@keyframes bgParticleDrift": {
                  "0%": { transform: "translate(0,0)" },
                  "25%": { transform: "translate(40px,-30px)" },
                  "50%": { transform: "translate(-20px,40px)" },
                  "75%": { transform: "translate(30px,20px)" },
                  "100%": { transform: "translate(0,0)" },
                },
                "@keyframes bgParticleTwinkle": {
                  "0%, 100%": { opacity: 0.3 },
                  "50%": { opacity: 0.9 },
                },
              }}
            >
              {[
                { left: "5%", top: "12%", delay: "0s", size: 6 },
                { left: "12%", top: "78%", delay: "1.2s", size: 5 },
                { left: "18%", top: "44%", delay: "2.4s", size: 7 },
                { left: "26%", top: "20%", delay: "0.6s", size: 4 },
                { left: "33%", top: "62%", delay: "3.6s", size: 6 },
                { left: "41%", top: "30%", delay: "1.8s", size: 5 },
                { left: "47%", top: "85%", delay: "0.4s", size: 7 },
                { left: "54%", top: "15%", delay: "2.8s", size: 4 },
                { left: "61%", top: "50%", delay: "1.0s", size: 6 },
                { left: "68%", top: "70%", delay: "3.0s", size: 5 },
                { left: "73%", top: "25%", delay: "0.2s", size: 7 },
                { left: "79%", top: "90%", delay: "1.4s", size: 5 },
                { left: "85%", top: "40%", delay: "2.2s", size: 6 },
                { left: "91%", top: "65%", delay: "0.8s", size: 4 },
                { left: "96%", top: "18%", delay: "3.4s", size: 6 },
                { left: "8%", top: "55%", delay: "2.0s", size: 5 },
                { left: "22%", top: "88%", delay: "0.5s", size: 6 },
                { left: "36%", top: "8%", delay: "1.6s", size: 4 },
                { left: "50%", top: "72%", delay: "2.6s", size: 7 },
                { left: "64%", top: "35%", delay: "0.3s", size: 5 },
                { left: "76%", top: "55%", delay: "1.1s", size: 6 },
                { left: "88%", top: "80%", delay: "2.4s", size: 4 },
                { left: "15%", top: "32%", delay: "3.2s", size: 5 },
                { left: "28%", top: "65%", delay: "0.9s", size: 6 },
                { left: "44%", top: "5%", delay: "1.7s", size: 4 },
                { left: "58%", top: "92%", delay: "2.5s", size: 5 },
                { left: "70%", top: "12%", delay: "0.1s", size: 6 },
                { left: "82%", top: "48%", delay: "1.3s", size: 7 },
                { left: "94%", top: "75%", delay: "2.9s", size: 4 },
                { left: "3%", top: "60%", delay: "0.7s", size: 5 },
              ].map((p, i) => (
                <Box
                  key={i}
                  className="bg-particle"
                  sx={{
                    left: p.left,
                    top: p.top,
                    width: p.size,
                    height: p.size,
                    animationDelay: `${p.delay}, ${p.delay}`,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
        {sortedLayers
          .filter((layer) => layer.visible)
          .map((layer) => {
            const layerComponents = components
              .filter(
                (comp) =>
                  comp.layerId === layer.id &&
                  comp.visible &&
                  !comp.config?.embeddedInBorder11,
              )
              .sort((a, b) => a.zIndex - b.zIndex);

            return (
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
                {layerComponents.map((comp) => (
                  <CanvasErrorBoundary key={comp.id} componentId={comp.id}>
                    <EditorCanvasComponent
                      component={comp}
                      isSelected={!isPreview && selectedIds.includes(comp.id)}
                      isHovered={!isPreview && hoveredId === comp.id}
                      layerLocked={layer.locked}
                      isCanvasDragOver={isDragOver}
                      previewMode={isPreview}
                      eventBindings={eventBindings}
                      onSelect={selectComponent}
                      onHover={setHoveredComponent}
                    />
                  </CanvasErrorBoundary>
                ))}
              </Box>
            );
          })}
      </Box>

      {canvasConfig.grid.visible && !hasAnyBackgroundContent() && (
        <CanvasGrid
          canvasWidth={canvasConfig.width}
          canvasHeight={canvasConfig.height}
          gridSize={canvasConfig.grid.size}
          viewport={viewport}
          visible={canvasConfig.grid.visible}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          isDark={isDark}
          minorColor={canvasConfig.grid.minorColor || ""}
          majorColor={canvasConfig.grid.majorColor || ""}
          opacity={canvasConfig.grid.opacity}
          brightness={canvasConfig.grid.brightness}
        />
      )}

      {!isPreview && (
          <CanvasGuideLines
            canvasWidth={canvasConfig.width}
            canvasHeight={canvasConfig.height}
            viewport={viewport}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            guide={canvasConfig.guide}
          />
      )}

      {/* 设备覆盖层（编辑/预览均显示） */}
      <SceneDeviceOverlay
        viewId={activeViewId}
        editable={!isPreview}
      />

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
        <Tooltip title="按 1:1 实际大小显示">
          <IconButton size="small" onClick={setActualSize}>
            <CropFreeIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      )}

      {!isPreview && components.length === 0 && !hasAnyBackgroundContent() && (
        <Box
          sx={{
            position: "absolute",
            left: viewport.offset.x + canvasConfig.width * viewport.scale / 2,
            top: viewport.offset.y + canvasConfig.height * viewport.scale / 2,
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "text.secondary",
            pointerEvents: "none",
            zIndex: 2,
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
        </Box>
      )}

      {/* 画布尺寸变更 Toast — 让 4K/8K 切换可感知 */}
      {!isPreview && (
        <Snackbar
          open={sizeChangeToast.open}
          autoHideDuration={3000}
          onClose={() => setSizeChangeToast((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity="info"
            variant="filled"
            onClose={() => setSizeChangeToast((s) => ({ ...s, open: false }))}
            sx={{ fontSize: 12 }}
          >
            {sizeChangeToast.message}
          </Alert>
        </Snackbar>
      )}
      </Box>
    );

  if (isPreview) {
    return canvasContent;
  }

  return (
    <EditorRuler canvasWidth={canvasConfig.width} canvasHeight={canvasConfig.height} rulerVisible={canvasConfig.ruler.visible}>
      {canvasContent}
    </EditorRuler>
  );
}
