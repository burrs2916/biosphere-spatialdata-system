/**
 * DustAlarmPanelRenderer - 粉尘浓度预警报警面板
 *
 * 数据流（与 DustTrendRenderer 一致）：
 *   config.selectedDeviceIds -> 集控器(pc=18)
 *     -> 分控器(pc=18001, parentDeviceId in 集控器ID集)
 *       -> 粉尘传感器(pc=18015 频率型 / pc=18029 报警型)
 *         -> 0x061e 30s推送 -> deviceStore.devices -> 本组件提取 finalValue
 *
 * 核心特性：
 *   1. 层级发现：集控器->分控器->粉尘传感器（与 DustTrendRenderer / SensorMonitorRenderer 一致）
 *   2. 三级预警/报警：正常 / 预警(≥alarmHigh×warningRatio) / 报警(≥alarmHigh)
 *   3. 离线/陈旧数据判定：30s+ 预警，60s+ 离线
 *   4. 报警型传感器(18029)：显示触发/未触发状态
 *   5. 浓度占比条：当前值 vs 报警阈值的可视化
 *   6. 4K 大屏自适应字体
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { useMemo, useState, useEffect } from "react";
import { useDeviceStore } from "../../../store/deviceStore";
import { useThrottledDevices } from "../../../hooks/useThrottledDevices";
import type { ComponentRendererProps } from "../../../types/editor";

// ═══════════════════════════════════════════════════════════════════
// 常量 & 类型
// ═══════════════════════════════════════════════════════════════════

const MAIN_CONTROLLER_PC = new Set(["18", "FY002-MainController"]);
const SUB_CONTROLLER_PC = new Set(["18001", "FY002-SubController-Spray"]);
const DUST_FREQ_PC = new Set(["18015", "FY002-Sensor-Dust"]);
const DUST_ALARM_PC = new Set(["18029", "FY002-Alarm-Dust"]);

/** 传感器设备类型（从 deviceStore 读取的 DeviceInstance 子集） */
interface DustSensorDevice {
  deviceId: string;
  productCode: string;
  online: boolean;
  fault?: boolean;
  parentDeviceId?: string;
  metadata: {
    realtime?: Record<string, { value: unknown; timestamp: number; quality?: string }>;
    minRange?: number;
    maxRange?: number;
    alarmLow?: number;
    alarmHigh?: number;
    alias?: string;
    productName?: string;
    [k: string]: unknown;
  };
}

/** 单个粉尘传感器的评估状态 */
type DustStatus = "normal" | "warning" | "alarm" | "offline";

interface DustRow {
  deviceId: string;
  label: string;
  productCode: string;
  isFreq: boolean;
  isAlarm: boolean;
  value: number | undefined;
  alarmHigh: number | undefined;
  alarmLow: number | undefined;
  status: DustStatus;
  ratio: number; // 浓度占报警阈值的比例 (0~1+)
  isStale: boolean;
  ageSec: number;
  alarmTriggered: boolean; // 报警型传感器是否触发
}

// ═══════════════════════════════════════════════════════════════════
// 工具函数（与 DustTrendRenderer 对齐）
// ═══════════════════════════════════════════════════════════════════

