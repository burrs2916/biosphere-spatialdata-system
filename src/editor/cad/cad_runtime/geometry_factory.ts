import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { Text as TroikaText } from 'troika-three-text';
import type { CadPoint, CadLwVertex } from '../types';
import type { SceneNode } from '../cad_runtime/scene_node';
import { applyTransform } from '../coordinate/TransformCalculator';
import type { TransformParams } from '../coordinate/TransformCalculator';

const DEFAULT_LINE_WIDTH = 1.5;
const FONT_URL = '/fonts/SourceHanSansCN-Regular.otf';

export class GeometryFactory {
  private _resolution: THREE.Vector2;
  private _lineMaterialCache: Map<string, LineMaterial> = new Map();
  private static readonly MAX_MATERIAL_CACHE_SIZE = 500;
  private _clippingPlanes: THREE.Plane[] = [];
  private _transformParams: TransformParams | null = null;
  private _requestRender: () => void;

  constructor(resolution: THREE.Vector2, requestRender: () => void) {
    this._resolution = resolution;
    this._requestRender = requestRender;
  }

  setResolution(resolution: THREE.Vector2): void {
    this._resolution = resolution;
  }

  setClippingPlanes(planes: THREE.Plane[]): void {
    this._clippingPlanes = planes;
  }

  setTransformParams(params: TransformParams | null): void {
    this._transformParams = params;
  }

  createLine(start: CadPoint, end: CadPoint, color: THREE.Color, lineWidth: number = DEFAULT_LINE_WIDTH): Line2 | null {
    if (!isValidPoint(start) || !isValidPoint(end)) return null;
    const MIN_LINE_LENGTH = 0.1;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    if (dx * dx + dy * dy + dz * dz < MIN_LINE_LENGTH * MIN_LINE_LENGTH) return null;
    const points = [
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3(end.x, end.y, end.z),
    ];
    return this.createLine2FromPoints(points, color, lineWidth);
  }

