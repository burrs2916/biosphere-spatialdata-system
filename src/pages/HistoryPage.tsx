import { useEffect, useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useAlarmHistoryStore, type AlarmRecord } from "../store/alarmHistoryStore";
import { sensorMeta } from "../components/monitors/AlertMonitor";
import { useDeviceStore } from "../store/deviceStore";
import { formatTimestamp, toDateTimeLocalValue, fromDateTimeLocalValue, recentTimeRange, queryDashboardStats, type DashboardStats } from "../services/historyApi";

type SensorType = NonNullable<AlarmRecord["sensorType"]>;

const SENSOR_TYPE_OPTIONS: { value: SensorType | "all"; label: string }[] = [
  { value: "all", label: "全部类型" },
  ...(Object.keys(sensorMeta) as SensorType[]).map((k) => ({
    value: k,
    label: sensorMeta[k].label,
  })),
];

const EVENT_TYPE_OPTIONS = [
  { value: "all", label: "全部事件" },
  { value: "enter", label: "报警触发" },
  { value: "leave", label: "报警解除" },
];

const ACK_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "unread", label: "未确认" },
  { value: "acknowledged", label: "已确认" },
];

const QUICK_RANGES = [
  { label: "1小时", hours: 1 },
  { label: "6小时", hours: 6 },
  { label: "24小时", hours: 24 },
  { label: "7天", hours: 24 * 7 },
];

const PAGE_SIZE = 20;

function pickStep(hours: number): string {
  if (hours <= 3) return "5m";
  if (hours <= 12) return "30m";
  if (hours <= 48) return "1h";
  return "1d";
}

function sensorLabel(type?: SensorType): string {
  return type ? (sensorMeta[type]?.label ?? type) : "未知报警";
}

function sensorColor(type?: SensorType): "error" | "warning" | "info" | "default" {
  const sev = type ? sensorMeta[type]?.severity : "info";
  return sev === "error" ? "error" : sev === "warning" ? "warning" : "info";
}

function deviceNameOf(rec: AlarmRecord, nameById: Map<string, string>): string {
  return rec.productName || rec.productCode || nameById.get(rec.deviceId) || rec.deviceId;
}

