import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import type { ComponentRendererProps } from "../../types/editor";

export function MetricRenderer({ config }: ComponentRendererProps) {
  const title = (config.title as string) || "指标名称";
  const value = (config.value as string) ?? "--";
  const unit = (config.unit as string) || "";
  const trend = (config.trend as string) || "none";
  const color = (config.color as string) || "#2196F3";

  const trendColor = trend === "up" ? "#4CAF50" : trend === "down" ? "#F44336" : "rgba(255,255,255,0.4)";
  const TrendIcon =
    trend === "up"
      ? TrendingUpIcon
      : trend === "down"
        ? TrendingDownIcon
        : TrendingFlatIcon;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        p: 1.5,
        backgroundColor: "rgba(0,0,0,0.2)",
        borderRadius: 1,
        border: `1px solid ${color}22`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
        }}
      />
      <Typography
        variant="caption"
        sx={{ color: "rgba(255,255,255,0.5)", mb: 0.75, fontSize: 11, letterSpacing: 0.5 }}
      >
        {title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color, lineHeight: 1, fontSize: { xs: 22, sm: 28 } }}
        >
          {value}
        </Typography>
        {unit && (
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            {unit}
          </Typography>
        )}
        {trend !== "none" && (
          <TrendIcon
            sx={{
              fontSize: 18,
              color: trendColor,
            }}
          />
        )}
      </Box>
    </Box>
  );
}
