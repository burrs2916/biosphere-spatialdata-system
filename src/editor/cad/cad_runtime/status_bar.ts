import type { InteractionMode } from './cad_event_bus';

export interface StatusBarState {
  cursorX: number;
  cursorY: number;
  zoom: number;
  interactionMode: InteractionMode;
  selectedCount: number;
  layerName: string | null;
  snapEnabled: boolean;
  entityCount: number;
  visibleEntityCount: number;
  fps: number;
}

export class StatusBarManager {
  private _state: StatusBarState = {
    cursorX: 0,
    cursorY: 0,
    zoom: 1,
    interactionMode: 'select',
    selectedCount: 0,
    layerName: null,
    snapEnabled: false,
    entityCount: 0,
    visibleEntityCount: 0,
    fps: 0,
  };
  private _element: HTMLElement | null = null;
  private _updateScheduled = false;
  private _fpsFrames = 0;
  private _fpsLastTime = performance.now();

  attach(element: HTMLElement): void {
    this._element = element;
    this._render();
  }

  detach(): void {
    this._element = null;
  }

  update(partial: Partial<StatusBarState>): void {
    Object.assign(this._state, partial);
    this._scheduleUpdate();
  }

  updateCursorPosition(x: number, y: number): void {
    this._state.cursorX = x;
    this._state.cursorY = y;
    this._scheduleUpdate();
  }

  updateZoom(zoom: number): void {
    this._state.zoom = zoom;
    this._scheduleUpdate();
  }

  updateInteractionMode(mode: InteractionMode): void {
    this._state.interactionMode = mode;
    this._scheduleUpdate();
  }

  updateSelection(count: number, layerName?: string | null): void {
    this._state.selectedCount = count;
    if (layerName !== undefined) this._state.layerName = layerName;
    this._scheduleUpdate();
  }

  updateEntityCounts(total: number, visible: number): void {
    this._state.entityCount = total;
    this._state.visibleEntityCount = visible;
    this._scheduleUpdate();
  }

  tickFps(): void {
    this._fpsFrames++;
    const now = performance.now();
    if (now - this._fpsLastTime >= 1000) {
      this._state.fps = Math.round(this._fpsFrames * 1000 / (now - this._fpsLastTime));
      this._fpsFrames = 0;
      this._fpsLastTime = now;
      this._scheduleUpdate();
    }
  }

  private _scheduleUpdate(): void {
    if (this._updateScheduled) return;
    this._updateScheduled = true;
    requestAnimationFrame(() => {
      this._updateScheduled = false;
      this._render();
    });
  }

  private _render(): void {
    if (!this._element) return;
    const s = this._state;
    const modeLabels: Record<string, string> = {
      select: '选择',
      pan: '平移',
      draw_line: '画线',
      draw_circle: '画圆',
      draw_text: '文字',
      measure: '测量',
      annotate: '批注',
      search: '搜索',
    };
    this._element.innerHTML = `
      <span class="sb-item" title="光标坐标">X: ${s.cursorX.toFixed(2)} Y: ${s.cursorY.toFixed(2)}</span>
      <span class="sb-sep">|</span>
      <span class="sb-item" title="缩放比例">缩放: ${(s.zoom * 100).toFixed(0)}%</span>
      <span class="sb-sep">|</span>
      <span class="sb-item" title="交互模式">${modeLabels[s.interactionMode] ?? s.interactionMode}</span>
      <span class="sb-sep">|</span>
      <span class="sb-item" title="选中数量">选中: ${s.selectedCount}</span>
      ${s.layerName ? `<span class="sb-sep">|</span><span class="sb-item" title="图层">图层: ${s.layerName}</span>` : ''}
      <span class="sb-sep">|</span>
      <span class="sb-item" title="实体数">实体: ${s.visibleEntityCount}/${s.entityCount}</span>
      <span class="sb-sep">|</span>
      <span class="sb-item" title="捕捉">${s.snapEnabled ? '捕捉:开' : '捕捉:关'}</span>
      <span class="sb-sep">|</span>
      <span class="sb-item" title="帧率">FPS: ${s.fps}</span>
    `;
  }
}
