/**
 * logQueryStore - 日志监控查询状态管理
 *
 * 职责：
 * - 管理日志查询参数（时间范围、设备ID、日志级别、事件类型、分页）
 * - 管理4类查询结果（操作日志、设备事件、系统事件、传感器数据）
 * - 提供查询/导出/重置 Actions
 * - 管理 Tab 切换状态
 */
import { create } from "zustand";
import {
  queryOperationHistory,
  queryEventHistory,
  querySystemHistory,
  querySensorHistory,
  exportHistoryCsv,
  queryHistoryCount,
  recentTimeRange,
  isAbortError,
  type OperationLog,
  type DeviceEvent,
  type SystemEvent,
  type SensorRecord,
  type ExportParams,
} from "../services/historyApi";
import { logger } from "../utils/logger";

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

export type LogTab = "operation" | "event" | "system" | "sensor";

export interface TimeRange {
  from: string;
  to: string;
}

export interface QueryResult<T> {
  data: T[];
  total: number;
}

export interface LogQueryParams {
  timeRange: TimeRange;
  deviceId: string;
  logLevel: string;
  eventType: string;
  currentPage: number;
  pageSize: number;
}

interface LogQueryState extends LogQueryParams {
  // Tab
  activeTab: LogTab;

  // 查询结果
  operationLogs: QueryResult<OperationLog>;
  deviceEvents: QueryResult<DeviceEvent>;
  systemEvents: QueryResult<SystemEvent>;
  sensorData: QueryResult<SensorRecord>;

  // 加载状态
  loading: boolean;
  error: string | null;
  exporting: boolean;

  // 分页总数缓存（优化大表 COUNT 开销）
  /** 各 Tab 的总数缓存：后端 count_total=false 时复用，避免翻页/轮询每次都跑 COUNT(*) */
  cachedTotals: Record<LogTab, number | undefined>;
  /** 下一次查询是否需要后端返回 total（过滤/时间/切 Tab 变化时置 true，拿到后置 false） */
  needsCount: boolean;

  // Actions - 参数设置
  setQueryParams: (params: Partial<LogQueryParams>) => void;
  setActiveTab: (tab: LogTab) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Actions - 查询
  queryOperationLogs: () => Promise<void>;
  queryDeviceEvents: () => Promise<void>;
  querySystemEvents: () => Promise<void>;
  querySensorData: () => Promise<void>;
  queryActiveTab: () => Promise<void>;

  // Actions - 导出
  exportCsv: (source?: ExportParams["source"]) => Promise<void>;

