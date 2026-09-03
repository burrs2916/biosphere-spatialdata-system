import Box from "@mui/material/Box";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, CHART_BOX_SX, calcFontScale, chartFontSizes, calcDevicePixelRatio } from "./echartsCore";
import { useEchartOptions } from "./useEchartOptions";
import type { ComponentRendererProps } from "../../../types/editor";

/** 地图 */
export function MapChartRenderer({ config, width, height }: ComponentRendererProps) {
  const isDark = (config.theme as string) !== "light";
  const mapName = (config.mapName as string) || "china";
  const data = (config.data as { name: string; value: number }[]) || [
    { name: "北京", value: 200 }, { name: "上海", value: 180 },
    { name: "广东", value: 150 }, { name: "四川", value: 120 },
    { name: "浙江", value: 100 },
  ];
  const roam = (config.roam as boolean) ?? true;
  const visualMapMin = (config.visualMapMin as number) ?? 0;
  const visualMapMax = (config.visualMapMax as number) ?? 200;

  const scale = calcFontScale(width, height);
  const fs = chartFontSizes(scale);
  const dpr = calcDevicePixelRatio(width, height);

  const baseOption: Record<string, unknown> = {
    visualMap: {
      min: visualMapMin, max: visualMapMax,
      left: 10, bottom: 20, text: ["高", "低"], calculable: true,
      inRange: { color: ["#50a3ba", "#eac736", "#d94e5d"] },
      textStyle: { color: isDark ? "rgba(255,255,255,0.6)" : "#666", fontSize: fs.subtitle },
    },
    geo: {
      map: mapName, roam,
      itemStyle: {
        areaColor: isDark ? "rgba(0,193,222,0.06)" : "#eee",
        borderColor: isDark ? "rgba(0,193,222,0.3)" : "#999",
        ...(isDark ? { shadowColor: "rgba(0,193,222,0.15)", shadowBlur: 6 } : {}),
      },
      emphasis: {
        itemStyle: { areaColor: "rgba(0,193,222,0.2)" },
        label: { show: true, color: "#fff", fontSize: fs.label },
      },
      label: { fontSize: fs.label },
    },
    series: [{ type: "map", map: mapName, geoIndex: 0, data }],
  };

  const option = useEchartOptions(config, baseOption, scale);

  return (
    <Box sx={CHART_BOX_SX}>
      <ReactEChartsCore echarts={echarts} option={option} theme={isDark ? "industrial-dark" : undefined} notMerge lazyUpdate opts={{ devicePixelRatio: dpr }} style={{ width: "100%", height: "100%" }} />
    </Box>
  );
}