function downloadCsv(rows: AlarmRecord[], nameById: Map<string, string>): void {
  const header = ["时间", "设备ID", "设备名称", "报警类型", "事件", "确认状态"];
  const lines = rows.map((r) => [
    formatTimestamp(r.timestamp),
    r.deviceId,
    deviceNameOf(r, nameById),
    sensorLabel(r.sensorType),
    r.type === "enter" ? "报警触发" : "报警解除",
    r.acknowledged ? "已确认" : "未确认",
  ]);
  const csv = [header, ...lines]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  // BOM 保证 Excel 中文不乱码
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `alarm-history-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const records = useAlarmHistoryStore((s) => s.records);
  const acknowledge = useAlarmHistoryStore((s) => s.acknowledge);
  const acknowledgeAll = useAlarmHistoryStore((s) => s.acknowledgeAll);
  const clear = useAlarmHistoryStore((s) => s.clear);
  const startSubscription = useAlarmHistoryStore((s) => s.startSubscription);
  const loadFromBackend = useAlarmHistoryStore((s) => s.loadFromBackend);

  const devices = useDeviceStore((s) => s.devices);

  const [sensorType, setSensorType] = useState<SensorType | "all">("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [eventType, setEventType] = useState<"all" | "enter" | "leave">("all");
  const [ackFilter, setAckFilter] = useState<"all" | "unread" | "acknowledged">("all");
  const [timeRange, setTimeRange] = useState(() => recentTimeRange(24));
  const [page, setPage] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);

  // 边缘计算端实时聚合统计（GreptimeDB，真实无限）
  const [dash, setDash] = useState<DashboardStats | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  // 当前时间范围跨度（小时），用于选择趋势聚合步长
  const rangeHours = useMemo(() => {
    const span = Date.parse(timeRange.to) - Date.parse(timeRange.from);
    return Math.max(0.05, span / 3_600_000);
  }, [timeRange]);

  // 加载边缘聚合统计：失败优雅降级（未配置数据源 / GreptimeDB 未就绪不崩）
  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    setDashError(null);
    try {
      const data = await queryDashboardStats({
        from: timeRange.from,
        to: timeRange.to,
        step: pickStep(rangeHours),
      });
      setDash(data);
    } catch (err) {
      setDashError(err instanceof Error ? err.message : String(err));
      setDash(null);
    } finally {
      setDashLoading(false);
    }
  }, [timeRange.from, timeRange.to, rangeHours]);

  // 挂载：确保订阅启动 + 加载持久化历史（幂等）
  useEffect(() => {
    startSubscription();
    if (useAlarmHistoryStore.getState().records.length === 0) {
      void loadFromBackend();
    }
  }, [startSubscription, loadFromBackend]);

  // 边缘聚合统计：挂载 + 时间范围变化时刷新
  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // 设备下拉选项：deviceStore 设备 + 历史记录中出现过的设备
  const deviceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of Object.values(devices)) {
      map.set(d.deviceId, d.productName || d.deviceId);
    }
    for (const r of records) {
      if (!map.has(r.deviceId)) map.set(r.deviceId, r.deviceId);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [devices, records]);

  const nameById = useMemo(
    () => new Map(deviceOptions.map((o) => [o.id, o.name])),
    [deviceOptions],
  );

  const stats = useMemo(() => {
    let enter = 0;
    let unread = 0;
    for (const r of records) {
      if (r.type === "enter") {
        enter += 1;
        if (!r.acknowledged) unread += 1;
      }
    }
    return { total: records.length, enter, unread };
  }, [records]);

  const filtered = useMemo(() => {
    const from = Date.parse(timeRange.from);
    const to = Date.parse(timeRange.to);
    return records
      .filter((r) => (sensorType === "all" ? true : r.sensorType === sensorType))
      .filter((r) => (deviceFilter === "all" ? true : r.deviceId === deviceFilter))
      .filter((r) => (eventType === "all" ? true : r.type === eventType))
      .filter((r) =>
        ackFilter === "all" ? true : ackFilter === "unread" ? !r.acknowledged : r.acknowledged,
      )
      .filter((r) => {
        const t = r.timestamp;
        return t >= from && t <= to;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [records, sensorType, deviceFilter, eventType, ackFilter, timeRange]);

  // 本地归档明细分析（基于 filtered，随筛选实时变化）
  const localAnalysis = useMemo(() => {
    const byType = new Map<SensorType | "unknown", number>();
    let ack = 0;
    for (const r of filtered) {
      const t = r.sensorType ?? "unknown";
      byType.set(t, (byType.get(t) ?? 0) + 1);
      if (r.acknowledged) ack += 1;
    }
    const ackRate = filtered.length > 0 ? (ack / filtered.length) * 100 : 0;
    // 平均持续时长：按设备配对「触发(enter)→解除(leave)」
    const durations: number[] = [];
    const openByDevice = new Map<string, number>();
    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
    for (const r of sorted) {
      if (r.type === "enter") {
        openByDevice.set(r.deviceId, r.timestamp);
      } else if (r.type === "leave") {
        const start = openByDevice.get(r.deviceId);
        if (start !== undefined) {
          durations.push(r.timestamp - start);
          openByDevice.delete(r.deviceId);
        }
      }
    }
    const avgDurationMin = durations.length > 0
      ? durations.reduce((s, d) => s + d, 0) / durations.length / 60_000
      : 0;
    return {
      byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]),
      ackCount: ack,
      ackRate,
      avgDurationMin,
      pairedCount: durations.length,
    };
  }, [filtered]);

  // 边缘趋势按时间桶聚合（跨 event_type 求和）
  const dashTrendBuckets = useMemo(() => {
    if (!dash) return [];
    const map = new Map<string, number>();
    for (const p of dash.trend) {
      map.set(p.ts, (map.get(p.ts) ?? 0) + p.count);
    }
    return Array.from(map.entries())
      .map(([ts, count]) => ({ ts, count }))
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }, [dash]);

  // 筛选条件变化重置分页
  useEffect(() => {
    setPage(0);
  }, [sensorType, deviceFilter, eventType, ackFilter, timeRange]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handleQuickRange = (hours: number) => {
    setTimeRange(recentTimeRange(hours));
  };

  const handleExport = () => {
    downloadCsv(filtered, nameById);
  };

  const handleRefresh = () => {
    void loadFromBackend();
    void loadDashboard();
  };

  const handleClearConfirm = () => {
    clear();
    setClearOpen(false);
    setPage(0);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          历史事件
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="刷新">
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshRoundedIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArticleRoundedIcon />}
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            导出 CSV
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="warning"
            startIcon={<DoneAllRoundedIcon />}
            onClick={() => acknowledgeAll()}
            disabled={stats.unread === 0}
          >
            全部确认
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={() => setClearOpen(true)}
            disabled={records.length === 0}
          >
            清空
          </Button>
        </Stack>
      </Box>

      {/* 统计概览 */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "总事件", value: stats.total, color: "primary" },
          { label: "报警触发", value: stats.enter, color: "error" },
          { label: "未确认", value: stats.unread, color: "warning" },
        ].map((c) => (
          <Paper key={c.label} sx={{ p: 2, flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {c.label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: `${c.color}.main`, lineHeight: 1.2 }}>
              {c.value}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1.5, mb: 3 }}>
        本地归档：最多保留最近 500 条报警事件（进入 / 解除），超出后自动滚动丢弃，不依赖后端。
      </Typography>

      {/* 筛选栏 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" }, flexWrap: "wrap" }}>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
            {QUICK_RANGES.map((r) => (
              <Chip
                key={r.hours}
                label={r.label}
                size="small"
                clickable
                onClick={() => handleQuickRange(r.hours)}
                sx={{ height: 32 }}
              />
            ))}
          </Stack>
          <TextField
            label="开始时间"
            type="datetime-local"
            size="small"
            value={toDateTimeLocalValue(timeRange.from)}
            onChange={(e) => {
              const v = fromDateTimeLocalValue(e.target.value);
              if (v) setTimeRange((t) => ({ ...t, from: v }));
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="结束时间"
            type="datetime-local"
            size="small"
            value={toDateTimeLocalValue(timeRange.to)}
            onChange={(e) => {
              const v = fromDateTimeLocalValue(e.target.value);
              if (v) setTimeRange((t) => ({ ...t, to: v }));
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="报警类型"
            size="small"
            select
            sx={{ minWidth: 130 }}
            value={sensorType}
            onChange={(e) => setSensorType(e.target.value as SensorType | "all")}
          >
            {SENSOR_TYPE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="设备"
            size="small"
            select
            sx={{ minWidth: 160 }}
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
          >
            <MenuItem value="all">
              <em>全部设备</em>
            </MenuItem>
            {deviceOptions.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="事件"
            size="small"
            select
            sx={{ minWidth: 120 }}
            value={eventType}
            onChange={(e) => setEventType(e.target.value as "all" | "enter" | "leave")}
          >
            {EVENT_TYPE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="确认状态"
            size="small"
            select
            sx={{ minWidth: 120 }}
            value={ackFilter}
            onChange={(e) => setAckFilter(e.target.value as "all" | "unread" | "acknowledged")}
          >
            {ACK_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {/* 统计分析 */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            统计分析
          </Typography>
          {dashLoading && (
            <Typography variant="caption" color="text.secondary">
              边缘数据加载中…
            </Typography>
          )}
        </Stack>

        {/* 边缘计算端实时聚合 */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              边缘计算端 · 实时聚合
            </Typography>
            <Chip size="small" label="GreptimeDB" variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            数据来自边缘端时序库聚合，覆盖全部历史（不限于本地 500 条归档），随上方时间范围实时刷新。
          </Typography>

          {dashError ? (
            <Alert severity="info">{dashError}</Alert>
          ) : dash ? (
            <>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {[
                  { label: "总事件", value: dash.summary.total_events, color: "primary" },
                  { label: "故障事件", value: dash.summary.fault_events, color: "error" },
                  { label: "在线传感器", value: dash.summary.total_sensors, color: "success" },
                  {
                    label: "平均在线率",
                    value: `${(dash.summary.avg_online_rate * 100).toFixed(1)}%`,
                    color: "info",
                  },
                ].map((c) => (
                  <Grid size={{ xs: 6, sm: 3 }} key={c.label}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                      <Typography variant="caption" color="text.secondary">
                        {c.label}
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{ fontWeight: 700, color: `${c.color}.main`, lineHeight: 1.2 }}
                      >
                        {c.value}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      时间趋势（事件量 / 时间桶）
                    </Typography>
                    {dashTrendBuckets.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        该时间范围内无事件
                      </Typography>
                    ) : (
                      (() => {
                        const max = Math.max(1, ...dashTrendBuckets.map((b) => b.count));
                        return (
                          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, height: 140 }}>
                            {dashTrendBuckets.map((b) => (
                              <Tooltip key={b.ts} title={`${formatTimestamp(b.ts)} · ${b.count} 条`}>
                                <Box
                                  sx={{
                                    flex: 1,
                                    height: `${(b.count / max) * 100}%`,
                                    minHeight: b.count > 0 ? 4 : 2,
                                    bgcolor: b.count > 0 ? "primary.main" : "divider",
                                    borderRadius: 0.5,
                                    opacity: 0.85,
                                  }}
                                />
                              </Tooltip>
                            ))}
                          </Box>
                        );
                      })()
                    )}
                  </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      Top 故障设备
                    </Typography>
                    {dash.fault_top.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        该时间范围内无故障设备
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {dash.fault_top.slice(0, 6).map((d, idx) => (
                          <Box key={d.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Chip
                              size="small"
                              label={idx + 1}
                              color="error"
                              sx={{ height: 20, fontSize: "0.65rem", minWidth: 24 }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap>
                                {d.key}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={`${d.count}`}
                              sx={{ height: 20, fontSize: "0.65rem" }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </>
          ) : (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Paper>

        {/* 本地归档明细分析 */}
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              本地归档 · 报警明细分析
            </Typography>
            <Chip size="small" label={`${filtered.length} 条`} variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            基于当前筛选条件下的本地报警归档（最多 500 条），含类型分布、确认率与平均持续时长。
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  报警类型分布
                </Typography>
                {localAnalysis.byType.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    无数据
                  </Typography>
                ) : (
                  <Stack spacing={1.25}>
                    {localAnalysis.byType.map(([t, count]) => {
                      const st = t === "unknown" ? undefined : (t as SensorType);
                      const label = sensorLabel(st);
                      const color = sensorColor(st);
                      const pct = filtered.length > 0 ? (count / filtered.length) * 100 : 0;
                      return (
                        <Box key={t}>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Chip
                              size="small"
                              label={label}
                              color={color}
                              sx={{ height: 20, fontSize: "0.65rem" }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {count} 条
                            </Typography>
                          </Box>
                          <Box sx={{ height: 6, bgcolor: "divider", borderRadius: 1, mt: 0.5 }}>
                            <Box
                              sx={{
                                height: "100%",
                                width: `${pct}%`,
                                bgcolor: `${color}.main`,
                                borderRadius: 1,
                              }}
                            />
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  确认率
                </Typography>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      color: localAnalysis.ackRate === 100 ? "success.main" : "warning.main",
                    }}
                  >
                    {localAnalysis.ackRate.toFixed(0)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {localAnalysis.ackCount}/{filtered.length} 已确认
                  </Typography>
                </Box>
                <Box sx={{ height: 10, bgcolor: "divider", borderRadius: 1, mt: 1 }}>
                  <Box
                    sx={{
                      height: "100%",
                      width: `${localAnalysis.ackRate}%`,
                      bgcolor: "success.main",
                      borderRadius: 1,
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  未确认 {filtered.length - localAnalysis.ackCount} 条
                </Typography>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  平均持续时长
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {localAnalysis.avgDurationMin > 0 ? localAnalysis.avgDurationMin.toFixed(1) : "—"}
                  {localAnalysis.avgDurationMin > 0 && (
                    <Typography component="span" variant="body2" color="text.secondary">
                      {" "}
                      分钟
                    </Typography>
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  {localAnalysis.pairedCount > 0
                    ? `基于 ${localAnalysis.pairedCount} 对「触发→解除」配对`
                    : "暂无完整触发/解除配对"}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {/* 表格 */}
      <Paper sx={{ p: 0 }}>
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <HistoryRoundedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {records.length === 0
                ? "暂无历史事件 · 设备触发/解除报警后将自动记录于此"
                : "当前筛选条件下暂无匹配的历史事件"}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>时间</TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>设备</TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>报警类型</TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>事件</TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>确认状态</TableCell>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTimestamp(r.timestamp)}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Tooltip title={r.deviceId}>
                        <span>{deviceNameOf(r, nameById)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={sensorLabel(r.sensorType)}
                        color={sensorColor(r.sensorType)}
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.type === "enter" ? "报警触发" : "报警解除"}
                        color={r.type === "enter" ? "error" : "success"}
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      {r.acknowledged ? (
                        <Chip
                          size="small"
                          icon={<CheckCircleRoundedIcon />}
                          label="已确认"
                          color="success"
                          sx={{ height: 20, fontSize: "0.65rem" }}
                        />
                      ) : (
                        <Chip size="small" label="未确认" color="warning" sx={{ height: 20, fontSize: "0.65rem" }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {r.acknowledged ? (
                        <Typography variant="caption" color="text.disabled">
                          —
                        </Typography>
                      ) : (
                        <Button size="small" onClick={() => acknowledge(r.id)}>
                          确认
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {filtered.length > 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.5,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              共 {filtered.length} 条 · 第 {safePage + 1}/{pageCount} 页
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                size="small"
                label="上一页"
                clickable
                disabled={safePage <= 0}
                onClick={() => setPage(safePage - 1)}
                sx={{ height: 24 }}
              />
              <Chip
                size="small"
                label="下一页"
                clickable
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                sx={{ height: 24 }}
              />
            </Stack>
          </Box>
        )}
      </Paper>

      {/* 清空确认弹窗 */}
      <Dialog open={clearOpen} onClose={() => setClearOpen(false)}>
        <DialogTitle>清空历史事件？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            将删除全部 {records.length} 条报警历史事件记录，且不可恢复。此操作仅清空本地历史归档。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearOpen(false)}>取消</Button>
          <Button onClick={handleClearConfirm} color="error" variant="contained">
            确认清空
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
