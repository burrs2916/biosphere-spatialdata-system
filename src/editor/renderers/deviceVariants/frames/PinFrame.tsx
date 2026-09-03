/**
 * PinFrame — 设备图钉标记 SVG 渲染
 *
 * 从 DeviceSvgFrames.tsx 拆分，完全自包含（不依赖 ScreenComponents）。
 */

import { useId } from 'react';
import { isControllerLedActive, CONTROLLER_STATE_LEDS } from '../deviceStatus';

// ─── Pin 标记变体 ──────────────────────────────────────────

// ─── 设备图钉标记 (Pin Marker) ────────────────────────────
//
// 严格复刻自参考 SVG:
//   /references/SVG参考/设备/device_marker_pin_standard_终改.svg
//
// 参考 SVG 原始结构：
//   viewBox="0 0 44 66"
//   <g transform="translate(2, 2)">
//     path  水滴形定位钉  fill=#D93A3A stroke=#FFFFFF stroke-width=2.5
//     path  水滴形描边层  stroke=#FFFFFF stroke-width=2.5（同路径，只描边不填充）
//     rect  内嵌面板      fill=#D93A3A x=10 y=12 w=20 h=15 rx=2
//     rect  面板描边      stroke=#FFFFFF stroke-width=1.8
//     rect  蓝色屏幕      fill=#5A9ED6 x=14 y=16 w=12 h=7 rx=1.2
//     rect  反光条        fill=#7EBEE8 opacity=0.5 x=15 y=17 w=4 h=2 rx=0.5
//   </g>

export const PIN_VW = 44;
export const PIN_VH = 66;

// 水滴形路径（与参考 SVG 一致）
export const PIN_DROP_PATH =
  'M40,20 C40,8.954305 31.045695,0 20,0 C8.954305,0 0,8.954305 0,20 C0,34.6666667 6.66666667,48.6666667 20,62 C33.3333333,48.6666667 40,34.6666667 40,20 Z';

export interface PinFrameProps {
  bodyColor?: string;
  screenColor?: string;
  borderColor?: string;
  statusColor?: string;
  label?: string;
  online?: boolean;
  triggered?: boolean;
  isRunning?: boolean; // 压力泵（18041）运转状态：true=运行中，false=停止
  iconType?:
    | 'main'
    | 'sub'
    | 'sensor'
    | 'alarm'
    | 'alarm_coal_cutter'
    | 'alarm_frame_move'
    | 'alarm_frame_drop'
    | 'alarm_top_coal'
    | 'alarm_smoke'
    | 'alarm_temp'
    | 'alarm_vibration'
    | 'alarm_dust'
    | 'alarm_co'
    | 'alarm_flame'
    | 'dust' // 粉尘数值型（18015，-Sensor-Dust）：蜂巢格栅 + 中心激光器
    | 'numeric_co' // CO 数值型（18013，-Sensor-CO）：百叶窗进气口 + 气体粒子扩散
    | 'numeric_ch4' // CH4 数值型（18012，-Sensor-CH4）：圆形烧结网 + 催化燃烧室
    | 'numeric_temp' // 温度数值型（18014，-Sensor-Temp）：探温探头 + 温度计
    | 'numeric_wind' // 风速数值型（18010，-Sensor-Wind）：风杯风速计
    | 'numeric_wind_press' // 风压数值型（18011，-Sensor-WindPress）：U型管压力计
    | 'touch'
    | 'infrared'
    // ─── 独立设备类型（不复用通用分支） ───
    | 'alarm_clean_wall' // 清洗煤壁传感器（18035）：水滴 + 煤壁清洗动画
    | 'flow_meter' // 流量计（18040）：水流转子 + 流量数字（独立设备，非传感器）
    | 'pump' // 压力泵（18041）：泵体 + 运转动画
    | 'collector_wireless' // 无线信号采集器（18002）：天线 + 信号波
    | 'collector_wired' // 有线信号采集器（18003）：线缆接口 + 端子
    | 'generic';
  /** 分控器 controllerState 原始字节（0x061e 位域），用于驱动8个LED灯颜色 */
  controllerState?: number;
}

