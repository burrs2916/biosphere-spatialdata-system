/**
 * devicePlacementStore — 设备摆位管理
 *
 * 职责：
 * - 维护"设备在哪个视图哪个位置"的关系
 * - 运行时独立 store（性能 + 解耦）
 * - 序列化时由 sceneStore 合并到 SceneView.devicePlacements
 *
 * 索引模式：placementsByView[viewId] → DevicePlacement[]
 *
 * === 增强：变更通知 ===
 * sceneStore 通过 setChangeListener 订阅本 store 的状态变更，
 * 在 add/remove/update/hydrateView 后通知，sceneStore 据此把
 * 最新摆位回写到 active scene 的 SceneView.devicePlacements（仅内存，
 * 落盘由 sceneStore.saveScene 显式触发）。
 */
import { create } from "zustand";
import type { DevicePlacement, PlacementSnapMode } from "../types/devicePlacement";
import { logger } from "../utils/logger";

type PlacementChangeListener = (viewId: string, placements: DevicePlacement[]) => void;

let changeListener: PlacementChangeListener | null = null;

/** 外部订阅（sceneStore 用）：每次摆位变更后回调 */
export function setDevicePlacementChangeListener(listener: PlacementChangeListener | null): void {
  changeListener = listener;
}

interface DevicePlacementState {
  /** 按视图分组的摆位 */
  placementsByView: Record<string, DevicePlacement[]>;
  /** 当前吸附模式 */
  snapMode: PlacementSnapMode;

  // 加载/卸载
  hydrateView(viewId: string, placements: DevicePlacement[]): void;
  unloadView(viewId: string): void;

  // CRUD
  addPlacement(viewId: string, placement: DevicePlacement): void;
  removePlacement(viewId: string, placementId: string): void;
  updatePlacement(viewId: string, placementId: string, patch: Partial<DevicePlacement>): void;

  // 查询
  getPlacements(viewId: string): DevicePlacement[];
  isDevicePlaced(viewId: string, deviceId: string): boolean;
  findPlacement(viewId: string, deviceId: string): DevicePlacement | undefined;
  /** 跨视图查询：某设备在哪些视图被使用 */
  getPlacedViews(deviceId: string): string[];

  setSnapMode(mode: PlacementSnapMode): void;
}

export const useDevicePlacementStore = create<DevicePlacementState>((set, get) => ({
  placementsByView: {},
  snapMode: "smart",

  hydrateView(viewId, placements) {
    set((state) => ({
      placementsByView: { ...state.placementsByView, [viewId]: placements },
    }));
    // === 增强：通知订阅方（sceneStore 把摆位回写到 SceneView.devicePlacements） ===
    try { changeListener?.(viewId, placements); } catch { /* swallow */ }
  },

  unloadView(viewId) {
    set((state) => {
      const next = { ...state.placementsByView };
      delete next[viewId];
      return { placementsByView: next };
    });
    try { changeListener?.(viewId, []); } catch { /* swallow */ }
  },

  addPlacement(viewId, placement) {
    let placements: DevicePlacement[] = [];
    set((state) => {
      const current = state.placementsByView[viewId] ?? [];
      // 同一视图同一设备只允许一份
      if (current.some((p) => p.deviceId === placement.deviceId)) {
        logger.warn("DevicePlacementStore", "Device already placed in this view", {
          viewId,
          deviceId: placement.deviceId,
        });
        return {};
      }
      placements = [...current, placement];
      return {
        placementsByView: {
          ...state.placementsByView,
          [viewId]: placements,
        },
      };
    });
    try { changeListener?.(viewId, placements); } catch { /* swallow */ }
  },

  removePlacement(viewId, placementId) {
    let placements: DevicePlacement[] = [];
    set((state) => {
      const current = state.placementsByView[viewId] ?? [];
      placements = current.filter((p) => p.id !== placementId);
      return {
        placementsByView: {
          ...state.placementsByView,
          [viewId]: placements,
        },
      };
    });
    try { changeListener?.(viewId, placements); } catch { /* swallow */ }
  },

  updatePlacement(viewId, placementId, patch) {
    let placements: DevicePlacement[] = [];
    set((state) => {
      const current = state.placementsByView[viewId] ?? [];
      placements = current.map((p) => (p.id === placementId ? { ...p, ...patch } : p));
      return {
        placementsByView: {
          ...state.placementsByView,
          [viewId]: placements,
        },
      };
    });
    try { changeListener?.(viewId, placements); } catch { /* swallow */ }
  },

  getPlacements(viewId) {
    return get().placementsByView[viewId] ?? [];
  },

  isDevicePlaced(viewId, deviceId) {
    return (get().placementsByView[viewId] ?? []).some((p) => p.deviceId === deviceId);
  },

  findPlacement(viewId, deviceId) {
    return (get().placementsByView[viewId] ?? []).find((p) => p.deviceId === deviceId);
  },

  getPlacedViews(deviceId) {
    const viewIds: string[] = [];
    for (const [viewId, placements] of Object.entries(get().placementsByView)) {
      if (placements.some((p) => p.deviceId === deviceId)) viewIds.push(viewId);
    }
    return viewIds;
  },

  setSnapMode(mode) {
    set({ snapMode: mode });
  },
}));

/** 工具函数：生成 placement id */
export function generatePlacementId(deviceId: string): string {
  return `placement_${deviceId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}