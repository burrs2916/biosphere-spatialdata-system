import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import StorageIcon from "@mui/icons-material/Storage";
import CloudIcon from "@mui/icons-material/Cloud";
import WifiIcon from "@mui/icons-material/Wifi";
import SyncIcon from "@mui/icons-material/Sync";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useDataSourceStore } from "../store/datasourceStore";
import type { DataSourceType, DataSourceStatus, DataSource } from "../types/dataSource";
import { DATABASE_LABELS, GREPTIMEDB_CONNECTION_MODE_LABELS } from "../types/database";
import { MQTT_PROTOCOL_LABELS } from "../types/mqtt";
import DataSourceEditor from "../components/datasource/DataSourceEditor";

const typeIcons: Record<DataSourceType, ReactNode> = {
  http: <CloudIcon />,
  websocket: <WifiIcon />,
  mqtt: <WifiIcon />,
  database: <StorageIcon />,
};

const typeLabels: Record<DataSourceType, string> = {
  http: "HTTP REST",
  websocket: "WebSocket",
  mqtt: "MQTT",
  database: "数据库",
};

const statusColors: Record<DataSourceStatus, "success" | "default" | "error" | "warning"> = {
  connected: "success",
  disconnected: "default",
  failed: "error",
  error: "error",
  connecting: "warning",
};

const statusLabels: Record<DataSourceStatus, string> = {
  connected: "已连接",
  disconnected: "未连接",
  failed: "连接失败",
  error: "错误",
  connecting: "连接中",
};

const TYPE_FILTERS: { value: DataSourceType | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "http", label: "HTTP" },
  { value: "websocket", label: "WebSocket" },
  { value: "mqtt", label: "MQTT" },
  { value: "database", label: "数据库" },
];

// 添加向导中各类型的说明（让「最强最全」的添加入口自带引导）
const TYPE_DESCRIPTIONS: Record<DataSourceType, string> = {
  http: "RESTful API，适合大多数 HTTP 接口（支持请求头/响应映射/测试 API）",
  websocket: "双向实时推送，适合高频数据流与设备上行",
  mqtt: "物联网消息订阅，适合设备上报与边缘网关",
  database: "直连数据库（含 GreptimeDB），适合时序/关系查询",
};

// 与设置面板一致的副标题生成，消除重复拼串、统一信息源
function dataSourceSubtitle(ds: DataSource): string {
  if (ds.type === "database" && ds.connection.database) {
    const db = ds.connection.database;
    const mode =
      db.dbType === "greptimedb" && db.connectionMode
        ? ` (${GREPTIMEDB_CONNECTION_MODE_LABELS[db.connectionMode]})`
        : "";
    return `${DATABASE_LABELS[db.dbType]}${mode} · ${db.host}:${db.port}`;
  }
  if (ds.type === "mqtt" && ds.connection.mqtt) {
    const m = ds.connection.mqtt;
    return `${MQTT_PROTOCOL_LABELS[m.protocol]} · ${m.host}:${m.port}`;
  }
  return ds.connection.url || "";
}

// 按类型判断「能否测试连接」：database/mqtt 没有 url 字段，之前主页按钮永远 disabled
function canTestDataSource(ds: DataSource): boolean {
  if (ds.type === "database") return !!ds.connection.database?.host;
  if (ds.type === "mqtt") return !!ds.connection.mqtt?.host;
  return !!ds.connection.url;
}

