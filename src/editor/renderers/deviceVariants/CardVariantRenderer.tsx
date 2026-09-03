/**
 * ControlPanelRenderer — 设备控制面板变体
 *
 * 传感器 Tooltip：
 * - 使用 position:absolute 作为组件子元素
 * - 位置基于 SVG 传感器本体（viewBox 坐标系换算），不是拖动边框
 * - 大小根据画布缩放动态调整
 * - 通过 ResizeObserver 响应尺寸变化，无需 rAF 循环
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import type { DeviceVariantRendererProps } from './types';
import { getDeviceFrame } from './DeviceSvgFrames';
import { deviceStateMachine } from '../../../store/deviceStateMachine';
import {
  computeDeviceStatus,
  getStatusVisual,
  getDeviceLabel,
  getSubtitle,
  getCoreValue,
  resolveDeviceContent,
  extractControllerStateRaw,
} from './deviceStatus';
import type { TooltipField, DeviceLiveStatus } from './deviceStatus';
import type { DeviceInstance } from '../../../types/device';
import { useThrottledDevices, useThrottledDeviceStates } from '../../../hooks/useThrottledDevices';
import { DEFAULT_PRODUCT_CODE_MAPPING } from '../../../devices/edgeConductorDefaults';
import {
  injectAnimationKeyframes,
  getAnimationSx,
  getLineEffectFilter,
  getLineEffectSx,
  getLineEffectAnimations,
} from '../decorationAnimation';

// ─── 数字 productCode → 字符串 productCode 转换 ───
// 后端 API 推送的 productCode 可能是数字（18026）或字符串（"FY002-Alarm-Infrared"），
// 这里统一规范化为字符串，便于后续的 .includes() 匹配
const NUM_TO_STRING_PC: Record<number, string> = DEFAULT_PRODUCT_CODE_MAPPING;
function normalizeProductCode(pc: string | number | undefined): string | undefined {
  if (pc === undefined || pc === null) return undefined;
  if (typeof pc === 'number') {
    return NUM_TO_STRING_PC[pc] ?? String(pc);
  }
  // 字符串：如果是纯数字（如 "18026"），尝试反向映射
  if (/^\d+$/.test(pc)) {
    const num = Number(pc);
    return NUM_TO_STRING_PC[num] ?? pc;
  }
  return pc;
}

// 传感器 SVG viewBox 常量（与 DeviceSvgFrames.tsx SensorFrame 一致）
const SENSOR_VW = 80;
const SENSOR_VH = 120;
// 传感器本体在 viewBox 中的位置
const SENSOR_BODY = { x: 10, y: 20, w: 60, h: 90 };

export function ControlPanelRenderer({
  device,
  product,
  isPending,
  isTemplate,
  forceOnline,
  hideScreenContent,
  styleConfig,
  animationConfig,
  contentConfig,
}: DeviceVariantRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ─── 传感器本体在容器内的实际像素位置（考虑 preserveAspectRatio letterbox） ───
  const [sensorLayout, setSensorLayout] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    scale: number;
  } | null>(null);

  const updateLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw === 0 || ch === 0) return;

    // 计算 preserveAspectRatio="xMidYMid meet" 的实际渲染
    const vbRatio = SENSOR_VW / SENSOR_VH;
    const elRatio = cw / ch;
    let scale: number, offsetX: number, offsetY: number;
    if (elRatio > vbRatio) {
      scale = ch / SENSOR_VH;
      offsetX = (cw - SENSOR_VW * scale) / 2;
      offsetY = 0;
    } else {
      scale = cw / SENSOR_VW;
      offsetX = 0;
      offsetY = (ch - SENSOR_VH * scale) / 2;
    }

    const newLayout = {
      left: offsetX + SENSOR_BODY.x * scale,
      top: offsetY + SENSOR_BODY.y * scale,
      width: SENSOR_BODY.w * scale,
      height: SENSOR_BODY.h * scale,
      scale,
    };

    setSensorLayout((prev) => {
      if (
        prev &&
        Math.abs(prev.left - newLayout.left) < 0.5 &&
        Math.abs(prev.top - newLayout.top) < 0.5 &&
        Math.abs(prev.width - newLayout.width) < 0.5 &&
        Math.abs(prev.height - newLayout.height) < 0.5
      )
        return prev;
      return newLayout;
    });
  }, []);

  useLayoutEffect(() => {
    updateLayout();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateLayout);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateLayout]);

  // 1. 状态计算
  // 优先级：forceOnline/isTemplate（产品模板态 = 彩色） > 真实状态
  //   - 产品模板态（isTemplate=true）：截图、组件库、画布上未绑实例 → 显示彩色产品图
  //     （按设备类型本来的颜色，不受 online/offline 影响，方便辨认）
  //   - 设备库/导航栏（forceOnline=true）：同上，强制彩色
  //   - 画布上真实绑定的设备：按 online/offline/alarm/pending 真实数据渲染
  //       - 在线 = 彩色 + 绿点脉冲
  //       - 离线 = 灰色机身 + 灰点
  //       - 告警 = 橙色脉冲
  // 订阅 deviceStates 以响应状态机变化（节流 500ms，与 devices 同节奏，避免多实例卡片被状态机跳变全量重渲）
  const deviceStates = useThrottledDeviceStates(500);
  const status: DeviceLiveStatus = forceOnline || isTemplate ? 'online' : computeDeviceStatus(device, isPending);
  const statusVisual = getStatusVisual(status);

  // 2. 子设备统计
  const devices = useThrottledDevices<DeviceInstance>(500);
  const childStats = useMemo(() => {
    if (device?.category !== 'main') return undefined;
    const deviceId = device.deviceId;
    const subs = Object.values(devices).filter((d) => d.parentDeviceId === deviceId && d.category === 'sub');
    const subOnline = subs.filter((d) => d.online).length;
    let sensorTotal = 0,
      sensorOnline = 0;
    for (const sub of subs) {
      const sensors = Object.values(devices).filter(
        (d) => d.parentDeviceId === sub.deviceId && d.category === 'sensor',
      );
      sensorTotal += sensors.length;
      sensorOnline += sensors.filter((d) => d.online).length;
    }
    return { subTotal: subs.length, subOnline, sensorTotal, sensorOnline };
  }, [devices, device?.category, device?.deviceId]);

  // 3. 内容
  const resolvedContent = useMemo(
    () => resolveDeviceContent(device, product, contentConfig, childStats),
    [device, product, contentConfig, childStats],
  );
  const label = getDeviceLabel(device, product, isTemplate);
  const subtitle = getSubtitle(device, product);
  const coreValue = getCoreValue(device, product, status);

  const deviceIp = useMemo(() => {
    if (!device || device.category === 'sub') return undefined;
    const md = (device.metadata ?? {}) as Record<string, unknown>;
    const network = (md.network ?? {}) as Record<string, unknown>;
    return (network.ip as string) || (md.ip as string) || undefined;
  }, [device]);

  const parentName = useMemo(() => {
    if (!device || device.category !== 'sub') return undefined;
    const parentId = device.parentDeviceId;
    if (!parentId) return undefined;
    const parentDevice = devices[parentId];
    if (parentDevice) {
      const md = (parentDevice.metadata ?? {}) as Record<string, any>;
      return md.alias || md.deviceName || parentDevice.deviceId || parentId.split('_')[0];
    }
    return parentId.split('_')[0];
  }, [device, devices]);

  // 5. Frame 选择
  // 先把 productCode 规范化为字符串（支持数字/字符串两种格式）
  const normalizedDevicePC = normalizeProductCode(device.productCode);
  const inferredCat = normalizedDevicePC?.includes('-SubController')
    ? 'sub'
    : normalizedDevicePC?.includes('-MainController') || normalizedDevicePC?.includes('-Spray-')
      ? 'main'
      : normalizedDevicePC?.includes('-Sensor-') || normalizedDevicePC?.includes('-Alarm-')
        ? 'sensor'
        : normalizedDevicePC === 'FY002-FlowMeter' || normalizedDevicePC === 'FY002-Pump'
          ? 'auxiliary'
          : normalizedDevicePC === 'FY002-Collector-Wireless' || normalizedDevicePC === 'FY002-Collector-Wired'
            ? 'sub'
            : null;
  const productCode = device.productCode ?? product?.productCode;
  // 规范化 productCode（支持数字/字符串两种格式 → 统一转为 FY002-* 字符串）
  const normalizedPC = normalizeProductCode(productCode);
  const FrameComponent = getDeviceFrame(inferredCat ?? device.category, normalizedPC);
  // sensorType 推断规则（与 DeviceSvgFrames.SensorFrame 视觉分支对齐）：
  //  - 报警型产品（-Alarm-*）→ 对应报警 sensorType
  //    - Touch    : 触控
  //    - Infrared : 红外
  //    - Smoke    : 烟雾
  //    - Dust     : 粉尘报警（18029，highByte.1 位）
  //    - 其他 Alarm-* : 通用 alarm
  //  - 数值型产品（-Sensor-*）→ "numeric"（默认） / "dust"（粉尘浓度 18015）
  //  - 集控器 / 分控器等非 sensor → undefined（不渲染传感器 UI）
  const sensorType:
    | 'numeric'
    | 'dust'
    | 'co'
    | 'ch4'
    | 'temperature'
    | 'wind'
    | 'windPress'
    | 'alarm'
    | 'touch'
    | 'infrared'
    | 'smoke'
    | 'alarm_dust'
    | 'flame'
    | 'alarm_temperature'
    | 'alarm_co'
    | 'top_coal'
    | 'coalCutter'
    | 'frameMove'
    | 'frameDrop'
    | 'vibration'
    | 'cleanWall'
    | 'flowMeter'
    | 'pump'
    | 'collector_wireless'
    | 'collector_wired'
    | undefined =
    inferredCat === 'sensor'
      ? normalizedPC?.includes('-Alarm-CleanWall')
        ? 'cleanWall'
        : normalizedPC?.includes('-Alarm-Touch')
          ? 'touch'
          : normalizedPC?.includes('-Alarm-Infrared')
            ? 'infrared'
            : normalizedPC?.includes('-Alarm-Smoke')
              ? 'smoke'
              : normalizedPC?.includes('-Alarm-Dust')
                ? 'alarm_dust'
                : normalizedPC?.includes('-Alarm-Flame')
                  ? 'flame'
                  : normalizedPC?.includes('-Alarm-Temperature')
                    ? 'alarm_temperature'
                    : normalizedPC?.includes('-Alarm-CO')
                      ? 'alarm_co'
                      : normalizedPC?.includes('-Alarm-TopCoal')
                        ? 'top_coal'
                        : normalizedPC?.includes('-Alarm-CoalCutter')
                          ? 'coalCutter'
                          : normalizedPC?.includes('-Alarm-FrameMovement')
                            ? 'frameMove'
                            : normalizedPC?.includes('-Alarm-FrameDrop')
                              ? 'frameDrop'
                              : normalizedPC?.includes('-Alarm-Vibration')
                                ? 'vibration'
                                : normalizedPC?.includes('-Alarm-')
                                  ? 'alarm'
                                  : normalizedPC?.includes('-Sensor-Dust')
                                    ? 'dust'
                                    : normalizedPC?.includes('-Sensor-CO')
                                      ? 'co'
                                      : normalizedPC?.includes('-Sensor-CH4')
                                        ? 'ch4'
                                        : normalizedPC?.includes('-Sensor-Temp')
                                          ? 'temperature'
                                          : normalizedPC?.includes('-Sensor-WindPress')
                                            ? 'windPress'
                                            : normalizedPC?.includes('-Sensor-Wind')
                                              ? 'wind'
                                              : 'numeric'
      : inferredCat === 'auxiliary'
        ? normalizedPC === 'FY002-FlowMeter'
          ? 'flowMeter'
          : normalizedPC === 'FY002-Pump'
            ? 'pump'
            : undefined
        : inferredCat === 'sub'
          ? normalizedPC === 'FY002-Collector-Wireless'
            ? 'collector_wireless'
            : normalizedPC === 'FY002-Collector-Wired'
              ? 'collector_wired'
              : undefined
          : undefined;
  // 2026-07-21 DEBUG
  // eslint-disable-next-line no-console
  console.log('[CardVariantRenderer sensorType]', {
    deviceId: device.deviceId,
    devicePC: device.productCode,
    normalizedPC,
    inferredCat,
    sensorType,
  });

  const triggered = useMemo(() => {
    if (
      !sensorType ||
      sensorType === 'numeric' ||
      sensorType === 'dust' ||
      sensorType === 'co' ||
      sensorType === 'ch4' ||
      sensorType === 'temperature' ||
      sensorType === 'wind' ||
      sensorType === 'windPress'
    )
      return false;
    // ─── 独立设备触发逻辑 ───
    // 清洗煤壁传感器（18035）：读取 cleanTrigger tag
    if (sensorType === 'cleanWall') {
      const md = (device?.metadata ?? {}) as Record<string, any>;
      const rtClean = (md.realtime as Record<string, any>)?.cleanTrigger;
      const cleanVal = rtClean?.value !== undefined ? rtClean.value : md.cleanTrigger;
      return cleanVal === true;
    }
    // 流量计 / 压力泵 / 采集器：无触发态
    if (sensorType === 'flowMeter' || sensorType === 'pump' || sensorType === 'collector_wireless' || sensorType === 'collector_wired') return false;
    const md = (device?.metadata ?? {}) as Record<string, any>;
    // 优先读 md.realtime.alarm.value（WS tag_values 推送），回退到 md.alarm
    const rtAlarm = (md.realtime as Record<string, any>)?.alarm;
    const alarmVal = rtAlarm?.value !== undefined ? rtAlarm.value : md.alarm;
    return alarmVal === true;
  }, [device?.metadata, sensorType]);

  // 主题色
  const sensorAccentColor = useMemo(() => {
    if (statusVisual.bodyScheme === 'offline') return '#9E9E9E';
    if (triggered) {
      if (sensorType === 'smoke') return '#212121'; // 纯黑 = 浓烟
      if (sensorType === 'touch') return '#1565C0';
      if (sensorType === 'alarm_dust') return '#4E342E'; // 粉尘报警触发 = 深棕
      if (sensorType === 'flame') return '#BF360C'; // 火焰触发 = 深焰橙
      if (sensorType === 'alarm_temperature') return '#C62828'; // 温度报警触发 = 深红
      if (sensorType === 'alarm_co') return '#C62828'; // CO 报警触发 = 深红（有毒气体危险）
      if (sensorType === 'top_coal') return '#FF6F00'; // 放顶煤触发 = 深橙（煤流活跃）
      if (sensorType === 'coalCutter') return '#F57F17'; // 割煤机触发 = 深琥珀（截割活跃）
      if (sensorType === 'frameMove') return '#1B5E20'; // 移架触发 = 深绿（推移中）
      if (sensorType === 'frameDrop') return '#3E2723'; // 落架触发 = 深棕（支架下降）
      if (sensorType === 'vibration') return '#6A1B9A'; // 振动触发 = 深紫（振动活跃）
      if (sensorType === 'cleanWall') return '#00695C'; // 清洗煤壁触发 = 深青绿（水流喷射）
      return '#C62828';
    }
    if (sensorType === 'smoke') return '#FFFFFF'; // 纯白 = 无烟
    if (sensorType === 'infrared') return '#E53935'; // 红外未触发 = 红外红（与 PinFrame/SensorFrame 指示色一致）
    if (sensorType === 'touch') return '#4A7C8A';
    if (sensorType === 'alarm_dust') return '#A1887F'; // 粉尘报警未触发 = 浅棕
    if (sensorType === 'flame') return '#37474F'; // 火焰未触发 = 深石板灰（火焰探测器外壳色）
    if (sensorType === 'alarm_temperature') return '#FF8F00'; // 温度报警未触发 = 琥珀橙（温度计经典色）
    if (sensorType === 'alarm_co') return '#AD1457'; // CO 报警未触发 = 深玫红（有毒气体警示色）
    if (sensorType === 'top_coal') return '#424242'; // 放顶煤未触发 = 煤灰黑（煤炭静态色）
    if (sensorType === 'coalCutter') return '#F9A825'; // 割煤机未触发 = 工业黄
    if (sensorType === 'frameMove') return '#2E7D32'; // 移架未触发 = 工业绿
    if (sensorType === 'frameDrop') return '#5D4037'; // 落架未触发 = 棕色
    if (sensorType === 'vibration') return '#4527A0'; // 振动未触发 = 紫色
    if (sensorType === 'cleanWall') return '#00897B'; // 清洗煤壁未触发 = 青绿（待机）
    if (sensorType === 'flowMeter') return '#1565C0'; // 流量计（独立设备，非传感器）= 深蓝（水流色）
    if (sensorType === 'pump') return '#1A2332'; // 压力泵（独立设备，非传感器）= SCADA深蓝灰（工业仪表盘色）
    if (sensorType === 'collector_wireless') return '#1A3A5C'; // 无线信号采集器 = 深海蓝（无线通信色）
    if (sensorType === 'collector_wired') return '#2E3B4E'; // 有线信号采集器 = 深石墨灰（有线工业色）
    if (sensorType === 'dust') return '#ECEFF1'; // 粉尘浓度（数值型）= 工业灰白（实验室仪器风）
    if (sensorType === 'co') return '#00695C'; // CO 浓度（数值型）= 深青色（电化学传感器工业色）
    if (sensorType === 'ch4') return '#1565C0'; // CH4 浓度（数值型）= 深蓝色（催化燃烧式瓦斯监测工业色）
    if (sensorType === 'temperature') return '#E65100'; // 温度（数值型）= 深橙色（温度计经典色）
    if (sensorType === 'wind') return '#0277BD'; // 风速（数值型）= 浅蓝色（风的颜色）
    if (sensorType === 'windPress') return '#00838F'; // 风压（数值型）= 青蓝色（压力计色）
    return styleConfig?.bodyColor ?? '#607D8B';
  }, [statusVisual.bodyScheme, sensorType, triggered, styleConfig?.bodyColor]);

  // Tooltip 字段：仅使用 faceItems（面板显示字段）
  // 设计原则：屏幕显示（screenContent）只渲染在传感器中间的屏幕上，
  //          面板显示（faceContent）只渲染在右上角悬浮 tooltip 中，
  //          两者完全分离，避免同一字段在两个位置重复显示。
  const isSensor = inferredCat === 'sensor' || device.category === 'sensor';
  const tooltipFields = useMemo<TooltipField[]>(() => {
    if (!isSensor) return [];
    const face = resolvedContent?.faceItems ?? [];
    if (face.length === 0) return [];
    return face.map((item, idx) => ({
      key: item.key,
      label: item.label,
      value: item.value,
      unit: item.unit,
      primary: idx === 0,
    }));
  }, [isSensor, resolvedContent?.faceItems]);

  const showTooltip = isSensor && tooltipFields.length > 0;

  // 6. 动画
  if (animationConfig && status !== 'offline') injectAnimationKeyframes();
  const animActive = status !== 'offline';
  const decoSx = animActive && animationConfig ? getAnimationSx(animationConfig) : {};
  const lineSx = animActive && animationConfig ? getLineEffectSx(animationConfig) : {};
  const lineFilter = animActive && animationConfig ? getLineEffectFilter(animationConfig) : '';
  const lineAnims = animActive && animationConfig ? getLineEffectAnimations(animationConfig) : [];
  const composedSx: any = { ...decoSx, ...lineSx };
  if (lineAnims.length > 0) {
    composedSx.animation = `${(decoSx as any)?.animation ?? ''}${lineAnims.join(', ')}`.trim();
  }

  // === 设备状态机：统一读取状态（响应式，通过 deviceStates 订阅） ===
  const deviceStateName = device ? (deviceStates[device.deviceId] ?? deviceStateMachine.getDeviceStateName(device.deviceId)) : 'offline';
  const isFault = deviceStateName === 'fault';
  const isAlarm = deviceStateName === 'alarm';
  const isWarning = deviceStateName === 'warning';

  return (
    <Box
      ref={containerRef}
      data-thumbnail-renderer="card"
      data-device-status={status}
      data-device-template={isTemplate ? 'true' : undefined}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'visible',
        // 状态转换平滑过渡：boxShadow 在 fault/alarm/normal 之间渐变，避免突变
        transition: 'box-shadow 0.35s ease-in-out',
        ...composedSx,
        ...(lineFilter ? { filter: lineFilter } : {}),
        ...(isFault ? {
          boxShadow: '0 0 0 2px #f44336, 0 0 8px 2px rgba(244,67,54,0.5)',
          animation: 'device-fault-pulse 1.2s ease-in-out infinite',
          '@keyframes device-fault-pulse': {
            '0%, 100%': { boxShadow: '0 0 0 2px #f44336, 0 0 8px 2px rgba(244,67,54,0.5)' },
            '50%': { boxShadow: '0 0 0 2px #f44336, 0 0 16px 4px rgba(244,67,54,0.7)' },
          },
        } : isAlarm ? {
          boxShadow: '0 0 0 2px #ff9800, 0 0 6px 1px rgba(255,152,0,0.4)',
        } : isWarning ? {
          boxShadow: '0 0 0 2px #ff9800, 0 0 4px 1px rgba(255,152,0,0.25)',
        } : {}),
      }}
    >
      <FrameComponent
        status={status}
        statusVisual={statusVisual}
        label={hideScreenContent ? '' : label}
        subtitle={hideScreenContent ? null : subtitle}
        isTemplate={isTemplate}
        hideScreenContent={hideScreenContent}
        bodyColor={styleConfig?.bodyColor}
        screenColor={styleConfig?.screenColor}
        borderColor={styleConfig?.borderColor}
        faceItems={hideScreenContent ? undefined : resolvedContent?.faceItems}
        screenItems={hideScreenContent ? undefined : resolvedContent?.screenItems}
        childStats={childStats}
        deviceIp={deviceIp}
        parentName={parentName}
        coreValue={hideScreenContent ? undefined : coreValue}
        sensorType={sensorType}
        triggered={triggered}
        deviceMetadata={device?.metadata as Record<string, any> | undefined}
        controllerState={device?.category === 'sub' ? extractControllerStateRaw(device as any) ?? undefined : undefined}
      />

      {/* 传感器 Tooltip：基于 SVG 传感器本体的实际渲染位置定位 */}
      {showTooltip && sensorLayout && (
        <SensorTooltip
          fields={tooltipFields}
          statusColor={statusVisual.color}
          accentColor={sensorAccentColor}
          sensorLayout={sensorLayout}
        />
      )}
    </Box>
  );
}

