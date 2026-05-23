import * as THREE from 'three';
import type { CameraInfo } from '../CadRenderer';
import { isValidNumber } from './geometry_factory';

export class CameraController {
  private _camera: THREE.OrthographicCamera;
  private _canvasWidth = 0;
  private _canvasHeight = 0;
  private _initialSpan: number = 0;
  private _fitMode: 'contain' | 'cover' | 'stretch' | 'custom' = 'contain';
  private readonly _MIN_SPAN_RATIO = 0.01;
  private readonly _MAX_SPAN_RATIO = 100;
  private _lastCameraEmit = 0;
  private _onCameraChanged?: (info: CameraInfo) => void;
  private _onCameraInteractionEnd?: (info: CameraInfo) => void;
  private _cameraInteractionEndTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(camera: THREE.OrthographicCamera, canvasWidth: number, canvasHeight: number) {
    this._camera = camera;
    this._canvasWidth = canvasWidth;
    this._canvasHeight = canvasHeight;
  }

  get camera(): THREE.OrthographicCamera { return this._camera; }
  get initialSpan(): number { return this._initialSpan; }
  get fitMode(): 'contain' | 'cover' | 'stretch' | 'custom' { return this._fitMode; }

  setCallbacks(onCameraChanged?: (info: CameraInfo) => void, onCameraInteractionEnd?: (info: CameraInfo) => void): void {
    this._onCameraChanged = onCameraChanged;
    this._onCameraInteractionEnd = onCameraInteractionEnd;
  }

  setCanvasSize(width: number, height: number): void {
    this._canvasWidth = width;
    this._canvasHeight = height;
  }

  setFitMode(mode: 'contain' | 'cover' | 'stretch' | 'custom'): void {
    this._fitMode = mode;
  }

  getCameraInfo(): CameraInfo {
    const worldWidth = this._camera.right - this._camera.left;
    const worldHeight = this._camera.top - this._camera.bottom;
    const baseSize = Math.max(this._canvasWidth, this._canvasHeight);
    const zoom = baseSize > 0 ? baseSize / Math.max(1e-6, Math.max(worldWidth, worldHeight)) : 1;
    return {
      centerX: this._camera.position.x,
      centerY: this._camera.position.y,
      worldWidth,
      worldHeight,
      zoom,
    };
  }

  getCameraState(): { centerX: number; centerY: number; halfW: number; halfH: number } {
    return {
      centerX: this._camera.position.x,
      centerY: this._camera.position.y,
      halfW: this._camera.right,
      halfH: this._camera.top,
    };
  }

  setCameraState(state: { centerX: number; centerY: number; halfW: number; halfH: number }): boolean {
    if (!isValidNumber(state.centerX) || !isValidNumber(state.centerY) ||
        !isValidNumber(state.halfW) || !isValidNumber(state.halfH) ||
        state.halfW <= 0 || state.halfH <= 0) return false;
    this._camera.position.set(state.centerX, state.centerY, this._camera.position.z);
    this._camera.left = -state.halfW;
    this._camera.right = state.halfW;
    this._camera.top = state.halfH;
    this._camera.bottom = -state.halfH;
    this._camera.updateProjectionMatrix();
    return true;
  }

  zoomIn(): void {
    const factor = 0.8;
    this._camera.left *= factor;
    this._camera.right *= factor;
    this._camera.top *= factor;
    this._camera.bottom *= factor;
    this._camera.updateProjectionMatrix();
  }

  zoomOut(): void {
    const factor = 1.25;
    this._camera.left *= factor;
    this._camera.right *= factor;
    this._camera.top *= factor;
    this._camera.bottom *= factor;
    this._camera.updateProjectionMatrix();
  }

  handleWheel(e: WheelEvent, rect: DOMRect): boolean {
    if (this._initialSpan <= 0) return false;
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const worldX = this._camera.position.x + ndcX * (this._camera.right - this._camera.left) / 2;
    const worldY = this._camera.position.y + ndcY * (this._camera.top - this._camera.bottom) / 2;
    const zoomFactor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    const newHalfW = (this._camera.right - this._camera.left) / 2 * zoomFactor;
    const newHalfH = (this._camera.top - this._camera.bottom) / 2 * zoomFactor;
    const newSpan = Math.max(newHalfW * 2, newHalfH * 2);
    if (newSpan < this._initialSpan * this._MIN_SPAN_RATIO || newSpan > this._initialSpan * this._MAX_SPAN_RATIO) return false;
    const centerX = worldX - (worldX - this._camera.position.x) * zoomFactor;
    const centerY = worldY - (worldY - this._camera.position.y) * zoomFactor;
    this._camera.position.set(centerX, centerY, this._camera.position.z);
    this._camera.left = -newHalfW;
    this._camera.right = newHalfW;
    this._camera.top = newHalfH;
    this._camera.bottom = -newHalfH;
    this._camera.updateProjectionMatrix();
    return true;
  }

