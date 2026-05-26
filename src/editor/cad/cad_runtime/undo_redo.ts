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
  private _groupDepth = 0;
  private _currentGroup: UndoAction[] = [];
  private _groupDescription = '';

  constructor(maxStackSize = 50) {
    this._maxStackSize = maxStackSize;
  }

  setOnStackChanged(callback: () => void): void {
    this._onStackChanged = callback;
  }

  push(action: UndoAction): void {
    if (this._isPerforming) return;

    if (this._groupDepth > 0) {
      this._currentGroup.push(action);
      return;
    }

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
    this._groupDepth = 0;
    this._currentGroup = [];
    this._groupDescription = '';
    this._onStackChanged?.();
  }

  getUndoCount(): number {
    return this._undoStack.length;
  }

  getRedoCount(): number {
    return this._redoStack.length;
  }

  beginGroup(description?: string): void {
    this._groupDepth++;
    if (this._groupDepth === 1) {
      this._currentGroup = [];
      this._groupDescription = description || '';
    }
  }

  endGroup(): void {
    if (this._groupDepth <= 0) {
      console.warn('[UndoRedoManager] endGroup called without matching beginGroup');
      return;
    }

    this._groupDepth--;

    if (this._groupDepth === 0 && this._currentGroup.length > 0) {
      const groupActions = [...this._currentGroup];
      const groupDesc = this._groupDescription || groupActions.map(a => a.description).join(', ');

      const groupAction: UndoAction = {
        type: 'group',
        description: groupDesc,
        undo: () => {
          for (let i = groupActions.length - 1; i >= 0; i--) {
            groupActions[i].undo();
          }
        },
        redo: () => {
          for (const a of groupActions) {
            a.redo();
          }
        },
      };

      this._undoStack.push(groupAction);
      this._redoStack = [];
      if (this._undoStack.length > this._maxStackSize) {
        this._undoStack.shift();
      }
      this._currentGroup = [];
      this._groupDescription = '';
      this._onStackChanged?.();
    }
  }

  isInGroup(): boolean {
    return this._groupDepth > 0;
  }
}
