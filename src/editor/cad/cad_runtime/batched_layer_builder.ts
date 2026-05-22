import * as THREE from 'three';

interface BatchKey {
  layerName: string;
  colorHex: number;
  lineWidth: number;
}

interface EntityBatchEntry {
  entityId: string;
  startVertex: number;
  vertexCount: number;
  deleted: boolean;
  culled: boolean;
}

interface BatchGroup {
  key: BatchKey;
  positions: Float32Array;
  positionsLength: number;
  entries: EntityBatchEntry[];
  lineSegments: THREE.LineSegments | null;
  needsRebuild: boolean;
  hasDeletedEntries: boolean;
}

export class BatchedLayerBuilder {
  private _batches: Map<string, BatchGroup> = new Map();
  private _entityBatchKey: Map<string, string> = new Map();
  private _entityEntryIndex: Map<string, EntityBatchEntry> = new Map();
  private _layerEntityIndex: Map<string, Set<string>> = new Map();
  private _needsCullingRebuild: boolean = false;
  private static readonly COMPACT_THRESHOLD = 0.15;
  private static readonly INITIAL_POSITION_CAPACITY = 65536;

  constructor(_resolution: THREE.Vector2) {
  }

  setResolution(_resolution: THREE.Vector2): void {
    for (const batch of this._batches.values()) {
      if (batch.lineSegments) {
        const mat = batch.lineSegments.material as THREE.LineBasicMaterial;
        mat.needsUpdate = true;
      }
    }
  }

  private _batchKeyStr(key: BatchKey): string {
    return `${key.layerName}__${key.colorHex}__${key.lineWidth}`;
  }

  private _ensureCapacity(batch: BatchGroup, additionalFloats: number): void {
    const required = batch.positionsLength + additionalFloats;
    if (batch.positions.length >= required) return;
    let newCapacity = batch.positions.length;
    while (newCapacity < required) {
      newCapacity = newCapacity === 0 ? BatchedLayerBuilder.INITIAL_POSITION_CAPACITY : newCapacity * 2;
    }
    const newArr = new Float32Array(newCapacity);
    newArr.set(batch.positions.subarray(0, batch.positionsLength));
    batch.positions = newArr;
  }

  addLineSegments(
    entityId: string,
    layerName: string,
    color: THREE.Color,
    lineWidth: number,
    positions: number[],
    scene?: THREE.Scene,
  ): void {
    if (this._entityBatchKey.has(entityId)) {
      this.removeEntity(entityId, scene);
    }

    const key: BatchKey = { layerName, colorHex: color.getHex(), lineWidth };
    const keyStr = this._batchKeyStr(key);

    let batch = this._batches.get(keyStr);
    if (!batch) {
      batch = {
        key,
        positions: new Float32Array(BatchedLayerBuilder.INITIAL_POSITION_CAPACITY),
        positionsLength: 0,
        entries: [],
        lineSegments: null,
        needsRebuild: true,
        hasDeletedEntries: false,
      };
      this._batches.set(keyStr, batch);
    }

    if (batch.hasDeletedEntries) {
      this._compactBatch(batch);
    }

    const floatCount = positions.length;
    this._ensureCapacity(batch, floatCount);

    const startVertex = batch.positionsLength / 3;
    const vertexCount = floatCount / 3;

    for (let i = 0; i < floatCount; i++) {
      batch.positions[batch.positionsLength + i] = positions[i];
    }
    batch.positionsLength += floatCount;

    const entry: EntityBatchEntry = { entityId, startVertex, vertexCount, deleted: false, culled: false };
    batch.entries.push(entry);
    batch.needsRebuild = true;

    this._entityBatchKey.set(entityId, keyStr);
    this._entityEntryIndex.set(entityId, entry);

    let layerSet = this._layerEntityIndex.get(layerName);
    if (!layerSet) {
      layerSet = new Set();
      this._layerEntityIndex.set(layerName, layerSet);
    }
    layerSet.add(entityId);
  }

  private _disposeBatchLineSegments(batch: BatchGroup, scene?: THREE.Scene): void {
    if (!batch.lineSegments) return;
    if (scene) {
      scene.remove(batch.lineSegments);
    }
    batch.lineSegments.geometry.dispose();
    (batch.lineSegments.material as THREE.LineBasicMaterial).dispose();
    batch.lineSegments = null;
  }

