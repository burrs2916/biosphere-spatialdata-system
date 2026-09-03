import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import Pagination from "@mui/material/Pagination";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import { useLogQueryStore, type LogTab, type TimeRange } from "../store/logQueryStore";
import { useAgentStore } from "../features/agent/store/agentStore";
import { useDeviceStore } from "../store/deviceStore";
import {
  formatTimestamp,
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
  recentTimeRange,
  queryOperationHistory,
  queryEventHistory,
  querySystemHistory,
  querySensorHistory,
} from "../services/historyApi";

const TAB_DEFS: { key: LogTab; label: string }[] = [
  { key: "operation", label: "操作日志" },
  { key: "event", label: "设备事件" },
  { key: "system", label: "系统事件" },
  { key: "sensor", label: "传感器数据" },
];

// ═════════════════════════════════════════════════════════════════
// AI 辅助整理：把当前筛选上下文注入 AI 助手，一键场景化发问
// ═══════════════════════════════════════════════════════════════
const AI_SCENARIOS: { key: string; label: string }[] = [
  { key: "handover", label: "本班交接简报" },
  { key: "anomaly", label: "异常归因分析" },
  { key: "dust", label: "降尘效果评估" },
  { key: "audit", label: "操作合规审计" },
  { key: "summary", label: "时间段智能摘要" },
];

function buildScenarioPrompt(
  key: string,
  s: ReturnType<typeof useLogQueryStore.getState>,
  deviceList: { deviceId: string; productName?: string }[],
): string {
  const devName = s.deviceId
    ? (deviceList.find((d) => d.deviceId === s.deviceId)?.productName || s.deviceId)
    : "全部设备";
  const level = s.logLevel === "all" ? "全部" : s.logLevel;
  const type = s.eventType === "all" ? "全部" : s.eventType;
  const tab = TAB_DEFS.find((t) => t.key === s.activeTab)?.label ?? "";
  const ctx = `时间范围：${s.timeRange.from} ~ ${s.timeRange.to}；设备：${devName}；级别：${level}；类型：${type}；当前查看：${tab}。\n提示：调用 AI 工具查询时，请将上述时间范围与设备作为查询参数（device_id / from / to）传入，确保分析基于当前查看的数据，而非全量默认范围。`;
  const r8 = recentTimeRange(8);
  // 数据红线：报警位域未拆分（仅烟雾位有确定含义）、协议 scene 与前端场景两套口径，AI 不得编造
  const guard =
    "注意：报警数据当前为 2 字节位域，仅「烟雾」位（低字节第 4 位）有确定含义，不要推测具体触发传感器或位域其他位的含义；协议 scene 与前端场景是两套口径，不要混淆。";

  switch (key) {
    case "handover":
      return `请基于以下筛选条件，生成煤矿喷雾降尘系统【本班交接班简报】（建议取最近 8 小时：from=${r8.from} to=${r8.to}）：\n- ${ctx}\n要求：按「离线/上线设备、报警与故障、下发指令及结果、异常事件」四段式输出，并给出接班人员需注意的事项。\n${guard}`;
    case "anomaly":
      return `请基于以下筛选条件，对这段时间做【异常归因分析】：\n- ${ctx}\n要求：列出故障与报警，尝试关联「粉尘超标→喷雾是否及时触发」「故障是否连锁扩散」，对可能原因做归因并给出排查建议。\n${guard}`;
    case "dust":
      return `请基于以下筛选条件，评估【降尘效果】：\n- ${ctx}\n要求：优先用 query_sensor_history 拉取粉尘（sensorType=5）与喷雾（spray.*）数据，对比喷雾开启前后粉尘浓度变化，给出均值/峰值/是否超标及降尘效果判断。若当前筛选不含传感器数据，请主动按设备与时间范围查询粉尘与喷雾。`;
    case "audit":
      return `请基于以下筛选条件，做【操作合规审计】：\n- ${ctx}\n要求：列出所有下发指令、成功率、失败项，标出异常模式（如频繁失败、非工作时段批量操作、异常命令码），供安全合规检查参考。将 command_code 翻译成中文（如 0x0614=下发喷雾策略）。`;
    case "summary":
    default:
      return `请用一段话概括以下筛选范围内的系统日志整体情况：\n- ${ctx}\n要求：涵盖日志量、故障/报警次数、粉尘是否超标、指令成功率，以及有无需要重点关注的异常。结论简洁、可操作。`;
  }
}

