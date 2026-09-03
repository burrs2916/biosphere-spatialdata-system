/**
 * historyApi - 封装后端 /api/history/* 接口调用
 *
 * 后端接口（全部 POST + JSON Body）：
 *   POST /api/history/sensors     - 查询传感器历史数据
 *   POST /api/history/operations  - 查询操作日志
 *   POST /api/history/events      - 查询设备事件
 *   POST /api/history/system      - 查询系统事件
 *   POST /api/history/export      - 导出CSV
 *
 * 后端地址获取方式与 EdgeConductorProvider 一致：
 *   从 deviceStore.activeDataSourceId 拿到数据源 ID，
 *   再从 datasourceStore.getDataSource(id) 拿到 DataSource，
 *   用 ds.connection.url 作为 baseUrl，ds.connection.headers 作为请求头。
 */
import { useDeviceStore } from "../store/deviceStore";
import { useDataSourceStore } from "../store/datasourceStore";
import { logger } from "../utils/logger";

// ═══════════════════════════════════════════════════════════════════
// 请求参数接口
// ═══════════════════════════════════════════════════════════════════

/** 传感器历史查询参数 */
export interface SensorHistoryParams {
  device_id?: string;
  type?: string;
  from: string;
  to: string;
  limit?: number;
  offset?: number;
  agg?: string;
  step?: string;
  /** 是否让后端返回总数 COUNT（大表下 COUNT 是主要开销，翻页/轮询时可置 false 复用缓存） */
  countTotal?: boolean;
  /** 为 true 时该请求不进入全局 inflight 表，不会取消/覆盖同路径的其它请求（用于后台采样等旁路查询） */
  bypassInflight?: boolean;
}

/** 操作日志查询参数 */
export interface OperationHistoryParams {
  device_id?: string;
  from: string;
  to: string;
  limit?: number;
  offset?: number;
  action?: string;
  result?: string;
  /** 是否让后端返回总数 COUNT（见 SensorHistoryParams.countTotal 说明） */
  countTotal?: boolean;
  /** 为 true 时该请求不进入全局 inflight 表，不会取消/覆盖同路径的其它请求（用于后台采样等旁路查询） */
  bypassInflight?: boolean;
}

/** 设备事件查询参数 */
export interface EventHistoryParams {
  device_id?: string;
  type?: string;
  from: string;
  to: string;
  limit?: number;
  offset?: number;
  level?: string;
  agg?: string;
  step?: string;
  /** 是否让后端返回总数 COUNT（见 SensorHistoryParams.countTotal 说明） */
  countTotal?: boolean;
  /** 为 true 时该请求不进入全局 inflight 表，不会取消/覆盖同路径的其它请求（用于后台采样等旁路查询） */
  bypassInflight?: boolean;
}

/** 系统事件查询参数 */
export interface SystemHistoryParams {
  from: string;
  to: string;
  limit?: number;
  offset?: number;
  level?: string;
  type?: string;
  module?: string;
  /** 是否让后端返回总数 COUNT（见 SensorHistoryParams.countTotal 说明） */
  countTotal?: boolean;
  /** 为 true 时该请求不进入全局 inflight 表，不会取消/覆盖同路径的其它请求（用于后台采样等旁路查询） */
  bypassInflight?: boolean;
}

/** 导出CSV参数（合并所有筛选字段） */
export interface ExportParams {
  source?: "operation" | "event" | "system" | "sensor";
  device_id?: string;
  type?: string;
  from: string;
  to: string;
  limit?: number;
  offset?: number;
  agg?: string;
  step?: string;
  action?: string;
  result?: string;
  level?: string;
  module?: string;
}

// ═══════════════════════════════════════════════════════════════════
// 响应数据接口
// ═══════════════════════════════════════════════════════════════════

/** 传感器历史记录 */
export interface SensorRecord {
  id?: string | number;
  timestamp: string | number;
  device_id?: string;
  type?: string;
  value?: number;
  unit?: string;
  quality?: string;
  [k: string]: unknown;
}

/** 操作日志记录 */
export interface OperationLog {
  id?: string | number;
  timestamp: string | number;
  request_id?: string;
  command_code?: string;
  action?: string;
  device_id?: string;
  result?: string;
  duration_ms?: number;
  operator?: string;
  payload?: unknown;
  result_msg?: string;
  [k: string]: unknown;
}

/** 设备事件记录 */
export interface DeviceEvent {
  id?: string | number;
  timestamp: string | number;
  device_id?: string;
  event_type?: string;
  level?: string;
  old_value?: unknown;
  new_value?: unknown;
  reason?: string;
  [k: string]: unknown;
}

/** 系统事件记录 */
export interface SystemEvent {
  id?: string | number;
  timestamp: string | number;
  event_type?: string;
  level?: string;
  module?: string;
  message?: string;
  details?: unknown;
  [k: string]: unknown;
}

