import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckIcon from "@mui/icons-material/Check";
import TuneIcon from "@mui/icons-material/Tune";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import Brightness6Icon from "@mui/icons-material/Brightness6";
import PaletteIcon from "@mui/icons-material/Palette";
import { useThemeStore } from "../../../store/themeStore";
import { useLayoutStore } from "../../../store/layoutStore";
import { useAppearanceStore } from "../../../store/appearanceStore";
import type { IconGroup, SystemIcon } from "../../../services/tauri";

interface AppearancePanelProps {
  expandedPanels: string[];
  onPanelChange: (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => void;
  groups: IconGroup[];
  icons: SystemIcon[];
  iconsLoading: boolean;
  iconFileUrls: Record<string, string>;
  uploadIcon: (groupId: string, file: File) => Promise<string>;
  saveIcon: (icon: SystemIcon) => Promise<void>;
  saveGroup: (group: IconGroup) => Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onDeleteRequest: (type: string, target: any) => void;
}

export default function AppearancePanel({
  expandedPanels,
  onPanelChange,
  groups,
  icons,
  iconsLoading,
  iconFileUrls,
  uploadIcon,
  saveIcon,
  saveGroup,
  onError,
  onSuccess,
  onDeleteRequest,
}: AppearancePanelProps) {
  const themeConfig = useThemeStore((state) => state.config);
  const themeSetMode = useThemeStore((state) => state.setMode);
  const themeSetPreset = useThemeStore((state) => state.setPreset);
  const themeSetCustomPrimary = useThemeStore((state) => state.setCustomPrimary);
  const themeSetFontSize = useThemeStore((state) => state.setFontSize);
  const themeSetBorderRadius = useThemeStore((state) => state.setBorderRadius);
  const themeResetConfig = useThemeStore((state) => state.resetConfig);
  const layoutConfig = useLayoutStore((state) => state.config);
  const appearanceProfiles = useAppearanceStore((s) => s.profiles);
  const appearanceActiveProfileId = useAppearanceStore((s) => s.activeProfileId);
  const appearanceBaseProfileId = useAppearanceStore((s) => s.baseProfileId);
  const appearanceIsModified = useAppearanceStore((s) => s.isModified);

  const [customAppearanceOpen, setCustomAppearanceOpen] = React.useState(false);
  const [expandedGroupPanels, setExpandedGroupPanels] = React.useState<string[]>([]);
  const [editingIconId, setEditingIconId] = React.useState<string | null>(null);
  const [editingIconName, setEditingIconName] = React.useState("");
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false);
  const [createGroupName, setCreateGroupName] = React.useState("");
  const [createGroupDescription, setCreateGroupDescription] = React.useState<string | null>(null);
  const [createGroupParentId, setCreateGroupParentId] = React.useState<string | null>(null);
  const [uploadTargetGroupId, setUploadTargetGroupId] = React.useState<string | null>(null);

  const groupFileInputRef = React.useRef<HTMLInputElement>(null);
  const MAX_ICON_FILE_SIZE = 512 * 1024;

  const handleGroupPanelChange =
    (groupId: string) =>
    (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedGroupPanels((prev) =>
        isExpanded ? [...prev, groupId] : prev.filter((p) => p !== groupId)
      );
    };

  const handleCreateGroupSubmit = async () => {
    if (!createGroupName) return;
    try {
      const groupId = `group_${crypto.randomUUID().replace(/-/g, "")}`;
      await saveGroup({
        id: groupId,
        name: createGroupName,
        description: createGroupDescription ?? undefined,
        parent_id: createGroupParentId ?? undefined,
        updated_at: Date.now(),
      });
      setCreateGroupOpen(false);
      setCreateGroupName("");
      setCreateGroupDescription(null);
      setCreateGroupParentId(null);
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  const handleGroupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !uploadTargetGroupId) return;
    const file = e.target.files[0];
    if (file.size > MAX_ICON_FILE_SIZE) {
      onError(`图标文件大小不能超过 ${MAX_ICON_FILE_SIZE / 1024}KB，当前文件 ${(file.size / 1024).toFixed(1)}KB`);
      e.target.value = "";
      return;
    }
    try {
      await uploadIcon(uploadTargetGroupId, file);
      // refreshIconFileUrls is handled by parent via iconFileUrls prop
      if (!expandedGroupPanels.includes(uploadTargetGroupId)) {
        setExpandedGroupPanels((prev) => [...prev, uploadTargetGroupId]);
      }
      onSuccess("图标上传成功！");
    } catch (error) {
      console.error("Failed to upload icon:", error);
      onError("图标上传失败，请重试");
    }
    e.target.value = "";
    setUploadTargetGroupId(null);
  };

