import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import Slider from "@mui/material/Slider";
import Collapse from "@mui/material/Collapse";
import Button from "@mui/material/Button";
import { useCallback, useState } from "react";
import { useEditorStore, type AdaptationType } from "../../store/editorStore";
import type { GradientDirection, ImageFit } from "../../types/editor";
import { AssetPicker, type AssetPickerMode } from "../components/AssetPicker";
import { convertFileSrc } from "@tauri-apps/api/core";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import Rotate90DegreesCwIcon from "@mui/icons-material/Rotate90DegreesCw";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import GridOnIcon from "@mui/icons-material/GridOn";
import GridOffIcon from "@mui/icons-material/GridOff";
import StraightenIcon from "@mui/icons-material/Straighten";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import VideoIcon from "@mui/icons-material/Videocam";
import CloseIcon from "@mui/icons-material/Close";

const PRESET_SIZES = [
  { label: "1920×1080 (Full HD)", width: 1920, height: 1080 },
  { label: "2560×1440 (2K)", width: 2560, height: 1440 },
  { label: "3840×2160 (4K)", width: 3840, height: 2160 },
  { label: "1280×720 (HD)", width: 1280, height: 720 },
  { label: "1080×1920 (竖屏)", width: 1080, height: 1920 },
  { label: "800×600", width: 800, height: 600 },
  { label: "自定义", width: 0, height: 0 },
];

const ADAPTATION_OPTIONS: { label: string; value: AdaptationType; desc: string }[] = [
  { label: "自适应缩放", value: "scale", desc: "等比缩放，保持宽高比" },
  { label: "撑满宽度", value: "full-x", desc: "宽度撑满，高度自适应" },
  { label: "撑满高度", value: "full-y", desc: "高度撑满，宽度自适应" },
  { label: "撑满全屏", value: "full-screen", desc: "完全撑满，可能变形" },
  { label: "无自适应", value: "none", desc: "保持原始尺寸" },
];

const GRID_SIZE_OPTIONS = [10, 20, 50, 100];

const GRADIENT_DIRECTION_OPTIONS: { label: string; value: GradientDirection }[] = [
  { label: "→ 向右", value: "to-right" },
  { label: "↓ 向下", value: "to-bottom" },
  { label: "↘ 右下", value: "to-bottom-right" },
  { label: "↙ 左下", value: "to-bottom-left" },
  { label: "◎ 径向", value: "radial" },
];

const SOLID_PRESETS = [
  "#ffffff", "#f5f5f5", "#e0e0e0", "#bdbdbd", "#9e9e9e",
  "#1a1a2e", "#16213e", "#0f3460", "#0a0a0a", "#1b1b2f",
  "#e53935", "#d81b60", "#8e24aa", "#5e35b1", "#3949ab",
  "#1e88e5", "#039be5", "#00acc1", "#00897b", "#43a047",
  "#7cb342", "#c0ca33", "#fdd835", "#ffb300", "#fb8c00",
  "#f4511e", "#6d4c41", "#757575", "#546e7a", "#000000",
];

const GRADIENT_PRESETS: { name: string; direction: GradientDirection; colors: [string, string] }[] = [
  { name: "暖阳", direction: "to-bottom", colors: ["#f12711", "#f5af19"] },
  { name: "海洋", direction: "to-right", colors: ["#2193b0", "#6dd5ed"] },
  { name: "紫霞", direction: "to-bottom-right", colors: ["#8e2de2", "#4a00e0"] },
  { name: "翠绿", direction: "to-bottom", colors: ["#11998e", "#38ef7d"] },
  { name: "暮光", direction: "to-bottom", colors: ["#0f0c29", "#302b63"] },
  { name: "火焰", direction: "to-right", colors: ["#ff0844", "#ffb199"] },
  { name: "极光", direction: "to-bottom-left", colors: ["#43cea2", "#185a9d"] },
  { name: "星空", direction: "to-bottom", colors: ["#0f2027", "#2c5364"] },
  { name: "晨曦", direction: "to-right", colors: ["#ffecd2", "#fcb69f"] },
  { name: "深蓝", direction: "to-bottom", colors: ["#000428", "#004e92"] },
  { name: "樱花", direction: "to-right", colors: ["#ee9ca7", "#ffdde1"] },
  { name: "暗夜", direction: "radial", colors: ["#1a1a2e", "#16213e"] },
];