/**
 * 把用户在表格中【人工选中的行】交给 AI 解读。
 * lines：已按当前 tab 列序列化成可读文本（如「时间=… · 设备=… · 状态=…」）。
 */
function buildExplainPrompt(lines: string[], tabLabel: string): string {
  // 数据红线：报警位域未拆分（仅烟雾位有确定含义）、协议 scene 与前端场景两套口径，AI 不得编造
  const guard =
    "注意：报警数据当前为 2 字节位域，仅「烟雾」位（低字节第 4 位）有确定含义，不要推测具体触发传感器或位域其他位的含义；协议 scene 与前端场景是两套口径，不要混淆。command_code / sensorType / 状态码等编码请翻译成中文（如 0x0614=下发喷雾策略；sensorType 0风速1风压2CH4 3CO 4温度5粉尘）。";
  return `以下是从系统日志「${tabLabel}」中人工选中的 ${lines.length} 条记录，请帮我解读：\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n要求：逐条或整体说明这些记录的含义、是否正常、可能暗示的问题或异常；如需要更多上下文，可调用工具（query_devices / query_sensor_history / query_operation_logs / query_device_events / query_system_events）。\n${guard}`;
}

const LEVEL_OPTIONS = [
  { label: "全部级别", value: "all" },
  { label: "信息 (info)", value: "info" },
  { label: "警告 (warn)", value: "warn" },
  { label: "错误 (error)", value: "error" },
];

const EVENT_TYPE_OPTIONS = [
  { label: "全部类型", value: "all" },
  { label: "状态变更", value: "status_change" },
  { label: "上线", value: "online" },
  { label: "离线", value: "offline" },
  { label: "告警", value: "alarm" },
  { label: "故障", value: "fault" },
  { label: "参数变更", value: "param_change" },
];

const QUICK_RANGES = [
  { label: "1小时", hours: 1 },
  { label: "6小时", hours: 6 },
  { label: "24小时", hours: 24 },
  { label: "7天", hours: 24 * 7 },
];

// ═══════════════════════════════════════════════════════════════════
// 统计分析（采样聚合，纯前端）
// ═══════════════════════════════════════════════════════════════════

const STATS_SAMPLE = 500;

// 筛选栏输入框高度对齐查询按钮（Button size="small" ≈ 30px），整行等高
const compactFieldSx = { "& .MuiInputBase-root": { height: 30 } } as const;

const BAR_PALETTE = [
  "primary.main",
  "info.main",
  "success.main",
  "warning.main",
  "error.main",
  "secondary.main",
];

type BarColor = "error" | "warning" | "info" | "success" | "primary";

interface DistItem {
  key: string;
  label: string;
  count: number;
  pct: number;
  barColor: string;
}
interface Dist {
  title: string;
  items: DistItem[];
}
interface OverviewCard {
  label: string;
  value: string | number;
  color: BarColor;
}
interface StatsVM {
  sampleSize: number;
  trendStepLabel: string;
  overview: OverviewCard[];
  dists: Dist[];
  trend: { ts: string; count: number }[];
}

function levelColor(level?: string): BarColor {
  const l = (level ?? "").toLowerCase();
  if (l === "error") return "error";
  if (l === "warn" || l === "warning") return "warning";
  return "info";
}

function eventTypeColor(t?: string): BarColor {
  const v = (t ?? "").toLowerCase();
  if (v === "fault") return "error";
  if (v === "alarm" || v === "offline") return "warning";
  if (v === "online") return "success";
  if (v === "status_change" || v === "param_change") return "info";
  return "info";
}

function resultColor(r?: string): BarColor {
  const v = (r ?? "").toLowerCase();
  if (v === "success") return "success";
  if (v === "fail" || v === "failed" || v === "error") return "error";
  return "info";
}

function pickTrendStep(hours: number): { minutes: number; label: string } {
  if (hours <= 3) return { minutes: 5, label: "5 分钟" };
  if (hours <= 12) return { minutes: 30, label: "30 分钟" };
  if (hours <= 48) return { minutes: 60, label: "1 小时" };
  return { minutes: 1440, label: "1 天" };
}

function countByField(rows: Record<string, unknown>[], field: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = str(r[field] as unknown);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function toDistItems(
  map: Map<string, number>,
  colorOf?: (k: string) => BarColor,
): DistItem[] {
  const total = Array.from(map.values()).reduce((s, n) => s + n, 0) || 1;
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, count], i) => ({
      key: k,
      label: k,
      count,
      pct: (count / total) * 100,
      barColor: colorOf ? `${colorOf(k)}.main` : BAR_PALETTE[i % BAR_PALETTE.length],
    }));
}

