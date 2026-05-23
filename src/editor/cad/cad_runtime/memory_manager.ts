import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export class MemoryManager {
  private _disposables: Set<{ dispose: () => void }> = new Set();
  private _trackedMeshes: Map<string, THREE.Object3D> = new Map();
  private _materialCache: Map<string, THREE.Material> = new Map();
  private _geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  private _textureCache: Map<string, THREE.Texture> = new Map();
  private _maxCacheSize = 500;
  private _stats = { meshes: 0, materials: 0, geometries: 0, textures: 0 };

  track(id: string, obj: THREE.Object3D): void {
    const existing = this._trackedMeshes.get(id);
    if (existing) {
      this.disposeObject3D(existing);
    }
    this._trackedMeshes.set(id, obj);
    this._stats.meshes = this._trackedMeshes.size;
  }

  untrack(id: string): void {
    const obj = this._trackedMeshes.get(id);
    if (obj) {
      this.disposeObject3D(obj);
      this._trackedMeshes.delete(id);
      this._stats.meshes = this._trackedMeshes.size;
    }
  }

  getTracked(id: string): THREE.Object3D | undefined {
    return this._trackedMeshes.get(id);
  }

  getAllTrackedIds(): string[] {
    return Array.from(this._trackedMeshes.keys());
  }

  cacheMaterial(key: string, material: THREE.Material): void {
    const existing = this._materialCache.get(key);
    if (existing) existing.dispose();
    if (this._materialCache.size >= this._maxCacheSize) {
      const oldest = this._materialCache.keys().next();
      if (!oldest.done) {
        const oldMat = this._materialCache.get(oldest.value);
        oldMat?.dispose();
        this._materialCache.delete(oldest.value);
      }
    }
    this._materialCache.set(key, material);
    this._stats.materials = this._materialCache.size;
  }

  getCachedMaterial(key: string): THREE.Material | undefined {
    return this._materialCache.get(key);
  }

  cacheGeometry(key: string, geometry: THREE.BufferGeometry): void {
    const existing = this._geometryCache.get(key);
    if (existing) existing.dispose();
    this._geometryCache.set(key, geometry);
    this._stats.geometries = this._geometryCache.size;
  }

  getCachedGeometry(key: string): THREE.BufferGeometry | undefined {
    return this._geometryCache.get(key);
  }

  cacheTexture(key: string, texture: THREE.Texture): void {
    const existing = this._textureCache.get(key);
    if (existing) existing.dispose();
    this._textureCache.set(key, texture);
    this._stats.textures = this._textureCache.size;
  }

  getCachedTexture(key: string): THREE.Texture | undefined {
    return this._textureCache.get(key);
  }

  registerDisposable(disposable: { dispose: () => void }): void {
    this._disposables.add(disposable);
  }

  unregisterDisposable(disposable: { dispose: () => void }): void {
    this._disposables.delete(disposable);
  }

  disposeObject3D(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments || child instanceof Line2) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  disposeAllMeshes(): void {
    for (const [_id, obj] of this._trackedMeshes) {
      this.disposeObject3D(obj);
    }
    this._trackedMeshes.clear();
    this._stats.meshes = 0;
  }

  disposeAllMaterials(): void {
    for (const mat of this._materialCache.values()) {
      mat.dispose();
    }
    this._materialCache.clear();
    this._stats.materials = 0;
  }

  disposeAllGeometries(): void {
    for (const geo of this._geometryCache.values()) {
      geo.dispose();
    }
    this._geometryCache.clear();
    this._stats.geometries = 0;
  }

  disposeAllTextures(): void {
    for (const tex of this._textureCache.values()) {
      tex.dispose();
    }
    this._textureCache.clear();
    this._stats.textures = 0;
  }

  disposeAll(): void {
    this.disposeAllMeshes();
    this.disposeAllMaterials();
    this.disposeAllGeometries();
    this.disposeAllTextures();
    for (const disposable of this._disposables) {
      try {
        disposable.dispose();
      } catch (_e) {
      }
    }
    this._disposables.clear();
  }

  getStats(): { meshes: number; materials: number; geometries: number; textures: number; disposables: number } {
    return {
      ...this._stats,
      disposables: this._disposables.size,
    };
  }

  estimateMemoryUsage(): { estimatedMB: number; breakdown: Record<string, number> } {
    let totalBytes = 0;
    const breakdown: Record<string, number> = {};
    let meshBytes = 0;
    for (const obj of this._trackedMeshes.values()) {
      obj.traverse((child) => {
        if ((child as any).geometry) {
          const geo = (child as any).geometry as THREE.BufferGeometry;
          for (const attr of Object.values(geo.attributes)) {
            meshBytes += (attr as THREE.BufferAttribute).array.byteLength;
          }
        }
      });
    }
    breakdown.meshes = meshBytes;
    totalBytes += meshBytes;
    let matBytes = 0;
    for (const mat of this._materialCache.values()) {
      matBytes += estimateMaterialSize(mat);
    }
    breakdown.materials = matBytes;
    totalBytes += matBytes;
    let geoBytes = 0;
    for (const geo of this._geometryCache.values()) {
      for (const attr of Object.values(geo.attributes)) {
        geoBytes += (attr as THREE.BufferAttribute).array.byteLength;
      }
    }
    breakdown.geometries = geoBytes;
    totalBytes += geoBytes;
    let texBytes = 0;
    for (const tex of this._textureCache.values()) {
      texBytes += estimateTextureSize(tex);
    }
    breakdown.textures = texBytes;
    totalBytes += texBytes;
    return { estimatedMB: totalBytes / (1024 * 1024), breakdown };
  }
}

function estimateMaterialSize(mat: THREE.Material): number {
  let size = 1024;
  if (mat instanceof LineMaterial) size += 512;
  return size;
}

function estimateTextureSize(tex: THREE.Texture): number {
  const img = tex.image as any;
  if (!img) return 0;
  if (img.width && img.height) {
    return img.width * img.height * 4;
  }
  return 256 * 256 * 4;
}
