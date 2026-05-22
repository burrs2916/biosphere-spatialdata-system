import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import type { ComponentRendererProps } from "../../types/editor";
import { MapLibreEngine } from "../map-engines/MapLibreEngine";
import type { MapEngine } from "../map-engines/types";
import "maplibre-gl/dist/maplibre-gl.css";

interface HeatmapPoint {
  lng: number;
  lat: number;
  weight?: number;
}

export function HeatmapMapRenderer({ config, componentId }: ComponentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const initRef = useRef(false);

  const baseMapUrl = (config.baseMapUrl as string) || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const heatmapRadius = (config.heatmapRadius as number) ?? 30;
  const heatmapIntensity = (config.heatmapIntensity as number) ?? 1;
  const heatmapOpacity = (config.heatmapOpacity as number) ?? 0.8;
  const data = (config.data as HeatmapPoint[]) || [];

  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

    const engine = new MapLibreEngine();
    engineRef.current = engine;

    const features = data.map((point, index) => ({
      type: "Feature" as const,
      properties: { weight: point.weight ?? 1, id: index },
      geometry: {
        type: "Point" as const,
        coordinates: [point.lng, point.lat],
      },
    }));

    const style = {
      version: 8,
      sources: {
        "base-tiles": {
          type: "raster",
          tiles: [baseMapUrl],
          tileSize: 256,
        },
        "heatmap-source": {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features,
          },
        },
      },
      layers: [
        {
          id: "base-tile-layer",
          type: "raster",
          source: "base-tiles",
        },
        {
          id: "heatmap-layer",
          type: "heatmap",
          source: "heatmap-source",
          paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": heatmapIntensity,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0, 0, 255, 0)",
              0.2, "royalblue",
              0.4, "cyan",
              0.6, "lime",
              0.8, "yellow",
              1, "red",
            ],
            "heatmap-radius": heatmapRadius,
            "heatmap-opacity": heatmapOpacity,
          },
        },
      ],
    };

    engine
      .mount({
        container: containerRef.current,
        crs: "EPSG:3857",
        style: JSON.stringify(style),
        camera: {
          center: { x: 116.397, y: 39.908 },
          zoom: 10,
        },
        interactive: true,
        attributionControl: false,
      })
      .catch((err) => {
        console.error(`[HeatmapMap:${componentId}] Mount failed:`, err);
      });

    return () => {
      engine.unmount();
      engineRef.current = null;
      initRef.current = false;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const observer = new ResizeObserver(() => {
      engine.resize();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 1,
        border: "1px solid rgba(33,150,243,0.15)",
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: "100%",
          "& .maplibregl-ctrl-attrib": { display: "none" },
          "& .maplibregl-ctrl-logo": { display: "none" },
        }}
      />
      {data.length === 0 && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,20,40,0.6)",
            gap: 1,
            pointerEvents: "none",
          }}
        >
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
            请配置热力数据
          </Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
            支持通过数据源动态绑定
          </Typography>
        </Box>
      )}
      {data.length > 0 && !engineRef.current?.isReady && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,20,40,0.8)",
            gap: 1,
          }}
        >
          <CircularProgress size={24} sx={{ color: "rgba(33,150,243,0.6)" }} />
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
            热力图加载中...
          </Typography>
        </Box>
      )}
    </Box>
  );
}
