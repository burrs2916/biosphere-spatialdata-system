import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { CadViewerEngine } from "../editor/cad/CadViewerEngine";

interface CadPreviewViewerProps {
  libraryId: string;
  libraryName: string;
}

/**
 * Read-only CAD preview used inside the map-browsing popup.
 * Mounts CadViewerEngine, loads the library's .cadbin and renders it
 * without any editing affordances (no layer panel / text editing / select).
 */
export function CadPreviewViewer({ libraryId, libraryName }: CadPreviewViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    const engine = new CadViewerEngine();

    // Preview is read-only fit-to-window: block wheel / double-click zoom so the
    // map stays framed and cannot be scaled. Pan is unaffected. Capturing on the
    // container intercepts the canvas-level listeners added by the engine.
    const blockZoom = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    container.addEventListener("wheel", blockZoom, { capture: true, passive: false });
    container.addEventListener("dblclick", blockZoom, { capture: true });

    const handleError = (ev: { type: string; data?: unknown }) => {
      const payload = (ev.data ?? {}) as { error?: unknown };
      const msg = payload.error instanceof Error ? payload.error.message : String(payload.error ?? "未知渲染错误");
      if (!destroyed) {
        setErrorMsg(msg);
        setStatus("error");
      }
    };
    const unsub = engine.on("error", handleError);

    void (async () => {
      try {
        await engine.initialize({
          container,
          autoResize: true,
          backgroundColor: "#0a0a1a",
          lineColor: "#4fc3f7",
        });
        if (destroyed) {
          engine.destroy();
          return;
        }
        const ok = await engine.openFromMapLibrary(libraryId, libraryName);
        if (destroyed) return;
        if (ok === false) throw new Error("CAD 文档加载失败");
        // Frame the whole drawing to the window (适应窗口).
        engine.fitToView();
        if (!destroyed) setStatus("ready");
      } catch (err) {
        if (!destroyed) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      }
    })();

    return () => {
      destroyed = true;
      container.removeEventListener("wheel", blockZoom, { capture: true } as EventListenerOptions);
      container.removeEventListener("dblclick", blockZoom, { capture: true } as EventListenerOptions);
      unsub();
      engine.destroy();
    };
  }, [libraryId, libraryName]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%", backgroundColor: "#0a0a1a" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {status === "loading" && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
            backgroundColor: "rgba(10,10,26,0.88)",
          }}
        >
          <CircularProgress size={32} sx={{ color: "#4fc3f7" }} />
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)" }}>
            CAD 图纸加载中…
          </Typography>
        </Box>
      )}
      {status === "error" && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
          }}
        >
          <Typography variant="body2" sx={{ color: "rgba(255,120,120,0.9)", textAlign: "center" }}>
            {errorMsg || "CAD 加载失败"}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