  applyExtents(minX: number, minY: number, maxX: number, maxY: number, containerW: number, containerH: number): void {
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX;
    const height = maxY - minY;
    if (!isValidNumber(centerX) || !isValidNumber(centerY) || !isValidNumber(width) || !isValidNumber(height) || width <= 0 || height <= 0) {
      this.resetToDefaultView();
      return;
    }
    const cw = containerW || 1;
    const ch = containerH || 1;
    const aspect = cw / ch;
    let halfW: number, halfH: number;
    switch (this._fitMode) {
      case 'contain': {
        const padding = 1.05;
        halfH = Math.max(width / aspect, height) * padding / 2;
        halfW = halfH * aspect;
        break;
      }
      case 'cover': {
        const padding = 1.0;
        halfH = Math.min(width / aspect, height) * padding / 2;
        halfW = halfH * aspect;
        break;
      }
      case 'stretch': {
        const padding = 1.0;
        halfW = (width * padding) / 2;
        halfH = (height * padding) / 2;
        break;
      }
      case 'custom':
      default: {
        const padding = 1.05;
        halfH = Math.max(width / aspect, height) * padding / 2;
        halfW = halfH * aspect;
        break;
      }
    }
    if (!isValidNumber(halfH) || !isValidNumber(halfW) || halfH <= 0 || halfW <= 0) {
      this.resetToDefaultView();
      return;
    }
    let cameraZ = halfH * 4;
    cameraZ = Math.max(0.1, Math.min(1000000, cameraZ));
    this._camera.position.set(centerX, centerY, cameraZ);
    this._camera.lookAt(centerX, centerY, 0);
    this._camera.near = 0.1;
    this._camera.far = Math.max(cameraZ * 3, 1000);
    this._camera.left = -halfW;
    this._camera.right = halfW;
    this._camera.top = halfH;
    this._camera.bottom = -halfH;
    this._initialSpan = Math.max(halfW * 2, halfH * 2);
    if (!isValidNumber(this._initialSpan) || this._initialSpan <= 0) this._initialSpan = 1.0;
    this._camera.updateProjectionMatrix();
  }

  resetToDefaultView(): void {
    const defaultSpan = 100;
    this._initialSpan = defaultSpan * 2;
    this.applyExtents(-defaultSpan, -defaultSpan, defaultSpan, defaultSpan, this._canvasWidth, this._canvasHeight);
  }

  handleResize(cw: number, ch: number): void {
    this._canvasWidth = cw;
    this._canvasHeight = ch;
    if (this._fitMode === 'custom') {
      const oldAspect = this._canvasWidth > 0 && this._canvasHeight > 0
        ? (this._camera.right - this._camera.left) / (this._camera.top - this._camera.bottom) : 1;
      const newAspect = cw / ch;
      if (Math.abs(oldAspect - newAspect) > 0.001) {
        const halfH = (this._camera.top - this._camera.bottom) / 2;
        const centerX = (this._camera.left + this._camera.right) / 2;
        const centerY = (this._camera.top + this._camera.bottom) / 2;
        this._camera.left = centerX - halfH * newAspect;
        this._camera.right = centerX + halfH * newAspect;
        this._camera.top = centerY + halfH;
        this._camera.bottom = centerY - halfH;
        this._camera.updateProjectionMatrix();
      }
    }
  }

  emitCameraChanged(): void {
    if (!this._onCameraChanged) return;
    const now = performance.now();
    if (now - this._lastCameraEmit < 50) return;
    this._lastCameraEmit = now;
    this._onCameraChanged(this.getCameraInfo());
  }

  emitCameraInteractionEnd(): void {
    this._onCameraInteractionEnd?.(this.getCameraInfo());
  }

  scheduleCameraInteractionEnd(): void {
    if (this._cameraInteractionEndTimer !== null) clearTimeout(this._cameraInteractionEndTimer);
    this._cameraInteractionEndTimer = setTimeout(() => {
      this._cameraInteractionEndTimer = null;
      this.emitCameraInteractionEnd();
    }, 350);
  }

  cancelPendingTimers(): void {
    if (this._cameraInteractionEndTimer !== null) {
      clearTimeout(this._cameraInteractionEndTimer);
      this._cameraInteractionEndTimer = null;
    }
  }
}
