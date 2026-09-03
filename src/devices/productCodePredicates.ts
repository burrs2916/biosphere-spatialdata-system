/**
 * 设备产品码判定 —— 全项目唯一真源
 *
 * 为什么需要这个文件：
 *   deviceStore 中 DeviceInstance.productCode 存在**两种形态**：
 *     1) 数字形态   "18" / "18001"
 *        —— adapter 的 productCodeMapping 为空时，EdgeConductorProvider 原样透传
 *     2) 组件码形态 "FY002-MainController" / "FY002-SubController-Spray"
 *        —— 默认 edge-conductor adapter 应用 DEFAULT_PRODUCT_CODE_MAPPING 后
 *           （见 deviceAdapter.ts createDefaultDeviceAdapter）
 *
 *   EdgeConductorProvider.loadDevices() 的 `pm[Number(raw)] ?? raw` 决定了：
 *   只要使用默认适配器，productCode **恒为形态 2**。
 *
 *   历史上有 7 处代码各自硬编码产品码常量，其中 3 处只认形态 1，导致
 *   喷雾控制工具栏 / 定时卡 / 日志过滤面板的分控器发现静默失效。
 *   本文件把判定收口，任何按产品码筛选设备的代码都必须走这里。
 *
 * 判定优先级：productCode（两种形态）→ device_category 兜底。
 * device_category 由后端权威提供（main_controller / sub_controller / sensor / collector），
 * 经 categoryMapping 归一为 main / sub / sensor / auxiliary。
 */

import { DEFAULT_PRODUCT_CODE_MAPPING } from "./edgeConductorDefaults";

// ─── 协议层产品码真源 ───
// 对齐 edge-conductor core/src/protocol/device/metadata.rs PRODUCT_METADATA
export const MAIN_CONTROLLER_PRODUCT_CODE = 18; // 喷雾降尘分站
export const SUB_CONTROLLER_PRODUCT_CODE = 18001; // 喷雾分控器

/**
 * 构建一个产品码的全部可接受形态（数字形态 + 组件码形态）
 */
function buildAcceptedForms(...codes: number[]): Set<string> {
  const forms = new Set<string>();
  for (const code of codes) {
    forms.add(String(code));
    const mapped = DEFAULT_PRODUCT_CODE_MAPPING[code];
    if (mapped) forms.add(mapped);
  }
  return forms;
}

const MAIN_CONTROLLER_FORMS = buildAcceptedForms(MAIN_CONTROLLER_PRODUCT_CODE);
const SUB_CONTROLLER_FORMS = buildAcceptedForms(SUB_CONTROLLER_PRODUCT_CODE);

// ─── 设备字段宽松读取 ───
// 调用方持有的设备对象形态不一（DeviceInstance / Record<string, unknown>），
// 统一按 unknown 读取，避免类型断言散落各处。

function readString(source: unknown, key: string): string {
  if (!source || typeof source !== "object") return "";
  const value = (source as Record<string, unknown>)[key];
  return value === undefined || value === null ? "" : String(value);
}

export function readDeviceProductCode(device: unknown): string {
  return readString(device, "productCode");
}

export function readDeviceCategory(device: unknown): string {
  return readString(device, "category");
}

export function readDeviceId(device: unknown): string {
  return readString(device, "deviceId") || readString(device, "id");
}

export function readParentDeviceId(device: unknown): string {
  return readString(device, "parentDeviceId");
}

// ─── 产品码判定（两种形态都认）───

/** 是否为集控器产品码："18" 或 "FY002-MainController" */
export function isMainControllerProductCode(productCode: unknown): boolean {
  if (productCode === undefined || productCode === null) return false;
  return MAIN_CONTROLLER_FORMS.has(String(productCode));
}

/** 是否为分控器产品码："18001" 或 "FY002-SubController-Spray" */
export function isSubControllerProductCode(productCode: unknown): boolean {
  if (productCode === undefined || productCode === null) return false;
  return SUB_CONTROLLER_FORMS.has(String(productCode));
}

// ─── 设备对象判定 ───

/**
 * 是否为集控器：优先按 productCode（双形态），category==="main" 作为兜底。
 * 保留兜底是因为历史数据里存在 productCode 缺失但 category 正确的设备。
 */
