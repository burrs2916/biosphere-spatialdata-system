import type { SceneNode } from './scene_node';

export class DirtyTracker {
  private dirtyNodes: Set<number> = new Set();
  private dirtyLayers: Set<string> = new Set();
  private globalDirty: boolean = false;

  markNodeDirty(id: number): void {
    this.dirtyNodes.add(id);
  }

  markLayerDirty(layer: string): void {
    this.dirtyLayers.add(layer);
  }

  markGlobalDirty(): void {
    this.globalDirty = true;
  }

  isNodeDirty(id: number): boolean {
    return this.globalDirty || this.dirtyNodes.has(id);
  }

  isLayerDirty(layer: string): boolean {
    return this.globalDirty || this.dirtyLayers.has(layer);
  }

  isGlobalDirty(): boolean {
    return this.globalDirty;
  }

  getDirtyNodeIds(): number[] {
    return Array.from(this.dirtyNodes);
  }

  getDirtyLayerNames(): string[] {
    return Array.from(this.dirtyLayers);
  }

  clear(): void {
    this.dirtyNodes.clear();
    this.dirtyLayers.clear();
    this.globalDirty = false;
  }

  applyNodeChanges(nodes: Map<number, SceneNode>): void {
    for (const id of this.dirtyNodes) {
      const node = nodes.get(id);
      if (node) {
        node.dirty = true;
      }
    }
  }
}
