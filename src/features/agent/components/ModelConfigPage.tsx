/**
 * ModelConfigPage —— 三层模型配置（Provider → Endpoint → Model）
 * 交互模式对齐 web-craft ModelConfigPage：层级折叠卡片 + Dialog 编辑 + 连接/对话测试 + 删除确认 + Snackbar
 */
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Snackbar,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { useAgentStore } from "../store/agentStore";
import type { AiEndpoint, AiModel, AiProvider } from "../proto/agent";

// 供应商颜色圆点（名称哈希 → 确定性颜色，视觉区分多供应商）
const PROVIDER_COLORS = [
  "#60A5FA", "#38BDF8", "#00E676", "#FBBF24", "#FF6B6B",
  "#26C6DA", "#AB47BC", "#FFA726", "#66BB6A", "#5C6BC0",
];
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function ProviderDot({ name, size = 10 }: { name: string; size?: number }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: "50%", bgcolor: PROVIDER_COLORS[hashString(name || "?") % PROVIDER_COLORS.length], flexShrink: 0 }} />
  );
}

const inputSx = { "& .MuiInputBase-input": { fontSize: 12 } } as const;

// ── Provider 编辑 Dialog ──
function ProviderDialog({
  open, onClose, onSave, initial,
}: { open: boolean; onClose: () => void; onSave: (p: AiProvider) => void; initial: AiProvider | null }) {
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setApiKey(initial.apiKey);
      setEnabled(initial.enabled);
    } else {
      setName("");
      setApiKey("");
      setEnabled(true);
    }
  }, [initial, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id || "",
      name: name.trim(),
      apiKey: apiKey.trim(),
      enabled,
      createdAt: initial?.createdAt || "",
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15 }}>{initial ? "编辑供应商" : "添加供应商"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "12px !important" }}>
        <TextField label="供应商名称" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" placeholder="如 OpenAI / DeepSeek / 硅基流动" />
        <TextField
          label="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          fullWidth size="small"
          type={showKey ? "text" : "password"}
          placeholder="sk-..."
          helperText="留空 = 免鉴权（内网本地模型/网关常用）"
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowKey((v) => !v)} edge="end">
                    {showKey ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} size="small" />
          <Typography sx={{ fontSize: 12 }}>启用</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">取消</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={!name.trim()}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Endpoint 编辑 Dialog ──
