import * as THREE from 'three';
import type { SceneNode } from '../cad_runtime/scene_node';
import type { SnapPoint, SnapSettings } from './types';

export class SnapManager {
  private _enabledSnaps: Set<string>;
  private _snapRadius: number;
  private _nodeIndex: Map<string, SceneNode>;
  private _entityLayers: Map<string, string>;
  private _hiddenLayers: Set<string>;

  constructor(settings?: Partial<SnapSettings>) {
    this._enabledSnaps = new Set<string>(['endpoint', 'midpoint', 'center']);
    this._snapRadius = settings?.snapRadius ?? 10;
    this._nodeIndex = new Map();
    this._entityLayers = new Map();
    this._hiddenLayers = new Set();
  }

  setNodeIndex(nodeIndex: Map<string, SceneNode>): void {
    this._nodeIndex = nodeIndex;
  }

  setEntityLayers(entityLayers: Map<string, string>): void {
    this._entityLayers = entityLayers;
  }

  setHiddenLayers(hiddenLayers: Set<string>): void {
    this._hiddenLayers = hiddenLayers;
  }

  enableSnap(type: string): void {
    this._enabledSnaps.add(type);
  }

  disableSnap(type: string): void {
    this._enabledSnaps.delete(type);
  }

  setSnapRadius(radius: number): void {
    this._snapRadius = radius;
  }

  isSnapEnabled(type: string): boolean {
    return this._enabledSnaps.has(type);
  }

