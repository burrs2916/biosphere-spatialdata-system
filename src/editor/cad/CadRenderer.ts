import * as THREE from 'three';
import { Text as TroikaText } from 'troika-three-text';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import type { CadDocument, CadEntity, CadPoint, CadLwVertex, CadBlock } from './types';
import type { SceneGraph } from './cad_runtime/scene_graph';
import { RenderProfile } from './cad_runtime/scene_graph';
import type { SceneNode, BoundingBox, LayerNode } from './cad_runtime/scene_node';
import { BatchedLayerBuilder } from './cad_runtime/batched_layer_builder';
import type { EntityRendererRegistry } from './cad_runtime/entity_renderers/EntityRenderer';
import type { ToolRegistry } from '../tools/Tool';
import { GridSpatialIndex, type LineSegment } from './cad_runtime/grid_spatial_index';
import { SdfTextRenderer } from './cad_runtime/sdf_text_renderer';
import { DrawingManager } from './drawing/DrawingManager';
import { SnapManager } from './snap/SnapManager';
import type { TransformParams } from './coordinate/TransformCalculator';
import { applyTransform } from './coordinate/TransformCalculator';
import { logger } from '../../utils/logger';

export interface CadRendererConfig {
  container: HTMLElement;
  backgroundColor?: string;
  lineColor?: string;
  debugMode?: boolean;
  transparentBackground?: boolean;
  onEntityClick?: (entityId: string, layer: string) => void;
  onSelectionChanged?: (entityIds: string[]) => void;
  onCameraChanged?: (info: CameraInfo) => void;
  onCameraInteractionEnd?: (info: CameraInfo) => void;
  onEntityMoved?: (entityId: string, dx: number, dy: number) => void;
  onEntityContextMenu?: (entityId: string, layer: string, clientX: number, clientY: number) => void;
  onDrawComplete?: (entityJson: string) => void;
}

export interface CameraInfo {
  centerX: number;
  centerY: number;
  worldWidth: number;
  worldHeight: number;
  zoom: number;
}

const DEFAULT_LINE_WIDTH = 1.5;
const HIGHLIGHT_COLOR = new THREE.Color(0x00ff88);
const MIN_LUMINANCE_ON_DARK_BG = 0.18;
const MAX_LUMINANCE_ON_LIGHT_BG = 0.82;
const TARGET_LUMINANCE_DARK = 0.35;
const TARGET_LUMINANCE_LIGHT = 0.55;
const DELETED_LAYER_NAME = '__deleted__';
const FONT_URL = '/fonts/SourceHanSansCN-Regular.otf';

export class CadRenderer {
  private _scene: THREE.Scene;
  private _camera: THREE.OrthographicCamera;
  private _renderer: THREE.WebGLRenderer;
  private _container: HTMLElement;
  private _document: CadDocument | null = null;
  private _entityMeshes: Map<string, THREE.Object3D> = new Map();
  private _debugMode: boolean = false;
  private _transparentBackground: boolean = false;

  /** 检查是否处于调试模式（按需输出日志） */
  private _isDebugMode(): boolean {
    return this._debugMode;
  }

  /** 切换调试模式 */
  setDebugMode(enabled: boolean): void {
    this._debugMode = enabled;
    logger.info('CadRenderer', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /** 设置坐标变换参数，用于将CAD坐标变换为地理/显示坐标 */
  setTransformParams(params: TransformParams | null): void {
    this._transformParams = params;
    if (this._isDebugMode() && params) {
      logger.info('CadRenderer', 'Transform params updated', {
        offsetX: params.offsetX,
        offsetY: params.offsetY,
        scale: params.scale,
        rotation: params.rotation,
      });
    }
  }

  setEntityRendererRegistry(registry: EntityRendererRegistry | null): void {
    this._entityRendererRegistry = registry;
  }

  getEntityRendererRegistry(): EntityRendererRegistry | null {
    return this._entityRendererRegistry;
  }

  setToolRegistry(registry: ToolRegistry | null): void {
    this._toolRegistry = registry;
  }

  getToolRegistry(): ToolRegistry | null {
    return this._toolRegistry;
  }

  private _entityLayers: Map<string, string> = new Map();
  private _hiddenLayers: Set<string> = new Set();
  private _selectedEntityIds: Set<string> = new Set();
  private _selectedOriginalMaterials: Map<string, Map<string, THREE.Material | LineMaterial>> = new Map();
  private _highlightOverlays: Map<string, THREE.Object3D> = new Map();
  private _animationId: number | null = null;
  private _isDisposed = false;
  private _wheelHandler!: (e: WheelEvent) => void;
  private _contextMenuHandler!: (e: MouseEvent) => void;
  private _mouseDownHandler!: (e: MouseEvent) => void;
  private _mouseMoveHandler!: (e: MouseEvent) => void;
  private _mouseUpHandler!: (e: MouseEvent) => void;
  private _mouseLeaveHandler!: () => void;
  private _keyDownHandler!: (e: KeyboardEvent) => void;
  private _isRecoveringCamera = false;
  private _needsRender = false;
  private _isPanning = false;
  private _isBoxSelecting = false;
  private _boxSelectStart = new THREE.Vector2();
  private _boxSelectEnd = new THREE.Vector2();
  private _boxSelectOverlay: HTMLDivElement | null = null;
  private _onEntityClick?: (entityId: string, layer: string) => void;
  private _onSelectionChanged?: (entityIds: string[]) => void;
  private _onCameraChanged?: (info: CameraInfo) => void;
  private _onCameraInteractionEnd?: (info: CameraInfo) => void;
  /** 节流：camera change 通知不要每帧都打回去 */
  private _lastCameraEmit = 0;
  private _cameraInteractionEndTimer: ReturnType<typeof setTimeout> | null = null;
  /** 视口裁剪节流，避免 wheel/move 时每帧扫所有 mesh */
  private _cullingScheduled = false;
  private _lastCullingTime = 0;
  /** wheel 缩放防抖：累积多帧 wheel 事件，每帧只应用一次 */
  private _wheelPending = false;
  private _wheelZoomFactor = 1.0;
  private _wheelWorldX = 0;
  private _wheelWorldY = 0;
  /** 缩放范围限制：基于初始视图跨度计算 */
  private _initialSpan: number = 0;
  private readonly _MIN_SPAN_RATIO = 0.01;   // 最大放大：初始跨度的 1/100（更合理的范围）
  private readonly _MAX_SPAN_RATIO = 100;      // 最大缩小：初始跨度的 100 倍（更合理的范围）
  private _panStart = new THREE.Vector2();
  private _cameraStart = new THREE.Vector2();
  private _documentPanListenersAttached = false;
  private _documentPanMouseMoveHandler!: (e: MouseEvent) => void;
  private _documentPanMouseUpHandler!: (e: MouseEvent) => void;
  private _canvasWidth = 0;
  private _canvasHeight = 0;
  private _resolution: THREE.Vector2;
  private _lineMaterialCache: Map<string, LineMaterial> = new Map();
  private static readonly MAX_MATERIAL_CACHE_SIZE = 500;
  private _defaultLineColor: THREE.Color;
  private _isDarkBackground: boolean = true;
  private _backgroundColor: THREE.Color = new THREE.Color('#1a1a2e');
  /**
   * 由 SceneGraph.bounds 提供的真实图纸范围；优先于按 mesh 估算的 box。
   * 修复：Line2 的 boundingBox 默认是 null，setFromObject 拿不到尺寸，
   * 之前会让摄像机定格在原点导致大坐标范围的图纸全部画在视野外（看似空白）。
   */
  private _externalBounds: BoundingBox | null = null;
  /** entityId(数字字符串) → 对应的 SceneNode，便于编辑器查询 / 双击编辑文字 */
  private _nodeIndex: Map<string, SceneNode> = new Map();
  /** entityId → 该实体当前使用的 THREE.Color（克隆品，用于颜色编辑还原） */
  private _entityColors: Map<string, THREE.Color> = new Map();
  /** 名字 → 图层定义（含 color/visible/locked/frozen），用于 ByLayer fallback。 */
  private _layerIndex: Map<string, LayerNode> = new Map();
  /** 当前光标所在的 world 坐标（cadbin 模式下供状态栏读取） */
  private _lastWorldX = 0;
  private _lastWorldY = 0;
  /**
   * 被"业务层"隐藏的实体 id 集合：图层不可见 / 已删除 / 用户单独隐藏。
   * 视口裁剪只能在此集合之外的实体上做（否则会"自动看见"被业务隐藏的东西）。
   */
  private _logicallyHidden: Set<string> = new Set();
  private _layerEntityIndex: Map<string, Set<string>> = new Map();
  private _layerGroups: Map<string, THREE.Group> = new Map();
  private _batchedBuilder: BatchedLayerBuilder;
  private _useBatchedRendering: boolean = true;
  private _individualEntities: Set<string> = new Set();
  private _spatialIndex: GridSpatialIndex = new GridSpatialIndex(100);
  private _blocks: Map<string, CadBlock> = new Map();
  private _pickingScene: THREE.Scene = new THREE.Scene();
  private _pickingTexture: THREE.WebGLRenderTarget | null = null;
  private _pickingCamera: THREE.OrthographicCamera | null = null;
  private _entityColorMap: Map<number, string> = new Map(); // color key -> entityId
  private _colorEntityMap: Map<string, number> = new Map(); // entityId -> color key
  private _clippingPlanes: THREE.Plane[] = [];
  private _documentExtents: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private _renderProfile: RenderProfile = RenderProfile.Simple;
  private _complexFlags: number = 0;
  private _interactionMode: 'select' | 'pan' | 'draw_line' | 'draw_circle' | 'draw_text' = 'select';
  private _fitMode: 'contain' | 'cover' | 'stretch' | 'custom' = 'contain';
  private _isDraggingEntity = false;
  private _dragEntityId: string | null = null;
  private _dragStartWorld = new THREE.Vector2();
  /** 拖动开始时缓存的线几何顶点（避免 position 偏移 + 合批残留双影） */
  private _dragLineSnapshots: Map<string, number[]> = new Map();
  private _onEntityMoved?: (entityId: string, dx: number, dy: number) => void;
  private _onEntityContextMenu?: (entityId: string, layer: string, clientX: number, clientY: number) => void;
  private _deferredNodes: SceneNode[] = [];
  private _deferredTimer: number | null = null;
  private _isProgressiveLoading = false;
  private _sdfTextRenderer: SdfTextRenderer = new SdfTextRenderer();
  private _useBatchedText = true;
  private _placeholderMap: Map<string, THREE.Object3D> = new Map();
  /** 坐标变换参数：用于将CAD坐标变换为显示坐标（特别是文字） */
  private _transformParams: TransformParams | null = null;
  /** INSERT递归深度计数器，用于防止无限递归 */
  private _insertDepth: number = 0;
  /** 当前正在加载的块名集合，用于检测循环引用 */
  private _visitedBlocks: Set<string> = new Set();
  /** 绘图管理器 */
  private _drawingManager: DrawingManager | null = null;
  /** 捕捉管理器 */
  private _snapManager: SnapManager | null = null;
  /** 绘图完成回调 */
  private _onDrawComplete?: (entityJson: string) => void;
  /** EntityRendererRegistry — 渐进式集成，可选注入 */
  private _entityRendererRegistry: EntityRendererRegistry | null = null;
  /** ToolRegistry — 渐进式集成，可选注入 */
  private _toolRegistry: ToolRegistry | null = null;

  // 捕捉回调暂时注释，等待捕捉功能完整集成
  // private _onSnapPointFound?: (snapPoint: any) => void;

  constructor(config: CadRendererConfig) {
    this._container = config.container;
    this._onEntityClick = config.onEntityClick;
    this._onSelectionChanged = config.onSelectionChanged;
    this._onCameraChanged = config.onCameraChanged;
    this._onCameraInteractionEnd = config.onCameraInteractionEnd;
    this._onEntityMoved = config.onEntityMoved;
    this._onEntityContextMenu = config.onEntityContextMenu;
    this._onDrawComplete = config.onDrawComplete;
    this._defaultLineColor = new THREE.Color(config.lineColor || '#4fc3f7');
    this._debugMode = config.debugMode || false;
    this._transparentBackground = config.transparentBackground || false;

    this._scene = new THREE.Scene();
    const bgColor = new THREE.Color(config.backgroundColor || '#1a1a2e');
    this._backgroundColor = bgColor;
    this._isDarkBackground = this._computeIsDark(bgColor);
    if (this._transparentBackground) {
      this._scene.background = null;
    } else {
      this._scene.background = bgColor;
    }
    this._sdfTextRenderer.addToScene(this._scene);
    this._sdfTextRenderer.onBboxesUpdated = (bboxes) => {
      for (const [id, bbox] of bboxes) {
        const node = this._nodeIndex.get(id);
        if (node) {
          node.bbox = { ...bbox };
        }
      }
    };

    const cw = config.container.clientWidth || 1;
    const ch = config.container.clientHeight || 1;
    this._canvasWidth = cw;
    this._canvasHeight = ch;
    this._resolution = new THREE.Vector2(cw * window.devicePixelRatio, ch * window.devicePixelRatio);
    this._batchedBuilder = new BatchedLayerBuilder(this._resolution);
    const aspect = cw / ch;
    const frustumSize = 1000;

    this._camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100000
    );
    this._camera.position.set(0, 0, 1000);
    this._camera.lookAt(0, 0, 0);

    this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: this._transparentBackground });
    this._renderer.setSize(cw, ch);
    this._renderer.setPixelRatio(window.devicePixelRatio);
    if (this._transparentBackground) {
      this._renderer.setClearColor(0x000000, 0);
    }
    config.container.appendChild(this._renderer.domElement);

    // Initialize GPU picking scene
    this._pickingScene = new THREE.Scene();
    this._pickingScene.background = new THREE.Color(0x000000);
    
    // Create picking camera (same as main camera)
    const aspect2 = cw / ch;
    const frustumSize2 = 1000;
    this._pickingCamera = new THREE.OrthographicCamera(
      -frustumSize2 * aspect2 / 2,
      frustumSize2 * aspect2 / 2,
      frustumSize2 / 2,
      -frustumSize2 / 2,
      0.1,
      100000
    );
    this._pickingCamera.position.set(0, 0, 1000);
    this._pickingCamera.lookAt(0, 0, 0);