function EndpointDialog({
  open, onClose, onSave, initial, providerId, providers,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (e: AiEndpoint) => void;
  initial: AiEndpoint | null;
  providerId: string;
  providers: AiProvider[];
}) {
  const [pid, setPid] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [insecure, setInsecure] = useState(false);

  useEffect(() => {
    if (initial) {
      setPid(initial.providerId);
      setName(initial.name || "");
      setBaseUrl(initial.baseUrl);
      setEnabled(initial.enabled);
      setInsecure(initial.insecure ?? false);
    } else {
      setPid(providerId || providers[0]?.id || "");
      setName("");
      setBaseUrl("");
      setEnabled(true);
      setInsecure(false);
    }
  }, [initial, open, providerId, providers]);

  const handleSave = () => {
    if (!pid || !baseUrl.trim()) return;
    onSave({ id: initial?.id || "", providerId: pid, name: name.trim() || baseUrl.trim(), baseUrl: baseUrl.trim(), enabled, insecure, createdAt: initial?.createdAt || "" });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15 }}>{initial ? "编辑端点" : "添加端点"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "12px !important" }}>
        <TextField
          select label="所属供应商" value={pid} onChange={(e) => setPid(e.target.value)}
          fullWidth size="small" sx={inputSx}
        >
          {providers.map((p) => (
            <MenuItem key={p.id} value={p.id} sx={{ fontSize: 12 }}>{p.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="端点名称" value={name} onChange={(e) => setName(e.target.value)}
          fullWidth size="small" placeholder="如：OpenAI 官方 / 硅基流动 / 本地服务"
          helperText="留空则显示 URL"
        />
        <TextField
          label="Base URL（OpenAI 兼容）" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
          fullWidth size="small" placeholder="https://api.openai.com/v1"
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} size="small" />
          <Typography sx={{ fontSize: 12 }}>启用</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Switch checked={insecure} onChange={(e) => setInsecure(e.target.checked)} size="small" />
          <Typography sx={{ fontSize: 12 }}>跳过证书校验（内网自签 https 网关）</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">取消</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={!pid || !baseUrl.trim()}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Model 编辑 Dialog ──
function ModelDialog({
  open, onClose, onSave, initial, endpointId, endpoints,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (m: AiModel) => void;
  initial: AiModel | null;
  endpointId: string;
  endpoints: AiEndpoint[];
}) {
  const [eid, setEid] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (initial) {
      setEid(initial.endpointId);
      setName(initial.modelName);
    } else {
      setEid(endpointId || endpoints[0]?.id || "");
      setName("");
    }
  }, [initial, open, endpointId, endpoints]);

  const handleSave = () => {
    if (!eid || !name.trim()) return;
    onSave({ id: initial?.id || "", endpointId: eid, modelName: name.trim(), createdAt: initial?.createdAt || "" });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15 }}>{initial ? "编辑模型" : "添加模型"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "12px !important" }}>
        <TextField
          select label="所属端点" value={eid} onChange={(e) => setEid(e.target.value)}
          fullWidth size="small" sx={inputSx}
        >
          {endpoints.map((e) => (
            <MenuItem key={e.id} value={e.id} sx={{ fontSize: 12 }}>
              {e.name || e.baseUrl}
              {e.name && e.baseUrl !== e.name && (
                <Typography component="span" sx={{ fontSize: 10, color: "text.disabled", ml: 1 }}>{e.baseUrl}</Typography>
              )}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="模型名称" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" placeholder="gpt-4o-mini / deepseek-chat" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">取消</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={!eid || !name.trim()}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── 主页面 ──
export default function ModelConfigPage() {
  const store = useAgentStore();
  const { providers, endpoints, models, activeModelId, error } = store;

  const [providerDialog, setProviderDialog] = useState<{ open: boolean; data: AiProvider | null }>({ open: false, data: null });
  const [endpointDialog, setEndpointDialog] = useState<{ open: boolean; data: AiEndpoint | null; providerId: string }>({ open: false, data: null, providerId: "" });
  const [modelDialog, setModelDialog] = useState<{ open: boolean; data: AiModel | null; endpointId: string }>({ open: false, data: null, endpointId: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: "", message: "", onConfirm: () => {} });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });
  const [testResults, setTestResults] = useState<Map<string, { success: boolean; message: string }>>(new Map());
  const [testingId, setTestingId] = useState<string | null>(null);
  const [modelTestResults, setModelTestResults] = useState<Map<string, { success: boolean; message: string }>>(new Map());
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());

  // 远端模型列表：拉取 → 勾选 → 批量导入
  const [fetchingModelsId, setFetchingModelsId] = useState<string | null>(null);
  const [remoteModels, setRemoteModels] = useState<{
    open: boolean; endpointId: string; endpointName: string;
    list: string[]; selected: Set<string>; loading: boolean; error: string | null;
  }>({ open: false, endpointId: "", endpointName: "", list: [], selected: new Set(), loading: false, error: null });

  useEffect(() => {
    void store.loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) setSnackbar({ open: true, message: error, severity: "error" });
  }, [error]);

  const toggleProvider = (id: string) =>
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleEndpoint = (id: string) =>
    setExpandedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleTestConnection = async (endpointId: string) => {
    setTestingId(endpointId);
    try {
      const result = await import("../services/agent.service").then((s) => s.testEndpointConnection(endpointId));
      setTestResults((prev) => new Map(prev).set(endpointId, { success: true, message: result }));
      setSnackbar({ open: true, message: result, severity: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResults((prev) => new Map(prev).set(endpointId, { success: false, message: msg }));
      setSnackbar({ open: true, message: msg, severity: "error" });
    } finally {
      setTestingId(null);
    }
  };

  const handleTestModel = async (modelId: string) => {
    setTestingModelId(modelId);
    try {
      const result = await import("../services/agent.service").then((s) => s.testModelChat(modelId));
      setModelTestResults((prev) => new Map(prev).set(modelId, { success: true, message: result }));
      setSnackbar({ open: true, message: result, severity: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setModelTestResults((prev) => new Map(prev).set(modelId, { success: false, message: msg }));
      setSnackbar({ open: true, message: msg, severity: "error" });
    } finally {
      setTestingModelId(null);
    }
  };

  const handleSaveProvider = async (p: AiProvider) => {
    await store.saveProvider(p);
    setSnackbar({ open: true, message: "供应商已保存", severity: "success" });
  };
  const handleSaveEndpoint = async (e: AiEndpoint) => {
    await store.saveEndpoint(e);
    setSnackbar({ open: true, message: "端点已保存", severity: "success" });
  };
  const handleSaveModel = async (m: AiModel) => {
    await store.saveModel(m);
    setSnackbar({ open: true, message: "模型已保存", severity: "success" });
  };

  const toggleRemoteModel = (name: string) =>
    setRemoteModels((prev) => {
      const next = new Set(prev.selected);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...prev, selected: next };
    });

  const handleFetchRemoteModels = async (endpointId: string, endpointName: string) => {
    setFetchingModelsId(endpointId);
    setRemoteModels({ open: true, endpointId, endpointName, list: [], selected: new Set(), loading: true, error: null });
    try {
      const list = await import("../services/agent.service").then((s) => s.listRemoteModels(endpointId));
      const existing = new Set(models.filter((m) => m.endpointId === endpointId).map((m) => m.modelName));
      const selected = new Set(list.filter((n) => !existing.has(n)));
      setRemoteModels((prev) => ({ ...prev, list, selected, loading: false }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRemoteModels((prev) => ({ ...prev, loading: false, error: msg }));
    } finally {
      setFetchingModelsId(null);
    }
  };

  const handleImportModels = async () => {
    const { endpointId, selected } = remoteModels;
    if (selected.size === 0) return;
    setRemoteModels((prev) => ({ ...prev, loading: true, error: null }));
    try {
      for (const name of selected) {
        await store.saveModel({ id: "", endpointId, modelName: name, createdAt: "" });
      }
      setRemoteModels((prev) => ({ ...prev, loading: false, open: false }));
      setSnackbar({ open: true, message: `已导入 ${selected.size} 个模型`, severity: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRemoteModels((prev) => ({ ...prev, loading: false, error: msg }));
    }
  };

  const confirmDelete = (title: string, message: string, onConfirm: () => void) =>
    setDeleteConfirm({ open: true, title, message, onConfirm });

  return (
    <Box sx={{ p: 1.25, overflow: "auto", height: "100%" }}>
      {/* 顶部：当前模型 + 添加供应商 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          当前模型：
          {(() => {
            const m = models.find((x) => x.id === activeModelId);
            if (!m) return "未配置";
            const ep = endpoints.find((x) => x.id === m.endpointId);
            const pv = providers.find((x) => x.id === ep?.providerId);
            return `${pv?.name ?? "?"} / ${m.modelName}`;
          })()}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small" variant="contained" startIcon={<AddRoundedIcon />} sx={{ fontSize: 11 }}
          onClick={() => setProviderDialog({ open: true, data: null })}
        >
          添加供应商
        </Button>
      </Box>

      {/* 层级折叠卡片 */}
      {providers.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 0.5 }}>还没有配置任何供应商</Typography>
          <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
            添加供应商 → 端点（Base URL）→ 模型，即可开始使用 AI 助手
          </Typography>
        </Box>
      ) : (
        providers.map((p) => {
          const pvEndpoints = endpoints.filter((e) => e.providerId === p.id);
          const expanded = expandedProviders.has(p.id);
          return (
            <Box key={p.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, mb: 1, overflow: "hidden" }}>
              {/* Provider 行 */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.6 }}>
                <IconButton size="small" onClick={() => toggleProvider(p.id)} sx={{ p: 0.25 }}>
                  {expanded ? <KeyboardArrowUpRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                </IconButton>
                <ProviderDot name={p.name} />
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.name}</Typography>
                {!p.enabled && <Chip size="small" label="已停用" sx={{ height: 16, fontSize: 9 }} />}
                <Box sx={{ flex: 1 }} />
                <Tooltip title="编辑"><IconButton size="small" onClick={() => setProviderDialog({ open: true, data: p })}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="删除">
                  <IconButton
                    size="small"
                    onClick={() =>
                      confirmDelete("删除供应商", `将同时删除其下所有端点与模型（${p.name}），确定？`, () => {
                        void store.deleteProvider(p.id);
                      })
                    }
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {/* 端点区（可折叠） */}
              <Collapse in={expanded}>
                <Box sx={{ px: 1, pb: 1 }}>
                  {pvEndpoints.length === 0 && (
                    <Typography sx={{ fontSize: 11, color: "text.disabled", py: 0.5 }}>暂无端点</Typography>
                  )}
                  {pvEndpoints.map((e) => {
                    const epModels = models.filter((m) => m.endpointId === e.id);
                    const epExpanded = expandedEndpoints.has(e.id);
                    const test = testResults.get(e.id);
                    return (
                      <Box key={e.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 0.5 }}>
                        {/* Endpoint 行 */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.75, py: 0.4 }}>
                          <IconButton size="small" onClick={() => toggleEndpoint(e.id)} sx={{ p: 0.25 }}>
                            {epExpanded ? <KeyboardArrowUpRoundedIcon sx={{ fontSize: 14 }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 14 }} />}
                          </IconButton>
                          {/* 端点名为主行，URL 作小字副行 */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 11.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.name || e.baseUrl}
                            </Typography>
                            {e.name && (
                              <Typography sx={{ fontSize: 9.5, fontFamily: "monospace", color: "text.disabled", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {e.baseUrl}
                              </Typography>
                            )}
                          </Box>
                          {!e.enabled && <Chip size="small" label="停用" sx={{ height: 15, fontSize: 9 }} />}
                          <Tooltip title="从远端拉取模型列表（一键添加）">
                            <Button
                              size="small" variant="text" disabled={fetchingModelsId === e.id}
                              onClick={() => void handleFetchRemoteModels(e.id, e.name || e.baseUrl)}
                              sx={{ minWidth: 0, fontSize: 10, px: 0.5 }}
                            >
                              {fetchingModelsId === e.id ? "拉取中…" : "拉取模型"}
                            </Button>
                          </Tooltip>
                          <Tooltip title="测试连接">
                            <Button
                              size="small" variant="text" disabled={testingId === e.id}
                              onClick={() => void handleTestConnection(e.id)}
                              sx={{ minWidth: 0, fontSize: 10, px: 0.5 }}
                            >
                              {testingId === e.id ? "测试中…" : "测试"}
                            </Button>
                          </Tooltip>
                          <Tooltip title="编辑端点"><IconButton size="small" onClick={() => setEndpointDialog({ open: true, data: e, providerId: p.id })}><EditRoundedIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                          <Tooltip title="删除端点">
                            <IconButton
                              size="small"
                              onClick={() =>
                                confirmDelete("删除端点", `将同时删除端点「${e.name || e.baseUrl}」及其下所有模型，确定？`, () => {
                                  void store.deleteEndpoint(e.id);
                                })
                              }
                            >
                              <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        {test && (
                          <Alert severity={test.success ? "success" : "error"} sx={{ mx: 0.75, mb: 0.5, py: 0.25, fontSize: 10 }}>
                            {test.message}
                          </Alert>
                        )}
                        {/* Model 列表（可折叠） */}
                        <Collapse in={epExpanded}>
                          <Box sx={{ px: 0.75, pb: 0.75 }}>
                            {epModels.length === 0 && (
                              <Typography sx={{ fontSize: 10, color: "text.disabled", py: 0.25 }}>暂无模型</Typography>
                            )}
                            {epModels.map((m) => {
                              const active = m.id === activeModelId;
                              const mtest = modelTestResults.get(m.id);
                              return (
                                <Box
                                  key={m.id}
                                  title={mtest ? `${mtest.success ? "成功" : "失败"}: ${mtest.message}` : undefined}
                                  sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.25, px: 0.5, borderRadius: 0.5, "&:hover": { bgcolor: "action.hover" } }}
                                >
                                  <Chip
                                    size="small" label={active ? "当前" : "可用"}
                                    color={active ? "success" : "default"}
                                    variant={active ? "filled" : "outlined"}
                                    sx={{ height: 16, fontSize: 9 }}
                                  />
                                  <Typography sx={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {m.modelName}
                                  </Typography>
                                  <Tooltip title="对话测试">
                                    <Button
                                      size="small" variant="text" disabled={testingModelId === m.id}
                                      onClick={() => void handleTestModel(m.id)}
                                      sx={{ minWidth: 0, fontSize: 10, px: 0.5 }}
                                    >
                                      {testingModelId === m.id ? "…" : <BoltRoundedIcon sx={{ fontSize: 13 }} />}
                                    </Button>
                                  </Tooltip>
                                  <Tooltip title="编辑模型"><IconButton size="small" onClick={() => setModelDialog({ open: true, data: m, endpointId: e.id })}><EditRoundedIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>
                                  <Tooltip title="删除模型">
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        confirmDelete("删除模型", `确定删除模型 ${m.modelName}？`, () => {
                                          void store.deleteModel(m.id);
                                        })
                                      }
                                    >
                                      <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              );
                            })}
                            <Button
                              size="small" startIcon={<AddRoundedIcon />} sx={{ fontSize: 10, mt: 0.25 }}
                              onClick={() => setModelDialog({ open: true, data: null, endpointId: e.id })}
                            >
                              添加模型
                            </Button>
                          </Box>
                        </Collapse>
                      </Box>
                    );
                  })}
                  <Button
                    size="small" startIcon={<AddRoundedIcon />} sx={{ fontSize: 10 }}
                    onClick={() => setEndpointDialog({ open: true, data: null, providerId: p.id })}
                  >
                    添加端点
                  </Button>
                </Box>
              </Collapse>
            </Box>
          );
        })
      )}

      {/* Dialogs */}
      <ProviderDialog
        open={providerDialog.open}
        onClose={() => setProviderDialog({ open: false, data: null })}
        onSave={(p) => void handleSaveProvider(p)}
        initial={providerDialog.data}
      />
      <EndpointDialog
        open={endpointDialog.open}
        onClose={() => setEndpointDialog({ open: false, data: null, providerId: "" })}
        onSave={(e) => void handleSaveEndpoint(e)}
        initial={endpointDialog.data}
        providerId={endpointDialog.providerId}
        providers={providers}
      />
      <ModelDialog
        open={modelDialog.open}
        onClose={() => setModelDialog({ open: false, data: null, endpointId: "" })}
        onSave={(m) => void handleSaveModel(m)}
        initial={modelDialog.data}
        endpointId={modelDialog.endpointId}
        endpoints={endpoints}
      />

      {/* 删除确认 */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, title: "", message: "", onConfirm: () => {} })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15 }}>{deleteConfirm.title}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12 }}>{deleteConfirm.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setDeleteConfirm({ open: false, title: "", message: "", onConfirm: () => {} })}>取消</Button>
          <Button
            size="small" color="error" variant="contained"
            onClick={() => {
              deleteConfirm.onConfirm();
              setDeleteConfirm({ open: false, title: "", message: "", onConfirm: () => {} });
            }}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 远端模型列表：拉取 → 勾选 → 批量导入 */}
      <Dialog open={remoteModels.open} onClose={() => setRemoteModels((p) => ({ ...p, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15 }}>
          远端模型列表
          <Typography component="span" sx={{ fontSize: 11, color: "text.secondary", ml: 1 }}>{remoteModels.endpointName}</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          {remoteModels.loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={24} /></Box>
          ) : remoteModels.error ? (
            <Alert severity="error" sx={{ fontSize: 11 }}>{remoteModels.error}</Alert>
          ) : remoteModels.list.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: "text.secondary", py: 1 }}>未返回任何模型</Typography>
          ) : (
            <Box sx={{ maxHeight: 280, overflow: "auto" }}>
              {remoteModels.list.map((name) => (
                <Box
                  key={name}
                  sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.25, px: 0.5, borderRadius: 0.5, "&:hover": { bgcolor: "action.hover" } }}
                >
                  <Checkbox size="small" checked={remoteModels.selected.has(name)} onChange={() => toggleRemoteModel(name)} />
                  <Typography sx={{ fontSize: 11.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setRemoteModels((p) => ({ ...p, open: false }))} disabled={remoteModels.loading}>取消</Button>
          <Button
            size="small" variant="contained" onClick={() => void handleImportModels()}
            disabled={remoteModels.loading || remoteModels.selected.size === 0}
          >
            导入选中（{remoteModels.selected.size}）
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} sx={{ fontSize: 12 }} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
