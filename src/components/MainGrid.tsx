import { useNavigate } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import { MetricWidget } from "./widgets";
import type { MetricWidgetProps } from "./widgets";
import { LineChartWidget, BarChartWidget, PieChartWidget } from "./widgets/ChartWidget";
import { MapView } from "./spatial";
import { AlertMonitor, DataSourceStatusCard } from "./monitors";
import type { SpatialLayerConfig } from "../types/spatial";

const statData: MetricWidgetProps[] = [
  {
    id: "stat-nodes",
    title: "数据节点",
    value: "1,284",
    interval: "最近 30 天",
    trend: "up",
    data: [
      200, 24, 220, 260, 240, 380, 100, 240, 280, 240, 300, 340, 320, 360, 340,
      380, 360, 400, 380, 420, 400, 640, 340, 460, 440, 480, 460, 600, 880, 920,
    ],
  },
  {
    id: "stat-queries",
    title: "空间查询",
    value: "32.5K",
    interval: "最近 30 天",
    trend: "up",
    data: [
      1640, 1250, 970, 1130, 1050, 900, 720, 1080, 900, 450, 920, 820, 840, 600,
      820, 780, 800, 760, 380, 740, 660, 620, 840, 500, 520, 480, 400, 360, 300,
      220,
    ],
  },
  {
    id: "stat-storage",
    title: "存储容量",
    value: "2.4TB",
    interval: "最近 30 天",
    trend: "neutral",
    data: [
      500, 400, 510, 530, 520, 600, 530, 520, 510, 730, 520, 510, 530, 620, 510,
      530, 520, 410, 530, 520, 610, 530, 520, 610, 530, 420, 510, 430, 520, 510,
    ],
  },
  {
    id: "stat-users",
    title: "活跃用户",
    value: "456",
    interval: "最近 30 天",
    trend: "down",
    data: [
      300, 280, 320, 340, 320, 380, 300, 320, 340, 320, 360, 340, 380, 360, 340,
      380, 360, 400, 380, 420, 400, 440, 380, 400, 380, 420, 400, 440, 420, 460,
    ],
  },
];

const lineChartData = {
  xAxis: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"],
  series: [
    {
      name: "查询量",
      data: [120, 280, 450, 380, 520, 410, 320],
    },
    {
      name: "写入量",
      data: [80, 150, 280, 220, 350, 280, 180],
    },
  ],
};

const pieChartData = [
  { name: "矢量数据", value: 12500 },
  { name: "栅格数据", value: 8900 },
  { name: "点云数据", value: 5600 },
  { name: "影像数据", value: 4200 },
];

const barChartData = [
  { label: "北京", value: 4520 },
  { label: "上海", value: 3890 },
  { label: "广州", value: 3240 },
  { label: "深圳", value: 2980 },
  { label: "杭州", value: 2150 },
];

const defaultLayers: SpatialLayerConfig[] = [
  {
    id: "layer-base",
    name: "底图",
    type: "tile",
    dimension: "2d",
    source: {
      type: "tile",
      urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      minZoom: 0,
      maxZoom: 18,
    },
    visible: true,
    zIndex: 0,
    opacity: 1,
  },
  {
    id: "layer-vector",
    name: "矢量标注",
    type: "vector",
    dimension: "2d",
    source: {
      type: "vector",
      url: "/data/markers.json",
      crs: "EPSG:4326",
    },
    visible: true,
    zIndex: 1,
    opacity: 0.9,
  },
  {
    id: "layer-devices",
    name: "设备点位",
    type: "devices",
    dimension: "2d",
    source: {
      type: "devices",
      url: "/api/devices/positions",
      refreshInterval: 5000,
    },
    visible: true,
    zIndex: 2,
    opacity: 1,
  },
  {
    id: "layer-3d-model",
    name: "建筑模型",
    type: "3dtiles",
    dimension: "3d",
    source: {
      type: "3dtiles",
      url: "/data/buildings/3dtiles.json",
    },
    visible: false,
    zIndex: 3,
    opacity: 0.8,
  },
  {
    id: "layer-heatmap",
    name: "热力分布",
    type: "heatmap",
    dimension: "2d",
    source: {
      type: "heatmap",
      url: "/api/heatmap/data",
    },
    visible: false,
    zIndex: 4,
    opacity: 0.6,
  },
];

function QuickActionCard({
  title,
  description,
  icon,
  path,
  tag,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  tag?: string;
}) {
  const navigate = useNavigate();

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: (theme) =>
            theme.vars
              ? `0 4px 20px rgba(${theme.vars.palette.primary.mainChannel} / 0.12)`
              : "0 4px 20px rgba(0,0,0,0.06)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <CardActionArea onClick={() => navigate(path)} sx={{ height: "100%" }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "primary.main",
                color: "primary.contrastText",
              }}
            >
              {icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
            </Box>
            {tag && (
              <Chip size="small" label={tag} color="primary" variant="outlined" sx={{ height: 20, fontSize: "0.6rem" }} />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function MainGrid() {
  const navigate = useNavigate();

  return (
    <Box sx={{ width: "100%", maxWidth: { sm: "100%", md: "1700px" } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
            空间数据仪表盘
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            实时监控空间数据系统运行状态
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="新建场景">
            <IconButton
              size="small"
              color="primary"
              onClick={() => navigate("/scene")}
              sx={{
                border: "1px dashed",
                borderColor: "primary.main",
                borderRadius: 1,
              }}
            >
              <AddRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={2} columns={12} sx={{ mb: 3 }}>
        {statData.map((card) => (
          <Grid key={card.id} size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetricWidget {...card} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} columns={12} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <QuickActionCard
            title="场景编辑器"
            description="创建和编辑空间场景，管理2D/3D图层"
            icon={<LayersRoundedIcon sx={{ fontSize: 20 }} />}
            path="/scene"
            tag="核心"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <QuickActionCard
            title="地图浏览"
            description="浏览和管理地图数据，切换坐标系"
            icon={<MapRoundedIcon sx={{ fontSize: 20 }} />}
            path="/maps"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <QuickActionCard
            title="数据源管理"
            description="配置和管理空间数据源连接"
            icon={<StorageRoundedIcon sx={{ fontSize: 20 }} />}
            path="/datasource"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <DataSourceStatusCard id="ds-status" />
        </Grid>
      </Grid>

      <Typography component="h2" variant="h6" sx={{ mb: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
        <MapRoundedIcon fontSize="small" />
        场景预览
      </Typography>
      <Grid container spacing={2} columns={12} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <MapView
            id="map-preview"
            title="主场景"
            coordinateSystem="EPSG:3857"
            layers={defaultLayers}
            camera={{
              center: { x: 116.397, y: 39.908 },
              zoom: 100,
              pitch: 0,
              bearing: 0,
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <AlertMonitor id="alert-monitor" />
        </Grid>
      </Grid>

      <Typography component="h2" variant="h6" sx={{ mb: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
        <DashboardRoundedIcon fontSize="small" />
        数据分析
      </Typography>
      <Grid container spacing={2} columns={12}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%", p: 1 }}>
            <LineChartWidget
              id="chart-line"
              title="数据流量趋势"
              data={lineChartData}
              height={300}
            />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card variant="outlined" sx={{ height: "100%", p: 1 }}>
            <PieChartWidget
              id="chart-pie"
              title="数据类型分布"
              data={pieChartData}
              height={300}
            />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card variant="outlined" sx={{ height: "100%", p: 1 }}>
            <BarChartWidget
              id="chart-bar"
              title="城市数据分布"
              data={barChartData}
              height={300}
            />
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