/** 从 deviceStore 设备对象中提取传感器实时值 */
function extractSensorValue(device: DustSensorDevice): number | undefined {
  const rt = device.metadata?.realtime;
  if (!rt) return undefined;
  const fv = rt.finalValue?.value;
  if (fv !== undefined && fv !== null) {
    const n = Number(fv);
    if (Number.isFinite(n)) return n;
  }
  const v = rt.sensorValue?.value;
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 数据陈旧度判断（协议 0x061e 30s 周期） */
function evaluateStaleness(
  lastTimestamp: number | undefined,
  now: number,
): { isStale: boolean; isVeryStale: boolean; ageSec: number } {
  if (!lastTimestamp) return { isStale: false, isVeryStale: false, ageSec: -1 };
  const ageSec = Math.max(0, Math.round((now - lastTimestamp) / 1000));
  return { isStale: ageSec >= 30, isVeryStale: ageSec >= 60, ageSec };
}

function isDustSensor(pc: string): boolean {
  return DUST_FREQ_PC.has(pc) || DUST_ALARM_PC.has(pc);
}

function isDustFreqSensor(pc: string): boolean {
  return DUST_FREQ_PC.has(pc);
}

function isDustAlarmSensor(pc: string): boolean {
  return DUST_ALARM_PC.has(pc);
}

/** 获取传感器标签（与 DustTrendRenderer 的 getSensorLabel 一致） */
function getSensorLabel(device: DustSensorDevice, index: number): string {
  const alias = device.metadata?.alias as string | undefined;
  const productName = device.metadata?.productName as string | undefined;
  if (alias && alias.trim()) return alias.trim();
  if (productName && productName.trim()) return productName.trim();

  const id = device.deviceId || "";
  const parts = id.split("_");
  if (parts.length >= 3) {
    const ctrlId = parts[parts.length - 2];
    const sensorPart = parts[parts.length - 1];
    return `粉尘#${ctrlId}-${sensorPart.replace("f", "")}`;
  }
  return `粉尘#${index + 1}`;
}

/** 获取最新数据时间戳 */
function getLatestTimestamp(device: DustSensorDevice): number | undefined {
  const rt = device.metadata?.realtime;
  if (!rt) return undefined;
  const fv = rt.finalValue?.timestamp;
  const sv = rt.sensorValue?.timestamp;
  const sc = rt.sensorStatusCode?.timestamp;
  const candidates = [fv, sv, sc].filter((t) => t !== undefined && Number.isFinite(t)) as number[];
  if (candidates.length === 0) return undefined;
  return Math.max(...candidates);
}

// ═══════════════════════════════════════════════════════════════════
// 状态颜色
// ═══════════════════════════════════════════════════════════════════

const STATUS_COLORS: Record<DustStatus, { color: string; bg: string; label: string }> = {
  normal: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "正常" },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "预警" },
  alarm: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "报警" },
  offline: { color: "#6b7280", bg: "rgba(107,114,128,0.12)", label: "离线" },
};

// ═══════════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════════

