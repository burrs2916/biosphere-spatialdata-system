import type { SceneNode, SymbolDef } from './scene_node';

export class SymbolSystem {
  private symbols: Map<string, SymbolDef> = new Map();

  loadFromBlockTable(
    blockDefs: Array<{ nameIdx: number; baseX: number; baseY: number; baseZ: number; entityStart: number; entityCount: number }>,
    strings: string[],
    nodes: Map<number, SceneNode>
  ): void {
    this.symbols.clear();
    for (const def of blockDefs) {
      const name = strings[def.nameIdx] || `Block_${def.nameIdx}`;
      const symbolNodes: SceneNode[] = [];
      let idx = def.entityStart;
      for (let i = 0; i < def.entityCount && idx < nodes.size; i++) {
        const node = nodes.get(idx);
        if (node) {
          symbolNodes.push({ ...node });
        }
        idx++;
      }
      this.symbols.set(name, {
        name,
        baseX: def.baseX,
        baseY: def.baseY,
        baseZ: def.baseZ,
        nodes: symbolNodes,
      });
    }
  }

  getSymbol(name: string): SymbolDef | undefined {
    return this.symbols.get(name);
  }

  hasSymbol(name: string): boolean {
    return this.symbols.has(name);
  }

  getAllSymbolNames(): string[] {
    return Array.from(this.symbols.keys());
  }

  getSymbolCount(): number {
    return this.symbols.size;
  }

  addSymbol(def: SymbolDef): void {
    this.symbols.set(def.name, def);
  }

  removeSymbol(name: string): void {
    this.symbols.delete(name);
  }

  instantiateSymbol(
    name: string,
    posX: number,
    posY: number,
    scaleX: number,
    scaleY: number,
    rotation: number
  ): SceneNode[] | null {
    const symbol = this.symbols.get(name);
    if (!symbol) return null;

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return symbol.nodes.map(node => {
      const transformed = { ...node };
      const nx = (transformed.bbox.minX - symbol.baseX) * scaleX;
      const ny = (transformed.bbox.minY - symbol.baseY) * scaleY;
      transformed.bbox = {
        minX: posX + nx * cos - ny * sin,
        minY: posY + nx * sin + ny * cos,
        maxX: posX + ((transformed.bbox.maxX - symbol.baseX) * scaleX) * cos - ((transformed.bbox.maxY - symbol.baseY) * scaleY) * sin,
        maxY: posY + ((transformed.bbox.maxX - symbol.baseX) * scaleX) * sin + ((transformed.bbox.maxY - symbol.baseY) * scaleY) * cos,
      };
      return transformed;
    });
  }
}
