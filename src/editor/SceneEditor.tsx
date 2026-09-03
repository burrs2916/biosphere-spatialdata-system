import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import SaveIcon from "@mui/icons-material/Save";
import PreviewIcon from "@mui/icons-material/Preview";

import PublishIcon from "@mui/icons-material/Publish";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LayersIcon from "@mui/icons-material/Layers";
import SettingsIcon from "@mui/icons-material/Settings";
import WidgetsIcon from "@mui/icons-material/Widgets";
import BoltIcon from "@mui/icons-material/Bolt";
import { useCallback, useEffect, useState, useRef } from "react";
import { EditorCanvas } from "./canvas/EditorCanvas";
import { EditorLayerPanelContent } from "./panels/EditorLayerPanel";
import { EditorPropertyPanelContent } from "./panels/EditorPropertyPanel";
import { EditorCanvasPanel } from "./panels/EditorCanvasPanel";
import { EventBindingPanel } from "./panels/EventBindingPanel";
import { SceneTabBar } from "./components/SceneTabBar";
import logger from "../utils/logger";
import { openPreviewWindow } from "../utils/previewWindow";
import { ComponentCenterPanel } from "./panels/ComponentCenterPanel";
import { PerformanceMonitor } from "./monitors/PerformanceMonitor";
import { useEditorStore } from "../store/editorStore";
import { createDefaultLayer } from "../types/editor";
import { useSceneStore } from "../store/sceneStore";
import { useEditorShortcuts } from "./hooks/useEditorShortcuts";
import { SceneEditorProvider } from "./context/SceneEditorContext";
import { useDirtyStore } from "../store/editorStore";

