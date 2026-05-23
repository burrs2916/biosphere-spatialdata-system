import type { CameraInfo } from '../CadRenderer';
import type { MeasureResult } from '../measure/MeasureTool';
import type { Annotation } from './annotation_tool';
import type { SearchResult } from './search_engine';

export type InteractionMode = 'select' | 'pan' | 'draw_line' | 'draw_circle' | 'draw_text' | 'measure' | 'annotate' | 'search';

export interface EntityPickEvent {
  entityId: string;
  layer: string;
  worldX: number;
  worldY: number;
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  ctrlKey: boolean;
}

export interface EntityMovedEvent {
  entityId: string;
  dx: number;
  dy: number;
}

export interface SelectionChangedEvent {
  entityIds: string[];
  added?: string[];
  removed?: string[];
}

export interface ContextMenuEvent {
  entityId: string;
  layer: string;
  clientX: number;
  clientY: number;
  worldX: number;
  worldY: number;
}

export interface HoverEvent {
  entityId: string | null;
  layer: string | null;
  worldX: number;
  worldY: number;
}

export interface LayerVisibilityEvent {
  layerName: string;
  visible: boolean;
}

export interface DrawCompleteEvent {
  entityJson: string;
}

export type CadEventType =
  | 'entityClick'
  | 'entityDoubleClick'
  | 'entityMoved'
  | 'selectionChanged'
  | 'contextMenu'
  | 'hover'
  | 'cameraChanged'
  | 'cameraInteractionEnd'
  | 'layerVisibilityChanged'
  | 'drawComplete'
  | 'measureResult'
  | 'annotationAdded'
  | 'annotationRemoved'
  | 'searchResult'
  | 'interactionModeChanged'
  | 'cursorPositionChanged'
  | 'contextLost'
  | 'contextRestored'
  | 'loadingProgress';

export type CadEventMap = {
  entityClick: EntityPickEvent;
  entityDoubleClick: EntityPickEvent;
  entityMoved: EntityMovedEvent;
  selectionChanged: SelectionChangedEvent;
  contextMenu: ContextMenuEvent;
  hover: HoverEvent;
  cameraChanged: CameraInfo;
  cameraInteractionEnd: CameraInfo;
  layerVisibilityChanged: LayerVisibilityEvent;
  drawComplete: DrawCompleteEvent;
  measureResult: MeasureResult;
  annotationAdded: Annotation;
  annotationRemoved: string;
  searchResult: SearchResult[];
  interactionModeChanged: InteractionMode;
  cursorPositionChanged: { x: number; y: number };
  contextLost: void;
  contextRestored: void;
  loadingProgress: { loaded: number; total: number };
};

type CadEventHandler<T extends CadEventType> = (event: CadEventMap[T]) => void;

export class CadEventBus {
  private _handlers: Map<CadEventType, Set<CadEventHandler<any>>> = new Map();

  on<T extends CadEventType>(event: T, handler: CadEventHandler<T>): () => void {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set());
    }
    this._handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  once<T extends CadEventType>(event: T, handler: CadEventHandler<T>): () => void {
    const wrapper: CadEventHandler<T> = (e) => {
      this.off(event, wrapper);
      handler(e);
    };
    return this.on(event, wrapper);
  }

  off<T extends CadEventType>(event: T, handler: CadEventHandler<T>): void {
    this._handlers.get(event)?.delete(handler);
  }

  emit<T extends CadEventType>(event: T, data: CadEventMap[T]): void {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    }
  }

  removeAllListeners(event?: CadEventType): void {
    if (event) {
      this._handlers.delete(event);
    } else {
      this._handlers.clear();
    }
  }

  listenerCount(event: CadEventType): number {
    return this._handlers.get(event)?.size ?? 0;
  }
}
