import Box from "@mui/material/Box";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, CHART_BOX_SX, calcFontScale, calcDevicePixelRatio } from "./echartsCore";
import { useEchartOptions } from "./useEchartOptions";
import type { ComponentRendererProps } from "../../../types/editor";

/** 自定义图表 - 完全自定义 renderItem */
export function CustomChartRenderer({ config, width, height }: ComponentRendererProps) {
  const isDark = (config.theme as string) !== "light";
  const customOption = (config.option as Record<string, unknown>) || {
    xAxis: { type: "category", data: ["A", "B", "C", "D"] },
    yAxis: { type: "value" },
    series: [{
      type: "custom",
      renderItem: (_params: unknown, api: { coord: (data: number[]) => number[]; value: () => number }) => ({
        type: "group",
        children: [{
          type: "rect",
          shape: {
            x: api.coord([0, api.value()])[0] - 10,
            y: api.coord([0, api.value()])[1],
            width: 20,
            height: 300 - api.coord([0, api.value()])[1],
          },
          style: { fill: "#00c1de" },
        }],
      }),
      data: [120, 200, 150, 80],
    }],
  };

  const scale = calcFontScale(width, height);
  const dpr = calcDevicePixelRatio(width, height);
  const option = useEchartOptions(config, customOption, scale);

  return (
    <Box sx={CHART_BOX_SX}>
      <ReactEChartsCore echarts={echarts} option={option} theme={isDark ? "industrial-dark" : undefined} notMerge lazyUpdate opts={{ devicePixelRatio: dpr }} style={{ width: "100%", height: "100%" }} />
    </Box>
  );
}
