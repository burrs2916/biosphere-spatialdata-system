export interface HostAPI {
  getComponentConfig(componentId: string): Record<string, unknown> | null;
  setComponentConfig(componentId: string, config: Record<string, unknown>): void;
  updateComponentConfig(componentId: string, partial: Record<string, unknown>): void;
  getComponentData(componentId: string): unknown;
  setComponentData(componentId: string, data: unknown): void;
  emitEvent(componentId: string, eventName: string, payload?: unknown): void;
  subscribeEvent(componentId: string, eventName: string, handler: (payload: unknown) => void): () => void;
  requestDataSource(sourceId: string, params?: Record<string, unknown>): Promise<unknown>;
  getSceneState(): SceneStateInfo;
  logger: PluginLogger;
}

export interface SceneStateInfo {
  sceneId: string;
  viewport: { width: number; height: number; scale: number };
  activeLayerId: string | null;
  selectedComponentIds: string[];
}

export interface PluginLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

type EventHandler = (payload: unknown) => void;

class HostAPIImpl implements HostAPI {
  private componentConfigs = new Map<string, Record<string, unknown>>();
  private componentData = new Map<string, unknown>();
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private pluginName: string;

  constructor(pluginName: string) {
    this.pluginName = pluginName;
  }

  getComponentConfig(componentId: string): Record<string, unknown> | null {
    return this.componentConfigs.get(componentId) ?? null;
  }

  setComponentConfig(componentId: string, config: Record<string, unknown>): void {
    this.componentConfigs.set(componentId, config);
  }

  updateComponentConfig(componentId: string, partial: Record<string, unknown>): void {
    const existing = this.componentConfigs.get(componentId) ?? {};
    this.componentConfigs.set(componentId, { ...existing, ...partial });
  }

  getComponentData(componentId: string): unknown {
    return this.componentData.get(componentId);
  }

  setComponentData(componentId: string, data: unknown): void {
    this.componentData.set(componentId, data);
  }

  emitEvent(componentId: string, eventName: string, payload?: unknown): void {
    const key = `${componentId}:${eventName}`;
    const handlers = this.eventHandlers.get(key);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          this.logger.error(`Event handler error for ${key}:`, err);
        }
      });
    }
  }

  subscribeEvent(componentId: string, eventName: string, handler: EventHandler): () => void {
    const key = `${componentId}:${eventName}`;
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, new Set<EventHandler>());
    }
    this.eventHandlers.get(key)!.add(handler);

    return () => {
      const handlers = this.eventHandlers.get(key);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(key);
        }
      }
    };
  }

  async requestDataSource(sourceId: string, _params?: Record<string, unknown>): Promise<unknown> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("get_datasource", { id: sourceId });
    } catch (err) {
      this.logger.error(`Failed to request data source "${sourceId}":`, err);
      return null;
    }
  }

  getSceneState(): SceneStateInfo {
    return {
      sceneId: "",
      viewport: { width: 1920, height: 1080, scale: 1 },
      activeLayerId: null,
      selectedComponentIds: [],
    };
  }

  logger: PluginLogger = {
    info: (message: string, data?: unknown) => {
      console.log(`[Plugin:${this.pluginName}] ${message}`, data ?? "");
    },
    warn: (message: string, data?: unknown) => {
      console.warn(`[Plugin:${this.pluginName}] ${message}`, data ?? "");
    },
    error: (message: string, data?: unknown) => {
      console.error(`[Plugin:${this.pluginName}] ${message}`, data ?? "");
    },
  };
}

const hostAPIInstances = new Map<string, HostAPIImpl>();

export function createHostAPI(pluginName: string): HostAPI {
  if (!hostAPIInstances.has(pluginName)) {
    hostAPIInstances.set(pluginName, new HostAPIImpl(pluginName));
  }
  return hostAPIInstances.get(pluginName)!;
}

export function getHostAPI(pluginName: string): HostAPI | null {
  return hostAPIInstances.get(pluginName) ?? null;
}

export function destroyHostAPI(pluginName: string): void {
  hostAPIInstances.delete(pluginName);
}
