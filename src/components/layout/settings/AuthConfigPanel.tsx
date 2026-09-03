import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import MuiSelect from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import Tooltip from "@mui/material/Tooltip";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import SecurityIcon from "@mui/icons-material/Security";
import DomainIcon from "@mui/icons-material/Domain";
import SettingsIcon from "@mui/icons-material/Settings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useAuthStore, AUTH_PRESETS } from "../../../store/authStore";
import type { AuthPreset, ApiEndpoint, HeaderConfig, ResponseMapping, HttpMethod, SuggestedEndpoint, AuthParam, ParamLocation, HeaderUsage, UserDisplayConfig } from "../../../services/tauri";
import type { MenuIcon as MenuIconType } from "../../../services/tauri";
import { SUGGESTED_HEADERS } from "../../../services/tauri";
import type { IconGroup, SystemIcon } from "../../../services/tauri";
import IconPickerDialog, { renderMenuIcon, PRESET_ICON_NAMES } from "./IconPickerDialog";

// --- Constants ---

const SECRET_PARAMS = ["password", "client_secret", "api_key", "secret"];

const SUGGESTED_MAPPING_GROUPS = [
  {
    id: "token-group",
    label: "📌 令牌映射组",
    mappings: [
      { sourcePath: "", targetKey: "accessToken", saveToCache: true },
      { sourcePath: "", targetKey: "refreshToken", saveToCache: true },
      { sourcePath: "", targetKey: "expiresIn", saveToCache: true },
    ],
  },
  {
    id: "user-group",
    label: "👤 用户信息映射组",
    mappings: [
      { sourcePath: "", targetKey: "userId", saveToCache: true },
      { sourcePath: "", targetKey: "username", saveToCache: true },
      { sourcePath: "", targetKey: "avatar", saveToCache: true },
    ],
  },
  {
    id: "tenant-group",
    label: "🏢 租户信息映射组",
    mappings: [
      { sourcePath: "", targetKey: "tenantId", saveToCache: true },
      { sourcePath: "", targetKey: "tenantName", saveToCache: true },
    ],
  },
];

const PRESET_ICONS: Record<AuthPreset, React.ReactNode> = {
  keycloak: <DomainIcon />,
  auth0: <SecurityIcon />,
  internal: <VpnKeyIcon />,
  custom: <SettingsIcon />,
};

const PRESET_COLORS: Record<AuthPreset, string> = {
  keycloak: "#7c4dff",
  auth0: "#eb5424",
  internal: "#2196f3",
  custom: "#ff9800",
};

const generateId = () => Math.random().toString(36).substring(2, 9);

// --- Types ---

export interface AuthConfigData {
  enabled: boolean;
  preset: AuthPreset;
  authParams: AuthParam[];
  webhook: {
    baseUrl: string;
    endpoints: ApiEndpoint[];
    headerConfig: HeaderConfig[];
    userDisplayConfig: UserDisplayConfig[];
    request: { timeout: number; headers: Record<string, string> };
    token: { storage: "localStorage" | "sessionStorage" | "memory"; key: string; header: string; prefix: string };
    refresh: { enabled: boolean; threshold: number };
  };
}

export interface AuthConfigPanelHandle {
  getAuthConfig: () => AuthConfigData;
  reinitialize: () => void;
}

