import { useState, useEffect, useCallback, useMemo } from "react";
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
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WidgetsIcon from "@mui/icons-material/Widgets";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useComponentStore } from "../store/componentStore";
import { componentRegistry } from "../editor/registry";
import { resolveIcon } from "../editor/plugins";
import { collectPluginTypes, countAllPlugins } from "../utils/componentTree";
import { PluginCard } from "../components/component";
import { CreateCategoryDialog } from "../components/component/CreateCategoryDialog";
import { CategoryDetailDialog } from "../components/component/CategoryDetailDialog";
import { PreviewWindow } from "../components/component/PreviewWindow";
import type { ComponentPluginItem, ComponentCategoryNode } from "../types/component";

function CategoryTreeItem({
  node,
  depth,
  activeId,
  onSelect,
  onContextMenu,
}: {
  node: ComponentCategoryNode;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, node: ComponentCategoryNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = activeId === node.id;
  const pluginCount = countAllPlugins(node);

  return (
    <Box>
      <Box
        onClick={() => onSelect(node.id)}
        onContextMenu={(e) => onContextMenu(e, node)}
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
          bgcolor: isActive ? "action.selected" : "transparent",
          borderLeft: isActive ? 2 : 0,
          borderColor: node.color || "primary.main",
          transition: "all 0.15s",
          "&:hover": {
            bgcolor: isActive ? "action.selected" : "action.hover",
          },
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            sx={{ p: 0, width: 16, height: 16 }}
          >
            {expanded ? (
              <ExpandMoreIcon sx={{ fontSize: 12, color: "text.disabled" }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 12, color: "text.disabled" }} />
            )}
          </IconButton>
        ) : (
          <Box sx={{ width: 16, height: 16, flexShrink: 0 }} />
        )}
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
          {resolveIcon(node.icon, "folder", 12)}
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
      {hasChildren && expanded && (
        <Box>
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </Box>
      )}
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
  const movePluginToCategory = useComponentStore((s) => s.movePluginToCategory);
  const categoryTree = useComponentStore((s) => s.categoryTree);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [windowPreview, setWindowPreview] = useState<{
    plugin: ComponentPluginItem;
    definition: any;
  } | null>(null);

  const definition = useMemo(() => {
    if (!plugin) return null;
    const def = componentRegistry.get(plugin.type);
    console.log("[ComponentDetail] plugin:", plugin?.type, "definition:", def?.type, "all types:", componentRegistry.getAll().map(d => d.type));
    return def;
  }, [plugin]);

  const isMapCad = definition?.type === "map-cad";

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

  const handleMove = async (targetCatId: string) => {
    await movePluginToCategory(plugin.id, targetCatId);
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
        <Box
          sx={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)",
            borderRadius: 1,
            color: "text.secondary",
          }}
        >
          {resolveIcon(plugin.icon, "widgets", 22)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {plugin.name}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
            {plugin.type}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {plugin.description && (
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.25, display: "block" }}>
                描述
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1.5 }}>
                {plugin.description}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.25, display: "block" }}>
                版本
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11 }}>{plugin.version}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.25, display: "block" }}>
                来源
              </Typography>
              <Chip
                label={plugin.builtIn ? "内置" : "自定义"}
                size="small"
                sx={{ fontSize: 9, height: 18 }}
                color={plugin.builtIn ? "primary" : "default"}
                variant="outlined"
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.25, display: "block" }}>
                状态
              </Typography>
              <Chip
                label={plugin.enabled ? "已启用" : "已禁用"}
                size="small"
                sx={{ fontSize: 9, height: 18 }}
                color={plugin.enabled ? "success" : "default"}
                variant="outlined"
              />
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

          {definition?.configSchema && definition.configSchema.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.5, display: "block" }}>
                配置项 ({definition.configSchema.length})
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {definition.configSchema.map((field) => (
                  <Chip
                    key={field.key}
                    label={`${field.label} (${field.type})`}
                    size="small"
                    sx={{ fontSize: 8, height: 16 }}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}

          {definition?.capabilities && (
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.5, display: "block" }}>
                能力
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {Object.entries(definition.capabilities).map(([key, val]) => (
                  <Chip
                    key={key}
                    label={`${key}: ${val ? "✓" : "✗"}`}
                    size="small"
                    sx={{ fontSize: 8, height: 16 }}
                    color={val ? "success" : "default"}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 0.5 }} />

          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10, mb: 0.5, display: "block" }}>
              移动到分组
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {categoryTree
                .filter((cat) => cat.id !== plugin.category)
                .map((cat) => (
                  <Chip
                    key={cat.id}
                    icon={
                      <Box sx={{ width: 12, height: 12, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color || "text.secondary" }}>
                        {resolveIcon(cat.icon, "folder", 8)}
                      </Box>
                    }
                    label={cat.name}
                    size="small"
                    onClick={() => handleMove(cat.id)}
                    sx={{ fontSize: 9, height: 20, cursor: "pointer" }}
                    variant="outlined"
                  />
                ))}
            </Box>
          </Box>
        </Box>
      </Box>

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
              console.log("[Preview] Button clicked, isMapCad:", isMapCad, "definition:", definition?.type);
              if (isMapCad) {
                console.log("[Preview] Opening window preview for:", plugin.type);
                setWindowPreview({ plugin, definition });
              } else {
                console.log("[Preview] Opening dialog preview for:", plugin.type);
                setPreviewOpen(true);
              }
            }}
            sx={{ fontSize: 10, textTransform: "none", flex: 1 }}
          >
            预览
          </Button>
        )}
      </Box>

      {!isMapCad && (
        <ComponentPreviewDialog
          plugin={plugin}
          definition={definition}
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {windowPreview && (
        <PreviewWindow
          plugin={windowPreview.plugin}
          definition={windowPreview.definition}
          onClose={() => setWindowPreview(null)}
        />
      )}
    </Box>
  );
}