  removeEntity(entityId: string, scene?: THREE.Scene): boolean {
    const keyStr = this._entityBatchKey.get(entityId);
    if (!keyStr) return false;

    const batch = this._batches.get(keyStr);
    if (!batch) return false;

    const entry = this._entityEntryIndex.get(entityId);
    if (!entry || entry.deleted) return false;

    entry.deleted = true;
    batch.hasDeletedEntries = true;
    batch.needsRebuild = true;
    this._entityBatchKey.delete(entityId);
    this._entityEntryIndex.delete(entityId);

    const layerName = batch.key.layerName;
    const layerSet = this._layerEntityIndex.get(layerName);
    if (layerSet) {
      layerSet.delete(entityId);
      if (layerSet.size === 0) {
        this._layerEntityIndex.delete(layerName);
      }
    }

    if (batch.hasDeletedEntries) {
      this._compactBatch(batch);
    }

    const batchEmpty = batch.entries.length === 0;
    if (batchEmpty) {
      this._disposeBatchLineSegments(batch, scene);
      this._batches.delete(keyStr);
    } else if (scene) {
      batch.needsRebuild = true;
      this.rebuildDirty(scene);
      this.pruneOrphanedLineSegments(scene);
    }

    return true;
  }

  removeLayer(layerName: string, scene?: THREE.Scene): void {
    const entityIds = this._layerEntityIndex.get(layerName);
    if (entityIds) {
      for (const id of Array.from(entityIds)) {
        this.removeEntity(id, scene);
      }
    }
  }

  renameLayer(oldName: string, newName: string): void {
    if (oldName === newName) return;
    const entitySet = this._layerEntityIndex.get(oldName);
    if (entitySet) {
      this._layerEntityIndex.delete(oldName);
      this._layerEntityIndex.set(newName, entitySet);
    }
    for (const [key, batch] of this._batches) {
      if (key.startsWith(oldName + '__')) {
        const rest = key.slice(oldName.length);
        const newKey = newName + rest;
        this._batches.delete(key);
        batch.key.layerName = newName;
        if (batch.lineSegments) {
          batch.lineSegments.name = `__batch_${newName}_${batch.key.colorHex}`;
        }
        this._batches.set(newKey, batch);
      }
    }
  }

  hasEntity(entityId: string): boolean {
    return this._entityBatchKey.has(entityId);
  }

  private _compactBatch(batch: BatchGroup): void {
    if (!batch.hasDeletedEntries) return;

    const newPositions = new Float32Array(batch.positions.length);
    let offset = 0;
    const newEntries: EntityBatchEntry[] = [];

    for (const entry of batch.entries) {
      if (entry.deleted) continue;
      const startPos = entry.startVertex * 3;
      const count = entry.vertexCount * 3;
      newPositions.set(batch.positions.subarray(startPos, startPos + count), offset);
      const newEntry: EntityBatchEntry = {
        entityId: entry.entityId,
        startVertex: offset / 3,
        vertexCount: entry.vertexCount,
        deleted: false,
        culled: entry.culled,
      };
      newEntries.push(newEntry);
      this._entityEntryIndex.set(entry.entityId, newEntry);
      offset += count;
    }

    batch.positions = newPositions;
    batch.positionsLength = offset;
    batch.entries = newEntries;
    batch.hasDeletedEntries = false;
  }

  private _collectActivePositions(batch: BatchGroup, skipCulled: boolean = false): Float32Array {
    let totalFloats = 0;
    for (const entry of batch.entries) {
      if (entry.deleted) continue;
      if (skipCulled && entry.culled) continue;
      totalFloats += entry.vertexCount * 3;
    }

    const result = new Float32Array(totalFloats);
    let offset = 0;
    for (const entry of batch.entries) {
      if (entry.deleted) continue;
      if (skipCulled && entry.culled) continue;
      const startPos = entry.startVertex * 3;
      const count = entry.vertexCount * 3;
      result.set(batch.positions.subarray(startPos, startPos + count), offset);
      offset += count;
    }
    return result;
  }

