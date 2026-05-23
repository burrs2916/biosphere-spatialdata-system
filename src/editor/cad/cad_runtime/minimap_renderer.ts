import * as THREE from 'three';
import type { BoundingBox } from './scene_node';

export class MinimapRenderer {
  private _minimapRenderer: THREE.WebGLRenderer | null = null;
  private _minimapScene: THREE.Scene = new THREE.Scene();
  private _minimapCamera: THREE.OrthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100000);
  private _viewportRect: THREE.LineSegments | null = null;
  private _mainScene: THREE.Scene | null = null;
  private _mainCamera: THREE.OrthographicCamera | null = null;
  private _width = 200;
  private _height = 150;
  private _container: HTMLElement | null = null;

  constructor(container?: HTMLElement, width = 200, height = 150) {
    this._width = width;
    this._height = height;
    if (container) {
      this._container = container;
      this._initRenderer();
    }
  }

  private _initRenderer(): void {
    if (!this._container) return;
    this._minimapRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this._minimapRenderer.setSize(this._width, this._height);
    this._minimapRenderer.setPixelRatio(1);
    this._minimapRenderer.setClearColor(0x1a1a2e, 0.8);
    this._container.appendChild(this._minimapRenderer.domElement);
    this._minimapRenderer.domElement.style.position = 'absolute';
    this._minimapRenderer.domElement.style.bottom = '10px';
    this._minimapRenderer.domElement.style.right = '10px';
    this._minimapRenderer.domElement.style.border = '1px solid rgba(255,255,255,0.3)';
    this._minimapRenderer.domElement.style.borderRadius = '4px';
    this._minimapRenderer.domElement.style.pointerEvents = 'none';
    this._minimapRenderer.domElement.style.zIndex = '100';
  }

  setMainScene(scene: THREE.Scene): void {
    this._mainScene = scene;
  }

  setMainCamera(camera: THREE.OrthographicCamera): void {
    this._mainCamera = camera;
  }

  setBounds(bounds: BoundingBox): void {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const aspect = this._width / this._height;
    const boundsAspect = width / height;
    let halfW: number, halfH: number;
    if (boundsAspect > aspect) {
      halfW = width / 2 * 1.1;
      halfH = halfW / aspect;
    } else {
      halfH = height / 2 * 1.1;
      halfW = halfH * aspect;
    }
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    this._minimapCamera.position.set(cx, cy, 1000);
    this._minimapCamera.lookAt(cx, cy, 0);
    this._minimapCamera.left = -halfW;
    this._minimapCamera.right = halfW;
    this._minimapCamera.top = halfH;
    this._minimapCamera.bottom = -halfH;
    this._minimapCamera.near = 0.1;
    this._minimapCamera.far = 100000;
    this._minimapCamera.updateProjectionMatrix();
  }

  update(): void {
    if (!this._minimapRenderer || !this._mainScene || !this._mainCamera) return;
    this._updateViewportRect();
    this._minimapRenderer.render(this._mainScene, this._minimapCamera);
  }

  private _updateViewportRect(): void {
    if (!this._mainCamera || !this._minimapScene) return;
    if (this._viewportRect) {
      this._minimapScene.remove(this._viewportRect);
      this._viewportRect.geometry.dispose();
      (this._viewportRect.material as THREE.Material).dispose();
    }
    const cam = this._mainCamera;
    const left = cam.position.x + cam.left;
    const right = cam.position.x + cam.right;
    const top = cam.position.y + cam.top;
    const bottom = cam.position.y + cam.bottom;
    const positions = new Float32Array([
      left, top, 0.5, right, top, 0.5,
      right, top, 0.5, right, bottom, 0.5,
      right, bottom, 0.5, left, bottom, 0.5,
      left, bottom, 0.5, left, top, 0.5,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x4fc3f7, depthTest: false, linewidth: 2 });
    this._viewportRect = new THREE.LineSegments(geometry, material);
    this._viewportRect.renderOrder = 9999;
    this._minimapScene.add(this._viewportRect);
  }

  dispose(): void {
    if (this._viewportRect) {
      this._minimapScene.remove(this._viewportRect);
      this._viewportRect.geometry.dispose();
      (this._viewportRect.material as THREE.Material).dispose();
    }
    this._minimapRenderer?.dispose();
    if (this._container && this._minimapRenderer) {
      this._container.removeChild(this._minimapRenderer.domElement);
    }
  }
}