    // Create render target for picking
    this._pickingTexture = new THREE.WebGLRenderTarget(
      cw,
      ch,
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      }
    );

    this._setupMouseInteraction();
    this._animate();
  }

  private _setupMouseInteraction(): void {
    const canvas = this._renderer.domElement;

    this._wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

      // 累积缩放因子，每帧只应用一次（防抖）
      this._wheelZoomFactor *= zoomFactor;

      const rect = this._renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this._wheelWorldX = this._camera.position.x + mouseX * (this._camera.right - this._camera.left) / 2;
      this._wheelWorldY = this._camera.position.y + mouseY * (this._camera.top - this._camera.bottom) / 2;

      if (!this._wheelPending) {
        this._wheelPending = true;
        requestAnimationFrame(() => {
          this._wheelPending = false;
          const zf = this._wheelZoomFactor;
          this._wheelZoomFactor = 1.0;

          if (zf === 1.0) return;

          // 防御：若相机已退化（left>=right 或 bottom>=top），
          // 直接自救恢复，不再执行缩放。
          if (this._camera.left >= this._camera.right ||
              this._camera.bottom >= this._camera.top) {
            this._fitToView();
            return;
          }

          const oldSpanX = this._camera.right - this._camera.left;
          const oldSpanY = this._camera.top - this._camera.bottom;

          // 防御：若 _initialSpan 未初始化，先从当前相机跨度计算
          if (this._initialSpan <= 0) {
            this._initialSpan = Math.max(oldSpanX, oldSpanY, 1.0);
          }

          let appliedZf = zf;

          // 钳位：确保缩放后 X/Y 跨度都在 [minSpan, maxSpan] 范围内
          const minSpan = this._initialSpan * this._MIN_SPAN_RATIO;
          const maxSpan = this._initialSpan * this._MAX_SPAN_RATIO;

          // 推导：
          //   newSpanX = oldSpanX * zf >= minSpan  →  zf >= minSpan / oldSpanX
          //   newSpanY = oldSpanY * zf >= minSpan  →  zf >= minSpan / oldSpanY
          //   取两者较大值：zf >= minSpan / Math.min(oldSpanX, oldSpanY)
          //   同理上限：zf <= maxSpan / Math.max(oldSpanX, oldSpanY)
          const minZf = minSpan / Math.min(oldSpanX, oldSpanY);
          const maxZf = maxSpan / Math.max(oldSpanX, oldSpanY);
          appliedZf = Math.max(minZf, Math.min(maxZf, zf));

          // 用钳位后的 appliedZf 计算新相机
          const newLeft = this._wheelWorldX + (this._camera.left - this._wheelWorldX) * appliedZf;
          const newRight = this._wheelWorldX + (this._camera.right - this._wheelWorldX) * appliedZf;
          const newTop = this._wheelWorldY + (this._camera.top - this._wheelWorldY) * appliedZf;
          const newBottom = this._wheelWorldY + (this._camera.bottom - this._wheelWorldY) * appliedZf;

          this._camera.left = newLeft;
          this._camera.right = newRight;
          this._camera.top = newTop;
          this._camera.bottom = newBottom;

          const currentSpan = Math.max(newRight - newLeft, newTop - newBottom);
          const zoomNear = Math.max(0.1, currentSpan / 10000);
          const zoomFar = Math.min(currentSpan * 10, zoomNear * 10000);
          this._camera.near = zoomNear;
          this._camera.far = Math.max(zoomFar, zoomNear * 10);

          this._camera.updateProjectionMatrix();
          this._requestRender();
          this._scheduleViewportCulling();
          this._emitCameraChanged();
          this._scheduleCameraInteractionEnd();
        });
      }
    };
    canvas.addEventListener('wheel', this._wheelHandler, { passive: false });

    this._contextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      if (this._interactionMode !== 'select') return;
      const hitId = this.pickEntityIdAt(e.clientX, e.clientY);
      if (hitId) {
        const layer = this._entityLayers.get(hitId) || '';
        this._onEntityContextMenu?.(hitId, layer, e.clientX, e.clientY);
      }
    };
    canvas.addEventListener('contextmenu', this._contextMenuHandler);

    this._mouseDownHandler = (e: MouseEvent) => {
      logger.info('CadRenderer', 'mousedown', { button: e.button, interactionMode: this._interactionMode, isPanning: this._isPanning });
      if (e.button === 2) return;

      // 处理绘图模式
      if (this._interactionMode === 'draw_line' || this._interactionMode === 'draw_circle' || this._interactionMode === 'draw_text') {
        if (e.button === 0 && this._drawingManager) {
          let wx: number, wy: number;
          if (this._lastSnapPoint) {
            wx = this._lastSnapPoint.x;
            wy = this._lastSnapPoint.y;
          } else {
            const worldCoord = this._clientToWorldCoord(e);
            wx = worldCoord.x;
            wy = worldCoord.y;
          }
          this._drawingManager.handleMouseDown(wx, wy);
        }
        return;
      }

      if (this._interactionMode === 'pan' || e.button === 1) {
        e.preventDefault();
        this._isPanning = true;
        this._panStart.set(e.clientX, e.clientY);
        this._cameraStart.set(this._camera.position.x, this._camera.position.y);
        this._attachDocumentPanListeners();
        this._updateCursor('grabbing');
        logger.info('CadRenderer', 'pan started', { clientX: e.clientX, clientY: e.clientY, cameraX: this._camera.position.x, cameraY: this._camera.position.y });
        return;
      }

      if (e.button === 0 && this._interactionMode === 'select') {
        const hitId = this.pickEntityIdAt(e.clientX, e.clientY);
        if (hitId) {
          const layer = this._entityLayers.get(hitId) || '';
          const layerNode = this._layerIndex.get(layer);
          if (layerNode?.locked) {
            e.preventDefault();
            this._isPanning = true;
            this._panStart.set(e.clientX, e.clientY);
            this._cameraStart.set(this._camera.position.x, this._camera.position.y);
            this._attachDocumentPanListeners();
            this._updateCursor('not-allowed');
            return;
          }
          if (!this._selectedEntityIds.has(hitId)) {
            this.selectEntity(hitId);
            this._onEntityClick?.(hitId, layer);
            this._onSelectionChanged?.(this.getSelectedEntityIds());
          }

          this._isDraggingEntity = true;
          this._dragEntityId = hitId;
          const worldCoord = this._clientToWorldCoord(e);
          this._dragStartWorld.set(worldCoord.x, worldCoord.y);
          this._prepareSelectedEntitiesForDrag();
          for (const selId of this._selectedEntityIds) {
            if (this._sdfTextRenderer.has(selId)) {
              this._sdfTextRenderer.startDrag(selId);
            }
          }
          this._updateCursor('grabbing');
        } else {
          this.deselectAll();
          this._onSelectionChanged?.([]);
          this._isBoxSelecting = true;
          this._boxSelectStart.set(e.clientX, e.clientY);
          this._boxSelectEnd.set(e.clientX, e.clientY);
          this._showBoxSelectOverlay(e.clientX, e.clientY);
          canvas.style.cursor = 'crosshair';
        }
      }
    };
    canvas.addEventListener('mousedown', this._mouseDownHandler);

    this._mouseMoveHandler = (e: MouseEvent) => {
      this._updateLastWorldCoord(e);

      this._handleSnap(e);

      if (this._drawingManager && (this._drawingManager.isDrawing() || this._drawingManager.isTextPlacing())) {
        const worldCoord = this._clientToWorldCoord(e);
        this._drawingManager.handleMouseMove(worldCoord.x, worldCoord.y);
        return;
      }

      if (this._isBoxSelecting) {
        this._boxSelectEnd.set(e.clientX, e.clientY);
        this._updateBoxSelectOverlay();
        return;
      }

      if (this._isDraggingEntity && this._dragEntityId) {
        const worldCoord = this._clientToWorldCoord(e);
        const dx = worldCoord.x - this._dragStartWorld.x;
        const dy = worldCoord.y - this._dragStartWorld.y;
        for (const selId of this._selectedEntityIds) {
          this._applyDragPreview(selId, dx, dy);
          if (this._sdfTextRenderer.has(selId)) {
            const node = this._nodeIndex.get(selId);
            if (node) {
              const baseX = (node as any).posX ?? 0;
              const baseY = (node as any).posY ?? 0;
              this._sdfTextRenderer.updateDragPosition(selId, baseX + dx, baseY + dy);
            }
          }
          const overlay = this._highlightOverlays.get(selId);
          const borderOverlay = this._highlightOverlays.get(selId + '__border');
          if (overlay) {
            overlay.position.x = dx;
            overlay.position.y = dy;
          }
          if (borderOverlay) {
            borderOverlay.position.x = dx;
            borderOverlay.position.y = dy;
          }
        }
        this._requestRender();
        return;
      }

      if (this._isPanning) {
        const dx = e.clientX - this._panStart.x;
        const dy = e.clientY - this._panStart.y;

        const renderRect = this._renderer.domElement.getBoundingClientRect();
        const worldDx = -dx * (this._camera.right - this._camera.left) / renderRect.width;
        const worldDy = dy * (this._camera.top - this._camera.bottom) / renderRect.height;

        this._camera.position.x = this._cameraStart.x + worldDx;
        this._camera.position.y = this._cameraStart.y + worldDy;
        this._camera.updateProjectionMatrix();
        this._requestRender();
        this._scheduleViewportCulling();
        this._emitCameraChanged();
        logger.info('CadRenderer', 'pan moving', { dx, dy, worldDx, worldDy, camX: this._camera.position.x, camY: this._camera.position.y });
        return;
      }

      if (this._interactionMode === 'select') {
        const hitId = this.pickEntityIdAt(e.clientX, e.clientY);
        if (hitId) {
          this._updateCursor(this._selectedEntityIds.has(hitId) ? 'move' : 'hover');
        } else {
          this._updateCursor();
        }
      }
    };
    canvas.addEventListener('mousemove', this._mouseMoveHandler);

    this._mouseUpHandler = (e: MouseEvent) => {
      if (this._isBoxSelecting) {
        this._isBoxSelecting = false;
        this._hideBoxSelectOverlay();
        const hoverId = this.pickEntityIdAt(e.clientX, e.clientY);
        if (hoverId && this._selectedEntityIds.has(hoverId)) {
          this._updateCursor('move');
        } else if (hoverId) {
          this._updateCursor('hover');
        } else {
          this._updateCursor();
        }

        const sx = Math.min(this._boxSelectStart.x, this._boxSelectEnd.x);
        const sy = Math.min(this._boxSelectStart.y, this._boxSelectEnd.y);
        const ex = Math.max(this._boxSelectStart.x, this._boxSelectEnd.x);
        const ey = Math.max(this._boxSelectStart.y, this._boxSelectEnd.y);

        if (ex - sx > 3 && ey - sy > 3) {
          const rect = this._renderer.domElement.getBoundingClientRect();
          const ndcMinX = ((sx - rect.left) / rect.width) * 2 - 1;
          const ndcMinY = -((ey - rect.top) / rect.height) * 2 + 1;
          const ndcMaxX = ((ex - rect.left) / rect.width) * 2 - 1;
          const ndcMaxY = -((sy - rect.top) / rect.height) * 2 + 1;
          const worldMinX = this._camera.position.x + ndcMinX * (this._camera.right - this._camera.left) / 2;
          const worldMinY = this._camera.position.y + ndcMinY * (this._camera.top - this._camera.bottom) / 2;
          const worldMaxX = this._camera.position.x + ndcMaxX * (this._camera.right - this._camera.left) / 2;
          const worldMaxY = this._camera.position.y + ndcMaxY * (this._camera.top - this._camera.bottom) / 2;
          this.selectEntitiesInRect(worldMinX, worldMinY, worldMaxX, worldMaxY);
          this._onSelectionChanged?.(this.getSelectedEntityIds());
        }
        return;
      }

      if (this._isDraggingEntity && this._dragEntityId) {
        const worldCoord = this._clientToWorldCoord(e);
        const dx = worldCoord.x - this._dragStartWorld.x;
        const dy = worldCoord.y - this._dragStartWorld.y;
        const significant = Math.abs(dx) > 2 || Math.abs(dy) > 2;

        if (significant) {
          for (const selId of this._selectedEntityIds) {
            const node = this._nodeIndex.get(selId);
            if (!node) continue;
            if (this._sdfTextRenderer.has(selId)) {
              this._sdfTextRenderer.endDrag(selId);
              this._translateNode(node, dx, dy);
              this._sdfTextRenderer.updatePosition(selId, (node as any).posX ?? 0, (node as any).posY ?? 0);
              this._addHighlightOverlay(selId);
            } else {
              this._translateNode(node, dx, dy);
              this._rebuildEntityMesh(selId);
            }
            this._onEntityMoved?.(selId, dx, dy);
          }
          this._dragLineSnapshots.clear();
          this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
          this._requestRender();
        } else {
          for (const selId of this._selectedEntityIds) {
            if (this._sdfTextRenderer.has(selId)) {
              this._sdfTextRenderer.endDrag(selId);
              const n = this._nodeIndex.get(selId);
              if (n) {
                this._sdfTextRenderer.updatePosition(selId, (n as any).posX ?? 0, (n as any).posY ?? 0);
              }
            }
            this._restoreDragPreview(selId);
            const overlay = this._highlightOverlays.get(selId);
            const borderOverlay = this._highlightOverlays.get(selId + '__border');
            if (overlay) { overlay.position.set(0, 0, 0); }
            if (borderOverlay) { borderOverlay.position.set(0, 0, 0); }
          }
          this._dragLineSnapshots.clear();
          this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
          this._requestRender();
        }

        this._isDraggingEntity = false;
        this._dragEntityId = null;
        const hoverId = this.pickEntityIdAt(e.clientX, e.clientY);
        if (hoverId && this._selectedEntityIds.has(hoverId)) {
          this._updateCursor('move');
        } else if (hoverId) {
          this._updateCursor('hover');
        } else {
          this._updateCursor();
        }
        return;
      }

      if (this._isPanning) {
        this._isPanning = false;
        this._detachDocumentPanListeners();
        this._emitCameraInteractionEnd();
        logger.info('CadRenderer', 'pan ended', { interactionMode: this._interactionMode });
        if (this._interactionMode === 'select') {
          const panHoverId = this.pickEntityIdAt(e.clientX, e.clientY);
          if (panHoverId && this._selectedEntityIds.has(panHoverId)) {
            this._updateCursor('move');
          } else if (panHoverId) {
            this._updateCursor('hover');
          } else {
            this._updateCursor();
          }
        } else {
          this._updateCursor();
        }
      }
    };
    canvas.addEventListener('mouseup', this._mouseUpHandler);

    this._documentPanMouseMoveHandler = (e: MouseEvent) => {
      if (!this._isPanning) return;
      e.preventDefault();
      e.stopPropagation();
      this._mouseMoveHandler(e);
    };

    this._documentPanMouseUpHandler = (e: MouseEvent) => {
      if (!this._isPanning) return;
      e.preventDefault();
      e.stopPropagation();
      this._mouseUpHandler(e);
    };

    this._mouseLeaveHandler = () => {
      if (this._isDraggingEntity && this._dragEntityId) {
        const dx = this._lastWorldX - this._dragStartWorld.x;
        const dy = this._lastWorldY - this._dragStartWorld.y;
        const significant = Math.abs(dx) > 2 || Math.abs(dy) > 2;

        if (significant) {
          for (const selId of this._selectedEntityIds) {
            const node = this._nodeIndex.get(selId);
            if (!node) continue;
            if (this._sdfTextRenderer.has(selId)) {
              this._sdfTextRenderer.endDrag(selId);
              this._translateNode(node, dx, dy);
              this._sdfTextRenderer.updatePosition(selId, (node as any).posX ?? 0, (node as any).posY ?? 0);
              this._addHighlightOverlay(selId);
            } else {
              this._translateNode(node, dx, dy);
              this._rebuildEntityMesh(selId);
            }
            this._onEntityMoved?.(selId, dx, dy);
          }
          this._dragLineSnapshots.clear();
          this._batchedBuilder.rebuildAll(this._scene);
          this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
          this._requestRender();
        } else {
          for (const selId of this._selectedEntityIds) {
            if (this._sdfTextRenderer.has(selId)) {
              this._sdfTextRenderer.endDrag(selId);
              const n = this._nodeIndex.get(selId);
              if (n) {
                this._sdfTextRenderer.updatePosition(selId, (n as any).posX ?? 0, (n as any).posY ?? 0);
              }
            }
            this._restoreDragPreview(selId);
            const overlay = this._highlightOverlays.get(selId);
            const borderOverlay = this._highlightOverlays.get(selId + '__border');
            if (overlay) { overlay.position.set(0, 0, 0); }
            if (borderOverlay) { borderOverlay.position.set(0, 0, 0); }
          }
          this._dragLineSnapshots.clear();
          this._batchedBuilder.rebuildAll(this._scene);
          this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
          this._requestRender();
        }

        this._isDraggingEntity = false;
        this._dragEntityId = null;
        this._requestRender();
      }
      if (this._isBoxSelecting) {
        this._isBoxSelecting = false;
        this._hideBoxSelectOverlay();
      }
      if (this._isPanning && this._documentPanListenersAttached) {
        return;
      }
      if (this._isPanning && !this._documentPanListenersAttached) {
        this._isPanning = false;
        this._emitCameraInteractionEnd();
      }
      this._updateCursor();
    };
    canvas.addEventListener('mouseleave', this._mouseLeaveHandler);

    // 添加键盘事件处理（ESC取消绘图）
    this._keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this._drawingManager && (this._drawingManager.isDrawing() || this._drawingManager.isTextPlacing())) {
          this._drawingManager.cancelDrawing();
          this._removeDrawPreview();
        }
      }
    };
    document.addEventListener('keydown', this._keyDownHandler);
  }

  private _showBoxSelectOverlay(startX: number, startY: number): void {
    if (!this._boxSelectOverlay) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;border:1px dashed #4fc3f7;background:rgba(79,195,247,0.1);pointer-events:none;z-index:1000;display:none;';
      this._container.style.position = 'relative';
      this._container.appendChild(overlay);
      this._boxSelectOverlay = overlay;
    }
    const rect = this._container.getBoundingClientRect();
    this._boxSelectOverlay.style.left = `${startX - rect.left}px`;
    this._boxSelectOverlay.style.top = `${startY - rect.top}px`;
    this._boxSelectOverlay.style.width = '0px';
    this._boxSelectOverlay.style.height = '0px';
    this._boxSelectOverlay.style.display = 'block';
  }

  private _updateBoxSelectOverlay(): void {
    if (!this._boxSelectOverlay) return;
    const rect = this._container.getBoundingClientRect();
    const x1 = Math.min(this._boxSelectStart.x, this._boxSelectEnd.x) - rect.left;
    const y1 = Math.min(this._boxSelectStart.y, this._boxSelectEnd.y) - rect.top;
    const x2 = Math.max(this._boxSelectStart.x, this._boxSelectEnd.x) - rect.left;
    const y2 = Math.max(this._boxSelectStart.y, this._boxSelectEnd.y) - rect.top;
    this._boxSelectOverlay.style.left = `${x1}px`;
    this._boxSelectOverlay.style.top = `${y1}px`;
    this._boxSelectOverlay.style.width = `${x2 - x1}px`;
    this._boxSelectOverlay.style.height = `${y2 - y1}px`;
  }

  private _hideBoxSelectOverlay(): void {
    if (this._boxSelectOverlay) {
      this._boxSelectOverlay.style.display = 'none';
    }
  }

  private _clientToWorldCoord(e: MouseEvent): { x: number; y: number } {
    const rect = this._renderer.domElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const worldX = this._camera.position.x + ndcX * (this._camera.right - this._camera.left) / 2;
    const worldY = this._camera.position.y + ndcY * (this._camera.top - this._camera.bottom) / 2;
    return { x: worldX, y: worldY };
  }

  setInteractionMode(mode: 'select' | 'pan' | 'draw_line' | 'draw_circle' | 'draw_text'): void {
    if (mode !== this._interactionMode) {
      this.deselectAll();
      this._onSelectionChanged?.([]);
    }
    this._interactionMode = mode;
    
    // 如果切换到绘图模式，初始化绘图管理器
    if (mode === 'draw_line' || mode === 'draw_circle' || mode === 'draw_text') {
      if (!this._drawingManager) {
        this._drawingManager = new DrawingManager();
        this._drawingManager.setScene(this._scene);
        this._drawingManager.setOnDrawComplete((entityJson: string) => {
          this._onDrawComplete?.(entityJson);
        });
        this._drawingManager.setOnDrawPreview((preview) => {
          this._updateDrawPreview(preview);
        });
      }
      this._drawingManager.startDrawing(mode);
      this._updateCursor();
    } else {
      // 如果正在绘图，取消
      if (this._drawingManager) {
        this._drawingManager.cancelDrawing();
      }
      this._updateCursor();
    }
  }

  getInteractionMode(): 'select' | 'pan' | 'draw_line' | 'draw_circle' | 'draw_text' {
    return this._interactionMode;
  }

  setTextDrawParams(params: { content: string; height: number; layer: string; color: number }): void {
    if (this._drawingManager) {
      this._drawingManager.setTextParams(params);
    }
  }

  setOnDrawComplete(callback: (entityJson: string) => void): void {
    this._onDrawComplete = callback;
  }

  // 捕捉回调暂时注释，等待捕捉功能完整集成
  // setOnSnapPointFound(callback: (snapPoint: any) => void): void {
  //   this._onSnapPointFound = callback;
  // }

  private _updateDrawPreview(_preview: any): void {
    // 这里可以更新状态栏显示坐标等信息
    // 预览已由 DrawingManager 处理
  }

  private _removeDrawPreview(): void {
    // 清除预览（已由 DrawingManager 处理）
  }

  /** 初始化捕捉管理器 */
  initSnapManager(settings?: any): void {
    if (!this._snapManager) {
      this._snapManager = new SnapManager(settings);
    }
  }

  /** 启用/禁用捕捉类型 */
  setSnapEnabled(type: string, enabled: boolean): void {
    if (!this._snapManager) {
      this._snapManager = new SnapManager();
    }
    if (enabled) {
      this._snapManager.enableSnap(type);
    } else {
      this._snapManager.disableSnap(type);
    }
  }

  getSnapManager(): SnapManager | null {
    return this._snapManager;
  }

  /** 把鼠标 client 坐标换算成世界坐标，写到 _lastWorldX/Y。 */
  private _updateLastWorldCoord(e: MouseEvent): void {
    const rect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._lastWorldX = this._camera.position.x + ndcX * (this._camera.right - this._camera.left) / 2;
    this._lastWorldY = this._camera.position.y + ndcY * (this._camera.top - this._camera.bottom) / 2;
  }

  private _snapMarker: THREE.Object3D | null = null;
  private _lastSnapPoint: { x: number; y: number } | null = null;

  private _handleSnap(e: MouseEvent): void {
    if (!this._snapManager) return;
    this._snapManager.setNodeIndex(this._nodeIndex);
    this._snapManager.setEntityLayers(this._entityLayers);
    this._snapManager.setHiddenLayers(this._logicallyHidden);

    const rect = this._renderer.domElement.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const snapPoint = this._snapManager.findSnapPoint(
      canvasX, canvasY,
      this._camera,
      rect.width, rect.height
    );

    this._clearSnapMarker();

    if (snapPoint) {
      this._lastSnapPoint = { x: snapPoint.x, y: snapPoint.y };
      this._showSnapMarker(snapPoint.x, snapPoint.y, snapPoint.type);
    } else {
      this._lastSnapPoint = null;
    }
  }

  private _showSnapMarker(worldX: number, worldY: number, type: string): void {
    if (!this._scene) return;
    const size = (this._camera.right - this._camera.left) / this._canvasWidth * 8;
    const color = type === 'endpoint' ? 0x00ff00 : type === 'midpoint' ? 0x00ffff : 0xff00ff;
    const geometry = new THREE.BufferGeometry();
    const verts: number[] = [];
    if (type === 'endpoint') {
      verts.push(worldX - size, worldY, 0.1, worldX + size, worldY, 0.1);
      verts.push(worldX, worldY - size, 0.1, worldX, worldY + size, 0.1);
    } else if (type === 'midpoint') {
      verts.push(worldX - size, worldY - size, 0.1, worldX + size, worldY + size, 0.1);
      verts.push(worldX + size, worldY - size, 0.1, worldX - size, worldY + size, 0.1);
    } else {
      const segs = 16;
      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2;
        const a2 = ((i + 1) / segs) * Math.PI * 2;
        verts.push(worldX + Math.cos(a1) * size, worldY + Math.sin(a1) * size, 0.1);
        verts.push(worldX + Math.cos(a2) * size, worldY + Math.sin(a2) * size, 0.1);
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    const material = new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false });
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = 9999;
    this._scene.add(lines);
    this._snapMarker = lines;
    this._requestRender();
  }

  private _clearSnapMarker(): void {
    if (this._snapMarker && this._scene) {
      this._scene.remove(this._snapMarker);
      this._disposeObject3D(this._snapMarker);
      this._snapMarker = null;
    }
  }

  getSnapWorldPoint(): { x: number; y: number } | null {
    return this._lastSnapPoint;
  }

  /** 当前光标处的世界坐标（cadbin 状态栏读取） */
  getLastWorldCoord(): { x: number; y: number } {
    return { x: this._lastWorldX, y: this._lastWorldY };
  }

  /** 当前相机视图信息（中心 + 视野尺寸 + 等效 zoom）；状态栏 / fit-to-view 联动用。 */
  getCameraInfo(): CameraInfo {
    const worldWidth = this._camera.right - this._camera.left;
    const worldHeight = this._camera.top - this._camera.bottom;
    const baseSize = Math.max(this._canvasWidth, this._canvasHeight);
    const zoom = baseSize > 0 ? baseSize / Math.max(1e-6, Math.max(worldWidth, worldHeight)) : 1;
    return {
      centerX: this._camera.position.x,
      centerY: this._camera.position.y,
      worldWidth,
      worldHeight,
      zoom,
    };
  }

  private _emitCameraChanged(): void {
    if (!this._onCameraChanged) return;
    const now = performance.now();
    if (now - this._lastCameraEmit < 50) return; // 20Hz 节流
    this._lastCameraEmit = now;
    this._onCameraChanged(this.getCameraInfo());
  }

  private _emitCameraInteractionEnd(): void {
    this._onCameraInteractionEnd?.(this.getCameraInfo());
  }

  private _scheduleCameraInteractionEnd(): void {
    if (this._cameraInteractionEndTimer !== null) {
      clearTimeout(this._cameraInteractionEndTimer);
    }
    this._cameraInteractionEndTimer = setTimeout(() => {
      this._cameraInteractionEndTimer = null;
      this._emitCameraInteractionEnd();
    }, 350);
  }

  private _attachDocumentPanListeners(): void {
    if (this._documentPanListenersAttached) return;
    document.addEventListener('mousemove', this._documentPanMouseMoveHandler, true);
    document.addEventListener('mouseup', this._documentPanMouseUpHandler, true);
    this._documentPanListenersAttached = true;
  }

  private _detachDocumentPanListeners(): void {
    if (!this._documentPanListenersAttached) return;
    document.removeEventListener('mousemove', this._documentPanMouseMoveHandler, true);
    document.removeEventListener('mouseup', this._documentPanMouseUpHandler, true);
    this._documentPanListenersAttached = false;
  }

  /**
   * 视口裁剪：当前 frustum 之外的 mesh 直接 visible=false，省 GPU draw call。
   * 注意：被图层显隐 / 被锁定影响的 mesh 这里只在 frustum 命中时才显示，
   * 真正"不可显示"用 `_logicallyHidden` 集合再 mask 一层，避免被这里反向打开。
   */
  private _scheduleViewportCulling(): void {
    if (this._cullingScheduled) return;
    this._cullingScheduled = true;
    const now = performance.now();
    const elapsed = now - (this._lastCullingTime || 0);
    const delay = elapsed < 50 ? (50 - elapsed) : 0;
    setTimeout(() => {
      this._cullingScheduled = false;
      this._lastCullingTime = performance.now();
      this._applyViewportCulling();
    }, delay);
  }

  private _applyViewportCulling(): void {
    if (this._entityMeshes.size === 0 && this._batchedBuilder.getEntityCount() === 0 && this._sdfTextRenderer.size === 0) return;
    
    // 验证相机参数的有效性
    if (!this._isValidNumber(this._camera.left) || !this._isValidNumber(this._camera.right) ||
        !this._isValidNumber(this._camera.bottom) || !this._isValidNumber(this._camera.top) ||
        !this._isValidNumber(this._camera.position.x) || !this._isValidNumber(this._camera.position.y)) {
      logger.warn('CadRenderer', '_applyViewportCulling: invalid camera parameters');
      return;
    }

    const viewMinX = this._camera.left + this._camera.position.x;
    const viewMaxX = this._camera.right + this._camera.position.x;
    const viewMinY = this._camera.bottom + this._camera.position.y;
    const viewMaxY = this._camera.top + this._camera.position.y;

    // 边界检查：防止极端缩放导致数值问题
    const viewW = viewMaxX - viewMinX;
    const viewH = viewMaxY - viewMinY;
    
    if (!this._isValidNumber(viewW) || !this._isValidNumber(viewH) || viewW <= 0 || viewH <= 0) {
      logger.warn('CadRenderer', '_applyViewportCulling: invalid view dimensions', { viewW, viewH });
      return;
    }

    // 限制 margin 的计算，避免极端缩放时 margin 过大或过小
    const rawMargin = Math.max(viewW, viewH) * 0.02;
    const MIN_MARGIN = 0.001;
    const MAX_MARGIN = Math.max(viewW, viewH) * 0.5;  // margin 不超过视图的一半
    const margin = Math.max(MIN_MARGIN, Math.min(MAX_MARGIN, rawMargin));
    
    const extMinX = viewMinX - margin;
    const extMaxX = viewMaxX + margin;
    const extMinY = viewMinY - margin;
    const extMaxY = viewMaxY + margin;

    // 验证扩展边界的有效性
    if (!this._isValidNumber(extMinX) || !this._isValidNumber(extMaxX) ||
        !this._isValidNumber(extMinY) || !this._isValidNumber(extMaxY)) {
      logger.warn('CadRenderer', '_applyViewportCulling: invalid extended bounds');
      return;
    }

    const visibleInSpatial = this._spatialIndex.queryRect(extMinX, extMinY, extMaxX, extMaxY);
    const visibleSet = new Set<string>(visibleInSpatial);

    let changed = false;
    for (const [id, mesh] of this._entityMeshes) {
      if (this._logicallyHidden.has(id)) {
        if (mesh.visible) { mesh.visible = false; changed = true; }
        continue;
      }
      const layerName = this._entityLayers.get(id);
      if (layerName && this._hiddenLayers.has(layerName)) {
        if (mesh.visible) { mesh.visible = false; changed = true; }
        continue;
      }
      const shouldShow = visibleSet.has(id) || !this._spatialIndex.hasEntity(id);
      if (mesh.visible !== shouldShow) {
        mesh.visible = shouldShow;
        changed = true;
      }
    }

    const batchedChanged = this._batchedBuilder.applyCulling(visibleSet);
    if (batchedChanged) {
      this._batchedBuilder.rebuildCulled();
      changed = true;
    }

    if (this._useBatchedText) {
      const textChanged = this._sdfTextRenderer.applyCulling(extMinX, extMinY, extMaxX, extMaxY, this._hiddenLayers, this._logicallyHidden);
      if (textChanged) {
        this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
        changed = true;
      }
    }

    if (changed) {
      this._requestRender();
    }
  }

  private _offsetLinePositions(positions: number[], dx: number, dy: number): number[] {
    const out = new Array<number>(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      out[i] = positions[i] + dx;
      out[i + 1] = positions[i + 1] + dy;
      out[i + 2] = positions[i + 2] ?? 0;
    }
    return out;
  }

  /** 从图层组中移除同一 entityId 的重复 mesh（保留 primary 可选） */
  private _removeDuplicateEntityMeshes(entityId: string, keep?: THREE.Object3D | null): void {
    const layerName = this._entityLayers.get(entityId);
    if (!layerName) return;
    const layerGroup = this._layerGroups.get(layerName);
    if (!layerGroup) return;
    const stale: THREE.Object3D[] = [];
    layerGroup.traverse((child) => {
      if (child.userData.__entityId === entityId && child !== keep) {
        stale.push(child);
      }
    });
    for (const obj of stale) {
      obj.parent?.remove(obj);
      this._disposeObject3D(obj, false);
    }
  }

  private _disposeTrackedEntityMesh(entityId: string): void {
    const mesh = this._entityMeshes.get(entityId);
    if (!mesh) return;
    this._removeNodeFromLayerGroup(entityId);
    mesh.parent?.remove(mesh);
    this._disposeObject3D(mesh, false);
    this._entityMeshes.delete(entityId);
    this._individualEntities.delete(entityId);
  }

  private _prepareSelectedEntitiesForDrag(): void {
    this._dragLineSnapshots.clear();
    for (const entityId of this._selectedEntityIds) {
      if (this._sdfTextRenderer.has(entityId)) continue;

      if (this._useBatchedRendering && this._batchedBuilder.hasEntity(entityId)) {
        this._extractFromBatch(entityId);
      } else {
        this._removeDuplicateEntityMeshes(entityId, this._entityMeshes.get(entityId) ?? null);
      }

      const node = this._nodeIndex.get(entityId);
      const mesh = this._entityMeshes.get(entityId);
      if (!node || !mesh) continue;

      mesh.position.set(0, 0, 0);
      const positions = this._extractLinePositions(node);
      if (positions && mesh instanceof Line2) {
        this._dragLineSnapshots.set(entityId, positions);
      }
    }
    if (this._useBatchedRendering) {
      this._batchedBuilder.rebuildDirty(this._scene);
      this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
    }
    this._requestRender();
  }

  private _applyDragPreview(entityId: string, dx: number, dy: number): void {
    const snapshot = this._dragLineSnapshots.get(entityId);
    const mesh = this._entityMeshes.get(entityId);
    if (snapshot && mesh instanceof Line2) {
      mesh.position.set(0, 0, 0);
      mesh.geometry.setPositions(this._offsetLinePositions(snapshot, dx, dy));
      mesh.computeLineDistances();
      return;
    }
    if (mesh) {
      mesh.position.set(dx, dy, 0);
    }
  }

  private _restoreDragPreview(entityId: string): void {
    const snapshot = this._dragLineSnapshots.get(entityId);
    const mesh = this._entityMeshes.get(entityId);
    if (snapshot && mesh instanceof Line2) {
      mesh.position.set(0, 0, 0);
      mesh.geometry.setPositions(snapshot);
      mesh.computeLineDistances();
      return;
    }
    if (mesh) {
      mesh.position.set(0, 0, 0);
    }
  }

  private _extractFromBatch(entityId: string): void {
    if (!this._batchedBuilder.hasEntity(entityId)) return;
    this._batchedBuilder.removeEntity(entityId, this._scene);
    this._spatialIndex.removeEntity(entityId);
    this._disposeTrackedEntityMesh(entityId);
    this._removeDuplicateEntityMeshes(entityId);
    const node = this._nodeIndex.get(entityId);
    if (!node) {
      this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
      return;
    }
    const mesh = this._createSceneNodeMesh(node);
    if (mesh && this._validateObject3D(mesh)) {
      const layerName = this._entityLayers.get(entityId) || node.layer;
      const layerGroup = this._layerGroups.get(layerName);
      if (layerGroup) {
        const placeholder = this._placeholderMap.get(entityId);
        if (placeholder) {
          layerGroup.remove(placeholder);
          this._disposeObject3D(placeholder);
          this._placeholderMap.delete(entityId);
        }
      }
      this._entityMeshes.set(entityId, mesh);
      this._individualEntities.add(entityId);
      this._addEntityToSpatialIndex(entityId, node);
      if (this._logicallyHidden.has(entityId) || this._hiddenLayers.has(node.layer)) {
        mesh.visible = false;
      }
      this._addNodeToLayerGroup(node.layer, mesh, entityId);
    }
    this._batchedBuilder.rebuildDirty(this._scene);
    this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
  }

  private _mergeBackToBatch(entityId: string): void {
    if (!this._useBatchedRendering) return;
    const node = this._nodeIndex.get(entityId);
    if (!node || !this._isBatchableType(node.type)) return;

    if (this._batchedBuilder.hasEntity(entityId)) {
      this._batchedBuilder.removeEntity(entityId, this._scene);
    }
    this._disposeTrackedEntityMesh(entityId);
    this._removeDuplicateEntityMeshes(entityId);
    this._spatialIndex.removeEntity(entityId);

    const positions = this._extractLinePositions(node);
    if (positions && positions.length >= 6) {
      const color = this._resolveColor(node.color, node.layer);
      const rawLw = (node as { lineWeight?: number }).lineWeight;
      const lineWidth = (rawLw !== undefined && Number.isFinite(rawLw) && rawLw > 0)
        ? Math.max(1, Math.min(rawLw * 1.5, 5))
        : DEFAULT_LINE_WIDTH;
      this._batchedBuilder.addLineSegments(entityId, node.layer, color, lineWidth, positions, this._scene);
      if (!this._spatialIndex.hasEntity(entityId)) {
        this._addSegmentsToSpatialIndex(entityId, positions);
      }
      this._registerEntityInLayer(node.layer, entityId);
      this._batchedBuilder.rebuildDirty(this._scene);
      this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
    }
  }

  selectEntity(entityId: string, additive: boolean = false): void {
    if (!additive) {
      this.deselectAll();
    }

    if (this._selectedEntityIds.has(entityId)) return;

    this._selectedEntityIds.add(entityId);

    const isSdfText = this._sdfTextRenderer.has(entityId);
    if (isSdfText) {
      this._addHighlightOverlay(entityId);
    } else {
      const isBatched = this._batchedBuilder.hasEntity(entityId);
      if (isBatched) {
        this._extractFromBatch(entityId);
      }
      const mesh = this._entityMeshes.get(entityId);
      if (mesh) {
        this._applyHighlightMaterial(entityId, mesh);
      }
    }

    this._requestRender();
  }

  private _applyHighlightMaterial(entityId: string, mesh: THREE.Object3D): void {
    const matMap = new Map<string, THREE.Material | LineMaterial>();
    mesh.traverse((child) => {
      if (child instanceof Line2) {
        const mat = child.material as LineMaterial;
        matMap.set(child.uuid, mat);
        const highlightMat = new LineMaterial({
          color: HIGHLIGHT_COLOR.getHex(),
          linewidth: mat.linewidth + 1,
          resolution: this._resolution,
          worldUnits: false,
        });
        child.material = highlightMat;
      } else if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
        const mat = child.material as THREE.Material;
        matMap.set(child.uuid, mat);
        const highlightMat = mat.clone();
        if ('color' in highlightMat) {
          (highlightMat as any).color = HIGHLIGHT_COLOR.clone();
        }
        child.material = highlightMat;
      }
    });
    this._selectedOriginalMaterials.set(entityId, matMap);
  }

  private _addHighlightOverlay(entityId: string): void {
    this._removeHighlightOverlay(entityId);

    let bbox = this._spatialIndex.getEntityBbox(entityId);
    if (!bbox) {
      const node = this._nodeIndex.get(entityId);
      if (node?.bbox) bbox = node.bbox;
    }
    if (!bbox) return;
    const { minX, minY, maxX, maxY } = bbox;
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 && h <= 0) return;
    const pad = Math.max(w, h) * 0.03;
    const x0 = minX - pad, y0 = minY - pad, x1 = maxX + pad, y1 = maxY + pad;

    const fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      x0, y0, -1, x1, y0, -1, x0, y1, -1,
      x1, y0, -1, x1, y1, -1, x0, y1, -1,
    ]), 3));
    const fillMat = new THREE.MeshBasicMaterial({
      color: HIGHLIGHT_COLOR.getHex(),
      transparent: true,
      opacity: 0.12,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.renderOrder = 0;
    fill.userData.__highlightOverlay = entityId;
    this._scene.add(fill);
    this._highlightOverlays.set(entityId, fill);

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      x0, y0, -0.5, x1, y0, -0.5,
      x1, y0, -0.5, x1, y1, -0.5,
      x1, y1, -0.5, x0, y1, -0.5,
      x0, y1, -0.5, x0, y0, -0.5,
    ]), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: HIGHLIGHT_COLOR.getHex(), linewidth: 2, depthTest: false, depthWrite: false });
    const line = new THREE.LineSegments(lineGeo, lineMat);
    line.renderOrder = 0;
    line.userData.__highlightOverlay = entityId;
    line.userData.__highlightBorder = true;
    this._scene.add(line);
    this._highlightOverlays.set(entityId + '__border', line);
  }

  private _removeHighlightOverlay(entityId: string): void {
    const keys = [entityId, entityId + '__border'];
    for (const key of keys) {
      const overlay = this._highlightOverlays.get(key);
      if (overlay) {
        this._scene.remove(overlay);
        if (overlay instanceof THREE.Mesh) {
          overlay.geometry.dispose();
          if (overlay.material instanceof THREE.Material) overlay.material.dispose();
        } else if (overlay instanceof THREE.LineSegments || overlay instanceof THREE.Line) {
          overlay.geometry.dispose();
          (overlay.material as THREE.Material).dispose();
        }
        this._highlightOverlays.delete(key);
      }
    }
  }

  deselectEntity(entityId: string): void {
    if (!this._selectedEntityIds.has(entityId)) return;

    this._removeHighlightOverlay(entityId);

    const matMap = this._selectedOriginalMaterials.get(entityId);
    const mesh = this._entityMeshes.get(entityId);
    if (mesh && matMap) {
      mesh.traverse((child) => {
        if (matMap.has(child.uuid)) {
          const originalMat = matMap.get(child.uuid)!;
          if (child instanceof Line2) {
            child.material.dispose();
            child.material = originalMat as LineMaterial;
          } else if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
            child.material.dispose();
            child.material = originalMat as THREE.Material;
          }
        }
      });
    }

    this._selectedEntityIds.delete(entityId);
    this._selectedOriginalMaterials.delete(entityId);

    this._mergeBackToBatch(entityId);

    this._requestRender();
  }

  deselectAll(): void {
    for (const entityId of this._selectedEntityIds) {
      this._removeHighlightOverlay(entityId);
    }

    const ids = Array.from(this._selectedEntityIds);
    for (const entityId of ids) {
      const matMap = this._selectedOriginalMaterials.get(entityId);
      const mesh = this._entityMeshes.get(entityId);
      if (mesh && matMap) {
        mesh.traverse((child) => {
          if (matMap.has(child.uuid)) {
            const originalMat = matMap.get(child.uuid)!;
            if (child instanceof Line2) {
              child.material.dispose();
              child.material = originalMat as LineMaterial;
            } else if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
              child.material.dispose();
              child.material = originalMat as THREE.Material;
            }
          }
        });
      }
    }
    this._selectedEntityIds.clear();
    this._selectedOriginalMaterials.clear();

    for (const entityId of ids) {
      this._mergeBackToBatch(entityId);
    }

    this._requestRender();
  }

  getSelectedEntityIds(): string[] {
    return Array.from(this._selectedEntityIds);
  }

  getSelectedEntityId(): string | null {
    const ids = this.getSelectedEntityIds();
    return ids.length === 1 ? ids[0] : (ids.length === 0 ? null : ids[0]);
  }

  selectEntitiesInRect(minX: number, minY: number, maxX: number, maxY: number, additive: boolean = false): string[] {
    if (!additive) this.deselectAll();

    const rect = {
      minX: Math.min(minX, maxX),
      minY: Math.min(minY, maxY),
      maxX: Math.max(minX, maxX),
      maxY: Math.max(minY, maxY),
    };
    const selected: string[] = [];

    const spatialCandidates = this._spatialIndex.queryRect(rect.minX, rect.minY, rect.maxX, rect.maxY);
    const candidateSet = new Set(spatialCandidates);

    for (const [id, node] of this._nodeIndex) {
      if (!candidateSet.has(id)) {
        if (!this._bboxIntersectsRect(node.bbox, rect)) continue;
      }
      if (this._selectedEntityIds.has(id)) continue;
      if (this._logicallyHidden.has(id)) continue;
      if (this._selectionRectHitsNode(rect, node)) {
        this.selectEntity(id, true);
        selected.push(id);
      }
    }

    if (selected.length > 0) {
      this._onSelectionChanged?.(this.getSelectedEntityIds());
    }
    return selected;
  }

  private _selectionRectHitsNode(rect: BoundingBox, node: SceneNode): boolean {
    if (!this._bboxIntersectsRect(node.bbox, rect)) return false;

    switch (node.type) {
      case 'line':
        return this._segmentIntersectsRect(node.startX, node.startY, node.endX, node.endY, rect);
      case 'polyline':
        return this._polylineIntersectsRect(
          node.vertices.map(v => ({ x: v.x, y: v.y })),
          node.closed,
          rect,
        );
      case 'lwPolyline':
        return this._polylineIntersectsRect(node.vertices, node.closed, rect);
      case 'spline': {
        const points = node.fitPoints.length > 0 ? node.fitPoints : node.controlPoints;
        return this._polylineIntersectsRect(
          points.map(p => ({ x: p.x, y: p.y })),
          false,
          rect,
        );
      }
      default:
        return true;
    }
  }

  private _bboxIntersectsRect(bb: BoundingBox, rect: BoundingBox): boolean {
    return bb.minX <= rect.maxX && bb.maxX >= rect.minX && bb.minY <= rect.maxY && bb.maxY >= rect.minY;
  }

  private _pointInRect(x: number, y: number, rect: BoundingBox): boolean {
    return x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
  }

  private _polylineIntersectsRect(points: Array<{ x: number; y: number }>, closed: boolean, rect: BoundingBox): boolean {
    if (points.length === 0) return false;
    if (points.some(p => this._pointInRect(p.x, p.y, rect))) return true;

    const segmentCount = closed ? points.length : points.length - 1;
    for (let i = 0; i < segmentCount; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (this._segmentIntersectsRect(a.x, a.y, b.x, b.y, rect)) return true;
    }
    return false;
  }

  private _segmentIntersectsRect(x1: number, y1: number, x2: number, y2: number, rect: BoundingBox): boolean {
    if (this._pointInRect(x1, y1, rect) || this._pointInRect(x2, y2, rect)) return true;

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    if (maxX < rect.minX || minX > rect.maxX || maxY < rect.minY || minY > rect.maxY) {
      return false;
    }

    return this._segmentsIntersect(x1, y1, x2, y2, rect.minX, rect.minY, rect.maxX, rect.minY)
      || this._segmentsIntersect(x1, y1, x2, y2, rect.maxX, rect.minY, rect.maxX, rect.maxY)
      || this._segmentsIntersect(x1, y1, x2, y2, rect.maxX, rect.maxY, rect.minX, rect.maxY)
      || this._segmentsIntersect(x1, y1, x2, y2, rect.minX, rect.maxY, rect.minX, rect.minY);
  }

  private _segmentsIntersect(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number,
  ): boolean {
    const orient = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
      (qx - px) * (ry - py) - (qy - py) * (rx - px);
    const onSegment = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
      Math.min(px, rx) - 1e-9 <= qx && qx <= Math.max(px, rx) + 1e-9
      && Math.min(py, ry) - 1e-9 <= qy && qy <= Math.max(py, ry) + 1e-9;

    const o1 = orient(ax, ay, bx, by, cx, cy);
    const o2 = orient(ax, ay, bx, by, dx, dy);
    const o3 = orient(cx, cy, dx, dy, ax, ay);
    const o4 = orient(cx, cy, dx, dy, bx, by);

    if (Math.abs(o1) < 1e-9 && onSegment(ax, ay, cx, cy, bx, by)) return true;
    if (Math.abs(o2) < 1e-9 && onSegment(ax, ay, dx, dy, bx, by)) return true;
    if (Math.abs(o3) < 1e-9 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
    if (Math.abs(o4) < 1e-9 && onSegment(cx, cy, bx, by, dx, dy)) return true;

    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
  }

  private _isValidNumber(value: number): boolean {
    return Number.isFinite(value) && !Number.isNaN(value);
  }

  private _isValidPoint(point: CadPoint): boolean {
    return this._isValidNumber(point.x) && this._isValidNumber(point.y) && this._isValidNumber(point.z);
  }

  private _expandDegenerateBbox(node: SceneNode): void {
    const bb = node.bbox;
    const dx = bb.maxX - bb.minX;
    const dy = bb.maxY - bb.minY;
    const minSize = 2.0;
    if (dx < minSize) {
      const cx = (bb.minX + bb.maxX) / 2;
      bb.minX = cx - minSize / 2;
      bb.maxX = cx + minSize / 2;
    }
    if (dy < minSize) {
      const cy = (bb.minY + bb.maxY) / 2;
      bb.minY = cy - minSize / 2;
      bb.maxY = cy + minSize / 2;
    }
  }

  private _isValidVector3(v: THREE.Vector3): boolean {
    return this._isValidNumber(v.x) && this._isValidNumber(v.y) && this._isValidNumber(v.z);
  }

  private _createLineMaterial(color: THREE.Color, lineWidth: number = DEFAULT_LINE_WIDTH): LineMaterial {
    const key = `${color.getHex()}_${lineWidth}`;
    const cached = this._lineMaterialCache.get(key);
    if (cached && !(cached as any).disposed) return cached;
    if (cached) this._lineMaterialCache.delete(key);

    const material = new LineMaterial({
      color: color.getHex(),
      linewidth: lineWidth,
      resolution: this._resolution,
      worldUnits: false,
    });

    // 缓存大小限制：超过限制时移除最老的条目
    if (this._lineMaterialCache.size >= CadRenderer.MAX_MATERIAL_CACHE_SIZE) {
      const oldestKeyResult = this._lineMaterialCache.keys().next();
      if (!oldestKeyResult.done) {
        const oldestKey = oldestKeyResult.value;
        const oldestMat = this._lineMaterialCache.get(oldestKey);
        if (oldestMat) {
          oldestMat.dispose();
        }
        this._lineMaterialCache.delete(oldestKey);
      }
    }

    this._lineMaterialCache.set(key, material);
    return material;
  }

  private _createLine2FromPoints(points: THREE.Vector3[], color: THREE.Color, lineWidth: number = DEFAULT_LINE_WIDTH): Line2 | null {
    if (points.length < 2) return null;

    // Filter degenerate (zero/near-zero length) line segments — these render as
    // scattered pixel artifacts due to Line2 round linecap. AutoCAD / Illustrator
    // silently drops such geometry; we must do the same.
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
      if (!this._isValidVector3(p)) return null;
      positions.push(p.x, p.y, p.z);
    }

    const geometry = new LineGeometry();
    geometry.setPositions(positions);

    const material = this._createLineMaterial(color, lineWidth);
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    return line;
  }

  private _validateGeometry(geometry: THREE.BufferGeometry): boolean {
    const position = geometry.getAttribute('position');
    if (!position) return false;

    const array = position.array;
    for (let i = 0; i < array.length; i++) {
      if (!this._isValidNumber(array[i])) {
        return false;
      }
    }
    return true;
  }

  private _validateLine2Geometry(line2: Line2): boolean {
    try {
      const geo = line2.geometry;
      const posAttr = geo.getAttribute('instanceStart');
      if (posAttr) {
        const arr = (posAttr as any).data?.array || (posAttr as any).array;
        if (arr) {
          for (let i = 0; i < arr.length; i++) {
            if (!this._isValidNumber(arr[i])) {
              return false;
            }
          }
        }
      }
      const posAttrEnd = geo.getAttribute('instanceEnd');
      if (posAttrEnd) {
        const arr = (posAttrEnd as any).data?.array || (posAttrEnd as any).array;
        if (arr) {
          for (let i = 0; i < arr.length; i++) {
            if (!this._isValidNumber(arr[i])) {
              return false;
            }
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private _validateObject3D(obj: THREE.Object3D): boolean {
    let valid = true;
    obj.traverse((child) => {
      if (!valid) return;
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Points) {
        if (!this._validateGeometry(child.geometry)) {
          valid = false;
        }
      }
      if (child instanceof Line2) {
        if (!this._validateLine2Geometry(child)) {
          valid = false;
        }
      }
    });
    return valid;
  }

  private _animate(): void {
    if (this._isDisposed) return;

    if (this._needsRender) {
      this._needsRender = false;
      this._renderer.render(this._scene, this._camera);
      // Continue animation loop if there might be more updates
      if (this._hasPendingUpdates()) {
        this._needsRender = true;
      }
    }

    // Stop animation loop if no rendering is needed
    if (!this._needsRender) {
      if (this._animationId !== null) {
        cancelAnimationFrame(this._animationId);
        this._animationId = null;
        // 仅在调试模式输出，避免每帧打印日志
        if (this._isDebugMode()) {
          logger.info('CadRenderer', 'Animation loop stopped');
        }
      }
      return;
    }

    this._animationId = requestAnimationFrame(() => this._animate());
  }

  private _hasPendingUpdates(): boolean {
    // Check if there are pending operations that might need rendering
    return this._isPanning || this._isBoxSelecting || this._isDraggingEntity;
  }

  private _updateCursor(hint?: 'hover' | 'grabbing' | 'move' | 'not-allowed'): void {
    const canvas = this._renderer?.domElement;
    if (!canvas) return;

    if (this._interactionMode === 'draw_text') {
      canvas.style.cursor = 'text';
      return;
    }
    if (this._interactionMode === 'draw_line' || this._interactionMode === 'draw_circle') {
      canvas.style.cursor = 'crosshair';
      return;
    }
    if (this._interactionMode === 'pan') {
      canvas.style.cursor = hint === 'grabbing' ? 'grabbing' : 'grab';
      return;
    }

    switch (hint) {
      case 'grabbing': canvas.style.cursor = 'grabbing'; break;
      case 'move': canvas.style.cursor = 'move'; break;
      case 'not-allowed': canvas.style.cursor = 'not-allowed'; break;
      case 'hover': canvas.style.cursor = 'pointer'; break;
      default: canvas.style.cursor = 'default'; break;
    }
  }

  private _requestRender(): void {
    if (this._isDisposed) return;

    if (!this._isRecoveringCamera &&
        (this._camera.left >= this._camera.right || this._camera.bottom >= this._camera.top)) {
      logger.warn('CadRenderer', 'Degenerate camera detected in _requestRender, recovering');
      this._isRecoveringCamera = true;
      try {
        this._fitToView();
      } finally {
        this._isRecoveringCamera = false;
      }
      return;
    }

    this._needsRender = true;
    if (this._animationId === null) {
      this._animationId = requestAnimationFrame(() => this._animate());
      if (this._isDebugMode()) {
        logger.info('CadRenderer', 'Animation loop started');
      }
    }
  }

  loadDocument(doc: CadDocument): void {
    this._clearEntities();
    this._document = doc;
    this._entityLayers.clear();
    this._hiddenLayers.clear();
    this._blocks.clear();  // 清空之前的 blocks

    // 加载 blocks
    if (doc.blocks && doc.blocks.length > 0) {
      for (const block of doc.blocks) {
        this._blocks.set(block.name, block);
      }
      logger.info('CadRenderer', 'Loaded blocks', { count: doc.blocks.length });
    }

    if (doc.extents) {
      const margin = Math.max(doc.extents.max.x - doc.extents.min.x, doc.extents.max.y - doc.extents.min.y) * 0.05;
      this._documentExtents = {
        minX: doc.extents.min.x - margin,
        minY: doc.extents.min.y - margin,
        maxX: doc.extents.max.x + margin,
        maxY: doc.extents.max.y + margin,
      };
      this._clippingPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -(this._documentExtents.minX)),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), this._documentExtents.maxX),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this._documentExtents.minY)),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), this._documentExtents.maxY),
      ];
      this._renderer.localClippingEnabled = true;
    } else {
      this._documentExtents = null;
      this._clippingPlanes = [];
      this._renderer.localClippingEnabled = false;
    }

    // 仅在调试模式输出详细日志
    if (this._isDebugMode()) {
      logger.info('CadRenderer', 'loadDocument called', {
        fileName: doc.file_name,
        entityCount: doc.entity_count,
        actualEntities: doc.entities.length,
        layerCount: doc.layers?.length,
        hasExtents: !!doc.extents,
        extentsMin: doc.extents ? { x: doc.extents.min.x, y: doc.extents.min.y } : undefined,
        extentsMax: doc.extents ? { x: doc.extents.max.x, y: doc.extents.max.y } : undefined,
      });
    }

    // 统计实体类型分布 - 仅在调试模式输出
    if (this._isDebugMode()) {
      const typeCounts = new Map<string, number>();
      for (const e of doc.entities) {
        const t = (e as any).type as string;
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      }
      logger.info('CadRenderer', 'Entity type distribution', { types: Object.fromEntries(typeCounts) });
    }


    let skippedCount = 0;
    let nullMeshCount = 0;
    const skippedTypes = new Map<string, number>();

    for (const entity of doc.entities) {
      try {
        const mesh = this._createEntityMesh(entity);
        if (mesh) {
          if (this._validateObject3D(mesh)) {
            this._entityMeshes.set(entity.id, mesh);
            this._entityLayers.set(entity.id, entity.layer);
            if (this._hiddenLayers.has(entity.layer)) {
              mesh.visible = false;
            }
            this._addNodeToLayerGroup(entity.layer, mesh, entity.id);
          } else {
            skippedCount++;
            const t = (entity as any).type as string;
            skippedTypes.set(t, (skippedTypes.get(t) || 0) + 1);
            this._disposeObject3D(mesh);
          }
        } else {
          nullMeshCount++;
        }
      } catch (e) {
        skippedCount++;
        const t = (entity as any).type as string;
        skippedTypes.set(t, (skippedTypes.get(t) || 0) + 1);
      }
    }

    if (skippedCount > 0) {
      logger.warn('CadRenderer', 'Skipped entities with invalid geometry', {
        skippedCount,
        skippedTypes: Object.fromEntries(skippedTypes),
      });
    }

    // 仅在调试模式输出加载摘要
    if (this._isDebugMode()) {
      logger.info('CadRenderer', 'Document loaded', {
        totalEntities: doc.entities.length,
        skippedCount,
        nullMeshCount,
        renderedCount: this._entityMeshes.size,
      });
    }

    this._fitToView();
    this._setupGPUPicking();  // Setup GPU picking after loading document
    this._requestRender();
  }

  loadFromSceneGraph(sceneGraph: SceneGraph): void {
    this._clearEntities();
    this._document = null;
    this._entityLayers.clear();
    this._hiddenLayers.clear();
    this._nodeIndex.clear();
    this._entityColors.clear();
    this._layerIndex.clear();
    this._logicallyHidden.clear();

    this._renderProfile = sceneGraph.renderProfile;
    this._complexFlags = sceneGraph.complexFlags;
    this._externalBounds = sceneGraph.bounds;

    if (sceneGraph.bounds) {
      const b = sceneGraph.bounds;
      const extentW = b.maxX - b.minX;
      const extentH = b.maxY - b.minY;
      const maxExtent = Math.max(extentW, extentH);
      const cellSize = Math.max(10, maxExtent / 200);
      this._spatialIndex.setCellSize(cellSize);
    }

    for (const layer of sceneGraph.allLayers) {
      this._layerIndex.set(layer.name, layer);
      if (!layer.visible || layer.frozen || layer.name === DELETED_LAYER_NAME) {
        this._hiddenLayers.add(layer.name);
      }
    }

    const nodes = sceneGraph.allNodes;
    // 仅在调试模式输出详细加载信息
    if (this._isDebugMode()) {
      logger.info('CadRenderer', 'loadFromSceneGraph called', {
        nodeCount: nodes.length,
        layerCount: sceneGraph.allLayers.length,
        bounds: sceneGraph.bounds,
        renderProfile: this._renderProfile,
      });
    }

    switch (this._renderProfile) {
      case RenderProfile.Light:
        this._renderSimple(nodes);
        break;
      case RenderProfile.Standard:
        this._renderStandard(nodes);
        break;
      case RenderProfile.Heavy:
        this._renderHeavy(nodes);
        break;
      case RenderProfile.Mega:
        this._renderMega(nodes);
        break;
      case RenderProfile.Ultra:
        this._renderUltra(nodes);
        break;
      case RenderProfile.HeavyLwPolyline:
        this._renderWithLod(nodes);
        break;
      case RenderProfile.HeavyHatch:
        this._renderWithHatchOpt(nodes);
        break;
      case RenderProfile.LargeCoordinates:
        this._renderWithCoordOpt(nodes);
        break;
      case RenderProfile.HeavyEntity:
        this._renderWithLod(nodes);
        break;
      case RenderProfile.MediumEntity:
        this._renderWithLod(nodes);
        break;
      case RenderProfile.Complex:
        this._renderWithFullOpt(nodes);
        break;
      case RenderProfile.Simple:
      default:
        this._renderSimple(nodes);
        break;
    }

    // 仅在调试模式输出渲染摘要
    if (this._isDebugMode()) {
      logger.info('CadRenderer', 'SceneGraph loaded', {
        totalNodes: nodes.length,
        renderedCount: this._entityMeshes.size,
        batchedCount: this._batchedBuilder.getEntityCount(),
        batchCount: this._batchedBuilder.getBatchCount(),
        individualCount: this._individualEntities.size,
        spatialIndexEntities: this._spatialIndex.getEntityCount(),
        spatialIndexSegments: this._spatialIndex.getSegmentCount(),
        externalBounds: this._externalBounds,
        renderProfile: this._renderProfile,
        isProgressive: this._isProgressiveLoading,
      });
    }

    if (!this._isProgressiveLoading) {
      this._batchedBuilder.rebuildAll(this._scene);
      if (this._sdfTextRenderer.needsSync) {
        this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
      }
      this._fitToView();
      this._scheduleViewportCulling();
      this._requestRender();
    }
    this._emitCameraChanged();
  }

  private _ensureLayerGroup(layerName: string): THREE.Group {
    let group = this._layerGroups.get(layerName);
    if (!group) {
      group = new THREE.Group();
      group.name = `__layer_${layerName}`;
      group.visible = !this._hiddenLayers.has(layerName);
      this._scene.add(group);
      this._layerGroups.set(layerName, group);
    }
    return group;
  }

  private _addNodeToLayerGroup(layerName: string, mesh: THREE.Object3D, entityId: string): void {
    const group = this._ensureLayerGroup(layerName);
    mesh.userData.__entityId = entityId;
    group.add(mesh);
    this._registerEntityInLayer(layerName, entityId);
  }

  private _registerEntityInLayer(layerName: string, entityId: string): void {
    let entitySet = this._layerEntityIndex.get(layerName);
    if (!entitySet) {
      entitySet = new Set();
      this._layerEntityIndex.set(layerName, entitySet);
    }
    entitySet.add(entityId);
  }

  private _removeNodeFromLayerGroup(entityId: string): void {
    const layerName = this._entityLayers.get(entityId);
    if (!layerName) return;
    const entitySet = this._layerEntityIndex.get(layerName);
    if (entitySet) {
      entitySet.delete(entityId);
      if (entitySet.size === 0) {
        this._layerEntityIndex.delete(layerName);
      }
    }
  }

  private _isBatchableType(type: string): boolean {
    return type === 'line' || type === 'circle' || type === 'arc' ||
           type === 'polyline' || type === 'lwPolyline' || type === 'spline' ||
           type === 'ellipse' || type === 'dimension';
  }

  private _addSegmentsToSpatialIndex(entityId: string, positions: number[]): void {
    const segments: LineSegment[] = [];
    for (let i = 0; i < positions.length - 5; i += 6) {
      segments.push({
        entityId,
        x1: positions[i], y1: positions[i + 1],
        x2: positions[i + 3], y2: positions[i + 4],
      });
    }
    this._spatialIndex.addSegments(segments);
  }

  private _addEntityToSpatialIndex(entityId: string, node: SceneNode): void {
    const positions = this._extractLinePositions(node);
    if (positions && positions.length >= 6) {
      this._addSegmentsToSpatialIndex(entityId, positions);
    }
  }

  private _extractLinePositions(node: SceneNode): number[] | null {
    switch (node.type) {
      case 'line': {
        const sx = node.startX, sy = node.startY, ex = node.endX, ey = node.endY;
        const dx = ex - sx, dy = ey - sy;
        if (dx * dx + dy * dy < 0.01) return null;
        return [sx, sy, 0, ex, ey, 0];
      }
      case 'circle': {
        if (node.radius <= 0) return null;
        return this._circlePositions(node.centerX, node.centerY, node.radius, 0, Math.PI * 2);
      }
      case 'arc': {
        if (node.radius <= 0) return null;
        return this._arcPositions(node.centerX, node.centerY, node.radius, node.startAngle, node.endAngle);
      }
      case 'ellipse': {
        return this._ellipsePositions(node as any);
      }
      case 'lwPolyline': {
        return this._lwPolylinePositions(node as any);
      }
      case 'polyline': {
        return this._polylinePositions(node as any);
      }
      case 'spline': {
        return this._splinePositions(node as any);
      }
      case 'dimension': {
        return this._dimensionPositions(node as any);
      }
      default:
        return null;
    }
  }

  private _adaptiveArcSegments(radius: number, angleRange: number): number {
    const viewW = this._camera.right - this._camera.left;
    const canvasW = this._canvasWidth || 1;
    const pixelPerUnit = canvasW / viewW;
    const circumference = 2 * Math.PI * radius;
    const pixelCircumference = circumference * pixelPerUnit;
    const desiredPixelsPerSegment = 4;
    const idealSegments = Math.ceil(pixelCircumference / desiredPixelsPerSegment);
    const minSegments = 8;
    const maxSegments = 256;
    const fullSegments = Math.max(minSegments, Math.min(maxSegments, idealSegments));
    const fraction = Math.abs(angleRange) / (2 * Math.PI);
    return Math.max(minSegments, Math.round(fullSegments * fraction));
  }

  private _circlePositions(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): number[] | null {
    let angleRange = endAngle - startAngle;
    if (angleRange < 0) angleRange += Math.PI * 2;
    if (angleRange < 1e-10) return null;

    const segCount = this._adaptiveArcSegments(radius, angleRange);
    const positions: number[] = [];

    for (let i = 0; i < segCount; i++) {
      const a1 = startAngle + (i / segCount) * angleRange;
      const a2 = startAngle + ((i + 1) / segCount) * angleRange;
      positions.push(
        cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, 0,
        cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius, 0,
      );
    }
    return positions.length >= 6 ? positions : null;
  }

  private _arcPositions(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): number[] | null {
    return this._circlePositions(cx, cy, radius, startAngle, endAngle);
  }

  private _ellipsePositions(node: any): number[] | null {
    const majorLength = Math.sqrt(node.majorX ** 2 + node.majorY ** 2);
    if (majorLength < 1e-10 || node.minorRatio <= 0) return null;
    const minorLength = majorLength * node.minorRatio;
    const rotation = Math.atan2(node.majorY, node.majorX);

    let angleRange = node.endAngle - node.startAngle;
    if (angleRange < 0) angleRange += Math.PI * 2;
    if (angleRange < 1e-10) return null;

    const avgRadius = (majorLength + minorLength) / 2;
    const segments = this._adaptiveArcSegments(avgRadius, angleRange);
    const positions: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a1 = node.startAngle + (i / segments) * angleRange;
      const a2 = node.startAngle + ((i + 1) / segments) * angleRange;
      const cosR = Math.cos(rotation), sinR = Math.sin(rotation);

      const x1 = Math.cos(a1) * majorLength, y1 = Math.sin(a1) * minorLength;
      const rx1 = node.centerX + x1 * cosR - y1 * sinR;
      const ry1 = node.centerY + x1 * sinR + y1 * cosR;

      const x2 = Math.cos(a2) * majorLength, y2 = Math.sin(a2) * minorLength;
      const rx2 = node.centerX + x2 * cosR - y2 * sinR;
      const ry2 = node.centerY + x2 * sinR + y2 * cosR;

      positions.push(rx1, ry1, 0, rx2, ry2, 0);
    }
    return positions.length >= 6 ? positions : null;
  }

  private _dedupLineSegmentPositions(positions: number[]): number[] {
    if (positions.length < 12) return positions;
    const result: number[] = [];
    for (let i = 0; i < positions.length - 5; i += 6) {
      const dx = positions[i + 3] - positions[i];
      const dy = positions[i + 4] - positions[i + 1];
      if (dx * dx + dy * dy > 1e-6) {
        result.push(positions[i], positions[i + 1], positions[i + 2],
                    positions[i + 3], positions[i + 4], positions[i + 5]);
      }
    }
    return result;
  }

  private _lwPolylinePositions(node: any): number[] | null {
    const vertices = node.vertices;
    if (!vertices || vertices.length === 0) return null;
    const validVertices = vertices.filter((v: { x: number; y: number; bulge: number }) =>
      this._isValidNumber(v.x) && this._isValidNumber(v.y) && this._isValidNumber(v.bulge));
    if (validVertices.length < 2) return null;

    const positions: number[] = [];
    for (let i = 0; i < validVertices.length; i++) {
      const v = validVertices[i];
      const nextIdx = node.closed ? (i + 1) % validVertices.length : i + 1;
      if (nextIdx >= validVertices.length && !node.closed) break;
      const nextV = validVertices[nextIdx];

      if (Math.abs(v.bulge) > 1e-9 && nextIdx < validVertices.length) {
        const arcPts = this._bulgeToArcPositions(v, nextV);
        for (let j = 0; j < arcPts.length - 3; j += 3) {
          positions.push(arcPts[j], arcPts[j + 1], arcPts[j + 2],
                         arcPts[j + 3], arcPts[j + 4], arcPts[j + 5]);
        }
      } else if (nextIdx < validVertices.length) {
        positions.push(v.x, v.y, 0, nextV.x, nextV.y, 0);
      }
    }
    const deduped = this._dedupLineSegmentPositions(positions);
    return deduped.length >= 6 ? deduped : null;
  }

  private _polylinePositions(node: any): number[] | null {
    const vertices = node.vertices;
    if (!vertices || vertices.length < 2) return null;
    const positions: number[] = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i], b = vertices[i + 1];
      if (this._isValidNumber(a.x) && this._isValidNumber(a.y) && this._isValidNumber(b.x) && this._isValidNumber(b.y)) {
        positions.push(a.x, a.y, a.z || 0, b.x, b.y, b.z || 0);
      }
    }
    if (node.closed && vertices.length > 1) {
      const first = vertices[0], last = vertices[vertices.length - 1];
      if (this._isValidNumber(first.x) && this._isValidNumber(last.x)) {
        positions.push(last.x, last.y, last.z || 0, first.x, first.y, first.z || 0);
      }
    }
    const deduped = this._dedupLineSegmentPositions(positions);
    return deduped.length >= 6 ? deduped : null;
  }

  private _splinePositions(node: any): number[] | null {
    const fitPoints = node.fitPoints;
    const controlPoints = node.controlPoints;
    const points = fitPoints.length >= 2 ? fitPoints : controlPoints;
    if (points.length < 2) return null;

    const validPoints = points.filter((p: { x: number; y: number; z: number }) =>
      this._isValidNumber(p.x) && this._isValidNumber(p.y));
    if (validPoints.length < 2) return null;

    const positions: number[] = [];
    for (let i = 0; i < validPoints.length - 1; i++) {
      const a = validPoints[i], b = validPoints[i + 1];
      positions.push(a.x, a.y, a.z || 0, b.x, b.y, b.z || 0);
    }
    const deduped = this._dedupLineSegmentPositions(positions);
    return deduped.length >= 6 ? deduped : null;
  }

  private _dimensionPositions(node: any): number[] | null {
    const positions: number[] = [];
    const dx = node.defX, dy = node.defY, mx = node.midX, my = node.midY;
    if (this._isValidNumber(dx) && this._isValidNumber(dy) && this._isValidNumber(mx) && this._isValidNumber(my)) {
      const ddx = mx - dx, ddy = my - dy;
      if (ddx * ddx + ddy * ddy > 0.01) {
        positions.push(dx, dy, 0, mx, my, 0);
      }
    }
    return positions.length >= 6 ? positions : null;
  }

  private _bulgeToArcPositions(start: CadLwVertex, end: CadLwVertex): number[] {
    const bulge = start.bulge;
    if (!this._isValidNumber(bulge)) return [];

    const sx = start.x, sy = start.y, ex = end.x, ey = end.y;
    const dx = ex - sx, dy = ey - sy;
    const chordLength = Math.sqrt(dx * dx + dy * dy);
    if (chordLength < 1e-10) return [];

    const includedAngle = 4 * Math.atan(Math.abs(bulge));
    if (includedAngle < 1e-10 || includedAngle >= Math.PI * 2 - 1e-10) return [];

    const sinHalfAngle = Math.sin(includedAngle / 2);
    if (Math.abs(sinHalfAngle) < 1e-10) return [];

    const radius = chordLength / (2 * sinHalfAngle);
    if (!this._isValidNumber(radius) || radius <= 0 || !isFinite(radius)) return [];

    const midX = (sx + ex) / 2, midY = (sy + ey) / 2;
    const chordDirX = dx / chordLength, chordDirY = dy / chordLength;
    const perpX = -chordDirY, perpY = chordDirX;
    const sagitta = radius * (1 - Math.cos(includedAngle / 2));
    const sign = bulge > 0 ? 1 : -1;
    const cx = midX + sign * perpX * sagitta, cy = midY + sign * perpY * sagitta;

    if (!this._isValidNumber(cx) || !this._isValidNumber(cy)) return [];

    let startAngle = Math.atan2(sy - cy, sx - cx);
    let endAngle = Math.atan2(ey - cy, ex - cx);
    if (!this._isValidNumber(startAngle) || !this._isValidNumber(endAngle)) return [];

    if (bulge > 0) {
      while (endAngle <= startAngle) endAngle += Math.PI * 2;
    } else {
      while (endAngle >= startAngle) endAngle -= Math.PI * 2;
    }

    const segments = this._adaptiveArcSegments(radius, Math.abs(endAngle - startAngle));
    const positions: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a1 = startAngle + (i / segments) * (endAngle - startAngle);
      const a2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);
      positions.push(
        cx + radius * Math.cos(a1), cy + radius * Math.sin(a1), 0,
        cx + radius * Math.cos(a2), cy + radius * Math.sin(a2), 0,
      );
    }
    return positions;
  }

  private _addNodeToScene(node: SceneNode, enableLwPolyDecimation: boolean = false): boolean {
    if (node.layer === DELETED_LAYER_NAME) return false;
    try {
      const idStr = String(node.id);
      this._expandDegenerateBbox(node);
      this._entityLayers.set(idStr, node.layer);
      this._entityColors.set(idStr, this._resolveColor(node.color, node.layer).clone());
      const hiddenByLayer = this._hiddenLayers.has(node.layer);
      const hiddenByNode = node.visible === false;
      if (hiddenByLayer || hiddenByNode) {
        this._logicallyHidden.add(idStr);
      }

      let effectiveNode = node;
      if (enableLwPolyDecimation && node.type === 'lwPolyline') {
        effectiveNode = this._decimateLwPolylineNode(node);
      }
      this._nodeIndex.set(idStr, effectiveNode);

      if (this._useBatchedText && (effectiveNode.type === 'text' || effectiveNode.type === 'mText')) {
        const added = this._addTextToBatchedRenderer(idStr, effectiveNode, effectiveNode.layer);
        if (added) {
          this._registerEntityInLayer(effectiveNode.layer, idStr);
          if (hiddenByLayer || hiddenByNode) {
            this._sdfTextRenderer.setTextVisible(idStr, false);
          }
          return true;
        }
      }

      if (this._useBatchedRendering && this._isBatchableType(effectiveNode.type) && !this._selectedEntityIds.has(idStr)) {
        const positions = this._extractLinePositions(effectiveNode);
        if (positions && positions.length >= 6) {
          const color = this._resolveColor(effectiveNode.color, effectiveNode.layer);
          const rawLw = (effectiveNode as { lineWeight?: number }).lineWeight;
          const lineWidth = (rawLw !== undefined && Number.isFinite(rawLw) && rawLw > 0)
            ? Math.max(1, Math.min(rawLw * 1.5, 5))
            : DEFAULT_LINE_WIDTH;
          this._batchedBuilder.addLineSegments(idStr, effectiveNode.layer, color, lineWidth, positions, this._scene);
          this._addSegmentsToSpatialIndex(idStr, positions);
          this._registerEntityInLayer(effectiveNode.layer, idStr);
          return true;
        }
      }

      const mesh = this._createSceneNodeMesh(effectiveNode);
      if (mesh) {
        if (this._validateObject3D(mesh)) {
          this._entityMeshes.set(idStr, mesh);
          this._individualEntities.add(idStr);
          this._addEntityToSpatialIndex(idStr, effectiveNode);
          if (hiddenByLayer || hiddenByNode) mesh.visible = false;
          this._addNodeToLayerGroup(effectiveNode.layer, mesh, idStr);
          return true;
        }
        this._disposeObject3D(mesh);
      }
    } catch (_e) {
      // skip
    }
    return false;
  }

  private _decimateLwPolylineNode(node: SceneNode): SceneNode {
    if (node.type !== 'lwPolyline') return node;
    const lwNode = node as import('./cad_runtime/scene_node').LwPolylineNode;
    const maxVerts = 2000;
    if (lwNode.vertices.length <= maxVerts) return node;
    const step = Math.ceil(lwNode.vertices.length / maxVerts);
    const decimated = [] as Array<{ x: number; y: number; bulge: number }>;
    for (let i = 0; i < lwNode.vertices.length; i += step) {
      decimated.push(lwNode.vertices[i]);
    }
    const last = lwNode.vertices[lwNode.vertices.length - 1];
    const decLast = decimated[decimated.length - 1];
    if (decLast.x !== last.x || decLast.y !== last.y) decimated.push(last);
    if (lwNode.closed) {
      const first = lwNode.vertices[0];
      const decLast2 = decimated[decimated.length - 1];
      if (decLast2.x !== first.x || decLast2.y !== first.y) decimated.push(first);
    }
    return { ...lwNode, vertices: decimated };
  }

  private _renderSimple(nodes: SceneNode[]): void {
    let skipped = 0;
    let deleted = 0;
    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }
      if (!this._addNodeToScene(node)) skipped++;
    }
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderSimple', { total: nodes.length, deleted, skipped, rendered: this._entityMeshes.size });
    }
  }

  private _renderWithLod(nodes: SceneNode[]): void {
    let skipped = 0;
    let deleted = 0;
    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }
      if (!this._addNodeToScene(node, true)) skipped++;
    }
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderWithLod', { total: nodes.length, deleted, skipped, rendered: this._entityMeshes.size });
    }
  }

  private _renderWithHatchOpt(nodes: SceneNode[]): void {
    let skipped = 0;
    let deleted = 0;
    let hatchSkipped = 0;
    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }
      if (node.type === 'hatch') {
        const hatchNode = node as import('./cad_runtime/scene_node').HatchNode;
        const boundaries = hatchNode.boundaries ?? [];
        const hasOversizedPath = boundaries.some(b => b.length > 100);
        const totalVertices = boundaries.reduce((sum, b) => sum + b.length, 0);
        if (hasOversizedPath || boundaries.length > 50 || totalVertices > 500) {
          hatchSkipped++;
          continue;
        }
      }
      if (!this._addNodeToScene(node)) skipped++;
    }
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderWithHatchOpt', { total: nodes.length, deleted, skipped, hatchSkipped, rendered: this._entityMeshes.size });
    }
  }

  private _renderWithCoordOpt(nodes: SceneNode[]): void {
    let skipped = 0;
    let deleted = 0;
    let hatchSkipped = 0;
    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }
      if (node.type === 'hatch') {
        const hatchNode = node as import('./cad_runtime/scene_node').HatchNode;
        const boundaryCount = hatchNode.boundaries?.length ?? 0;
        const totalVertices = hatchNode.boundaries?.reduce((sum, b) => sum + b.length, 0) ?? 0;
        if (boundaryCount > 50 || totalVertices > 500) {
          hatchSkipped++;
          continue;
        }
      }
      if (!this._addNodeToScene(node, true)) skipped++;
    }
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderWithCoordOpt', { total: nodes.length, deleted, skipped, hatchSkipped, rendered: this._entityMeshes.size });
    }
  }

  private _renderWithFullOpt(nodes: SceneNode[]): void {
    let skipped = 0;
    let deleted = 0;
    let hatchSkipped = 0;
    let textClamped = 0;
    let smallTextSkipped = 0;
    const FLAG_LARGE_COORDS = 0b0001;
    const FLAG_HEAVY_LWPOLY = 0b0010;
    const FLAG_HEAVY_HATCH = 0b0100;
    const FLAG_EXTREME_TEXT = 0b1000;
    const FLAG_DISTRIBUTED_COORDS = 0b10000;
    const FLAG_MEDIUM_ENTITY = 0b100000;
    const TEXT_HEIGHT_MIN = 0.1;
    const TEXT_HEIGHT_MAX = 500.0;
    const SMALL_TEXT_THRESHOLD = 0.5;

    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }

      if ((this._complexFlags & FLAG_HEAVY_HATCH) && node.type === 'hatch') {
        const hatchNode = node as import('./cad_runtime/scene_node').HatchNode;
        const boundaryCount = hatchNode.boundaries?.length ?? 0;
        const totalVertices = hatchNode.boundaries?.reduce((sum, b) => sum + b.length, 0) ?? 0;
        if (boundaryCount > 50 || totalVertices > 500) { hatchSkipped++; continue; }
      }

      if ((this._complexFlags & FLAG_EXTREME_TEXT) && (node.type === 'text' || node.type === 'mText')) {
        const textNode = node as any;
        if (textNode.height !== undefined && (textNode.height > TEXT_HEIGHT_MAX || textNode.height < TEXT_HEIGHT_MIN)) {
          textNode.height = Math.max(TEXT_HEIGHT_MIN, Math.min(TEXT_HEIGHT_MAX, textNode.height));
          textClamped++;
        }
      }

      if ((this._complexFlags & FLAG_MEDIUM_ENTITY) && (node.type === 'text' || node.type === 'mText')) {
        const textNode = node as any;
        if (textNode.height !== undefined && textNode.height < SMALL_TEXT_THRESHOLD) {
          smallTextSkipped++;
          continue;
        }
      }

      const enableDecimation = (this._complexFlags & FLAG_HEAVY_LWPOLY) !== 0 || (this._complexFlags & FLAG_LARGE_COORDS) !== 0 || (this._complexFlags & FLAG_DISTRIBUTED_COORDS) !== 0;
      if (!this._addNodeToScene(node, enableDecimation)) skipped++;
    }
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderWithFullOpt', { total: nodes.length, deleted, skipped, hatchSkipped, textClamped, smallTextSkipped, rendered: this._entityMeshes.size, complexFlags: this._complexFlags });
    }
  }

  private _renderStandard(nodes: SceneNode[]): void {
    let skipped = 0;
    let deleted = 0;
    let smallTextSkipped = 0;
    const FLAG_HEAVY_LWPOLY = 0b0010;
    const FLAG_MEDIUM_ENTITY = 0b100000;
    const SMALL_TEXT_THRESHOLD = 0.5;

    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }

      if ((this._complexFlags & FLAG_MEDIUM_ENTITY) && (node.type === 'text' || node.type === 'mText')) {
        const textNode = node as any;
        if (textNode.height !== undefined && textNode.height < SMALL_TEXT_THRESHOLD) {
          smallTextSkipped++;
          continue;
        }
      }

      const enableDecimation = (this._complexFlags & FLAG_HEAVY_LWPOLY) !== 0;
      if (!this._addNodeToScene(node, enableDecimation)) skipped++;
    }
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderStandard', { total: nodes.length, deleted, skipped, smallTextSkipped, rendered: this._entityMeshes.size, complexFlags: this._complexFlags });
    }
  }

  private _renderHeavy(nodes: SceneNode[]): void {
    let skeletonRendered = 0;
    let deferred = 0;
    let deleted = 0;
    let hatchSkipped = 0;
    let textClamped = 0;
    let smallTextSkipped = 0;
    const FLAG_HEAVY_HATCH = 0b0100;
    const FLAG_EXTREME_TEXT = 0b1000;
    const FLAG_HEAVY_LWPOLY = 0b0010;
    const FLAG_LARGE_COORDS = 0b0001;
    const FLAG_DISTRIBUTED_COORDS = 0b10000;
    const FLAG_MULTI_CLUSTER = 0b1000000;
    const FLAG_MEDIUM_ENTITY = 0b100000;
    const TEXT_HEIGHT_MIN = 0.1;
    const TEXT_HEIGHT_MAX = 500.0;
    const SMALL_TEXT_THRESHOLD = 0.5;

    this._deferredNodes = [];
    this._isProgressiveLoading = true;

    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }

      if ((this._complexFlags & FLAG_HEAVY_HATCH) && node.type === 'hatch') {
        const hatchNode = node as import('./cad_runtime/scene_node').HatchNode;
        const boundaryCount = hatchNode.boundaries?.length ?? 0;
        const totalVertices = hatchNode.boundaries?.reduce((sum, b) => sum + b.length, 0) ?? 0;
        if (boundaryCount > 50 || totalVertices > 500) { hatchSkipped++; continue; }
        this._deferredNodes.push(node);
        deferred++;
        continue;
      }

      if ((this._complexFlags & FLAG_EXTREME_TEXT) && (node.type === 'text' || node.type === 'mText')) {
        const textNode = node as any;
        if (textNode.height !== undefined && (textNode.height > TEXT_HEIGHT_MAX || textNode.height < TEXT_HEIGHT_MIN)) {
          textNode.height = Math.max(TEXT_HEIGHT_MIN, Math.min(TEXT_HEIGHT_MAX, textNode.height));
          textClamped++;
        }
      }

      if ((this._complexFlags & FLAG_MEDIUM_ENTITY) && (node.type === 'text' || node.type === 'mText')) {
        const textNode = node as any;
        if (textNode.height !== undefined && textNode.height < SMALL_TEXT_THRESHOLD) {
          smallTextSkipped++;
          continue;
        }
      }

      const enableDecimation = (this._complexFlags & FLAG_HEAVY_LWPOLY) !== 0 ||
                               (this._complexFlags & FLAG_LARGE_COORDS) !== 0 ||
                               (this._complexFlags & FLAG_DISTRIBUTED_COORDS) !== 0 ||
                               (this._complexFlags & FLAG_MULTI_CLUSTER) !== 0;
      if (!this._addNodeToScene(node, enableDecimation)) { /* skip */ }
      else skeletonRendered++;
    }

    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderHeavy skeleton', { total: nodes.length, skeletonRendered, deferred, deleted, hatchSkipped, textClamped, smallTextSkipped, complexFlags: this._complexFlags });
    }

    this._batchedBuilder.rebuildAll(this._scene);
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    this._fitToView();
    this._requestRender();
    this._scheduleDeferredRender();
  }

  private _renderMega(nodes: SceneNode[]): void {
    let skeletonRendered = 0;
    let deferred = 0;
    let deleted = 0;
    let placeholderCount = 0;
    const TEXT_HEIGHT_MIN = 0.1;
    const TEXT_HEIGHT_MAX = 500.0;
    const SMALL_TEXT_THRESHOLD = 1.0;
    const HATCH_MAX_BOUNDARIES = 30;
    const HATCH_MAX_VERTICES = 300;

    this._deferredNodes = [];
    this._isProgressiveLoading = true;

    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }

      if (node.type === 'hatch') {
        const hatchNode = node as import('./cad_runtime/scene_node').HatchNode;
        const boundaryCount = hatchNode.boundaries?.length ?? 0;
        const totalVertices = hatchNode.boundaries?.reduce((sum, b) => sum + b.length, 0) ?? 0;
        if (boundaryCount > HATCH_MAX_BOUNDARIES || totalVertices > HATCH_MAX_VERTICES) continue;
        this._deferredNodes.push(node);
        deferred++;
        continue;
      }

      if (node.type === 'text' || node.type === 'mText') {
        const textNode = node as any;
        if (textNode.height !== undefined) {
          if (textNode.height > TEXT_HEIGHT_MAX || textNode.height < TEXT_HEIGHT_MIN) {
            textNode.height = Math.max(TEXT_HEIGHT_MIN, Math.min(TEXT_HEIGHT_MAX, textNode.height));
          }
          if (textNode.height < SMALL_TEXT_THRESHOLD) continue;
        }
        if (this._useBatchedText) {
          if (!this._addNodeToScene(node, true)) { /* skip */ }
          else skeletonRendered++;
        } else {
          const color = this._resolveColor(node.color, node.layer);
          const placeholder = this._createTextPlaceholder(
            { x: (node as any).posX, y: (node as any).posY, z: 0 },
            (textNode as any).height ?? 5,
            (node as any).rotation ?? 0,
            color,
            (node as any).widthFactor ?? 1.0,
          );
          if (placeholder) {
            const idStr = String(node.id);
            this._entityLayers.set(idStr, node.layer);
            this._entityColors.set(idStr, color.clone());
            this._nodeIndex.set(idStr, node);
            this._addNodeToLayerGroup(node.layer, placeholder, idStr);
            this._placeholderMap.set(idStr, placeholder);
            placeholderCount++;
          }
          this._deferredNodes.push(node);
          deferred++;
        }
        continue;
      }

      if (!this._addNodeToScene(node, true)) { /* skip */ }
      else skeletonRendered++;
    }

    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderMega skeleton', { total: nodes.length, skeletonRendered, deferred, placeholderCount, deleted });
    }

    this._batchedBuilder.rebuildAll(this._scene);
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    this._fitToView();
    this._requestRender();
    this._scheduleDeferredRender();
  }

  private _renderUltra(nodes: SceneNode[]): void {
    let skeletonRendered = 0;
    let deferred = 0;
    let deleted = 0;
    let placeholderCount = 0;
    const TEXT_HEIGHT_MIN = 0.1;
    const TEXT_HEIGHT_MAX = 500.0;
    const SMALL_TEXT_THRESHOLD = 2.0;

    this._deferredNodes = [];
    this._isProgressiveLoading = true;

    for (const node of nodes) {
      if (node.layer === DELETED_LAYER_NAME) { deleted++; continue; }

      if (node.type === 'hatch') continue;

      if (node.type === 'text' || node.type === 'mText') {
        const textNode = node as any;
        if (textNode.height !== undefined) {
          if (textNode.height > TEXT_HEIGHT_MAX || textNode.height < TEXT_HEIGHT_MIN) {
            textNode.height = Math.max(TEXT_HEIGHT_MIN, Math.min(TEXT_HEIGHT_MAX, textNode.height));
          }
          if (textNode.height < SMALL_TEXT_THRESHOLD) continue;
        }
        if (this._useBatchedText) {
          if (!this._addNodeToScene(node, true)) { /* skip */ }
          else skeletonRendered++;
        } else {
          const color = this._resolveColor(node.color, node.layer);
          const placeholder = this._createTextPlaceholder(
            { x: (node as any).posX, y: (node as any).posY, z: 0 },
            (textNode as any).height ?? 5,
            (node as any).rotation ?? 0,
            color,
            (node as any).widthFactor ?? 1.0,
          );
          if (placeholder) {
            const idStr = String(node.id);
            this._entityLayers.set(idStr, node.layer);
            this._entityColors.set(idStr, color.clone());
            this._nodeIndex.set(idStr, node);
            this._addNodeToLayerGroup(node.layer, placeholder, idStr);
            this._placeholderMap.set(idStr, placeholder);
            placeholderCount++;
          }
          this._deferredNodes.push(node);
          deferred++;
        }
        continue;
      }

      if (!this._addNodeToScene(node, true)) { /* skip */ }
      else skeletonRendered++;
    }

    if (this._isDebugMode()) {
      logger.info('CadRenderer', '_renderUltra skeleton', { total: nodes.length, skeletonRendered, deferred, placeholderCount, deleted });
    }

    this._batchedBuilder.rebuildAll(this._scene);
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    this._fitToView();
    this._requestRender();
    this._scheduleDeferredRender();
  }

  private _scheduleDeferredRender(): void {
    if (this._deferredNodes.length === 0) {
      this._isProgressiveLoading = false;
      return;
    }
    this._deferredTimer = requestAnimationFrame(() => this._processDeferredBatch());
  }

  private _processDeferredBatch(): void {
    this._deferredTimer = null;
    const BATCH_SIZE = 50;
    const batch = this._deferredNodes.splice(0, BATCH_SIZE);

    for (const node of batch) {
      if (node.layer === DELETED_LAYER_NAME) continue;
      const idStr = String(node.id);
      const existingMesh = this._entityMeshes.get(idStr);
      if (existingMesh) {
        this._disposeObject3D(existingMesh);
        this._entityMeshes.delete(idStr);
        this._individualEntities.delete(idStr);
      }
      const layerGroup = this._layerGroups.get(node.layer);
      if (layerGroup) {
        const oldChild = this._placeholderMap.get(idStr);
        if (oldChild) {
          layerGroup.remove(oldChild);
          this._disposeObject3D(oldChild);
          this._placeholderMap.delete(idStr);
        }
      }
      this._addNodeToScene(node, false);
    }

    this._batchedBuilder.rebuildDirty(this._scene);
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    this._requestRender();

    if (this._isDebugMode() && this._deferredNodes.length % 200 === 0) {
      logger.info('CadRenderer', 'progressive batch', { remaining: this._deferredNodes.length, rendered: this._entityMeshes.size });
    }

    if (this._deferredNodes.length > 0) {
      this._deferredTimer = requestAnimationFrame(() => this._processDeferredBatch());
    } else {
      this._isProgressiveLoading = false;
      this._scheduleViewportCulling();
      if (this._isDebugMode()) {
        logger.info('CadRenderer', 'progressive loading complete', { rendered: this._entityMeshes.size, batched: this._batchedBuilder.getEntityCount() });
      }
    }
  }

  /**
   * 拿当前缓存的实体节点（cadbin 模式）
   * 编辑器双击文字 / 取属性面板时使用。
   */
  getEntityNode(entityId: string): SceneNode | undefined {
    return this._nodeIndex.get(entityId);
  }

  getAllEntityNodes(): SceneNode[] {
    return Array.from(this._nodeIndex.values());
  }

  /**
   * 鼠标坐标 → 命中的 entityId（用于编辑器双击文字）。
   * 用 raycaster 命中 mesh 后，反向查 _entityMeshes。
   */
  pickEntityIdAt(clientX: number, clientY: number, includeHidden: boolean = false): string | null {
    const rect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const ndcX = (canvasX / rect.width) * 2 - 1;
    const ndcY = -(canvasY / rect.height) * 2 + 1;
    const worldPoint = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this._camera);

    const pixelSize = Math.max(
      (this._camera.right - this._camera.left) / rect.width,
      (this._camera.top - this._camera.bottom) / rect.height,
    );
    const tolerance = pixelSize * 8;

    const candidates = this._spatialIndex.queryPointCandidates(worldPoint.x, worldPoint.y, tolerance);
    for (const { entityId } of candidates) {
      if (includeHidden) return entityId;
      const layerName = this._entityLayers.get(entityId);
      if (layerName && this._hiddenLayers.has(layerName)) continue;
      if (this._logicallyHidden.has(entityId)) continue;
      return entityId;
    }

    if (this._useBatchedText && this._sdfTextRenderer.size > 0) {
      const textHit = this._sdfTextRenderer.pickTextAt(
        worldPoint.x, worldPoint.y, tolerance,
        this._hiddenLayers, this._logicallyHidden,
      );
      if (textHit) return textHit;
    }

    const gpuHit = this._pickEntityAt(canvasX, canvasY);
    if (gpuHit) return gpuHit;

    return null;
  }


  /**
   * 在已加载的 cadbin 场景中替换某个 Text/MText 实体的内容。
   * 直接重建 mesh（共享纹理池）；若 id 对应的不是文字则返回 false。
   */
  updateTextContent(entityId: string, newContent: string): boolean {
    const node = this._nodeIndex.get(entityId);
    if (!node) return false;
    if (node.type !== 'text' && node.type !== 'mText') return false;

    (node as unknown as { content: string }).content = newContent;
    this._recomputeBbox(node);
    this._expandDegenerateBbox(node);

    if (this._useBatchedText && this._sdfTextRenderer.has(entityId)) {
      this._sdfTextRenderer.removeText(entityId);
      this._addTextToBatchedRenderer(entityId, node, node.layer);
      if (this._hiddenLayers.has(node.layer) || node.visible === false) {
        this._sdfTextRenderer.setTextVisible(entityId, false);
      }
      this._requestRender();
      return true;
    }

    const oldMesh = this._entityMeshes.get(entityId);
    if (oldMesh) {
      this._removeNodeFromLayerGroup(entityId);
      oldMesh.parent?.remove(oldMesh);
      this._disposeObject3D(oldMesh, false);
      this._entityMeshes.delete(entityId);
    }

    const newMesh = this._createSceneNodeMesh(node);
    if (!newMesh) return false;

    this._entityMeshes.set(entityId, newMesh);
    this._entityLayers.set(entityId, node.layer);
    if (this._hiddenLayers.has(node.layer) || node.visible === false) {
      newMesh.visible = false;
    }
    this._addNodeToLayerGroup(node.layer, newMesh, entityId);
    this._requestRender();
    return true;
  }

  private _createSceneNodeMesh(node: SceneNode): THREE.Object3D | null {
    const renderer = this._entityRendererRegistry?.getRendererForType(node.type);
    if (renderer) {
      try {
        const context = this._createEntityRenderContext();
        const result = renderer.create(node, context);
        if (result) {
          result.object.userData.entityId = node.id;
          result.object.userData.entityType = node.type;
          return result.object;
        }
      } catch (err) {
        console.warn(`[CadRenderer] EntityRenderer for "${node.type}" failed, falling back to built-in:`, err);
      }
    }

    const color = this._resolveColor(node.color, node.layer);
    this._entityColors.set(String(node.id), color.clone());
    // 真正按"线宽"渲染：lineWeight 是 mm，绝大多数 CAD 实体在 0.05~2.11 mm 之间，
    // 转 px 时给个保底，免得 lineWeight 0 的全是 0.5px 看着虚。
    const rawLw = (node as { lineWeight?: number }).lineWeight;
    const lineWidth = (rawLw !== undefined && Number.isFinite(rawLw) && rawLw > 0)
      ? Math.max(1, Math.min(rawLw * 1.5, 5))
      : DEFAULT_LINE_WIDTH;

    switch (node.type) {
      case 'line':
        return this._createLine(
          { x: node.startX, y: node.startY, z: 0 },
          { x: node.endX, y: node.endY, z: 0 },
          color,
          lineWidth,
        );
      case 'circle':
        return this._createCircle(
          { x: node.centerX, y: node.centerY, z: 0 },
          node.radius,
          color,
          lineWidth,
        );
      case 'arc':
        return this._createArc(
          { x: node.centerX, y: node.centerY, z: 0 },
          node.radius,
          node.startAngle,
          node.endAngle,
          color,
          lineWidth,
        );
      case 'ellipse':
        return this._createEllipse(
          { x: node.centerX, y: node.centerY, z: 0 },
          { x: node.majorX, y: node.majorY, z: 0 },
          node.minorRatio,
          node.startAngle,
          node.endAngle,
          color,
          lineWidth,
        );
      case 'lwPolyline':
        return this._createLwPolyline(
          node.vertices.map(v => ({ x: v.x, y: v.y, bulge: v.bulge })),
          node.closed,
          color,
          lineWidth,
        );
      case 'polyline':
        return this._createPolyline(
          node.vertices.map(v => ({ x: v.x, y: v.y, z: v.z })),
          node.closed,
          color,
          lineWidth,
        );
      case 'spline':
        return this._createSpline(
          node.controlPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
          node.fitPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
          node.knots,
          node.degree,
          color,
          lineWidth,
        );
      case 'text': {
        const ap = this._textAlignmentToAttachmentPoint(
          (node as any).horizontalAlignment ?? 0,
          (node as any).verticalAlignment ?? 0,
        );
        return this._createText(
          { x: node.posX, y: node.posY, z: 0 },
          node.content,
          node.height,
          node.rotation,
          color,
          ap,
        );
      }
      case 'mText':
        return this._createText(
          { x: node.posX, y: node.posY, z: 0 },
          node.content,
          node.height,
          node.rotation,
          color,
          node.attachmentPoint || 1,
          node.width || 0,
          (node as any).widthFactor ?? 1.0,
          (node as any).fontName ?? '',
          (node as any).heightScale ?? 1.0,
        );
      case 'solid':
        return this._createSolid(
          node.points.map(p => ({ x: p.x, y: p.y, z: 0 })),
          color,
        );
      case 'point':
        return this._createPoint({ x: node.posX, y: node.posY, z: 0 }, color);
      case 'hatch':
        return this._createHatch(
          node.boundaries.map(path => path.map(v => ({ x: v.x, y: v.y, bulge: v.bulge }))),
          node.solid,
          node.scale,
          node.angle,
          color,
          lineWidth,
          (node as any).style ?? 0,
          ((node as any).patternLines ?? []).map((pl: any) => ({
            angle: pl.angle,
            base_x: pl.base_x,
            base_y: pl.base_y,
            offset_x: pl.offset_x,
            offset_y: pl.offset_y,
            dashes: pl.dashes,
          })),
        );
      case 'dimension':
        return this._createDimension(
          { x: node.defX, y: node.defY, z: 0 },
          { x: node.midX, y: node.midY, z: 0 },
          node.content,
          node.rotation,
          color,
          lineWidth,
        );
      case 'insert':
        // 完整的 BlockRef 展开尚未实现（见实施方案 P2 阶段）。
        // 暂时绘制一个十字+小圈，让块插入点至少在画面上能看到，便于定位。
        return this._createInsertPlaceholder(
          { x: node.posX, y: node.posY, z: 0 },
          Math.max(Math.abs(node.scaleX), Math.abs(node.scaleY)) || 1,
          color,
          lineWidth,
        );
      default:
        return null;
    }
  }

  /**
   * 把 cadbin 里的 u32 颜色解码成可见的 THREE.Color：
   *   1) 0xFFFFFF / 负数 / 0xFFFFFFFF（ByLayer 兜底）→ 优先用 layer.color
   *   2) layer.color 也是 0/-1 → defaultLineColor
   *   3) 解码后亮度过低 → defaultLineColor（深色底"看不见黑实体"）
   *   4) 其它情况返回原色
   * 这是修复"专业 CAD 工具看得到、我们这看不到"的关键之一。
   */
  private _createEntityRenderContext(): import("./cad_runtime/entity_renderers/EntityRenderer").EntityRenderContext {
    return {
      scene: this._scene,
      camera: this._camera,
      renderer: this._renderer,
      viewport: { width: this._canvasWidth, height: this._canvasHeight },
      zoom: this._camera.zoom,
      frameTime: performance.now(),
    };
  }

  private _resolveColor(rawColor: number, layerName?: string): THREE.Color {
    if (rawColor === 0xFFFFFF || rawColor === 0xFFFFFFFF || rawColor < 0) {
      if (layerName) {
        const layer = this._layerIndex.get(layerName);
        if (layer && layer.color > 0 && layer.color !== 0xFFFFFF) {
          const lc = this._intToColor(layer.color);
          return this._adjustColorForBackground(lc);
        }
      }
      return this._defaultLineColor.clone();
    }
    const c = this._intToColor(rawColor);
    return this._adjustColorForBackground(c);
  }

  private _adjustColorForBackground(color: THREE.Color): THREE.Color {
    const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    if (this._isDarkBackground) {
      if (luma < MIN_LUMINANCE_ON_DARK_BG) {
        return this._brightenToTarget(color, TARGET_LUMINANCE_DARK);
      }
    } else {
      if (luma > MAX_LUMINANCE_ON_LIGHT_BG) {
        return this._darkenToTarget(color, TARGET_LUMINANCE_LIGHT);
      }
    }
    return color.clone();
  }

  private _brightenToTarget(color: THREE.Color, targetLuma: number): THREE.Color {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    if (hsl.s < 0.01) {
      return new THREE.Color().setHSL(hsl.h, 0, targetLuma);
    }
    const newL = Math.max(targetLuma, hsl.l);
    return new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, 1), newL);
  }

  private _darkenToTarget(color: THREE.Color, targetLuma: number): THREE.Color {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    if (hsl.s < 0.01) {
      return new THREE.Color().setHSL(hsl.h, 0, targetLuma);
    }
    const newL = Math.min(targetLuma, hsl.l);
    return new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, 1), newL);
  }

  private _computeIsDark(color: THREE.Color): boolean {
    const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    return luma < 0.5;
  }

  setBackgroundColor(color: string): void {
    const newBg = new THREE.Color(color);
    const wasDark = this._isDarkBackground;
    this._isDarkBackground = this._computeIsDark(newBg);
    this._backgroundColor = newBg;
    if (!this._transparentBackground) {
      this._scene.background = newBg;
    }
    if (wasDark !== this._isDarkBackground) {
      this._refreshAllEntityColors();
    }
  }

  isDarkBackground(): boolean {
    return this._isDarkBackground;
  }

  setLineColor(color: string): void {
    this._defaultLineColor = new THREE.Color(color);
    this._refreshAllEntityColors();
  }

  getBackgroundColor(): string {
    return '#' + this._backgroundColor.getHexString();
  }

  private _refreshAllEntityColors(): void {
    for (const [id, node] of this._nodeIndex) {
      const newColor = this._resolveColor(node.color, node.layer);
      this._entityColors.set(id, newColor.clone());

      if (this._batchedBuilder.hasEntity(id)) {
        const positions = this._extractLinePositions(node);
        if (positions && positions.length >= 6) {
          this._batchedBuilder.removeEntity(id, this._scene);
          const rawLw = (node as { lineWeight?: number }).lineWeight;
          const lineWidth = (rawLw !== undefined && Number.isFinite(rawLw) && rawLw > 0)
            ? Math.max(1, Math.min(rawLw * 1.5, 5))
            : DEFAULT_LINE_WIDTH;
          this._batchedBuilder.addLineSegments(id, node.layer, newColor, lineWidth, positions, this._scene);
        }
      } else {
        const mesh = this._entityMeshes.get(id);
        if (mesh && !this._selectedEntityIds.has(id)) {
          mesh.traverse((child) => {
            if (child instanceof Line2) {
              (child.material as LineMaterial).color.copy(newColor);
            } else if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
              if ('color' in (child.material as THREE.Material)) {
                ((child.material as THREE.Material) as any).color.copy(newColor);
              }
            }
          });
        }
      }
    }
    this._batchedBuilder.rebuildDirty(this._scene);
    this._requestRender();
  }

  /**
   * INSERT 占位渲染：用十字+小圆圈表示块的插入点。
   * 等 BlockTable 把子实体几何写入 .cadbin 后，会替换为真正的实例化渲染。
   */
  private _createInsertPlaceholder(
    pos: { x: number; y: number; z: number },
    scale: number,
    color: THREE.Color,
    lineWidth: number,
  ): THREE.Object3D {
    const group = new THREE.Group();
    const armSize = 6 * scale;
    const horizontal = this._createLine(
      { x: pos.x - armSize, y: pos.y, z: 0 },
      { x: pos.x + armSize, y: pos.y, z: 0 },
      color,
      lineWidth,
    );
    const vertical = this._createLine(
      { x: pos.x, y: pos.y - armSize, z: 0 },
      { x: pos.x, y: pos.y + armSize, z: 0 },
      color,
      lineWidth,
    );
    const ring = this._createCircle(pos, armSize * 0.6, color, lineWidth);
    if (horizontal) group.add(horizontal);
    if (vertical) group.add(vertical);
    if (ring) group.add(ring);
    return group;
  }

  setLayerVisible(layerName: string, visible: boolean): void {
    if (visible) {
      this._hiddenLayers.delete(layerName);
    } else {
      this._hiddenLayers.add(layerName);
    }
    const layer = this._layerIndex.get(layerName);
    if (layer) {
      layer.visible = visible;
    }

    const layerGroup = this._layerGroups.get(layerName);
    if (layerGroup) {
      layerGroup.visible = visible;
    }

    this._batchedBuilder.setLayerVisible(layerName, visible);
    this._sdfTextRenderer.setLayerVisible(layerName, visible);
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }

    const entitySet = this._layerEntityIndex.get(layerName);
    if (entitySet) {
      for (const id of entitySet) {
        if (!this._individualEntities.has(id)) continue;
        if (visible) {
          this._logicallyHidden.delete(id);
        } else {
          this._logicallyHidden.add(id);
        }
      }
    }

    this._requestRender();
  }

  setMultipleLayersVisible(changes: Array<{ layerName: string; visible: boolean }>): void {
    const layerNames: string[] = [];

    for (const { layerName, visible } of changes) {
      layerNames.push(layerName);
      
      if (visible) {
        this._hiddenLayers.delete(layerName);
      } else {
        this._hiddenLayers.add(layerName);
      }
      const layer = this._layerIndex.get(layerName);
      if (layer) {
        layer.visible = visible;
      }

      const layerGroup = this._layerGroups.get(layerName);
      if (layerGroup) {
        layerGroup.visible = visible;
      }

      this._batchedBuilder.setLayerVisible(layerName, visible);
      this._sdfTextRenderer.setLayerVisible(layerName, visible);
    }

    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }

    for (const layerName of layerNames) {
      const entitySet = this._layerEntityIndex.get(layerName);
      if (entitySet) {
        for (const id of entitySet) {
          if (!this._individualEntities.has(id)) continue;
          const visible = !this._hiddenLayers.has(layerName);
          if (visible) {
            this._logicallyHidden.delete(id);
          } else {
            this._logicallyHidden.add(id);
          }
        }
      }
    }

    this._requestRender();
  }

  setLayerLocked(layerName: string, locked: boolean): void {
    const layer = this._layerIndex.get(layerName);
    if (layer) layer.locked = locked;
    // 锁定的图层若有选中实体，自动取消选中
    if (locked) {
      for (const id of Array.from(this._selectedEntityIds)) {
        const sl = this._entityLayers.get(id);
        if (sl === layerName) {
          this.deselectEntity(id);
        }
      }
      this._onSelectionChanged?.(this.getSelectedEntityIds());
    }
  }

  removeLayer(layerName: string, deleteEntities: boolean): void {
    const entitySet = this._layerEntityIndex.get(layerName);
    if (entitySet) {
      for (const id of Array.from(entitySet)) {
        if (deleteEntities) {
          this.deleteEntityLocally(id);
        } else {
          const node = this._nodeIndex.get(id);
          if (node) {
            (node as { layer: string }).layer = '0';
            this._entityLayers.set(id, '0');
            this._removeNodeFromLayerGroup(id);
            this._addNodeToLayerGroup('0', this._entityMeshes.get(id)!, id);
          }
        }
      }
    }

    if (!deleteEntities && this._layerEntityIndex.has(layerName)) {
      const targetSet = this._layerEntityIndex.get('0') || new Set();
      for (const id of Array.from(this._layerEntityIndex.get(layerName) || [])) {
        targetSet.add(id);
      }
      this._layerEntityIndex.set('0', targetSet);
    }
    this._layerEntityIndex.delete(layerName);

    this._layerIndex.delete(layerName);
    this._hiddenLayers.delete(layerName);

    const layerGroup = this._layerGroups.get(layerName);
    if (layerGroup) {
      if (!deleteEntities) {
        const group0 = this._layerGroups.get('0');
        if (group0) {
          while (layerGroup.children.length > 0) {
            const child = layerGroup.children[0];
            layerGroup.remove(child);
            group0.add(child);
          }
        }
      }
      this._scene.remove(layerGroup);
      this._layerGroups.delete(layerName);
    }

    this._batchedBuilder.removeLayer(layerName, this._scene);
    this._sdfTextRenderer.removeLayer(layerName);
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }

    this._requestRender();
  }

  renameLayer(oldName: string, newName: string): void {
    if (oldName === newName) return;

    const layer = this._layerIndex.get(oldName);
    if (layer) {
      this._layerIndex.delete(oldName);
      layer.name = newName;
      this._layerIndex.set(newName, layer);
    }

    const entitySet = this._layerEntityIndex.get(oldName);
    if (entitySet) {
      this._layerEntityIndex.delete(oldName);
      this._layerEntityIndex.set(newName, entitySet);
      for (const id of entitySet) {
        const node = this._nodeIndex.get(id);
        if (node) {
          (node as { layer: string }).layer = newName;
        }
        this._entityLayers.set(id, newName);
      }
    }

    if (this._hiddenLayers.has(oldName)) {
      this._hiddenLayers.delete(oldName);
      this._hiddenLayers.add(newName);
    }
    if (this._logicallyHidden.has(oldName)) {
      this._logicallyHidden.delete(oldName);
      this._logicallyHidden.add(newName);
    }

    const layerGroup = this._layerGroups.get(oldName);
    if (layerGroup) {
      this._layerGroups.delete(oldName);
      layerGroup.name = newName;
      this._layerGroups.set(newName, layerGroup);
    }

    this._batchedBuilder.renameLayer(oldName, newName);
    this._sdfTextRenderer.renameLayer(oldName, newName);
    if (this._sdfTextRenderer.needsSync) {
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }

    this._requestRender();
  }

  /** 把图层颜色更新后，所有"按 ByLayer 解析"的实体颜色也跟着重算。 */
  setLayerColor(layerName: string, newColorRgb: number): void {
    const layer = this._layerIndex.get(layerName);
    if (!layer) return;
    layer.color = newColorRgb;

    const entitySet = this._layerEntityIndex.get(layerName);
    if (entitySet) {
      const batchedIds: string[] = [];
      for (const id of entitySet) {
        const node = this._nodeIndex.get(id);
        if (!node) continue;
        if (node.color === 0xFFFFFF || node.color === -1 || (node.color >>> 0) === 0xFFFFFFFF) {
          if (this._batchedBuilder.hasEntity(id)) {
            batchedIds.push(id);
          } else {
            this._rebuildEntityMesh(id);
          }
        }
      }
      if (batchedIds.length > 0) {
        for (const id of batchedIds) {
          this._batchedBuilder.removeEntity(id, this._scene);
        }
        for (const id of batchedIds) {
          const node = this._nodeIndex.get(id);
          if (!node) continue;
          const positions = this._extractLinePositions(node);
          if (positions && positions.length >= 6) {
            const color = this._resolveColor(node.color, node.layer);
            const rawLw = (node as { lineWeight?: number }).lineWeight;
            const lineWidth = (rawLw !== undefined && Number.isFinite(rawLw) && rawLw > 0)
              ? Math.max(1, Math.min(rawLw * 1.5, 5))
              : DEFAULT_LINE_WIDTH;
            this._batchedBuilder.addLineSegments(id, node.layer, color, lineWidth, positions, this._scene);
          }
        }
        this._batchedBuilder.rebuildDirty(this._scene);
        this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
      }
    }
    this._requestRender();
  }

  isLayerVisible(layerName: string): boolean {
    return !this._hiddenLayers.has(layerName);
  }

  isLayerLocked(layerName: string): boolean {
    return this._layerIndex.get(layerName)?.locked ?? false;
  }

  getLayers(): string[] {
    const layers = new Set<string>();
    for (const layer of this._entityLayers.values()) {
      layers.add(layer);
    }
    return Array.from(layers);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // cadbin 编辑：颜色 / 移动 / 删除（仅前端 mesh，持久化由 Engine 调后端命令）
  // ─────────────────────────────────────────────────────────────────────────

  /** 改一个实体的颜色（只改 in-memory + mesh） */
  updateEntityColor(entityId: string, newColorRgb: number): boolean {
    const node = this._nodeIndex.get(entityId);
    if (!node) return false;
    (node as { color: number }).color = newColorRgb;
    return this._rebuildEntityMesh(entityId);
  }

  /** 把实体从一个图层挪到另一个图层（更新 _entityLayers / SceneNode.layer / 重建 mesh） */
  updateEntityLayer(entityId: string, newLayer: string): boolean {
    const node = this._nodeIndex.get(entityId);
    if (!node) return false;
    this._removeNodeFromLayerGroup(entityId);
    (node as { layer: string }).layer = newLayer;
    this._entityLayers.set(entityId, newLayer);
    return this._rebuildEntityMesh(entityId);
  }

  /** 平移实体（dx/dy 是世界坐标增量） */
  moveEntity(entityId: string, dx: number, dy: number): boolean {
    const node = this._nodeIndex.get(entityId);
    if (!node) return false;
    this._translateNode(node, dx, dy);
    return this._rebuildEntityMesh(entityId);
  }

  copyEntityLocally(entityId: string, dx: number, dy: number): string | null {
    const node = this._nodeIndex.get(entityId);
    if (!node) return null;
    const newId = this._nextEntityId();
    const clone = this._deepCloneSceneNode(node, newId);
    this._translateNode(clone, dx, dy);
    this._expandDegenerateBbox(clone);
    this._nodeIndex.set(newId, clone);
    this._entityLayers.set(newId, clone.layer);
    this._entityColors.set(newId, this._resolveColor(clone.color, clone.layer).clone());

    const hiddenByLayer = this._hiddenLayers.has(clone.layer);
    const hiddenByNode = clone.visible === false;
    if (hiddenByLayer || hiddenByNode) {
      this._logicallyHidden.add(newId);
    }

    if (this._useBatchedRendering && this._isBatchableType(clone.type) && !this._selectedEntityIds.has(newId)) {
      const positions = this._extractLinePositions(clone);
      if (positions && positions.length >= 6) {
        const color = this._resolveColor(clone.color, clone.layer);
        const rawLw = (clone as { lineWeight?: number }).lineWeight;
        const lineWidth = (rawLw !== undefined && Number.isFinite(rawLw) && rawLw > 0)
          ? Math.max(1, Math.min(rawLw * 1.5, 5))
          : DEFAULT_LINE_WIDTH;
        this._batchedBuilder.addLineSegments(newId, clone.layer, color, lineWidth, positions, this._scene);
        this._addSegmentsToSpatialIndex(newId, positions);
        this._registerEntityInLayer(clone.layer, newId);
        this._batchedBuilder.rebuildDirty(this._scene);
        this._requestRender();
        return newId;
      }
    }

    if (this._useBatchedText && (clone.type === 'text' || clone.type === 'mText')) {
      const added = this._addTextToBatchedRenderer(newId, clone, clone.layer);
      if (added) {
        this._registerEntityInLayer(clone.layer, newId);
        if (hiddenByLayer || hiddenByNode) {
          this._sdfTextRenderer.setTextVisible(newId, false);
        }
        this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
        return newId;
      }
    }

    const mesh = this._createSceneNodeMesh(clone);
    if (mesh && this._validateObject3D(mesh)) {
      this._entityMeshes.set(newId, mesh);
      this._individualEntities.add(newId);
      this._addEntityToSpatialIndex(newId, clone);
      if (hiddenByLayer || hiddenByNode) {
        mesh.visible = false;
      }
      this._addNodeToLayerGroup(clone.layer, mesh, newId);
    } else {
      this._nodeIndex.delete(newId);
      this._entityLayers.delete(newId);
      this._entityColors.delete(newId);
      this._logicallyHidden.delete(newId);
      return null;
    }

    this._requestRender();
    return newId;
  }

  copyEntitiesLocally(entityIds: string[], dx: number, dy: number): string[] {
    const newIds: string[] = [];
    for (const id of entityIds) {
      const newId = this.copyEntityLocally(id, dx, dy);
      if (newId) newIds.push(newId);
    }
    return newIds;
  }

  private _nextEntityId(): string {
    let maxId = 0;
    for (const key of this._nodeIndex.keys()) {
      const num = parseInt(key, 10);
      if (!isNaN(num) && num > maxId) maxId = num;
    }
    return String(maxId + 1);
  }

  private _deepCloneSceneNode(node: SceneNode, newId: string): SceneNode {
    const clone = JSON.parse(JSON.stringify(node)) as SceneNode;
    clone.id = parseInt(newId, 10);
    return clone;
  }

  updateEntityFromProps(entityId: string, props: Record<string, unknown>): boolean {
    const node = this._nodeIndex.get(entityId);
    if (!node) return false;
    Object.assign(node, props);
    this._recomputeBbox(node);
    return this._rebuildEntityMesh(entityId);
  }

  private _recomputeBbox(node: SceneNode): void {
    switch (node.type) {
      case 'line': {
        node.bbox = { minX: Math.min(node.startX, node.endX), minY: Math.min(node.startY, node.endY), maxX: Math.max(node.startX, node.endX), maxY: Math.max(node.startY, node.endY) };
        break;
      }
      case 'circle': {
        node.bbox = { minX: node.centerX - node.radius, minY: node.centerY - node.radius, maxX: node.centerX + node.radius, maxY: node.centerY + node.radius };
        break;
      }
      case 'arc': {
        node.bbox = { minX: node.centerX - node.radius, minY: node.centerY - node.radius, maxX: node.centerX + node.radius, maxY: node.centerY + node.radius };
        break;
      }
      case 'text': {
        node.bbox = this._textNodeBbox(node);
        break;
      }
      case 'mText': {
        node.bbox = this._mTextNodeBbox(node);
        break;
      }
      case 'point': {
        node.bbox = { minX: node.posX - 1, minY: node.posY - 1, maxX: node.posX + 1, maxY: node.posY + 1 };
        break;
      }
      case 'insert': {
        node.bbox = { minX: node.posX - 10, minY: node.posY - 10, maxX: node.posX + 10, maxY: node.posY + 10 };
        break;
      }
      default:
        break;
    }
  }

  private _translateNode(node: SceneNode, dx: number, dy: number): void {
    switch (node.type) {
      case 'line':
        node.startX += dx; node.startY += dy;
        node.endX += dx; node.endY += dy;
        break;
      case 'circle':
      case 'arc':
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
      case 'text':
      case 'mText':
      case 'point':
      case 'insert':
        node.posX += dx; node.posY += dy;
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
    // bbox 同步平移
    node.bbox.minX += dx; node.bbox.maxX += dx;
    node.bbox.minY += dy; node.bbox.maxY += dy;
  }

  /** 删除实体：仅前端不渲染，并加入 _logicallyHidden（视口裁剪不会把它再打开） */
  deleteEntityLocally(entityId: string): boolean {
    if (this._batchedBuilder.hasEntity(entityId)) {
      this._batchedBuilder.removeEntity(entityId, this._scene);
      this._batchedBuilder.rebuildDirty(this._scene);
      this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
    }
    if (this._sdfTextRenderer.has(entityId)) {
      this._sdfTextRenderer.removeText(entityId);
      this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
    }
    this._spatialIndex.removeEntity(entityId);

    const oldMesh = this._entityMeshes.get(entityId);
    if (oldMesh) {
      this._removeNodeFromLayerGroup(entityId);
      oldMesh.parent?.remove(oldMesh);
      this._disposeObject3D(oldMesh, false);
      this._entityMeshes.delete(entityId);
      this._individualEntities.delete(entityId);
      this._spatialIndex.removeEntity(entityId);
    }
    this._nodeIndex.delete(entityId);
    this._entityLayers.delete(entityId);
    this._entityColors.delete(entityId);
    this._logicallyHidden.add(entityId);
    if (this._selectedEntityIds.has(entityId)) {
      this.deselectEntity(entityId);
      this._onSelectionChanged?.(this.getSelectedEntityIds());
    }
    this._requestRender();
    return true;
  }

  restoreEntityLocally(node: SceneNode): boolean {
    const idStr = String(node.id);
    if (this._nodeIndex.has(idStr)) return false;
    this._logicallyHidden.delete(idStr);
    this._expandDegenerateBbox(node);
    this._nodeIndex.set(idStr, node);
    this._entityLayers.set(idStr, node.layer);
    this._entityColors.set(idStr, this._resolveColor(node.color, node.layer).clone());

    const hiddenByLayer = this._hiddenLayers.has(node.layer);
    const hiddenByNode = node.visible === false;
    if (hiddenByLayer || hiddenByNode) {
      this._logicallyHidden.add(idStr);
    }

    if (this._useBatchedText && (node.type === 'text' || node.type === 'mText')) {
      const added = this._addTextToBatchedRenderer(idStr, node, node.layer);
      if (added) {
        this._registerEntityInLayer(node.layer, idStr);
        if (hiddenByLayer || hiddenByNode) {
          this._sdfTextRenderer.setTextVisible(idStr, false);
        }
        this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
        return true;
      }
    }

    if (this._useBatchedRendering && this._isBatchableType(node.type) && !this._selectedEntityIds.has(idStr)) {
      const positions = this._extractLinePositions(node);
      if (positions && positions.length >= 6) {
        const color = this._resolveColor(node.color, node.layer);
        const rawLw = (node as { lineWeight?: number }).lineWeight;
        const lineWidth = (rawLw !== undefined && Number.isFinite(rawLw) && rawLw > 0)
          ? Math.max(1, Math.min(rawLw * 1.5, 5))
          : DEFAULT_LINE_WIDTH;
        this._batchedBuilder.addLineSegments(idStr, node.layer, color, lineWidth, positions, this._scene);
        this._addSegmentsToSpatialIndex(idStr, positions);
        this._registerEntityInLayer(node.layer, idStr);
        this._batchedBuilder.rebuildDirty(this._scene);
        this._requestRender();
        return true;
      }
    }

    try {
      const mesh = this._createSceneNodeMesh(node);
      if (!mesh) {
        this._requestRender();
        return true;
      }
      if (!this._validateObject3D(mesh)) {
        this._disposeObject3D(mesh, false);
        return false;
      }
      this._entityMeshes.set(idStr, mesh);
      this._individualEntities.add(idStr);
      this._addEntityToSpatialIndex(idStr, node);
      if (hiddenByLayer || hiddenByNode) {
        mesh.visible = false;
      }
      this._addNodeToLayerGroup(node.layer, mesh, idStr);
      this._requestRender();
      return true;
    } catch {
      return false;
    }
  }

  addEntityLocally(node: SceneNode): boolean {
    return this.restoreEntityLocally(node);
  }

  private _estimateTextWidth(content: string, height: number, widthFactor: number = 1): number {
    const safeHeight = this._isValidNumber(height) && height > 0 ? height : 1;
    const safeWidthFactor = this._isValidNumber(widthFactor) && widthFactor > 0 ? widthFactor : 1;
    const maxUnits = content
      .split(/\r?\n|\\P/)
      .reduce((max, line) => {
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

  private _anchoredTextBbox(posX: number, posY: number, width: number, height: number, rotation: number, col: number, row: number): BoundingBox {
    const w = Math.max(Math.abs(width), 1e-6);
    const h = Math.max(Math.abs(height), 1e-6);
    const [minLocalX, maxLocalX] = col === 1 ? [-w / 2, w / 2] : col === 2 ? [-w, 0] : [0, w];
    const [minLocalY, maxLocalY] = row === 0 ? [-h, 0] : row === 1 ? [-h / 2, h / 2] : [0, h];
    const safeRotation = this._isValidNumber(rotation) ? rotation : 0;
    const cos = Math.cos(safeRotation);
    const sin = Math.sin(safeRotation);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [x, y] of [
      [minLocalX, minLocalY],
      [minLocalX, maxLocalY],
      [maxLocalX, minLocalY],
      [maxLocalX, maxLocalY],
    ]) {
      const rx = posX + x * cos - y * sin;
      const ry = posY + x * sin + y * cos;
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }

    return { minX, minY, maxX, maxY };
  }

  private _textNodeBbox(node: Extract<SceneNode, { type: 'text' }>): BoundingBox {
    const width = this._estimateTextWidth(node.content, node.height, 1);
    const col = node.horizontalAlignment === 1 || node.horizontalAlignment === 4 ? 1 : node.horizontalAlignment === 2 || node.horizontalAlignment === 3 || node.horizontalAlignment === 5 ? 2 : 0;
    const row = node.verticalAlignment === 3 ? 0 : node.verticalAlignment === 2 ? 1 : 2;
    return this._anchoredTextBbox(node.posX, node.posY, width, node.height, node.rotation, col, row);
  }

  private _mTextNodeBbox(node: Extract<SceneNode, { type: 'mText' }>): BoundingBox {
    const heightScale = this._isValidNumber(node.heightScale) && node.heightScale > 0 ? node.heightScale : 1;
    const effectiveHeight = Math.max(Math.abs(node.height * heightScale), 1e-6);
    const estimatedWidth = this._estimateTextWidth(node.content, effectiveHeight, node.widthFactor);
    const blockWidth = this._isValidNumber(node.width) && node.width > 0 ? Math.abs(node.width) : estimatedWidth;
    const lineCount = Math.max(1, node.content.split(/\r?\n|\\P/).filter(Boolean).length);
    const blockHeight = effectiveHeight * lineCount * 1.25;
    const ap = Math.max(1, Math.min(9, Math.floor(node.attachmentPoint || 1)));
    const col = (ap - 1) % 3;
    const row = Math.floor((ap - 1) / 3);
    return this._anchoredTextBbox(node.posX, node.posY, blockWidth, blockHeight, node.rotation, col, row);
  }

  private _rebuildEntityMesh(entityId: string): boolean {
    const node = this._nodeIndex.get(entityId);
    if (!node) return false;

    if (this._useBatchedText && this._sdfTextRenderer.has(entityId)) {
      this._sdfTextRenderer.removeText(entityId);
      const added = this._addTextToBatchedRenderer(entityId, node, node.layer);
      if (added) {
        if (this._hiddenLayers.has(node.layer) || node.visible === false) {
          this._sdfTextRenderer.setTextVisible(entityId, false);
        }
        if (this._selectedEntityIds.has(entityId)) {
          this._addHighlightOverlay(entityId);
        }
        this._sdfTextRenderer.sync().then(() => { if (!this._isDisposed) this._requestRender(); });
        return true;
      }
    }

    if (this._batchedBuilder.hasEntity(entityId)) {
      this._batchedBuilder.removeEntity(entityId, this._scene);
      this._spatialIndex.removeEntity(entityId);
      if (this._useBatchedRendering && this._isBatchableType(node.type) && !this._selectedEntityIds.has(entityId)) {
        const positions = this._extractLinePositions(node);
        if (positions && positions.length >= 6) {
          const color = this._resolveColor(node.color, node.layer);
          const rawLw = (node as { lineWeight?: number }).lineWeight;
          const lineWidth = (rawLw !== undefined && Number.isFinite(rawLw) && rawLw > 0)
            ? Math.max(1, Math.min(rawLw * 1.5, 5))
            : DEFAULT_LINE_WIDTH;
          this._batchedBuilder.addLineSegments(entityId, node.layer, color, lineWidth, positions, this._scene);
          this._addSegmentsToSpatialIndex(entityId, positions);
          this._batchedBuilder.rebuildDirty(this._scene);
          this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
          this._requestRender();
          return true;
        }
      }
      this._batchedBuilder.rebuildDirty(this._scene);
      this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
    }

    const oldMesh = this._entityMeshes.get(entityId);

    if (oldMesh) {
      const oldMatMap = this._selectedOriginalMaterials.get(entityId);
      if (oldMatMap) {
        oldMesh.traverse((child) => {
          if (oldMatMap.has(child.uuid)) {
            if (child instanceof Line2) {
              child.material.dispose();
            } else if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
              child.material.dispose();
            }
          }
        });
        this._selectedOriginalMaterials.delete(entityId);
      }
      this._removeNodeFromLayerGroup(entityId);
      oldMesh.parent?.remove(oldMesh);
      this._disposeObject3D(oldMesh, false);
      this._entityMeshes.delete(entityId);
      this._individualEntities.delete(entityId);
    }

    const layerName = this._entityLayers.get(entityId);
    if (layerName) {
      const layerGroup = this._layerGroups.get(layerName);
      if (layerGroup) {
        const staleChildren: THREE.Object3D[] = [];
        layerGroup.traverse((child) => {
          if (child.userData.__entityId === entityId && child !== oldMesh) {
            staleChildren.push(child);
          }
        });
        for (const stale of staleChildren) {
          stale.parent?.remove(stale);
          this._disposeObject3D(stale, false);
        }
      }
    }

    this._spatialIndex.removeEntity(entityId);
    const newMesh = this._createSceneNodeMesh(node);
    if (!newMesh) return false;
    this._entityMeshes.set(entityId, newMesh);
    this._individualEntities.add(entityId);
    this._addEntityToSpatialIndex(entityId, node);
    this._entityLayers.set(entityId, node.layer);
    if (this._logicallyHidden.has(entityId) || this._hiddenLayers.has(node.layer)) {
      newMesh.visible = false;
    }
    this._addNodeToLayerGroup(node.layer, newMesh, entityId);
    if (this._selectedEntityIds.has(entityId)) {
      this._applyHighlightMaterial(entityId, newMesh);
    }
    this._scheduleViewportCulling();
    this._requestRender();

    this._batchedBuilder.pruneOrphanedLineSegments(this._scene);
    return true;
  }

  private _clearEntities(): void {
    if (this._deferredTimer !== null) {
      cancelAnimationFrame(this._deferredTimer);
      this._deferredTimer = null;
    }
    this._deferredNodes = [];
    this._isProgressiveLoading = false;
    this._initialSpan = 0;  // 重置，新文档加载后由 _applyExtents 重新计算
    for (const mesh of this._entityMeshes.values()) {
      this._disposeObject3D(mesh);
    }
    for (const group of this._layerGroups.values()) {
      this._scene.remove(group);
    }
    this._batchedBuilder.clear(this._scene);
    this._sdfTextRenderer.clear();
    this._spatialIndex.clear();
    this._layerGroups.clear();
    this._layerEntityIndex.clear();
    this._entityMeshes.clear();
    this._individualEntities.clear();
    this._nodeIndex.clear();
    this._entityColors.clear();
    this._layerIndex.clear();
    this._logicallyHidden.clear();
    this._placeholderMap.clear();
    this._externalBounds = null;
  }

  private _disposeObject3D(obj: THREE.Object3D, disposeMaterial: boolean = true): void {
    obj.traverse((child) => {
      if (child instanceof TroikaText) {
        child.dispose();
      } else if (child instanceof Line2) {
        child.geometry.dispose();
        if (disposeMaterial) child.material.dispose();
      } else if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Points) {
        child.geometry.dispose();
        if (disposeMaterial) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  private _createEntityMesh(entity: CadEntity): THREE.Object3D | null {
    let color = this._intToColor(entity.color);
    if (entity.color === 0xFFFFFF) {
      color = this._defaultLineColor.clone();
    }
    const lineWidth = (entity as any).line_weight && this._isValidNumber((entity as any).line_weight) && (entity as any).line_weight > 0
      ? Math.max(1, Math.min((entity as any).line_weight, 5))
      : DEFAULT_LINE_WIDTH;

    switch (entity.type) {
      case 'Line':
        return this._createLine(entity.start, entity.end, color, lineWidth);
      case 'Circle':
        return this._createCircle(entity.center, entity.radius, color, lineWidth);
      case 'Arc':
        return this._createArc(entity.center, entity.radius, entity.start_angle, entity.end_angle, color, lineWidth);
      case 'Polyline':
        return this._createPolyline(entity.vertices, entity.closed, color, lineWidth);
      case 'LwPolyline':
        return this._createLwPolyline(entity.vertices, entity.closed, color, lineWidth);
      case 'Ellipse':
        return this._createEllipse(entity.center, entity.major_axis, entity.minor_axis_ratio, entity.start_angle, entity.end_angle, color, lineWidth);
      case 'Spline':
        return this._createSpline(entity.control_points, entity.fit_points, entity.knots, entity.degree, color, lineWidth);
      case 'Text': {
        const ap = this._textAlignmentToAttachmentPoint(
          (entity as any).horizontal_alignment ?? 0,
          (entity as any).vertical_alignment ?? 0,
        );
        return this._createText(entity.position, entity.content, entity.height, entity.rotation, color, ap);
      }
      case 'MText':
        return this._createText(entity.position, entity.content, entity.height, entity.rotation, color, entity.attachment_point ?? 1, (entity as any).width ?? 0, (entity as any).width_factor ?? 1.0, (entity as any).font_name ?? '', (entity as any).height_scale ?? 1.0);
      case 'Solid':
        return this._createSolid(entity.points, color);
      case 'Point':
        return this._createPoint(entity.position, color);
      case 'Insert':
        return this._renderInsert(entity);
      case 'Hatch':
        return this._createHatch(
          entity.boundaries,
          entity.solid,
          entity.scale,
          entity.angle,
          color,
          lineWidth,
          (entity as any).style ?? 0,
          ((entity as any).pattern_lines ?? []).map((pl: any) => ({
            angle: pl.angle,
            base_x: pl.base_x,
            base_y: pl.base_y,
            offset_x: pl.offset_x,
            offset_y: pl.offset_y,
            dashes: pl.dashes,
          })),
        );
      case 'Dimension':
        return this._createDimension(entity.definition_point, entity.text_midpoint, entity.content, entity.rotation, color, lineWidth);
      default:
        return null;
    }
  }

  private _intToColor(colorInt: number): THREE.Color {
    // 强制按 u32 解释；cadbin 中 ByLayer 写成 0xFFFFFFFF，JS 取符号位会变 -1，需要 >>> 0 回正。
    const u = colorInt >>> 0;
    const r = (u >>> 16) & 0xff;
    const g = (u >>> 8) & 0xff;
    const b = u & 0xff;
    return new THREE.Color(r / 255, g / 255, b / 255);
  }

  private _createLine(start: CadPoint, end: CadPoint, color: THREE.Color, lineWidth: number): Line2 | null {
    if (!this._isValidPoint(start) || !this._isValidPoint(end)) {
      return null;
    }

    // Drop degenerate / near-zero-length lines that would render as scattered
    // pixel artifacts (round linecap on zero-length Line2). This matches how
    // AutoCAD and Illustrator handle such geometry.
    const MIN_LINE_LENGTH = 0.1;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    if (dx * dx + dy * dy + dz * dz < MIN_LINE_LENGTH * MIN_LINE_LENGTH) {
      return null;
    }

    const points = [
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3(end.x, end.y, end.z),
    ];

    return this._createLine2FromPoints(points, color, lineWidth);
  }

  private _createCircle(center: CadPoint, radius: number, color: THREE.Color, lineWidth: number): Line2 | null {
    if (!this._isValidPoint(center) || !this._isValidNumber(radius) || radius <= 0) {
      return null;
    }

    const segments = this._adaptiveArcSegments(radius, Math.PI * 2);
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius,
        center.z
      ));
    }

    return this._createLine2FromPoints(points, color, lineWidth);
  }

  private _createArc(
    center: CadPoint,
    radius: number,
    startAngle: number,
    endAngle: number,
    color: THREE.Color,
    lineWidth: number
  ): Line2 | null {
    if (!this._isValidPoint(center) || !this._isValidNumber(radius) || radius <= 0) {
      return null;
    }

    if (!this._isValidNumber(startAngle) || !this._isValidNumber(endAngle)) {
      return null;
    }

    let angleRange = endAngle - startAngle;
    if (angleRange < 0) {
      angleRange += Math.PI * 2;
    }
    if (angleRange < 1e-10) {
      return null;
    }

    const segments = this._adaptiveArcSegments(radius, angleRange);
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * angleRange;
      points.push(new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius,
        center.z
      ));
    }

    return this._createLine2FromPoints(points, color, lineWidth);
  }

  private _createPolyline(vertices: CadPoint[], closed: boolean, color: THREE.Color, lineWidth: number): Line2 | null {
    const validVertices = vertices.filter(v => this._isValidPoint(v));
    if (validVertices.length === 0) {
      return null;
    }

    const points = validVertices.map(v => new THREE.Vector3(v.x, v.y, v.z));

    if (closed && points.length > 0) {
      points.push(points[0].clone());
    }

    return this._createLine2FromPoints(points, color, lineWidth);
  }

  private _createLwPolyline(vertices: CadLwVertex[], closed: boolean, color: THREE.Color, lineWidth: number): Line2 | null {
    if (!vertices || vertices.length === 0) {
      return null;
    }

    const validVertices = vertices.filter(v => this._isValidNumber(v.x) && this._isValidNumber(v.y) && this._isValidNumber(v.bulge));
    if (validVertices.length === 0) {
      return null;
    }

    const points: THREE.Vector3[] = [];

    for (let i = 0; i < validVertices.length; i++) {
      const v = validVertices[i];
      points.push(new THREE.Vector3(v.x, v.y, 0));

      const nextIdx = closed ? (i + 1) % validVertices.length : i + 1;
      if (nextIdx >= validVertices.length) continue;

      const nextV = validVertices[nextIdx];

      if (Math.abs(v.bulge) > 1e-9) {
        const arcPoints = this._bulgeToArc(v, nextV);
        for (const p of arcPoints) {
          if (this._isValidVector3(p)) {
            points.push(p);
          }
        }
      }
    }

    if (closed && points.length > 0) {
      points.push(points[0].clone());
    }

    return this._createLine2FromPoints(points, color, lineWidth);
  }

  private _bulgeToArc(start: CadLwVertex, end: CadLwVertex): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const bulge = start.bulge;

    if (!this._isValidNumber(bulge)) {
      return points;
    }

    const sx = start.x, sy = start.y;
    const ex = end.x, ey = end.y;

    const dx = ex - sx;
    const dy = ey - sy;
    const chordLength = Math.sqrt(dx * dx + dy * dy);

    if (chordLength < 1e-10) {
      return points;
    }

    const includedAngle = 4 * Math.atan(Math.abs(bulge));
    if (includedAngle < 1e-10 || includedAngle >= Math.PI * 2 - 1e-10) {
      return points;
    }

    const sinHalfAngle = Math.sin(includedAngle / 2);
    if (Math.abs(sinHalfAngle) < 1e-10) {
      return points;
    }

    const radius = chordLength / (2 * sinHalfAngle);
    if (!this._isValidNumber(radius) || radius <= 0 || !isFinite(radius)) {
      return points;
    }

    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;

    const chordDirX = dx / chordLength;
    const chordDirY = dy / chordLength;

    const perpX = -chordDirY;
    const perpY = chordDirX;

    const sagitta = radius * (1 - Math.cos(includedAngle / 2));
    const sign = bulge > 0 ? 1 : -1;

    const cx = midX + sign * perpX * sagitta;
    const cy = midY + sign * perpY * sagitta;

    if (!this._isValidNumber(cx) || !this._isValidNumber(cy)) {
      return points;
    }

    let startAngle = Math.atan2(sy - cy, sx - cx);
    let endAngle = Math.atan2(ey - cy, ex - cx);

    if (!this._isValidNumber(startAngle) || !this._isValidNumber(endAngle)) {
      return points;
    }

    if (bulge > 0) {
      while (endAngle <= startAngle) {
        endAngle += Math.PI * 2;
      }
    } else {
      while (endAngle >= startAngle) {
        endAngle -= Math.PI * 2;
      }
    }

    const segments = Math.max(8, Math.ceil(Math.abs(includedAngle) / (Math.PI / 32)));
    const angleStep = (endAngle - startAngle) / segments;

    for (let i = 1; i < segments; i++) {
      const angle = startAngle + angleStep * i;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (this._isValidNumber(x) && this._isValidNumber(y)) {
        points.push(new THREE.Vector3(x, y, 0));
      }
    }

    return points;
  }

  private _createEllipse(
    center: CadPoint,
    majorAxis: CadPoint,
    minorAxisRatio: number,
    startAngle: number,
    endAngle: number,
    color: THREE.Color,
    lineWidth: number
  ): Line2 | null {
    if (!this._isValidPoint(center) || !this._isValidPoint(majorAxis)) {
      return null;
    }

    const majorLength = Math.sqrt(majorAxis.x ** 2 + majorAxis.y ** 2 + majorAxis.z ** 2);
    if (majorLength < 1e-10 || !this._isValidNumber(majorLength)) {
      return null;
    }

    if (!this._isValidNumber(minorAxisRatio) || minorAxisRatio <= 0) {
      return null;
    }

    if (!this._isValidNumber(startAngle) || !this._isValidNumber(endAngle)) {
      return null;
    }

    const segments = 64;
    const points: THREE.Vector3[] = [];
    const minorLength = majorLength * minorAxisRatio;
    const rotation = Math.atan2(majorAxis.y, majorAxis.x);

    let angleRange = endAngle - startAngle;
    if (angleRange < 0) {
      angleRange += Math.PI * 2;
    }
    if (angleRange < 1e-10) {
      return null;
    }

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * angleRange;
      const x = Math.cos(angle) * majorLength;
      const y = Math.sin(angle) * minorLength;

      const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
      const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);

      points.push(new THREE.Vector3(
        center.x + rotatedX,
        center.y + rotatedY,
        center.z
      ));
    }

    return this._createLine2FromPoints(points, color, lineWidth);
  }

  private _createSpline(
    controlPoints: CadPoint[],
    fitPoints: CadPoint[],
    _knots: number[],
    degree: number,
    color: THREE.Color,
    lineWidth: number
  ): Line2 | null {
    if (fitPoints.length >= 2) {
      return this._createSplineFromFitPoints(fitPoints, color, lineWidth);
    }

    const validPoints = controlPoints.filter(p => this._isValidPoint(p));
    if (validPoints.length < 2) {
      return this._createPolyline(validPoints, false, color, lineWidth);
    }

    const points: THREE.Vector3[] = [];

    const numSamples = Math.max(validPoints.length * 10, 50);
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const point = this._evaluateBSpline(validPoints, t, degree);
      if (this._isValidPoint(point)) {
        points.push(new THREE.Vector3(point.x, point.y, point.z));
      }
    }

    return this._createLine2FromPoints(points, color, lineWidth);
  }

  private _createSplineFromFitPoints(fitPoints: CadPoint[], color: THREE.Color, lineWidth: number): Line2 | null {
    const validPoints = fitPoints.filter(p => this._isValidPoint(p));
    if (validPoints.length < 2) {
      return null;
    }

    const points: THREE.Vector3[] = [];

    for (let i = 0; i < validPoints.length - 1; i++) {
      const p0 = validPoints[Math.max(0, i - 1)];
      const p1 = validPoints[i];
      const p2 = validPoints[Math.min(validPoints.length - 1, i + 1)];
      const p3 = validPoints[Math.min(validPoints.length - 1, i + 2)];

      if (!this._isValidPoint(p0) || !this._isValidPoint(p1) || 
          !this._isValidPoint(p2) || !this._isValidPoint(p3)) {
        continue;
      }

      const segments = 10;
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const t2 = t * t;
        const t3 = t2 * t;

        const catmullRom = [
          -0.5 * t3 + t2 - 0.5 * t,
          1.5 * t3 - 2.5 * t2 + 1,
          -1.5 * t3 + 2 * t2 + 0.5 * t,
          0.5 * t3 - 0.5 * t2
        ];

        const x = catmullRom[0] * p0.x + catmullRom[1] * p1.x + catmullRom[2] * p2.x + catmullRom[3] * p3.x;
        const y = catmullRom[0] * p0.y + catmullRom[1] * p1.y + catmullRom[2] * p2.y + catmullRom[3] * p3.y;
        const z = catmullRom[0] * p0.z + catmullRom[1] * p1.z + catmullRom[2] * p2.z + catmullRom[3] * p3.z;

        if (this._isValidNumber(x) && this._isValidNumber(y) && this._isValidNumber(z)) {
          points.push(new THREE.Vector3(x, y, z));
        }
      }
    }

    return this._createLine2FromPoints(points, color, lineWidth);
  }

  private _evaluateBSpline(points: CadPoint[], t: number, _degree: number): CadPoint {
    if (points.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    if (points.length === 1) {
      const p = points[0];
      if (!this._isValidPoint(p)) {
        return { x: 0, y: 0, z: 0 };
      }
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

    if (!this._isValidPoint(p0) || !this._isValidPoint(p1) || 
        !this._isValidPoint(p2) || !this._isValidPoint(p3)) {
      return { x: 0, y: 0, z: 0 };
    }

    const t2 = localT * localT;
    const t3 = t2 * localT;

    const catmullRom = [
      -0.5 * t3 + t2 - 0.5 * localT,
      1.5 * t3 - 2.5 * t2 + 1,
      -1.5 * t3 + 2 * t2 + 0.5 * localT,
      0.5 * t3 - 0.5 * t2
    ];

    const x = catmullRom[0] * p0.x + catmullRom[1] * p1.x + catmullRom[2] * p2.x + catmullRom[3] * p3.x;
    const y = catmullRom[0] * p0.y + catmullRom[1] * p1.y + catmullRom[2] * p2.y + catmullRom[3] * p3.y;
    const z = catmullRom[0] * p0.z + catmullRom[1] * p1.z + catmullRom[2] * p2.z + catmullRom[3] * p3.z;

    return {
      x: this._isValidNumber(x) ? x : 0,
      y: this._isValidNumber(y) ? y : 0,
      z: this._isValidNumber(z) ? z : 0,
    };
  }

  /**
   * 将 CAD Text 的 horizontal_alignment + vertical_alignment 映射为 MText 的 attachmentPoint。
   * horizontal: 0=Left 1=Center 2=Right 3=Aligned 4=Middle 5=Fit
   * vertical:   0=Baseline 1=Bottom 2=Middle 3=Top
   * attachmentPoint: 1=左上 2=中上 3=右上 / 4=左中 5=正中 6=右中 / 7=左下 8=中下 9=右下
   *
   * 关键：CAD Text 的 Baseline 表示文字基线（大写字母底部）在插入点上，
   * 对应 TroikaText 的 anchorY='bottom'，即 attachmentPoint 的"下"行(row=2)。
   * 之前的映射将 Baseline 错误地映射到"中"行(row=1)，导致文字整体下移半个字高，
   * 与线条重叠。
   */
  private _textAlignmentToAttachmentPoint(hAlign: number, vAlign: number): number {
    // 修复缺陷3：正确映射DXF对齐方式到TroikaText锚点
    // 水平对齐：0/3/4 -> col=0(left), 1 -> col=1(center), 2 -> col=2(right)
    const col = hAlign === 1 ? 1 : hAlign === 2 ? 2 : 0;
    // 垂直对齐：0(baseline)/1(bottom) -> row=2(bottom), 2 -> row=1(middle), 3 -> row=0(top)
    const row = vAlign === 3 ? 0 : vAlign === 2 ? 1 : 2;
    return row * 3 + col + 1;
  }

  private _addTextToBatchedRenderer(idStr: string, node: SceneNode, layer: string): boolean {
    try {
      const color = this._resolveColor(node.color, layer);
      const textNode = node as any;
      const content = textNode.content ?? '';
      if (!content || content.trim().length === 0) return false;

      const height = textNode.height;
      if (!this._isValidNumber(height) || height <= 0) return false;

      // 应用坐标变换：从CAD坐标转换为显示坐标
      let position = { x: textNode.posX ?? 0, y: textNode.posY ?? 0, z: 0 };
      if (this._transformParams) {
        const transformed = applyTransform(
          { x: position.x, y: position.y },
          this._transformParams
        );
        position = { x: transformed.x, y: transformed.y, z: 0 };
      }
      if (!this._isValidPoint(position)) return false;

      const rotation = this._isValidNumber(textNode.rotation) ? textNode.rotation : 0;
      const widthFactor = (this._isValidNumber(textNode.widthFactor) && textNode.widthFactor > 0) ? textNode.widthFactor : 1.0;
      const heightScale = (this._isValidNumber(textNode.heightScale) && textNode.heightScale > 0) ? textNode.heightScale : 1.0;
      const fontSize = height * heightScale;

      let attachmentPoint: number;
      if (node.type === 'text') {
        attachmentPoint = this._textAlignmentToAttachmentPoint(
          textNode.horizontalAlignment ?? 0,
          textNode.verticalAlignment ?? 0,
        );
      } else {
        attachmentPoint = textNode.attachmentPoint ?? 1;
      }

      const ap = Math.max(1, Math.min(9, Math.floor(attachmentPoint)));
      const col = ((ap - 1) % 3);
      const row = Math.floor((ap - 1) / 3);
      const anchorX = col === 0 ? 'left' : col === 1 ? 'center' : 'right';
      const anchorY = row === 0 ? 'top' : row === 1 ? 'middle' : 'bottom';

      const rectWidth = textNode.width ?? 0;
      const maxWidth = (rectWidth > 0 && this._isValidNumber(rectWidth)) ? rectWidth / widthFactor : undefined;

      const lines = content.split(/\r?\n|\\P/).filter((s: string) => s.length > 0);
      if (lines.length === 0) return false;
      const textContent = lines.join('\n');

      const estWidth = this._estimateTextWidth(textContent, fontSize, widthFactor);

      this._sdfTextRenderer.addText(
        idStr,
        textContent,
        position,
        fontSize,
        color,
        rotation,
        anchorX,
        anchorY,
        maxWidth,
        widthFactor,
        layer,
        estWidth,
      );
      return true;
    } catch (_e) {
      return false;
    }
  }

  /**
   * MText 风格的多行文字渲染。
   * @param attachmentPoint DXF 71 组码：1=左上 2=中上 3=右上 / 4=左中 5=正中 6=右中 / 7=左下 8=中下 9=右下
   * 文字 plane 的中心通过 attachmentPoint 反推到 (position.x, position.y)。
   */
  private _createText(
    position: CadPoint,
    content: string,
    height: number,
    rotation: number,
    color: THREE.Color,
    attachmentPoint: number = 1,
    rectWidth: number = 0,
    widthFactor: number = 1.0,
    _fontName: string = '',
    heightScale: number = 1.0,
  ): THREE.Group | null {
    if (!this._isValidPoint(position)) {
      return null;
    }

    if (!this._isValidNumber(height) || height <= 0) {
      return null;
    }

    if (!content || content.trim().length === 0) {
      return null;
    }

    if (!this._isValidNumber(rotation)) {
      rotation = 0;
    }

    const lines = content.split(/\r?\n|\\P/).filter(s => s.length > 0);
    if (lines.length === 0) return null;

    const group = new THREE.Group();

    const effectiveWidthFactor = (this._isValidNumber(widthFactor) && widthFactor > 0) ? widthFactor : 1.0;
    const effectiveHeightScale = (this._isValidNumber(heightScale) && heightScale > 0) ? heightScale : 1.0;

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
    textMesh.maxWidth = (rectWidth > 0 && this._isValidNumber(rectWidth)) ? rectWidth / effectiveWidthFactor : undefined;
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

  private _createTextPlaceholder(
    position: CadPoint,
    height: number,
    rotation: number,
    color: THREE.Color,
    widthFactor: number = 1.0,
  ): THREE.Mesh | null {
    if (!this._isValidPoint(position) || !this._isValidNumber(height) || height <= 0) {
      return null;
    }
    const w = height * 0.6 * (this._isValidNumber(widthFactor) && widthFactor > 0 ? widthFactor : 1.0);
    const h = height;
    const geometry = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    mesh.position.set(position.x, position.y, position.z || 0);
    mesh.rotation.z = rotation || 0;
    return mesh;
  }

  private _createSolid(points: CadPoint[], color: THREE.Color): THREE.Mesh | null {
    const validPoints = points.filter(p => this._isValidPoint(p));
    if (validPoints.length < 3) {
      return null;
    }

    const shape = new THREE.Shape();

    shape.moveTo(validPoints[0].x, validPoints[0].y);
    for (let i = 1; i < validPoints.length; i++) {
      shape.lineTo(validPoints[i].x, validPoints[i].y);
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    });

    return new THREE.Mesh(geometry, material);
  }

  // PDMODE=0 / PDSIZE=0 means points are displayed as 1:1 pixel dots in AutoCAD —
  // effectively invisible in engineering drawings. Illustrator silently drops them;
  // we do the same. Point entities are still parsed and stored in SceneGraph for
  // selection/pick purposes but never rendered as visible geometry.
  private _createPoint(_position: CadPoint, _color: THREE.Color): THREE.Group | null {
    return null;
  }

  private _createHatch(
    boundaries: CadLwVertex[][],
    solid: boolean,
    scale: number,
    angle: number,
    color: THREE.Color,
    lineWidth: number,
    style: number = 0,
    patternLines: Array<{ angle: number; base_x: number; base_y: number; offset_x: number; offset_y: number; dashes: number[] }> = [],
  ): THREE.Object3D | null {
    if (!boundaries || boundaries.length === 0) {
      return null;
    }

    const group = new THREE.Group();

    const allPaths: CadLwVertex[][] = [];
    for (const path of boundaries) {
      const validVertices = path.filter(v => this._isValidNumber(v.x) && this._isValidNumber(v.y) && this._isValidNumber(v.bulge));
      if (validVertices.length < 3) continue;
      allPaths.push(validVertices);
    }
    if (allPaths.length === 0) return null;

    if (solid) {
      const fillPaths = this._getHatchFillPaths(allPaths, style);
      const mergedPositions: number[] = [];
      const mergedIndices: number[] = [];
      let vertexOffset = 0;
      for (const path of fillPaths) {
        const shape = new THREE.Shape();
        shape.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          shape.lineTo(path[i].x, path[i].y);
        }
        shape.closePath();

        try {
          const shapeGeo = new THREE.ShapeGeometry(shape);
          const posArr = shapeGeo.getAttribute('position');
          for (let i = 0; i < posArr.count; i++) {
            mergedPositions.push(posArr.getX(i), posArr.getY(i), posArr.getZ(i));
          }
          const idxArr = shapeGeo.getIndex();
          if (idxArr) {
            for (let i = 0; i < idxArr.count; i++) {
              mergedIndices.push(idxArr.getX(i) + vertexOffset);
            }
          }
          vertexOffset += posArr.count;
          shapeGeo.dispose();
        } catch {
          // skip invalid shapes
        }
      }
      if (mergedPositions.length > 0) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3));
        if (mergedIndices.length > 0) {
          geometry.setIndex(mergedIndices);
        }
        const material = new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.3,
        });
        group.add(new THREE.Mesh(geometry, material));
      }
    } else if (patternLines.length > 0) {
      const fillPaths = this._getHatchFillPaths(allPaths, style);
      const patternGroup = this._createHatchPatternFromDefinition(fillPaths, scale, patternLines, color, lineWidth);
      if (patternGroup) group.add(patternGroup);
    } else {
      const fillPaths = this._getHatchFillPaths(allPaths, style);
      for (const path of fillPaths) {
        const patternLine = this._createHatchPatternLine(path, scale, angle, color, lineWidth);
        if (patternLine) group.add(patternLine);
      }
    }

    for (const path of allPaths) {
      const outlinePoints: THREE.Vector3[] = [];
      for (let i = 0; i < path.length; i++) {
        const v = path[i];
        outlinePoints.push(new THREE.Vector3(v.x, v.y, 0));
        const nextIdx = (i + 1) % path.length;
        const nextV = path[nextIdx];
        if (Math.abs(v.bulge) > 1e-9) {
          const arcPoints = this._bulgeToArc(v, nextV);
          for (const p of arcPoints) {
            if (this._isValidVector3(p)) outlinePoints.push(p);
          }
        }
      }
      if (outlinePoints.length > 0) outlinePoints.push(outlinePoints[0].clone());
      const outlineLine = this._createLine2FromPoints(outlinePoints, color, lineWidth);
      if (outlineLine) group.add(outlineLine);
    }

    if (group.children.length === 0) return null;
    return group;
  }

  private _getHatchFillPaths(paths: CadLwVertex[][], style: number): CadLwVertex[][] {
    if (style === 2) return paths;
    if (style === 1) {
      if (paths.length <= 1) return paths;
      let outerIdx = 0;
      let maxArea = -1;
      for (let i = 0; i < paths.length; i++) {
        const area = this._polygonArea(paths[i]);
        if (area > maxArea) { maxArea = area; outerIdx = i; }
      }
      return [paths[outerIdx]];
    }
    return paths;
  }

  private _polygonArea(vertices: CadLwVertex[]): number {
    let area = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    return Math.abs(area) / 2;
  }

  private _createHatchPatternFromDefinition(
    paths: CadLwVertex[][],
    scale: number,
    patternLines: Array<{ angle: number; base_x: number; base_y: number; offset_x: number; offset_y: number; dashes: number[] }>,
    color: THREE.Color,
    lineWidth: number,
  ): THREE.Group | null {
    if (!this._isValidNumber(scale) || scale <= 0) scale = 1;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const path of paths) {
      for (const v of path) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
      }
    }
    if (!isFinite(minX) || !isFinite(maxX)) return null;

    const halfDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2) / 2;
    if (halfDiag < 1e-10) return null;

    const group = new THREE.Group();

    for (const pl of patternLines) {
      const rad = pl.angle;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      const offsetX = pl.offset_x * scale;
      const offsetY = pl.offset_y * scale;

      const perpDist = Math.abs(offsetX * sinA - offsetY * cosA);
      const spacing = perpDist > 1e-10 ? perpDist : scale * 3;

      const numLines = Math.ceil(halfDiag * 2 / spacing) + 2;
      const halfLen = halfDiag * 1.5;

      const isContinuous = !pl.dashes || pl.dashes.length === 0;
      const hasDashes = pl.dashes && pl.dashes.length > 0 && pl.dashes.some(d => Math.abs(d) > 1e-10);

      const positions: number[] = [];

      for (let i = -numLines; i <= numLines; i++) {
        const lineBaseX = pl.base_x * scale + i * offsetX;
        const lineBaseY = pl.base_y * scale + i * offsetY;

        const cx = (minX + maxX) / 2 + lineBaseX * cosA - lineBaseY * sinA;
        const cy = (minY + maxY) / 2 + lineBaseX * sinA + lineBaseY * cosA;

        if (isContinuous || !hasDashes) {
          const x1 = cx - halfLen * cosA;
          const y1 = cy - halfLen * sinA;
          const x2 = cx + halfLen * cosA;
          const y2 = cy + halfLen * sinA;
          positions.push(x1, y1, 0, x2, y2, 0);
        } else {
          let dist = 0;
          for (let di = 0; di < pl.dashes.length; di++) {
            const d = pl.dashes[di] * scale;
            if (d > 0) {
              const startDist = dist;
              const endDist = dist + d;

              const segStartX = cx - halfLen * cosA + startDist * cosA;
              const segStartY = cy - halfLen * sinA + startDist * sinA;
              const segEndX = cx - halfLen * cosA + endDist * cosA;
              const segEndY = cy - halfLen * sinA + endDist * sinA;

              positions.push(segStartX, segStartY, 0, segEndX, segEndY, 0);
            }
            dist += Math.abs(d);
          }
        }
      }

      if (positions.length >= 6) {
        const geometry = new LineGeometry();
        geometry.setPositions(positions);
        const material = this._createLineMaterial(color, lineWidth * 0.5);
        const line = new Line2(geometry, material);
        line.computeLineDistances();
        group.add(line);
      }
    }

    if (group.children.length === 0) return null;
    return group;
  }

  private _createHatchPatternLine(
    vertices: CadLwVertex[],
    scale: number,
    angle: number,
    color: THREE.Color,
    lineWidth: number
  ): Line2 | null {
    if (!this._isValidNumber(scale) || scale <= 0) scale = 1;
    if (!this._isValidNumber(angle)) angle = 0;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of vertices) {
      if (!this._isValidNumber(v.x) || !this._isValidNumber(v.y)) continue;
      minX = Math.min(minX, v.x);
      minY = Math.min(minY, v.y);
      maxX = Math.max(maxX, v.x);
      maxY = Math.max(maxY, v.y);
    }

    if (!this._isValidNumber(minX) || !this._isValidNumber(maxX) || 
        !this._isValidNumber(minY) || !this._isValidNumber(maxY) ||
        minX === Infinity || maxX === -Infinity) {
      return null;
    }

    const spacing = scale * 3;
    if (spacing < 1e-10 || !this._isValidNumber(spacing)) return null;

    const rad = angle * Math.PI / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const halfDiag = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2) / 2;

    if (!this._isValidNumber(halfDiag) || halfDiag < 1e-10) return null;

    const numLines = Math.ceil(halfDiag * 2 / spacing);
    const halfLen = halfDiag * 1.5;

    const positions: number[] = [];

    for (let i = -numLines; i <= numLines; i++) {
      const offset = i * spacing;
      const baseX = cx + offset * sinA;
      const baseY = cy - offset * cosA;

      const x1 = baseX - halfLen * cosA;
      const y1 = baseY - halfLen * sinA;
      const x2 = baseX + halfLen * cosA;
      const y2 = baseY + halfLen * sinA;

      if (this._isValidNumber(x1) && this._isValidNumber(y1) && 
          this._isValidNumber(x2) && this._isValidNumber(y2)) {
        positions.push(x1, y1, 0, x2, y2, 0);
      }
    }

    if (positions.length < 6) return null;

    const geometry = new LineGeometry();
    geometry.setPositions(positions);

    const material = this._createLineMaterial(color, lineWidth * 0.5);
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    return line;
  }

  private _createDimension(
    definitionPoint: CadPoint,
    textMidpoint: CadPoint,
    content: string,
    rotation: number,
    color: THREE.Color,
    lineWidth: number
  ): THREE.Group | null {
    if (!this._isValidPoint(definitionPoint) || !this._isValidPoint(textMidpoint)) {
      return null;
    }

    if (!this._isValidNumber(rotation)) {
      rotation = 0;
    }

    const group = new THREE.Group();

    const dp = new THREE.Vector3(definitionPoint.x, definitionPoint.y, definitionPoint.z);
    const tm = new THREE.Vector3(textMidpoint.x, textMidpoint.y, textMidpoint.z);

    const dimLine = this._createLine2FromPoints([dp, tm], color, lineWidth);
    if (dimLine) {
      group.add(dimLine);
    }

    const arrowSize = 3;
    const dir = new THREE.Vector3().subVectors(tm, dp);
    const len = dir.length();
    if (len > arrowSize * 2) {
      const dirNorm = dir.normalize();
      const perp = new THREE.Vector3(-dirNorm.y, dirNorm.x, 0);

      const arrowPoints1 = [
        dp.clone(),
        dp.clone().add(dirNorm.clone().multiplyScalar(arrowSize)).add(perp.clone().multiplyScalar(arrowSize * 0.4)),
        dp.clone().add(dirNorm.clone().multiplyScalar(arrowSize)).add(perp.clone().multiplyScalar(-arrowSize * 0.4)),
        dp.clone(),
      ];
      const arrow1 = this._createLine2FromPoints(arrowPoints1, color, lineWidth);
      if (arrow1) group.add(arrow1);

      const arrowPoints2 = [
        tm.clone(),
        tm.clone().add(dirNorm.clone().multiplyScalar(-arrowSize)).add(perp.clone().multiplyScalar(arrowSize * 0.4)),
        tm.clone().add(dirNorm.clone().multiplyScalar(-arrowSize)).add(perp.clone().multiplyScalar(-arrowSize * 0.4)),
        tm.clone(),
      ];
      const arrow2 = this._createLine2FromPoints(arrowPoints2, color, lineWidth);
      if (arrow2) group.add(arrow2);
    }

    const extLen = 5;
    const dirNorm = len > 0 ? dir.normalize() : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3(-dirNorm.y, dirNorm.x, 0);

    const ext1Start = dp.clone().add(perp.clone().multiplyScalar(-extLen));
    const ext1End = dp.clone().add(perp.clone().multiplyScalar(extLen));
    const ext1 = this._createLine2FromPoints([ext1Start, ext1End], color, lineWidth * 0.5);
    if (ext1) group.add(ext1);

    const ext2Start = tm.clone().add(perp.clone().multiplyScalar(-extLen));
    const ext2End = tm.clone().add(perp.clone().multiplyScalar(extLen));
    const ext2 = this._createLine2FromPoints([ext2Start, ext2End], color, lineWidth * 0.5);
    if (ext2) group.add(ext2);

    if (content && content.trim().length > 0) {
      const textMesh = this._createText(textMidpoint, content, 5, rotation, color, 5);
      if (textMesh) {
        group.add(textMesh);
      }
    }

    return group;
  }

  private _isValidBoundingBox(bb: BoundingBox | null | undefined): bb is BoundingBox {
    return !!bb
      && this._isValidNumber(bb.minX)
      && this._isValidNumber(bb.minY)
      && this._isValidNumber(bb.maxX)
      && this._isValidNumber(bb.maxY)
      && bb.maxX > bb.minX
      && bb.maxY > bb.minY;
  }

  private _collectNodeBounds(): BoundingBox | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [id, node] of this._nodeIndex) {
      if (this._logicallyHidden.has(id)) continue;
      const bb = node.bbox;
      if (!this._isValidNumber(bb.minX) || !this._isValidNumber(bb.minY)
          || !this._isValidNumber(bb.maxX) || !this._isValidNumber(bb.maxY)) {
        continue;
      }
      minX = Math.min(minX, bb.minX);
      minY = Math.min(minY, bb.minY);
      maxX = Math.max(maxX, bb.maxX);
      maxY = Math.max(maxY, bb.maxY);
    }
    const bounds = { minX, minY, maxX, maxY };
    return this._isValidBoundingBox(bounds) ? bounds : null;
  }

  private _boundsForView(preferred: BoundingBox | null | undefined): BoundingBox | null {
    const nodeBounds = this._collectNodeBounds();
    const hasPreferred = this._isValidBoundingBox(preferred);
    if (hasPreferred && nodeBounds) {
      return {
        minX: Math.min(preferred.minX, nodeBounds.minX),
        minY: Math.min(preferred.minY, nodeBounds.minY),
        maxX: Math.max(preferred.maxX, nodeBounds.maxX),
        maxY: Math.max(preferred.maxY, nodeBounds.maxY),
      };
    }
    if (hasPreferred) return preferred;
    return nodeBounds;
  }

  private _fitToView(): void {
    this._initialSpan = 0;

    const bb = this._boundsForView(this._externalBounds);
    if (bb) {
      // 验证边界框的有效性
      if (this._isValidBoundingBox(bb)) {
        const width = bb.maxX - bb.minX;
        const height = bb.maxY - bb.minY;
        if (width > 0 && height > 0 && this._isValidNumber(width) && this._isValidNumber(height)) {
          this._applyExtents(
            { x: bb.minX, y: bb.minY, z: 0 },
            { x: bb.maxX, y: bb.maxY, z: 0 },
          );
          return;
        }
      }
    }

    if (!this._document?.extents) {
      this._fitToEntities();
      return;
    }

    const { min, max } = this._document.extents;
    if (!this._isValidPoint(min) || !this._isValidPoint(max)) {
      this._fitToEntities();
      return;
    }

    const width = max.x - min.x;
    const height = max.y - min.y;
    if (width <= 0 || height <= 0 || !this._isValidNumber(width) || !this._isValidNumber(height)) {
      this._fitToEntities();
      return;
    }

    const merged = this._boundsForView({
      minX: min.x,
      minY: min.y,
      maxX: max.x,
      maxY: max.y,
    });
    if (merged) {
      // 再次验证 merged 边界框
      const mergedWidth = merged.maxX - merged.minX;
      const mergedHeight = merged.maxY - merged.minY;
      if (mergedWidth > 0 && mergedHeight > 0 && 
          this._isValidNumber(mergedWidth) && this._isValidNumber(mergedHeight)) {
        this._applyExtents(
          { x: merged.minX, y: merged.minY, z: 0 },
          { x: merged.maxX, y: merged.maxY, z: 0 },
        );
        return;
      }
    }

    // Fallback: 如果所有方法都失败，尝试使用实体网格
    this._fitToEntities();
  }

  private _fitToEntities(): void {
    // 增强检查：如果没有任何实体，重置到默认视图
    if (this._entityMeshes.size === 0 && this._nodeIndex.size === 0) {
      logger.warn('CadRenderer', '_fitToEntities: no entities, resetting to default view');
      this._resetToDefaultView();
      return;
    }

    if (this._nodeIndex.size > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [id, node] of this._nodeIndex) {
        if (this._logicallyHidden.has(id)) continue;
        const bb = node.bbox;
        if (bb.minX < minX) minX = bb.minX;
        if (bb.minY < minY) minY = bb.minY;
        if (bb.maxX > maxX) maxX = bb.maxX;
        if (bb.maxY > maxY) maxY = bb.maxY;
      }
      if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY) && maxX > minX && maxY > minY) {
        this._applyExtents(
          { x: minX, y: minY, z: 0 },
          { x: maxX, y: maxY, z: 0 },
        );
        return;
      }
    }

    const box = new THREE.Box3();

    for (const mesh of this._entityMeshes.values()) {
      try {
        if (!mesh.visible) continue;
        // Line2 / LineSegments2 默认不会自动算 boundingBox，先手动算一遍才能让 setFromObject 生效。
        mesh.traverse((child) => {
          if (child instanceof Line2) {
            try {
              child.geometry.computeBoundingBox();
            } catch {
              // ignore
            }
          }
        });
        const meshBox = new THREE.Box3().setFromObject(mesh);
        if (!meshBox.isEmpty() &&
            this._isValidNumber(meshBox.min.x) && this._isValidNumber(meshBox.min.y) &&
            this._isValidNumber(meshBox.max.x) && this._isValidNumber(meshBox.max.y)) {
          box.union(meshBox);
        }
      } catch {
        // Skip invalid meshes
      }
    }

    if (box.isEmpty()) {
      // 所有方法都失败：重置到默认视图
      logger.warn('CadRenderer', '_fitToEntities: box is empty, resetting to default view');
      this._resetToDefaultView();
      return;
    }

    if (!this._isValidNumber(box.min.x) || !this._isValidNumber(box.min.y) ||
        !this._isValidNumber(box.max.x) || !this._isValidNumber(box.max.y)) {
      return;
    }

    const min = { x: box.min.x, y: box.min.y, z: box.min.z };
    const max = { x: box.max.x, y: box.max.y, z: box.max.z };

    this._applyExtents(min, max);
  }

  /**
   * 重置到默认视图（安全网）
   * 当所有其他方法都失败时调用
   */
  private _resetToDefaultView(): void {
    // 设置一个合理的默认视图（以原点为中心，跨度为100个单位）
    const defaultCenter = { x: 0, y: 0, z: 0 };
    const defaultSpan = 100;  // 默认视图跨度
    const defaultMin = { x: defaultCenter.x - defaultSpan, y: defaultCenter.y - defaultSpan, z: 0 };
    const defaultMax = { x: defaultCenter.x + defaultSpan, y: defaultCenter.y + defaultSpan, z: 0 };
    
    // 强制重置 _initialSpan
    this._initialSpan = defaultSpan * 2;
    
    this._applyExtents(defaultMin, defaultMax);
    logger.info('CadRenderer', '_resetToDefaultView: reset to default view');
  }

  private _applyExtents(min: CadPoint, max: CadPoint): void {
    const centerX = (min.x + max.x) / 2;
    const centerY = (min.y + max.y) / 2;
    const width = max.x - min.x;
    const height = max.y - min.y;

    if (!this._isValidNumber(centerX) || !this._isValidNumber(centerY)) {
      logger.warn('CadRenderer', '_applyExtents: invalid center', { centerX, centerY });
      this._resetToDefaultView();
      return;
    }

    if (!this._isValidNumber(width) || !this._isValidNumber(height) || width <= 0 || height <= 0) {
      logger.warn('CadRenderer', '_applyExtents: invalid dimensions', { width, height });
      this._resetToDefaultView();
      return;
    }

    const cw = this._container.clientWidth || 1;
    const ch = this._container.clientHeight || 1;
    if (cw === 0 || ch === 0) {
      logger.warn('CadRenderer', '_applyExtents: container has zero size', { width: cw, height: ch });
      return;
    }

    const aspect = cw / ch;
    let halfW: number;
    let halfH: number;

    switch (this._fitMode) {
      case 'contain': {
        const padding = 1.05;
        halfH = Math.max(width / aspect, height) * padding / 2;
        halfW = halfH * aspect;
        break;
      }
      case 'cover': {
        const padding = 1.0;
        halfH = Math.min(width / aspect, height) * padding / 2;
        halfW = halfH * aspect;
        break;
      }
      case 'stretch': {
        const padding = 1.0;
        halfW = (width * padding) / 2;
        halfH = (height * padding) / 2;
        break;
      }
      case 'custom':
      default: {
        const padding = 1.05;
        halfH = Math.max(width / aspect, height) * padding / 2;
        halfW = halfH * aspect;
        break;
      }
    }

    if (!this._isValidNumber(halfH) || !this._isValidNumber(halfW) || halfH <= 0 || halfW <= 0) {
      logger.warn('CadRenderer', '_applyExtents: invalid half dimensions', { halfW, halfH });
      this._resetToDefaultView();
      return;
    }

    let cameraZ = halfH * 4;
    const MIN_CAMERA_Z = 0.1;
    const MAX_CAMERA_Z = 1000000;
    cameraZ = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, cameraZ));

    // FIX: Use safe near/far plane values that properly encompass the scene
    // Camera is at z=cameraZ looking at z=0, so we need:
    //   - near plane small enough to see geometry at z=0
    //   - far plane large enough to include z=0 and beyond
    const nearPlane = 0.1;
    const farPlane = Math.max(cameraZ * 3, 1000);

    this._camera.position.set(centerX, centerY, cameraZ);
    this._camera.lookAt(centerX, centerY, 0);
    this._camera.near = nearPlane;
    this._camera.far = Math.max(farPlane, nearPlane * 10);
    this._camera.left = -halfW;
    this._camera.right = halfW;
    this._camera.top = halfH;
    this._camera.bottom = -halfH;

    this._initialSpan = Math.max(halfW * 2, halfH * 2);
    if (!this._isValidNumber(this._initialSpan) || this._initialSpan <= 0) {
      this._initialSpan = 1.0;
      logger.warn('CadRenderer', '_applyExtents: invalid initialSpan, using default');
    }

    if (this._camera.left >= this._camera.right || this._camera.bottom >= this._camera.top) {
      logger.warn('CadRenderer', '_applyExtents: camera bounds degenerate', {
        left: this._camera.left,
        right: this._camera.right,
        bottom: this._camera.bottom,
        top: this._camera.top,
      });
      this._resetToDefaultView();
      return;
    }

    this._camera.updateProjectionMatrix();
    this._applyViewportCulling();
    this._requestRender();

    logger.info('CadRenderer', '_applyExtents applied', {
      centerX,
      centerY,
      cameraZ,
      width,
      height,
      halfW,
      halfH,
      aspect,
      containerW: cw,
      containerH: ch,
      near: this._camera.near,
      far: this._camera.far,
      initialSpan: this._initialSpan,
    });
  }

  resize(): void {
    const cw = this._container.clientWidth || 1;
    const ch = this._container.clientHeight || 1;
    this._canvasWidth = cw;
    this._canvasHeight = ch;
    this._renderer.setSize(cw, ch);
    this._resolution.set(cw * window.devicePixelRatio, ch * window.devicePixelRatio);
    this._batchedBuilder.setResolution(this._resolution);

    this._scene.traverse((child) => {
      if (child instanceof Line2) {
        (child.material as LineMaterial).resolution.copy(this._resolution);
      }
    });

    let pendingSync = 0;
    this._scene.traverse((child) => {
      if (child instanceof TroikaText) {
        if (child.parent === this._sdfTextRenderer.batchedText) return;
        pendingSync++;
        child.sync(() => {
          pendingSync--;
          if (pendingSync === 0) {
            this._requestRender();
          }
        });
      }
    });

    this._camera.updateProjectionMatrix();

    if (this._fitMode === 'custom') {
      const oldAspect = this._canvasWidth > 0 && this._canvasHeight > 0
        ? (this._camera.right - this._camera.left) / (this._camera.top - this._camera.bottom)
        : 1;
      const newAspect = cw / ch;
      if (Math.abs(oldAspect - newAspect) > 0.001) {
        const halfH = (this._camera.top - this._camera.bottom) / 2;
        const centerX = (this._camera.left + this._camera.right) / 2;
        const centerY = (this._camera.top + this._camera.bottom) / 2;
        this._camera.left = centerX - halfH * newAspect;
        this._camera.right = centerX + halfH * newAspect;
        this._camera.top = centerY + halfH;
        this._camera.bottom = centerY - halfH;
        this._camera.updateProjectionMatrix();
      }
    } else if (this._document || this._entityMeshes.size > 0) {
      this._fitToView();
    }

    this._scheduleViewportCulling();
    this._emitCameraChanged();
    this._requestRender();
  }

  zoomIn(): void {
    const factor = 0.8;
    this._camera.left *= factor;
    this._camera.right *= factor;
    this._camera.top *= factor;
    this._camera.bottom *= factor;
    this._camera.updateProjectionMatrix();
    this._requestRender();
  }

  zoomOut(): void {
    const factor = 1.25;
    this._camera.left *= factor;
    this._camera.right *= factor;
    this._camera.top *= factor;
    this._camera.bottom *= factor;
    this._camera.updateProjectionMatrix();
    this._requestRender();
  }

  fitToView(): void {
    this._fitToView();
  }

  setFitMode(mode: 'contain' | 'cover' | 'stretch' | 'custom'): void {
    if (this._fitMode === mode) return;
    this._fitMode = mode;
    if (mode === 'custom') {
      this._requestRender();
    } else {
      this._fitToView();
    }
  }

  getFitMode(): 'contain' | 'cover' | 'stretch' | 'custom' {
    return this._fitMode;
  }

  getCameraState(): { centerX: number; centerY: number; halfW: number; halfH: number } {
    return {
      centerX: this._camera.position.x,
      centerY: this._camera.position.y,
      halfW: this._camera.right,
      halfH: this._camera.top,
    };
  }

  getDrawingBounds(): BoundingBox | null {
    return this._boundsForView(this._externalBounds);
  }

  setCameraState(state: { centerX: number; centerY: number; halfW: number; halfH: number }): void {
    if (
      !this._isValidNumber(state.centerX) ||
      !this._isValidNumber(state.centerY) ||
      !this._isValidNumber(state.halfW) ||
      !this._isValidNumber(state.halfH) ||
      state.halfW <= 0 ||
      state.halfH <= 0
    ) {
      logger.warn('CadRenderer', 'setCameraState: invalid state', state);
      return;
    }
    this._camera.position.set(state.centerX, state.centerY, this._camera.position.z);
    this._camera.left = -state.halfW;
    this._camera.right = state.halfW;
    this._camera.top = state.halfH;
    this._camera.bottom = -state.halfH;
    this._camera.updateProjectionMatrix();
    this._scheduleViewportCulling();
    this._requestRender();
  }

  /**
   * GPU Picking: Use color-coding to identify entities instantly
   * Replaces raycasting for O(1) entity picking
   */
  private _setupGPUPicking(): void {
    if (!this._pickingCamera || !this._pickingTexture) return;

    // Clear previous picking scene
    while (this._pickingScene.children.length > 0) {
      const child = this._pickingScene.children[0];
      this._pickingScene.remove(child);
      if (child instanceof THREE.Mesh || child instanceof Line2) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
        child.geometry.dispose();
      }
    }
    this._entityColorMap.clear();
    this._colorEntityMap.clear();

    // Assign unique color to each entity
    let colorId = 1;
    this._entityMeshes.forEach((mesh, entityId) => {
      if (!mesh.visible) return;
      
      const color = new THREE.Color(colorId);
      this._entityColorMap.set(colorId, entityId);
      this._colorEntityMap.set(entityId, colorId);

      const cloned = mesh.clone();
      cloned.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshBasicMaterial({ color });
        } else if (child instanceof Line2) {
          child.material = new LineMaterial({ color, linewidth: 3, worldUnits: false, resolution: new THREE.Vector2(this._canvasWidth, this._canvasHeight) });
        } else if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
          child.material = new THREE.LineBasicMaterial({ color, linewidth: 3 });
        }
      });

      this._pickingScene.add(cloned);
      colorId++;
    });

    // Also add batched entities
    // (Simplified: in production, you'd render the batched geometry with color-coding)
  }

  private _pickEntityAt(x: number, y: number): string | null {
    if (!this._pickingCamera || !this._pickingTexture) return null;

    // Update picking camera to match main camera
    this._pickingCamera.position.copy(this._camera.position);
    this._pickingCamera.rotation.copy(this._camera.rotation);
    this._pickingCamera.scale.copy(this._camera.scale);
    this._pickingCamera.left = this._camera.left;
    this._pickingCamera.right = this._camera.right;
    this._pickingCamera.top = this._camera.top;
    this._pickingCamera.bottom = this._camera.bottom;
    this._pickingCamera.updateProjectionMatrix();

    // Render picking scene to texture
    this._renderer.setRenderTarget(this._pickingTexture);
    this._renderer.render(this._pickingScene, this._pickingCamera);
    this._renderer.setRenderTarget(null);

    // Read pixel at mouse position
    const pixelBuffer = new Uint8Array(4);
    this._renderer.readRenderTargetPixels(
      this._pickingTexture,
      x,
      this._pickingTexture.height - y,
      1,
      1,
      pixelBuffer
    );

    // Convert pixel color back to colorId
    const colorId = (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | pixelBuffer[2];
    
    if (colorId === 0) return null; // Background color

    return this._entityColorMap.get(colorId) || null;
  }

  private _renderInsert(entity: any): THREE.Object3D | null {
    // 修复缺陷4：添加深度限制和循环检测，防止无限递归和指数爆炸
    const MAX_INSERT_DEPTH = 10;  // 最大递归深度
    if (this._insertDepth >= MAX_INSERT_DEPTH) {
      logger.warn('CadRenderer', '_renderInsert: max depth exceeded', {
        blockName: entity.block_name,
        depth: this._insertDepth,
      });
      return null;
    }

    if (!this._blocks.size) {
      logger.warn('CadRenderer', '_renderInsert: no blocks loaded');
      return null;
    }

    const blockName = entity.block_name || (entity as any).blockName;
    
    // 检测循环引用
    if (this._visitedBlocks.has(blockName)) {
      logger.warn('CadRenderer', '_renderInsert: circular reference detected', { blockName });
      return null;
    }

    const block = this._blocks.get(blockName);
    if (!block) {
      logger.warn('CadRenderer', '_renderInsert: block not found', { blockName: entity.block_name });
      return null;
    }

    const group = new THREE.Group();
    group.name = `INSERT_${entity.id}_${entity.block_name}`;

    // Apply INSERT transformation: position, scale, rotation
    const matrix = new THREE.Matrix4();
    
    // 1. Apply scale
    matrix.makeScale(entity.x_scale, entity.y_scale, entity.z_scale);
    
    // 2. Apply rotation (CAD rotation is around Z axis, in radians)
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationZ(entity.rotation);
    matrix.premultiply(rotationMatrix);
    
    // 3. Apply translation (position is the insertion point)
    const translationMatrix = new THREE.Matrix4();
    translationMatrix.makeTranslation(entity.position.x, entity.position.y, entity.position.z);
    matrix.premultiply(translationMatrix);

    // 进入递归，标记已访问
    this._insertDepth++;
    this._visitedBlocks.add(blockName);

    try {
      // Render all entities in the block
      for (const blkEntity of block.entities) {
        try {
          const mesh = this._createEntityMesh(blkEntity);
          if (mesh) {
            mesh.applyMatrix4(matrix);
            group.add(mesh);
          }
        } catch (e) {
          logger.warn('CadRenderer', '_renderInsert: failed to render block entity', { 
            blockName: entity.block_name, 
            entityId: blkEntity.id,
            error: e 
          });
        }
      }

      logger.info('CadRenderer', '_renderInsert: rendered block', { 
        blockName: entity.block_name, 
        entityCount: block.entities.length,
        childCount: group.children.length 
      });
    } finally {
      // 退出递归
      this._insertDepth--;
      if (this._insertDepth === 0) {
        this._visitedBlocks.clear();
      }
    }

    return group.children.length > 0 ? group : null;
  }

  dispose(): void {
    this._isDisposed = true;

    // 移除所有事件监听器
    const canvas = this._renderer.domElement;
    canvas.removeEventListener('wheel', this._wheelHandler);
    canvas.removeEventListener('contextmenu', this._contextMenuHandler);
    canvas.removeEventListener('mousedown', this._mouseDownHandler);
    canvas.removeEventListener('mousemove', this._mouseMoveHandler);
    canvas.removeEventListener('mouseup', this._mouseUpHandler);
    canvas.removeEventListener('mouseleave', this._mouseLeaveHandler);
    this._detachDocumentPanListeners();
    document.removeEventListener('keydown', this._keyDownHandler);

    if (this._cameraInteractionEndTimer !== null) {
      clearTimeout(this._cameraInteractionEndTimer);
      this._cameraInteractionEndTimer = null;
    }

    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }

    if (this._deferredTimer !== null) {
      cancelAnimationFrame(this._deferredTimer);
      this._deferredTimer = null;
    }

    this._clearEntities();
    this._sdfTextRenderer.dispose();

    for (const overlay of this._highlightOverlays.values()) {
      this._scene.remove(overlay);
      if (overlay instanceof THREE.LineSegments || overlay instanceof THREE.Line) {
        overlay.geometry.dispose();
        (overlay.material as THREE.Material).dispose();
      }
    }
    this._highlightOverlays.clear();

    for (const mat of this._lineMaterialCache.values()) {
      mat.dispose();
    }
    this._lineMaterialCache.clear();

    this._renderer.dispose();

    if (this._renderer.domElement.parentElement === this._container) {
      this._container.removeChild(this._renderer.domElement);
    }
  }
}
