import type { SceneNode } from '../scene_node';

export interface Command {
  readonly type: string;
  execute(nodes: Map<number, SceneNode>): void;
  undo(nodes: Map<number, SceneNode>): void;
  getDescription(): string;
}

export class MoveCommand implements Command {
  readonly type = 'move';
  private ids: number[];
  private dx: number;
  private dy: number;

  constructor(ids: number[], dx: number, dy: number) {
    this.ids = [...ids];
    this.dx = dx;
    this.dy = dy;
  }

  execute(nodes: Map<number, SceneNode>): void {
    for (const id of this.ids) {
      const node = nodes.get(id);
      if (node) this.applyDelta(node, this.dx, this.dy);
    }
  }

  undo(nodes: Map<number, SceneNode>): void {
    for (const id of this.ids) {
      const node = nodes.get(id);
      if (node) this.applyDelta(node, -this.dx, -this.dy);
    }
  }

  getDescription(): string {
    return `Move ${this.ids.length} entities by (${this.dx}, ${this.dy})`;
  }

  private applyDelta(node: SceneNode, dx: number, dy: number): void {
    node.bbox.minX += dx;
    node.bbox.minY += dy;
    node.bbox.maxX += dx;
    node.bbox.maxY += dy;
    node.dirty = true;

    switch (node.type) {
      case 'line':
        node.startX += dx; node.startY += dy;
        node.endX += dx; node.endY += dy;
        break;
      case 'circle':
        node.centerX += dx; node.centerY += dy;
        break;
      case 'arc':
        node.centerX += dx; node.centerY += dy;
        break;
      case 'point':
        node.posX += dx; node.posY += dy;
        break;
      case 'text':
        node.posX += dx; node.posY += dy;
        break;
      case 'mText':
        node.posX += dx; node.posY += dy;
        break;
      case 'insert':
        node.posX += dx; node.posY += dy;
        break;
      case 'ellipse':
        node.centerX += dx; node.centerY += dy;
        break;
      case 'lwPolyline':
        for (const v of node.vertices) { v.x += dx; v.y += dy; }
        break;
      case 'polyline':
        for (const v of node.vertices) { v.x += dx; v.y += dy; }
        break;
      case 'spline':
        for (const p of node.controlPoints) { p.x += dx; p.y += dy; }
        for (const p of node.fitPoints) { p.x += dx; p.y += dy; }
        break;
      case 'solid':
        for (const p of node.points) { p.x += dx; p.y += dy; }
        break;
      case 'hatch':
        for (const path of node.boundaries) {
          for (const v of path) { v.x += dx; v.y += dy; }
        }
        break;
      case 'dimension':
        node.defX += dx; node.defY += dy;
        node.midX += dx; node.midY += dy;
        break;
    }
  }
}

export class DeleteCommand implements Command {
  readonly type = 'delete';
  private ids: number[];
  private backup: Map<number, SceneNode> = new Map();

  constructor(ids: number[]) {
    this.ids = [...ids];
  }

  execute(nodes: Map<number, SceneNode>): void {
    this.backup.clear();
    for (const id of this.ids) {
      const node = nodes.get(id);
      if (node) {
        this.backup.set(id, this.cloneNode(node));
        nodes.delete(id);
      }
    }
  }

  undo(nodes: Map<number, SceneNode>): void {
    for (const [id, node] of this.backup) {
      nodes.set(id, node);
    }
  }

  getDescription(): string {
    return `Delete ${this.ids.length} entities`;
  }

  private cloneNode(node: SceneNode): SceneNode {
    return JSON.parse(JSON.stringify(node));
  }
}

export class ChangeColorCommand implements Command {
  readonly type = 'changeColor';
  private ids: number[];
  private newColor: number;
  private oldColors: Map<number, number> = new Map();

  constructor(ids: number[], newColor: number) {
    this.ids = [...ids];
    this.newColor = newColor;
  }

  execute(nodes: Map<number, SceneNode>): void {
    this.oldColors.clear();
    for (const id of this.ids) {
      const node = nodes.get(id);
      if (node) {
        this.oldColors.set(id, node.color);
        node.color = this.newColor;
        node.dirty = true;
      }
    }
  }

  undo(nodes: Map<number, SceneNode>): void {
    for (const [id, oldColor] of this.oldColors) {
      const node = nodes.get(id);
      if (node) {
        node.color = oldColor;
        node.dirty = true;
      }
    }
  }

  getDescription(): string {
    return `Change color of ${this.ids.length} entities to 0x${this.newColor.toString(16)}`;
  }
}

export class ChangeLayerCommand implements Command {
  readonly type = 'changeLayer';
  private ids: number[];
  private newLayer: string;
  private oldLayers: Map<number, string> = new Map();

  constructor(ids: number[], newLayer: string) {
    this.ids = [...ids];
    this.newLayer = newLayer;
  }

  execute(nodes: Map<number, SceneNode>): void {
    this.oldLayers.clear();
    for (const id of this.ids) {
      const node = nodes.get(id);
      if (node) {
        this.oldLayers.set(id, node.layer);
        node.layer = this.newLayer;
        node.dirty = true;
      }
    }
  }

  undo(nodes: Map<number, SceneNode>): void {
    for (const [id, oldLayer] of this.oldLayers) {
      const node = nodes.get(id);
      if (node) {
        node.layer = oldLayer;
        node.dirty = true;
      }
    }
  }

