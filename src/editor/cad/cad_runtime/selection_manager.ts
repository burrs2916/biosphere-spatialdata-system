import type { SceneNode, BoundingBox } from './scene_node';

export interface SelectionChangeListener {
  onSelectionChanged: (added: number[], removed: number[]) => void;
}

export class SelectionManager {
  private selectedIds: Set<number> = new Set();
  private listeners: SelectionChangeListener[] = [];

  addListener(listener: SelectionChangeListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: SelectionChangeListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  select(id: number, nodes: Map<number, SceneNode>): void {
    if (!this.selectedIds.has(id)) {
      this.selectedIds.add(id);
      const node = nodes.get(id);
      if (node) node.selected = true;
      this.notifyListeners([id], []);
    }
  }

  deselect(id: number, nodes: Map<number, SceneNode>): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      const node = nodes.get(id);
      if (node) node.selected = false;
      this.notifyListeners([], [id]);
    }
  }

  toggle(id: number, nodes: Map<number, SceneNode>): void {
    if (this.selectedIds.has(id)) {
      this.deselect(id, nodes);
    } else {
      this.select(id, nodes);
    }
  }

  selectAll(nodes: Map<number, SceneNode>): void {
    const added: number[] = [];
    for (const [id, node] of nodes) {
      if (!this.selectedIds.has(id)) {
        this.selectedIds.add(id);
        node.selected = true;
        added.push(id);
      }
    }
    if (added.length > 0) this.notifyListeners(added, []);
  }

  clearSelection(nodes: Map<number, SceneNode>): void {
    const removed: number[] = [];
    for (const id of this.selectedIds) {
      const node = nodes.get(id);
      if (node) node.selected = false;
      removed.push(id);
    }
    this.selectedIds.clear();
    if (removed.length > 0) this.notifyListeners([], removed);
  }

  selectByRect(minX: number, minY: number, maxX: number, maxY: number, nodes: Map<number, SceneNode>): void {
    const added: number[] = [];
    for (const [id, node] of nodes) {
      if (this.isNodeInRect(node, minX, minY, maxX, maxY) && !this.selectedIds.has(id)) {
        this.selectedIds.add(id);
        node.selected = true;
        added.push(id);
      }
    }
    if (added.length > 0) this.notifyListeners(added, []);
  }

  getSelectedIds(): number[] {
    return Array.from(this.selectedIds);
  }

  getSelectedCount(): number {
    return this.selectedIds.size;
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  getSelectionBounds(nodes: Map<number, SceneNode>): BoundingBox | null {
    if (this.selectedIds.size === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of this.selectedIds) {
      const node = nodes.get(id);
      if (node) {
        minX = Math.min(minX, node.bbox.minX);
        minY = Math.min(minY, node.bbox.minY);
        maxX = Math.max(maxX, node.bbox.maxX);
        maxY = Math.max(maxY, node.bbox.maxY);
      }
    }
    return { minX, minY, maxX, maxY };
  }

  private isNodeInRect(node: SceneNode, minX: number, minY: number, maxX: number, maxY: number): boolean {
    return node.bbox.minX >= minX && node.bbox.maxX <= maxX &&
           node.bbox.minY >= minY && node.bbox.maxY <= maxY;
  }

  private notifyListeners(added: number[], removed: number[]): void {
    for (const listener of this.listeners) {
      listener.onSelectionChanged(added, removed);
    }
  }
}
