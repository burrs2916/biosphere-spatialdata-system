import List from "@mui/material/List";
import ListSubheader from "@mui/material/ListSubheader";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import ExtensionRoundedIcon from "@mui/icons-material/ExtensionRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import LibraryBooksRoundedIcon from "@mui/icons-material/LibraryBooksRounded";
import { useLocation, useNavigate } from "react-router-dom";

interface MenuItemDef {
  text: string;
  icon: React.ReactNode;
  path: string;
}

interface MenuGroupDef {
  id: string;
  label: string;
  items: MenuItemDef[];
}

const menuGroups: MenuGroupDef[] = [
  {
    id: "main",
    label: "主导航",
    items: [
      { text: "仪表盘", icon: <DashboardRoundedIcon />, path: "/" },
      { text: "场景编辑", icon: <LayersRoundedIcon />, path: "/scene" },
      { text: "地图浏览", icon: <MapRoundedIcon />, path: "/maps" },
      { text: "数据源", icon: <StorageRoundedIcon />, path: "/datasource" },
    ],
  },
  {
    id: "published",
    label: "发布管理",
    items: [
      { text: "已发布场景", icon: <PublicRoundedIcon />, path: "/published" },
    ],
  },
  {
    id: "components",
    label: "组件库",
    items: [
      { text: "组件管理", icon: <ExtensionRoundedIcon />, path: "/components" },
      { text: "图库管理", icon: <LibraryBooksRoundedIcon />, path: "/map-library" },
    ],
  },
  {
    id: "monitors",
    label: "监控",
    items: [
      { text: "告警中心", icon: <WarningRoundedIcon />, path: "/alerts" },
      { text: "系统日志", icon: <ArticleRoundedIcon />, path: "/logs" },
      { text: "历史事件", icon: <HistoryRoundedIcon />, path: "/history" },
    ],
  },
  {
    id: "secondary",
    label: "",
    items: [
      { text: "关于", icon: <InfoRoundedIcon />, path: "/about" },
      { text: "帮助", icon: <HelpRoundedIcon />, path: "/help" },
    ],
  },
];

interface MenuContentProps {
  collapsed?: boolean;
}

export default function MenuContent({ collapsed = false }: MenuContentProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const renderMenuItem = (item: MenuItemDef, index: number) => {
    const isSelected = location.pathname === item.path;
    const menuItem = (
      <ListItem key={`${item.path}-${index}`} disablePadding sx={{ display: "block" }}>
        <ListItemButton
          selected={isSelected}
          onClick={() => navigate(item.path)}
          sx={{
            borderRadius: 1,
            mx: collapsed ? 0.5 : 1,
            minHeight: collapsed ? 48 : 40,
            justifyContent: collapsed ? "center" : "flex-start",
            px: collapsed ? 1.5 : 2,
            "&.Mui-selected": {
              backgroundColor: (theme) =>
                theme.vars
                  ? `rgba(${theme.vars.palette.primary.mainChannel} / 0.1)`
                  : "action.selected",
              "&:hover": {
                backgroundColor: (theme) =>
                  theme.vars
                    ? `rgba(${theme.vars.palette.primary.mainChannel} / 0.15)`
                    : "action.selected",
              },
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: collapsed ? 0 : 2,
              color: isSelected ? "primary.main" : "inherit",
              justifyContent: "center",
            }}
          >
            {item.icon}
          </ListItemIcon>
          {!collapsed && (
            <ListItemText
              primary={item.text}
              sx={{
                "& .MuiListItemText-primary": {
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: "0.875rem",
                },
              }}
            />
          )}
        </ListItemButton>
      </ListItem>
    );

    if (collapsed) {
      return (
        <Tooltip key={`${item.path}-${index}`} title={item.text} placement="right">
          {menuItem}
        </Tooltip>
      );
    }

    return menuItem;
  };

  if (collapsed) {
    return (
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        {menuGroups.map((group, groupIndex) => (
          <Box key={group.id}>
            {groupIndex > 0 && (
              <Divider sx={{ my: 0.5, mx: 1 }} />
            )}
            <List dense sx={{ py: 0.5 }}>
              {group.items.map((item, itemIndex) => renderMenuItem(item, itemIndex))}
            </List>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
      {menuGroups.map((group, groupIndex) => (
        <List
          key={group.id}
          dense
          subheader={
            group.label ? (
              <ListSubheader
                component="div"
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                  bgcolor: "transparent",
                  lineHeight: "28px",
                  px: 2,
                  py: 0,
                }}
              >
                {group.label}
              </ListSubheader>
            ) : undefined
          }
          sx={{
            pt: groupIndex > 0 ? 0 : undefined,
            "& .MuiListSubheader-root": {
              mt: groupIndex > 0 ? 0.5 : 0,
            },
          }}
        >
          {groupIndex > 0 && <Divider sx={{ mb: 0.5 }} />}
          {group.items.map((item, itemIndex) => renderMenuItem(item, itemIndex))}
        </List>
      ))}
    </Box>
  );
}
