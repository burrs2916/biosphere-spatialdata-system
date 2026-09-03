import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import { useAlarmHistoryStore, loadAlarmPreferences, setAlarmPreferences } from "../store/alarmHistoryStore";
import { sensorMeta } from "../components/monitors/AlertMonitor";
import AlertMonitor from "../components/monitors/AlertMonitor";

const WINDOW_24H = 24 * 60 * 60 * 1000;

export default function AlertCenterPage() {
  const records = useAlarmHistoryStore((s) => s.records);
  const unreadEnterCount = useAlarmHistoryStore((s) => s.unreadEnterCount);
  const hourlyTrend24h = useAlarmHistoryStore((s) => s.hourlyTrend24h);
  const topUnreadByDevice = useAlarmHistoryStore((s) => s.topUnreadByDevice);
  const loadFromBackend = useAlarmHistoryStore((s) => s.loadFromBackend);
  const startSubscription = useAlarmHistoryStore((s) => s.startSubscription);

  // 报警提醒偏好（声音 / 系统通知）
  const [soundOn, setSoundOn] = useState(true);
  const [notifyOn, setNotifyOn] = useState(true);

  // 挂载兜底：加载持久化历史 + 确保订阅已启动 + 加载提醒偏好
  useEffect(() => {
    void loadFromBackend();
    startSubscription();
    void loadAlarmPreferences().then((p) => {
      setSoundOn(p.soundEnabled);
      setNotifyOn(p.notifyEnabled);
    });
  }, [loadFromBackend, startSubscription]);

  const handleRefresh = () => {
    void loadFromBackend();
  };

  const handleSoundChange = (v: boolean) => {
    setSoundOn(v);
    void setAlarmPreferences({ soundEnabled: v });
  };

  const handleNotifyChange = (v: boolean) => {
    setNotifyOn(v);
    void setAlarmPreferences({ notifyEnabled: v });
  };

  const stats = useMemo(() => {
    const now = Date.now();
    const enter24h = records.filter((r) => r.type === "enter" && now - r.timestamp <= WINDOW_24H);
    const severe24h = enter24h.filter(
      (r) => (sensorMeta[r.sensorType ?? "unknown"] ?? sensorMeta.unknown).severity === "error",
    ).length;
    return { total24h: enter24h.length, severe24h };
  }, [records]);

  const trend = useMemo(() => hourlyTrend24h(), [hourlyTrend24h, records]);
  const maxTrend = Math.max(1, ...trend);
  const topDevices = useMemo(() => topUnreadByDevice(5), [topUnreadByDevice, records]);

  const now = new Date();

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
            告警中心
          </Typography>
          <Chip
            size="small"
            icon={<NotificationsRoundedIcon />}
            label={unreadEnterCount > 0 ? `未确认 ${unreadEnterCount}` : "无未确认报警"}
            color={unreadEnterCount > 0 ? "error" : "success"}
          />
          <Tooltip title="刷新">
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={soundOn}
                onChange={(e) => handleSoundChange(e.target.checked)}
              />
            }
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <VolumeUpRoundedIcon fontSize="small" />
                声音
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={notifyOn}
                onChange={(e) => handleNotifyChange(e.target.checked)}
              />
            }
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <NotificationsRoundedIcon fontSize="small" />
                系统通知
              </Box>
            }
          />
        </Stack>
      </Box>

      {/* 统计概览 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              未确认报警
            </Typography>
            <Typography variant="h4" color={unreadEnterCount > 0 ? "error.main" : "text.primary"}>
              {unreadEnterCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              24h 内报警
            </Typography>
            <Typography variant="h4">{stats.total24h}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              24h 内严重
            </Typography>
            <Typography variant="h4" color={stats.severe24h > 0 ? "error.main" : "text.primary"}>
              {stats.severe24h}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* 左列：24h 趋势 + Top 报警设备 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                24 小时趋势
              </Typography>
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, height: 120 }}>
                {trend.map((count, i) => {
                  const hour = new Date(now.getTime() - (23 - i) * 3600 * 1000).getHours();
                  return (
                    <Tooltip key={i} title={`${hour}:00 · ${count} 条`}>
                      <Box
                        sx={{
                          flex: 1,
                          height: `${(count / maxTrend) * 100}%`,
                          minHeight: count > 0 ? 4 : 2,
                          bgcolor: count > 0 ? "error.main" : "divider",
                          borderRadius: 0.5,
                          opacity: i === 23 ? 1 : 0.75,
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  24h 前
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  现在
                </Typography>
              </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                Top 报警设备
              </Typography>
              {topDevices.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  暂无未确认报警设备
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {topDevices.map((d, idx) => (
                    <Box key={d.deviceId} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip
                        size="small"
                        label={idx + 1}
                        color="error"
                        sx={{ height: 20, fontSize: "0.65rem", minWidth: 24 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {d.productName || d.deviceId}
                        </Typography>
                      </Box>
                      <Chip size="small" label={`${d.count}`} sx={{ height: 20, fontSize: "0.65rem" }} />
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        </Grid>

        {/* 右列：实时告警列表（复用 AlertMonitor，默认未确认） */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AlertMonitor id="alert-center-list" title="实时告警列表" defaultAckFilter="unread" showBulkActions style={{ height: "100%" }} />
        </Grid>
      </Grid>
    </Box>
  );
}
