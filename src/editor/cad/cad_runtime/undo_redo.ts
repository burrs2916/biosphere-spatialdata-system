export interface UndoAction {
  type: string;
  description: string;
  undo: () => void;
  redo: () => void;
}

export class UndoRedoManager {
  private _undoStack: UndoAction[] = [];
  private _redoStack: UndoAction[] = [];
  private _maxStackSize = 50;
  private _isPerforming = false;
  private _onStackChanged?: () => void;

  constructor(maxStackSize = 50) {
    this._maxStackSize = maxStackSize;
  }

  setOnStackChanged(callback: () => void): void {
    this._onStackChanged = callback;
  }

  push(action: UndoAction): void {
    if (this._isPerforming) return;
    this._undoStack.push(action);
    this._redoStack = [];
    if (this._undoStack.length > this._maxStackSize) {
      this._undoStack.shift();
    }
    this._onStackChanged?.();
  }

  undo(): boolean {
    if (this._undoStack.length === 0) return false;
    const action = this._undoStack.pop()!;
    this._isPerforming = true;
    try {
      action.undo();
    } finally {
      this._isPerforming = false;
    }
    this._redoStack.push(action);
    this._onStackChanged?.();
    return true;
  }

  redo(): boolean {
    if (this._redoStack.length === 0) return false;
    const action = this._redoStack.pop()!;
    this._isPerforming = true;
    try {
      action.redo();
    } finally {
      this._isPerforming = false;
    }
    this._undoStack.push(action);
    this._onStackChanged?.();
    return true;
  }

  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  getUndoDescription(): string | null {
    return this._undoStack.length > 0 ? this._undoStack[this._undoStack.length - 1].description : null;
  }

  getRedoDescription(): string | null {
    return this._redoStack.length > 0 ? this._redoStack[this._redoStack.length - 1].description : null;
  }

  clear(): void {
    this._undoStack = [];
    this._redoStack = [];
    this._onStackChanged?.();
  }

  getUndoCount(): number {
    return this._undoStack.length;
  }

  getRedoCount(): number {
    return this._redoStack.length;
  }

  beginGroup(): void {
  }

  endGroup(): void {
  }
}
