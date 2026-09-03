/**
 * deviceStatus.ts — 统一从 device + product 抽取屏幕 / Tooltip 所需字段
 *
 * 设计目的：
 * - SVG Frame 只接收规整的 props，不直接吃 device.metadata（结构松散）
 * - 离线 / 在线 / 告警状态统一计算（避免到处写 if-else）
 * - 实时核心数值按 product.category 决定是否展示
 */
import type { DeviceInstance, ProductDefinition } from '../../../types/device';
import { useDeviceStore } from '../../../store/deviceStore';
import type { DeviceStateName } from '../../../store/deviceStateMachine';

// 设备状态：
//  - online/offline/alarm/warning/fault：由状态机计算，优先级 fault > alarm > warning > normal(online) > offline
//  - pending：组件已挂载、deviceId 已绑，但 deviceStore 还没拉到该设备数据
//              （首次进入场景 / 数据源冷启动 / 刚切换 adapter 这几秒内的中间态）
export type DeviceLiveStatus = 'online' | 'offline' | 'alarm' | 'warning' | 'fault' | 'pending';

/** 设备外壳配色方案：
 *  - normal：设备正常形态（红色面板 + 蓝色屏幕 + 黑螺丝 + 红端子）
 *  - offline：设备离线形态（**形状、线条、螺丝、屏幕边框完全一致**，
 *             只把颜色换成灰色系；不再用 CSS filter 避免半透明与失真）
 *            → 8K 大尺寸下螺丝孔/端子/屏幕边框 100% 清晰
 */
export type BodyScheme = 'normal' | 'offline';

// 状态视觉
export interface StatusVisual {
  text: string; // 中文状态文字
  color: string; // 状态点 + 文字色
  bodyScheme: BodyScheme; // 外壳配色方案
  pulse: boolean; // 状态点是否脉冲
}

const VISUALS: Record<DeviceLiveStatus, StatusVisual> = {
  online: { text: '在线', color: '#3CCB7F', bodyScheme: 'normal', pulse: true },
  offline: { text: '离线', color: '#888888', bodyScheme: 'offline', pulse: false },
  alarm: { text: '告警', color: '#F0A030', bodyScheme: 'normal', pulse: true },
  warning: { text: '预警', color: '#FF9800', bodyScheme: 'normal', pulse: true },
  fault: { text: '故障', color: '#ef4444', bodyScheme: 'normal', pulse: true },
  pending: { text: '检查中', color: '#FFC107', bodyScheme: 'normal', pulse: true },
};

/** 状态机状态名 → DeviceLiveStatus 映射 */
function stateNameToLiveStatus(s: DeviceStateName): DeviceLiveStatus {
  switch (s) {
    case 'fault': return 'fault';
    case 'alarm': return 'alarm';
    case 'warning': return 'warning';
    case 'normal': return 'online';
    case 'offline': return 'offline';
  }
}

/** 计算设备当前状态（用于屏幕 + 外壳置灰）
 *  优先从状态机结果读取（deviceStates），回退到手动计算。
 *  - 无 device 数据 + 有 deviceId + store 还在加载中 → pending（黄点脉冲）
 *  - 无 device 数据 + store 已加载完 → offline（产品已注册但该设备实例在数据源里没找到）
 *  - 状态机结果：fault > alarm > warning > normal(online) > offline
 *  - device.online === true 视为在线
 *  - 其余一律离线
 */
export function computeDeviceStatus(
  device: DeviceInstance | null | undefined,
  isPending: boolean = false,
): DeviceLiveStatus {
  if (isPending) return 'pending';
  if (!device) return 'offline';

  // 优先从状态机结果读取
  const smState = useDeviceStore.getState().deviceStates[device.deviceId];
  if (smState) {
    return stateNameToLiveStatus(smState);
  }

  // 回退：手动计算
  const md = (device.metadata ?? {}) as Record<string, any>;
  // P1 修复：metadata.fault 优先于 alarm（与状态机优先级 fault > alarm > online 对齐）
  if (md.fault) return 'fault';
  const rtAlarm = (md.realtime as Record<string, any>)?.alarm;
  const alarmVal = rtAlarm?.value !== undefined ? rtAlarm.value : md.alarm;
  if (alarmVal === true || alarmVal === 1) return 'alarm';
  if (device.online === true) return 'online';
  return 'offline';
}

/** 取状态视觉配置 */
export function getStatusVisual(status: DeviceLiveStatus): StatusVisual {
  return VISUALS[status];
}

/** 屏幕要显示的设备编号（带兜底）
 *  优先级：deviceId → 别名 → deviceName → 产品名 → "未命名"
 *
 *  模板态（isTemplate=true）：优先产品名，因为还没绑实例
 */
export function getDeviceLabel(
  device: DeviceInstance | null | undefined,
  product: ProductDefinition | undefined,
  isTemplate: boolean = false,
): string {
  if (isTemplate) {
    if (product?.productName) return product.productName;
    if (product?.productCode) return product.productCode;
    return '未命名';
  }
  if (device?.deviceId) return String(device.deviceId);
  const md = (device?.metadata ?? {}) as Record<string, any>;
  if (md.alias) return String(md.alias);
  if (md.deviceName) return String(md.deviceName);
  if (product?.productName) return product.productName;
  return '未命名';
}

/** 副标题：产品名（仅在无 deviceId 时显示，便于辨识产品类别） */
export function getSubtitle(
  device: DeviceInstance | null | undefined,
  product: ProductDefinition | undefined,
): string | null {
  if (!product?.productName) return null;
  if (device?.deviceId) return null; // 有 deviceId 时副标题空出，给设备编号
  return product.productName;
}

/** 屏幕右上角核心数值（仅传感器类产品有意义） */
export interface CoreValue {
  text: string; // "4.2" 或 "—"
  unit: string; // "MPa"
  display: boolean; // false 时屏幕不显示该区域
  // 2026-06-15：可视反馈标志
  outOfRange?: boolean; // 数值 > maxRange 或 < minRange → 标红
  overAlarm?: boolean; // 数值 > alarmHigh 或 < alarmLow → 标红+边角"超"字
  // P2-1 增强：电池预警/触发源细分（用于在 SVG 屏幕做专属视觉）
  // - batteryWarning: 烟雾传感器在低电时为 true（控制屏幕变黄/加"低电"字样）
  // - triggerSource : "alarm"=报警触发 / "battery"=电池预警 / "both"=二者 / "normal"=正常
  batteryWarning?: boolean;
  triggerSource?: 'alarm' | 'battery' | 'both' | 'normal';
}

function getProductUnit(product: ProductDefinition | undefined, md: Record<string, any>): string {
  // ProductDefinition 没有 unit 字段，从 metadata 兜底
  if (md?.unit) return String(md.unit);
  // 按 sensorSubType 推断
  const st = product?.sensorSubType;
  if (st === 'wind_pressure') return 'Pa';
  if (st === 'temperature') return '℃';
  if (st === 'ch4') return '%';
  if (st === 'co') return 'ppm';
  if (st === 'wind_speed') return 'm/s';
  if (st === 'dust') return 'mg/m³';
  return '';
}