function SectionHeader({
  title,
  icon,
  expanded,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Box
      onClick={onToggle}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        cursor: "pointer",
        userSelect: "none",
        py: 0.5,
        "&:hover": { opacity: 0.8 },
      }}
    >
      <Box sx={{ color: "primary.main", display: "flex", alignItems: "center", fontSize: 16 }}>
        {icon}
      </Box>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: "text.primary", fontSize: 11, flex: 1, letterSpacing: 0.5 }}
      >
        {title}
      </Typography>
      <Box sx={{ color: "text.disabled", display: "flex", alignItems: "center" }}>
        {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
      </Box>
    </Box>
  );
}

function SettingRow({
  label,
  children,
  labelWidth = 64,
}: {
  label: string;
  children: React.ReactNode;
  labelWidth?: number;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minHeight: 30 }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", width: labelWidth, flexShrink: 0, fontSize: 11, lineHeight: "30px" }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export function EditorCanvasPanel() {
  const canvasConfig = useEditorStore((s) => s.canvasConfig);
  const setCanvasConfig = useEditorStore((s) => s.setCanvasConfig);
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize);
  const viewport = useEditorStore((s) => s.viewport);
  const resetViewport = useEditorStore((s) => s.resetViewport);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const components = useEditorStore((s) => s.components);
  const layers = useEditorStore((s) => s.layers);

  const activeBackground = canvasConfig.background;
  const setActiveBackground = useCallback((updates: Partial<typeof canvasConfig.background>) => {
    setCanvasConfig({
      background: { ...canvasConfig.background, ...updates },
    });
  }, [canvasConfig.background, setCanvasConfig]);

  const [sizeExpanded, setSizeExpanded] = useState(true);
  const [bgExpanded, setBgExpanded] = useState(true);
  const [gridExpanded, setGridExpanded] = useState(false);
  const [viewportExpanded, setViewportExpanded] = useState(false);

  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetPickerMode, setAssetPickerMode] = useState<AssetPickerMode>("image");

  const aspectRatio = canvasConfig.width / canvasConfig.height;

  const handlePresetChange = useCallback(
    (event: { target: { value: string } }) => {
      const preset = PRESET_SIZES.find((p) => p.label === event.target.value);
      if (preset && preset.width > 0) {
        setCanvasSize(preset.width, preset.height);
      }
    },
    [setCanvasSize]
  );

  const handleWidthChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const width = parseInt(event.target.value, 10);
      if (!isNaN(width) && width > 0) {
        if (canvasConfig.lockAspectRatio) {
          const height = Math.round(width / aspectRatio);
          setCanvasSize(width, height);
        } else {
          setCanvasSize(width, canvasConfig.height);
        }
      }
    },
    [canvasConfig.height, canvasConfig.lockAspectRatio, aspectRatio, setCanvasSize]
  );

  const handleHeightChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const height = parseInt(event.target.value, 10);
      if (!isNaN(height) && height > 0) {
        if (canvasConfig.lockAspectRatio) {
          const width = Math.round(height * aspectRatio);
          setCanvasSize(width, height);
        } else {
          setCanvasSize(canvasConfig.width, height);
        }
      }
    },
    [canvasConfig.width, canvasConfig.lockAspectRatio, aspectRatio, setCanvasSize]
  );

  const handleToggleOrientation = useCallback(() => {
    const newOrientation: "landscape" | "portrait" =
      canvasConfig.orientation === "landscape" ? "portrait" : "landscape";
    setCanvasConfig({
      orientation: newOrientation,
      width: canvasConfig.height,
      height: canvasConfig.width,
    });
  }, [canvasConfig, setCanvasConfig]);

  const handleToggleLockRatio = useCallback(() => {
    setCanvasConfig({ lockAspectRatio: !canvasConfig.lockAspectRatio });
  }, [canvasConfig.lockAspectRatio, setCanvasConfig]);

  const currentPreset = PRESET_SIZES.find(
    (p) => p.width === canvasConfig.width && p.height === canvasConfig.height
  );

  const layerCount = layers.filter((l) => l.type === "layer").length;
  const groupCount = layers.filter((l) => l.type === "group").length;

  const getBackgroundStyle = useCallback(() => {
    const bg = activeBackground;
    if (bg.type === "solid") return { backgroundColor: bg.color };
    if (bg.type === "gradient") {
      const dir = bg.gradient.direction;
      if (dir === "radial") return { background: `radial-gradient(circle, ${bg.gradient.colors[0]}, ${bg.gradient.colors[1]})` };
      const cssDir = dir.replace(/-/g, " ");
      return { background: `linear-gradient(${cssDir}, ${bg.gradient.colors[0]}, ${bg.gradient.colors[1]})` };
    }
    if (bg.type === "image" && bg.imageUrl) {
      try {
        const url = bg.imageUrl.startsWith("data:") || bg.imageUrl.startsWith("http://") || bg.imageUrl.startsWith("https://")
          ? bg.imageUrl
          : convertFileSrc(bg.imageUrl);
        return { backgroundImage: `url(${url})`, backgroundSize: bg.imageFit || "cover", backgroundPosition: "center" };
      } catch {
        return { backgroundColor: "#ffffff" };
      }
    }
    if (bg.type === "video" && bg.videoUrl) {
      return { backgroundColor: "#1a1a2e" };
    }
    return { backgroundColor: "#ffffff" };
  }, [activeBackground]);

  const openAssetPicker = useCallback((mode: AssetPickerMode) => {
    setAssetPickerMode(mode);
    setAssetPickerOpen(true);
  }, []);

  const handleAssetSelect = useCallback((path: string) => {
    if (assetPickerMode === "image") {
      setActiveBackground({ imageUrl: path });
    } else {
      setActiveBackground({ videoUrl: path });
    }
  }, [assetPickerMode, setActiveBackground]);

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: "text.secondary", fontSize: 11 }}
        >
          画布设置
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          px: 1.5,
          py: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { borderRadius: 2, backgroundColor: "action.disabled" },
        }}
      >
        {/* ===== 尺寸设置 ===== */}
        <Box>
          <SectionHeader
            title="尺寸设置"
            icon={<StraightenIcon sx={{ fontSize: 14 }} />}
            expanded={sizeExpanded}
            onToggle={() => setSizeExpanded(!sizeExpanded)}
          />
          <Collapse in={sizeExpanded} unmountOnExit>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pl: 0.5, pt: 0.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: 12 }}>预设尺寸</InputLabel>
                <Select
                  value={currentPreset?.label || "自定义"}
                  label="预设尺寸"
                  onChange={handlePresetChange as any}
                  sx={{ fontSize: 12 }}
                >
                  {PRESET_SIZES.map((preset) => (
                    <MenuItem key={preset.label} value={preset.label} sx={{ fontSize: 12 }}>
                      {preset.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <SettingRow label="宽度">
                <TextField
                  type="number"
                  size="small"
                  value={canvasConfig.width}
                  onChange={handleWidthChange}
                  sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 } }}
                  slotProps={{ htmlInput: { min: 100 } }}
                />
              </SettingRow>
              <SettingRow label="高度">
                <TextField
                  type="number"
                  size="small"
                  value={canvasConfig.height}
                  onChange={handleHeightChange}
                  sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 } }}
                  slotProps={{ htmlInput: { min: 100 } }}
                />
              </SettingRow>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 0.5 }}>
                <Tooltip title={canvasConfig.lockAspectRatio ? "解锁宽高比" : "锁定宽高比"}>
                  <IconButton size="small" onClick={handleToggleLockRatio}>
                    {canvasConfig.lockAspectRatio ? (
                      <LockIcon sx={{ fontSize: 14, color: "primary.main" }} />
                    ) : (
                      <LockOpenIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title="切换横版/竖版">
                  <IconButton size="small" onClick={handleToggleOrientation}>
                    <Rotate90DegreesCwIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10 }}>
                  {canvasConfig.orientation === "landscape" ? "横版" : "竖版"} · {aspectRatio.toFixed(2)}
                </Typography>
                {canvasConfig.lockAspectRatio && (
                  <Typography variant="caption" sx={{ color: "primary.main", fontSize: 9 }}>
                    🔒
                  </Typography>
                )}
              </Box>

              <SettingRow label="屏幕适配">
                <Select
                  size="small"
                  value={canvasConfig.adaptationType}
                  onChange={(e) => setCanvasConfig({ adaptationType: e.target.value as AdaptationType })}
                  sx={{ fontSize: 11, flex: 1 }}
                >
                  {ADAPTATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 11 }}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </SettingRow>
            </Box>
          </Collapse>
          <Divider sx={{ mt: 1 }} />
        </Box>

        {/* ===== 背景设置 ===== */}
        <Box>
          <SectionHeader
            title="背景设置"
            icon={<TuneIcon sx={{ fontSize: 14 }} />}
            expanded={bgExpanded}
            onToggle={() => setBgExpanded(!bgExpanded)}
          />
          <Collapse in={bgExpanded} unmountOnExit>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pl: 0.5 }}>
            <SettingRow label="背景类型">
              <Select
                size="small"
                value={activeBackground.type}
                onChange={(e) =>
                  setActiveBackground({ type: e.target.value as any })
                }
                sx={{ fontSize: 11, flex: 1 }}
              >
                <MenuItem value="solid" sx={{ fontSize: 11 }}>纯色</MenuItem>
                <MenuItem value="gradient" sx={{ fontSize: 11 }}>渐变</MenuItem>
                <MenuItem value="image" sx={{ fontSize: 11 }}>图片</MenuItem>
                <MenuItem value="video" sx={{ fontSize: 11 }}>视频</MenuItem>
              </Select>
            </SettingRow>

            {/* ===== 纯色背景 ===== */}
            {activeBackground.type === "solid" && (
              <>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, py: 0.5 }}>
                  {SOLID_PRESETS.map((color) => (
                    <Tooltip key={color} title={color}>
                      <Box
                        onClick={() =>
                          setActiveBackground({ color })
                        }
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: 0.5,
                          backgroundColor: color,
                          cursor: "pointer",
                          border: activeBackground.color === color ? 2 : 1,
                          borderColor: activeBackground.color === color ? "primary.main" : "divider",
                          transition: "all 0.1s",
                          "&:hover": {
                            transform: "scale(1.15)",
                            borderColor: "primary.main",
                          },
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
                <SettingRow label="自定义色">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 0 }}>
                    <input
                      type="color"
                      value={activeBackground.color}
                      onChange={(e) =>
                        setActiveBackground({ color: e.target.value })
                      }
                      style={{ width: 24, height: 24, border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", padding: 0, flexShrink: 0 }}
                    />
                    <TextField
                      size="small"
                      value={activeBackground.color}
                      onChange={(e) =>
                        setActiveBackground({ color: e.target.value })
                      }
                      sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 }, "& .MuiInputBase-root": { minHeight: 28 } }}
                    />
                  </Box>
                </SettingRow>
              </>
            )}

            {/* ===== 渐变背景 ===== */}
            {activeBackground.type === "gradient" && (
              <>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, fontWeight: 600 }}>
                  预设渐变
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.5 }}>
                  {GRADIENT_PRESETS.map((preset) => {
                    const cssDir = preset.direction === "radial"
                      ? "radial-gradient(circle"
                      : `linear-gradient(${preset.direction.replace(/-/g, " ")}`;
                    const isActive =
                      activeBackground.gradient.direction === preset.direction &&
                      activeBackground.gradient.colors[0] === preset.colors[0] &&
                      activeBackground.gradient.colors[1] === preset.colors[1];
                    return (
                      <Tooltip key={preset.name} title={preset.name}>
                        <Box
                          onClick={() =>
                            setActiveBackground({ gradient: { direction: preset.direction, colors: [...preset.colors] as [string, string] } })
                          }
                          sx={{
                            height: 36,
                            borderRadius: 0.75,
                            cursor: "pointer",
                            border: isActive ? 2 : 1,
                            borderColor: isActive ? "primary.main" : "divider",
                            background: `${cssDir}, ${preset.colors[0]}, ${preset.colors[1]})`,
                            transition: "all 0.1s",
                            "&:hover": {
                              transform: "scale(1.05)",
                              borderColor: "primary.main",
                            },
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
                <SettingRow label="渐变方向">
                  <Select
                    size="small"
                    value={activeBackground.gradient.direction}
                    onChange={(e) =>
                      setActiveBackground({ gradient: { ...activeBackground.gradient,
                            direction: e.target.value as GradientDirection } })
                    }
                    sx={{ fontSize: 11, flex: 1 }}
                  >
                    {GRADIENT_DIRECTION_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 11 }}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </SettingRow>
                <SettingRow label="起始颜色">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 0 }}>
                    <input
                      type="color"
                      value={activeBackground.gradient.colors[0]}
                      onChange={(e) =>
                        setActiveBackground({ gradient: { ...activeBackground.gradient,
                              colors: [e.target.value, activeBackground.gradient.colors[1]] } })
                      }
                      style={{ width: 24, height: 24, border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", padding: 0, flexShrink: 0 }}
                    />
                    <TextField
                      size="small"
                      value={activeBackground.gradient.colors[0]}
                      onChange={(e) =>
                        setActiveBackground({ gradient: { ...activeBackground.gradient,
                              colors: [e.target.value, activeBackground.gradient.colors[1]] } })
                      }
                      sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 }, "& .MuiInputBase-root": { minHeight: 28 } }}
                    />
                  </Box>
                </SettingRow>
                <SettingRow label="结束颜色">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 0 }}>
                    <input
                      type="color"
                      value={activeBackground.gradient.colors[1]}
                      onChange={(e) =>
                        setActiveBackground({ gradient: { ...activeBackground.gradient,
                              colors: [activeBackground.gradient.colors[0], e.target.value] } })
                      }
                      style={{ width: 24, height: 24, border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", padding: 0, flexShrink: 0 }}
                    />
                    <TextField
                      size="small"
                      value={activeBackground.gradient.colors[1]}
                      onChange={(e) =>
                        setActiveBackground({ gradient: { ...activeBackground.gradient,
                              colors: [activeBackground.gradient.colors[0], e.target.value] } })
                      }
                      sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 }, "& .MuiInputBase-root": { minHeight: 28 } }}
                    />
                  </Box>
                </SettingRow>
              </>
            )}

            {/* ===== 图片背景 ===== */}
            {activeBackground.type === "image" && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => openAssetPicker("image")}
                  sx={{ fontSize: 11, textTransform: "none", py: 0.5 }}
                >
                  {activeBackground.imageUrl ? "更换图片" : "选择图片"}
                </Button>
                {activeBackground.imageUrl && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 10,
                        color: "text.primary",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {activeBackground.imageUrl.split("/").pop() || activeBackground.imageUrl.split("\\").pop() || "已选择"}
                    </Typography>
                    <Tooltip title="清除">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setActiveBackground({ imageUrl: "" })
                        }
                        sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                <SettingRow label="填充模式">
                  <Select
                    size="small"
                    value={activeBackground.imageFit}
                    onChange={(e) =>
                      setActiveBackground({ imageFit: e.target.value as ImageFit })
                    }
                    sx={{ fontSize: 11, flex: 1 }}
                  >
                    <MenuItem value="cover" sx={{ fontSize: 11 }}>覆盖</MenuItem>
                    <MenuItem value="contain" sx={{ fontSize: 11 }}>包含</MenuItem>
                    <MenuItem value="fill" sx={{ fontSize: 11 }}>拉伸</MenuItem>
                    <MenuItem value="none" sx={{ fontSize: 11 }}>原始</MenuItem>
                  </Select>
                </SettingRow>
              </>
            )}

            {/* ===== 视频背景 ===== */}
            {activeBackground.type === "video" && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  onClick={() => openAssetPicker("video")}
                  sx={{ fontSize: 11, textTransform: "none", py: 0.5 }}
                >
                  {activeBackground.videoUrl ? "更换视频" : "选择视频"}
                </Button>
                {activeBackground.videoUrl && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 10,
                        color: "text.primary",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {activeBackground.videoUrl.split("/").pop() || activeBackground.videoUrl.split("\\").pop() || "已选择"}
                    </Typography>
                    <Tooltip title="清除">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setActiveBackground({ videoUrl: "" })
                        }
                        sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                <SettingRow label="自动播放">
                  <Switch
                    size="small"
                    checked={activeBackground.videoAutoplay}
                    onChange={(e) =>
                      setActiveBackground({ videoAutoplay: e.target.checked })
                    }
                  />
                </SettingRow>
                <SettingRow label="静音">
                  <Switch
                    size="small"
                    checked={activeBackground.videoMuted}
                    onChange={(e) =>
                      setActiveBackground({ videoMuted: e.target.checked })
                    }
                  />
                </SettingRow>
                <SettingRow label="循环播放">
                  <Switch
                    size="small"
                    checked={activeBackground.videoLoop}
                    onChange={(e) =>
                      setActiveBackground({ videoLoop: e.target.checked })
                    }
                  />
                </SettingRow>
              </>
            )}

            {/* ===== 背景预览 ===== */}
            <Box
              sx={{
                height: 48,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...getBackgroundStyle(),
              }}
            >
              {activeBackground.type === "video" && activeBackground.videoUrl && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <VideoIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
                    {activeBackground.videoUrl.split("/").pop() || activeBackground.videoUrl.split("\\").pop() || "视频"}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Collapse>
          <Divider sx={{ mt: 1 }} />
        </Box>

        {/* ===== 网格与辅助 ===== */}
        <Box>
          <SectionHeader
            title="网格与辅助"
            icon={<GridOnIcon sx={{ fontSize: 14 }} />}
            expanded={gridExpanded}
            onToggle={() => setGridExpanded(!gridExpanded)}
          />
          <Collapse in={gridExpanded} unmountOnExit>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pl: 0.5 }}>
            <SettingRow label="显示网格">
              <Switch
                size="small"
                checked={canvasConfig.grid.visible}
                onChange={(e) =>
                  setCanvasConfig({ grid: { ...canvasConfig.grid, visible: e.target.checked } })
                }
              />
              <Tooltip title={canvasConfig.grid.visible ? "隐藏网格" : "显示网格"}>
                <IconButton size="small" sx={{ ml: "auto" }}>
                  {canvasConfig.grid.visible ? (
                    <GridOnIcon sx={{ fontSize: 16, color: "primary.main" }} />
                  ) : (
                    <GridOffIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  )}
                </IconButton>
              </Tooltip>
            </SettingRow>

            {canvasConfig.grid.visible && (
              <>
                <SettingRow label="网格大小">
                  <Select
                    size="small"
                    value={canvasConfig.grid.size}
                    onChange={(e) =>
                      setCanvasConfig({ grid: { ...canvasConfig.grid, size: Number(e.target.value) } })
                    }
                    sx={{ fontSize: 11, flex: 1 }}
                  >
                    {GRID_SIZE_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s} sx={{ fontSize: 11 }}>{s}px</MenuItem>
                    ))}
                  </Select>
                </SettingRow>

                <SettingRow label="吸附网格">
                  <Switch
                    size="small"
                    checked={canvasConfig.grid.snapToGrid}
                    onChange={(e) =>
                      setCanvasConfig({ grid: { ...canvasConfig.grid, snapToGrid: e.target.checked } })
                    }
                  />
                </SettingRow>

                {canvasConfig.grid.snapToGrid && (
                  <>
                    <SettingRow label="拖拽步长">
                      <TextField
                        size="small"
                        type="number"
                        value={canvasConfig.grid.dragStep}
                        onChange={(e) =>
                          setCanvasConfig({
                            grid: { ...canvasConfig.grid, dragStep: Math.max(1, parseInt(e.target.value) || 1) },
                          })
                        }
                        sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 }, "& .MuiInputBase-root": { minHeight: 28 } }}
                        slotProps={{ htmlInput: { min: 1 } }}
                      />
                      <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10, flexShrink: 0 }}>px</Typography>
                    </SettingRow>
                    <SettingRow label="缩放步长">
                      <TextField
                        size="small"
                        type="number"
                        value={canvasConfig.grid.resizeStep}
                        onChange={(e) =>
                          setCanvasConfig({
                            grid: { ...canvasConfig.grid, resizeStep: Math.max(1, parseInt(e.target.value) || 1) },
                          })
                        }
                        sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 }, "& .MuiInputBase-root": { minHeight: 28 } }}
                        slotProps={{ htmlInput: { min: 1 } }}
                      />
                      <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10, flexShrink: 0 }}>px</Typography>
                    </SettingRow>
                  </>
                )}
              </>
            )}

            <Divider sx={{ my: 0.5 }} />

            <SettingRow label="显示标尺">
              <Switch
                size="small"
                checked={canvasConfig.ruler.visible}
                onChange={(e) =>
                  setCanvasConfig({ ruler: { visible: e.target.checked } })
                }
              />
            </SettingRow>

            <SettingRow label="辅助线">
              <Switch
                size="small"
                checked={canvasConfig.guide.visible}
                onChange={(e) =>
                  setCanvasConfig({ guide: { visible: e.target.checked } })
                }
              />
            </SettingRow>
          </Box>
        </Collapse>
          <Divider sx={{ mt: 1 }} />
        </Box>

        {/* ===== 视口控制 ===== */}
        <Box>
          <SectionHeader
            title="视口控制"
            icon={<FullscreenIcon sx={{ fontSize: 14 }} />}
            expanded={viewportExpanded}
            onToggle={() => setViewportExpanded(!viewportExpanded)}
          />
          <Collapse in={viewportExpanded} unmountOnExit>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pl: 0.5 }}>
            <SettingRow label="缩放比例">
              <Typography variant="caption" sx={{ fontWeight: 600, color: "primary.main", fontSize: 12, minWidth: 40 }}>
                {Math.round(viewport.scale * 100)}%
              </Typography>
            </SettingRow>

            <Slider
              size="small"
              value={viewport.scale * 100}
              min={canvasConfig.viewport.minScale * 100}
              max={canvasConfig.viewport.maxScale * 100}
              onChange={(_, value) => {
                const scale = (value as number) / 100;
                useEditorStore.getState().setViewport({ scale });
              }}
              sx={{ mx: 0.5 }}
            />

            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
              <Tooltip title="缩小">
                <IconButton size="small" onClick={zoomOut}>
                  <ZoomOutIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="适应画布">
                <IconButton size="small" onClick={() => resetViewport()}>
                  <FitScreenIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="放大">
                <IconButton size="small" onClick={zoomIn}>
                  <ZoomInIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>

            <SettingRow label="最小缩放">
              <TextField
                size="small"
                type="number"
                value={canvasConfig.viewport.minScale}
                onChange={(e) =>
                  setCanvasConfig({
                    viewport: { ...canvasConfig.viewport, minScale: Math.max(0.05, parseFloat(e.target.value) || 0.1) },
                  })
                }
                sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 }, "& .MuiInputBase-root": { minHeight: 28 } }}
                slotProps={{ htmlInput: { min: 0.05, max: 1, step: 0.05 } }}
              />
            </SettingRow>
            <SettingRow label="最大缩放">
              <TextField
                size="small"
                type="number"
                value={canvasConfig.viewport.maxScale}
                onChange={(e) =>
                  setCanvasConfig({
                    viewport: { ...canvasConfig.viewport, maxScale: Math.min(20, Math.max(1, parseFloat(e.target.value) || 5)) },
                  })
                }
                sx={{ flex: 1, minWidth: 0, "& .MuiInputBase-input": { fontSize: 11, py: 0.5, px: 1 }, "& .MuiInputBase-root": { minHeight: 28 } }}
                slotProps={{ htmlInput: { min: 1, max: 20, step: 0.5 } }}
              />
            </SettingRow>
          </Box>
        </Collapse>
          <Divider sx={{ mt: 1 }} />
        </Box>

        {/* ===== 画布信息 ===== */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, pl: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", fontSize: 11, mb: 0.5 }}>
            画布信息
          </Typography>
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
              border: 1,
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>尺寸</Typography>
              <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 10 }}>
                {canvasConfig.width} × {canvasConfig.height}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.3 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>宽高比</Typography>
              <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 10 }}>
                {aspectRatio.toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.3 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>组件</Typography>
              <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 10 }}>
                {components.length}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.3 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>图层</Typography>
              <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 10 }}>
                {layerCount} 图层 · {groupCount} 分组
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.3 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>适配</Typography>
              <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 10 }}>
                {ADAPTATION_OPTIONS.find((o) => o.value === canvasConfig.adaptationType)?.label || "自适应"}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <AssetPicker
        open={assetPickerOpen}
        mode={assetPickerMode}
        onClose={() => setAssetPickerOpen(false)}
        onSelect={handleAssetSelect}
        currentValue={assetPickerMode === "image" ? activeBackground.imageUrl : activeBackground.videoUrl}
      />
    </Box>
  );
}
