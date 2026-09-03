import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import MuiMenu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import WidgetsIcon from "@mui/icons-material/Widgets";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useComponentStore } from "../store/componentStore";
import { componentRegistry } from "../editor/registry";
import { resolveIcon } from "../editor/plugins";
import { renderCategoryIcon } from "../components/component/categoryConstants";
import { countAllPlugins, getUngroupedPlugins, isPluginInCategory } from "../utils/componentTree";
import { PluginCard } from "../components/component";
import { CreateCategoryDialog } from "../components/component/CreateCategoryDialog";
import { CategoryDetailDialog } from "../components/component/CategoryDetailDialog";
import { EditCategoryDialog } from "../components/component/EditCategoryDialog";
import { openComponentPreviewWindow } from "../utils/previewWindow";
import { IconPicker } from "../components/component/IconPicker";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import type { ComponentPluginItem, ComponentCategoryNode } from "../types/component";
import { BUILTIN_CATEGORY_IDS } from "../types/component";

let _thumbnailGenerator: typeof import("../editor/utils/thumbnailGenerator").thumbnailGenerator | null = null;
async function getThumbnailGenerator() {
  if (!_thumbnailGenerator) {
    const mod = await import("../editor/utils/thumbnailGenerator");
    _thumbnailGenerator = mod.thumbnailGenerator;
  }
  return _thumbnailGenerator;
}

function CategoryTreeItem({
  node,
  depth,
  activeId,
  onSelect,
  onContextMenu,
  onDrop,
  collapsed,
  onToggleCollapse,
}: {
  node: ComponentCategoryNode;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: ComponentCategoryNode) => void;
  onDrop?: (e: React.DragEvent, catId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: (id: string) => void;
}) {
  const isActive = activeId === node.id;
  const pluginCount = countAllPlugins(node);
  const [dragOver, setDragOver] = useState(false);

  return (
    <Box
      onClick={() => onSelect(node.id)}
      onContextMenu={(e) => onContextMenu(e, node)}
      onDragOver={(e) => {
        if (!onDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        onDrop?.(e, node.id);
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        pl: depth * 1.5 + 0.75,
        pr: 0.75,
        py: 0.5,
        cursor: "pointer",
        borderRadius: 0.75,
        mx: 0.5,
        bgcolor: dragOver ? "primary.main" : isActive ? "action.selected" : "transparent",
        color: dragOver ? "primary.contrastText" : undefined,
        borderLeft: isActive ? 2 : 0,
        borderColor: node.color || "primary.main",
        transition: "all 0.15s",
        "&:hover": {
          bgcolor: dragOver ? "primary.main" : isActive ? "action.selected" : "action.hover",
        },
      }}
    >
      <Box
        sx={{
          width: 14,
          height: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: "pointer",
          transition: "transform 0.15s",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          opacity: 0.5,
          "&:hover": { opacity: 1 },
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse?.(node.id);
        }}
      >
        <ExpandMoreIcon sx={{ fontSize: 12 }} />
      </Box>
      <Box
        sx={{
          width: 18,
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 0.25,
          bgcolor: node.color ? `${node.color}18` : "transparent",
          color: node.color || "text.secondary",
          flexShrink: 0,
        }}
      >
        {renderCategoryIcon(node.icon, 12)}
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontSize: 11,
          fontWeight: isActive ? 600 : 400,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: isActive ? "text.primary" : "text.secondary",
        }}
      >
        {node.name}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          fontSize: 9,
          color: "text.disabled",
          flexShrink: 0,
        }}
      >
        {pluginCount}
      </Typography>
    </Box>
  );
}

