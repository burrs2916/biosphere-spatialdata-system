import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { useMapLibraryStore } from "../store/mapLibraryStore";
import type { MapLibraryType } from "../types/mapLibrary";
import { TileMapRenderer } from "../editor/renderers/TileMapRenderer";
import { BlueprintMapRenderer } from "../editor/renderers/BlueprintMapRenderer";
import { CadPreviewViewer } from "./CadPreviewViewer";

/**
 * Blocks wheel / double-click zoom on whatever map canvas it contains, so the
 * preview stays fit-to-window. Capturing on this wrapper intercepts the
 * canvas-level listeners added by the underlying map engines. Pan remains.
 */
function NoZoomBox({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const blockZoom = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("wheel", blockZoom, { capture: true, passive: false });
    el.addEventListener("dblclick", blockZoom, { capture: true });
    return () => {
      el.removeEventListener("wheel", blockZoom, { capture: true } as EventListenerOptions);
      el.removeEventListener("dblclick", blockZoom, { capture: true } as EventListenerOptions);
    };
  }, []);

  return (
    <Box ref={ref} sx={{ width: "100%", height: "100%" }}>
      {children}
    </Box>
  );
}

/**
 * Standalone full-screen preview rendered inside its own Tauri WebviewWindow
 * (spawned from MapsPage). It deliberately renders WITHOUT the app shell so
 * each map preview is an independent, movable, resizable OS window that can be
 * opened multiple times in parallel without blocking the main application.
 * Zoom is disabled — the map simply fits the window.
 */
export default function MapPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const type = (searchParams.get("type") as MapLibraryType) || "cad";

  const libraries = useMapLibraryStore((s) => s.libraries);
  const loadLibraries = useMapLibraryStore((s) => s.loadLibraries);

  useEffect(() => {
    void loadLibraries();
  }, [loadLibraries]);

  const library = libraries.find((l) => l.id === id);
  const name = library?.name ?? id ?? "地图预览";

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#0a0a1a",
        overflow: "hidden",
      }}
    >
      {id && type === "cad" && <CadPreviewViewer libraryId={id} libraryName={name} key={id} />}
      {id && type === "tile" && (
        <NoZoomBox>
          <TileMapRenderer config={{ mapLibraryId: id, showControls: false }} componentId={`preview-${id}`} key={id} />
        </NoZoomBox>
      )}
      {id && type === "blueprint" && (
        <NoZoomBox>
          <BlueprintMapRenderer config={{ mapLibraryId: id, showControls: false }} componentId={`preview-${id}`} key={id} />
        </NoZoomBox>
      )}
    </Box>
  );
}