export function getCoreValue(
  device: DeviceInstance | null | undefined,
  product: ProductDefinition | undefined,
  status: DeviceLiveStatus,
): CoreValue {
  const isSensor = product?.category === 'sensor';
  if (!isSensor) return { text: '', unit: '', display: false };

  // ─── 报警/触控传感器：显示触发状态，不显示数值 ───
  const isAlarmSensor = product?.productCode?.includes('-Alarm-') ?? false;
  if (isAlarmSensor) {
    if (status === 'offline') {
      return { text: '离线', unit: '', display: true };
    }
    const md = (device?.metadata ?? {}) as Record<string, any>;
    // P0-4：报警传感器统一用位域解析（精确：能区分"触发" vs "低电"）
    //       烟雾/红外/触控 都共享 0x0614 协议位域（lowByte 上不同的 bit 位）
    //       其它报警传感器（CO/温度/粉尘/...）走 fallback 路径
    const productCode = product?.productCode ?? '';
    const alarmKind = inferAlarmKindFromProductCode(productCode);
    // P0 修复：同时检查扁平字段和 metadata.realtime 嵌套字段
    // WS 推送的数据存储在 metadata.realtime.{key}.value，而非扁平的 metadata.{key}
    const rt = (md.realtime ?? {}) as Record<string, { value: unknown }>;
    const rtVal = (k: string): unknown => rt?.[k]?.value;
    const hasAlarmBits = md.alarmSensors !== undefined || md.batteryWarning !== undefined
        || rtVal('alarmSensors') !== undefined || rtVal('batteryWarning') !== undefined;
    if (alarmKind && hasAlarmBits) {
      // 合并扁平字段和 realtime 嵌套字段
      const mergedMd = {
        ...md,
        alarmSensors: md.alarmSensors ?? rtVal('alarmSensors'),
        batteryWarning: md.batteryWarning ?? rtVal('batteryWarning'),
        sensorStatusCode: md.sensorStatusCode ?? rtVal('sensorStatusCode'),
      };
      const bit = parseAlarmBitField(mergedMd, alarmKind);
      let text = '正常';
      let batteryWarning = false;
      if (bit.source === 'alarm') text = '触发';
      else if (bit.source === 'battery') {
        text = '低电';
        batteryWarning = true;
      } else if (bit.source === 'both') {
        text = '触发+低电';
        batteryWarning = true;
      }
      // P1-1：sensorStatusCode 异常优先级最高
      if (mergedMd.sensorStatusCode !== undefined) {
        const status = getSmokeSensorStatus(mergedMd);
        if (status.hasError) {
          text = `${text}·${status.summary}`;
        }
      }
      return { text, unit: '', display: true, batteryWarning, triggerSource: bit.source };
    }
    // 其它报警传感器：原逻辑
    const rtAlarm = (md.realtime as Record<string, any>)?.alarm;
    const alarmVal = rtAlarm?.value !== undefined ? rtAlarm.value : md.alarm;
    const triggered = (alarmVal as boolean) === true;
    return { text: triggered ? '触发' : '正常', unit: '', display: true };
  }

  // ─── 数值型传感器：显示实时数值 ───
  if (status === 'offline') {
    return { text: '—', unit: getProductUnit(product, {}), display: true };
  }
  const md = (device?.metadata ?? {}) as Record<string, any>;
  // === 增强：优先取 metadata.realtime 中的最新值（subscribeData 写入），其次取扁平字段 ===
  // 协议依据：edge-conductor data_processor.rs:586-597 后端 WS 推送的 tag 键名为
  //   sensorValue（频率传感器的"传感器的值"，4 byte，0x061e 返回字段）
  //   sensorFrequency（频率传感器的"传感器的频率"，4 byte）
  // 因此优先读取 sensorValue / sensorFrequency；保留 value / pressure / ... 作为兜底兼容。
  const realtime = (md.realtime ?? {}) as Record<string, { value: unknown }>;
  const rtValue = (k: string): unknown => realtime?.[k]?.value;
  const raw =
    rtValue('finalValue') ??
    rtValue('sensorValue') ??
    rtValue('sensorFrequency') ??
    rtValue('value') ??
    rtValue('pressure') ??
    rtValue('flow') ??
    rtValue('temperature') ??
    rtValue('concentration') ??
    md.sensorValue ??
    md.sensorFrequency ??
    md.value ??
    md.pressure ??
    md.flow ??
    md.temperature ??
    md.concentration;
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
  if (isNaN(num)) return { text: '—', unit: getProductUnit(product, md), display: true };
  // 2026-06-15：与设备表 minRange/maxRange/alarmLow/alarmHigh 对比，输出可视反馈标志
  const toNum = (v: unknown): number | undefined =>
    typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : undefined;
  const minR = toNum(md.minRange ?? md.min_range);
  const maxR = toNum(md.maxRange ?? md.max_range);
  const aLow = toNum(md.alarmLow ?? md.alarm_low);
  const aHigh = toNum(md.alarmHigh ?? md.alarm_high);
  const outOfRange = (minR !== undefined && num < minR) || (maxR !== undefined && num > maxR);
  const overAlarm = (aLow !== undefined && num < aLow) || (aHigh !== undefined && num > aHigh);
  return {
    text: num.toFixed(1),
    unit: getProductUnit(product, md),
    display: true,
    outOfRange: outOfRange || undefined,
    overAlarm: overAlarm || undefined,
  };
}

// ─── 通用内容解析：根据用户配置的 tags 从 device.metadata 动态取值 ───

import type { DeviceContentConfig } from './types';

/** 沿点号路径从对象中取值：getNestedVal({a:{b:1}}, "a.b") → 1 */
function getNestedVal(obj: Record<string, any>, path: string): unknown {
  const keys = path.split('.');
  let cur: any = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

/** 根据 ProductTag 的 dataType / enumValues 将原始值格式化为可读文本 */
function formatTagDisplayValue(raw: unknown, tag: ProductDefinition['tags'][number] | undefined): string {
  if (raw === undefined || raw === null) return '—';

  // boolean → 友好文本
  if (typeof raw === 'boolean') {
    // 根据字段语义选择更贴切的措辞
    const id = tag?.id ?? '';
    if (id === 'alarm') return raw ? '已触发' : '未触发';
    if (id === 'batteryWarning' || id.includes('Warning')) return raw ? '低电预警' : '正常';
    if (id === 'online') return raw ? '在线' : '离线';
    return raw ? '是' : '否';
  }

  // enum → 查映射表
  if (tag?.dataType === 'enum' && tag.enumValues) {
    const mapped = tag.enumValues[String(raw)] ?? tag.enumValues[Number(raw)];
    if (mapped) return mapped;
  }

  // { value, unit } 子对象
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const v = (raw as any).value;
    const unit = (raw as any).unit;
    if (v !== undefined) {
      // 递归格式化 value 部分（可能也是 enum/boolean）
      const inner = formatTagDisplayValue(v, tag);
      return unit ? `${inner} ${unit}` : inner;
    }
    return '—';
  }

  // 数字 / 字符串
  if (typeof raw === 'number') {
    const unit = tag?.unit;
    return unit ? `${raw} ${unit}` : String(raw);
  }

  return String(raw);
}

function resolveTagValue(
  device: DeviceInstance | null | undefined,
  product: ProductDefinition | undefined,
  tagId: string,
): { label: string; value: string; unit?: string } {
  const md = (device?.metadata ?? {}) as Record<string, any>;
  const realtime = (md.realtime ?? {}) as Record<string, { value: unknown; unit?: string }>;
  const network = (md.network ?? {}) as Record<string, unknown>;
  const tag = product?.tags?.find((t) => t.id === tagId);

  // 1) 特殊 tag：状态
  if (tagId === '__status__') {
    return { label: '状态', value: device?.online ? '在线' : '离线' };
  }

  // 2) 特殊 tag：设备 ID
  if (tagId === '__deviceId__') {
    return { label: '设备ID', value: device?.deviceId ?? '—' };
  }

  // 3) 特殊 tag：产品名
  if (tagId === '__productName__') {
    return { label: '产品', value: product?.productName ?? '—' };
  }

  // 4) 特殊 tag：IP
  if (tagId === '__ip__') {
    const ip = (network.ip as string) || (md.ip as string);
    return { label: 'IP', value: ip ?? '—' };
  }

  // 5) 特殊 tag：MAC
  if (tagId === '__mac__') {
    return { label: 'MAC', value: (network.mac as string) ?? '—' };
  }

  // 6) 特殊 tag：最后心跳
  if (tagId === '__lastHeartbeat__') {
    const ts = md.lastHeartbeat ?? md.lastSeenAt;
    return { label: '心跳', value: formatRelativeTime(ts as any) };
  }

  // 7) 用户从后端 tags 选出的字段
  //    支持嵌套路径：tagId="spray.sprayPosition" → md.spray.sprayPosition
  //    查找顺序：realtime[tagId] → realtime（嵌套） → md[tagId] → md（嵌套）

  // 7a) realtime 扁平查找
  const rtFlat = realtime?.[tagId];
  if (rtFlat && rtFlat.value !== undefined && rtFlat.value !== null) {
    return {
      label: findTagLabel(product, tagId),
      value: formatTagDisplayValue(rtFlat.value, tag),
      unit: rtFlat.unit ?? tag?.unit,
    };
  }

  // 7b) realtime 嵌套查找（tagId 含点号）
  if (tagId.includes('.')) {
    const rtNested = getNestedVal(realtime as Record<string, any>, tagId);
    if (rtNested !== undefined && rtNested !== null) {
      if (typeof rtNested === 'object' && (rtNested as any).value !== undefined) {
        return {
          label: findTagLabel(product, tagId),
          value: formatTagDisplayValue((rtNested as any).value, tag),
          unit: (rtNested as any).unit ?? tag?.unit,
        };
      }
      return {
        label: findTagLabel(product, tagId),
        value: formatTagDisplayValue(rtNested, tag),
      };
    }
  }

  // 7c) metadata 扁平查找
  const flat = md[tagId];
  if (flat !== undefined && flat !== null) {
    return {
      label: findTagLabel(product, tagId),
      value: formatTagDisplayValue(flat, tag),
    };
  }

  // 7d) metadata 嵌套查找
  if (tagId.includes('.')) {
    const nested = getNestedVal(md, tagId);
    if (nested !== undefined && nested !== null) {
      return {
        label: findTagLabel(product, tagId),
        value: formatTagDisplayValue(nested, tag),
      };
    }
  }

  // 8) 兜底：向父设备 metadata 查找（用于报警传感器从分控器继承喷雾参数等）
  //    只对没有自身网络通道的子设备启用：sensor 类别（特别是 alarm 传感器）
  if (device?.parentDeviceId && product?.category === 'sensor') {
    try {
      const parent = useDeviceStore.getState().devices[device.parentDeviceId];
      if (parent) {
        const pmd = (parent.metadata ?? {}) as Record<string, any>;
        const pRealtime = (pmd.realtime ?? {}) as Record<string, { value: unknown; unit?: string }>;

        // 父设备 realtime 扁平
        const prtFlat = pRealtime?.[tagId];
        if (prtFlat && prtFlat.value !== undefined && prtFlat.value !== null) {
          return {
            label: findTagLabel(product, tagId),
            value: formatTagDisplayValue(prtFlat.value, tag),
            unit: prtFlat.unit ?? tag?.unit,
          };
        }

        // 父设备 realtime 嵌套
        if (tagId.includes('.')) {
          const prtNested = getNestedVal(pRealtime as Record<string, any>, tagId);
          if (prtNested !== undefined && prtNested !== null) {
            const v =
              typeof prtNested === 'object' && (prtNested as any).value !== undefined
                ? (prtNested as any).value
                : prtNested;
            return {
              label: findTagLabel(product, tagId),
              value: formatTagDisplayValue(v, tag),
            };
          }
        }

        // 父设备 metadata 扁平
        const pflat = pmd[tagId];
        if (pflat !== undefined && pflat !== null) {
          return {
            label: findTagLabel(product, tagId),
            value: formatTagDisplayValue(pflat, tag),
          };
        }

        // 父设备 metadata 嵌套
        if (tagId.includes('.')) {
          const pnested = getNestedVal(pmd, tagId);
          if (pnested !== undefined && pnested !== null) {
            return {
              label: findTagLabel(product, tagId),
              value: formatTagDisplayValue(pnested, tag),
            };
          }
        }
      }
    } catch {
      // 兜底失败时静默忽略，避免影响主流程
    }
  }

  return { label: findTagLabel(product, tagId), value: '—' };
}