  const handleUploadClick = (groupId: string) => {
    setUploadTargetGroupId(groupId);
    setTimeout(() => groupFileInputRef.current?.click(), 0);
  };

  const handleIconNameDoubleClick = (iconId: string, currentName: string) => {
    setEditingIconId(iconId);
    setEditingIconName(currentName);
  };

  const handleIconNameSave = async (iconId: string) => {
    if (!editingIconName.trim()) {
      setEditingIconId(null);
      return;
    }
    const icon = icons.find((i) => i.id === iconId);
    if (icon && icon.name !== editingIconName) {
      try {
        await saveIcon({ ...icon, name: editingIconName.trim() });
      } catch (error) {
        console.error("Failed to rename icon:", error);
      }
    }
    setEditingIconId(null);
    setEditingIconName("");
  };

  const handleIconNameKeyDown = (e: React.KeyboardEvent, iconId: string) => {
    if (e.key === "Enter") {
      handleIconNameSave(iconId);
    } else if (e.key === "Escape") {
      setEditingIconId(null);
      setEditingIconName("");
    }
  };

  return (
    <>
      <Accordion
        expanded={expandedPanels.includes("appearance")}
        onChange={onPanelChange("appearance")}
        disableGutters
        sx={{
          mb: 1,
          "&:before": { display: "none" },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div">
          <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
            🎨 外观设置
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Appearance profiles grid */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1.5 }}>
              外观方案
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
              {appearanceProfiles.map((profile) => {
                const isActive = appearanceActiveProfileId === profile.id;
                const isBase = appearanceBaseProfileId === profile.id;
                const showModified = isBase && appearanceIsModified;
                const APPEARANCE_PRESET_COLORS: Record<string, string> = { default: "#2a5688", blue: "#2563eb", green: "#059669", orange: "#d97706", purple: "#7c4dff" };
                const accentColor = profile.theme.preset === "custom" ? (profile.theme.customPrimary || "#6366f1") : (APPEARANCE_PRESET_COLORS[profile.theme.preset] || "#2a5688");
                return (
                  <Paper
                    key={profile.id}
                    onClick={() => useAppearanceStore.getState().applyProfile(profile.id)}
                    sx={{
                      p: 1,
                      cursor: "pointer",
                      border: "2px solid",
                      borderColor: (isActive || showModified) ? "primary.main" : "divider",
                      borderRadius: 1.5,
                      transition: "all 0.2s",
                      "&:hover": {
                        borderColor: "primary.light",
                        transform: "translateY(-1px)",
                        boxShadow: 1,
                      },
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        height: 24,
                        borderRadius: 0.5,
                        mb: 0.75,
                        display: "flex",
                        overflow: "hidden",
                      }}
                    >
                      <Box sx={{ flex: 1, bgcolor: profile.theme.mode === "dark" ? "#1f2937" : "#f5f7fa" }} />
                      <Box sx={{ width: 8, bgcolor: accentColor }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: (isActive || showModified) ? 700 : 500, lineHeight: 1.2, display: "block", fontSize: 10 }}>
                      {profile.name}
                    </Typography>
                    {isActive && !showModified && (
                      <CheckIcon
                        sx={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          fontSize: 12,
                          bgcolor: "primary.main",
                          color: "#fff",
                          borderRadius: "50%",
                          p: 0.2,
                        }}
                      />
                    )}
                    {showModified && (
                      <Chip
                        label="已调整"
                        size="small"
                        sx={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          height: 14,
                          fontSize: 8,
                          px: 0.3,
                          "& .MuiChip-label": { px: 0.3 },
                        }}
                        color="primary"
                        variant="filled"
                      />
                    )}
                  </Paper>
                );
              })}
              <Paper
                onClick={() => setCustomAppearanceOpen(true)}
                sx={{
                  p: 1,
                  cursor: "pointer",
                  border: "2px solid",
                  borderColor: appearanceActiveProfileId === null && !appearanceIsModified ? "primary.main" : "divider",
                  borderRadius: 1.5,
                  transition: "all 0.2s",
                  "&:hover": {
                    borderColor: "primary.light",
                    transform: "translateY(-1px)",
                    boxShadow: 1,
                  },
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    width: "100%",
                    height: 24,
                    borderRadius: 0.5,
                    mb: 0.75,
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  <Box sx={{ flex: 1, bgcolor: themeConfig.mode === "dark" ? "#1f2937" : "#f5f7fa" }} />
                  <Box sx={{ width: 8, bgcolor: themeConfig.preset === "custom" ? (themeConfig.customPrimary || "#6366f1") : (themeConfig.preset === "default" ? "#2a5688" : themeConfig.preset === "blue" ? "#2563eb" : themeConfig.preset === "green" ? "#059669" : themeConfig.preset === "orange" ? "#d97706" : "#7c4dff") }} />
                </Box>
                <Typography variant="caption" sx={{ fontWeight: appearanceActiveProfileId === null && !appearanceIsModified ? 700 : 500, lineHeight: 1.2, display: "block", fontSize: 10 }}>
                  自定义
                </Typography>
                {appearanceActiveProfileId === null && !appearanceIsModified && (
                  <CheckIcon
                    sx={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      fontSize: 12,
                      bgcolor: "primary.main",
                      color: "#fff",
                      borderRadius: "50%",
                      p: 0.2,
                    }}
                  />
                )}
              </Paper>
            </Box>
          </Box>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            fullWidth
            onClick={() => {
              themeResetConfig();
              useLayoutStore.getState().resetLayout();
              useAppearanceStore.getState().detectActiveProfile(
                useThemeStore.getState().config,
                useLayoutStore.getState().config
              );
            }}
          >
            恢复默认外观
          </Button>
          <Divider sx={{ mb: 2 }} />

          {/* Icon group management */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                图标分组管理
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setCreateGroupParentId(null);
                    setCreateGroupOpen(true);
                  }}
                >
                  新建分组
                </Button>
                <input
                  ref={groupFileInputRef}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg"
                  onChange={handleGroupFileSelect}
                  style={{ display: "none" }}
                />
              </Box>
            </Box>

            {groups.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                暂无分组，请先创建分组
              </Typography>
            ) : (
              groups.filter((g) => !g.parent_id).map((group) => {
                const groupIcons = icons.filter((i) => i.group_id === group.id);
                const subGroups = groups.filter((g) => g.parent_id === group.id);
                const subGroupIconCount = subGroups.reduce((sum, sg) => sum + icons.filter((i) => i.group_id === sg.id).length, 0);
                const isExpanded = expandedGroupPanels.includes(group.id);
                return (
                  <Paper
                    key={group.id}
                    sx={{
                      mb: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        p: 1.5,
                        cursor: "pointer",
                        "&:hover": {
                          bgcolor: "action.hover",
                        },
                      }}
                      onClick={() => handleGroupPanelChange(group.id)(undefined as any, !isExpanded)}
                    >
                      <ExpandMoreIcon
                        sx={{
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 500, ml: 1, flex: 1 }}>
                        {group.name}
                      </Typography>
                      <Chip
                        label={`${groupIcons.length + subGroupIconCount} 个图标`}
                        size="small"
                        variant="outlined"
                      />
                      <Box sx={{ display: "flex", gap: 0.5, ml: 1 }} onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="上传图标到此分组" arrow>
                          <IconButton size="small" onClick={() => handleUploadClick(group.id)}>
                            <UploadFileIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="添加子分组" arrow>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setCreateGroupParentId(group.id);
                              setCreateGroupOpen(true);
                            }}
                          >
                            <AddIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="删除分组" arrow>
                          <IconButton
                            size="small"
                            onClick={() => {
                              onDeleteRequest("iconGroup", group.id);
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    {isExpanded && (
                      <Box sx={{ p: 1.5, pt: 0 }}>
                        {group.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                            {group.description}
                          </Typography>
                        )}
                        {groupIcons.length > 0 && (
                          <Box sx={{ mb: subGroups.length > 0 ? 2 : 0 }}>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: 2,
                              }}
                            >
                              {groupIcons.map((icon) => (
                                <Paper
                                  key={icon.id}
                                  sx={{
                                    p: 1.5,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 1,
                                    borderRadius: 2,
                                    cursor: "pointer",
                                    "&:hover": {
                                      bgcolor: "action.hover",
                                    },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: 48,
                                      height: 48,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      bgcolor: "action.hover",
                                      borderRadius: 1,
                                      mb: 1,
                                    }}
                                  >
                                    <img
                                      src={iconFileUrls[icon.id] || ""}
                                      alt={icon.name}
                                      style={{
                                        maxWidth: "100%",
                                        maxHeight: "100%",
                                      }}
                                    />
                                  </Box>
                                  {editingIconId === icon.id ? (
                                    <TextField
                                      value={editingIconName}
                                      onChange={(e) => setEditingIconName(e.target.value)}
                                      onBlur={() => handleIconNameSave(icon.id)}
                                      onKeyDown={(e) => handleIconNameKeyDown(e, icon.id)}
                                      size="small"
                                      variant="standard"
                                      autoFocus
                                      sx={{ "& .MuiInput-input": { fontSize: "0.8rem", textAlign: "center" } }}
                                    />
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 500, cursor: "pointer" }}
                                      onDoubleClick={() => handleIconNameDoubleClick(icon.id, icon.name)}
                                    >
                                      {icon.name}
                                    </Typography>
                                  )}
                                  <Tooltip title="删除图标" arrow>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        onDeleteRequest("icon", icon.id);
                                      }}
                                      sx={{ mt: 0.5 }}
                                    >
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Paper>
                              ))}
                            </Box>
                          </Box>
                        )}
                        {subGroups.map((subGroup) => {
                          const subIcons = icons.filter((i) => i.group_id === subGroup.id);
                          const isSubExpanded = expandedGroupPanels.includes(subGroup.id);
                          return (
                            <Paper
                              key={subGroup.id}
                              sx={{
                                mt: 1,
                                border: "1px dashed",
                                borderColor: "divider",
                                borderRadius: 1,
                                ml: 2,
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  p: 1.5,
                                  cursor: "pointer",
                                  "&:hover": {
                                    bgcolor: "action.hover",
                                  },
                                }}
                                onClick={() => handleGroupPanelChange(subGroup.id)(undefined as any, !isSubExpanded)}
                              >
                                <ExpandMoreIcon
                                  sx={{
                                    fontSize: 18,
                                    transform: isSubExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s",
                                  }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 500, ml: 1, flex: 1, fontSize: "0.8rem" }}>
                                  {subGroup.name}
                                </Typography>
                                <Chip
                                  label={`${subIcons.length}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: "0.7rem" }}
                                />
                                <Box sx={{ display: "flex", gap: 0.5, ml: 1 }} onClick={(e) => e.stopPropagation()}>
                                  <Tooltip title="上传图标到此子分组" arrow>
                                    <IconButton size="small" onClick={() => handleUploadClick(subGroup.id)}>
                                      <UploadFileIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="删除子分组" arrow>
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        onDeleteRequest("iconGroup", subGroup.id);
                                      }}
                                    >
                                      <DeleteIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>
                              {isSubExpanded && (
                                <Box sx={{ p: 1.5, pt: 0 }}>
                                  {subGroup.description && (
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                                      {subGroup.description}
                                    </Typography>
                                  )}
                                  {subIcons.length === 0 ? (
                                    <Typography variant="caption" color="text.secondary">
                                      暂无图标
                                    </Typography>
                                  ) : (
                                    <Box
                                      sx={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(4, 1fr)",
                                        gap: 2,
                                      }}
                                    >
                                      {subIcons.map((icon) => (
                                        <Paper
                                          key={icon.id}
                                          sx={{
                                            p: 1.5,
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            gap: 1,
                                            borderRadius: 2,
                                            cursor: "pointer",
                                            "&:hover": {
                                              bgcolor: "action.hover",
                                            },
                                          }}
                                        >
                                          <Box
                                            sx={{
                                              width: 48,
                                              height: 48,
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              bgcolor: "action.hover",
                                              borderRadius: 1,
                                              mb: 1,
                                            }}
                                          >
                                            <img
                                              src={iconFileUrls[icon.id] || ""}
                                              alt={icon.name}
                                              style={{
                                                maxWidth: "100%",
                                                maxHeight: "100%",
                                              }}
                                            />
                                          </Box>
                                          {editingIconId === icon.id ? (
                                            <TextField
                                              value={editingIconName}
                                              onChange={(e) => setEditingIconName(e.target.value)}
                                              onBlur={() => handleIconNameSave(icon.id)}
                                              onKeyDown={(e) => handleIconNameKeyDown(e, icon.id)}
                                              size="small"
                                              variant="standard"
                                              autoFocus
                                              sx={{ "& .MuiInput-input": { fontSize: "0.8rem", textAlign: "center" } }}
                                            />
                                          ) : (
                                            <Typography
                                              variant="body2"
                                              sx={{ fontWeight: 500, cursor: "pointer" }}
                                              onDoubleClick={() => handleIconNameDoubleClick(icon.id, icon.name)}
                                            >
                                              {icon.name}
                                            </Typography>
                                          )}
                                          <Tooltip title="删除图标" arrow>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                onDeleteRequest("icon", icon.id);
                                              }}
                                              sx={{ mt: 0.5 }}
                                            >
                                              <DeleteIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                          </Tooltip>
                                        </Paper>
                                      ))}
                                    </Box>
                                  )}
                                </Box>
                              )}
                            </Paper>
                          );
                        })}
                        {groupIcons.length === 0 && subGroups.length === 0 && (
                          <Typography variant="caption" color="text.secondary">
                            暂无图标，点击上传按钮添加图标，或点击"+"添加子分组
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Paper>
                );
              })
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* CreateGroupDialog */}
      <Dialog
        open={createGroupOpen}
        onClose={() => {
          setCreateGroupOpen(false);
          setCreateGroupParentId(null);
        }}
        aria-labelledby="create-group-dialog-title"
      >
        <DialogTitle id="create-group-dialog-title">
          {createGroupParentId ? "新建子分组" : "新建图标分组"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, minWidth: 400 }}>
            {createGroupParentId && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                父分组：{groups.find((g) => g.id === createGroupParentId)?.name}
              </Typography>
            )}
            <TextField
              fullWidth
              label="分组名称"
              value={createGroupName}
              onChange={(e) => setCreateGroupName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="描述（可选）"
              value={createGroupDescription || ""}
              onChange={(e) => setCreateGroupDescription(e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateGroupOpen(false);
            setCreateGroupParentId(null);
          }}>
            取消
          </Button>
          <Button
            onClick={handleCreateGroupSubmit}
            variant="contained"
            disabled={!createGroupName || iconsLoading}
          >
            {iconsLoading ? "创建中..." : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CustomAppearanceDialog */}
      <Dialog
        open={customAppearanceOpen}
        onClose={() => setCustomAppearanceOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{ "& .MuiDialog-paper": { borderRadius: 2, overflow: "hidden" } }}
      >
        <DialogTitle sx={{ pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TuneIcon sx={{ fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>自定义外观方案</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* Color mode */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>颜色模式</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
              {([
                { value: "light" as const, icon: <LightModeIcon sx={{ fontSize: 18 }} />, label: "浅色", bg: "#f5f7fa", fg: "#1f2937" },
                { value: "dark" as const, icon: <DarkModeIcon sx={{ fontSize: 18 }} />, label: "深色", bg: "#1f2937", fg: "#f9fafb" },
                { value: "system" as const, icon: <Brightness6Icon sx={{ fontSize: 18 }} />, label: "跟随系统", bg: "linear-gradient(135deg, #f5f7fa 50%, #1f2937 50%)", fg: "#6b7280" },
              ]).map((item) => (
                <Paper
                  key={item.value}
                  onClick={() => {
                    themeSetMode(item.value);
                    useAppearanceStore.getState().detectActiveProfile(
                      { ...useThemeStore.getState().config, mode: item.value },
                      useLayoutStore.getState().config
                    );
                  }}
                  sx={{
                    p: 1,
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: themeConfig.mode === item.value ? "primary.main" : "divider",
                    borderRadius: 1.5,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.5,
                    transition: "all 0.2s",
                    "&:hover": { borderColor: "primary.light", transform: "translateY(-1px)" },
                    position: "relative",
                  }}
                >
                  <Box sx={{ width: "100%", height: 24, borderRadius: 0.5, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", color: item.fg }}>
                    {item.icon}
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: themeConfig.mode === item.value ? 700 : 400, fontSize: 10 }}>
                    {item.label}
                  </Typography>
                  {themeConfig.mode === item.value && (
                    <CheckIcon sx={{ position: "absolute", top: 2, right: 2, fontSize: 12, bgcolor: "primary.main", color: "#fff", borderRadius: "50%", p: 0.2 }} />
                  )}
                </Paper>
              ))}
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Theme color */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>主题色彩</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
              {([
                { value: "default" as const, label: "默认", main: "#2a5688", light: "#799cc2", dark: "#1e3f66" },
                { value: "blue" as const, label: "科技蓝", main: "#2563eb", light: "#93c5fd", dark: "#1e40af" },
                { value: "green" as const, label: "翠绿", main: "#059669", light: "#6ee7b7", dark: "#065f46" },
                { value: "orange" as const, label: "暖橙", main: "#d97706", light: "#fcd34d", dark: "#92400e" },
                { value: "purple" as const, label: "典雅紫", main: "#7c4dff", light: "#b388ff", dark: "#6200ea" },
              ]).map((item) => (
                <Paper
                  key={item.value}
                  onClick={() => {
                    themeSetPreset(item.value);
                    useAppearanceStore.getState().detectActiveProfile(
                      { ...useThemeStore.getState().config, preset: item.value },
                      useLayoutStore.getState().config
                    );
                  }}
                  sx={{
                    p: 1,
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: themeConfig.preset === item.value ? "primary.main" : "divider",
                    borderRadius: 1.5,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.5,
                    transition: "all 0.2s",
                    "&:hover": { borderColor: "primary.light", transform: "translateY(-1px)" },
                    position: "relative",
                  }}
                >
                  <Box sx={{ display: "flex", gap: 0.2, height: 16, width: "100%", borderRadius: 0.5, overflow: "hidden" }}>
                    <Box sx={{ flex: 1, bgcolor: item.light }} />
                    <Box sx={{ flex: 1.5, bgcolor: item.main }} />
                    <Box sx={{ flex: 1, bgcolor: item.dark }} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: themeConfig.preset === item.value ? 700 : 400, fontSize: 10 }}>
                    {item.label}
                  </Typography>
                  {themeConfig.preset === item.value && (
                    <CheckIcon sx={{ position: "absolute", top: 2, right: 2, fontSize: 12, bgcolor: "primary.main", color: "#fff", borderRadius: "50%", p: 0.2 }} />
                  )}
                </Paper>
              ))}
              <Paper
                sx={{
                  p: 1,
                  cursor: "pointer",
                  border: "2px solid",
                  borderColor: themeConfig.preset === "custom" ? "primary.main" : "divider",
                  borderRadius: 1.5,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.5,
                  transition: "all 0.2s",
                  "&:hover": { borderColor: "primary.light", transform: "translateY(-1px)" },
                  position: "relative",
                }}
              >
                <Box
                  sx={{ width: "100%", height: 16, borderRadius: 0.5, bgcolor: themeConfig.customPrimary || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}
                  onClick={(e) => {
                    const input = e.currentTarget.querySelector("input[type=color]") as HTMLInputElement;
                    if (input) input.click();
                  }}
                >
                  <PaletteIcon sx={{ fontSize: 10, color: "#fff" }} />
                  <input
                    type="color"
                    value={themeConfig.customPrimary || "#6366f1"}
                    onChange={(e) => {
                      const val = e.target.value;
                      themeSetCustomPrimary(val);
                      useAppearanceStore.getState().detectActiveProfile(
                        { ...useThemeStore.getState().config, preset: "custom", customPrimary: val },
                        useLayoutStore.getState().config
                      );
                    }}
                    style={{ position: "absolute", width: "100%", height: "100%", opacity: 0, cursor: "pointer", top: 0, left: 0 }}
                  />
                </Box>
                <Typography variant="caption" sx={{ fontWeight: themeConfig.preset === "custom" ? 700 : 400, fontSize: 10 }}>
                  自定义
                </Typography>
                {themeConfig.preset === "custom" && (
                  <CheckIcon sx={{ position: "absolute", top: 2, right: 2, fontSize: 12, bgcolor: "primary.main", color: "#fff", borderRadius: "50%", p: 0.2 }} />
                )}
              </Paper>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Font & border */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>界面风格</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                  字体大小
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  {([
                    { value: "small" as const, label: "小" },
                    { value: "medium" as const, label: "中" },
                    { value: "large" as const, label: "大" },
                  ]).map((item) => (
                    <Paper
                      key={item.value}
                      onClick={() => {
                        themeSetFontSize(item.value);
                        useAppearanceStore.getState().detectActiveProfile(
                          { ...useThemeStore.getState().config, fontSize: item.value },
                          useLayoutStore.getState().config
                        );
                      }}
                      sx={{
                        flex: 1,
                        py: 0.5,
                        cursor: "pointer",
                        border: "2px solid",
                        borderColor: themeConfig.fontSize === item.value ? "primary.main" : "divider",
                        borderRadius: 1,
                        textAlign: "center",
                        transition: "all 0.2s",
                        "&:hover": { borderColor: "primary.light" },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: themeConfig.fontSize === item.value ? 700 : 400,
                          fontSize: item.value === "small" ? 10 : item.value === "large" ? 14 : 12,
                        }}
                      >
                        {item.label}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                  圆角风格
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {([
                    { value: "none" as const, label: "直角" },
                    { value: "small" as const, label: "小圆" },
                    { value: "medium" as const, label: "中圆" },
                    { value: "large" as const, label: "大圆" },
                    { value: "round" as const, label: "全圆" },
                  ]).map((item) => (
                    <Paper
                      key={item.value}
                      onClick={() => {
                        themeSetBorderRadius(item.value);
                        useAppearanceStore.getState().detectActiveProfile(
                          { ...useThemeStore.getState().config, borderRadius: item.value },
                          useLayoutStore.getState().config
                        );
                      }}
                      sx={{
                        flex: 1,
                        py: 0.5,
                        cursor: "pointer",
                        border: "2px solid",
                        borderColor: themeConfig.borderRadius === item.value ? "primary.main" : "divider",
                        borderRadius: { none: 0, small: 2, medium: 6, large: 12, round: 20 }[item.value],
                        textAlign: "center",
                        transition: "all 0.2s",
                        "&:hover": { borderColor: "primary.light" },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: themeConfig.borderRadius === item.value ? 700 : 400, fontSize: 10 }}
                      >
                        {item.label}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Layout preset */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>布局预设</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
              {([
                { value: "default" as const, label: "标准", desc: "240px 侧栏", svg: <Box sx={{ width: "100%", height: 28, display: "flex", gap: 0.3 }}><Box sx={{ width: 28, bgcolor: "action.hover", borderRadius: 0.5 }} /><Box sx={{ flex: 1, bgcolor: "action.selected", borderRadius: 0.5 }} /></Box> },
                { value: "compact" as const, label: "紧凑", desc: "64px 侧栏", svg: <Box sx={{ width: "100%", height: 28, display: "flex", gap: 0.3 }}><Box sx={{ width: 10, bgcolor: "action.hover", borderRadius: 0.5 }} /><Box sx={{ flex: 1, bgcolor: "action.selected", borderRadius: 0.5 }} /></Box> },
                { value: "wide" as const, label: "宽屏", desc: "280px 侧栏", svg: <Box sx={{ width: "100%", height: 28, display: "flex", gap: 0.3 }}><Box sx={{ width: 36, bgcolor: "action.hover", borderRadius: 0.5 }} /><Box sx={{ flex: 1, bgcolor: "action.selected", borderRadius: 0.5 }} /></Box> },
              ]).map((item) => (
                <Paper
                  key={item.value}
                  onClick={() => {
                    useLayoutStore.getState().applyPreset(item.value);
                    useAppearanceStore.getState().detectActiveProfile(
                      useThemeStore.getState().config,
                      useLayoutStore.getState().config
                    );
                  }}
                  sx={{
                    p: 1,
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: layoutConfig.preset === item.value ? "primary.main" : "divider",
                    borderRadius: 1.5,
                    transition: "all 0.2s",
                    "&:hover": {
                      borderColor: "primary.light",
                      transform: "translateY(-1px)",
                    },
                    position: "relative",
                  }}
                >
                  {item.svg}
                  <Typography variant="caption" sx={{ fontWeight: layoutConfig.preset === item.value ? 700 : 400, display: "block", mt: 0.5, fontSize: 10 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                    {item.desc}
                  </Typography>
                  {layoutConfig.preset === item.value && (
                    <CheckIcon sx={{ position: "absolute", top: 2, right: 2, fontSize: 12, bgcolor: "primary.main", color: "#fff", borderRadius: "50%", p: 0.2 }} />
                  )}
                </Paper>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={() => setCustomAppearanceOpen(false)} variant="contained" size="small">完成</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
