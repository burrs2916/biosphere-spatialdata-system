import { useState, useEffect, useCallback, memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import WidgetsIcon from "@mui/icons-material/Widgets";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { useEditorStore } from "../../store/editorStore";
import { componentRegistry } from "../registry";
import type { ConfigField, SceneComponent } from "../../types/editor";
import type { MapLibrary } from "../../types/mapLibrary";
import { PanelWrapper } from "../components/PanelWrapper";

interface EditorPropertyPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

const fieldSx = {
  "& .MuiInputBase-input": { fontSize: 11.5, py: 0.4, px: 0.75 },
  "& .MuiOutlinedInput-root": { borderRadius: 0.75 },
  "& .MuiInputLabel-root": { fontSize: 10.5 },
  "& .MuiFormHelperText-root": { fontSize: 9, ml: 0 },
};

const sectionHeaderSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  py: 0.4,
  px: 0.75,
  borderRadius: 0.75,
  "&:hover": { backgroundColor: "action.hover" },
  userSelect: "none",
  minHeight: 24,
};

const sectionTitleSx = {
  fontWeight: 600,
  color: "text.secondary",
  fontSize: 10,
  letterSpacing: 0.8,
  textTransform: "uppercase",
};

function CompactNumberInput({
  label,
  value,
  onChange,
  adornment,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  adornment?: string;
  step?: number;
}) {
  return (
    <TextField
      value={Math.round(value * 100) / 100}
      size="small"
      fullWidth
      onChange={(e) => onChange(Number(e.target.value))}
      sx={fieldSx}
      slotProps={{
        htmlInput: { style: { textAlign: "center" }, step },
        inputLabel: { shrink: true },
        input: {
          startAdornment: adornment ? (
            <InputAdornment position="start" sx={{ mr: -0.5, "& .MuiTypography-root": { fontSize: 9, color: "text.disabled", fontWeight: 600 } }}>
              {adornment}
            </InputAdornment>
          ) : undefined,
        },
      }}
      label={label}
    />
  );
}

function MapLibrarySelectField({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const [maps, setMaps] = useState<MapLibrary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMaps = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const mapType = field.mapType || "cad";
      const m = await invoke<MapLibrary[]>("get_published_map_libraries_by_type", { mapType });
      setMaps(m);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [field.mapType]);

  useEffect(() => {
    loadMaps();
    let unsubscribeFn: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("map-library-published", async () => {
        setLoading(true);
        await loadMaps();
      }).then((fn) => { unsubscribeFn = fn; });
    });
    return () => { unsubscribeFn?.(); };
  }, [loadMaps]);

  return (
    <TextField
      label={field.label}
      value={String(value ?? "")}
      size="small"
      fullWidth
      select
      onChange={(e) => onChange(field.key, e.target.value)}
      sx={fieldSx}
    >
      <MenuItem value="" disabled sx={{ fontSize: 11 }}>
        {loading ? "加载中..." : "-- 选择已发布的地图 --"}
      </MenuItem>
      {maps.map((m) => (
        <MenuItem key={m.id} value={m.id} sx={{ fontSize: 11 }}>{m.name}</MenuItem>
      ))}
    </TextField>
  );
}

