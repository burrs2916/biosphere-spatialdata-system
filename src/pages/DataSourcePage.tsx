import * as React from "react";
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
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import StorageIcon from "@mui/icons-material/Storage";
import CloudIcon from "@mui/icons-material/Cloud";
import WifiIcon from "@mui/icons-material/Wifi";
import SyncIcon from "@mui/icons-material/Sync";
import DatabaseIcon from "@mui/icons-material/Storage";
import { useDataSourceStore } from "../store/datasourceStore";
import type { DataSourceType, DataSourceStatus } from "../types/dataSource";

const typeIcons: Record<DataSourceType, React.ReactNode> = {
  http: <CloudIcon />,
  websocket: <WifiIcon />,
  mqtt: <WifiIcon />,
  database: <DatabaseIcon />,
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

export default function DataSourcePage() {
  const {
    dataSources,
    addDataSource,
    deleteDataSource,
    setDataSourceEnabled,
    testConnection,
  } = useDataSourceStore();

  const activeCount = dataSources.filter((d) => d.status === "connected").length;
  const errorCount = dataSources.filter((d) => d.status === "error" || d.status === "failed").length;

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
          数据源管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => addDataSource({ name: `数据源 ${dataSources.length + 1}` })}
        >
          添加数据源
        </Button>
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

      {dataSources.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <StorageIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
          <Typography variant="h6" color="text.secondary">暂无数据源</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            点击"添加数据源"创建您的第一个数据源
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => addDataSource({ name: "数据源 1" })}>
            添加数据源
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {dataSources.map((ds) => (
            <Grid key={ds.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card sx={{ height: "100%", opacity: ds.enabled ? 1 : 0.6 }}>
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <StorageIcon color="primary" />
                      <Typography variant="h6" noWrap>{ds.name || "未命名"}</Typography>
                    </Box>
                    <Chip label={statusLabels[ds.status]} color={statusColors[ds.status]} size="small" />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    {typeIcons[ds.type]}
                    <Typography variant="body2" color="text.secondary">
                      {typeLabels[ds.type]}
                    </Typography>
                  </Box>
                  {ds.description && (
                    <Typography variant="body2" color="text.secondary">
                      {ds.description}
                    </Typography>
                  )}
                  {ds.connection.url && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", mt: 1 }}>
                      {ds.connection.url}
                    </Typography>
                  )}
                  {ds.lastError && (
                    <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
                      {ds.lastError}
                    </Typography>
                  )}
                  {ds.lastFetchedAt && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      最近获取: {new Date(ds.lastFetchedAt).toLocaleString()}
                    </Typography>
                  )}
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
                    <Tooltip title="测试连接">
                      <IconButton size="small" onClick={() => testConnection(ds.id)} disabled={!ds.connection.url}>
                        <SyncIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton size="small" onClick={() => deleteDataSource(ds.id)}>
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

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          数据源类型说明
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CloudIcon color="primary" />
              <Box>
                <Typography variant="subtitle2">HTTP REST</Typography>
                <Typography variant="body2" color="text.secondary">支持 GET/POST/PUT/DELETE 请求</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <WifiIcon color="primary" />
              <Box>
                <Typography variant="subtitle2">WebSocket</Typography>
                <Typography variant="body2" color="text.secondary">双向实时通信</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <WifiIcon color="primary" />
              <Box>
                <Typography variant="subtitle2">MQTT</Typography>
                <Typography variant="body2" color="text.secondary">实时消息订阅</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DatabaseIcon color="primary" />
              <Box>
                <Typography variant="subtitle2">数据库</Typography>
                <Typography variant="body2" color="text.secondary">直连数据库查询</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