  rebuildDirty(scene: THREE.Scene): void {
    for (const batch of this._batches.values()) {
      if (!batch.needsRebuild) continue;
      batch.needsRebuild = false;

      if (batch.hasDeletedEntries) {
        const totalVerts = batch.entries.reduce((s, e) => s + (e.deleted ? 0 : e.vertexCount), 0);
        const deletedVerts = batch.entries.reduce((s, e) => s + (e.deleted ? e.vertexCount : 0), 0);
        if (totalVerts > 0 && deletedVerts / (totalVerts + deletedVerts) > BatchedLayerBuilder.COMPACT_THRESHOLD) {
          this._compactBatch(batch);
        }
      }

      const positionArray = this._collectActivePositions(batch);

      if (positionArray.length < 6) {
        this._disposeBatchLineSegments(batch, scene);
        continue;
      }

      if (batch.lineSegments) {
        const attr = batch.lineSegments.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (attr.array.length === positionArray.length) {
          attr.array.set(positionArray);
          attr.needsUpdate = true;
          batch.lineSegments.geometry.setDrawRange(0, positionArray.length / 3);
          batch.lineSegments.geometry.computeBoundingSphere();
        } else {
          scene.remove(batch.lineSegments);
          batch.lineSegments.geometry.dispose();
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
          batch.lineSegments.geometry = geometry;
          scene.add(batch.lineSegments);
        }
      } else {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));

        const material = new THREE.LineBasicMaterial({
          color: batch.key.colorHex,
          linewidth: batch.key.lineWidth,
        });

        const lineSegments = new THREE.LineSegments(geometry, material);
        lineSegments.name = `__batch_${batch.key.layerName}_${batch.key.colorHex}`;
        lineSegments.frustumCulled = false;
        scene.add(lineSegments);
        batch.lineSegments = lineSegments;
      }
    }
  }

  rebuildAll(scene: THREE.Scene): void {
    for (const batch of this._batches.values()) {
      if (batch.hasDeletedEntries) {
        this._compactBatch(batch);
      }
      batch.needsRebuild = true;
    }
    this.rebuildDirty(scene);
    this.pruneOrphanedLineSegments(scene);
  }

  /**
   * Remove batch LineSegments still attached to the scene but no longer tracked in _batches
   * (can happen when the last entity is extracted and the batch map entry is deleted).
   */
  pruneOrphanedLineSegments(scene: THREE.Scene): void {
    const active = new Set<THREE.LineSegments>();
    for (const batch of this._batches.values()) {
      if (batch.lineSegments) {
        active.add(batch.lineSegments);
      }
    }

    const orphans: THREE.LineSegments[] = [];
    for (const child of scene.children) {
      if (!(child instanceof THREE.LineSegments)) continue;
      if (!child.name.startsWith('__batch_')) continue;
      if (!active.has(child)) {
        orphans.push(child);
      }
    }

    for (const orphan of orphans) {
      scene.remove(orphan);
      orphan.geometry.dispose();
      const mat = orphan.material;
      if (Array.isArray(mat)) {
        for (const m of mat) m.dispose();
      } else {
        (mat as THREE.LineBasicMaterial).dispose();
      }
    }
  }

  clear(scene: THREE.Scene): void {
    for (const batch of this._batches.values()) {
      this._disposeBatchLineSegments(batch, scene);
    }
    this._batches.clear();
    this._entityBatchKey.clear();
    this._entityEntryIndex.clear();
    this._layerEntityIndex.clear();
  }

  getEntityCount(): number {
    return this._entityBatchKey.size;
  }

  getBatchCount(): number {
    return this._batches.size;
  }

  getEntityIdsInLayer(layerName: string): string[] {
    const layerSet = this._layerEntityIndex.get(layerName);
    return layerSet ? Array.from(layerSet) : [];
  }

  getEntityBatchKeyMap(): Map<string, string> {
    return this._entityBatchKey;
  }

  setLayerVisible(layerName: string, visible: boolean): void {
    for (const batch of this._batches.values()) {
      if (batch.key.layerName === layerName && batch.lineSegments) {
        batch.lineSegments.visible = visible;
      }
    }
  }

  applyCulling(visibleEntityIds: Set<string>): boolean {
    let changed = false;
    for (const batch of this._batches.values()) {
      for (const entry of batch.entries) {
        if (entry.deleted) continue;
        const shouldCull = !visibleEntityIds.has(entry.entityId);
        if (entry.culled !== shouldCull) {
          entry.culled = shouldCull;
          changed = true;
        }
      }
    }
    if (changed) {
      this._needsCullingRebuild = true;
    }
    return changed;
  }

  rebuildCulled(): void {
    if (!this._needsCullingRebuild) return;
    this._needsCullingRebuild = false;

    for (const batch of this._batches.values()) {
      if (!batch.lineSegments) continue;

      const positionArray = this._collectActivePositions(batch, true);

      if (positionArray.length < 6) {
        batch.lineSegments.geometry.setDrawRange(0, 0);
        continue;
      }

      const attr = batch.lineSegments.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (attr.array.length >= positionArray.length) {
        attr.array.set(positionArray);
        attr.needsUpdate = true;
        batch.lineSegments.geometry.setDrawRange(0, positionArray.length / 3);
        batch.lineSegments.geometry.computeBoundingSphere();
      } else {
        batch.lineSegments.geometry.dispose();
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
        batch.lineSegments.geometry = geometry;
      }
    }
  }

  rebuildLayer(layerName: string, scene: THREE.Scene): void {
    for (const batch of this._batches.values()) {
      if (batch.key.layerName === layerName) {
        batch.needsRebuild = true;
      }
    }
    this.rebuildDirty(scene);
  }
}