function bucketRows(
  rows: Record<string, unknown>[],
  stepMinutes: number,
  from: string,
  to: string,
): { ts: string; count: number }[] {
  const start = Date.parse(from);
  const end = Date.parse(to);
  const stepMs = stepMinutes * 60_000;
  if (isNaN(start) || isNaN(end) || stepMs <= 0) return [];
  const buckets: { t: number; count: number }[] = [];
  for (let t = start; t < end; t += stepMs) buckets.push({ t, count: 0 });
  if (buckets.length === 0) return [];
  for (const r of rows) {
    const ts = Date.parse(str(r.timestamp as unknown));
    if (isNaN(ts)) continue;
    let idx = Math.floor((ts - start) / stepMs);
    if (idx < 0) idx = 0;
    if (idx >= buckets.length) idx = buckets.length - 1;
    buckets[idx].count++;
  }
  return buckets.map((b) => ({ ts: new Date(b.t).toISOString(), count: b.count }));
}

function buildStatsVM(
  rows: Record<string, unknown>[],
  tab: LogTab,
  timeRange: TimeRange,
): StatsVM {
  const spanHours = (Date.parse(timeRange.to) - Date.parse(timeRange.from)) / 3_600_000;
  const step = pickTrendStep(spanHours);
  const trend = bucketRows(rows, step.minutes, timeRange.from, timeRange.to);

  if (tab === "operation") {
    let success = 0;
    let fail = 0;
    const durs: number[] = [];
    for (const r of rows) {
      const res = str(r.result as unknown).toLowerCase();
      if (res === "success") success++;
      else if (res === "fail" || res === "failed" || res === "error") fail++;
      const d = Number(r.duration_ms);
      if (!Number.isNaN(d)) durs.push(d);
    }
    const avgDur = durs.length ? durs.reduce((s, d) => s + d, 0) / durs.length : 0;
    const overview: OverviewCard[] = [
      { label: "总操作", value: rows.length, color: "primary" },
      { label: "成功", value: success, color: "success" },
      { label: "失败", value: fail, color: "error" },
      { label: "平均耗时", value: avgDur ? `${avgDur.toFixed(0)} ms` : "—", color: "info" },
    ];
    const dists: Dist[] = [
      { title: "动作分布", items: toDistItems(countByField(rows, "action")) },
      { title: "结果分布", items: toDistItems(countByField(rows, "result"), resultColor) },
    ];
    return { sampleSize: rows.length, trendStepLabel: step.label, overview, dists, trend };
  }

  if (tab === "event") {
    let fault = 0;
    let alarm = 0;
    let err = 0;
    for (const r of rows) {
      const t = str(r.event_type as unknown).toLowerCase();
      if (t === "fault") fault++;
      else if (t === "alarm") alarm++;
      if (str(r.level as unknown).toLowerCase() === "error") err++;
    }
    const overview: OverviewCard[] = [
      { label: "总事件", value: rows.length, color: "primary" },
      { label: "故障", value: fault, color: "error" },
      { label: "告警", value: alarm, color: "warning" },
      { label: "错误级别", value: err, color: "error" },
    ];
    const dists: Dist[] = [
      { title: "事件类型分布", items: toDistItems(countByField(rows, "event_type"), eventTypeColor) },
      { title: "级别分布", items: toDistItems(countByField(rows, "level"), levelColor) },
    ];
    return { sampleSize: rows.length, trendStepLabel: step.label, overview, dists, trend };
  }

  if (tab === "system") {
    let e = 0;
    let w = 0;
    let i = 0;
    for (const r of rows) {
      const l = str(r.level as unknown).toLowerCase();
      if (l === "error") e++;
      else if (l === "warn" || l === "warning") w++;
      else if (l === "info") i++;
    }
    const overview: OverviewCard[] = [
      { label: "总事件", value: rows.length, color: "primary" },
      { label: "错误", value: e, color: "error" },
      { label: "警告", value: w, color: "warning" },
      { label: "信息", value: i, color: "info" },
    ];
    const dists: Dist[] = [
      { title: "级别分布", items: toDistItems(countByField(rows, "level"), levelColor) },
      { title: "模块分布", items: toDistItems(countByField(rows, "module")) },
    ];
    return { sampleSize: rows.length, trendStepLabel: step.label, overview, dists, trend };
  }

  // sensor
  const devSet = new Set<string>();
  const typeSet = new Set<string>();
  for (const r of rows) {
    if (r.device_id) devSet.add(str(r.device_id as unknown));
    if (r.type) typeSet.add(str(r.type as unknown));
  }
  const overview: OverviewCard[] = [
    { label: "采样点数", value: rows.length, color: "primary" },
    { label: "设备数", value: devSet.size, color: "info" },
    { label: "类型数", value: typeSet.size, color: "success" },
  ];
  const dists: Dist[] = [
    { title: "传感器类型分布", items: toDistItems(countByField(rows, "type")) },
    { title: "质量分布", items: toDistItems(countByField(rows, "quality")) },
  ];
  return { sampleSize: rows.length, trendStepLabel: step.label, overview, dists, trend };
}

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return v === undefined || v === null || v === "" ? "-" : String(v);
}

