import { useEffect, useCallback, useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PublishIcon from "@mui/icons-material/Publish";
import UnpublishedIcon from "@mui/icons-material/Unpublished";
import ArchitectureIcon from "@mui/icons-material/Architecture";
import MapIcon from "@mui/icons-material/Map";
import WallpaperIcon from "@mui/icons-material/Wallpaper";
import PublicIcon from "@mui/icons-material/Public";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useMapLibraryStore } from "../store/mapLibraryStore";
import type { MapLibrary, MapLibraryGroup, MapLibraryType, MapLibraryStatus } from "../types/mapLibrary";
import { MAP_LIBRARY_TYPE_LABELS, MAP_LIBRARY_STATUS_LABELS } from "../types/mapLibrary";
import type { ParseResult, CadDocument } from "../editor/cad/types";
import { logger } from "../utils/logger";
import { openEditorWindow, openMapPreviewWindow } from "../utils/previewWindow";
import { open } from "@tauri-apps/plugin-dialog";

const TYPE_ICONS: Record<MapLibraryType, React.ReactElement> = {
  cad: <ArchitectureIcon />,
  tile: <MapIcon />,
  blueprint: <WallpaperIcon />,
  globe: <PublicIcon />,
  heatmap: <WhatshotIcon />,
};

const STATUS_COLORS: Record<MapLibraryStatus, "default" | "primary" | "success" | "warning" | "error"> = {
  draft: "default",
  published: "success",
  archived: "warning",
};

const MAP_TYPES: MapLibraryType[] = ["cad", "tile", "blueprint", "globe", "heatmap"];

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("zh-CN");
}