/** 从 ProductDefinition.tags 中找 label（用于显示） */
function findTagLabel(product: ProductDefinition | undefined, tagId: string): string {
  return product?.tags?.find((t) => t.id === tagId)?.name ?? tagId;
}

/**
 * 内容解析结果：面板 / 屏幕分别返回结构化字段列表
 * - faceItems：面板上展示的字段（通常 1-3 个，比如产品名 + 设备ID）
 * - screenItems：屏幕里展示的字段（通常 2-3 个，比如状态 + 实时值）
 * - layout：用户选择的排列方式
 */
export interface ResolvedContent {
  faceItems: Array<{ key: string; label: string; value: string; unit?: string }>;
  screenItems: Array<{ key: string; label: string; value: string; unit?: string }>;
}

/**
 * 根据用户配置的 contentConfig 解析出实际要展示的字段
 * - 用户没配（faceTags/screenTags = undefined）→ 返回 undefined，让调用方走"自动"逻辑
 * - 用户配了 "__default__" → 等价于没配（兜底为自动）
 */
export function resolveDeviceContent(
  device: DeviceInstance | null | undefined,
  product: ProductDefinition | undefined,
  contentConfig: DeviceContentConfig | undefined,
  childStats?: { subTotal: number; subOnline: number; sensorTotal: number; sensorOnline: number },
): ResolvedContent | undefined {
  if (!contentConfig) return undefined;
  const { faceTags, screenTags } = contentConfig;

  // 两边都没配 → undefined（让渲染器走"自动"逻辑）
  const faceReady = faceTags && faceTags.length > 0 && !(faceTags.length === 1 && faceTags[0] === '__default__');
  const screenReady =
    screenTags && screenTags.length > 0 && !(screenTags.length === 1 && screenTags[0] === '__default__');
  if (!faceReady && !screenReady) return undefined;

  // 解析内置字段
  const resolveBuiltIn = (key: string): { key: string; label: string; value: string; unit?: string } | null => {
    const md = (device?.metadata ?? {}) as Record<string, any>;
    const network = md.network ?? {};
    switch (key) {
      case '__builtin_name__': {
        // 传感器 productName 通常带"传感器"后缀（如"CH4传感器"），
        // 在 Tooltip 标题/第一行显示过于冗长且不友好。
        // 这里针对所有传感器产品做一次简化为短中文名（与 SVG 标记底部的中文名保持一致）。
        const pc = product?.productCode ?? '';
        const shortName: Record<string, string> = {
          // 数值型传感器
          'FY002-Sensor-CH4': '甲烷',
          'FY002-Sensor-CO': '一氧化碳',
          'FY002-Sensor-Dust': '粉尘',
          'FY002-Sensor-Temp': '温度',
          'FY002-Sensor-Wind': '风速',
          'FY002-Sensor-WindPress': '风压',
          // 报警型传感器
          'FY002-Alarm-TopCoal': '放顶煤',
          'FY002-Alarm-Smoke': '烟雾',
          'FY002-Alarm-Touch': '触控',
          'FY002-Alarm-Infrared': '红外',
          'FY002-Alarm-Temperature': '温度',
          'FY002-Alarm-CO': 'CO',
          'FY002-Alarm-Dust': '粉尘',
          'FY002-Alarm-Flame': '火焰',
          'FY002-Alarm-Vibration': '振动',
          'FY002-Alarm-FrameMovement': '移架',
          'FY002-Alarm-FrameDrop': '落架',
          'FY002-Alarm-CoalCutterPosition': '割煤机位置',
        };
        const short = pc ? shortName[pc] : undefined;
        return { key, label: '设备名称', value: short ?? product?.productName ?? device?.deviceId ?? '—' };
      }
      case '__builtin_id__':
        return { key, label: '设备ID', value: device?.deviceId ?? '—' };
      case '__builtin_ip__':
        return { key, label: 'IP', value: (network.ip as string) || (md.ip as string) || '—' };
      case '__builtin_subCount__':
        return { key, label: '分控器', value: `${childStats?.subOnline ?? 0}/${childStats?.subTotal ?? 0}` };
      case '__builtin_sensorCount__':
        return { key, label: '传感器', value: `${childStats?.sensorOnline ?? 0}/${childStats?.sensorTotal ?? 0}` };
      // ─── 分控器专属内置字段（数据来自 deviceStore 计算，不依赖后端未推送的字段） ───
      case '__builtin_sprayStatus__': {
        // 解析 controllerState 位域（后端推送后从 metadata.realtime 或扁平字段读取）
        const realtime = (md.realtime ?? {}) as Record<string, { value: unknown }>;
        const rtVal = (k: string): unknown => realtime?.[k]?.value ?? md[k];
        const frontSpray = !!rtVal('state.frontSpray');
        const rearSpray = !!rtVal('state.rearSpray');
        const cleaning = !!rtVal('state.cleaning');
        const frontForce = !!rtVal('state.frontForceSpray');
        const rearForce = !!rtVal('state.rearForceSpray');
        const frontCleaning = !!rtVal('state.frontCleaning');

        // 如果有任何状态位为 true，拼接显示
        const activeStates: string[] = [];
        if (frontSpray) activeStates.push('前喷');
        if (rearSpray) activeStates.push('后喷');
        if (cleaning) activeStates.push('清洗');
        if (frontForce) activeStates.push('前强喷');
        if (rearForce) activeStates.push('后强喷');
        if (frontCleaning) activeStates.push('前清洗');

        const value = !device?.online ? '离线' : activeStates.length > 0 ? activeStates.join(' ') : '待机';
        return { key, label: '喷洒', value };
      }
      case '__builtin_alarmStatus__':
        return { key, label: '报警', value: (md.alarm as boolean) ? '报警' : '正常' };
      case '__builtin_controllerId__': {
        // 协议字段：0x061e controllers[].controllerId（1字节分控器编号）
        // 从 device.deviceId 中提取最后一段 _xx（分控器编号）
        const did = device?.deviceId ?? '';
        const parts = did.split('_');
        const cid = parts.length > 1 ? parts[parts.length - 1] : did;
        return { key, label: '编号', value: cid };
      }
      case '__builtin_commFault__': {
        // 协议字段：controllerState bit4（0=通讯 1=未通信）
        // 优先读 md.realtime.controllerState，回退到 md.controllerState
        const rtCs = (md.realtime as Record<string, any>)?.controllerState;
        const csVal = rtCs?.value !== undefined ? rtCs.value : md.controllerState;
        const csNum = typeof csVal === 'number' ? csVal : parseInt(String(csVal ?? '0'), 10);
        const fault = (csNum & (1 << 4)) !== 0; // bit4 = 通讯故障
        return { key, label: '通讯', value: fault ? '未通信' : '正常' };
      }
      case '__builtin_subSensorCount__': {
        // 分控器下属传感器数量：直接从 deviceStore 查询 childDevices（与集控器 childStats 逻辑一致）
        const subId = device?.deviceId;
        if (!subId) return { key, label: '传感器', value: '0' };
        const allDevices = useDeviceStore.getState().devices;
        const sensors = Object.values(allDevices).filter((d) => d.parentDeviceId === subId && d.category === 'sensor');
        const onlineSensors = sensors.filter((d) => d.online).length;
        return { key, label: '传感器', value: `${onlineSensors}/${sensors.length}` };
      }
      case '__builtin_parentName__': {
        // 所属分控器/集控器名称：优先从 deviceStore 查找父设备的实际名称
        const parentId = device?.parentDeviceId;
        if (!parentId) return { key, label: '所属', value: '—' };
        try {
          const parentDevice = useDeviceStore.getState().devices[parentId];
          if (parentDevice) {
            const pmd = (parentDevice.metadata ?? {}) as Record<string, any>;
            const name = pmd.alias ?? pmd.deviceName ?? parentDevice.productName ?? parentDevice.deviceId;
            return { key, label: '所属', value: String(name) };
          }
        } catch {
          /* fallback */
        }
        // 兜底：从 parentId 中提取可读部分
        return { key, label: '所属', value: parentId.split('_').slice(0, -1).join('_') || parentId };
      }
      // ─── 报警传感器专属内置字段 ───
      case '__builtin_onlineStatus__': {
        return { key, label: '在线', value: device?.online ? '在线' : '离线' };
      }
      case '__builtin_alarmTrigger__': {
        // 优先读 md.realtime.alarm.value（WS tag_values 推送），回退到 md.alarm（初始值）
        const rtAlarm = (md.realtime as Record<string, any>)?.alarm;
        const alarmVal = rtAlarm?.value !== undefined ? rtAlarm.value : md.alarm;
        const triggered = (alarmVal as boolean) === true;
        // 按 productCode 子类型语义化文案（协议数据相同，仅物理意义不同）
        const pc = product?.productCode ?? '';
        const isInfrared = pc.includes('-Alarm-Infrared');
        const isTouch = pc.includes('-Alarm-Touch');
        const isDust = pc.includes('-Alarm-Dust');
        const isSmoke = pc.includes('-Alarm-Smoke');
        const isCO = pc.includes('-Alarm-CO');
        const isFlame = pc.includes('-Alarm-Flame');
        const isVibration = pc.includes('-Alarm-Vibration');
        const isTemp = pc.includes('-Alarm-Temperature');
        const isTopCoal = pc.includes('-Alarm-TopCoal');
        const isFrameDrop = pc.includes('-Alarm-FrameDrop');
        const isFrameMove = pc.includes('-Alarm-FrameMove');
        const isCoalCutter = pc.includes('-Alarm-CoalCutter');
        const value = isInfrared
          ? triggered
            ? '光束遮挡'
            : '对射正常'
          : isTouch
            ? triggered
              ? '已触控'
              : '正常'
            : isDust
              ? triggered
                ? '浓度越限'
                : '正常'
              : isSmoke
                ? triggered
                  ? '检测到烟雾'
                  : '正常'
                : isCO
                  ? triggered
                    ? 'CO超标'
                    : '正常'
                  : isFlame
                    ? triggered
                      ? '检测到火焰'
                      : '正常'
                    : isVibration
                      ? triggered
                        ? '检测到振动'
                        : '正常'
                      : isTemp
                        ? triggered
                          ? '温度越限'
                          : '正常'
                        : isTopCoal
                          ? triggered
                            ? '放煤中'
                            : '待机'
                          : isFrameDrop
                            ? triggered
                              ? '已落架'
                              : '正常'
                            : isFrameMove
                              ? triggered
                                ? '已移架'
                                : '正常'
                              : isCoalCutter
                                ? triggered
                                  ? '割煤机到位'
                                  : '正常'
                                : triggered
                                  ? '已触发'
                                  : '正常';
        return { key, label: '触发', value };
      }
      case '__builtin_batteryWarn__': {
        // 优先读 md.realtime.batteryWarning.value（WS tag_values 推送），回退到 md.batteryWarning
        const rtBw = (md.realtime as Record<string, any>)?.batteryWarning;
        const bwVal = rtBw?.value !== undefined ? rtBw.value : md.batteryWarning;
        const warn = (bwVal as boolean) === true;
        return { key, label: '电池', value: warn ? '低电预警' : '正常' };
      }
      case '__builtin_alarmSource__': {
        // 协议字段：alarm + batteryWarning 两位独立可读，合法组合解读
        const rtAlarmSrc = (md.realtime as Record<string, any>)?.alarm;
        const alarmValSrc = rtAlarmSrc?.value !== undefined ? rtAlarmSrc.value : md.alarm;
        const triggeredSrc = (alarmValSrc as boolean) === true;
        const rtBwSrc = (md.realtime as Record<string, any>)?.batteryWarning;
        const bwValSrc = rtBwSrc?.value !== undefined ? rtBwSrc.value : md.batteryWarning;
        const batteryWarnSrc = (bwValSrc as boolean) === true;
        const value =
          triggeredSrc && batteryWarnSrc
            ? '浓度越限+电池欠压'
            : triggeredSrc
              ? '浓度越限'
              : batteryWarnSrc
                ? '电池欠压'
                : '—';
        return { key, label: '告警源', value };
      }
      case '__builtin_statusCode__': {
        // 协议字段：sensorStatusCode（字段解析规则.json:532-588）
        //   2 字节位域，lowByte bits 0-6 各代表一种独立状态：
        //   bit0=未设置 / bit1=读配置错误 / bit2=写配置错误 / bit3=未连接设备
        //   bit4=断网 / bit5=超预设置 / bit6=超量程 / bit7=预留
        const rtSc = (md.realtime as Record<string, any>)?.sensorStatusCode;
        const rawSc = rtSc?.value !== undefined ? rtSc.value : md.sensorStatusCode;
        const scNum = typeof rawSc === 'number' ? rawSc : parseInt(String(rawSc ?? ''), 10);
        if (!Number.isFinite(scNum) || scNum === 0) {
          return { key, label: '状态码', value: scNum === 0 ? '正常' : '—' };
        }
        const STATUS_BITS: { bit: number; label: string }[] = [
          { bit: 0, label: '未设置' },
          { bit: 1, label: '读配置错误' },
          { bit: 2, label: '写配置错误' },
          { bit: 3, label: '未连接设备' },
          { bit: 4, label: '断网' },
          { bit: 5, label: '超预设置' },
          { bit: 6, label: '超量程' },
        ];
        const active = STATUS_BITS.filter(({ bit }) => (scNum & (1 << bit)) !== 0).map(({ label }) => label);
        return { key, label: '状态码', value: active.length > 0 ? active.join('|') : '正常' };
      }
      case '__builtin_alarmRegistered__': {
        // 协议字段：alarmSensorInfo（字段解析规则.json:376-469）
        //   2 字节位域，每个 bit 代表一种报警传感器是否已注册：
        //   lowByte: bit0=割煤机位置 bit1=移架 bit2=落架 bit3=放顶煤 bit4=烟雾 bit5=温度 bit6=红外 bit7=触控
        //   highByte: bit0=振动 bit1=粉尘 bit2=CO bit3=火焰 bit4-7=预留
        const rtReg = (md.realtime as Record<string, any>)?.alarmSensorInfo;
        const rawReg = rtReg?.value !== undefined ? rtReg.value : md.alarmSensorInfo;
        if (rawReg === undefined || rawReg === null) {
          return { key, label: '注册', value: '—' };
        }
        const regNum = typeof rawReg === 'number' ? rawReg : parseInt(String(rawReg), 10);
        if (!Number.isFinite(regNum)) {
          return { key, label: '注册', value: '—' };
        }
        // 根据 productCode 确定当前传感器对应的 bit 位
        const pc = product?.productCode ?? '';
        const SENSOR_BIT_MAP: { code: string; bit: number; name: string }[] = [
          { code: '-Alarm-CoalCutter', bit: 0, name: '割煤机位置' },
          { code: '-Alarm-FrameMove', bit: 1, name: '移架' },
          { code: '-Alarm-FrameDrop', bit: 2, name: '落架' },
          { code: '-Alarm-TopCoal', bit: 3, name: '放顶煤' },
          { code: '-Alarm-Smoke', bit: 4, name: '烟雾' },
          { code: '-Alarm-Temperature', bit: 5, name: '温度' },
          { code: '-Alarm-Infrared', bit: 6, name: '红外' },
          { code: '-Alarm-Touch', bit: 7, name: '触控' },
          { code: '-Alarm-Vibration', bit: 8, name: '振动' },
          { code: '-Alarm-Dust', bit: 9, name: '粉尘' },
          { code: '-Alarm-CO', bit: 10, name: 'CO' },
          { code: '-Alarm-Flame', bit: 11, name: '火焰' },
        ];
        const match = SENSOR_BIT_MAP.find(({ code }) => pc.includes(code));
        if (!match) {
          // 未知传感器类型，显示总注册数
          const total = SENSOR_BIT_MAP.filter(({ bit }) => (regNum & (1 << bit)) !== 0).length;
          return { key, label: '注册', value: total > 0 ? `已注册${total}项` : '未注册' };
        }
        const registered = (regNum & (1 << match.bit)) !== 0;
        return { key, label: '注册', value: registered ? '已注册' : '未注册' };
      }
      // ─── 独立设备内置字段（不复用通用分支） ───
      // 清洗煤壁传感器（18035）：cleanTrigger（清洗触发状态）
      case '__builtin_cleanTrigger__': {
        const rt = (md.realtime as Record<string, any>)?.cleanTrigger;
        const raw = rt?.value !== undefined ? rt.value : md.cleanTrigger;
        if (raw === true) return { key, label: '清洗触发', value: '触发中' };
        if (raw === false) return { key, label: '清洗触发', value: '待机' };
        return { key, label: '清洗触发', value: '—' };
      }
      // 流量计（18040）：instantFlow（瞬时流量）/ totalFlow（累计流量）
      case '__builtin_instantFlow__': {
        const rt = (md.realtime as Record<string, any>)?.instantFlow;
        const raw = rt?.value !== undefined ? rt.value : md.instantFlow;
        if (raw === undefined || raw === null) return { key, label: '瞬时流量', value: '—' };
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
        if (!Number.isFinite(num)) return { key, label: '瞬时流量', value: '—' };
        return { key, label: '瞬时流量', value: `${num.toFixed(1)} L/min` };
      }
      case '__builtin_totalFlow__': {
        const rt = (md.realtime as Record<string, any>)?.totalFlow;
        const raw = rt?.value !== undefined ? rt.value : md.totalFlow;
        if (raw === undefined || raw === null) return { key, label: '累计流量', value: '—' };
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
        if (!Number.isFinite(num)) return { key, label: '累计流量', value: '—' };
        return { key, label: '累计流量', value: `${num.toFixed(0)} L` };
      }
      // 压力泵（18041）：startStatus（启动状态：0=停止 1=运行）
      case '__builtin_startStatus__': {
        const rt = (md.realtime as Record<string, any>)?.startStatus;
        const raw = rt?.value !== undefined ? rt.value : md.startStatus;
        if (raw === undefined || raw === null) return { key, label: '启动状态', value: '—' };
        const num = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
        if (!Number.isFinite(num)) return { key, label: '启动状态', value: '—' };
        if (num === 1) return { key, label: '启动状态', value: '运行' };
        if (num === 0) return { key, label: '启动状态', value: '停止' };
        return { key, label: '启动状态', value: String(num) };
      }
      case '__builtin_sprayConfig__': {
        // 喷雾配置紧凑摘要（一行显示，适合小屏幕）
        // 数据来源优先级：
        //   1. 自身 md.realtime["spray.xxx"].value（WS tag_values 推送）
        //   2. 父设备（集控器）的 md.realtime["spray.xxx"].value
        //   3. md.spray[k] 对象格式（兼容旧数据）
        const rt = md.realtime as Record<string, any> | undefined;
        const spray = md.spray as Record<string, any> | undefined;
        // 沿父设备链向上查找喷雾参数（报警传感器→分控器→集控器）
        let ancestorRt: Record<string, any> | undefined;
        try {
          let curId: string | undefined = device?.parentDeviceId;
          let depth = 0;
          while (curId && depth < 5) {
            const ancestor = useDeviceStore.getState().devices[curId];
            if (!ancestor) break;
            const amd = (ancestor.metadata ?? {}) as Record<string, any>;
            const art = amd.realtime as Record<string, any> | undefined;
            if (art && art['spray.sprayPosition']?.value !== undefined) {
              ancestorRt = art;
              break;
            }
            curId = ancestor.parentDeviceId;
            depth++;
          }
        } catch {
          /* fallback */
        }
        const gv = (k: string): unknown => {
          // 1) 自身 WS tag_values: md.realtime["spray.xxx"].value
          const rtEntry = rt?.[`spray.${k}`];
          if (rtEntry?.value !== undefined) return rtEntry.value;
          // 2) 祖先设备 WS tag_values（沿 parentDeviceId 链查找）
          const ancEntry = ancestorRt?.[`spray.${k}`];
          if (ancEntry?.value !== undefined) return ancEntry.value;
          // 3) md.spray[k] 对象格式（兼容旧数据）
          if (spray) {
            const v = spray[k];
            return typeof v === 'object' && v !== null ? (v as any).value : v;
          }
          return undefined;
        };
        const posMap: Record<string, string> = { '0': '前喷', '1': '后喷', '2': '前后喷' };
        const dirMap: Record<string, string> = { '0': '上风向', '1': '下风向' };
        const parts: string[] = [];
        const pos = gv('sprayPosition');
        if (pos !== undefined) parts.push(posMap[String(pos)] ?? String(pos));
        const dir = gv('windDirection');
        if (dir !== undefined) parts.push(dirMap[String(dir)] ?? String(dir));
        const interval = gv('waterCurtainInterval');
        if (interval !== undefined) parts.push(`间隔${interval}`);
        const count = gv('waterCurtainCount');
        if (count !== undefined) parts.push(`幕数${count}`);
        const delay = gv('sprayDelayTime');
        if (delay !== undefined) parts.push(`延时${delay}ms`);
        return { key, label: '喷雾', value: parts.length > 0 ? parts.join(' | ') : '—' };
      }
      default:
        return null;
    }
  };

  const resolveAll = (tags: string[] | undefined) =>
    (tags ?? [])
      .filter((t) => t !== '__default__')
      // 跳过已从产品定义中移除的过期 tag（如喷雾参数从 tags 迁移到 configSchema 后）
      .filter((t) => {
        if (t.startsWith('__builtin_')) return true;
        if (t.startsWith('__')) return true; // 特殊 tag（__status__ 等）
        // 向后兼容：online 已从数值型传感器 tags 中移除（由 __builtin_onlineStatus__ 覆盖），
        // 但旧配置中可能仍包含 "online"，需要放行
        if (t === 'online') return true;
        // product 缺失/未加载时不再盲目过滤掉用户勾选的 tag
        // 兜底逻辑：resolveTagValue 内部会处理 product 为空的情况（用 tagId 直接从 metadata 兜底取值）
        if (!product || !product.tags) return true;
        return product.tags.some((pt) => pt.id === t);
      })
      .map((t) => {
        // 优先解析内置字段
        const builtIn = resolveBuiltIn(t);
        if (builtIn) return builtIn;
        return { key: t, ...resolveTagValue(device, product, t) };
      });

  return {
    faceItems: resolveAll(faceTags),
    screenItems: resolveAll(screenTags),
  };
}

