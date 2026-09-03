/**
 * SupportStatusRenderer - 综采工作面支架状态表（对标 sprayv2/showzc 的"工作面状态"与"支架状态表"）
 *
 * 数据契约：
 *  - 聚合状态（割煤机位置/移架/落架/放顶煤）来自绑定集控器子树内各分控器的 batteryWarning 位域
 *    （协议 0x061e 电池预警低字节：bit0 割煤机位置 / bit1 移架 / bit2 落架 / bit3 放顶煤），
 *    任一分控器对应 bit=1 即点亮（OR 聚合），复用 deviceStatus.parseAlarmBitField。
 *    （旧实现读主控 realtime.alarmSensors，但边缘从不给主控推该 tag，聚合灯永远全灭——已修正。）
 *  - 支架传感器表来自该集控器子树下的各报警传感器设备（productCode 含 -Alarm-），
 *    每个设备的触发/电池状态取自其 metadata（与 deviceStatus.__builtin_alarmTrigger__ 同源）。
 *  - 协议真源：协议.txt 0x061e 分控器状态位域；字段解析规则.json batteryWarning 定义一致。
 *
 * 设备发现：严格绑定（selectedDeviceIds 留空 = 不显示），仅纳入已勾选的集控器并遍历其子树
 *   ——与 ShearerPositionCurveRenderer 的发现逻辑一致，避免混入巷道/廊桥设备
 *   （deviceStore 为全矿共享池，无区域过滤）。
 *
 * 注意：移架/落架/放煤为机械动作"状态上报"（非可下发命令），与老项目只显示状态/传感器表一致。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { useThrottledDevices } from "../../../hooks/useThrottledDevices";
import { useDeviceStore } from "../../../store/deviceStore";
import { parseAlarmBitField, type AlarmSensorKind } from "../deviceVariants/deviceStatus";
import { isSubControllerDevice } from "../../../devices/productCodePredicates";
import type { ComponentRendererProps } from "../../../types/editor";

const MAIN_CONTROLLER_PC = new Set(["18", "FY002-MainController"]);
const ALARM_PC_MARK = "-Alarm-";

const SUPPORT_ALARM_LABEL: Record<string, string> = {
  CoalCutter: "割煤机位置",
  FrameMove: "移架",
  FrameDrop: "落架",
  TopCoal: "放顶煤",
  Smoke: "烟雾",
  Temperature: "温度",
  Infrared: "红外",
  Touch: "触控",
  Vibration: "振动",
  Dust: "粉尘",
  CO: "CO",
  Flame: "火焰",
};

interface SensorRow {
  id: string;
  label: string;
  triggered: boolean;
  battery: boolean;
  online: boolean;
}

function getMeta(dev: Record<string, unknown>): Record<string, unknown> {
  return (dev.metadata as Record<string, unknown> | undefined) ?? {};
}

/** 报警传感器位域原始值（兼容 flat 与 realtime 两种落库位置） */
function readAlarmBitRaw(dev: Record<string, unknown>): unknown {
  const md = getMeta(dev);
  const rt = (md.realtime as Record<string, unknown> | undefined) ?? {};
  return rt.alarmSensors ?? md.alarmSensors;
}

function devTriggered(dev: Record<string, unknown>): boolean {
  const md = getMeta(dev);
  const rt = (md.realtime as Record<string, { value?: unknown }> | undefined) ?? {};
  const v = rt.alarm?.value ?? md.alarm;
  return v === true || v === 1;
}

function devBatteryWarn(dev: Record<string, unknown>): boolean {
  const md = getMeta(dev);
  const rt = (md.realtime as Record<string, { value?: unknown }> | undefined) ?? {};
  const v = rt.batteryWarning?.value ?? md.batteryWarning;
  return v === true || v === 1;
}

function alarmLabel(productCode: string): string {
  for (const [k, v] of Object.entries(SUPPORT_ALARM_LABEL)) {
    if (productCode.includes(`-Alarm-${k}`)) return v;
  }
  return productCode;
}

