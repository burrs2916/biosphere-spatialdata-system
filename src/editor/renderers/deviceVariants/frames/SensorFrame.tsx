/**
 * SensorFrame — 传感器 / 通用设备 SVG 外壳渲染
 *
 * 从 DeviceSvgFrames.tsx 拆分，引用 ScreenComponents 中的共享工具。
 */

import { useId, useState, useEffect, useMemo } from 'react';
import { resolveColors } from './ScreenComponents';
import type { SensorFrameProps } from './ScreenComponents';

// ─── 传感器 (Sensor) ──────────────────────────────────────

export const SENSOR_VW = 80;
export const SENSOR_VH = 120;

/** 估算文字在 SVG 中的渲染宽度（viewBox 坐标系）
 *  中文/全角 ≈ fontSize，英文/数字 ≈ fontSize * 0.6
 */
function estimateTextWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // CJK 统一汉字、全角字符、中文标点
    w +=
      (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)
        ? fontSize
        : fontSize * 0.6;
  }
  return w;
}

/** 屏幕文字跑马灯组件：文字超长时自动水平滚动 */
function MarqueeText({
  x,
  y,
  children,
  fill,
  fontSize = 6,
  fontWeight = 600,
  fontFamily = 'sans-serif',
  maxWidth = 40,
}: {
  x: number;
  y: number;
  children: string;
  fill: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  maxWidth?: number;
}) {
  const textWidth = estimateTextWidth(children, fontSize);
  const overflow = textWidth - maxWidth;

  if (overflow <= 0) {
    // 文字不超长，静态显示
    return (
      <text x={x} y={y} fill={fill} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight}>
        {children}
      </text>
    );
  }

  // 超长：跑马灯滚动，从 x 滚动到 x - overflow，停留 1 秒后开始
  const scrollDur = Math.max(2, Math.round(overflow / 8)); // 滚动时长随溢出量增加
  const pauseDur = 1; // 到达终点后停留 1 秒
  const totalDur = scrollDur * 2 + pauseDur * 2;

  return (
    <text x={x} y={y} fill={fill} fontSize={fontSize} fontFamily={fontFamily} fontWeight={fontWeight}>
      {children}
      <animate
        attributeName="x"
        values={`${x}; ${x}; ${x - overflow}; ${x - overflow}; ${x}`}
        keyTimes={`0; ${pauseDur / totalDur}; ${(pauseDur + scrollDur) / totalDur}; ${(pauseDur * 2 + scrollDur) / totalDur}; 1`}
        dur={`${totalDur}s`}
        repeatCount="indefinite"
      />
    </text>
  );
}

