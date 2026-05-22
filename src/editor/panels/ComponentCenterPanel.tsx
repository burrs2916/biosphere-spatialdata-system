import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { componentRegistry } from "../registry";
import { useComponentStore } from "../../store/componentStore";
import { PanelWrapper } from "../components/PanelWrapper";
import { resolveIcon } from "../plugins";
import { ComponentGridCard } from "../../components/component";
import { CreateCategoryDialog } from "../../components/component/CreateCategoryDialog";
import { CategoryDetailDialog } from "../../components/component/CategoryDetailDialog";
import type { ComponentPluginItem, ComponentCategoryNode } from "../../types/component";
import { collectPluginTypes } from "../../utils/componentTree";
import WidgetsIcon from "@mui/icons-material/Widgets";
import ExtensionIcon from "@mui/icons-material/Extension";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronRightIcon2 from "@mui/icons-material/ChevronRight";
import InputAdornment from "@mui/material/InputAdornment";

interface ComponentCenterPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

function ComponentLibraryTab() {
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const categoryTree = useComponentStore((s) => s.categoryTree);
  const refresh = useComponentStore((s) => s.refresh);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const tabItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (categoryTree.length > 0 && !activeCategory) {
      setActiveCategory(categoryTree[0].id);
    }
  }, [categoryTree, activeCategory]);

  const activeNode = categoryTree.find((n) => n.id === activeCategory);

  const allDefinitionsForCategory = React.useMemo(() => {
    if (!activeNode) return componentRegistry.getByCategory(activeCategory);

    const types = collectPluginTypes(activeNode);
    const catKey = activeCategory.replace("ccat_", "");
    const registryDefs = componentRegistry.getByCategory(catKey);
    for (const def of registryDefs) {
      types.add(def.type);
    }

    return componentRegistry.getAll().filter((d) => types.has(d.type));
  }, [activeNode, activeCategory]);

  const filteredDefinitions = allDefinitionsForCategory.filter((def) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      def.name.toLowerCase().includes(q) ||
      def.type.toLowerCase().includes(q) ||
      (def.description || "").toLowerCase().includes(q)
    );
  });

  const switchToCategory = useCallback(
    (direction: "left" | "right") => {
      const rootIds = categoryTree.map((n) => n.id);
      const currentIndex = rootIds.indexOf(activeCategory);
      let nextIndex: number;
      if (direction === "left") {
        nextIndex = Math.max(0, currentIndex - 1);
      } else {
        nextIndex = Math.min(rootIds.length - 1, currentIndex + 1);
      }
      const nextCategory = rootIds[nextIndex];
      if (nextCategory === activeCategory) return;
      setActiveCategory(nextCategory);
      requestAnimationFrame(() => {
        const tabEl = tabItemRefs.current.get(nextCategory);
        if (tabEl) {
          tabEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      });
    },
    [categoryTree, activeCategory]
  );

  const rootCategories = categoryTree;
  const rootIds = rootCategories.map((n) => n.id);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 1, py: 0.5, flexShrink: 0 }}>
        <TextField
          size="small"
          placeholder="搜索组件..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{ "& .MuiInputBase-input": { fontSize: 11, py: 0.5 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {rootIds.indexOf(activeCategory) > 0 && (
          <IconButton
            size="small"
            onClick={() => switchToCategory("left")}
            sx={{ flexShrink: 0, width: 20, height: 20, mx: 0.25 }}
          >
            <ChevronLeftIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
        <Box
          ref={tabScrollRef}
          sx={{
            display: "flex",
            flex: 1,
            overflowX: "auto",
            "&::-webkit-scrollbar": { height: 0 },
            px: 0.5,
          }}
        >
          {rootCategories.map((cat) => (
            <Box
              key={cat.id}
              ref={(el: any) => {
                if (el) tabItemRefs.current.set(cat.id, el as HTMLDivElement);
              }}
              onClick={() => setActiveCategory(cat.id)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                px: 1,
                py: 0.5,
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontSize: 10,
                fontWeight: activeCategory === cat.id ? 600 : 400,
                color: activeCategory === cat.id ? cat.color || "primary.main" : "text.secondary",
                borderBottom: activeCategory === cat.id ? 2 : 0,
                borderColor: cat.color || "primary.main",
                transition: "all 0.15s",
                flexShrink: 0,
                "&:hover": {
                  color: cat.color || "primary.main",
                  backgroundColor: (theme: any) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.02)",
                },
              }}
            >
              {resolveIcon(cat.icon, "category", 12)}
              {cat.name}
            </Box>
          ))}
        </Box>
        {rootIds.indexOf(activeCategory) < rootIds.length - 1 && (
          <IconButton
            size="small"
            onClick={() => switchToCategory("right")}
            sx={{ flexShrink: 0, width: 20, height: 20, mx: 0.25 }}
          >
            <ChevronRightIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>

      <Box
        sx={{
          px: 1,
          py: 0.25,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
          {activeNode?.name || activeCategory}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 9 }}>
          {filteredDefinitions.length} 个组件
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          px: 1,
          pb: 1,
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { borderRadius: 2 },
        }}
      >
        {filteredDefinitions.length > 0 ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 0.75,
            }}
          >
            {filteredDefinitions.map((def) => (
              <ComponentGridCard key={def.type} definition={def} />
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
            <Typography variant="caption">
              {search ? "未找到匹配的组件" : "暂无组件"}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function PluginManagerTab() {
  const categoryTree = useComponentStore((s) => s.categoryTree);
  const plugins = useComponentStore((s) => s.plugins);
  const isLoading = useComponentStore((s) => s.isLoading);
  const refresh = useComponentStore((s) => s.refresh);
  const movePluginToCategory = useComponentStore((s) => s.movePluginToCategory);
  const deleteCategory = useComponentStore((s) => s.deleteCategory);

  const [detailCategory, setDetailCategory] = useState<ComponentCategoryNode | null>(null);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; cat: ComponentCategoryNode } | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDeleteCategory = async (catId: string) => {
    setCtxMenu(null);
    await deleteCategory(catId);
  };

  const handleContextMenu = (e: React.MouseEvent, cat: ComponentCategoryNode) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, cat });
  };

  const handleMovePlugin = async (plugin: ComponentPluginItem, targetCatId: string) => {
    await movePluginToCategory(plugin.id, targetCatId);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          加载中...
        </Typography>
      </Box>
    );
  }

  const totalPlugins = plugins.length;
  const enabledCount = plugins.filter((p) => p.enabled).length;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 1.5, pb: 0.5, flexShrink: 0 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
          {categoryTree.length} 个分组 · {totalPlugins} 个组件 · 已启用 {enabledCount}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          px: 1,
          pb: 1,
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": { borderRadius: 2 },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {categoryTree.map((cat) => {
            return (
              <Box
                key={cat.id}
                onClick={() => setDetailCategory(cat)}
                onContextMenu={(e) => handleContextMenu(e, cat)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1,
                  borderRadius: 1,
                  border: 1,
                  borderColor: "divider",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  "&:hover": {
                    borderColor: cat.color || "primary.main",
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 0.75,
                    flexShrink: 0,
                    backgroundColor: cat.color
                      ? `${cat.color}18`
                      : "rgba(255,255,255,0.06)",
                    color: cat.color || "text.secondary",
                  }}
                >
                  {resolveIcon(cat.icon, "folder", 18)}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: "text.primary", display: "block", lineHeight: 1.3 }}>
                    {cat.name}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled", mt: 0.25, display: "block" }}>
                    {cat.plugins.length} 个组件
                  </Typography>
                </Box>
                <ChevronRightIcon2 sx={{ fontSize: 14, color: "text.disabled" }} />
              </Box>
            );
          })}
        </Box>
        {categoryTree.length === 0 && (
          <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
            <Typography variant="caption">暂无分组</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: "divider", flexShrink: 0 }}>
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

      <Menu
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
          const hasPlugins = cat.plugins.length > 0;

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
      </Menu>

      <CategoryDetailDialog
        category={detailCategory}
        open={!!detailCategory}
        onClose={() => setDetailCategory(null)}
        onMovePlugin={handleMovePlugin}
        allCategories={categoryTree}
      />

      <CreateCategoryDialog
        open={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
        categoryCount={categoryTree.length}
      />
    </Box>
  );
}

