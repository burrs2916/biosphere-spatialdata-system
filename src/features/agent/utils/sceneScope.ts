/**
 * 场景范围解析（scope 三级：全矿 / 单设备 / 场景）
 *
 * 项目红线：三场景设备严格绑定模型——`selectedDeviceIds` 空 → 组件不显示任何设备；
 * 绑定集控器 → 仅显示其下属分控器/传感器（子树）。本文件把这条「场景 → 设备集合」
 * 的解析复用到 AI 助手：读取场景组件的 `selectedDeviceIds`，经既有
 * `discoverMainControllerIds / discoverSubControllerIds / discoverSensorIds`
 * 展开成完整子树设备 ID，再交给后端做只读过滤。
 *
 * 设计取舍：scenes DB 与实时设备树只存在于前端，Rust ai_agent 不反向依赖，
 * 故「场景→设备」在前端一次性解析好，运行时随对话请求传给后端。
 */

import {
  discoverMainControllerIds,
  discoverSubControllerIds,
  discoverSensorIds,
} from "../../../devices/productCodePredicates";
import { useSceneStore } from "../../../store/sceneStore";
import { useDeviceStore } from "../../../store/deviceStore";
import type { SceneDSL } from "../../../types/scene";
import type { AgentScope, SceneScopeInfo } from "../proto/agent";

/** 收集一个场景所有组件绑定的 selectedDeviceIds（views / globalComponents / editorComponents 一并取，去重） */
export function collectSceneSelectedIds(scene: SceneDSL): string[] {
  const ids = new Set<string>();
  const sources: unknown[] = [scene.views, scene.globalComponents, scene.editorComponents];
  for (const src of sources) {
    const views = Array.isArray(src)
      ? (src as Array<{ components?: unknown[] }>)
      : [];
    for (const v of views) {
      const comps = v?.components ?? [];
      for (const c of comps) {
        const sd = (c as { config?: { selectedDeviceIds?: unknown } })?.config
          ?.selectedDeviceIds;
        if (Array.isArray(sd)) {
          for (const x of sd) {
            if (typeof x === "string" || typeof x === "number") ids.add(String(x));
          }
        }
      }
    }
  }
  return [...ids];
}

/**
 * 把一个场景解析为完整设备 ID 集合（含集控器→分控器→传感器子树）。
 * 严格绑定模型：selectedDeviceIds 为空 → 返回空数组（不显示任何设备）。
 */
export function resolveSceneDeviceIds(
  scene: SceneDSL,
  devices: Record<string, unknown>,
): string[] {
  const raw = collectSceneSelectedIds(scene);
  if (raw.length === 0) return [];
  const mains = discoverMainControllerIds(devices, raw);
  if (mains.length === 0) return [];
  const subs = discoverSubControllerIds(devices, mains);
  const sensors = discoverSensorIds(devices, [...mains, ...subs]);
  return [...new Set([...mains, ...subs, ...sensors])];
}

/** 构造一次运行所需的场景范围：列出全部场景及其已解析的设备集合 + 当前所在场景 id。
 *  无场景或无设备树时返回 null（不注入场景信息，后端按默认全矿处理）。 */
export function buildAgentScope(): AgentScope | null {
  const { scenes, activeSceneId } = useSceneStore.getState();
  const devices = useDeviceStore.getState().devices as unknown as Record<string, unknown>;
  if (!scenes || scenes.length === 0) return null;
  if (Object.keys(devices).length === 0) return null; // 设备树未加载，不传入以免误导
  const infos: SceneScopeInfo[] = (scenes ?? []).map((s) => {
    const anyScene = s as unknown as Record<string, unknown>;
    const sceneMode =
      typeof anyScene.sceneMode === "string" ? (anyScene.sceneMode as string) : "";
    return {
      id: s.id,
      name: s.name ?? "",
      sceneMode,
      deviceIds: resolveSceneDeviceIds(s, devices),
    };
  });
  return { scenes: infos, activeSceneId: activeSceneId ?? null };
}
