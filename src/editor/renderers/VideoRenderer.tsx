import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import VideocamIcon from "@mui/icons-material/Videocam";
import type { ComponentRendererProps } from "../../types/editor";

export function VideoRenderer({ config }: ComponentRendererProps) {
  const source = config.source as string;

  if (source) {
    return (
      <Box
        component="video"
        src={source}
        sx={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: "#000",
        }}
        muted={config.muted as boolean}
      />
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.3)",
        borderRadius: 1,
        gap: 1,
      }}
    >
      <VideocamIcon sx={{ fontSize: 32, color: "rgba(255,255,255,0.3)" }} />
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
        请设置视频源
      </Typography>
    </Box>
  );
}