/** 分页响应 */
export interface SensorHistoryResponse {
  data: SensorRecord[];
  total?: number;
}

export interface OperationHistoryResponse {
  data: OperationLog[];
  total?: number;
}

export interface EventHistoryResponse {
  data: DeviceEvent[];
  total?: number;
}

export interface SystemHistoryResponse {
  data: SystemEvent[];
  total?: number;
}

// ═══════════════════════════════════════════════════════════════════
// 仪表盘统计（边缘 GreptimeDB，真实无限）
// ═══════════════════════════════════════════════════════════════════

/** 仪表盘统计查询参数 */
export interface DashboardStatsParams {
  from: string;
  to: string;
  /** 趋势聚合步长：5m/30m/1h/1d */
  step?: string;
  /** 故障 Top N */
  fault_limit?: number;
}

export interface DashboardSummary {
  total_events: number;
  fault_events: number;
  total_sensors: number;
  /** 平均在线率 0.0 ~ 1.0 */
  avg_online_rate: number;
}

export interface DashboardTrendPoint {
  ts: string;
  key: string;
  count: number;
}

export interface DashboardCountItem {
  key: string;
  count: number;
}

export interface DashboardOnlineRate {
  device_id: string;
  total: number;
  online: number;
  rate: number;
}

export interface DashboardSensorVolume {
  device_id: string;
  sensor_type: string;
  count: number;
}

export interface DashboardStats {
  summary: DashboardSummary;
  trend: DashboardTrendPoint[];
  breakdown: DashboardCountItem[];
  fault_top: DashboardCountItem[];
  online_rate: DashboardOnlineRate[];
  sensor_volume: DashboardSensorVolume[];
}

// ═══════════════════════════════════════════════════════════════════
// 后端地址解析（与 EdgeConductorProvider.buildBaseUrl/buildHeaders 对齐）
// ═══════════════════════════════════════════════════════════════════

interface BackendConfig {
  baseUrl: string;
  headers: Record<string, string>;
}

/**
 * 从全局 store 中获取当前激活数据源的后端地址和请求头。
 * 与 EdgeConductorProvider 中的 buildBaseUrl/buildHeaders 逻辑一致。
 */
function getBackendConfig(): BackendConfig | null {
  const dsStore = useDataSourceStore.getState();
  const all = dsStore.dataSources ?? [];
  const activeId = useDeviceStore.getState().activeDataSourceId;
  const activeDs = activeId ? dsStore.getDataSource(activeId) : undefined;
  // 历史接口走 HTTP；当前激活数据源可能是 MQTT/实时源（大屏实时数据走它正常），
  // 不能作为 HTTP baseUrl。因此：优先激活源，但仅当它确实是 http(s)；否则回退到
  // 第一个启用的 HTTP 数据源（如「边缘计算」localhost:8084）。
  const isHttp = (ds?: { connection?: { url?: string } }) =>
    !!ds?.connection?.url && /^https?:\/\//i.test(ds.connection.url);
  const ds =
    (isHttp(activeDs) ? activeDs : undefined) ?? all.find((d) => isHttp(d));
  if (!ds) {
    return null;
  }
  const baseUrl = (ds.connection.url ?? "").replace(/\/+$/, "");
  const headers: Record<string, string> = {};
  (ds.connection.headers ?? [])
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      if (h.key) headers[h.key] = h.value ?? "";
    });
  return { baseUrl, headers };
}

/** 同一路径上尚未完成的前一个请求会被取消，避免快速切换/轮询时请求堆积造成卡顿 */
const inflight = new Map<string, AbortController>();

