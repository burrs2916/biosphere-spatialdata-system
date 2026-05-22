import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ComponentRendererProps } from "../../types/editor";

export function FallbackRenderer({ componentId }: ComponentRendererProps) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,0,0,0.1)",
        border: "1px dashed rgba(255,0,0,0.3)",
        borderRadius: 1,
        p: 1,
      }}
    >
      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
        未知组件: {componentId}
      </Typography>
    </Box>
  );
}