export function isMainControllerDevice(device: unknown): boolean {
  if (!device || typeof device !== "object") return false;
  return isMainControllerProductCode(readDeviceProductCode(device)) || readDeviceCategory(device) === "main";
}

/** 是否为分控器：优先按 productCode（双形态），category==="sub" 作为兜底 */
export function isSubControllerDevice(device: unknown): boolean {
  if (!device || typeof device !== "object") return false;
  return isSubControllerProductCode(readDeviceProductCode(device)) || readDeviceCategory(device) === "sub";
}

/** 是否为传感器 */
export function isSensorDevice(device: unknown): boolean {
  if (!device || typeof device !== "object") return false;
  return readDeviceCategory(device) === "sensor";
}

// ─── 动态发现（不依赖任何硬编码设备 ID）───

/**
 * 从设备表中发现集控器 ID —— **严格绑定模型**：
 * 只有显式绑定的集控器才返回，未绑定（restrictTo 空）时一律返回空数组，
 * 渲染层据此「不显示任何设备」。即满足产品要求：
 * 「只有选择集控器的前提下，才显示该集控器下的分控器/传感器，不显示全部」。
 *
 * @param devices deviceStore.devices（id → 设备对象）
 * @param restrictTo 绑定范围（组件 config.selectedDeviceIds，即"设备"属性面板勾选的集控器）。
 *                   留空/空数组 = 未绑定 → 返回 []（不显示任何设备）；
 *                   非空时只在给定 ID 中筛选确为集控器的设备（混入分控器/传感器 ID 自动回溯其根）。
 */
export function discoverMainControllerIds(
  devices: Record<string, unknown> | undefined | null,
  restrictTo?: readonly string[],
): string[] {
  if (!devices) return [];

  // 未绑定 → 不返回任何集控器（严格模型：没选集控器就不显示设备）
  if (!restrictTo || restrictTo.length === 0) {
    return [];
  }

  // 有限定 → 在范围内筛选，且必须是真实存在 + 确为集控器
  // 兜底：限定值里混入分控器/传感器 ID 时（历史脏数据），向上回溯到其集控器根
  const resolved = new Set<string>();
  for (const id of restrictTo) {
    const device = devices[id];
    if (!device) continue;
    if (isMainControllerDevice(device)) {
      resolved.add(id);
      continue;
    }
    const rootId = resolveMainControllerRoot(devices, id);
    if (rootId) resolved.add(rootId);
  }
  return Array.from(resolved).sort();
}

/**
 * 沿 parentDeviceId 向上回溯到集控器根。
 * 用于处理历史配置里误绑分控器/传感器的情况。
 */
export function resolveMainControllerRoot(
  devices: Record<string, unknown>,
  deviceId: string,
): string | null {
  const seen = new Set<string>();
  let current: string | undefined = deviceId;
  while (current && devices[current] && !seen.has(current)) {
    seen.add(current);
    if (isMainControllerDevice(devices[current])) return current;
    current = readParentDeviceId(devices[current]) || undefined;
  }
  return null;
}

/**
 * 发现指定集控器下的所有分控器 ID。
 * 判据：分控器产品码（双形态）+ parentDeviceId === 集控器 ID
 */
export function discoverSubControllerIds(
  devices: Record<string, unknown> | undefined | null,
  mainControllerIds: readonly string[],
): string[] {
  if (!devices || mainControllerIds.length === 0) return [];
  const target = new Set(mainControllerIds);
  return Object.keys(devices)
    .filter((id) => isSubControllerDevice(devices[id]) && target.has(readParentDeviceId(devices[id])))
    .sort();
}

/**
 * 发现指定分控器下的所有传感器 ID
 */
export function discoverSensorIds(
  devices: Record<string, unknown> | undefined | null,
  parentIds: readonly string[],
): string[] {
  if (!devices || parentIds.length === 0) return [];
  const target = new Set(parentIds);
  return Object.keys(devices)
    .filter((id) => isSensorDevice(devices[id]) && target.has(readParentDeviceId(devices[id])))
    .sort();
}