function ComponentDetailPanel({
  plugin,
  onClose,
}: {
  plugin: ComponentPluginItem | null;
  onClose: () => void;
}) {
  const togglePlugin = useComponentStore((s) => s.togglePlugin);
  const updatePluginMeta = useComponentStore((s) => s.updatePluginMeta);
  const categories = useComponentStore((s) => s.categories);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSaving, setIconSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null);
  const movePluginToCategory = useComponentStore((s) => s.movePluginToCategory);

  const definition = useMemo(() => {
    if (!plugin) return null;
    return componentRegistry.get(plugin.type);
  }, [plugin]);

  // plugin prop 已从 store 合并，直接使用 plugin.iconOverride
  const currentIcon = useMemo(() => {
    if (!plugin) return "widgets";
    return (
      plugin.iconOverride ??
      componentRegistry.getEffectiveIcon(plugin.type) ??
      definition?.icon ??
      plugin.icon ??
      "widgets"
    );
  }, [plugin, definition]);

  // 当前所属分组名
  const currentCategoryName = useMemo(() => {
    if (!plugin) return "";
    const cat = categories.find(
      (c) => c.id === plugin.category || c.id === `ccat_${plugin.category}`
    );
    if (cat) return cat.name;
    return plugin.category ? "未分组" : "未分组";
  }, [plugin, categories]);

  if (!plugin) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "text.disabled",
          gap: 1,
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 32 }} />
        <Typography variant="caption">选择组件查看详情</Typography>
      </Box>
    );
  }

  const handleToggle = async () => {
    await togglePlugin(plugin.id, !plugin.enabled);
  };

  const handleChangeIcon = async (newIcon: string) => {
    setIconSaving(true);
    try {
      await updatePluginMeta(plugin.type, { icon: newIcon });
      setIconPickerOpen(false);
    } catch (err) {
      console.error("[ComponentDetail] Failed to update icon:", err);
    } finally {
      setIconSaving(false);
    }
  };

  const handleResetIcon = async () => {
    setIconSaving(true);
    try {
      await updatePluginMeta(plugin.type, { icon: null });
      setIconPickerOpen(false);
    } catch (err) {
      console.error("[ComponentDetail] Failed to reset icon:", err);
    } finally {
      setIconSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!plugin) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === plugin.name) { setEditingName(false); return; }
    setMetaSaving(true);
    try {
      await updatePluginMeta(plugin.type, { name: trimmed });
      setEditingName(false);
    } catch (err) {
      console.error("[ComponentDetail] Failed to save name:", err);
    } finally {
      setMetaSaving(false);
    }
  };

  const handleSaveDesc = async () => {
    if (!plugin) return;
    const trimmed = descDraft.trim();
    if (trimmed === (plugin.description ?? "")) { setEditingDesc(false); return; }
    setMetaSaving(true);
    try {
      await updatePluginMeta(plugin.type, { description: trimmed || null });
      setEditingDesc(false);
    } catch (err) {
      console.error("[ComponentDetail] Failed to save description:", err);
    } finally {
      setMetaSaving(false);
    }
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 头部：图标 + 名称 + 关闭 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Tooltip title="点击更换图标" arrow>
          <Box
            onClick={() => !iconSaving && setIconPickerOpen(true)}
            sx={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
              borderRadius: 1.5,
              color: plugin.iconOverride ? "primary.main" : "text.secondary",
              cursor: iconSaving ? "wait" : "pointer",
              transition: "all 0.15s",
              position: "relative",
              "&:hover": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(0,0,0,0.08)",
                transform: "scale(1.05)",
              },
            }}
          >
            {resolveIcon(currentIcon, "widgets", 24, plugin.type)}
            {plugin.iconOverride && (
              <Box
                sx={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: "warning.main",
                  border: "1px solid",
                  borderColor: "background.paper",
                }}
              />
            )}
          </Box>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <TextField
              size="small"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
              disabled={metaSaving}
              slotProps={{ htmlInput: { style: { fontSize: 13, fontWeight: 600, padding: "2px 6px" } } }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, lineHeight: 1.3, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
              onClick={() => { setNameDraft(plugin.name); setEditingName(true); }}
            >
              {plugin.name}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
            {plugin.description || ""}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      {/* 内容区 */}
      <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* 状态标签行 */}
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            <Chip
              label={plugin.builtIn ? "内置" : "自定义"}
              size="small"
              sx={{ fontSize: 9, height: 18 }}
              color={plugin.builtIn ? "primary" : "default"}
              variant="outlined"
            />
            <Chip
              label={plugin.enabled ? "已启用" : "已禁用"}
              size="small"
              sx={{ fontSize: 9, height: 18 }}
              color={plugin.enabled ? "success" : "default"}
              variant="outlined"
            />
            <Chip
              label={currentCategoryName}
              size="small"
              sx={{ fontSize: 9, height: 18, cursor: "pointer" }}
              color="info"
              variant="outlined"
              onClick={(e) => setMoveMenuAnchor(e.currentTarget)}
              onDelete={(e) => { e.stopPropagation(); setMoveMenuAnchor(e.currentTarget); }}
              deleteIcon={<ArrowForwardIcon sx={{ fontSize: 10 }} />}
            />
            <MuiMenu
              anchorEl={moveMenuAnchor}
              open={Boolean(moveMenuAnchor)}
              onClose={() => setMoveMenuAnchor(null)}
              slotProps={{ paper: { sx: { maxHeight: 280, minWidth: 160 } } }}
            >
              <MenuItem
                onClick={async () => {
                  if (!plugin) return;
                  await movePluginToCategory(plugin.type, "");
                  setMoveMenuAnchor(null);
                }}
                sx={{ fontSize: 11, gap: 1 }}
              >
                {resolveIcon("help_outline", "folder", 12)}
                <Typography variant="caption" sx={{ fontSize: 11 }}>未分组</Typography>
              </MenuItem>
              {categories
                .filter((c) => c.id !== plugin?.category && c.id !== `ccat_${plugin?.category}`)
                .map((cat) => (
                  <MenuItem
                    key={cat.id}
                    onClick={async () => {
                      if (!plugin) return;
                      await movePluginToCategory(plugin.type, cat.id);
                      setMoveMenuAnchor(null);
                    }}
                    sx={{ fontSize: 11, gap: 1 }}
                  >
                    <Box sx={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color || "text.secondary" }}>
                      {renderCategoryIcon(cat.icon, 10)}
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: 11 }}>{cat.name}</Typography>
                  </MenuItem>
                ))}
            </MuiMenu>
          </Box>

          {/* 描述 */}
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.25, display: "block" }}>
              描述
            </Typography>
            {editingDesc ? (
              <TextField
                size="small"
                autoFocus
                multiline
                minRows={2}
                maxRows={4}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={handleSaveDesc}
                onKeyDown={(e) => { if (e.key === "Escape") setEditingDesc(false); }}
                disabled={metaSaving}
                slotProps={{ htmlInput: { style: { fontSize: 11, lineHeight: 1.5 } } }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5 }, width: "100%" }}
              />
            ) : (
              <Typography
                variant="caption"
                sx={{ fontSize: 11, lineHeight: 1.5, color: plugin.description ? "text.primary" : "text.disabled", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                onClick={() => { setDescDraft(plugin.description ?? ""); setEditingDesc(true); }}
              >
                {plugin.description || "点击添加描述"}
              </Typography>
            )}
          </Box>

          {/* 基本信息 */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.25, display: "block" }}>
                版本
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11 }}>{plugin.version}</Typography>
            </Box>
            {plugin.author && (
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.25, display: "block" }}>
                  作者
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 11 }}>{plugin.author}</Typography>
              </Box>
            )}
          </Box>

          {/* 配置项 */}
          {definition?.configSchema && definition.configSchema.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.5, display: "block" }}>
                配置项 ({definition.configSchema.length})
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {definition.configSchema.map((field) => {
                  const typeLabel: Record<string, string> = { text: "文本", number: "数字", boolean: "开关", color: "颜色", select: "选择", slider: "滑块", json: "JSON" };
                  return (
                    <Chip
                      key={field.key}
                      label={`${field.label} · ${field.type ? typeLabel[field.type] ?? field.type : "未配置"}`}
                      size="small"
                      sx={{ fontSize: 8, height: 16 }}
                      variant="outlined"
                    />
                  );
                })}
              </Box>
            </Box>
          )}

          {/* 能力 */}
          {definition?.capabilities && (
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.5, display: "block" }}>
                能力
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {Object.entries(definition.capabilities).map(([key, val]) => {
                  const capLabels: Record<string, string> = {
                    resizable: "可缩放", draggable: "可拖拽", rotatable: "可旋转",
                    selectable: "可选中", editable: "可编辑", connectable: "可连线",
                    groupable: "可分组", lockable: "可锁定", exportable: "可导出",
                  };
                  return (
                    <Chip
                      key={key}
                      label={`${capLabels[key] || key} ${val ? "✓" : "✗"}`}
                      size="small"
                      sx={{ fontSize: 8, height: 16 }}
                      color={val ? "success" : "default"}
                      variant="outlined"
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* 底部操作栏 */}
      <Box
        sx={{
          p: 1.5,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<Switch checked={plugin.enabled} size="small" />}
          onClick={handleToggle}
          sx={{ fontSize: 10, textTransform: "none", flex: 1 }}
          color={plugin.enabled ? "warning" : "success"}
        >
          {plugin.enabled ? "禁用" : "启用"}
        </Button>
        {definition && (
          <Button
            size="small"
            variant="contained"
            startIcon={<ViewInArIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              openComponentPreviewWindow({
                pluginType: plugin.type,
                pluginName: plugin.name,
                pluginDescription: plugin.description ?? "",
                pluginIcon: plugin.iconOverride ?? definition?.icon ?? "",
                defaultConfig: definition?.defaultConfig ?? {},
                defaultSize: definition?.defaultSize ?? null,
              });
            }}
            sx={{ fontSize: 10, textTransform: "none", flex: 1 }}
          >
            预览
          </Button>
        )}
      </Box>

      <Dialog
        open={iconPickerOpen}
        onClose={() => !iconSaving && setIconPickerOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, pb: 1 }}>
          <span>更换组件图标</span>
          {plugin.iconOverride && (
            <Button
              size="small"
              onClick={handleResetIcon}
              disabled={iconSaving}
              sx={{ fontSize: 10, textTransform: "none" }}
            >
              恢复默认
            </Button>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", mb: 0.5, display: "block" }}>
            {plugin.iconOverride ? "已自定义" : "使用默认"}{definition ? ` · 默认: ${definition.icon || "无"}` : ""}
          </Typography>
          <IconPicker value={currentIcon} onChange={handleChangeIcon} />
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <Button
            size="small"
            onClick={() => setIconPickerOpen(false)}
            disabled={iconSaving}
            sx={{ fontSize: 11, textTransform: "none" }}
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function BatchMoveMenu({
  categories,
  onMove,
}: {
  categories: ComponentCategoryNode[];
  onMove: (catId: string) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        sx={{ fontSize: 10, textTransform: "none", minWidth: 0, px: 1 }}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        移动到
      </Button>
      <MuiMenu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { maxHeight: 300 } } }}
      >
        {categories.map((cat) => (
          <MenuItem
            key={cat.id}
            onClick={() => { setAnchor(null); onMove(cat.id); }}
            sx={{ fontSize: 11 }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color || "text.secondary" }}>
                {renderCategoryIcon(cat.icon, 10)}
              </Box>
              {cat.name}
            </Box>
          </MenuItem>
        ))}
      </MuiMenu>
    </>
  );
}