export interface TooltipField {
  key: string;
  label: string;
  value: string;
  unit?: string;
  primary?: boolean;
}

/** 相对时间格式化（如 "2 分钟前"） */
export function formatRelativeTime(ts: number | string | undefined, now: number = Date.now()): string {
  if (!ts) return '—';
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  if (isNaN(t)) return '—';
  const diff = Math.max(0, now - t);
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

/** 抽取 Tooltip 所需字段（仅返回有值的）
 *  分控器不显示独立 IP/MAC/心跳（通过集控器无线通信，无网络接口）
 */
export function buildTooltipFields(
  device: DeviceInstance | null | undefined,
  product: ProductDefinition | undefined,
  status: DeviceLiveStatus,
  visual: StatusVisual,
  isTemplate: boolean = false,
): TooltipField[] {
  const fields: TooltipField[] = [];

  // 标题行：产品名 + 设备ID（有 deviceId 时合并显示）
  const title = product?.productName ?? '未知设备';
  const id = device?.deviceId ? device.deviceId : '';
  fields.push({
    key: 'title',
    label: '',
    value: id ? `${title} · ${id}` : title,
    primary: true,
  });

  // 状态
  fields.push({
    key: 'status',
    label: '状态',
    value: isTemplate ? '产品模板' : visual.text,
  });

  // 模板态：额外加一行产品码说明
  if (isTemplate && product?.productCode) {
    fields.push({ key: 'productCode', label: '产品码', value: product.productCode });
  }

  const md = (device?.metadata ?? {}) as Record<string, any>;
  // 故障原因（WS 推送 fault_reason，有值时在状态行下方展示）
  if (!isTemplate && md.faultReason) {
    fields.push({ key: 'faultReason', label: '故障', value: String(md.faultReason) });
  }

  const network = md.network ?? {};
  const isSub = product?.category === 'sub' || device?.category === 'sub';

  // ─── 报警传感器不显示 IP/MAC（绑定在分控器上，无独立网络接口） ───
  const isAlarmSensor = product?.category === 'sensor' && (product?.productCode?.includes('-Alarm-') ?? false);
  if (!isSub && !isAlarmSensor) {
    if (network.ip) fields.push({ key: 'ip', label: 'IP', value: String(network.ip) });
    if (network.mac) fields.push({ key: 'mac', label: 'MAC', value: String(network.mac) });
  }

  // 地址（集控器/传感器均可显示）
  if (network.address || md.location) {
    fields.push({ key: 'address', label: '地址', value: String(network.address ?? md.location) });
  }
  if (md.firmware || md.version) {
    fields.push({ key: 'firmware', label: '固件', value: String(md.firmware ?? md.version) });
  }

  // ─── 分控器专属：显示所属集控器名称 ───
  if (isSub && device?.parentDeviceId) {
    let parentLabel = device.parentDeviceId;
    try {
      const parentDev = useDeviceStore.getState().devices[device.parentDeviceId];
      if (parentDev) {
        const pmd = (parentDev.metadata ?? {}) as Record<string, any>;
        parentLabel = pmd.alias ?? pmd.deviceName ?? parentDev.productName ?? parentDev.deviceId;
      }
    } catch {
      /* fallback */
    }
    fields.push({
      key: 'parentDevice',
      label: '集控器',
      value: String(parentLabel),
    });
  }

  // 最后心跳（分控器和报警传感器不显示独立心跳，由集控器统一管理）
  if (!isSub && !isAlarmSensor) {
    const lastSeen = md.lastSeenAt ?? md.lastHeartbeat ?? device?.metadata?.lastHeartbeat;
    if (lastSeen) {
      fields.push({
        key: 'lastSeen',
        label: '最后心跳',
        value: formatRelativeTime(lastSeen as any),
      });
    } else if (status === 'offline') {
      fields.push({ key: 'lastSeen', label: '最后心跳', value: '未上报' });
    }
  }

  // 实时数据（仅传感器）
  if (product?.category === 'sensor') {
    if (isAlarmSensor) {
      // ─── 报警/触控传感器：显示触发状态和电池预警，不显示数值 ───
      const rtAlarm = (md.realtime as Record<string, any>)?.alarm;
      const alarmVal = rtAlarm?.value !== undefined ? rtAlarm.value : md.alarm;
      const triggered = (alarmVal as boolean) === true;
      fields.push({
        key: 'triggered',
        label: '触发',
        value: triggered ? '已触发' : '未触发',
      });
      // P1-2：触发态下显示触发时间（最近一次 enter）+ 触发源（精确到 sensor 位的来源）
      // P3-4 增强：触发源/触发时间对所有走位域解析的报警传感器（smoke/infrared/touch）开放
      if (triggered) {
        const alarmKind = inferAlarmKindFromProductCode(product?.productCode);
        if (alarmKind && (md.alarmSensors !== undefined || md.batteryWarning !== undefined)) {
          const bit = parseAlarmBitField(md, alarmKind);
          let sourceText: string;
          if (bit.source === 'alarm') sourceText = '报警信号';
          else if (bit.source === 'battery') sourceText = '电池预警';
          else if (bit.source === 'both') sourceText = '报警+电池';
          else sourceText = '未知';
          fields.push({ key: 'triggerSource', label: '触发源', value: sourceText });
        }
        // 触发时间：优先从 alarmHistoryStore 拉最近一次 enter；回退到 md.alarmAt
        let triggerTime: number | undefined;
        if (device?.deviceId) {
          try {
            // 动态 require 避免循环依赖（deviceStatus.ts 已经被 deviceStore 引用）
            const { useAlarmHistoryStore } =
              require('../../../store/alarmHistoryStore') as typeof import('../../../store/alarmHistoryStore');
            const records = useAlarmHistoryStore.getState().records;
            const latestEnter = records
              .filter((r) => r.deviceId === device.deviceId && r.type === 'enter')
              .sort((a, b) => b.timestamp - a.timestamp)[0];
            if (latestEnter) triggerTime = latestEnter.timestamp;
          } catch {
            /* 静默忽略 */
          }
        }
        if (!triggerTime) {
          const t = md.alarmAt ?? md.triggeredAt;
          if (typeof t === 'number') triggerTime = t;
          else if (typeof t === 'string') {
            const parsed = Date.parse(t);
            if (!isNaN(parsed)) triggerTime = parsed;
          }
        }
        if (triggerTime) {
          fields.push({
            key: 'triggerTime',
            label: '触发时间',
            value: formatRelativeTime(triggerTime),
          });
        }
      }
      // 电池预警 — 优先读 md.realtime.batteryWarning.value（WS 实时推送），回退到 md.batteryWarning
      // P0-1 优化：始终显示"电池"行（"正常"/"低电预警"），让用户一眼看到设备电量状态，
      //         而非仅在低电时才显示（容易漏看）
      const rtBw = (md.realtime as Record<string, any>)?.batteryWarning;
      const bwVal = rtBw?.value !== undefined ? rtBw.value : md.batteryWarning;
      const batteryWarn = (bwVal as boolean) === true;
      fields.push({
        key: 'batteryWarning',
        label: '电池',
        value: batteryWarn ? '低电预警' : '正常',
      });
      // 喷雾参数 — 从 md.realtime["spray.xxx"].value 读取（WS tag_values），
      // 沿父设备链查找（报警传感器→分控器→集控器，0x0614 响应挂在集控器上）
      let sprayAncestorRt: Record<string, any> | undefined;
      try {
        let curId: string | undefined = device?.parentDeviceId;
        let depth = 0;
        while (curId && depth < 5) {
          const ancestor = useDeviceStore.getState().devices[curId];
          if (!ancestor) break;
          const amd = (ancestor.metadata ?? {}) as Record<string, any>;
          const art = amd.realtime as Record<string, any> | undefined;
          if (art && art['spray.sprayPosition']?.value !== undefined) {
            sprayAncestorRt = art;
            break;
          }
          curId = ancestor.parentDeviceId;
          depth++;
        }
      } catch {
        /* fallback */
      }
      const gvSpray = (k: string): unknown => {
        const rtEntry = (md.realtime as Record<string, any>)?.[`spray.${k}`];
        if (rtEntry?.value !== undefined) return rtEntry.value;
        const ancEntry = sprayAncestorRt?.[`spray.${k}`];
        if (ancEntry?.value !== undefined) return ancEntry.value;
        return undefined;
      };
      const sprayPos = gvSpray('sprayPosition');
      if (sprayPos !== undefined) {
        const posMap: Record<string, string> = { '0': '前喷', '1': '后喷', '2': '前后喷' };
        fields.push({ key: 'sprayPosition', label: '喷洒', value: posMap[String(sprayPos)] ?? String(sprayPos) });
      }
      const sprayDir = gvSpray('windDirection');
      if (sprayDir !== undefined) {
        const dirMap: Record<string, string> = { '0': '上风向', '1': '下风向' };
        fields.push({ key: 'windDirection', label: '风向', value: dirMap[String(sprayDir)] ?? String(sprayDir) });
      }
      const sprayDelay = gvSpray('sprayDelayTime');
      if (sprayDelay !== undefined) {
        fields.push({ key: 'sprayDelayTime', label: '延时', value: `${sprayDelay} ms` });
      }
    } else {
      // ─── 数值型传感器：显示实时值 ───
      const v = md.value ?? md.pressure ?? md.flow ?? md.temperature;
      if (typeof v === 'number') {
        const unit = getProductUnit(product, md);
        const labelHint = product?.productName?.includes('压力')
          ? '压力'
          : product?.productName?.includes('流量')
            ? '流量'
            : product?.productName?.includes('温度')
              ? '温度'
              : product?.sensorSubType === 'wind_pressure'
                ? '风压'
                : product?.sensorSubType === 'temperature'
                  ? '温度'
                  : '实时值';
        fields.push({ key: 'value', label: labelHint, value: `${v.toFixed(2)} ${unit}`.trim() });
      }
    }
  }

  return fields;
}

// ============================================================================
// P0-4：协议 alarmSensors / batteryWarning 位域解析
// ----------------------------------------------------------------------------
// 协议定义：alarmSensors 是 2 字节位域（lowByte + highByte），每个 bit 对应一个传感器
// 烟雾传感器固定占 lowByte.4（与协议文档《字段解析规则.json》一致）
// bit = 1 → "有"（触发 / 低电），bit = 0 → "无"（正常）
//
// 后端（edge-conductor + 云端）当前把整个位域直接塞到 md.alarmSensors / md.batteryWarning，
// 传过来时通常是 number（2 字节 0~65535）或 "0x00FF" 字符串。
// 解析后产出 typed 对象，供 getCoreValue / buildTooltipFields 增强使用。
// ============================================================================

/** 报警传感器子类型 → 位域位置
 *  协议 0x0614 中 alarmSensors / batteryWarning 是统一的 2 字节位域，每个 bit 对应 1 个报警传感器
 *  当前已注册的产品（位域为 0x0614 中 alarmSensors/batteryWarning 上的 bit）：
 *  - smoke     : 烟雾   → lowByte.4
 *  - infrared  : 红外   → lowByte.6
 *  - touch     : 触控   → lowByte.7
 *  - dustAlarm : 粉尘报警 → highByte.1  （数值型粉尘 18015 不在此列，18029 才是）
 *  未来新增报警传感器（CO/温度/火焰/振动/...）只需在此处追加 1 行
 */
export const ALARM_SENSOR_BIT_POS: Record<string, { byte: 'lowByte' | 'highByte'; bit: number }> = {
  // 协议字段解析规则.json: alarmSensors / batteryWarning / alarmSensorInfo 位域定义
  // lowByte（bit 0-7）
  coalCutter: { byte: 'lowByte', bit: 0 }, // 割煤机位置 18020
  frameMove: { byte: 'lowByte', bit: 1 }, // 移架 18021
  frameDrop: { byte: 'lowByte', bit: 2 }, // 落架 18022
  topCoal: { byte: 'lowByte', bit: 3 }, // 放顶煤 18023
  smoke: { byte: 'lowByte', bit: 4 }, // 烟雾 18024
  temperature: { byte: 'lowByte', bit: 5 }, // 温度报警 18025
  infrared: { byte: 'lowByte', bit: 6 }, // 红外 18026
  touch: { byte: 'lowByte', bit: 7 }, // 触控 18027
  // highByte（bit 0-3，4-7 预留）
  vibration: { byte: 'highByte', bit: 0 }, // 振动 18028
  dustAlarm: { byte: 'highByte', bit: 1 }, // 粉尘报警 18029
  co: { byte: 'highByte', bit: 2 }, // CO 18030
  flame: { byte: 'highByte', bit: 3 }, // 火焰 18031
};

/** 报警传感器在报警位域中的详细状态（P0-4 输出，P3-1 扩展为通用） */
export interface AlarmBitField {
  /** 触发位：true=触发 / false=正常 */
  triggered: boolean;
  /** 电池预警位：true=低电 / false=正常 */
  batteryWarning: boolean;
  /** 触发的可能来源（用于面板上"触发原因"提示）：
   *  - "alarm"    : alarm 位置 1
   *  - "battery"  : battery 位置 1
   *  - "both"     : 两个位都置 1
   *  - "normal"   : 都没置 1
   */
  source: 'alarm' | 'battery' | 'both' | 'normal';
}

/** 报警传感器子类型取值：
 *  - smoke/infrared/touch/temperature/... : 报警传感器子类型
 *  - string                              : 兼容未来扩展
 */
export type AlarmSensorKind =
  | 'smoke'
  | 'touch'
  | 'infrared'
  | 'dustAlarm'
  | 'temperature'
  | 'flame'
  | 'vibration'
  | 'co'
  | 'topCoal'
  | 'frameDrop'
  | 'frameMove'
  | 'coalCutter'
  | string;

/** productCode 后缀 → alarm sensor kind（与 ALARM_SENSOR_BIT_POS 配合使用）
 *  示例：FY002-Alarm-Smoke       → "smoke"
 *        FY002-Alarm-Dust        → "dustAlarm"
 *        FY002-Alarm-Temperature → "temperature"
 *  返回 undefined 表示该产品不是当前支持的报警传感器子类型
 */
export function inferAlarmKindFromProductCode(productCode: string | undefined | null): AlarmSensorKind | undefined {
  if (!productCode) return undefined;
  if (productCode.includes('-Alarm-Smoke')) return 'smoke';
  if (productCode.includes('-Alarm-Infrared')) return 'infrared';
  if (productCode.includes('-Alarm-Touch')) return 'touch';
  if (productCode.includes('-Alarm-Dust')) return 'dustAlarm';
  if (productCode.includes('-Alarm-Temperature')) return 'temperature';
  if (productCode.includes('-Alarm-Flame')) return 'flame';
  if (productCode.includes('-Alarm-Vibration')) return 'vibration';
  if (productCode.includes('-Alarm-CO')) return 'co';
  if (productCode.includes('-Alarm-TopCoal')) return 'topCoal';
  if (productCode.includes('-Alarm-FrameDrop')) return 'frameDrop';
  if (productCode.includes('-Alarm-FrameMove')) return 'frameMove';
  if (productCode.includes('-Alarm-CoalCutter')) return 'coalCutter';
  return undefined;
}

/** 把 1 个 2 字节位域（number / 0x字符串 / 数组）归一为 number */
function normalizeBitField(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw & 0xffff;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      const n = parseInt(trimmed, 16);
      return Number.isNaN(n) ? 0 : n & 0xffff;
    }
    const n = parseInt(trimmed, 10);
    return Number.isNaN(n) ? 0 : n & 0xffff;
  }
  if (Array.isArray(raw) && raw.length >= 2) {
    // [lowByte, highByte] 数组
    const lo = (Number(raw[0]) || 0) & 0xff;
    const hi = (Number(raw[1]) || 0) & 0xff;
    return (hi << 8) | lo;
  }
  return 0;
}