interface AuthConfigPanelProps {
  expandedPanels: string[];
  onPanelChange: (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => void;
  onDeleteRequest: (type: string, target: any) => void;
  onRegisterDeleteExecutor: (executor: (type: string, target: any) => void) => void;
  groups: IconGroup[];
  icons: SystemIcon[];
  iconFileUrls: Record<string, string>;
  /**
   * 用户信息展示配置由外层（SettingsDrawer）单一持有：
   * 编辑在 UserDisplayPanel、保存在本面板的 getAuthConfig，必须读写同一份，
   * 否则面板改动会在保存时被丢弃。
   */
  userDisplayConfig: UserDisplayConfig[];
  onUserDisplayConfigChange: (config: UserDisplayConfig[]) => void;
}

const AuthConfigPanel = React.forwardRef<AuthConfigPanelHandle, AuthConfigPanelProps>(
  function AuthConfigPanel({ expandedPanels, onPanelChange, onDeleteRequest, onRegisterDeleteExecutor, groups, icons, iconFileUrls, userDisplayConfig, onUserDisplayConfigChange }, ref) {
    const { enabled, preset, authParams, webhook, loadPresetConfig } = useAuthStore();

    // Register delete executor so the shell can call us on confirm
    React.useEffect(() => {
      const executor = (type: string, target: any) => {
        if (type === "endpoint" && target) {
          setEndpoints((prev) => prev.filter((e) => e.id !== target));
        } else if (type === "param" && target !== null) {
          setParams((prev) => prev.filter((_, i) => i !== target));
        } else if (type === "responseMapping" && target) {
          const { endpointId, index } = target;
          setEndpoints((prev) =>
            prev.map((e) =>
              e.id === endpointId
                ? { ...e, responseMapping: e.responseMapping.filter((_, i) => i !== index) }
                : e
            )
          );
        } else if (type === "headerConfig" && target) {
          setHeaderConfigs((prev) => prev.filter((h) => h.id !== target));
        }
      };
      onRegisterDeleteExecutor(executor);
    }, [onRegisterDeleteExecutor]);

    const [authEnabled, setAuthEnabled] = React.useState(false);
    const [selectedPreset, setSelectedPreset] = React.useState<AuthPreset>("custom");
    const [params, setParams] = React.useState<AuthParam[]>([]);
    const [baseUrl, setBaseUrl] = React.useState("");
    const [endpoints, setEndpoints] = React.useState<ApiEndpoint[]>([]);
    const [headerConfigs, setHeaderConfigs] = React.useState<HeaderConfig[]>([]);
    const [timeout, setTimeoutValue] = React.useState(10000);
    const [tokenStorage, setTokenStorage] = React.useState<string>("localStorage");
    const [tokenKey, setTokenKey] = React.useState("accessToken");
    const [tokenHeader, setTokenHeader] = React.useState("Authorization");
    const [tokenPrefix, setTokenPrefix] = React.useState("Bearer ");
    const [refreshEnabled, setRefreshEnabled] = React.useState(true);
    const [refreshThreshold, setRefreshThreshold] = React.useState(300);
    // 注：userDisplayConfig 由外部持有（受控），此处不再自建 state，避免两份状态互相覆盖/丢失。

    const [menuIconSelectOpen, setMenuIconSelectOpen] = React.useState(false);
    const [menuIconSelectEndpoint, setMenuIconSelectEndpoint] = React.useState<string | null>(null);

    // Initialize from store
    const initFromStore = React.useCallback(() => {
      setAuthEnabled(enabled ?? false);
      setSelectedPreset(preset ?? "custom");
      setBaseUrl(webhook?.baseUrl ?? "");
      const rawEndpoints = Array.isArray(webhook?.endpoints) ? webhook.endpoints : [];
      const processedEndpoints = rawEndpoints.map((e, index) => ({
        id: e.id ?? `endpoint-${index}`,
        name: e.name ?? "",
        path: e.path ?? "",
        method: e.method ?? "POST",
        responseMapping: Array.isArray(e.responseMapping) ? e.responseMapping : [],
        bindToMenu: e.bindToMenu ?? false,
        menuIcon: e.menuIcon,
        endpointType: e.endpointType,
      }));
      setEndpoints(processedEndpoints);
      setHeaderConfigs(Array.isArray(webhook?.headerConfig) ? webhook.headerConfig : []);
      setTimeoutValue(webhook?.request?.timeout ?? 10000);
      setTokenStorage(webhook?.token?.storage ?? "localStorage");
      setTokenKey(webhook?.token?.key ?? "accessToken");
      setTokenHeader(webhook?.token?.header ?? "Authorization");
      setTokenPrefix(webhook?.token?.prefix ?? "Bearer ");
      setRefreshEnabled(webhook?.refresh?.enabled ?? true);
      setRefreshThreshold(webhook?.refresh?.threshold ?? 300);
      onUserDisplayConfigChange(Array.isArray(webhook?.userDisplayConfig) ? webhook.userDisplayConfig : []);
      setParams(Array.isArray(authParams) ? authParams : []);
    }, [enabled, preset, authParams, webhook, onUserDisplayConfigChange]);

    React.useImperativeHandle(ref, () => ({
      getAuthConfig: (): AuthConfigData => ({
        enabled: authEnabled,
        preset: selectedPreset,
        authParams: params,
        webhook: {
          baseUrl,
          endpoints,
          headerConfig: headerConfigs,
          userDisplayConfig,
          request: { timeout, headers: { "Content-Type": "application/json" } },
          token: {
            storage: tokenStorage as "localStorage" | "sessionStorage" | "memory",
            key: tokenKey,
            header: tokenHeader,
            prefix: tokenPrefix,
          },
          refresh: { enabled: refreshEnabled, threshold: refreshThreshold },
        },
      }),
      reinitialize: initFromStore,
    }), [authEnabled, selectedPreset, params, baseUrl, endpoints, headerConfigs, userDisplayConfig, timeout, tokenStorage, tokenKey, tokenHeader, tokenPrefix, refreshEnabled, refreshThreshold, initFromStore]);

    // --- Handlers ---

    const handlePresetChange = async (newPreset: AuthPreset) => {
      setSelectedPreset(newPreset);
      const savedConfig = await loadPresetConfig(newPreset);
      if (savedConfig) {
        setAuthEnabled(authEnabled || (savedConfig.enabled ?? false));
        setBaseUrl(savedConfig.baseUrl ?? "");
        setParams(savedConfig.authParams ?? []);
        setEndpoints(savedConfig.endpoints ?? []);
        setHeaderConfigs(savedConfig.headerConfig ?? []);
        onUserDisplayConfigChange(savedConfig.userDisplayConfig ?? []);
        setTimeoutValue(savedConfig.timeout ?? 10000);
        setTokenStorage(savedConfig.tokenStorage ?? "localStorage");
        setTokenKey(savedConfig.tokenKey ?? "accessToken");
        setTokenHeader(savedConfig.tokenHeader ?? "Authorization");
        setTokenPrefix(savedConfig.tokenPrefix ?? "Authorization");
        setRefreshEnabled(savedConfig.refreshEnabled ?? true);
        setRefreshThreshold(savedConfig.refreshThreshold ?? 300);
      } else {
        setAuthEnabled(authEnabled || false);
        setBaseUrl("");
        setParams([]);
        setEndpoints([]);
        setHeaderConfigs([]);
        onUserDisplayConfigChange([]);
        setTimeoutValue(10000);
        setTokenStorage("localStorage");
        setTokenKey("accessToken");
        setTokenHeader("Authorization");
        setTokenPrefix("Bearer ");
        setRefreshEnabled(true);
        setRefreshThreshold(300);
      }
    };

    const handleAddParam = (event: React.MouseEvent) => {
      event.stopPropagation();
      const newParam: AuthParam = { id: generateId(), key: "", label: "", value: "", location: "body", required: false };
      setParams((prev) => [...prev, newParam]);
    };

    const handleRemoveParam = (index: number) => {
      onDeleteRequest("param", index);
    };

    const handleParamChange = (index: number, field: keyof AuthParam, value: string | ParamLocation | boolean) => {
      setParams((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const handleAddSuggestedParam = (event: React.MouseEvent, suggestedParam: { key: string; label: string; location: ParamLocation; required: boolean; description?: string }) => {
      event.stopPropagation();
      const exists = params.some((p) => p.key === suggestedParam.key);
      if (!exists) {
        const newParam: AuthParam = { id: generateId(), key: suggestedParam.key, label: suggestedParam.label, value: "", location: suggestedParam.location, required: suggestedParam.required, description: suggestedParam.description };
        setParams((prev) => [...prev, newParam]);
      }
    };

    const handleAddEndpoint = (event: React.MouseEvent) => {
      event.stopPropagation();
      const newEndpoint: ApiEndpoint = { id: generateId(), name: "", path: "", method: "POST", responseMapping: [], bindToMenu: false };
      setEndpoints((prev) => [...prev, newEndpoint]);
    };

    const handleRemoveEndpoint = (id: string) => {
      onDeleteRequest("endpoint", id);
    };

    const handleEndpointChange = (id: string, field: keyof ApiEndpoint, value: string | HttpMethod | ResponseMapping[] | boolean | MenuIconType | "login" | "logout" | "other") => {
      setEndpoints((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          const updated = { ...e, [field]: value };
          if (field === "bindToMenu" && value === true && !e.menuIcon) {
            updated.menuIcon = "login";
          }
          return updated;
        })
      );
    };

    const handleAddSuggestedEndpoint = (suggested: SuggestedEndpoint) => {
      const exists = endpoints.some((e) => e.name === suggested.name);
      if (!exists) {
        const newEndpoint: ApiEndpoint = {
          id: generateId(),
          name: suggested.name,
          path: suggested.path,
          method: suggested.method,
          responseMapping: suggested.suggestedMappings.map((m) => ({ sourcePath: m.sourcePath, targetKey: m.targetKey, saveToCache: true })),
          bindToMenu: suggested.bindToMenu,
          menuIcon: suggested.menuIcon,
        };
        setEndpoints((prev) => [...prev, newEndpoint]);
      }
    };

    const handleAddResponseMapping = (endpointId: string) => {
      const newMapping: ResponseMapping = { sourcePath: "", targetKey: "", saveToCache: true };
      setEndpoints((prev) => prev.map((e) => e.id === endpointId ? { ...e, responseMapping: [...e.responseMapping, newMapping] } : e));
    };

    const handleAddMappingGroup = (endpointId: string, group: typeof SUGGESTED_MAPPING_GROUPS[number]) => {
      const existingTargetKeys = new Set(endpoints.find(e => e.id === endpointId)?.responseMapping.map(m => m.targetKey) || []);
      const newMappings = group.mappings.filter(m => !existingTargetKeys.has(m.targetKey));
      if (newMappings.length > 0) {
        setEndpoints((prev) => prev.map((e) => e.id === endpointId ? { ...e, responseMapping: [...e.responseMapping, ...newMappings] } : e));
      }
    };

    const handleRemoveResponseMapping = (endpointId: string, index: number) => {
      onDeleteRequest("responseMapping", { endpointId, index });
    };

    const handleResponseMappingChange = (endpointId: string, index: number, field: keyof ResponseMapping, value: string | boolean) => {
      setEndpoints((prev) => prev.map((e) => e.id === endpointId ? { ...e, responseMapping: e.responseMapping.map((m, i) => i === index ? { ...m, [field]: value } : m) } : e));
    };

    const handleAddHeaderConfig = (event: React.MouseEvent) => {
      event.stopPropagation();
      const newConfig: HeaderConfig = { id: generateId(), headerName: "", valueTemplate: "", usage: "both" };
      setHeaderConfigs((prev) => [...prev, newConfig]);
    };

    const handleAddSuggestedHeader = (event: React.MouseEvent, suggestedHeader: typeof SUGGESTED_HEADERS[keyof typeof SUGGESTED_HEADERS]) => {
      event.stopPropagation();
      const newConfig: HeaderConfig = { id: generateId(), headerName: suggestedHeader.headerName, valueTemplate: suggestedHeader.valueTemplate, usage: "both" };
      setHeaderConfigs((prev) => [...prev, newConfig]);
    };

    const handleRemoveHeaderConfig = (id: string) => {
      onDeleteRequest("headerConfig", id);
    };

    const handleHeaderConfigChange = (id: string, field: keyof HeaderConfig, value: string | HeaderUsage) => {
      setHeaderConfigs((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
    };

    // --- Computed ---

    const currentPresetConfig = AUTH_PRESETS[selectedPreset] || AUTH_PRESETS.custom;
    const existingParamKeys = new Set(params.map((p) => p.key));
    const availableSuggestedParams = currentPresetConfig.suggestedParams.filter((p) => !existingParamKeys.has(p.key));
    const existingEndpointNames = new Set(endpoints.map((e) => e.name));
    const availableSuggestedEndpoints = currentPresetConfig.suggestedEndpoints.filter((e) => !existingEndpointNames.has(e.name));
    const showAuthConfig = authEnabled;
    const serviceAddressLabel = showAuthConfig ? "认证服务地址" : "后端服务地址";

    return (
      <>
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>认证配置</Typography>
              <Typography variant="caption" color="text.secondary">配置认证服务</Typography>
            </Box>
            <Switch checked={authEnabled} onChange={(e) => setAuthEnabled(e.target.checked)} />
          </Box>

          {authEnabled && (
            <>
              <Divider sx={{ my: 2 }} />

              {/* Preset templates */}
              <Accordion expanded={expandedPanels.includes("preset")} onChange={onPanelChange("preset")} disableGutters sx={{ mb: 1, "&:before": { display: "none" }, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div">
                  <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>📋 预设模板</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
                    {(Object.entries(AUTH_PRESETS) as [AuthPreset, typeof AUTH_PRESETS[AuthPreset]][]).map(([key, config]) => {
                      const isSelected = selectedPreset === key;
                      const color = PRESET_COLORS[key];
                      return (
                        <Paper key={key} onClick={() => handlePresetChange(key)} sx={{ p: 1.5, cursor: "pointer", border: "2px solid", borderColor: isSelected ? color : "divider", borderRadius: 2, bgcolor: isSelected ? `${color}10` : "background.paper", transition: "all 0.2s", position: "relative", "&:hover": { borderColor: color, bgcolor: `${color}08` } }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                            <Box sx={{ color: isSelected ? color : "text.secondary", display: "flex", alignItems: "center" }}>{PRESET_ICONS[key]}</Box>
                            <Typography variant="body2" sx={{ fontWeight: isSelected ? 600 : 500, color: isSelected ? color : "text.primary" }}>{config.label}</Typography>
                            {isSelected && <CheckCircleIcon sx={{ fontSize: 16, color, ml: "auto" }} />}
                          </Box>
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1.3 }}>{config.description}</Typography>
                        </Paper>
                      );
                    })}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* Service address */}
              <Accordion expanded={expandedPanels.includes("service")} onChange={onPanelChange("service")} disableGutters sx={{ mb: 1, "&:before": { display: "none" }, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div">
                  <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>🌐 服务地址</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField fullWidth label={serviceAddressLabel} placeholder="https://your-server.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} size="small" />
                </AccordionDetails>
              </Accordion>

              {showAuthConfig && (
                <>
                  {/* Auth params */}
                  <Accordion expanded={expandedPanels.includes("params")} onChange={onPanelChange("params")} disableGutters sx={{ mb: 1, "&:before": { display: "none" }, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", pr: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>🔑 认证参数</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={(e) => { e.stopPropagation(); handleAddParam(e); }}>添加</Button>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
                        <Typography variant="caption">💡 配置登录认证时传递的参数</Typography>
                      </Alert>
                      {availableSuggestedParams.length > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5, flexWrap: "wrap" }}>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">建议参数:</Typography>
                          {availableSuggestedParams.map((suggestedParam) => (
                            <Chip key={suggestedParam.key} label={suggestedParam.label || suggestedParam.key} size="small" variant="outlined" onClick={(event) => handleAddSuggestedParam(event, suggestedParam)} sx={{ height: 22, fontSize: 11, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }} />
                          ))}
                        </Box>
                      )}
                      {params.map((item, index) => (
                        <Box key={item.id || index} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
                          <TextField size="small" placeholder="参数名" value={item.key} onChange={(e) => handleParamChange(index, "key", e.target.value)} sx={{ flex: 1 }} />
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <MuiSelect value={item.location} onChange={(e) => handleParamChange(index, "location", e.target.value as ParamLocation)} displayEmpty sx={{ fontSize: 12 }}>
                              <MenuItem value="body">请求体</MenuItem>
                              <MenuItem value="query">URL参数</MenuItem>
                              <MenuItem value="formData">表单数据</MenuItem>
                            </MuiSelect>
                          </FormControl>
                          <TextField size="small" placeholder="参数值" value={item.value} onChange={(e) => handleParamChange(index, "value", e.target.value)} type={SECRET_PARAMS.some((s) => item.key.toLowerCase().includes(s)) ? "password" : "text"} sx={{ flex: 1 }} />
                          <IconButton size="small" onClick={() => handleRemoveParam(index)}><DeleteIcon fontSize="small" /></IconButton>
                        </Box>
                      ))}
                      {params.length === 0 && (
                        <Typography variant="caption" color="text.secondary">暂无参数，点击"添加"或选择建议参数</Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>

                  {/* Headers */}
                  <Accordion expanded={expandedPanels.includes("headers")} onChange={onPanelChange("headers")} disableGutters sx={{ mb: 1, "&:before": { display: "none" }, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", pr: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>📝 请求头配置</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={(e) => { e.stopPropagation(); handleAddHeaderConfig(e); }}>添加配置</Button>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
                        <Typography variant="caption">💡 配置访问后端API时的请求头</Typography>
                      </Alert>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>💡 建议请求头（点击添加）:</Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {Object.entries(SUGGESTED_HEADERS).map(([key, header]) => (
                            <Chip key={key} label={header.label} size="small" onClick={(event) => handleAddSuggestedHeader(event, header)} sx={{ cursor: "pointer", "&:hover": { bgcolor: "primary.light", color: "white" } }} />
                          ))}
                        </Box>
                      </Box>
                      {headerConfigs.length === 0 && (
                        <Typography variant="caption" color="text.secondary">暂无配置，点击上方建议标签或"添加配置"设置请求头</Typography>
                      )}
                      {headerConfigs.map((config) => (
                        <Box key={config.id} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <MuiSelect value={config.usage || "both"} onChange={(e) => handleHeaderConfigChange(config.id, "usage", e.target.value)} displayEmpty sx={{ fontSize: 12 }}>
                              <MenuItem value="auth">认证请求</MenuItem>
                              <MenuItem value="api">API请求</MenuItem>
                              <MenuItem value="both">两者都用</MenuItem>
                            </MuiSelect>
                          </FormControl>
                          <TextField size="small" label="请求头名称" value={config.headerName} onChange={(e) => handleHeaderConfigChange(config.id, "headerName", e.target.value)} placeholder="Authorization" sx={{ flex: 1 }} />
                          <TextField size="small" label="值模板" value={config.valueTemplate} onChange={(e) => handleHeaderConfigChange(config.id, "valueTemplate", e.target.value)} placeholder="Bearer ${auth_token}" sx={{ flex: 1 }} />
                          <IconButton size="small" onClick={() => handleRemoveHeaderConfig(config.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </Box>
                      ))}
                      {headerConfigs.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>使用 ${"{"}缓存键名{"}"} 引用已保存的数据</Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>

                  <Divider sx={{ my: 2 }} />

                  {/* Storage */}
                  <Accordion expanded={expandedPanels.includes("storage")} onChange={onPanelChange("storage")} disableGutters sx={{ mb: 1, "&:before": { display: "none" }, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div">
                      <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>💾 存储配置</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                        <TextField fullWidth label="接口请求超时时间" type="number" value={timeout} onChange={(e) => setTimeoutValue(Number(e.target.value))} helperText="请求后端接口超时时间" size="small" />
                        <FormControl fullWidth size="small">
                          <InputLabel>存储方式</InputLabel>
                          <MuiSelect value={tokenStorage} label="存储方式" onChange={(e) => setTokenStorage(e.target.value)}>
                            <MenuItem value="localStorage">localStorage</MenuItem>
                            <MenuItem value="sessionStorage">sessionStorage</MenuItem>
                            <MenuItem value="memory">内存</MenuItem>
                          </MuiSelect>
                        </FormControl>
                        <TextField fullWidth label="主令牌存储键名" value={tokenKey} onChange={(e) => setTokenKey(e.target.value)} placeholder="默认: accessToken" helperText="指定认证令牌的存储键名" size="small" />
                      </Box>
                    </AccordionDetails>
                  </Accordion>

                  <Divider sx={{ my: 2 }} />

                  {/* Endpoints */}
                  <Accordion expanded={expandedPanels.includes("endpoints")} onChange={onPanelChange("endpoints")} disableGutters sx={{ mb: 1, "&:before": { display: "none" }, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", pr: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>🔗 接口端点</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={(e) => { e.stopPropagation(); handleAddEndpoint(e); }}>添加接口</Button>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      {availableSuggestedEndpoints.length > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5, flexWrap: "wrap" }}>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">建议接口:</Typography>
                          {availableSuggestedEndpoints.map((endpoint) => (
                            <Chip key={endpoint.name} label={endpoint.name} size="small" variant="outlined" onClick={() => handleAddSuggestedEndpoint(endpoint)} sx={{ height: 22, fontSize: 11, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }} />
                          ))}
                        </Box>
                      )}
                      {endpoints.length === 0 && (
                        <Typography variant="caption" color="text.secondary">暂无接口，点击"添加接口"或选择建议接口</Typography>
                      )}
                      {endpoints.map((endpoint) => (
                        <Accordion key={endpoint.id} sx={{ mb: 1, position: "relative" }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div" sx={{ pr: 7 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{endpoint.name || "未命名接口"}</Typography>
                              <Chip label={endpoint.method} size="small" sx={{ height: 20, fontSize: 10, bgcolor: endpoint.method === "GET" ? "#4caf50" : endpoint.method === "POST" ? "#2196f3" : endpoint.method === "PUT" ? "#ff9800" : "#f44336", color: "white" }} />
                              {endpoint.bindToMenu && <Chip size="small" label="菜单" color="secondary" variant="outlined" />}
                              <Box onClick={(e) => { e.stopPropagation(); handleRemoveEndpoint(endpoint.id); }} sx={{ ml: "auto", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "text.secondary", "&:hover": { bgcolor: "action.hover", color: "error.main" } }}>
                                <DeleteIcon fontSize="small" />
                              </Box>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                              <TextField size="small" label="接口名称" value={endpoint.name} onChange={(e) => handleEndpointChange(endpoint.id, "name", e.target.value)} sx={{ flex: 1 }} />
                              <FormControl size="small" sx={{ width: 100 }}>
                                <InputLabel>方法</InputLabel>
                                <MuiSelect value={endpoint.method} label="方法" onChange={(e) => handleEndpointChange(endpoint.id, "method", e.target.value as HttpMethod)}>
                                  <MenuItem value="GET">GET</MenuItem>
                                  <MenuItem value="POST">POST</MenuItem>
                                  <MenuItem value="PUT">PUT</MenuItem>
                                  <MenuItem value="DELETE">DELETE</MenuItem>
                                </MuiSelect>
                              </FormControl>
                            </Box>
                            <TextField fullWidth size="small" label="请求路径" value={endpoint.path} onChange={(e) => handleEndpointChange(endpoint.id, "path", e.target.value)} placeholder="/auth/login" sx={{ mb: 2 }} />

                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Checkbox checked={endpoint.bindToMenu} onChange={(e) => handleEndpointChange(endpoint.id, "bindToMenu", e.target.checked)} size="small" />
                                <Typography variant="caption">绑定到用户菜单</Typography>
                              </Box>
                              {endpoint.bindToMenu && (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={renderMenuIcon(endpoint.menuIcon || "login", icons, iconFileUrls)}
                                  endIcon={<ChevronRightIcon sx={{ fontSize: 14 }} />}
                                  onClick={() => {
                                    setMenuIconSelectEndpoint(endpoint.id);
                                    setMenuIconSelectOpen(true);
                                  }}
                                  sx={{ textTransform: "none", borderRadius: 1.5, px: 1.5, py: 0.25, fontSize: "0.8rem", borderColor: "divider", "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }}
                                >
                                  {(() => {
                                    const iconId = endpoint.menuIcon || "login";
                                    if (PRESET_ICON_NAMES[iconId]) return PRESET_ICON_NAMES[iconId];
                                    if (iconId.startsWith("emoji-")) return "Emoji 图标";
                                    if (iconId.startsWith("material-")) return iconId.replace("material-", "");
                                    const icon = icons.find((i) => i.id === iconId);
                                    return icon?.name || "选择图标";
                                  })()}
                                </Button>
                              )}
                              <FormControl size="small" sx={{ minWidth: 150, mt: 1 }} required>
                                <InputLabel>端点类型</InputLabel>
                                <MuiSelect value={endpoint.endpointType || "other"} label="端点类型" onChange={(e) => handleEndpointChange(endpoint.id, "endpointType", e.target.value as "login" | "logout" | "refresh" | "other")}>
                                  <MenuItem value="other">普通功能</MenuItem>
                                  <MenuItem value="login">登录</MenuItem>
                                  <MenuItem value="logout">注销</MenuItem>
                                  <MenuItem value="refresh">令牌刷新</MenuItem>
                                </MuiSelect>
                              </FormControl>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>响应数据映射</Typography>
                              <Button size="small" startIcon={<AddIcon />} onClick={() => handleAddResponseMapping(endpoint.id)}>添加映射</Button>
                            </Box>

                            {endpoint.bindToMenu && endpoint.endpointType === "login" && (
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>💡 建议映射组（点击添加）:</Typography>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                  {SUGGESTED_MAPPING_GROUPS.map((group) => {
                                    const existingTargetKeys = new Set(endpoint.responseMapping.map(m => m.targetKey));
                                    const allAdded = group.mappings.every(m => existingTargetKeys.has(m.targetKey));
                                    return (
                                      <Chip key={group.id} label={group.label} size="small" variant="outlined" onClick={() => handleAddMappingGroup(endpoint.id, group)} disabled={allAdded} sx={{ height: 22, fontSize: 11, cursor: allAdded ? "not-allowed" : "pointer", "&:hover": { bgcolor: allAdded ? "transparent" : "action.hover" }, opacity: allAdded ? 0.5 : 1 }} />
                                    );
                                  })}
                                </Box>
                              </Box>
                            )}

                            {endpoint.responseMapping.length === 0 && (
                              <Typography variant="caption" color="text.secondary">暂无映射，点击"添加映射"或选择建议映射组配置响应数据提取</Typography>
                            )}

                            {endpoint.responseMapping.map((mapping, index) => (
                              <Box key={index} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center", p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
                                <TextField size="small" label="后端路径" value={mapping.sourcePath} onChange={(e) => handleResponseMappingChange(endpoint.id, index, "sourcePath", e.target.value)} placeholder="data.token" sx={{ flex: 1 }} />
                                <TextField size="small" label="存储键名" value={mapping.targetKey} onChange={(e) => handleResponseMappingChange(endpoint.id, index, "targetKey", e.target.value)} placeholder="auth_token" sx={{ flex: 1 }} />
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <Checkbox checked={mapping.saveToCache} onChange={(e) => handleResponseMappingChange(endpoint.id, index, "saveToCache", e.target.checked)} size="small" />
                                  <Typography variant="caption">缓存</Typography>
                                </Box>
                                {endpoint.bindToMenu && (
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Tooltip title="标记此字段为token过期时间，用于自动刷新token">
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                        <Checkbox checked={mapping.isExpirationTime ?? false} onChange={(e) => handleResponseMappingChange(endpoint.id, index, "isExpirationTime", e.target.checked)} size="small" />
                                        <Typography variant="caption">过期时间</Typography>
                                      </Box>
                                    </Tooltip>
                                  </Box>
                                )}
                                <IconButton size="small" onClick={() => handleRemoveResponseMapping(endpoint.id, index)}><DeleteIcon fontSize="small" /></IconButton>
                              </Box>
                            ))}
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                </>
              )}
            </>
          )}
        </Paper>

        {/* Icon picker dialog */}
        <IconPickerDialog
          open={menuIconSelectOpen}
          onClose={() => {
            setMenuIconSelectOpen(false);
            setMenuIconSelectEndpoint(null);
          }}
          onSelectIcon={(iconId) => {
            if (menuIconSelectEndpoint) {
              handleEndpointChange(menuIconSelectEndpoint, "menuIcon", iconId);
              setMenuIconSelectOpen(false);
              setMenuIconSelectEndpoint(null);
            }
          }}
          groups={groups}
          icons={icons}
          iconFileUrls={iconFileUrls}
        />
      </>
    );
  }
);

export default AuthConfigPanel;
