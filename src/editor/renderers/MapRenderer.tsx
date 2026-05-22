import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PublicIcon from "@mui/icons-material/Public";
import type { ComponentRendererProps } from "../../types/editor";

export function MapRenderer({ config }: ComponentRendererProps) {
  const mapType = (config.mapType as string) || "tile";
  const zoom = (config.zoom as number) || 10;

  const mapLabel =
    mapType === "3d" ? "3D 地图" : mapType === "cad" ? "CAD 图纸" : "瓦片地图";

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,20,40,0.6)",
        borderRadius: 1,
        border: "1px solid rgba(33,150,243,0.15)",
        position: "relative",
        overflow: "hidden",
        gap: 1,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(0deg, rgba(33,150,243,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(33,150,243,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />
      <PublicIcon sx={{ fontSize: 36, color: "rgba(33,150,243,0.4)" }} />
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
        {mapLabel}
      </Typography>
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
        缩放: {zoom}x
      </Typography>
    </Box>
  );
}