/** 判断是否为「主动取消」错误（不应作为业务错误展示，也不应覆盖已有数据） */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** 统一 POST JSON 请求 */
async function postJson<T>(
  path: string,
  body: unknown,
  opts?: { signal?: AbortSignal; bypassInflight?: boolean },
): Promise<T> {
  const cfg = getBackendConfig();
  if (!cfg) {
    throw new Error("未配置数据源，无法查询历史数据");
  }
  const url = `${cfg.baseUrl}${path}`;
  const headers = { ...cfg.headers, "Content-Type": "application/json" };

  const ac = new AbortController();
  if (opts?.bypassInflight) {
    // 后台统计总数请求：仅自身超时保护，不入全局 inflight 表，
    // 避免取消/覆盖正在进行的分页数据请求（同路径）。
  } else {
    // 取消同路径的前一个未完成请求（快速切换 Tab / 连续筛选时不让旧请求阻塞新请求）
    inflight.get(path)?.abort();
    inflight.set(path, ac);
  }
  const timer = setTimeout(() => ac.abort(), 30000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: opts?.signal ?? ac.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}${text ? ` - ${text}` : ""}`);
    }
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timer);
    if (!opts?.bypassInflight && inflight.get(path) === ac) inflight.delete(path);
  }
}

// ═══════════════════════════════════════════════════════════════════
// API 函数
// ═══════════════════════════════════════════════════════════════════

/** 查询传感器历史数据 */
export async function querySensorHistory(
  params: SensorHistoryParams,
): Promise<SensorHistoryResponse> {
  try {
    const { countTotal, bypassInflight, ...rest } = params;
    const raw = await postJson<unknown>("/api/history/sensors", {
      ...rest,
      ...(countTotal !== undefined ? { count_total: countTotal } : {}),
    }, { bypassInflight });
    return normalizeResponse<SensorRecord>(raw);
  } catch (err) {
    if (isAbortError(err)) throw err; // 主动取消（快速切换/轮询/并发同路径）非错误，不记日志
    logger.error("historyApi", "querySensorHistory failed", { error: err, params });
    throw err;
  }
}

/** 查询操作日志 */
export async function queryOperationHistory(
  params: OperationHistoryParams,
): Promise<OperationHistoryResponse> {
  try {
    const { countTotal, bypassInflight, ...rest } = params;
    const raw = await postJson<unknown>("/api/history/operations", {
      ...rest,
      ...(countTotal !== undefined ? { count_total: countTotal } : {}),
    }, { bypassInflight });
    return normalizeResponse<OperationLog>(raw);
  } catch (err) {
    if (isAbortError(err)) throw err; // 主动取消（快速切换/轮询/并发同路径）非错误，不记日志
    logger.error("historyApi", "queryOperationHistory failed", { error: err, params });
    throw err;
  }
}

/** 查询设备事件 */
export async function queryEventHistory(
  params: EventHistoryParams,
): Promise<EventHistoryResponse> {
  try {
    const { countTotal, bypassInflight, ...rest } = params;
    const raw = await postJson<unknown>("/api/history/events", {
      ...rest,
      ...(countTotal !== undefined ? { count_total: countTotal } : {}),
    }, { bypassInflight });
    return normalizeResponse<DeviceEvent>(raw);
  } catch (err) {
    if (isAbortError(err)) throw err; // 主动取消（快速切换/轮询/并发同路径）非错误，不记日志
    logger.error("historyApi", "queryEventHistory failed", { error: err, params });
    throw err;
  }
}

/** 查询系统事件 */
export async function querySystemHistory(
  params: SystemHistoryParams,
): Promise<SystemHistoryResponse> {
  try {
    const { countTotal, bypassInflight, ...rest } = params;
    const raw = await postJson<unknown>("/api/history/system", {
      ...rest,
      ...(countTotal !== undefined ? { count_total: countTotal } : {}),
    }, { bypassInflight });
    return normalizeResponse<SystemEvent>(raw);
  } catch (err) {
    if (isAbortError(err)) throw err; // 主动取消（快速切换/轮询/并发同路径）非错误，不记日志
    logger.error("historyApi", "querySystemHistory failed", { error: err, params });
    throw err;
  }
}

/** 导出CSV，返回 Blob 供前端下载 */
export async function exportHistoryCsv(params: ExportParams): Promise<Blob> {
  const cfg = getBackendConfig();
  if (!cfg) {
    throw new Error("未配置数据源，无法导出数据");
  }
  const url = `${cfg.baseUrl}/api/history/export`;
  const headers = { ...cfg.headers, "Content-Type": "application/json" };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}${text ? ` - ${text}` : ""}`);
    }
    return await resp.blob();
  } catch (err) {
    logger.error("historyApi", "exportHistoryCsv failed", { error: err, params });
    throw err;
  }
}

/** 查询仪表盘统计（边缘 GreptimeDB，真实无限） */
export async function queryDashboardStats(
  params: DashboardStatsParams,
): Promise<DashboardStats> {
  try {
    const raw = await postJson<unknown>("/api/history/dashboard/stats", params);
    // 边缘在 GreptimeDB 未就绪时返回 { code, msg } 错误体（HTTP 200）
    const err = raw as { code?: number; msg?: string };
    if (typeof err?.code === "number" && typeof err?.msg === "string") {
      throw new Error(err.msg);
    }
    return raw as DashboardStats;
  } catch (err) {
    logger.error("historyApi", "queryDashboardStats failed", { error: err, params });
    throw err;
  }
}

/**
 * 仅取总数（COUNT），用于后台异步统计，避免首屏/翻页被 COUNT(*) 阻塞。
 * 走 bypassInflight（不入全局 inflight 表），且 limit=1，仅返回 total，不下拉数据。
 */
export interface HistoryCountParams {
  tab: "operation" | "event" | "system" | "sensor";
  from: string;
  to: string;
  device_id?: string;
  type?: string;
  level?: string;
}

