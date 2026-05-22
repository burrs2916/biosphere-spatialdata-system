import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { CadViewerEngine } from "../editor/cad/CadViewerEngine";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Paper from "@mui/material/Paper";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import PublishIcon from "@mui/icons-material/Publish";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import DeleteIcon from "@mui/icons-material/Delete";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import LayersIcon from "@mui/icons-material/Layers";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import NearMeIcon from "@mui/icons-material/NearMe";
import PanToolIcon from "@mui/icons-material/PanTool";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import EditIcon from "@mui/icons-material/Edit";
import FormatSizeIcon from "@mui/icons-material/FormatSize";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useMapLibraryStore } from "../store/mapLibraryStore";
import type { MapLibrary } from "../types/mapLibrary";
import { MAP_LIBRARY_STATUS_LABELS } from "../types/mapLibrary";
import { logger } from "../utils/logger";

interface EditorEntity {
  id: string;
  layer: string;
  entityType: string;
  color: string;
  geometry: unknown;
  properties: Record<string, unknown>;
}

interface EditorLayer {
  name: string;
  file: string;
  visible: boolean;
  locked: boolean;
  entityCount: number;
  entities: EditorEntity[];
  colorRgb?: number;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  line: "线段",
  lwPolyline: "轻量多段线",
  polyline: "多段线",
  circle: "圆",
  arc: "圆弧",
  ellipse: "椭圆",
  spline: "样条曲线",
  text: "文字",
  mText: "多行文字",
  hatch: "填充",
  solid: "实体填充",
  point: "点",
  insert: "块参照",
  dimension: "标注",
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  line: "#60a5fa",
  lwPolyline: "#60a5fa",
  polyline: "#60a5fa",
  circle: "#34d399",
  arc: "#34d399",
  ellipse: "#34d399",
  spline: "#a78bfa",
  text: "#94a3b8",
  mText: "#94a3b8",
  hatch: "#f59e0b",
  solid: "#f59e0b",
  point: "#94a3b8",
  insert: "#8b5cf6",
  dimension: "#ef4444",
};

