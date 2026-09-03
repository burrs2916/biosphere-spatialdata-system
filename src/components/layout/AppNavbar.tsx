import { styled, alpha } from "@mui/material/styles";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import InputBase from "@mui/material/InputBase";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import Popover from "@mui/material/Popover";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useAlarmHistoryStore, type AlarmRecord } from "../../store/alarmHistoryStore";
import { useDeviceStore } from "../../store/deviceStore";
import { useLayoutStore } from "../../store/layoutStore";
// 复用告警中心的 sensorType 语义（label + severity 单一来源，与 AlertMonitor 一致）
import { sensorMeta, type AlertSeverity } from "../monitors/AlertMonitor";
// AI 助手抽屉（features/agent，纯新增功能）
import { AiAssistantDrawer, useAgentStore } from "../../features/agent";

const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.black, 0.05),
  "&:hover": {
    backgroundColor: alpha(theme.palette.common.black, 0.1),
  },
  marginRight: theme.spacing(2),
  marginLeft: theme.spacing(1),
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    width: "auto",
  },
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("md")]: {
      width: "20ch",
    },
  },
}));

interface AppNavbarProps {
  onSettingsClick?: () => void;
}

// 通知中心：severity → 图标/配色（label 复用告警中心 sensorMeta，不再本地重复维护）
const SEVERITY_UI: Record<
  AlertSeverity,
  { Icon: typeof ErrorRoundedIcon; color: string }
> = {
  error: { Icon: ErrorRoundedIcon, color: "error.main" },
  warning: { Icon: WarningRoundedIcon, color: "warning.main" },
  info: { Icon: InfoRoundedIcon, color: "info.main" },
  success: { Icon: CheckCircleRoundedIcon, color: "success.main" },
};