export function PinFrame({
  bodyColor = '#D93A3A',
  screenColor = '#5A9ED6',
  borderColor,
  online = true,
  triggered = false,
  isRunning = false,
  iconType = 'generic',
  controllerState,
}: PinFrameProps) {
  const uid = useId().replace(/:/g, '');
  const glowId = `pin-glow-${uid}`;

  // 描边色：在线=白色，离线=灰色
  const strokeColor = borderColor ?? (online ? '#FFFFFF' : '#AAAAAA');
  // 离线态颜色
  const effectiveBodyColor = online ? bodyColor : '#888888';
  const effectiveScreenColor = online ? screenColor : '#666666';

  // 触控态：蓝色水滴 + 手指图标
  const isTouch = iconType === 'touch';
  // 红外态：红外红 + 双探头+光束图标
  const isInfrared = iconType === 'infrared';
  // 烟雾态：烟雾灰 + 烟雾扩散动画
  const isSmoke = iconType === 'alarm_smoke';
  // 粉尘数值态（18015）：棕色 + 蜂巢格栅 + 中心激光器
  const isDust = iconType === 'dust';
  // CO 数值态（18013）：深青色 + 百叶窗进气口 + 气体粒子扩散
  const isNumericCO = iconType === 'numeric_co';
  // CH4 数值态（18012）：深蓝色 + 圆形烧结网 + 催化燃烧室
  const isNumericCH4 = iconType === 'numeric_ch4';
  // 温度数值态（18014）：深橙色 + 探温探头 + 温度计
  const isNumericTemp = iconType === 'numeric_temp';
  // 粉尘报警态（18029）：浅棕 + 蜂巢格栅 + 触发=深棕脉动
  const isAlarmDust = iconType === 'alarm_dust';
  // 火焰态（18031）：深焰橙 + 多层火苗 + 发光摇曳
  const isFlame = iconType === 'alarm_flame';
  // 温度报警态（18025）：冷蓝灰 + 温度计小图标
  const isTemperature = iconType === 'alarm_temp';
  // CO 报警态（18030）：深玫红 + 气体扩散波纹 + "CO"字母
  const isCO = iconType === 'alarm_co';
  // 放顶煤态（18023）：煤灰黑 + 漏斗形放煤口 + 煤块下落
  const isTopCoal = iconType === 'alarm_top_coal';
  // 风速数值态（18010）：浅蓝 + 风杯风速计
  const isNumericWind = iconType === 'numeric_wind';
  // 风压数值态（18011）：青蓝 + U型管压力计
  const isNumericWindPress = iconType === 'numeric_wind_press';
  // 告警态屏幕色
  const isAlarm = iconType === 'alarm';
  // ─── 独立设备类型（不复用通用分支） ───
  // 清洗煤壁传感器（18035）：青绿水滴 + 水流喷射 + 煤壁纹理
  const isCleanWall = iconType === 'alarm_clean_wall';
  // 流量计（18040）：深蓝水滴 + 水流转子 + 流量数字（独立设备，非传感器）
  const isFlowMeter = iconType === 'flow_meter';
  // 压力泵（18041）：SCADA 风格迷你压力表 + 状态灯（独立设备，非传感器）
  const isPump = iconType === 'pump';
  // 信号采集器：无线（18002）/ 有线（18003）
  const isCollector = iconType === 'collector_wireless' || iconType === 'collector_wired';
  const isWirelessCollector = iconType === 'collector_wireless';
  // 2026-06-15：报警型 10 个变体，按 iconType 区分屏幕色 + 内部标识符
  const ALARM_VARIANTS: Record<string, { color: string; short: string; body: string; triggeredBody: string }> = {
    // body = 未触发态主体色，triggeredBody = 触发态主体色（与 SensorFrame / CardVariantRenderer 一致）
    alarm_coal_cutter: { color: '#FFB300', short: '割', body: '#F9A825', triggeredBody: '#F57F17' }, // 割煤机：黄→深琥珀
    alarm_frame_move: { color: '#43A047', short: '移', body: '#2E7D32', triggeredBody: '#1B5E20' }, // 移架：绿→深绿
    alarm_frame_drop: { color: '#8D6E63', short: '落', body: '#5D4037', triggeredBody: '#3E2723' }, // 落架：棕→深棕
    alarm_top_coal: { color: '#FFB300', short: '顶', body: '#424242', triggeredBody: '#FF6F00' }, // 放顶煤：黑→深橙
    alarm_smoke: { color: '#90A4AE', short: '烟', body: '#546E7A', triggeredBody: '#5D4037' }, // 烟雾：蓝灰→深棕
    alarm_temp: { color: '#FFB74D', short: '温', body: '#FF8F00', triggeredBody: '#C62828' }, // 温度：琥珀→深红
    alarm_vibration: { color: '#7E57C2', short: '振', body: '#4527A0', triggeredBody: '#6A1B9A' }, // 振动：紫→深紫
    alarm_dust: { color: '#A1887F', short: '尘', body: '#A1887F', triggeredBody: '#4E342E' }, // 粉尘：浅棕→深棕
    alarm_co: { color: '#F06292', short: 'CO', body: '#AD1457', triggeredBody: '#C62828' }, // CO：玫红→深红
    alarm_flame: { color: '#FF7043', short: '火', body: '#37474F', triggeredBody: '#BF360C' }, // 火焰：石板灰→深焰橙
  };
  const alarmVariant = iconType ? ALARM_VARIANTS[iconType] : undefined;
  const finalScreenColor = isAlarm
    ? '#F0A030'
    : isTouch
      ? '#4FC3F7'
      : isInfrared
        ? '#E53935'
        : alarmVariant
          ? alarmVariant.color
          : effectiveScreenColor;
  // 报警型触发态：使用 triggeredBody 作为主体色（与 SensorFrame / CardVariantRenderer 一致）
  const variantBodyColor = alarmVariant
    ? triggered
      ? alarmVariant.triggeredBody
      : alarmVariant.body
    : effectiveBodyColor;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${PIN_VW} ${PIN_VH}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 光晕滤镜 — 在线态水滴外发光 */}
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* 烟雾型 Pin：密排小圆孔格栅 pattern */}
        <pattern id={`pin-smoke-grille-${uid}`} x="0" y="0" width="2.5" height="2.5" patternUnits="userSpaceOnUse">
          <circle cx="1.25" cy="1.25" r="0.6" fill="#1A1F26" />
        </pattern>
        {/* 烟雾型 Pin 上半部分剪切区域（用于把格栅只显示在水滴上半部） */}
        <clipPath id={`pin-smoke-top-clip-${uid}`}>
          <rect x="0" y="0" width="40" height="22" />
        </clipPath>
      </defs>

      {isTouch ? (
        /* ── 触控型：圆形底座 + 波纹图标 ── */
        <g transform="translate(2, 2)">
          {/* 蓝色呼吸光晕（最外层） */}
          {online && (
            <circle cx="20" cy="28" r="20" fill="none" stroke="#4FC3F7" strokeWidth="2" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0;0.5" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="r" values="20;26;20" dur="1.8s" repeatCount="indefinite" />
            </circle>
          )}

          {/* 圆形底座 */}
          <circle cx="20" cy="28" r="18" fill={effectiveBodyColor} stroke={strokeColor} strokeWidth="2.5" />

          {/* 中心实心圆 */}
          <circle cx="20" cy="28" r="4" fill={finalScreenColor} />

          {/* 波纹1：最强 */}
          <circle cx="20" cy="28" r="4" fill="none" stroke={finalScreenColor} strokeWidth="2" opacity="0.8">
            <animate attributeName="r" values="4;16;4" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" repeatCount="indefinite" />
          </circle>

          {/* 波纹2 */}
          <circle cx="20" cy="28" r="4" fill="none" stroke={finalScreenColor} strokeWidth="1.5" opacity="0.5">
            <animate attributeName="r" values="4;16;4" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
          </circle>

          {/* 波纹3 */}
          <circle cx="20" cy="28" r="4" fill="none" stroke={finalScreenColor} strokeWidth="1" opacity="0.3">
            <animate attributeName="r" values="4;16;4" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
          </circle>

          {/* 指针尖（朝下的小三角，暗示定位） */}
          <polygon
            points="14,44 20,54 26,44"
            fill={effectiveBodyColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isInfrared ? (
        /* ── 红外型：圆形底座 + 双探头+光束图标（红外红配色） ── */
        <g transform="translate(2, 2)">
          {/* 红外放射光线（外层，8 根径向光线，垂直于圆周向外延伸） */}
          {online && (
            <g stroke="#E53935" strokeWidth="1.6" strokeLinecap="round" fill="none">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                // 错相起算：8 根轮转，总周期 1.6s，每根延迟 = (deg/360) * 1.6s
                const begin = `${(deg / 360) * 1.6}s`;
                return (
                  <g key={deg} transform={`rotate(${deg} 20 28)`}>
                    {/* 内端固定在 r=18（贴圆形底座），外端在 r=22 ~ r=27 之间循环 */}
                    <line x1="38" y1="28" x2="42" y2="28">
                      <animate attributeName="x2" values="42;47;42" dur="1.6s" repeatCount="indefinite" begin={begin} />
                      <animate
                        attributeName="opacity"
                        values="0.95;0;0.95"
                        dur="1.6s"
                        repeatCount="indefinite"
                        begin={begin}
                      />
                    </line>
                  </g>
                );
              })}
            </g>
          )}

          {/* 圆形底座（深红/红外红） */}
          <circle cx="20" cy="28" r="18" fill={effectiveBodyColor} stroke={strokeColor} strokeWidth="2.5" />

          {/* 双探头 LED（左）：持续发光 */}
          <circle cx="13" cy="28" r="2" fill={online ? '#FF1744' : '#888'} opacity={online ? 0.95 : 0.5}>
            {online && <animate attributeName="opacity" values="0.95;0.4;0.95" dur="1.2s" repeatCount="indefinite" />}
          </circle>
          {/* 发光外晕（左） */}
          {online && (
            <circle cx="13" cy="28" r="2" fill="#FF1744" opacity="0.4">
              <animate attributeName="r" values="2;5;2" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="1.2s" repeatCount="indefinite" />
            </circle>
          )}

          {/* 双探头 LED（右）：持续发光（错相 0.6s） */}
          <circle cx="27" cy="28" r="2" fill={online ? '#FF1744' : '#888'} opacity={online ? 0.95 : 0.5}>
            {online && (
              <animate
                attributeName="opacity"
                values="0.95;0.4;0.95"
                dur="1.2s"
                repeatCount="indefinite"
                begin="0.6s"
              />
            )}
          </circle>
          {/* 发光外晕（右） */}
          {online && (
            <circle cx="27" cy="28" r="2" fill="#FF1744" opacity="0.4">
              <animate attributeName="r" values="2;5;2" dur="1.2s" repeatCount="indefinite" begin="0.6s" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="1.2s" repeatCount="indefinite" begin="0.6s" />
            </circle>
          )}

          {/* 中间光束：脉冲扫描动画（左右往返） */}
          {online && (
            <line
              x1="13"
              y1="28"
              x2="27"
              y2="28"
              stroke="#FF1744"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.85"
            >
              <animate attributeName="x1" values="13;27;13" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="x2" values="27;13;27" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.85;0.3;0.85" dur="2.4s" repeatCount="indefinite" />
            </line>
          )}

          {/* 指针尖（朝下的小三角，暗示定位） */}
          <polygon
            points="14,44 20,54 26,44"
            fill={effectiveBodyColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isSmoke ? (
        /* ── 烟雾型：与红外/触控完全同形（圆形底座+三角指针），仅圆形内叠加密排小圆孔格栅 ── */
        <g transform="translate(2, 2)">
          {/* 触发时：黑色告警脉冲圈（黑=浓烟感） */}
          {online && triggered && (
            <circle cx="20" cy="28" r="18" fill="none" stroke="#000000" strokeWidth="2" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="r" values="18;24;18" dur="1.2s" repeatCount="indefinite" />
            </circle>
          )}

          {/* 在线未触发：银灰呼吸光晕（无烟=洁净空气） */}
          {online && !triggered && (
            <circle cx="20" cy="28" r="18" fill="none" stroke="#BDBDBD" strokeWidth="1.5" opacity="0.3">
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="r" values="18;22;18" dur="2.5s" repeatCount="indefinite" />
            </circle>
          )}

          {/* 圆形底座：正常=白（无烟），触发=纯黑（浓烟） */}
          <circle
            cx="20"
            cy="28"
            r="18"
            fill={triggered ? '#212121' : '#FFFFFF'}
            stroke={triggered ? '#000000' : '#BDBDBD'}
            strokeWidth="2.5"
          />

          {/* 圆形内格栅：密排小圆孔 — 正常=深黑孔（光透出），触发=纯黑覆盖（浓烟填满） */}
          <g clipPath={`url(#pin-smoke-top-clip-${uid})`}>
            <circle cx="20" cy="28" r="18" fill={`url(#pin-smoke-grille-${uid})`} opacity={online ? 0.9 : 0.4} />
            {/* 触发时：格栅变深黑+轻微脉动（浓烟涌入） */}
            {triggered && online && (
              <circle cx="20" cy="28" r="18" fill="#000000" opacity="0.4">
                <animate attributeName="opacity" values="0.4;0.2;0.4" dur="0.8s" repeatCount="indefinite" />
              </circle>
            )}
          </g>

          {/* 指针尖（朝下的小三角，暗示定位） — 颜色与底座同步 */}
          <polygon
            points="14,44 20,54 26,44"
            fill={triggered ? '#212121' : '#FFFFFF'}
            stroke={triggered ? '#000000' : '#BDBDBD'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isAlarmDust || isDust ? (
        /* ── 粉尘型（18015 数值型 / 18029 报警型）：方形底座 + 侧壁进气槽 + 中央激光腔 ──
            与烟雾型（圆形+顶部圆孔）形成根本性差异：粉尘是壁挂式矩形设备，烟雾是天花板圆形设备
            isDust      (18015)  : 中棕 #6D4C41 方底 + 激光腔（旋转扇叶）+ 进气流动动画
            isAlarmDust (18029)  : 浅棕 #A1887F 方底 + 激光腔（静态，触发=深棕脉动） */
        <g transform="translate(2, 2)">
          {/* 触发时：深棕色脉冲外框（仅报警型） */}
          {isAlarmDust && online && triggered && (
            <rect x="2" y="6" width="36" height="44" rx="5" fill="none" stroke="#3E2723" strokeWidth="2" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0;0.6" dur="1.0s" repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="2;3.5;2" dur="1.0s" repeatCount="indefinite" />
            </rect>
          )}

          {/* 在线未触发：棕色柔和呼吸光晕（矩形外框） */}
          {online && !(isAlarmDust && triggered) && (
            <rect
              x="2"
              y="6"
              width="36"
              height="44"
              rx="5"
              fill="none"
              stroke={isAlarmDust ? '#A1887F' : '#6D4C41'}
              strokeWidth="1.5"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="1.5;2.5;1.5" dur="2.4s" repeatCount="indefinite" />
            </rect>
          )}

          {/* 方形底座（壁挂式工业设备 — 与烟雾的圆形根本性区分） */}
          <rect
            x="4"
            y="8"
            width="32"
            height="40"
            rx="4"
            fill={online ? (isAlarmDust ? (triggered ? '#3E2723' : '#A1887F') : '#6D4C41') : '#888888'}
            stroke={online ? (isAlarmDust ? (triggered ? '#1B0F0A' : '#3E2723') : '#3E2723') : '#666666'}
            strokeWidth="2"
          />

          {/* ──── 侧壁进气槽：右侧垂直方孔 pattern（与烟雾的密排圆孔形成根本性差异） ──── */}
          <pattern id={`pin-dust-vent-${uid}`} x="0" y="0" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
            <rect x="0.3" y="0.3" width="1" height="1" fill="#1B0F0A" rx="0.15" />
          </pattern>
          <rect x="30" y="12" width="4" height="32" rx="0.8" fill="#1B0F0A" />
          <rect x="30" y="12" width="4" height="32" rx="0.8" fill={`url(#pin-dust-vent-${uid})`} />
          {/* 数值型粉尘（18015）特有：进气道内空气流动动画（白点从下往上流） */}
          {isDust && online && (
            <>
              <circle cx="32" cy="42" r="0.5" fill="#FFE0B2" opacity="0.9">
                <animate attributeName="cy" values="42;13;42" dur="2.0s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0;0.9" dur="2.0s" repeatCount="indefinite" />
              </circle>
              <circle cx="32" cy="42" r="0.4" fill="#FFE0B2" opacity="0.7">
                <animate attributeName="cy" values="42;13;42" dur="2.0s" begin="0.7s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="2.0s" begin="0.7s" repeatCount="indefinite" />
              </circle>
            </>
          )}
          {/* 报警型粉尘（18029）触发：进气道变红 + 脉动（粉尘浓度超限的视觉警告） */}
          {isAlarmDust && triggered && online && (
            <rect x="30" y="12" width="4" height="32" rx="0.8" fill="#B71C1C" opacity="0.55">
              <animate attributeName="opacity" values="0.55;0.2;0.55" dur="0.6s" repeatCount="indefinite" />
            </rect>
          )}

          {/* ──── 中央激光散射腔（圆形 + 激光束 + 准星）—— 粉尘型核心识别元素 ──── */}
          <circle cx="16" cy="24" r="6" fill="#1B0F0A" stroke="#0D0703" strokeWidth="0.5" />
          <circle cx="16" cy="24" r="4.8" fill="none" stroke="#5D4037" strokeWidth="0.3" />
          {/* 激光束（水平红线穿过腔体） */}
          <line x1="11" y1="24" x2="21" y2="24" stroke="#F44336" strokeWidth="0.4" opacity={online ? 0.85 : 0.2} />
          {/* 激光发射点 */}
          <circle cx="11" cy="24" r="0.7" fill="#FF5252" opacity={online ? 1 : 0.3}>
            {online && <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite" />}
          </circle>
          {/* 激光接收点（带十字准星） */}
          <rect x="20" y="22.5" width="2" height="3" fill="#3E2723" stroke="#8D6E63" strokeWidth="0.25" />
          <line x1="21" y1="22.5" x2="21" y2="25.5" stroke="#8D6E63" strokeWidth="0.2" />
          <line x1="20" y1="24" x2="22" y2="24" stroke="#8D6E63" strokeWidth="0.2" />
          {/* 数值型粉尘（18015）特有：腔体内旋转扇叶（空气采样） */}
          {isDust && online && (
            <g>
              <ellipse cx="16" cy="24" rx="2.6" ry="0.6" fill="#8D6E63" opacity="0.75">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 16 24"
                  to="360 16 24"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse cx="16" cy="24" rx="2.6" ry="0.6" fill="#8D6E63" opacity="0.55">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="60 16 24"
                  to="420 16 24"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse cx="16" cy="24" rx="2.6" ry="0.6" fill="#8D6E63" opacity="0.55">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="120 16 24"
                  to="480 16 24"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </ellipse>
            </g>
          )}
          {/* 报警型粉尘（18029）触发：腔体变红 + 脉冲（粉尘浓度超限） */}
          {isAlarmDust && triggered && online && (
            <circle cx="16" cy="24" r="6" fill="#B71C1C" opacity="0.45">
              <animate attributeName="opacity" values="0.45;0.15;0.45" dur="0.6s" repeatCount="indefinite" />
            </circle>
          )}
          {/* 腔体外圈高光（金属质感） */}
          <circle cx="16" cy="24" r="6" fill="none" stroke="#8D6E63" strokeWidth="0.35" opacity="0.6" />

          {/* ──── 工业铭牌区域（腔体下方）—— 抽象的双横线标识，象征产品代号区 ──── */}
          <rect x="6" y="36" width="20" height="6" rx="0.8" fill="#1B0F0A" opacity="0.85" />
          <line x1="9" y1="38.5" x2="23" y2="38.5" stroke="#FFCC80" strokeWidth="0.4" opacity="0.85" />
          <line x1="9" y1="40.5" x2="20" y2="40.5" stroke="#FFCC80" strokeWidth="0.3" opacity="0.65" />

          {/* 指针尖（朝下的小三角）— 颜色与底座同步 */}
          <polygon
            points="14,48 20,58 26,48"
            fill={online ? (isAlarmDust ? (triggered ? '#3E2723' : '#A1887F') : '#6D4C41') : '#888888'}
            stroke={online ? (isAlarmDust ? (triggered ? '#1B0F0A' : '#3E2723') : '#3E2723') : '#666666'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isNumericCO ? (
        /* ── CO 数值型（18013）：方形底座 + 顶部百叶窗进气口 + "CO"字母 + 气体粒子扩散
            形状与其他数值型传感器（粉尘）一致：方形底座 + 指针尖
            颜色统一使用 effectiveBodyColor / strokeColor（与卡片视觉变体共享 styleConfig 配置）
            CO 特有元素：横向百叶窗（被动扩散）+ 气体粒子向下飘入 */
        <g transform="translate(2, 2)">
          {/* 在线态：青色柔和呼吸光晕（矩形外框） */}
          {online && (
            <rect
              x="2"
              y="6"
              width="36"
              height="44"
              rx="5"
              fill="none"
              stroke="#4DB6AC"
              strokeWidth="1.5"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="1.5;2.5;1.5" dur="2.4s" repeatCount="indefinite" />
            </rect>
          )}

          {/* 方形底座（颜色与卡片外壳统一：effectiveBodyColor / strokeColor） */}
          <rect
            x="4"
            y="8"
            width="32"
            height="40"
            rx="4"
            fill={effectiveBodyColor}
            stroke={strokeColor}
            strokeWidth="2"
          />

          {/* ── 顶部横向百叶窗进气口（3 条缝隙，与卡片视图一致）──
              CO 特有元素：电化学气体扩散膜（被动扩散） */}
          <g>
            {/* 百叶窗底框（深色凹槽） */}
            <rect x="10" y="12" width="20" height="8" rx="1" fill="#00352C" />
            {/* 3 条横向缝隙 */}
            <rect x="11.5" y="13.5" width="17" height="1.2" rx="0.3" fill={online ? '#001A14' : '#5A5A5A'} />
            <rect x="11.5" y="15.8" width="17" height="1.2" rx="0.3" fill={online ? '#001A14' : '#5A5A5A'} />
            <rect x="11.5" y="18.1" width="17" height="1.2" rx="0.3" fill={online ? '#001A14' : '#5A5A5A'} />
            {/* 百叶窗叶片高光（金属感） */}
            {online && (
              <>
                <line x1="11.5" y1="13.7" x2="28.5" y2="13.7" stroke="#4DB6AC" strokeWidth="0.2" opacity="0.4" />
                <line x1="11.5" y1="16.0" x2="28.5" y2="16.0" stroke="#4DB6AC" strokeWidth="0.2" opacity="0.4" />
                <line x1="11.5" y1="18.3" x2="28.5" y2="18.3" stroke="#4DB6AC" strokeWidth="0.2" opacity="0.4" />
              </>
            )}
          </g>

          {/* ── 气体粒子扩散动画（在线时：粒子从百叶窗向下飘入）── */}
          {online && (
            <g>
              <circle cx="16" cy="24" r="0.5" fill="#80CBC4" opacity="0.7">
                <animate attributeName="cy" values="21;30;21" dur="3.0s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="3.0s" repeatCount="indefinite" />
              </circle>
              <circle cx="20" cy="26" r="0.45" fill="#80CBC4" opacity="0.6">
                <animate attributeName="cy" values="21;30;21" dur="3.0s" begin="1.0s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="3.0s" begin="1.0s" repeatCount="indefinite" />
              </circle>
              <circle cx="24" cy="25" r="0.5" fill="#80CBC4" opacity="0.65">
                <animate attributeName="cy" values="21;30;21" dur="3.0s" begin="2.0s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0.65;0;0.65"
                  dur="3.0s"
                  begin="2.0s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )}

          {/* ── 中心"一氧化碳"四字（核心标识，与报警传感器中文名格式对齐）── */}
          <text
            x="20"
            y="38"
            textAnchor="middle"
            fill={online ? '#80CBC4' : '#5A5A5A'}
            fontSize="6"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1"
          >
            一氧化碳
          </text>

          {/* ── 底部"ppm"单位标识（暗示浓度监测）── */}
          <text
            x="20"
            y="44"
            textAnchor="middle"
            fill={online ? 'rgba(128,203,196,0.8)' : 'rgba(255,255,255,0.2)'}
            fontSize="4"
            fontFamily="'Arial', sans-serif"
            fontWeight="600"
          >
            ppm
          </text>

          {/* 指针尖（朝下的小三角）— 颜色与底座统一 */}
          <polygon
            points="14,48 20,58 26,48"
            fill={effectiveBodyColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isNumericCH4 ? (
        /* ── CH4 数值型（18012）：方形底座 + 顶部圆形烧结网 + "CH4"字母 + 催化燃烧动画
            形状与其他数值型传感器（粉尘/CO）一致：方形底座 + 指针尖
            颜色统一使用 effectiveBodyColor / strokeColor（与卡片视觉变体共享 styleConfig 配置）
            CH4 特有元素：圆形烧结金属扩散网（被动扩散）+ 催化珠发光脉动 + 热量波纹扩散 */
        <g transform="translate(2, 2)">
          {/* 在线态：蓝色柔和呼吸光晕（矩形外框） */}
          {online && (
            <rect
              x="2"
              y="6"
              width="36"
              height="44"
              rx="5"
              fill="none"
              stroke="#64B5F6"
              strokeWidth="1.5"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="1.5;2.5;1.5" dur="2.4s" repeatCount="indefinite" />
            </rect>
          )}

          {/* 方形底座（颜色与卡片外壳统一：effectiveBodyColor / strokeColor） */}
          <rect
            x="4"
            y="8"
            width="32"
            height="40"
            rx="4"
            fill={effectiveBodyColor}
            stroke={strokeColor}
            strokeWidth="2"
          />

          {/* ── 顶部圆形烧结金属扩散网（与 CO 的横向百叶窗形成根本性差异）──
              CH4 特有元素：催化燃烧式传感器的烧结金属气体扩散网 */}
          <g>
            {/* 扩散网外圈（深色凹槽） */}
            <circle cx="20" cy="14" r="4.5" fill="#0D47A1" />
            {/* 烧结金属网纹理（密排小圆点） */}
            <pattern id={`ch4-pin-sinter-${uid}`} x="0" y="0" width="1.5" height="1.5" patternUnits="userSpaceOnUse">
              <circle cx="0.4" cy="0.4" r="0.25" fill={online ? '#0A2E6B' : '#5A5A5A'} />
              <circle cx="1.1" cy="1.1" r="0.25" fill={online ? '#0A2E6B' : '#5A5A5A'} />
            </pattern>
            <circle cx="20" cy="14" r="4" fill={`url(#ch4-pin-sinter-${uid})`} />
            {/* 扩散网内圈高光（金属质感） */}
            {online && <circle cx="20" cy="14" r="4" fill="none" stroke="#64B5F6" strokeWidth="0.2" opacity="0.4" />}
          </g>

          {/* ── 中心催化燃烧室（催化珠发光脉动 + 热量波纹扩散）── */}
          {online && (
            <g>
              {/* 热量波纹（从催化珠向外扩散，2 层交错） */}
              <circle cx="20" cy="30" r="2" fill="none" stroke="#FF6F00" strokeWidth="0.4" opacity="0.6">
                <animate attributeName="r" values="2;7;2" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="20" cy="30" r="2" fill="none" stroke="#FF8F00" strokeWidth="0.3" opacity="0.5">
                <animate attributeName="r" values="2;7;2" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
              </circle>
              {/* 中心催化珠（发光脉动） */}
              <circle cx="20" cy="30" r="1.2" fill="#FF6F00">
                <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="r" values="1.2;1.6;1.2" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* ── 中心"甲烷"二字（核心标识，与报警传感器中文名格式对齐）── */}
          <text
            x="20"
            y="40"
            textAnchor="middle"
            fill={online ? '#64B5F6' : '#5A5A5A'}
            fontSize="5.5"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1.5"
          >
            甲烷
          </text>

          {/* ── 底部"%LEL"单位标识（爆炸下限百分比）── */}
          <text
            x="20"
            y="45"
            textAnchor="middle"
            fill={online ? 'rgba(100,181,246,0.8)' : 'rgba(255,255,255,0.2)'}
            fontSize="3.5"
            fontFamily="'Arial', sans-serif"
            fontWeight="600"
          >
            %LEL
          </text>

          {/* 指针尖（朝下的小三角）— 颜色与底座统一 */}
          <polygon
            points="14,48 20,58 26,48"
            fill={effectiveBodyColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isNumericTemp ? (
        /* ── 温度数值型（18014）：方形底座 + 顶部探温探头 + "温度"文字 + 温度计动画
            形状与其他数值型传感器（粉尘/CO/CH4）一致：方形底座 + 指针尖
            温度特有元素：探温探头 + 水银柱起伏 + 热辐射波纹 */
        <g transform="translate(2, 2)">
          {/* 在线态：橙色柔和呼吸光晕 */}
          {online && (
            <rect
              x="2"
              y="6"
              width="36"
              height="44"
              rx="5"
              fill="none"
              stroke="#FF8F00"
              strokeWidth="1.5"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="1.5;2.5;1.5" dur="2.4s" repeatCount="indefinite" />
            </rect>
          )}

          {/* 方形底座 */}
          <rect
            x="4"
            y="8"
            width="32"
            height="40"
            rx="4"
            fill={effectiveBodyColor}
            stroke={strokeColor}
            strokeWidth="2"
          />

          {/* ── 顶部探温探头（PT100 铂电阻造型）── */}
          <g>
            {/* 探头外圈 */}
            <circle cx="20" cy="14" r="4.5" fill="#BF360C" />
            {/* 探头中心（感温元件） */}
            <circle cx="20" cy="14" r="3.5" fill={online ? '#FFAB91' : '#5A5A5A'} />
            {/* 高光 */}
            {online && <circle cx="19" cy="13" r="1.2" fill="#FFFFFF" opacity="0.3" />}
            {/* 感温点 */}
            <circle cx="20" cy="14" r="1" fill={online ? '#E65100' : '#3A3A3A'} />
          </g>

          {/* ── 中心温度计（水银柱 + 刻度线 + 储液球）── */}
          {online && (
            <g>
              {/* 温度计管身 */}
              <rect x="18.5" y="22" width="3" height="14" rx="1.5" fill="#3E2723" />
              {/* 刻度线 */}
              <line x1="17" y1="25" x2="18.5" y2="25" stroke="#FFAB91" strokeWidth="0.3" opacity="0.6" />
              <line x1="17" y1="29" x2="18.5" y2="29" stroke="#FFAB91" strokeWidth="0.3" opacity="0.6" />
              <line x1="17" y1="33" x2="18.5" y2="33" stroke="#FFAB91" strokeWidth="0.3" opacity="0.6" />
              <line x1="21.5" y1="25" x2="23" y2="25" stroke="#FFAB91" strokeWidth="0.3" opacity="0.6" />
              <line x1="21.5" y1="29" x2="23" y2="29" stroke="#FFAB91" strokeWidth="0.3" opacity="0.6" />
              <line x1="21.5" y1="33" x2="23" y2="33" stroke="#FFAB91" strokeWidth="0.3" opacity="0.6" />
              {/* 水银柱 */}
              <rect x="19" y="28" width="2" height="8" rx="1" fill="#FF5722">
                <animate attributeName="height" values="8;6;8;9;8" dur="3s" repeatCount="indefinite" />
                <animate attributeName="y" values="28;30;28;27;28" dur="3s" repeatCount="indefinite" />
              </rect>
              {/* 储液球 */}
              <circle cx="20" cy="36" r="1.8" fill="#FF5722" />

              {/* 热辐射波纹 */}
              <circle cx="20" cy="30" r="4" fill="none" stroke="#FF8F00" strokeWidth="0.3" opacity="0.4">
                <animate attributeName="r" values="4;7;4" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* "温度"文字 */}
          <text
            x="20"
            y="42"
            textAnchor="middle"
            fill={online ? '#FFAB91' : '#5A5A5A'}
            fontSize="5.5"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1.5"
          >
            温度
          </text>

          {/* "℃" 单位 */}
          <text
            x="20"
            y="46"
            textAnchor="middle"
            fill={online ? 'rgba(255,171,145,0.8)' : 'rgba(255,255,255,0.2)'}
            fontSize="3.5"
            fontFamily="'Arial', sans-serif"
            fontWeight="600"
          >
            ℃
          </text>

          {/* 指针尖 */}
          <polygon
            points="14,48 20,58 26,48"
            fill={effectiveBodyColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isTopCoal ? (
        /* ── 放顶煤（18023）：煤灰黑方形底座 + 顶部漏斗放煤口 + 煤块下落动画 ──
            未触发：煤灰黑底座 + 静态煤块 + 慢速呼吸光
            触发态：深橙底座 + 煤块活跃下落 + 顶部脉冲圈 */
        <g transform="translate(2, 2)">
          {/* 在线态：橙色柔和呼吸光晕 */}
          {online && (
            <rect
              x="2"
              y="6"
              width="36"
              height="44"
              rx="5"
              fill="none"
              stroke="#FF8F00"
              strokeWidth="1.5"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="1.5;2.5;1.5" dur="2.4s" repeatCount="indefinite" />
            </rect>
          )}

          {/* 方形底座 */}
          <rect
            x="4"
            y="8"
            width="32"
            height="40"
            rx="4"
            fill={online ? (triggered ? '#FF6F00' : '#424242') : '#9E9E9E'}
            stroke={online ? (triggered ? '#E65100' : '#212121') : '#9E9E9E'}
            strokeWidth="2"
          />

          {/* ── 顶部漏斗形放煤口 ── */}
          <g>
            {/* 漏斗外框（梯形） */}
            <path
              d="M 14,8 L 26,8 L 24,16 L 16,16 Z"
              fill={online ? (triggered ? '#E65100' : '#212121') : '#616161'}
              stroke={online ? (triggered ? '#FFAB40' : '#424242') : '#757575'}
              strokeWidth="0.5"
            />
            {/* 漏斗内部（暗腔） */}
            <path d="M 15,9 L 25,9 L 23,15 L 17,15 Z" fill={online ? '#0A0A0A' : '#424242'} />
          </g>

          {/* ── 中心煤块下落动画 ── */}
          {online && (
            <g>
              {triggered ? (
                <>
                  {/* 触发态：煤块活跃下落 */}
                  <rect x="17" y="18" width="1.5" height="1.5" rx="0.3" fill="#424242">
                    <animate attributeName="y" values="18;38;18" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                  </rect>
                  <rect x="20" y="20" width="1.2" height="1.2" rx="0.3" fill="#616161">
                    <animate attributeName="y" values="20;40;20" dur="1s" begin="0.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.3;1" dur="1s" begin="0.2s" repeatCount="indefinite" />
                  </rect>
                  <rect x="22" y="19" width="1.5" height="1.5" rx="0.3" fill="#424242">
                    <animate attributeName="y" values="19;39;19" dur="1.4s" begin="0.4s" repeatCount="indefinite" />
                    <animate
                      attributeName="opacity"
                      values="1;0.3;1"
                      dur="1.4s"
                      begin="0.4s"
                      repeatCount="indefinite"
                    />
                  </rect>
                  <rect x="19" y="22" width="1" height="1" rx="0.2" fill="#757575">
                    <animate attributeName="y" values="22;40;22" dur="0.9s" begin="0.1s" repeatCount="indefinite" />
                    <animate
                      attributeName="opacity"
                      values="1;0.3;1"
                      dur="0.9s"
                      begin="0.1s"
                      repeatCount="indefinite"
                    />
                  </rect>
                  {/* 橙色高光 */}
                  <rect x="18.5" y="24" width="1" height="1" rx="0.2" fill="#FF8F00" opacity="0.6">
                    <animate attributeName="y" values="24;38;24" dur="1.3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="1.3s" repeatCount="indefinite" />
                  </rect>
                </>
              ) : (
                <>
                  {/* 未触发：静态煤块 */}
                  <rect x="18" y="28" width="1.2" height="1.2" rx="0.3" fill="#424242" opacity="0.6" />
                  <rect x="21" y="32" width="1.5" height="1.5" rx="0.3" fill="#616161" opacity="0.5" />
                  <rect x="23" y="26" width="1" height="1" rx="0.2" fill="#424242" opacity="0.4" />
                </>
              )}
            </g>
          )}

          {/* "顶"字标识 */}
          <text
            x="20"
            y="42"
            textAnchor="middle"
            fill={online ? (triggered ? '#FFAB40' : '#FFFFFF') : 'rgba(255,255,255,0.4)'}
            fontSize="5.5"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1"
          >
            顶
          </text>

          {/* 指针尖 */}
          <polygon
            points="14,48 20,58 26,48"
            fill={online ? (triggered ? '#FF6F00' : '#424242') : '#9E9E9E'}
            stroke={online ? (triggered ? '#E65100' : '#212121') : '#9E9E9E'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isNumericWind ? (
        /* ── 风速数值型（18010）：浅蓝方底 + 顶部风杯风速计 + 旋转动画 ── */
        <g transform="translate(2, 2)">
          {online && (
            <rect
              x="2"
              y="6"
              width="36"
              height="44"
              rx="5"
              fill="none"
              stroke="#4FC3F7"
              strokeWidth="1.5"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="1.5;2.5;1.5" dur="2.4s" repeatCount="indefinite" />
            </rect>
          )}
          <rect
            x="4"
            y="8"
            width="32"
            height="40"
            rx="4"
            fill={online ? '#0277BD' : '#9E9E9E'}
            stroke={online ? '#01579B' : '#9E9E9E'}
            strokeWidth="2"
          />
          {/* 顶部风杯支架 */}
          <line x1="20" y1="8" x2="20" y2="16" stroke={online ? '#4FC3F7' : '#BDBDBD'} strokeWidth="1" />
          {/* 风杯（3个圆杯旋转） */}
          {online && (
            <g transform="translate(20, 14)">
              <g>
                <circle cx="0" cy="-3" r="2" fill="#4FC3F7" />
                <circle cx="2.6" cy="1.5" r="2" fill="#4FC3F7" />
                <circle cx="-2.6" cy="1.5" r="2" fill="#4FC3F7" />
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </g>
            </g>
          )}
          {/* 气流线 */}
          {online && (
            <g opacity="0.4">
              <path d="M 8,24 Q 12,22 16,24" fill="none" stroke="#81D4FA" strokeWidth="0.5">
                <animate attributeName="opacity" values="0.4;0;0.4" dur="1.2s" repeatCount="indefinite" />
              </path>
              <path d="M 24,28 Q 28,26 32,28" fill="none" stroke="#81D4FA" strokeWidth="0.5">
                <animate attributeName="opacity" values="0;0.4;0" dur="1.2s" repeatCount="indefinite" />
              </path>
            </g>
          )}
          <text
            x="20"
            y="42"
            textAnchor="middle"
            fill={online ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
            fontSize="5.5"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1"
          >
            风速
          </text>
          <polygon
            points="14,48 20,58 26,48"
            fill={online ? '#0277BD' : '#9E9E9E'}
            stroke={online ? '#01579B' : '#9E9E9E'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isNumericWindPress ? (
        /* ── 风压数值型（18011）：青蓝方底 + U型管压力计 + 液柱波动 ── */
        <g transform="translate(2, 2)">
          {online && (
            <rect
              x="2"
              y="6"
              width="36"
              height="44"
              rx="5"
              fill="none"
              stroke="#26C6DA"
              strokeWidth="1.5"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="stroke-width" values="1.5;2.5;1.5" dur="2.4s" repeatCount="indefinite" />
            </rect>
          )}
          <rect
            x="4"
            y="8"
            width="32"
            height="40"
            rx="4"
            fill={online ? '#00838F' : '#9E9E9E'}
            stroke={online ? '#006064' : '#9E9E9E'}
            strokeWidth="2"
          />
          {/* U型管 */}
          <path
            d="M 14,16 L 14,30 Q 14,34 18,34 L 22,34 Q 26,34 26,30 L 26,16"
            fill="none"
            stroke={online ? '#26C6DA' : '#BDBDBD'}
            strokeWidth="1.2"
          />
          {/* 左液柱 */}
          {online && (
            <rect x="13" y="24" width="2" height="10" fill="#26C6DA">
              <animate attributeName="height" values="10;6;10" dur="2s" repeatCount="indefinite" />
              <animate attributeName="y" values="24;28;24" dur="2s" repeatCount="indefinite" />
            </rect>
          )}
          {/* 右液柱 */}
          {online && (
            <rect x="25" y="20" width="2" height="14" fill="#26C6DA">
              <animate attributeName="height" values="14;18;14" dur="2s" repeatCount="indefinite" />
              <animate attributeName="y" values="20;16;20" dur="2s" repeatCount="indefinite" />
            </rect>
          )}
          {/* 刻度线 */}
          <g stroke={online ? '#80DEEA' : '#BDBDBD'} strokeWidth="0.3" opacity="0.5">
            <line x1="11" y1="20" x2="13" y2="20" />
            <line x1="11" y1="24" x2="13" y2="24" />
            <line x1="11" y1="28" x2="13" y2="28" />
            <line x1="27" y1="20" x2="29" y2="20" />
            <line x1="27" y1="24" x2="29" y2="24" />
            <line x1="27" y1="28" x2="29" y2="28" />
          </g>
          <text
            x="20"
            y="42"
            textAnchor="middle"
            fill={online ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
            fontSize="5"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1"
          >
            风压
          </text>
          <polygon
            points="14,48 20,58 26,48"
            fill={online ? '#00838F' : '#9E9E9E'}
            stroke={online ? '#006064' : '#9E9E9E'}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isFlame ? (
        /* ── 火焰型（18031）：深焰橙水滴 + 中心多层火苗（发光 + 摇曳） ──
            未触发：橙色水滴 + 小火苗慢速摇曳
            触发态：深焰橙水滴 + 大火苗快速摇曳 + 外圈脉冲 */
        <g transform="translate(2, 2)">
          {/* 在线态：外圈呼吸光晕（橙色脉冲） */}
          {online && (
            <path
              d={PIN_DROP_PATH}
              fill="none"
              stroke={triggered ? '#FF3D00' : '#FF8F00'}
              strokeWidth="1.5"
              opacity="0.5"
            >
              <animate
                attributeName="opacity"
                values="0.5;0;0.5"
                dur={triggered ? '0.8s' : '1.6s'}
                repeatCount="indefinite"
              />
              <animate
                attributeName="strokeWidth"
                values="1.5;4.5;1.5"
                dur={triggered ? '0.8s' : '1.6s'}
                repeatCount="indefinite"
              />
            </path>
          )}

          {/* 水滴形主体（深焰橙/深石板灰） */}
          <path
            d={PIN_DROP_PATH}
            fill={online ? (triggered ? '#BF360C' : '#37474F') : '#888888'}
            fillRule="nonzero"
            stroke={strokeColor}
            strokeWidth="2.5"
          />

          {/* 中心多层火苗（以 (20,32) 为底部中心，向上延伸） */}
          <g transform="translate(20, 32)" filter={online ? `url(#${glowId})` : undefined}>
            {/* 外层火苗（红橙） */}
            <path
              d="M 0,0 C -5,-3 -6,-9 -3,-14 C -2,-17 -1,-19 0,-21 C 1,-19 2,-17 3,-14 C 6,-9 5,-3 0,0 Z"
              fill={online ? (triggered ? '#FF3D00' : '#FF6F00') : '#666'}
              opacity={online ? 0.9 : 0.4}
            >
              {online && (
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values={triggered ? '1;0.88;1.12;1' : '1;0.92;1.08;1'}
                  dur={triggered ? '0.4s' : '1.1s'}
                  repeatCount="indefinite"
                />
              )}
            </path>
            {/* 中层火苗（亮橙） */}
            <path
              d="M 0,0 C -3.5,-2 -4.5,-7 -2,-11 C -1,-13 -0.5,-14.5 0,-16 C 0.5,-14.5 1,-13 2,-11 C 4.5,-7 3.5,-2 0,0 Z"
              fill={online ? '#FF9800' : '#888'}
              opacity={online ? 0.95 : 0.4}
            >
              {online && (
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values={triggered ? '1;1.12;0.88;1' : '1;1.08;0.93;1'}
                  dur={triggered ? '0.3s' : '0.9s'}
                  repeatCount="indefinite"
                />
              )}
            </path>
            {/* 内层火苗（黄白核心） */}
            <path
              d="M 0,0 C -2,-1 -2.5,-4 -1,-7 C -0.5,-8.5 -0.2,-9.5 0,-10.5 C 0.2,-9.5 0.5,-8.5 1,-7 C 2.5,-4 2,-1 0,0 Z"
              fill={online ? '#FFF9C4' : '#AAA'}
              opacity={online ? 1 : 0.4}
            >
              {online && (
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values={triggered ? '1;0.82;1.18;1' : '1;1.1;0.9;1'}
                  dur={triggered ? '0.25s' : '0.7s'}
                  repeatCount="indefinite"
                />
              )}
            </path>
            {/* 火苗底部基座 */}
            <ellipse cx="0" cy="0" rx="3" ry="0.8" fill={online ? '#3E0A00' : '#444'} opacity="0.7" />
          </g>

          {/* 指针尖（朝下，颜色与水滴同步） */}
          <polygon
            points="14,44 20,54 26,44"
            fill={online ? (triggered ? '#BF360C' : '#E64A19') : '#888888'}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isTemperature ? (
        /* ── 温度报警型（18025）：圆形底座 + 中心温度计 + 热辐射波纹（参考红外结构）
            未触发：琥珀橙圆形底座 + 琥珀色水银柱低位 + 热辐射波纹慢速
            触发态：深红圆形底座 + 红色水银柱满管 + 热辐射波纹快速 + 外圈脉冲 */
        <g transform="translate(2, 2)">
          {/* 热辐射波纹（外层，8 根径向波纹线，从圆形底座向外扩散） */}
          {online && (
            <g stroke={triggered ? '#FF5252' : '#FFB74D'} strokeWidth="1.6" strokeLinecap="round" fill="none">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                const begin = `${(deg / 360) * (triggered ? 0.8 : 2.0)}s`;
                return (
                  <g key={deg} transform={`rotate(${deg} 20 28)`}>
                    <line x1="38" y1="28" x2="42" y2="28">
                      <animate
                        attributeName="x2"
                        values="42;47;42"
                        dur={triggered ? '0.8s' : '2.0s'}
                        repeatCount="indefinite"
                        begin={begin}
                      />
                      <animate
                        attributeName="opacity"
                        values="0.9;0;0.9"
                        dur={triggered ? '0.8s' : '2.0s'}
                        repeatCount="indefinite"
                        begin={begin}
                      />
                    </line>
                  </g>
                );
              })}
            </g>
          )}

          {/* 触发态：外圈红色脉冲圈（温度超限报警） */}
          {online && triggered && (
            <circle cx="20" cy="28" r="18" fill="none" stroke="#FF5252" strokeWidth="2" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="r" values="18;24;18" dur="0.8s" repeatCount="indefinite" />
            </circle>
          )}

          {/* 圆形底座（琥珀橙/触发=深红，离线=灰，与卡片视图外壳一致） */}
          <circle
            cx="20"
            cy="28"
            r="18"
            fill={online ? (triggered ? '#C62828' : '#FF8F00') : '#9E9E9E'}
            stroke={strokeColor}
            strokeWidth="2.5"
          />

          {/* 中心温度计小图标（以 (20,28) 为中心，竖向布局，颜色与卡片视图温度计一致） */}
          <g transform="translate(20, 28)">
            {/* 温度计管身（细长竖管，深色背景） */}
            <rect
              x="-2.5"
              y="-12"
              width="5"
              height="16"
              rx="2.5"
              fill={online ? '#3E2723' : '#5A5A5A'}
              stroke={online ? (triggered ? '#FFCDD2' : '#FFE0B2') : '#5A5A5A'}
              strokeWidth="0.4"
            />
            {/* 水银柱（核心动态元素） */}
            {online ? (
              triggered ? (
                <rect x="-1.5" y="-10" width="3" height="14" rx="1.5" fill="#FF5252">
                  <animate attributeName="height" values="14;12;15;14" dur="0.4s" repeatCount="indefinite" />
                  <animate attributeName="y" values="-10;-8;-11;-10" dur="0.4s" repeatCount="indefinite" />
                </rect>
              ) : (
                <rect x="-1.5" y="-4" width="3" height="8" rx="1.5" fill="#FFB74D">
                  <animate attributeName="height" values="8;7;9;8" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="y" values="-4;-3;-5;-4" dur="2.5s" repeatCount="indefinite" />
                </rect>
              )
            ) : (
              <rect x="-1.5" y="-2" width="3" height="6" rx="1.5" fill="#9E9E9E" opacity="0.5" />
            )}
            {/* 底部储液球（温度计标志性造型） */}
            <circle
              cx="0"
              cy="6"
              r="4"
              fill={online ? (triggered ? '#FF5252' : '#FFB74D') : '#9E9E9E'}
              stroke={online ? '#3E2723' : '#5A5A5A'}
              strokeWidth="0.6"
              opacity={online ? 0.95 : 0.6}
            />
            {/* 储液球高光（模拟玻璃球反光） */}
            {online && <ellipse cx="-1.5" cy="4.5" rx="1.2" ry="1" fill="#FFFFFF" opacity="0.35" />}
          </g>

          {/* 指针尖（朝下的小三角，暗示定位，颜色与圆形底座一致） */}
          <polygon
            points="14,44 20,54 26,44"
            fill={online ? (triggered ? '#C62828' : '#FF8F00') : '#9E9E9E'}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isCO ? (
        /* ── CO 报警型（18030）：圆形底座 + 中心"CO"字母 + 气体扩散波纹（参考温度结构）
            未触发：深玫红圆形底座 + 白色"CO" + 慢速气体扩散波纹
            触发态：深红圆形底座 + 红色"CO" + 快速气体扩散波纹 + 外圈脉冲 */
        <g transform="translate(2, 2)">
          {/* 气体扩散波纹（外层，3 层同心圆从中心向外扩散） */}
          {online && (
            <g>
              <circle
                cx="20"
                cy="28"
                r="10"
                fill="none"
                stroke={triggered ? '#FF5252' : '#F8BBD0'}
                strokeWidth="1.2"
                opacity="0.6"
              >
                <animate
                  attributeName="r"
                  values="10;18;10"
                  dur={triggered ? '0.8s' : '2.0s'}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;0;0.6"
                  dur={triggered ? '0.8s' : '2.0s'}
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx="20"
                cy="28"
                r="10"
                fill="none"
                stroke={triggered ? '#FF5252' : '#F8BBD0'}
                strokeWidth="1.0"
                opacity="0.5"
              >
                <animate
                  attributeName="r"
                  values="10;18;10"
                  dur={triggered ? '0.8s' : '2.0s'}
                  begin="0.3s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.5;0;0.5"
                  dur={triggered ? '0.8s' : '2.0s'}
                  begin="0.3s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx="20"
                cy="28"
                r="10"
                fill="none"
                stroke={triggered ? '#FF5252' : '#F8BBD0'}
                strokeWidth="0.8"
                opacity="0.4"
              >
                <animate
                  attributeName="r"
                  values="10;18;10"
                  dur={triggered ? '0.8s' : '2.0s'}
                  begin="0.6s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur={triggered ? '0.8s' : '2.0s'}
                  begin="0.6s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )}

          {/* 触发态：外圈红色脉冲圈（CO 超限报警） */}
          {online && triggered && (
            <circle cx="20" cy="28" r="18" fill="none" stroke="#FF5252" strokeWidth="2" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="r" values="18;24;18" dur="0.8s" repeatCount="indefinite" />
            </circle>
          )}

          {/* 圆形底座（深玫红/触发=深红，离线=灰，与卡片视图外壳一致） */}
          <circle
            cx="20"
            cy="28"
            r="18"
            fill={online ? (triggered ? '#C62828' : '#AD1457') : '#9E9E9E'}
            stroke={strokeColor}
            strokeWidth="2.5"
          />

          {/* 中心"CO"字母（核心标识） */}
          <text
            x="20"
            y="31"
            textAnchor="middle"
            fill={online ? (triggered ? '#FFCDD2' : '#FFFFFF') : '#5A5A5A'}
            fontSize="9"
            fontFamily="'Arial', sans-serif"
            fontWeight="800"
            letterSpacing="0.5"
          >
            CO
          </text>

          {/* 指针尖（朝下的小三角，暗示定位，颜色与圆形底座一致） */}
          <polygon
            points="14,44 20,54 26,44"
            fill={online ? (triggered ? '#C62828' : '#AD1457') : '#9E9E9E'}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isCleanWall ? (
        /* ── 清洗煤壁传感器（18035）：青绿水滴 + 水流喷射 + 煤壁纹理 ──
            独立实现，不归入 alarmSensors 位域
            未触发：青绿水滴 + 水流慢速
            触发态：深青绿水滴 + 水流快速喷射 + 煤壁清洗动画 */
        <g transform="translate(2, 2)">
          {/* 在线态：外圈呼吸光晕（青绿脉冲） */}
          {online && (
            <path
              d={PIN_DROP_PATH}
              fill="none"
              stroke={triggered ? '#00897B' : '#26A69A'}
              strokeWidth="1.5"
              opacity="0.5"
            >
              <animate
                attributeName="opacity"
                values="0.5;0;0.5"
                dur={triggered ? '0.8s' : '1.6s'}
                repeatCount="indefinite"
              />
              <animate
                attributeName="strokeWidth"
                values="1.5;4.5;1.5"
                dur={triggered ? '0.8s' : '1.6s'}
                repeatCount="indefinite"
              />
            </path>
          )}

          {/* 水滴形主体（青绿/深青绿） */}
          <path
            d={PIN_DROP_PATH}
            fill={online ? (triggered ? '#00695C' : '#00897B') : '#888888'}
            fillRule="nonzero"
            stroke={strokeColor}
            strokeWidth="2.5"
          />

          {/* 煤壁纹理（右侧竖纹，模拟煤层断面） */}
          <g opacity={online ? 0.4 : 0.2}>
            <rect x="28" y="14" width="3" height="20" rx="0.5" fill="#1A1A1A" />
            <rect x="31" y="16" width="2" height="16" rx="0.3" fill="#2D2D2D" />
          </g>

          {/* 水流喷射动画（从中心向右喷射到煤壁） */}
          {online && (
            <g transform="translate(20, 24)">
              {/* 水流主体 */}
              <path d="M 0,0 Q 4,-1 8,0 Q 10,1 8,2 Q 4,3 0,2 Z" fill={triggered ? '#4DB6AC' : '#80CBC4'} opacity="0.9">
                <animate
                  attributeName="opacity"
                  values="0.9;0.4;0.9"
                  dur={triggered ? '0.4s' : '1.2s'}
                  repeatCount="indefinite"
                />
              </path>
              {/* 水滴飞溅 */}
              <circle cx="10" cy="0" r="1" fill={triggered ? '#4DB6AC' : '#80CBC4'}>
                <animate
                  attributeName="cx"
                  values="8;14;8"
                  dur={triggered ? '0.3s' : '1.0s'}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;0;1"
                  dur={triggered ? '0.3s' : '1.0s'}
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="9" cy="3" r="0.8" fill={triggered ? '#4DB6AC' : '#80CBC4'}>
                <animate
                  attributeName="cx"
                  values="7;12;7"
                  dur={triggered ? '0.35s' : '1.1s'}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0;0.8"
                  dur={triggered ? '0.35s' : '1.1s'}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )}

          {/* 中心喷头图标 */}
          <g transform="translate(14, 22)">
            <rect x="-2" y="-3" width="4" height="6" rx="1" fill={online ? '#E0F2F1' : '#666'} />
            <circle cx="0" cy="0" r="1.5" fill={online ? '#004D40' : '#444'} />
          </g>

          {/* 指针尖 */}
          <polygon
            points="14,44 20,54 26,44"
            fill={online ? (triggered ? '#00695C' : '#00897B') : '#888888'}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isFlowMeter ? (
        /* ── 流量计（18040）：深蓝水滴 + 水流转子 + 流量数字 ──
            独立设备类型（otherDeviceTypeRules，非传感器），协议命令码 0x0626
            实时字段：instantFlow（瞬时流量）/ totalFlow（累计流量） */
        <g transform="translate(2, 2)">
          {/* 在线态：外圈呼吸光晕（蓝色脉冲） */}
          {online && (
            <path d={PIN_DROP_PATH} fill="none" stroke="#1976D2" strokeWidth="1.5" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0;0.5" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="strokeWidth" values="1.5;4;1.5" dur="1.8s" repeatCount="indefinite" />
            </path>
          )}

          {/* 水滴形主体（深蓝） */}
          <path
            d={PIN_DROP_PATH}
            fill={online ? '#1565C0' : '#888888'}
            fillRule="nonzero"
            stroke={strokeColor}
            strokeWidth="2.5"
          />

          {/* 中心水流转子（旋转动画） */}
          <g transform="translate(20, 26)" filter={online ? `url(#${glowId})` : undefined}>
            {/* 转子外圈 */}
            <circle
              cx="0"
              cy="0"
              r="6"
              fill="none"
              stroke={online ? '#42A5F5' : '#666'}
              strokeWidth="1.5"
              opacity="0.6"
            />
            {/* 转子叶片（4 叶，旋转） */}
            {online && (
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <path d="M 0,0 L 0,-5 Q 2,-4 2,0 Z" fill="#42A5F5" opacity="0.9" />
                <path d="M 0,0 L 5,0 Q 4,2 0,2 Z" fill="#42A5F5" opacity="0.9" />
                <path d="M 0,0 L 0,5 Q -2,4 -2,0 Z" fill="#42A5F5" opacity="0.9" />
                <path d="M 0,0 L -5,0 Q -4,-2 0,-2 Z" fill="#42A5F5" opacity="0.9" />
              </g>
            )}
            {/* 中心轴 */}
            <circle cx="0" cy="0" r="1.5" fill={online ? '#0D47A1' : '#444'} />
          </g>

          {/* 流量数字标识 */}
          <text
            x="20"
            y="42"
            textAnchor="middle"
            fontSize="4"
            fontFamily="'PingFang SC', sans-serif"
            fontWeight="700"
            fill={online ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
          >
            流量
          </text>

          {/* 指针尖 */}
          <polygon
            points="14,44 20,54 26,44"
            fill={online ? '#1565C0' : '#888888'}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : isPump ? (
        /* ── 压力泵（18041）：参考 industrial-pump-scada003.svg 迷你版
            独立设备类型，协议命令码 0x0627，字段 startStatus（0=停止 1=运行）
            圆形主体 + 顶部迷你压力表（红色指针随状态偏转）+ 底部状态灯 */
        <g transform="translate(2, 2)">
          {/* 在线态：外圈呼吸光晕 */}
          {online && (
            <circle cx="20" cy="26" r="18" fill="none" stroke="#4FD1C5" strokeWidth="1.5" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0;0.5" dur="2.0s" repeatCount="indefinite" />
              <animate attributeName="strokeWidth" values="1.5;4;1.5" dur="2.0s" repeatCount="indefinite" />
            </circle>
          )}

          {/* 圆形主体（深蓝灰，与 Card 变体一致） */}
          <circle cx="20" cy="26" r="18" fill={online ? '#1A2332' : '#424242'} stroke={online ? '#2D3748' : '#616161'} strokeWidth="2.5" />

          {/* 迷你压力表（12 主刻度 + 红色指针，与 Card 变体风格统一） */}
          <g transform="translate(20, 20)">
            <circle cx="0" cy="0" r="9" fill={online ? '#2D3748' : '#616161'} stroke={online ? '#4FD1C5' : '#616161'} strokeWidth="0.8" />
            <circle cx="0" cy="0" r="7.5" fill={online ? '#F0F4F8' : '#9E9E9E'} />
            {/* 12 主刻度 */}
            <g stroke={online ? '#4A5568' : '#9E9E9E'} strokeWidth="0.5">
              {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => {
                const rad = (deg * Math.PI) / 180;
                return <line key={`tick-${deg}`} x1={Math.cos(rad)*5.5} y1={Math.sin(rad)*5.5} x2={Math.cos(rad)*7} y2={Math.sin(rad)*7} />;
              })}
            </g>
            {/* 红色指针：运行→右偏 60°，停止→左偏 -60° */}
            {online && (
              <line x1="0" y1="0" x2="0" y2="-5.5" stroke="#E53E3E" strokeWidth="1" strokeLinecap="round" transform={`rotate(${isRunning ? 60 : -60})`} />
            )}
            <circle cx="0" cy="0" r="1.2" fill={online ? '#E53E3E' : '#616161'} />
          </g>

          {/* 状态灯 */}
          <circle cx="20" cy="34" r="2.5" fill={online ? (isRunning ? '#4FD1C5' : '#FFC107') : '#616161'} />
          {online && isRunning && (
            <circle cx="20" cy="34" r="2.5" fill="#4FD1C5" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
            </circle>
          )}

          {/* 泵标识 */}
          <text x="20" y="42" textAnchor="middle" fontSize="4" fontFamily="'PingFang SC', sans-serif" fontWeight="700" fill={online ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}>
            泵
          </text>
        </g>
      ) : isCollector ? (
        /* ── 信号采集器（18002 无线 / 18003 有线）：圆角矩形 + 天线/接口 + 状态灯 ──
            形状：圆角矩形（与 sub 相同基础形状）
            颜色：无线=深海蓝 #1A3A5C，有线=深石墨灰 #2E3B4E
            协议：wirelessAddressRules bit1010=无线 / bit1110=有线 */
        <g transform="translate(2, 2)">
          {online && (
            <rect x="4" y="8" width="32" height="36" rx="6" fill="none" stroke={isWirelessCollector ? '#4FD1C5' : '#FFC107'} strokeWidth="1.5" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
            </rect>
          )}
          {/* 主体 */}
          <rect x="4" y="8" width="32" height="36" rx="6" fill={online ? (isWirelessCollector ? '#1A3A5C' : '#2E3B4E') : '#888888'} stroke={strokeColor} strokeWidth="2.5" />
          {/* 顶部信号区 */}
          {isWirelessCollector ? (
            <g>
              {/* 天线杆 */}
              <line x1="20" y1="8" x2="20" y2="4" stroke={online ? '#90A4AE' : '#666'} strokeWidth="1" strokeLinecap="round" />
              <circle cx="20" cy="4" r="1" fill={online ? '#4FD1C5' : '#666'} />
              {/* 信号波纹 */}
              {online && [0, 1].map(i => (
                <path key={`pin-sig-${i}`} d={`M ${16 + i * 4} 8 Q 20 ${6 - i} ${24 - i * 4} 8`} fill="none" stroke="#4FD1C5" strokeWidth="0.5" opacity={0.7 - i * 0.3}>
                  <animate attributeName="opacity" values={`${0.7 - i * 0.3};0.1;${0.7 - i * 0.3}`} dur="1.5s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                </path>
              ))}
            </g>
          ) : (
            <g>
              {/* 有线接口 */}
              <rect x="12" y="6" width="16" height="4" rx="1" fill={online ? '#37474F' : '#666'} />
              {[0, 1, 2].map(i => (
                <circle key={`pin-term-${i}`} cx={16 + i * 4} cy="8" r="0.8" fill={online ? '#546E7A' : '#666'} />
              ))}
            </g>
          )}
          {/* 中心屏幕 */}
          <rect x="10" y="14" width="20" height="12" rx="1.5" fill={online ? '#0D1B2A' : '#444'} stroke={online ? '#4FD1C5' : '#666'} strokeWidth="0.5" />
          <text x="20" y="23" textAnchor="middle" fontSize="5" fontFamily="'PingFang SC', sans-serif" fontWeight="700" fill={online ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}>
            {isWirelessCollector ? '无' : '有'}
          </text>
          {/* 状态LED */}
          <g>
            <circle cx="10" cy="32" r="1.2" fill={online ? '#4CAF50' : '#666'} opacity={online ? 0.9 : 0.4} />
            <circle cx="16" cy="32" r="1.2" fill={online ? '#4FD1C5' : '#666'} opacity={online ? 0.9 : 0.4} />
            <circle cx="24" cy="32" r="1.2" fill={online ? '#FFC107' : '#666'} opacity={online ? 0.9 : 0.4} />
            <circle cx="30" cy="32" r="1.2" fill={online ? '#FF9800' : '#666'} opacity={online ? 0.9 : 0.4} />
          </g>
          {/* 底部端子 */}
          <rect x="12" y="38" width="16" height="3" rx="0.5" fill={online ? (isWirelessCollector ? '#0F2440' : '#1A2332') : '#666'} />
        </g>
      ) : iconType === 'main' ? (
        /* ── 集控器（18）：六边形 + 小屏幕 + 端子标识（控制中心视觉） ──
            形状：六边形（区别于水滴形传感器）
            颜色：红色 #D93A3A（与 PinVariantRenderer bodyColor 一致）
            协议：targetType=18，系统核心，管理分控器/传感器 */
        <g transform="translate(2, 2)">
          {/* 在线态：外圈呼吸光晕（红色脉冲） */}
          {online && (
            <polygon
              points="20,4 34,12 34,36 20,44 6,36 6,12"
              fill="none"
              stroke="#D93A3A"
              strokeWidth="1.5"
              opacity="0.5"
            >
              <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
              <animate attributeName="strokeWidth" values="1.5;4;1.5" dur="2s" repeatCount="indefinite" />
            </polygon>
          )}
          {/* 六边形主体 */}
          <polygon
            points="20,4 34,12 34,36 20,44 6,36 6,12"
            fill={online ? '#D93A3A' : '#888888'}
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* 中心小屏幕 */}
          <rect
            x="12"
            y="18"
            width="16"
            height="12"
            rx="1.5"
            fill={online ? '#1A1A1A' : '#444'}
            stroke={online ? '#FFCDD2' : '#666'}
            strokeWidth="0.5"
          />
          {/* 屏幕内状态点 */}
          <circle cx="15" cy="22" r="1" fill={online ? '#4CAF50' : '#666'}>
            {online && <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />}
          </circle>
          {/* 屏幕内文字"主" */}
          <text
            x="20"
            y="28"
            textAnchor="middle"
            fontSize="5"
            fontFamily="'PingFang SC', sans-serif"
            fontWeight="700"
            fill={online ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
          >
            主
          </text>
          {/* 顶部端子标识（4个端子） */}
          <g>
            <rect x="10" y="8" width="2" height="3" fill={online ? '#B71C1C' : '#666'} />
            <rect x="14" y="6" width="2" height="3" fill={online ? '#B71C1C' : '#666'} />
            <rect x="24" y="6" width="2" height="3" fill={online ? '#B71C1C' : '#666'} />
            <rect x="28" y="8" width="2" height="3" fill={online ? '#B71C1C' : '#666'} />
          </g>
          {/* 指针尖 */}
          <polygon
            points="14,44 20,54 26,44"
            fill={online ? '#D93A3A' : '#888888'}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : iconType === 'sub' ? (
        /* ── 分控器（18001/18002/18003）：圆角矩形 + 状态指示灯阵列 ──
            形状：圆角矩形（区别于水滴形传感器和六边形集控器）
            颜色：橙色 #E67E22（与 PinVariantRenderer bodyColor 一致）
            协议：管理前喷/后喷/清洗/电池预警/强喷等多状态（controllerState 位域） */
        <g transform="translate(2, 2)">
          {/* 在线态：外圈呼吸光晕（橙色脉冲） */}
          {online && (
            <rect
              x="4"
              y="8"
              width="32"
              height="36"
              rx="6"
              fill="none"
              stroke="#E67E22"
              strokeWidth="1.5"
              opacity="0.5"
            >
              <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
              <animate attributeName="strokeWidth" values="1.5;4;1.5" dur="2s" repeatCount="indefinite" />
            </rect>
          )}
          {/* 圆角矩形主体 */}
          <rect
            x="4"
            y="8"
            width="32"
            height="36"
            rx="6"
            fill={online ? '#E67E22' : '#888888'}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          {/* 中心小屏幕 */}
          <rect
            x="10"
            y="14"
            width="20"
            height="12"
            rx="1.5"
            fill={online ? '#1A1A1A' : '#444'}
            stroke={online ? '#FFE0B2' : '#666'}
            strokeWidth="0.5"
          />
          {/* 屏幕内文字"分" */}
          <text
            x="20"
            y="23"
            textAnchor="middle"
            fontSize="5"
            fontFamily="'PingFang SC', sans-serif"
            fontWeight="700"
            fill={online ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
          >
            分
          </text>
          {/* 状态指示灯阵列（8个LED，对应 controllerState 位域 8 个 bit）
              布局：两行4列，行间距 3px，列间距 6px
              bit0=前喷 bit1=后喷 bit2=清洗 bit3=电池
              bit4=通讯 bit5=前强 bit6=后强 bit7=清洗2 */}
          <g>
            {CONTROLLER_STATE_LEDS.map((led, idx) => {
              const col = idx % 4;
              const row = Math.floor(idx / 4);
              const cx = 10 + col * 6;
              const cy = 30 + row * 3;
              const active = controllerState !== undefined && online && isControllerLedActive(controllerState, led.bit);
              const fillColor = !online ? '#666' : (controllerState !== undefined ? (active ? led.activeColor : led.inactiveColor) : '#4CAF50');
              const opacity = !online ? 0.4 : (controllerState !== undefined ? (active ? 0.95 : 0.3) : 0.9);
              return (
                <g key={`sub-led-${idx}`}>
                  <circle cx={cx} cy={cy} r="1.2" fill={fillColor} opacity={opacity} />
                  {/* 激活态脉冲光晕 */}
                  {active && led.pulse && (
                    <circle cx={cx} cy={cy} r="1.2" fill={led.activeColor} opacity="0.4">
                      <animate attributeName="r" values="1.2;2.5;1.2" dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0;0.4" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}
          </g>
          {/* 底部端子标识 */}
          <rect x="12" y="38" width="16" height="3" rx="0.5" fill={online ? '#BF360C' : '#666'} />
          {/* 指针尖 */}
          <polygon
            points="14,44 20,54 26,44"
            fill={online ? '#E67E22' : '#888888'}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        /* ── 非触控型：原始水滴形 ── */
        <g transform="translate(2, 2)">
          {/* 1. 水滴形主体（填充 + 白色描边） */}
          <path d={PIN_DROP_PATH} fill={variantBodyColor} fillRule="nonzero" stroke={strokeColor} strokeWidth="2.5" />

          {/* 2. 在线态：外圈呼吸光晕 */}
          {online && !isAlarm && !alarmVariant && (
            <path d={PIN_DROP_PATH} fill="none" stroke={strokeColor} strokeWidth="1" opacity="0.3">
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="strokeWidth" values="1;4;1" dur="2.5s" repeatCount="indefinite" />
            </path>
          )}

          {/* 2b. 告警态/变体态：橙或变体色脉冲圈 */}
          {(isAlarm || alarmVariant) && (
            <path
              d={PIN_DROP_PATH}
              fill="none"
              stroke={alarmVariant ? alarmVariant.color : '#F0A030'}
              strokeWidth="1.5"
              opacity="0.5"
            >
              <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="strokeWidth" values="1.5;5;1.5" dur="1.2s" repeatCount="indefinite" />
            </path>
          )}

          {/* 4. 内嵌面板（变体色/红色矩形 + 白色描边） */}
          <rect x="10" y="12" width="20" height="15" rx="2" fill={variantBodyColor} fillRule="nonzero" />
          <rect x="10" y="12" width="20" height="15" rx="2" fill="none" stroke={strokeColor} strokeWidth="1.8" />

          {/* 5. 屏幕（变体色/告警橙色/蓝色） */}
          <rect x="14" y="16" width="12" height="7" rx="1.2" fill={finalScreenColor} fillRule="nonzero" />

          {/* 5b. 变体代号：屏幕内 1-2 个汉字标识（2026-06-15 实施） */}
          {alarmVariant && (
            <text
              x="20"
              y="21.4"
              textAnchor="middle"
              fontSize={alarmVariant.short.length > 1 ? 3.6 : 4.6}
              fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
              fontWeight="700"
              fill={online ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
            >
              {alarmVariant.short}
            </text>
          )}

          {/* 6. 屏幕呼吸微光（在线态） */}
          {online && (
            <rect x="14" y="16" width="12" height="7" rx="1.2" fill="#FFFFFF" fillRule="nonzero" opacity="0">
              <animate attributeName="opacity" values="0;0.15;0" dur="3s" repeatCount="indefinite" />
            </rect>
          )}

          {/* 7. 反光条 */}
          <rect
            x="15"
            y="17"
            width="4"
            height="2"
            rx="0.5"
            fill="#7EBEE8"
            fillRule="nonzero"
            opacity={online ? 0.5 : 0.2}
          />
        </g>
      )}
    </svg>
  );
}