export default function MapEditorPage() {
  const { libraryId } = useParams<{ libraryId: string }>();
  const [searchParams] = useSearchParams();
  const urlPreviewMode = searchParams.get("mode") === "preview";
  const libraries = useMapLibraryStore((s) => s.libraries);
  const loadLibraries = useMapLibraryStore((s) => s.loadLibraries);
  const saveLibrary = useMapLibraryStore((s) => s.saveLibrary);
  const publishLibrary = useMapLibraryStore((s) => s.publishLibrary);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [library, setLibrary] = useState<MapLibrary | null>(null);
  const isPreviewMode = urlPreviewMode || (library?.status === "published");
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false, message: "", severity: "info",
  });
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [layerSearch, setLayerSearch] = useState("");
  const [activeLayerName, setActiveLayerName] = useState<string | null>(null);
  const [layerContextMenu, setLayerContextMenu] = useState<{ mouseX: number; mouseY: number; layerName: string } | null>(null);
  const [deleteLayerConfirm, setDeleteLayerConfirm] = useState<string | null>(null);
  const [renameLayerTarget, setRenameLayerTarget] = useState<string | null>(null);
  const [renameLayerValue, setRenameLayerValue] = useState("");
  const [addTextOpen, setAddTextOpen] = useState(false);
  const [addTextContent, setAddTextContent] = useState("");
  const [addTextHeight, setAddTextHeight] = useState(2.5);
  const [isTextPlacing, setIsTextPlacing] = useState(false);
  const isTextPlacingRef = useRef(false);

  const cadbinContainerRef = useRef<HTMLDivElement>(null);
  const cadbinEngineRef = useRef<CadViewerEngine | null>(null);
  const [cadbinTextEditor, setCadbinTextEditor] = useState<{
    id: string;
    originalContent: string;
    draftContent: string;
    originalHeight: number;
    draftHeight: number | string;
    originalRotation: number;
    draftRotation: number | string;
    left: number;
    top: number;
    width: number;
    height: number;
    rotation: number;
    color: string;
  } | null>(null);
  const [cadbinTextSaving, setCadbinTextSaving] = useState(false);

  const [cadbinSelected, setCadbinSelected] = useState<{
    id: string;
    type: string;
    layer: string;
    color: number;
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    extra?: Record<string, unknown>;
  } | null>(null);
  const [cadbinStatus, setCadbinStatus] = useState<{
    cursorX: number;
    cursorY: number;
    zoom: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const [cadbinInteractionMode, setCadbinInteractionMode] = useState<'select' | 'pan' | 'draw_text'>('select');
  const [isDarkBg, setIsDarkBg] = useState(true);
  const [preciseMoveOpen, setPreciseMoveOpen] = useState(false);
  const [preciseMoveDx, setPreciseMoveDx] = useState("0");
  const [preciseMoveDy, setPreciseMoveDy] = useState("0");
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldVersion, setFieldVersion] = useState(0);
  const activeFieldRef = useRef<string | null>(null);
  const [entityContextMenu, setEntityContextMenu] = useState<{
    entityId: string;
    layer: string;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const clipboardRef = useRef<import("../editor/cad/cad_runtime/scene_node").SceneNode | null>(null);

  const cadbinCmdStackRef = useRef<{
    items: Array<{ description: string; redo: () => Promise<void>; undo: () => Promise<void> }>;
    cursor: number;
  }>({ items: [], cursor: -1 });
  const [cadbinCmdVersion, setCadbinCmdVersion] = useState(0);
  const cadbinPushCmd = useCallback((description: string, redo: () => Promise<void>, undo: () => Promise<void>) => {
    const stack = cadbinCmdStackRef.current;
    stack.items = stack.items.slice(0, stack.cursor + 1);
    stack.items.push({ description, redo, undo });
    stack.cursor = stack.items.length - 1;
    setCadbinCmdVersion((v) => v + 1);
    setIsDirty(true);
  }, []);
  const cadbinUndo = useCallback(async () => {
    const stack = cadbinCmdStackRef.current;
    if (stack.cursor < 0) return;
    const cmd = stack.items[stack.cursor];
    stack.cursor -= 1;
    try { await cmd.undo(); } catch (e) { console.error("[MapEditorPage] cadbin undo failed", e); }
    setCadbinCmdVersion((v) => v + 1);
  }, []);
  const cadbinRedo = useCallback(async () => {
    const stack = cadbinCmdStackRef.current;
    if (stack.cursor + 1 >= stack.items.length) return;
    stack.cursor += 1;
    const cmd = stack.items[stack.cursor];
    try { await cmd.redo(); } catch (e) { console.error("[MapEditorPage] cadbin redo failed", e); }
    setCadbinCmdVersion((v) => v + 1);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<EditorLayer[]>([]);
  layersRef.current = layers;

  const hasCadbin = Boolean(library?.cadbinPath);

  useEffect(() => {
    logger.info("MapEditorPage", "Layers changed", {
      layersCount: layers.length,
      totalEntities: layers.reduce((s, l) => s + l.entityCount, 0),
    });
  }, [layers]);

  useEffect(() => {
    loadLibraries();
  }, [loadLibraries]);

  useEffect(() => {
    if (!cadbinSelected) { setFieldValues({}); return; }
    const eng = cadbinEngineRef.current;
    if (!eng) return;
    const node = eng.getEntityNode(cadbinSelected.id);
    if (!node) return;
    const values: Record<string, string> = {};
    const addNumField = (key: string, val: number) => {
      if (activeFieldRef.current === key) return;
      values[key] = val.toFixed(2);
    };
    const addStrField = (key: string, val: string) => {
      if (activeFieldRef.current === key) return;
      values[key] = val;
    };
    if (node.type === 'text') {
      addStrField('content', (node as any).content ?? '');
      addNumField('posX', node.posX);
      addNumField('posY', node.posY);
      addNumField('height', node.height);
      addNumField('rotation', node.rotation);
    } else if (node.type === 'mText') {
      addStrField('content', (node as any).content ?? '');
      addNumField('posX', node.posX);
      addNumField('posY', node.posY);
      addNumField('height', node.height);
      addNumField('rotation', node.rotation);
      addNumField('widthFactor', (node as any).widthFactor ?? 1);
    } else if (node.type === 'line') {
      addNumField('startX', node.startX); addNumField('startY', node.startY);
      addNumField('endX', node.endX); addNumField('endY', node.endY);
    } else if (node.type === 'circle') {
      addNumField('centerX', node.centerX); addNumField('centerY', node.centerY);
      addNumField('radius', node.radius);
    } else if (node.type === 'arc') {
      addNumField('centerX', node.centerX); addNumField('centerY', node.centerY);
      addNumField('radius', node.radius);
      addNumField('startAngle', node.startAngle); addNumField('endAngle', node.endAngle);
    } else if (node.type === 'ellipse') {
      addNumField('centerX', node.centerX); addNumField('centerY', node.centerY);
      addNumField('minorRatio', node.minorRatio);
    } else if (node.type === 'insert') {
      addNumField('posX', node.posX); addNumField('posY', node.posY);
      addNumField('scaleX', node.scaleX); addNumField('scaleY', node.scaleY);
      addNumField('rotation', node.rotation);
    } else if (node.type === 'point') {
      addNumField('posX', node.posX); addNumField('posY', node.posY);
    } else if (node.type === 'dimension') {
      addNumField('defX', node.defX); addNumField('defY', node.defY);
      addNumField('midX', node.midX); addNumField('midY', node.midY);
      addNumField('rotation', node.rotation);
    }
    setFieldValues(prev => {
      const merged = { ...prev };
      for (const [k, v] of Object.entries(values)) { merged[k] = v; }
      for (const k of Object.keys(merged)) {
        if (!(k in values) && activeFieldRef.current !== k) { delete merged[k]; }
      }
      return merged;
    });
  }, [cadbinSelected?.id, fieldVersion]);

  useEffect(() => {
    if (libraries.length > 0 && libraryId) {
      const lib = libraries.find((l) => l.id === libraryId);
      if (lib) {
        setLibrary(lib);
        if (!cadbinEngineRef.current) {
          void loadEditorData(lib);
        }
      } else {
        setLoadError("图库不存在");
        setLoading(false);
      }
    }
  }, [libraries, libraryId]);

  const loadEditorData = async (lib: MapLibrary) => {
    if (!lib.cadbinPath) {
      setLoadError("该图库没有 CAD 二进制（.cadbin），无法在编辑器中打开。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
  };

  useEffect(() => {
    if (loading) return;

    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      void container.getBoundingClientRect();
    };

    updateSize();
    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    if (!hasCadbin || !cadbinContainerRef.current || !library) return;

    let destroyed = false;
    const engine = new CadViewerEngine();
    cadbinEngineRef.current = engine;

    const handleEngineError = (event: { type: string; data?: unknown }) => {
      const payload = (event.data ?? {}) as { error?: unknown };
      const errMsg = payload.error instanceof Error
        ? payload.error.message
        : String(payload.error ?? "未知渲染错误");
      console.error("[MapEditorPage] CadViewerEngine error:", errMsg);
      if (!destroyed) {
        setLoadError(errMsg);
        setLoading(false);
      }
    };
    engine.on("error", handleEngineError);

    const handleSceneGraphLoaded = () => {
      if (destroyed) return;
      const cadLayers = engine.getCadbinLayers();
      const editorLayers: EditorLayer[] = cadLayers
        .filter((l) => l.name !== "__deleted__")
        .map((l) => ({
          name: l.name,
          file: "",
          visible: l.visible && !l.frozen,
          locked: l.locked,
          entityCount: l.entityCount,
          entities: [],
          colorRgb: l.color,
        }));
      editorLayers.sort((a, b) => a.name.localeCompare(b.name));
      logger.info("MapEditorPage", "cadbin layers populated", {
        layerCount: editorLayers.length,
        totalEntities: editorLayers.reduce((s, l) => s + l.entityCount, 0),
      });
      setLayers(editorLayers);
      for (const l of editorLayers) {
        engine.setLayerVisible(l.name, l.visible);
      }
    };
    engine.on("sceneGraphLoaded", handleSceneGraphLoaded);

    const handleSelectionChanged = (ev: { type: string; data?: unknown }) => {
      const payload = (ev.data ?? {}) as { entityIds?: string[]; primaryId?: string | null; node?: import("../editor/cad/cad_runtime/scene_node").SceneNode | null };
      setSelectedEntityIds(payload.entityIds ?? []);
      if (!payload.entityIds || payload.entityIds.length === 0 || !payload.node) {
        setCadbinSelected(null);
        return;
      }
      if (payload.entityIds.length > 1) {
        setCadbinSelected(null);
        return;
      }
      const entityId = payload.primaryId || payload.entityIds[0];
      const node = payload.node;
      const extra: Record<string, unknown> = {};
      switch (node.type) {
        case "line":
          extra.start = `(${node.startX.toFixed(2)}, ${node.startY.toFixed(2)})`;
          extra.end = `(${node.endX.toFixed(2)}, ${node.endY.toFixed(2)})`;
          extra.length = Math.hypot(node.endX - node.startX, node.endY - node.startY).toFixed(2);
          break;
        case "circle":
          extra.center = `(${node.centerX.toFixed(2)}, ${node.centerY.toFixed(2)})`;
          extra.radius = node.radius.toFixed(2);
          break;
        case "arc":
          extra.center = `(${node.centerX.toFixed(2)}, ${node.centerY.toFixed(2)})`;
          extra.radius = node.radius.toFixed(2);
          extra.startAngle = `${(node.startAngle * 180 / Math.PI).toFixed(1)}°`;
          extra.endAngle = `${(node.endAngle * 180 / Math.PI).toFixed(1)}°`;
          break;
        case "text":
        case "mText":
          extra.position = `(${node.posX.toFixed(2)}, ${node.posY.toFixed(2)})`;
          extra.height = node.height.toFixed(2);
          extra.content = node.content;
          if (node.rotation) extra.rotation = `${(node.rotation * 180 / Math.PI).toFixed(1)}°`;
          break;
        case "lwPolyline":
        case "polyline":
          extra.vertices = node.vertices.length;
          extra.closed = node.closed ? "是" : "否";
          break;
        case "ellipse":
          extra.center = `(${node.centerX.toFixed(2)}, ${node.centerY.toFixed(2)})`;
          extra.minorRatio = node.minorRatio.toFixed(3);
          break;
        case "spline":
          extra.controlPoints = node.controlPoints.length;
          if (node.fitPoints.length > 0) extra.fitPoints = node.fitPoints.length;
          break;
        case "insert":
          extra.position = `(${node.posX.toFixed(2)}, ${node.posY.toFixed(2)})`;
          extra.block = node.blockName;
          extra.scale = `${node.scaleX.toFixed(2)} × ${node.scaleY.toFixed(2)}`;
          break;
        case "point":
          extra.position = `(${node.posX.toFixed(2)}, ${node.posY.toFixed(2)})`;
          break;
        case "dimension":
          extra.content = node.content;
          break;
      }
      setCadbinSelected({
        id: entityId,
        type: node.type,
        layer: node.layer,
        color: node.color,
        bbox: { ...node.bbox },
        extra,
      });
    };
    engine.on("selectionChanged", handleSelectionChanged);

    const handleCameraChanged = (ev: { type: string; data?: unknown }) => {
      const info = ev.data as { centerX: number; centerY: number; worldWidth: number; worldHeight: number; zoom: number } | undefined;
      if (!info) return;
      const cur = engine.getCursorWorldCoord() || { x: info.centerX, y: info.centerY };
      setCadbinStatus({
        cursorX: cur.x,
        cursorY: cur.y,
        zoom: info.zoom,
        centerX: info.centerX,
        centerY: info.centerY,
      });
    };
    engine.on("cameraChanged", handleCameraChanged);

    const handleEntityMoved = async (ev: { type: string; data?: unknown }) => {
      const info = ev.data as { entityId: string; dx: number; dy: number } | undefined;
      if (!info || !info.entityId) return;
      const { entityId, dx, dy } = info;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const libId = (engine as any)._libraryId as string | null;
        if (libId) {
          await invoke('move_cadbin_entity', {
            libraryId: libId,
            entityId: Number(entityId),
            dx,
            dy,
          });
        }
        cadbinPushCmd(
          `拖拽移动 (${dx.toFixed(1)}, ${dy.toFixed(1)})`,
          async () => { await engine.moveEntity(entityId, dx, dy); },
          async () => { await engine.moveEntity(entityId, -dx, -dy); },
        );
        const node = engine.getEntityNode(entityId);
        if (node) {
          setCadbinSelected({
            id: entityId,
            type: node.type,
            layer: node.layer,
            color: node.color,
            bbox: { ...node.bbox },
            extra: (node.type === 'text' || node.type === 'mText') ? { content: (node as any).content } : undefined,
          });
        }
      } catch (e) {
        setSnackbar({ open: true, message: `移动失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
      }
    };
    engine.on("entityMoved", handleEntityMoved);

    const handleEntityContextMenu = (ev: { type: string; data?: unknown }) => {
      const info = ev.data as { entityId: string; layer: string; clientX: number; clientY: number } | undefined;
      if (!info) return;
      setEntityContextMenu({ entityId: info.entityId, layer: info.layer, mouseX: info.clientX, mouseY: info.clientY });
    };
    engine.on("entityContextMenu", handleEntityContextMenu);

    const handleEntityCreated = (ev: { type: string; data?: unknown }) => {
      const info = ev.data as { entityId: string } | undefined;
      if (!info || !info.entityId) return;
      
      logger.info("MapEditorPage", "Entity created", { entityId: info.entityId });
      
      const node = engine.getEntityNode(info.entityId);
      if (!node) return;
      
      setLayers(prevLayers => 
        prevLayers.map(layer => {
          if (layer.name === node.layer) {
            return { ...layer, entityCount: layer.entityCount + 1 };
          }
          return layer;
        })
      );
      
      if (isTextPlacingRef.current) {
        // 文本放置模式：保持放置状态，不自动选中
      } else {
        engine.selectEntity(info.entityId);
        if (cadbinInteractionMode !== 'select' && cadbinInteractionMode !== 'pan') {
          setCadbinInteractionMode('select');
          engine.setInteractionMode('select');
        }
      }

      const snapshot = JSON.parse(JSON.stringify(node));
      cadbinPushCmd(
        `新增${ENTITY_TYPE_LABELS[node.type] || node.type}`,
        async () => {
          const id2 = await engine.addEntity(JSON.stringify(snapshot));
          const n2 = engine.getEntityNode(id2);
          if (n2) engine.addEntityLocally(n2);
        },
        async () => {
          await engine.deleteEntity(String(snapshot.id));
        },
      );
      
      setIsDirty(true);
      setSnackbar({ open: true, message: `已创建${ENTITY_TYPE_LABELS[node.type] || node.type}实体`, severity: "success" });
      void handleSave();
    };
    engine.on("entityCreated", handleEntityCreated);

    const handleEntityChanged = (ev: { type: string; data?: unknown }) => {
      const info = ev.data as { entityId?: string; change: string; layer?: string; layerName?: string } | undefined;
      if (!info) return;
      
      if (info.change === 'add') {
        logger.info("MapEditorPage", "Entity added", { entityId: info.entityId });
      } else if (info.change === 'delete') {
        logger.info("MapEditorPage", "Entity deleted", { entityId: info.entityId, layer: info.layer });
        const layer = info.layer;
        if (layer) {
          setLayers(prevLayers => 
            prevLayers.map(l => {
              if (l.name === layer) {
                return { ...l, entityCount: Math.max(0, l.entityCount - 1) };
              }
              return l;
            })
          );
        }
      } else if (info.change === 'restore' && info.layer) {
        setLayers(prevLayers =>
          prevLayers.map(l => {
            if (l.name === info.layer) {
              return { ...l, entityCount: l.entityCount + 1 };
            }
            return l;
          })
        );
      }
    };
    engine.on("entityChanged", handleEntityChanged);

    const containerEl = cadbinContainerRef.current!;
    const handleDblClick = (ev: MouseEvent) => {
      if (isPreviewMode) return;
      const eng = cadbinEngineRef.current;
      if (!eng) return;
      const id = eng.pickEntityIdAt(ev.clientX, ev.clientY);
      if (!id) return;
      const node = eng.getEntityNode(id);
      if (!node || (node.type !== "text" && node.type !== "mText")) return;

      const rect = containerEl.getBoundingClientRect();
      const left = ev.clientX - rect.left;
      const top = ev.clientY - rect.top;

      const colorR = (node.color >>> 16) & 0xff;
      const colorG = (node.color >>> 8) & 0xff;
      const colorB = node.color & 0xff;
      const luma = 0.2126 * (colorR / 255) + 0.7152 * (colorG / 255) + 0.0722 * (colorB / 255);
      const colorCss = luma > 0.7 ? "#1a1a1a" : `rgb(${colorR}, ${colorG}, ${colorB})`;

      const baseHeight = Math.max(18, Math.min(36, (node.bbox.maxY - node.bbox.minY) * 1));
      const baseWidth = Math.max(120, (((node as { content: string }).content?.length) || 4) * baseHeight * 0.6);

      setCadbinTextEditor({
        id,
        originalContent: (node as { content: string }).content,
        draftContent: (node as { content: string }).content,
        originalHeight: (node as { height: number }).height ?? 2.5,
        draftHeight: (node as { height: number }).height ?? 2.5,
        originalRotation: ((node as { rotation: number }).rotation || 0) * 180 / Math.PI,
        draftRotation: ((node as { rotation: number }).rotation || 0) * 180 / Math.PI,
        left,
        top,
        width: baseWidth,
        height: baseHeight,
        rotation: (node as { rotation: number }).rotation || 0,
        color: colorCss,
      });
    };
    containerEl.addEventListener("dblclick", handleDblClick);

    void (async () => {
      try {
        await engine.initialize({
          container: cadbinContainerRef.current!,
          autoResize: true,
          backgroundColor: "#0a0a1a",
          lineColor: "#4fc3f7",
        });
        if (destroyed) { engine.destroy(); return; }

        const ok = await engine.openFromMapLibrary(library.id, library.name);
        if (!destroyed) {
          if (ok === false) throw new Error("CAD 文档加载失败");
          setLoading(false);
        }
      } catch (err) {
        if (!destroyed) {
          const msg = err instanceof Error ? err.message : String(err);
          setLoadError(msg);
          setLoading(false);
        }
      }
    })();

    return () => {
      destroyed = true;
      containerEl.removeEventListener("dblclick", handleDblClick);
      engine.off("error", handleEngineError);
      engine.off("sceneGraphLoaded", handleSceneGraphLoaded);
      engine.off("selectionChanged", handleSelectionChanged);
      engine.off("cameraChanged", handleCameraChanged);
      engine.off("entityMoved", handleEntityMoved);
      engine.off("entityContextMenu", handleEntityContextMenu);
      engine.off("entityCreated", handleEntityCreated);
      engine.off("entityChanged", handleEntityChanged);
      setCadbinSelected(null);
      setCadbinStatus(null);
      cadbinCmdStackRef.current = { items: [], cursor: -1 };
      if (cadbinEngineRef.current) {
        cadbinEngineRef.current.destroy();
        cadbinEngineRef.current = null;
      }
    };
  }, [hasCadbin, library?.id, library?.name, isPreviewMode]);

  const handleCadbinTextCommit = useCallback(async () => {
    const editor = cadbinTextEditor;
    if (!editor) return;
    const eng = cadbinEngineRef.current;
    if (!eng) {
      setCadbinTextEditor(null);
      return;
    }
    const contentChanged = editor.draftContent !== editor.originalContent;
    const normalizedHeight = typeof editor.draftHeight === 'string'
      ? parseFloat(editor.draftHeight)
      : editor.draftHeight;
    const heightChanged = Number.isFinite(normalizedHeight) && normalizedHeight !== editor.originalHeight;
    const normalizedRotation = typeof editor.draftRotation === 'string'
      ? parseFloat(editor.draftRotation)
      : editor.draftRotation;
    const rotationChanged = Number.isFinite(normalizedRotation) && normalizedRotation !== editor.originalRotation;
    if (!contentChanged && !heightChanged && !rotationChanged) {
      setCadbinTextEditor(null);
      return;
    }
    setCadbinTextSaving(true);
    const targetId = editor.id;
    const redoContent = editor.draftContent;
    const undoContent = editor.originalContent;
    const redoHeight = normalizedHeight;
    const undoHeight = editor.originalHeight;
    const redoRotationRad = normalizedRotation * Math.PI / 180;
    const undoRotationRad = editor.originalRotation * Math.PI / 180;
    try {
      if (contentChanged) {
        await eng.updateTextContent(targetId, redoContent);
      }
      if (heightChanged) {
        await eng.updateEntityProps(targetId, JSON.stringify({ height: redoHeight }));
      }
      if (rotationChanged) {
        await eng.updateEntityProps(targetId, JSON.stringify({ rotation: redoRotationRad }));
      }
      cadbinPushCmd(
        `编辑文字`,
        async () => {
          if (contentChanged) await eng.updateTextContent(targetId, redoContent);
          if (heightChanged) await eng.updateEntityProps(targetId, JSON.stringify({ height: redoHeight }));
          if (rotationChanged) await eng.updateEntityProps(targetId, JSON.stringify({ rotation: redoRotationRad }));
        },
        async () => {
          if (contentChanged) await eng.updateTextContent(targetId, undoContent);
          if (heightChanged) await eng.updateEntityProps(targetId, JSON.stringify({ height: undoHeight }));
          if (rotationChanged) await eng.updateEntityProps(targetId, JSON.stringify({ rotation: undoRotationRad }));
        },
      );
      setCadbinTextEditor(null);
      setSnackbar({ open: true, message: "文字已更新并写回 .cadbin", severity: "success" });
      setIsDirty(true);
    } catch (err) {
      try {
        if (contentChanged) await eng.updateTextContent(targetId, undoContent);
        if (heightChanged) await eng.updateEntityProps(targetId, JSON.stringify({ height: undoHeight }));
        if (rotationChanged) await eng.updateEntityProps(targetId, JSON.stringify({ rotation: undoRotationRad }));
      } catch {
        /* ignore */
      }
      const msg = err instanceof Error ? err.message : String(err);
      setSnackbar({ open: true, message: `保存失败: ${msg}`, severity: "error" });
    } finally {
      setCadbinTextSaving(false);
    }
  }, [cadbinTextEditor, cadbinPushCmd]);

  const handleCadbinTextCancel = useCallback(() => {
    setCadbinTextEditor(null);
  }, []);

  const cadbinDeleteSelected = useCallback(async () => {
    const eng = cadbinEngineRef.current;
    if (!eng || !cadbinSelected) return;
    const id = cadbinSelected.id;
    const node = eng.getEntityNode(id);
    if (!node) return;
    const snapshot = JSON.parse(JSON.stringify(node));
    try {
      await eng.deleteEntity(id);
      cadbinPushCmd(
        `删除实体 ${snapshot.type}#${id}`,
        async () => { await eng.deleteEntity(id); },
        async () => {
          await eng.restoreEntity(snapshot);
          setCadbinSelected({
            id: String(snapshot.id),
            type: snapshot.type,
            layer: snapshot.layer,
            color: snapshot.color,
            bbox: snapshot.bbox,
            extra: (snapshot.type === 'text' || snapshot.type === 'mText')
              ? { content: (snapshot as any).content }
              : undefined,
          });
        },
      );
      setCadbinSelected(null);
      setSnackbar({ open: true, message: "实体已删除", severity: "success" });
      setIsDirty(true);
    } catch (e) {
      setSnackbar({ open: true, message: `删除失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
    }
  }, [cadbinSelected, cadbinPushCmd]);

  const cadbinChangeColor = useCallback(async (newColorRgb: number) => {
    const eng = cadbinEngineRef.current;
    if (!eng || !cadbinSelected) return;
    const id = cadbinSelected.id;
    const oldColor = cadbinSelected.color;
    try {
      await eng.updateEntityColor(id, newColorRgb);
      setCadbinSelected((s) => (s ? { ...s, color: newColorRgb } : s));
      cadbinPushCmd(
        `改实体颜色 0x${newColorRgb.toString(16).padStart(6, "0")}`,
        async () => { await eng.updateEntityColor(id, newColorRgb); setCadbinSelected((s) => s && s.id === id ? { ...s, color: newColorRgb } : s); },
        async () => { await eng.updateEntityColor(id, oldColor); setCadbinSelected((s) => s && s.id === id ? { ...s, color: oldColor } : s); },
      );
    } catch (e) {
      setSnackbar({ open: true, message: `改色失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
    }
  }, [cadbinSelected, cadbinPushCmd]);

  const cadbinCopySelected = useCallback(() => {
    const eng = cadbinEngineRef.current;
    if (!eng || !cadbinSelected) return;
    const node = eng.getEntityNode(cadbinSelected.id);
    if (node) {
      clipboardRef.current = JSON.parse(JSON.stringify(node));
      setSnackbar({ open: true, message: `已复制 ${ENTITY_TYPE_LABELS[node.type] || node.type}`, severity: "info" });
    }
  }, [cadbinSelected]);

  const cadbinPasteClipboard = useCallback(async () => {
    const eng = cadbinEngineRef.current;
    const snapshot = clipboardRef.current;
    if (!eng || !snapshot) return;
    const cam = eng.getCameraInfo();
    if (!cam) return;
    const offset = Math.min(cam.worldWidth, cam.worldHeight) * 0.05;
    const clone = JSON.parse(JSON.stringify(snapshot));
    delete clone.id;
    switch (clone.type) {
      case 'line':
        clone.startX += offset; clone.startY += offset;
        clone.endX += offset; clone.endY += offset;
        break;
      case 'circle': case 'arc': case 'ellipse':
        clone.centerX += offset; clone.centerY += offset;
        break;
      case 'text': case 'mText': case 'point': case 'insert':
        clone.posX += offset; clone.posY += offset;
        break;
      case 'lwPolyline': case 'polyline':
        clone.vertices = clone.vertices.map((v: any) => ({ ...v, x: v.x + offset, y: v.y + offset }));
        break;
      case 'spline':
        clone.controlPoints = clone.controlPoints?.map((p: any) => ({ ...p, x: p.x + offset, y: p.y + offset }));
        clone.fitPoints = clone.fitPoints?.map((p: any) => ({ ...p, x: p.x + offset, y: p.y + offset }));
        break;
      case 'solid':
        clone.points = clone.points?.map((p: any) => ({ ...p, x: p.x + offset, y: p.y + offset }));
        break;
    }
    const entityJson = JSON.stringify(clone);
    try {
      const newId = await eng.addEntity(entityJson);
      const node = eng.getEntityNode(newId);
      if (node) eng.addEntityLocally(node);
      cadbinPushCmd(
        `粘贴 ${ENTITY_TYPE_LABELS[clone.type] || clone.type}`,
        async () => {
          const id2 = await eng.addEntity(entityJson);
          const n2 = eng.getEntityNode(id2);
          if (n2) eng.addEntityLocally(n2);
        },
        async () => { await eng.deleteEntity(newId); },
      );
      setSnackbar({ open: true, message: "已粘贴", severity: "success" });
      setIsDirty(true);
    } catch (e) {
      setSnackbar({ open: true, message: `粘贴失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
    }
  }, [cadbinPushCmd]);

  const cadbinChangeLayer = useCallback(async (newLayer: string) => {
    const eng = cadbinEngineRef.current;
    if (!eng || !cadbinSelected) return;
    const id = cadbinSelected.id;
    const oldLayer = cadbinSelected.layer;
    try {
      await eng.updateEntityLayer(id, newLayer);
      setCadbinSelected((s) => (s ? { ...s, layer: newLayer } : s));
      cadbinPushCmd(
        `把实体移到图层 ${newLayer}`,
        async () => { await eng.updateEntityLayer(id, newLayer); setCadbinSelected((s) => s && s.id === id ? { ...s, layer: newLayer } : s); },
        async () => { await eng.updateEntityLayer(id, oldLayer); setCadbinSelected((s) => s && s.id === id ? { ...s, layer: oldLayer } : s); },
      );
    } catch (e) {
      setSnackbar({ open: true, message: `改图层失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
    }
  }, [cadbinSelected, cadbinPushCmd]);

  const cadbinChangeLayerColor = useCallback(async (layerName: string, newColorRgb: number) => {
    const eng = cadbinEngineRef.current;
    if (!eng) return;
    try {
      await eng.updateLayerProps(layerName, { color: newColorRgb });
      setSnackbar({ open: true, message: `图层 ${layerName} 颜色已更新`, severity: "success" });
      setIsDirty(true);
    } catch (e) {
      setSnackbar({ open: true, message: `图层改色失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
    }
  }, []);

  const cadbinBatchDelete = useCallback(async () => {
    const eng = cadbinEngineRef.current;
    if (!eng || selectedEntityIds.length === 0) return;
    const snapshots: import("../editor/cad/cad_runtime/scene_node").SceneNode[] = [];
    for (const id of selectedEntityIds) {
      const node = eng.getEntityNode(id);
      if (node) snapshots.push(JSON.parse(JSON.stringify(node)));
    }
    if (snapshots.length === 0) return;
    try {
      for (const id of selectedEntityIds) {
        await eng.deleteEntity(id);
      }
      cadbinPushCmd(
        `批量删除 ${snapshots.length} 个实体`,
        async () => { for (const snap of snapshots) { await eng.deleteEntity(String(snap.id)); } },
        async () => { for (const snap of snapshots) { await eng.restoreEntity(snap); } },
      );
      setCadbinSelected(null);
      setSelectedEntityIds([]);
      setSnackbar({ open: true, message: `已删除 ${snapshots.length} 个实体`, severity: "success" });
      setIsDirty(true);
    } catch (e) {
      setSnackbar({ open: true, message: `批量删除失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
    }
  }, [selectedEntityIds, cadbinPushCmd]);

  const cadbinBatchChangeColor = useCallback(async (newColorRgb: number) => {
    const eng = cadbinEngineRef.current;
    if (!eng || selectedEntityIds.length === 0) return;
    const oldColors: Map<string, number> = new Map();
    for (const id of selectedEntityIds) {
      const node = eng.getEntityNode(id);
      if (node) oldColors.set(id, node.color);
    }
    try {
      for (const id of selectedEntityIds) {
        await eng.updateEntityColor(id, newColorRgb);
      }
      cadbinPushCmd(
        `批量改色 0x${newColorRgb.toString(16).padStart(6, "0")}`,
        async () => { for (const id of selectedEntityIds) { await eng.updateEntityColor(id, newColorRgb); } },
        async () => { for (const [id, oldColor] of oldColors) { await eng.updateEntityColor(id, oldColor); } },
      );
      setIsDirty(true);
      setSnackbar({ open: true, message: `已修改 ${selectedEntityIds.length} 个实体颜色`, severity: "success" });
    } catch (e) {
      setSnackbar({ open: true, message: `批量改色失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
    }
  }, [selectedEntityIds, cadbinPushCmd]);

  const cadbinBatchChangeLayer = useCallback(async (newLayer: string) => {
    const eng = cadbinEngineRef.current;
    if (!eng || selectedEntityIds.length === 0) return;
    const oldLayers: Map<string, string> = new Map();
    for (const id of selectedEntityIds) {
      const node = eng.getEntityNode(id);
      if (node) oldLayers.set(id, node.layer);
    }
    try {
      for (const id of selectedEntityIds) {
        await eng.updateEntityLayer(id, newLayer);
      }
      cadbinPushCmd(
        `批量移到图层 ${newLayer}`,
        async () => { for (const id of selectedEntityIds) { await eng.updateEntityLayer(id, newLayer); } },
        async () => { for (const [id, oldLayer] of oldLayers) { await eng.updateEntityLayer(id, oldLayer); } },
      );
      setIsDirty(true);
      setSnackbar({ open: true, message: `已移动 ${selectedEntityIds.length} 个实体到图层 ${newLayer}`, severity: "success" });
    } catch (e) {
      setSnackbar({ open: true, message: `批量改图层失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
    }
  }, [selectedEntityIds, cadbinPushCmd]);

  useEffect(() => {
    if (!hasCadbin || isPreviewMode) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (cadbinTextEditor) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEntityIds.length > 1) {
          e.preventDefault();
          void cadbinBatchDelete();
        } else if (cadbinSelected) {
          e.preventDefault();
          void cadbinDeleteSelected();
        }
      } else if (e.key === "Escape") {
        if (isTextPlacing) {
          cadbinEngineRef.current?.cancelTextPlacement();
          setCadbinInteractionMode('select');
          setIsTextPlacing(false);
          isTextPlacingRef.current = false;
        } else if (cadbinSelected) {
          cadbinEngineRef.current?.deselectEntity();
          setCadbinSelected(null);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        void cadbinUndo();
      } else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y")
              || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        void cadbinRedo();
      } else if (e.key === "+" || e.key === "=") {
        cadbinEngineRef.current?.zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        cadbinEngineRef.current?.zoomOut();
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        cadbinEngineRef.current?.fitToView();
      } else if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey) {
        setCadbinInteractionMode('select');
        cadbinEngineRef.current?.setInteractionMode('select');
      } else if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey) {
        setCadbinInteractionMode('pan');
        cadbinEngineRef.current?.setInteractionMode('pan');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && cadbinSelected) {
        e.preventDefault();
        cadbinCopySelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        void cadbinPasteClipboard();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasCadbin, isPreviewMode, cadbinSelected, cadbinTextEditor, cadbinDeleteSelected, cadbinUndo, cadbinRedo, cadbinCopySelected, cadbinPasteClipboard, selectedEntityIds, cadbinBatchDelete, isTextPlacing]);

  const filteredLayers = useMemo(() => {
    if (!layerSearch.trim()) return layers;
    const q = layerSearch.toLowerCase();
    return layers.filter((l) => l.name.toLowerCase().includes(q));
  }, [layers, layerSearch]);

  const handleLayerContextMenu = useCallback((e: React.MouseEvent, layerName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLayerContextMenu({ mouseX: e.clientX, mouseY: e.clientY, layerName });
  }, []);

  const handleCloseLayerContextMenu = useCallback(() => {
    setLayerContextMenu(null);
  }, []);

  const handleToggleLayerVisibility = useCallback((layerName: string) => {
    const layer = layersRef.current.find((l) => l.name === layerName);
    if (!layer) return;
    const wasVisible = layer.visible;

    const syncEngineVisibility = (visible: boolean) => {
      const eng = cadbinEngineRef.current;
      if (eng) {
        eng.setLayerVisible(layerName, visible);
        void eng.updateLayerProps(layerName, { visible, frozen: !visible }).catch((err) => {
          console.error("[MapEditorPage] updateLayerProps visible failed", err);
        });
      }
    };

    setLayers((prev) =>
      prev.map((l) => (l.name === layerName ? { ...l, visible: !wasVisible } : l)),
    );
    syncEngineVisibility(!wasVisible);
    setIsDirty(true);
  }, []);

  const handleToggleLayerLock = useCallback((layerName: string) => {
    const layer = layersRef.current.find((l) => l.name === layerName);
    if (!layer) return;
    const wasLocked = layer.locked;

    const syncEngine = (locked: boolean) => {
      const eng = cadbinEngineRef.current;
      if (!eng) return;
      void eng.updateLayerProps(layerName, { locked }).catch((err) => {
        console.error("[MapEditorPage] updateLayerProps locked failed", err);
      });
    };

    setLayers((prev) =>
      prev.map((l) => (l.name === layerName ? { ...l, locked: !wasLocked } : l)),
    );
    syncEngine(!wasLocked);
    setIsDirty(true);
  }, []);

  const handleShowAllLayers = useCallback(() => {
    const eng = cadbinEngineRef.current;
    setLayers((prev) => prev.map((l) => ({ ...l, visible: true })));
    if (eng) {
      eng.setMultipleLayersVisible(layers.map((l) => ({ layerName: l.name, visible: true })));
      void eng.batchUpdateLayerProps(layers.map((l) => ({ layerName: l.name, props: { visible: true, frozen: false } }))).catch((err) => {
        console.error("[MapEditorPage] batchUpdateLayerProps visible failed", err);
      });
    }
    setIsDirty(true);
  }, [layers]);

  const handleHideAllLayers = useCallback(() => {
    const eng = cadbinEngineRef.current;
    setLayers((prev) => prev.map((l) => ({ ...l, visible: false })));
    if (eng) {
      eng.setMultipleLayersVisible(layers.map((l) => ({ layerName: l.name, visible: false })));
      void eng.batchUpdateLayerProps(layers.map((l) => ({ layerName: l.name, props: { visible: false } }))).catch((err) => {
        console.error("[MapEditorPage] batchUpdateLayerProps visible failed", err);
      });
    }
    setIsDirty(true);
  }, [layers]);

  const allLayersVisible = layers.length > 0 && layers.every((l) => l.visible);
  const handleToggleAllLayers = useCallback(() => {
    if (allLayersVisible) {
      handleHideAllLayers();
    } else {
      handleShowAllLayers();
    }
  }, [allLayersVisible, handleShowAllLayers, handleHideAllLayers]);

  const handleLayerContextAction = useCallback((action: string) => {
    const layerName = layerContextMenu?.layerName;
    setLayerContextMenu(null);
    if (!layerName) return;

    switch (action) {
      case "hide":
        handleToggleLayerVisibility(layerName);
        break;
      case "lock":
        handleToggleLayerLock(layerName);
        break;
      case "isolate": {
        const eng = cadbinEngineRef.current;
        setLayers((prev) => {
          const next = prev.map((l) => ({
            ...l,
            visible: l.name === layerName,
          }));
          if (eng) {
            eng.setMultipleLayersVisible(next.map((l) => ({ layerName: l.name, visible: l.visible })));
            void eng.batchUpdateLayerProps(next.map((l) => ({ layerName: l.name, props: { visible: l.visible, frozen: !l.visible } }))).catch((err) => {
              console.error("[MapEditorPage] batchUpdateLayerProps isolate failed", err);
            });
          }
          return next;
        });
        setIsDirty(true);
        break;
      }
      case "showAll": {
        handleShowAllLayers();
        break;
      }
      case "delete": {
        setDeleteLayerConfirm(layerName);
        break;
      }
      case "rename": {
        setRenameLayerTarget(layerName);
        setRenameLayerValue(layerName);
        break;
      }
    }
  }, [layerContextMenu, handleToggleLayerVisibility, handleToggleLayerLock, handleShowAllLayers]);

  const handleSave = useCallback(async () => {
    if (!library) return;
    setSaving(true);
    logger.info("MapEditorPage", "handleSave metadata", { libraryId: library.id });
    try {
      const eng = cadbinEngineRef.current;
      if (eng) {
        await eng.flushPendingChanges();
      }
      const totalEntities = layersRef.current.reduce((s, l) => s + l.entityCount, 0);
      const updatedLib: MapLibrary = {
        ...library,
        entityCount: totalEntities,
        layers: JSON.stringify(layersRef.current.map((l) => ({ name: l.name, visible: l.visible, locked: l.locked, entityCount: l.entityCount }))),
        updatedAt: Math.floor(Date.now() / 1000),
      };
      await saveLibrary(updatedLib);
      setLibrary(updatedLib);
      setIsDirty(false);
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("library-updated", { libraryId: library.id });
      } catch {}
      setSnackbar({ open: true, message: "图库信息已保存（CAD 几何已通过编辑写入 .cadbin）", severity: "success" });
    } catch (err) {
      logger.error("MapEditorPage", "Save failed", { error: String(err) });
      setSnackbar({ open: true, message: "保存失败: " + String(err), severity: "error" });
    } finally {
      setSaving(false);
    }
  }, [library, saveLibrary]);

  const handlePublish = useCallback(async () => {
    if (!library) return;
    setPublishConfirmOpen(false);
    
    try {
      if (!library.cadbinPath) {
        setSnackbar({ open: true, message: "发布失败: 缺少CAD数据文件", severity: "error" });
        return;
      }

      const { invoke } = await import("@tauri-apps/api/core");
      const cadbinExists = await invoke<boolean>("read_map_library_cadbin", { id: library.id })
        .then(() => true)
        .catch(() => false);
      
      if (!cadbinExists) {
        setSnackbar({ open: true, message: "发布失败: CAD数据文件不存在或损坏", severity: "error" });
        return;
      }

      await handleSave();
      const published = await publishLibrary(library.id);
      if (published) {
        setLibrary(published);
        try {
          const { emit } = await import("@tauri-apps/api/event");
          await emit("map-library-published", { libraryId: library.id, mapType: "cad" });
        } catch {}
        setSnackbar({ open: true, message: "发布成功", severity: "success" });
      }
    } catch (err) {
      setSnackbar({ open: true, message: "发布失败: " + String(err), severity: "error" });
    }
  }, [library, handleSave, publishLibrary]);

  const totalEntityCount = useMemo(() => layers.reduce((s, l) => s + l.entityCount, 0), [layers]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  if (loading && !hasCadbin) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !library) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="error" sx={{ mb: 2 }}>{loadError || "图库不存在"}</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => getCurrentWindow().close()}>关闭窗口</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Paper
        square
        elevation={1}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.5,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {library.name}
        </Typography>

        {!isPreviewMode && (
          <Chip label={MAP_LIBRARY_STATUS_LABELS[library.status]} size="small" color={library.status === "published" ? "success" : "default"} />
        )}

        <Box sx={{ flex: 1 }} />

        {!isPreviewMode && (
          <>
            <ToggleButtonGroup
              size="small"
              value={cadbinInteractionMode}
              exclusive
              onChange={(_, mode: string) => {
                if (!mode) return;
                setCadbinInteractionMode(mode as typeof cadbinInteractionMode);
                cadbinEngineRef.current?.setInteractionMode(mode as any);
              }}
              sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, border: 'none', borderRadius: '4px !important' } }}
            >
              <ToggleButton value="select">
                <Tooltip title="选择 (V)" arrow placement="bottom">
                  <NearMeIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="pan">
                <Tooltip title="平移 (H)" arrow placement="bottom">
                  <PanToolIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          </>
        )}

        <Tooltip title="适应窗口">
          <IconButton size="small" onClick={() => cadbinEngineRef.current?.fitToView()}>
            <FitScreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={isDarkBg ? "切换浅色背景" : "切换深色背景"}>
          <IconButton size="small" onClick={() => {
            setIsDarkBg(prev => {
              const newDark = !prev;
              cadbinEngineRef.current?.setBackgroundColor(newDark ? "#1a1a2e" : "#f0f0f0");
              return newDark;
            });
          }}>
            {isDarkBg ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {!isPreviewMode && (
          <>
            <Tooltip title="放大 (+)">
              <IconButton size="small" onClick={() => { cadbinEngineRef.current?.zoomIn(); }}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="缩小 (-)">
              <IconButton size="small" onClick={() => { cadbinEngineRef.current?.zoomOut(); }}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}

        <Divider orientation="vertical" flexItem />

        {!isPreviewMode && (
          <>
            <Tooltip title="撤销 (Ctrl+Z)">
              <span>
                <IconButton size="small" disabled={(() => { cadbinCmdVersion; return cadbinCmdStackRef.current.cursor < 0; })()} onClick={() => void cadbinUndo()}>
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="重做 (Ctrl+Y / Ctrl+Shift+Z)">
              <span>
                <IconButton
                  size="small"
                  disabled={(() => { cadbinCmdVersion; return cadbinCmdStackRef.current.cursor + 1 >= cadbinCmdStackRef.current.items.length; })()}
                  onClick={() => void cadbinRedo()}
                >
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="删除选中 (Delete)">
              <span>
                <IconButton size="small" color="error" disabled={!cadbinSelected} onClick={() => void cadbinDeleteSelected()}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="新增文本注释">
              <IconButton size="small" color={isTextPlacing ? "warning" : "default"} onClick={() => {
                if (isTextPlacing) {
                  cadbinEngineRef.current?.cancelTextPlacement();
                  setCadbinInteractionMode('select');
                  setIsTextPlacing(false);
                  isTextPlacingRef.current = false;
                } else {
                  const eng = cadbinEngineRef.current;
                  const vh = eng?.getViewportWorldHeight() ?? 100;
                  setAddTextContent(""); setAddTextHeight(Math.round(vh * 0.03 * 10) / 10); setAddTextOpen(true);
                }
              }}>
                <FormatSizeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {isTextPlacing && (
              <Typography variant="caption" sx={{ color: 'warning.main', whiteSpace: 'nowrap' }}>
                点击放置文本 · ESC取消
              </Typography>
            )}
            <Divider orientation="vertical" flexItem />
            <Button size="small" variant="outlined" startIcon={<SaveIcon />} onClick={() => void handleSave()} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button size="small" variant="contained" color="success" startIcon={<PublishIcon />} onClick={() => setPublishConfirmOpen(true)} disabled={saving || !library?.cadbinPath}>
              发布
            </Button>
          </>
        )}

        {isPreviewMode && cadbinStatus && (
          <Typography variant="caption" color="text.secondary">
            {Math.round(cadbinStatus.zoom * 100)}%
          </Typography>
        )}
      </Paper>

      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        {!isPreviewMode && (
        <Paper
          square
          sx={{
            width: 240,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box sx={{ px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <LayersIcon fontSize="small" color="action" />
            <Typography variant="caption" sx={{ fontWeight: 600, textTransform: "uppercase" }}>
              图层 ({layers.length})
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="新建图层">
              <IconButton
                size="small"
                onClick={async () => {
                  const eng = cadbinEngineRef.current;
                  if (!eng) return;
                  const name = `新建图层${layers.length + 1}`;
                  try {
                    await eng.createLayer(name);
                    setLayers((prev) => [...prev, {
                      name,
                      file: '',
                      visible: true,
                      locked: false,
                      entityCount: 0,
                      entities: [],
                    }]);
                    setActiveLayerName(name);
                    setSnackbar({ open: true, message: `已创建图层: ${name}`, severity: "success" });
                    setIsDirty(true);
                  } catch (e) {
                    setSnackbar({ open: true, message: `创建图层失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
                  }
                }}
              >
                <AddCircleIcon fontSize="small" sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={allLayersVisible ? "全部隐藏" : "全部显示"}>
              <IconButton size="small" onClick={handleToggleAllLayers}>
                {allLayersVisible ? (
                  <VisibilityOffIcon fontSize="small" sx={{ fontSize: 14 }} />
                ) : (
                  <VisibilityIcon fontSize="small" sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ px: 1, pb: 0.5 }}>
            <TextField
              size="small"
              placeholder="搜索图层..."
              value={layerSearch}
              onChange={(e) => setLayerSearch(e.target.value)}
              fullWidth
              slotProps={{ input: { sx: { fontSize: "0.75rem" } } }}
            />
          </Box>
          <Divider />
          <List dense disablePadding sx={{ flex: 1, overflow: "auto" }}>
            {filteredLayers.map((layer) => {
              let layerColor = "#60a5fa";
              if (layer.colorRgb !== undefined && layer.colorRgb >= 0 && layer.colorRgb !== 0xffffff) {
                const r = (layer.colorRgb >>> 16) & 0xff;
                const g = (layer.colorRgb >>> 8) & 0xff;
                const b = layer.colorRgb & 0xff;
                layerColor = `rgb(${r},${g},${b})`;
              } else if (layer.entities.length > 0) {
                const colorCounts: Record<string, number> = {};
                for (const e of layer.entities) {
                  const c = e.color || "#60a5fa";
                  colorCounts[c] = (colorCounts[c] || 0) + 1;
                }
                let maxCount = 0;
                for (const [c, count] of Object.entries(colorCounts)) {
                  if (count > maxCount) { maxCount = count; layerColor = c; }
                }
              }
              const isActive = activeLayerName === layer.name;
              return (
              <ListItemButton
                key={layer.name}
                selected={isActive}
                sx={{
                  py: 0.5,
                  px: 1,
                  "&.Mui-selected": { backgroundColor: "action.selected" },
                  "&.Mui-selected:hover": { backgroundColor: "action.selected" },
                  opacity: layer.visible ? 1 : 0.5,
                }}
                onClick={() => {
                  setActiveLayerName(layer.name);
                }}
                onContextMenu={(e) => handleLayerContextMenu(e, layer.name)}
              >
                <Box
                  component="label"
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "2px",
                    backgroundColor: layerColor,
                    flexShrink: 0,
                    mr: 1,
                    border: isActive ? "2px solid" : "1px solid",
                    borderColor: isActive ? "primary.main" : "divider",
                    cursor: "pointer",
                    position: "relative",
                  }}
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); }}
                  title="点击修改图层颜色"
                >
                  <input
                    type="color"
                    value={(() => {
                      const c = layer.colorRgb ?? 0x60a5fa;
                      const cc = c >= 0 && c !== 0xffffff ? c : 0x60a5fa;
                      return `#${cc.toString(16).padStart(6, "0")}`;
                    })()}
                    onChange={(e) => {
                      const hex = e.target.value.replace("#", "");
                      const rgb = parseInt(hex, 16);
                      if (Number.isFinite(rgb)) {
                        setLayers((prev) => prev.map((l) => (l.name === layer.name ? { ...l, colorRgb: rgb } : l)));
                        void cadbinChangeLayerColor(layer.name, rgb);
                      }
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                    }}
                  />
                </Box>
                <ListItemText
                  primary={layer.name}
                  secondary={`${layer.entityCount} 个实体`}
                  slotProps={{
                    primary: { variant: "caption", noWrap: true, sx: { fontWeight: isActive ? 600 : 400 } },
                    secondary: { variant: "caption", sx: { fontSize: "0.65rem" } },
                  }}
                />
                <Tooltip title={layer.visible ? "隐藏图层" : "显示图层"}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleToggleLayerVisibility(layer.name); }}
                    sx={{ p: 0.25 }}
                  >
                    {layer.visible ? <VisibilityIcon sx={{ fontSize: 14 }} /> : <VisibilityOffIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={layer.locked ? "解锁图层" : "锁定图层"}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleToggleLayerLock(layer.name); }}
                    sx={{ p: 0.25 }}
                  >
                    {layer.locked ? <LockIcon sx={{ fontSize: 14 }} /> : <LockOpenIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Tooltip>
              </ListItemButton>
              );
            })}
          </List>
          <Divider />
          <Box sx={{ px: 1.5, py: 0.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="caption" color="text.secondary">
              共 {totalEntityCount} 个实体
            </Typography>
            {activeLayerName && (
              <Chip
                label={`当前: ${activeLayerName}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: 10, height: 18, '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
          </Box>
        </Paper>
        )}

        <Box
          ref={containerRef}
          sx={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            cursor: "default",
            backgroundColor: "#0a0a1a",
          }}
        >
          <>
            <div ref={cadbinContainerRef} style={{ width: "100%", height: "100%" }} />
            {loading && (
              <Box sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(10, 10, 26, 0.55)",
                pointerEvents: "none",
                zIndex: 10,
              }}>
                <CircularProgress />
              </Box>
            )}
            {cadbinTextEditor && (
              <Box
                sx={{
                  position: "absolute",
                  left: cadbinTextEditor.left,
                  top: cadbinTextEditor.top,
                  transform: "translate(-50%, -50%)",
                  zIndex: 20,
                  bgcolor: "rgba(255, 255, 255, 0.96)",
                  border: "2px solid #1976d2",
                  borderRadius: 1,
                  boxShadow: 6,
                  p: 1,
                  minWidth: cadbinTextEditor.width,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Typography variant="caption" sx={{ color: "#666", mb: 0.5, display: "block" }}>
                  编辑文字（Enter 保存，Esc 取消）
                </Typography>
                <TextField
                  autoFocus
                  multiline
                  size="small"
                  fullWidth
                  value={cadbinTextEditor.draftContent}
                  onChange={(e) =>
                    setCadbinTextEditor((prev) => (prev ? { ...prev, draftContent: e.target.value } : prev))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleCadbinTextCommit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      handleCadbinTextCancel();
                    }
                  }}
                  disabled={cadbinTextSaving}
                  slotProps={{
                    input: {
                      sx: {
                        fontFamily: "Arial, sans-serif",
                        fontSize: 14,
                        color: cadbinTextEditor.color,
                      },
                    },
                  }}
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                  <Typography variant="caption" sx={{ color: "#666", whiteSpace: "nowrap" }}>
                    高度
                  </Typography>
                  <input
                    type="number"
                    step="any"
                    value={cadbinTextEditor.draftHeight}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCadbinTextEditor((prev) => {
                        if (!prev) return prev;
                        if (raw === '' || raw === '-' || raw === '.' || raw.endsWith('.')) {
                          return { ...prev, draftHeight: raw as any };
                        }
                        const val = parseFloat(raw);
                        if (Number.isFinite(val)) {
                          return { ...prev, draftHeight: val };
                        }
                        return prev;
                      });
                    }}
                    onBlur={() => {
                      setCadbinTextEditor((prev) => {
                        if (!prev) return prev;
                        const val = typeof prev.draftHeight === 'string'
                          ? parseFloat(prev.draftHeight)
                          : prev.draftHeight;
                        if (!Number.isFinite(val)) {
                          return { ...prev, draftHeight: prev.originalHeight };
                        }
                        return { ...prev, draftHeight: val };
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCadbinTextCommit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        handleCadbinTextCancel();
                      }
                    }}
                    style={{
                      width: 80,
                      background: "rgba(0,0,0,0.06)",
                      border: "1px solid rgba(0,0,0,0.2)",
                      borderRadius: 3,
                      fontSize: 12,
                      padding: "2px 4px",
                      fontFamily: "monospace",
                    }}
                  />
                  <Typography variant="caption" sx={{ color: "#666", whiteSpace: "nowrap", ml: 1 }}>
                    旋转°
                  </Typography>
                  <input
                    type="number"
                    step="any"
                    value={cadbinTextEditor.draftRotation}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCadbinTextEditor((prev) => {
                        if (!prev) return prev;
                        if (raw === '' || raw === '-' || raw === '.' || raw.endsWith('.')) {
                          return { ...prev, draftRotation: raw as any };
                        }
                        const val = parseFloat(raw);
                        if (Number.isFinite(val)) {
                          return { ...prev, draftRotation: val };
                        }
                        return prev;
                      });
                    }}
                    onBlur={() => {
                      setCadbinTextEditor((prev) => {
                        if (!prev) return prev;
                        const val = typeof prev.draftRotation === 'string'
                          ? parseFloat(prev.draftRotation)
                          : prev.draftRotation;
                        if (!Number.isFinite(val)) {
                          return { ...prev, draftRotation: prev.originalRotation };
                        }
                        return { ...prev, draftRotation: val };
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCadbinTextCommit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        handleCadbinTextCancel();
                      }
                    }}
                    style={{
                      width: 80,
                      background: "rgba(0,0,0,0.06)",
                      border: "1px solid rgba(0,0,0,0.2)",
                      borderRadius: 3,
                      fontSize: 12,
                      padding: "2px 4px",
                      fontFamily: "monospace",
                    }}
                  />
                </Box>
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
                  <Button size="small" onClick={handleCadbinTextCancel} disabled={cadbinTextSaving}>
                    取消
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleCadbinTextCommit()}
                    disabled={cadbinTextSaving}
                  >
                    {cadbinTextSaving ? "保存中..." : "保存"}
                  </Button>
                </Box>
              </Box>
            )}

            {!isPreviewMode && selectedEntityIds.length > 1 && (
              <Paper
                elevation={6}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 272,
                  maxHeight: "calc(100% - 60px)",
                  overflow: "auto",
                  p: 1.5,
                  zIndex: 15,
                  bgcolor: "rgba(20, 20, 35, 0.96)",
                  color: "#e6e6f0",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#f59e0b" }}>
                    多选 ({selectedEntityIds.length} 个实体)
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => { cadbinEngineRef.current?.deselectEntity(); setCadbinSelected(null); setSelectedEntityIds([]); }}
                    sx={{ p: 0.25, color: "#9fb6ff" }}
                  >
                    <HighlightOffIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 1 }} />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: "#9aa3b8" }}>批量改色</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box
                      component="label"
                      sx={{
                        width: 18,
                        height: 14,
                        borderRadius: 0.5,
                        backgroundColor: "#4fc3f7",
                        border: "1px solid rgba(255,255,255,0.3)",
                        cursor: "pointer",
                        position: "relative",
                        flexShrink: 0,
                      }}
                    >
                      <input
                        type="color"
                        value="#4fc3f7"
                        onChange={(e) => {
                          const rgb = parseInt(e.target.value.replace("#", ""), 16);
                          if (Number.isFinite(rgb)) void cadbinBatchChangeColor(rgb);
                        }}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: 11, color: "#9aa3b8" }}>点击选择颜色</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "#9aa3b8", mt: 0.5 }}>批量改图层</Typography>
                  <select
                    onChange={(e) => void cadbinBatchChangeLayer(e.target.value)}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#e6e6f0",
                      fontSize: 12,
                      padding: "2px 4px",
                      borderRadius: 3,
                    }}
                  >
                    <option value="" style={{ background: "#1a1a2e" }}>选择图层...</option>
                    {layers.map((l) => (
                      <option key={l.name} value={l.name} style={{ background: "#1a1a2e" }}>{l.name}</option>
                    ))}
                  </select>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => void cadbinBatchDelete()}
                    sx={{ fontSize: 11, py: 0.25, mt: 0.5, color: "#ff7676", borderColor: "rgba(255,118,118,0.5)" }}
                  >
                    批量删除 ({selectedEntityIds.length})
                  </Button>
                </Box>
              </Paper>
            )}

            {!isPreviewMode && cadbinSelected && selectedEntityIds.length <= 1 && (
              <Paper
                elevation={6}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 272,
                  maxHeight: "calc(100% - 60px)",
                  overflow: "auto",
                  p: 1.5,
                  zIndex: 15,
                  bgcolor: "rgba(20, 20, 35, 0.96)",
                  color: "#e6e6f0",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#9fb6ff" }}>
                    属性
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Tooltip title="键盘快捷键: Del=删除 · Ctrl+Z=撤销 · Ctrl+Y=重做 · 双击文字=编辑">
                      <IconButton size="small" sx={{ p: 0.25, color: "#5a6a8a" }}>
                        <Typography variant="caption" sx={{ fontSize: 12, fontWeight: 700 }}>?</Typography>
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={() => { cadbinEngineRef.current?.deselectEntity(); setCadbinSelected(null); }}
                      sx={{ p: 0.25, color: "#9fb6ff" }}
                    >
                      <HighlightOffIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 1 }} />
                <Box sx={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 0.5, fontSize: 12 }}>
                  <Typography variant="caption" sx={{ color: "#9aa3b8" }}>类型</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: ENTITY_TYPE_COLORS[cadbinSelected.type] || "#e6e6f0" }}>
                    {ENTITY_TYPE_LABELS[cadbinSelected.type] || cadbinSelected.type}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#9aa3b8" }}>ID</Typography>
                  <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{cadbinSelected.id}</Typography>
                  <Typography variant="caption" sx={{ color: "#9aa3b8" }}>图层</Typography>
                  <select
                    value={cadbinSelected.layer}
                    onChange={(e) => void cadbinChangeLayer(e.target.value)}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#e6e6f0",
                      fontSize: 12,
                      padding: "2px 4px",
                      borderRadius: 3,
                    }}
                  >
                    {layers.map((l) => (
                      <option key={l.name} value={l.name} style={{ background: "#1a1a2e" }}>{l.name}</option>
                    ))}
                  </select>
                  <Typography variant="caption" sx={{ color: "#9aa3b8" }}>颜色</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box
                      component="label"
                      sx={{
                        width: 18,
                        height: 14,
                        borderRadius: 0.5,
                        backgroundColor: (() => {
                          const c = cadbinSelected.color;
                          if (c < 0 || c === 0xffffff) return "#4fc3f7";
                          const r = (c >>> 16) & 0xff;
                          const g = (c >>> 8) & 0xff;
                          const b = c & 0xff;
                          return `rgb(${r},${g},${b})`;
                        })(),
                        border: "1px solid rgba(255,255,255,0.3)",
                        cursor: "pointer",
                        position: "relative",
                        flexShrink: 0,
                      }}
                    >
                      <input
                        type="color"
                        value={(() => {
                          const c = cadbinSelected.color;
                          const cc = c >= 0 && c !== 0xffffff ? c : 0x4fc3f7;
                          return `#${cc.toString(16).padStart(6, "0")}`;
                        })()}
                        onChange={(e) => {
                          const rgb = parseInt(e.target.value.replace("#", ""), 16);
                          if (Number.isFinite(rgb)) void cadbinChangeColor(rgb);
                        }}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: 11 }}>
                      0x{(cadbinSelected.color >>> 0).toString(16).padStart(6, "0").toUpperCase()}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "#9aa3b8" }}>包围盒</Typography>
                  <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: 11 }}>
                    ({cadbinSelected.bbox.minX.toFixed(1)}, {cadbinSelected.bbox.minY.toFixed(1)})
                    <br />
                    ({cadbinSelected.bbox.maxX.toFixed(1)}, {cadbinSelected.bbox.maxY.toFixed(1)})
                  </Typography>
                  {cadbinSelected.extra && Object.entries(cadbinSelected.extra).map(([k, v]) => (
                    <React.Fragment key={k}>
                      <Typography variant="caption" sx={{ color: "#9aa3b8" }}>{k}</Typography>
                      <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                        {k === "content" ? (
                          <Box
                            component="span"
                            sx={{
                              cursor: "pointer",
                              "&:hover": { textDecoration: "underline", color: "#9fb6ff" },
                            }}
                            onClick={() => {
                              const eng = cadbinEngineRef.current;
                              if (!eng) return;
                              const node = eng.getEntityNode(cadbinSelected.id);
                              if (!node || (node.type !== "text" && node.type !== "mText")) return;
                              const containerEl = cadbinContainerRef.current;
                              if (!containerEl) return;
                              const rect = containerEl.getBoundingClientRect();
                              const midX = (cadbinSelected.bbox.minX + cadbinSelected.bbox.maxX) / 2;
                              const midY = (cadbinSelected.bbox.minY + cadbinSelected.bbox.maxY) / 2;
                              const cam = eng.getCameraInfo();
                              if (!cam) return;
                              const pxX = rect.left + rect.width / 2 + (midX - cam.centerX) / cam.worldWidth * rect.width;
                              const pxY = rect.top + rect.height / 2 - (midY - cam.centerY) / cam.worldHeight * rect.height;
                              const colorR = (cadbinSelected.color >>> 16) & 0xff;
                              const colorG = (cadbinSelected.color >>> 8) & 0xff;
                              const colorB = cadbinSelected.color & 0xff;
                              const luma = 0.2126 * (colorR / 255) + 0.7152 * (colorG / 255) + 0.0722 * (colorB / 255);
                              const colorCss = luma > 0.7 ? "#1a1a1a" : `rgb(${colorR}, ${colorG}, ${colorB})`;
                              const baseHeight = Math.max(18, Math.min(36, (cadbinSelected.bbox.maxY - cadbinSelected.bbox.minY) * 1));
                              const baseWidth = Math.max(120, (String(v).length || 4) * baseHeight * 0.6);
                              setCadbinTextEditor({
                                id: cadbinSelected.id,
                                originalContent: String(v),
                                draftContent: String(v),
                                originalHeight: (eng.getEntityNode(cadbinSelected.id) as any)?.height ?? 2.5,
                                draftHeight: (eng.getEntityNode(cadbinSelected.id) as any)?.height ?? 2.5,
                                originalRotation: ((eng.getEntityNode(cadbinSelected.id) as any)?.rotation || 0) * 180 / Math.PI,
                                draftRotation: ((eng.getEntityNode(cadbinSelected.id) as any)?.rotation || 0) * 180 / Math.PI,
                                left: pxX - rect.left,
                                top: pxY - rect.top,
                                width: baseWidth,
                                height: baseHeight,
                                rotation: (eng.getEntityNode(cadbinSelected.id) as any)?.rotation || 0,
                                color: colorCss,
                              });
                            }}
                          >
                            {String(v)}
                          </Box>
                        ) : String(v)}
                      </Typography>
                    </React.Fragment>
                  ))}
                </Box>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 1 }} />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {(() => {
                    const eng = cadbinEngineRef.current;
                    if (!eng) return null;
                    const node = eng.getEntityNode(cadbinSelected.id);
                    if (!node) return null;
                    const fields: { label: string; key: string; value: number; type: 'number' }[] = [];
                    const strFields: { label: string; key: string; value: string; type: 'string' }[] = [];
                    if (node.type === 'line') {
                      fields.push({ label: '起点X', key: 'startX', value: node.startX, type: 'number' });
                      fields.push({ label: '起点Y', key: 'startY', value: node.startY, type: 'number' });
                      fields.push({ label: '终点X', key: 'endX', value: node.endX, type: 'number' });
                      fields.push({ label: '终点Y', key: 'endY', value: node.endY, type: 'number' });
                    } else if (node.type === 'circle') {
                      fields.push({ label: '圆心X', key: 'centerX', value: node.centerX, type: 'number' });
                      fields.push({ label: '圆心Y', key: 'centerY', value: node.centerY, type: 'number' });
                      fields.push({ label: '半径', key: 'radius', value: node.radius, type: 'number' });
                    } else if (node.type === 'arc') {
                      fields.push({ label: '圆心X', key: 'centerX', value: node.centerX, type: 'number' });
                      fields.push({ label: '圆心Y', key: 'centerY', value: node.centerY, type: 'number' });
                      fields.push({ label: '半径', key: 'radius', value: node.radius, type: 'number' });
                      fields.push({ label: '起始角', key: 'startAngle', value: node.startAngle, type: 'number' });
                      fields.push({ label: '终止角', key: 'endAngle', value: node.endAngle, type: 'number' });
                    } else if (node.type === 'ellipse') {
                      fields.push({ label: '圆心X', key: 'centerX', value: node.centerX, type: 'number' });
                      fields.push({ label: '圆心Y', key: 'centerY', value: node.centerY, type: 'number' });
                      fields.push({ label: '短轴比', key: 'minorRatio', value: node.minorRatio, type: 'number' });
                    } else if (node.type === 'text') {
                      strFields.push({ label: '内容', key: 'content', value: (node as any).content ?? '', type: 'string' });
                      fields.push({ label: '位置X', key: 'posX', value: node.posX, type: 'number' });
                      fields.push({ label: '位置Y', key: 'posY', value: node.posY, type: 'number' });
                      fields.push({ label: '高度', key: 'height', value: node.height, type: 'number' });
                      fields.push({ label: '旋转', key: 'rotation', value: node.rotation, type: 'number' });
                    } else if (node.type === 'mText') {
                      strFields.push({ label: '内容', key: 'content', value: (node as any).content ?? '', type: 'string' });
                      fields.push({ label: '位置X', key: 'posX', value: node.posX, type: 'number' });
                      fields.push({ label: '位置Y', key: 'posY', value: node.posY, type: 'number' });
                      fields.push({ label: '高度', key: 'height', value: node.height, type: 'number' });
                      fields.push({ label: '旋转', key: 'rotation', value: node.rotation, type: 'number' });
                      fields.push({ label: '宽度因子', key: 'widthFactor', value: (node as any).widthFactor ?? 1, type: 'number' });
                    } else if (node.type === 'insert') {
                      fields.push({ label: '位置X', key: 'posX', value: node.posX, type: 'number' });
                      fields.push({ label: '位置Y', key: 'posY', value: node.posY, type: 'number' });
                      fields.push({ label: '缩放X', key: 'scaleX', value: node.scaleX, type: 'number' });
                      fields.push({ label: '缩放Y', key: 'scaleY', value: node.scaleY, type: 'number' });
                      fields.push({ label: '旋转', key: 'rotation', value: node.rotation, type: 'number' });
                    } else if (node.type === 'point') {
                      fields.push({ label: '位置X', key: 'posX', value: node.posX, type: 'number' });
                      fields.push({ label: '位置Y', key: 'posY', value: node.posY, type: 'number' });
                    } else if (node.type === 'dimension') {
                      fields.push({ label: '定义点X', key: 'defX', value: node.defX, type: 'number' });
                      fields.push({ label: '定义点Y', key: 'defY', value: node.defY, type: 'number' });
                      fields.push({ label: '中点X', key: 'midX', value: node.midX, type: 'number' });
                      fields.push({ label: '中点Y', key: 'midY', value: node.midY, type: 'number' });
                      fields.push({ label: '旋转', key: 'rotation', value: node.rotation, type: 'number' });
                    }
                    if (fields.length === 0 && strFields.length === 0) return null;
                    return (
                      <>
                        <Typography variant="caption" sx={{ color: "#9aa3b8", mb: 0.5 }}>属性编辑</Typography>
                        {strFields.map((f) => (
                          <Box key={f.key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Typography variant="caption" sx={{ color: "#7a8aa3", minWidth: 36, fontSize: 10 }}>{f.label}</Typography>
                            <input
                              type="text"
                              value={fieldValues[f.key] ?? f.value}
                              onChange={(e) => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                              onFocus={() => { activeFieldRef.current = f.key; }}
                              onBlur={async (e) => {
                                activeFieldRef.current = null;
                                const newVal = e.target.value;
                                if (newVal === f.value) return;
                                const targetId = cadbinSelected.id;
                                try {
                                  await eng.updateTextContent(targetId, newVal);
                                  cadbinPushCmd(
                                    `修改 ${f.label}`,
                                    async () => { await eng.updateTextContent(targetId, newVal); },
                                    async () => { await eng.updateTextContent(targetId, f.value); },
                                  );
                                  const updatedNode = eng.getEntityNode(targetId);
                                  if (updatedNode) {
                                    setCadbinSelected({
                                      id: targetId,
                                      type: updatedNode.type,
                                      layer: updatedNode.layer,
                                      color: updatedNode.color,
                                      bbox: { ...updatedNode.bbox },
                                      extra: (updatedNode.type === 'text' || updatedNode.type === 'mText') ? { content: (updatedNode as any).content } : undefined,
                                    });
                                  }
                                  setFieldVersion(v => v + 1);
                                  setIsDirty(true);
                                } catch (err) {
                                  setFieldValues(prev => ({ ...prev, [f.key]: f.value }));
                                  setSnackbar({ open: true, message: `属性修改失败: ${err instanceof Error ? err.message : String(err)}`, severity: "error" });
                                }
                              }}
                              style={{
                                width: "100%",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 3,
                                color: "#c0c8d8",
                                fontSize: 11,
                                padding: "2px 4px",
                                fontFamily: "monospace",
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </Box>
                        ))}
                        {fields.map((f) => (
                          <Box key={f.key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Typography variant="caption" sx={{ color: "#7a8aa3", minWidth: 36, fontSize: 10 }}>{f.label}</Typography>
                            <input
                              type="number"
                              step="any"
                              value={fieldValues[f.key] ?? f.value.toFixed(2)}
                              onChange={(e) => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                              onFocus={() => { activeFieldRef.current = f.key; }}
                              onBlur={async (e) => {
                                activeFieldRef.current = null;
                                const newVal = parseFloat(e.target.value);
                                if (!Number.isFinite(newVal) || newVal === f.value) return;
                                const props: Record<string, number> = { [f.key]: newVal };
                                const undoProps: Record<string, number> = { [f.key]: f.value };
                                const targetId = cadbinSelected.id;
                                try {
                                  await eng.updateEntityProps(targetId, JSON.stringify(props));
                                  cadbinPushCmd(
                                    `修改 ${f.label}: ${f.value.toFixed(2)} → ${newVal.toFixed(2)}`,
                                    async () => { await eng.updateEntityProps(targetId, JSON.stringify(props)); },
                                    async () => { await eng.updateEntityProps(targetId, JSON.stringify(undoProps)); },
                                  );
                                  const updatedNode = eng.getEntityNode(targetId);
                                  if (updatedNode) {
                                    setCadbinSelected({
                                      id: targetId,
                                      type: updatedNode.type,
                                      layer: updatedNode.layer,
                                      color: updatedNode.color,
                                      bbox: { ...updatedNode.bbox },
                                      extra: (updatedNode.type === 'text' || updatedNode.type === 'mText') ? { content: (updatedNode as any).content } : undefined,
                                    });
                                  }
                                  setFieldVersion(v => v + 1);
                                  setIsDirty(true);
                                } catch (err) {
                                  setFieldValues(prev => ({ ...prev, [f.key]: f.value.toFixed(2) }));
                                  setSnackbar({ open: true, message: `属性修改失败: ${err instanceof Error ? err.message : String(err)}`, severity: "error" });
                                }
                              }}
                              style={{
                                width: "100%",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 3,
                                color: "#c0c8d8",
                                fontSize: 11,
                                padding: "2px 4px",
                                fontFamily: "monospace",
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </Box>
                        ))}
                      </>
                    );
                  })()}
                </Box>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 1 }} />
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
                    onClick={() => void cadbinDeleteSelected()}
                    sx={{ fontSize: 11, py: 0.25, color: "#ff7676", borderColor: "rgba(255,118,118,0.5)" }}
                  >
                    删除
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setPreciseMoveDx("0");
                      setPreciseMoveDy("0");
                      setPreciseMoveOpen(true);
                    }}
                    sx={{ fontSize: 11, py: 0.25, color: "#9fb6ff", borderColor: "rgba(159,182,255,0.4)" }}
                  >
                    精确平移…
                  </Button>
                  {(cadbinSelected.type === "text" || cadbinSelected.type === "mText") && !!cadbinSelected.extra?.content && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const eng = cadbinEngineRef.current;
                        if (!eng) return;
                        const node = eng.getEntityNode(cadbinSelected.id);
                        if (!node) return;
                        const containerEl = cadbinContainerRef.current;
                        if (!containerEl) return;
                        const rect = containerEl.getBoundingClientRect();
                        const midX = (cadbinSelected.bbox.minX + cadbinSelected.bbox.maxX) / 2;
                        const midY = (cadbinSelected.bbox.minY + cadbinSelected.bbox.maxY) / 2;
                        const cam = eng.getCameraInfo();
                        if (!cam) return;
                        const pxX = rect.left + rect.width / 2 + (midX - cam.centerX) / cam.worldWidth * rect.width;
                        const pxY = rect.top + rect.height / 2 - (midY - cam.centerY) / cam.worldHeight * rect.height;
                        const colorR = (cadbinSelected.color >>> 16) & 0xff;
                        const colorG = (cadbinSelected.color >>> 8) & 0xff;
                        const colorB = cadbinSelected.color & 0xff;
                        const luma = 0.2126 * (colorR / 255) + 0.7152 * (colorG / 255) + 0.0722 * (colorB / 255);
                        const colorCss = luma > 0.7 ? "#1a1a1a" : `rgb(${colorR}, ${colorG}, ${colorB})`;
                        const baseHeight = Math.max(18, Math.min(36, (cadbinSelected.bbox.maxY - cadbinSelected.bbox.minY) * 1));
                        const baseWidth = Math.max(120, ((node as { content: string }).content?.length || 4) * baseHeight * 0.6);
                        setCadbinTextEditor({
                          id: cadbinSelected.id,
                          originalContent: (node as { content: string }).content,
                          draftContent: (node as { content: string }).content,
                          originalHeight: (node as { height: number }).height ?? 2.5,
                          draftHeight: (node as { height: number }).height ?? 2.5,
                          originalRotation: ((node as { rotation: number }).rotation || 0) * 180 / Math.PI,
                          draftRotation: ((node as { rotation: number }).rotation || 0) * 180 / Math.PI,
                          left: pxX - rect.left,
                          top: pxY - rect.top,
                          width: baseWidth,
                          height: baseHeight,
                          rotation: (node as { rotation: number }).rotation || 0,
                          color: colorCss,
                        });
                      }}
                      sx={{ fontSize: 11, py: 0.25, color: "#34d399", borderColor: "rgba(52,211,153,0.4)" }}
                    >
                      编辑文字
                    </Button>
                  )}
                </Box>
                <Box sx={{ mt: 1, px: 0.5, py: 0.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, color: "#5a6a8a", lineHeight: 1.4, display: "block" }}>
                    Del 删除 · Ctrl+Z 撤销 · Ctrl+Y 重做 · 双击文字编辑
                  </Typography>
                </Box>
              </Paper>
            )}

            {!isPreviewMode && (
              <Paper
                elevation={4}
                sx={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 12,
                  px: 1.5,
                  py: 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  bgcolor: "rgba(20, 20, 35, 0.85)",
                  color: "#bdc8e6",
                  fontSize: 11,
                  fontFamily: "monospace",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 0,
                }}
              >
                <span>X: {cadbinStatus ? cadbinStatus.cursorX.toFixed(2) : "—"}</span>
                <span>Y: {cadbinStatus ? cadbinStatus.cursorY.toFixed(2) : "—"}</span>
                <span>Zoom: {cadbinStatus ? `${cadbinStatus.zoom.toFixed(3)}x` : "—"}</span>
                <Box sx={{ flex: 1 }} />
                <span>选中: {selectedEntityIds.length > 1 ? `${selectedEntityIds.length} 个实体` : cadbinSelected ? `${ENTITY_TYPE_LABELS[cadbinSelected.type] || cadbinSelected.type}#${cadbinSelected.id}` : "无"}</span>
                <span>历史: {(() => { cadbinCmdVersion; return `${cadbinCmdStackRef.current.cursor + 1}/${cadbinCmdStackRef.current.items.length}`; })()}</span>
                <span style={{ opacity: 0.5 }}>v{cadbinCmdVersion}</span>
              </Paper>
            )}
          </>
        </Box>
      </Box>

      <Dialog open={publishConfirmOpen} onClose={() => setPublishConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="warning" />
          确认发布
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            发布后该地图将变为“已发布”状态，可被其他场景引用使用。
          </Typography>
          
          <Box sx={{ 
            backgroundColor: "background.default", 
            borderRadius: 1, 
            padding: 2,
            mb: 2
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              地图信息
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" color="text.secondary">名称</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{library?.name}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" color="text.secondary">实体数量</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{totalEntityCount}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">图层数量</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{layers.length}</Typography>
            </Box>
          </Box>

          {isDirty && (
            <Alert severity="info" sx={{ mt: 1 }}>
              发布前将自动保存图库元数据（实体数、图层显隐等）；CAD 几何已保存在 .cadbin 中。
            </Alert>
          )}
          
          <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 2 }}>
            发布后可在场景编辑中通过"CAD图纸"组件引用此地图
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPublishConfirmOpen(false)}>取消</Button>
          <Button variant="contained" color="success" onClick={() => void handlePublish()} startIcon={<PublishIcon />}>
            确认发布
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={preciseMoveOpen} onClose={() => setPreciseMoveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>精确平移</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="X 方向位移（世界单位）"
            type="number"
            fullWidth
            value={preciseMoveDx}
            onChange={(e) => setPreciseMoveDx(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Y 方向位移（世界单位）"
            type="number"
            fullWidth
            value={preciseMoveDy}
            onChange={(e) => setPreciseMoveDy(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreciseMoveOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const dx = parseFloat(preciseMoveDx);
              const dy = parseFloat(preciseMoveDy);
              if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
              const eng = cadbinEngineRef.current;
              if (!eng || !cadbinSelected) return;
              const idForMove = cadbinSelected.id;
              try {
                await eng.moveEntity(idForMove, dx, dy);
                cadbinPushCmd(
                  `平移 (${dx.toFixed(2)}, ${dy.toFixed(2)})`,
                  async () => { await eng.moveEntity(idForMove, dx, dy); },
                  async () => { await eng.moveEntity(idForMove, -dx, -dy); },
                );
                setSnackbar({ open: true, message: `已平移 (${dx.toFixed(2)}, ${dy.toFixed(2)})`, severity: "success" });
                setIsDirty(true);
              } catch (e) {
                setSnackbar({ open: true, message: `移动失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
              }
              setPreciseMoveOpen(false);
            }}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Menu
        open={layerContextMenu !== null}
        onClose={handleCloseLayerContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          layerContextMenu ? { top: layerContextMenu.mouseY, left: layerContextMenu.mouseX } : undefined
        }
      >
        <MenuItem onClick={() => handleLayerContextAction("hide")}>
          <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
          <ListItemText>隐藏/显示</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleLayerContextAction("lock")}>
          <ListItemIcon><LockIcon fontSize="small" /></ListItemIcon>
          <ListItemText>锁定/解锁</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleLayerContextAction("isolate")}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>隔离图层</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleLayerContextAction("showAll")}>
          <ListItemIcon><LayersIcon fontSize="small" /></ListItemIcon>
          <ListItemText>显示全部</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleLayerContextAction("rename")}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>重命名</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleLayerContextAction("delete")} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
          <ListItemText>删除图层</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={deleteLayerConfirm !== null} onClose={() => setDeleteLayerConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除图层</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            确定要删除图层 <strong>{deleteLayerConfirm}</strong> 吗？
          </Typography>
          {(() => {
            const layer = layers.find(l => l.name === deleteLayerConfirm);
            if (layer && layer.entityCount > 0) {
              return (
                <Typography variant="body2" sx={{ mt: 1, color: 'warning.main' }}>
                  该图层包含 {layer.entityCount} 个实体，删除后实体将移至图层 "0"。
                </Typography>
              );
            }
            return null;
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteLayerConfirm(null)}>取消</Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              const layerName = deleteLayerConfirm;
              setDeleteLayerConfirm(null);
              if (!layerName) return;
              const eng = cadbinEngineRef.current;
              if (!eng) return;
              try {
                const layer = layers.find(l => l.name === layerName);
                const hasEntities = layer && layer.entityCount > 0;
                const movedCount = layer?.entityCount ?? 0;
                await eng.deleteLayer(layerName, false);
                setLayers((prev) => {
                  const rest = prev.filter((l) => l.name !== layerName);
                  const result = movedCount > 0
                    ? rest.map(l => l.name === '0' ? { ...l, entityCount: l.entityCount + movedCount } : l)
                    : rest;
                  layersRef.current = result;
                  return result;
                });
                if (activeLayerName === layerName) {
                  setActiveLayerName(layers.length > 1 ? layers.find(l => l.name !== layerName)?.name || null : null);
                }
                setIsDirty(true);
                setSnackbar({ open: true, message: `已删除图层: ${layerName}${hasEntities ? '（实体已移至图层 0）' : ''}`, severity: "success" });
                void handleSave();
              } catch (e) {
                setSnackbar({ open: true, message: `删除图层失败: ${e instanceof Error ? e.message : String(e)}`, severity: "error" });
              }
            }}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameLayerTarget !== null} onClose={() => setRenameLayerTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>重命名图层</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="图层名称"
            value={renameLayerValue}
            onChange={(e) => setRenameLayerValue(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newName = renameLayerValue.trim();
                if (newName && renameLayerTarget && newName !== renameLayerTarget) {
                  const eng = cadbinEngineRef.current;
                  if (eng) {
                    void eng.renameLayer(renameLayerTarget, newName).then(() => {
                      setLayers((prev) => {
                        const result = prev.map((l) => l.name === renameLayerTarget ? { ...l, name: newName } : l);
                        layersRef.current = result;
                        return result;
                      });
                      if (activeLayerName === renameLayerTarget) {
                        setActiveLayerName(newName);
                      }
                      setIsDirty(true);
                      void handleSave();
                      setRenameLayerTarget(null);
                    }).catch((err) => {
                      setSnackbar({ open: true, message: `重命名失败: ${err instanceof Error ? err.message : String(err)}`, severity: "error" });
                    });
                  }
                }
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameLayerTarget(null)}>取消</Button>
          <Button
            variant="contained"
            disabled={!renameLayerValue.trim() || renameLayerValue.trim() === renameLayerTarget}
            onClick={async () => {
              const newName = renameLayerValue.trim();
              if (!newName || !renameLayerTarget || newName === renameLayerTarget) return;
              const eng = cadbinEngineRef.current;
              if (!eng) return;
              try {
                await eng.renameLayer(renameLayerTarget, newName);
                setLayers((prev) => {
                  const result = prev.map((l) => l.name === renameLayerTarget ? { ...l, name: newName } : l);
                  layersRef.current = result;
                  return result;
                });
                if (activeLayerName === renameLayerTarget) {
                  setActiveLayerName(newName);
                }
                setIsDirty(true);
                void handleSave();
                setRenameLayerTarget(null);
              } catch (err) {
                setSnackbar({ open: true, message: `重命名失败: ${err instanceof Error ? err.message : String(err)}`, severity: "error" });
              }
            }}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addTextOpen} onClose={() => setAddTextOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>新增文本注释</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="文本内容"
            value={addTextContent}
            onChange={(e) => setAddTextContent(e.target.value)}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            type="number"
            label="文字高度"
            value={addTextHeight}
            onChange={(e) => setAddTextHeight(Number(e.target.value))}
            sx={{ mt: 2 }}
            slotProps={{ htmlInput: { min: 0.1, step: 0.5 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTextOpen(false)}>取消</Button>
          <Button
            variant="contained"
            disabled={!addTextContent.trim()}
            onClick={() => {
              const eng = cadbinEngineRef.current;
              if (!eng) return;
              const layer = activeLayerName || '0';
              eng.startTextPlacement({
                content: addTextContent.trim(),
                height: addTextHeight,
                layer,
                color: 3,
              });
              setCadbinInteractionMode('draw_text');
              setIsTextPlacing(true);
              isTextPlacingRef.current = true;
              setAddTextOpen(false);
            }}
          >
            放置文本
          </Button>
        </DialogActions>
      </Dialog>

      {!isPreviewMode && (
        <Menu
          open={entityContextMenu !== null}
          onClose={() => setEntityContextMenu(null)}
          anchorReference="anchorPosition"
          anchorPosition={
            entityContextMenu ? { top: entityContextMenu.mouseY, left: entityContextMenu.mouseX } : undefined
          }
        >
          <MenuItem onClick={() => {
            if (!entityContextMenu) return;
            const eng = cadbinEngineRef.current;
            if (eng) {
              eng.selectEntity(entityContextMenu.entityId);
              setCadbinSelected(() => {
                const node = eng.getEntityNode(entityContextMenu.entityId);
                if (!node) return null;
                return {
                  id: entityContextMenu.entityId,
                  type: node.type,
                  layer: node.layer,
                  color: node.color,
                  bbox: { ...node.bbox },
                  extra: (node.type === 'text' || node.type === 'mText') ? { content: (node as any).content } : undefined,
                };
              });
            }
            setEntityContextMenu(null);
          }}>
            <ListItemIcon><NearMeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>选中</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => {
            if (!entityContextMenu) return;
            const eng = cadbinEngineRef.current;
            if (eng) {
              eng.selectEntity(entityContextMenu.entityId);
              const node = eng.getEntityNode(entityContextMenu.entityId);
              if (node && (node.type === 'text' || node.type === 'mText')) {
                const containerEl = cadbinContainerRef.current;
                if (containerEl) {
                  const rect = containerEl.getBoundingClientRect();
                  const midX = (node.bbox.minX + node.bbox.maxX) / 2;
                  const midY = (node.bbox.minY + node.bbox.maxY) / 2;
                  const cam = eng.getCameraInfo();
                  if (cam) {
                    const pxX = rect.left + rect.width / 2 + (midX - cam.centerX) / cam.worldWidth * rect.width;
                    const pxY = rect.top + rect.height / 2 - (midY - cam.centerY) / cam.worldHeight * rect.height;
                    const colorR = (node.color >>> 16) & 0xff;
                    const colorG = (node.color >>> 8) & 0xff;
                    const colorB = node.color & 0xff;
                    const luma = 0.2126 * (colorR / 255) + 0.7152 * (colorG / 255) + 0.0722 * (colorB / 255);
                    const colorCss = luma > 0.7 ? "#1a1a1a" : `rgb(${colorR}, ${colorG}, ${colorB})`;
                    const baseHeight = Math.max(18, Math.min(36, (node.bbox.maxY - node.bbox.minY) * 1));
                    const baseWidth = Math.max(120, ((node as any).content?.length || 4) * baseHeight * 0.6);
                    setCadbinTextEditor({
                      id: entityContextMenu.entityId,
                      originalContent: (node as any).content,
                      draftContent: (node as any).content,
                      originalHeight: (node as { height: number }).height ?? 2.5,
                      draftHeight: (node as { height: number }).height ?? 2.5,
                      originalRotation: ((node as any).rotation || 0) * 180 / Math.PI,
                      draftRotation: ((node as any).rotation || 0) * 180 / Math.PI,
                      left: pxX - rect.left,
                      top: pxY - rect.top,
                      width: baseWidth,
                      height: baseHeight,
                      rotation: (node as any).rotation || 0,
                      color: colorCss,
                    });
                  }
                }
              }
            }
            setEntityContextMenu(null);
          }} disabled={!entityContextMenu || (() => {
            const eng = cadbinEngineRef.current;
            if (!eng || !entityContextMenu) return true;
            const node = eng.getEntityNode(entityContextMenu.entityId);
            return !node || (node.type !== 'text' && node.type !== 'mText');
          })()}>
            <ListItemIcon><HighlightOffIcon fontSize="small" /></ListItemIcon>
            <ListItemText>编辑文字</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => {
            if (!entityContextMenu) return;
            const eng = cadbinEngineRef.current;
            if (eng) {
              eng.selectEntity(entityContextMenu.entityId);
              const node = eng.getEntityNode(entityContextMenu.entityId);
              if (node) {
                clipboardRef.current = JSON.parse(JSON.stringify(node));
                setSnackbar({ open: true, message: `已复制 ${ENTITY_TYPE_LABELS[node.type] || node.type}`, severity: "info" });
              }
            }
            setEntityContextMenu(null);
          }}>
            <ListItemText>复制 (Ctrl+C)</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => {
            setEntityContextMenu(null);
            void cadbinPasteClipboard();
          }} disabled={!clipboardRef.current}>
            <ListItemText>粘贴 (Ctrl+V)</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => {
            if (!entityContextMenu) return;
            const eng = cadbinEngineRef.current;
            if (eng) {
              eng.selectEntity(entityContextMenu.entityId);
              const node = eng.getEntityNode(entityContextMenu.entityId);
              if (node) {
                setCadbinSelected({
                  id: entityContextMenu.entityId,
                  type: node.type,
                  layer: node.layer,
                  color: node.color,
                  bbox: { ...node.bbox },
                  extra: (node.type === 'text' || node.type === 'mText') ? { content: (node as any).content } : undefined,
                });
              }
            }
            setEntityContextMenu(null);
            void cadbinDeleteSelected();
          }}>
            <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
            <ListItemText>删除</ListItemText>
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
}