/** 解析指定报警传感器在 alarmSensors / batteryWarning 两个位域中的位状态
 *  - 若位域数据缺失/为 0，返回 { triggered:false, batteryWarning:false, source:"normal" }
 *  - 即使单个位域数据缺省也会走另一路（如 alarm 缺，只看 battery）
 *  - 若 kind 未在 ALARM_SENSOR_BIT_POS 中注册，返回 normal
 *
 *  P3-1：原 parseSmokeAlarmBitField 通用化，所有 -Alarm-* 子类型共用同一套解析
 */
export function parseAlarmBitField(md: Record<string, any> | null | undefined, kind: AlarmSensorKind): AlarmBitField {
  const safe = md ?? {};
  const alarmBits = normalizeBitField(safe.alarmSensors);
  const batteryBits = normalizeBitField(safe.batteryWarning);
  const pos = ALARM_SENSOR_BIT_POS[kind];
  if (!pos) {
    return { triggered: false, batteryWarning: false, source: 'normal' };
  }
  const mask = 1 << pos.bit;
  const triggered = (alarmBits & mask) !== 0;
  const batteryWarning = (batteryBits & mask) !== 0;
  let source: AlarmBitField['source'] = 'normal';
  if (triggered && batteryWarning) source = 'both';
  else if (triggered) source = 'alarm';
  else if (batteryWarning) source = 'battery';
  return { triggered, batteryWarning, source };
}

