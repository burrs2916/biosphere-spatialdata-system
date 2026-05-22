import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";

export function TextRenderer({ config }: ComponentRendererProps) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "flex-start",
        justifyContent:
          config.textAlign === "center"
            ? "center"
            : config.textAlign === "right"
              ? "flex-end"
              : "flex-start",
        p: 1,
        fontSize: (config.fontSize as number) || 16,
        fontWeight: (config.fontWeight as string) || "normal",
        color: (config.color as string) || "#ffffff",
        lineHeight: (config.lineHeight as number) || 1.5,
        overflow: "hidden",
        wordBreak: "break-word",
      }}
    >
      {(config.content as string) || "文本内容"}
    </Box>
  );
}
