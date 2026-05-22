import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { componentRegistry } from "../editor/registry";
import { loadComponentPreviewConfig, clearComponentPreviewConfig } from "../utils/previewWindow";
import { logger } from "../utils/logger";

export default function ComponentPreviewPage() {
  const { componentType } = useParams<{ componentType: string }>();
  const [Renderer, setRenderer] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});

  const initializedRef = useRef(false);

  useEffect(() => {
    logger.info("ComponentPreviewPage", "Page initialized", {
      componentType,
      windowLabel: getCurrentWindow().label,
    });
  }, [componentType]);

  useEffect(() => {
    if (!componentType) return;

    const previewConfig = loadComponentPreviewConfig();
    if (previewConfig && previewConfig.pluginType === componentType) {
      setConfig(previewConfig.defaultConfig);
    }

    componentRegistry.loadRenderer(componentType).then((comp: React.ComponentType<any> | null) => {
      if (comp) {
        setRenderer(() => comp);
      } else {
        setError("未找到组件渲染器");
      }
      setLoading(false);
    }).catch((err: Error) => {
      logger.error("ComponentPreviewPage", "Failed to load renderer", { error: String(err) });
      setError(err.message || "加载渲染器失败");
      setLoading(false);
    });
  }, [componentType]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const currentWindow = getCurrentWindow();
    currentWindow.onCloseRequested(() => {
      clearComponentPreviewConfig();
    }).catch(() => {});
  }, []);

  if (error) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#1a1a2e",
        color: "#888",
        gap: "8px",
        fontFamily: "sans-serif",
      }}>
        <h3 style={{ margin: 0, opacity: 0.6 }}>加载失败</h3>
        <p style={{ margin: 0, opacity: 0.4, fontSize: "14px" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      backgroundColor: "#1a1a2e",
    }}>
      {loading && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "sans-serif",
        }}>
          <span>加载渲染器...</span>
        </div>
      )}

      {Renderer && !loading && (
        <Renderer
          config={config}
          componentId={`preview_${componentType}`}
          mode="preview"
        />
      )}
    </div>
  );
}
