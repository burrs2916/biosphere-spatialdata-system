/**
 * TimingCardRenderer — 定时列表卡片组件（协议对齐版）
 *
 * 严格对齐协议 0x0616/0617/0620/0621：
 *   - 选择集控器（config.selectedDeviceIds）→ 自动发现其下属分控器
 *   - 0x0605 级联自动推送 0x0621 帧 → 分控器时间槽数据自动到达
 *   - 四种数据状态：noData / loaded / allDisabled / pending
 *   - 紧凑展示：只显示启用的时间段 chip
 *   - "刷新"按钮发送 0x0620，"编辑"按钮打开 WorkTimeDialog 下发 0x0621
 *   - 集控器全局时间（0x0616 获取 / 0x0617 设置）也支持
 *
 * position 提取：
 *   分控器 deviceId 格式为 "{集控器ID}_{controllerId}"，
 *   extractControllerId() 从末尾提取 controllerId 即为 position。
 */

import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import type { ComponentRendererProps } from "../../../types/editor";
import { useDeviceStore } from "../../../store/deviceStore";
import { useThrottledDevices } from "../../../hooks/useThrottledDevices";
import { DEVICE_COMMANDS } from "../../../devices/deviceCommands";
import { WorkTimeDialog, WorkTimeSlot } from "./SprayDialogs";
import {
  discoverMainControllerIds,
  isSubControllerDevice,
} from "../../../devices/productCodePredicates";

// ── 常量 ──
// 集控器/分控器产品码判定统一走 devices/productCodePredicates
// （兼容 "18"/"18001" 与 "FY002-MainController"/"FY002-SubController-Spray" 双形态）
const MAX_SLOTS = 6;

/** 默认时间槽（6个，全部禁用） */
const DEFAULT_SLOTS: WorkTimeSlot[] = Array.from({ length: MAX_SLOTS }, () => ({
  enabled: 0, startMinute: 0, endMinute: 0,
}));

/** 从 deviceId 中提取分控器协议编号 (1字节, 0-255) */
function extractControllerId(deviceId: string): number | null {
  const parts = deviceId.split(/[-\s_.]+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const n = Number(parts[i]);
    if (Number.isFinite(n) && n >= 0 && n <= 255 && String(n) === parts[i]) {
      return n;
    }
  }
  return null;
}

/** 分钟数转 HH:mm */
function minuteToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── 数据读取 ──

/** 时间槽数据状态 */
type DataState = "noData" | "loaded" | "allDisabled";

/** 从分控器的 metadata.realtime 中提取 workTimeSlots
 *  deviceStore WebSocket 推送路径: metadata.realtime.workTimeSlots = { value: [...], timestamp, quality }
 *  返回 null 表示无数据（noData 状态），返回数组表示已加载
 */
function getWorkTimeSlotsFromDevice(
  device: Record<string, unknown> | undefined,
  debugId?: string,
): { state: DataState; slots: WorkTimeSlot[] } {
  if (!device) {
    console.debug("[TimingCard] getWorkTimeSlots: device 为空", debugId);
    return { state: "noData", slots: DEFAULT_SLOTS };
  }
  const md = device.metadata as Record<string, unknown> | undefined;
  if (!md) {
    console.debug("[TimingCard] getWorkTimeSlots: metadata 为空", debugId);
    return { state: "noData", slots: DEFAULT_SLOTS };
  }
  const realtime = (md.realtime ?? {}) as Record<string, unknown>;
  // deviceStore 包装格式: { value: actualValue, timestamp, quality }
  const slotEntry = realtime.workTimeSlots as Record<string, unknown> | undefined;
  const slotsArr = (slotEntry?.value ?? slotEntry) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(slotsArr) || slotsArr.length === 0) {
    console.debug("[TimingCard] getWorkTimeSlots: 无 workTimeSlots 数据", {
      debugId,
      realtimeKeys: Object.keys(realtime),
      hasSlotEntry: !!slotEntry,
      slotEntryValue: slotEntry?.value,
    });
    return { state: "noData", slots: DEFAULT_SLOTS };
  }
  const result: WorkTimeSlot[] = slotsArr.map((s) => ({
    enabled: Number(s.enabled ?? 0),
    startMinute: (Number(s.startHour ?? 0)) * 60 + Number(s.startMinute ?? 0),
    endMinute: (Number(s.endHour ?? 0)) * 60 + Number(s.endMinute ?? 0),
  }));
  const enabledCount = result.filter((s) => s.enabled).length;
  const state: DataState = enabledCount === 0 ? "allDisabled" : "loaded";
  console.debug("[TimingCard] getWorkTimeSlots: 解析成功", {
    debugId, state, slotCount: result.length, enabledCount,
    slots: result.map((s, i) => `#${i}: en=${s.enabled} ${minuteToHHMM(s.startMinute)}-${minuteToHHMM(s.endMinute)}`),
  });
  return { state, slots: result };
}

