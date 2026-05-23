import type { SceneNode } from './scene_node';

export interface ProgressiveLoadConfig {
  chunkSize: number;
  delayBetweenChunks: number;
  priorityTypes: string[];
}

const DEFAULT_CONFIG: ProgressiveLoadConfig = {
  chunkSize: 200,
  delayBetweenChunks: 16,
  priorityTypes: ['line', 'arc', 'circle', 'polyline'],
};

export class ProgressiveLoader {
  private _pendingNodes: SceneNode[] = [];
  private _loadedCount = 0;
  private _totalCount = 0;
  private _isRunning = false;
  private _config: ProgressiveLoadConfig = DEFAULT_CONFIG;
  private _onChunkReady?: (nodes: SceneNode[], loaded: number, total: number) => void;
  private _onComplete?: () => void;
  private _onProgress?: (loaded: number, total: number) => void;
  private _timerId: ReturnType<typeof setTimeout> | null = null;
  private _cancelled = false;

  setConfig(config: Partial<ProgressiveLoadConfig>): void {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  setCallbacks(
    onChunkReady?: (nodes: SceneNode[], loaded: number, total: number) => void,
    onComplete?: () => void,
    onProgress?: (loaded: number, total: number) => void,
  ): void {
    this._onChunkReady = onChunkReady;
    this._onComplete = onComplete;
    this._onProgress = onProgress;
  }

  load(nodes: SceneNode[]): void {
    this.cancel();
    this._pendingNodes = this._prioritizeNodes(nodes);
    this._totalCount = nodes.length;
    this._loadedCount = 0;
    this._cancelled = false;
    this._isRunning = true;
    this._processNextChunk();
  }

  cancel(): void {
    this._cancelled = true;
    this._isRunning = false;
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get progress(): number {
    return this._totalCount > 0 ? this._loadedCount / this._totalCount : 0;
  }

  private _prioritizeNodes(nodes: SceneNode[]): SceneNode[] {
    const prioritySet = new Set(this._config.priorityTypes);
    const high: SceneNode[] = [];
    const low: SceneNode[] = [];
    for (const node of nodes) {
      if (prioritySet.has(node.type)) {
        high.push(node);
      } else {
        low.push(node);
      }
    }
    return [...high, ...low];
  }

  private _processNextChunk(): void {
    if (this._cancelled) return;
    if (this._pendingNodes.length === 0) {
      this._isRunning = false;
      this._onComplete?.();
      return;
    }
    const chunk = this._pendingNodes.splice(0, this._config.chunkSize);
    this._loadedCount += chunk.length;
    this._onChunkReady?.(chunk, this._loadedCount, this._totalCount);
    this._onProgress?.(this._loadedCount, this._totalCount);
    if (this._pendingNodes.length > 0) {
      this._timerId = setTimeout(() => {
        this._timerId = null;
        this._processNextChunk();
      }, this._config.delayBetweenChunks);
    } else {
      this._isRunning = false;
      this._onComplete?.();
    }
  }
}
