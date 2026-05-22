export { adapterRegistry } from "./adapters/registry";
export type { DataSourceAdapter, AdapterFetchResult, AdapterConnectOptions } from "./adapters/types";
export { HttpAdapter } from "./adapters/HttpAdapter";
export { WebSocketAdapter } from "./adapters/WebSocketAdapter";

export { DataSourceScheduler } from "./scheduler";
export { dataSourceEventBus } from "./events";
export type { DataSourceEventMap } from "./events";

export { DataPipeline } from "./pipeline";
export type { TransformStep, TransformFunction, PipelineConfig } from "./pipeline";

export { pluginManager } from "./plugins";
export type { DataSourcePlugin } from "./plugins";
