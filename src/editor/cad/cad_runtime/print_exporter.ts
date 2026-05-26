import * as THREE from 'three';
import type { BoundingBox, SceneNode, LineNode, CircleNode, ArcNode, TextNode, PointNode } from './scene_node';

export class PrintExporter {
  private _scene: THREE.Scene | null = null;
  private _camera: THREE.OrthographicCamera | null = null;
  private _nodes: Map<number, SceneNode> | null = null;

  setScene(scene: THREE.Scene): void {
    this._scene = scene;
  }

  setCamera(camera: THREE.OrthographicCamera): void {
    this._camera = camera;
  }

  setNodes(nodes: Map<number, SceneNode>): void {
    this._nodes = nodes;
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

  exportToSVG(bounds?: BoundingBox, options?: { strokeWidth?: number; fontSize?: number }): string | null {
    if (!this._nodes || this._nodes.size === 0) return null;

    const svgBounds = bounds || this._computeBounds();
    if (!svgBounds) return null;

    const strokeWidth = options?.strokeWidth ?? 1;
    const fontSize = options?.fontSize ?? 12;
    const width = 1920;
    const height = 1080;

    const bw = svgBounds.maxX - svgBounds.minX;
    const bh = svgBounds.maxY - svgBounds.minY;
    const scale = Math.min(width / bw, height / bh) * 0.9;
    const offsetX = (width - bw * scale) / 2;
    const offsetY = (height - bh * scale) / 2;

    const toSvgX = (x: number) => (x - svgBounds.minX) * scale + offsetX;
    const toSvgY = (y: number) => height - ((y - svgBounds.minY) * scale + offsetY);

    let svgContent = '';

    for (const [, node] of this._nodes) {
      if (!node.visible) continue;
      const color = this._nodeColorToHex(node);

      switch (node.type) {
        case 'line': {
          const ln = node as LineNode;
          svgContent += `  <line x1="${toSvgX(ln.startX)}" y1="${toSvgY(ln.startY)}" x2="${toSvgX(ln.endX)}" y2="${toSvgY(ln.endY)}" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
          break;
        }
        case 'circle': {
          const cn = node as CircleNode;
          svgContent += `  <circle cx="${toSvgX(cn.centerX)}" cy="${toSvgY(cn.centerY)}" r="${cn.radius * scale}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
          break;
        }
        case 'arc': {
          const an = node as ArcNode;
          const startX = toSvgX(an.centerX + an.radius * Math.cos(an.startAngle));
          const startY = toSvgY(an.centerY + an.radius * Math.sin(an.startAngle));
          const endX = toSvgX(an.centerX + an.radius * Math.cos(an.endAngle));
          const endY = toSvgY(an.centerY + an.radius * Math.sin(an.endAngle));
          const largeArc = Math.abs(an.endAngle - an.startAngle) > Math.PI ? 1 : 0;
          svgContent += `  <path d="M ${startX} ${startY} A ${an.radius * scale} ${an.radius * scale} 0 ${largeArc} 0 ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
          break;
        }
        case 'point': {
          const pn = node as PointNode;
          svgContent += `  <circle cx="${toSvgX(pn.posX)}" cy="${toSvgY(pn.posY)}" r="${strokeWidth * 2}" fill="${color}" />\n`;
          break;
        }
        case 'text': {
          const tn = node as TextNode;
          const tx = toSvgX(tn.posX);
          const ty = toSvgY(tn.posY);
          const rot = tn.rotation ? ` transform="rotate(${-tn.rotation * 180 / Math.PI}, ${tx}, ${ty})"` : '';
          svgContent += `  <text x="${tx}" y="${ty}" fill="${color}" font-size="${fontSize}"${rot}>${this._escapeXml(tn.content)}</text>\n`;
          break;
        }
        case 'lwPolyline':
        case 'polyline': {
          const verts = (node as any).vertices;
          if (verts && verts.length > 0) {
            const points = verts.map((v: any) => `${toSvgX(v.x)},${toSvgY(v.y)}`).join(' ');
            svgContent += `  <polyline points="${points}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
          }
          break;
        }
        case 'solid': {
          const pts = (node as any).points;
          if (pts && pts.length >= 3) {
            const points = pts.map((p: any) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ');
            svgContent += `  <polygon points="${points}" fill="${color}" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
          }
          break;
        }
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <rect width="100%" height="100%" fill="#1a1a2e" />\n${svgContent}</svg>`;
  }

  downloadSVG(filename: string = 'cad_export.svg', bounds?: BoundingBox): boolean {
    const svg = this.exportToSVG(bounds);
    if (!svg) return false;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }

  exportToPDF(): Blob | null {
    return null;
  }

  private _computeBounds(): BoundingBox | null {
    if (!this._nodes || this._nodes.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [, node] of this._nodes) {
      if (!node.visible) continue;
      minX = Math.min(minX, node.bbox.minX);
      minY = Math.min(minY, node.bbox.minY);
      maxX = Math.max(maxX, node.bbox.maxX);
      maxY = Math.max(maxY, node.bbox.maxY);
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }

  private _nodeColorToHex(node: SceneNode): string {
    const color = (node as any).color;
    if (typeof color === 'number') {
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    if (typeof color === 'string') return color;
    return '#ffffff';
  }

  private _escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
}