export function SupportStatusRenderer({ config }: ComponentRendererProps) {
  const title = (config.title as string) ?? "支架状态表";
  const rawSelectedIds = (config.selectedDeviceIds as string[] | undefined) ?? [];
  const showAggregates = (config.showAggregates as boolean) ?? true;
  const showBattery = (config.showBattery as boolean) ?? true;
  const accentColor = (config.accentColor as string) || "#5A9ED6";
  const devicesMap = useThrottledDevices(500);
  const getEffectiveOnline = useDeviceStore((s) => s.getEffectiveOnline);

  const { aggregates, sensors, onlineCount } = useMemo(() => {
    const sel = rawSelectedIds;
    const all = Object.entries(devicesMap) as [string, Record<string, unknown>][];

    // 1) 识别综采工作面集控器（带煤机位置 tag）—— 严格绑定：仅纳入已绑定的集控器
    const miningCtrls: string[] = [];
    for (const [id, dev] of all) {
      const pc = String(dev.productCode ?? "");
      if (!MAIN_CONTROLLER_PC.has(pc)) continue;
      if (!sel.includes(id)) continue;
      miningCtrls.push(id);
    }

    // 2) 子树映射（parentDeviceId）
    const children: Record<string, string[]> = {};
    for (const [id, dev] of all) {
      const p = dev.parentDeviceId as string | undefined;
      if (p) (children[p] ??= []).push(id);
    }

    // 3) 聚合状态（协议 0x061e：割煤机位置/移架/落架/放顶煤 = 分控器电池预警低字节 bit0-3）
    //    真源：绑定集控器子树内各分控器的 batteryWarning 位域，任一置 1 即点亮（OR 聚合）。
    //    旧实现读主控 realtime.alarmSensors —— 边缘从不给主控推该 tag（只推分控器/传感器级），
    //    聚合灯永远全灭；主控级位域保留为兼容输入（若未来边缘推了仍纳入判定）。
    const agg = { coalCutter: false, frameMove: false, frameDrop: false, topCoal: false };
    const AGG_KINDS: Array<[keyof typeof agg, AlarmSensorKind]> = [
      ["coalCutter", "coalCutter"],
      ["frameMove", "frameMove"],
      ["frameDrop", "frameDrop"],
      ["topCoal", "topCoal"],
    ];
    let online = 0;
    if (miningCtrls.length > 0) {
      const cdev = devicesMap[miningCtrls[0]] as Record<string, unknown>;
      if ((cdev.online as boolean) ?? false) online = 1;
      // 兼容输入：主控级 alarmSensors 位域（当前边缘不推，保留不破坏）
      const mainRaw = readAlarmBitRaw(cdev);
      if (mainRaw !== undefined) {
        const synth = { alarmSensors: mainRaw };
        for (const [key, kind] of AGG_KINDS) {
          if (parseAlarmBitField(synth, kind).triggered) agg[key] = true;
        }
      }
      // 真源：子树内分控器的 batteryWarning 位域（低字节 bit0-3）
      for (const ctrl of miningCtrls) {
        const queue = [...(children[ctrl] ?? [])];
        while (queue.length > 0) {
          const cur = queue.shift() as string;
          const sdev = devicesMap[cur] as Record<string, unknown> | undefined;
          if (!sdev) continue;
          if (isSubControllerDevice(sdev)) {
            const md = (sdev.metadata as Record<string, unknown> | undefined) ?? {};
            const rt = (md.realtime as Record<string, { value?: unknown }> | undefined) ?? {};
            const bw = rt.batteryWarning?.value ?? md.batteryWarning;
            if (bw !== undefined) {
              const synth = { batteryWarning: bw };
              for (const [key, kind] of AGG_KINDS) {
                // batteryWarning 位=1 表示"有该状态"，取 .batteryWarning 而非 .triggered
                if (parseAlarmBitField(synth, kind).batteryWarning) agg[key] = true;
              }
            }
          }
          for (const c of children[cur] ?? []) queue.push(c);
        }
      }
    }

    // 4) 支架传感器表：遍历综采集控器子树下的报警传感器设备
    const supportIds = new Set<string>();
    for (const ctrl of miningCtrls) {
      const queue = [...(children[ctrl] ?? [])];
      while (queue.length > 0) {
        const cur = queue.shift() as string;
        const cdev = devicesMap[cur] as Record<string, unknown> | undefined;
        if (!cdev) continue;
        const pc = String(cdev.productCode ?? "");
        if (pc.includes(ALARM_PC_MARK)) supportIds.add(cur);
        for (const c of children[cur] ?? []) queue.push(c);
      }
    }

    const rows: SensorRow[] = [];
    for (const id of supportIds) {
      const dev = devicesMap[id] as Record<string, unknown>;
      rows.push({
        id,
        label: alarmLabel(String(dev.productCode ?? "")),
        triggered: devTriggered(dev),
        battery: devBatteryWarn(dev),
        online: getEffectiveOnline(id),
      });
    }
    rows.sort((a, b) => a.label.localeCompare(b.label, "zh"));

    return { aggregates: agg, sensors: rows, onlineCount: online };
  }, [rawSelectedIds, devicesMap, getEffectiveOnline]);

  const chip = (label: string, on: boolean) => (
    <Box
      key={label}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.4,
        borderRadius: 1,
        bgcolor: on ? "rgba(239,68,68,0.18)" : "rgba(60,203,127,0.15)",
        border: `1px solid ${on ? "rgba(239,68,68,0.6)" : "rgba(60,203,127,0.5)"}`,
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: on ? "#ef4444" : "#3CCB7F" }} />
      <Typography sx={{ fontSize: 11, color: on ? "#ff8a80" : "#7ee0a8", fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontSize: 10, color: on ? "#ff8a80" : "#7ee0a8" }}>{on ? "触发" : "正常"}</Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(22,38,62,0.92) 0%, rgba(16,28,48,0.95) 100%)",
        border: "1px solid rgba(120,144,156,0.4)",
        borderRadius: 1.5,
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.6,
          borderBottom: "1px solid rgba(120,144,156,0.3)",
          background: "linear-gradient(90deg, rgba(120,144,156,0.12), transparent)",
          flexShrink: 0,
        }}
      >
        <Box sx={{ width: 3, height: 14, background: accentColor, borderRadius: 0.5 }} />
        <Typography sx={{ fontSize: 13, color: "#B0BEC5", fontWeight: 700, letterSpacing: 1 }}>{title}</Typography>
        {onlineCount === 0 && (
          <Typography sx={{ fontSize: 10, color: "#FFC107", ml: "auto" }}>集控器离线</Typography>
        )}
      </Box>

      {/* 聚合状态：煤机位置 / 移架 / 落架 / 放顶煤（对标"工作面状态"，可配置显隐） */}
      {showAggregates && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.8,
            px: 1.5,
            py: 1,
            borderBottom: "1px solid rgba(120,144,156,0.2)",
          }}
        >
          {chip("煤机位置", aggregates.coalCutter)}
          {chip("移架", aggregates.frameMove)}
          {chip("落架", aggregates.frameDrop)}
          {chip("放顶煤", aggregates.topCoal)}
        </Box>
      )}

      {/* 支架状态表：各报警传感器 */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 1, py: 0.5 }}>
        {sensors.length === 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              等待支架传感器数据(0x061e)…
            </Typography>
          </Box>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 10, color: "#90A4AE", padding: "2px 6px" }}>监测点</th>
                <th style={{ textAlign: "center", fontSize: 10, color: "#90A4AE", padding: "2px 6px" }}>状态</th>
                {showBattery && (
                  <th style={{ textAlign: "center", fontSize: 10, color: "#90A4AE", padding: "2px 6px" }}>电池</th>
                )}
                <th style={{ textAlign: "center", fontSize: 10, color: "#90A4AE", padding: "2px 6px" }}>在线</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id} style={{ opacity: s.online ? 1 : 0.5 }}>
                  <td style={{ fontSize: 11, color: "#cfd8e3", padding: "3px 6px" }}>{s.label}</td>
                  <td style={{ textAlign: "center", padding: "3px 6px" }}>
                    <Typography
                      component="span"
                      sx={{ fontSize: 11, fontWeight: 700, color: s.online ? (s.triggered ? "#ff8a80" : "#7ee0a8") : "#6b7280" }}
                    >
                      {s.online ? (s.triggered ? "触发" : "正常") : "--"}
                    </Typography>
                  </td>
                  {showBattery && (
                    <td style={{ textAlign: "center", padding: "3px 6px" }}>
                      <Typography
                        component="span"
                        sx={{ fontSize: 11, color: s.online ? (s.battery ? "#FFC107" : "#7ee0a8") : "#6b7280" }}
                      >
                        {s.online ? (s.battery ? "低电" : "正常") : "--"}
                      </Typography>
                    </td>
                  )}
                  <td style={{ textAlign: "center", padding: "3px 6px" }}>
                    <Typography
                      component="span"
                      sx={{ fontSize: 11, color: s.online ? "#7ee0a8" : "#6b7280" }}
                    >
                      {s.online ? "在线" : "离线"}
                    </Typography>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Box>
    </Box>
  );
}
