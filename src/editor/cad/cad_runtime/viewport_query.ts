import type { SceneNode, BoundingBox } from './scene_node';
import { SpatialIndex } from './spatial_index';
import { LayerManager } from './layer_manager';

export interface ViewportState {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  zoom: number;
}

export class ViewportQuery {
  private spatialIndex: SpatialIndex;
  private layerManager: LayerManager;
  private viewport: ViewportState = { centerX: 0, centerY: 0, width: 1000, height: 800, zoom: 1 };

  constructor(spatialIndex: SpatialIndex, layerManager: LayerManager) {
    this.spatialIndex = spatialIndex;
    this.layerManager = layerManager;
  }

  setViewport(viewport: ViewportState): void {
    this.viewport = { ...viewport };
  }

  getViewport(): ViewportState {
    return { ...this.viewport };
  }

  getViewportBounds(): BoundingBox {
    const halfW = this.viewport.width / (2 * this.viewport.zoom);
    const halfH = this.viewport.height / (2 * this.viewport.zoom);
    return {
      minX: this.viewport.centerX - halfW,
      minY: this.viewport.centerY - halfH,
      maxX: this.viewport.centerX + halfW,
      maxY: this.viewport.centerY + halfH,
    };
  }

  queryVisibleNodes(nodes: Map<number, SceneNode>): SceneNode[] {
    const bounds = this.getViewportBounds();
    const candidateIds = this.spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);

    const result: SceneNode[] = [];
    for (const id of candidateIds) {
      const node = nodes.get(id);
      if (node && node.visible && this.layerManager.isLayerVisible(node.layer)) {
        result.push(node);
      }
    }
    return result;
  }

  queryVisibleByLayer(nodes: Map<number, SceneNode>, layerName: string): SceneNode[] {
    const bounds = this.getViewportBounds();
    const candidateIds = this.spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);

    const result: SceneNode[] = [];
    for (const id of candidateIds) {
      const node = nodes.get(id);
      if (node && node.layer === layerName && node.visible) {
        result.push(node);
      }
    }
    return result;
  }

  hitTest(x: number, y: number, tolerance: number, nodes: Map<number, SceneNode>): SceneNode | null {
    const candidateIds = this.spatialIndex.queryPoint(x, y, tolerance);

    let closest: SceneNode | null = null;
    let closestDist = Infinity;

    for (const id of candidateIds) {
      const node = nodes.get(id);
      if (!node || !node.visible || !this.layerManager.isLayerVisible(node.layer)) continue;

      const dist = this.distanceToNode(node, x, y);
      if (dist < closestDist && dist <= tolerance) {
        closestDist = dist;
        closest = node;
      }
    }
    return closest;
  }

  zoomToFit(bounds: BoundingBox, padding: number = 0.1): ViewportState {
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    if (bw <= 0 || bh <= 0) return this.viewport;

    const padW = bw * padding;
    const padH = bh * padding;
    const zoomX = this.viewport.width / (bw + padW * 2);
    const zoomY = this.viewport.height / (bh + padH * 2);
    const zoom = Math.min(zoomX, zoomY);

    return {
      centerX: (bounds.minX + bounds.maxX) / 2,
      centerY: (bounds.minY + bounds.maxY) / 2,
      width: this.viewport.width,
      height: this.viewport.height,
      zoom,
    };
  }

  private distanceToNode(node: SceneNode, x: number, y: number): number {
    const cx = (node.bbox.minX + node.bbox.maxX) / 2;
    const cy = (node.bbox.minY + node.bbox.maxY) / 2;
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  }
}