export default function MapLibraryPage() {
  const libraries = useMapLibraryStore((s) => s.libraries);
  const groups = useMapLibraryStore((s) => s.groups);
  const isLoading = useMapLibraryStore((s) => s.isLoading);
  const error = useMapLibraryStore((s) => s.error);
  const activeLibraryId = useMapLibraryStore((s) => s.activeLibraryId);
  const activeTypeFilter = useMapLibraryStore((s) => s.activeTypeFilter);
  const loadLibraries = useMapLibraryStore((s) => s.loadLibraries);
  const loadGroups = useMapLibraryStore((s) => s.loadGroups);
  const deleteLibrary = useMapLibraryStore((s) => s.deleteLibrary);
  const publishLibrary = useMapLibraryStore((s) => s.publishLibrary);
  const unpublishLibrary = useMapLibraryStore((s) => s.unpublishLibrary);
  const setActiveLibraryId = useMapLibraryStore((s) => s.setActiveLibraryId);
  const setActiveTypeFilter = useMapLibraryStore((s) => s.setActiveTypeFilter);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [preselectedGroupId, setPreselectedGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MapLibraryGroup | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingLibraryId, setMovingLibraryId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<MapLibraryGroup | null>(null);

  const deleteGroup = useMapLibraryStore((s) => s.deleteGroup);

  const currentType = activeTypeFilter || "cad";

  useEffect(() => {
    loadLibraries();
    loadGroups(currentType);
  }, [loadLibraries, loadGroups, currentType]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("library-updated", () => {
        loadLibraries();
        loadGroups(currentType);
      }).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, [loadLibraries, loadGroups, currentType]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
    setActiveTypeFilter(newValue as MapLibraryType);
    setActiveLibraryId(null);
  };

  const handleCreateNew = useCallback((groupId?: string | null) => {
    setPreselectedGroupId(groupId ?? null);
    setCreateDialogOpen(true);
  }, []);

  const handleDelete = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name });
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const label = `editor-${deleteTarget.id}`;
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) return;
    } catch {}
    await deleteLibrary(deleteTarget.id);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }, [deleteTarget, deleteLibrary]);

  const handleTogglePublish = useCallback(async (lib: MapLibrary) => {
    if (lib.status === "published") {
      await unpublishLibrary(lib.id);
    } else {
      await publishLibrary(lib.id);
    }
  }, [publishLibrary, unpublishLibrary]);

  const handleOpenGroupDialog = (group?: MapLibraryGroup) => {
    setEditingGroup(group || null);
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = useCallback((group: MapLibraryGroup) => {
    setDeleteGroupTarget(group);
    setDeleteGroupConfirmOpen(true);
  }, []);

  const handleConfirmDeleteGroup = useCallback(async () => {
    if (!deleteGroupTarget) return;
    await deleteGroup(deleteGroupTarget.id);
    setDeleteGroupConfirmOpen(false);
    setDeleteGroupTarget(null);
  }, [deleteGroupTarget, deleteGroup]);

  const handleOpenMoveDialog = (libraryId: string) => {
    setMovingLibraryId(libraryId);
    setMoveDialogOpen(true);
  };

  const filteredLibraries = libraries.filter((l) => l.mapType === currentType);
  const currentGroups = groups.filter((g) => g.mapType === currentType);

  const groupedLibraries = useMemo(() => {
    const map = new Map<string | null, MapLibrary[]>();
    map.set(null, []);
    for (const g of currentGroups) {
      map.set(g.id, []);
    }
    for (const lib of filteredLibraries) {
      const gid = lib.groupId || null;
      if (!map.has(gid)) {
        map.set(gid, []);
      }
      map.get(gid)!.push(lib);
    }
    return map;
  }, [filteredLibraries, currentGroups]);

  const activeLibrary = libraries.find((l) => l.id === activeLibraryId);

  return (
    <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
              图库管理
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 500 }}>
              管理和编辑各类地图资源，处理完成后发布供组件使用
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="刷新数据">
              <IconButton
                onClick={() => { loadLibraries(); loadGroups(currentType); }}
                size="small"
                sx={{ border: 1, borderColor: "divider" }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<CreateNewFolderIcon />}
              onClick={() => handleOpenGroupDialog()}
              size="small"
              sx={{ borderRadius: 2, textTransform: "none" }}
            >
              新建图库
            </Button>
          </Box>
        </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => useMapLibraryStore.setState({ error: null })}>
          {error}
        </Alert>
      )}

      <Tabs
        value={currentType}
        onChange={handleTabChange}
        sx={{ 
          mb: 3,
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 500,
            minHeight: 48,
          }
        }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {MAP_TYPES.map((type) => (
          <Tab
            key={type}
            value={type}
            label={MAP_LIBRARY_TYPE_LABELS[type]}
            icon={TYPE_ICONS[type]}
            iconPosition="start"
            disabled={type === "globe" || type === "heatmap"}
          />
        ))}
      </Tabs>

      <Box sx={{ display: "flex", gap: 2, minHeight: "calc(100vh - 280px)" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isLoading && libraries.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : currentGroups.length === 0 && filteredLibraries.length === 0 ? (
            <Card sx={{ textAlign: "center", py: 6, px: 4 }}>
              <CardContent>
                <FolderOpenIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  暂无{MAP_LIBRARY_TYPE_LABELS[currentType]}
                </Typography>
                <Typography variant="body2" color="text.disabled" sx={{ mt: 1, mb: 3 }}>
                  先创建图库，然后在图库中导入地图资源
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CreateNewFolderIcon />}
                  onClick={() => handleOpenGroupDialog()}
                >
                  新建图库
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {currentGroups.map((group) => {
                const groupLibs = groupedLibraries.get(group.id) || [];
                return (
                  <Card
                    key={group.id}
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      },
                    }}
                  >
                    {/* 图库头部 */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 2.5,
                        py: 1.8,
                        bgcolor: "grey.50",
                        borderBottom: expandedGroups.has(group.id) ? "1px solid" : "none",
                        borderColor: "divider",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                        "&:hover": {
                          bgcolor: "grey.100",
                        },
                      }}
                      onClick={() => toggleGroupExpand(group.id)}
                    >
                      {expandedGroups.has(group.id) ? (
                        <ExpandMoreIcon fontSize="small" color="action" />
                      ) : (
                        <ChevronRightIcon fontSize="small" color="action" />
                      )}
                      <CreateNewFolderIcon fontSize="small" color="primary" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, fontSize: "0.95rem" }}>
                        {group.name}
                      </Typography>
                      <Chip 
                        label={`${groupLibs.length} 个资源`} 
                        size="small" 
                        color="primary"
                        variant="outlined"
                        sx={{ 
                          height: 24,
                          "& .MuiChip-label": { px: 1, fontSize: "0.75rem" }
                        }}
                      />
                      {group.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                          {group.description}
                        </Typography>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={(e) => { e.stopPropagation(); handleCreateNew(group.id); }}
                        sx={{ 
                          ml: 1, 
                          borderRadius: 2,
                          textTransform: "none",
                          fontSize: "0.8rem",
                        }}
                      >
                        导入资源
                      </Button>
                      <Tooltip title="编辑图库" placement="top">
                        <IconButton 
                          size="small" 
                          onClick={(e) => { e.stopPropagation(); handleOpenGroupDialog(group); }}
                          sx={{ 
                            p: 0.5,
                            "&:hover": { bgcolor: "action.hover" }
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={groupLibs.length > 0 ? "图库内有资源，无法删除" : "删除图库"} placement="top">
                        <span onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={groupLibs.length > 0}
                            onClick={(e) => { e.stopPropagation(); if (groupLibs.length === 0) handleDeleteGroup(group); }}
                            sx={{ 
                              p: 0.5,
                              bgcolor: "error.lighter",
                              border: "1px solid",
                              borderColor: "error.light",
                              "&:hover": { 
                                bgcolor: "error.light",
                                transform: "scale(1.05)",
                              },
                              "&.Mui-disabled": { opacity: 0.3 },
                              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                    {/* 图库内容（可收起） */}
                    {expandedGroups.has(group.id) && (
                      <Box sx={{ p: 2.5, bgcolor: "background.paper" }}>
                      {groupLibs.length === 0 ? (
                        <Box sx={{ 
                          textAlign: "center", 
                          py: 4,
                          px: 2,
                          borderRadius: 2,
                          border: "1px dashed",
                          borderColor: "divider",
                          bgcolor: "grey.50",
                        }}>
                          <FolderOpenIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1.5, opacity: 0.5 }} />
                          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                            此图库暂无地图资源
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            sx={{ 
                              borderRadius: 2,
                              textTransform: "none",
                              borderStyle: "dashed",
                            }}
                            onClick={() => handleCreateNew(group.id)}
                          >
                            导入第一个资源
                          </Button>
                        </Box>
                      ) : (
                        <LibraryCardGrid
                          libraries={groupLibs}
                          activeLibraryId={activeLibraryId}
                          onSelect={setActiveLibraryId}
                          onTogglePublish={handleTogglePublish}
                          onDelete={handleDelete}
                          onMove={handleOpenMoveDialog}
                        />
                      )}
                    </Box>
                  )}
                  </Card>
                );
              })}

              {(() => {
                const UNGROUPED_ID = "__ungrouped__";
                const ungrouped = groupedLibraries.get(null) || [];
                if (ungrouped.length === 0) return null;
                return (
                  <Card
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 2.5,
                        py: 1.8,
                        bgcolor: "grey.50",
                        borderBottom: expandedGroups.has(UNGROUPED_ID) ? "1px solid" : "none",
                        borderColor: "divider",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                        "&:hover": {
                          bgcolor: "grey.100",
                        },
                      }}
                      onClick={() => toggleGroupExpand(UNGROUPED_ID)}
                    >
                      {expandedGroups.has(UNGROUPED_ID) ? (
                        <ExpandMoreIcon fontSize="small" color="action" />
                      ) : (
                        <ChevronRightIcon fontSize="small" color="action" />
                      )}
                      <FolderOpenIcon fontSize="small" color="action" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        未分组
                      </Typography>
                      <Chip 
                        label={`${ungrouped.length} 个资源`} 
                        size="small" 
                        color="default"
                        variant="outlined"
                        sx={{ 
                          height: 24,
                          "& .MuiChip-label": { px: 1, fontSize: "0.75rem" }
                        }}
                      />
                    </Box>
                    {expandedGroups.has(UNGROUPED_ID) && (
                      <Box sx={{ p: 2.5, bgcolor: "background.paper" }}>
                        <LibraryCardGrid
                          libraries={ungrouped}
                          activeLibraryId={activeLibraryId}
                          onSelect={setActiveLibraryId}
                          onTogglePublish={handleTogglePublish}
                          onDelete={handleDelete}
                          onMove={handleOpenMoveDialog}
                        />
                      </Box>
                    )}
                  </Card>
                );
              })()}
            </Box>
          )}
        </Box>

        {/* 右侧详情面板：始终显示，未选择时展示引导 */}
        <Box sx={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column" }}>
          {activeLibrary ? (
            <LibraryDetailPanel library={activeLibrary} onTogglePublish={() => handleTogglePublish(activeLibrary)} />
          ) : (
            <Card
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                py: 10,
                px: 4,
                borderRadius: 3,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                bgcolor: "background.paper",
                border: "2px dashed",
                borderColor: "divider",
              }}
            >
              <Box sx={{ mb: 3, opacity: 0.4 }}>
                <VisibilityIcon sx={{ fontSize: 80 }} color="disabled" />
              </Box>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                选择资源查看详情
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ lineHeight: 1.6, maxWidth: 260 }}>
                在左侧列表中选择一个地图资源，此处将展示其详细信息、发布状态及操作入口
              </Typography>
              <Box sx={{ mt: 4, display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                <Chip 
                  label={currentType ? MAP_LIBRARY_TYPE_LABELS[currentType] : "全部"} 
                  size="small" 
                  variant="outlined"
                  sx={{ height: 24, "& .MuiChip-label": { px: 1, fontSize: "0.75rem" } }}
                />
                <Chip 
                  label={`${filteredLibraries.length} 个资源`} 
                  size="small" 
                  variant="outlined"
                  sx={{ height: 24, "& .MuiChip-label": { px: 1, fontSize: "0.75rem" } }}
                />
              </Box>
            </Card>
          )}
        </Box>
      </Box>

      <CreateLibraryDialog
        open={createDialogOpen}
        preselectedGroupId={preselectedGroupId}
        currentType={currentType}
        onClose={() => { setCreateDialogOpen(false); setPreselectedGroupId(null); }}
        onCreated={(id) => {
          setCreateDialogOpen(false);
          setPreselectedGroupId(null);
          setActiveLibraryId(id);
        }}
      />

      <GroupDialog
        open={groupDialogOpen}
        group={editingGroup}
        mapType={currentType}
        onClose={() => { setGroupDialogOpen(false); setEditingGroup(null); }}
      />

      <MoveLibraryDialog
        open={moveDialogOpen}
        libraryId={movingLibraryId}
        groups={currentGroups}
        onClose={() => { setMoveDialogOpen(false); setMovingLibraryId(null); }}
      />

      <Dialog 
        open={deleteConfirmOpen} 
        onClose={() => setDeleteConfirmOpen(false)} 
        maxWidth="xs" 
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }
          }
        }}
      >
        <DialogTitle sx={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 1,
          pb: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
            确认删除
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 2 }}>
          <Typography variant="body1" sx={{ mb: 1 }}>
            确定要删除地图资源 <strong>"{deleteTarget?.name}"</strong> 吗？
          </Typography>
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {deleteTarget?.name} 的所有数据将被永久删除，此操作不可恢复。
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
          <Button 
            onClick={() => setDeleteConfirmOpen(false)}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            取消
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleConfirmDelete} 
            startIcon={<DeleteIcon />}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 500 }}
          >
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={deleteGroupConfirmOpen} 
        onClose={() => setDeleteGroupConfirmOpen(false)} 
        maxWidth="xs" 
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }
          }
        }}
      >
        <DialogTitle sx={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 1,
          pb: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
            确认删除图库
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 2 }}>
          <Typography variant="body1" sx={{ mb: 1.5 }}>
            确定要删除图库 <strong>"{deleteGroupTarget?.name}"</strong> 吗？
          </Typography>
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            图库内的地图资源将变为未分组状态，不会被删除。
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
          <Button 
            onClick={() => setDeleteGroupConfirmOpen(false)}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            取消
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleConfirmDeleteGroup} 
            startIcon={<DeleteIcon />}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 500 }}
          >
            确认删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function LibraryCardGrid({
  libraries,
  activeLibraryId,
  onSelect,
  onTogglePublish,
  onDelete,
  onMove,
}: {
  libraries: MapLibrary[];
  activeLibraryId: string | null;
  onSelect: (id: string) => void;
  onTogglePublish: (lib: MapLibrary) => void;
  onDelete: (id: string, name: string) => void;
  onMove: (id: string) => void;
}) {
  const [openWindowIds, setOpenWindowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const ids = new Set<string>();
        for (const lib of libraries) {
          const editorWin = await WebviewWindow.getByLabel(`editor-${lib.id}`);
          if (editorWin) { ids.add(lib.id); continue; }
          const previewWin = await WebviewWindow.getByLabel(`map-preview-${lib.id}`);
          if (previewWin) { ids.add(lib.id); }
        }
        if (!cancelled) setOpenWindowIds(ids);
      } catch {}
    };
    check();
    const timer = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [libraries]);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 2.5 }}>
      {libraries.map((lib) => (
        <Card
          key={lib.id}
          sx={{
            cursor: "pointer",
            borderRadius: 3,
            boxShadow: activeLibraryId === lib.id 
              ? "0 4px 16px rgba(25, 118, 210, 0.15)" 
              : "0 1px 3px rgba(0,0,0,0.08)",
            border: activeLibraryId === lib.id ? "2px solid" : "2px solid transparent",
            borderColor: activeLibraryId === lib.id ? "primary.main" : "transparent",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": { 
              boxShadow: activeLibraryId === lib.id 
                ? "0 6px 20px rgba(25, 118, 210, 0.25)" 
                : "0 4px 12px rgba(0,0,0,0.12)",
              transform: "translateY(-2px)",
            },
          }}
          onClick={() => onSelect(lib.id)}
        >
          <CardContent sx={{ p: 2.5, pb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5 }}>
              <Box sx={{ 
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: "primary.lighter",
                flexShrink: 0,
              }}>
                {TYPE_ICONS[lib.mapType]}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.4, mb: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lib.name}
                </Typography>
                <Chip
                  label={MAP_LIBRARY_STATUS_LABELS[lib.status]}
                  color={STATUS_COLORS[lib.status]}
                  size="small"
                  variant={lib.status === "draft" ? "outlined" : "filled"}
                  sx={{ 
                    height: 20,
                    "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem", fontWeight: 500 }
                  }}
                />
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 0.5, mb: 1, flexWrap: "wrap" }}>
              {lib.sourceFormat && <Chip label={lib.sourceFormat.toUpperCase()} size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" } }} />}
              {lib.entityCount > 0 && <Chip label={`${lib.entityCount} 实体`} size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" } }} />}
            </Box>
            {lib.description && (
              <Typography variant="body2" color="text.secondary" sx={{ 
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                display: "-webkit-box", 
                WebkitLineClamp: 2, 
                WebkitBoxOrient: "vertical",
                fontSize: "0.8rem",
                lineHeight: 1.5,
                mb: 1,
              }}>
                {lib.description}
              </Typography>
            )}
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", fontSize: "0.7rem" }}>
              {formatDate(lib.createdAt)}
            </Typography>
          </CardContent>
          <CardActions sx={{ pt: 0, pb: 1.5, px: 2, justifyContent: "flex-end", gap: 0.5 }}>
            <Tooltip title={lib.status === "published" ? "已发布，无法移动" : "移动到图库"} placement="top">
              <span>
                <IconButton 
                  size="small" 
                  color="info"
                  disabled={lib.status === "published"}
                  onClick={(e) => { e.stopPropagation(); onMove(lib.id); }}
                  sx={{ 
                    p: 0.5,
                    bgcolor: "info.lighter",
                    border: "1px solid",
                    borderColor: "info.light",
                    "&:hover": { 
                      bgcolor: "info.light",
                      transform: "scale(1.05)",
                    },
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <DriveFileMoveIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={lib.status === "published" ? "取消发布" : "发布"} placement="top">
              <IconButton
                size="small"
                color={lib.status === "published" ? "success" : "primary"}
                onClick={(e) => { e.stopPropagation(); onTogglePublish(lib); }}
                sx={{ 
                  p: 0.5,
                  bgcolor: lib.status === "published" ? "success.lighter" : "primary.lighter",
                  border: "1px solid",
                  borderColor: lib.status === "published" ? "success.light" : "primary.light",
                  "&:hover": { 
                    bgcolor: lib.status === "published" ? "success.light" : "primary.light",
                    transform: "scale(1.05)",
                  },
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {lib.status === "published" ? <UnpublishedIcon fontSize="small" /> : <PublishIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={lib.status === "published" ? "已发布，无法删除" : openWindowIds.has(lib.id) ? "正在编辑/预览中，无法删除" : "删除"} placement="top">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={lib.status === "published" || openWindowIds.has(lib.id)}
                  onClick={(e) => { e.stopPropagation(); onDelete(lib.id, lib.name); }}
                  sx={{ 
                    p: 0.5,
                    bgcolor: "error.lighter",
                    border: "1px solid",
                    borderColor: "error.light",
                    "&:hover": { 
                      bgcolor: "error.light",
                      transform: "scale(1.05)",
                    },
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </CardActions>
        </Card>
      ))}
    </Box>
  );
}

function GroupDialog({
  open,
  group,
  mapType,
  onClose,
}: {
  open: boolean;
  group: MapLibraryGroup | null;
  mapType: MapLibraryType;
  onClose: () => void;
}) {
  const createGroup = useMapLibraryStore((s) => s.createGroup);
  const updateGroup = useMapLibraryStore((s) => s.updateGroup);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(group?.name || "");
      setDescription(group?.description || "");
    }
  }, [open, group]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (group) {
        await updateGroup(group.id, name, description || null);
      } else {
        await createGroup(name, description || null, mapType);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {group ? "编辑图库" : "新建图库"}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          label="图库名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2, mt: 1 }}
          required
          autoFocus
        />
        <TextField
          label="描述（可选）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          size="small"
          multiline
          rows={2}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "保存中..." : group ? "保存" : "创建"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MoveLibraryDialog({
  open,
  libraryId,
  groups,
  onClose,
}: {
  open: boolean;
  libraryId: string | null;
  groups: MapLibraryGroup[];
  onClose: () => void;
}) {
  const moveLibraryToGroup = useMapLibraryStore((s) => s.moveLibraryToGroup);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedGroupId("");
    }
  }, [open]);

  const handleMove = async () => {
    if (!libraryId) return;
    setMoving(true);
    try {
      await moveLibraryToGroup(libraryId, selectedGroupId || null);
      onClose();
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        pb: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
          移动到图库
        </Typography>
        <IconButton 
          size="small" 
          onClick={onClose}
          sx={{ 
            p: 0.5,
            "&:hover": { bgcolor: "action.hover" }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5, pb: 2 }}>
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel>选择图库</InputLabel>
          <Select
            value={selectedGroupId}
            label="选择图库"
            onChange={(e) => setSelectedGroupId(e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            <MenuItem value="">
              <em>未分组</em>
            </MenuItem>
            {groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
        <Button 
          variant="outlined"
          onClick={onClose}
          sx={{ 
            borderRadius: 2, 
            textTransform: "none",
            borderColor: "grey.300",
            color: "text.secondary",
            bgcolor: "grey.50",
            "&:hover": { 
              bgcolor: "grey.100",
              borderColor: "grey.400",
              transform: "scale(1.02)",
            },
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          取消
        </Button>
        <Button 
          variant="contained" 
          color="info"
          onClick={handleMove} 
          disabled={moving}
          sx={{ 
            borderRadius: 2, 
            textTransform: "none", 
            fontWeight: 500,
            "&:hover": { 
              transform: "scale(1.02)",
            },
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {moving ? "移动中..." : "确定"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CreateLibraryDialog({
  open,
  preselectedGroupId,
  currentType,
  onClose,
  onCreated,
}: {
  open: boolean;
  preselectedGroupId: string | null;
  currentType: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [step, setStep] = useState<"type" | "form">("type");
  const [selectedType, setSelectedType] = useState<MapLibraryType | null>(null);

  // 当通过图库卡片内"导入资源"打开时，自动跳过类型选择
  useEffect(() => {
    if (open && preselectedGroupId && currentType) {
      setSelectedType(currentType as MapLibraryType);
      setStep("form");
    }
  }, [open, preselectedGroupId, currentType]);

  // 关闭时重置状态
  const handleReset = () => {
    setStep("type");
    setSelectedType(null);
  };

  const handleTypeSelect = (type: MapLibraryType) => {
    setSelectedType(type);
    setStep("form");
  };

  const handleBack = () => {
    // 如果是从图库卡片内进入（跳过类型选择），返回时直接关闭对话框
    if (preselectedGroupId) {
      handleReset();
      onClose();
    } else {
      setStep("type");
      setSelectedType(null);
    }
  };

  const handleCreated = (id: string) => {
    handleReset();
    onCreated(id);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        pb: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
          {step === "type"
            ? "导入资源 - 选择类型"
            : `导入${selectedType ? MAP_LIBRARY_TYPE_LABELS[selectedType] : ""}资源`}
        </Typography>
        <IconButton 
          size="small" 
          onClick={handleClose}
          sx={{ 
            p: 0.5,
            "&:hover": { bgcolor: "action.hover" }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5, pb: 2 }}>
        {step === "type" ? (
          <TypeSelector onSelect={handleTypeSelect} />
        ) : selectedType === "cad" ? (
          <CadImportForm groupId={preselectedGroupId} onBack={handleBack} onCreated={handleCreated} />
        ) : selectedType === "tile" ? (
          <TileMapForm groupId={preselectedGroupId} onBack={handleBack} onCreated={handleCreated} />
        ) : selectedType === "blueprint" ? (
          <BlueprintForm groupId={preselectedGroupId} onBack={handleBack} onCreated={handleCreated} />
        ) : (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography color="text.secondary">该类型暂未实现</Typography>
            <Button sx={{ mt: 2, borderRadius: 2, textTransform: "none" }} onClick={handleBack}>返回选择</Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TypeSelector({ onSelect }: { onSelect: (type: MapLibraryType) => void }) {
  const types: { type: MapLibraryType; icon: React.ReactElement; desc: string }[] = [
    { type: "cad", icon: <ArchitectureIcon sx={{ fontSize: 40 }} />, desc: "导入 DWG/DXF 文件，解析为 .cadbin 二进制并支持渲染编辑、发布为 GIS 矢量地图" },
    { type: "tile", icon: <MapIcon sx={{ fontSize: 40 }} />, desc: "配置瓦片地图服务（天地图、高德、OSM 等）" },
    { type: "blueprint", icon: <WallpaperIcon sx={{ fontSize: 40 }} />, desc: "导入图片并配准地理坐标，叠加到地图上" },
    { type: "globe", icon: <PublicIcon sx={{ fontSize: 40 }} />, desc: "配置三维地球影像和地形服务（即将支持）" },
    { type: "heatmap", icon: <WhatshotIcon sx={{ fontSize: 40 }} />, desc: "导入数据点生成热力图（即将支持）" },
  ];

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2.5, pt: 1 }}>
      {types.map(({ type, icon, desc }) => (
        <Card
          key={type}
          sx={{
            cursor: type === "globe" || type === "heatmap" ? "not-allowed" : "pointer",
            borderRadius: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            opacity: type === "globe" || type === "heatmap" ? 0.5 : 1,
            pointerEvents: type === "globe" || type === "heatmap" ? "none" : "auto",
            "&:hover": {
              boxShadow: type === "globe" || type === "heatmap" ? "0 1px 3px rgba(0,0,0,0.08)" : "0 4px 12px rgba(0,0,0,0.12)",
              transform: type === "globe" || type === "heatmap" ? "none" : "translateY(-2px)",
            },
          }}
          onClick={() => onSelect(type)}
        >
          <CardContent sx={{ textAlign: "center", py: 3.5, px: 2.5 }}>
            <Box sx={{ 
              color: "primary.main",
              mb: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: "primary.lighter",
              mx: "auto",
            }}>{icon}</Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5, fontSize: "0.95rem" }}>{MAP_LIBRARY_TYPE_LABELS[type]}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.6, fontSize: "0.75rem" }}>
              {desc}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function CadImportForm({ groupId, onBack, onCreated }: { groupId: string | null; onBack: () => void; onCreated: (id: string) => void }) {
  const importCadDoc = useMapLibraryStore((s) => s.importCadDoc);
  const moveLibraryToGroup = useMapLibraryStore((s) => s.moveLibraryToGroup);
  const [step, setStep] = useState<"select" | "preview">("select");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedDoc, setParsedDoc] = useState<CadDocument | null>(null);
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "CAD文件", extensions: ["dwg", "dxf"] }],
      });
      if (!selected) return;

      const fp = selected as string;
      const fn = fp.split("/").pop() || fp.split("\\").pop() || "unknown";
      const nameWithoutExt = fn.replace(/\.(dwg|dxf)$/i, "");

      setFilePath(fp);
      setFileName(fn);
      setName(nameWithoutExt);
      setParseError(null);
      setParsing(true);

      const { invoke } = await import("@tauri-apps/api/core");
      const result: ParseResult = await invoke("parse_cad_file", { filePath: fp });

      if (result.success && result.document) {
        setParsedDoc(result.document);
        setStep("preview");
      } else {
        setParseError(result.error || "解析失败");
      }
    } catch (err) {
      setParseError(String(err));
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!filePath || !name || !parsedDoc) return;
    setImporting(true);
    try {
      // 直接复用 step="select" 阶段已解析的 CadDocument，
      // 避免后端 import_cad_file_to_map_library 再次读盘 + 二次 acadrust 解析。
      // 源文件备份留待未来可选实现。
      const result = await importCadDoc(parsedDoc, fileName, name, null);
      if (result) {
        // 如果有预选图库分组，自动移动到该分组
        if (groupId) {
          await moveLibraryToGroup(result.id, groupId);
        }
        onCreated(result.id);
      }
    } catch (err) {
      logger.error("CadImportForm", "Failed to import CAD", { error: String(err) });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep("select");
    setParsedDoc(null);
    setFilePath("");
    setFileName("");
    setName("");
    setParseError(null);
  };

  if (step === "preview" && parsedDoc) {
    return (
      <Box sx={{ pt: 1 }}>
        <TextField
          label="图库名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2.5 }}
        />
        
        <Box sx={{ mb: 2.5, p: 2, borderRadius: 2, bgcolor: "grey.50" }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
            文件信息
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {fileName} · {parsedDoc.entity_count} 个实体 · {parsedDoc.layers.length} 个图层
          </Typography>
          {parsedDoc.extents && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
              坐标范围: X({parsedDoc.extents.min.x.toFixed(2)} ~ {parsedDoc.extents.max.x.toFixed(2)})
              <br />
              Y({parsedDoc.extents.min.y.toFixed(2)} ~ {parsedDoc.extents.max.y.toFixed(2)})
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button 
            onClick={handleReset}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            重新选择
          </Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmImport} 
            disabled={importing || !name}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 500 }}
          >
            {importing ? <CircularProgress size={20} /> : "确认导入"}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 1 }}>
      {parseError && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
          {parseError}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button 
          onClick={onBack}
          sx={{ borderRadius: 2, textTransform: "none" }}
        >
          返回
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSelectFile} 
          disabled={parsing} 
          startIcon={parsing ? <CircularProgress size={16} /> : <FolderOpenIcon />}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 500 }}
        >
          {parsing ? "解析中..." : "选择CAD文件"}
        </Button>
      </Box>
    </Box>
  );
}

function TileMapForm({ groupId, onBack, onCreated }: { groupId: string | null; onBack: () => void; onCreated: (id: string) => void }) {
  const createTileLibrary = useMapLibraryStore((s) => s.createTileLibrary);
  const moveLibraryToGroup = useMapLibraryStore((s) => s.moveLibraryToGroup);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tileUrl, setTileUrl] = useState("");
  const [tileType, setTileType] = useState("xyz");
  const [minZoom, setMinZoom] = useState(0);
  const [maxZoom, setMaxZoom] = useState(18);
  const [coordinateSystem, setCoordinateSystem] = useState("EPSG:3857");
  const [apiKey, setApiKey] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name || !tileUrl) return;
    setCreating(true);
    try {
      const result = await createTileLibrary(name, description || null, tileUrl, tileType, minZoom, maxZoom, coordinateSystem, apiKey || null);
      if (result) {
        if (groupId) {
          await moveLibraryToGroup(result.id, groupId);
        }
        onCreated(result.id);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ pt: 1 }}>
      <TextField 
        label="图库名称" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        fullWidth 
        size="small" 
        sx={{ mb: 2.5 }} 
        required 
      />
      <TextField 
        label="描述" 
        value={description} 
        onChange={(e) => setDescription(e.target.value)} 
        fullWidth 
        size="small" 
        multiline 
        rows={3} 
        sx={{ mb: 2.5 }} 
      />
      <TextField 
        label="瓦片服务 URL" 
        value={tileUrl} 
        onChange={(e) => setTileUrl(e.target.value)} 
        fullWidth 
        size="small" 
        sx={{ mb: 2.5 }} 
        placeholder="https://tile.example.com/{z}/{x}/{y}.png" 
        required 
      />
      <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
        <InputLabel>瓦片类型</InputLabel>
        <Select 
          value={tileType} 
          label="瓦片类型" 
          onChange={(e) => setTileType(e.target.value)}
          sx={{ borderRadius: 2 }}
        >
          <MenuItem value="xyz">XYZ</MenuItem>
          <MenuItem value="tms">TMS</MenuItem>
          <MenuItem value="wmts">WMTS</MenuItem>
        </Select>
      </FormControl>
      <Box sx={{ display: "flex", gap: 2, mb: 2.5 }}>
        <TextField 
          label="最小缩放" 
          type="number" 
          value={minZoom} 
          onChange={(e) => setMinZoom(Number(e.target.value))} 
          size="small" 
          sx={{ flex: 1 }} 
        />
        <TextField 
          label="最大缩放" 
          type="number" 
          value={maxZoom} 
          onChange={(e) => setMaxZoom(Number(e.target.value))} 
          size="small" 
          sx={{ flex: 1 }} 
        />
      </Box>
      <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
        <InputLabel>坐标系</InputLabel>
        <Select 
          value={coordinateSystem} 
          label="坐标系" 
          onChange={(e) => setCoordinateSystem(e.target.value)}
          sx={{ borderRadius: 2 }}
        >
          <MenuItem value="EPSG:3857">EPSG:3857 (Web墨卡托)</MenuItem>
          <MenuItem value="EPSG:4326">EPSG:4326 (WGS84)</MenuItem>
          <MenuItem value="EPSG:4490">EPSG:4490 (CGCS2000)</MenuItem>
        </Select>
      </FormControl>
      <TextField 
        label="API Key（可选）" 
        value={apiKey} 
        onChange={(e) => setApiKey(e.target.value)} 
        fullWidth 
        size="small" 
        sx={{ mb: 2.5 }} 
        type="password" 
      />
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button 
          onClick={onBack}
          sx={{ borderRadius: 2, textTransform: "none" }}
        >
          返回
        </Button>
        <Button 
          variant="contained" 
          onClick={handleCreate} 
          disabled={creating || !name || !tileUrl}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 500 }}
        >
          {creating ? "创建中..." : "创建"}
        </Button>
      </Box>
    </Box>
  );
}