  /**
   * 查找捕捉点
   * @param mouseX 鼠标X坐标（屏幕坐标）
   * @param mouseY 鼠标Y坐标（屏幕坐标）
   * @param camera 相机
   * @param canvasWidth canvas宽度
   * @param canvasHeight canvas高度
   * @returns 捕捉点或null
   */
  findSnapPoint(
    mouseX: number,
    mouseY: number,
    camera: THREE.OrthographicCamera,
    canvasWidth: number,
    canvasHeight: number
  ): SnapPoint | null {
    // 将屏幕坐标转换为世界坐标
    const rect = { left: 0, top: 0, width: canvasWidth, height: canvasHeight };
    const ndcX = ((mouseX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((mouseY - rect.top) / rect.height) * 2 + 1;
    
    const worldX = camera.position.x + ndcX * (camera.right - camera.left) / 2;
    const worldY = camera.position.y + ndcY * (camera.top - camera.bottom) / 2;

    // 计算捕捉半径对应的世界坐标距离
    const worldSnapRadius = this._snapRadius * (camera.right - camera.left) / canvasWidth;

    let closestSnap: SnapPoint | null = null;
    let closestDist = worldSnapRadius;

    // 端点捕捉
    if (this._enabledSnaps.has('endpoint')) {
      const snap = this._findEndpoint(worldX, worldY, worldSnapRadius);
      if (snap && snap.distance < closestDist) {
        closestSnap = snap;
        closestDist = snap.distance;
      }
    }

    // 中点捕捉
    if (this._enabledSnaps.has('midpoint')) {
      const snap = this._findMidpoint(worldX, worldY, worldSnapRadius);
      if (snap && snap.distance < closestDist) {
        closestSnap = snap;
        closestDist = snap.distance;
      }
    }

    // 圆心捕捉
    if (this._enabledSnaps.has('center')) {
      const snap = this._findCenter(worldX, worldY, worldSnapRadius);
      if (snap && snap.distance < closestDist) {
        closestSnap = snap;
        closestDist = snap.distance;
      }
    }

    // 交点捕捉（性能开销大，放在最后）
    if (this._enabledSnaps.has('intersection')) {
      const snap = this._findIntersection(worldX, worldY, worldSnapRadius);
      if (snap && snap.distance < closestDist) {
        closestSnap = snap;
        closestDist = snap.distance;
      }
    }

    return closestSnap;
  }

  private _findEndpoint(worldX: number, worldY: number, radius: number): SnapPoint | null {
    let closest: SnapPoint | null = null;
    let closestDist = radius;

    for (const [id, node] of this._nodeIndex) {
      if (this._isEntityHidden(id)) continue;

      const points = this._getEndpointPoints(node);
      for (const p of points) {
        const dist = Math.hypot(p.x - worldX, p.y - worldY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = {
            x: p.x,
            y: p.y,
            type: 'endpoint',
            entityId: id,
            description: `端点: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`,
            distance: dist,
          } as SnapPoint & { distance: number };
        }
      }
    }

    return closest;
  }

  private _findMidpoint(worldX: number, worldY: number, radius: number): SnapPoint | null {
    let closest: SnapPoint | null = null;
    let closestDist = radius;

    for (const [id, node] of this._nodeIndex) {
      if (this._isEntityHidden(id)) continue;

      const points = this._getMidpoints(node);
      for (const p of points) {
        const dist = Math.hypot(p.x - worldX, p.y - worldY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = {
            x: p.x,
            y: p.y,
            type: 'midpoint',
            entityId: id,
            description: `中点: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`,
            distance: dist,
          } as SnapPoint & { distance: number };
        }
      }
    }

    return closest;
  }

  private _findCenter(worldX: number, worldY: number, radius: number): SnapPoint | null {
    let closest: SnapPoint | null = null;
    let closestDist = radius;

    for (const [id, node] of this._nodeIndex) {
      if (this._isEntityHidden(id)) continue;

      const center = this._getCenter(node);
      if (center) {
        const dist = Math.hypot(center.x - worldX, center.y - worldY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = {
            x: center.x,
            y: center.y,
            type: 'center',
            entityId: id,
            description: `圆心: (${center.x.toFixed(2)}, ${center.y.toFixed(2)})`,
            distance: dist,
          } as SnapPoint & { distance: number };
        }
      }
    }

    return closest;
  }

  private _findIntersection(_worldX: number, _worldY: number, _radius: number): SnapPoint | null {
    // 交点捕捉实现较复杂，先返回 null
    // TODO: 实现线段-线段、线段-圆、圆-圆交点计算
    return null;
  }

  private _getEndpointPoints(node: SceneNode): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];

    switch (node.type) {
      case 'line':
        points.push({ x: (node as any).startX, y: (node as any).startY });
        points.push({ x: (node as any).endX, y: (node as any).endY });
        break;
      case 'circle':
      case 'arc':
        // 圆和圆弧的"端点"概念不适用，跳过
        break;
      case 'lwPolyline':
      case 'polyline': {
        const vertices = (node as any).vertices || [];
        for (const v of vertices) {
          points.push({ x: v.x, y: v.y });
        }
        break;
      }
      case 'text':
      case 'mText':
      case 'point':
      case 'insert':
        points.push({ x: (node as any).posX, y: (node as any).posY });
        break;
    }

    return points;
  }

  private _getMidpoints(node: SceneNode): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];

    switch (node.type) {
      case 'line': {
        const startX = (node as any).startX;
        const startY = (node as any).startY;
        const endX = (node as any).endX;
        const endY = (node as any).endY;
        points.push({ x: (startX + endX) / 2, y: (startY + endY) / 2 });
        break;
      }
      case 'lwPolyline':
      case 'polyline': {
        const vertices = (node as any).vertices || [];
        for (let i = 0; i < vertices.length - 1; i++) {
          const v1 = vertices[i];
          const v2 = vertices[i + 1];
          if (v1.bulge === 0 || !v1.bulge) {
            points.push({ x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 });
          }
        }
        break;
      }
    }

    return points;
  }

  private _getCenter(node: SceneNode): { x: number; y: number } | null {
    switch (node.type) {
      case 'circle':
      case 'arc':
        return { x: (node as any).centerX, y: (node as any).centerY };
      case 'ellipse':
        return { x: (node as any).centerX, y: (node as any).centerY };
      default:
        return null;
    }
  }

  private _isEntityHidden(entityId: string): boolean {
    const layer = this._entityLayers.get(entityId);
    if (!layer) return false;
    return this._hiddenLayers.has(layer);
  }
}