export default function ComponentManagementPage() {
  const categoryTree = useComponentStore((s) => s.categoryTree);
  const categories = useComponentStore((s) => s.categories);
  const plugins = useComponentStore((s) => s.plugins);
  const isLoading = useComponentStore((s) => s.isLoading);
  const storeError = useComponentStore((s) => s.error);
  const refresh = useComponentStore((s) => s.refresh);
  const movePluginToCategory = useComponentStore((s) => s.movePluginToCategory);
  const movePluginsToCategory = useComponentStore((s) => s.movePluginsToCategory);
  const togglePluginsBatch = useComponentStore((s) => s.togglePluginsBatch);
  const deleteCategory = useComponentStore((s) => s.deleteCategory);
  const deleteCategoryWithMigrate = useComponentStore((s) => s.deleteCategoryWithMigrate);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>("__all__");
  const [search, setSearch] = useState("");
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "info" | "warning" | "error">("info");
  // 多选：Set<plugin.type>
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  // 折叠的分组
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  // 删除分组确认（迁移到目标分组）
  const [pendingDeleteCat, setPendingDeleteCat] = useState<ComponentCategoryNode | null>(null);
  const [migrateTargetId, setMigrateTargetId] = useState<string>("");
  const selectedPlugin = useMemo(() => {
    if (!selectedPluginId) return null;
    return plugins.find((p) => p.type === selectedPluginId) ?? null;
  }, [selectedPluginId, plugins]);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [thumbProgress, setThumbProgress] = useState<{ total: number; done: number; running: boolean } | null>(null);
  const thumbAbortRef = useRef(false);
  const [detailCategory, setDetailCategory] = useState<ComponentCategoryNode | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const editCategory = useMemo(() => {
    if (!editCategoryId) return null;
    const findNode = (nodes: ComponentCategoryNode[]): ComponentCategoryNode | null => {
      for (const n of nodes) {
        if (n.id === editCategoryId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };
    return findNode(categoryTree);
  }, [editCategoryId, categoryTree]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; cat: ComponentCategoryNode } | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);

  const syncIconFromPreviewWindow = useComponentStore((s) => s.syncIconFromPreviewWindow);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 监听 store error，显示 Snackbar
  useEffect(() => {
    if (storeError) {
      setSnackbarMsg(storeError);
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  }, [storeError]);

  // 监听预览窗口的图标更新事件
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ pluginType: string; icon: string; name?: string; description?: string | null }>("component-icon-updated", (event) => {
        const { pluginType, icon, name, description } = event.payload;
        syncIconFromPreviewWindow(pluginType, icon, name, description);
      }).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, [syncIconFromPreviewWindow]);

  const ungroupedPlugins = useMemo(
    () => getUngroupedPlugins(categories, plugins),
    [categories, plugins]
  );

  const activeNode = useMemo(() => {
    if (!activeCategoryId || activeCategoryId === "__all__" || activeCategoryId === "__ungrouped__") return null;
    const findNode = (nodes: ComponentCategoryNode[]): ComponentCategoryNode | null => {
      for (const n of nodes) {
        if (n.id === activeCategoryId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };
    return findNode(categoryTree);
  }, [activeCategoryId, categoryTree]);

  const filteredPlugins = useMemo(() => {
    let items: ComponentPluginItem[] = [];

    if (activeCategoryId === "__all__") {
      // 全部组件
      items = plugins;
    } else if (activeCategoryId === "__ungrouped__") {
      // 未分组组件
      items = ungroupedPlugins;
    } else if (activeNode) {
      // 只用 activeNode.plugins（buildCategoryTree 已正确按 store 中的 category 分配）
      items = activeNode.plugins;
    } else {
      items = plugins;
    }

    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [activeNode, activeCategoryId, plugins, search]);

  const handleSelectCategory = useCallback((id: string) => {
    setActiveCategoryId(id);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: ComponentCategoryNode) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, cat: node });
  }, []);

  const handleMovePlugin = useCallback(
    async (plugin: ComponentPluginItem, targetCatId: string) => {
      await movePluginToCategory(plugin.type, targetCatId);
    },
    [movePluginToCategory]
  );

  const handleDeleteCategory = useCallback(
    async (catId: string) => {
      setCtxMenu(null);
      await deleteCategory(catId);
      if (activeCategoryId === catId) {
        setActiveCategoryId(categoryTree[0]?.id ?? null);
      }
    },
    [deleteCategory, activeCategoryId, categoryTree]
  );

  const handlePluginClick = useCallback((plugin: ComponentPluginItem) => {
    setSelectedPluginId(plugin.type);
    setDetailPanelOpen(true);
  }, []);

  // 多选：处理选中状态切换
  const handleSelectChange = useCallback((plugin: ComponentPluginItem, e: React.MouseEvent) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (e.shiftKey) {
        // Shift 选择：从已选最后一个到当前形成区间（简化实现）
        next.add(plugin.type);
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd：切换
        if (next.has(plugin.type)) next.delete(plugin.type);
        else next.add(plugin.type);
      }
      return next;
    });
  }, []);

  // 清空选中
  const clearSelection = useCallback(() => setSelectedTypes(new Set()), []);

  // 批量移动
  const handleBatchMove = useCallback(async (targetCatId: string) => {
    const types = Array.from(selectedTypes);
    if (types.length === 0) return;
    await movePluginsToCategory(types, targetCatId);
    setSnackbarMsg(`已移动 ${types.length} 个组件`);
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
    clearSelection();
  }, [selectedTypes, movePluginsToCategory, clearSelection]);

  // 批量启用/禁用
  const handleBatchToggle = useCallback(async (enabled: boolean) => {
    const types = Array.from(selectedTypes);
    if (types.length === 0) return;
    await togglePluginsBatch(types, enabled);
    setSnackbarMsg(`已${enabled ? "启用" : "禁用"} ${types.length} 个组件`);
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
    clearSelection();
  }, [selectedTypes, togglePluginsBatch, clearSelection]);

  // 拖放：分组树节点接收 drop
  const handleDropOnCategory = useCallback(async (e: React.DragEvent, targetCatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData("application/x-plugin-types");
    if (!data) return;
    try {
      const types = JSON.parse(data) as string[];
      if (!Array.isArray(types) || types.length === 0) return;
      await movePluginsToCategory(types, targetCatId);
      setSnackbarMsg(`已移动 ${types.length} 个组件到目标分组`);
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
      clearSelection();
    } catch {/* swallow */}
  }, [movePluginsToCategory, clearSelection]);

  const handleGenerateThumbnails = useCallback(async () => {
    if (thumbProgress?.running) return;

    const allDefs = componentRegistry.getAll();
    const types = allDefs
      .filter((d) => d.enabled !== false)
      .filter((d) => !["map-tile", "map-cad", "map-globe", "map-heatmap", "map-blueprint", "video"].includes(d.type))
      .map((d) => d.type);

    if (types.length === 0) return;

    thumbAbortRef.current = false;
    setThumbProgress({ total: types.length, done: 0, running: true });

    const gen = await getThumbnailGenerator();

    let done = 0;
    for (const type of types) {
      if (thumbAbortRef.current) break;
      try {
        await gen.generate(type);
      } catch { /* skip */ }
      done++;
      setThumbProgress({ total: types.length, done, running: true });
    }

    setThumbProgress({ total: types.length, done, running: false });
  }, [thumbProgress?.running]);

  const handleAbortThumbnails = useCallback(() => {
    thumbAbortRef.current = true;
  }, []);

  const totalPlugins = plugins.length;
  const enabledCount = plugins.filter((p) => p.enabled).length;

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <WidgetsIcon sx={{ fontSize: 20, color: "primary.main" }} />
        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600, flex: 1 }}>
          组件管理
        </Typography>
        <TextField
          size="small"
          placeholder="搜索组件..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 200, "& .MuiInputBase-input": { fontSize: 12 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Tooltip title="刷新">
          <IconButton size="small" onClick={refresh} disabled={isLoading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={thumbProgress?.running ? "正在生成缩略图..." : "生成缩略图"}>
          <span>
            <IconButton
              size="small"
              onClick={thumbProgress?.running ? handleAbortThumbnails : handleGenerateThumbnails}
              color={thumbProgress?.running ? "warning" : "default"}
            >
              <PhotoLibraryIcon sx={{ fontSize: 18, ...(thumbProgress?.running ? { animation: "spin 1s linear infinite", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } } : {}) }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        <Box
          sx={{
            width: 220,
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Box sx={{ px: 1, py: 0.75, flexShrink: 0 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
              {categoryTree.length} 个分组
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": { borderRadius: 2 },
            }}
          >
            {/* 全部组件 */}
            <Box
              onClick={() => handleSelectCategory("__all__")}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                pl: 0.75 + 1.5 * 0 + 0.75,
                pr: 0.75,
                py: 0.5,
                cursor: "pointer",
                borderRadius: 0.75,
                mx: 0.5,
                bgcolor: activeCategoryId === "__all__" ? "action.selected" : "transparent",
                borderLeft: activeCategoryId === "__all__" ? 2 : 0,
                borderColor: "primary.main",
                transition: "all 0.15s",
                "&:hover": {
                  bgcolor: activeCategoryId === "__all__" ? "action.selected" : "action.hover",
                },
              }}
            >
              <Box sx={{ width: 16, height: 16, flexShrink: 0 }} />
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 0.25,
                  color: "primary.main",
                  flexShrink: 0,
                }}
              >
                <WidgetsIcon sx={{ fontSize: 12 }} />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: 11,
                  fontWeight: activeCategoryId === "__all__" ? 600 : 400,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: activeCategoryId === "__all__" ? "text.primary" : "text.secondary",
                }}
              >
                全部组件
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled", flexShrink: 0 }}>
                {plugins.length}
              </Typography>
            </Box>

            {/* 未分组 */}
            <Box
              onClick={() => handleSelectCategory("__ungrouped__")}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                pl: 0.75 + 1.5 * 0 + 0.75,
                pr: 0.75,
                py: 0.5,
                cursor: "pointer",
                borderRadius: 0.75,
                mx: 0.5,
                bgcolor: activeCategoryId === "__ungrouped__" ? "action.selected" : "transparent",
                borderLeft: activeCategoryId === "__ungrouped__" ? 2 : 0,
                borderColor: "warning.main",
                transition: "all 0.15s",
                "&:hover": {
                  bgcolor: activeCategoryId === "__ungrouped__" ? "action.selected" : "action.hover",
                },
              }}
            >
              <Box sx={{ width: 16, height: 16, flexShrink: 0 }} />
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 0.25,
                  color: "warning.main",
                  flexShrink: 0,
                }}
              >
                {resolveIcon("help_outline", "folder", 12)}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: 11,
                  fontWeight: activeCategoryId === "__ungrouped__" ? 600 : 400,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: activeCategoryId === "__ungrouped__" ? "text.primary" : "text.secondary",
                }}
              >
                未分组
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled", flexShrink: 0 }}>
                {ungroupedPlugins.length}
              </Typography>
            </Box>

            <Divider sx={{ my: 0.5, mx: 1 }} />

            {categoryTree.map((node) => (
              <CategoryTreeItem
                key={node.id}
                node={node}
                depth={0}
                activeId={activeCategoryId}
                onSelect={handleSelectCategory}
                onContextMenu={handleContextMenu}
                onDrop={handleDropOnCategory}
                collapsed={collapsedCats.has(node.id)}
                onToggleCollapse={(id) => {
                  setCollapsedCats((prev) => {
                    const next = new Set(prev);
                    const isCollapsing = !next.has(id);
                    if (isCollapsing) next.add(id);
                    else next.delete(id);
                    // 折叠时如果当前选中的就是该分组，切回全部
                    if (isCollapsing && activeCategoryId === id) {
                      setActiveCategoryId(null);
                    }
                    return next;
                  });
                }}
              />
            ))}
          </Box>

          <Box sx={{ px: 1, py: 1, borderTop: 1, borderColor: "divider", flexShrink: 0 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              sx={{ fontSize: 10, textTransform: "none", width: "100%" }}
              onClick={() => setCreateCategoryOpen(true)}
            >
              创建分组
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 0.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: 1,
              borderColor: "divider",
              flexShrink: 0,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {activeCategoryId === "__all__" ? (
                <Box sx={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "primary.main" }}>
                  <WidgetsIcon sx={{ fontSize: 12 }} />
                </Box>
              ) : activeCategoryId === "__ungrouped__" ? (
                <Box sx={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "warning.main" }}>
                  {resolveIcon("help_outline", "folder", 12)}
                </Box>
              ) : activeNode ? (
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: activeNode.color || "text.secondary",
                  }}
                >
                  {renderCategoryIcon(activeNode.icon, 12)}
                </Box>
              ) : null}
              <Typography variant="caption" sx={{ color: "text.primary", fontSize: 11, fontWeight: 600 }}>
                {activeCategoryId === "__all__" ? "全部组件" : activeCategoryId === "__ungrouped__" ? "未分组" : activeNode?.name ?? "全部组件"}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 9 }}>
              {filteredPlugins.length} 个组件
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              p: 2,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": { borderRadius: 2 },
            }}
          >
            {/* 批量操作工具栏：选中 ≥ 1 时显示 */}
            {selectedTypes.size > 0 && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  mb: 1,
                  borderRadius: 1,
                  bgcolor: "action.selected",
                  border: 1,
                  borderColor: "primary.main",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>
                  已选 {selectedTypes.size} 个
                </Typography>
                <Box sx={{ flex: 1 }} />
                <BatchMoveMenu
                  categories={categoryTree}
                  onMove={handleBatchMove}
                />
                <Button size="small" variant="outlined" sx={{ fontSize: 10, textTransform: "none", minWidth: 0, px: 1 }} onClick={() => handleBatchToggle(true)}>
                  启用
                </Button>
                <Button size="small" variant="outlined" sx={{ fontSize: 10, textTransform: "none", minWidth: 0, px: 1 }} onClick={() => handleBatchToggle(false)}>
                  禁用
                </Button>
                <Button size="small" sx={{ fontSize: 10, textTransform: "none", minWidth: 0, px: 1 }} onClick={() => {
                  const allTypes = filteredPlugins.map((p) => p.type);
                  setSelectedTypes(new Set(allTypes));
                }}>
                  全选
                </Button>
                <Button size="small" sx={{ fontSize: 10, textTransform: "none", minWidth: 0, px: 1 }} onClick={clearSelection}>
                  取消选择
                </Button>
              </Box>
            )}
            {filteredPlugins.length > 0 ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                  gap: 1,
                }}
              >
                {filteredPlugins.map((plugin) => {
                  const isUngrouped = !plugin.category || !categories.some((c) => isPluginInCategory(plugin, c.id));
                  const selectedTypesArr = Array.from(selectedTypes);
                  return (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      onMove={handleMovePlugin}
                      allCategories={categoryTree}
                      currentCategoryId={activeCategoryId ?? undefined}
                      onClick={handlePluginClick}
                      isUngrouped={isUngrouped}
                      selected={selectedTypes.has(plugin.type)}
                      onSelectChange={handleSelectChange}
                      draggingTypes={selectedTypesArr}
                    />
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                <WidgetsIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                <Typography variant="caption" sx={{ display: "block" }}>
                  {search ? "未找到匹配的组件" : "暂无组件"}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {detailPanelOpen && (
          <Box
            sx={{
              width: 280,
              borderLeft: 1,
              borderColor: "divider",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <ComponentDetailPanel
              plugin={selectedPlugin}
              onClose={() => setDetailPanelOpen(false)}
            />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          px: 2,
          py: 0.75,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
          {categoryTree.length} 个分组 · {totalPlugins} 个组件 · 已启用 {enabledCount}
        </Typography>
        {thumbProgress && (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={(thumbProgress.done / thumbProgress.total) * 100}
              sx={{ flex: 1, height: 4, borderRadius: 2 }}
            />
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 9, whiteSpace: "nowrap" }}>
              {thumbProgress.running
                ? `生成缩略图 ${thumbProgress.done}/${thumbProgress.total}...`
                : `已完成 ${thumbProgress.done}/${thumbProgress.total}`}
            </Typography>
          </Box>
        )}
      </Box>

      <MuiMenu
        open={Boolean(ctxMenu)}
        onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}
        slotProps={{ paper: { sx: { minWidth: 150 } } }}
      >
        {ctxMenu && (() => {
          const cat = ctxMenu.cat;
          const isBuiltIn = BUILTIN_CATEGORY_IDS.has(cat.id);
          const hasPlugins = countAllPlugins(cat) > 0;

          return (
            <>
              <MenuItem
                onClick={() => {
                  setCtxMenu(null);
                  setDetailCategory(cat);
                }}
                sx={{ fontSize: 12 }}
              >
                查看组件
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setCtxMenu(null);
                  setEditCategoryId(cat.id);
                }}
                sx={{ fontSize: 12 }}
              >
                编辑分组
              </MenuItem>
              {!isBuiltIn && !hasPlugins && (
                <MenuItem
                  onClick={() => handleDeleteCategory(cat.id)}
                  sx={{ fontSize: 12, color: "error.main" }}
                >
                  删除分组
                </MenuItem>
              )}
              {!isBuiltIn && hasPlugins && (
                <MenuItem
                  onClick={() => {
                    setCtxMenu(null);
                    setPendingDeleteCat(cat);
                    setMigrateTargetId("");
                  }}
                  sx={{ fontSize: 12, color: "error.main" }}
                >
                  {`删除分组（迁移 ${countAllPlugins(cat)} 个组件）`}
                </MenuItem>
              )}
            </>
          );
        })()}
      </MuiMenu>

      <CategoryDetailDialog
        category={detailCategory}
        open={!!detailCategory}
        onClose={() => setDetailCategory(null)}
        onMovePlugin={handleMovePlugin}
        onPluginClick={handlePluginClick}
        allCategories={categoryTree}
      />

      <CreateCategoryDialog
        open={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
        categoryCount={categoryTree.length}
      />

      <EditCategoryDialog
        key={editCategory?.id ?? "none"}
        category={editCategory}
        open={!!editCategory}
        onClose={() => setEditCategoryId(null)}
      />

      {/* 删除分组（迁移）确认对话框 */}
      <Dialog
        open={!!pendingDeleteCat}
        onClose={() => setPendingDeleteCat(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600 }}>
          删除分组「{pendingDeleteCat?.name}」
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ fontSize: 12, mb: 1.5 }}>
            该分组下有 {pendingDeleteCat ? countAllPlugins(pendingDeleteCat) : 0} 个组件，请选择迁移目标：
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 200, overflow: "auto" }}>
            <MenuItem
              selected={migrateTargetId === ""}
              onClick={() => setMigrateTargetId("")}
              sx={{ fontSize: 12, borderRadius: 0.5 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "warning.main" }}>
                  {resolveIcon("help_outline", "folder", 12)}
                </Box>
                未分组
              </Box>
            </MenuItem>
            {categoryTree
              .filter((c) => c.id !== pendingDeleteCat?.id)
              .map((cat) => (
                <MenuItem
                  key={cat.id}
                  selected={migrateTargetId === cat.id}
                  onClick={() => setMigrateTargetId(cat.id)}
                  sx={{ fontSize: 12, borderRadius: 0.5 }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box sx={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color || "text.secondary" }}>
                      {renderCategoryIcon(cat.icon, 12)}
                    </Box>
                    {cat.name}
                  </Box>
                </MenuItem>
              ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button size="small" sx={{ fontSize: 11, textTransform: "none" }} onClick={() => setPendingDeleteCat(null)}>
            取消
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            sx={{ fontSize: 11, textTransform: "none" }}
            onClick={async () => {
              if (!pendingDeleteCat) return;
              const catId = pendingDeleteCat.id;
              const target = migrateTargetId;
              const movedCount = countAllPlugins(pendingDeleteCat);
              await deleteCategoryWithMigrate(catId, target);
              setPendingDeleteCat(null);
              setMigrateTargetId("");
              if (activeCategoryId === catId) {
                setActiveCategoryId(target || "__ungrouped__");
              }
              setSnackbarMsg(`已删除分组并迁移 ${movedCount} 个组件`);
              setSnackbarSeverity("success");
              setSnackbarOpen(true);
            }}
          >
            确认迁移并删除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)} sx={{ fontSize: 12 }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
