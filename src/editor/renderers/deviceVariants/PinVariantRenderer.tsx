/**
 * PinVariantRenderer — 设备图钉变体
 *
 * 适用：CAD/地图上的位置标记
 * 视觉：水滴形定位钉 + 内嵌面板 + 蓝色屏幕 + 反光条
 *       在线态：白色描边 + 呼吸光晕 + 屏幕微光
 *       告警态：橙色脉冲 + 橙色屏幕
 *       离线态：灰色静止
 *
 * 通用化：与边框装饰组件组一样，支持 ANIMATION_SCHEMA 的 14 种动画 + 14 种线条效果
 */
import Box from '@mui/material/Box';
import { computeDeviceStatus, extractControllerStateRaw } from './deviceStatus';
import { ALARM_COLOR, type DeviceVariantRendererProps } from './types';
import { PinFrame, getPinIconType } from './DeviceSvgFrames';
import {
  injectAnimationKeyframes,
  getAnimationSx,
  getLineEffectFilter,
  getLineEffectSx,
  getLineEffectAnimations,
} from '../decorationAnimation';

export function PinVariantRenderer({
  device,
  product: _product,
  width,
  height,
  styleConfig,
  animationConfig,
}: DeviceVariantRendererProps) {
  const size = Math.min(width, height);
  const markerSize = size * 0.7;

  const status = computeDeviceStatus(device, false);
  const iconType = getPinIconType(device.category, device.productCode);

  // 分控器 controllerState 原始字节（驱动 PinFrame 8个LED灯）
  const controllerState = device.category === 'sub' ? extractControllerStateRaw(device as any) ?? undefined : undefined;

  // 压力泵运转状态（用于 PinFrame 状态灯颜色）
  const isPumpRunning = (() => {
    if (device.productCode !== 'FY002-Pump') return false;
    const md = (device?.metadata ?? {}) as Record<string, any>;
    const rtStatus = (md.realtime as Record<string, any>)?.startStatus;
    const rawStatus = rtStatus?.value !== undefined ? rtStatus.value : md.startStatus;
    return rawStatus === 1 || rawStatus === '1' || rawStatus === true;
  })();

  // 面板色：styleConfig 优先，否则按设备分类 + productCode 细分
  // 数值型传感器主体色需与 SensorFrame 卡片变体一致（协议视觉一致性要求）
  const pc = device.productCode ?? '';
  const bodyColor =
    styleConfig?.bodyColor ??
    (device.category === 'main'
      ? '#D93A3A'
      : device.category === 'sub'
        ? '#E67E22'
        : // 数值型传感器：按 productCode 匹配 SensorFrame 主体色
          pc.includes('-Sensor-CO')
          ? '#00695C' // CO 数值型（18013）：深青
          : pc.includes('-Sensor-CH4')
            ? '#1565C0' // CH4 数值型（18012）：深蓝
            : pc.includes('-Sensor-Temp')
              ? '#E65100' // 温度数值型（18014）：深橙
              : pc.includes('-Sensor-WindPress')
                ? '#00838F' // 风压数值型（18011）：青蓝
                : pc.includes('-Sensor-Wind')
                  ? '#0277BD' // 风速数值型（18010）：浅蓝
                  : pc.includes('-Sensor-Dust')
                    ? '#455A64' // 粉尘数值型（18015）：深蓝灰
                    : '#607D8B');

  // 屏幕色：styleConfig 优先，否则按状态
  const screenColor =
    styleConfig?.screenColor ?? (status === 'alarm' ? '#F0A030' : status === 'pending' ? '#FFD54F' : '#5A9ED6');

  // 注入全局动画 keyframes（与边框装饰组共享同一份）
  //    离线时不注入动画
  if (animationConfig && status !== 'offline') injectAnimationKeyframes();

  // 合成通用动画 + 线条效果 sx（离线时跳过）
  const animActive = status !== 'offline';
  const decoSx = animActive && animationConfig ? getAnimationSx(animationConfig) : {};
  const lineSx = animActive && animationConfig ? getLineEffectSx(animationConfig) : {};
  const lineFilter = animActive && animationConfig ? getLineEffectFilter(animationConfig) : '';
  const lineAnims = animActive && animationConfig ? getLineEffectAnimations(animationConfig) : [];
  const composedSx: any = { ...decoSx, ...lineSx };
  if (lineAnims.length > 0) {
    composedSx.animation = `${(decoSx as any)?.animation ?? ''}${lineAnims.join(', ')}`.trim();
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 通用动画/线条效果
        ...composedSx,
        ...(lineFilter ? { filter: lineFilter } : {}),
      }}
    >
      <Box sx={{ width: markerSize, height: markerSize }}>
        <PinFrame
          bodyColor={bodyColor}
          screenColor={screenColor}
          borderColor={styleConfig?.borderColor}
          online={device.online}
          triggered={status === 'alarm'}
          isRunning={isPumpRunning}
          iconType={iconType}
          controllerState={controllerState}
        />
      </Box>

      {/* 告警态脉冲圈（橙色，比离线更醒目） */}
      {status === 'alarm' && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${ALARM_COLOR}`,
            opacity: 0.7,
            animation: 'pin-alarm-pulse 1.2s infinite',
            '@keyframes pin-alarm-pulse': {
              '0%': { opacity: 0.7, transform: 'scale(1)' },
              '50%': { opacity: 0.15, transform: 'scale(1.25)' },
              '100%': { opacity: 0.7, transform: 'scale(1)' },
            },
          }}
        />
      )}

      {/* 离线时的脉冲提示 */}
      {status === 'offline' && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `1px dashed #9e9e9e`,
            opacity: 0.5,
            animation: 'pin-pulse 2s infinite',
            '@keyframes pin-pulse': {
              '0%': { opacity: 0.5, transform: 'scale(1)' },
              '50%': { opacity: 0.1, transform: 'scale(1.1)' },
              '100%': { opacity: 0.5, transform: 'scale(1)' },
            },
          }}
        />
      )}
    </Box>
  );
}
