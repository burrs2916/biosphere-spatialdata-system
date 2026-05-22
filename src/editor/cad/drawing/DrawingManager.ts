import * as THREE from 'three';

export type DrawMode = 'draw_line' | 'draw_circle' | 'draw_text';

export interface DrawState {
  isDrawing: boolean;
  mode: DrawMode;
  startPoint: THREE.Vector2 | null;
  previewMesh: THREE.Object3D | null;
}

export interface DrawPreviewUpdate {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  mode: DrawMode;
}

export interface TextDrawParams {
  content: string;
  height: number;
  layer: string;
  color: number;
}

export class DrawingManager {
  private _drawState: DrawState;
  private _scene: THREE.Scene | null = null;
  private _onDrawComplete?: (entityJson: string) => void;
  private _onDrawPreview?: (preview: DrawPreviewUpdate) => void;
  private _textParams: TextDrawParams | null = null;
  private _textPreviewMesh: THREE.Mesh | null = null;

  constructor() {
    this._drawState = {
      isDrawing: false,
      mode: 'draw_line',
      startPoint: null,
      previewMesh: null,
    };
  }

  setScene(scene: THREE.Scene): void {
    this._scene = scene;
  }

  setOnDrawComplete(callback: (entityJson: string) => void): void {
    this._onDrawComplete = callback;
  }

  setOnDrawPreview(callback: (preview: DrawPreviewUpdate) => void): void {
    this._onDrawPreview = callback;
  }

  setTextParams(params: TextDrawParams): void {
    this._textParams = params;
  }

  getDrawState(): DrawState {
    return { ...this._drawState };
  }

  isDrawing(): boolean {
    return this._drawState.isDrawing;
  }

  isTextPlacing(): boolean {
    return this._drawState.mode === 'draw_text' && this._textParams !== null;
  }

  startDrawing(mode: DrawMode): void {
    this._drawState.isDrawing = false;
    this._drawState.mode = mode;
    this._drawState.startPoint = null;
    this._clearPreview();
  }

  handleMouseDown(worldX: number, worldY: number): void {
    if (this._drawState.mode === 'draw_text') {
      this._completeTextDraw(worldX, worldY);
      return;
    }

    if (!this._drawState.isDrawing) {
      this._drawState.isDrawing = true;
      this._drawState.startPoint = new THREE.Vector2(worldX, worldY);
      this._showStartPointMarker(worldX, worldY);
    } else {
      if (this._drawState.startPoint) {
        this._completeDraw(worldX, worldY);
      }
    }
  }

  handleMouseMove(worldX: number, worldY: number): void {
    if (this._drawState.mode === 'draw_text') {
      return;
    }

    if (!this._drawState.isDrawing || !this._drawState.startPoint) return;

    if (this._onDrawPreview) {
      this._onDrawPreview({
        startX: this._drawState.startPoint.x,
        startY: this._drawState.startPoint.y,
        currentX: worldX,
        currentY: worldY,
        mode: this._drawState.mode,
      });
    }

    this._updatePreview(worldX, worldY);
  }

  cancelDrawing(): void {
    this._drawState.isDrawing = false;
    this._drawState.startPoint = null;
    this._textParams = null;
    this._clearPreview();
    this._clearTextPreview();
  }

  private _showStartPointMarker(x: number, y: number): void {
    if (!this._scene) return;

    const geometry = new THREE.BoxGeometry(1, 1, 0.1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0.01);
    mesh.scale.set(2, 2, 1);
    this._scene.add(mesh);
    this._drawState.previewMesh = mesh;
  }

  private _updatePreview(currentX: number, currentY: number): void {
    this._clearPreview();

    if (!this._scene || !this._drawState.startPoint) return;

    const startX = this._drawState.startPoint.x;
    const startY = this._drawState.startPoint.y;

    switch (this._drawState.mode) {
      case 'draw_line':
        this._showLinePreview(startX, startY, currentX, currentY);
        break;
      case 'draw_circle':
        this._showCirclePreview(startX, startY, currentX, currentY);
        break;
      case 'draw_text':
        break;
    }
  }

  private _showLinePreview(x1: number, y1: number, x2: number, y2: number): void {
    if (!this._scene) return;

    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([x1, y1, 0, x2, y2, 0]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    this._scene.add(line);
    this._drawState.previewMesh = line;
  }

  private _showCirclePreview(centerX: number, centerY: number, x2: number, y2: number): void {
    if (!this._scene) return;

    const radius = Math.hypot(x2 - centerX, y2 - centerY);
    const geometry = new THREE.CircleGeometry(radius, 32);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const line = new THREE.LineSegments(geometry, material);
    line.position.set(centerX, centerY, 0);
    this._scene.add(line);
    this._drawState.previewMesh = line;
  }

  private _clearPreview(): void {
    if (this._drawState.previewMesh && this._scene) {
      this._scene.remove(this._drawState.previewMesh);
      this._disposeObject3D(this._drawState.previewMesh);
      this._drawState.previewMesh = null;
    }
  }

  private _clearTextPreview(): void {
    if (this._textPreviewMesh && this._scene) {
      this._scene.remove(this._textPreviewMesh);
      this._disposeObject3D(this._textPreviewMesh);
      this._textPreviewMesh = null;
    }
  }

  private _completeTextDraw(x: number, y: number): void {
    if (!this._textParams) return;

    const entityJson = JSON.stringify({
      type: 'Text',
      id: '__new__',
      layer: this._textParams.layer,
      color: this._textParams.color,
      position: { x, y, z: 0 },
      height: this._textParams.height,
      content: this._textParams.content,
      rotation: 0,
      horizontal_alignment: 0,
      vertical_alignment: 0,
    });

    this._clearTextPreview();

    if (this._onDrawComplete) {
      this._onDrawComplete(entityJson);
    }
  }

  private _completeDraw(endX: number, endY: number): void {
    if (!this._drawState.startPoint) return;

    const startX = this._drawState.startPoint.x;
    const startY = this._drawState.startPoint.y;

    let entityJson: string;

    switch (this._drawState.mode) {
      case 'draw_line':
        entityJson = JSON.stringify({
          type: 'Line',
          id: '__new__',
          layer: '0',
          color: 7,
          start: { x: startX, y: startY, z: 0 },
          end: { x: endX, y: endY, z: 0 },
          line_weight: 0.25,
        });
        break;

      case 'draw_circle': {
        const radius = Math.hypot(endX - startX, endY - startY);
        entityJson = JSON.stringify({
          type: 'Circle',
          id: '__new__',
          layer: '0',
          color: 7,
          center: { x: startX, y: startY, z: 0 },
          radius: radius,
          line_weight: 0.25,
        });
        break;
      }

      case 'draw_text':
        entityJson = JSON.stringify({
          type: 'Text',
          id: '__new__',
          layer: '0',
          color: 7,
          position: { x: startX, y: startY, z: 0 },
          height: 10,
          content: '文字',
          rotation: 0,
          horizontal_alignment: 0,
          vertical_alignment: 0,
        });
        break;
    }

    this._clearPreview();
    this._drawState.isDrawing = false;
    this._drawState.startPoint = null;

    if (this._onDrawComplete) {
      this._onDrawComplete(entityJson);
    }
  }

  private _disposeObject3D(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      }
    });
  }
}
