import * as THREE from 'three';
import type { UndoRedoManager, UndoAction } from './undo_redo';

export type AnnotationType = 'text' | 'arrow' | 'rect' | 'circle' | 'freehand';

export interface Annotation {
  id: string;
  type: AnnotationType;
  points: Array<{ x: number; y: number }>;
  text?: string;
  color: string;
  createdAt: number;
}

export class AnnotationTool {
  private _scene: THREE.Scene | null = null;
  private _camera: THREE.OrthographicCamera | null = null;
  private _annotations: Map<string, Annotation> = new Map();
  private _visuals: Map<string, THREE.Object3D> = new Map();
  private _currentType: AnnotationType = 'text';
  private _currentColor: string = '#ff4444';
  private _isDrawing = false;
  private _currentPoints: Array<{ x: number; y: number }> = [];
  private _tempVisual: THREE.Object3D | null = null;
  private _onAnnotationAdded?: (annotation: Annotation) => void;
  private _onAnnotationRemoved?: (id: string) => void;
  private _canvasWidth = 0;
  private _canvasHeight = 0;
  private _idCounter = 0;
  private _undoRedoManager: UndoRedoManager | null = null;

  setScene(scene: THREE.Scene): void {
    this._scene = scene;
  }

  setCamera(camera: THREE.OrthographicCamera): void {
    this._camera = camera;
  }

  setCanvasSize(width: number, height: number): void {
    this._canvasWidth = width;
    this._canvasHeight = height;
  }

  setCallbacks(onAdded?: (annotation: Annotation) => void, onRemoved?: (id: string) => void): void {
    this._onAnnotationAdded = onAdded;
    this._onAnnotationRemoved = onRemoved;
  }

  setUndoRedoManager(manager: UndoRedoManager): void {
    this._undoRedoManager = manager;
  }

  setType(type: AnnotationType): void {
    this._currentType = type;
    this.cancel();
  }

  setColor(color: string): void {
    this._currentColor = color;
  }

  startDrawing(): void {
    this._isDrawing = true;
    this._currentPoints = [];
  }

  addPoint(worldX: number, worldY: number): void {
    this._currentPoints.push({ x: worldX, y: worldY });
    this._updateTempVisual();
    const required = this._getRequiredPoints();
    if (this._currentPoints.length >= required) {
      this._finishAnnotation();
    }
  }

  updatePreview(worldX: number, worldY: number): void {
    if (!this._isDrawing || this._currentPoints.length === 0) return;
    const previewPoints = [...this._currentPoints, { x: worldX, y: worldY }];
    this._updateTempVisualWithPoints(previewPoints);
  }

  cancel(): void {
    this._isDrawing = false;
    this._currentPoints = [];
    this._removeTempVisual();
  }

  removeAnnotation(id: string): void {
    const annotation = this._annotations.get(id);
    this._removeAnnotationInternal(id);

    if (this._undoRedoManager && annotation) {
      const capturedAnnotation = annotation;
      const undoAction: UndoAction = {
        type: 'annotation-remove',
        description: `删除标注: ${capturedAnnotation.id}`,
        undo: () => {
          this._annotations.set(id, capturedAnnotation);
          this._createVisual(capturedAnnotation);
          this._onAnnotationAdded?.(capturedAnnotation);
        },
        redo: () => { this._removeAnnotationInternal(id); },
      };
      this._undoRedoManager.push(undoAction);
    }
  }

  private _removeAnnotationInternal(id: string): void {
    const visual = this._visuals.get(id);
    if (visual && this._scene) {
      this._scene.remove(visual);
      this._disposeObject3D(visual);
    }
    this._visuals.delete(id);
    this._annotations.delete(id);
    this._onAnnotationRemoved?.(id);
  }

  clearAll(): void {
    for (const [id] of this._annotations) {
      this.removeAnnotation(id);
    }
  }

  getAnnotations(): Annotation[] {
    return Array.from(this._annotations.values());
  }