/** @deprecated 自 P3-1 起使用 parseAlarmBitField(md, "smoke")；保留仅用于向后兼容 */
export function parseSmokeAlarmBitField(md: Record<string, any> | null | undefined): AlarmBitField {
  return parseAlarmBitField(md, 'smoke');
}

/** 类型别名，向后兼容（P0-4 旧代码可能引用了 SmokeAlarmBitField） */
export type SmokeAlarmBitField = AlarmBitField;

// ============================================================================
// P1-1：传感器状态码位域（sensorStatusCode）解析
// ----------------------------------------------------------------------------
// 协议定义：sensorStatusCode 是 2 字节位域（lowByte + highByte），每 bit 标识 1 个异常：
//   lowByte.0  未设置      (1=未设置 / 0=设置)
//   lowByte.1  读配置错误  (1=异常 / 0=正常)
//   lowByte.2  写配置错误  (1=异常 / 0=正常)
//   lowByte.3  未连接设备  (1=未连接 / 0=正常)
//   lowByte.4  断网        (1=断网 / 0=正常)
//   lowByte.5  超预设置    (1=超预设置 / 0=正常)
//   lowByte.6  超量程      (1=超量程 / 0=正常)
//   lowByte.7  预留
//   highByte   预留
// ============================================================================

/** 状态码位定义（与协议文档《字段解析规则.json》中 sensorStatusCode 一致） */
export const SENSOR_STATUS_BITS: Array<{ bit: number; name: string; flag: string }> = [
  { bit: 0, name: '未设置', flag: 'unconfigured' },
  { bit: 1, name: '读配置错误', flag: 'readConfigError' },
  { bit: 2, name: '写配置错误', flag: 'writeConfigError' },
  { bit: 3, name: '未连接设备', flag: 'disconnected' },
  { bit: 4, name: '断网', flag: 'networkDown' },
  { bit: 5, name: '超预设置', flag: 'overPreset' },
  { bit: 6, name: '超量程', flag: 'overRange' },
  { bit: 7, name: '预留', flag: 'reserved7' },
];

