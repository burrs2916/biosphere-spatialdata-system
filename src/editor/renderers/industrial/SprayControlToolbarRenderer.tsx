/**
 * SprayControlToolbarRenderer — 喷雾控制工具栏
 *
 * 协议对齐：
 *   - 0619 喷洒控制：controlMode / controlWord / controlPosition / controllerIds
 *   - 061b 循环喷洒：continuousCurtainCount / sprayDurationSecs / stopDurationSecs
 *   - 0613 获取喷雾参数（无参）
 *
 * 反馈链路（已对齐 edge-conductor 实际推送）：
 *   - 0x061e 设备主动上报 → data_processor.rs 解析为 tag_values
 *     推送给前端的 key：
 *       - "controllerState"  (1B 位域：bit0前喷 bit1后喷 bit2清洗 bit3电池 bit4通讯 bit5前强 bit6后强 bit7前清洗)
 *       - "batteryWarning"   (2B 电池告警位，0=无，bit 位参见协议)
 *   - 前端写入 deviceStore.metadata.realtime.{controllerState,batteryWarning}
 *   - 渲染器从 metadata.realtime 读取并解析为可视化状态
 *
 * 交互设计：
 *   - 绑定集控器后，自动发现并渲染其下属分控器卡片（productCode=18001 + parentDeviceId）
 *   - 点击分控器卡片多选/取消（Shift+点击=单选）
 *   - 分控器卡片显示在线/故障/喷洒状态，状态变化时卡片闪动 800ms（高亮反馈）
 *   - 工具栏"全选当前集控器/全不选"快捷操作，多集控器时按集控器分组
 *   - 底部操作日志：最近 10 条指令记录（时间戳 + 动作 + 目标 + 结果）
 *   - 强喷-强停互斥：任一指令执行中其他指令按钮禁用
 *
 * 设计目标（对比老项目 sprayv2 增强点）：
 *   1. 选中 → 工具栏多选 + 高亮 + 单选模式，比老项目"按编号按钮"更直观
 *   2. 状态变化高亮（闪动）：操作员一眼看到"刚刚这条数据是新的"
 *   3. 操作日志：故障复盘有据可查
 *   4. 离线/故障分控器自动置灰，指令下发前自动跳过
 *   5. 后端 CommandResult{success,code,msg} 用于"已下发/参数错误/集控器离线"等
 *      细粒度提示（老项目只 R.ok 不分）
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import SyncIcon from "@mui/icons-material/Sync";
import LoopIcon from "@mui/icons-material/Loop";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import DeselectIcon from "@mui/icons-material/Deselect";
import ClearIcon from "@mui/icons-material/Clear";
import HistoryIcon from "@mui/icons-material/History";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import TuneIcon from "@mui/icons-material/Tune";
import type { ComponentRendererProps } from "../../../types/editor";
import { logger } from "../../../utils/logger";
import { DEVICE_COMMANDS } from "../../../devices/deviceCommands";
import { useDeviceStore } from "../../../store/deviceStore";
import type { DeviceLiveStatus, StatusVisual } from "../deviceVariants/deviceStatus";
import {
  parseControllerState,
  getSprayStatusText,
  isAnySpraying,
} from "../deviceVariants/deviceStatus";
import { injectSprayControlCSS, type VisualFeedback } from "./sprayControlStyles";
import { SubControllerCard, type SubControllerInfo } from "./SubControllerCard";
import { SprayParamsDialog, WorkTimeDialog, LoopParamsDialog } from "./SprayDialogs";
import { useSprayControlLog, type ControlAction } from "../../../store/sprayLogStore";
import {
  discoverMainControllerIds,
  isSubControllerDevice,
} from "../../../devices/productCodePredicates";

// ─── 按钮定义 ───

// controlPosition 枚举（对齐协议 字段解析规则.json controlPosition）
// 0=全控 1=前喷 2=后喷 3=清洗
type ControlPosition = 0 | 1 | 2 | 3;
const CONTROL_POSITION_LABELS: Record<ControlPosition, string> = {
  0: "全控", 1: "前喷", 2: "后喷", 3: "清洗",
};

// ControlAction 已抽取到 SprayControlLog.ts，此处通过 import 引入

interface ControlButton {
  id: ControlAction;
  label: string;
  icon: React.ReactNode;
  color: string;
  group: "control" | "cycle" | "config";
  /** 需要额外的 controlPosition 选择器 */
  needsPosition?: boolean;
  sceneFilter?: string[];
}

const CONTROL_BUTTONS: ControlButton[] = [
  { id: "forceSpray",  label: "强喷",    icon: <WaterDropIcon />,        color: "#3b82f6", group: "control", needsPosition: true },
  { id: "forceStop",   label: "强停",    icon: <PowerSettingsNewIcon />, color: "#ef4444", group: "control", needsPosition: true },
  { id: "autoMode",    label: "自动",    icon: <AutorenewIcon />,        color: "#f59e0b", group: "control" },
  { id: "fetchParams", label: "获取参数", icon: <SyncIcon />,             color: "#8b5cf6", group: "config" },
  { id: "setSprayParams", label: "喷雾参数", icon: <TuneIcon />,         color: "#06b6d4", group: "config" },
  { id: "setWorkTime",    label: "工作时间", icon: <HistoryIcon />,      color: "#a78bfa", group: "config" },
  // 廊桥(bridge)以"循环冲洗/循环喷雾"为招牌特性（老项目 showlq 的 langqiaoxunhuan），
  // 协议 0x061b 循环喷洒设置支持。原 sceneFilter 仅 ["cycle"] 导致 bridge 模式被隐藏，
  // 现放开到 ["cycle","bridge"]，使廊桥工具栏显示"循环喷/停循环"。
  { id: "loopStart",   label: "循环喷",  icon: <LoopIcon />,             color: "#10b981", group: "cycle", sceneFilter: ["cycle", "bridge"] },
  { id: "loopStop",    label: "停循环",  icon: <StopCircleIcon />,       color: "#f97316", group: "cycle", sceneFilter: ["cycle", "bridge"] },
];

// ─── 0619 命令参数构造 ───