export function DustAlarmPanelRenderer({ config, width = 910, height = 380 }: ComponentRendererProps) {
  const title = (config.title as string) ?? "粉尘浓度预警报警";
  const warningRatio = (config.warningRatio as number) ?? 0.8;
  const valuePrecision = (config.valuePrecision as number) ?? 2;
  const theme = (config.theme as string) ?? "dark";

  const rawSelectedIds = (config.selectedDeviceIds as string[]) ?? [];
  const devicesMap = useThrottledDevices(500);
  const getEffectiveOnline = useDeviceStore((s) => s.getEffectiveOnline);

  // UI tick - 1s 间隔确保状态及时刷新
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── 层级发现：集控器->分控器->粉尘传感器 ───
  const { mainControllerIds, dustSensors } = useMemo(() => {
    // 1) 确定目标集控器
    const mcIds = rawSelectedIds.filter((id) => {
      const d = devicesMap[id] as Record<string, unknown> | undefined;
      if (!d) return false;
      const pc = String(d.productCode ?? "");
      return MAIN_CONTROLLER_PC.has(pc);
    });

    // 2) 找到这些集控器下的分控器
    const subIds = new Set<string>();
    for (const [, d] of Object.entries(devicesMap)) {
      const dev = d as Record<string, unknown>;
      const pc = String(dev.productCode ?? "");
      const parentId = dev.parentDeviceId as string | undefined;
      if (SUB_CONTROLLER_PC.has(pc) && parentId && mcIds.includes(parentId)) {
        subIds.add((dev.deviceId as string) ?? "");
      }
    }

    // 3) 找到粉尘传感器
    const sensors: DustSensorDevice[] = [];
    let sensorIndex = 0;
    for (const [id, d] of Object.entries(devicesMap)) {
      const dev = d as Record<string, unknown>;
      const pc = String(dev.productCode ?? "");
      const parentId = dev.parentDeviceId as string | undefined;

      const isChildOfSub = parentId && subIds.has(parentId);
      const isChildOfMc = parentId && mcIds.includes(parentId);

      if (isDustSensor(pc) && (isChildOfSub || isChildOfMc)) {
        const md = (dev.metadata ?? {}) as Record<string, unknown>;
        const realtime = (md.realtime ?? {}) as Record<string, { value: unknown; timestamp: number; quality?: string }>;
        sensors.push({
          deviceId: id,
          productCode: pc,
          online: getEffectiveOnline(id),
          fault: Boolean((md as Record<string, unknown>)?.fault),
          parentDeviceId: parentId,
          metadata: {
            realtime,
            minRange: md.minRange as number | undefined,
            maxRange: md.maxRange as number | undefined,
            alarmLow: md.alarmLow as number | undefined,
            alarmHigh: md.alarmHigh as number | undefined,
            alias: md.alias as string | undefined,
            productName: dev.productName as string | undefined,
          },
        });
        sensorIndex++;
      }
    }

    return { mainControllerIds: mcIds, dustSensors: sensors };
  }, [rawSelectedIds, devicesMap, getEffectiveOnline]);

  // ─── 评估每个粉尘传感器的状态 ───
  const now = Date.now();
  const rows: DustRow[] = useMemo(() => {
    return dustSensors.map((sensor, index) => {
      const isFreq = isDustFreqSensor(sensor.productCode);
      const isAlarm = isDustAlarmSensor(sensor.productCode);
      const label = getSensorLabel(sensor, index);
      const value = isFreq ? extractSensorValue(sensor) : undefined;
      const alarmHigh = sensor.metadata.alarmHigh;
      const alarmLow = sensor.metadata.alarmLow;
      const latestTs = getLatestTimestamp(sensor);
      const staleness = evaluateStaleness(latestTs, now);

      // 报警型传感器
      let alarmTriggered = false;
      if (isAlarm) {
        const rt = sensor.metadata.realtime;
        alarmTriggered = rt?.alarm?.value === true;
      }

      // 状态判定
      let status: DustStatus;
      let ratio = 0;

      if (!sensor.online || staleness.isVeryStale) {
        status = "offline";
      } else if (isAlarm) {
        status = alarmTriggered ? "alarm" : "normal";
        ratio = alarmTriggered ? 1 : 0;
      } else if (isFreq) {
        if (value === undefined || !Number.isFinite(value)) {
          status = staleness.isVeryStale ? "offline" : (staleness.isStale ? "warning" : "normal");
        } else if (alarmHigh !== undefined && Number.isFinite(alarmHigh) && alarmHigh > 0) {
          ratio = value / alarmHigh;
          if (value >= alarmHigh) {
            status = "alarm";
          } else if (value >= alarmHigh * warningRatio) {
            status = "warning";
          } else {
            status = "normal";
          }
        } else {
          // 无阈值配置，只看在线状态
          status = "normal";
          ratio = 0;
        }
      } else {
        status = "normal";
      }

      return {
        deviceId: sensor.deviceId,
        label,
        productCode: sensor.productCode,
        isFreq,
        isAlarm,
        value,
        alarmHigh,
        alarmLow,
        status,
        ratio: Math.min(ratio, 1.2),
        isStale: staleness.isStale,
        ageSec: staleness.ageSec,
        alarmTriggered,
      };
    });
  }, [dustSensors, now, warningRatio]);

  // ─── 统计摘要 ───
  const stats = useMemo(() => {
    let normal = 0, warning = 0, alarm = 0, offline = 0;
    for (const r of rows) {
      if (r.status === "normal") normal++;
      else if (r.status === "warning") warning++;
      else if (r.status === "alarm") alarm++;
      else offline++;
    }
    return { normal, warning, alarm, offline, total: rows.length };
  }, [rows]);

  // ─── 字体系统：4K 大屏自适应 ───
  const baseFontSize = Math.max(13, Math.min(width / 55, height / 22, 22));
  const headerFontSize = baseFontSize * 0.95;
  const cellFontSize = baseFontSize * 0.8;
  const smallFontSize = baseFontSize * 0.65;

  // ─── 空状态 ───
  const isUnbound = rawSelectedIds.length === 0 && mainControllerIds.length === 0;
  const hasNoSensors = mainControllerIds.length > 0 && dustSensors.length === 0;
  const globalNoSensors = rawSelectedIds.length === 0 && dustSensors.length === 0;

  const isDark = theme === "dark";
  const textColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(30,41,59,0.9)";
  const textMuted = isDark ? "rgba(255,255,255,0.5)" : "rgba(100,116,139,0.7)";
  const borderColor = isDark ? "rgba(120,144,156,0.2)" : "rgba(203,213,225,0.5)";
  const headerBg = isDark ? "rgba(30,58,107,0.3)" : "rgba(241,245,249,0.8)";
  const rowBg = isDark ? "rgba(79,195,247,0.04)" : "rgba(248,250,252,0.6)";
  const rowAltBg = isDark ? "rgba(79,195,247,0.02)" : "rgba(255,255,255,0.4)";

  // ═══════════════════════════════════════════════════════════════════
  // 空状态渲染
  // ═══════════════════════════════════════════════════════════════════
  if (globalNoSensors) {
    return (
      <Box sx={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: isDark ? "linear-gradient(180deg, rgba(10,20,40,0.95), rgba(8,15,30,0.98))" : "linear-gradient(180deg, rgba(248,250,252,0.95), rgba(241,245,249,0.98))",
        border: `1px solid ${borderColor}`, borderRadius: 1.5, gap: 1,
      }}>
        <Typography sx={{ fontSize: baseFontSize, color: textMuted, fontWeight: 500 }}>
          粉尘浓度预警报警
        </Typography>
        <Typography sx={{ fontSize: smallFontSize, color: textMuted }}>
          {isUnbound ? "等待集控器接入…" : hasNoSensors ? "未发现粉尘传感器" : "等待数据接入…"}
        </Typography>
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // 主面板渲染
  // ═══════════════════════════════════════════════════════════════════

  // 表格列宽：等比例 fr 布局，天然撑满整行、随面板宽度等比伸缩
  //（原实现为 px 固定宽 + Math.max 兜底，宽面板下列宽不合理/不撑满）。
  // 比例：监测点 1.4 ｜ 当前值 1 ｜ 报警阈值 1 ｜ 状态 0.8 ｜ 浓度占比 1.8（占比条最宽）
  // 表头与数据行必须共用同一模板，保证列对齐。
  const GRID_COLUMNS = "1.4fr 1fr 1fr 0.8fr 1.8fr";

  // 浓度占比条宽度（占可用列宽）
  const barMaxWidth = Math.max(60, width * 0.08);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: isDark
          ? "linear-gradient(180deg, rgba(10,20,40,0.95) 0%, rgba(8,15,30,0.98) 100%)"
          : "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.98) 100%)",
        border: `1px solid ${borderColor}`,
        borderRadius: 1.5,
      }}
    >
      {/* ─── 标题栏 + 统计摘要 ─── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${borderColor}`,
          background: headerBg,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: headerFontSize, color: textColor, fontWeight: 700, letterSpacing: 1,
            // 标题按合理宽度撑满：占据统计摘要左侧的全部剩余宽度，超长省略号截断
            flex: 1, minWidth: 0,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {(["normal", "warning", "alarm", "offline"] as DustStatus[]).map((st) => {
            const count = st === "normal" ? stats.normal : st === "warning" ? stats.warning : st === "alarm" ? stats.alarm : stats.offline;
            const sc = STATUS_COLORS[st];
            return (
              <Box key={st} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box
                  sx={{
                    width: baseFontSize * 0.5,
                    height: baseFontSize * 0.5,
                    borderRadius: "50%",
                    backgroundColor: sc.color,
                    boxShadow: count > 0 && st === "alarm"
                      ? `0 0 8px ${sc.color}88`
                      : count > 0 && st === "warning"
                        ? `0 0 6px ${sc.color}66`
                        : "none",
                    animation: count > 0 && st === "alarm" ? "dustAlarmPulse 1.2s ease-in-out infinite" : "none",
                    "@keyframes dustAlarmPulse": {
                      "0%,100%": { boxShadow: `0 0 8px ${sc.color}88` },
                      "50%": { boxShadow: `0 0 16px ${sc.color}cc, 0 0 24px ${sc.color}44` },
                    },
                  }}
                />
                <Typography sx={{ fontSize: smallFontSize, color: textMuted }}>{sc.label}</Typography>
                <Typography sx={{ fontSize: cellFontSize, color: sc.color, fontWeight: 700, minWidth: 16 }}>
                  {count}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ─── 表头 ─── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: GRID_COLUMNS,
          px: 1.5,
          py: 0.5,
          borderBottom: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: smallFontSize, color: textMuted, fontWeight: 500 }}>监测点</Typography>
        <Typography sx={{ fontSize: smallFontSize, color: textMuted, fontWeight: 500 }}>当前值</Typography>
        <Typography sx={{ fontSize: smallFontSize, color: textMuted, fontWeight: 500 }}>报警阈值</Typography>
        <Typography sx={{ fontSize: smallFontSize, color: textMuted, fontWeight: 500 }}>状态</Typography>
        <Typography sx={{ fontSize: smallFontSize, color: textMuted, fontWeight: 500 }}>浓度占比</Typography>
      </Box>

      {/* ─── 数据行 ─── */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {rows.length === 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <Typography sx={{ fontSize: smallFontSize, color: textMuted }}>
              {hasNoSensors ? "该集控器下未发现粉尘传感器" : "等待粉尘传感器接入…"}
            </Typography>
          </Box>
        ) : (
          rows.map((row, idx) => {
            const sc = STATUS_COLORS[row.status];
            const barWidth = Math.min(row.ratio, 1) * barMaxWidth;
            const barPercent = row.ratio > 0 ? Math.round(row.ratio * 100) : 0;
            const isAlarmRow = row.status === "alarm";

            return (
              <Tooltip
                key={row.deviceId}
                title={
                  <Box sx={{ fontSize: 11, lineHeight: 1.6 }}>
                    <div>设备ID: {row.deviceId}</div>
                    <div>类型: {row.isFreq ? "频率型(18015)" : "报警型(18029)"}</div>
                    {row.isFreq && row.value !== undefined && <div>当前值: {row.value.toFixed(valuePrecision)} mg/m³</div>}
                    {row.alarmHigh !== undefined && <div>报警上限: {row.alarmHigh} mg/m³</div>}
                    {row.alarmLow !== undefined && <div>报警下限: {row.alarmLow} mg/m³</div>}
                    {row.ageSec >= 0 && <div>数据年龄: {row.ageSec}s {row.isStale ? "(陈旧)" : ""}</div>}
                    <div>状态: {sc.label}</div>
                  </Box>
                }
                arrow
                placement="left"
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: GRID_COLUMNS,
                    px: 1.5,
                    py: 0.5,
                    alignItems: "center",
                    background: idx % 2 === 0 ? rowBg : rowAltBg,
                    borderBottom: `1px solid ${borderColor}`,
                    borderLeft: isAlarmRow ? `3px solid ${sc.color}` : `3px solid transparent`,
                    transition: "background 0.2s",
                    "&:hover": { background: isDark ? "rgba(79,195,247,0.08)" : "rgba(79,195,247,0.06)" },
                    animation: isAlarmRow ? "dustRowPulse 2s ease-in-out infinite" : "none",
                    "@keyframes dustRowPulse": {
                      "0%,100%": { background: idx % 2 === 0 ? rowBg : rowAltBg },
                      "50%": { background: sc.bg },
                    },
                  }}
                >
                  {/* 监测点名称 */}
                  <Typography sx={{
                    fontSize: cellFontSize, color: textColor, fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {row.label}
                  </Typography>

                  {/* 当前值 */}
                  <Box>
                    {row.isAlarm ? (
                      <Typography sx={{
                        fontSize: cellFontSize,
                        color: row.alarmTriggered ? "#ef4444" : "#22c55e",
                        fontWeight: 700,
                      }}>
                        {row.alarmTriggered ? "触发" : "未触发"}
                      </Typography>
                    ) : row.value !== undefined ? (
                      <Typography sx={{
                        fontSize: cellFontSize, color: sc.color, fontWeight: 700,
                        fontFamily: "monospace",
                      }}>
                        {row.value.toFixed(valuePrecision)}
                        <Typography component="span" sx={{ fontSize: smallFontSize, color: textMuted, ml: 0.3 }}>
                          mg/m³
                        </Typography>
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: cellFontSize, color: textMuted }}>--</Typography>
                    )}
                  </Box>

                  {/* 报警阈值 */}
                  <Box>
                    {row.isAlarm ? (
                      <Typography sx={{ fontSize: smallFontSize, color: textMuted }}>开关量</Typography>
                    ) : row.alarmHigh !== undefined ? (
                      <Typography sx={{ fontSize: cellFontSize, color: textMuted, fontFamily: "monospace" }}>
                        {row.alarmHigh.toFixed(valuePrecision)}
                        <Typography component="span" sx={{ fontSize: smallFontSize, ml: 0.3 }}>mg/m³</Typography>
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: smallFontSize, color: textMuted }}>未设置</Typography>
                    )}
                  </Box>

                  {/* 状态标签 */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{
                      width: baseFontSize * 0.4,
                      height: baseFontSize * 0.4,
                      borderRadius: "50%",
                      backgroundColor: sc.color,
                      flexShrink: 0,
                      boxShadow: row.status === "alarm" ? `0 0 6px ${sc.color}88` : "none",
                      animation: row.status === "alarm" ? "dustDotPulse 1s ease-in-out infinite" : "none",
                      "@keyframes dustDotPulse": {
                        "0%,100%": { opacity: 1, transform: "scale(1)" },
                        "50%": { opacity: 0.6, transform: "scale(0.85)" },
                      },
                    }} />
                    <Typography sx={{ fontSize: smallFontSize, color: sc.color, fontWeight: 600 }}>
                      {sc.label}
                    </Typography>
                  </Box>

                  {/* 浓度占比条 */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {row.isAlarm ? (
                      <Typography sx={{ fontSize: smallFontSize, color: textMuted }}>
                        {row.alarmTriggered ? "已触发" : "监控中"}
                      </Typography>
                    ) : row.alarmHigh !== undefined && row.value !== undefined ? (
                      <>
                        <Box sx={{
                          flex: 1,
                          maxWidth: barMaxWidth,
                          height: baseFontSize * 0.5,
                          background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                          borderRadius: 999,
                          overflow: "hidden",
                          position: "relative",
                        }}>
                          <Box sx={{
                            width: `${Math.min(barWidth / barMaxWidth * 100, 100)}%`,
                            height: "100%",
                            background: row.status === "alarm"
                              ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                              : row.status === "warning"
                                ? "linear-gradient(90deg, #22c55e, #f59e0b)"
                                : "linear-gradient(90deg, #22c55e, #4ade80)",
                            borderRadius: 999,
                            transition: "width 0.5s ease",
                          }} />
                          {/* 预警线标记 */}
                          <Box sx={{
                            position: "absolute",
                            left: `${warningRatio * 100}%`,
                            top: -2,
                            bottom: -2,
                            width: 1,
                            background: "rgba(245,158,11,0.6)",
                          }} />
                        </Box>
                        <Typography sx={{
                          fontSize: smallFontSize,
                          color: textMuted,
                          fontFamily: "monospace",
                          minWidth: 32,
                        }}>
                          {barPercent}%
                        </Typography>
                      </>
                    ) : (
                      <Typography sx={{ fontSize: smallFontSize, color: textMuted }}>--</Typography>
                    )}
                  </Box>
                </Box>
              </Tooltip>
            );
          })
        )}
      </Box>

      {/* ─── 底部说明 ─── */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 1.5,
          py: 0.4,
          borderTop: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: smallFontSize * 0.9, color: textMuted }}>
          预警线: 报警阈值×{(warningRatio * 100).toFixed(0)}% ｜ 数据周期: 30s
        </Typography>
        <Typography sx={{ fontSize: smallFontSize * 0.9, color: textMuted }}>
          共 {stats.total} 个监测点
        </Typography>
      </Box>
    </Box>
  );
}
