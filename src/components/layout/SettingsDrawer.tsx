import * as React from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useAuthStore } from "../../store/authStore";
import { useIconStore } from "../../store/iconStore";
import { iconsApi } from "../../services/tauri";
import type { UserDisplayConfig, UserDisplayType } from "../../services/tauri";
import AuthConfigPanel, { type AuthConfigPanelHandle } from "./settings/AuthConfigPanel";
import UserDisplayPanel from "./settings/UserDisplayPanel";
import AppearancePanel from "./settings/AppearancePanel";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { updateConfig, reset, getUserProfileCandidateKeys, getCachedValue } = useAuthStore();

  // Shell state
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [resetCounter, setResetCounter] = React.useState(0);

  const [expandedPanels, setExpandedPanels] = React.useState<string[]>([
    "preset",
    "service",
    "params",
    "endpoints",
    "headers",
    "userDisplay",
    "appearance",
  ]);

  // 用户信息展示配置（全应用单一持有者）：
  // UserDisplayPanel 编辑它、AuthConfigPanel 保存时读它 —— 必须是同一份，否则改动会被保存丢弃。
  const [userDisplayConfig, setUserDisplayConfig] = React.useState<UserDisplayConfig[]>([]);

  // Refs
  const authPanelRef = React.useRef<AuthConfigPanelHandle>(null);
  const savedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete confirm dialog state
  type DeleteType = "endpoint" | "param" | "responseMapping" | "headerConfig" | "iconGroup" | "icon" | "reset" | null;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteConfirmType, setDeleteConfirmType] = React.useState<DeleteType>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<any>(null);

  // Auth panel registers its delete executor so shell can call it on confirm
  const authDeleteExecRef = React.useRef<((type: string, target: any) => void) | null>(null);

  // Icon store
  const {
    groups,
    icons,
    loading: iconsLoading,
    fetchAllGroups,
    fetchAllIcons,
    uploadIcon,
    saveIcon,
    deleteIcon,
    saveGroup,
    deleteGroup,
  } = useIconStore();

  const [iconFileUrls, setIconFileUrls] = React.useState<Record<string, string>>({});

  // Initialize on open
  React.useEffect(() => {
    if (open) {
      try {
        // 打开设置时先回填已保存的展示配置，否则面板恒显「不显示」，看不到已保存内容
        setUserDisplayConfig(useAuthStore.getState().webhook?.userDisplayConfig ?? []);
        authPanelRef.current?.reinitialize();
        fetchAllGroups();
        fetchAllIcons();
      } catch (err) {
        console.error("[SettingsDrawer] Failed to initialize settings:", err);
        if (err instanceof Error) {
          setError(`初始化设置失败: ${err.message}`);
        } else {
          setError("初始化设置失败: 未知错误");
        }
      }
    }
  }, [open]);

  // Refresh icon file URLs
  const refreshIconFileUrls = async () => {
    try {
      const urls = await iconsApi.getIconFileUrls();
      setIconFileUrls(urls);
    } catch {
      setIconFileUrls({});
    }
  };

  React.useEffect(() => {
    if (icons.length > 0) {
      refreshIconFileUrls();
    }
  }, [icons]);

  React.useEffect(() => {
    if (open) {
      refreshIconFileUrls();
    }
  }, [open]);

  // Panel change handler
  const handlePanelChange =
    (panel: string) =>
    (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedPanels((prev) =>
        isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
      );
    };

  // Alert helpers
  const handleSetError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const handleSetSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 5000);
  };

  // AuthConfigPanel 侧整体回写（初始化 / 预设切换时把已保存配置顶上来），保持引用稳定
  const applyUserDisplayConfig = React.useCallback((config: UserDisplayConfig[]) => {
    setUserDisplayConfig(Array.isArray(config) ? config : []);
  }, []);

  // User display config handler
  const handleUserDisplayConfigChange = (
    cacheKey: string,
    displayType: UserDisplayType,
    customLabel?: string
  ) => {
    setUserDisplayConfig((prev: UserDisplayConfig[]) => {
      const existingIndex = prev.findIndex((c) => c.cacheKey === cacheKey);
      if (existingIndex >= 0) {
        if (displayType === "none") {
          return prev.filter((_, i) => i !== existingIndex);
        }
        return prev.map((c, i) =>
          i === existingIndex
            ? { ...c, displayType, customLabel: displayType === "custom" ? customLabel : undefined }
            : c
        );
      } else if (displayType !== "none") {
        return [...prev, { cacheKey, displayType, customLabel: displayType === "custom" ? customLabel : undefined }];
      }
      return prev;
    });
  };

  // --- Delete confirm pattern ---
  // Panels request deletion → shell shows dialog → shell executes on confirm

  const pendingDeleteRef = React.useRef<{ type: string; target: any } | null>(null);

  const handleDeleteRequest = (type: string, target: any) => {
    setDeleteConfirmType(type as DeleteType);
    setDeleteTarget(target);
    pendingDeleteRef.current = { type, target };
    setDeleteConfirmOpen(true);
  };

  const cancelDelete = () => {
    setDeleteConfirmType(null);
    setDeleteTarget(null);
    pendingDeleteRef.current = null;
    setDeleteConfirmOpen(false);
  };

  const confirmDelete = async () => {
    const pending = pendingDeleteRef.current;
    if (!pending) {
      setDeleteConfirmOpen(false);
      return;
    }

    if (pending.type === "reset") {
      await handleReset();
    } else if (pending.type === "iconGroup" && pending.target) {
      try {
        await deleteGroup(pending.target);
      } catch (error) {
        console.error("Failed to delete group:", error);
      }
    } else if (pending.type === "icon" && pending.target) {
      try {
        await deleteIcon(pending.target);
      } catch (error) {
        console.error("Failed to delete icon:", error);
      }
    } else {
      // Auth-related deletes (endpoint, param, responseMapping, headerConfig)
      // Delegate to AuthConfigPanel which manages these as internal state
      authDeleteExecRef.current?.(pending.type, pending.target);
    }

    setDeleteConfirmType(null);
    setDeleteTarget(null);
    pendingDeleteRef.current = null;
    setDeleteConfirmOpen(false);
  };

  // --- Save ---
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const config = authPanelRef.current?.getAuthConfig();
      if (!config) {
        setError("无法获取认证配置");
        return;
      }
      await updateConfig(config);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("[ERROR] Failed to save config:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[ERROR] Error details:", errorMessage);
      setError(`保存配置失败: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // --- Reset ---
  const handleReset = async () => {
    try {
      await reset();
      setResetCounter((c) => c + 1);
    } catch (error) {
      console.error("Failed to reset config:", error);
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        slotProps={{
          paper: { sx: { width: 680, maxWidth: "100%" } },
          backdrop: { onClick: (e) => e.stopPropagation() },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>系统设置</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        {/* Alerts */}
        {saved && <Alert severity="success" sx={{ m: 2, mb: 0 }}>设置已保存</Alert>}
        {success && <Alert severity="success" sx={{ m: 2, mb: 0 }}>{success}</Alert>}
        {error && <Alert severity="error" sx={{ m: 2, mb: 0 }}>{error}</Alert>}

        {/* Content */}
        <Box sx={{ p: 2, overflow: "auto", flexGrow: 1 }}>
          <AuthConfigPanel
            ref={authPanelRef}
            expandedPanels={expandedPanels}
            onPanelChange={handlePanelChange}
            onDeleteRequest={handleDeleteRequest}
            onRegisterDeleteExecutor={(executor) => { authDeleteExecRef.current = executor; }}
            groups={groups}
            icons={icons}
            iconFileUrls={iconFileUrls}
            userDisplayConfig={userDisplayConfig}
            onUserDisplayConfigChange={applyUserDisplayConfig}
            key={`auth-${resetCounter}`}
          />

          <UserDisplayPanel
            expandedPanels={expandedPanels}
            onPanelChange={handlePanelChange}
            userDisplayConfig={userDisplayConfig}
            onUserDisplayConfigChange={handleUserDisplayConfigChange}
            cachedKeys={getUserProfileCandidateKeys()}
            getCachedValue={getCachedValue}
          />

          <Divider sx={{ my: 2 }} />

          <AppearancePanel
            expandedPanels={expandedPanels}
            onPanelChange={handlePanelChange}
            groups={groups}
            icons={icons}
            iconsLoading={iconsLoading}
            iconFileUrls={iconFileUrls}
            uploadIcon={uploadIcon}
            saveIcon={saveIcon}
            saveGroup={saveGroup}
            onError={handleSetError}
            onSuccess={handleSetSuccess}
            onDeleteRequest={handleDeleteRequest}
          />

          <Divider sx={{ my: 2 }} />
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            gap: 1,
            justifyContent: "space-between",
          }}
        >
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              setDeleteConfirmType("reset");
              setDeleteTarget(null);
              pendingDeleteRef.current = { type: "reset", target: null };
              setDeleteConfirmOpen(true);
            }}
          >
            重置
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={onClose}>取消</Button>
            <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存设置"}
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* Shared delete confirm dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={cancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {deleteConfirmType === "endpoint" && "确认删除接口？"}
          {deleteConfirmType === "param" && "确认删除参数？"}
          {deleteConfirmType === "responseMapping" && "确认删除响应映射？"}
          {deleteConfirmType === "headerConfig" && "确认删除请求头配置？"}
          {deleteConfirmType === "iconGroup" && (groups.find((g) => g.id === deleteTarget && !g.parent_id)
            ? "确认删除分组？"
            : "确认删除子分组？")}
          {deleteConfirmType === "icon" && "确认删除图标？"}
          {deleteConfirmType === "reset" && "确认重置设置？"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {deleteConfirmType === "endpoint" && "删除后无法恢复，确定要删除这个接口吗？"}
            {deleteConfirmType === "param" && "删除后无法恢复，确定要删除这个参数吗？"}
            {deleteConfirmType === "responseMapping" && "删除后无法恢复，确定要删除这个响应映射吗？"}
            {deleteConfirmType === "headerConfig" && "删除后无法恢复，确定要删除这个请求头配置吗？"}
            {deleteConfirmType === "iconGroup" && (groups.find((g) => g.id === deleteTarget && !g.parent_id)
              ? "删除分组将同时删除该分组下的所有子分组和图标文件，且无法恢复，确定要删除吗？"
              : "删除子分组将同时删除该子分组下的所有图标文件，且无法恢复，确定要删除吗？")}
            {deleteConfirmType === "icon" && "删除后图标文件将从系统中永久移除，无法恢复，确定要删除吗？"}
            {deleteConfirmType === "reset" && "重置将清除所有认证配置并恢复为默认设置，此操作无法撤销，确定要重置吗？"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} color="primary">取消</Button>
          <Button onClick={confirmDelete} color="error" autoFocus>
            {deleteConfirmType === "reset" ? "重置" : "删除"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