interface SprayControlParams {
  controlMode: number;
  controlWord: number;
  controlPosition: number;
  controllerIds: number[];
}

/**
 * 从 deviceId 中提取分控器协议编号 (1字节, 0-255)
 * deviceId 格式: "DEV-18002-001" / "18002-1" / "controller-7" 等
 * 优先取最后一段的纯数字部分，0-255 范围内才有效
 */
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

function buildSprayControlPayload(
  action: ControlAction,
  controllerIds: number[],
  controlPosition: ControlPosition = 0,
): { command: string; params: SprayControlParams } {
  const command = DEVICE_COMMANDS.SET_SPRAY_CONTROL;
  switch (action) {
    case "forceSpray":
      // 强喷控制：controlMode=1(强喷), controlWord=1(喷), controlPosition 由用户选择
      return { command, params: { controlMode: 1, controlWord: 1, controlPosition, controllerIds } };
    case "forceStop":
      // 强停：controlMode=0(退出强喷), controlWord=0(不喷), 保留当前位置退出
      return { command, params: { controlMode: 0, controlWord: 0, controlPosition, controllerIds } };
    case "autoMode":
      // 自动模式：退出强喷控制，恢复传感器自动触发
      // controllerIds 为空 = 对所有分控器生效
      return { command, params: { controlMode: 0, controlWord: 0, controlPosition: 0, controllerIds: [] } };
    default:
      return { command, params: { controlMode: 0, controlWord: 0, controlPosition: 0, controllerIds: [] } };
  }
}

// ─── controllerState 位域解析已统一到 deviceStatus.ts ───
// parseControllerState / getSprayStatusText / isAnySpraying / ControllerState 均从 deviceStatus 导入

// ─── 分控器信息 ───

// SubControllerInfo 已抽取到 SubControllerCard.tsx，此处通过 import 引入

// ─── 分控器状态 → SubControllerFrame 视觉映射 ───

function mapControllerStatus(ctrl: SubControllerInfo): DeviceLiveStatus {
  if (!ctrl.online) return "offline";
  if (ctrl.controllerState?.commFault) return "fault";
  if (ctrl.controllerState?.batteryWarn) return "warning";
  return "online";
}

const SUB_CONTROLLER_STATUS_VISUALS: Record<DeviceLiveStatus, StatusVisual> = {
  online:  { text: "在线", color: "#3CCB7F", bodyScheme: "normal", pulse: true },
  offline: { text: "离线", color: "#888888", bodyScheme: "offline", pulse: false },
  alarm:   { text: "告警", color: "#F0A030", bodyScheme: "normal", pulse: true },
  warning: { text: "预警", color: "#FF9800", bodyScheme: "normal", pulse: true },
  fault:   { text: "故障", color: "#ef4444", bodyScheme: "normal", pulse: true },
  pending: { text: "检查中", color: "#FFC107", bodyScheme: "normal", pulse: true },
};

function mapStatusVisual(ctrl: SubControllerInfo): StatusVisual {
  return SUB_CONTROLLER_STATUS_VISUALS[mapControllerStatus(ctrl)];
}

function buildScreenItems(ctrl: SubControllerInfo, isSpraying: boolean) {
  const items: Array<{ key: string; label: string; value: string; unit?: string }> = [];
  if (isSpraying) {
    items.push({ key: "spray", label: "状态", value: ctrl.sprayStatusText });
  } else if (ctrl.online) {
    items.push({ key: "status", label: "状态", value: "待机" });
  }
  if (ctrl.controllerState?.batteryWarn) {
    items.push({ key: "battery", label: "电池", value: "预警" });
  }
  if (ctrl.controllerState?.commFault) {
    items.push({ key: "comm", label: "通讯", value: "故障" });
  }
  return items;
}

// ─── 主渲染器 ───

