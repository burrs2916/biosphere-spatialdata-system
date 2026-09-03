/**
 * ControllerFrames — 喷雾集控器 (MainController) + 喷雾分控器 (SubController)
 *
 * 从 DeviceSvgFrames.tsx 拆分，引用 ScreenComponents 中的共享工具。
 */

import { useId } from "react";
import { resolveColors } from "./ScreenComponents";
import type { BaseDeviceFrameProps } from "./ScreenComponents";
import { isControllerLedActive, CONTROLLER_STATE_LEDS } from "../deviceStatus";

// ─── 集控器 Frame Props（额外携带子设备统计 + IP） ───

/** 集控器 Frame Props（额外携带子设备统计 + IP） */
export interface MainControllerFrameProps extends BaseDeviceFrameProps {
  /** 子设备统计（仅集控器） */
  childStats?: { subTotal: number; subOnline: number; sensorTotal: number; sensorOnline: number };
  /** IP 地址（显示在面板底部，仅集控器有独立 IP） */
  deviceIp?: string;
}

/** 分控器 Frame Props（无独立 IP/MAC，可携带父设备名） */
export interface SubControllerFrameProps extends BaseDeviceFrameProps {
  /** 所属集控器名称（显示在面板底部） */
  parentName?: string;
  /** controllerState 原始字节（驱动8个LED状态灯） */
  controllerState?: number;
}

// ═══════════════════════════════════════════════════════════
// 喷雾集控器 (MainController)
// ═══════════════════════════════════════════════════════════
//
// 严格 1:1 复刻自参考 SVG:
//   /references/SVG参考/设备/exported_image.svg
//
// 参考 SVG 原始结构：
//   viewBox="0 0 360 266"
//   <g transform="translate(0, 3)">
//     rect  主体面板   fill=#D93A3A  x=20 y=10 w=320 h=240 rx=8
//     rect  外框描边   stroke=#B82F2F stroke-width=6  x=10 y=0 w=340 h=260 rx=10
//     12x circle  螺丝孔  fill=#222222  r=4
//     rect  屏幕区   fill=#5A9ED6 stroke=#333 stroke-width=2  x=110 y=80 w=140 h=80 rx=4
//     <g transform="translate(0, 70)">  端子组  fill=#B82F2F
//       4x rect  x=0/0/350/350 y=0/100/0/100 w=10 h=20 rx=2
//     </g>
//   </g>

export const MC_VW = 360;
export const MC_VH = 266;

