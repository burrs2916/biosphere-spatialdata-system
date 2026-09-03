/**
 * deviceScope — 设备范围模式（统一开关）
 *
 * 背景：业务场景（巷道/廊桥/综采）执行「严格绑定模型」——
 * config.selectedDeviceIds 留空 = 不显示任何设备，绑定集控器 = 只显示其子树。
 * 该模型在业务场景下是对的（避免大屏误显示无关设备），
 * 但「设备状态监控大屏」这类全局监控视图的诉求恰好相反：要看全部设备。
 *
 * 引入显式开关，两种诉求互不污染：
 *   - "bound"（默认）：严格绑定，留空 = 无设备。所有存量组件行为不变。
 *   - "all"  ：全量设备，忽略 selectedDeviceIds。初始化大屏模板显式使用。
 *
 * 注意：只有显式设 deviceScope==="all" 的组件才会走全量，
 * 存量三场景与新拖入的组件默认仍是 bound，红线不被破坏。
 */
import { discoverMainControllerIds, isMainControllerDevice } from "../../../devices/productCodePredicates";

export type DeviceScope = "bound" | "all";

/** 读取组件的设备范围模式；缺省一律按 bound（严格绑定）处理 */
export function resolveDeviceScope(config: Record<string, unknown> | undefined): DeviceScope {
  return config?.deviceScope === "all" ? "all" : "bound";
}

/**
 * 解析组件应覆盖的集控器根 ID 列表。
 *
 * - scope="all"  ：返回设备表中所有集控器（动态发现，不写死任何 ID）
 * - scope="bound"：走原有 discoverMainControllerIds（留空 → 空数组）
 */
export function resolveMainControllerIds(
  devicesMap: Record<string, unknown> | undefined | null,
  selectedDeviceIds: readonly string[] | undefined,
  scope: DeviceScope,
): string[] {
  if (!devicesMap) return [];

  if (scope === "all") {
    return Object.entries(devicesMap)
      .filter(([, device]) => isMainControllerDevice(device))
      .map(([id]) => id);
  }

  return discoverMainControllerIds(devicesMap, selectedDeviceIds);
}

/**
 * 判断某设备 ID 是否落在组件范围内。
 *
 * - scope="all"  ：恒为 true
 * - scope="bound"：必须在 idSet 内
 *
 * 返回 null 表示「无范围限制」（全量）。
 */
export function makeScopeMatcher(
  scope: DeviceScope,
  allowedIds: readonly string[] | Set<string>,
): ((deviceId: string) => boolean) | null {
  if (scope === "all") return null;
  const set = allowedIds instanceof Set ? allowedIds : new Set(allowedIds);
  return (deviceId: string) => set.has(deviceId);
}
