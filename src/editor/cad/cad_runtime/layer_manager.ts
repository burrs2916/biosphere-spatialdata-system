import type { LayerNode } from './scene_node';

export interface LayerChangeListener {
  onLayerChanged: (layerName: string, change: LayerChange) => void;
}

export type LayerChange = 'visibility' | 'frozen' | 'locked' | 'color' | 'added' | 'removed';

export class LayerManager {
  private layers: Map<string, LayerNode> = new Map();
  private hiddenLayers: Set<string> = new Set();
  private listeners: LayerChangeListener[] = [];

  addListener(listener: LayerChangeListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: LayerChangeListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  loadLayers(layers: LayerNode[]): void {
    this.layers.clear();
    this.hiddenLayers.clear();
    for (const layer of layers) {
      this.layers.set(layer.name, { ...layer });
    }
  }

  getLayer(name: string): LayerNode | undefined {
    return this.layers.get(name);
  }

  getAllLayers(): LayerNode[] {
    return Array.from(this.layers.values());
  }

  getVisibleLayers(): LayerNode[] {
    return Array.from(this.layers.values()).filter(l => l.visible && !this.hiddenLayers.has(l.name));
  }

  getLayerCount(): number {
    return this.layers.size;
  }

  setLayerVisibility(name: string, visible: boolean): void {
    const layer = this.layers.get(name);
    if (layer) {
      layer.visible = visible;
      if (visible) {
        this.hiddenLayers.delete(name);
      } else {
        this.hiddenLayers.add(name);
      }
      this.notifyListeners(name, 'visibility');
    }
  }

  toggleLayerVisibility(name: string): void {
    const layer = this.layers.get(name);
    if (layer) {
      this.setLayerVisibility(name, !layer.visible);
    }
  }

  isLayerVisible(name: string): boolean {
    const layer = this.layers.get(name);
    return layer ? layer.visible && !this.hiddenLayers.has(name) : false;
  }

  isLayerHidden(name: string): boolean {
    return this.hiddenLayers.has(name);
  }

  setLayerFrozen(name: string, frozen: boolean): void {
    const layer = this.layers.get(name);
    if (layer) {
      layer.frozen = frozen;
      this.notifyListeners(name, 'frozen');
    }
  }

  setLayerLocked(name: string, locked: boolean): void {
    const layer = this.layers.get(name);
    if (layer) {
      layer.locked = locked;
      this.notifyListeners(name, 'locked');
    }
  }

  setLayerColor(name: string, color: number): void {
    const layer = this.layers.get(name);
    if (layer) {
      layer.color = color;
      this.notifyListeners(name, 'color');
    }
  }

  addLayer(layer: LayerNode): void {
    this.layers.set(layer.name, { ...layer });
    this.notifyListeners(layer.name, 'added');
  }

  removeLayer(name: string): void {
    this.layers.delete(name);
    this.hiddenLayers.delete(name);
    this.notifyListeners(name, 'removed');
  }

  showAllLayers(): void {
    for (const layer of this.layers.values()) {
      layer.visible = true;
    }
    this.hiddenLayers.clear();
    // 批量通知 - 只通知一次，避免通知风暴
    this.notifyListeners('*', 'visibility');
  }

  hideAllLayers(): void {
    for (const layer of this.layers.values()) {
      layer.visible = false;
      this.hiddenLayers.add(layer.name);
    }
    // 批量通知 - 只通知一次，避免通知风暴
    this.notifyListeners('*', 'visibility');
  }

  private notifyListeners(layerName: string, change: LayerChange): void {
    for (const listener of this.listeners) {
      listener.onLayerChanged(layerName, change);
    }
  }
}