function FileField({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const [picking, setPicking] = useState(false);

  const handlePick = async () => {
    setPicking(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: field.key === "source"
          ? [{ name: "CAD 文件", extensions: ["dxf", "dwg"] }]
          : undefined,
      });
      if (selected) {
        const filePath = typeof selected === "string" ? selected : (selected as { path: string }).path;
        onChange(field.key, filePath);
      }
    } catch {
    } finally {
      setPicking(false);
    }
  };

  const displayValue = String(value ?? "");
  const fileName = displayValue.split(/[\\/]/).pop() || displayValue;

  return (
    <Box>
      <Typography sx={{ fontSize: 10, color: "text.secondary", mb: 0.25, fontWeight: 500 }}>
        {field.label}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 0.75,
          py: 0.4,
          borderRadius: 0.75,
          border: 1,
          borderColor: "divider",
          backgroundColor: "action.hover",
          minHeight: 28,
        }}
      >
        <Typography
          sx={{
            flex: 1,
            fontSize: 11,
            color: value ? "text.primary" : "text.disabled",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value ? fileName : (field.placeholder || "点击选择文件")}
        </Typography>
        <IconButton size="small" onClick={handlePick} disabled={picking} sx={{ p: 0.25 }}>
          {picking ? <CircularProgress size={12} /> : <FolderOpenIcon sx={{ fontSize: 13 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}

function ConfigFieldRenderer({
  field,
  value,
  onChange,
  config,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  config: Record<string, unknown>;
}) {
  if (field.hidden?.(config)) return null;

  switch (field.type) {
    case "text":
      return (
        <TextField
          label={field.label}
          value={value ?? field.defaultValue ?? ""}
          size="small"
          fullWidth
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          sx={fieldSx}
        />
      );

    case "number":
      return (
        <TextField
          label={field.label}
          type="number"
          value={value ?? field.defaultValue ?? 0}
          size="small"
          fullWidth
          slotProps={{ htmlInput: { min: field.min, max: field.max, step: field.step } }}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
          sx={fieldSx}
        />
      );

    case "select":
      return (
        <TextField
          label={field.label}
          value={value ?? field.defaultValue ?? ""}
          size="small"
          fullWidth
          select
          onChange={(e) => onChange(field.key, e.target.value)}
          sx={fieldSx}
        >
          {field.options?.map((opt) => (
            <MenuItem key={String(opt.value)} value={String(opt.value)} sx={{ fontSize: 11 }}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      );

    case "color":
      return (
        <Box>
          <Typography sx={{ fontSize: 10, color: "text.secondary", mb: 0.25, fontWeight: 500 }}>
            {field.label}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box
              sx={{
                position: "relative",
                width: 24,
                height: 24,
                borderRadius: 0.75,
                border: 1,
                borderColor: "divider",
                overflow: "hidden",
                flexShrink: 0,
                cursor: "pointer",
                "&:hover": { borderColor: "primary.main" },
              }}
            >
              <input
                type="color"
                value={String(value ?? field.defaultValue ?? "#000000")}
                onChange={(e) => onChange(field.key, e.target.value)}
                style={{
                  position: "absolute",
                  inset: -4,
                  width: "calc(100% + 8px)",
                  height: "calc(100% + 8px)",
                  cursor: "pointer",
                  border: "none",
                  padding: 0,
                }}
              />
            </Box>
            <TextField
              value={value ?? field.defaultValue ?? ""}
              size="small"
              fullWidth
              onChange={(e) => onChange(field.key, e.target.value)}
              sx={{
                ...fieldSx,
                "& .MuiInputBase-input": { fontSize: 10.5, fontFamily: "monospace" },
              }}
              placeholder="#000000"
            />
          </Box>
        </Box>
      );

    case "toggle":
      return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.25 }}>
          <Typography sx={{ fontSize: 11, color: "text.primary" }}>
            {field.label}
          </Typography>
          <Switch
            checked={Boolean(value ?? field.defaultValue ?? false)}
            onChange={(e) => onChange(field.key, e.target.checked)}
            size="small"
          />
        </Box>
      );

    case "slider":
      return (
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
            <Typography sx={{ fontSize: 10, color: "text.secondary", fontWeight: 500 }}>
              {field.label}
            </Typography>
            <Typography sx={{ fontSize: 10, color: "text.primary", fontFamily: "monospace", fontWeight: 500 }}>
              {String(value ?? field.defaultValue ?? 0)}
            </Typography>
          </Box>
          <Slider
            size="small"
            value={Number(value ?? field.defaultValue ?? 0)}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(_, v) => onChange(field.key, v)}
            sx={{ py: 0.25 }}
          />
        </Box>
      );

    case "textarea":
      return (
        <TextField
          label={field.label}
          value={value ?? field.defaultValue ?? ""}
          size="small"
          fullWidth
          multiline
          rows={3}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          sx={fieldSx}
        />
      );

    case "json":
      return (
        <TextField
          label={field.label}
          value={
            typeof value === "object" && value !== null
              ? JSON.stringify(value, null, 2)
              : String(value ?? "")
          }
          size="small"
          fullWidth
          multiline
          rows={4}
          placeholder={field.placeholder || "JSON 格式"}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(field.key, parsed);
            } catch {
              onChange(field.key, e.target.value);
            }
          }}
          sx={fieldSx}
        />
      );

    case "file":
      return <FileField field={field} value={value} onChange={onChange} />;

    case "mapLibrary":
      return <MapLibrarySelectField field={field} value={value} onChange={onChange} />;

    default:
      return null;
  }
}

