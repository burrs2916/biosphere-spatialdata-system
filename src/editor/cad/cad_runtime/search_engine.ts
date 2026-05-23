import type { SceneNode } from '../cad_runtime/scene_node';

export interface SearchResult {
  entityId: string;
  node: SceneNode;
  matchField: string;
  matchValue: string;
}

export class SearchEngine {
  private _nodeIndex: Map<string, SceneNode> = new Map();

  setNodeIndex(nodeIndex: Map<string, SceneNode>): void {
    this._nodeIndex = nodeIndex;
  }

  search(query: string, options?: { searchContent?: boolean; searchLayer?: boolean; searchType?: boolean; caseSensitive?: boolean }): SearchResult[] {
    if (!query.trim()) return [];
    const searchContent = options?.searchContent !== false;
    const searchLayer = options?.searchLayer !== false;
    const searchType = options?.searchType !== false;
    const caseSensitive = options?.caseSensitive ?? false;
    const q = caseSensitive ? query : query.toLowerCase();
    const results: SearchResult[] = [];

    for (const [id, node] of this._nodeIndex) {
      if (searchContent) {
        const content = this._getNodeContent(node);
        const haystack = caseSensitive ? content : content.toLowerCase();
        if (haystack.includes(q)) {
          results.push({ entityId: id, node, matchField: 'content', matchValue: content });
          continue;
        }
      }
      if (searchLayer) {
        const layer = node.layer;
        const haystack = caseSensitive ? layer : layer.toLowerCase();
        if (haystack.includes(q)) {
          results.push({ entityId: id, node, matchField: 'layer', matchValue: layer });
          continue;
        }
      }
      if (searchType) {
        const type = node.type;
        const haystack = caseSensitive ? type : type.toLowerCase();
        if (haystack.includes(q)) {
          results.push({ entityId: id, node, matchField: 'type', matchValue: type });
          continue;
        }
      }
    }

    return results;
  }

  searchByLayer(layerName: string): SearchResult[] {
    const results: SearchResult[] = [];
    for (const [id, node] of this._nodeIndex) {
      if (node.layer === layerName) {
        results.push({ entityId: id, node, matchField: 'layer', matchValue: layerName });
      }
    }
    return results;
  }

  searchByType(type: string): SearchResult[] {
    const results: SearchResult[] = [];
    for (const [id, node] of this._nodeIndex) {
      if (node.type === type) {
        results.push({ entityId: id, node, matchField: 'type', matchValue: type });
      }
    }
    return results;
  }

  searchByBbox(minX: number, minY: number, maxX: number, maxY: number): SearchResult[] {
    const results: SearchResult[] = [];
    for (const [id, node] of this._nodeIndex) {
      const bb = node.bbox;
      if (bb.minX <= maxX && bb.maxX >= minX && bb.minY <= maxY && bb.maxY >= minY) {
        results.push({ entityId: id, node, matchField: 'bbox', matchValue: `(${bb.minX.toFixed(1)},${bb.minY.toFixed(1)})-(${bb.maxX.toFixed(1)},${bb.maxY.toFixed(1)})` });
      }
    }
    return results;
  }

  private _getNodeContent(node: SceneNode): string {
    switch (node.type) {
      case 'text':
      case 'mText':
        return (node as any).content ?? '';
      case 'dimension':
        return (node as any).content ?? '';
      case 'insert':
        return (node as any).blockName ?? '';
      default:
        return '';
    }
  }
}