  createCircle(center: CadPoint, radius: number, color: THREE.Color, lineWidth: number, adaptiveArcSegments: (r: number, a: number) => number): Line2 | null {
    if (!isValidPoint(center) || !isValidNumber(radius) || radius <= 0) return null;
    const segments = adaptiveArcSegments(radius, Math.PI * 2);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, center.z));
    }
    return this.createLine2FromPoints(points, color, lineWidth);
  }

  createArc(center: CadPoint, radius: number, startAngle: number, endAngle: number, color: THREE.Color, lineWidth: number, adaptiveArcSegments: (r: number, a: number) => number): Line2 | null {
    if (!isValidPoint(center) || !isValidNumber(radius) || radius <= 0) return null;
    if (!isValidNumber(startAngle) || !isValidNumber(endAngle)) return null;
    let angleRange = endAngle - startAngle;
    if (angleRange < 0) angleRange += Math.PI * 2;
    if (angleRange < 1e-10) return null;
    const segments = adaptiveArcSegments(radius, angleRange);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * angleRange;
      points.push(new THREE.Vector3(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, center.z));
    }
    return this.createLine2FromPoints(points, color, lineWidth);
  }

  createPolyline(vertices: CadPoint[], closed: boolean, color: THREE.Color, lineWidth: number): Line2 | null {
    const validVertices = vertices.filter(v => isValidPoint(v));
    if (validVertices.length === 0) return null;
    const points = validVertices.map(v => new THREE.Vector3(v.x, v.y, v.z));
    if (closed && points.length > 0) points.push(points[0].clone());
    return this.createLine2FromPoints(points, color, lineWidth);
  }

  createLwPolyline(vertices: CadLwVertex[], closed: boolean, color: THREE.Color, lineWidth: number): Line2 | null {
    if (!vertices || vertices.length === 0) return null;
    const validVertices = vertices.filter(v => isValidNumber(v.x) && isValidNumber(v.y) && isValidNumber(v.bulge));
    if (validVertices.length === 0) return null;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < validVertices.length; i++) {
      const v = validVertices[i];
      points.push(new THREE.Vector3(v.x, v.y, 0));
      const nextIdx = closed ? (i + 1) % validVertices.length : i + 1;
      if (nextIdx >= validVertices.length) continue;
      const nextV = validVertices[nextIdx];
      if (Math.abs(v.bulge) > 1e-9) {
        const arcPoints = bulgeToArc(v, nextV);
        for (const p of arcPoints) {
          if (isValidVector3(p)) points.push(p);
        }
      }
    }
    if (closed && points.length > 0) points.push(points[0].clone());
    return this.createLine2FromPoints(points, color, lineWidth);
  }

  createEllipse(center: CadPoint, majorAxis: CadPoint, minorAxisRatio: number, startAngle: number, endAngle: number, color: THREE.Color, lineWidth: number): Line2 | null {
    if (!isValidPoint(center) || !isValidPoint(majorAxis)) return null;
    const majorLength = Math.sqrt(majorAxis.x ** 2 + majorAxis.y ** 2 + majorAxis.z ** 2);
    if (majorLength < 1e-10 || !isValidNumber(majorLength)) return null;
    if (!isValidNumber(minorAxisRatio) || minorAxisRatio <= 0) return null;
    if (!isValidNumber(startAngle) || !isValidNumber(endAngle)) return null;
    const segments = 64;
    const points: THREE.Vector3[] = [];
    const minorLength = majorLength * minorAxisRatio;
    const rotation = Math.atan2(majorAxis.y, majorAxis.x);
    let angleRange = endAngle - startAngle;
    if (angleRange < 0) angleRange += Math.PI * 2;
    if (angleRange < 1e-10) return null;
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * angleRange;
      const x = Math.cos(angle) * majorLength;
      const y = Math.sin(angle) * minorLength;
      const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
      const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
      points.push(new THREE.Vector3(center.x + rotatedX, center.y + rotatedY, center.z));
    }
    return this.createLine2FromPoints(points, color, lineWidth);
  }

  createSpline(controlPoints: CadPoint[], fitPoints: CadPoint[], _knots: number[], degree: number, color: THREE.Color, lineWidth: number): Line2 | null {
    if (fitPoints.length >= 2) {
      return this.createSplineFromFitPoints(fitPoints, color, lineWidth);
    }
    const validPoints = controlPoints.filter(p => isValidPoint(p));
    if (validPoints.length < 2) return this.createPolyline(validPoints, false, color, lineWidth);
    const points: THREE.Vector3[] = [];
    const numSamples = Math.max(validPoints.length * 10, 50);
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const point = evaluateBSpline(validPoints, t, degree);
      if (isValidPoint(point)) points.push(new THREE.Vector3(point.x, point.y, point.z));
    }
    return this.createLine2FromPoints(points, color, lineWidth);
  }

  createSplineFromFitPoints(fitPoints: CadPoint[], color: THREE.Color, lineWidth: number): Line2 | null {
    const validPoints = fitPoints.filter(p => isValidPoint(p));
    if (validPoints.length < 2) return null;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < validPoints.length - 1; i++) {
      const p0 = validPoints[Math.max(0, i - 1)];
      const p1 = validPoints[i];
      const p2 = validPoints[Math.min(validPoints.length - 1, i + 1)];
      const p3 = validPoints[Math.min(validPoints.length - 1, i + 2)];
      if (!isValidPoint(p0) || !isValidPoint(p1) || !isValidPoint(p2) || !isValidPoint(p3)) continue;
      const segments = 10;
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const t2 = t * t;
        const t3 = t2 * t;
        const catmullRom = [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2];
        const x = catmullRom[0] * p0.x + catmullRom[1] * p1.x + catmullRom[2] * p2.x + catmullRom[3] * p3.x;
        const y = catmullRom[0] * p0.y + catmullRom[1] * p1.y + catmullRom[2] * p2.y + catmullRom[3] * p3.y;
        const z = catmullRom[0] * p0.z + catmullRom[1] * p1.z + catmullRom[2] * p2.z + catmullRom[3] * p3.z;
        if (isValidNumber(x) && isValidNumber(y) && isValidNumber(z)) points.push(new THREE.Vector3(x, y, z));
      }
    }
    return this.createLine2FromPoints(points, color, lineWidth);
  }

  createText(
    position: CadPoint, content: string, height: number, rotation: number,
    color: THREE.Color, attachmentPoint: number = 1, rectWidth: number = 0,
    widthFactor: number = 1.0, _fontName: string = '', heightScale: number = 1.0,
  ): THREE.Group | null {
    if (!isValidPoint(position)) return null;
    if (!isValidNumber(height) || height <= 0) return null;
    if (!content || content.trim().length === 0) return null;
    if (!isValidNumber(rotation)) rotation = 0;
    const lines = content.split(/\r?\n|\\P/).filter(s => s.length > 0);
    if (lines.length === 0) return null;
    const group = new THREE.Group();
    const effectiveWidthFactor = (isValidNumber(widthFactor) && widthFactor > 0) ? widthFactor : 1.0;
    const effectiveHeightScale = (isValidNumber(heightScale) && heightScale > 0) ? heightScale : 1.0;
    const textContent = lines.join('\n');
    const fontSize = height * effectiveHeightScale;
    const ap = Math.max(1, Math.min(9, Math.floor(attachmentPoint)));
    const col = ((ap - 1) % 3);
    const row = Math.floor((ap - 1) / 3);
    const anchorX = col === 0 ? 'left' : col === 1 ? 'center' : 'right';
    const anchorY = row === 0 ? 'top' : row === 1 ? 'middle' : 'bottom';
    const textMesh = new TroikaText();
    textMesh.text = textContent;
    textMesh.font = FONT_URL;
    textMesh.fontSize = fontSize;
    textMesh.color = color;
    textMesh.anchorX = anchorX;
    textMesh.anchorY = anchorY;
    textMesh.maxWidth = (rectWidth > 0 && isValidNumber(rectWidth)) ? rectWidth / effectiveWidthFactor : undefined;
    textMesh.lineHeight = 1.25;
    textMesh.depthTest = false;
    textMesh.renderOrder = 1;
    textMesh.scale.set(effectiveWidthFactor, 1, 1);
    textMesh.sync(() => {
      if (this._clippingPlanes.length > 0) {
        textMesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
            const mat = (child as THREE.Mesh).material as THREE.Material;
            mat.clippingPlanes = this._clippingPlanes;
            mat.clipShadows = true;
          }
        });
      }
      this._requestRender();
    });
    group.add(textMesh);
    group.position.set(position.x, position.y, position.z);
    group.rotation.z = rotation || 0;
    return group;
  }

  createTextPlaceholder(position: CadPoint, height: number, rotation: number, color: THREE.Color, widthFactor: number = 1.0): THREE.Mesh | null {
    if (!isValidPoint(position) || !isValidNumber(height) || height <= 0) return null;
    const w = height * 0.6 * (isValidNumber(widthFactor) && widthFactor > 0 ? widthFactor : 1.0);
    const h = height;
    const geometry = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, depthTest: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    mesh.position.set(position.x, position.y, position.z || 0);
    mesh.rotation.z = rotation || 0;
    return mesh;
  }

  createSolid(points: CadPoint[], color: THREE.Color): THREE.Mesh | null {
    const validPoints = points.filter(p => isValidPoint(p));
    if (validPoints.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(validPoints[0].x, validPoints[0].y);
    for (let i = 1; i < validPoints.length; i++) shape.lineTo(validPoints[i].x, validPoints[i].y);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    return new THREE.Mesh(geometry, material);
  }

  createPoint(_position: CadPoint, _color: THREE.Color): THREE.Group | null {
    return null;
  }

  createLine2FromPoints(points: THREE.Vector3[], color: THREE.Color, lineWidth: number = DEFAULT_LINE_WIDTH): Line2 | null {
    if (points.length < 2) return null;
    const MIN_VISIBLE_LENGTH = 0.01;
    let hasVisibleSegment = false;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const dz = points[i].z - points[i - 1].z;
      if (dx * dx + dy * dy + dz * dz >= MIN_VISIBLE_LENGTH * MIN_VISIBLE_LENGTH) {
        hasVisibleSegment = true;
        break;
      }
    }
    if (!hasVisibleSegment) return null;
    const positions: number[] = [];
    for (const p of points) {
      if (!isValidVector3(p)) return null;
      positions.push(p.x, p.y, p.z);
    }
    const geometry = new LineGeometry();
    geometry.setPositions(positions);
    const material = this.createLineMaterial(color, lineWidth);
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    return line;
  }

  createLineMaterial(color: THREE.Color, lineWidth: number = DEFAULT_LINE_WIDTH): LineMaterial {
    const key = `${color.getHex()}_${lineWidth}`;
    const cached = this._lineMaterialCache.get(key);
    if (cached && !(cached as any).disposed) return cached;
    if (cached) this._lineMaterialCache.delete(key);
    const material = new LineMaterial({ color: color.getHex(), linewidth: lineWidth, resolution: this._resolution, worldUnits: false });
    if (this._lineMaterialCache.size >= GeometryFactory.MAX_MATERIAL_CACHE_SIZE) {
      const oldestKeyResult = this._lineMaterialCache.keys().next();
      if (!oldestKeyResult.done) {
        const oldestKey = oldestKeyResult.value;
        const oldestMat = this._lineMaterialCache.get(oldestKey);
        if (oldestMat) oldestMat.dispose();
        this._lineMaterialCache.delete(oldestKey);
      }
    }
    this._lineMaterialCache.set(key, material);
    return material;
  }

  addTextToBatchedRenderer(
    idStr: string, node: SceneNode, layer: string,
    resolveColor: (rawColor: number, layerName?: string) => THREE.Color,
    sdfTextRenderer: any,
  ): boolean {
    try {
      const color = resolveColor(node.color, layer);
      const textNode = node as any;
      const content = textNode.content ?? '';
      if (!content || content.trim().length === 0) return false;
      const height = textNode.height;
      if (!isValidNumber(height) || height <= 0) return false;
      let position = { x: textNode.posX ?? 0, y: textNode.posY ?? 0, z: 0 };
      if (this._transformParams) {
        const transformed = applyTransform({ x: position.x, y: position.y }, this._transformParams);
        position = { x: transformed.x, y: transformed.y, z: 0 };
      }
      if (!isValidPoint(position)) return false;
      const rotation = isValidNumber(textNode.rotation) ? textNode.rotation : 0;
      const widthFactor = (isValidNumber(textNode.widthFactor) && textNode.widthFactor > 0) ? textNode.widthFactor : 1.0;
      const heightScale = (isValidNumber(textNode.heightScale) && textNode.heightScale > 0) ? textNode.heightScale : 1.0;
      const fontSize = height * heightScale;
      let attachmentPoint: number;
      if (node.type === 'text') {
        attachmentPoint = textAlignmentToAttachmentPoint(textNode.horizontalAlignment ?? 0, textNode.verticalAlignment ?? 0);
      } else {
        attachmentPoint = textNode.attachmentPoint ?? 1;
      }
      const ap = Math.max(1, Math.min(9, Math.floor(attachmentPoint)));
      const col = ((ap - 1) % 3);
      const row = Math.floor((ap - 1) / 3);
      const anchorX = col === 0 ? 'left' : col === 1 ? 'center' : 'right';
      const anchorY = row === 0 ? 'top' : row === 1 ? 'middle' : 'bottom';
      const rectWidth = textNode.width ?? 0;
      const maxWidth = (rectWidth > 0 && isValidNumber(rectWidth)) ? rectWidth / widthFactor : undefined;
      const lines = content.split(/\r?\n|\\P/).filter((s: string) => s.length > 0);
      if (lines.length === 0) return false;
      const textContent = lines.join('\n');
      const estWidth = estimateTextWidth(textContent, fontSize, widthFactor);
      sdfTextRenderer.addText(idStr, textContent, position, fontSize, color, rotation, anchorX, anchorY, maxWidth, widthFactor, layer, estWidth);
      return true;
    } catch (_e) {
      return false;
    }
  }

  disposeLineMaterials(): void {
    for (const mat of this._lineMaterialCache.values()) mat.dispose();
    this._lineMaterialCache.clear();
  }

  getLineMaterialCache(): Map<string, LineMaterial> {
    return this._lineMaterialCache;
  }
}

