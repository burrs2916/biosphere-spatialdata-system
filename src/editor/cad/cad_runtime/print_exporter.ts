import * as THREE from 'three';
import type { BoundingBox } from './scene_node';

export class PrintExporter {
  private _scene: THREE.Scene | null = null;
  private _camera: THREE.OrthographicCamera | null = null;

  setScene(scene: THREE.Scene): void {
    this._scene = scene;
  }

  setCamera(camera: THREE.OrthographicCamera): void {
    this._camera = camera;
  }

  exportToPNG(width: number = 1920, height: number = 1080, bounds?: BoundingBox): string | null {
    if (!this._scene || !this._camera) return null;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x1a1a2e, 1);

    const exportCamera = this._camera.clone() as THREE.OrthographicCamera;
    if (bounds) {
      const bw = bounds.maxX - bounds.minX;
      const bh = bounds.maxY - bounds.minY;
      const aspect = width / height;
      let halfW: number, halfH: number;
      if (bw / bh > aspect) {
        halfW = bw / 2 * 1.05;
        halfH = halfW / aspect;
      } else {
        halfH = bh / 2 * 1.05;
        halfW = halfH * aspect;
      }
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      exportCamera.position.set(cx, cy, exportCamera.position.z);
      exportCamera.left = -halfW;
      exportCamera.right = halfW;
      exportCamera.top = halfH;
      exportCamera.bottom = -halfH;
      exportCamera.updateProjectionMatrix();
    }

    renderer.render(this._scene, exportCamera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    renderer.dispose();
    return dataUrl;
  }

  downloadPNG(filename: string = 'cad_export.png', width: number = 1920, height: number = 1080, bounds?: BoundingBox): boolean {
    const dataUrl = this.exportToPNG(width, height, bounds);
    if (!dataUrl) return false;
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    return true;
  }

  exportToSVG(): string | null {
    return null;
  }

  exportToPDF(): Blob | null {
    return null;
  }
}
