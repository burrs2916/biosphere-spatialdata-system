/**
 * ScreenComponents — 共享基础工具 + 通用设备外壳 + 屏幕内容子组件
 *
 * 被 ControllerFrames / SensorFrame / PinFrame 及 barrel 共同引用。
 */

import React from "react";
import type { DeviceLiveStatus, StatusVisual, CoreValue, BodyScheme } from "../deviceStatus";

// ─── 离线灰板配色（形状/线条/螺丝/端子完全和正常形态一致，只换颜色） ───
export const OFFLINE_PALETTE = {
  body: "#8C8C8C",      // 灰色面板
  border: "#5A5A5A",    // 深灰描边
  screen: "#2A2A2A",    // 屏幕变暗（模拟"屏幕关闭"）
  screw: "#2A2A2A",     // 螺丝深灰
  terminal: "#6A6A6A",  // 端子变灰
};

/** 根据 bodyScheme 解析各部位颜色（保持 SVG 形状/线条完全一致，只换颜色） */
export function resolveColors(
  scheme: BodyScheme,
  c: { bodyColor?: string; borderColor?: string; screenColor?: string; screwColor?: string; terminalColor?: string },
) {
  if (scheme === "offline") {
    return {
      body: OFFLINE_PALETTE.body,
      border: OFFLINE_PALETTE.border,
      screen: OFFLINE_PALETTE.screen,
      screw: OFFLINE_PALETTE.screw,
      terminal: OFFLINE_PALETTE.terminal,
    };
  }
  return {
    body: c.bodyColor ?? "",
    border: c.borderColor ?? "",
    screen: c.screenColor ?? "",
    screw: c.screwColor ?? "",
    terminal: c.terminalColor ?? "",
  };
}

// ─── 类型 ──────────────────────────────────────────────

/** 所有 Frame 共享的基础 Props */
export interface BaseDeviceFrameProps {
  /** 主体色（面板填充） */
  bodyColor?: string;
  /** 边框色 */
  borderColor?: string;
  /** 屏幕填充色 */
  screenColor?: string;
  /** 螺丝/紧固件色 */
  screwColor?: string;
  /** 端子色 */
  terminalColor?: string;
  /** 设备状态（用于屏幕显示 + 置灰） */
  status: DeviceLiveStatus;
  /** 状态视觉配置（颜色/脉冲/置灰） */
  statusVisual: StatusVisual;
  /** 屏幕主标签（设备编号 / 设备名） */
  label: string;
  /** 屏幕副标题（产品名，可选） */
  subtitle?: string | null;
  /** 是否为产品模板形态 */
  isTemplate?: boolean;
  /** 额外 CSS 类名 */
  className?: string;
  /** 通用化：用户从后端 tags 中选出来的"面板"字段（覆盖默认 label/subtitle） */
  faceItems?: Array<{ key: string; label: string; value: string; unit?: string }>;
  /** 通用化：用户从后端 tags 中选出来的"屏幕"字段（覆盖默认 coreValue/状态行） */
  screenItems?: Array<{ key: string; label: string; value: string; unit?: string }>;
  /** 隐藏屏幕内所有内容（用于设备列表小图标等空间受限场景） */
  hideScreenContent?: boolean;
  /** 设备元数据（用于仪表盘阈值联动：minRange/maxRange/alarmLow/alarmHigh/realtime） */
  deviceMetadata?: Record<string, any>;
}

/** 传感器 / 通用设备 Frame Props（携带核心数值 + 自定义屏幕内容） */
export interface SensorFrameProps extends BaseDeviceFrameProps {
  /** 屏幕右上角核心数值（仅传感器） */
  coreValue?: CoreValue;
  /** 屏幕区附加内容（覆盖默认布局） */
  screenContent?: React.ReactNode;
  /** 传感器类型：
   *  - numeric   : 通用数值型
   *  - dust      : 粉尘浓度（18015，-Sensor-Dust）
   *  - alarm     : 通用报警型
   *  - touch     : 触控
   *  - infrared  : 红外
   *  - smoke     : 烟雾
   *  - alarm_dust: 粉尘报警（18029，-Alarm-Dust，highByte.1 位）
   *  - alarm_temperature: 温度报警（18025，-Alarm-Temperature，lowByte.5 位）
   *  - alarm_co  : CO 报警（18030，-Alarm-CO，highByte.2 位）
   *  - cleanWall : 清洗煤壁传感器（18035，-Alarm-CleanWall，独立报警型）
   *  - flowMeter : 流量计（18040，命令码 0x0626）
   *  - pump      : 压力泵（18041，命令码 0x0627）
   */
  sensorType?: "numeric" | "dust" | "co" | "ch4" | "temperature" | "wind" | "windPress" | "alarm" | "touch" | "infrared" | "smoke" | "alarm_dust" | "flame" | "alarm_temperature" | "alarm_co" | "top_coal" | "coalCutter" | "frameMove" | "frameDrop" | "vibration" | "cleanWall" | "flowMeter" | "pump" | "collector_wireless" | "collector_wired";
  /** 报警型传感器是否已触发 */
  triggered?: boolean;
}