  getDescription(): string {
    return `Move ${this.ids.length} entities to layer "${this.newLayer}"`;
  }
}

export class RotateCommand implements Command {
  readonly type = 'rotate';
  private ids: number[];
  private angle: number;
  private pivotX: number;
  private pivotY: number;

  constructor(ids: number[], angle: number, pivotX: number, pivotY: number) {
    this.ids = [...ids];
    this.angle = angle;
    this.pivotX = pivotX;
    this.pivotY = pivotY;
  }

  execute(nodes: Map<number, SceneNode>): void {
    this.applyRotation(nodes, this.angle);
  }

  undo(nodes: Map<number, SceneNode>): void {
    this.applyRotation(nodes, -this.angle);
  }

  getDescription(): string {
    return `Rotate ${this.ids.length} entities by ${this.angle}rad around (${this.pivotX}, ${this.pivotY})`;
  }

  private applyRotation(nodes: Map<number, SceneNode>, angle: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (const id of this.ids) {
      const node = nodes.get(id);
      if (!node) continue;

      this.rotateNodeGeometry(node, angle, cos, sin);
      node.dirty = true;
    }
  }

  private rotateNodeGeometry(node: SceneNode, angle: number, cos: number, sin: number): void {
    const rotatePoint = (px: number, py: number): { x: number; y: number } => {
      const dx = px - this.pivotX;
      const dy = py - this.pivotY;
      return {
        x: this.pivotX + dx * cos - dy * sin,
        y: this.pivotY + dx * sin + dy * cos,
      };
    };

    switch (node.type) {
      case 'line': {
        const start = rotatePoint(node.startX, node.startY);
        const end = rotatePoint(node.endX, node.endY);
        node.startX = start.x; node.startY = start.y;
        node.endX = end.x; node.endY = end.y;
        break;
      }
      case 'circle': {
        const center = rotatePoint(node.centerX, node.centerY);
        node.centerX = center.x; node.centerY = center.y;
        break;
      }
      case 'arc': {
        const center = rotatePoint(node.centerX, node.centerY);
        node.centerX = center.x; node.centerY = center.y;
        node.startAngle += angle;
        node.endAngle += angle;
        break;
      }
      case 'ellipse': {
        const center = rotatePoint(node.centerX, node.centerY);
        node.centerX = center.x; node.centerY = center.y;
        const major = rotatePoint(node.centerX + node.majorX, node.centerY + node.majorY);
        node.majorX = major.x - node.centerX;
        node.majorY = major.y - node.centerY;
        node.startAngle += angle;
        node.endAngle += angle;
        break;
      }
      case 'point': {
        const pos = rotatePoint(node.posX, node.posY);
        node.posX = pos.x; node.posY = pos.y;
        break;
      }
      case 'text': {
        const pos = rotatePoint(node.posX, node.posY);
        node.posX = pos.x; node.posY = pos.y;
        node.rotation += angle;
        break;
      }
      case 'mText': {
        const pos = rotatePoint(node.posX, node.posY);
        node.posX = pos.x; node.posY = pos.y;
        node.rotation += angle;
        break;
      }
      case 'insert': {
        const pos = rotatePoint(node.posX, node.posY);
        node.posX = pos.x; node.posY = pos.y;
        node.rotation += angle;
        break;
      }
      case 'lwPolyline': {
        for (const v of node.vertices) {
          const rotated = rotatePoint(v.x, v.y);
          v.x = rotated.x; v.y = rotated.y;
        }
        break;
      }
      case 'polyline': {
        for (const v of node.vertices) {
          const rotated = rotatePoint(v.x, v.y);
          v.x = rotated.x; v.y = rotated.y;
        }
        break;
      }
      case 'spline': {
        for (const p of node.controlPoints) {
          const rotated = rotatePoint(p.x, p.y);
          p.x = rotated.x; p.y = rotated.y;
        }
        for (const p of node.fitPoints) {
          const rotated = rotatePoint(p.x, p.y);
          p.x = rotated.x; p.y = rotated.y;
        }
        break;
      }
      case 'solid': {
        for (const p of node.points) {
          const rotated = rotatePoint(p.x, p.y);
          p.x = rotated.x; p.y = rotated.y;
        }
        break;
      }
      case 'hatch': {
        for (const path of node.boundaries) {
          for (const v of path) {
            const rotated = rotatePoint(v.x, v.y);
            v.x = rotated.x; v.y = rotated.y;
          }
        }
        break;
      }
      case 'dimension': {
        const defPt = rotatePoint(node.defX, node.defY);
        const midPt = rotatePoint(node.midX, node.midY);
        node.defX = defPt.x; node.defY = defPt.y;
        node.midX = midPt.x; node.midY = midPt.y;
        node.rotation += angle;
        break;
      }
    }

    const corners = [
      rotatePoint(node.bbox.minX, node.bbox.minY),
      rotatePoint(node.bbox.minX, node.bbox.maxY),
      rotatePoint(node.bbox.maxX, node.bbox.minY),
      rotatePoint(node.bbox.maxX, node.bbox.maxY),
    ];
    node.bbox.minX = Math.min(...corners.map(c => c.x));
    node.bbox.minY = Math.min(...corners.map(c => c.y));
    node.bbox.maxX = Math.max(...corners.map(c => c.x));
    node.bbox.maxY = Math.max(...corners.map(c => c.y));
  }
}
