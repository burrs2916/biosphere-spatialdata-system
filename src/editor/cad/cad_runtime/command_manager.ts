import type { SceneNode } from './scene_node';
import type { Command } from './commands';

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize: number;
  private changeListeners: Array<() => void> = [];

  constructor(maxStackSize: number = 100) {
    this.maxStackSize = maxStackSize;
  }

  addChangeListener(listener: () => void): void {
    this.changeListeners.push(listener);
  }

  removeChangeListener(listener: () => void): void {
    const idx = this.changeListeners.indexOf(listener);
    if (idx >= 0) this.changeListeners.splice(idx, 1);
  }

  execute(command: Command, nodes: Map<number, SceneNode>): void {
    command.execute(nodes);
    this.undoStack.push(command);
    this.redoStack.length = 0;

    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    this.notifyChange();
  }

  undo(nodes: Map<number, SceneNode>): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo(nodes);
    this.redoStack.push(command);
    this.notifyChange();
    return true;
  }

  redo(nodes: Map<number, SceneNode>): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute(nodes);
    this.undoStack.push(command);
    this.notifyChange();
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].getDescription();
  }

  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].getDescription();
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.notifyChange();
  }

  private notifyChange(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}