function ComponentPreviewDialog({
  plugin,
  definition,
  open,
  onClose,
}: {
  plugin: ComponentPluginItem;
  definition: any;
  open: boolean;
  onClose: () => void;
}) {
  const [Renderer, setRenderer] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(false);

  const isFullPreview = definition?.type === "map-cad";

  useEffect(() => {
    if (!open || !definition) return;
    let cancelled = false;
    setLoading(true);
    componentRegistry.loadRenderer(plugin.type).then((comp) => {
      if (!cancelled && comp) {
        setRenderer(() => comp);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, plugin.type, definition]);

  const defaultConfig = definition?.defaultConfig ?? {};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isFullPreview}
      maxWidth={isFullPreview ? undefined : "sm"}
      fullWidth
      sx={isFullPreview ? { "& .MuiDialog-paper": { borderRadius: 0 } } : { "& .MuiDialog-paper": { borderRadius: 2, minHeight: 400 } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 13, pb: 1 }}>
        {resolveIcon(plugin.icon, "widgets", 16)}
        {plugin.name} - 预览
        {isFullPreview && (
          <Typography variant="caption" sx={{ color: "text.disabled", ml: 1 }}>
            预览模式下数据不会持久化
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, ...(isFullPreview ? { height: "calc(100vh - 48px)" } : {}) }}>
        <Box
          sx={{
            width: "100%",
            height: isFullPreview ? "100%" : 350,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.2)"
                : "rgba(0,0,0,0.02)",
            position: "relative",
          }}
        >
          {loading ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              加载渲染器...
            </Typography>
          ) : Renderer ? (
            <Box
              sx={{
                width: isFullPreview ? "100%" : (definition?.defaultSize?.width ?? 200),
                height: isFullPreview ? "100%" : (definition?.defaultSize?.height ?? 150),
                overflow: "hidden",
              }}
            >
              <Renderer config={defaultConfig} componentId={`preview_${plugin.type}`} mode="preview" />
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              无法加载渲染器
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({
  category,
  open,
  onClose,
}: {
  category: ComponentCategoryNode | null;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const updateCategory = useComponentStore((s) => s.updateCategory);

  useEffect(() => {
    if (category) setName(category.name);
  }, [category]);

  if (!category) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    await updateCategory(category.id, { name: name.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 13, pb: 1 }}>编辑分组</DialogTitle>
      <DialogContent sx={{ pt: "8px !important" }}>
        <TextField
          size="small"
          label="组名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          sx={{ "& .MuiInputBase-input": { fontSize: 12 } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button size="small" onClick={onClose} sx={{ fontSize: 11, textTransform: "none" }}>
          取消
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!name.trim()}
          onClick={handleSave}
          sx={{ fontSize: 11, textTransform: "none" }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ComponentManagementPage() {
  const categoryTree = useComponentStore((s) => s.categoryTree);
  const plugins = useComponentStore((s) => s.plugins);
  const isLoading = useComponentStore((s) => s.isLoading);
  const refresh = useComponentStore((s) => s.refresh);
  const movePluginToCategory = useComponentStore((s) => s.movePluginToCategory);
  const deleteCategory = useComponentStore((s) => s.deleteCategory);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<ComponentPluginItem | null>(null);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [detailCategory, setDetailCategory] = useState<ComponentCategoryNode | null>(null);
  const [editCategory, setEditCategory] = useState<ComponentCategoryNode | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; cat: ComponentCategoryNode } | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (categoryTree.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categoryTree[0].id);
    }
  }, [categoryTree, activeCategoryId]);

  const activeNode = useMemo(() => {
    if (!activeCategoryId) return null;
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
    if (activeNode) {
      const types = collectPluginTypes(activeNode);
      const catKey = activeCategoryId!.replace("ccat_", "");
      const registryDefs = componentRegistry.getByCategory(catKey);
      for (const def of registryDefs) types.add(def.type);
      items = plugins.filter((p) => types.has(p.type));
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
      await movePluginToCategory(plugin.id, targetCatId);
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
    setSelectedPlugin(plugin);
    setDetailPanelOpen(true);
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
            {categoryTree.map((node) => (
              <CategoryTreeItem
                key={node.id}
                node={node}
                depth={0}
                activeId={activeCategoryId}
                onSelect={handleSelectCategory}
                onContextMenu={handleContextMenu}
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
              {activeNode && (
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
                  {resolveIcon(activeNode.icon, "folder", 12)}
                </Box>
              )}
              <Typography variant="caption" sx={{ color: "text.primary", fontSize: 11, fontWeight: 600 }}>
                {activeNode?.name ?? "全部组件"}
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
            {filteredPlugins.length > 0 ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: 1,
                }}
              >
                {filteredPlugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    onMove={handleMovePlugin}
                    allCategories={categoryTree}
                    currentCategoryId={activeCategoryId ?? undefined}
                    onClick={handlePluginClick}
                  />
                ))}
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
          const isBuiltIn =
            cat.id.startsWith("ccat_basic") ||
            cat.id.startsWith("ccat_chart") ||
            cat.id.startsWith("ccat_map") ||
            cat.id.startsWith("ccat_media") ||
            cat.id.startsWith("ccat_decoration");
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
                  setEditCategory(cat);
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
        category={editCategory}
        open={!!editCategory}
        onClose={() => setEditCategory(null)}
      />
    </Box>
  );
}