export default function DataSourcePage() {
  const {
    dataSources,
    addDataSource,
    deleteDataSource,
    setDataSourceEnabled,
    testConnection,
    testAllConnections,
    connectionStatuses,
    loadFromBackend,
  } = useDataSourceStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DataSourceType | "all">("all");

  const [searchParams] = useSearchParams();
  const editParam = searchParams.get("edit");

  useEffect(() => {
    void loadFromBackend().then(() => {
      if (editParam) setEditingId(editParam);
    });
  }, [loadFromBackend, editParam]);

  const activeCount = dataSources.filter((d) => d.status === "connected").length;
  const errorCount = dataSources.filter((d) => d.status === "error" || d.status === "failed").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dataSources.filter((d) => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (q) {
        const hay = `${d.name} ${d.connection.url || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dataSources, typeFilter, query]);

  // 添加：先弹类型选择向导，按所选类型创建正确默认连接配置的数据源，再打开编辑
  const handleOpenAdd = () => setAddTypeOpen(true);

  const handleSelectType = async (type: DataSourceType) => {
    setAddTypeOpen(false);
    const ds = await addDataSource({ type });
    setEditingId(ds.id);
  };

  // 克隆：完整复制连接/映射/测试 API，便于同配置换地址快速维护
  const handleClone = async (src: DataSource) => {
    const clone = await addDataSource({
      type: src.type,
      name: `${src.name || "未命名"} 副本`,
      description: src.description,
      enabled: src.enabled,
      connection: {
        ...src.connection,
        headers: src.connection.headers.map((h) => ({ ...h })),
        database: src.connection.database ? { ...src.connection.database } : undefined,
        mqtt: src.connection.mqtt ? { ...src.connection.mqtt } : undefined,
        websocket: src.connection.websocket ? { ...src.connection.websocket } : undefined,
      },
      responseMapping: src.responseMapping.map((m) => ({ ...m })),
      testApis: src.testApis.map((a) => ({ ...a })),
    });
    setEditingId(clone.id);
  };

  // 一键测试全部已启用数据源连接
  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      await testAllConnections();
    } finally {
      setTestingAll(false);
    }
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      void deleteDataSource(pendingDeleteId);
      setPendingDeleteId(null);
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          数据源管理
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={testingAll ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
            onClick={handleTestAll}
            disabled={testingAll || dataSources.length === 0}
          >
            {testingAll ? "测试中..." : "测试全部连接"}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
          >
            添加数据源
          </Button>
        </Stack>
      </Box>

      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <Paper sx={{ p: 2, flex: 1, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary">总数</Typography>
          <Typography variant="h4">{dataSources.length}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary">已连接</Typography>
          <Typography variant="h4" color="success.main">{activeCount}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary">错误</Typography>
          <Typography variant="h4" color="error.main">{errorCount}</Typography>
        </Paper>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 3, alignItems: { sm: "center" } }}>
        <TextField
          size="small"
          placeholder="搜索名称或 URL"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ color: "text.secondary", mr: 0.5 }} /> } }}
          sx={{ minWidth: 240 }}
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {TYPE_FILTERS.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              size="small"
              clickable
              color={typeFilter === t.value ? "primary" : "default"}
              variant={typeFilter === t.value ? "filled" : "outlined"}
              onClick={() => setTypeFilter(t.value)}
            />
          ))}
        </Stack>
      </Stack>

      {dataSources.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <StorageIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
          <Typography variant="h6" color="text.secondary">暂无数据源</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            点击"添加数据源"创建您的第一个数据源
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenAdd}>
            添加数据源
          </Button>
        </Paper>
      ) : filtered.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">没有匹配的数据源</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filtered.map((ds) => (
            <Grid key={ds.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card sx={{ height: "100%", opacity: ds.enabled ? 1 : 0.6 }}>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                      {typeIcons[ds.type]}
                      <Typography variant="h6" noWrap sx={{ color: "primary.main" }}>{ds.name || "未命名"}</Typography>
                    </Box>
                    <Chip label={statusLabels[ds.status]} color={statusColors[ds.status]} size="small" />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {typeLabels[ds.type]}
                    </Typography>
                  </Box>
                  {ds.description && (
                    <Typography variant="body2" color="text.secondary">
                      {ds.description}
                    </Typography>
                  )}
                  {(() => {
                    const sub = dataSourceSubtitle(ds);
                    return sub ? (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", mt: 1 }}>
                        {sub}
                      </Typography>
                    ) : null;
                  })()}
                  {ds.lastError && (
                    <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
                      {ds.lastError}
                    </Typography>
                  )}
                  {(() => {
                    const testedAt = connectionStatuses[ds.id]?.testedAt;
                    return testedAt ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        最近测试: {new Date(testedAt).toLocaleString()}
                      </Typography>
                    ) : ds.lastFetchedAt ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        最近获取: {new Date(ds.lastFetchedAt).toLocaleString()}
                      </Typography>
                    ) : null;
                  })()}
                  {ds.testApis.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      测试 API: {ds.testApis.length} 个
                    </Typography>
                  )}
                </CardContent>
                <CardActions sx={{ justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Switch
                      size="small"
                      checked={ds.enabled}
                      onChange={(e) => setDataSourceEnabled(ds.id, e.target.checked)}
                    />
                    <Typography variant="caption">{ds.enabled ? "启用" : "禁用"}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Tooltip title="编辑">
                      <IconButton size="small" onClick={() => setEditingId(ds.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="克隆数据源">
                      <IconButton size="small" onClick={() => handleClone(ds)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={canTestDataSource(ds) ? "测试连接" : "请先填写连接地址"}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => testConnection(ds.id)}
                          disabled={!canTestDataSource(ds) || ds.status === "connecting"}
                        >
                          {ds.status === "connecting" ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <SyncIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton size="small" onClick={() => setPendingDeleteId(ds.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={!!editingId}
        onClose={() => setEditingId(null)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { maxHeight: "90vh" } } }}
      >
        <DialogContent dividers sx={{ p: 3 }}>
          {editingId && (
            <DataSourceEditor dsId={editingId} onClose={() => setEditingId(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* 添加数据源：类型选择向导（所有入口中最强最全的添加体验） */}
      <Dialog open={addTypeOpen} onClose={() => setAddTypeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>选择数据源类型</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {(Object.keys(typeIcons) as DataSourceType[]).map((type) => (
              <Grid key={type} size={{ xs: 12, sm: 6 }}>
                <Paper
                  variant="outlined"
                  onClick={() => handleSelectType(type)}
                  sx={{
                    p: 2,
                    cursor: "pointer",
                    borderColor: "divider",
                    height: "100%",
                    transition: "border-color .15s, box-shadow .15s",
                    "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Box sx={{ color: "primary.main", display: "flex" }}>{typeIcons[type]}</Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{typeLabels[type]}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {TYPE_DESCRIPTIONS[type]}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTypeOpen(false)}>取消</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingDeleteId} onClose={() => setPendingDeleteId(null)} maxWidth="xs">
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>确定删除该数据源吗？此操作不可撤销。</DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDeleteId(null)}>取消</Button>
          <Button color="error" onClick={confirmDelete}>删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