export function MainControllerFrame({
  bodyColor = "#D93A3A",
  borderColor = "#B82F2F",
  screenColor = "#5A9ED6",
  screwColor = "#222222",
  terminalColor = "#B82F2F",
  status: _status,
  statusVisual,
  label,
  subtitle: _subtitle,
  isTemplate = false,
  childStats,
  deviceIp,
  // 通用化：用户从后端 tags 中选出来的字段（覆盖硬编码的产品名/编号/IP）
  faceItems,
  screenItems,
}: MainControllerFrameProps) {
  const uid = useId().replace(/:/g, "");
  const glowId = `mc-glow-${uid}`;
  // 离线形态：形状完全一致，只换配色
  const palette = resolveColors(statusVisual.bodyScheme, {
    bodyColor, borderColor, screenColor, screwColor, terminalColor,
  });

  const isOffline = statusVisual.bodyScheme === "offline";
  const statusColor = isOffline ? "#BBBBBB" : (isTemplate ? "#F0A030" : statusVisual.color);
  // 状态文字：模板态显示"模板"，否则显示 statusVisual.text（在线/离线/告警/待定）
  const statusText = isTemplate ? "模板" : statusVisual.text;

  // 屏幕内文字颜色
  const screenTextColor = isOffline ? "rgba(255,255,255,0.5)" : "#FFFFFF";
  const screenSubTextColor = isOffline ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.7)";
  // 面板文字颜色
  const panelTextPrimary = isOffline ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)";
  const panelTextSecondary = isOffline ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.6)";

  return (
    <div
      style={{
        width: "100%", height: "100%", position: "relative",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${MC_VW} ${MC_VH}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        <defs>
          {/* 状态灯光晕滤镜 */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* 左上标识区裁剪：x=30~105, y=35~75（屏幕左侧窄区） */}
          <clipPath id={`face-top-clip-${uid}`}>
            <rect x="28" y="35" width="78" height="45" />
          </clipPath>
          {/* 屏幕下方全宽区裁剪：x=28~330, y=168~232（避开底部螺丝 y=240） */}
          <clipPath id={`face-bottom-clip-${uid}`}>
            <rect x="28" y="168" width="300" height="65" />
          </clipPath>
          {/* 屏幕文字裁剪区域：屏幕内边距 4px */}
          <clipPath id={`screen-clip-${uid}`}>
            <rect x="114" y="84" width="132" height="72" />
          </clipPath>
        </defs>

        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
          <g transform="translate(0, 3)">
            {/* 1. 主体面板 */}
            <rect x="20" y="10" width="320" height="240" rx="8" fill={palette.body} fillRule="nonzero" />
            {/* 2. 外框描边 */}
            <rect x="10" y="0" width="340" height="260" rx="10" fill="none" stroke={palette.border} strokeWidth={6} />
            {/* 3. 螺丝孔 — 上边 5 个 */}
            <circle cx="30" cy="20" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="110" cy="20" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="180" cy="20" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="250" cy="20" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="330" cy="20" r="4" fill={palette.screw} fillRule="nonzero" />
            {/* 螺丝孔 — 下边 5 个 */}
            <circle cx="30" cy="240" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="110" cy="240" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="180" cy="240" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="250" cy="240" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="330" cy="240" r="4" fill={palette.screw} fillRule="nonzero" />
            {/* 螺丝孔 — 左右中间各 1 个 */}
            <circle cx="30" cy="130" r="4" fill={palette.screw} fillRule="nonzero" />
            <circle cx="330" cy="130" r="4" fill={palette.screw} fillRule="nonzero" />
            {/* 4. 屏幕区域 */}
            <rect x="110" y="80" width="140" height="80" rx="4" fill={palette.screen} fillRule="nonzero" stroke="#333333" strokeWidth={2} />
            {/* 5. 接线端子组 */}
            <g transform="translate(0, 70)" fill={palette.terminal} fillRule="nonzero">
              <rect x="0" y="0" width="10" height="20" rx="2" />
              <rect x="0" y="100" width="10" height="20" rx="2" />
              <rect x="350" y="0" width="10" height="20" rx="2" />
              <rect x="350" y="100" width="10" height="20" rx="2" />
            </g>

            {/* ═══ 左上标识区（屏幕左侧窄区，显示产品名/短标识） ═══ */}
            <g clipPath={`url(#face-top-clip-${uid})`}>
              <text
                x="30" y="52"
                fill={panelTextPrimary}
                fontSize="10"
                fontFamily="sans-serif"
                fontWeight="700"
              >
                喷雾集控器
              </text>
              {!isTemplate && label && (
                <text
                  x="30" y="66"
                  fill={panelTextSecondary}
                  fontSize="7.5"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {label}
                </text>
              )}
            </g>
          </g>

          {/* ═══ 屏幕下方全宽区：faceItems（设备ID、IP、数据字段） ═══ */}
          <g clipPath={`url(#face-bottom-clip-${uid})`}>
            {faceItems && faceItems.length > 0 ? (
              faceItems.map((item, idx) => (
                <text
                  key={item.key}
                  x="30" y={180 + idx * 14}
                  fill={panelTextPrimary}
                  fontSize="9"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {item.label}{item.unit ? `(${item.unit})` : ""}: {item.value}
                </text>
              ))
            ) : (
              <>
                {/* 默认：设备ID + IP（向后兼容） */}
                {!isTemplate && label && (
                  <text
                    x="30" y="180"
                    fill={panelTextSecondary}
                    fontSize="8"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    ID: {label}
                  </text>
                )}
                {deviceIp && (
                  <text
                    x="30" y={isTemplate && !label ? 180 : 194}
                    fill={panelTextSecondary}
                    fontSize="8"
                    fontFamily="sans-serif"
                  >
                    IP: {deviceIp}
                  </text>
                )}
              </>
            )}
          </g>

          {/* ═══ 屏幕内容（纯 SVG，只显示动态信息） ═══ */}

          {/* 屏幕 1 行：状态 LED 灯 + 状态文字 */}
          <circle
            cx="118" cy="96"
            r="4"
            fill={statusColor}
            filter={`url(#${glowId})`}
          />
          {statusVisual.pulse && !isOffline && (
            <circle cx="118" cy="96" r="4" fill={statusColor} opacity="0.4">
              <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
          {/* 状态文字（永远保留，紧挨 LED 灯右侧） */}
          <text
            x="128" y="100"
            fill={screenTextColor}
            fontSize="11"
            fontFamily="sans-serif"
            fontWeight="700"
          >
            {statusText}
          </text>
          {/* 屏幕 2~N 行：screenItems（状态行下方） */}
          <g clipPath={`url(#screen-clip-${uid})`}>
          {screenItems && screenItems.length > 0 ? (
            screenItems.map((item, idx) => (
              <text
                key={item.key}
                x="118" y={118 + idx * 14}
                fill={screenSubTextColor}
                fontSize="9"
                fontFamily="sans-serif"
                fontWeight="600"
              >
                {item.label}{item.unit ? `(${item.unit})` : ""}: {item.value}
              </text>
            ))
          ) : (
            <text
              x="180" y="130"
              textAnchor="middle"
              fill={screenSubTextColor}
              fontSize="9"
              fontFamily="sans-serif"
              fontWeight="600"
            >
              {`分控${childStats?.subOnline ?? 0}/${childStats?.subTotal ?? 0}  传感${childStats?.sensorOnline ?? 0}/${childStats?.sensorTotal ?? 0}`}
            </text>
          )}
          </g>
          {/* 模板态屏幕 */}
          {isTemplate && (
            <text
              x="180" y="114"
              textAnchor="middle"
              fill="rgba(255,255,255,0.8)"
              fontSize="12"
              fontFamily="sans-serif"
              fontWeight="700"
            >
              {label || "喷雾集控器"}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 喷雾分控器 (SubController)
// ═══════════════════════════════════════════════════════════
//
// 严格复刻自参考 SVG:
//   /references/SVG参考/设备/industrial_instrument_v3_终.svg
//
// 参考 SVG 原始结构 (viewBox 656×295, translate(1,1)):
//   左阀门组: x=0, y=96, ~102×100（管道+散热片+螺栓）
//   右阀门组: x=551.5, y=96, 镜像
//   外框: stroke=#989CA0 fill=#D8DCDE x=102 y=0 w=450 h=293 rx=6
//   内框: stroke=#B8BCC0 fill=#E2E4E6 x=115 y=13 w=424 h=267 rx=3
//   6个精细六角螺丝
//   屏幕（黑底）: stroke=#0A0F14 fill=#1A1F24 x=204 y=68 w=246 h=144 rx=4
//   屏幕内框: stroke=#3A3F44 x=208 y=72 w=238 h=136 rx=2
//   红色边框: stroke=#D92525 stroke-width=4 x=217 y=81 w=220 h=118 rx=2
//   显示区（浅蓝）: fill=#B8D4E3 x=225 y=89 w=204 h=102 rx=1
//
// 归一化到 viewBox 328×148（原始 656×295 / 2）

export const SC_VW = 328;
export const SC_VH = 148;

export function SubControllerFrame({
  bodyColor = "#D8DCDE",
  borderColor = "#989CA0",
  screenColor = "#1A1F24",
  screwColor = "#B0B4B8",
  terminalColor = "#C8CCD0",
  status: _status,
  statusVisual,
  label,
  subtitle: _subtitle,
  faceItems,
  screenItems,
  isTemplate,
  parentName,
  controllerState,
}: SubControllerFrameProps) {
  const palette = resolveColors(statusVisual.bodyScheme, {
    bodyColor, borderColor, screenColor, screwColor, terminalColor,
  });

  const uid = useId().replace(/:/g, "");
  const glowId = `sc-glow-${uid}`;

  // 状态颜色
  const statusColor = statusVisual.color;
  const isOffline = statusVisual.bodyScheme === "offline";

  // 屏幕文字颜色（显示区是浅蓝底，用深色文字）
  const displayTextColor = isOffline ? "rgba(0,0,0,0.2)" : "#1a1a1a";
  const displaySubTextColor = isOffline ? "rgba(0,0,0,0.15)" : "#333";

  // 屏幕红色边框颜色（离线变灰）
  const screenBorderColor = isOffline ? "#555" : "#D92525";
  // 显示区颜色（离线变灰）
  const displayBg = isOffline ? "#888" : "#B8D4E3";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SC_VW} ${SC_VH}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* 面板文字裁剪：内框区域，避开螺丝 */}
          <clipPath id={`sc-face-clip-${uid}`}>
            <rect x="60" y="18" width="208" height="112" />
          </clipPath>
          {/* 屏幕显示区裁剪 */}
          <clipPath id={`sc-screen-clip-${uid}`}>
            <rect x="114" y="46" width="100" height="49" />
          </clipPath>
        </defs>

        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
          <g transform="translate(0.5, 0.5)">
            {/* ── 左阀门组 ── */}
            <g transform="translate(0, 48)">
              {/* 管道主体 */}
              <rect stroke="#5A5E62" strokeWidth={0.75} fill={palette.terminal} x="0" y="0" width="21" height="50" rx="1.5" />
              {/* 管道中间亮区 */}
              <rect stroke="#5A5E62" fill={isOffline ? "#777" : "#D8DCDE"} x="5" y="15" width="11" height="20" rx="1" />
              {/* 管道分隔线 */}
              <line x1="0" y1="6" x2="21" y2="6" stroke="#5A5E62" strokeWidth={0.4} />
              <line x1="0" y1="44" x2="21" y2="44" stroke="#5A5E62" strokeWidth={0.4} />
              {/* 阀门菱形 */}
              <polygon stroke="#5A5E62" strokeWidth={0.75} fill={isOffline ? "#666" : "#A0A4A8"} points="20,25.5 22.5,14 27.5,14 29,25.5 27.5,37 22.5,37" />
              <circle stroke="#5A5E62" strokeWidth={0.4} cx="25" cy="25.5" r="2.5" fill="none" />
              {/* 散热片 */}
              <rect stroke="#5A5E62" strokeWidth={0.75} fill={isOffline ? "#777" : "#B8BCC0"} x="28" y="12.5" width="8" height="25" rx="0.5" />
              {/* 散热片纹路 */}
              <g opacity="0.85" stroke={isOffline ? "#555" : "#9B6B5E"} strokeWidth={0.6}>
                <line x1="28" y1="15.75" x2="36" y2="15.75" />
                <line x1="28" y1="19" x2="36" y2="19" />
                <line x1="28" y1="22.25" x2="36" y2="22.25" />
                <line x1="28" y1="25.5" x2="36" y2="25.5" />
                <line x1="28" y1="28.75" x2="36" y2="28.75" />
                <line x1="28" y1="32" x2="36" y2="32" />
                <line x1="28" y1="35.25" x2="36" y2="35.25" />
              </g>
              {/* 螺栓座 */}
              <rect stroke="#5A5E62" strokeWidth={0.75} fill={isOffline ? "#666" : "#989CA0"} x="35" y="5" width="16" height="40" rx="1" />
              <circle stroke="#5A5E62" strokeWidth={0.4} fill={isOffline ? "#555" : "#787C80"} cx="41" cy="11" r="1.5" />
              <circle stroke="#5A5E62" strokeWidth={0.4} fill={isOffline ? "#555" : "#787C80"} cx="41" cy="39.5" r="1.5" />
            </g>

            {/* ── 右阀门组（镜像） ── */}
            <g transform={`translate(${SC_VW - 51}, 48) scale(-1, 1) translate(-51, 0)`}>
              <rect stroke="#5A5E62" strokeWidth={0.75} fill={palette.terminal} x="0" y="0" width="21" height="50" rx="1.5" />
              <rect stroke="#5A5E62" fill={isOffline ? "#777" : "#D8DCDE"} x="5" y="15" width="11" height="20" rx="1" />
              <line x1="0" y1="6" x2="21" y2="6" stroke="#5A5E62" strokeWidth={0.4} />
              <line x1="0" y1="44" x2="21" y2="44" stroke="#5A5E62" strokeWidth={0.4} />
              <polygon stroke="#5A5E62" strokeWidth={0.75} fill={isOffline ? "#666" : "#A0A4A8"} points="20,25.5 22.5,14 27.5,14 29,25.5 27.5,37 22.5,37" />
              <circle stroke="#5A5E62" strokeWidth={0.4} cx="25" cy="25.5" r="2.5" fill="none" />
              <rect stroke="#5A5E62" strokeWidth={0.75} fill={isOffline ? "#777" : "#B8BCC0"} x="28" y="12.5" width="8" height="25" rx="0.5" />
              <g opacity="0.85" stroke={isOffline ? "#555" : "#9B6B5E"} strokeWidth={0.6}>
                <line x1="28" y1="15.75" x2="36" y2="15.75" />
                <line x1="28" y1="19" x2="36" y2="19" />
                <line x1="28" y1="22.25" x2="36" y2="22.25" />
                <line x1="28" y1="25.5" x2="36" y2="25.5" />
                <line x1="28" y1="28.75" x2="36" y2="28.75" />
                <line x1="28" y1="32" x2="36" y2="32" />
                <line x1="28" y1="35.25" x2="36" y2="35.25" />
              </g>
              <rect stroke="#5A5E62" strokeWidth={0.75} fill={isOffline ? "#666" : "#989CA0"} x="35" y="5" width="16" height="40" rx="1" />
              <circle stroke="#5A5E62" strokeWidth={0.4} fill={isOffline ? "#555" : "#787C80"} cx="41" cy="11" r="1.5" />
              <circle stroke="#5A5E62" strokeWidth={0.4} fill={isOffline ? "#555" : "#787C80"} cx="41" cy="39.5" r="1.5" />
            </g>

            {/* ── 外框 ── */}
            <rect stroke={palette.border} strokeWidth={1} fill={palette.body} x="51" y="0" width="225" height="146.5" rx="3" />
            {/* ── 内框 ── */}
            <rect stroke={isOffline ? "#666" : "#B8BCC0"} fill={isOffline ? "#777" : "#E2E4E6"} x="57.5" y="6.5" width="212" height="133.5" rx="1.5" />

            {/* ── 六角螺丝（6个） ── */}
            {[
              [62, 10], [163.5, 10], [265, 10],
              [62, 138], [163.5, 138], [265, 138],
            ].map(([cx, cy], idx) => (
              <g key={`sc-screw-${idx}`} fillRule="nonzero">
                <circle stroke={isOffline ? "#555" : "#787C80"} fill={palette.screw} cx={cx} cy={cy} r="3.5" />
                <circle stroke={isOffline ? "#444" : "#686C70"} strokeWidth={0.4} fill={isOffline ? "#666" : "#989CA0"} cx={cx} cy={cy} r="2.5" />
                <polygon fill={isOffline ? "#333" : "#484C50"} points={`${cx} ${cy - 1.5} ${cx + 1.4} ${cy - 0.75} ${cx + 1.4} ${cy + 0.75} ${cx} ${cy + 1.5} ${cx - 1.4} ${cy + 0.75} ${cx - 1.4} ${cy - 0.75}`} />
              </g>
            ))}

            {/* ── 屏幕（黑底） ── */}
            <rect stroke="#0A0F14" fill={palette.screen} x="102" y="34" width="123" height="72" rx="2" />
            {/* 屏幕内框 */}
            <rect stroke="#3A3F44" x="104" y="36" width="119" height="68" rx="1" />
            {/* 红色边框 */}
            <rect stroke={screenBorderColor} strokeWidth={2} x="108.5" y="40.5" width="110" height="59" rx="1" />
            {/* 显示区（浅蓝） */}
            <rect fill={displayBg} x="112.5" y="44.5" width="102" height="51" rx="0.5" />
          </g>

          {/* ═══ 屏幕内容（显示区内） ═══ */}
          <g clipPath={`url(#sc-screen-clip-${uid})`}>
            {/* 状态 LED + 状态文字 */}
            <circle cx="116" cy="52" r="2" fill={statusColor} filter={`url(#${glowId})`} />
            {statusVisual.pulse && !isOffline && (
              <circle cx="116" cy="52" r="2" fill={statusColor} opacity="0.4">
                <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <text x="121" y="55" fill={displayTextColor} fontSize="6" fontFamily="sans-serif" fontWeight="700">
              {statusVisual.text}
            </text>

            {/* ═══ 分控器8状态LED灯条（controllerState 位域） ═══
                位于屏幕中间区域，两行4列布局
                每个 LED 旁边带短标签，颜色由 CONTROLLER_STATE_LEDS 定义驱动 */}
            {controllerState !== undefined && !isOffline && (
              <g transform="translate(116, 59)">
                {CONTROLLER_STATE_LEDS.map((led, idx) => {
                  const col = idx % 4;
                  const row = Math.floor(idx / 4);
                  const x = col * 25;
                  const y = row * 10;
                  const active = isControllerLedActive(controllerState, led.bit);
                  const fillColor = active ? led.activeColor : led.inactiveColor;
                  const textColor = active ? '#000' : 'rgba(0,0,0,0.3)';
                  return (
                    <g key={`sc-led-${idx}`} transform={`translate(${x}, ${y})`}>
                      <circle cx="2" cy="2" r="1.5" fill={fillColor} opacity={active ? 0.95 : 0.25} />
                      {/* 强喷/强停LED脉冲光晕 */}
                      {active && led.pulse && (
                        <circle cx="2" cy="2" r="1.5" fill={led.activeColor} opacity="0.3">
                          <animate attributeName="r" values="1.5;3;1.5" dur="1.2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.3;0;0.3" dur="1.2s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <text x="5" y="3.5" fill={textColor} fontSize="3.5" fontFamily="sans-serif" fontWeight="600" dominantBaseline="middle">
                        {led.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {screenItems && screenItems.length > 0 ? (
              screenItems.map((item, idx) => (
                <text
                  key={item.key}
                  x="116" y={63 + idx * 8}
                  fill={displaySubTextColor}
                  fontSize="5.5"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {item.label}{item.unit ? `(${item.unit})` : ""}: {item.value}
                </text>
              ))
            ) : (
              <>
                {/* 默认：分控器编号 */}
                {label && (
                  <text
                    x="164" y="64"
                    textAnchor="middle"
                    fill={displaySubTextColor}
                    fontSize="5.5"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {label}
                  </text>
                )}
                {/* 喷洒状态（由 __builtin_sprayStatus__ 解析后传入 screenItems） */}
                <text
                  x="164" y="78"
                  textAnchor="middle"
                  fill={isOffline ? "rgba(0,0,0,0.15)" : displayTextColor}
                  fontSize="6"
                  fontFamily="sans-serif"
                  fontWeight="700"
                >
                  {isOffline ? "离线" : "待机"}
                </text>
              </>
            )}
          </g>

          {/* ═══ 面板信息区（内框内、屏幕外） ═══ */}
          <g clipPath={`url(#sc-face-clip-${uid})`}>
            {/* 屏幕上方：产品名 */}
            <text
              x="163" y="26"
              textAnchor="middle"
              fill={isOffline ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.65)"}
              fontSize="6"
              fontFamily="sans-serif"
              fontWeight="700"
            >
              喷雾分控器
            </text>
            {/* 屏幕下方：faceItems 或默认 所属集控器名 */}
            {faceItems && faceItems.length > 0 ? (
              faceItems.map((item, idx) => (
                <text
                  key={item.key}
                  x="60" y={118 + idx * 8}
                  fill={isOffline ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.55)"}
                  fontSize="5"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {item.label}{item.unit ? `(${item.unit})` : ""}: {item.value}
                </text>
              ))
            ) : (
              <>
                {parentName && (
                  <text
                    x="60" y="118"
                    fill={isOffline ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.45)"}
                    fontSize="5"
                    fontFamily="sans-serif"
                  >
                    集控: {parentName}
                  </text>
                )}
              </>
            )}
          </g>

          {/* 模板态 */}
          {isTemplate && (
            <text
              x="164" y="72"
              textAnchor="middle"
              fill="rgba(0,0,0,0.6)"
              fontSize="8"
              fontFamily="sans-serif"
              fontWeight="700"
            >
              {label || "喷雾分控器"}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