export { ControlPanelRenderer as CardVariantRenderer };

// ─── 传感器 Tooltip ───

interface SensorTooltipProps {
  fields: TooltipField[];
  statusColor: string;
  accentColor: string;
  sensorLayout: { left: number; top: number; width: number; height: number; scale: number };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function SensorTooltip({ fields, statusColor, accentColor, sensorLayout }: SensorTooltipProps) {
  if (fields.length === 0) return null;

  const titleField = fields.find((f) => f.primary);
  const otherFields = fields.filter((f) => !f.primary);

  // 缩放因子：基于 SVG 渲染 scale，但限制下限确保可读性
  const s = Math.max(1.0, Math.min(sensorLayout.scale, 2.5));

  // 字号（保证最小可读尺寸）
  const baseFont = Math.max(11, Math.round(12 * s));
  const labelFont = Math.max(9, Math.round(10 * s));
  // 间距
  const padV = Math.max(4, Math.round(5 * s));
  const padH = Math.max(6, Math.round(7 * s));
  const rowPad = Math.max(2, Math.round(2 * s));
  const dotSize = Math.max(5, Math.round(5 * s));
  const radius = Math.max(3, Math.round(3 * s));

  // 颜色：深色底 + 微妙的主题色边框，不用刺眼的颜色
  const borderColor = hexToRgba(accentColor, 0.35);
  const glowColor = hexToRgba(accentColor, 0.12);
  const scanLineColor = hexToRgba(accentColor, 0.04);

  return (
    <Box
      sx={{
        position: 'absolute',
        left: sensorLayout.left + sensorLayout.width + 4,
        top: sensorLayout.top,
        transform: 'translateY(-2px)',
        zIndex: 9999,
        pointerEvents: 'none',
        // ─── 与报警传感器/其他数值传感器保持统一尺寸 ───
        // 取消 maxWidth 跟随 scale 变化（之前 maxWidth = max(180, 220 * s) 会在高缩放下变成 550px 显得过大）
        // 改为固定 width：与告警型烟雾/温度/红外/触控等保持同一尺寸
        width: 220,
        minWidth: 220,
        minHeight: 40,
        maxWidth: 220,
        whiteSpace: 'nowrap',
        fontSize: baseFont,
        lineHeight: 1.4,
        fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
        bgcolor: 'rgba(10, 14, 24, 0.92)',
        color: '#c8dce8',
        borderRadius: radius,
        border: `1px solid ${borderColor}`,
        boxShadow: `0 0 8px ${glowColor}, 0 2px 8px rgba(0,0,0,0.3)`,
        padding: `${padV}px ${padH}px`,
        // 扫描线
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${scanLineColor} 3px, ${scanLineColor} 4px)`,
          pointerEvents: 'none',
          borderRadius: 'inherit',
        },
      }}
    >
      {titleField && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: Math.round(3 * s),
            mb: rowPad,
            pb: rowPad,
            borderBottom: `1px solid rgba(255,255,255,0.06)`,
          }}
        >
          <Box
            sx={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              bgcolor: statusColor,
              flexShrink: 0,
              boxShadow: `0 0 ${Math.round(3 * s)}px ${statusColor}`,
            }}
          />
          <Box
            sx={{
              fontSize: baseFont,
              fontWeight: 700,
              color: '#e8f0f6',
              flex: '1 1 0',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={titleField.value}
          >
            {titleField.value}
          </Box>
        </Box>
      )}

      {otherFields.map((f, idx) => (
        <Box
          key={f.key}
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: Math.round(4 * s),
            py: Math.round(1 * s),
            minWidth: 0,
            ...(idx > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : {}),
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: labelFont,
              color: 'rgba(160, 185, 200, 0.7)',
              flexShrink: 0,
              fontWeight: 500,
            }}
          >
            {f.label}
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: baseFont,
              color: f.key === 'status' ? '#5cf5c0' : '#e0ecf2',
              fontWeight: f.key === 'status' ? 700 : 400,
              flex: '1 1 0',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={`${f.value}${f.unit ? ` ${f.unit}` : ''}`}
          >
            {f.value}
            {f.unit ? ` ${f.unit}` : ''}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
