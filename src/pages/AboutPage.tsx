import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ExtensionRoundedIcon from "@mui/icons-material/ExtensionRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import {
  APP_NAME,
  APP_VERSION,
  APP_DESCRIPTION,
  APP_TECH,
  APP_SHORT_NAME,
} from "../constants/appInfo";

interface Feature {
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const FEATURES: Feature[] = [
  { title: "实时态势监控", desc: "告警、通信概览、粉尘浓度等实时态势一屏掌握", icon: <DashboardRoundedIcon /> },
  { title: "地图浏览与预览", desc: "CAD 图纸、瓦片地图、蓝图浏览与独立预览窗口", icon: <MapRoundedIcon /> },
  { title: "场景组态与发布", desc: "拖拽组件搭建监控大屏并发布管理", icon: <LayersRoundedIcon /> },
  { title: "数据源管理", desc: "配置并激活 HTTP 数据源与设备适配器", icon: <StorageRoundedIcon /> },
  { title: "告警中心", desc: "实时告警确认、归档与声音/系统通知", icon: <WarningRoundedIcon /> },
  { title: "系统日志", desc: "操作 / 事件 / 系统 / 传感器运行日志", icon: <ArticleRoundedIcon /> },
  { title: "历史事件", desc: "报警触发 / 解除本地归档，可追溯导出", icon: <HistoryRoundedIcon /> },
  { title: "组件与图库", desc: "组件库与地图图库统一管理复用", icon: <ExtensionRoundedIcon /> },
];

export default function AboutPage() {
  return (
    <Box sx={{ width: "100%", maxWidth: 960, mx: "auto" }}>
      {/* Hero */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          mb: 3,
          color: "primary.contrastText",
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          borderRadius: 2,
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { sm: "center" } }}>
          <Avatar sx={{ width: 64, height: 64, bgcolor: "rgba(255,255,255,0.18)", color: "inherit" }}>
            <HubRoundedIcon sx={{ fontSize: 36 }} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              {APP_NAME}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
              <Chip
                label={`版本 v${APP_VERSION}`}
                size="small"
                sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "inherit", fontWeight: 600 }}
              />
              <Chip
                label="桌面端应用"
                size="small"
                variant="outlined"
                sx={{ borderColor: "rgba(255,255,255,0.5)", color: "inherit" }}
              />
            </Stack>
          </Box>
        </Stack>
        <Typography variant="body1" sx={{ mt: 2, opacity: 0.92 }}>
          {APP_DESCRIPTION}
        </Typography>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* 系统信息 */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              系统信息
            </Typography>

            {/* 当前版本 */}
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="overline"
                sx={{ display: "block", color: "text.secondary", letterSpacing: 1, lineHeight: 1 }}
              >
                当前版本
              </Typography>
              <Typography
                variant="h3"
                sx={{ fontWeight: 800, color: "primary.main", lineHeight: 1.1, mt: 0.5 }}
              >
                v{APP_VERSION}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* 技术架构 */}
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="overline"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  letterSpacing: 1,
                  lineHeight: 1,
                  mb: 1.5,
                }}
              >
                技术架构
              </Typography>
              <Stack spacing={1.25}>
                {APP_TECH.map((t) => (
                  <Box key={t} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Box
                      component="span"
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {t}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* 数据来源 */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, height: "100%" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              数据来源
            </Typography>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", gap: 1.5 }}>
                <Avatar variant="rounded" sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
                  <DashboardRoundedIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    实时数据
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    由 edge-conductor 经 WebSocket 推送至设备层，驱动仪表盘与场景实时监控。
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: 1.5 }}>
                <Avatar variant="rounded" sx={{ bgcolor: "secondary.main", width: 40, height: 40 }}>
                  <StorageRoundedIcon />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    日志与历史
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    查询在「数据源」中已激活的 HTTP 数据源（操作 / 事件 / 系统 / 传感器 / 报警归档）。
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* 核心能力 */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        核心能力
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {FEATURES.map((f) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={f.title}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                height: "100%",
                transition: "border-color 0.2s, box-shadow 0.2s",
                "&:hover": { borderColor: "primary.main", boxShadow: 2 },
              }}
            >
              <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, mb: 1.5 }}>
                {f.icon}
              </Avatar>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                {f.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {f.desc}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" align="center" sx={{ display: "block" }}>
        内部系统 · 数据涉密，请勿外传 · © {new Date().getFullYear()} {APP_SHORT_NAME}
      </Typography>
    </Box>
  );
}