export function isValidNumber(value: number): boolean {
  return Number.isFinite(value) && !Number.isNaN(value);
}

export function isValidPoint(point: CadPoint): boolean {
  return isValidNumber(point.x) && isValidNumber(point.y) && isValidNumber(point.z);
}

export function isValidVector3(v: THREE.Vector3): boolean {
  return isValidNumber(v.x) && isValidNumber(v.y) && isValidNumber(v.z);
}

export function textAlignmentToAttachmentPoint(hAlign: number, vAlign: number): number {
  const col = hAlign === 1 ? 1 : hAlign === 2 ? 2 : 0;
  const row = vAlign === 3 ? 0 : vAlign === 2 ? 1 : 2;
  return row * 3 + col + 1;
}

export function estimateTextWidth(content: string, height: number, widthFactor: number = 1): number {
  const safeHeight = isValidNumber(height) && height > 0 ? height : 1;
  const safeWidthFactor = isValidNumber(widthFactor) && widthFactor > 0 ? widthFactor : 1;
  const maxUnits = content.split(/\r?\n|\\P/).reduce((max, line) => {
    const units = Array.from(line).reduce((sum, ch) => {
      const code = ch.charCodeAt(0);
      if (/\s/.test(ch)) return sum + 0.3;
      if (code <= 0x7f) {
        if ('ilI1|'.includes(ch)) return sum + 0.3;
        if ('MWmw@'.includes(ch)) return sum + 0.85;
        return sum + 0.6;
      }
      if (code >= 0x3000 && code <= 0x303F) return sum + 1;
      if (code >= 0x4E00 && code <= 0x9FFF) return sum + 1;
      if (code >= 0xAC00 && code <= 0xD7AF) return sum + 1;
      return sum + 0.8;
    }, 0);
    return Math.max(max, units);
  }, 0);
  return Math.max(safeHeight, Math.max(1, maxUnits) * safeHeight * safeWidthFactor);
}