  addTextAnnotation(worldX: number, worldY: number, text: string): Annotation | null {
    const id = `ann_${++this._idCounter}_${Date.now()}`;
    const annotation: Annotation = {
      id,
      type: 'text',
      points: [{ x: worldX, y: worldY }],
      text,
      color: this._currentColor,
      createdAt: Date.now(),
    };
    this._annotations.set(id, annotation);
    this._createTextVisual(annotation);
    this._onAnnotationAdded?.(annotation);

    if (this._undoRedoManager) {
      const undoAction: UndoAction = {
        type: 'annotation-add',
        description: `添加文本标注: ${text}`,
        undo: () => { this._removeAnnotationInternal(id); },
        redo: () => {
          this._annotations.set(id, annotation);
          this._createTextVisual(annotation);
          this._onAnnotationAdded?.(annotation);
        },
      };
      this._undoRedoManager.push(undoAction);
    }

    return annotation;
  }

  private _getRequiredPoints(): number {
    switch (this._currentType) {
      case 'text': return 1;
      case 'arrow': return 2;
      case 'rect': return 2;
      case 'circle': return 2;
      case 'freehand': return Infinity;
      default: return 2;
    }
  }

  private _finishAnnotation(): void {
    if (this._currentPoints.length === 0) return;
    const id = `ann_${++this._idCounter}_${Date.now()}`;
    const annotation: Annotation = {
      id,
      type: this._currentType,
      points: [...this._currentPoints],
      color: this._currentColor,
      createdAt: Date.now(),
    };
    this._annotations.set(id, annotation);
    this._removeTempVisual();
    this._createVisual(annotation);
    this._onAnnotationAdded?.(annotation);

    if (this._undoRedoManager) {
      const undoAction: UndoAction = {
        type: 'annotation-add',
        description: `添加${this._currentType}标注`,
        undo: () => { this._removeAnnotationInternal(id); },
        redo: () => {
          this._annotations.set(id, annotation);
          this._createVisual(annotation);
          this._onAnnotationAdded?.(annotation);
        },
      };
      this._undoRedoManager.push(undoAction);
    }

    this._isDrawing = false;
    this._currentPoints = [];
  }

  private _createVisual(annotation: Annotation): void {
    if (!this._scene || !this._camera) return;
    const color = new THREE.Color(annotation.color);
    let visual: THREE.Object3D | null = null;
    switch (annotation.type) {
      case 'arrow': visual = this._createArrowVisual(annotation.points, color); break;
      case 'rect': visual = this._createRectVisual(annotation.points, color); break;
      case 'circle': visual = this._createCircleVisual(annotation.points, color); break;
      case 'freehand': visual = this._createFreehandVisual(annotation.points, color); break;
      case 'text': visual = this._createTextVisualObject(annotation, color); break;
    }
    if (visual) {
      this._scene.add(visual);
      this._visuals.set(annotation.id, visual);
    }
  }

  private _createTextVisual(annotation: Annotation): void {
    if (!this._scene) return;
    const visual = this._createTextVisualObject(annotation, new THREE.Color(annotation.color));
    if (visual) {
      this._scene.add(visual);
      this._visuals.set(annotation.id, visual);
    }
  }

