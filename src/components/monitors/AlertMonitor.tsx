import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import Divider from "@mui/material/Divider";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import type { AlertMonitorProps } from "./types";

export type AlertSeverity = "error" | "warning" | "info" | "success";

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  timestamp: string;
  source: string;
}

const alertData: AlertItem[] = [
  {
    id: "1",
    title: "数据源连接异常",
    description: "PostgreSQL 数据源 'prod-db' 连接超时",
    severity: "error",
    timestamp: "2分钟前",
    source: "数据源管理",
  },
  {
    id: "2",
    title: "存储空间不足",
    description: "磁盘使用率达到 85%，请及时清理",
    severity: "warning",
    timestamp: "15分钟前",
    source: "系统监控",
  },
  {
    id: "3",
    title: "场景渲染完成",
    description: "场景 '城市地图' 已成功渲染",
    severity: "success",
    timestamp: "30分钟前",
    source: "场景编辑器",
  },
  {
    id: "4",
    title: "新版本可用",
    description: "系统有新版本 v2.1.0 可更新",
    severity: "info",
    timestamp: "1小时前",
    source: "系统通知",
  },
  {
    id: "5",
    title: "查询性能下降",
    description: "空间查询响应时间超过阈值",
    severity: "warning",
    timestamp: "2小时前",
    source: "性能监控",
  },
];

const severityConfig = {
  error: {
    color: "error" as const,
    icon: <ErrorRoundedIcon />,
    label: "严重",
  },
  warning: {
    color: "warning" as const,
    icon: <WarningRoundedIcon />,
    label: "警告",
  },
  info: {
    color: "info" as const,
    icon: <InfoRoundedIcon />,
    label: "信息",
  },
  success: {
    color: "success" as const,
    icon: <CheckCircleRoundedIcon />,
    label: "成功",
  },
};

export default function AlertMonitor({
  title = "告警中心",
  maxItems,
  visible = true,
  style,
  className,
}: AlertMonitorProps) {
  const [alerts] = useState<AlertItem[]>(maxItems ? alertData.slice(0, maxItems) : alertData);

  if (!visible) return null;

  const errorCount = alerts.filter((a) => a.severity === "error").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
      style={style}
      className={className}
    >
      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column", p: 0 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
            pb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography component="h2" variant="subtitle2">
              {title}
            </Typography>
            <Badge badgeContent={errorCount + warningCount} color="error">
              <NotificationsRoundedIcon color="action" fontSize="small" />
            </Badge>
          </Box>
          <Tooltip title="刷新">
            <IconButton size="small">
              <RefreshRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: "flex", gap: 1, px: 2, pb: 1 }}>
          <Chip
            size="small"
            icon={<ErrorRoundedIcon />}
            label={`${errorCount} 严重`}
            color="error"
            variant="outlined"
          />
          <Chip
            size="small"
            icon={<WarningRoundedIcon />}
            label={`${warningCount} 警告`}
            color="warning"
            variant="outlined"
          />
        </Box>

        <Divider />

        <List sx={{ flex: 1, overflow: "auto", py: 0 }}>
          {alerts.map((alert, index) => (
            <Box key={alert.id}>
              <ListItem
                disablePadding
                secondaryAction={
                  <Tooltip title="清除">
                    <IconButton size="small" edge="end">
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton sx={{ py: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Box
                      sx={{
                        color: `${severityConfig[alert.severity].color}.main`,
                      }}
                    >
                      {severityConfig[alert.severity].icon}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {alert.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={severityConfig[alert.severity].label}
                          color={severityConfig[alert.severity].color}
                          sx={{ height: 20, fontSize: "0.65rem" }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {alert.description}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
              {index < alerts.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      </CardContent>

      <Divider />

      <CardActions sx={{ justifyContent: "space-between", px: 2 }}>
        <Typography variant="caption" color="text.secondary">
          最近更新: {new Date().toLocaleTimeString("zh-CN")}
        </Typography>
        <Button size="small" color="primary">
          查看全部
        </Button>
      </CardActions>
    </Card>
  );
}