export function ComponentCenterPanel({
  collapsed,
  onToggle,
}: ComponentCenterPanelProps) {
  const [activeTab, setActiveTab] = useState<"library" | "plugins">("library");

  return (
    <PanelWrapper
      collapsed={collapsed}
      onToggle={onToggle}
      width={260}
      position="left"
    >
      <Box
        sx={{
          width: "100%",
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
            borderBottom: 1,
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Box
            onClick={() => setActiveTab("library")}
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5,
              py: 0.75,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: activeTab === "library" ? 600 : 400,
              color: activeTab === "library" ? "primary.main" : "text.secondary",
              borderBottom: activeTab === "library" ? 2 : 0,
              borderColor: "primary.main",
              transition: "all 0.15s",
              "&:hover": {
                color: "primary.main",
                backgroundColor: (theme: any) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.02)",
              },
            }}
          >
            <WidgetsIcon sx={{ fontSize: 13 }} />
            组件库
          </Box>
          <Box
            onClick={() => setActiveTab("plugins")}
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5,
              py: 0.75,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: activeTab === "plugins" ? 600 : 400,
              color: activeTab === "plugins" ? "primary.main" : "text.secondary",
              borderBottom: activeTab === "plugins" ? 2 : 0,
              borderColor: "primary.main",
              transition: "all 0.15s",
              "&:hover": {
                color: "primary.main",
                backgroundColor: (theme: any) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.02)",
              },
            }}
          >
            <ExtensionIcon sx={{ fontSize: 13 }} />
            分组管理
          </Box>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {activeTab === "library" ? (
            <ComponentLibraryTab />
          ) : (
            <PluginManagerTab />
          )}
        </Box>
      </Box>
    </PanelWrapper>
  );
}