function LevelChip({ level }: { level: string }) {
  const color = level === "error" ? "error" : level === "warn" ? "warning" : level === "info" ? "info" : "default";
  const label =
    level === "error" ? "错误" : level === "warn" ? "警告" : level === "info" ? "信息" : level || "默认";
  return (
    <Chip size="small" label={label} color={color} sx={{ height: 20, fontSize: "0.65rem" }} />
  );
}

const COLUMNS: Record<LogTab, { label: string; get: (r: Row) => ReactNode }[]> = {
  operation: [
    { label: "时间", get: (r) => formatTimestamp(r.timestamp as string | number | undefined) },
    { label: "指令码", get: (r) => str(r.command_code) },
    { label: "动作", get: (r) => str(r.action) },
    { label: "设备", get: (r) => str(r.device_id) },
    { label: "结果", get: (r) => str(r.result) },
    { label: "耗时(ms)", get: (r) => str(r.duration_ms) },
    { label: "操作人", get: (r) => str(r.operator) },
  ],
  event: [
    { label: "时间", get: (r) => formatTimestamp(r.timestamp as string | number | undefined) },
    { label: "设备", get: (r) => str(r.device_id) },
    { label: "事件类型", get: (r) => str(r.event_type) },
    { label: "级别", get: (r) => <LevelChip level={str(r.level)} /> },
    { label: "变化", get: (r) => `${str(r.old_value)} → ${str(r.new_value)}` },
    { label: "原因", get: (r) => str(r.reason) },
  ],
  system: [
    { label: "时间", get: (r) => formatTimestamp(r.timestamp as string | number | undefined) },
    { label: "事件类型", get: (r) => str(r.event_type) },
    { label: "级别", get: (r) => <LevelChip level={str(r.level)} /> },
    { label: "模块", get: (r) => str(r.module) },
    { label: "消息", get: (r) => str(r.message) },
  ],
  sensor: [
    { label: "时间", get: (r) => formatTimestamp(r.timestamp as string | number | undefined) },
    { label: "设备", get: (r) => str(r.device_id) },
    { label: "类型", get: (r) => str(r.type) },
    { label: "数值", get: (r) => str(r.value) },
    { label: "单位", get: (r) => str(r.unit) },
    { label: "质量", get: (r) => str(r.quality) },
  ],
};