function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Box>
      <Box onClick={() => setExpanded(!expanded)} sx={sectionHeaderSx}>
        <Typography sx={sectionTitleSx}>{title}</Typography>
        {expanded ? <ExpandLessIcon sx={{ fontSize: 13, color: "text.disabled" }} /> : <ExpandMoreIcon sx={{ fontSize: 13, color: "text.disabled" }} />}
      </Box>
      {expanded && <Box sx={{ mt: 0.25, mb: 0.25 }}>{children}</Box>}
    </Box>
  );
}

const ComponentConfigPanel = memo(function ComponentConfigPanel({ component }: { component: SceneComponent }) {
  const updateComponentConfig = useEditorStore((s) => s.updateComponentConfig);
  const definition = componentRegistry.get(component.type);

  const handleChange = useCallback((key: string, value: unknown) => {
    updateComponentConfig(component.id, { [key]: value });
  }, [component.id, updateComponentConfig]);

  const schema = definition?.configSchema || [];
  const groups = new Map<string, ConfigField[]>();
  schema.forEach((field) => {
    const group = field.group || "通用";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(field);
  });

  if (schema.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {Array.from(groups.entries()).map(([group, fields]) => (
        <CollapsibleSection key={group} title={group} defaultExpanded={groups.size <= 2}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, pt: 0.25 }}>
            {fields.map((field) => (
              <ConfigFieldRenderer
                key={field.key}
                field={field}
                value={component.config[field.key]}
                onChange={handleChange}
                config={component.config}
              />
            ))}
          </Box>
        </CollapsibleSection>
      ))}
    </Box>
  );
});

