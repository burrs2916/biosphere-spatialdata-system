/**
 * LogFilterPanel - 日志监控筛选面板
 *
 * 左侧筛选面板，提供：
 * - 时间范围选择器（datetime-local）
 * - 设备选择（仅列本场景集控器子树内的设备，消费主视图已绑定的数据源）
 * - 日志级别选择（all/info/warn/error）
 * - 事件类型选择
 * - 查询按钮、导出CSV按钮
 *
 * 通过 logMonitorStore 的 setQueryParams 触发查询；任何筛选变更（级别/类型/设备/时间）
 * 立即全量重查右侧全部表 + 统计 + 报告 + 图表（refreshAll），非仅激活 tab。
 *
 * 关键：本组件使用专用 `useLogMonitorStore`（场景设备池隔离版本），
 * 与 OperationLogTable / DeviceEventTable / SystemEventTable / AlarmTrendStacked /
 * OperationCommandDonut / OperationResultDonut / LogOverviewCards 等同视图组件共享同一 store；
 * 自动同步场景设备池：挂载时调用 `subscribeLogMonitorToScene()`（幂等）。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ComponentRendererProps } from "../../../types/editor";
import { useLogMonitorStore, subscribeLogMonitorToScene } from "../../../store/logMonitorStore";
import type { LogQueryParams } from "../../../store/logMonitorStore";
import { useDeviceStore } from "../../../store/deviceStore";
import { toDateTimeLocalValue, fromDateTimeLocalValue, recentTimeRange } from "../../../services/historyApi";
// 复用设备组件分组里的"喷雾集控器"卡片视图，让日志面板一眼呈现当前监控的集控器
import { ControlPanelRenderer } from "../deviceVariants/CardVariantRenderer";
// 子控器卡片：完全复用喷雾控制工具栏的分控器卡片视觉（点击 = 按该设备过滤日志）
import { SubControllerCard } from "./SubControllerCard";
import type { SubControllerInfo } from "./SubControllerCard";
import { DEFAULT_PRODUCT_CODE_MAPPING } from "../../../devices/edgeConductorDefaults";
import {
  parseControllerState,
  getSprayStatusText,
  type DeviceLiveStatus,
  type StatusVisual,
} from "../deviceVariants/deviceStatus";
import type { DeviceInstance } from "../../../types/device";
import { isSubControllerDevice } from "../../../devices/productCodePredicates";

// 日志级别选项
const LEVEL_OPTIONS = [
  { label: "全部级别", value: "all" },
  { label: "信息 (info)", value: "info" },
  { label: "警告 (warn)", value: "warn" },
  { label: "错误 (error)", value: "error" },
];

// 事件类型选项（按 tab 区分，对齐边缘实际写入值——含经 W4 变量写入的真实类型，避免死/缺选项）
// - event  : device_events.event_type  → status_change/online/offline/reconnect/fault/
//            alarm_trigger/alarm_clear/data_lock/config_change（实测 GreptimeDB 全量分布）
// - system : system_events.event_type  → startup/config_change
// - sensor : sensor_data.sensor_type   → belt/flowMeter/pump
// - operation: 操作日志无 event_type 域，事件类型不适用（UI 置灰提示）
const TAB_EVENT_TYPE_OPTIONS: Record<string, { label: string; value: string }[]> = {
  event: [
    { label: "全部类型", value: "all" },
    { label: "状态变更", value: "status_change" },
    { label: "上线", value: "online" },
    { label: "离线", value: "offline" },
    { label: "重连", value: "reconnect" },
    { label: "故障", value: "fault" },
    { label: "报警触发", value: "alarm_trigger" },
    { label: "报警解除", value: "alarm_clear" },
    { label: "数据锁存", value: "data_lock" },
    { label: "配置变更", value: "config_change" },
  ],
  system: [
    { label: "全部类型", value: "all" },
    { label: "系统启动", value: "startup" },
    { label: "配置变更", value: "config_change" },
  ],
  sensor: [
    { label: "全部类型", value: "all" },
    { label: "皮带", value: "belt" },
    { label: "流量计", value: "flowMeter" },
    { label: "水泵", value: "pump" },
  ],
  operation: [{ label: "全部类型", value: "all" }],
};

// 快捷时间范围
const QUICK_RANGES = [
  { label: "1小时", hours: 1 },
  { label: "6小时", hours: 6 },
  { label: "24小时", hours: 24 },
  { label: "7天", hours: 24 * 7 },
];

// 集控器悬浮详情中的一行（label / value）
function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.25 }}>
      <Typography component="span" sx={{ fontSize: 11.5, color: "rgba(160,185,200,0.72)" }}>
        {label}
      </Typography>
      <Typography
        component="span"
        sx={{ fontSize: 11.5, color: valueColor ?? "#E0ECF2", fontWeight: 500, textAlign: "right", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={value}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function LogFilterPanel({ config }: ComponentRendererProps) {
  const title = (config.title as string) ?? "日志筛选";
  const showExport = (config.showExport as boolean) ?? true;

  const timeRange = useLogMonitorStore((s) => s.timeRange);
  const selectedDeviceIds = useLogMonitorStore((s) => s.selectedDeviceIds);
  const logLevel = useLogMonitorStore((s) => s.logLevel);
  const eventType = useLogMonitorStore((s) => s.eventType);
  const activeTab = useLogMonitorStore((s) => s.activeTab);
  const loading = useLogMonitorStore((s) => s.loading);
  const exporting = useLogMonitorStore((s) => s.exporting);
  const setQueryParams = useLogMonitorStore((s) => s.setQueryParams);
  const queryOperationLogs = useLogMonitorStore((s) => s.queryOperationLogs);
  const queryDeviceEvents = useLogMonitorStore((s) => s.queryDeviceEvents);
  const querySystemEvents = useLogMonitorStore((s) => s.querySystemEvents);
  const queryEventsForStats = useLogMonitorStore((s) => s.queryEventsForStats);
  const queryOpsForStats = useLogMonitorStore((s) => s.queryOpsForStats);
  const bumpRefresh = useLogMonitorStore((s) => s.bumpRefresh);
  const exportCsv = useLogMonitorStore((s) => s.exportCsv);
  const exportReport = useLogMonitorStore((s) => s.exportReport);
  const report = useLogMonitorStore((s) => s.report);
  const queryReport = useLogMonitorStore((s) => s.queryReport);

  const devices = useDeviceStore((s) => s.devices);
  const products = useDeviceStore((s) => s.products);
  const scopeMode = useLogMonitorStore((s) => s.scopeMode);
  // 主视图喷雾控制工具栏当前绑定的集控器根（与工具栏 mainControllerIds 同源）
  const selectedControllerIds = useLogMonitorStore((s) => s.selectedControllerIds);

  // ── 设备画像：完全复用喷雾控制工具栏的检测逻辑 ──
  // 主集控器 = selectedControllerIds（已为 productCode=18 根）；
  // 子控器按工具栏同口径扫描：productCode=18001 && parentId===集控器根。
  const subControllers = useMemo<DeviceInstance[]>(() => {
    if (selectedControllerIds.length === 0) return [];
    const roots = new Set(selectedControllerIds);
    const list: DeviceInstance[] = [];
    for (const d of Object.values(devices)) {
      if (isSubControllerDevice(d) && roots.has(String(d.parentDeviceId ?? ""))) list.push(d);
    }
    return list;
  }, [devices, selectedControllerIds]);

  // ── 子控器卡片视觉映射（与 SprayControlToolbarRenderer 内部一致）──
  const mapControllerStatus = (ctrl: SubControllerInfo): DeviceLiveStatus => {
    if (!ctrl.online) return "offline";
    if (ctrl.controllerState?.commFault) return "fault";
    if (ctrl.controllerState?.batteryWarn) return "warning";
    return "online";
  };
  const SUB_VISUALS: Record<DeviceLiveStatus, StatusVisual> = {
    online: { text: "在线", color: "#3CCB7F", bodyScheme: "normal", pulse: true },
    offline: { text: "离线", color: "#888888", bodyScheme: "offline", pulse: false },
    alarm: { text: "告警", color: "#F0A030", bodyScheme: "normal", pulse: true },
    warning: { text: "预警", color: "#FF9800", bodyScheme: "normal", pulse: true },
    fault: { text: "故障", color: "#ef4444", bodyScheme: "normal", pulse: true },
    pending: { text: "检查中", color: "#FFC107", bodyScheme: "normal", pulse: true },
  };
  const mapStatusVisual = (ctrl: SubControllerInfo): StatusVisual => SUB_VISUALS[mapControllerStatus(ctrl)];
  const buildScreenItems = (ctrl: SubControllerInfo, isSpraying: boolean) => {
    const items: Array<{ key: string; label: string; value: string; unit?: string }> = [];
    if (isSpraying) items.push({ key: "spray", label: "状态", value: ctrl.sprayStatusText });
    else if (ctrl.online) items.push({ key: "status", label: "状态", value: "待机" });
    if (ctrl.controllerState?.batteryWarn) items.push({ key: "battery", label: "电池", value: "预警" });
    if (ctrl.controllerState?.commFault) items.push({ key: "comm", label: "通讯", value: "故障" });
    return items;
  };
  const NEUTRAL_FEEDBACK = { glowColor: "#00BCD4", glowIntensity: 0, animType: "none" } as const;
  const toSubInfo = (d: DeviceInstance): SubControllerInfo => {
    const md = (d.metadata ?? {}) as Record<string, unknown>;
    const realtime = (md.realtime ?? {}) as Record<string, { value: unknown }>;
    const stateRaw = realtime.controllerState?.value;
    const state = typeof stateRaw === "number" ? parseControllerState(stateRaw) : null;
    const parentName =
      selectedControllerIds.length === 1
        ? devices[selectedControllerIds[0]]?.productName ?? selectedControllerIds[0]
        : String(d.parentDeviceId ?? "");
    return {
      deviceId: d.deviceId,
      productName: d.productName,
      online: d.online,
      parentDeviceId: String(d.parentDeviceId ?? ""),
      parentName,
      controllerState: state,
      controllerStateRaw: typeof stateRaw === "number" ? stateRaw : undefined,
      batteryWarning: typeof realtime.batteryWarning?.value === "number" ? realtime.batteryWarning.value : 0,
      sprayStatusText: state ? getSprayStatusText(state) : "",
      lastChangeTime: 0,
      pendingSince: 0,
    };
  };

  // 全量刷新：右侧画布同时摆放多张表（操作/事件/系统），筛选变更必须重查"全部表"，
  // 而非仅激活 tab —— 否则非激活表永远停留旧数据（"点了筛选右侧不联动"的根因）。
  const refreshAll = useCallback(() => {
    void queryOperationLogs();
    void queryDeviceEvents();
    void querySystemEvents();
    void queryEventsForStats();
    void queryOpsForStats();
    void queryReport();
    bumpRefresh(); // 触发 3 图表(命令donut/结果donut/堆叠趋势)依赖 refreshNonce 自刷新
  }, [queryOperationLogs, queryDeviceEvents, querySystemEvents, queryEventsForStats, queryOpsForStats, queryReport, bumpRefresh]);

  // 时间输入框逐段触发 onChange：防抖 500ms 合并重查，避免选时间过程的查询风暴
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshAllDebounced = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => refreshAll(), 500);
  }, [refreshAll]);
  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  // 中央 30s 自动刷新：全部表 + 统计 + 报告 + 图表一致鲜活；挂载即查一次。
  useEffect(() => {
    subscribeLogMonitorToScene();
    refreshAll();
    const timer = setInterval(() => refreshAll(), 30000);
    return () => clearInterval(timer);
  }, [refreshAll]);

  const handleQuery = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  const handleExport = useCallback(() => {
    void exportCsv();
  }, [exportCsv]);

  const handleExportReport = useCallback(() => {
    void exportReport();
  }, [exportReport]);

  const handleQuickRange = useCallback(
    (hours: number) => {
      setQueryParams({ timeRange: recentTimeRange(hours) });
      refreshAll();
    },
    [setQueryParams, refreshAll],
  );

  // 任何筛选变更：立即按新条件重查全部表 + 统计 + 报告 + 图表，不等 30s 轮询
  const runFilter = useCallback(
    (patch: Partial<LogQueryParams>) => {
      setQueryParams(patch);
      refreshAll();
    },
    [setQueryParams, refreshAll],
  );

  // 点选分控器画像：切换该设备在多选集合中的成员身份（再次点同一台 = 取消），
  // 支持同时选中多台分控器一起过滤日志。
  const handleToggleDevice = useCallback(
    (id: string) => {
      const cur = useLogMonitorStore.getState().selectedDeviceIds;
      const next = cur.includes(id)
        ? cur.filter((x) => x !== id)
        : [...cur, id];
      runFilter({ selectedDeviceIds: next });
    },
    [runFilter],
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        background: "linear-gradient(180deg, rgba(22,38,62,0.92) 0%, rgba(16,28,48,0.95) 100%)",
        border: "1px solid rgba(120,144,156,0.4)",
        borderRadius: 1.5,
        p: 1.5,
        gap: 1.2,
      }}
    >
      {/* 主体：表单紧凑排布，占满上半部 */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
      {/* 标题栏 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Box sx={{ width: 3, height: 14, background: "#B0BEC5", borderRadius: 0.5 }} />
        <Typography sx={{ fontSize: 13, color: "#B0BEC5", fontWeight: 700, letterSpacing: 1 }}>
          {title}
        </Typography>
      </Box>

      {/* 快捷时间范围 */}
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", flexShrink: 0 }}>
        {QUICK_RANGES.map((r) => (
          <Button
            key={r.hours}
            size="small"
            variant="outlined"
            onClick={() => handleQuickRange(r.hours)}
            sx={{
              minWidth: 0,
              py: 0.15,
              px: 0.8,
              fontSize: 10,
              color: "rgba(176,190,197,0.8)",
              borderColor: "rgba(120,144,156,0.4)",
              "&:hover": {
                borderColor: "rgba(90,158,214,0.7)",
                bgcolor: "rgba(90,158,214,0.1)",
              },
            }}
          >
            {r.label}
          </Button>
        ))}
      </Box>

      {/* 时间范围 - 开始 */}
      <TextField
        label="开始时间"
        type="datetime-local"
        size="small"
        fullWidth
        value={toDateTimeLocalValue(timeRange.from)}
        onChange={(e) => {
          const val = fromDateTimeLocalValue(e.target.value);
          if (val) {
            setQueryParams({ timeRange: { ...timeRange, from: val } });
            refreshAllDebounced();
          }
        }}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={textFieldSx}
      />

      {/* 时间范围 - 结束 */}
      <TextField
        label="结束时间"
        type="datetime-local"
        size="small"
        fullWidth
        value={toDateTimeLocalValue(timeRange.to)}
        onChange={(e) => {
          const val = fromDateTimeLocalValue(e.target.value);
          if (val) {
            setQueryParams({ timeRange: { ...timeRange, to: val } });
            refreshAllDebounced();
          }
        }}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={textFieldSx}
      />

      {/* 当前监控集控器 + 子控器：完全镜像喷雾控制工具栏的渲染逻辑
          （主集控器 = selectedControllerIds；子控器按 productCode=18001 && parentId 扫描，与工具栏同口径） */}
      {scopeMode === "scene" && selectedControllerIds.length > 0 ? (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Box sx={{ width: 3, height: 14, background: "#5A9ED6", borderRadius: 0.5 }} />
            <Typography sx={{ fontSize: 12.5, color: "#CFE3F2", fontWeight: 700, letterSpacing: 1 }}>
              当前监控集控器
            </Typography>
            <Typography sx={{ fontSize: 11, color: "rgba(176,190,197,0.75)" }}>
              {selectedControllerIds.length}集控 · {subControllers.length}分控
            </Typography>
            <ButtonBase
              onClick={() => runFilter({ selectedDeviceIds: [] })}
              sx={{
                ml: "auto", px: 1, py: 0.25, borderRadius: 0.75, fontSize: 11,
                color: selectedDeviceIds.length === 0 ? "#fff" : "rgba(255,255,255,0.6)",
                backgroundColor: selectedDeviceIds.length === 0 ? "rgba(90,158,214,0.5)" : "rgba(255,255,255,0.06)",
                border: "1px solid", borderColor: selectedDeviceIds.length === 0 ? "rgba(90,158,214,0.7)" : "rgba(255,255,255,0.15)",
                "&:hover": { backgroundColor: selectedDeviceIds.length === 0 ? "rgba(90,158,214,0.6)" : "rgba(255,255,255,0.13)" },
              }}
            >
              全部设备
            </ButtonBase>
          </Box>

          {/* 主集控器卡片（展示用，一眼知日志归属；与工具栏一致只渲染绑定台数） */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: subControllers.length > 0 ? 1 : 0 }}>
            {selectedControllerIds.map((cid) => {
              const dev = devices[cid];
              if (!dev) {
                return (
                  <Typography key={cid} sx={{ fontSize: 11, color: "rgba(176,190,197,0.6)" }}>
                    集控器 {cid}（设备未加载）
                  </Typography>
                );
              }
              const prodKey =
                typeof dev.productCode === "number"
                  ? DEFAULT_PRODUCT_CODE_MAPPING[dev.productCode]
                  : dev.productCode;
              const prod =
                (prodKey ? products[prodKey as string] : undefined) ??
                (typeof dev.productCode === "string" ? products[dev.productCode] : undefined);
              // 悬浮详情：仅统计本集控器子树内的分控器 / 传感器数量
              const md = (dev.metadata ?? {}) as Record<string, unknown>;
              const net = (md.network ?? {}) as Record<string, unknown>;
              const ip = ((net.ip as string) || (md.ip as string) || "—") as string;
              const subCount = Object.values(devices).filter(
                (d) => d.parentDeviceId === cid && d.category === "sub",
              ).length;
              let sensorCount = 0;
              for (const sub of Object.values(devices)) {
                if (sub.parentDeviceId === cid && sub.category === "sub") {
                  sensorCount += Object.values(devices).filter(
                    (d) => d.parentDeviceId === sub.deviceId && d.category === "sensor",
                  ).length;
                }
              }
              const detail = (
                <Box sx={{ p: 1, minWidth: 210 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#E8F0F6", mb: 0.5 }}>
                    {dev.productName || "喷雾集控器"}
                  </Typography>
                  <DetailRow label="设备ID" value={dev.deviceId} />
                  <DetailRow
                    label="状态"
                    value={dev.online ? "在线" : "离线"}
                    valueColor={dev.online ? "#3CCB7F" : "#9E9E9E"}
                  />
                  <DetailRow label="产品码" value={String(dev.productCode)} />
                  <DetailRow label="IP地址" value={ip} />
                  <DetailRow label="分控器" value={`${subCount} 台`} />
                  <DetailRow label="传感器" value={`${sensorCount} 台`} />
                </Box>
              );
              return (
                <Box key={cid} sx={{ position: "relative", width: "100%", height: 225 }}>
                  {/* 卡片本体（放大 1/2：150 → 225） */}
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 1,
                      overflow: "hidden",
                      border: "1px solid rgba(120,144,156,0.35)",
                      bgcolor: "rgba(10,16,28,0.45)",
                    }}
                  >
                    <ControlPanelRenderer
                      device={dev}
                      product={prod}
                      width={240}
                      height={225}
                      mode="preview"
                      isTemplate={false}
                      hideScreenContent={false}
                    />
                  </Box>
                  {/* 透明悬浮层：触发详情 Tooltip（不破坏面板 flex 布局） */}
                  <Tooltip title={detail} arrow placement="right" enterDelay={120} leaveDelay={80}>
                    <Box sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                  </Tooltip>
                </Box>
              );
            })}
          </Box>

          {/* 子控器卡片（点击 = 按该设备过滤日志，镜像工具栏"选择事件"） */}
          {subControllers.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {subControllers.map((d) => {
                const info = toSubInfo(d);
                const selected = selectedDeviceIds.includes(d.deviceId);
                return (
                  <Box
                    key={d.deviceId}
                    sx={{ width: 96, height: 132, position: "relative", flexShrink: 0, transform: "scale(0.82)", transformOrigin: "top left" }}
                  >
                    <SubControllerCard
                      ctrl={info}
                      selected={selected}
                      feedback={NEUTRAL_FEEDBACK}
                      flashing={false}
                      pending={false}
                      mainControllerCount={selectedControllerIds.length}
                      onToggle={(id) => handleToggleDevice(id)}
                      mapControllerStatus={mapControllerStatus}
                      mapStatusVisual={mapStatusVisual}
                      buildScreenItems={buildScreenItems}
                    />
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 11, color: "rgba(176,190,197,0.6)", px: 0.5 }}>
          {scopeMode === "scene" ? "主视图未绑定集控器，无可选设备" : "全矿模式"}
        </Typography>
      )}

      {/* 日志级别：按钮选择（镜像工具栏按钮风格，无下拉） */}
      <Box>
        <Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.85)", fontWeight: 600, mb: 0.5 }}>
          日志级别
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "nowrap", gap: 0.5 }}>
          {LEVEL_OPTIONS.map((o) => {
            const active = logLevel === o.value;
            return (
              <ButtonBase
                key={o.value}
                onClick={() => runFilter({ logLevel: o.value })}
                sx={{
                  px: 1.25, py: 0.4, borderRadius: 0.75, fontSize: 12.5, lineHeight: "20px", flex: 1, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center",
                  color: active ? "#fff" : "rgba(255,255,255,0.6)",
                  backgroundColor: active ? "rgba(90,158,214,0.55)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${active ? "rgba(90,158,214,0.7)" : "rgba(255,255,255,0.12)"}`,
                  "&:hover": { backgroundColor: active ? "rgba(90,158,214,0.65)" : "rgba(255,255,255,0.13)" },
                }}
              >
                {o.label}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {/* 事件类型：按钮选择（按当前 tab 区分词表；操作日志 tab 无此域，置灰提示） */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.85)", fontWeight: 600 }}>
            事件类型
          </Typography>
          {activeTab === "operation" && (
            <Typography sx={{ fontSize: 9.5, color: "rgba(176,190,197,0.5)" }}>
              （仅作用于事件表）
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, opacity: activeTab === "operation" ? 0.4 : 1 }}>
          {(TAB_EVENT_TYPE_OPTIONS[activeTab] ?? TAB_EVENT_TYPE_OPTIONS.event).map((o) => {
            const active = eventType === o.value;
            return (
              <ButtonBase
                key={o.value}
                disabled={activeTab === "operation"}
                onClick={() => activeTab !== "operation" && runFilter({ eventType: o.value })}
                sx={{
                  px: 1.25, py: 0.4, borderRadius: 0.75, fontSize: 12.5, lineHeight: "20px", flex: 1, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center",
                  color: active ? "#fff" : "rgba(255,255,255,0.6)",
                  backgroundColor: active ? "rgba(90,158,214,0.55)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${active ? "rgba(90,158,214,0.7)" : "rgba(255,255,255,0.12)"}`,
                  "&:hover": { backgroundColor: active ? "rgba(90,158,214,0.65)" : "rgba(255,255,255,0.13)" },
                  "&.Mui-disabled": { opacity: 1 },
                }}
              >
                {o.label}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
      </Box>

      {/* 操作按钮（镜像工具栏按钮风格） */}
      <Box sx={{ display: "flex", gap: 0.5, mt: 1.5, flexShrink: 0, flexWrap: "nowrap" }}>
        <ButtonBase
          onClick={handleQuery}
          disabled={loading}
          sx={{
            display: "flex", alignItems: "center", gap: 0.5, px: 1.5, py: 0.5, borderRadius: 1.25, fontSize: 13,
            backgroundColor: loading ? "rgba(90,158,214,0.4)" : "rgba(90,158,214,0.18)",
            color: "#7FD3FF", cursor: "pointer", border: "1px solid rgba(90,158,214,0.6)",
            "&:hover": { backgroundColor: "rgba(90,158,214,0.3)" },
            "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
          }}
        >
          {loading ? <CircularProgress size={14} color="inherit" /> : "查询"}
        </ButtonBase>
        {showExport && (
          <ButtonBase
            onClick={handleExport}
            disabled={exporting}
            sx={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, px: 1.75, py: 0.75, borderRadius: 1.25, fontSize: 13.5, flex: 1, minWidth: 0,
              backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(176,190,197,0.9)",
              cursor: "pointer", border: "1px solid rgba(120,144,156,0.5)",
              "&:hover": { backgroundColor: "rgba(90,158,214,0.08)", borderColor: "rgba(90,158,214,0.7)" },
              "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
            }}
          >
            {exporting ? <CircularProgress size={14} color="inherit" /> : "导出CSV"}
          </ButtonBase>
        )}
        {showExport && (
          <ButtonBase
            onClick={handleExportReport}
            disabled={exporting || !report}
            sx={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, px: 1.75, py: 0.75, borderRadius: 1.25, fontSize: 13.5, flex: 1, minWidth: 0,
              backgroundColor: report ? "rgba(90,158,214,0.12)" : "rgba(255,255,255,0.04)",
              color: report ? "#5A9ED6" : "rgba(176,190,197,0.4)",
              cursor: "pointer", border: `1px solid ${report ? "rgba(90,158,214,0.6)" : "rgba(120,144,156,0.3)"}`,
              "&:hover": { backgroundColor: "rgba(90,158,214,0.1)", borderColor: "rgba(90,158,214,0.8)" },
              "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
            }}
          >
            {exporting ? <CircularProgress size={14} color="inherit" /> : "导出报告"}
          </ButtonBase>
        )}
      </Box>

      {/* 底部填充：查询范围提示 + 导出说明，消除窄长面板空白 */}
      <Box
        sx={{
          mt: "auto",
          pt: 1.5,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            border: "1px solid rgba(120,144,156,0.25)",
            background: "rgba(16,28,48,0.5)",
          }}
        >
          <Typography sx={{ fontSize: 11, color: "#B0BEC5", fontWeight: 700, mb: 0.5 }}>
            数据范围
          </Typography>
          <Typography sx={{ fontSize: 11, color: "rgba(176,190,197,0.65)", lineHeight: 1.6 }}>
            • 本视图绑定主场景已选集控器子树下的全部设备，仅展示该范围数据。
            <br />
            • 时间默认近 24 小时，可点上方快捷区间或手动设定起止。
            <br />
            • 查询会同步刷新右侧表格、图表与概览统计。
            <br />
            • 「导出报告」需在数据加载完成后可用（约 30s 自动刷新）。
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** 暗色主题 TextField 样式 */
const textFieldSx = {
  "& .MuiInputLabel-root": {
    color: "rgba(176,190,197,0.7)",
    fontSize: 12,
  },
  "& .MuiOutlinedInput-root": {
    color: "#e0e8f0",
    fontSize: 12,
    "& fieldset": {
      borderColor: "rgba(120,144,156,0.4)",
    },
    "&:hover fieldset": {
      borderColor: "rgba(90,158,214,0.6)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "rgba(90,158,214,0.8)",
    },
  },
  "& .MuiSelect-icon": {
    color: "rgba(176,190,197,0.6)",
  },
  "& input": {
    colorScheme: "dark",
  },
} as const;