function BlueprintForm({ groupId, onBack, onCreated }: { groupId: string | null; onBack: () => void; onCreated: (id: string) => void }) {
  const createBlueprintLibrary = useMapLibraryStore((s) => s.createBlueprintLibrary);
  const moveLibraryToGroup = useMapLibraryStore((s) => s.moveLibraryToGroup);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [coordinateSystem, setCoordinateSystem] = useState("EPSG:3857");
  const [minLng, setMinLng] = useState("");
  const [minLat, setMinLat] = useState("");
  const [maxLng, setMaxLng] = useState("");
  const [maxLat, setMaxLat] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "图片文件", extensions: ["png", "jpg", "jpeg", "bmp", "webp"] }],
      });
      if (selected) {
        setImagePath(selected as string);
      }
    } catch (err) {
      logger.error("BlueprintForm", "Failed to select image", { error: String(err) });
    }
  };

  const handleCreate = async () => {
    if (!name || !imagePath || !minLng || !minLat || !maxLng || !maxLat) return;
    setCreating(true);
    try {
      const bounds = JSON.stringify({
        minX: parseFloat(minLng),
        minY: parseFloat(minLat),
        maxX: parseFloat(maxLng),
        maxY: parseFloat(maxLat),
      });
      const result = await createBlueprintLibrary(name, description || null, imagePath, bounds, coordinateSystem);
      if (result) {
        if (groupId) {
          await moveLibraryToGroup(result.id, groupId);
        }
        onCreated(result.id);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ pt: 1 }}>
      <TextField 
        label="图库名称" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        fullWidth 
        size="small" 
        sx={{ mb: 2.5 }} 
        required 
      />
      <TextField 
        label="描述" 
        value={description} 
        onChange={(e) => setDescription(e.target.value)} 
        fullWidth 
        size="small" 
        multiline 
        rows={3} 
        sx={{ mb: 2.5 }} 
      />
      <Box sx={{ display: "flex", gap: 1, mb: 2.5, alignItems: "center" }}>
        <TextField 
          label="图片文件" 
          value={imagePath} 
          fullWidth 
          size="small" 
          slotProps={{ htmlInput: { readOnly: true } }} 
        />
        <Button 
          variant="outlined" 
          size="small" 
          onClick={handleSelectImage} 
          startIcon={<FolderOpenIcon />}
          sx={{ borderRadius: 2, textTransform: "none", flexShrink: 0 }}
        >
          选择
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block", fontWeight: 500 }}>
        地理配准坐标（图片四个角对应的经纬度范围）
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 2.5 }}>
        <TextField 
          label="西经度 (minLng)" 
          value={minLng} 
          onChange={(e) => setMinLng(e.target.value)} 
          size="small" 
          type="number" 
          placeholder="116.0" 
        />
        <TextField 
          label="南纬度 (minLat)" 
          value={minLat} 
          onChange={(e) => setMinLat(e.target.value)} 
          size="small" 
          type="number" 
          placeholder="39.0" 
        />
        <TextField 
          label="东经度 (maxLng)" 
          value={maxLng} 
          onChange={(e) => setMaxLng(e.target.value)} 
          size="small" 
          type="number" 
          placeholder="117.0" 
        />
        <TextField 
          label="北纬度 (maxLat)" 
          value={maxLat} 
          onChange={(e) => setMaxLat(e.target.value)} 
          size="small" 
          type="number" 
          placeholder="40.0" 
        />
      </Box>
      <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
        <InputLabel>坐标系</InputLabel>
        <Select 
          value={coordinateSystem} 
          label="坐标系" 
          onChange={(e) => setCoordinateSystem(e.target.value)}
          sx={{ borderRadius: 2 }}
        >
          <MenuItem value="EPSG:3857">EPSG:3857 (Web墨卡托)</MenuItem>
          <MenuItem value="EPSG:4326">EPSG:4326 (WGS84)</MenuItem>
          <MenuItem value="EPSG:4490">EPSG:4490 (CGCS2000)</MenuItem>
        </Select>
      </FormControl>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button 
          onClick={onBack}
          sx={{ borderRadius: 2, textTransform: "none" }}
        >
          返回
        </Button>
        <Button 
          variant="contained" 
          onClick={handleCreate} 
          disabled={creating || !name || !imagePath || !minLng || !minLat || !maxLng || !maxLat}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 500 }}
        >
          {creating ? "创建中..." : "创建"}
        </Button>
      </Box>
    </Box>
  );
}