/** 单个状态码解析结果 */
export interface SensorStatusCode {
  /** 原始位域（number，2 字节 0~65535） */
  raw: number;
  /** 异常项列表（flag + name） */
  flags: Array<{ flag: string; name: string; bit: number }>;
  /** 是否有任何异常 */
  hasError: boolean;
  /** 异常状态简称（如 "断网" / "未连接+超量程"） */
  summary: string;
}

/** 解析 sensorStatusCode 位域
 *  - 接受 number / 0x字符串 / [lowByte, highByte] 数组
 *  - 任何位为 1 视为异常；为 0 或缺省视为正常
 */
export function parseSensorStatusCode(raw: number | string | [number, number] | null | undefined): SensorStatusCode {
  const code = normalizeBitField(raw);
  const flags: SensorStatusCode['flags'] = [];
  for (const def of SENSOR_STATUS_BITS) {
    if (def.bit === 7) continue; // 预留位不展示
    if ((code & (1 << def.bit)) !== 0) {
      flags.push({ flag: def.flag, name: def.name, bit: def.bit });
    }
  }
  return {
    raw: code,
    flags,
    hasError: flags.length > 0,
    summary: flags.length === 0 ? '正常' : flags.map((f) => f.name).join('+'),
  };
}

/** 烟雾传感器的 sensorStatusCode 解析便捷封装（自动从 md.sensorStatusCode 取） */
export function getSmokeSensorStatus(md: Record<string, any> | null | undefined): SensorStatusCode {
  return parseSensorStatusCode(md?.sensorStatusCode);
}

