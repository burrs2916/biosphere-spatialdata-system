import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import Divider from "@mui/material/Divider";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { componentRegistry } from "../editor/registry";
import { pluginLoader, resolveIcon } from "../editor/plugins";
import { loadComponentPreviewConfig, clearComponentPreviewConfig } from "../utils/previewWindow";
import { logger } from "../utils/logger";
import { IconPicker } from "../components/component/IconPicker";
import {
  parseIconSource,
  serializeIconSource,
  type IconSource,
} from "../utils/iconSource";

type TabKey = "auto" | "icon" | "upload" | "text" | "color";

const EMOJI_SAMPLES = ["📊", "📈", "📉", "🎯", "⚙️", "🔧", "💡", "🔥", "⚡", "🌐", "🗺️", "📍", "🛰️", "🏗️", "🛠️", "✨", "🎨", "🧭", "📐", "🔍"];

const PRESETS = [
  { w: 200, h: 150, label: "200×150" },
  { w: 400, h: 300, label: "400×300" },
  { w: 600, h: 400, label: "600×400" },
  { w: 800, h: 600, label: "800×600" },
];

const ASPECT_PRESETS = [
  { w: 1, h: 1, label: "1:1" },
  { w: 4, h: 3, label: "4:3" },
  { w: 16, h: 9, label: "16:9" },
  { w: 3, h: 4, label: "3:4" },
  { w: 9, h: 16, label: "9:16" },
];

const BG_PRESETS = [
  "#0a1929", "#1a2942", "#0d1b2a", "#1e3a5f",
  "#ffffff", "#f5f5f5", "#263238", "#000000",
];

const COLOR_PRESETS = [
  "#4fc3f7", "#7acaec", "#3faacb", "#235fa7",
  "#11eefd", "#00c2ff", "#1dc1f5", "#ff7043",
  "#ffa726", "#66bb6a", "#ab47bc", "#ec407a",
];

async function writeThumbnail(componentType: string, dataUrl: string) {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_thumbnail", { componentType, dataUrl });
}

/** 用 Canvas 合成背景色+前景图片，输出 PNG dataUrl */
function compositeWithBg(
  fgDataUrl: string,
  bg: string,
  radius: number,
  width = 120,
  height = 80,
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    // 绘制圆角背景
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.clip();

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // contain 模式：居中绘制，保持比例
      const scale = Math.min(width / img.width, height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (width - w) / 2;
      const y = (height - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(canvas.toDataURL("image/png"));
    img.src = fgDataUrl;
  });
}

interface CaptureOpts {
  bg: string;
  padding: number;
  borderRadius: number;
  w: number;
  h: number;
  pixelRatio: number;
  transparent: boolean;
}

async function captureWithStyle(stage: HTMLDivElement, opts: CaptureOpts): Promise<string | null> {
  try {
    let restore: (() => void) | null = null;
    if (opts.transparent) {
      const prev = stage.style.backgroundImage;
      stage.style.backgroundImage = "none";
      restore = () => { stage.style.backgroundImage = prev; };
    }
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(stage, {
      width: opts.w,
      height: opts.h,
      pixelRatio: opts.pixelRatio,
      ...(opts.transparent ? {} : { backgroundColor: opts.bg }),
      cacheBust: true,
    });
    restore?.();
    return dataUrl;
  } catch (e) {
    console.error("[captureWithStyle] failed:", e);
    return null;
  }
}

function makeColorSvg(color: string, name: string, radius: number, showName: boolean): string {
  if (!showName) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
      <rect width="120" height="80" fill="${color}" rx="${radius}" ry="${radius}"/>
    </svg>`;
  }
  const escaped = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
    <rect width="120" height="80" fill="${color}" rx="${radius}" ry="${radius}"/>
    <text x="60" y="50" text-anchor="middle" font-size="14" font-weight="500" font-family="system-ui, -apple-system, sans-serif" fill="#fff">${escaped}</text>
  </svg>`;
}