export function bulgeToArc(start: CadLwVertex, end: CadLwVertex): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const bulge = start.bulge;
  if (!isValidNumber(bulge)) return points;
  const sx = start.x, sy = start.y, ex = end.x, ey = end.y;
  const dx = ex - sx, dy = ey - sy;
  const chordLength = Math.sqrt(dx * dx + dy * dy);
  if (chordLength < 1e-10) return points;
  const includedAngle = 4 * Math.atan(Math.abs(bulge));
  if (includedAngle < 1e-10 || includedAngle >= Math.PI * 2 - 1e-10) return points;
  const sinHalfAngle = Math.sin(includedAngle / 2);
  if (Math.abs(sinHalfAngle) < 1e-10) return points;
  const radius = chordLength / (2 * sinHalfAngle);
  if (!isValidNumber(radius) || radius <= 0 || !isFinite(radius)) return points;
  const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
  const chordDirX = dx / chordLength, chordDirY = dy / chordLength;
  const perpX = -chordDirY, perpY = chordDirX;
  const sagitta = radius * (1 - Math.cos(includedAngle / 2));
  const sign = bulge > 0 ? 1 : -1;
  const cx = midX + sign * perpX * sagitta, cy = midY + sign * perpY * sagitta;
  if (!isValidNumber(cx) || !isValidNumber(cy)) return points;
  let startAngle = Math.atan2(sy - cy, sx - cx);
  let endAngle = Math.atan2(ey - cy, ex - cx);
  if (!isValidNumber(startAngle) || !isValidNumber(endAngle)) return points;
  if (bulge > 0) { while (endAngle <= startAngle) endAngle += Math.PI * 2; }
  else { while (endAngle >= startAngle) endAngle -= Math.PI * 2; }
  const segments = Math.max(8, Math.ceil(Math.abs(includedAngle) / (Math.PI / 32)));
  const angleStep = (endAngle - startAngle) / segments;
  for (let i = 1; i < segments; i++) {
    const angle = startAngle + angleStep * i;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (isValidNumber(x) && isValidNumber(y)) points.push(new THREE.Vector3(x, y, 0));
  }
  return points;
}

