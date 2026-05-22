import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PublicIcon from "@mui/icons-material/Public";
import type { ComponentRendererProps } from "../../types/editor";

export function GlobeMapRenderer({ config }: ComponentRendererProps) {
  const terrainEnabled = (config.terrainEnabled as boolean) ?? true;
  const imageryProvider = (config.imageryProvider as string) || "osm";

  const providerLabel =
    imageryProvider === "tianditu" ? "天地图" : imageryProvider === "osm" ? "OpenStreetMap" : "无底图";

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at center, rgba(0,40,80,0.8) 0%, rgba(0,10,30,0.95) 100%)",
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
            radial-gradient(circle at 30% 40%, rgba(33,150,243,0.05) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, rgba(33,150,243,0.03) 0%, transparent 50%)
          `,
          pointerEvents: "none",
        }}
      />
      <PublicIcon sx={{ fontSize: 48, color: "rgba(33,150,243,0.4)" }} />
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
        三维地球
      </Typography>
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
        底图: {providerLabel} · 地形: {terrainEnabled ? "开启" : "关闭"}
      </Typography>
      <Typography variant="caption" sx={{ color: "rgba(33,150,243,0.4)", mt: 1 }}>
        即将支持 · CesiumJS 引擎集成中
      </Typography>
    </Box>
  );
}
