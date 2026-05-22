import { useEffect, useState, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import CloseIcon from "@mui/icons-material/Close";
import { useParams, useSearchParams } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSceneStore } from "../store/sceneStore";
import { useEditorStore } from "../store/editorStore";
import { EditorCanvas } from "../editor/canvas/EditorCanvas";
import { logger } from "../utils/logger";

type WindowMode = "preview" | "live";

export default function ScenePreviewPage() {
  const { sceneId } = useParams<{ sceneId: string }>();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") as WindowMode) || "preview";
  const isLive = mode === "live";

  const scenes = useSceneStore((s) => s.scenes);
  const loadScenes = useSceneStore((s) => s.loadScenes);
  const loadScene = useEditorStore((s) => s.loadScene);
  const setCanvasConfig = useEditorStore((s) => s.setCanvasConfig);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sceneNotFound, setSceneNotFound] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const unlistenRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    logger.info("ScenePreviewPage", "Page initialized", {
      mode,
      isLive,
      sceneId,
      windowLabel: getCurrentWindow().label,
    });
  }, [mode, isLive, sceneId]);

  useEffect(() => {
    setPreviewMode(true);
    return () => {
      setPreviewMode(false);
    };
  }, [setPreviewMode]);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  useEffect(() => {
    if (!sceneId || scenes.length === 0) return;

    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) {
      setSceneNotFound(true);
      return;
    }

    if (scene.editorComponents && scene.editorLayers) {
      loadScene(scene.editorComponents, scene.editorLayers);
    } else {
      loadScene([], []);
    }

    if (scene.canvasConfig) {
      setCanvasConfig(scene.canvasConfig);
    }

    setLoaded(true);
    logger.info("ScenePreviewPage", "Scene loaded", {
      sceneId,
      sceneName: scene.name,
      isLive,
    });
  }, [sceneId, scenes, loadScene, setCanvasConfig, isLive]);

  useEffect(() => {
    return () => {
      document.body.style.backgroundColor = "";
      document.documentElement.style.backgroundColor = "";
    };
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    logger.info("ScenePreviewPage", "Setting up window event listeners", { isLive });
    const currentWindow = getCurrentWindow();
    logger.info("ScenePreviewPage", "getCurrentWindow", { label: currentWindow.label });

    currentWindow.isFullscreen().then((fullscreen) => {
      logger.info("ScenePreviewPage", "Initial isFullscreen", { fullscreen });
      setIsFullscreen(fullscreen);
    }).catch((e) => {
      logger.error("ScenePreviewPage", "isFullscreen check failed", { error: String(e) });
    });

    let unlistenFn: (() => void) | null = null;
    currentWindow.onResized(() => {
      currentWindow.isFullscreen().then((fullscreen) => {
        setIsFullscreen(fullscreen);
      }).catch(() => {});
    }).then((fn) => {
      unlistenFn = fn;
      unlistenRef.current = fn;
      logger.info("ScenePreviewPage", "onResized listener registered");
    }).catch((e) => {
      logger.error("ScenePreviewPage", "onResized registration failed", { error: String(e) });
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
        unlistenFn = null;
        unlistenRef.current = null;
      }
    };
  }, [isLive]);

  const handleFullscreen = async () => {
    logger.info("ScenePreviewPage", "handleFullscreen clicked", { isLive });
    try {
      const currentWindow = getCurrentWindow();
      const fullscreen = await currentWindow.isFullscreen();
      logger.info("ScenePreviewPage", "Current fullscreen state", { fullscreen });
      if (fullscreen) {
        await currentWindow.setFullscreen(false);
        logger.info("ScenePreviewPage", "setFullscreen(false) succeeded");
      } else {
        await currentWindow.setFullscreen(true);
        logger.info("ScenePreviewPage", "setFullscreen(true) succeeded");
      }
    } catch (e) {
      logger.error("ScenePreviewPage", "fullscreen failed", {
        error: String(e),
        errorType: typeof e,
      });
    }
  };

  const handleClose = async () => {
    logger.info("ScenePreviewPage", "handleClose clicked", { isLive });
    try {
      const win = getCurrentWindow();
      logger.info("ScenePreviewPage", "Calling close", { label: win.label });
      await win.close();
      logger.info("ScenePreviewPage", "close succeeded");
    } catch (e) {
      logger.error("ScenePreviewPage", "close failed", {
        error: String(e),
        errorType: typeof e,
      });
    }
  };

  if (sceneNotFound) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "text.secondary",
          gap: 1,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 500, opacity: 0.6 }}>
          场景未找到
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.4 }}>
          该场景可能已被删除
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        bgcolor: "background.default",
        m: 0,
        p: 0,
      }}
    >
      {loaded && (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            position: "relative",
            zIndex: 1,
          }}
        >
          <EditorCanvas />
        </Box>
      )}

      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          zIndex: 1000,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(30,30,42,0.85)"
              : "rgba(255,255,255,0.85)",
          borderRadius: 1.5,
          px: 1,
          py: 0.25,
          backdropFilter: "blur(12px)",
          border: 1,
          borderColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.06)",
          opacity: 0.5,
          transition: "opacity 0.2s",
          "&:hover": { opacity: 1 },
          pointerEvents: "auto",
        }}
      >
        {!isLive && (
          <Typography variant="caption" sx={{ color: "text.secondary", px: 0.5 }}>
            预览
          </Typography>
        )}
        <Tooltip title={isFullscreen ? "退出全屏" : "全屏"}>
          <IconButton size="small" onClick={handleFullscreen}>
            {isFullscreen ? (
              <FullscreenExitIcon sx={{ fontSize: 16 }} />
            ) : (
              <FullscreenIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="关闭">
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