  // Actions - 重置
  resetQuery: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// 默认值
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_TIME_RANGE = recentTimeRange(24);
const DEFAULT_PAGE_SIZE = 20;

const EMPTY_RESULT = { data: [], total: 0 };

// ═══════════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════════

/**
 * 后台异步统计某 Tab 总数（不阻塞首屏/翻页）。
 * 仅在 needsCount 为 true（即尚无缓存总数）时触发；成功后写入缓存并关闭 needsCount。
 * 失败不影响已展示的数据，保留 needsCount=true 以便下次查询重试。
 */
async function fetchCountForTab(tab: LogTab, snapshot: LogQueryState) {
  try {
    const total = await queryHistoryCount({
      tab,
      from: snapshot.timeRange.from,
      to: snapshot.timeRange.to,
      device_id: snapshot.deviceId || undefined,
      type: snapshot.eventType !== "all" ? snapshot.eventType : undefined,
      level: snapshot.logLevel !== "all" ? snapshot.logLevel : undefined,
    });
    if (total === undefined) return;
    const cur = useLogQueryStore.getState();
    useLogQueryStore.setState({
      cachedTotals: { ...cur.cachedTotals, [tab]: total },
      needsCount: false,
    });
  } catch {
    // 后台统计失败不影响已展示数据；保留 needsCount=true 以便下次查询重试
  }
}

export const useLogQueryStore = create<LogQueryState>((set, get) => ({
  // ─── 查询参数 ───
  timeRange: DEFAULT_TIME_RANGE,
  deviceId: "",
  logLevel: "all",
  eventType: "all",
  currentPage: 0,
  pageSize: DEFAULT_PAGE_SIZE,

  // ─── Tab ───
  activeTab: "operation",

  // ─── 查询结果 ───
  operationLogs: { ...EMPTY_RESULT },
  deviceEvents: { ...EMPTY_RESULT },
  systemEvents: { ...EMPTY_RESULT },
  sensorData: { ...EMPTY_RESULT },

  // ─── 状态 ───
  loading: false,
  error: null,
  exporting: false,

  // ─── 分页总数缓存（大表 COUNT 优化）───
  cachedTotals: { operation: undefined, event: undefined, system: undefined, sensor: undefined },
  needsCount: true,

  // ═══════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════

  setQueryParams: (params) => {
    set((state) => ({
      ...state,
      ...params,
      currentPage: 0,
      // 时间/设备/级别/类型变化 → 所有 Tab 总数失效，下次查询重新 COUNT
      needsCount: true,
      cachedTotals: { operation: undefined, event: undefined, system: undefined, sensor: undefined },
    }));
  },

  setActiveTab: (tab) => {
    set((state) => ({
      activeTab: tab,
      currentPage: 0,
      eventType: "all",
      error: null,
      // 切换到尚未 COUNT 过的 Tab 才重新 COUNT；已缓存的 Tab 直接复用（翻页/轮询不重数）
      needsCount: state.cachedTotals[tab] === undefined,
    }));
  },

  setCurrentPage: (page) => {
    set({ currentPage: page });
  },

  setPageSize: (size) => {
    set({ pageSize: size, currentPage: 0 });
  },

  queryOperationLogs: async () => {
    const s = get();
    set({ loading: true, error: null });
    try {
      const resp = await queryOperationHistory({
        from: s.timeRange.from,
        to: s.timeRange.to,
        device_id: s.deviceId || undefined,
        action: undefined,
        result: undefined,
        limit: s.pageSize,
        offset: s.currentPage * s.pageSize,
        // 数据查询永远不阻塞在 COUNT(*) 上：首屏/翻页只取当页，总数由后台异步统计
        countTotal: false,
      });
      const cachedTotals = { ...s.cachedTotals, operation: resp.total ?? s.cachedTotals.operation };
      set({
        operationLogs: { data: resp.data, total: resp.total ?? s.cachedTotals.operation ?? 0 },
        cachedTotals,
        needsCount: s.needsCount,
        loading: false,
      });
      if (s.needsCount) void fetchCountForTab("operation", s);
    } catch (err) {
      if (isAbortError(err)) return;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("logQueryStore", "queryOperationLogs failed", { error: msg });
      set({ loading: false, error: msg });
    }
  },

  queryDeviceEvents: async () => {
    const s = get();
    set({ loading: true, error: null });
    try {
      const resp = await queryEventHistory({
        from: s.timeRange.from,
        to: s.timeRange.to,
        device_id: s.deviceId || undefined,
        type: s.eventType !== "all" ? s.eventType : undefined,
        level: s.logLevel !== "all" ? s.logLevel : undefined,
        limit: s.pageSize,
        offset: s.currentPage * s.pageSize,
        countTotal: false,
      });
      const cachedTotals = { ...s.cachedTotals, event: resp.total ?? s.cachedTotals.event };
      set({
        deviceEvents: { data: resp.data, total: resp.total ?? s.cachedTotals.event ?? 0 },
        cachedTotals,
        needsCount: s.needsCount,
        loading: false,
      });
      if (s.needsCount) void fetchCountForTab("event", s);
    } catch (err) {
      if (isAbortError(err)) return;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("logQueryStore", "queryDeviceEvents failed", { error: msg });
      set({ loading: false, error: msg });
    }
  },

  querySystemEvents: async () => {
    const s = get();
    set({ loading: true, error: null });
    try {
      const resp = await querySystemHistory({
        from: s.timeRange.from,
        to: s.timeRange.to,
        level: s.logLevel !== "all" ? s.logLevel : undefined,
        type: s.eventType !== "all" ? s.eventType : undefined,
        limit: s.pageSize,
        offset: s.currentPage * s.pageSize,
        countTotal: false,
      });
      const cachedTotals = { ...s.cachedTotals, system: resp.total ?? s.cachedTotals.system };
      set({
        systemEvents: { data: resp.data, total: resp.total ?? s.cachedTotals.system ?? 0 },
        cachedTotals,
        needsCount: s.needsCount,
        loading: false,
      });
      if (s.needsCount) void fetchCountForTab("system", s);
    } catch (err) {
      if (isAbortError(err)) return;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("logQueryStore", "querySystemEvents failed", { error: msg });
      set({ loading: false, error: msg });
    }
  },

  querySensorData: async () => {
    const s = get();
    set({ loading: true, error: null });
    try {
      const resp = await querySensorHistory({
        from: s.timeRange.from,
        to: s.timeRange.to,
        device_id: s.deviceId || undefined,
        type: s.eventType !== "all" ? s.eventType : undefined,
        limit: s.pageSize,
        offset: s.currentPage * s.pageSize,
        countTotal: false,
      });
      const cachedTotals = { ...s.cachedTotals, sensor: resp.total ?? s.cachedTotals.sensor };
      set({
        sensorData: { data: resp.data, total: resp.total ?? s.cachedTotals.sensor ?? 0 },
        cachedTotals,
        needsCount: s.needsCount,
        loading: false,
      });
      if (s.needsCount) void fetchCountForTab("sensor", s);
    } catch (err) {
      if (isAbortError(err)) return;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("logQueryStore", "querySensorData failed", { error: msg });
      set({ loading: false, error: msg });
    }
  },

  queryActiveTab: async () => {
    const tab = get().activeTab;
    switch (tab) {
      case "operation":
        await get().queryOperationLogs();
        break;
      case "event":
        await get().queryDeviceEvents();
        break;
      case "system":
        await get().querySystemEvents();
        break;
      case "sensor":
        await get().querySensorData();
        break;
    }
  },

  exportCsv: async (source) => {
    const s = get();
    const src = source ?? s.activeTab;
    set({ exporting: true, error: null });
    try {
      const params: ExportParams = {
        source: src,
        from: s.timeRange.from,
        to: s.timeRange.to,
        device_id: s.deviceId || undefined,
        type: s.eventType !== "all" ? s.eventType : undefined,
        level: s.logLevel !== "all" ? s.logLevel : undefined,
        limit: 10000,
        offset: 0,
      };
      const blob = await exportHistoryCsv(params);

      // 触发浏览器下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `history-${src}-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      set({ exporting: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("logQueryStore", "exportCsv failed", { error: msg });
      set({ exporting: false, error: msg });
    }
  },

  resetQuery: () => {
    set({
      timeRange: recentTimeRange(24),
      deviceId: "",
      logLevel: "all",
      eventType: "all",
      currentPage: 0,
      pageSize: DEFAULT_PAGE_SIZE,
      activeTab: "operation",
      operationLogs: { ...EMPTY_RESULT },
      deviceEvents: { ...EMPTY_RESULT },
      systemEvents: { ...EMPTY_RESULT },
      sensorData: { ...EMPTY_RESULT },
      loading: false,
      error: null,
      cachedTotals: { operation: undefined, event: undefined, system: undefined, sensor: undefined },
      needsCount: true,
    });
  },
}));
