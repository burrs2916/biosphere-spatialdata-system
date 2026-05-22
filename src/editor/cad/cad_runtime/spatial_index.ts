import type { SpatialEntry } from './cadbin_reader';

export class SpatialIndex {
  private entries: SpatialEntry[] = [];

  load(entries: SpatialEntry[]): void {
    this.entries = entries;
  }

  query(minX: number, minY: number, maxX: number, maxY: number): number[] {
    const result: number[] = [];
    for (const entry of this.entries) {
      if (entry.minX <= maxX && entry.maxX >= minX && entry.minY <= maxY && entry.maxY >= minY) {
        result.push(entry.entityId);
      }
    }
    return result;
  }

  queryPoint(x: number, y: number, tolerance: number = 5): number[] {
    return this.query(x - tolerance, y - tolerance, x + tolerance, y + tolerance);
  }

  getEntryCount(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }
}
