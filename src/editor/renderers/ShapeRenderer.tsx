import Box from "@mui/material/Box";
import type { ComponentRendererProps } from "../../types/editor";

export function ShapeRenderer({ config }: ComponentRendererProps) {
  const shapeType = (config.shapeType as string) || "rect";
  const fill = (config.fill as string) || "rgba(33, 150, 243, 0.3)";
  const stroke = (config.stroke as string) || "#2196F3";
  const strokeWidth = (config.strokeWidth as number) ?? 2;
  const borderRadius = (config.borderRadius as number) || 0;

  if (shapeType === "circle") {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          backgroundColor: fill,
          border: `${strokeWidth}px solid ${stroke}`,
        }}
      />
    );
  }

  if (shapeType === "line") {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: `${strokeWidth}px`,
            backgroundColor: stroke,
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        borderRadius: `${borderRadius}px`,
        backgroundColor: fill,
        border: `${strokeWidth}px solid ${stroke}`,
      }}
    />
  );
}
