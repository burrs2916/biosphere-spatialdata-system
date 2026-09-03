/**
 * DeviceAdapterConfigPanel — 设备接入配置面板
 *
 * 核心理念：
 * - 认证由数据源管理承担，这里不配置认证
 * - 用户从已配置的数据源列表中选择一个，明确关联
 * - 只配置"解读规则"：API 路径、字段映射、分类映射
 * - 无侵入式设计：不预设名称，由用户自行填写
 */
import { useState, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudIcon from "@mui/icons-material/Cloud";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import CircularProgress from "@mui/material/CircularProgress";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { useDataSourceStore } from "../../store/datasourceStore";
import { useDeviceAdapterStore } from "../../store/deviceAdapterStore";
import { useDeviceStore } from "../../store/deviceStore";
import { EdgeConductorProvider } from "../../devices/EdgeConductorProvider";
import type { DeviceAdapter } from "../../types/deviceAdapter";
import type { DataSource } from "../../types/dataSource";

interface DeviceAdapterConfigPanelProps {
  onClose: () => void;
}

export function DeviceAdapterConfigPanel({ onClose }: DeviceAdapterConfigPanelProps) {
  const adapters = useDeviceAdapterStore((s) => s.adapters);
  const addAdapter = useDeviceAdapterStore((s) => s.addAdapter);
  const updateAdapter = useDeviceAdapterStore((s) => s.updateAdapter);
  const removeAdapter = useDeviceAdapterStore((s) => s.removeAdapter);
  const updateRuntime = useDeviceAdapterStore((s) => s.updateRuntime);

  const dataSources = useDataSourceStore((s) => s.dataSources);
  const getDataSource = useDataSourceStore((s) => s.getDataSource);
  const testDsConnection = useDataSourceStore((s) => s.testConnection);

  const setProvider = useDeviceStore((s) => s.setProvider);

  // 数据源连通性测试状态：adapterId → "testing" | "ok" | "fail"
  const [dsTestStatus, setDsTestStatus] = useState<Record<string, "testing" | "ok" | "fail">>({});

  // 测试连接状态
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; deviceCount?: number; error?: string }>>({});

  // 添加新接入
  const handleAdd = useCallback(() => {
    addAdapter("edge-conductor");
  }, [addAdapter]);

  // 测试连接
  const handleTest = useCallback(async (adapter: DeviceAdapter) => {
    setTestingId(adapter.id);
    try {
      const ds = adapter.dataSourceId ? getDataSource(adapter.dataSourceId) : undefined;
      if (!ds) {
        setTestResult((prev) => ({
          ...prev,
          [adapter.id]: { success: false, error: "请先选择数据源" },
        }));
        return;
      }

      const provider = new EdgeConductorProvider(adapter, ds);
      const result = await provider.testConnection();
      setTestResult((prev) => ({ ...prev, [adapter.id]: result }));
      updateRuntime(adapter.id, {
        lastFetchAt: new Date().toISOString(),
        deviceCount: result.deviceCount,
        error: result.error,
      });
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [adapter.id]: { success: false, error: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setTestingId(null);
    }
  }, [getDataSource, updateRuntime]);

  // 应用接入：创建 Provider 并 reload DeviceStore
  const handleApply = useCallback(async (adapter: DeviceAdapter) => {
    const ds = adapter.dataSourceId ? getDataSource(adapter.dataSourceId) : undefined;
    if (!ds) return;

    const provider = new EdgeConductorProvider(adapter, ds);
    try {
      await setProvider(provider);
      updateRuntime(adapter.id, { lastFetchAt: new Date().toISOString() });
    } catch (err) {
      updateRuntime(adapter.id, { error: err instanceof Error ? err.message : String(err) });
    }
  }, [getDataSource, setProvider, updateRuntime]);

  // 计算每个接入关联的数据源
  const linkedDataSources = useMemo(() => {
    const result: Record<string, DataSource | undefined> = {};
    for (const adapter of adapters) {
      result[adapter.id] = adapter.dataSourceId ? getDataSource(adapter.dataSourceId) : undefined;
    }
    return result;
  }, [adapters, getDataSource]);

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 头部 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <IconButton size="small" onClick={onClose}>
          <ArrowBackIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <CloudIcon sx={{ fontSize: 14, color: "primary.main" }} />
        <Typography sx={{ fontSize: 11, fontWeight: 600, flex: 1 }}>
          设备接入配置
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 12 }} />}
          onClick={handleAdd}
          sx={{ fontSize: 9, textTransform: "none" }}
        >
          添加
        </Button>
      </Box>

      {/* 接入列表 */}
      <Box sx={{ flex: 1, overflow: "auto", px: 1, py: 1 }}>
        {adapters.length === 0 ? (
          <Box
            sx={{
              p: 2,
              textAlign: "center",
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <CloudIcon sx={{ fontSize: 32, color: "text.disabled", mb: 1 }} />
            <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 1 }}>
              尚未配置设备接入
            </Typography>
            <Typography sx={{ fontSize: 9, color: "text.disabled", mb: 1.5 }}>
              设备接入定义如何从数据源获取和解读设备信息<br />
              认证由数据源管理承担，这里只配置解读规则
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              sx={{ fontSize: 10, textTransform: "none" }}
            >
              添加设备接入
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {adapters.map((adapter) => (
              <AdapterCard
                key={adapter.id}
                adapter={adapter}
                linkedDs={linkedDataSources[adapter.id]}
                dataSources={dataSources}
                testing={testingId === adapter.id}
                testResult={testResult[adapter.id]}
                dsTestStatus={dsTestStatus[adapter.id]}
                onUpdate={(updates) => updateAdapter(adapter.id, updates)}
                onRemove={() => removeAdapter(adapter.id)}
                onTest={() => handleTest(adapter)}
                onApply={() => handleApply(adapter)}
                onDataSourceChange={(dsId) => {
                  updateAdapter(adapter.id, { dataSourceId: dsId });
                  if (dsId) {
                    setDsTestStatus((prev) => ({ ...prev, [adapter.id]: "testing" }));
                    testDsConnection(dsId)
                      .then((result) => {
                        setDsTestStatus((prev) => ({ ...prev, [adapter.id]: result ? "ok" : "fail" }));
                      })
                      .catch(() => {
                        setDsTestStatus((prev) => ({ ...prev, [adapter.id]: "fail" }));
                      });
                  } else {
                    setDsTestStatus((prev) => {
                      const next = { ...prev };
                      delete next[adapter.id];
                      return next;
                    });
                  }
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** 单个接入配置卡片 */
function AdapterCard({
  adapter,
  linkedDs,
  dataSources,
  testing,
  testResult,
  dsTestStatus,
  onUpdate,
  onRemove,
  onTest,
  onApply,
  onDataSourceChange,
}: {
  adapter: DeviceAdapter;
  linkedDs: DataSource | undefined;
  dataSources: DataSource[];
  testing: boolean;
  testResult?: { success: boolean; deviceCount?: number; error?: string };
  dsTestStatus: "testing" | "ok" | "fail" | undefined;
  onUpdate: (updates: Partial<DeviceAdapter>) => void;
  onRemove: () => void;
  onTest: () => void;
  onApply: () => void;
  onDataSourceChange: (dsId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // 卡片标题：优先用名称，否则用关联数据源的 URL，都没有则显示"未命名"
  const cardTitle = adapter.name
    || (linkedDs ? linkedDs.connection.url : "")
    || "未命名接入";

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      {/* 卡片头部 */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          bgcolor: "action.hover",
          cursor: "pointer",
          "&:hover": { bgcolor: "action.selected" },
        }}
      >
        <CloudIcon sx={{ fontSize: 14, color: "primary.main" }} />
        <Typography sx={{ fontSize: 11, fontWeight: 600, flex: 1 }} noWrap>
          {cardTitle}
        </Typography>
        {/* 数据源关联状态 */}
        {linkedDs ? (
          <Chip
            size="small"
            icon={<LinkIcon sx={{ fontSize: 10 }} />}
            label={linkedDs.name || linkedDs.connection.url}
            color={linkedDs.status === "connected" ? "success" : "default"}
            sx={{ fontSize: 8, height: 16, maxWidth: 120, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }}
          />
        ) : (
          <Chip
            size="small"
            icon={<LinkOffIcon sx={{ fontSize: 10 }} />}
            label="未选择数据源"
            color="warning"
            sx={{ fontSize: 8, height: 16 }}
          />
        )}
        {testResult?.success && (
          <Chip
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: 10 }} />}
            label={`${testResult.deviceCount ?? 0} 台`}
            color="success"
            sx={{ fontSize: 8, height: 16 }}
          />
        )}
        {testResult && !testResult.success && (
          <Chip
            size="small"
            icon={<ErrorIcon sx={{ fontSize: 10 }} />}
            label="失败"
            color="error"
            sx={{ fontSize: 8, height: 16 }}
          />
        )}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}
        >
          <DeleteIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Box>

      {/* 卡片内容 */}
      {expanded && (
        <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          {/* 名称 + 数据源选择（上下两行） */}
          <TextField
            size="small"
            label="接入名称"
            value={adapter.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="例如：矿区边缘网关"
            slotProps={{
              input: { sx: { fontSize: 11 } },
              inputLabel: { sx: { fontSize: 11 } },
            }}
          />
          <TextField
            select
            size="small"
            label="关联数据源"
            value={adapter.dataSourceId}
            onChange={(e) => onDataSourceChange(e.target.value)}
            slotProps={{
              input: {
                sx: { fontSize: 11 },
                endAdornment: dsTestStatus === "testing" ? (
                  <CircularProgress size={12} sx={{ mr: 2 }} />
                ) : undefined,
              },
              inputLabel: { sx: { fontSize: 11 } },
              select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 200 } } } } } as Record<string, unknown>,
            }}
            helperText={
              dsTestStatus === "testing"
                ? "正在测试连通性..."
                : dsTestStatus === "ok"
                  ? `✓ 连通正常 — ${linkedDs?.connection.url || ""}`
                  : dsTestStatus === "fail"
                    ? `✗ 连接失败 — ${linkedDs?.connection.url || ""}`
                    : "请先在数据源管理中配置连接"
            }
            sx={{
              "& .MuiFormHelperText-root": {
                fontSize: 9,
                color: dsTestStatus === "ok"
                  ? "success.main"
                  : dsTestStatus === "fail"
                    ? "error.main"
                    : undefined,
              },
            }}
          >
              <MenuItem value="">
                <em>未选择</em>
              </MenuItem>
              {dataSources.map((ds) => (
                <MenuItem key={ds.id} value={ds.id}>
                  <Box sx={{ display: "flex", flexDirection: "column", width: "100%", py: 0.25 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%" }}>
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          bgcolor: ds.status === "connected" ? "success.main" : "grey.400",
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontSize: 11, flex: 1 }} noWrap>
                        {ds.name || "未命名数据源"}
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: "text.disabled", flexShrink: 0 }}>
                        {ds.type.toUpperCase()}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 9, color: "text.disabled", pl: 1.25 }} noWrap>
                      {ds.connection.url || "未配置地址"}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>

          {/* API 路径 */}
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary" }}>
            API 路径
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-start" }}>
            <TextField
              size="small"
              label="设备列表"
              value={adapter.apiMapping.deviceListPath}
              onChange={(e) =>
                onUpdate({ apiMapping: { ...adapter.apiMapping, deviceListPath: e.target.value } })
              }
              sx={{ flex: 1 }}
              slotProps={{
                input: { sx: { fontSize: 10 } },
                inputLabel: { sx: { fontSize: 10 } },
              }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={onTest}
              disabled={!linkedDs || testing}
              startIcon={testing ? <CircularProgress size={12} /> : undefined}
              sx={{ fontSize: 9, textTransform: "none", mt: 0.25, minWidth: 48, height: 28 }}
            >
              {testing ? "..." : "测试"}
            </Button>
          </Box>
          {testResult && !testResult.success && testResult.error && (
            <Typography sx={{ fontSize: 9, color: "error.main" }}>
              ✗ {testResult.error}
            </Typography>
          )}
          {testResult?.success && (
            <Typography sx={{ fontSize: 9, color: "success.main" }}>
              ✓ 连通正常，发现 {testResult.deviceCount ?? 0} 台设备
            </Typography>
          )}

          <Divider />

          {/* 操作按钮 */}
          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
            <Button
              size="small"
              variant="contained"
              onClick={onApply}
              disabled={!linkedDs || !testResult?.success}
              sx={{ fontSize: 10, textTransform: "none" }}
            >
              应用
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