function LibraryDetailPanel({ library, onTogglePublish }: { library: MapLibrary; onTogglePublish: () => void }) {
  const saveLibrary = useMapLibraryStore((s) => s.saveLibrary);
  const [editName, setEditName] = useState(library.name);
  const [editDesc, setEditDesc] = useState(library.description || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditName(library.name);
    setEditDesc(library.description || "");
  }, [library.id, library.name, library.description]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLibrary({
        ...library,
        name: editName,
        description: editDesc || undefined,
        updatedAt: Math.floor(Date.now() / 1000),
      });
    } finally {
      setSaving(false);
    }
  };

  const parsedLayers = (() => {
    try {
      if (!library.layers) return [];
      const raw = JSON.parse(library.layers);
      return raw.map((l: any) => {
        if (typeof l === "string") return { name: l, entityCount: 0 };
        return { name: l.name || String(l), entityCount: l.entityCount ?? 0 };
      });
    } catch { return []; }
  })();

  const parsedBounds = (() => {
    try {
      return library.bounds ? JSON.parse(library.bounds) : null;
    } catch { return null; }
  })();

  const parsedMetadata = (() => {
    try {
      return library.metadata ? JSON.parse(library.metadata) : null;
    } catch { return null; }
  })();

  return (
    <Card sx={{ 
      height: "100%", 
      overflow: "auto",
      borderRadius: 3,
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      border: "1px solid",
      borderColor: "divider",
    }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, fontSize: "1.1rem" }}>
          图库详情
        </Typography>
        
        <TextField 
          label="名称" 
          value={editName} 
          onChange={(e) => setEditName(e.target.value)} 
          fullWidth 
          size="small" 
          disabled={library.status === "published"}
          sx={{ mb: 2.5 }}
        />
        
        <TextField 
          label="描述" 
          value={editDesc} 
          onChange={(e) => setEditDesc(e.target.value)} 
          fullWidth 
          size="small" 
          multiline 
          rows={3}
          disabled={library.status === "published"}
          sx={{ mb: 2.5 }}
        />
        
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
            状态
          </Typography>
          <Chip 
            label={MAP_LIBRARY_STATUS_LABELS[library.status]} 
            color={STATUS_COLORS[library.status]} 
            size="small"
            sx={{ 
              height: 24,
              "& .MuiChip-label": { px: 1, fontSize: "0.75rem", fontWeight: 500 }
            }}
          />
        </Box>
        
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
            类型
          </Typography>
          <Chip 
            label={MAP_LIBRARY_TYPE_LABELS[library.mapType]} 
            size="small" 
            variant="outlined"
            sx={{ 
              height: 24,
              "& .MuiChip-label": { px: 1, fontSize: "0.75rem", fontWeight: 500 }
            }}
          />
        </Box>

        {library.sourceFile && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: "grey.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              源文件
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.8rem", wordBreak: "break-all" }}>{library.sourceFile}</Typography>
          </Box>
        )}
        
        {library.dataDir && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: "grey.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              数据目录
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>{library.dataDir}</Typography>
          </Box>
        )}
        
        {library.entityCount > 0 && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: "grey.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              实体数量
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.9rem", fontWeight: 600 }}>{library.entityCount}</Typography>
          </Box>
        )}

        {parsedBounds && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: "grey.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              边界范围
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.75rem", fontFamily: "monospace", lineHeight: 1.6 }}>
              X: {parsedBounds.minX?.toFixed(2)} ~ {parsedBounds.maxX?.toFixed(2)}<br />
              Y: {parsedBounds.minY?.toFixed(2)} ~ {parsedBounds.maxY?.toFixed(2)}
            </Typography>
          </Box>
        )}
        
        {parsedLayers.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block", fontWeight: 500 }}>
              图层 ({parsedLayers.length})
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {parsedLayers.map((layer: { name: string; entityCount: number }) => (
                <Chip 
                  key={layer.name} 
                  label={`${layer.name}(${layer.entityCount})`} 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    height: 22, 
                    "& .MuiChip-label": { px: 0.75, fontSize: "0.65rem" },
                    opacity: layer.entityCount > 0 ? 1 : 0.5,
                  }} 
                />
              ))}
            </Box>
          </Box>
        )}

        {parsedMetadata && library.mapType === "tile" && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: "grey.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              瓦片配置
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.75rem", fontFamily: "monospace", wordBreak: "break-all", mb: 0.5 }}>
              URL: {parsedMetadata.tileUrl}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
              类型: {parsedMetadata.tileType} | 缩放: {parsedMetadata.minZoom}-{parsedMetadata.maxZoom}
            </Typography>
          </Box>
        )}
        
        {parsedMetadata && library.mapType === "blueprint" && (
          <Box sx={{ mb: 2.5, p: 1.5, borderRadius: 2, bgcolor: "grey.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              蓝图配置
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
              图片: {parsedMetadata.imageName}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
            创建时间
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>{formatDate(library.createdAt)}</Typography>
        </Box>
        
        {library.publishedAt && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", fontWeight: 500 }}>
              发布时间
            </Typography>
            <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>{formatDate(library.publishedAt)}</Typography>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 3, pb: 3, pt: 2, justifyContent: "space-between", borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "nowrap" }}>
          <Button
            size="small"
            variant={library.status === "published" ? "outlined" : "contained"}
            color={library.status === "published" ? "warning" : "success"}
            startIcon={library.status === "published" ? <UnpublishedIcon /> : <PublishIcon />}
            onClick={onTogglePublish}
            sx={{ 
              borderRadius: 2, 
              textTransform: "none", 
              fontWeight: 500,
              whiteSpace: "nowrap",
              ...(library.status === "published" ? {
                bgcolor: "warning.lighter",
                borderColor: "warning.light",
                "&:hover": { 
                  bgcolor: "warning.light",
                  transform: "scale(1.02)",
                },
              } : {
                "&:hover": { 
                  transform: "scale(1.02)",
                },
              }),
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {library.status === "published" ? "取消发布" : "发布"}
          </Button>
          {(library.cadbinPath) && (
            <>
              <Tooltip title="预览CAD图纸" placement="top">
                <Button 
                  size="small" 
                  variant="outlined" 
                  color="info"
                  startIcon={<VisibilityIcon />} 
                  onClick={() => openMapPreviewWindow(library.id, library.name)}
                  sx={{ 
                    borderRadius: 2, 
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    bgcolor: "info.lighter",
                    borderColor: "info.light",
                    "&:hover": { 
                      bgcolor: "info.light",
                      transform: "scale(1.02)",
                    },
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  预览
                </Button>
              </Tooltip>
              {library.status !== "published" && (
                <Tooltip title="编辑CAD图纸" placement="top">
                  <Button 
                    size="small" 
                    variant="outlined" 
                    color="secondary"
                    startIcon={<EditIcon />} 
                    onClick={() => openEditorWindow(library.id, library.name)}
                    sx={{ 
                      borderRadius: 2, 
                      textTransform: "none",
                      whiteSpace: "nowrap",
                      bgcolor: "secondary.lighter",
                      borderColor: "secondary.light",
                      "&:hover": { 
                        bgcolor: "secondary.light",
                        transform: "scale(1.02)",
                      },
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    编辑
                  </Button>
                </Tooltip>
              )}
            </>
          )}
        </Box>
        {library.status !== "published" && (
          <Button 
            size="small" 
            variant="contained" 
            color="primary"
            onClick={handleSave} 
            disabled={saving || !editName.trim()}
            sx={{ 
              borderRadius: 2, 
              textTransform: "none", 
              fontWeight: 500,
              whiteSpace: "nowrap",
              "&:hover": { 
                transform: "scale(1.02)",
              },
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {saving ? <CircularProgress size={16} /> : "保存修改"}
          </Button>
        )}
      </CardActions>

    </Card>
  );
}