export function EditorPropertyPanelContent() {
  const selectedIds = useEditorStore((s) => s.selection.selectedIds);
  const components = useEditorStore((s) => s.components);
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const updateComponentTransform = useEditorStore((s) => s.updateComponentTransform);
  const removeComponent = useEditorStore((s) => s.removeComponent);
  const duplicateComponent = useEditorStore((s) => s.duplicateComponent);
  const reorderComponent = useEditorStore((s) => s.reorderComponent);

  const selectedComponents = components.filter((c) =>
    selectedIds.includes(c.id)
  );

  if (selectedComponents.length === 0) {
    return (
      <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Typography sx={{ fontWeight: 600, fontSize: 12 }}>
            属性
          </Typography>
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 3, gap: 1 }}>
          <WidgetsIcon sx={{ fontSize: 28, color: "text.disabled", opacity: 0.4 }} />
          <Typography sx={{ textAlign: "center", fontSize: 11, color: "text.secondary" }}>
            选择画布中的组件
          </Typography>
          <Typography sx={{ textAlign: "center", fontSize: 9.5, color: "text.disabled" }}>
            以编辑其属性
          </Typography>
        </Box>
      </Box>
    );
  }

  const comp = selectedComponents[0];
  const definition = componentRegistry.get(comp.type);
  const hasConfig = (definition?.configSchema?.length ?? 0) > 0;
  const sameLayerComps = components.filter((c) => c.layerId === comp.layerId);
  const maxZIndex = sameLayerComps.reduce((max, c) => Math.max(max, c.zIndex), 0);

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 1.25, py: 0.75, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
          <TextField
            value={comp.name}
            size="small"
            fullWidth
            onChange={(e) => updateComponent(comp.id, { name: e.target.value })}
            sx={{
              ...fieldSx,
              "& .MuiInputBase-input": { fontSize: 12, fontWeight: 600, py: 0.2 },
              "& .MuiOutlinedInput-root": { borderRadius: 0.75, pr: 0.5 },
            }}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Chip
            label={definition?.name || comp.type}
            size="small"
            variant="outlined"
            sx={{ height: 16, fontSize: 9, "& .MuiChip-label": { px: 0.5 } }}
          />
          <Box sx={{ display: "flex", gap: 0 }}>
            <Tooltip title={comp.visible ? "隐藏" : "显示"} arrow enterDelay={400}>
              <IconButton size="small" onClick={() => updateComponent(comp.id, { visible: !comp.visible })} sx={{ p: 0.2 }}>
                {comp.visible ? <VisibilityIcon sx={{ fontSize: 13 }} /> : <VisibilityOffIcon sx={{ fontSize: 13 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title={comp.locked ? "解锁" : "锁定"} arrow enterDelay={400}>
              <IconButton size="small" onClick={() => updateComponent(comp.id, { locked: !comp.locked })} sx={{ p: 0.2 }}>
                {comp.locked ? <LockIcon sx={{ fontSize: 13 }} /> : <LockOpenIcon sx={{ fontSize: 13 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="复制" arrow enterDelay={400}>
              <IconButton size="small" onClick={() => duplicateComponent(comp.id)} sx={{ p: 0.2 }}>
                <ContentCopyIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除" arrow enterDelay={400}>
              <IconButton size="small" onClick={() => removeComponent(comp.id)} sx={{ p: 0.2, color: "error.main" }}>
                <DeleteIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", p: 1.25, display: "flex", flexDirection: "column", gap: 1, "&::-webkit-scrollbar": { width: 3 }, "&::-webkit-scrollbar-thumb": { borderRadius: 2 } }}>
        <CollapsibleSection title="位置与大小">
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
            <CompactNumberInput label="X" value={comp.transform.x} onChange={(v) => updateComponentTransform(comp.id, { x: v })} />
            <CompactNumberInput label="Y" value={comp.transform.y} onChange={(v) => updateComponentTransform(comp.id, { y: v })} />
            <CompactNumberInput label="W" value={comp.transform.width} onChange={(v) => updateComponentTransform(comp.id, { width: v })} />
            <CompactNumberInput label="H" value={comp.transform.height} onChange={(v) => updateComponentTransform(comp.id, { height: v })} />
          </Box>
          {definition?.capabilities.rotatable && (
            <Box sx={{ mt: 0.5 }}>
              <CompactNumberInput label="旋转" value={comp.transform.rotation} onChange={(v) => updateComponentTransform(comp.id, { rotation: v })} adornment="°" />
            </Box>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="层级顺序">
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.25 }}>
            <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>
              Z-Index
            </Typography>
            <TextField
              value={comp.zIndex}
              size="small"
              type="number"
              onChange={(e) => reorderComponent(comp.id, Number(e.target.value))}
              sx={{ ...fieldSx, width: 60, "& .MuiInputBase-input": { textAlign: "center", fontSize: 11, fontFamily: "monospace" } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Box sx={{ flex: 1 }} />
            <Tooltip title="上移一层" arrow enterDelay={400}>
              <span>
                <IconButton
                  size="small"
                  disabled={comp.zIndex >= maxZIndex}
                  onClick={() => reorderComponent(comp.id, comp.zIndex + 1)}
                  sx={{ p: 0.25 }}
                >
                  <ArrowUpwardIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="下移一层" arrow enterDelay={400}>
              <span>
                <IconButton
                  size="small"
                  disabled={comp.zIndex <= 0}
                  onClick={() => reorderComponent(comp.id, Math.max(0, comp.zIndex - 1))}
                  sx={{ p: 0.25 }}
                >
                  <ArrowDownwardIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </CollapsibleSection>

        {hasConfig && (
          <>
            <Divider sx={{ borderColor: "divider", opacity: 0.5 }} />
            <ComponentConfigPanel component={comp} />
          </>
        )}
      </Box>
    </Box>
  );
}

export function EditorPropertyPanel({ collapsed, onToggle }: EditorPropertyPanelProps) {
  return (
    <PanelWrapper
      collapsed={collapsed}
      onToggle={onToggle}
      width={280}
      position="right"
      borderSide="left"
    >
      <EditorPropertyPanelContent />
    </PanelWrapper>
  );
}