/** 分控器简要信息 */
interface SubControllerBrief {
  deviceId: string;
  position: number;
  name: string;
  online: boolean;
  parentDeviceId: string;
  parentName: string;
}

// ══════════════════════════════════════════════════════════════════
//  主组件
// ══════════════════════════════════════════════════════════════════

export function TimingCardRenderer({ config }: ComponentRendererProps) {
  const hasPermission = (config.hasPermission as boolean) ?? true;

  // ── deviceStore ──
  const devicesMap = useThrottledDevices(500);
  const getEffectiveOnline = useDeviceStore((s) => s.getEffectiveOnline);
  const sendCommand = useDeviceStore((s) => s.sendCommand);

  // ── 集控器发现（真实 API 动态获取，留空 = 不显示，需绑定集控器）──
  const rawSelectedIds = (config.selectedDeviceIds as string[]) ?? [];
  const mainControllerIds = useMemo(
    () => discoverMainControllerIds(devicesMap, rawSelectedIds),
    [rawSelectedIds, devicesMap],
  );

  // ── 分控器发现 ──
  const subControllers = useMemo(() => {
    const result: SubControllerBrief[] = [];
    for (const mcId of mainControllerIds) {
      const mainCtrl = devicesMap[mcId] as Record<string, unknown> | undefined;
      const parentName = String(mainCtrl?.productName ?? mcId);
      for (const d of Object.values(devicesMap)) {
        const parentId = String(d.parentDeviceId ?? "");
        if (!isSubControllerDevice(d) || parentId !== mcId) continue;

        const deviceId = String(d.deviceId);
        const position = extractControllerId(deviceId);
        if (position === null) continue;

        result.push({
          deviceId,
          position,
          name: String(d.productName ?? `分控器-${position}`),
          online: getEffectiveOnline(deviceId),
          parentDeviceId: mcId,
          parentName,
        });
      }
    }
    result.sort((a, b) => a.position - b.position);
    // 诊断日志：分控器发现结果
    if (result.length > 0) {
      console.debug("[TimingCard] 分控器发现:", {
        count: result.length,
        controllers: result.map(c => ({
          id: c.deviceId, pos: c.position, name: c.name, online: c.online,
          // 检查该设备的 metadata.realtime 是否有 workTimeSlots
          realtimeKeys: Object.keys(((devicesMap[c.deviceId] as any)?.metadata?.realtime ?? {}) as Record<string, unknown>),
          hasWorkTimeSlots: !!((devicesMap[c.deviceId] as any)?.metadata?.realtime?.workTimeSlots),
        })),
      });
    }
    return result;
  }, [mainControllerIds, devicesMap, getEffectiveOnline]);

  // ── 对话框状态 ──
  const [workTimeOpen, setWorkTimeOpen] = useState(false);
  const [workTimeSlots, setWorkTimeSlots] = useState<WorkTimeSlot[]>(DEFAULT_SLOTS);
  const [workTimeLoading, setWorkTimeLoading] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    type: "main" | "sub";
    mainControllerId: string;
    position?: number;
    name?: string;
  } | null>(null);

  // ── pending 状态（下发中的分控器 key: "{mainId}_{position}"） ──
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  // ── refreshing 状态（刷新中的分控器 deviceId） ──
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  // ── 消息提示 ──
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false, message: "", severity: "info",
  });

  // ── 判断当前是否在某个时间槽内 ──
  const isCurrentActive = (startMinute: number, endMinute: number) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes >= startMinute && currentMinutes <= endMinute;
  };

  // ── 刷新单个分控器（0x0620） ──
  const handleRefresh = useCallback(async (ctrl: SubControllerBrief) => {
    console.info("[TimingCard] ↻ 刷新分控器:", { deviceId: ctrl.deviceId, position: ctrl.position, parentDeviceId: ctrl.parentDeviceId });
    setRefreshingIds((prev) => new Set(prev).add(ctrl.deviceId));
    try {
      const result = await sendCommand(ctrl.parentDeviceId, DEVICE_COMMANDS.FETCH_SUB_WORK_TIME, { position: ctrl.position });
      console.info("[TimingCard] ↻ 刷新结果:", { success: result.success, code: result.code, msg: result.msg });
      if (result.success) {
        setSnackbar({ open: true, message: `已请求 ${ctrl.name} 工作时间`, severity: "info" });
      } else {
        setSnackbar({ open: true, message: `刷新失败(${result.code}): ${result.msg}`, severity: "error" });
      }
    } catch (e) {
      console.error("[TimingCard] ↻ 刷新异常:", e);
      setSnackbar({ open: true, message: `刷新异常: ${e}`, severity: "error" });
    } finally {
      setRefreshingIds((prev) => { const s = new Set(prev); s.delete(ctrl.deviceId); return s; });
    }
  }, [sendCommand]);

  // ── 刷新全部（0x0616 集控器级） ──
  const handleRefreshAll = useCallback(async () => {
    console.info("[TimingCard] ↻ 刷新全部:", { mainControllerIds });
    for (const mcId of mainControllerIds) {
      try {
        const result = await sendCommand(mcId, DEVICE_COMMANDS.FETCH_WORK_TIME);
        console.info("[TimingCard] ↻ 刷新全部结果:", { mcId, success: result.success, msg: result.msg });
        if (result.success) {
          setSnackbar({ open: true, message: `已请求集控器工作时间`, severity: "info" });
        } else {
          setSnackbar({ open: true, message: `刷新全部失败: ${result.msg}`, severity: "error" });
        }
      } catch (e) {
        console.error("[TimingCard] ↻ 刷新全部异常:", e);
        setSnackbar({ open: true, message: `刷新全部异常: ${e}`, severity: "error" });
      }
    }
  }, [mainControllerIds, sendCommand]);

  // ── 打开分控器工作时间编辑 ──
  const openSubWorkTimeEditor = useCallback((ctrl: SubControllerBrief) => {
    setEditingTarget({ type: "sub", mainControllerId: ctrl.parentDeviceId, position: ctrl.position, name: ctrl.name });
    const { slots } = getWorkTimeSlotsFromDevice(devicesMap[ctrl.deviceId] as Record<string, unknown> | undefined, ctrl.deviceId);
    setWorkTimeSlots(slots);
    setWorkTimeOpen(true);
  }, [devicesMap]);

  // ── 打开集控器全局时间编辑 ──
  const openMainWorkTimeEditor = useCallback((mcId: string) => {
    const mc = devicesMap[mcId] as Record<string, unknown> | undefined;
    const name = String(mc?.productName ?? mcId);
    setEditingTarget({ type: "main", mainControllerId: mcId, name });
    // 集控器也可能有 realtime 数据
    const { slots } = getWorkTimeSlotsFromDevice(mc, mcId);
    setWorkTimeSlots(slots);
    setWorkTimeOpen(true);
  }, [devicesMap]);

  // ── 确认下发工作时间 ──
  const handleWorkTimeSubmit = useCallback(async () => {
    if (!editingTarget) return;

    // 时间校验：启用的槽必须 start < end
    for (let i = 0; i < workTimeSlots.length; i++) {
      const s = workTimeSlots[i];
      if (s.enabled && s.startMinute >= s.endMinute) {
        setSnackbar({ open: true, message: `时段${i + 1}: 起始时间必须早于结束时间`, severity: "error" });
        return;
      }
    }

    setWorkTimeLoading(true);
    const slotsSummary = workTimeSlots.map((s, i) =>
      `#${i}: en=${s.enabled} ${minuteToHHMM(s.startMinute)}-${minuteToHHMM(s.endMinute)}`
    ).join(", ");
    console.info("[TimingCard] 📤 下发工作时间:", {
      type: editingTarget.type,
      mainControllerId: editingTarget.mainControllerId,
      position: editingTarget.position,
      name: editingTarget.name,
      slotCount: workTimeSlots.length,
      slots: slotsSummary,
    });

    // 设置 pending 状态
    if (editingTarget.type === "sub" && editingTarget.position !== undefined) {
      const key = `${editingTarget.mainControllerId}_${editingTarget.position}`;
      setPendingKeys((prev) => new Set(prev).add(key));
    }

    try {
      let result;
      if (editingTarget.type === "sub") {
        result = await sendCommand(
          editingTarget.mainControllerId,
          DEVICE_COMMANDS.SET_SUB_WORK_TIME,
          { position: editingTarget.position, slots: workTimeSlots },
        );
      } else {
        result = await sendCommand(
          editingTarget.mainControllerId,
          DEVICE_COMMANDS.SET_WORK_TIME,
          { slots: workTimeSlots },
        );
      }
      console.info("[TimingCard] 📤 下发结果:", { success: result.success, msg: result.msg });
      if (result.success) {
        setSnackbar({ open: true, message: `工作时间已下发`, severity: "success" });
        setWorkTimeOpen(false);
        setEditingTarget(null);
        // pending 最小显示 1.5s，之后由 WebSocket 推送自动更新
        if (editingTarget.type === "sub" && editingTarget.position !== undefined) {
          const key = `${editingTarget.mainControllerId}_${editingTarget.position}`;
          setTimeout(() => {
            setPendingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
          }, 1500);
        }
      } else {
        setSnackbar({ open: true, message: `下发失败: ${result.msg}`, severity: "error" });
        // 下发失败时清除 pending
        if (editingTarget.type === "sub" && editingTarget.position !== undefined) {
          const key = `${editingTarget.mainControllerId}_${editingTarget.position}`;
          setPendingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
        }
      }
    } catch (e) {
      console.error("[TimingCard] 📤 下发异常:", e);
      setSnackbar({ open: true, message: `下发异常: ${e}`, severity: "error" });
      if (editingTarget.type === "sub" && editingTarget.position !== undefined) {
        const key = `${editingTarget.mainControllerId}_${editingTarget.position}`;
        setPendingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      }
    } finally {
      setWorkTimeLoading(false);
    }
  }, [editingTarget, workTimeSlots, sendCommand]);

  // ══════════════════════════════════════════════════════════════════
  //  渲染
  // ══════════════════════════════════════════════════════════════════

  // ── 无集控器选中 ──
  if (mainControllerIds.length === 0) {
    return (
      <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "rgba(0,20,40,0.6)", borderRadius: 1, border: "1px solid rgba(255,152,0,0.3)", padding: 1.5, gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AccessTimeIcon sx={{ color: "#f59e0b", fontSize: 20 }} />
          <Typography sx={{ color: "#f59e0b", fontSize: 14, fontWeight: 600 }}>定时任务设置</Typography>
        </Box>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center" }}>
            请在属性面板绑定集控器
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "rgba(0,20,40,0.6)", borderRadius: 1, border: "1px solid rgba(255,152,0,0.3)", padding: 1.5, gap: 1, overflow: "auto" }}>
      {/* ── 标题栏 ── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AccessTimeIcon sx={{ color: "#f59e0b", fontSize: 20 }} />
        <Typography sx={{ color: "#f59e0b", fontSize: 14, fontWeight: 600, flex: 1 }}>定时任务设置</Typography>
        {hasPermission && mainControllerIds.length > 0 && (
          <IconButton
            size="small"
            onClick={handleRefreshAll}
            sx={{ p: 0.25, color: "rgba(59,130,246,0.7)", "&:hover": { color: "#3b82f6" } }}
            title="刷新全部（0x0616）"
          >
            <RefreshIcon sx={{ fontSize: 15 }} />
          </IconButton>
        )}
      </Box>

      {/* ── 集控器标签 ── */}
      {mainControllerIds.length > 1 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {mainControllerIds.map((mcId) => {
            const mc = devicesMap[mcId] as Record<string, unknown> | undefined;
            const name = String(mc?.productName ?? mcId);
            return (
              <Chip key={mcId} label={name} size="small" sx={{ fontSize: 10, height: 20, backgroundColor: "rgba(245,158,11,0.15)", color: "#f59e0b" }} />
            );
          })}
        </Box>
      )}

      {/* ── 分控器定时列表 ── */}
      {subControllers.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, flex: 1, overflow: "auto" }}>
          {subControllers.map((ctrl) => {
            const { state: dataState, slots } = getWorkTimeSlotsFromDevice(
              devicesMap[ctrl.deviceId] as Record<string, unknown> | undefined,
              ctrl.deviceId,
            );
            const enabledSlots = slots.filter((s) => s.enabled);
            const isPending = pendingKeys.has(`${ctrl.parentDeviceId}_${ctrl.position}`);
            const isRefreshing = refreshingIds.has(ctrl.deviceId);

            return (
              <Box
                key={ctrl.deviceId}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.25,
                  padding: "6px 8px",
                  backgroundColor: ctrl.online ? "rgba(255,255,255,0.04)" : "rgba(107,114,128,0.08)",
                  borderRadius: 1,
                  border: `1px solid ${ctrl.online ? "rgba(255,255,255,0.08)" : "rgba(107,114,128,0.15)"}`,
                  opacity: ctrl.online ? 1 : 0.6,
                  position: "relative",
                }}
              >
                {/* pending 进度条 */}
                {isPending && (
                  <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: 1 }} />
                )}

                {/* 分控器标题行 */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography sx={{ color: "#fff", fontSize: 12, fontWeight: 600, flex: 1 }}>
                    {ctrl.name}
                  </Typography>
                  {/* 数据状态标签 */}
                  {dataState === "noData" && (
                    <Chip label="等待数据" size="small" sx={{ fontSize: 9, height: 16, backgroundColor: "rgba(107,114,128,0.2)", color: "#9ca3af" }} />
                  )}
                  {dataState === "allDisabled" && (
                    <Chip label="全部停用" size="small" sx={{ fontSize: 9, height: 16, backgroundColor: "rgba(107,114,128,0.15)", color: "#6b7280" }} />
                  )}
                  {dataState === "loaded" && (
                    <Chip label={`${enabledSlots.length}/${slots.length}启用`} size="small" sx={{ fontSize: 9, height: 16, backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }} />
                  )}
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: ctrl.online ? "#4ade80" : "#6b7280", ml: 0.5 }} />
                </Box>

                {/* 时间槽数据区：按状态分支 */}
                <Box sx={{ ml: 1, minHeight: 18 }}>
                  {dataState === "noData" && (
                    <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontStyle: "italic" }}>
                      等待数据...
                    </Typography>
                  )}
                  {dataState === "allDisabled" && (
                    <Typography sx={{ color: "#6b7280", fontSize: 11 }}>
                      已加载 · 全部停用
                    </Typography>
                  )}
                  {dataState === "loaded" && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                      {enabledSlots.map((slot, idx) => {
                        const active = isCurrentActive(slot.startMinute, slot.endMinute);
                        return (
                          <Chip
                            key={idx}
                            label={`${minuteToHHMM(slot.startMinute)}-${minuteToHHMM(slot.endMinute)}`}
                            size="small"
                            sx={{
                              fontSize: 10,
                              height: 18,
                              backgroundColor: active ? "rgba(74,222,128,0.2)" : "rgba(59,130,246,0.15)",
                              color: active ? "#4ade80" : "#93c5fd",
                              border: active ? "1px solid rgba(74,222,128,0.4)" : "none",
                              fontFamily: "monospace",
                            }}
                          />
                        );
                      })}
                    </Box>
                  )}
                </Box>

                {/* 操作按钮 */}
                {hasPermission && (
                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5, mt: 0.25 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleRefresh(ctrl)}
                      disabled={!ctrl.online || isRefreshing}
                      sx={{ p: 0.25, color: "rgba(59,130,246,0.7)", "&:hover": { color: "#3b82f6" }, "&:disabled": { opacity: 0.3 } }}
                      title="刷新（0x0620）"
                    >
                      <RefreshIcon sx={{ fontSize: 14, animation: isRefreshing ? "spin 1s linear infinite" : "none" }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => openSubWorkTimeEditor(ctrl)}
                      disabled={!ctrl.online}
                      sx={{ p: 0.25, color: "rgba(167,139,250,0.7)", "&:hover": { color: "#a78bfa" }, "&:disabled": { opacity: 0.3 } }}
                      title="编辑时间设置（0x0621）"
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>未发现分控器</Typography>
        </Box>
      )}

      {/* ── 集控器全局定时入口 ── */}
      {hasPermission && mainControllerIds.map((mcId) => {
        const mc = devicesMap[mcId] as Record<string, unknown> | undefined;
        const mcOnline = getEffectiveOnline(mcId);
        const name = String(mc?.productName ?? mcId);
        return (
          <Box key={mcId} sx={{ display: "flex", alignItems: "center", gap: 0.5, padding: "4px 8px", backgroundColor: "rgba(245,158,11,0.06)", borderRadius: 1 }}>
            <SettingsIcon sx={{ fontSize: 13, color: "rgba(245,158,11,0.5)" }} />
            <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: 11, flex: 1 }}>
              {name} 全局定时
            </Typography>
            <IconButton
              size="small"
              onClick={() => openMainWorkTimeEditor(mcId)}
              disabled={!mcOnline}
              sx={{ p: 0.25, color: "rgba(167,139,250,0.7)", "&:hover": { color: "#a78bfa" }, "&:disabled": { opacity: 0.3 } }}
              title="编辑集控器全局时间（0x0617）"
            >
              <EditIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Box>
        );
      })}

      {/* ── 当前时间 ── */}
      <Box sx={{ padding: "4px 8px", backgroundColor: "rgba(59,130,246,0.1)", borderRadius: 1, textAlign: "center" }}>
        <Typography sx={{ color: "#3b82f6", fontSize: 11, fontFamily: "monospace" }}>
          {new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </Typography>
      </Box>

      {/* ── WorkTimeDialog 编辑弹窗 ── */}
      <WorkTimeDialog
        open={workTimeOpen}
        slots={workTimeSlots}
        loading={workTimeLoading}
        onClose={() => { setWorkTimeOpen(false); setEditingTarget(null); }}
        onSubmit={handleWorkTimeSubmit}
        onSlotsChange={setWorkTimeSlots}
        position={editingTarget?.type === "sub" ? editingTarget.position : undefined}
        controllerName={editingTarget?.name}
      />

      {/* ── 消息提示 ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} sx={{ fontSize: 12 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