function makeTextSvg(content: string, bg: string, fg: string, size: number, weight: number, radius: number): string {
  const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
    <rect width="120" height="80" fill="${bg}" rx="${radius}" ry="${radius}"/>
    <text x="60" y="50" text-anchor="middle" font-size="${size}" font-weight="${weight}" font-family="system-ui, -apple-system, sans-serif" fill="${fg}">${escaped}</text>
  </svg>`;
}

export default function ComponentPreviewPage() {
  const { componentType } = useParams<{ componentType: string }>();
  const [Renderer, setRenderer] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Plugin info from localStorage
  const [pluginName, setPluginName] = useState("");
  const [pluginDescription, setPluginDescription] = useState("");
  const [pluginIcon, setPluginIcon] = useState("");
  const [defaultSize, setDefaultSize] = useState<{ width: number; height: number } | null>(null);

  // Tab state
  const initialSrc = useMemo(() => parseIconSource(pluginIcon), [pluginIcon]);
  const [tab, setTab] = useState<TabKey>("auto");
  const [draft, setDraft] = useState<IconSource>(initialSrc);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Screenshot params
  const defaultW = defaultSize?.width ?? 800;
  const defaultH = defaultSize?.height ?? 600;
  const [previewW, setPreviewW] = useState(800);
  const [previewH, setPreviewH] = useState(600);
  const [lockAspect, setLockAspect] = useState(true);
  const [pixelRatio, setPixelRatio] = useState<1 | 2 | 3>(2);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [transparent, setTransparent] = useState(false);
  const [screenshotBg, setScreenshotBg] = useState("#0a1929");
  const [padding, setPadding] = useState(8);
  const [borderRadius, setBorderRadius] = useState(8);

  // Upload
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<{ name: string; size: number } | null>(null);
  const [uploadBg, setUploadBg] = useState("#0a1929");
  const [uploadRadius, setUploadRadius] = useState(8);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Icon
  const [iconBg, setIconBg] = useState("#0a1929");
  const [iconRadius, setIconRadius] = useState(8);
  const iconStageRef = useRef<HTMLDivElement>(null);

  // Color
  const [colorValue, setColorValue] = useState("#4fc3f7");
  const [colorRadius, setColorRadius] = useState(12);
  const [colorShowName, setColorShowName] = useState(false);

  // Text tab state
  const [textContent, setTextContent] = useState("");
  const [textBg, setTextBg] = useState("#333");
  const [textColor, setTextColor] = useState("#fff");
  const [textSize, setTextSize] = useState(36);
  const [textWeight, setTextWeight] = useState<400 | 600 | 700>(600);
  const [textRadius, setTextRadius] = useState(12);

  // Edit name/description
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Initialize
  useEffect(() => {
    if (!componentType) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        await pluginLoader.initialize();
      } catch (err) {
        logger.warn("ComponentPreviewPage", "pluginLoader.initialize() failed, continuing with partial data", { error: String(err) });
      }
      if (cancelled) return;

      // 确保设备组件已注册（设备组件是动态注册的，预览窗口中需要主动加载）
      try {
        const { ensureDevicesLoaded } = await import("../store/deviceStore");
        await ensureDevicesLoaded();
      } catch (err) {
        logger.warn("ComponentPreviewPage", "ensureDevicesLoaded() failed", { error: String(err) });
      }
      // 兜底：如果适配器为空（如预览窗口无数据源），用静态产品定义注册设备组件
      // 否则 componentRegistry 找不到设备定义 → 渲染 GenericDeviceFrame 而非正确 Frame
      if (componentType?.startsWith("device:") && !componentRegistry.get(componentType)) {
        try {
          const { generateStaticProductDefinitions } = await import("../devices/edgeConductorDefaults");
          const { registerDeviceComponents } = await import("../editor/registry");
          const staticProducts = generateStaticProductDefinitions();
          registerDeviceComponents(staticProducts);
          logger.info("ComponentPreviewPage", "Registered device components from static definitions", { count: staticProducts.length });
        } catch (err) {
          logger.warn("ComponentPreviewPage", "Failed to register static device components", { error: String(err) });
        }
      }
      if (cancelled) return;

      const definition = componentRegistry.get(componentType);
      logger.info("ComponentPreviewPage", "Component definition loaded", {
        componentType,
        hasDefinition: !!definition,
        defConfig: definition?.defaultConfig,
        defSize: definition?.defaultSize,
        defIcon: definition?.icon,
      });

      const defConfig = definition?.defaultConfig ?? {};
      const defSize = definition?.defaultSize ?? null;

      const previewConfig = loadComponentPreviewConfig();
      logger.info("ComponentPreviewPage", "Preview config from localStorage", {
        hasConfig: !!previewConfig,
        pluginType: previewConfig?.pluginType,
        matches: previewConfig?.pluginType === componentType,
        pluginName: previewConfig?.pluginName,
        pluginIcon: previewConfig?.pluginIcon,
        defaultSize: previewConfig?.defaultSize,
      });

      if (previewConfig && previewConfig.pluginType === componentType) {
        setConfig({ ...defConfig, ...previewConfig.defaultConfig });
        setPluginName(previewConfig.pluginName);
        setPluginDescription(previewConfig.pluginDescription || "");
        setPluginIcon(previewConfig.pluginIcon || "");
        setDefaultSize(previewConfig.defaultSize || defSize);
        setEditName(previewConfig.pluginName);
        setEditDescription(previewConfig.pluginDescription || "");
        if (previewConfig.defaultSize) {
          setPreviewW(previewConfig.defaultSize.width);
          setPreviewH(previewConfig.defaultSize.height);
        }
      } else {
        // 降级：从 registry definition 中获取信息
        logger.info("ComponentPreviewPage", "Falling back to registry definition", { componentType });
        setConfig(defConfig);
        setPluginName(definition?.name ?? componentType);
        setPluginDescription(definition?.description ?? "");
        setPluginIcon(definition?.icon ?? "");
        setEditName(definition?.name ?? componentType);
        setEditDescription(definition?.description ?? "");
        setDefaultSize(defSize);
        setPreviewW(defSize?.width ?? 800);
        setPreviewH(defSize?.height ?? 600);
      }

      const src = parseIconSource(previewConfig?.pluginIcon || definition?.icon);
      setDraft(src);
      setTab(src.kind === "thumbnail" ? "auto" : src.kind === "color" ? "color" : src.kind === "text" ? "text" : "icon");
      if (src.kind === "color") setColorValue(src.color);
      if (src.kind === "text") setTextContent(src.content);

      const comp = await componentRegistry.loadRenderer(componentType);
      if (cancelled) return;

      if (!comp) {
        setError("未找到组件渲染器");
        setRenderer(null);
      } else {
        setRenderer(() => comp);
      }
      setLoading(false);
    })().catch((err: Error) => {
      if (cancelled) return;
      logger.error("ComponentPreviewPage", "Failed to load renderer", { error: String(err) });
      setError(err.message || "加载渲染器失败");
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [componentType]);

  // Cleanup on close
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const currentWindow = getCurrentWindow();
      currentWindow.onCloseRequested(() => {
        clearComponentPreviewConfig();
      }).catch(() => {});
    } catch {}
  }, []);

  // Fullscreen state sync
  useEffect(() => {
    try {
      const currentWindow = getCurrentWindow();
      const unlisten = currentWindow.onResized(() => {
        currentWindow.isFullscreen().then((fs) => setIsFullscreen(fs)).catch(() => {});
      });
      return () => { unlisten.then((fn) => fn()).catch(() => {}); };
    } catch {}
  }, []);

  const handleFullscreen = async () => {
    try {
      const currentWindow = getCurrentWindow();
      const fs = await currentWindow.isFullscreen();
      await currentWindow.setFullscreen(!fs);
      setIsFullscreen(!fs);
    } catch {}
  };

  const handleClose = async () => {
    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.close();
    } catch {}
  };

  const setPreviewSize = (w: number, h: number) => {
    setPreviewW(w);
    setPreviewH(h);
  };

  const handleReset = () => {
    const definition = componentRegistry.get(componentType!);
    const def = parseIconSource(definition?.icon);
    setDraft(def);
    setTab(def.kind === "thumbnail" ? "auto" : def.kind === "color" ? "color" : def.kind === "text" ? "text" : "icon");
    if (def.kind === "color") setColorValue(def.color);
    if (def.kind === "text") { setTextContent(def.content); }
    setUploadPreview(null);
    setUploadMeta(null);
    setEditName(pluginName);
    setEditDescription(pluginDescription);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("请选择图片文件 (PNG / JPG / SVG)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadPreview(dataUrl);
      setUploadMeta({ name: file.name, size: file.size });
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      let finalSource: IconSource = draft;

      if (tab === "auto") {
        if (!stageRef.current) {
          setErrorMsg("预览区未就绪");
          setSaving(false);
          return;
        }
        const dataUrl = await captureWithStyle(stageRef.current, {
          bg: screenshotBg, padding, borderRadius,
          w: previewW, h: previewH, pixelRatio, transparent,
        });
        if (!dataUrl) { setErrorMsg("截图失败"); setSaving(false); return; }
        await writeThumbnail(componentType!, dataUrl);
        const ts = Date.now();
        setSavedAt(ts);
        finalSource = { kind: "thumbnail" };
      } else if (tab === "upload") {
        if (!uploadPreview) { setErrorMsg("请先选择图片"); setSaving(false); return; }
        // 合成背景色+图片后写入缩略图
        const composited = await compositeWithBg(uploadPreview, uploadBg, uploadRadius);
        await writeThumbnail(componentType!, composited);
        const ts = Date.now();
        setSavedAt(ts);
        finalSource = { kind: "thumbnail" };
      } else if (tab === "text") {
        if (!textContent.trim()) { setErrorMsg("请输入文字或 emoji"); setSaving(false); return; }
        const svg = makeTextSvg(textContent, textBg, textColor, textSize, textWeight, textRadius);
        const dataUrl = `data:image/svg+xml;base64,${btoa(decodeURIComponent(encodeURIComponent(svg)))}`;
        await writeThumbnail(componentType!, dataUrl);
        const ts = Date.now();
        setSavedAt(ts);
        finalSource = { kind: "text", content: textContent };
      } else if (tab === "color") {
        const svg = makeColorSvg(colorValue, pluginName, colorRadius, colorShowName);
        const dataUrl = `data:image/svg+xml;base64,${btoa(decodeURIComponent(encodeURIComponent(svg)))}`;
        await writeThumbnail(componentType!, dataUrl);
        const ts = Date.now();
        setSavedAt(ts);
        finalSource = { kind: "color", color: colorValue };
      } else if (tab === "icon") {
        // 截取带背景色的图标预览，写入缩略图
        if (!iconStageRef.current) {
          setErrorMsg("图标预览区未就绪");
          setSaving(false);
          return;
        }
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(iconStageRef.current, {
          width: 120,
          height: 80,
          pixelRatio: 2,
          backgroundColor: iconBg,
          cacheBust: true,
        });
        if (!dataUrl) { setErrorMsg("图标截图失败"); setSaving(false); return; }
        await writeThumbnail(componentType!, dataUrl);
        const ts = Date.now();
        setSavedAt(ts);
        finalSource = { kind: "thumbnail" };
      }

      const serialized = serializeIconSource(finalSource);
      const trimmedName = editName.trim() || pluginName;
      const trimmedDesc = editDescription.trim() || null;

      // 不再直接写 DB，统一由主窗口 store 的 syncIconFromPreviewWindow 处理持久化
      // 通知主窗口刷新组件图标、名称和描述
      try {
        const { emit } = await import("@tauri-apps/api/event");
        await emit("component-icon-updated", {
          pluginType: componentType,
          icon: serialized,
          name: trimmedName,
          description: trimmedDesc,
        });
      } catch {}
    } catch (e) {
      console.error("[ComponentPreviewPage] apply failed:", e);
      setErrorMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  const renderLivePreview = () => {
    if (tab === "text") {
      return (
        <Box sx={{
          width: 240, height: 160,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: textBg, borderRadius: `${textRadius}px`,
          color: textColor, fontSize: textSize, fontWeight: textWeight,
          letterSpacing: 1, overflow: "hidden",
        }}>
          {textContent || "示例"}
        </Box>
      );
    }
    if (tab === "color") {
      return (
        <Box sx={{
          width: 240, height: 160,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: colorValue, borderRadius: `${colorRadius}px`,
          color: "#fff", fontSize: 12, opacity: 0.95,
        }}>
          {colorShowName ? pluginName : ""}
        </Box>
      );
    }
    if (tab === "upload") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <Box sx={{
            width: 240, height: 160,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: uploadBg, borderRadius: `${uploadRadius}px`,
            overflow: "hidden",
          }}>
            {uploadPreview
              ? <img src={uploadPreview} alt="upload" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              : <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 11 }}>未选择文件</Typography>
            }
          </Box>
          {uploadMeta && (
            <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>
              {uploadMeta.name} · {(uploadMeta.size / 1024).toFixed(1)} KB
            </Typography>
          )}
        </Box>
      );
    }
    if (tab === "icon") {
      const matName = draft.kind === "material" ? draft.name : "widgets";
      return (
        <Box
          ref={iconStageRef}
          sx={{
            width: 120, height: 80,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: iconBg, borderRadius: `${iconRadius}px`,
            overflow: "hidden",
          }}
        >
          {resolveIcon(matName, "widgets", 40)}
        </Box>
      );
    }
    if (loading) return <Typography variant="caption" sx={{ color: "text.secondary" }}>加载渲染器...</Typography>;
    if (!Renderer) return <Typography variant="caption" sx={{ color: "text.disabled" }}>无法加载渲染器</Typography>;
    const innerSx = {
      width: "100%", height: "100%",
      bgcolor: transparent ? "transparent" : screenshotBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      "& > *": fitMode === "cover"
        ? { width: "100%", height: "100%", display: "block" }
        : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" as const },
    };
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <Box
          ref={stageRef}
          data-thumbnail-stage
          sx={{
            width: previewW, height: previewH,
            p: `${padding}px`,
            bgcolor: transparent ? "transparent" : screenshotBg,
            borderRadius: `${borderRadius}px`,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            boxShadow: transparent ? "0 0 0 1px rgba(0,0,0,0.2)" : "0 0 0 1px rgba(0,0,0,0.08)",
          }}
        >
          <Box sx={innerSx}>
            <Renderer config={{ ...config, _thumbnail: true }} componentId={`preview_${componentType}`} mode="preview" width={previewW} height={previewH} />
          </Box>
        </Box>
        <Typography variant="caption" sx={{ fontSize: 10, color: "text.disabled" }}>
          {previewW}×{previewH} · {fitMode} · 内边距 {padding} · 圆角 {borderRadius} · {transparent ? "透明" : screenshotBg.toUpperCase()} · {pixelRatio}x
        </Typography>
      </Box>
    );
  };

  if (error) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", bgcolor: "background.default", color: "text.secondary", gap: 1 }}>
        <Typography variant="h5" sx={{ opacity: 0.6 }}>加载失败</Typography>
        <Typography variant="body2" sx={{ opacity: 0.4 }}>{error}</Typography>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={createTheme({ palette: { mode: "dark" } })}>
      <CssBaseline />
      <Box sx={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", bgcolor: "background.default" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0, bgcolor: "background.paper" }}>
          {resolveIcon(pluginIcon, "widgets", 16)}
          <Typography variant="subtitle2" sx={{ fontSize: 13, fontWeight: 600 }}>设置图标 / 元数据</Typography>
          <Typography variant="caption" sx={{ fontSize: 10, color: "text.disabled" }}>· {componentType}</Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={isFullscreen ? "退出全屏" : "全屏"}>
            <IconButton size="small" onClick={handleFullscreen}>
              {isFullscreen ? <FullscreenExitRoundedIcon sx={{ fontSize: 16 }} /> : <FullscreenRoundedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="恢复为默认">
            <IconButton size="small" onClick={handleReset}><RestartAltIcon sx={{ fontSize: 16 }} /></IconButton>
          </Tooltip>
          <Tooltip title="关闭">
            <IconButton size="small" onClick={handleClose}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
          </Tooltip>
        </Box>

        {/* Name & Description */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", px: 2, py: 0.75, borderBottom: 1, borderColor: "divider", flexShrink: 0, bgcolor: "background.paper" }}>
          <TextField
            size="small"
            label="名称"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 30, style: { fontSize: 11 } } }}
            sx={{ flex: "1 1 140px", "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }}
          />
          <TextField
            size="small"
            label="描述"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 80, style: { fontSize: 11 } } }}
            sx={{ flex: "2 1 200px", "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }}
          />
        </Box>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v: TabKey) => { setTab(v); setErrorMsg(null); }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", minHeight: 36, flexShrink: 0, bgcolor: "background.paper", "& .MuiTab-root": { minHeight: 36, fontSize: 11, textTransform: "none", py: 0.5 } }}
        >
          <Tab value="auto" icon={<PhotoCameraIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="自动截图" />
          <Tab value="icon" icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="选择图标" />
          <Tab value="upload" icon={<UploadFileIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="上传图片" />
          <Tab value="text" icon={<TextFieldsIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="文字" />
          <Tab value="color" icon={<ColorLensIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="纯色块" />
        </Tabs>

        {/* Main content: left panel + right preview */}
        <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left: settings panel */}
          <Box sx={{ width: 280, flexShrink: 0, borderRight: 1, borderColor: "divider", p: 1.5, bgcolor: "background.default", overflow: "auto" }}>
            {tab === "auto" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>渲染尺寸</Typography>
                  <Tooltip title={lockAspect ? "已锁定横竖比" : "未锁定"}>
                    <IconButton size="small" onClick={() => setLockAspect(!lockAspect)} sx={{ p: 0.25 }}>
                      {lockAspect ? <LinkIcon sx={{ fontSize: 14, color: "primary.main" }} /> : <LinkOffIcon sx={{ fontSize: 14, color: "text.disabled" }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 32, color: "text.secondary" }}>宽 W</Typography>
                  <TextField type="number" size="small" value={previewW}
                    onChange={(e) => { const raw = e.target.value; if (raw === "") return; const v = parseInt(raw, 10); if (!isNaN(v) && v >= 50 && v <= 2000) setPreviewSize(v, previewH); }}
                    onBlur={() => { if (previewW < 50) setPreviewW(50); if (previewW > 2000) setPreviewW(2000); }}
                    slotProps={{ htmlInput: { min: 50, max: 2000, step: 10, style: { fontSize: 12, textAlign: "center", fontVariantNumeric: "tabular-nums", padding: "6px 0" } } }}
                    sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 0.5 }, "& input": { textAlign: "center" } }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 32, color: "text.secondary" }}>高 H</Typography>
                  <TextField type="number" size="small" value={previewH}
                    onChange={(e) => { const raw = e.target.value; if (raw === "") return; const v = parseInt(raw, 10); if (!isNaN(v) && v >= 50 && v <= 2000) setPreviewSize(previewW, v); }}
                    onBlur={() => { if (previewH < 50) setPreviewH(50); if (previewH > 2000) setPreviewH(2000); }}
                    slotProps={{ htmlInput: { min: 50, max: 2000, step: 10, style: { fontSize: 12, textAlign: "center", fontVariantNumeric: "tabular-nums", padding: "6px 0" } } }}
                    sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 0.5 }, "& input": { textAlign: "center" } }} />
                </Box>
                <Button size="small" onClick={() => { setLockAspect(false); setPreviewW(defaultW); setPreviewH(defaultH); }} sx={{ fontSize: 9, textTransform: "none", alignSelf: "flex-start", minWidth: "auto" }}>↺ 恢复默认（{defaultW}×{defaultH}）</Button>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {PRESETS.map((p) => (
                    <Button key={p.label} size="small" variant={previewW === p.w && previewH === p.h ? "contained" : "text"} onClick={() => { setLockAspect(false); setPreviewW(p.w); setPreviewH(p.h); }} sx={{ fontSize: 9, textTransform: "none", minWidth: "auto", px: 0.75, py: 0 }}>{p.label}</Button>
                  ))}
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled", mr: 0.5 }}>比例</Typography>
                  {ASPECT_PRESETS.map((a) => {
                    const active = Math.abs(previewW / previewH - a.w / a.h) < 0.02;
                    return (
                      <Button key={a.label} size="small" variant={active ? "contained" : "outlined"} onClick={() => {
                        const newH = Math.max(50, Math.min(2000, Math.round(previewW * a.h / a.w)));
                        setLockAspect(true);
                        setPreviewH(newH);
                      }} sx={{ fontSize: 9, textTransform: "none", minWidth: "auto", px: 0.75, py: 0 }}>{a.label}</Button>
                    );
                  })}
                </Box>
                <Divider />
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>截图样式</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>背景色</Typography>
                  <TextField type="color" size="small" value={screenshotBg} onChange={(e) => { setScreenshotBg(e.target.value); setTransparent(false); }} disabled={transparent} sx={{ width: 60, "& input": { p: 0.5, height: 24 } }} />
                  <TextField size="small" value={screenshotBg} onChange={(e) => { setScreenshotBg(e.target.value); setTransparent(false); }} disabled={transparent} slotProps={{ htmlInput: { style: { fontSize: 10, padding: "4px 6px" } } }} sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 0.5 }}>
                  {BG_PRESETS.map((c) => (
                    <Box key={c} onClick={() => { setScreenshotBg(c); setTransparent(false); }} sx={{ width: "100%", height: 20, borderRadius: 0.5, bgcolor: c, cursor: "pointer", border: !transparent && screenshotBg.toLowerCase() === c.toLowerCase() ? "2px solid" : "1px solid", borderColor: !transparent && screenshotBg.toLowerCase() === c.toLowerCase() ? "primary.main" : "divider" }} />
                  ))}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <input type="checkbox" id="transBg" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} style={{ width: 13, height: 13 }} />
                  <label htmlFor="transBg">
                    <Typography variant="caption" sx={{ fontSize: 10, cursor: "pointer" }}>透明背景（PNG）</Typography>
                  </label>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>内边距</Typography>
                  <TextField type="number" size="small" value={padding}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 50) setPadding(v); }}
                    slotProps={{ htmlInput: { min: 0, max: 50, style: { fontSize: 11, padding: "4px 6px" } } }}
                    sx={{ width: 70, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>圆角</Typography>
                  <TextField type="number" size="small" value={borderRadius}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 40) setBorderRadius(v); }}
                    slotProps={{ htmlInput: { min: 0, max: 40, style: { fontSize: 11, padding: "4px 6px" } } }}
                    sx={{ width: 70, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                </Box>
                <Divider />
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>输出选项</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>像素比</Typography>
                  {[1, 2, 3].map((p) => (
                    <Button key={p} size="small" variant={pixelRatio === p ? "contained" : "outlined"}
                      onClick={() => setPixelRatio(p as 1 | 2 | 3)}
                      sx={{ minWidth: "auto", px: 0.75, py: 0, fontSize: 10, textTransform: "none" }}>
                      {p}x
                    </Button>
                  ))}
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled" }}>· 输出 {previewW * pixelRatio}×{previewH * pixelRatio}</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>填充</Typography>
                  {(["contain", "cover"] as const).map((m) => (
                    <Button key={m} size="small" variant={fitMode === m ? "contained" : "outlined"}
                      onClick={() => setFitMode(m)}
                      sx={{ minWidth: "auto", px: 0.75, py: 0, fontSize: 10, textTransform: "none" }}>
                      {m === "contain" ? "Contain 完整" : "Cover 铺满"}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}

            {tab === "icon" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>选择 MUI 图标</Typography>
                <IconPicker
                  value={draft.kind === "material" ? draft.name : "widgets"}
                  onChange={(name) => setDraft({ kind: "material", name })}
                />
                <Divider />
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>背景色</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <TextField type="color" size="small" value={iconBg} onChange={(e) => setIconBg(e.target.value)} sx={{ width: 60, "& input": { p: 0.5, height: 24 } }} />
                  <TextField size="small" value={iconBg} onChange={(e) => setIconBg(e.target.value)} slotProps={{ htmlInput: { style: { fontSize: 10, padding: "4px 6px" } } }} sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.5 }}>
                  {COLOR_PRESETS.map((c) => (
                    <Box key={c} onClick={() => setIconBg(c)} sx={{ width: "100%", height: 20, borderRadius: 0.5, bgcolor: c, cursor: "pointer", border: iconBg.toLowerCase() === c.toLowerCase() ? "2px solid" : "1px solid", borderColor: iconBg.toLowerCase() === c.toLowerCase() ? "primary.main" : "divider" }} />
                  ))}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>圆角</Typography>
                  <TextField type="number" size="small" value={iconRadius}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 40) setIconRadius(v); }}
                    slotProps={{ htmlInput: { min: 0, max: 40, style: { fontSize: 11, padding: "4px 6px" } } }}
                    sx={{ width: 60, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled" }}>px</Typography>
                </Box>
              </Box>
            )}

            {tab === "upload" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>上传图片</Typography>
                <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>支持 PNG / JPG / SVG，文件会覆盖缩略图。</Typography>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />
                <Button size="small" variant="outlined" startIcon={<UploadFileIcon sx={{ fontSize: 14 }} />} onClick={() => fileInputRef.current?.click()} sx={{ fontSize: 11, textTransform: "none" }}>
                  选择文件
                </Button>
                {uploadPreview && (
                  <Button size="small" color="error" onClick={() => setUploadPreview(null)} sx={{ fontSize: 10, textTransform: "none" }}>清除已选</Button>
                )}
                <Divider />
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>背景色</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <TextField type="color" size="small" value={uploadBg} onChange={(e) => setUploadBg(e.target.value)} sx={{ width: 60, "& input": { p: 0.5, height: 24 } }} />
                  <TextField size="small" value={uploadBg} onChange={(e) => setUploadBg(e.target.value)} slotProps={{ htmlInput: { style: { fontSize: 10, padding: "4px 6px" } } }} sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.5 }}>
                  {COLOR_PRESETS.map((c) => (
                    <Box key={c} onClick={() => setUploadBg(c)} sx={{ width: "100%", height: 20, borderRadius: 0.5, bgcolor: c, cursor: "pointer", border: uploadBg.toLowerCase() === c.toLowerCase() ? "2px solid" : "1px solid", borderColor: uploadBg.toLowerCase() === c.toLowerCase() ? "primary.main" : "divider" }} />
                  ))}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>圆角</Typography>
                  <TextField type="number" size="small" value={uploadRadius}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 40) setUploadRadius(v); }}
                    slotProps={{ htmlInput: { min: 0, max: 40, style: { fontSize: 11, padding: "4px 6px" } } }}
                    sx={{ width: 60, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled" }}>px</Typography>
                </Box>
              </Box>
            )}

            {tab === "text" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>文字 / Emoji</Typography>
                <TextField size="small" placeholder="输入文字或 emoji" value={textContent} onChange={(e) => { setTextContent(e.target.value); setDraft({ kind: "text", content: e.target.value }); }} slotProps={{ htmlInput: { maxLength: 4, style: { fontSize: 14, textAlign: "center" } } }} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {EMOJI_SAMPLES.map((e) => (
                    <Button key={e} size="small" variant={textContent === e ? "contained" : "outlined"} onClick={() => { setTextContent(e); setDraft({ kind: "text", content: e }); }} sx={{ minWidth: "auto", px: 0.75, py: 0, fontSize: 16 }}>{e}</Button>
                  ))}
                </Box>
                <Divider />
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>背景</Typography>
                  <TextField type="color" size="small" value={textBg} onChange={(e) => setTextBg(e.target.value)} sx={{ width: 50, "& input": { p: 0.5, height: 22 } }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>文字</Typography>
                  <TextField type="color" size="small" value={textColor} onChange={(e) => setTextColor(e.target.value)} sx={{ width: 50, "& input": { p: 0.5, height: 22 } }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>字号</Typography>
                  <TextField type="number" size="small" value={textSize}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 12 && v <= 96) setTextSize(v); }}
                    slotProps={{ htmlInput: { min: 12, max: 96, style: { fontSize: 11, padding: "4px 6px" } } }}
                    sx={{ width: 60, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled" }}>px</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>字重</Typography>
                  {[400, 600, 700].map((w) => (
                    <Button key={w} size="small" variant={textWeight === w ? "contained" : "outlined"}
                      onClick={() => setTextWeight(w as 400 | 600 | 700)}
                      sx={{ minWidth: "auto", px: 0.75, py: 0, fontSize: 10 }}>{w}</Button>
                  ))}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>圆角</Typography>
                  <TextField type="number" size="small" value={textRadius}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 40) setTextRadius(v); }}
                    slotProps={{ htmlInput: { min: 0, max: 40, style: { fontSize: 11, padding: "4px 6px" } } }}
                    sx={{ width: 60, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled" }}>px</Typography>
                </Box>
              </Box>
            )}

            {tab === "color" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>纯色块</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.5 }}>
                  {COLOR_PRESETS.map((c) => (
                    <Box key={c} onClick={() => { setColorValue(c); setDraft({ kind: "color", color: c }); }} sx={{ width: 28, height: 28, borderRadius: 0.75, bgcolor: c, cursor: "pointer", border: colorValue === c ? "2px solid" : "1px solid", borderColor: colorValue === c ? "primary.main" : "divider" }} />
                  ))}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>自定义</Typography>
                  <TextField type="color" size="small" value={colorValue} onChange={(e) => { setColorValue(e.target.value); setDraft({ kind: "color", color: e.target.value }); }} sx={{ width: 50, "& input": { p: 0.5, height: 22 } }} />
                  <TextField size="small" value={colorValue} onChange={(e) => { setColorValue(e.target.value); setDraft({ kind: "color", color: e.target.value }); }} slotProps={{ htmlInput: { style: { fontSize: 10, padding: "4px 6px" } } }} sx={{ flex: 1, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: 10, width: 50 }}>圆角</Typography>
                  <TextField type="number" size="small" value={colorRadius}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 40) setColorRadius(v); }}
                    slotProps={{ htmlInput: { min: 0, max: 40, style: { fontSize: 11, padding: "4px 6px" } } }}
                    sx={{ width: 60, "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }} />
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled" }}>px</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <input type="checkbox" id="showName" checked={colorShowName} onChange={(e) => setColorShowName(e.target.checked)} style={{ width: 13, height: 13 }} />
                  <label htmlFor="showName">
                    <Typography variant="caption" sx={{ fontSize: 10, cursor: "pointer" }}>在色块上叠加显示组件名称</Typography>
                  </label>
                </Box>
              </Box>
            )}
          </Box>

          {/* Right: live preview */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", bgcolor: "background.paper", minHeight: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 0.75, borderBottom: 1, borderColor: "divider", bgcolor: "background.default", flexShrink: 0 }}>
              <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary" }}>实时预览（应用后保存为图标）</Typography>
              {(savedAt || errorMsg) && (
                <Typography variant="caption" sx={{ color: errorMsg ? "error.main" : "success.main", fontSize: 10 }}>
                  {errorMsg ? `⚠ ${errorMsg}` : "✓ 图标已更新"}
                </Typography>
              )}
            </Box>
            <Box sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
              ...(tab === "auto" && transparent ? {
                backgroundImage: "repeating-conic-gradient(#80808080 0% 25%, transparent 0% 50%)",
                backgroundSize: "16px 16px",
              } : {}),
              minHeight: 0,
              overflow: "auto",
            }}>
              {renderLivePreview()}
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1, px: 2, py: 1, borderTop: 1, borderColor: "divider", flexShrink: 0, bgcolor: "background.default" }}>
          <Button size="small" onClick={handleClose} sx={{ fontSize: 11, textTransform: "none" }}>取消</Button>
          <Button size="small" variant="contained" startIcon={<SaveIcon sx={{ fontSize: 14 }} />} onClick={handleApply} disabled={saving} sx={{ fontSize: 11, textTransform: "none" }}>
            {saving ? "保存中..." : "应用"}
          </Button>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