function evaluateBSpline(points: CadPoint[], t: number, _degree: number): CadPoint {
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  if (points.length === 1) {
    const p = points[0];
    if (!isValidPoint(p)) return { x: 0, y: 0, z: 0 };
    return p;
  }
  const n = points.length - 1;
  const clampedT = Math.max(0, Math.min(1, t));
  const segment = Math.min(Math.floor(clampedT * n), n - 1);
  const localT = clampedT * n - segment;
  const p0 = points[Math.max(0, segment - 1)];
  const p1 = points[segment];
  const p2 = points[Math.min(n, segment + 1)];
  const p3 = points[Math.min(n, segment + 2)];
  if (!isValidPoint(p0) || !isValidPoint(p1) || !isValidPoint(p2) || !isValidPoint(p3)) return { x: 0, y: 0, z: 0 };
  const t2 = localT * localT;
  const t3 = t2 * localT;
  const catmullRom = [-0.5 * t3 + t2 - 0.5 * localT, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * localT, 0.5 * t3 - 0.5 * t2];
  const x = catmullRom[0] * p0.x + catmullRom[1] * p1.x + catmullRom[2] * p2.x + catmullRom[3] * p3.x;
  const y = catmullRom[0] * p0.y + catmullRom[1] * p1.y + catmullRom[2] * p2.y + catmullRom[3] * p3.y;
  const z = catmullRom[0] * p0.z + catmullRom[1] * p1.z + catmullRom[2] * p2.z + catmullRom[3] * p3.z;
  return { x: isValidNumber(x) ? x : 0, y: isValidNumber(y) ? y : 0, z: isValidNumber(z) ? z : 0 };
}