// ─── 通用设备外壳 (Fallback) ───────────────────────────────

const GENERIC_VW = 120;
const GENERIC_VH = 100;

export function GenericDeviceFrame({
  bodyColor = "#607D8B",
  borderColor = "#455A64",
  screenColor = "#5A9ED6",
  status,
  statusVisual,
  label,
  subtitle,
  coreValue,
  screenContent,
}: SensorFrameProps) {
  const palette = resolveColors(statusVisual.bodyScheme, {
    bodyColor, borderColor, screenColor, screwColor: "#2A2A2A", terminalColor: "#6A6A6A",
  });

  return (
    <div
      style={{
        width: "100%", height: "100%", position: "relative",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${GENERIC_VW} ${GENERIC_VH}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        <rect x="10" y="8" width="100" height="80" rx="6" fill={palette.body} stroke={palette.border} strokeWidth={2} />
        <rect x="20" y="20" width="80" height="40" rx="3" fill={palette.screen} stroke="#333" strokeWidth={1} />
        <circle cx="100" cy="18" r="4" fill={statusVisual.color} />
      </svg>

      <div
        style={{
          position: "absolute",
          left: `${(20 / GENERIC_VW) * 100}%`,
          top: `${(20 / GENERIC_VH) * 100}%`,
          width: `${(80 / GENERIC_VW) * 100}%`,
          height: `${(40 / GENERIC_VH) * 100}%`,
          display: "flex", flexDirection: "column",
          alignItems: "stretch", justifyContent: "center",
          padding: "2px 4px",
          boxSizing: "border-box",
          overflow: "hidden", pointerEvents: "none",
          color: "#fff",
        }}
      >
        {screenContent ?? (
          <ScreenContent
            status={status}
            statusColor={statusVisual.color}
            statusText={statusVisual.text}
            pulse={statusVisual.pulse}
            label={label}
            subtitle={subtitle}
            coreValue={coreValue}
            dimmed={statusVisual.bodyScheme === "offline"}
          />
        )}
      </div>
    </div>
  );
}

// ─── 屏幕内容（统一子组件） ──────────────────────────────────

export interface ScreenContentProps {
  status: DeviceLiveStatus;
  statusColor: string;
  statusText: string;
  pulse: boolean;
  label: string;
  subtitle?: string | null;
  coreValue?: CoreValue;
  /** 外壳是否处于离线灰形态（屏幕文字降透明度） */
  dimmed?: boolean;
  /** 屏幕缩放因子（基于实际渲染高度，替代 vw 单位） */
  scale?: number;
}

/** 统一屏幕布局：第 1 行状态点+文字|核心数值；第 2 行设备编号；副标题产品名
 *
 * `dimmed` 标志表示外壳处于离线灰色形态：屏幕内的文字/数值统一变浅灰，
 * 字号、位置、布局完全不变 → 与正常形态屏幕结构一致
 */
export function ScreenContent({
  status: _status,
  statusColor,
  statusText,
  pulse,
  label,
  subtitle,
  coreValue,
  dimmed = false,
  scale = 1,
}: ScreenContentProps) {
  const showCore = coreValue?.display === true;
  // 离线时：状态色降为浅灰；其他文字用浅色；core 数值用浅色
  const effectiveStatusColor = dimmed ? "#BBBBBB" : statusColor;
  const labelColor = dimmed ? "rgba(255,255,255,0.55)" : "#FFFFFF";
  const subtitleColor = dimmed ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)";
  const coreColor = dimmed ? "rgba(255,255,255,0.5)" : "#FFFFFF";

  // 基于 scale 的动态字体大小（替代 vw 单位，随画布缩放自适应）
  // scale 上限 1.5，避免大画布下文字过大
  const sc = Math.min(scale, 1.5);
  const statusFontSize = Math.max(5, Math.round(9 * sc));
  const labelFontSize = Math.max(5, Math.round(9 * sc));
  const subtitleFontSize = Math.max(4, Math.round(7 * sc));
  const coreFontSize = Math.max(6, Math.round(11 * sc));
  const dotSize = Math.max(3, Math.round(5 * sc));
  const gapSize = Math.max(2, Math.round(4 * sc));
  const marginLeft = Math.max(3, Math.round(10 * sc));

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: gapSize,
          fontSize: `${statusFontSize}px`,
          fontWeight: 700,
          lineHeight: 1.1,
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: gapSize, minWidth: 0, flex: 1 }}>
          <StatusDot color={effectiveStatusColor} pulse={pulse} size={dotSize} />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: dimmed ? "rgba(255,255,255,0.55)" : "#FFFFFF",
            }}
          >
            {statusText}
          </span>
        </div>
        {showCore && (
          <span
            style={{
              fontSize: `${coreFontSize}px`,
              fontWeight: 800,
              color: coreValue?.overAlarm || coreValue?.outOfRange
                ? "#FF1744"   // 2026-06-15：超量程/超预设置标红
                : coreColor,
              flexShrink: 0,
              textShadow: coreValue?.overAlarm
                ? "0 0 6px rgba(255,23,68,0.7)"
                : undefined,
            }}
          >
            {coreValue?.overAlarm && (
              // 角标："超"字 + 闪烁（仅超预设置报警时显示）
              <span
                style={{
                  display: "inline-block",
                  marginRight: 4,
                  padding: "0 4px",
                  fontSize: "0.55em",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  background: "#FF1744",
                  borderRadius: 3,
                  letterSpacing: 0.5,
                  animation: "biosphere-alarm-flash 0.8s steps(2,end) infinite",
                }}
              >
                超
              </span>
            )}
            {coreValue?.text}
            {coreValue?.unit && (
              <span style={{ fontSize: "0.7em", marginLeft: 2, opacity: 0.85 }}>{coreValue.unit}</span>
            )}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: `${labelFontSize}px`,
          fontWeight: 700,
          marginTop: Math.max(1, Math.round(2 * scale)),
          marginLeft,
          color: labelColor,
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
        title={label}
      >
        {label}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: `${subtitleFontSize}px`,
            fontWeight: 500,
            color: subtitleColor,
            marginTop: Math.max(1, Math.round(2 * scale)),
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={subtitle}
        >
          {subtitle}
        </div>
      )}
    </>
  );
}