export default function LogsPage() {
  const timeRange = useLogQueryStore((s) => s.timeRange);
  const deviceId = useLogQueryStore((s) => s.deviceId);
  const logLevel = useLogQueryStore((s) => s.logLevel);
  const eventType = useLogQueryStore((s) => s.eventType);
  const activeTab = useLogQueryStore((s) => s.activeTab);
  const currentPage = useLogQueryStore((s) => s.currentPage);
  const pageSize = useLogQueryStore((s) => s.pageSize);
  const operationLogs = useLogQueryStore((s) => s.operationLogs);
  const deviceEvents = useLogQueryStore((s) => s.deviceEvents);
  const systemEvents = useLogQueryStore((s) => s.systemEvents);
  const sensorData = useLogQueryStore((s) => s.sensorData);
  const loading = useLogQueryStore((s) => s.loading);

  // 当前时间范围若正好等于某个快捷区间，则高亮对应 chip（干净统一的选中态）
  const activeRangeHours = useMemo(() => {
    const spanMs = new Date(timeRange.to).getTime() - new Date(timeRange.from).getTime();
    const spanH = spanMs / 3_600_000;
    const match = QUICK_RANGES.find((r) => Math.abs(spanH - r.hours) < 0.05);
    return match?.hours;
  }, [timeRange.from, timeRange.to]);
  const error = useLogQueryStore((s) => s.error);
  const exporting = useLogQueryStore((s) => s.exporting);
  const setQueryParams = useLogQueryStore((s) => s.setQueryParams);
  const setActiveTab = useLogQueryStore((s) => s.setActiveTab);
  const setCurrentPage = useLogQueryStore((s) => s.setCurrentPage);
  const queryActiveTab = useLogQueryStore((s) => s.queryActiveTab);
  const exportCsv = useLogQueryStore((s) => s.exportCsv);
  // 总数来自后台异步统计（cachedTotals）；数据查询不再返回 total，故以缓存为权威来源
  const cachedTotals = useLogQueryStore((s) => s.cachedTotals);
  const needsCount = useLogQueryStore((s) => s.needsCount);

  const devices = useDeviceStore((s) => s.devices);
  const deviceList = useMemo(() => Object.values(devices), [devices]);

  // 设备下拉树：协议层级 集控器(main) → 分控器(sub) → 传感器(sensor)。
  // 有父设备且父设备在列表中的挂到父级下；其余（含孤儿）作为根节点，集控器排前面。
  const deviceTree = useMemo(() => {
    const byId = new Map(deviceList.map((d) => [d.deviceId, d]));
    const childrenOf = new Map<string, typeof deviceList>();
    const roots: typeof deviceList = [];
    for (const d of deviceList) {
      if (d.parentDeviceId && byId.has(d.parentDeviceId)) {
        const arr = childrenOf.get(d.parentDeviceId) ?? [];
        arr.push(d);
        childrenOf.set(d.parentDeviceId, arr);
      } else {
        roots.push(d);
      }
    }
    const catOrder: Record<string, number> = { main: 0, sub: 1, sensor: 2, auxiliary: 3 };
    const sortDevices = (list: typeof deviceList) =>
      [...list].sort(
        (a, b) => (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9) || a.deviceId.localeCompare(b.deviceId),
      );
    const items: Array<{ device: (typeof deviceList)[number]; depth: number }> = [];
    const walk = (list: typeof deviceList, depth: number) => {
      for (const d of sortDevices(list)) {
        items.push({ device: d, depth });
        const kids = childrenOf.get(d.deviceId);
        if (kids?.length) walk(kids, depth + 1);
      }
    };
    walk(roots, 0);
    return items;
  }, [deviceList]);

  const [autoRefresh, setAutoRefresh] = useState(true);
  // 统计分析折叠面板：默认收起，数据表格优先占据首屏
  const [statsOpen, setStatsOpen] = useState(false);
  const REFRESH_INTERVAL_MS = 30_000;

  // 行选中：用于在表格中勾选若干条日志，交给 AI 解释。用行内容签名做 key，
  // 这样 30s 自动刷新后若同一行仍在，选中态保持；切 tab 时清空。
  const [selectedSigs, setSelectedSigs] = useState<Set<string>>(new Set());
  const rowSig = useCallback((row: Record<string, unknown>) => JSON.stringify(row), []);

  const result =
    activeTab === "operation"
      ? operationLogs
      : activeTab === "event"
        ? deviceEvents
        : activeTab === "system"
          ? systemEvents
          : sensorData;
  const columns = COLUMNS[activeTab];

  // ─── 行选中（交给 AI 解释）派生状态 ───
  const pageSigs = useMemo(
    () => result.data.map((r) => rowSig(r as Record<string, unknown>)),
    [result.data, rowSig],
  );
  const allSelected = pageSigs.length > 0 && pageSigs.every((s) => selectedSigs.has(s));
  const someSelected = pageSigs.some((s) => selectedSigs.has(s));
  const selectedRows = useMemo(
    () => result.data.filter((r) => selectedSigs.has(rowSig(r as Record<string, unknown>))),
    [result.data, selectedSigs, rowSig],
  );
  const toggleRow = (sig: string) =>
    setSelectedSigs((prev) => {
      const n = new Set(prev);
      if (n.has(sig)) n.delete(sig);
      else n.add(sig);
      return n;
    });
  const toggleAll = () =>
    setSelectedSigs((prev) => {
      const n = new Set(prev);
      if (allSelected) pageSigs.forEach((s) => n.delete(s));
      else pageSigs.forEach((s) => n.add(s));
      return n;
    });
  // 切 tab 时清空选中（不同 tab 行结构不同，跨 tab 保持无意义）
  useEffect(() => {
    setSelectedSigs(new Set());
  }, [activeTab]);

  // ─── 统计分析（采样聚合，纯前端）───
  const [statsRows, setStatsRows] = useState<Record<string, unknown>[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const s = useLogQueryStore.getState();
    setStatsLoading(true);
    setStatsError(null);
    try {
      const base = {
        from: s.timeRange.from,
        to: s.timeRange.to,
        device_id: s.deviceId || undefined,
        limit: STATS_SAMPLE,
        offset: 0,
        // 分布图只需采样行，不需要 total；传 false 跳过全表 COUNT(*)，
        // 否则每次切 tab/查询都额外跑一次 COUNT（这是「打开仍慢」的漏点）。
        countTotal: false,
        // 采样走旁路：不进入全局 inflight，避免取消/覆盖同路径的表格数据请求
        //（否则 loadStats 与 queryActiveTab 并发时会互相 abort，造成表格卡空）。
        bypassInflight: true,
      };
      let rows: Record<string, unknown>[] = [];
      if (s.activeTab === "operation") {
        const r = await queryOperationHistory({ ...base, action: undefined, result: undefined });
        rows = r.data as Record<string, unknown>[];
      } else if (s.activeTab === "event") {
        const r = await queryEventHistory({
          ...base,
          type: s.eventType !== "all" ? s.eventType : undefined,
          level: s.logLevel !== "all" ? s.logLevel : undefined,
        });
        rows = r.data as Record<string, unknown>[];
      } else if (s.activeTab === "system") {
        const r = await querySystemHistory({
          ...base,
          level: s.logLevel !== "all" ? s.logLevel : undefined,
          type: s.eventType !== "all" ? s.eventType : undefined,
        });
        rows = r.data as Record<string, unknown>[];
      } else {
        const r = await querySensorHistory({
          ...base,
          type: s.eventType !== "all" ? s.eventType : undefined,
        });
        rows = r.data as Record<string, unknown>[];
      }
      setStatsRows(rows);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : String(err));
      setStatsRows([]);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const statsVM = useMemo<StatsVM>(
    () => buildStatsVM(statsRows, activeTab, timeRange),
    [statsRows, activeTab, timeRange],
  );

  // 挂载 + 切 Tab 自动查询
  useEffect(() => {
    void queryActiveTab();
  }, [activeTab, queryActiveTab]);

  // 切 Tab 时刷新统计分析（采样，不随 30s 轮询，避免高频拉取）
  useEffect(() => {
    void loadStats();
  }, [activeTab, loadStats]);

  // 自动轮询刷新（默认开启，30s 一次）
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void queryActiveTab();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, REFRESH_INTERVAL_MS, queryActiveTab]);

  // 总数以后台异步统计结果（cachedTotals）为准；首屏未返回前显示「统计中…」
  const displayTotal = cachedTotals[activeTab] ?? 0;
  const counting = needsCount && cachedTotals[activeTab] === undefined;
  const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
  const safePage = Math.min(currentPage + 1, totalPages);

  const handleQuickRange = (hours: number) => {
    setQueryParams({ timeRange: recentTimeRange(hours) });
    void queryActiveTab();
    void loadStats();
  };

  const handleQuery = () => {
    void queryActiveTab();
    void loadStats();
  };

  const handlePage = (page0: number) => {
    setCurrentPage(page0);
    void queryActiveTab();
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          系统日志
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="自动刷新"
            sx={{ mr: 0.5 }}
          />
          <Tooltip title="刷新">
            <span>
              <IconButton size="small" onClick={() => { void queryActiveTab(); void loadStats(); }} disabled={loading}>
                <RefreshRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArticleRoundedIcon />}
            disabled={exporting}
            onClick={() => void exportCsv()}
          >
            {exporting ? "导出中..." : "导出 CSV"}
          </Button>
        </Stack>
      </Box>

      {/* 页级 Tabs：决定看哪类数据，筛选与统计都跟随它 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 44, "& .MuiTab-root": { minHeight: 44 } }}
        >
          {TAB_DEFS.map((t) => (
            <Tab key={t.key} value={t.key} label={t.label} />
          ))}
        </Tabs>
      </Paper>

      {/* 筛选栏 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 1.5, md: 2 }}
          sx={{ alignItems: { md: "center" }, flexWrap: "wrap" }}
        >
          {/* 快捷时间范围：段控，选中态高亮 */}
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
            {QUICK_RANGES.map((r) => {
              const active = activeRangeHours === r.hours;
              return (
                <Chip
                  key={r.hours}
                  label={r.label}
                  size="small"
                  clickable
                  color={active ? "primary" : "default"}
                  variant={active ? "filled" : "outlined"}
                  onClick={() => handleQuickRange(r.hours)}
                  sx={{ height: 30 }}
                />
              );
            })}
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />

          <TextField
            label="开始时间"
            type="datetime-local"
            size="small"
            sx={compactFieldSx}
            value={toDateTimeLocalValue(timeRange.from)}
            onChange={(e) => {
              const v = fromDateTimeLocalValue(e.target.value);
              if (v) setQueryParams({ timeRange: { ...timeRange, from: v } });
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="结束时间"
            type="datetime-local"
            size="small"
            sx={compactFieldSx}
            value={toDateTimeLocalValue(timeRange.to)}
            onChange={(e) => {
              const v = fromDateTimeLocalValue(e.target.value);
              if (v) setQueryParams({ timeRange: { ...timeRange, to: v } });
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />

          <TextField
            label="设备"
            size="small"
            select
            sx={{ minWidth: 180, ...compactFieldSx }}
            slotProps={{
              inputLabel: { shrink: true },
              select: {
                displayEmpty: true,
                renderValue: (value) => {
                  const d = deviceList.find((x) => x.deviceId === value);
                  return d ? `${d.productName || d.deviceId}（${d.deviceId}）` : "全部设备";
                },
              },
            }}
            value={deviceId}
            onChange={(e) => setQueryParams({ deviceId: e.target.value })}
          >
            <MenuItem value="">
              <em>全部设备</em>
            </MenuItem>
            {deviceTree.map(({ device: d, depth }) => (
              <MenuItem
                key={d.deviceId}
                value={d.deviceId}
                sx={{
                  pl: 2 + depth * 2.5,
                  ...(depth === 0
                    ? { fontWeight: 600 }
                    : { fontWeight: 400, color: "text.secondary", fontSize: 13, py: 0.5 }),
                }}
              >
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
                  <Box component="span">{d.productName || d.deviceId}</Box>
                  <Box
                    component="span"
                    sx={{ fontSize: 11, fontWeight: 400, color: "text.disabled", fontFamily: "monospace" }}
                  >
                    {d.deviceId}
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="级别"
            size="small"
            select
            sx={{ minWidth: 120, ...compactFieldSx }}
            value={logLevel}
            onChange={(e) => setQueryParams({ logLevel: e.target.value })}
          >
            {LEVEL_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="事件类型"
            size="small"
            select
            sx={{ minWidth: 130, ...compactFieldSx }}
            value={eventType}
            onChange={(e) => setQueryParams({ eventType: e.target.value })}
          >
            {EVENT_TYPE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="contained"
            size="small"
            onClick={handleQuery}
            disabled={loading}
            sx={{ ml: { md: "auto" }, minWidth: 88 }}
          >
            {loading ? <CircularProgress size={16} color="inherit" /> : "查询"}
          </Button>
        </Stack>
      </Paper>

      {/* AI 辅助整理：对当前筛选上下文 / 选中行发起 AI 分析（平铺，紧贴数据） */}
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", alignItems: "center", mb: 2 }}>
        <SmartToyRoundedIcon sx={{ fontSize: 18, color: "primary.main", mr: 0.25 }} />
        {AI_SCENARIOS.map((sc) => (
          <Chip
            key={sc.key}
            size="small"
            variant="outlined"
            color="primary"
            label={sc.label}
            onClick={() => {
              const s = useLogQueryStore.getState();
              useAgentStore.getState().seedAndOpen(buildScenarioPrompt(sc.key, s, deviceList));
            }}
          />
        ))}
        {selectedRows.length > 0 && (
          <Chip
            size="small"
            color="primary"
            label="解释选中行"
            onClick={() => {
              const tabLabel = TAB_DEFS.find((t) => t.key === activeTab)?.label ?? "";
              const lines = selectedRows.map((r) =>
                columns.map((c) => `${c.label}=${c.get(r as Row)}`).join(" · "),
              );
              useAgentStore.getState().seedAndOpen(buildExplainPrompt(lines, tabLabel));
            }}
          />
        )}
        {selectedRows.length > 0 && (
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={`已选 ${selectedRows.length} 行`}
            onDelete={() => setSelectedSigs(new Set())}
          />
        )}
      </Stack>

      {/* 日志表格 */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          {error ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center", bgcolor: "error.main", color: "error.contrastText" }}>
              <Typography variant="body2">查询失败：{error}</Typography>
              <Typography variant="caption">请确认已在「数据源管理」配置并激活一个 HTTP 数据源（日志接口 baseUrl 取自激活数据源）。</Typography>
              <Box sx={{ mt: 1.5 }}>
                <Button variant="contained" size="small" color="inherit" onClick={() => { void queryActiveTab(); void loadStats(); }} disabled={loading}>
                  {loading ? <CircularProgress size={16} color="inherit" /> : "重试"}
                </Button>
              </Box>
            </Paper>
          ) : loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : result.data.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <ArticleRoundedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                当前时间范围与筛选条件下暂无日志
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ fontWeight: 600 }}>
                      <Checkbox
                        size="small"
                        checked={allSelected}
                        indeterminate={!allSelected && someSelected}
                        onChange={toggleAll}
                      />
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.label} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {c.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.data.map((row, i) => {
                    const sig = rowSig(row as Record<string, unknown>);
                    const checked = selectedSigs.has(sig);
                    return (
                      <TableRow key={i} hover selected={checked}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={checked} onChange={() => toggleRow(sig)} />
                        </TableCell>
                        {columns.map((c) => (
                          <TableCell key={c.label} sx={{ whiteSpace: "nowrap" }}>
                            {c.get(row as Row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {!error && result.data.length > 0 && (
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}
          >
            <Typography variant="caption" color="text.secondary">
              {counting ? "总数统计中…" : `共 ${displayTotal} 条`}
              {!counting ? ` · 第 ${safePage}/${totalPages} 页` : ""}
            </Typography>
            <Pagination
              count={totalPages}
              page={safePage}
              onChange={(_, p) => handlePage(p - 1)}
              size="small"
              shape="rounded"
              disabled={loading}
              sx={{ "& .MuiPaginationItem-root": { fontSize: 12 } }}
            />
          </Box>
        )}
      </Paper>

      {/* 统计分析（折叠面板：次要信息置于数据之后，默认收起不霸屏） */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box
          onClick={() => setStatsOpen((v) => !v)}
          sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, cursor: "pointer", userSelect: "none" }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
            统计分析
          </Typography>
          <Chip
            size="small"
            label={`${TAB_DEFS.find((t) => t.key === activeTab)?.label ?? ""} · 采样 ${statsVM.sampleSize} 条`}
            variant="outlined"
          />
          {statsLoading && <CircularProgress size={14} />}
          <IconButton size="small" sx={{ p: 0 }}>
            {statsOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
          </IconButton>
        </Box>
        <Collapse in={statsOpen}>
          <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>

        {statsError ? (
          <Alert severity="info">{statsError}</Alert>
        ) : statsLoading && statsRows.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : statsRows.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            当前时间范围与筛选条件下暂无日志可供统计。
          </Typography>
        ) : (
          <>
            {/* 概览卡 */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              {statsVM.overview.map((c) => (
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

            {/* 时间趋势 */}
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                时间趋势（日志量 / {statsVM.trendStepLabel}）
              </Typography>
              {statsVM.trend.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  该范围内无时间分布
                </Typography>
              ) : (
                (() => {
                  const max = Math.max(1, ...statsVM.trend.map((b) => b.count));
                  return (
                    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, height: 130 }}>
                      {statsVM.trend.map((b) => (
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

            {/* 分布 */}
            <Grid container spacing={2}>
              {statsVM.dists.map((d) => (
                <Grid size={{ xs: 12, md: 6 }} key={d.title}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {d.title}
                    </Typography>
                    {d.items.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        无数据
                      </Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {d.items.map((it) => (
                          <Box key={it.key}>
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Typography
                                variant="body2"
                                noWrap
                                sx={{ maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis" }}
                                title={it.label}
                              >
                                {it.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {it.count} 条
                              </Typography>
                            </Box>
                            <Box sx={{ height: 6, bgcolor: "divider", borderRadius: 1, mt: 0.5 }}>
                              <Box
                                sx={{
                                  height: "100%",
                                  width: `${it.pct}%`,
                                  bgcolor: it.barColor,
                                  borderRadius: 1,
                                }}
                              />
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        )}
          </Box>
        </Collapse>
      </Paper>

    </Box>
  );
}