export async function queryHistoryCount(
  params: HistoryCountParams,
): Promise<number | undefined> {
  const { tab, from, to, device_id, type, level } = params;
  const base = {
    from,
    to,
    device_id: device_id || undefined,
    limit: 1,
    offset: 0,
    count_total: true,
  };
  let path: string;
  let body: Record<string, unknown>;
  switch (tab) {
    case "event":
      path = "/api/history/events";
      body = { ...base, type: type || undefined, level: level || undefined };
      break;
    case "system":
      path = "/api/history/system";
      body = { ...base, type: type || undefined, level: level || undefined };
      break;
    case "sensor":
      path = "/api/history/sensors";
      body = { ...base, type: type || undefined };
      break;
    case "operation":
    default:
      path = "/api/history/operations";
      body = base;
      break;
  }
  try {
    const raw = await postJson<unknown>(path, body, { bypassInflight: true });
    const obj = raw as Record<string, unknown> | null;
    if (!obj || typeof obj !== "object") return undefined;
    if (typeof obj.total === "number") return obj.total;
    if (typeof obj.count === "number") return obj.count;
    return undefined;
  } catch (err) {
    logger.error("historyApi", "queryHistoryCount failed", { error: err, params });
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════════

/**
 * 兼容后端多种响应格式：
 *   { data: [...], total: N }      （前端约定）
 *   { items: [...], total: N }
 *   { rows: [...], total: N }
 *   { records: [...], total: N }
 *   { logs: [...], total: N }      （/api/history/operations 真实返回）
 *   { events: [...], total: N }    （/api/history/events | /api/history/system 真实返回）
 *   { points: [...], total: N }    （/api/history/sensors 真实返回）
 *   [...] (纯数组，total = length)
 */
function normalizeResponse<T>(raw: unknown): { data: T[]; total: number | undefined } {
  if (Array.isArray(raw)) {
    return { data: raw.map(normalizeRecord) as T[], total: undefined };
  }
  const obj = raw as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") {
    return { data: [], total: undefined };
  }
  const data = (obj.data
    ?? obj.items
    ?? obj.rows
    ?? obj.records
    ?? obj.logs
    ?? obj.events
    ?? obj.points
    ?? []) as unknown[];
  // 后端显式返回 total（含 null）时尊重之：null/缺失都表示「未统计」，交由调用方用缓存 total 兜底，
  // 不再回退为 data.length（否则关掉 COUNT 后 total 会变成当页条数，分页错乱）。
  let total: number | undefined;
  if ("total" in obj) {
    total = typeof obj.total === "number" ? obj.total : undefined;
  } else if ("count" in obj) {
    total = typeof obj.count === "number" ? obj.count : undefined;
  } else if (Array.isArray(data)) {
    total = data.length;
  }
  return { data: data.map(normalizeRecord) as T[], total };
}

/**
 * 字段归一化（加法式，绝不删字段）：把后端真实字段名映射为前端渲染器期望的字段名。
 * - ts              -> timestamp
 * - event_level     -> level
 * - sensor_type     -> type
 * 仅当目标字段缺失时补全，已存在的字段原样保留，故不影响任何既有契约。
 */
function normalizeRecord(rec: unknown): Record<string, unknown> {
  if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
    return rec as Record<string, unknown>;
  }
  const r = rec as Record<string, unknown>;
  if (r.timestamp === undefined && r.ts !== undefined) r.timestamp = r.ts;
  if (r.level === undefined && r.event_level !== undefined) r.level = r.event_level;
  if (r.type === undefined && r.sensor_type !== undefined) r.type = r.sensor_type;
  return r;
}

/**
 * 时间戳格式化（项目中未引入 dayjs，使用原生 Date 实现）
 * 支持: ISO 字符串 / 毫秒时间戳 / 秒级时间戳
 */
export function formatTimestamp(
  ts: string | number | Date | undefined | null,
): string {
  if (ts === undefined || ts === null || ts === "") return "-";
  let d: Date;
  if (ts instanceof Date) {
    d = ts;
  } else if (typeof ts === "number") {
    // 秒级时间戳（< 1e12）转毫秒
    d = new Date(ts < 1e12 ? ts * 1000 : ts);
  } else {
    d = new Date(String(ts));
  }
  if (isNaN(d.getTime())) return String(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 将 ISO 时间字符串转为 datetime-local input 所需的值（YYYY-MM-DDTHH:mm） */
export function toDateTimeLocalValue(ts: string | number | undefined): string {
  if (!ts) return "";
  const d = typeof ts === "number" ? new Date(ts < 1e12 ? ts * 1000 : ts) : new Date(String(ts));
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 将 datetime-local input 的值转为 ISO 字符串 */
export function fromDateTimeLocalValue(val: string): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

/** 获取最近 N 小时的 ISO 时间范围 */
export function recentTimeRange(hours: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: now.toISOString() };
}