/** 状态点
 *  - color：点颜色
 *  - pulse：true 时叠加扩散圈（外圈 scale 1→2.2, opacity 0.5→0），用于告警/检查中
 *  - blink：true 时点本身在 0.35↔1 之间脉动（1.2s 循环），用于在线态心跳指示
 *  - size：显式像素值；未传时用原 clamp(6px, 0.7vw, 24px) 视口响应式
 *  - pulse 与 blink 可共存：blink 影响内点亮度，pulse 影响外圈扩散
 */
export function StatusDot({
  color,
  pulse,
  blink = false,
  size,
}: {
  color: string;
  pulse: boolean;
  blink?: boolean;
  size?: number;
}) {
  // 显式 size：按调用方传入的像素值（用于屏幕实际像素自适应的场景）
  // 未传 size：沿用原 clamp(6px, 0.7vw, 24px) 响应式逻辑（其他 frame 仍按视口宽计算）
  const dotSize = size !== undefined ? `${size}px` : "clamp(6px, 0.7vw, 24px)";
  // 光晕半径 = 尺寸的 40%
  const glow = size !== undefined
    ? `${Math.max(2, Math.round(size * 0.4))}px`
    : "clamp(2px, 0.2vw, 6px)";
  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        width: dotSize,
        height: dotSize,
        flexShrink: 0,
        // 持续光晕（不依赖动画，确保任何时候都能看到绿点轮廓）
        filter: `drop-shadow(0 0 ${glow} ${color})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: color,
          border: "1.5px solid rgba(255,255,255,0.85)",  // 白色描边，与屏幕蓝底形成强对比
          boxSizing: "border-box",
          animation: blink
            ? "device-status-blink 1.2s ease-in-out infinite"
            : undefined,
        }}
      />
      {pulse && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: color,
            opacity: 0.5,
            animation: "device-status-pulse 1.8s ease-in-out infinite",
          }}
        />
      )}
      <style>{`
        @keyframes device-status-pulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(2.2); opacity: 0; } }
        @keyframes device-status-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes biosphere-alarm-flash { 0%,49% { opacity: 1; } 50%,100% { opacity: 0.35; } }
      `}</style>
    </div>
  );
}