// ═══════════════════════════════════════════════════════════
// 分控器状态解析（controllerState 位域，0x061e 协议）
// ═══════════════════════════════════════════════════════════
//
// 协议字段解析规则.json → bitFieldDefinitions.controllerState
// 1字节位域，8个状态标志，可组合

/** 分控器 controllerState 位域解析结果 */
export interface ControllerState {
  frontSpray: boolean;      // bit0: 0=喷, 1=未喷（注意：逻辑反转）
  rearSpray: boolean;       // bit1: 0=喷, 1=未喷
  cleanSpray: boolean;      // bit2: 0=喷, 1=未喷
  batteryWarn: boolean;     // bit3: 0=无, 1=有
  commFault: boolean;       // bit4: 0=通讯, 1=未通信
  frontForceSpray: boolean; // bit5: 0=否, 1=是
  rearForceSpray: boolean;  // bit6: 0=否, 1=是
  frontClean: boolean;      // bit7: 0=否, 1=是
}

/** 解析 controllerState 原始字节为结构化状态 */
export function parseControllerState(rawValue: number): ControllerState {
  return {
    frontSpray: (rawValue & 0x01) === 0,
    rearSpray: (rawValue & 0x02) === 0,
    cleanSpray: (rawValue & 0x04) === 0,
    batteryWarn: !!(rawValue & 0x08),
    commFault: !!(rawValue & 0x10),
    frontForceSpray: !!(rawValue & 0x20),
    rearForceSpray: !!(rawValue & 0x40),
    frontClean: !!(rawValue & 0x80),
  };
}

/** 分控器 LED 状态定义：8个bit对应8个LED的颜色与标签 */
export const CONTROLLER_STATE_LEDS: ReadonlyArray<{
  bit: number;
  label: string;
  activeColor: string;
  inactiveColor: string;
  /** 脉冲动画（仅激活态） */
  pulse?: boolean;
}> = [
  { bit: 0, label: '前喷',   activeColor: '#4CAF50', inactiveColor: '#333' },   // bit0=0 → 前喷激活（绿色）
  { bit: 1, label: '后喷',   activeColor: '#4CAF50', inactiveColor: '#333' },   // bit1=0 → 后喷激活
  { bit: 2, label: '清洗',   activeColor: '#2196F3', inactiveColor: '#333' },   // bit2=0 → 清洗激活（蓝色）
  { bit: 3, label: '电池',   activeColor: '#FF9800', inactiveColor: '#333' },   // bit3=1 → 电池预警（橙色）
  { bit: 4, label: '通讯',   activeColor: '#F44336', inactiveColor: '#333' },   // bit4=1 → 通讯故障（红色）
  { bit: 5, label: '前强',   activeColor: '#00BCD4', inactiveColor: '#333', pulse: true },  // bit5=1 → 前强喷（亮蓝脉冲）
  { bit: 6, label: '后强',   activeColor: '#00BCD4', inactiveColor: '#333', pulse: true },  // bit6=1 → 后强喷（亮蓝脉冲）
  { bit: 7, label: '清洗2',  activeColor: '#9C27B0', inactiveColor: '#333' },   // bit7=1 → 前清洗（紫色）
];

/** 判断某个 LED 是否激活（bit0~bit2 逻辑反转：0=激活，bit3~bit7 逻辑正常：1=激活） */
export function isControllerLedActive(rawValue: number, bitIndex: number): boolean {
  const mask = 1 << bitIndex;
  if (bitIndex <= 2) {
    // bit0/1/2: 0=喷（激活），1=未喷（未激活）
    return (rawValue & mask) === 0;
  }
  // bit3~7: 1=激活
  return !!(rawValue & mask);
}

/** 生成分控器喷洒状态文本（并列显示，不互斥） */
export function getSprayStatusText(state: ControllerState): string {
  const parts: string[] = [];
  // 前喷/前强喷并列显示
  if (state.frontForceSpray) parts.push('前强喷');
  if (state.frontSpray) parts.push('前喷');
  // 后喷/后强喷并列显示
  if (state.rearForceSpray) parts.push('后强喷');
  if (state.rearSpray) parts.push('后喷');
  // 清洗/前清洗并列显示
  if (state.frontClean) parts.push('前清洗');
  if (state.cleanSpray) parts.push('清洗');
  if (parts.length === 0) return '未喷';
  return parts.join(' ');
}

/** 是否处于任何喷洒状态 */
export function isAnySpraying(state: ControllerState | null): boolean {
  if (!state) return false;
  return state.frontSpray || state.rearSpray || state.cleanSpray
      || state.frontForceSpray || state.rearForceSpray || state.frontClean;
}

/** 从 device.metadata 中提取 controllerState 原始值 */
export function extractControllerStateRaw(device: Record<string, any> | null | undefined): number | null {
  if (!device) return null;
  const md = (device.metadata ?? {}) as Record<string, any>;
  const realtime = (md.realtime ?? {}) as Record<string, { value: unknown }>;
  const raw = realtime.controllerState?.value;
  return typeof raw === 'number' ? raw : null;
}