export function SceneEditor() {
  useEditorShortcuts();
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const isDirty = useDirtyStore((s) => s.isDirty);
  const selectedIds = useEditorStore((s) => s.selection.selectedIds);

  const activeSceneId = useSceneStore((s) => s.activeSceneId);
  const scenes = useSceneStore((s) => s.scenes);
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? null;
  const updateScene = useSceneStore((s) => s.updateScene);
  const publishScene = useSceneStore((s) => s.publishScene);
  const unpublishScene = useSceneStore((s) => s.unpublishScene);

  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"property" | "layer" | "canvas" | "events">("property");

  useEffect(() => {
    if (selectedIds.length > 0) {
      setRightPanelOpen(true);
      setRightPanelTab("property");
    }
  }, [selectedIds]);

  const prevSceneIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = useCallback(async () => {
    if (!activeSceneId) return;
    const { views, globalComponents, activeViewId } = useEditorStore.getState().exportSceneWithViews();
    const activeView = views.find((v) => v.id === activeViewId);
    const canvasConfig = activeView?.canvasConfig;
    try {
      await updateScene(activeSceneId, {
        canvasConfig,
        views,
        globalComponents,
        activeViewId,
      });
      useDirtyStore.getState().markClean();
    } catch (err) {
      logger.error("SceneEditor", "Auto-save failed, keeping isDirty", { sceneId: activeSceneId, error: err });
    }
  }, [activeSceneId, updateScene]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (isDirty && activeSceneId) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        handleSaveRef.current();
      }, 1000);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isDirty, activeSceneId]);

  // 编辑器打开时：主动触发设备/产品数据加载（确保画布上的设备组件能拿到真实状态）
  // - ensureDevicesLoaded() 是单次锁；SceneEditor 必须在 DevicePalettePanel 之前调一次
  // - 否则首次进入场景时 deviceStore 还是 defaultProvider，画布上所有设备都显示为"离线"
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { useDeviceStore, ensureDevicesLoaded } = await import("../store/deviceStore");
        if (cancelled) return;
        // 触发全局单次自动加载（内部 _autoLoaded 锁保护，多个 caller 安全）
        await ensureDevicesLoaded();
        if (cancelled) return;
        const ds = useDeviceStore.getState();
        const productCount = Object.keys(ds.products || {}).length;
        const deviceCount = Object.keys(ds.devices || {}).length;
        logger.info("SceneEditor", "Device store ready on open", {
          productCount, deviceCount,
          lastLoadedAt: ds.lastLoadedAt,
        });
        if (productCount === 0 && deviceCount === 0) {
          logger.warn("SceneEditor", "No products / devices loaded — please configure a data source in the device panel", {});
        }
      } catch (err) {
        logger.error("SceneEditor", "Device store init failed", { error: err });
      }
    })();
    return () => { cancelled = true; };
  }, [activeSceneId]);

  useEffect(() => {
    if (!activeSceneId) return;

    const currentScene = useSceneStore.getState().scenes.find((s) => s.id === activeSceneId);
    if (!currentScene) return;

    if (prevSceneIdRef.current && prevSceneIdRef.current !== activeSceneId) {
      const prevSceneId = prevSceneIdRef.current;
      const prevScene = useSceneStore.getState().scenes.find((s) => s.id === prevSceneId);
      if (prevScene && useDirtyStore.getState().isDirty) {
        const { views, globalComponents, activeViewId } = useEditorStore.getState().exportSceneWithViews();
        const activeView = views.find((v) => v.id === activeViewId);
        const canvasConfig = activeView?.canvasConfig;
        useSceneStore.getState().updateScene(prevSceneId, {
          canvasConfig,
          views,
          globalComponents,
          activeViewId,
        }).then(() => {
          useDirtyStore.getState().markClean();
        }).catch((err) => {
          logger.error("SceneEditor", "Failed to save previous scene during switch", { sceneId: prevSceneId, error: err });
        });
      }
    }

    prevSceneIdRef.current = activeSceneId;

    const state = useEditorStore.getState();
    state.clearScene();

    // 调试日志：打印场景加载详情
    console.log("[SceneEditor] 🔍 Loading scene:", {
      sceneId: activeSceneId,
      hasViews: currentScene.views && currentScene.views.length > 0,
      viewCount: currentScene.views?.length || 0,
      hasComponents: currentScene.editorComponents && currentScene.editorComponents.length > 0,
      componentCount: currentScene.editorComponents?.length || 0,
      firstViewComponents: currentScene.views?.[0]?.components?.length || 0,
    });

    const hasViews = currentScene.views && currentScene.views.length > 0;
    const hasComponents = currentScene.editorComponents && currentScene.editorComponents.length > 0;
    const hasLayers = currentScene.editorLayers && currentScene.editorLayers.length > 0;

    if (hasViews) {
      logger.info("SceneEditor", "Loading scene with views", { sceneId: activeSceneId, viewCount: currentScene.views!.length, activeViewId: currentScene.activeViewId });
      const activeVId = currentScene.activeViewId || currentScene.views![0].id;
      state.loadSceneWithViews(currentScene.views!, currentScene.globalComponents || [], activeVId);
      
      // 调试：打印加载后的组件数量
      console.log("[SceneEditor] 🔍 After loadSceneWithViews:", {
        activeViewId: activeVId,
        loadedComponents: state.components.length,
        loadedLayers: state.layers.length,
        canvasConfig: state.canvasConfig,
      });
    } else if (hasComponents || hasLayers) {
      logger.info("SceneEditor", "Migrating legacy scene to views", { sceneId: activeSceneId, components: currentScene.editorComponents?.length || 0, layers: currentScene.editorLayers?.length || 0 });
      const defaultLayer = hasLayers ? currentScene.editorLayers! : [createDefaultLayer("默认图层", "layer", null, true)];
      const canvasConfig = currentScene.canvasConfig ? { ...currentScene.canvasConfig } : undefined;
      const views = [{ id: "default", name: currentScene.name || "主监控大屏", components: currentScene.editorComponents || [], layers: defaultLayer, canvasConfig }];
      state.loadSceneWithViews(views, [], "default");
      state.setActiveLayer(defaultLayer.find((l: any) => l.isDefault)?.id || defaultLayer[0]?.id);
    } else {
      logger.info("SceneEditor", "Creating default scene", { sceneId: activeSceneId });
      const defaultLayer = createDefaultLayer("默认图层", "layer", null, true);
      const canvasConfig = currentScene.canvasConfig ? { ...currentScene.canvasConfig } : undefined;
      const views = [{ id: "default", name: currentScene.name || "主监控大屏", components: [], layers: [defaultLayer], canvasConfig }];
      state.loadSceneWithViews(views, [], "default");
    }
  }, [activeSceneId]);

  return (
    <SceneEditorProvider>
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(18, 18, 24, 0.95)"
              : "rgba(255, 255, 255, 0.95)",
          gap: 0.5,
          height: 36,
          position: "relative",
          zIndex: 100,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <Tooltip title="撤销 (Ctrl+Z)">
            <span>
              <IconButton size="small" onClick={undo} disabled={!canUndo()}>
                <UndoIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="重做 (Ctrl+Y)">
            <span>
              <IconButton size="small" onClick={redo} disabled={!canRedo()}>
                <RedoIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="保存">
            <IconButton size="small" onClick={handleSave} color={isDirty ? "primary" : "default"}>
              <SaveIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 20 }} />

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <Tooltip title={leftPanelOpen ? "收起组件中心" : "展开组件中心"}>
            <IconButton
              size="small"
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              sx={{
                backgroundColor: leftPanelOpen ? "action.selected" : "transparent",
              }}
            >
              <WidgetsIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="预览">
            <IconButton
              size="small"
              onClick={async () => {
                if (activeScene) {
                  if (isDirty) {
                    await handleSaveRef.current();
                  }
                  openPreviewWindow(activeScene.id, activeScene.name);
                }
              }}
            >
              <PreviewIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          {activeScene && (
            <Tooltip title={activeScene.status === "published" ? "取消发布" : "发布场景"}>
              <IconButton
                size="small"
                onClick={async () => {
                  if (isDirty) {
                    await handleSaveRef.current();
                  }
                  if (activeScene.status === "published") {
                    unpublishScene(activeScene.id);
                  } else {
                    publishScene(activeScene.id);
                  }
                }}
                color={activeScene.status === "published" ? "success" : "default"}
              >
                <PublishIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <ComponentCenterPanel
          collapsed={!leftPanelOpen}
          onToggle={() => setLeftPanelOpen(!leftPanelOpen)}
        />

        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
          <SceneTabBar />
          <EditorCanvas />
        </Box>

        {rightPanelOpen && (
          <Box
            sx={{
              width: 300,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderLeft: 1,
              borderColor: "divider",
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(14, 14, 20, 0.92)"
                  : "rgba(248, 248, 252, 0.95)",
              backdropFilter: "blur(12px)",
              overflow: "hidden",
            }}
          >
            {activeScene && (
              <Box
                sx={{
                  px: 1.5,
                  py: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexShrink: 0,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: "text.primary",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {activeScene.name}
                </Typography>
                <Chip
                  label={
                    activeScene.status === "draft"
                      ? "草稿"
                      : activeScene.status === "published"
                        ? "已发布"
                        : "已归档"
                  }
                  size="small"
                  color={
                    activeScene.status === "published" ? "success" : "default"
                  }
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              </Box>
            )}

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                borderBottom: 1,
                borderColor: "divider",
                flexShrink: 0,
              }}
            >
              <Box
                onClick={() => setRightPanelTab("property")}
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.5,
                  py: 0.75,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: rightPanelTab === "property" ? 600 : 400,
                  color: rightPanelTab === "property" ? "primary.main" : "text.secondary",
                  borderBottom: rightPanelTab === "property" ? 2 : 0,
                  borderColor: "primary.main",
                  transition: "all 0.15s",
                  "&:hover": {
                    color: "primary.main",
                    backgroundColor: (theme: any) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.02)",
                  },
                }}
              >
                <SettingsIcon sx={{ fontSize: 14 }} />
                属性
              </Box>
              <Box
                onClick={() => setRightPanelTab("layer")}
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.5,
                  py: 0.75,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: rightPanelTab === "layer" ? 600 : 400,
                  color: rightPanelTab === "layer" ? "primary.main" : "text.secondary",
                  borderBottom: rightPanelTab === "layer" ? 2 : 0,
                  borderColor: "primary.main",
                  transition: "all 0.15s",
                  "&:hover": {
                    color: "primary.main",
                    backgroundColor: (theme: any) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.02)",
                  },
                }}
              >
                <LayersIcon sx={{ fontSize: 14 }} />
                图层
              </Box>
              <Box
                onClick={() => setRightPanelTab("canvas")}
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.5,
                  py: 0.75,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: rightPanelTab === "canvas" ? 600 : 400,
                  color: rightPanelTab === "canvas" ? "primary.main" : "text.secondary",
                  borderBottom: rightPanelTab === "canvas" ? 2 : 0,
                  borderColor: "primary.main",
                  transition: "all 0.15s",
                  "&:hover": {
                    color: "primary.main",
                    backgroundColor: (theme: any) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.02)",
                  },
                }}
              >
                画布
              </Box>
              {selectedIds.length > 0 && (
                <Box
                  onClick={() => setRightPanelTab("events")}
                  sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    py: 0.75,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: rightPanelTab === "events" ? 600 : 400,
                    color: rightPanelTab === "events" ? "primary.main" : "text.secondary",
                    borderBottom: rightPanelTab === "events" ? 2 : 0,
                    borderColor: "primary.main",
                    transition: "all 0.15s",
                    "&:hover": {
                      color: "primary.main",
                      backgroundColor: (theme: any) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.02)",
                    },
                  }}
                >
                  <BoltIcon sx={{ fontSize: 14 }} />
                  事件
                </Box>
              )}
            </Box>

            <Box sx={{ flex: 1, overflow: "auto", minHeight: 0 }}>
              {rightPanelTab === "property" ? (
                <EditorPropertyPanelContent />
              ) : rightPanelTab === "layer" ? (
                <EditorLayerPanelContent />
              ) : rightPanelTab === "events" ? (
                selectedIds.length > 0 ? (
                  <EventBindingPanel componentId={selectedIds[0]} />
                ) : (
                  <EditorPropertyPanelContent />
                )
              ) : (
                <EditorCanvasPanel />
              )}
            </Box>
          </Box>
        )}

        <Box
          sx={{
            width: 24,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(18, 18, 24, 0.4)"
                : "rgba(250, 250, 252, 0.6)",
            borderLeft: 1,
            borderColor: "divider",
            "&:hover": {
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
            },
          }}
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
        >
          {rightPanelOpen ? (
            <ChevronRightIcon sx={{ fontSize: 14 }} />
          ) : (
            <ChevronLeftIcon sx={{ fontSize: 14 }} />
          )}
        </Box>
      </Box>
    </Box>
    <PerformanceMonitor />
    </SceneEditorProvider>
  );
}