export function SprayControlToolbarRenderer({ config }: ComponentRendererProps) {
  // 注入全局 keyframes CSS（仅一次）
  injectSprayControlCSS();

  const sceneMode = (config.sceneMode as string) ?? "tunnel";
  const hasPermission = (config.hasPermission as boolean) ?? true;

  // 集控器 ID —— **全部来自真实 API 动态发现，不写死任何设备 ID**
  //   设备集由 edge-conductor GET /api/devices 驱动（deviceStore.devices），
  //   随协议 0x061e 上报自动注册/增减。
  //   config.selectedDeviceIds（即"设备"属性面板）是**显式绑定**：
  //     - 留空 = 不显示任何设备（严格模型，符合"只有选择集控器才显示其下属设备"）
  //     - 非空 = 仅显示并下控所绑定的集控器及其下属分控器/传感器
  //   由 discoverMainControllerIds 按 productCode/category 校验，
  //   历史脏数据（误绑分控器 ID）会自动向上回溯到其集控器根。
  const rawSelectedIds = (config.selectedDeviceIds as string[]) ?? [];

  const devicesMap = useDeviceStore((s) => s.devices) as unknown as Record<string, Record<string, unknown>>;
  const getEffectiveOnline = useDeviceStore((s) => s.getEffectiveOnline);

  const mainControllerIds = useMemo(
    () => discoverMainControllerIds(devicesMap, rawSelectedIds),
    [rawSelectedIds, devicesMap],
  );

  const [loading, setLoading] = useState<ControlAction | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false, message: "", severity: "info",
  });

  // ── 选中分控器 ──
  const [selectedControllerIds, setSelectedControllerIds] = useState<Set<string>>(new Set());

  // ── 强喷位置选择器 ──
  const [controlPosition, setControlPosition] = useState<ControlPosition>(0);

  // ── 喷雾参数设置对话框（0x0614）──
  const [sprayParamsOpen, setSprayParamsOpen] = useState(false);
  const [sprayParamsForm, setSprayParamsForm] = useState({
    sensorType: 0,
    sprayPosition: 0,
    windDirection: 0,
    waterCurtainInterval: 5,
    waterCurtainCount: 3,
    sprayDelayTime: 10,
  });

  // ── 工作时间设置对话框（0x0617）──
  const [workTimeOpen, setWorkTimeOpen] = useState(false);
  const [workTimeForm, setWorkTimeForm] = useState({
    slots: [
      { enabled: 1, startMinute: 480, endMinute: 720 },
      { enabled: 1, startMinute: 780, endMinute: 1080 },
    ],
  });

  // ── 循环喷参数设置对话框（0x061b）──
  const [loopParamsOpen, setLoopParamsOpen] = useState(false);
  const [loopParamsForm, setLoopParamsForm] = useState({
    continuousCurtainCount: 3,
    sprayDurationSecs: 30,
    stopDurationSecs: 10,
  });

  // ── 操作日志：写入全局 sprayLogStore（由日志监控视图操作日志表格顶部的"本会话本地指令"浮条消费） ──
  const { pushLog } = useSprayControlLog();

  // ── 状态变化追踪 ──
  // 记录每个分控器上一次 controllerState 字节值，用于判断"状态是否变化"并触发闪动
  const lastStateRef = useRef<Map<string, number>>(new Map());

  // ── 待确认指令追踪 ──
  // 指令下发后标记目标分控器为 pending，等 0x061e 状态变化确认后自动清除
  // 最小显示时间1.5s，避免设备响应太快导致pending动画一闪而过
  const PENDING_MIN_DISPLAY_MS = 1500;
  const [pendingCommands, setPendingCommands] = useState<Map<string, { since: number; action: "forceSpray" | "forceStop" | "loopStart" | "loopStop" }>>(new Map());
  const setPendingCommand = useCallback((deviceIds: string[], action: "forceSpray" | "forceStop" | "loopStart" | "loopStop") => {
    const now = Date.now();
    setPendingCommands(prev => {
      const next = new Map(prev);
      for (const id of deviceIds) {
        next.set(id, { since: now, action });
      }
      return next;
    });
  }, []);
  // 状态变化时清除 pending（但保证最小显示时间1.5s）
  const clearPendingOnStateChange = useCallback((deviceId: string) => {
    setPendingCommands(prev => {
      const entry = prev.get(deviceId);
      if (!entry) return prev;
      const elapsed = Date.now() - entry.since;
      if (elapsed < PENDING_MIN_DISPLAY_MS) {
        // 不足1.5s，延迟清除
        setTimeout(() => {
          setPendingCommands(p => {
            if (!p.has(deviceId)) return p;
            const next = new Map(p);
            next.delete(deviceId);
            return next;
          });
        }, PENDING_MIN_DISPLAY_MS - elapsed);
        return prev;
      }
      const next = new Map(prev);
      next.delete(deviceId);
      return next;
    });
  }, []);

  // 动态发现所有集控器下的分控器
  const allControllers = useMemo(() => {
    const result: SubControllerInfo[] = [];
    for (const mcId of mainControllerIds) {
      const mainCtrl = devicesMap[mcId] as Record<string, unknown> | undefined;
      const parentName = String(mainCtrl?.productName ?? mcId);
      for (const d of Object.values(devicesMap)) {
        const parentId = String(d.parentDeviceId ?? "");
        // 分控器判定走 productCodePredicates（兼容 18001 与 FY002-SubController-Spray 双形态），
        // 父设备必须等于当前集控器，保证分控器归属准确。
        if (!isSubControllerDevice(d) || parentId !== mcId) continue;

        const deviceId = String(d.deviceId);
        const md = (d.metadata ?? {}) as Record<string, unknown>;
        const realtime = (md.realtime ?? {}) as Record<string, { value: unknown }>;
        const stateRaw = realtime.controllerState?.value;
        const state = typeof stateRaw === "number" ? parseControllerState(stateRaw) : null;
        const batteryWarningRaw = realtime.batteryWarning?.value;
        const batteryWarning = typeof batteryWarningRaw === "number" ? batteryWarningRaw : 0;

        // 检测 controllerState 字节是否变化（用于闪动动画 + 清除 pending）
        let lastChangeTime = 0;
        if (typeof stateRaw === "number") {
          const prev = lastStateRef.current.get(deviceId);
          if (prev !== undefined && prev !== stateRaw) {
            lastChangeTime = Date.now();
            // 状态变化确认 → 清除待确认指令
            clearPendingOnStateChange(deviceId);
          }
          lastStateRef.current.set(deviceId, stateRaw);
        }

        const pending = pendingCommands.get(deviceId);
        result.push({
          deviceId,
          productName: String(d.productName ?? `分控器-${deviceId.slice(-3)}`),
          online: getEffectiveOnline(deviceId),
          parentDeviceId: mcId,
          parentName,
          controllerState: state,
          controllerStateRaw: typeof stateRaw === "number" ? stateRaw : undefined,
          batteryWarning,
          sprayStatusText: state ? getSprayStatusText(state) : "",
          lastChangeTime,
          pendingSince: pending?.since ?? 0,
          pendingAction: pending?.action,
        });
      }
    }
    return result;
  }, [mainControllerIds, devicesMap, pendingCommands]);

  // 定时清理 lastStateRef + 过期 pendingCommands（避免内存膨胀）
  useEffect(() => {
    const timer = setInterval(() => {
      const validIds = new Set(allControllers.map(c => c.deviceId));
      for (const id of Array.from(lastStateRef.current.keys())) {
        if (!validIds.has(id)) lastStateRef.current.delete(id);
      }
      // 清理超时 pending（超过30秒未确认的指令自动清除）
      const now = Date.now();
      setPendingCommands(prev => {
        const next = new Map(prev);
        for (const [id, cmd] of next.entries()) {
          if (now - cmd.since > 30000) next.delete(id);
        }
        return next.size === prev.size ? prev : next;
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [allControllers]);

  // 在线分控器数量
  const onlineCount = allControllers.filter(c => c.online).length;

  // 勾选的集控器在线数量（仅统计属性面板绑定、且真实存在于设备表中的集控器）
  const mainOnlineCount = mainControllerIds.filter(
    (id) => !!(devicesMap[id] as Record<string, unknown> | undefined)?.online,
  ).length;

  // 按集控器分组的分控器
  const groupedByMain = useMemo(() => {
    const groups: Record<string, { parentName: string; controllers: SubControllerInfo[] }> = {};
    for (const c of allControllers) {
      if (!groups[c.parentDeviceId]) {
        groups[c.parentDeviceId] = { parentName: c.parentName, controllers: [] };
      }
      groups[c.parentDeviceId].controllers.push(c);
    }
    return groups;
  }, [allControllers]);

  // 过滤可见按钮
  const visibleButtons = useMemo(() => {
    return CONTROL_BUTTONS.filter(btn => !btn.sceneFilter || btn.sceneFilter.includes(sceneMode));
  }, [sceneMode]);

  // 按钮分组
  const buttonGroups = useMemo(() => {
    const groups: { key: string; buttons: ControlButton[] }[] = [];
    const seen = new Set<string>();
    for (const btn of visibleButtons) {
      if (seen.has(btn.group)) continue;
      seen.add(btn.group);
      groups.push({ key: btn.group, buttons: visibleButtons.filter(b => b.group === btn.group) });
    }
    return groups;
  }, [visibleButtons]);

  // 设备 store 的 sendCommand（带 CommandResult{success,code,msg}）
  const deviceStoreSend = useDeviceStore((s) => s.sendCommand);

  const handleAction = useCallback(async (action: ControlAction) => {
    if (mainControllerIds.length === 0) {
      setSnackbar({
        open: true,
        message: rawSelectedIds.length > 0
          ? "所选范围内没有集控器，请检查属性面板「绑定集控器」的限定"
          : "未发现集控器：请检查边缘服务连接（edge-conductor 8084）与设备在线状态",
        severity: "error",
      });
      return;
    }

    // 喷雾参数设置 — 打开对话框
    if (action === "setSprayParams") {
      setSprayParamsOpen(true);
      return;
    }

    // 工作时间设置 — 打开对话框
    if (action === "setWorkTime") {
      setWorkTimeOpen(true);
      return;
    }

    // 循环喷参数设置 — 打开对话框
    if (action === "loopStart") {
      setLoopParamsOpen(true);
      return;
    }

    setLoading(action);
    logger.info("SprayControlToolbar", `Action: ${action}`, { mainControllerIds, sceneMode, selectedCount: selectedControllerIds.size, controlPosition });

    const t0 = performance.now();
    const buildLogBase = (commandCode: string, payload: Record<string, unknown> | null) => ({
      action,
      commandCode,
      targetMains: mainControllerIds,
      targetSubs: selectedControllerIds.size > 0 ? Array.from(selectedControllerIds) : [],
      payload,
      responses: [] as Array<{ deviceId: string; success: boolean; code: number; msg: string }>,
      durationMs: 0,
      sceneMode,
    });

    try {
      // 0613 获取参数
      if (action === "fetchParams") {
        const results = await Promise.all(mainControllerIds.map(id =>
          deviceStoreSend(id, DEVICE_COMMANDS.FETCH_SPRAY_PARAMS),
        ));
        const okCount = results.filter(r => r.success).length;
        const failCount = results.length - okCount;
        const ok = failCount === 0;
        setSnackbar({ open: true, message: ok ? `参数获取成功（${okCount} 个集控器）` : `部分失败：${okCount} 成功 / ${failCount} 失败`, severity: ok ? "success" : "error" });
        pushLog({
          ...buildLogBase("0613", null),
          result: ok ? "ok" : "partial",
          message: ok ? "参数获取成功" : `${failCount} 个集控器获取失败`,
          responses: results.map((r, i) => ({ deviceId: r.deviceId ?? mainControllerIds[i], success: r.success, code: r.code, msg: r.msg })),
          durationMs: Math.round(performance.now() - t0),
        });
        return;
      }

      // 061b 循环喷停止（loopStart 已通过对话框处理，此处仅 loopStop）
      if (action === "loopStop") {
        const params = { continuousCurtainCount: 0, sprayDurationSecs: 0, stopDurationSecs: 0 };
        const results = await Promise.all(mainControllerIds.map(id =>
          deviceStoreSend(id, DEVICE_COMMANDS.SET_CYCLE_SPRAY, params),
        ));
        const okCount = results.filter(r => r.success).length;
        const failCount = results.length - okCount;
        const ok = failCount === 0;
        if (ok) {
          const targetSubIds = allControllers.filter(c => c.online).map(c => c.deviceId);
          setPendingCommand(targetSubIds, "loopStop");
        }
        setSnackbar({ open: true, message: ok ? "循环喷雾已停止" : `循环喷雾停止失败（${failCount} 个集控器失败）`, severity: ok ? "success" : "error" });
        pushLog({
          ...buildLogBase("061b", params),
          result: ok ? "ok" : "partial",
          message: ok ? "循环喷雾已停止" : `${failCount} 个集控器失败`,
          responses: results.map((r, i) => ({ deviceId: r.deviceId ?? mainControllerIds[i], success: r.success, code: r.code, msg: r.msg })),
          durationMs: Math.round(performance.now() - t0),
        });
        return;
      }

      // ── 0619 喷洒控制 / 0614 喷雾参数 / 0617 工作时间 ──
      // 以下逻辑处理 forceSpray / forceStop / autoMode（0619）
      // 有选中分控器 → 只发选中的；没选中 → 广播（controllerIds 为空）

      // 智能跳过离线分控器（提示但不强制）
      let effectiveSelection: Set<string>;
      if (selectedControllerIds.size > 0) {
        const offlineSelected: string[] = [];
        effectiveSelection = new Set();
        for (const id of selectedControllerIds) {
          const ctrl = allControllers.find(c => c.deviceId === id);
          if (!ctrl || !ctrl.online) {
            offlineSelected.push(id);
            continue;
          }
          effectiveSelection.add(id);
        }
        if (offlineSelected.length > 0 && effectiveSelection.size === 0) {
          setSnackbar({ open: true, message: `所选 ${offlineSelected.length} 个分控器均离线，无法下发`, severity: "error" });
          pushLog({
            ...buildLogBase("0619", null),
            result: "fail",
            message: "全部离线，已跳过",
            responses: offlineSelected.map(id => ({ deviceId: id, success: false, code: -1, msg: "分控器离线" })),
            durationMs: Math.round(performance.now() - t0),
          });
          return;
        }
        if (offlineSelected.length > 0) {
          setSnackbar({ open: true, message: `已自动跳过 ${offlineSelected.length} 个离线分控器`, severity: "info" });
        }
      } else {
        effectiveSelection = selectedControllerIds;
      }

      const controllerIds: number[] = effectiveSelection.size > 0
        ? Array.from(effectiveSelection).map(id => extractControllerId(id))
            .filter((n): n is number => n !== null)
        : [];

      // 确定目标集控器列表
      let targetMainIds: string[];
      if (effectiveSelection.size > 0) {
        const parentSet = new Set<string>();
        for (const subId of effectiveSelection) {
          const ctrl = allControllers.find(c => c.deviceId === subId);
          if (ctrl?.parentDeviceId) {
            parentSet.add(ctrl.parentDeviceId);
          }
        }
        targetMainIds = mainControllerIds.filter(id => parentSet.has(id));
        if (targetMainIds.length === 0) {
          targetMainIds = mainControllerIds;
        }
      } else {
        targetMainIds = mainControllerIds;
      }

      // 0619 喷洒控制
      const payload = buildSprayControlPayload(action, controllerIds, controlPosition);
      const posLabel = CONTROL_POSITION_LABELS[controlPosition] ?? "全控";
      const results = await Promise.all(targetMainIds.map(id => deviceStoreSend(id, payload.command, payload.params as unknown as Record<string, unknown>)));
      const okCount = results.filter(r => r.success).length;
      const failCount = results.length - okCount;

      const actionMsgs: Record<string, string> = {
        forceSpray: effectiveSelection.size > 0
          ? `对 ${effectiveSelection.size} 个分控器开启强喷[${posLabel}]`
          : `广播开启强喷[${posLabel}]`,
        forceStop: effectiveSelection.size > 0
          ? `对 ${effectiveSelection.size} 个分控器停止强喷`
          : "广播停止强喷",
        autoMode: "切换到自动模式",
      };
      const summary = actionMsgs[action] || "操作成功";
      const ok = failCount === 0;
      const firstFail = results.find(r => !r.success);
      if (ok) {
        // 指令下发成功 → 标记目标分控器为"待确认"状态
        if (action === "forceSpray" || action === "forceStop") {
          const targetSubIds = effectiveSelection.size > 0
            ? Array.from(effectiveSelection)
            : allControllers.filter(c => c.online).map(c => c.deviceId);
          setPendingCommand(targetSubIds, action);
        }
        setSnackbar({ open: true, message: `${summary}（${okCount}/${results.length} 集控器已接收）`, severity: "success" });
        pushLog({
          ...buildLogBase("0619", payload.params as unknown as Record<string, unknown>),
          targetMains: targetMainIds,
          result: "ok",
          message: `${summary}，${okCount} 个集控器已确认`,
          responses: results.map((r, i) => ({ deviceId: r.deviceId ?? targetMainIds[i], success: r.success, code: r.code, msg: r.msg })),
          durationMs: Math.round(performance.now() - t0),
        });
      } else {
        setSnackbar({ open: true, message: `${summary}（${failCount} 个集控器失败：${firstFail?.msg ?? "未知错误"}）`, severity: "error" });
        pushLog({
          ...buildLogBase("0619", payload.params as unknown as Record<string, unknown>),
          targetMains: targetMainIds,
          result: "partial",
          message: `${failCount} 个集控器失败：${firstFail?.msg ?? "未知错误"}`,
          responses: results.map((r, i) => ({ deviceId: r.deviceId ?? targetMainIds[i], success: r.success, code: r.code, msg: r.msg })),
          durationMs: Math.round(performance.now() - t0),
        });
      }
    } catch (error) {
      logger.error("SprayControlToolbar", `操作失败: ${error}`);
      const errMsg = error instanceof Error ? error.message : String(error);
      setSnackbar({ open: true, message: `操作失败: ${errMsg}`, severity: "error" });
      pushLog({
        ...buildLogBase("-", null),
        result: "fail",
        message: errMsg,
        durationMs: Math.round(performance.now() - t0),
      });
    } finally {
      setLoading(null);
    }
  }, [mainControllerIds, sceneMode, selectedControllerIds, allControllers, deviceStoreSend, pushLog, controlPosition]);

  // ── 喷雾参数设置确认（0x0614）──
  const handleSprayParamsSubmit = useCallback(async () => {
    if (mainControllerIds.length === 0) return;
    setLoading("setSprayParams");
    const t0 = performance.now();
    try {
      // 协议规定 sprayDelayTime 单位为毫秒，前端输入为秒，需转换
      const params = {
        ...sprayParamsForm,
        sprayDelayTime: sprayParamsForm.sprayDelayTime * 1000,
      };
      const results = await Promise.all(mainControllerIds.map(id =>
        deviceStoreSend(id, DEVICE_COMMANDS.SET_SPRAY_PARAMS, params),
      ));
      const okCount = results.filter(r => r.success).length;
      const failCount = results.length - okCount;
      const ok = failCount === 0;
      setSnackbar({ open: true, message: ok ? "喷雾参数设置成功" : `${failCount} 个集控器设置失败`, severity: ok ? "success" : "error" });
      pushLog({
        action: "setSprayParams",
        commandCode: "0614",
        targetMains: mainControllerIds,
        targetSubs: [],
        payload: params as unknown as Record<string, unknown>,
        result: ok ? "ok" : "partial",
        message: ok ? "喷雾参数设置成功" : `${failCount} 个集控器设置失败`,
        responses: results.map((r, i) => ({ deviceId: r.deviceId ?? mainControllerIds[i], success: r.success, code: r.code, msg: r.msg })),
        durationMs: Math.round(performance.now() - t0),
        sceneMode,
      });
    } catch (error) {
      setSnackbar({ open: true, message: `设置失败: ${error}`, severity: "error" });
    } finally {
      setLoading(null);
      setSprayParamsOpen(false);
    }
  }, [mainControllerIds, sprayParamsForm, deviceStoreSend, pushLog, sceneMode]);

  // ── 工作时间设置确认（0x0617）──
  const handleWorkTimeSubmit = useCallback(async () => {
    if (mainControllerIds.length === 0) return;
    setLoading("setWorkTime");
    const t0 = performance.now();
    try {
      const params = { slots: workTimeForm.slots.map(s => ({ enabled: s.enabled, startMinute: s.startMinute, endMinute: s.endMinute })) };
      const results = await Promise.all(mainControllerIds.map(id =>
        deviceStoreSend(id, DEVICE_COMMANDS.SET_WORK_TIME, params),
      ));
      const okCount = results.filter(r => r.success).length;
      const failCount = results.length - okCount;
      const ok = failCount === 0;
      setSnackbar({ open: true, message: ok ? "工作时间设置成功" : `${failCount} 个集控器设置失败`, severity: ok ? "success" : "error" });
      pushLog({
        action: "setWorkTime",
        commandCode: "0617",
        targetMains: mainControllerIds,
        targetSubs: [],
        payload: params as unknown as Record<string, unknown>,
        result: ok ? "ok" : "partial",
        message: ok ? "工作时间设置成功" : `${failCount} 个集控器设置失败`,
        responses: results.map((r, i) => ({ deviceId: r.deviceId ?? mainControllerIds[i], success: r.success, code: r.code, msg: r.msg })),
        durationMs: Math.round(performance.now() - t0),
        sceneMode,
      });
    } catch (error) {
      setSnackbar({ open: true, message: `设置失败: ${error}`, severity: "error" });
    } finally {
      setLoading(null);
      setWorkTimeOpen(false);
    }
  }, [mainControllerIds, workTimeForm, deviceStoreSend, pushLog, sceneMode]);

  // ── 循环喷参数设置确认（0x061b）──
  const handleLoopParamsSubmit = useCallback(async () => {
    if (mainControllerIds.length === 0) return;
    setLoading("loopStart");
    const t0 = performance.now();
    try {
      const params = { ...loopParamsForm };
      const results = await Promise.all(mainControllerIds.map(id =>
        deviceStoreSend(id, DEVICE_COMMANDS.SET_CYCLE_SPRAY, params),
      ));
      const okCount = results.filter(r => r.success).length;
      const failCount = results.length - okCount;
      const ok = failCount === 0;
      if (ok) {
        const targetSubIds = allControllers.filter(c => c.online).map(c => c.deviceId);
        setPendingCommand(targetSubIds, "loopStart");
      }
      setSnackbar({ open: true, message: ok ? "循环喷雾已开始" : `循环喷雾开启失败（${failCount} 个集控器失败）`, severity: ok ? "success" : "error" });
      pushLog({
        action: "loopStart",
        commandCode: "061b",
        targetMains: mainControllerIds,
        targetSubs: [],
        payload: params as unknown as Record<string, unknown>,
        result: ok ? "ok" : "partial",
        message: ok ? "循环喷雾已开始" : `${failCount} 个集控器失败`,
        responses: results.map((r, i) => ({ deviceId: r.deviceId ?? mainControllerIds[i], success: r.success, code: r.code, msg: r.msg })),
        durationMs: Math.round(performance.now() - t0),
        sceneMode,
      });
    } catch (error) {
      setSnackbar({ open: true, message: `设置失败: ${error}`, severity: "error" });
    } finally {
      setLoading(null);
      setLoopParamsOpen(false);
    }
  }, [mainControllerIds, loopParamsForm, allControllers, deviceStoreSend, pushLog, sceneMode]);

  // ── 多选操作快捷 ──
  const toggleController = useCallback((id: string) => {
    setSelectedControllerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const all = new Set(allControllers.filter(c => c.online).map(c => c.deviceId));
    setSelectedControllerIds(all);
    pushLog({
      action: "selectAll",
      commandCode: "-",
      targetMains: mainControllerIds,
      targetSubs: Array.from(all),
      payload: null,
      result: "ok",
      message: "全选在线分控器",
      responses: [],
      durationMs: 0,
      sceneMode,
    });
  }, [allControllers, mainControllerIds, sceneMode, pushLog]);

  const deselectAll = useCallback(() => {
    setSelectedControllerIds(new Set());
    pushLog({
      action: "selectNone",
      commandCode: "-",
      targetMains: mainControllerIds,
      targetSubs: [],
      payload: null,
      result: "ok",
      message: "清空选中",
      responses: [],
      durationMs: 0,
      sceneMode,
    });
  }, [mainControllerIds, sceneMode, pushLog]);

  const selectGroup = useCallback((parentDeviceId: string) => {
    const groupControllers = allControllers
      .filter(c => c.parentDeviceId === parentDeviceId && c.online)
      .map(c => c.deviceId);
    setSelectedControllerIds(new Set(groupControllers));
    pushLog({
      action: "selectGroup",
      commandCode: "-",
      targetMains: [parentDeviceId],
      targetSubs: groupControllers,
      payload: null,
      result: "ok",
      message: `选中 ${groupControllers.length} 个分控器`,
      responses: [],
      durationMs: 0,
      sceneMode,
    });
  }, [allControllers, groupedByMain, sceneMode, pushLog]);

  // 当分控器列表变化（如设备上下线）时，自动剔除已离线的选中项
  useEffect(() => {
    setSelectedControllerIds(prev => {
      const valid = new Set(allControllers.map(c => c.deviceId));
      const next = new Set<string>();
      let changed = false;
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [allControllers]);

  // 是否处于闪动窗口内（800ms 内）
  const isFlashing = useCallback((ctrl: SubControllerInfo): boolean => {
    return ctrl.lastChangeTime > 0 && Date.now() - ctrl.lastChangeTime < 800;
  }, []);

  // 是否处于待确认状态（指令下发后 ≤30s 未收到0x061e确认）
  const isPending = useCallback((ctrl: SubControllerInfo): boolean => {
    return ctrl.pendingSince > 0 && Date.now() - ctrl.pendingSince < 30000;
  }, []);

  // 获取分控器的视觉反馈类型（决定动画颜色和效果）
  const getVisualFeedback = useCallback((ctrl: SubControllerInfo): VisualFeedback => {
    // 优先级：pending > forceSpray > spraying > fault > none
    if (isPending(ctrl)) {
      if (ctrl.pendingAction === "forceSpray") {
        return { glowColor: "#FFC107", glowIntensity: 0.8, animType: "pending" }; // 黄色脉冲 = 等待强喷确认
      }
      if (ctrl.pendingAction === "forceStop") {
        return { glowColor: "#FF9800", glowIntensity: 0.7, animType: "pending" }; // 橙色脉冲 = 等待强停确认
      }
      return { glowColor: "#FFC107", glowIntensity: 0.6, animType: "pending" };
    }
    if (ctrl.controllerState?.frontForceSpray || ctrl.controllerState?.rearForceSpray) {
      return { glowColor: "#00BCD4", glowIntensity: 0.9, animType: "forceSpray" }; // 亮蓝呼吸 = 强喷中
    }
    if (isAnySpraying(ctrl.controllerState)) {
      return { glowColor: "#4CAF50", glowIntensity: 0.5, animType: "spraying" }; // 绿色柔和 = 正在喷洒
    }
    return { glowColor: "transparent", glowIntensity: 0, animType: "none" };
  }, [isPending]);

  // 每 200ms 强制刷新一次（让"正在闪动"的卡片能正确移除动画）
  const [, forceTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceTick(t => t + 1), 200);
    return () => clearInterval(timer);
  }, []);

  const sceneLabels: Record<string, string> = { tunnel: "巷道", bridge: "廊桥", mining: "综采", cycle: "循环" };

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(0,20,40,0.92)",
        borderRadius: 1.5,
        border: "1px solid rgba(255,152,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* ── 顶部标题栏 + 多选快捷 ── */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
        px: 2, py: 1,
        borderBottom: "1px solid rgba(255,152,0,0.2)",
        backgroundColor: "rgba(255,152,0,0.08)",
      }}>
        <WaterDropIcon sx={{ fontSize: 28, color: "#4fc3f7" }} />
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.95)", letterSpacing: 1 }}>
          喷雾控制
        </Typography>
        <Typography sx={{
          fontSize: 16, color: "rgba(255,152,0,0.9)",
          border: "1px solid rgba(255,152,0,0.4)", borderRadius: 1, px: 1.5, lineHeight: "26px",
        }}>
          {sceneLabels[sceneMode] ?? sceneMode}
        </Typography>
        {mainControllerIds.length > 0 && (
          <Typography sx={{
            fontSize: 16, color: "rgba(79,195,247,0.9)",
            border: "1px solid rgba(79,195,247,0.4)", borderRadius: 1, px: 1.5, lineHeight: "26px",
          }}>
            {mainOnlineCount}/{mainControllerIds.length}集控 · {onlineCount}/{allControllers.length}分控在线
          </Typography>
        )}

        {/* 多选快捷按钮（仅在有分控器时显示） */}
        {allControllers.length > 0 && (
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.75 }}>
            <Tooltip title="全选所有在线分控器" arrow>
              <ButtonBase
                onClick={selectAll}
                disabled={onlineCount === 0}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.5,
                  px: 1.25, py: 0.5, borderRadius: 1,
                  fontSize: 14, color: "rgba(255,255,255,0.85)",
                  backgroundColor: "rgba(76,175,80,0.15)",
                  border: "1px solid rgba(76,175,80,0.4)",
                  "&:hover": { backgroundColor: "rgba(76,175,80,0.28)" },
                  "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
                }}
              >
                <SelectAllIcon sx={{ fontSize: 16 }} />
                <span>全选在线</span>
              </ButtonBase>
            </Tooltip>
            <Tooltip title="清空当前选择" arrow>
              <ButtonBase
                onClick={deselectAll}
                disabled={selectedControllerIds.size === 0}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.5,
                  px: 1.25, py: 0.5, borderRadius: 1,
                  fontSize: 14, color: "rgba(255,255,255,0.85)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.15)" },
                  "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
                }}
              >
                <DeselectIcon sx={{ fontSize: 16 }} />
                <span>全不选</span>
              </ButtonBase>
            </Tooltip>
            {/* 多集控器时按集控器分组选择 */}
            {mainControllerIds.length > 1 && Object.entries(groupedByMain).map(([parentId, g]) => (
              <Tooltip key={parentId} title={`仅选中 ${g.parentName} 下的在线分控器`} arrow>
                <ButtonBase
                  onClick={() => selectGroup(parentId)}
                  sx={{
                    px: 1.25, py: 0.5, borderRadius: 1,
                    fontSize: 13, color: "rgba(255,193,7,0.95)",
                    backgroundColor: "rgba(255,193,7,0.1)",
                    border: "1px solid rgba(255,193,7,0.35)",
                    "&:hover": { backgroundColor: "rgba(255,193,7,0.22)" },
                  }}
                >
                  {g.parentName}
                </ButtonBase>
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>

      {/* ── 未绑定集控器 ── */}
      {mainControllerIds.length === 0 && (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ fontSize: 18, color: "text.disabled" }}>
            请在属性面板绑定集控器
          </Typography>
        </Box>
      )}

      {/* ── 分控器卡片 ── */}
      {mainControllerIds.length > 0 && (
        <Box sx={{
          flex: 1, minHeight: 0,
          px: 1.5, py: 1.5,
          overflow: "auto",
          "&::-webkit-scrollbar": { height: 6, width: 6 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,152,0,0.3)", borderRadius: 3 },
        }}>
          {allControllers.length === 0 ? (
            <Typography sx={{ fontSize: 18, color: "text.disabled", textAlign: "center", py: 1 }}>
              所选集控器下暂无分控器
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {allControllers.map(ctrl => {
                const selected = selectedControllerIds.has(ctrl.deviceId);
                const flashing = isFlashing(ctrl);
                const pending = isPending(ctrl);
                const feedback = getVisualFeedback(ctrl);
                return (
                  <SubControllerCard
                    key={ctrl.deviceId}
                    ctrl={ctrl}
                    selected={selected}
                    feedback={feedback}
                    flashing={flashing}
                    pending={pending}
                    mainControllerCount={mainControllerIds.length}
                    onToggle={(id, shiftKey) => {
                      toggleController(id);
                      if (shiftKey && !selectedControllerIds.has(id)) {
                        setSelectedControllerIds(new Set([id]));
                      }
                    }}
                    mapControllerStatus={mapControllerStatus}
                    mapStatusVisual={mapStatusVisual}
                    buildScreenItems={buildScreenItems}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* ── 操作按钮栏 ── */}
      {mainControllerIds.length > 0 && (
        <Box sx={{
          display: "flex", alignItems: "center", gap: 0.75,
          px: 1.5, py: 1,
          borderTop: "1px solid rgba(255,152,0,0.2)",
          flexWrap: "wrap",
        }}>
          {/* controlPosition 选择器 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
            {([0, 1, 2, 3] as ControlPosition[]).map(pos => (
              <ButtonBase
                key={pos}
                onClick={() => setControlPosition(pos)}
                sx={{
                  px: 1, py: 0.25, borderRadius: 0.75,
                  fontSize: 12, lineHeight: "18px", fontFamily: "monospace",
                  fontWeight: controlPosition === pos ? 700 : 400,
                  color: controlPosition === pos ? "#fff" : "rgba(255,255,255,0.55)",
                  backgroundColor: controlPosition === pos
                    ? "rgba(59,130,246,0.55)"
                    : "rgba(255,255,255,0.05)",
                  border: controlPosition === pos
                    ? "1px solid rgba(59,130,246,0.7)"
                    : "1px solid rgba(255,255,255,0.1)",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    backgroundColor: controlPosition === pos
                      ? "rgba(59,130,246,0.65)"
                      : "rgba(255,255,255,0.1)",
                  },
                }}
              >
                {CONTROL_POSITION_LABELS[pos]}
              </ButtonBase>
            ))}
          </Box>

          <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,152,0,0.15)", height: 22 }} />

          {/* 所有按钮统一风格 */}
          {buttonGroups.map((group, gi) => (
            <Box key={group.key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {gi > 0 && (
                <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,152,0,0.15)", height: 22 }} />
              )}
              {group.buttons.map(btn => {
                const isCurrentLoading = loading === btn.id;
                const isOtherLoading = loading !== null && !isCurrentLoading;
                return (
                  <ButtonBase
                    key={btn.id}
                    disabled={!hasPermission || isOtherLoading}
                    onClick={() => handleAction(btn.id)}
                    sx={{
                      display: "flex", alignItems: "center", gap: 0.5,
                      px: 1.5, py: 0.5,
                      borderRadius: 1.25,
                      fontSize: 13,
                      backgroundColor: isCurrentLoading ? `${btn.color}40` : "rgba(255,255,255,0.07)",
                      color: btn.color,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      border: `1px solid ${isCurrentLoading ? btn.color + "60" : "rgba(255,255,255,0.08)"}`,
                      "&:hover": isOtherLoading ? {} : {
                        backgroundColor: `${btn.color}20`,
                        borderColor: `${btn.color}50`,
                      },
                      "&:disabled": {
                        backgroundColor: "rgba(255,255,255,0.03)",
                        color: "#4b5563",
                        cursor: "not-allowed",
                        opacity: 0.5,
                        borderColor: "transparent",
                      },
                    }}
                  >
                    <Box sx={{
                      display: "flex", alignItems: "center",
                      "& svg": { fontSize: 17 },
                      animation: isCurrentLoading ? "spraySpin 1s linear infinite" : "none",
                    }}>
                      {isCurrentLoading ? <HourglassEmptyIcon sx={{ fontSize: 17 }} /> : btn.icon}
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>
                      {isCurrentLoading ? "..." : btn.label}
                    </Typography>
                    {btn.needsPosition && (
                      <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 400, fontFamily: "monospace" }}>
                        {CONTROL_POSITION_LABELS[controlPosition]}
                      </Typography>
                    )}
                  </ButtonBase>
                );
              })}
            </Box>
          ))}

          {/* 选中提示 */}
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5 }}>
            {selectedControllerIds.size > 0 && (
              <Tooltip title="清空选中" arrow>
                <IconButton
                  size="small"
                  onClick={deselectAll}
                  sx={{
                    color: "rgba(255,255,255,0.45)",
                    p: 0.15,
                    "&:hover": { color: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)" },
                  }}
                >
                  <ClearIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}
            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
              {selectedControllerIds.size === 0 && "未选=广播"}
              {selectedControllerIds.size > 0 && (
                <>
                  <Box component="span" sx={{ color: "#4fc3f7", fontWeight: 600 }}>
                    {selectedControllerIds.size === 1 ? "单选" : "多选"}
                  </Box>
                  {` · ${selectedControllerIds.size}`}
                </>
              )}
            </Typography>
          </Box>
        </Box>
      )}


      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: "", severity: "info" })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbar({ open: false, message: "", severity: "info" })} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>


      {/* ── 喷雾参数设置对话框（0x0614）── */}
      <SprayParamsDialog
        open={sprayParamsOpen}
        form={sprayParamsForm}
        loading={loading !== null}
        onClose={() => setSprayParamsOpen(false)}
        onSubmit={handleSprayParamsSubmit}
        onFormChange={setSprayParamsForm}
      />

      {/* ── 工作时间设置对话框（0x0617）── */}
      <WorkTimeDialog
        open={workTimeOpen}
        slots={workTimeForm.slots}
        loading={loading !== null}
        onClose={() => setWorkTimeOpen(false)}
        onSubmit={handleWorkTimeSubmit}
        onSlotsChange={(updater) => setWorkTimeForm(prev => ({ ...prev, slots: updater(prev.slots) }))}
      />

      {/* ── 循环喷参数设置对话框（0x061b）── */}
      <LoopParamsDialog
        open={loopParamsOpen}
        form={loopParamsForm}
        loading={loading !== null}
        onClose={() => setLoopParamsOpen(false)}
        onSubmit={handleLoopParamsSubmit}
        onFormChange={setLoopParamsForm}
      />
    </Box>
  );
}
