import { useMemo, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import type { ComponentRendererProps } from "../../types/editor";

interface StatusRule {
  min?: number;
  max?: number;
  color?: string;
  label?: string;
}

export function MetricRenderer({ config }: ComponentRendererProps) {
  const title = (config.title as string) || "指标名称";
  const unit = (config.unit as string) || "";
  const prefix = (config.prefix as string) || "";
  const suffix = (config.suffix as string) || "";
  const showTrend = (config.showTrend as boolean) ?? true;
  const precision = (config.precision as number) ?? 1;
  const color = (config.color as string) || "#2196F3";
  const valueColor = (config.valueColor as string) || color;
  const titleColor = (config.titleColor as string) || "rgba(255,255,255,0.5)";
  const unitColor = (config.unitColor as string) || "rgba(255,255,255,0.4)";
  const fontSize = (config.fontSize as number) || 28;
  const titleFontSize = (config.titleFontSize as number) || 11;
  const backgroundColor = (config.backgroundColor as string) || "rgba(0,0,0,0.2)";
  const borderRadius = (config.borderRadius as number) ?? 4;
  const padding = (config.padding as number) ?? 12;
  const statusRules = (config.statusRules as StatusRule[]) || [];
  const field = (config.field as string) || "";

  const boundData = (config.data as Record<string, unknown>) || {};
  const rawValue = field ? boundData[field] : config.value;
  const numericValue = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue ?? "--"));
  const isNumeric = !isNaN(numericValue);

  const prevValueRef = useRef<number | null>(null);
  const trend = useMemo(() => {
    if (!showTrend || !isNumeric) return "none";
    if (prevValueRef.current === null) return "none";
    if (numericValue > prevValueRef.current) return "up";
    if (numericValue < prevValueRef.current) return "down";
    return "flat";
  }, [showTrend, isNumeric, numericValue]);

  useEffect(() => {
    if (isNumeric) {
      prevValueRef.current = numericValue;
    }
  }, [isNumeric, numericValue]);

  const displayValue = useMemo(() => {
    if (!isNumeric) return String(rawValue ?? "--");
    return numericValue.toFixed(precision);
  }, [isNumeric, rawValue, numericValue, precision]);

  const activeStatus = useMemo(() => {
    if (!isNumeric || statusRules.length === 0) return null;
    for (const rule of statusRules) {
      const minOk = rule.min === undefined || numericValue >= rule.min;
      const maxOk = rule.max === undefined || numericValue < rule.max;
      if (minOk && maxOk) return rule;
    }
    return null;
  }, [isNumeric, numericValue, statusRules]);

  const activeColor = activeStatus?.color || valueColor;
  const trendColor = trend === "up" ? "#4CAF50" : trend === "down" ? "#F44336" : "rgba(255,255,255,0.3)";
  const TrendIcon = trend === "up" ? TrendingUpIcon : trend === "down" ? TrendingDownIcon : TrendingFlatIcon;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        p: `${padding / 8}px`,
        backgroundColor,
        borderRadius: `${borderRadius}px`,
        border: `1px solid ${activeColor}22`,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${activeColor}, ${activeColor}88)`,
          transition: "background 0.3s ease",
        }}
      />
      <Typography
        sx={{
          color: titleColor,
          mb: 0.75,
          fontSize: titleFontSize,
          letterSpacing: 0.5,
          lineHeight: 1,
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
        {prefix && (
          <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: fontSize * 0.45, lineHeight: 1 }}>
            {prefix}
          </Typography>
        )}
        <Typography
          sx={{
            fontWeight: 700,
            color: activeColor,
            lineHeight: 1,
            fontSize,
            transition: "color 0.3s ease",
          }}
        >
          {displayValue}
        </Typography>
        {unit && (
          <Typography sx={{ color: unitColor, fontSize: fontSize * 0.4, lineHeight: 1 }}>
            {unit}
          </Typography>
        )}
        {suffix && (
          <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: fontSize * 0.4, lineHeight: 1 }}>
            {suffix}
          </Typography>
        )}
        {showTrend && trend !== "none" && (
          <TrendIcon sx={{ fontSize: fontSize * 0.5, color: trendColor, ml: 0.25 }} />
        )}
      </Box>
      {activeStatus?.label && (
        <Typography sx={{ color: activeColor, fontSize: 9, mt: 0.5, opacity: 0.7 }}>
          {activeStatus.label}
        </Typography>
      )}
    </Box>
  );
}
