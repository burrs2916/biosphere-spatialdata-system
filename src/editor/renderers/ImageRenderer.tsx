import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";

export function ImageRenderer({ config }: ComponentRendererProps) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: (config.borderRadius as number) || 0,
      }}
    >
      {config.source ? (
        <Box
          component="img"
          src={config.source as string}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: (config.fit as string) || "cover",
            display: "block",
          }}
        />
      ) : (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px dashed rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.4)",
            fontSize: 12,
          }}
        >
          请设置图片
        </Box>
      )}
    </Box>
  );
}
