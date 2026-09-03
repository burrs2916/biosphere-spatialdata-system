import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Link as RouterLink } from "react-router-dom";
import { APP_SHORT_NAME } from "../constants/appInfo";

const linkStyle = {
  color: "primary.main",
  textDecoration: "none",
  borderBottom: "1px solid",
  borderColor: "primary.main",
};

const QUICK_START = [
  {
    title: "配置数据源",
    desc: "在「数据源」页新增并激活一个 HTTP 数据源；日志、系统日志、历史事件等功能均依赖它。",
  },
  {
    title: "浏览地图",
    desc: "在「地图浏览」查看 CAD 图纸、瓦片地图与蓝图，点击可弹出独立预览窗口。",
  },
  {
    title: "搭建监控大屏",
    desc: "在「场景编辑」中组合组件、CAD 地图与图表，搭建并发布监控场景。",
  },
  {
    title: "查看监控与记录",
    desc: "在「告警中心 / 系统日志 / 历史事件」查看设备报警、运行日志与报警归档，支持筛选与 CSV 导出。",
  },
];

const FAQ = [
  {
    q: "日志 / 历史事件提示“未配置数据源”？",
    a: (
      <>
        这些功能需要查询后端历史接口。请先在<RouterLink to="/datasource" style={linkStyle}>数据源</RouterLink>
        页配置并激活一个 HTTP 数据源，其连接地址将作为日志接口的 baseUrl。
      </>
    ),
  },
  {
    q: "告警中心 / 历史事件为什么是空的？",
    a: "报警记录来自设备经 edge-conductor 上报的报警状态变化（进入/解除）。设备未触发报警时，对应列表为空属正常。历史事件会持久化保存已产生的记录。",
  },
  {
    q: "历史事件与告警中心有什么区别？",
    a: (
      <>
        <RouterLink to="/alerts" style={linkStyle}>告警中心</RouterLink>
        聚焦当前未确认的实时告警，便于快速处置；
        <RouterLink to="/history" style={linkStyle}>历史事件</RouterLink>
        是报警“触发 / 解除”的本地归档（最近 500 条），支持按类型、设备、时间筛选与 CSV 导出，用于事后追溯。
      </>
    ),
  },
  {
    q: "系统日志与历史事件有什么不同？",
    a: (
      <>
        <RouterLink to="/logs" style={linkStyle}>系统日志</RouterLink>
        记录设备的操作、事件、系统信息与传感器数值等运行流水；
        <RouterLink to="/history" style={linkStyle}>历史事件</RouterLink>
        专门记录报警状态的进入与退出。二者数据来源不同，互补不重叠。
      </>
    ),
  },
  {
    q: "如何导出数据？",
    a: (
      <>
        <RouterLink to="/logs" style={linkStyle}>系统日志</RouterLink>与
        <RouterLink to="/history" style={linkStyle}>历史事件</RouterLink>
        页面均提供“导出 CSV”按钮，按当前筛选条件导出，便于离线分析与归档。
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <Box sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
      <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: "center" }}>
        <HelpRoundedIcon sx={{ fontSize: 40, color: "primary.main" }} />
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            帮助
          </Typography>
          <Typography variant="body2" color="text.secondary">
            快速上手与常见问题
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={2}>
        {/* 快速上手 */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            快速上手
          </Typography>
          <Stack spacing={2}>
            {QUICK_START.map((s, i) => (
              <Stack key={s.title} direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {s.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {s.desc}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Paper>

        {/* 常见问题 */}
        <Paper sx={{ p: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, p: 3, pb: 1 }}>
            常见问题
          </Typography>
          <Box>
            {FAQ.map((item, i) => (
              <Accordion key={i} disableGutters elevation={0} sx={{ borderTop: 1, borderColor: "divider" }}>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {item.q}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary">
                    {item.a}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Paper>

        <Typography variant="caption" color="text.secondary" align="center">
          使用问题请联系项目运维 · {APP_SHORT_NAME} 内部系统
        </Typography>
      </Stack>
    </Box>
  );
}