  private _createArrowVisual(points: Array<{ x: number; y: number }>, color: THREE.Color): THREE.Group | null {
    if (points.length < 2) return null;
    const [start, end] = points;
    const group = new THREE.Group();
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      start.x, start.y, 0.2, end.x, end.y, 0.2,
    ]), 3));
    const lineMat = new THREE.LineBasicMaterial({ color, depthTest: false });
    const line = new THREE.Line(lineGeo, lineMat);
    line.renderOrder = 9990;
    group.add(line);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const headLen = Math.min(len * 0.15, (this._camera ? (this._camera.right - this._camera.left) / this._canvasWidth * 15 : 5));
      const angle = Math.atan2(dy, dx);
      const a1 = angle + Math.PI * 0.85;
      const a2 = angle - Math.PI * 0.85;
      const headGeo = new THREE.BufferGeometry();
      headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        end.x, end.y, 0.2, end.x + Math.cos(a1) * headLen, end.y + Math.sin(a1) * headLen, 0.2,
        end.x, end.y, 0.2, end.x + Math.cos(a2) * headLen, end.y + Math.sin(a2) * headLen, 0.2,
      ]), 3));
      const head = new THREE.LineSegments(headGeo, lineMat);
      head.renderOrder = 9990;
      group.add(head);
    }
    return group;
  }

  private _createRectVisual(points: Array<{ x: number; y: number }>, color: THREE.Color): THREE.LineSegments | null {
    if (points.length < 2) return null;
    const [p1, p2] = points;
    const positions = new Float32Array([
      p1.x, p1.y, 0.2, p2.x, p1.y, 0.2,
      p2.x, p1.y, 0.2, p2.x, p2.y, 0.2,
      p2.x, p2.y, 0.2, p1.x, p2.y, 0.2,
      p1.x, p2.y, 0.2, p1.x, p1.y, 0.2,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color, depthTest: false });
    const rect = new THREE.LineSegments(geo, mat);
    rect.renderOrder = 9990;
    return rect;
  }

  private _createCircleVisual(points: Array<{ x: number; y: number }>, color: THREE.Color): THREE.LineSegments | null {
    if (points.length < 2) return null;
    const [center, edge] = points;
    const radius = Math.sqrt((edge.x - center.x) ** 2 + (edge.y - center.y) ** 2);
    const segments = 64;
    const positions: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      positions.push(
        center.x + Math.cos(a1) * radius, center.y + Math.sin(a1) * radius, 0.2,
        center.x + Math.cos(a2) * radius, center.y + Math.sin(a2) * radius, 0.2,
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    const mat = new THREE.LineBasicMaterial({ color, depthTest: false });
    const circle = new THREE.LineSegments(geo, mat);
    circle.renderOrder = 9990;
    return circle;
  }

  private _createFreehandVisual(points: Array<{ x: number; y: number }>, color: THREE.Color): THREE.Line | null {
    if (points.length < 2) return null;
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = 0.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color, depthTest: false });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 9990;
    return line;
  }

  private _createTextVisualObject(annotation: Annotation, _color: THREE.Color): THREE.Mesh | null {
    if (annotation.points.length < 1) return null;
    const p = annotation.points[0];
    const text = annotation.text ?? '';
    if (!text) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const fontSize = 48;
    ctx.font = `${fontSize}px sans-serif`;
    const metrics = ctx.measureText(text);
    canvas.width = Math.ceil(metrics.width) + 20;
    canvas.height = fontSize + 20;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = annotation.color;
    ctx.textBaseline = 'top';
    ctx.fillText(text, 10, 10);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const aspect = canvas.width / canvas.height;
    const worldHeight = (this._camera ? (this._camera.top - this._camera.bottom) / this._canvasHeight * 20 : 20);
    const worldWidth = worldHeight * aspect;
    const geo = new THREE.PlaneGeometry(worldWidth, worldHeight);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, p.y, 0.3);
    mesh.renderOrder = 9991;
    return mesh;
  }

  private _updateTempVisual(): void {
    this._updateTempVisualWithPoints(this._currentPoints);
  }

  private _updateTempVisualWithPoints(points: Array<{ x: number; y: number }>): void {
    this._removeTempVisual();
    if (!this._scene || points.length === 0) return;
    const color = new THREE.Color(this._currentColor);
    let visual: THREE.Object3D | null = null;
    switch (this._currentType) {
      case 'arrow': if (points.length >= 2) visual = this._createArrowVisual(points, color); break;
      case 'rect': if (points.length >= 2) visual = this._createRectVisual(points, color); break;
      case 'circle': if (points.length >= 2) visual = this._createCircleVisual(points, color); break;
      case 'freehand': if (points.length >= 2) visual = this._createFreehandVisual(points, color); break;
      default: break;
    }
    if (visual) {
      visual.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments) {
          const mat = child.material as THREE.Material;
          if ('opacity' in mat) {
            (mat as any).opacity = 0.5;
            (mat as any).transparent = true;
          }
        }
      });
      this._scene.add(visual);
      this._tempVisual = visual;
    }
  }

  private _removeTempVisual(): void {
    if (this._tempVisual && this._scene) {
      this._scene.remove(this._tempVisual);
      this._disposeObject3D(this._tempVisual);
      this._tempVisual = null;
    }
  }

  private _disposeObject3D(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    });
  }
}