export default function AppNavbar(props: AppNavbarProps) {
  const { onSettingsClick } = props;
  const { config: layoutConfig, toggleSidebar } = useLayoutStore();
  const sidebarCollapsed = layoutConfig.sidebarCollapsed;

  const navigate = useNavigate();
  const records = useAlarmHistoryStore((s) => s.records);
  const acknowledge = useAlarmHistoryStore((s) => s.acknowledge);
  const acknowledgeAll = useAlarmHistoryStore((s) => s.acknowledgeAll);
  const devices = useDeviceStore((s) => s.devices);

  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);
  const notifOpen = Boolean(notifAnchor);
  // AI 助手抽屉（开关状态提升到 agentStore，便于系统日志页「AI 辅助整理」唤起）
  const aiOpen = useAgentStore((s) => s.drawerOpen);

  // 通知 = 未确认的 enter 报警（与历史事件/告警中心同源）
  const unread = useMemo(
    () => records.filter((r) => r.type === "enter" && !r.acknowledged),
    [records],
  );
  const unreadCount = unread.length;
  const unreadPreview = unread.slice(0, 8);

  // 报警是否仍在持续：同设备存在更晚的 leave 记录即视为已恢复（leave 与 enter 同源配对）
  const ongoingIds = useMemo(() => {
    const leaves = records.filter((x) => x.type === "leave");
    const set = new Set<string>();
    for (const r of records) {
      if (r.type !== "enter") continue;
      const recovered = leaves.some((l) => l.deviceId === r.deviceId && l.timestamp >= r.timestamp);
      if (!recovered) set.add(r.id);
    }
    return set;
  }, [records]);

  const openNotif = (e: MouseEvent<HTMLElement>) => setNotifAnchor(e.currentTarget);
  const closeNotif = () => setNotifAnchor(null);
  // 单条确认：仅标记已读（从未读列表消失），不关闭弹窗、不跳转——杜绝"点一下就没了+被扔到别的页"
  const handleAckOne = (id: string) => {
    acknowledge(id);
  };
  // 查看全部 → 告警中心（未确认报警的归属地，而非历史事件页）
  const handleViewAll = () => {
    closeNotif();
    navigate("/alerts");
  };

  const deviceNameOf = (r: AlarmRecord) =>
    r.productName || r.productCode || r.deviceId;
  // 位置链：设备 → 所属分控/集控器名（deviceStore 反查，缺省不显示）
  const locationOf = (r: AlarmRecord) => {
    const d = devices[r.deviceId];
    if (!d) return "";
    const parent = devices[String(d.parentDeviceId ?? "")];
    return parent?.productName ?? "";
  };
  const formatNotifTime = (t: number) => {
    const d = new Date(t);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  // 相对时间：新报警一眼感知"多久前"，绝对时间放 title
  const formatRelative = (t: number) => {
    const diff = Date.now() - t;
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return formatNotifTime(t);
  };

  const handleFullscreen = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();
      const fullscreen = await currentWindow.isFullscreen();
      await currentWindow.setFullscreen(!fullscreen);
    } catch {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    }
  };

  return (
    <AppBar
      position="sticky"
      sx={{
        flexShrink: 0,
        backgroundColor: "background.paper",
        color: "text.primary",
        boxShadow: "none",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar>
        <Tooltip title={sidebarCollapsed ? "展开菜单" : "收起菜单"}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={toggleSidebar}
            sx={{ mr: 1 }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Tooltip>

        <Search>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="搜索..."
            inputProps={{ "aria-label": "search" }}
          />
        </Search>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
          <Tooltip title="AI 助手">
            <IconButton color="inherit" onClick={() => useAgentStore.getState().openDrawer()}>
              <SmartToyRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="全屏">
            <IconButton color="inherit" onClick={handleFullscreen}>
              <FullscreenRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={unreadCount > 0 ? `通知（${unreadCount} 条未读）` : "通知"}>
            <IconButton
              size="large"
              aria-label="show notifications"
              color="inherit"
              onClick={openNotif}
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="设置">
            <IconButton
              color="inherit"
              onClick={() => onSettingsClick?.()}
            >
              <SettingsRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Popover
          open={notifOpen}
          anchorEl={notifAnchor}
          onClose={closeNotif}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { width: 340, maxHeight: 460 } } }}
        >
          <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              通知
              {unreadCount > 0 && (
                <Typography component="span" variant="caption" sx={{ ml: 0.5, color: "error.main" }}>
                  {unreadCount} 条未读
                </Typography>
              )}
            </Typography>
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              disabled={unreadCount === 0}
              onClick={() => {
                acknowledgeAll();
                closeNotif();
              }}
            >
              全部已读
            </Button>
          </Box>
          <Divider />
          {unreadPreview.length === 0 ? (
            <Typography variant="body2" sx={{ px: 2, py: 4, textAlign: "center", color: "text.secondary" }}>
              暂无未读通知
            </Typography>
          ) : (
            <List sx={{ py: 0, maxHeight: 340, overflow: "auto" }}>
              {unreadPreview.map((r) => {
                const meta = sensorMeta[r.sensorType ?? "unknown"];
                const sev = SEVERITY_UI[meta.severity];
                const ongoing = ongoingIds.has(r.id);
                const location = locationOf(r);
                return (
                  <ListItemButton
                    key={r.id}
                    onClick={() => {
                      closeNotif();
                      navigate("/alerts");
                    }}
                    sx={{
                      py: 1,
      alignItems: "flex-start",
                      // 单条确认按钮：hover 行时浮现
                      "& .notif-ack": { opacity: 0, transition: "opacity 0.15s" },
                      "&:hover .notif-ack": { opacity: 1 },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 30, mt: 0.25 }}>
                      <Tooltip title={sev === SEVERITY_UI.error ? "严重" : sev === SEVERITY_UI.warning ? "警告" : "提示"}>
                        <sev.Icon sx={{ fontSize: 18, color: sev.color }} />
                      </Tooltip>
                    </ListItemIcon>
                    <ListItemText
                      primary={`${meta.label} · ${deviceNameOf(r)}`}
                      slotProps={{
                        primary: { noWrap: true, variant: "body2", sx: { fontWeight: 600 } },
                        secondary: {
                          variant: "caption",
                          title: formatNotifTime(r.timestamp),
                        },
                      }}
                      secondary={
                        [location, formatRelative(r.timestamp)].filter(Boolean).join(" · ") || formatRelative(r.timestamp)
                      }
                    />
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 0.25,
                        ml: 1,
                        alignSelf: "center",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 10,
                          px: 0.75,
                          py: 0.1,
                          borderRadius: 2,
                          fontWeight: 600,
                          color: ongoing ? "error.main" : "success.main",
                          bgcolor: ongoing ? "rgba(239,68,68,0.1)" : "rgba(60,203,127,0.12)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ongoing ? "持续中" : "已恢复"}
                      </Typography>
                      <Tooltip title="标记已读">
                        <IconButton
                          className="notif-ack"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAckOne(r.id);
                          }}
                          sx={{ p: 0.25 }}
                        >
                          <DoneRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemButton>
                );
              })}
            </List>
          )}
          <Divider />
          {unreadCount > unreadPreview.length && (
            <Typography
              variant="caption"
              sx={{ display: "block", px: 2, py: 0.75, textAlign: "center", color: "text.secondary" }}
            >
              还有 {unreadCount - unreadPreview.length} 条未读未显示
            </Typography>
          )}
          <Box sx={{ p: 1 }}>
            <Button fullWidth size="small" onClick={handleViewAll}>
              查看全部（告警中心）
            </Button>
          </Box>
        </Popover>

        {/* AI 助手抽屉 */}
        <AiAssistantDrawer open={aiOpen} onClose={() => useAgentStore.getState().closeDrawer()} />
      </Toolbar>
    </AppBar>
  );
}