export function SensorFrame({
  bodyColor = '#607D8B',
  borderColor = '#455A64',
  screenColor = '#5A9ED6',
  status: _status,
  statusVisual,
  label,
  subtitle,
  coreValue,
  screenContent,
  screenItems,
  sensorType = 'numeric',
  triggered = false,
  isTemplate,
  hideScreenContent,
  deviceMetadata,
}: SensorFrameProps) {
  const uid = useId().replace(/:/g, '');
  const palette = resolveColors(statusVisual.bodyScheme, {
    bodyColor,
    borderColor,
    screenColor,
    screwColor: '#2A2A2A',
    terminalColor: '#6A6A6A',
  });

  const isOffline = statusVisual.bodyScheme === 'offline';

  // 类型化 sensorType：fallback 分支内仍需识别所有 sensorType（含 alarm_dust/touch/infrared）
  const _sensorType: NonNullable<SensorFrameProps['sensorType']> = sensorType ?? 'numeric';
  const _st: string = _sensorType; // 转为 string 让 ?: 链式判断正常工作

  // ─── 粉尘仪表盘数据计算（数值型 18015 用） ───
  // 从 deviceMetadata 提取 minRange/maxRange/alarmLow/alarmHigh 和实时值
  // 用于在激光散射腔位置渲染一个半圆弧 SVG 微型仪表盘
  const dustGauge = useMemo(() => {
    const md = (deviceMetadata ?? {}) as Record<string, any>;
    const toNum = (v: unknown): number | undefined =>
      typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : undefined;
    const minR = toNum(md.minRange ?? md.min_range);
    const maxR = toNum(md.maxRange ?? md.max_range);
    const aLow = toNum(md.alarmLow ?? md.alarm_low);
    const aHigh = toNum(md.alarmHigh ?? md.alarm_high);
    // 实时值：优先取 realtime.value.value（{value, unit} 结构）
    const rt = (md.realtime ?? {}) as Record<string, { value: unknown }>;
    const rawVal =
      rt.value?.value ??
      rt.pressure?.value ??
      rt.flow?.value ??
      rt.temperature?.value ??
      rt.concentration?.value ??
      md.value ??
      md.pressure ??
      md.flow ??
      md.concentration;
    const val = typeof rawVal === 'number' ? rawVal : typeof rawVal === 'string' ? parseFloat(rawVal) : NaN;
    // 表盘上下限：maxRange>0 用 maxRange，否则 alarmHigh>0 用 alarmHigh，否则 100
    const lo = minR !== undefined && minR > 0 ? minR : 0;
    const hi = maxR !== undefined && maxR > lo ? maxR : aHigh !== undefined && aHigh > lo ? aHigh : 100;
    // 当前值占满量程的百分比
    const pct = !isNaN(val) && hi > lo ? Math.max(0, Math.min(1, (val - lo) / (hi - lo))) : 0;
    // 报警分段百分比（用于 3 段彩色弧）
    const lowPct = aLow !== undefined && aLow > lo && aLow < hi ? (aLow - lo) / (hi - lo) : 1 / 3;
    const highPct = aHigh !== undefined && aHigh > lo && aHigh < hi ? (aHigh - lo) / (hi - lo) : 2 / 3;
    return { lo, hi, val, pct, lowPct, highPct, hasValue: !isNaN(val) };
  }, [deviceMetadata]);

  // ─── 压力泵（18041）专用状态计算：运行状态（协议 0x0627 仅 startStatus 一个字段）───
  const pumpStatus = useMemo(() => {
    const md = (deviceMetadata ?? {}) as Record<string, any>;
    // startStatus: 0=停止 1=运行
    const rtStatus = (md.realtime as Record<string, any>)?.startStatus;
    const rawStatus = rtStatus?.value !== undefined ? rtStatus.value : md.startStatus;
    const isRunning = rawStatus === 1 || rawStatus === '1' || rawStatus === true;
    return { isRunning };
  }, [deviceMetadata]);
  const GAUGE_CX = 40;
  const GAUGE_CY = 34;
  const GAUGE_R = 7.5;

  /** 极坐标→笛卡尔（角度单位：度，顺时针从 +x 轴起算，SVG 坐标系 y 朝下） */
  const polar = (cx: number, cy: number, r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  // 注：18015 数值型粉尘已切换为"激光散射腔"视觉（顶部进气网 + 中央 V 字光路），
  //     不再使用半圆弧仪表盘。如未来需切换回仪表盘，可参考 polar 用法。

  // ─── 屏幕文字轮播：当 screenItems 超过可显示行数时自动翻页 ───
  const SCREEN_LINES = 4; // 屏幕可显示行数（fontSize=5.5，行间距7，屏幕高28）
  const CAROUSEL_INTERVAL = 3000; // 轮播间隔 3 秒
  const [carouselPage, setCarouselPage] = useState(0);
  const screenItemCount = screenItems?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(screenItemCount / SCREEN_LINES));

  // 轮播定时器
  useEffect(() => {
    if (totalPages <= 1) {
      setCarouselPage(0);
      return;
    }
    const timer = setInterval(() => {
      setCarouselPage((p) => (p + 1) % totalPages);
    }, CAROUSEL_INTERVAL);
    return () => clearInterval(timer);
  }, [totalPages]);

  // 当前页的 screenItems
  const currentPageItems =
    screenItems && screenItems.length > 0
      ? screenItems.slice(carouselPage * SCREEN_LINES, (carouselPage + 1) * SCREEN_LINES)
      : [];

  // 报警型/触控型/红外型传感器：指示灯颜色随触发状态变化
  // 离线时统一用灰色
  // P2-1 增强：低电态（batteryWarning）— 报警型传感器专属：屏幕格栅/圆点变琥珀 + 显示"低电"字样
  // P3-2 增强：红外/触控也走位域解析后能产生 batteryWarning=true
  // 粉尘报警（18029）也支持电池低电
  const isBatteryWarn =
    (sensorType === 'smoke' ||
      sensorType === 'infrared' ||
      sensorType === 'touch' ||
      sensorType === 'alarm_dust' ||
      sensorType === 'flame' ||
      sensorType === 'alarm_temperature' ||
      sensorType === 'alarm_co' ||
      sensorType === 'coalCutter' ||
      sensorType === 'frameMove' ||
      sensorType === 'frameDrop' ||
      sensorType === 'vibration' ||
      sensorType === 'top_coal') &&
    coreValue?.batteryWarning === true &&
    !isOffline;
  // P2-1 增强：扩展"有事件"概念：触发 OR 低电
  const hasAlarmVisual = triggered || isBatteryWarn;
  const topLedColor: string = (() => {
    if (isOffline) return statusVisual.color;
    if (sensorType === 'infrared') return hasAlarmVisual ? '#B71C1C' : '#E53935'; // 红外：未触发=红外红，触发/低电=深红
    if (sensorType === 'smoke') return hasAlarmVisual ? '#FFB300' : '#90A4AE'; // 烟雾：未触发=灰蓝，触发/低电=琥珀
    if (sensorType === 'touch') return hasAlarmVisual ? '#FFB300' : '#4CAF50'; // 触控：未触发=绿色，触发/低电=琥珀
    if (sensorType === 'alarm_dust') return hasAlarmVisual ? '#4E342E' : '#A1887F'; // 粉尘报警：未触发=浅棕，触发/低电=深棕
    if (sensorType === 'flame') return hasAlarmVisual ? '#FF6F00' : '#7C4DFF'; // 火焰：未触发=紫外紫，触发/低电=亮焰橙
    if (sensorType === 'alarm_temperature') return hasAlarmVisual ? '#C62828' : '#FFB74D'; // 温度：未触发=琥珀亮，触发/低电=深红
    if (sensorType === 'alarm_co') return hasAlarmVisual ? '#C62828' : '#E91E63'; // CO：未触发=品红，触发/低电=深红
    if (sensorType === 'coalCutter') return hasAlarmVisual ? '#E65100' : '#F9A825'; // 割煤机：未触发=工业黄，触发/低电=深琥珀
    if (sensorType === 'frameMove') return hasAlarmVisual ? '#1B5E20' : '#2E7D32'; // 移架：未触发=工业绿，触发/低电=深绿
    if (sensorType === 'frameDrop') return hasAlarmVisual ? '#3E2723' : '#5D4037'; // 落架：未触发=棕色，触发/低电=深棕
    if (sensorType === 'vibration') return hasAlarmVisual ? '#6A1B9A' : '#4527A0'; // 振动：未触发=紫色，触发/低电=深紫
    if (sensorType === 'top_coal') return hasAlarmVisual ? '#E65100' : '#424242'; // 放顶煤：未触发=煤灰黑，触发/低电=深橙
    if (sensorType === 'alarm') return triggered ? '#F44336' : '#4CAF50'; // 报警：未触发=绿色，触发=红色
    return statusVisual.color;
  })();
  const indicatorColor: string = (() => {
    if (isOffline) return statusVisual.color;
    if (sensorType === 'smoke') return hasAlarmVisual ? '#FFB300' : '#4CAF50'; // 烟雾：未触发=绿色，触发/低电=琥珀
    if (sensorType === 'infrared') return hasAlarmVisual ? '#B71C1C' : '#E53935'; // P3-5 红外：未触发=红外红，触发/低电=深红
    if (sensorType === 'touch') return hasAlarmVisual ? '#FFB300' : '#1976D2'; // P3-5 触控：未触发=蓝色，触发/低电=琥珀（与红外区分）
    if (sensorType === 'alarm_dust') return hasAlarmVisual ? '#4E342E' : '#A1887F'; // 粉尘报警：未触发=浅棕，触发/低电=深棕
    if (sensorType === 'flame') return hasAlarmVisual ? '#FF6F00' : '#7C4DFF'; // 火焰：未触发=紫外紫，触发/低电=亮焰橙
    if (sensorType === 'alarm_temperature') return hasAlarmVisual ? '#C62828' : '#FFB74D'; // 温度：未触发=琥珀亮，触发/低电=深红
    if (sensorType === 'alarm_co') return hasAlarmVisual ? '#C62828' : '#E91E63'; // CO：未触发=品红，触发/低电=深红
    if (sensorType === 'coalCutter') return hasAlarmVisual ? '#E65100' : '#F9A825'; // 割煤机：未触发=工业黄，触发/低电=深琥珀
    if (sensorType === 'frameMove') return hasAlarmVisual ? '#1B5E20' : '#2E7D32'; // 移架：未触发=工业绿，触发/低电=深绿
    if (sensorType === 'frameDrop') return hasAlarmVisual ? '#3E2723' : '#5D4037'; // 落架：未触发=棕色，触发/低电=深棕
    if (sensorType === 'vibration') return hasAlarmVisual ? '#6A1B9A' : '#4527A0'; // 振动：未触发=紫色，触发/低电=深紫
    if (sensorType === 'top_coal') return hasAlarmVisual ? '#E65100' : '#424242'; // 放顶煤：未触发=煤灰黑，触发/低电=深橙
    if (sensorType === 'alarm') return triggered ? '#F44336' : '#4CAF50';
    return statusVisual.color;
  })();

  // 红外型传感器：独立配色（深紫红）以与触控型（青蓝灰）区分
  // 烟雾型传感器：独立配色（灰蓝棕）以与其他型区分
  // 模板/截图态：红外型使用 #6A1B9A（深紫）；烟雾型使用 #546E7A（灰蓝）
  // 触发时：红外用 #C62828（深红）；烟雾用 #5D4037（棕灰+橙色边框）
  // 离线时不覆盖，保持灰色
  const TOUCH_THUMB_BODY = '#4A7C8A';
  const INFRARED_THUMB_BODY = '#E53935'; // 红外（18026）外壳=红外红（与 PinFrame/CardVariantRenderer 一致）
  const SMOKE_THUMB_BODY = '#546E7A';
  const DUST_THUMB_BODY = '#78909C'; // 粉尘数值型（18015）外壳=蓝灰（与触控型 #4A7C8A 区分，工业检测风格）
  const ALARM_DUST_THUMB_BODY = '#A1887F'; // 粉尘报警（18029）外壳=浅棕
  const FLAME_THUMB_BODY = '#37474F'; // 火焰报警（18031）外壳=深石板灰（火焰探测器工业风）
  const TEMP_THUMB_BODY = '#FF8F00'; // 温度报警（18025）外壳=琥珀橙（温度计经典色）
  const CO_THUMB_BODY = '#AD1457'; // CO 报警（18030）外壳=深玫红（有毒气体警示色）
  const TOP_COAL_THUMB_BODY = '#424242'; // 放顶煤（18023）外壳=煤灰黑（煤炭色）
  const CO_SENSOR_THUMB_BODY = '#00695C'; // CO 数值型（18013）外壳=深青色（电化学传感器工业色）
  const CH4_SENSOR_THUMB_BODY = '#1565C0'; // CH4 数值型（18012）外壳=深蓝色（催化燃烧式瓦斯监测工业色）
  const TEMP_SENSOR_THUMB_BODY = '#E65100'; // 温度数值型（18014）外壳=深橙色（温度计经典色）
  const effectiveBodyColor = isOffline
    ? palette.body
    : sensorType === 'touch'
      // 触控（18027）：外壳用青蓝灰 #4A7C8A（与组件库一致），触发=深蓝 #1565C0
      ? triggered
        ? '#1565C0'
        : TOUCH_THUMB_BODY
      : sensorType === 'infrared'
        // 红外（18026）：外壳用红外红 #E53935（与组件库一致），触发=深红 #C62828
        ? triggered
          ? '#C62828'
          : INFRARED_THUMB_BODY
        : sensorType === 'smoke'
          // 烟雾（18024）：外壳用灰蓝 #546E7A（与组件库一致），触发=棕灰 #5D4037
          ? triggered
            ? '#5D4037'
            : SMOKE_THUMB_BODY
          : sensorType === 'dust'
            ? // 数值型粉尘（18015）：截图态(isTemplate) 用 DUST_THUMB_BODY，
              // 运行态统一用 #78909C（蓝灰工业风），与触控型 #4A7C8A 区分
              isTemplate
              ? DUST_THUMB_BODY
              : '#78909C'
            : sensorType === 'co'
              ? // CO 数值型（18013）：深青色 #00695C（电化学传感器工业色）
                isTemplate
                ? CO_SENSOR_THUMB_BODY
                : '#00695C'
              : sensorType === 'ch4'
                ? // CH4 数值型（18012）：深蓝色 #1565C0（催化燃烧式瓦斯监测工业色）
                  isTemplate
                  ? CH4_SENSOR_THUMB_BODY
                  : '#1565C0'
                : sensorType === 'temperature'
                  ? // 温度数值型（18014）：深橙色 #E65100（温度计经典色）
                    isTemplate
                    ? TEMP_SENSOR_THUMB_BODY
                    : '#E65100'
                  : sensorType === 'alarm_dust'
                    // 粉尘报警（18029）：外壳用浅棕 #A1887F（与组件库一致），触发=深棕 #4E342E
                    ? triggered
                      ? '#4E342E'
                      : ALARM_DUST_THUMB_BODY
                    : sensorType === 'flame'
                      ? // 火焰（18031）：外壳用深石板灰 #37474F（工业感），触发=深焰橙 #BF360C
                        // 用灰色而非紫蓝，避免"青色"误读
                        triggered
                        ? '#BF360C'
                        : isTemplate
                          ? FLAME_THUMB_BODY
                          : '#37474F'
                      : sensorType === 'alarm_temperature'
                        ? // 温度报警（18025）：外壳用琥珀橙 #FF8F00（温度计经典色），触发=深红 #C62828
                          triggered
                          ? '#C62828'
                          : isTemplate
                            ? TEMP_THUMB_BODY
                            : '#FF8F00'
                        : sensorType === 'alarm_co'
                          ? // CO 报警（18030）：外壳用深玫红 #AD1457（有毒气体警示色），触发=深红 #C62828
                            triggered
                            ? '#C62828'
                            : isTemplate
                              ? CO_THUMB_BODY
                              : '#AD1457'
                          : sensorType === 'top_coal'
                            ? // 放顶煤（18023）：外壳用煤灰黑 #424242（煤炭色），触发=深橙 #FF6F00（煤流活跃）
                              triggered
                              ? '#FF6F00'
                              : isTemplate
                                ? TOP_COAL_THUMB_BODY
                                : '#424242'
                            : sensorType === 'coalCutter'
                              ? // 割煤机位置（18020）：外壳用工业黄 #F9A825，触发=深琥珀 #F57F17
                                triggered
                                ? '#F57F17'
                                : isTemplate
                                  ? '#F9A825'
                                  : '#F9A825'
                              : sensorType === 'frameMove'
                                ? // 移架（18021）：外壳用工业绿 #2E7D32，触发=深绿 #1B5E20
                                  triggered
                                  ? '#1B5E20'
                                  : isTemplate
                                    ? '#2E7D32'
                                    : '#2E7D32'
                                : sensorType === 'frameDrop'
                                  ? // 落架（18022）：外壳用棕色 #5D4037，触发=深棕 #3E2723
                                    triggered
                                    ? '#3E2723'
                                    : isTemplate
                                      ? '#5D4037'
                                      : '#5D4037'
                                  : sensorType === 'vibration'
                                    ? // 振动（18028）：外壳用紫色 #4527A0，触发=深紫 #6A1B9A
                                      triggered
                                      ? '#6A1B9A'
                                      : isTemplate
                                        ? '#4527A0'
                                        : '#4527A0'
                                    : sensorType === 'wind'
                                      ? // 风速（18010）：外壳用浅蓝 #0277BD
                                        isTemplate
                                        ? '#0277BD'
                                        : '#0277BD'
                                      : sensorType === 'windPress'
                                        ? // 风压（18011）：外壳用青蓝 #00838F
                                          isTemplate
                                          ? '#00838F'
                                          : '#00838F'
                                        : sensorType === 'cleanWall'
                                          ? // 清洗煤壁（18035）：青绿 #00897B（待机），触发=深青绿 #00695C（与 PinFrame 一致）
                                            triggered
                                            ? '#00695C'
                                            : '#00897B'
                                          : sensorType === 'flowMeter'
                                            ? // 流量计（18040）：深蓝 #1565C0（与 PinFrame 一致）
                                              '#1565C0'
                                            : sensorType === 'pump'
                                              ? // 压力泵（18041）：工业面板深灰 #1A2332（SCADA 风格深色面板）
                                                '#1A2332'
                                              : sensorType === 'collector_wireless'
                                                ? '#1A3A5C'
                                                : sensorType === 'collector_wired'
                                                  ? '#2E3B4E'
                                                  : palette.body;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SENSOR_VW} ${SENSOR_VH}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <defs>
          {/* 屏幕文字裁剪区域：屏幕内边距 2px */}
          <clipPath id={`sensor-screen-clip-${uid}`}>
            <rect x="19" y="46" width="42" height="28" />
          </clipPath>
          {/* 状态灯光晕滤镜 */}
          <filter id={`sensor-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* 烟雾传感器：顶部矩形格栅 pattern（密排小圆孔） */}
          <pattern id={`smoke-grille-${uid}`} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.9" fill="#1A1F26" />
          </pattern>
          {/* 烟雾型顶部矩形区域剪切（高度 20px，与半圆等高） */}
          <clipPath id="sensor-smoke-top-rect-clip">
            <rect x="20" y="8" width="40" height="20" />
          </clipPath>
          {/* 粉尘传感器：侧面进气槽 pattern（与烟雾的顶部圆孔形成根本性差异 — 壁挂式 vs 天花板式） */}
          <pattern id={`dust-side-vent-${uid}`} x="0" y="0" width="2.5" height="2.5" patternUnits="userSpaceOnUse">
            <rect x="0.4" y="0.4" width="1.7" height="1.7" fill="#1B0F0A" rx="0.3" />
          </pattern>
          {/* 粉尘右壁垂直进气槽剪切（x=64~70，y=30~78） */}
          <clipPath id="sensor-dust-side-vent-clip">
            <rect x="64" y="30" width="6" height="48" />
          </clipPath>
          {/* ── 数值型粉尘（18015）专属：顶部圆形进气网 + 扇叶（主动采样视觉） ──
              圆形进气口居中顶部（cx=40, cy=22, r=5），密排方孔 pattern 填充
              扇叶 3 叶，从圆心向外辐射，外切于 r=4.2 */}
          <pattern id={`dust-top-grille-${uid}`} x="0" y="0" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
            <rect x="0.2" y="0.2" width="1.2" height="1.2" fill="#0D1115" rx="0.2" />
          </pattern>
          <clipPath id="sensor-dust-top-grille-clip">
            <circle cx="40" cy="22" r="5" />
          </clipPath>
          {/* ── 数值型粉尘激光散射腔：内框 + 内部 3 个检测位 ── */}
          <clipPath id="sensor-dust-laser-cavity-clip">
            <rect x="22" y="34" width="36" height="22" rx="2" />
          </clipPath>
          {/* ── 火焰传感器（18031）专属：发光滤镜 + 多层径向渐变 ── */}
          <filter id={`flame-glow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`flame-grad-outer-${uid}`} cx="50%" cy="75%" r="55%">
            <stop offset="0%" stopColor="#FF8F00" />
            <stop offset="50%" stopColor="#FF3D00" />
            <stop offset="100%" stopColor="#BF360C" />
          </radialGradient>
          <radialGradient id={`flame-grad-mid-${uid}`} cx="50%" cy="75%" r="50%">
            <stop offset="0%" stopColor="#FFD54F" />
            <stop offset="50%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#FF6F00" />
          </radialGradient>
          <radialGradient id={`flame-grad-inner-${uid}`} cx="50%" cy="70%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#FFF9C4" />
            <stop offset="100%" stopColor="#FFD54F" />
          </radialGradient>
          {/* 离线态灰色渐变 */}
          <radialGradient id={`flame-grad-offline-${uid}`} cx="50%" cy="75%" r="55%">
            <stop offset="0%" stopColor="#9E9E9E" />
            <stop offset="100%" stopColor="#616161" />
          </radialGradient>
        </defs>
        {/* ── 外壳：粉尘型 — 数值型 vs 报警型视觉根本性差异 ──
            数值型 dust（18015）：深蓝灰 #455A64 外壳 + 顶部圆形进气网（主动采样）+ 中央激光散射腔（科学仪器风）
            报警型 alarm_dust（18029）：浅棕 #A1887F 外壳 + 右侧进气槽 + 中央 LED 环（触发=深棕脉动） */}
        {sensorType === 'dust' || sensorType === 'alarm_dust' ? (
          <>
            {/* 粉尘外壳（颜色按 sensorType 分流） */}
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={
                isOffline
                  ? '#9E9E9E'
                  : sensorType === 'alarm_dust' && triggered
                    ? '#3E2723'
                    : sensorType === 'alarm_dust'
                      ? '#A1887F'
                      : '#455A64'
              }
              stroke={
                isOffline
                  ? '#9E9E9E'
                  : sensorType === 'dust'
                    ? '#263238' // 数值型：深石板蓝边框
                    : '#3E2723'
              } // 报警型：深棕边框
              strokeWidth={2}
            />

            {/* ── 数值型粉尘（18015）专属：顶部圆形进气网 + 3 叶旋转扇叶 ──
                圆心 (40, 22)，半径 5，密排方孔 pattern
                与报警型"右侧壁挂式进气槽"形成 90° 方向差异 + 主动 vs 被动的语义差异 */}
            {sensorType === 'dust' && (
              <>
                {/* 圆形进气口深色底盘 */}
                <circle cx="40" cy="22" r="5.5" fill="#1B232B" stroke="#0D1115" strokeWidth="0.4" />
                {/* 密排方孔进气网 */}
                <g clipPath="url(#sensor-dust-top-grille-clip)">
                  <rect x="34.5" y="16.5" width="11" height="11" fill={`url(#dust-top-grille-${uid})`} />
                  {/* 在线时扇叶持续旋转（主动抽气采样的视觉证据） */}
                  {!isOffline && (
                    <g>
                      <g transform-origin="40 22">
                        {/* 3 叶扇叶：每叶是窄长椭圆 */}
                        <ellipse cx="40" cy="19" rx="0.7" ry="3" fill="#B0BEC5" opacity="0.85" />
                        <ellipse
                          cx="42.85"
                          cy="23.5"
                          rx="0.7"
                          ry="3"
                          fill="#B0BEC5"
                          opacity="0.85"
                          transform="rotate(120 42.85 23.5)"
                        />
                        <ellipse
                          cx="37.15"
                          cy="23.5"
                          rx="0.7"
                          ry="3"
                          fill="#B0BEC5"
                          opacity="0.85"
                          transform="rotate(-120 37.15 23.5)"
                        />
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from="0 40 22"
                          to="360 40 22"
                          dur="1.8s"
                          repeatCount="indefinite"
                        />
                      </g>
                      {/* 中心轴帽 */}
                      <circle cx="40" cy="22" r="0.8" fill="#37474F" stroke="#0D1115" strokeWidth="0.2" />
                    </g>
                  )}
                  {isOffline && <circle cx="40" cy="22" r="0.8" fill="#5A5A5A" />}
                </g>
                {/* 进气口外圈描边（金属感） */}
                <circle cx="40" cy="22" r="5.5" fill="none" stroke="#0D1115" strokeWidth={0.6} />
                <circle cx="40" cy="22" r="5" fill="none" stroke="#546E7A" strokeWidth={0.3} />
              </>
            )}

            {/* ── 报警型粉尘（18029）专用：右侧壁挂式进气道（保留原设计） ── */}
            {sensorType === 'alarm_dust' && (
              <>
                {/* 垂直矩形开口 x=64~70, y=30~78（高 48px，宽 6px），用密排方孔 pattern 填充 */}
                <rect x="64" y="30" width="6" height="48" rx="1.2" fill="#1B0F0A" />
                <g clipPath="url(#sensor-dust-side-vent-clip)">
                  <rect x="64" y="30" width="6" height="48" fill={`url(#dust-side-vent-${uid})`} />
                  {/* 报警型粉尘触发：进气道变深红/黑 + 脉动 */}
                  {triggered && !isOffline && (
                    <rect x="64" y="30" width="6" height="48" fill="#B71C1C" opacity="0.55">
                      <animate attributeName="opacity" values="0.55;0.2;0.55" dur="0.6s" repeatCount="indefinite" />
                    </rect>
                  )}
                </g>
                {/* 进气道外圈描边 */}
                <rect x="64" y="30" width="6" height="48" rx="1.2" fill="none" stroke="#0D0703" strokeWidth={0.5} />
              </>
            )}

            {/* ── 数值型粉尘（18015）专属：中央激光散射腔（替代原仪表盘） ──
                矩形检测腔 (22~58, 34~56)，内部 V 字光路 + 散射颗粒 + LED + 接收器
                与报警型"8 段 LED 弧形环"在结构上根本性不同 ——
                报警型用"LED 段数"传达告警强度，数值型用"光路+颗粒"传达测量原理 */}
            {sensorType === 'dust' ? (
              /* 数值型粉尘：激光散射腔 */
              <g>
                {/* 检测腔深色底板（玻璃窗效果） */}
                <rect x="22" y="34" width="36" height="22" rx="2" fill="#0D1115" stroke="#263238" strokeWidth="0.5" />
                {/* 内框高光（增强玻璃感） */}
                <rect
                  x="22.5"
                  y="34.5"
                  width="35"
                  height="21"
                  rx="1.5"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="0.3"
                />

                {/* ── V 字激光光路 ──
                    左下角 LED (25, 52) → 中央检测点 (40, 41) → 右下角接收器 (55, 52) */}
                {/* 红外 LED 发射源（左下角，红点 + 外晕） */}
                <circle cx="25" cy="52" r="1.4" fill="#FF3D00" opacity={isOffline ? 0.4 : 1}>
                  {!isOffline && (
                    <animate attributeName="opacity" values="1;0.55;1" dur="1.2s" repeatCount="indefinite" />
                  )}
                </circle>
                {!isOffline && (
                  <circle cx="25" cy="52" r="2.6" fill="#FF3D00" opacity="0.3">
                    <animate attributeName="r" values="2.6;4;2.6" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* 激光线 1：LED → 中心检测点（半透明红） */}
                {!isOffline && (
                  <line
                    x1="26"
                    y1="51"
                    x2="40"
                    y2="41"
                    stroke="#FF3D00"
                    strokeWidth="0.5"
                    opacity="0.7"
                    strokeLinecap="round"
                  />
                )}
                {isOffline && (
                  <line
                    x1="26"
                    y1="51"
                    x2="40"
                    y2="41"
                    stroke="#5A5A5A"
                    strokeWidth="0.4"
                    opacity="0.5"
                    strokeLinecap="round"
                  />
                )}

                {/* 中心检测点（粉尘散射发生处） */}
                <circle cx="40" cy="41" r="0.8" fill={isOffline ? '#5A5A5A' : '#FFE0B2'} />
                {!isOffline && (
                  <circle cx="40" cy="41" r="1.8" fill="none" stroke="#FFE0B2" strokeWidth="0.3" opacity="0.6">
                    <animate attributeName="r" values="1.8;3.2;1.8" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* 激光线 2：中心检测点 → 接收器（散射后的反射光） */}
                {!isOffline && (
                  <line
                    x1="40"
                    y1="41"
                    x2="54"
                    y2="51"
                    stroke="#FF3D00"
                    strokeWidth="0.5"
                    opacity="0.45"
                    strokeLinecap="round"
                  />
                )}
                {isOffline && (
                  <line
                    x1="40"
                    y1="41"
                    x2="54"
                    y2="51"
                    stroke="#5A5A5A"
                    strokeWidth="0.4"
                    opacity="0.4"
                    strokeLinecap="round"
                  />
                )}

                {/* 光电接收器（右下角，深色方块） */}
                <rect x="53" y="50" width="4" height="4" rx="0.4" fill="#1B232B" stroke="#0D1115" strokeWidth="0.3" />
                <rect x="53.5" y="50.5" width="3" height="3" rx="0.2" fill={isOffline ? '#5A5A5A' : '#37474F'} />

                {/* 散射颗粒动画（仅在线） — 颗粒在检测腔内随机闪烁，浓度越高越多 */}
                {!isOffline && (
                  <g clipPath="url(#sensor-dust-laser-cavity-clip)">
                    {[
                      { x: 32, y: 38, d: 0 },
                      { x: 36, y: 44, d: 0.3 },
                      { x: 38, y: 40, d: 0.6 },
                      { x: 44, y: 46, d: 0.4 },
                      { x: 48, y: 38, d: 0.8 },
                      { x: 46, y: 42, d: 1.1 },
                    ].map((p, i) => (
                      <circle key={`particle-${i}`} cx={p.x} cy={p.y} r="0.5" fill="#FFE0B2" opacity="0.85">
                        <animate
                          attributeName="opacity"
                          values="0.85;0.2;0.85"
                          dur="1.5s"
                          begin={`${p.d}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    ))}
                  </g>
                )}

                {/* 实时数值（检测腔下方） */}
                {dustGauge.hasValue ? (
                  <text
                    x="40"
                    y="45"
                    textAnchor="middle"
                    fontSize="3.2"
                    fontWeight="600"
                    fill={
                      isOffline ? 'rgba(255,255,255,0.4)' : coreValue?.overAlarm ? '#FF5252' : 'rgba(255,255,255,0.95)'
                    }
                  >
                    {dustGauge.val.toFixed(1)}
                  </text>
                ) : (
                  <text
                    x="40"
                    y="45"
                    textAnchor="middle"
                    fontSize="3.2"
                    fontWeight="500"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.5)'}
                  >
                    —
                  </text>
                )}
              </g>
            ) : (
              /* 报警型粉尘：8 段 LED 弧形环 + 状态文字 */
              <g>
                {/* 底盘 */}
                <circle
                  cx={GAUGE_CX}
                  cy={GAUGE_CY}
                  r={GAUGE_R + 0.5}
                  fill="#1B0F0A"
                  stroke="#0D0703"
                  strokeWidth="0.4"
                />
                {/* 8 段 LED 弧形分布（180°→360°，每 22.5° 一段） */}
                {Array.from({ length: 8 }).map((_, i) => {
                  const a = 180 + (i + 0.5) * 22.5;
                  const segInner = polar(GAUGE_CX, GAUGE_CY, GAUGE_R - 1.5, a);
                  const segOuter = polar(GAUGE_CX, GAUGE_CY, GAUGE_R + 0.3, a);
                  const segW = 1.6;
                  const ang = (a * Math.PI) / 180;
                  // 矩形端点：垂直于径向方向
                  const dx = (Math.cos(ang + Math.PI / 2) * segW) / 2;
                  const dy = (Math.sin(ang + Math.PI / 2) * segW) / 2;
                  const x1 = segInner.x + dx,
                    y1 = segInner.y + dy;
                  const x2 = segInner.x - dx,
                    y2 = segInner.y - dy;
                  const x3 = segOuter.x - dx,
                    y3 = segOuter.y - dy;
                  const x4 = segOuter.x + dx,
                    y4 = segOuter.y + dy;
                  // 触发的 LED：从中心向外点亮（i 越靠右，触发越久时点亮越多）
                  const lit = triggered && !isOffline;
                  return (
                    <polygon
                      key={`led-${i}`}
                      points={`${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)} ${x3.toFixed(2)},${y3.toFixed(2)} ${x4.toFixed(2)},${y4.toFixed(2)}`}
                      fill={isOffline ? '#5A5A5A' : lit ? '#B71C1C' : '#3E2723'}
                      stroke="#0D0703"
                      strokeWidth="0.15"
                    />
                  );
                })}
                {/* 中心显示触发态文字 */}
                <text
                  x={GAUGE_CX}
                  y="36"
                  textAnchor="middle"
                  fontSize="3"
                  fontWeight="700"
                  fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#F44336' : 'rgba(255,255,255,0.85)'}
                >
                  {isOffline ? '离线' : triggered ? '触发' : '正常'}
                </text>
                {/* 报警型触发时整体脉冲 */}
                {triggered && !isOffline && (
                  <circle
                    cx={GAUGE_CX}
                    cy={GAUGE_CY}
                    r={GAUGE_R + 0.5}
                    fill="none"
                    stroke="#B71C1C"
                    strokeWidth="0.6"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      values={`${GAUGE_R + 0.5};${GAUGE_R + 1.8};${GAUGE_R + 0.5}`}
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            )}
          </>
        ) : sensorType === 'flame' ? (
          /* 火焰型（18031）：深石板灰外壳 + 中心多层火苗（径向渐变 + 发光滤镜 + 摇曳动画）
              未触发：小火苗慢速摇曳（待机监测态）
              触发态：大火苗快速摇曳 + 外圈热辐射波 + 外壳变深焰橙
              离线态：灰色静态火苗 */
          <>
            {/* 外壳：深石板灰/触发=深焰橙，离线=灰 */}
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#BF360C' : '#37474F'}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#3E0A00' : '#1C242A'}
              strokeWidth={2}
            />
            {/* 顶部小型 UV 探测窗口（不喧宾夺主，仅作工业仪器细节） */}
            <circle
              cx="40"
              cy="28"
              r="3"
              fill={isOffline ? '#5A5A5A' : '#1C242A'}
              stroke={isOffline ? '#5A5A5A' : triggered ? '#FF6F00' : '#546E7A'}
              strokeWidth="0.8"
            />
            <circle
              cx="40"
              cy="28"
              r="1"
              fill={isOffline ? '#9E9E9E' : triggered ? '#FFD180' : '#7C4DFF'}
              opacity={isOffline ? 0.4 : 0.8}
            />

            {/* ═══ 中心火焰（核心视觉）：多层火苗叠加 + 发光 + 摇曳 ═══ */}
            {/* 火苗底部中心在 (40, 58)，向上延伸 */}
            <g transform="translate(40, 58)" filter={isOffline ? undefined : `url(#flame-glow-${uid})`}>
              {/* ── 外层大火苗（红橙渐变） ── */}
              <g>
                {isOffline ? (
                  <path
                    d="M 0,0 C -10,-6 -12,-18 -7,-28 C -4,-34 -2,-38 0,-42 C 2,-38 4,-34 7,-28 C 12,-18 10,-6 0,0 Z"
                    fill={`url(#flame-grad-offline-${uid})`}
                    opacity="0.5"
                  />
                ) : (
                  <>
                    <path
                      d="M 0,0 C -10,-6 -12,-18 -7,-28 C -4,-34 -2,-38 0,-42 C 2,-38 4,-34 7,-28 C 12,-18 10,-6 0,0 Z"
                      fill={`url(#flame-grad-outer-${uid})`}
                      transform={triggered ? 'scale(1.15)' : 'scale(1)'}
                    >
                      <animateTransform
                        attributeName="transform"
                        type="scale"
                        values={triggered ? '1.15;1.05;1.2;1.15' : '1;0.92;1.08;1'}
                        dur={triggered ? '0.5s' : '1.1s'}
                        repeatCount="indefinite"
                      />
                    </path>
                  </>
                )}
              </g>

              {/* ── 中层火苗（亮橙渐变） ── */}
              {!isOffline && (
                <g>
                  <path
                    d="M 0,0 C -7,-5 -8,-14 -5,-22 C -3,-27 -1,-30 0,-33 C 1,-30 3,-27 5,-22 C 8,-14 7,-5 0,0 Z"
                    fill={`url(#flame-grad-mid-${uid})`}
                    transform={triggered ? 'scale(1.1)' : 'scale(1)'}
                  >
                    <animateTransform
                      attributeName="transform"
                      type="scale"
                      values={triggered ? '1.1;1.18;0.95;1.1' : '1;1.08;0.93;1'}
                      dur={triggered ? '0.4s' : '0.9s'}
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              )}

              {/* ── 内层火苗（黄白核心） ── */}
              {!isOffline && (
                <g>
                  <path
                    d="M 0,0 C -4,-3 -5,-9 -3,-15 C -2,-19 -1,-21 0,-24 C 1,-21 2,-19 3,-15 C 5,-9 4,-3 0,0 Z"
                    fill={`url(#flame-grad-inner-${uid})`}
                    transform={triggered ? 'scale(1.05)' : 'scale(1)'}
                  >
                    <animateTransform
                      attributeName="transform"
                      type="scale"
                      values={triggered ? '1.05;0.9;1.15;1.05' : '1;1.1;0.9;1'}
                      dur={triggered ? '0.3s' : '0.7s'}
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              )}

              {/* ── 火苗底部基座（深色椭圆，模拟火焰根部） ── */}
              <ellipse
                cx="0"
                cy="0"
                rx="6"
                ry="1.5"
                fill={isOffline ? '#616161' : triggered ? '#3E0A00' : '#1C242A'}
                opacity="0.8"
              />
            </g>

            {/* 触发态：外圈热辐射波（从火焰中心向外扩散） */}
            {triggered && !isOffline && (
              <>
                <circle cx="40" cy="40" r="14" fill="none" stroke="#FF6F00" strokeWidth="0.8" opacity="0.5">
                  <animate attributeName="r" values="14;22;14" dur="0.7s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="0.7s" repeatCount="indefinite" />
                </circle>
                <circle cx="40" cy="40" r="14" fill="none" stroke="#FF3D00" strokeWidth="0.6" opacity="0.35">
                  <animate attributeName="r" values="14;26;14" dur="0.9s" begin="0.2s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.35;0;0.35"
                    dur="0.9s"
                    begin="0.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </>
            )}
          </>
        ) : sensorType === 'alarm_temperature' ? (
          /* 温度报警型（18025）：琥珀橙外壳 + 中心温度计造型（水银柱 + 储液球 + 刻度线）
              未触发：琥珀橙外壳 + 琥珀色水银柱低位缓慢起伏（温度监测态）
              触发态：深红外壳 + 红色水银柱满管快速上升 + 顶部红色脉冲圈
              离线态：灰色静态温度计 */
          <>
            {/* 外壳：琥珀橙/触发=深红，离线=灰 */}
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#C62828' : '#FF8F00'}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#8B0000' : '#E65100'}
              strokeWidth={2}
            />
            {/* 顶部探温头（小圆，模拟温度计顶部感温元件） */}
            <circle
              cx="40"
              cy="28"
              r="3.5"
              fill={isOffline ? '#5A5A5A' : '#E65100'}
              stroke={isOffline ? '#5A5A5A' : triggered ? '#FFCDD2' : '#FFE0B2'}
              strokeWidth="0.8"
            />
            <circle
              cx="40"
              cy="28"
              r="1.2"
              fill={isOffline ? '#9E9E9E' : triggered ? '#FFCDD2' : '#FFB74D'}
              opacity={isOffline ? 0.4 : 0.85}
            />

            {/* ═══ 中心温度计（核心视觉）：管身 + 水银柱 + 储液球 ═══ */}
            {/* 温度计底部球心在 (40, 95)，管身从 y=35 到 y=90 */}

            {/* ── 温度计管身（细长竖管，深色背景） ── */}
            <rect
              x="36"
              y="33"
              width="8"
              height="60"
              rx="4"
              fill={isOffline ? '#5A5A5A' : '#3E2723'}
              stroke={isOffline ? '#5A5A5A' : triggered ? '#FFCDD2' : '#FFE0B2'}
              strokeWidth="0.6"
            />

            {/* ── 管内刻度线（左右各 4 条，模拟温度计刻度） ── */}
            {!isOffline &&
              [40, 50, 60, 70, 80].map((y) => (
                <g key={`temp-scale-${y}`}>
                  <line x1="36" y1={y} x2="38.5" y2={y} stroke="#FFE0B2" strokeWidth="0.4" opacity="0.6" />
                  <line x1="41.5" y1={y} x2="44" y2={y} stroke="#FFE0B2" strokeWidth="0.4" opacity="0.6" />
                </g>
              ))}

            {/* ── 水银柱（核心动态元素） ── */}
            {/* 未触发：琥珀色水银柱，高度约 25px（从 y=90 到 y=65），缓慢起伏
                触发态：红色水银柱，高度约 50px（从 y=90 到 y=40），快速上升
                离线态：灰色静态水银柱，高度 15px */}
            {isOffline ? (
              <rect x="37" y="75" width="6" height="15" rx="3" fill="#9E9E9E" opacity="0.5" />
            ) : triggered ? (
              <rect x="37" y="40" width="6" height="50" rx="3" fill="#FF5252">
                <animate attributeName="height" values="50;48;52;50" dur="0.4s" repeatCount="indefinite" />
                <animate attributeName="y" values="40;42;38;40" dur="0.4s" repeatCount="indefinite" />
              </rect>
            ) : (
              <rect x="37" y="65" width="6" height="25" rx="3" fill="#FFB74D">
                <animate attributeName="height" values="25;23;27;25" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="y" values="65;67;63;65" dur="2.5s" repeatCount="indefinite" />
              </rect>
            )}

            {/* ── 底部储液球（大圆，温度计标志性造型） ── */}
            <circle
              cx="40"
              cy="95"
              r="7"
              fill={isOffline ? '#9E9E9E' : triggered ? '#FF5252' : '#FFB74D'}
              stroke={isOffline ? '#5A5A5A' : '#3E2723'}
              strokeWidth="1"
              opacity={isOffline ? 0.6 : 0.95}
            />
            {/* 储液球高光（模拟玻璃球反光） */}
            {!isOffline && <ellipse cx="37.5" cy="92.5" rx="2" ry="1.5" fill="#FFFFFF" opacity="0.35" />}

            {/* 触发态：顶部红色脉冲圈（温度超限报警） */}
            {triggered && !isOffline && (
              <>
                <circle cx="40" cy="28" r="5" fill="none" stroke="#FF5252" strokeWidth="1" opacity="0.6">
                  <animate attributeName="r" values="5;12;5" dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
                </circle>
                <circle cx="40" cy="28" r="5" fill="none" stroke="#C62828" strokeWidth="0.8" opacity="0.4">
                  <animate attributeName="r" values="5;14;5" dur="1s" begin="0.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="1s" begin="0.2s" repeatCount="indefinite" />
                </circle>
              </>
            )}
          </>
        ) : sensorType === 'co' ? (
          /* CO 数值型（18013）：深青色外壳 + 顶部横向百叶窗进气口 + 气体粒子扩散动画
              电化学传感器被动扩散采样（与粉尘的主动抽气扇叶形成根本性差异）
              在线态：深青外壳 + 百叶窗进气口 + 气体粒子缓慢向下飘入
              离线态：灰色静态 */
          <>
            {/* 外壳：深青色，离线=灰 */}
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : '#004D40'}
              strokeWidth={2}
            />

            {/* ── 顶部横向百叶窗进气口（3 条缝隙，模拟电化学气体扩散膜）──
                与粉尘的"圆形进气网+旋转扇叶"形成根本性差异：
                粉尘 = 主动抽气（圆形风扇），CO = 被动扩散（横向百叶窗） */}
            <g>
              {/* 百叶窗底框（深色凹槽） */}
              <rect x="22" y="24" width="36" height="12" rx="1.5" fill="#00352C" />
              {/* 3 条横向缝隙（百叶窗叶片间隙） */}
              <rect x="24" y="26" width="32" height="1.8" rx="0.4" fill={isOffline ? '#5A5A5A' : '#001A14'} />
              <rect x="24" y="29.5" width="32" height="1.8" rx="0.4" fill={isOffline ? '#5A5A5A' : '#001A14'} />
              <rect x="24" y="33" width="32" height="1.8" rx="0.4" fill={isOffline ? '#5A5A5A' : '#001A14'} />
              {/* 百叶窗叶片高光（金属感） */}
              {!isOffline && (
                <>
                  <line x1="24" y1="26.3" x2="56" y2="26.3" stroke="#4DB6AC" strokeWidth="0.3" opacity="0.4" />
                  <line x1="24" y1="29.8" x2="56" y2="29.8" stroke="#4DB6AC" strokeWidth="0.3" opacity="0.4" />
                  <line x1="24" y1="33.3" x2="56" y2="33.3" stroke="#4DB6AC" strokeWidth="0.3" opacity="0.4" />
                </>
              )}
            </g>

            {/* ── 气体粒子扩散动画（在线时：粒子从百叶窗向下飘入传感器内部）──
                CO 气体通过百叶窗被动扩散进入电化学电极 */}
            {!isOffline && (
              <g clipPath={`url(#sensor-screen-clip-${uid})`} style={{ overflow: 'hidden' }}>
                {/* 粒子 1 */}
                <circle cx="30" cy="42" r="0.6" fill="#80CBC4" opacity="0.7">
                  <animate attributeName="cy" values="38;50;38" dur="3.0s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0;0.7" dur="3.0s" repeatCount="indefinite" />
                </circle>
                {/* 粒子 2 */}
                <circle cx="40" cy="44" r="0.5" fill="#80CBC4" opacity="0.6">
                  <animate attributeName="cy" values="38;50;38" dur="3.0s" begin="1.0s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.6;0;0.6"
                    dur="3.0s"
                    begin="1.0s"
                    repeatCount="indefinite"
                  />
                </circle>
                {/* 粒子 3 */}
                <circle cx="50" cy="43" r="0.55" fill="#80CBC4" opacity="0.65">
                  <animate attributeName="cy" values="38;50;38" dur="3.0s" begin="2.0s" repeatCount="indefinite" />
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

            {/* ── 底部"一氧化碳"标识（与烟雾/红外/触控/温度/火焰/粉尘的中文名格式对齐）── */}
            <text
              x="40"
              y="113"
              textAnchor="middle"
              fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(128,203,196,0.95)'}
              fontSize="7"
              fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
              fontWeight="600"
              letterSpacing="3"
            >
              一氧化碳
            </text>
          </>
        ) : sensorType === 'ch4' ? (
          /* CH4 数值型（18012）：深蓝色外壳 + 顶部圆形烧结金属扩散网 + 中心催化燃烧室
              催化燃烧式气体传感器（与 CO 的电化学百叶窗形成根本性差异）
              在线态：深蓝外壳 + 圆形扩散网 + 催化珠发光脉动 + 热量波纹扩散
              离线态：灰色静态 */
          <>
            {/* 外壳：深蓝色，离线=灰 */}
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : '#0D47A1'}
              strokeWidth={2}
            />

            {/* ── 顶部圆形烧结金属扩散网（与 CO 的横向百叶窗形成根本性差异）──
                催化燃烧式传感器通过烧结金属网被动扩散甲烷气体进入催化室
                粉尘 = 主动抽气（圆形风扇），CO = 被动扩散（横向百叶窗），CH4 = 被动扩散（圆形烧结网） */}
            <g>
              {/* 扩散网外圈（深色凹槽） */}
              <circle cx="40" cy="32" r="8" fill="#0D47A1" />
              {/* 烧结金属网纹理（密排小圆点 pattern） */}
              <pattern id={`ch4-sinter-${uid}`} x="0" y="0" width="2" height="2" patternUnits="userSpaceOnUse">
                <circle cx="0.5" cy="0.5" r="0.35" fill={isOffline ? '#5A5A5A' : '#0A2E6B'} />
                <circle cx="1.5" cy="1.5" r="0.35" fill={isOffline ? '#5A5A5A' : '#0A2E6B'} />
              </pattern>
              <circle cx="40" cy="32" r="7" fill={`url(#ch4-sinter-${uid})`} />
              {/* 扩散网内圈高光（金属质感） */}
              {!isOffline && (
                <circle cx="40" cy="32" r="7" fill="none" stroke="#64B5F6" strokeWidth="0.3" opacity="0.4" />
              )}
            </g>

            {/* ── 中心催化燃烧室（催化珠 + 热量波纹扩散动画）──
                甲烷在催化珠表面燃烧，产生热量使电阻变化
                催化珠发光脉动 = 燃烧反应在进行；热量波纹 = 燃烧产生的热量向外扩散 */}
            {!isOffline && (
              <g clipPath={`url(#sensor-screen-clip-${uid})`} style={{ overflow: 'hidden' }}>
                {/* 催化燃烧室外框 */}
                <circle cx="40" cy="55" r="10" fill="none" stroke="#0D47A1" strokeWidth="0.8" opacity="0.5" />

                {/* 热量波纹（从催化珠向外扩散，3 层交错） */}
                <circle cx="40" cy="55" r="3" fill="none" stroke="#FF6F00" strokeWidth="0.5" opacity="0.6">
                  <animate attributeName="r" values="3;12;3" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="40" cy="55" r="3" fill="none" stroke="#FF8F00" strokeWidth="0.4" opacity="0.5">
                  <animate attributeName="r" values="3;12;3" dur="2.5s" begin="0.8s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.5;0;0.5"
                    dur="2.5s"
                    begin="0.8s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx="40" cy="55" r="3" fill="none" stroke="#FFA726" strokeWidth="0.3" opacity="0.4">
                  <animate attributeName="r" values="3;12;3" dur="2.5s" begin="1.6s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.4;0;0.4"
                    dur="2.5s"
                    begin="1.6s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* 中心催化珠（发光脉动 = 催化燃烧反应在进行） */}
                <circle cx="40" cy="55" r="2" fill="#FF6F00">
                  <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="r" values="2;2.5;2" dur="1.5s" repeatCount="indefinite" />
                </circle>
                {/* 催化珠外晕 */}
                <circle cx="40" cy="55" r="3.5" fill="#FF6F00" opacity="0.3">
                  <animate attributeName="r" values="3.5;5;3.5" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0;0.3" dur="1.5s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </>
        ) : sensorType === 'temperature' ? (
          /* 温度数值型（18014）：深橙色外壳 + 顶部探温探头 + 中心温度计动画
              在线态：深橙外壳 + 探温头 + 水银柱随温度变化起伏 + 热辐射波纹
              离线态：灰色静态温度计 */
          <>
            {/* 外壳：深橙色，离线=灰 */}
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : '#BF360C'}
              strokeWidth={2}
            />

            {/* ── 顶部探温探头（PT100 铂电阻造型，模拟工业温度传感器） ──
                与 CH4 的烧结网、CO 的百叶窗形成根本性差异 */}
            <g>
              {/* 探头外圈（金属底座） */}
              <circle cx="40" cy="32" r="8" fill="#BF360C" />
              {/* 探头中心（感温元件，银色金属质感） */}
              <circle cx="40" cy="32" r="6" fill={isOffline ? '#5A5A5A' : '#FFAB91'} />
              {/* 探头高光（金属反光） */}
              {!isOffline && <circle cx="38" cy="30" r="2" fill="#FFFFFF" opacity="0.3" />}
              {/* 探头中心点（感温点） */}
              <circle cx="40" cy="32" r="1.5" fill={isOffline ? '#3A3A3A' : '#E65100'} />
            </g>

            {/* ── 中心温度计（核心视觉）：管身 + 水银柱 + 刻度线 ──
                水银柱高度随温度变化起伏，热辐射波纹从探头向外扩散 */}
            {!isOffline && (
              <g clipPath={`url(#sensor-screen-clip-${uid})`} style={{ overflow: 'hidden' }}>
                {/* 温度计管身（细长竖管，深色背景） */}
                <rect x="37" y="48" width="6" height="24" rx="3" fill="#3E2723" />

                {/* 管内刻度线（左右各 4 条，模拟温度计刻度） */}
                <line x1="35" y1="52" x2="37" y2="52" stroke="#FFAB91" strokeWidth="0.4" opacity="0.6" />
                <line x1="35" y1="57" x2="37" y2="57" stroke="#FFAB91" strokeWidth="0.4" opacity="0.6" />
                <line x1="35" y1="62" x2="37" y2="62" stroke="#FFAB91" strokeWidth="0.4" opacity="0.6" />
                <line x1="35" y1="67" x2="37" y2="67" stroke="#FFAB91" strokeWidth="0.4" opacity="0.6" />
                <line x1="43" y1="52" x2="45" y2="52" stroke="#FFAB91" strokeWidth="0.4" opacity="0.6" />
                <line x1="43" y1="57" x2="45" y2="57" stroke="#FFAB91" strokeWidth="0.4" opacity="0.6" />
                <line x1="43" y1="62" x2="45" y2="62" stroke="#FFAB91" strokeWidth="0.4" opacity="0.6" />
                <line x1="43" y1="67" x2="45" y2="67" stroke="#FFAB91" strokeWidth="0.4" opacity="0.6" />

                {/* 水银柱（红色，高度起伏 = 温度变化） */}
                <rect x="38" y="58" width="4" height="14" rx="2" fill="#FF5722">
                  <animate attributeName="height" values="14;10;14;16;14" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="y" values="58;62;58;56;58" dur="3s" repeatCount="indefinite" />
                </rect>
                {/* 水银柱顶部高光 */}
                <rect x="38.5" y="58" width="1" height="14" rx="0.5" fill="#FFAB91" opacity="0.5">
                  <animate attributeName="height" values="14;10;14;16;14" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="y" values="58;62;58;56;58" dur="3s" repeatCount="indefinite" />
                </rect>

                {/* 底部储液球（温度计标志性造型） */}
                <circle cx="40" cy="72" r="3" fill="#FF5722" />
                <circle cx="40" cy="72" r="3" fill="none" stroke="#FFAB91" strokeWidth="0.3" opacity="0.5" />

                {/* 热辐射波纹（从探头向外扩散，2 层交错） */}
                <circle cx="40" cy="55" r="8" fill="none" stroke="#FF8F00" strokeWidth="0.4" opacity="0.4">
                  <animate attributeName="r" values="8;14;8" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="40" cy="55" r="8" fill="none" stroke="#FFA726" strokeWidth="0.3" opacity="0.3">
                  <animate attributeName="r" values="8;14;8" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.3;0;0.3"
                    dur="2.5s"
                    begin="1.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            )}
          </>
        ) : sensorType === 'alarm_co' ? (
          /* CO 报警型（18030）：深玫红外壳 + 中心"CO"字母 + 同心圆气体扩散波纹
              未触发：深玫红外壳 + 白色"CO" + 慢速气体扩散波纹（监测态）
              触发态：深红外壳 + 红色"CO"闪烁 + 快速气体扩散波纹 + 顶部脉冲圈
              离线态：灰色静态"CO" */
          <>
            {/* 外壳：深玫红/触发=深红，离线=灰 */}
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#C62828' : '#AD1457'}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#8B0000' : '#880E4F'}
              strokeWidth={2}
            />
            {/* 顶部通气孔（工业仪器细节，3 个小圆孔） */}
            <circle cx="32" cy="28" r="1.5" fill={isOffline ? '#5A5A5A' : '#3E0A14'} opacity="0.7" />
            <circle cx="40" cy="28" r="1.5" fill={isOffline ? '#5A5A5A' : '#3E0A14'} opacity="0.7" />
            <circle cx="48" cy="28" r="1.5" fill={isOffline ? '#5A5A5A' : '#3E0A14'} opacity="0.7" />

            {/* ═══ 中心"CO"字母 + 气体扩散波纹（核心视觉） ═══ */}
            {/* 气体扩散波纹：3 层同心圆从中心向外扩散（CO 无色无味，用波纹表达"隐形扩散"） */}
            {!isOffline && (
              <g>
                {/* 波纹 1（最内层） */}
                <circle
                  cx="40"
                  cy="62"
                  r="8"
                  fill="none"
                  stroke={triggered ? '#FF5252' : '#F8BBD0'}
                  strokeWidth="0.8"
                  opacity="0.6"
                >
                  <animate
                    attributeName="r"
                    values="8;20;8"
                    dur={triggered ? '1.0s' : '2.5s'}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0;0.6"
                    dur={triggered ? '1.0s' : '2.5s'}
                    repeatCount="indefinite"
                  />
                </circle>
                {/* 波纹 2（中层） */}
                <circle
                  cx="40"
                  cy="62"
                  r="8"
                  fill="none"
                  stroke={triggered ? '#FF5252' : '#F8BBD0'}
                  strokeWidth="0.6"
                  opacity="0.5"
                >
                  <animate
                    attributeName="r"
                    values="8;20;8"
                    dur={triggered ? '1.0s' : '2.5s'}
                    begin="0.3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.5;0;0.5"
                    dur={triggered ? '1.0s' : '2.5s'}
                    begin="0.3s"
                    repeatCount="indefinite"
                  />
                </circle>
                {/* 波纹 3（最外层） */}
                <circle
                  cx="40"
                  cy="62"
                  r="8"
                  fill="none"
                  stroke={triggered ? '#FF5252' : '#F8BBD0'}
                  strokeWidth="0.5"
                  opacity="0.4"
                >
                  <animate
                    attributeName="r"
                    values="8;20;8"
                    dur={triggered ? '1.0s' : '2.5s'}
                    begin="0.6s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.4;0;0.4"
                    dur={triggered ? '1.0s' : '2.5s'}
                    begin="0.6s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            )}

            {/* 中心"CO"字母（核心标识） */}
            <text
              x="40"
              y="66"
              textAnchor="middle"
              fill={isOffline ? '#5A5A5A' : triggered ? '#FFCDD2' : '#FFFFFF'}
              fontSize="14"
              fontFamily="'Arial', sans-serif"
              fontWeight="800"
              letterSpacing="0.5"
            >
              CO
            </text>
            {/* "CO"字母下方小标识：分子式说明 */}
            {!isOffline && (
              <text
                x="40"
                y="74"
                textAnchor="middle"
                fill={triggered ? 'rgba(255,205,210,0.7)' : 'rgba(248,187,208,0.7)'}
                fontSize="3.5"
                fontFamily="sans-serif"
                fontWeight="600"
              >
                一氧化碳
              </text>
            )}

            {/* 触发态：顶部红色脉冲圈（CO 超限报警） */}
            {triggered && !isOffline && (
              <>
                <circle cx="40" cy="28" r="5" fill="none" stroke="#FF5252" strokeWidth="1" opacity="0.6">
                  <animate attributeName="r" values="5;12;5" dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
                </circle>
                <circle cx="40" cy="28" r="5" fill="none" stroke="#C62828" strokeWidth="0.8" opacity="0.4">
                  <animate attributeName="r" values="5;14;5" dur="1s" begin="0.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="1s" begin="0.2s" repeatCount="indefinite" />
                </circle>
              </>
            )}
          </>
        ) : sensorType === 'top_coal' ? (
          /* 放顶煤（18023）：煤灰黑外壳 + 顶部漏斗形放煤口 + 中心煤块下落动画
              未触发：煤灰黑外壳 + 静态煤块 + 慢速呼吸光
              触发态：深橙外壳 + 煤块活跃下落 + 顶部脉冲圈
              离线态：灰色静态 */
          <>
            {/* 外壳：煤灰黑/触发=深橙，离线=灰 */}
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#FF6F00' : '#424242'}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#E65100' : '#212121'}
              strokeWidth={2}
            />

            {/* ── 顶部漏斗形放煤口（液压支架放煤口造型） ── */}
            <g>
              {/* 漏斗外框（梯形） */}
              <path
                d="M 28,8 L 52,8 L 48,28 L 32,28 Z"
                fill={isOffline ? '#616161' : triggered ? '#E65100' : '#212121'}
                stroke={isOffline ? '#757575' : triggered ? '#FFAB40' : '#424242'}
                strokeWidth="0.8"
              />
              {/* 漏斗内部（暗腔） */}
              <path d="M 30,10 L 50,10 L 47,26 L 33,26 Z" fill={isOffline ? '#424242' : '#0A0A0A'} />
              {/* 漏斗中心线（放煤口铰链） */}
              <line
                x1="40"
                y1="10"
                x2="40"
                y2="26"
                stroke={isOffline ? '#757575' : '#FF8F00'}
                strokeWidth="0.3"
                opacity="0.5"
              />
            </g>

            {/* ── 中心煤块下落动画 ── */}
            {!isOffline && (
              <g clipPath={`url(#sensor-screen-clip-${uid})`} style={{ overflow: 'hidden' }}>
                {/* 背景暗色（煤壁） */}
                <rect x="19" y="46" width="42" height="28" fill="#1A1A1A" />

                {/* 煤块颗粒（下落动画） */}
                {triggered ? (
                  <>
                    {/* 触发态：多块煤活跃下落 */}
                    <rect x="34" y="48" width="2.5" height="2.5" rx="0.5" fill="#424242">
                      <animate attributeName="y" values="48;70;48" dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
                    </rect>
                    <rect x="38" y="50" width="2" height="2" rx="0.5" fill="#616161">
                      <animate attributeName="y" values="50;72;50" dur="1s" begin="0.2s" repeatCount="indefinite" />
                      <animate
                        attributeName="opacity"
                        values="1;0.3;1"
                        dur="1s"
                        begin="0.2s"
                        repeatCount="indefinite"
                      />
                    </rect>
                    <rect x="42" y="47" width="2.5" height="2.5" rx="0.5" fill="#424242">
                      <animate attributeName="y" values="47;71;47" dur="1.4s" begin="0.4s" repeatCount="indefinite" />
                      <animate
                        attributeName="opacity"
                        values="1;0.3;1"
                        dur="1.4s"
                        begin="0.4s"
                        repeatCount="indefinite"
                      />
                    </rect>
                    <rect x="36" y="52" width="1.8" height="1.8" rx="0.4" fill="#757575">
                      <animate attributeName="y" values="52;72;52" dur="0.9s" begin="0.1s" repeatCount="indefinite" />
                      <animate
                        attributeName="opacity"
                        values="1;0.3;1"
                        dur="0.9s"
                        begin="0.1s"
                        repeatCount="indefinite"
                      />
                    </rect>
                    <rect x="44" y="51" width="2" height="2" rx="0.5" fill="#616161">
                      <animate attributeName="y" values="51;72;51" dur="1.1s" begin="0.5s" repeatCount="indefinite" />
                      <animate
                        attributeName="opacity"
                        values="1;0.3;1"
                        dur="1.1s"
                        begin="0.5s"
                        repeatCount="indefinite"
                      />
                    </rect>
                    {/* 橙色高光（煤流活跃） */}
                    <rect x="37" y="55" width="1.5" height="1.5" rx="0.3" fill="#FF8F00" opacity="0.6">
                      <animate attributeName="y" values="55;70;55" dur="1.3s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0;0.6" dur="1.3s" repeatCount="indefinite" />
                    </rect>
                  </>
                ) : (
                  <>
                    {/* 未触发：静态煤块 + 慢速呼吸 */}
                    <rect x="35" y="58" width="2" height="2" rx="0.5" fill="#424242" opacity="0.6" />
                    <rect x="40" y="62" width="2.5" height="2.5" rx="0.5" fill="#616161" opacity="0.5" />
                    <rect x="44" y="56" width="1.8" height="1.8" rx="0.4" fill="#424242" opacity="0.4" />
                    {/* 慢速呼吸光 */}
                    <circle cx="40" cy="60" r="6" fill="none" stroke="#FF8F00" strokeWidth="0.3" opacity="0.2">
                      <animate attributeName="opacity" values="0.2;0.05;0.2" dur="3s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
              </g>
            )}

            {/* 触发态：顶部脉冲圈 */}
            {triggered && !isOffline && (
              <g>
                <circle cx="40" cy="28" r="5" fill="none" stroke="#FF8F00" strokeWidth="1" opacity="0.6">
                  <animate attributeName="r" values="5;12;5" dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
                </circle>
                <circle cx="40" cy="28" r="5" fill="none" stroke="#FF6F00" strokeWidth="0.8" opacity="0.4">
                  <animate attributeName="r" values="5;14;5" dur="1s" begin="0.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="1s" begin="0.2s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </>
        ) : sensorType === 'wind' ? (
          /* 风速（18010）：浅蓝外壳 + 顶部风杯风速计 + 旋转动画
              离线态：灰色静态 */
          <>
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : '#01579B'}
              strokeWidth={2}
            />
            {/* 顶部风杯支架 */}
            <line x1="40" y1="20" x2="40" y2="32" stroke={isOffline ? '#BDBDBD' : '#4FC3F7'} strokeWidth="1.5" />
            {/* 风杯（3个圆杯旋转） */}
            {!isOffline && (
              <g transform="translate(40, 30)">
                <g>
                  <circle cx="0" cy="-4" r="3" fill="#4FC3F7" stroke="#0288D1" strokeWidth="0.5" />
                  <circle cx="3.5" cy="2" r="3" fill="#4FC3F7" stroke="#0288D1" strokeWidth="0.5" />
                  <circle cx="-3.5" cy="2" r="3" fill="#4FC3F7" stroke="#0288D1" strokeWidth="0.5" />
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
            {!isOffline && (
              <g opacity="0.5">
                <path d="M 18,50 Q 22,48 26,50" fill="none" stroke="#81D4FA" strokeWidth="0.6">
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" repeatCount="indefinite" />
                </path>
                <path d="M 54,54 Q 58,52 62,54" fill="none" stroke="#81D4FA" strokeWidth="0.6">
                  <animate attributeName="opacity" values="0;0.5;0" dur="1.2s" repeatCount="indefinite" />
                </path>
                <path d="M 18,60 Q 22,58 26,60" fill="none" stroke="#81D4FA" strokeWidth="0.6">
                  <animate
                    attributeName="opacity"
                    values="0.5;0;0.5"
                    dur="1.2s"
                    begin="0.4s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            )}
          </>
        ) : sensorType === 'windPress' ? (
          /* 风压（18011）：青蓝外壳 + U型管压力计 + 液柱波动
              离线态：灰色静态 */
          <>
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : '#006064'}
              strokeWidth={2}
            />
            {/* 顶部压力表 */}
            <circle
              cx="40"
              cy="30"
              r="8"
              fill={isOffline ? '#616161' : '#006064'}
              stroke={isOffline ? '#9E9E9E' : '#26C6DA'}
              strokeWidth="1"
            />
            {!isOffline && (
              <>
                <line x1="40" y1="30" x2="44" y2="26" stroke="#FF6F00" strokeWidth="1" />
                <circle cx="40" cy="30" r="1" fill="#26C6DA" />
              </>
            )}
            {/* U型管 */}
            <path
              d="M 28,44 L 28,68 Q 28,74 34,74 L 46,74 Q 52,74 52,68 L 52,44"
              fill="none"
              stroke={isOffline ? '#BDBDBD' : '#26C6DA'}
              strokeWidth="1.5"
            />
            {/* 左液柱 */}
            {!isOffline && (
              <rect x="27" y="56" width="2" height="18" fill="#26C6DA">
                <animate attributeName="height" values="18;12;18" dur="2s" repeatCount="indefinite" />
                <animate attributeName="y" values="56;62;56" dur="2s" repeatCount="indefinite" />
              </rect>
            )}
            {/* 右液柱 */}
            {!isOffline && (
              <rect x="51" y="50" width="2" height="24" fill="#26C6DA">
                <animate attributeName="height" values="24;30;24" dur="2s" repeatCount="indefinite" />
                <animate attributeName="y" values="50;44;50" dur="2s" repeatCount="indefinite" />
              </rect>
            )}
            {/* 刻度线 */}
            <g stroke={isOffline ? '#BDBDBD' : '#80DEEA'} strokeWidth="0.4" opacity="0.6">
              <line x1="24" y1="50" x2="27" y2="50" />
              <line x1="24" y1="56" x2="27" y2="56" />
              <line x1="24" y1="62" x2="27" y2="62" />
              <line x1="24" y1="68" x2="27" y2="68" />
              <line x1="53" y1="50" x2="56" y2="50" />
              <line x1="53" y1="56" x2="56" y2="56" />
              <line x1="53" y1="62" x2="56" y2="62" />
              <line x1="53" y1="68" x2="56" y2="68" />
            </g>
          </>
        ) : sensorType === 'coalCutter' ? (
          /* 割煤机位置（18020）：工业黄外壳 + 截割齿轮 + 旋转动画
              未触发：工业黄 + 静态齿轮
              触发态：深琥珀 + 齿轮旋转 + 截割火花
              离线态：灰色静态 */
          <>
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#F57F17' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#E65100' : '#F57F17'}
              strokeWidth={2}
            />
            {/* 顶部截割臂 */}
            <rect x="36" y="8" width="8" height="16" fill={isOffline ? '#616161' : triggered ? '#E65100' : '#F9A825'} />
            {/* 截割齿轮 */}
            <g transform="translate(40, 38)">
              <circle
                cx="0"
                cy="0"
                r="10"
                fill={isOffline ? '#616161' : triggered ? '#BF360C' : '#F57F17'}
                stroke={isOffline ? '#9E9E9E' : '#E65100'}
                strokeWidth="1"
              />
              {/* 齿轮齿 */}
              {!isOffline && (
                <g>
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                    const rad = (deg * Math.PI) / 180;
                    const x1 = Math.cos(rad) * 10;
                    const y1 = Math.sin(rad) * 10;
                    const x2 = Math.cos(rad) * 13;
                    const y2 = Math.sin(rad) * 13;
                    return (
                      <line
                        key={deg}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={triggered ? '#E65100' : '#F57F17'}
                        strokeWidth="2"
                      />
                    );
                  })}
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0"
                    to="360"
                    dur={triggered ? '0.8s' : '2s'}
                    repeatCount="indefinite"
                  />
                </g>
              )}
              <circle cx="0" cy="0" r="3" fill={isOffline ? '#424242' : '#3E2723'} />
            </g>
            {/* 截割火花（触发态） */}
            {triggered && !isOffline && (
              <g>
                <circle cx="30" cy="50" r="0.8" fill="#FFD54F">
                  <animate attributeName="cy" values="50;58;50" dur="0.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="0.6s" repeatCount="indefinite" />
                </circle>
                <circle cx="50" cy="52" r="0.8" fill="#FFD54F">
                  <animate attributeName="cy" values="52;60;52" dur="0.6s" begin="0.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="0.6s" begin="0.2s" repeatCount="indefinite" />
                </circle>
                <circle cx="35" cy="55" r="0.6" fill="#FF8F00">
                  <animate attributeName="cy" values="55;62;55" dur="0.6s" begin="0.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="0.6s" begin="0.4s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </>
        ) : sensorType === 'frameMove' ? (
          /* 移架（18021）：工业绿外壳 + 液压支架 + 推移箭头
              未触发：工业绿 + 静态支架
              触发态：深绿 + 推移箭头动画
              离线态：灰色静态 */
          <>
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#1B5E20' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#0B3D0B' : '#2E7D32'}
              strokeWidth={2}
            />
            {/* 顶部液压缸 */}
            <rect
              x="34"
              y="8"
              width="12"
              height="16"
              fill={isOffline ? '#616161' : triggered ? '#0B3D0B' : '#1B5E20'}
              stroke={isOffline ? '#9E9E9E' : '#2E7D32'}
              strokeWidth="0.5"
            />
            {!isOffline && (
              <rect x="38" y="14" width="4" height="10" fill={triggered ? '#2E7D32' : '#4CAF50'}>
                {triggered && <animate attributeName="y" values="14;10;14" dur="1.5s" repeatCount="indefinite" />}
              </rect>
            )}
            {/* 支架顶梁 */}
            <rect
              x="22"
              y="32"
              width="36"
              height="6"
              fill={isOffline ? '#616161' : triggered ? '#0B3D0B' : '#1B5E20'}
              stroke={isOffline ? '#9E9E9E' : '#2E7D32'}
              strokeWidth="0.5"
            />
            {/* 支架立柱（4根） */}
            <rect
              x="24"
              y="38"
              width="3"
              height="32"
              fill={isOffline ? '#616161' : triggered ? '#0B3D0B' : '#2E7D32'}
            />
            <rect
              x="35"
              y="38"
              width="3"
              height="32"
              fill={isOffline ? '#616161' : triggered ? '#0B3D0B' : '#2E7D32'}
            />
            <rect
              x="42"
              y="38"
              width="3"
              height="32"
              fill={isOffline ? '#616161' : triggered ? '#0B3D0B' : '#2E7D32'}
            />
            <rect
              x="53"
              y="38"
              width="3"
              height="32"
              fill={isOffline ? '#616161' : triggered ? '#0B3D0B' : '#2E7D32'}
            />
            {/* 底座 */}
            <rect
              x="22"
              y="70"
              width="36"
              height="6"
              fill={isOffline ? '#616161' : triggered ? '#0B3D0B' : '#1B5E20'}
              stroke={isOffline ? '#9E9E9E' : '#2E7D32'}
              strokeWidth="0.5"
            />
            {/* 推移箭头（触发态） */}
            {triggered && !isOffline && (
              <g>
                <path d="M 40,84 L 36,80 L 36,82 L 30,82 L 30,86 L 36,86 L 36,88 Z" fill="#FFEB3B">
                  <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 40,84 L 44,80 L 44,82 L 50,82 L 50,86 L 44,86 L 44,88 Z" fill="#FFEB3B">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
                </path>
              </g>
            )}
          </>
        ) : sensorType === 'frameDrop' ? (
          /* 落架（18022）：棕色外壳 + 支架 + 下降箭头
              未触发：棕色 + 静态支架
              触发态：深棕 + 下降箭头动画
              离线态：灰色静态 */
          <>
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#3E2723' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#1B0E0A' : '#5D4037'}
              strokeWidth={2}
            />
            {/* 顶部液压缸 */}
            <rect
              x="34"
              y="8"
              width="12"
              height="16"
              fill={isOffline ? '#616161' : triggered ? '#1B0E0A' : '#3E2723'}
              stroke={isOffline ? '#9E9E9E' : '#5D4037'}
              strokeWidth="0.5"
            />
            {!isOffline && (
              <rect x="38" y="14" width="4" height="10" fill={triggered ? '#5D4037' : '#8D6E63'}>
                {triggered && <animate attributeName="y" values="14;18;14" dur="1.5s" repeatCount="indefinite" />}
              </rect>
            )}
            {/* 支架顶梁 */}
            <rect
              x="22"
              y="32"
              width="36"
              height="6"
              fill={isOffline ? '#616161' : triggered ? '#1B0E0A' : '#3E2723'}
              stroke={isOffline ? '#9E9E9E' : '#5D4037'}
              strokeWidth="0.5"
            />
            {/* 支架立柱（4根） */}
            <rect
              x="24"
              y="38"
              width="3"
              height="32"
              fill={isOffline ? '#616161' : triggered ? '#1B0E0A' : '#3E2723'}
            />
            <rect
              x="35"
              y="38"
              width="3"
              height="32"
              fill={isOffline ? '#616161' : triggered ? '#1B0E0A' : '#3E2723'}
            />
            <rect
              x="42"
              y="38"
              width="3"
              height="32"
              fill={isOffline ? '#616161' : triggered ? '#1B0E0A' : '#3E2723'}
            />
            <rect
              x="53"
              y="38"
              width="3"
              height="32"
              fill={isOffline ? '#616161' : triggered ? '#1B0E0A' : '#3E2723'}
            />
            {/* 底座 */}
            <rect
              x="22"
              y="70"
              width="36"
              height="6"
              fill={isOffline ? '#616161' : triggered ? '#1B0E0A' : '#3E2723'}
              stroke={isOffline ? '#9E9E9E' : '#5D4037'}
              strokeWidth="0.5"
            />
            {/* 下降箭头（触发态） */}
            {triggered && !isOffline && (
              <g>
                <path d="M 40,84 L 36,88 L 38,88 L 38,92 L 42,92 L 42,88 L 44,88 Z" fill="#FF7043">
                  <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,0;0,3;0,0"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            )}
          </>
        ) : sensorType === 'vibration' ? (
          /* 振动（18028）：紫色外壳 + 振动波形 + 正弦动画
              未触发：紫色 + 静态波形
              触发态：深紫 + 波形振动 + 脉冲
              离线态：灰色静态 */
          <>
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#6A1B9A' : effectiveBodyColor}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#4A148C' : '#4527A0'}
              strokeWidth={2}
            />
            {/* 顶部传感器探头 */}
            <circle
              cx="40"
              cy="28"
              r="6"
              fill={isOffline ? '#616161' : triggered ? '#4A148C' : '#4527A0'}
              stroke={isOffline ? '#9E9E9E' : '#7E57C2'}
              strokeWidth="1"
            />
            {!isOffline && (
              <circle cx="40" cy="28" r="2" fill={triggered ? '#FFEB3B' : '#7E57C2'}>
                {triggered && <animate attributeName="r" values="2;3;2" dur="0.5s" repeatCount="indefinite" />}
              </circle>
            )}
            {/* 振动波形 */}
            {!isOffline ? (
              <g>
                <path
                  d="M 18,55 Q 24,48 30,55 T 42,55 T 54,55 T 62,55"
                  fill="none"
                  stroke={triggered ? '#FFEB3B' : '#B39DDB'}
                  strokeWidth="1.2"
                >
                  {triggered && (
                    <animate
                      attributeName="d"
                      values="M 18,55 Q 24,48 30,55 T 42,55 T 54,55 T 62,55;
                              M 18,55 Q 24,62 30,55 T 42,55 T 54,55 T 62,55;
                              M 18,55 Q 24,48 30,55 T 42,55 T 54,55 T 62,55"
                      dur="0.4s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>
                <path
                  d="M 18,62 Q 24,56 30,62 T 42,62 T 54,62 T 62,62"
                  fill="none"
                  stroke={triggered ? '#FF80AB' : '#9575CD'}
                  strokeWidth="0.8"
                  opacity="0.7"
                >
                  {triggered && (
                    <animate
                      attributeName="d"
                      values="M 18,62 Q 24,56 30,62 T 42,62 T 54,62 T 62,62;
                              M 18,62 Q 24,68 30,62 T 42,62 T 54,62 T 62,62;
                              M 18,62 Q 24,56 30,62 T 42,62 T 54,62 T 62,62"
                      dur="0.4s"
                      begin="0.1s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>
              </g>
            ) : null}
            {/* 振动指示器（触发态） */}
            {triggered && !isOffline && (
              <g>
                <circle cx="20" cy="40" r="1" fill="#FFEB3B">
                  <animate attributeName="opacity" values="1;0;1" dur="0.3s" repeatCount="indefinite" />
                </circle>
                <circle cx="60" cy="40" r="1" fill="#FFEB3B">
                  <animate attributeName="opacity" values="0;1;0" dur="0.3s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </>
        ) : sensorType === 'cleanWall' ? (
          /* 清洗煤壁传感器（18035）：青绿外壳 + 顶部喷头 + 水流喷射动画 + 右侧煤壁纹理
              未触发：青绿 #00897B + 静态喷头
              触发态：深青绿 #00695C + 水流喷射动画
              离线态：灰色静态
              协议来源：spraySensorTypeRules sensorType=15，0x0614 喷雾参数设置 */
          <>
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : triggered ? '#00695C' : '#00897B'}
              stroke={isOffline ? '#9E9E9E' : triggered ? '#004D40' : '#00695C'}
              strokeWidth={2}
            />
            {/* 顶部喷头底座（矩形） */}
            <rect
              x="30"
              y="8"
              width="20"
              height="14"
              rx="2"
              fill={isOffline ? '#616161' : triggered ? '#004D40' : '#00695C'}
              stroke={isOffline ? '#9E9E9E' : '#004D40'}
              strokeWidth="0.8"
            />
            {/* 喷头出水口（圆形） */}
            <circle
              cx="40"
              cy="22"
              r="3"
              fill={isOffline ? '#424242' : '#004D40'}
              stroke={isOffline ? '#9E9E9E' : '#00695C'}
              strokeWidth="0.5"
            />
            {/* 喷头中心孔 */}
            <circle cx="40" cy="22" r="1.2" fill={isOffline ? '#616161' : triggered ? '#4DB6AC' : '#00897B'} />

            {/* 水流喷射动画（触发态） */}
            {triggered && !isOffline ? (
              <g>
                {/* 主水柱 */}
                <path
                  d="M 40,25 Q 38,35 40,45 Q 42,55 40,65"
                  fill="none"
                  stroke="#4DB6AC"
                  strokeWidth="1.5"
                  opacity="0.8"
                >
                  <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.4s" repeatCount="indefinite" />
                </path>
                {/* 水滴飞溅 */}
                <circle cx="36" cy="35" r="0.8" fill="#80CBC4">
                  <animate attributeName="cy" values="28;42;28" dur="0.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0;0.9" dur="0.5s" repeatCount="indefinite" />
                </circle>
                <circle cx="44" cy="40" r="0.7" fill="#80CBC4">
                  <animate attributeName="cy" values="30;48;30" dur="0.6s" begin="0.1s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.8;0;0.8"
                    dur="0.6s"
                    begin="0.1s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx="38" cy="50" r="0.6" fill="#4DB6AC">
                  <animate attributeName="cy" values="32;58;32" dur="0.7s" begin="0.2s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    values="0.7;0;0.7"
                    dur="0.7s"
                    begin="0.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ) : null}

            {/* 右侧煤壁纹理（竖纹） */}
            <g opacity={isOffline ? 0.2 : 0.4}>
              <rect x="58" y="30" width="3" height="70" rx="0.5" fill="#1A1A1A" />
              <rect x="61" y="34" width="2" height="62" rx="0.3" fill="#2D2D2D" />
              <rect x="63" y="38" width="2" height="54" rx="0.3" fill="#1A1A1A" />
            </g>

            {/* 待机态：喷头呼吸光晕（青绿脉冲） */}
            {!isOffline && !triggered && (
              <circle cx="40" cy="22" r="3" fill="none" stroke="#4DB6AC" strokeWidth="0.8" opacity="0.4">
                <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* 触发态：喷头强脉冲 */}
            {triggered && !isOffline && (
              <circle cx="40" cy="22" r="3" fill="none" stroke="#4DB6AC" strokeWidth="1.2" opacity="0.6">
                <animate attributeName="r" values="3;6;3" dur="0.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
              </circle>
            )}
          </>
        ) : sensorType === 'flowMeter' ? (
          /* 流量计（18040）：深蓝外壳 + 顶部水流转子 + 中央流量数字显示
              独立设备类型（otherDeviceTypeRules，非传感器），复用 SensorFrame 框架仅作卡片渲染
              协议来源：命令码 0x0626，字段 instantFlow/totalFlow
              颜色：深蓝 #1565C0（与 PinFrame 水滴主体一致） */
          <>
            <rect
              x="10"
              y="20"
              width="60"
              height="90"
              rx="8"
              fill={isOffline ? '#9E9E9E' : '#1565C0'}
              stroke={isOffline ? '#9E9E9E' : '#0D47A1'}
              strokeWidth={2}
            />
            {/* 顶部水流转子外壳（圆形） */}
            <circle
              cx="40"
              cy="22"
              r="6"
              fill={isOffline ? '#616161' : '#0D47A1'}
              stroke={isOffline ? '#9E9E9E' : '#1976D2'}
              strokeWidth="1"
            />
            {/* 水流转子（旋转动画） */}
            {!isOffline ? (
              <g transform-origin="40 22">
                <path d="M 40,17 L 41,22 L 40,27 L 39,22 Z" fill="#42A5F5" opacity="0.9" />
                <path d="M 35,22 L 40,21 L 45,22 L 40,23 Z" fill="#42A5F5" opacity="0.9" />
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 40 22"
                  to="360 40 22"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </g>
            ) : null}
            {/* 转子中心轴 */}
            <circle cx="40" cy="22" r="1.2" fill={isOffline ? '#424242' : '#0D47A1'} />

            {/* 中央流量数字显示区 */}
            <rect
              x="18"
              y="40"
              width="44"
              height="30"
              rx="3"
              fill={isOffline ? '#424242' : '#0D47A1'}
              stroke="#333"
              strokeWidth={1}
              opacity="0.6"
            />

            {/* 流量刻度线 */}
            {!isOffline && (
              <g opacity="0.4">
                <line x1="22" y1="75" x2="58" y2="75" stroke="#42A5F5" strokeWidth="0.5" />
                <line x1="22" y1="78" x2="22" y2="82" stroke="#42A5F5" strokeWidth="0.5" />
                <line x1="32" y1="78" x2="32" y2="82" stroke="#42A5F5" strokeWidth="0.5" />
                <line x1="40" y1="78" x2="40" y2="82" stroke="#42A5F5" strokeWidth="0.5" />
                <line x1="48" y1="78" x2="48" y2="82" stroke="#42A5F5" strokeWidth="0.5" />
                <line x1="58" y1="78" x2="58" y2="82" stroke="#42A5F5" strokeWidth="0.5" />
              </g>
            )}

            {/* 在线态：转子外圈呼吸光晕（蓝色脉冲） */}
            {!isOffline && (
              <circle cx="40" cy="22" r="6" fill="none" stroke="#42A5F5" strokeWidth="0.8" opacity="0.4">
                <animate attributeName="r" values="6;9;6" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
          </>
        ) : sensorType === 'collector_wireless' || sensorType === 'collector_wired' ? (
          /* 信号采集器（18002 无线 / 18003 有线）：工业信号采集器标准外观
              协议：subController 类型，wirelessAddressRules 区分无线(bit1010)/有线(bit1110)
              视觉设计：机箱主体 + 顶部信号区（无线=天线/有线=接口）+ 中间屏幕 + 底部端子排
              颜色：无线=深海蓝 #1A3A5C，有线=深石墨灰 #2E3B4E */
          <>
            <defs>
              <linearGradient id={`col-body-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isOffline ? '#616161' : sensorType === 'collector_wireless' ? '#1A3A5C' : '#2E3B4E'} />
                <stop offset="100%" stopColor={isOffline ? '#424242' : sensorType === 'collector_wireless' ? '#0F2440' : '#1A2332'} />
              </linearGradient>
              <linearGradient id={`col-panel-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isOffline ? '#616161' : '#37474F'} />
                <stop offset="100%" stopColor={isOffline ? '#424242' : '#263238'} />
              </linearGradient>
              <linearGradient id={`col-screen-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isOffline ? '#424242' : '#0D1B2A'} />
                <stop offset="100%" stopColor={isOffline ? '#616161' : '#1B2838'} />
              </linearGradient>
            </defs>

            {/* ═══════ 卡片背景 ═══════ */}
            <rect x="4" y="4" width="72" height="112" rx="4" fill={`url(#col-body-${uid})`} stroke={isOffline ? '#616161' : '#0D1B2A'} strokeWidth="1" />

            {/* ═══════ 顶部信号区 ═══════ */}
            {sensorType === 'collector_wireless' ? (
              /* 无线：顶部天线 + 信号波纹 */
              <g>
                {/* 天线底座 */}
                <rect x="32" y="8" width="16" height="5" rx="1" fill={isOffline ? '#616161' : '#37474F'} />
                {/* 天线杆 */}
                <line x1="40" y1="8" x2="40" y2="2" stroke={isOffline ? '#9E9E9E' : '#90A4AE'} strokeWidth="1" strokeLinecap="round" />
                {/* 天线顶部小球 */}
                <circle cx="40" cy="2" r="1.2" fill={isOffline ? '#616161' : '#4FD1C5'} />
                {/* 信号波纹（在线时动画） */}
                {!isOffline && [0, 1, 2].map(i => (
                  <path key={`sig-${i}`} d={`M ${34 + i * 3} 6 Q ${40} ${4 - i * 1.5} ${46 - i * 3} 6`} fill="none" stroke="#4FD1C5" strokeWidth="0.5" opacity={0.8 - i * 0.25}>
                    <animate attributeName="opacity" values={`${0.8 - i * 0.25};${0.2 - i * 0.05};${0.8 - i * 0.25}`} dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                  </path>
                ))}
                {isOffline && [0, 1, 2].map(i => (
                  <path key={`sig-off-${i}`} d={`M ${34 + i * 3} 6 Q ${40} ${4 - i * 1.5} ${46 - i * 3} 6`} fill="none" stroke="#616161" strokeWidth="0.5" opacity={0.3 - i * 0.08} />
                ))}
              </g>
            ) : (
              /* 有线：顶部线缆接口 */
              <g>
                {/* 接口面板条 */}
                <rect x="20" y="6" width="40" height="8" rx="1" fill={isOffline ? '#616161' : '#37474F'} stroke={isOffline ? '#424242' : '#1A2332'} strokeWidth="0.5" />
                {/* 4 个接线端子（圆形接口） */}
                {[0, 1, 2, 3].map(i => (
                  <g key={`term-${i}`}>
                    <circle cx={26 + i * 8} cy="10" r="2" fill={isOffline ? '#424242' : '#1A2332'} stroke={isOffline ? '#616161' : '#546E7A'} strokeWidth="0.5" />
                    <circle cx={26 + i * 8} cy="10" r="0.8" fill={isOffline ? '#616161' : '#546E7A'} />
                  </g>
                ))}
                {/* 线缆指示（小三角箭头向下表示信号输入） */}
                {!isOffline && [0, 1, 2, 3].map(i => (
                  <polygon key={`arrow-${i}`} points={`${25 + i * 8},13 ${27 + i * 8},13 ${26 + i * 8},15`} fill="#4FD1C5" opacity="0.6">
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.5s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
                  </polygon>
                ))}
              </g>
            )}

            {/* ═══════ 中间屏幕 ═══════ */}
            <rect x="12" y="20" width="56" height="36" rx="3" fill={`url(#col-screen-${uid})`} stroke={isOffline ? '#424242' : '#37474F'} strokeWidth="0.8" />
            {/* 屏幕内框 */}
            <rect x="14" y="22" width="52" height="32" rx="2" fill="none" stroke={isOffline ? '#616161' : '#4FD1C5'} strokeWidth="0.4" opacity="0.3" />
            {/* 屏幕文字区 - 由 ScreenComponents 渲染 */}

            {/* ═══════ 底部状态指示灯排 ═══════ */}
            <rect x="12" y="60" width="56" height="10" rx="2" fill={`url(#col-panel-${uid})`} stroke={isOffline ? '#424242' : '#1A2332'} strokeWidth="0.5" />
            {/* 4 个状态LED */}
            {[0, 1, 2, 3].map(i => (
              <circle key={`led-${i}`} cx={20 + i * 14} cy="65" r="1.5" fill={
                isOffline ? '#616161' :
                i === 0 ? '#4CAF50' :        // 电源
                i === 1 ? '#4FD1C5' :        // 通信
                i === 2 ? '#FFC107' :        // 数据
                '#FF9800'                     // 报警
              }>
                {!isOffline && <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" begin={`${i * 0.3}s`} repeatCount="indefinite" />}
              </circle>
            ))}

            {/* ═══════ 底部端子排 ═══════ */}
            <rect x="8" y="74" width="64" height="32" rx="2" fill={`url(#col-panel-${uid})`} stroke={isOffline ? '#424242' : '#1A2332'} strokeWidth="0.8" />
            {/* 端子螺丝（2 排 × 6 个） */}
            {Array.from({ length: 2 }).map((_, row) =>
              Array.from({ length: 6 }).map((_, col) => (
                <circle key={`screw-${row}-${col}`} cx={14 + col * 10} cy={80 + row * 10} r="1.5" fill={isOffline ? '#616161' : '#546E7A'} stroke={isOffline ? '#424242' : '#37474F'} strokeWidth="0.3" />
              ))
            )}

            {/* ═══════ 底部文字标识 ═══════ */}
            <text x="40" y="113" textAnchor="middle" fill={isOffline ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)'} fontSize="4" fontFamily="'PingFang SC', sans-serif" fontWeight="600" letterSpacing="0.5">
              {sensorType === 'collector_wireless' ? '无线采集器' : '有线采集器'}
            </text>
          </>
        ) : sensorType === 'pump' ? (
          /* 压力泵（18041）：完全复刻 industrial-pump-scada003.svg
              协议命令码 0x0627，字段 startStatus（0=停止 1=运行）
              使用参考 SVG 原始坐标 + scale(0.295) 缩放至 80×120 viewBox */
          <g transform="translate(0, 19) scale(0.295)">
            <defs>
              <linearGradient id={`pump-grad-metal-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isOffline ? '#B0BEC5' : '#C0C8D4'} />
                <stop offset="50%" stopColor={isOffline ? '#90A4AE' : '#A0AEBE'} />
                <stop offset="100%" stopColor={isOffline ? '#78909C' : '#8896A6'} />
              </linearGradient>
              <linearGradient id={`pump-grad-body-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isOffline ? '#616161' : '#4A5568'} />
                <stop offset="100%" stopColor={isOffline ? '#424242' : '#2D3748'} />
              </linearGradient>
              <linearGradient id={`pump-grad-panel-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isOffline ? '#616161' : '#3D4A5C'} />
                <stop offset="100%" stopColor={isOffline ? '#424242' : '#2A3444'} />
              </linearGradient>
              <radialGradient id={`pump-grad-gauge-${uid}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={isOffline ? '#9E9E9E' : '#FFFFFF'} />
                <stop offset="85%" stopColor={isOffline ? '#BDBDBD' : '#F0F4F8'} />
                <stop offset="100%" stopColor={isOffline ? '#9E9E9E' : '#E2E8F0'} />
              </radialGradient>
            </defs>

            {/* 左侧管道螺栓 */}
            <circle cx="24" cy="150" r="3" fill="#2D3748" />
            {/* 左侧管道主体 */}
            <rect x="7" y="78" width="28" height="78" rx="2" fill={`url(#pump-grad-metal-${uid})`} stroke="#2D3748" strokeWidth="2.5" />
            {/* 左侧管道顶部法兰 */}
            <rect x="0" y="73" width="42" height="12" rx="2" fill={isOffline ? '#90A4AE' : '#B0BEC5'} stroke="#2D3748" strokeWidth="2.5" />
            <circle cx="10" cy="79" r="3" fill="#2D3748" />
            <circle cx="32" cy="79" r="3" fill="#2D3748" />

            {/* 主机体 */}
            <rect x="32" y="98" width="180" height="130" rx="6" fill={`url(#pump-grad-body-${uid})`} stroke={isOffline ? '#616161' : '#1A2332'} strokeWidth="3" />
            {/* 7 条散热槽线 */}
            <g stroke="#1A2332" strokeWidth="1.5" opacity="0.5">
              <line x1="42" y1="118" x2="202" y2="118" />
              <line x1="42" y1="133" x2="202" y2="133" />
              <line x1="42" y1="148" x2="202" y2="148" />
              <line x1="42" y1="163" x2="202" y2="163" />
              <line x1="42" y1="178" x2="202" y2="178" />
              <line x1="42" y1="193" x2="202" y2="193" />
              <line x1="42" y1="208" x2="202" y2="208" />
            </g>

            {/* 右侧电机圆 - 外圈 */}
            <circle cx="187" cy="163" r="40" fill={isOffline ? '#424242' : '#3D4A5C'} stroke={isOffline ? '#616161' : '#1A2332'} strokeWidth="2.5" />
            {/* 右侧电机圆 - 内圈 */}
            <circle cx="187" cy="163" r="32" fill={isOffline ? '#616161' : '#354052'} stroke={isOffline ? '#424242' : '#1A2332'} strokeWidth="1.5" />
            {/* 2 个青绿指示灯 */}
            <circle cx="175" cy="151" r="5" fill={isOffline ? '#616161' : '#4FD1C5'} />
            <circle cx="199" cy="175" r="5" fill={isOffline ? '#616161' : '#4FD1C5'} />
            {/* 运行态：flow-status 虚线圆旋转动画 */}
            {!isOffline && pumpStatus.isRunning && (
              <circle cx="187" cy="163" r="8" fill="none" stroke="#4FD1C5" strokeWidth="1" strokeDasharray="3,2">
                <animateTransform attributeName="transform" type="rotate" from="0 187 163" to="360 187 163" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* 底部控制面板 - 上层 */}
            <rect x="42" y="228" width="160" height="25" rx="3" fill={`url(#pump-grad-panel-${uid})`} stroke={isOffline ? '#616161' : '#1A2332'} strokeWidth="2.5" />
            {/* 底部控制面板 - 下层底座 */}
            <rect x="22" y="253" width="200" height="22" rx="3" fill={`url(#pump-grad-panel-${uid})`} stroke={isOffline ? '#616161' : '#1A2332'} strokeWidth="2.5" />
            {/* 底部状态灯 */}
            <circle cx="37" cy="264" r="4" fill={isOffline ? '#616161' : pumpStatus.isRunning ? '#4FD1C5' : '#FFC107'} />
            <circle cx="207" cy="264" r="4" fill={isOffline ? '#616161' : pumpStatus.isRunning ? '#4FD1C5' : '#FFC107'} />

            {/* 右侧出水管道 */}
            <rect x="212" y="153" width="50" height="30" rx="2" fill={`url(#pump-grad-metal-${uid})`} stroke="#2D3748" strokeWidth="2.5" />
            {/* 右侧法兰 */}
            <rect x="255" y="143" width="14" height="50" rx="2" fill={isOffline ? '#90A4AE' : '#B0BEC5'} stroke="#2D3748" strokeWidth="2.5" />
            <circle cx="262" cy="150" r="3" fill="#2D3748" />
            <circle cx="262" cy="186" r="3" fill="#2D3748" />

            {/* 顶部控制盒 */}
            <rect x="152" y="73" width="40" height="28" rx="3" fill={isOffline ? '#424242' : '#2D3748'} stroke={isOffline ? '#616161' : '#1A2332'} strokeWidth="2.5" />

            {/* 顶部圆形压力表 - 外圈 */}
            <circle cx="172" cy="38" r="38" fill={isOffline ? '#424242' : '#2D3748'} stroke={isOffline ? '#616161' : '#1A2332'} strokeWidth="3" />
            {/* 顶部圆形压力表 - 盘面 */}
            <circle cx="172" cy="38" r="32" fill={`url(#pump-grad-gauge-${uid})`} stroke={isOffline ? '#616161' : '#4A5568'} strokeWidth="1.5" />
            {/* 12 主刻度（每 30°） */}
            <g stroke={isOffline ? '#9E9E9E' : '#4A5568'} strokeWidth="2">
              {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => {
                const rad = ((deg - 90) * Math.PI) / 180;
                return <line key={`tick-${deg}`} x1={172 + Math.cos(rad) * 28} y1={38 + Math.sin(rad) * 28} x2={172 + Math.cos(rad) * 32} y2={38 + Math.sin(rad) * 32} />;
              })}
            </g>
            {/* 12 次刻度（每 15°偏移） */}
            <g stroke={isOffline ? '#BDBDBD' : '#8896A6'} strokeWidth="1">
              {[15,45,75,105,135,165,195,225,255,285,315,345].map(deg => {
                const rad = ((deg - 90) * Math.PI) / 180;
                return <line key={`sub-${deg}`} x1={172 + Math.cos(rad) * 29} y1={38 + Math.sin(rad) * 29} x2={172 + Math.cos(rad) * 32} y2={38 + Math.sin(rad) * 32} />;
              })}
            </g>
            {/* 红色指针：停止→参考原位(左下)，运行→旋转-120°到右下 */}
            {!isOffline && (
              <line x1="172" y1="38" x2="160" y2="53" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round"
                transform={pumpStatus.isRunning ? `rotate(-120 172 38)` : undefined} />
            )}
            {/* 指针中心 */}
            <circle cx="172" cy="38" r="3" fill={isOffline ? '#616161' : '#2D3748'} />
            {!isOffline && <circle cx="172" cy="38" r="1.5" fill="#E53E3E" />}
          </g>
        ) : (
          <>
            {/* ── 外壳：按 sensorType 分支 ──
                smoke: 白底圆形外壳（独立于通用矩形）
                touch: 青蓝灰圆形触控外壳
                infrared: 红外红矩形外壳
                alarm_dust: 浅棕矩形外壳 + 右侧进气道
                其他（numeric / alarm 通用）: 标准矩形外壳 */}
            {sensorType === 'smoke' ? (
              // 烟雾：白色圆形外壳（与组件库 isTemplate 视觉一致）
              <rect
                x="10" y="20" width="60" height="90" rx="8"
                fill={isOffline ? '#9E9E9E' : triggered ? '#212121' : '#FFFFFF'}
                stroke={triggered ? '#000000' : '#BDBDBD'}
                strokeWidth={2}
              />
            ) : sensorType === 'touch' ? (
              // 触控：青蓝灰矩形外壳（与组件库 isTemplate 视觉一致）
              <rect
                x="10" y="20" width="60" height="90" rx="10"
                fill={isOffline ? '#9E9E9E' : triggered ? '#1565C0' : TOUCH_THUMB_BODY}
                stroke={isOffline ? '#9E9E9E' : triggered ? '#0D47A1' : '#2C5F6E'}
                strokeWidth={2}
              />
            ) : sensorType === 'infrared' ? (
              // 红外：红外红矩形外壳（与组件库 isTemplate 视觉一致）
              <rect
                x="10" y="20" width="60" height="90" rx="8"
                fill={isOffline ? '#9E9E9E' : triggered ? '#C62828' : INFRARED_THUMB_BODY}
                stroke={isOffline ? '#9E9E9E' : triggered ? '#7F0000' : '#B71C1C'}
                strokeWidth={2}
              />
            ) : (_st === 'alarm_dust') ? (
              // 粉尘报警：浅棕矩形外壳 + 右侧壁挂式进气道（与组件库 isTemplate 视觉一致）
              <rect
                x="10" y="20" width="60" height="90" rx="8"
                fill={isOffline ? '#9E9E9E' : triggered ? '#4E342E' : ALARM_DUST_THUMB_BODY}
                stroke={isOffline ? '#9E9E9E' : triggered ? '#3E2723' : '#5D4037'}
                strokeWidth={2}
              />
            ) : (
              // 通用：标准矩形外壳
              <rect
                x="10" y="20" width="60" height="90" rx="8"
                fill={effectiveBodyColor}
                stroke={palette.border}
                strokeWidth={2}
              />
            )}

            {/* ── 顶部特征：按 sensorType 分支 ──
                不同传感器顶部结构根本性差异（识别传感器类型的核心） */}
            {sensorType === 'smoke' ? (
              // 烟雾：顶部矩形格栅（密排小圆孔 pattern）+ 触发时变黑
              <rect x="20" y="8" width="40" height="20" fill={triggered ? '#000000' : '#E0E0E0'} />
            ) : sensorType === 'touch' ? (
              // 触控：顶部圆形触控盘（3 层波纹圈视觉）
              <>
                <circle cx="40" cy="14" r="7" fill={isOffline ? '#5A5A5A' : triggered ? '#0D47A1' : '#2C5F6E'} opacity={0.7} />
                <circle cx="40" cy="14" r="5" fill="none" stroke={isOffline ? '#9E9E9E' : '#FFFFFF'} strokeWidth="0.5" opacity={0.6} />
                <circle cx="40" cy="14" r="3" fill="none" stroke={isOffline ? '#9E9E9E' : '#FFFFFF'} strokeWidth="0.4" opacity={0.5} />
              </>
            ) : sensorType === 'infrared' ? (
              // 红外：顶部双探头对射结构（左右对称两个长方形探头 + 中间光束）
              <>
                <rect x="32" y="6" width="3.5" height="14" rx="0.5" fill={isOffline ? '#9E9E9E' : palette.border} />
                <rect x="44.5" y="6" width="3.5" height="14" rx="0.5" fill={isOffline ? '#9E9E9E' : palette.border} />
                <line
                  x1="35.5" y1="13" x2="44.5" y2="13"
                  stroke={triggered ? '#F44336' : isOffline ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)'}
                  strokeWidth="0.6"
                  strokeLinecap="round"
                />
              </>
            ) : (_st === 'alarm_dust') ? (
              // 粉尘报警：顶部 3 行横向百叶窗进气口（替代通用半圆顶部）
              <>
                <rect x="22" y="24" width="36" height="12" rx="1.5" fill={isOffline ? '#5A5A5A' : '#1B0F0A'} />
                <rect x="24" y="26" width="32" height="1.8" rx="0.4" fill={isOffline ? '#9E9E9E' : '#3E2723'} />
                <rect x="24" y="29.5" width="32" height="1.8" rx="0.4" fill={isOffline ? '#9E9E9E' : '#3E2723'} />
                <rect x="24" y="33" width="32" height="1.8" rx="0.4" fill={isOffline ? '#9E9E9E' : '#3E2723'} />
              </>
            ) : (
              // 通用：标准半圆顶部
              <path d="M 20,28 A 20,20 0 0,1 60,28" fill={palette.border} />
            )}

            {/* 烟雾格栅密排小圆孔（应用 pattern，触发时变黑） */}
            {sensorType === 'smoke' && (
              <g clipPath="url(#sensor-smoke-top-rect-clip)">
                <rect x="20" y="8" width="40" height="20" fill={`url(#smoke-grille-${uid})`} />
                {triggered && !isOffline && (
                  <rect x="20" y="8" width="40" height="20" fill="#000000" opacity="0.4">
                    <animate attributeName="opacity" values="0.4;0.2;0.4" dur="0.8s" repeatCount="indefinite" />
                  </rect>
                )}
              </g>
            )}
          </>
        )}
        {sensorType !== 'pump' && sensorType !== 'flowMeter' && sensorType !== 'collector_wireless' && sensorType !== 'collector_wired' && (
          <rect x="18" y="45" width="44" height="30" rx="3" fill={palette.screen} stroke="#333" strokeWidth={1} />
        )}
        {/* 底部矩形框（设备类型标识区）：所有传感器通用结构
            框内显示"甲烷"/"烟雾"/"红外"等中文标识（与报警型传感器统一）
            添加浅灰描边，让矩形框边界清晰可辨，避免与外框混淆 */}
        {sensorType !== 'pump' && sensorType !== 'flowMeter' && sensorType !== 'collector_wireless' && sensorType !== 'collector_wired' && (
          <rect
            x="25"
            y="105"
            width="30"
            height="10"
            rx="2"
            fill={palette.border}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={0.4}
          />
        )}
        {sensorType === 'touch' ? (
          /* 触控型：在线=波纹圈动画，离线=静态灰圈 */
          <>
            <circle cx="40" cy="12" r="3" fill={indicatorColor} opacity={isOffline ? 0.4 : 0.9} />
            {statusVisual.pulse && (
              <>
                <circle cx="40" cy="12" r="3" fill="none" stroke={indicatorColor} strokeWidth="1.2" opacity="0.8">
                  <animate attributeName="r" values="2;10;2" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" repeatCount="indefinite" />
                </circle>
                <circle cx="40" cy="12" r="3" fill="none" stroke={indicatorColor} strokeWidth="1" opacity="0.6">
                  <animate attributeName="r" values="2;10;2" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
                  <animate
                    attributeName="opacity"
                    values="0.6;0;0.6"
                    dur="1.2s"
                    repeatCount="indefinite"
                    begin="0.2s"
                  />
                </circle>
                <circle cx="40" cy="12" r="3" fill="none" stroke={indicatorColor} strokeWidth="0.8" opacity="0.4">
                  <animate attributeName="r" values="2;10;2" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
                  <animate
                    attributeName="opacity"
                    values="0.4;0;0.4"
                    dur="1.2s"
                    repeatCount="indefinite"
                    begin="0.4s"
                  />
                </circle>
              </>
            )}
          </>
        ) : sensorType === 'infrared' ? (
          /* 红外型：双端对射探测头 + 中间光束 */
          <>
            {/* 左侧探头 + 发光 LED（在线时持续发光动画） */}
            <rect x="32" y="6" width="3.5" height="10" rx="0.5" fill={palette.border} />
            <circle cx="33.75" cy="11" r="1.4" fill={topLedColor} opacity={isOffline ? 0.4 : 1}>
              {!isOffline && <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" />}
            </circle>
            {/* 发光外晕（左） */}
            {!isOffline && (
              <circle cx="33.75" cy="11" r="2.6" fill={topLedColor} opacity="0.35">
                <animate attributeName="r" values="2.6;4.2;2.6" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0;0.35" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
            {/* 右侧探头 + 发光 LED（在线时持续发光动画） */}
            <rect x="44.5" y="6" width="3.5" height="10" rx="0.5" fill={palette.border} />
            <circle cx="46.25" cy="11" r="1.4" fill={topLedColor} opacity={isOffline ? 0.4 : 1}>
              {!isOffline && (
                <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" begin="0.7s" />
              )}
            </circle>
            {/* 发光外晕（右） */}
            {!isOffline && (
              <circle cx="46.25" cy="11" r="2.6" fill={topLedColor} opacity="0.35">
                <animate attributeName="r" values="2.6;4.2;2.6" dur="1.4s" repeatCount="indefinite" begin="0.7s" />
                <animate
                  attributeName="opacity"
                  values="0.35;0;0.35"
                  dur="1.4s"
                  repeatCount="indefinite"
                  begin="0.7s"
                />
              </circle>
            )}
            {/* 中间光束（触发时红色高亮） */}
            {triggered ? (
              <line
                x1="35.5"
                y1="11"
                x2="44.5"
                y2="11"
                stroke="#F44336"
                strokeWidth="0.8"
                opacity={isOffline ? 0.3 : 0.9}
                strokeLinecap="round"
              />
            ) : (
              <line
                x1="35.5"
                y1="11"
                x2="44.5"
                y2="11"
                stroke={isOffline ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)'}
                strokeWidth="0.4"
                strokeLinecap="round"
                strokeDasharray="1,1"
              />
            )}
          </>
        ) : sensorType === 'smoke' ? (
          /* 烟雾型：顶部单 LED 指示灯（无烟=白，触发=黑，离线=暗灰） */
          <>
            <circle
              cx="40"
              cy="12"
              r="3"
              fill={isOffline ? '#9E9E9E' : triggered ? '#000000' : '#616161'}
              opacity={isOffline ? 0.4 : 0.9}
            />
            {statusVisual.pulse && !isOffline && (
              <circle cx="40" cy="12" r="3" fill={triggered ? '#000000' : '#616161'} opacity="0.4">
                <animate attributeName="r" values="3;6;3" dur={triggered ? '0.6s' : '2s'} repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur={triggered ? '0.6s' : '2s'}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </>
        ) : sensorType === 'dust' ? (
          /* 数值型粉尘：LED 指示灯位于屏幕区左上角 (22, 49) */
          <>
            <circle
              cx="22"
              cy="49"
              r="1.6"
              fill={isOffline ? '#9E9E9E' : indicatorColor}
              opacity={isOffline ? 0.4 : 0.95}
            />
            {statusVisual.pulse && !isOffline && (
              <circle cx="22" cy="49" r="1.6" fill={indicatorColor} opacity="0.4">
                <animate attributeName="r" values="1.6;3;1.6" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
          </>
        ) : sensorType === 'alarm_dust' ? (
          /* 报警型粉尘：LED 指示灯位于屏幕区左上角 (22, 49)，触发时变深棕 */
          <>
            <circle
              cx="22"
              cy="49"
              r="1.6"
              fill={isOffline ? '#9E9E9E' : hasAlarmVisual ? '#4E342E' : '#A1887F'}
              opacity={isOffline ? 0.4 : 0.95}
            />
            {statusVisual.pulse && !isOffline && (
              <circle cx="22" cy="49" r="1.6" fill={hasAlarmVisual ? '#4E342E' : '#A1887F'} opacity="0.4">
                <animate
                  attributeName="r"
                  values="1.6;3;1.6"
                  dur={triggered ? '0.6s' : '1.8s'}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur={triggered ? '0.6s' : '1.8s'}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </>
        ) : sensorType === 'co' ? (
          /* CO 数值型：顶部小状态 LED（百叶窗上方，r=2，不遮挡进气口） */
          <>
            <circle
              cx="40"
              cy="14"
              r="2"
              fill={isOffline ? '#9E9E9E' : indicatorColor}
              opacity={isOffline ? 0.4 : 0.95}
            />
            {statusVisual.pulse && !isOffline && (
              <circle cx="40" cy="14" r="2" fill={indicatorColor} opacity="0.4">
                <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
          </>
        ) : sensorType ===
          'ch4' /* CH4 数值型：不需要顶部指示器，绿点在屏幕内左上角（screenContent 区渲染） */ ? null : sensorType ===
          'temperature' /* 温度数值型：不需要顶部指示器，绿点在屏幕内左上角（screenContent 区渲染） */ ? null : sensorType ===
          'top_coal' /* 放顶煤：不需要顶部指示器，顶部是漏斗形放煤口 */ ? null : sensorType ===
          'wind' /* 风速：不需要顶部指示器，顶部是风杯风速计 */ ? null : sensorType ===
          'windPress' /* 风压：不需要顶部指示器，顶部是压力表 */ ? null : sensorType ===
          'coalCutter' /* 割煤机位置：不需要顶部指示器，顶部是截割臂 */ ? null : sensorType ===
          'frameMove' /* 移架：不需要顶部指示器，顶部是液压缸 */ ? null : sensorType ===
          'frameDrop' /* 落架：不需要顶部指示器，顶部是液压缸 */ ? null : sensorType ===
          'vibration' /* 振动：不需要顶部指示器，顶部是传感器探头 */ ? null : sensorType ===
          'cleanWall' /* 清洗煤壁：不需要顶部指示器，顶部是喷头（已在主体渲染） */ ? null : sensorType ===
          'flowMeter' /* 流量计：不需要顶部指示器，顶部是水流转子（已在主体渲染） */ ? null : sensorType ===
          'pump' /* 压力泵：不需要顶部指示器，顶部是泵体叶轮（已在主体渲染） */ ? null : sensorType ===
          'collector_wireless' /* 采集器：不需要顶部指示器，顶部是天线/接口（已在主体渲染） */ ? null : sensorType ===
          'collector_wired' /* 采集器：不需要顶部指示器，顶部是接口（已在主体渲染） */ ? null : (
          <>
            <circle cx="40" cy="12" r="5" fill={indicatorColor} />
            {statusVisual.pulse && (
              <circle cx="40" cy="12" r="5" fill={indicatorColor} opacity="0.4">
                <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
          </>
        )}
        {/* 火焰型（18031）触发态：探测窗周围双层火焰波纹（已在主体渲染，此处无需重复） */}
        {sensorType === 'flame' && triggered && statusVisual.pulse && null}
        {/* 温度报警型（18025）触发态：探温头周围红色脉冲圈（已在主体渲染，此处无需重复） */}
        {sensorType === 'alarm_temperature' && triggered && statusVisual.pulse && null}
        {/* 报警型/触控型触发态：顶部中央红色脉冲圈（粉尘报警 alarm_dust 不画这里，改到底部 LED 周围脉动） */}
        {(sensorType === 'alarm' || sensorType === 'touch') && triggered && statusVisual.pulse && (
          <circle cx="40" cy="12" r="5" fill="none" stroke="#F44336" strokeWidth="1.5" opacity="0.6">
            <animate attributeName="r" values="5;10;5" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}
        {/* 粉尘报警（18029）触发态：屏幕区左上角 LED 双层脉动（更醒目的报警反馈） */}
        {sensorType === 'alarm_dust' && triggered && statusVisual.pulse && (
          <circle cx="22" cy="49" r="1.6" fill="none" stroke="#4E342E" strokeWidth="1" opacity="0.6">
            <animate attributeName="r" values="1.6;5;1.6" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="0.8s" repeatCount="indefinite" />
          </circle>
        )}
        {/* 触控型：底部矩形框显示"触 控"（离线时降低透明度） */}
        {sensorType === 'touch' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="600"
            letterSpacing="3"
          >
            触控
          </text>
        )}
        {/* 红外型：底部显示"红 外"（与触控"触 控"对齐，离线时降低透明度） */}
        {sensorType === 'infrared' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="600"
            letterSpacing="3"
          >
            红外
          </text>
        )}
        {/* 烟雾型：底部显示"烟 雾"（与触控/红外对齐） */}
        {sensorType === 'smoke' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="600"
            letterSpacing="3"
          >
            烟雾
          </text>
        )}
        {/* 火焰型：底部显示"火 焰"（与触控/红外/烟雾对齐） */}
        {sensorType === 'flame' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(255,224,178,0.95)' : 'rgba(255,255,255,0.95)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="600"
            letterSpacing="3"
          >
            火焰
          </text>
        )}
        {/* 温度报警型：底部显示"温 度"（与触控/红外/烟雾/火焰对齐） */}
        {sensorType === 'alarm_temperature' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(255,171,145,0.95)' : 'rgba(255,255,255,0.95)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="600"
            letterSpacing="3"
          >
            温度
          </text>
        )}
        {/* CH4 数值型：底部显示"甲烷"（与触控/红外/烟雾/火焰/温度对齐） */}
        {sensorType === 'ch4' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="600"
            letterSpacing="3"
          >
            甲烷
          </text>
        )}
        {/* 温度数值型：底部显示"温度"（与触控/红外/烟雾/火焰/甲烷对齐） */}
        {sensorType === 'temperature' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="600"
            letterSpacing="3"
          >
            温度
          </text>
        )}
        {/* CO 报警型：底部显示"CO"（与触控/红外/烟雾/火焰/温度对齐） */}
        {sensorType === 'alarm_co' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(255,205,210,0.95)' : 'rgba(248,187,208,0.95)'}
            fontSize="7"
            fontFamily="'Arial', sans-serif"
            fontWeight="700"
            letterSpacing="1"
          >
            CO
          </text>
        )}
        {/* 放顶煤：底部显示"放顶煤" */}
        {sensorType === 'top_coal' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(255,224,178,0.95)' : 'rgba(255,255,255,0.85)'}
            fontSize="6"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1.5"
          >
            放顶煤
          </text>
        )}
        {/* 风速：底部显示"风速" */}
        {sensorType === 'wind' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="2"
          >
            风速
          </text>
        )}
        {/* 风压：底部显示"风压" */}
        {sensorType === 'windPress' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="2"
          >
            风压
          </text>
        )}
        {/* 割煤机位置：底部显示"割煤机" */}
        {sensorType === 'coalCutter' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(255,235,59,0.95)' : 'rgba(255,255,255,0.85)'}
            fontSize="6"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1.5"
          >
            割煤机
          </text>
        )}
        {/* 移架：底部显示"移架" */}
        {sensorType === 'frameMove' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(200,230,201,0.95)' : 'rgba(255,255,255,0.85)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="2"
          >
            移架
          </text>
        )}
        {/* 落架：底部显示"落架" */}
        {sensorType === 'frameDrop' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(255,171,145,0.95)' : 'rgba(255,255,255,0.85)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="2"
          >
            落架
          </text>
        )}
        {/* 振动：底部显示"振动" */}
        {sensorType === 'vibration' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(255,235,59,0.95)' : 'rgba(255,255,255,0.85)'}
            fontSize="7"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="2"
          >
            振动
          </text>
        )}
        {/* 清洗煤壁：底部显示"清洗煤壁" */}
        {sensorType === 'cleanWall' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : triggered ? 'rgba(178,235,242,0.95)' : 'rgba(255,255,255,0.85)'}
            fontSize="5.5"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="0.5"
          >
            清洗煤壁
          </text>
        )}
        {/* 流量计：底部显示"流量计" */}
        {sensorType === 'flowMeter' && (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'}
            fontSize="6"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="700"
            letterSpacing="1"
          >
            流量计
          </text>
        )}
        {/* 压力泵：无底部文字（参考 SVG 无文字标识） */}
        {sensorType === 'pump' && null}
        {/* 粉尘型：底部 PM 等级指示
            - 数值型 dust（18015）：3 段彩色等级条（绿/黄/红）+ 当前等级高亮
            - 报警型 alarm_dust（18029）：文字"粉尘报警"（四个字） */}
        {sensorType === 'dust' ? (
          /* 数值型粉尘：PM 等级条（绿/黄/红）上移 + 底部"粉 尘"文字（与其他传感器视觉一致） */
          <g>
            {/* 左侧"PM"小标识 */}
            <text
              x="15"
              y="105"
              fill={isOffline ? 'rgba(0,0,0,0.3)' : 'rgba(38,50,56,0.85)'}
              fontSize="4.5"
              fontWeight="700"
              fontFamily="'Arial', sans-serif"
            >
              PM
            </text>
            {/* 3 段等级条（绿/黄/红），等宽 7px，间隔 0.5px */}
            {(() => {
              const pct = dustGauge.pct ?? 0;
              const level = isOffline ? -1 : !dustGauge.hasValue ? 0 : pct >= 0.85 ? 2 : pct >= 0.5 ? 1 : 0;
              const colors = isOffline ? ['#3A3A3A', '#3A3A3A', '#3A3A3A'] : ['#4CAF50', '#FFC107', '#F44336'];
              return [0, 1, 2].map((i) => (
                <rect
                  key={`pm-level-${i}`}
                  x={25 + i * 8}
                  y={102}
                  width={7}
                  height={3}
                  rx={0.6}
                  fill={colors[i]}
                  opacity={isOffline ? 0.4 : level === i ? 1 : 0.35}
                >
                  {level === i && !isOffline && (
                    <animate attributeName="opacity" values="1;0.55;1" dur="1.5s" repeatCount="indefinite" />
                  )}
                </rect>
              ));
            })()}
            {/* 右侧单位 mg/m³ */}
            <text
              x="65"
              y="105"
              textAnchor="end"
              fill={isOffline ? 'rgba(0,0,0,0.3)' : 'rgba(38,50,56,0.85)'}
              fontSize="3.6"
              fontWeight="500"
              fontFamily="'Arial', sans-serif"
            >
              mg/m³
            </text>
            {/* 底部"粉 尘"文字，与触控/红外/烟雾对齐 */}
            <text
              x="40"
              y="113"
              textAnchor="middle"
              fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)'}
              fontSize="7"
              fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
              fontWeight="600"
              letterSpacing="3"
            >
              粉尘
            </text>
          </g>
        ) : sensorType === 'alarm_dust' ? (
          <text
            x="40"
            y="113"
            textAnchor="middle"
            fill={isOffline ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)'}
            fontSize="5.5"
            fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
            fontWeight="600"
            letterSpacing="0.5"
          >
            粉尘报警
          </text>
        ) : null}
      </svg>

      {/* ─── 屏幕内容：纯 SVG text，和集控器/分控器一样利用 viewBox 自动缩放 ─── */}
      {!hideScreenContent && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${SENSOR_VW} ${SENSOR_VH}`}
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <g clipPath={`url(#sensor-screen-clip-${uid})`}>
            {screenContent ? null : screenItems && screenItems.length > 0 ? (
              /* 用户勾选了属性 → 轮播显示 screenItems */
              <g>
                {currentPageItems.map((item, idx) => {
                  const text = `${item.label}: ${item.value}${item.unit ? ' ' + item.unit : ''}`;
                  return (
                    <MarqueeText
                      key={item.key}
                      x={20}
                      y={52 + idx * 7}
                      fill={isOffline ? 'rgba(255,255,255,0.4)' : '#FFFFFF'}
                      fontSize={5.5}
                      fontWeight={600}
                      maxWidth={40}
                    >
                      {text}
                    </MarqueeText>
                  );
                })}
                {/* 轮播指示器：多页时在屏幕右下角显示小圆点 */}
                {totalPages > 1
                  ? Array.from({ length: totalPages }, (_, i) => (
                      <circle
                        key={`dot-${i}`}
                        cx={56 + i * 3}
                        cy="72"
                        r={i === carouselPage ? 0.8 : 0.5}
                        fill={
                          i === carouselPage
                            ? isOffline
                              ? 'rgba(255,255,255,0.6)'
                              : '#FFFFFF'
                            : isOffline
                              ? 'rgba(255,255,255,0.2)'
                              : 'rgba(255,255,255,0.4)'
                        }
                      />
                    ))
                  : null}
              </g>
            ) : sensorType === 'touch' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={isOffline ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)'}
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="700"
                  letterSpacing="1.5"
                >
                  触控
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="sans-serif"
                    fontWeight="700"
                  >
                    {/* P3-2 增强：触控支持低电文案 */}
                    {isBatteryWarn ? (triggered ? '触发+低电' : '低电') : triggered ? '触发' : '正常'}
                  </text>
                </g>
              )
            ) : sensorType === 'infrared' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={isOffline ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)'}
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="700"
                  letterSpacing="1.5"
                >
                  红外
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="sans-serif"
                    fontWeight="700"
                  >
                    {/* P3-2 增强：红外支持低电文案 */}
                    {isBatteryWarn ? (triggered ? '触发+低电' : '低电') : triggered ? '触发' : '正常'}
                  </text>
                </g>
              )
            ) : sensorType === 'smoke' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)'}
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="700"
                  letterSpacing="1.5"
                >
                  烟雾
                </text>
              ) : (
                <g>
                  {/* 屏幕内格栅：密排小圆孔（无烟=黑孔，触发=白孔被黑覆盖，低电=琥珀色） */}
                  <g opacity={isOffline ? 0.3 : 0.85}>
                    {Array.from({ length: 5 }, (_, row) =>
                      Array.from({ length: 7 }, (_, col) => (
                        <circle
                          key={`g-${row}-${col}`}
                          cx={22 + col * 3}
                          cy={49 + row * 4}
                          r={0.7}
                          fill={isBatteryWarn ? '#FFB300' : triggered ? '#FFFFFF' : '#000000'}
                        />
                      )),
                    )}
                  </g>
                  {/* 触发时：格栅被深黑覆盖层+脉动（浓烟涌入） */}
                  {triggered && !isBatteryWarn && !isOffline && (
                    <g>
                      {Array.from({ length: 5 }, (_, row) =>
                        Array.from({ length: 7 }, (_, col) => (
                          <circle
                            key={`gp-${row}-${col}`}
                            cx={22 + col * 3}
                            cy={49 + row * 4}
                            r={0.7}
                            fill="#000000"
                            opacity="0.5"
                          >
                            <animate
                              attributeName="opacity"
                              values="0.5;0.2;0.5"
                              dur={0.6 + (row + col) * 0.05}
                              repeatCount="indefinite"
                            />
                          </circle>
                        )),
                      )}
                    </g>
                  )}
                  {/* P2-1：低电时显示"低电"字样 + 闪烁（与触发区分） */}
                  {isBatteryWarn && (
                    <text
                      x="40"
                      y="58"
                      textAnchor="middle"
                      fill="#FFB300"
                      fontSize="5"
                      fontFamily="sans-serif"
                      fontWeight="800"
                      letterSpacing="0.5"
                    >
                      低电
                      <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
                    </text>
                  )}
                  {/* 中心状态指示灯：无烟=灰白待机，触发=纯黑（浓烟），低电=琥珀，离线=暗灰 */}
                  <circle
                    cx="40"
                    cy="58"
                    r="2.5"
                    fill={isOffline ? '#9E9E9E' : isBatteryWarn ? '#FFB300' : triggered ? '#000000' : '#616161'}
                    filter={`url(#sensor-glow-${uid})`}
                  >
                    {!isOffline && (
                      <animate
                        attributeName="opacity"
                        values={hasAlarmVisual ? '1;0.3;1' : '0.85;1;0.85'}
                        dur={hasAlarmVisual ? '0.6s' : '2s'}
                        repeatCount="indefinite"
                      />
                    )}
                  </circle>
                </g>
              )
            ) : sensorType === 'alarm_dust' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={isOffline ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)'}
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="700"
                  letterSpacing="1.5"
                >
                  粉尘
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="sans-serif"
                    fontWeight="700"
                  >
                    {isBatteryWarn ? (triggered ? '越限+低电' : '低电') : triggered ? '浓度越限' : '正常'}
                  </text>
                </g>
              )
            ) : sensorType === 'flame' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={
                    isOffline ? 'rgba(255,255,255,0.4)' : triggered ? 'rgba(255,224,178,0.95)' : 'rgba(255,255,255,0.9)'
                  }
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="700"
                  letterSpacing="1.5"
                >
                  火焰
                </text>
              ) : (
                <g>
                  {/* 紫外/火焰指示点（屏幕左上角） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#FFE0B2' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="sans-serif"
                    fontWeight="700"
                  >
                    {isBatteryWarn ? (triggered ? '触发+低电' : '低电') : triggered ? '火警' : '紫外监测'}
                  </text>
                </g>
              )
            ) : sensorType === 'alarm_temperature' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={
                    isOffline ? 'rgba(255,255,255,0.4)' : triggered ? 'rgba(255,171,145,0.95)' : 'rgba(255,255,255,0.9)'
                  }
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="700"
                  letterSpacing="1.5"
                >
                  温度
                </text>
              ) : (
                <g>
                  {/* 温度指示点（屏幕左上角） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#FFAB91' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="sans-serif"
                    fontWeight="700"
                  >
                    {isBatteryWarn ? (triggered ? '超温+低电' : '低电') : triggered ? '超温报警' : '温度监测'}
                  </text>
                </g>
              )
            ) : sensorType === 'co' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={isOffline ? 'rgba(255,255,255,0.4)' : 'rgba(128,203,196,0.95)'}
                  fontSize="7"
                  fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                  fontWeight="700"
                  letterSpacing="3"
                >
                  一氧化碳
                </text>
              ) : (
                <g>
                  {/* CO 指示点（屏幕左上角） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#80CBC4'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    一氧化碳监测
                  </text>
                </g>
              )
            ) : sensorType === 'ch4' ? (
              isTemplate ? (
                <g>
                  {/* 甲烷指示点（屏幕左上角，与温度传感器位置对齐） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#64B5F6'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    甲烷监测
                  </text>
                </g>
              ) : (
                <g>
                  {/* 甲烷指示点（屏幕左上角，与温度传感器位置对齐） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#64B5F6'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    甲烷监测
                  </text>
                </g>
              )
            ) : sensorType === 'temperature' ? (
              isTemplate ? (
                <g>
                  {/* 温度指示点（屏幕左上角，与甲烷传感器位置对齐） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#FFAB91'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    温度监测
                  </text>
                </g>
              ) : (
                <g>
                  {/* 温度指示点（屏幕左上角，与甲烷传感器位置对齐） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#FFAB91'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    温度监测
                  </text>
                </g>
              )
            ) : sensorType === 'alarm_co' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={
                    isOffline ? 'rgba(255,255,255,0.4)' : triggered ? 'rgba(255,205,210,0.95)' : 'rgba(248,187,208,0.9)'
                  }
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="700"
                  letterSpacing="1.5"
                >
                  CO
                </text>
              ) : (
                <g>
                  {/* CO 指示点（屏幕左上角） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#FFCDD2' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="sans-serif"
                    fontWeight="700"
                  >
                    {isBatteryWarn ? (triggered ? '超标+低电' : '低电') : triggered ? 'CO超标' : 'CO监测'}
                  </text>
                </g>
              )
            ) : sensorType === 'top_coal' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={
                    isOffline
                      ? 'rgba(255,255,255,0.4)'
                      : triggered
                        ? 'rgba(255,224,178,0.95)'
                        : 'rgba(255,255,255,0.85)'
                  }
                  fontSize="6"
                  fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                  fontWeight="700"
                  letterSpacing="1"
                >
                  {triggered ? '放煤中' : '待机'}
                </text>
              ) : (
                <g>
                  {/* 放顶煤指示点（屏幕左上角） */}
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#FFAB40' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    {triggered ? '放煤中' : '待机'}
                  </text>
                </g>
              )
            ) : sensorType === 'wind' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={isOffline ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)'}
                  fontSize="6"
                  fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                  fontWeight="700"
                  letterSpacing="1"
                >
                  风速监测
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    风速
                  </text>
                </g>
              )
            ) : sensorType === 'windPress' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={isOffline ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)'}
                  fontSize="6"
                  fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                  fontWeight="700"
                  letterSpacing="1"
                >
                  风压监测
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    风压
                  </text>
                </g>
              )
            ) : sensorType === 'coalCutter' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={
                    isOffline ? 'rgba(255,255,255,0.4)' : triggered ? 'rgba(255,235,59,0.95)' : 'rgba(255,255,255,0.85)'
                  }
                  fontSize="6"
                  fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                  fontWeight="700"
                  letterSpacing="1"
                >
                  {triggered ? '截割中' : '待机'}
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#FFEB3B' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    {triggered ? '截割中' : '待机'}
                  </text>
                </g>
              )
            ) : sensorType === 'frameMove' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={
                    isOffline
                      ? 'rgba(255,255,255,0.4)'
                      : triggered
                        ? 'rgba(200,230,201,0.95)'
                        : 'rgba(255,255,255,0.85)'
                  }
                  fontSize="6"
                  fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                  fontWeight="700"
                  letterSpacing="1"
                >
                  {triggered ? '推移中' : '待机'}
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#C8E6C9' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    {triggered ? '推移中' : '待机'}
                  </text>
                </g>
              )
            ) : sensorType === 'frameDrop' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={
                    isOffline
                      ? 'rgba(255,255,255,0.4)'
                      : triggered
                        ? 'rgba(255,171,145,0.95)'
                        : 'rgba(255,255,255,0.85)'
                  }
                  fontSize="6"
                  fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                  fontWeight="700"
                  letterSpacing="1"
                >
                  {triggered ? '下降中' : '待机'}
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#FFAB91' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    {triggered ? '下降中' : '待机'}
                  </text>
                </g>
              )
            ) : sensorType === 'vibration' ? (
              isTemplate ? (
                <text
                  x="40"
                  y="62"
                  textAnchor="middle"
                  fill={
                    isOffline ? 'rgba(255,255,255,0.4)' : triggered ? 'rgba(255,235,59,0.95)' : 'rgba(255,255,255,0.85)'
                  }
                  fontSize="6"
                  fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                  fontWeight="700"
                  letterSpacing="1"
                >
                  {triggered ? '振动中' : '待机'}
                </text>
              ) : (
                <g>
                  <circle cx="22" cy="54" r="1.5" fill={indicatorColor} filter={`url(#sensor-glow-${uid})`} />
                  <text
                    x="26"
                    y="56"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : triggered ? '#FFEB3B' : '#FFFFFF'}
                    fontSize="5.5"
                    fontFamily="'PingFang SC', 'Microsoft YaHei', sans-serif"
                    fontWeight="700"
                  >
                    {triggered ? '振动中' : '待机'}
                  </text>
                </g>
              )
            ) : (
              /* 默认（未勾选 screenContent）：只显示设备编号或产品类型名，不显示设备状态信息 */
              <g>
                {label ? (
                  <text
                    x="40"
                    y="58"
                    textAnchor="middle"
                    fill={isOffline ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)'}
                    fontSize="6"
                    fontFamily="sans-serif"
                    fontWeight="700"
                  >
                    {label}
                  </text>
                ) : subtitle ? (
                  <text
                    x="40"
                    y="58"
                    textAnchor="middle"
                    fill={isOffline ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)'}
                    fontSize="6"
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {subtitle}
                  </text>
                ) : null}
              </g>
            )}
          </g>
        </svg>
      )}
    </div>
  );
}
