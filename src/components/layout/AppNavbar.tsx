import { styled, alpha } from "@mui/material/styles";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import InputBase from "@mui/material/InputBase";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useLayoutStore } from "../../store/layoutStore";

const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.black, 0.05),
  "&:hover": {
    backgroundColor: alpha(theme.palette.common.black, 0.1),
  },
  marginRight: theme.spacing(2),
  marginLeft: theme.spacing(1),
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    width: "auto",
  },
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("md")]: {
      width: "20ch",
    },
  },
}));

interface AppNavbarProps {
  onSettingsClick?: () => void;
}

export default function AppNavbar(props: AppNavbarProps) {
  const { onSettingsClick } = props;
  const { config: layoutConfig, toggleSidebar } = useLayoutStore();
  const sidebarCollapsed = layoutConfig.sidebarCollapsed;

  const handleFullscreen = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();
      const fullscreen = await currentWindow.isFullscreen();
      await currentWindow.setFullscreen(!fullscreen);
    } catch {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    }
  };

  return (
    <AppBar
      position="sticky"
      sx={{
        flexShrink: 0,
        backgroundColor: "background.paper",
        color: "text.primary",
        boxShadow: "none",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar>
        <Tooltip title={sidebarCollapsed ? "展开菜单" : "收起菜单"}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={toggleSidebar}
            sx={{ mr: 1 }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Tooltip>

        <Search>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="搜索..."
            inputProps={{ "aria-label": "search" }}
          />
        </Search>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
          <Tooltip title="全屏">
            <IconButton color="inherit" onClick={handleFullscreen}>
              <FullscreenRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="通知">
            <IconButton
              size="large"
              aria-label="show notifications"
              color="inherit"
            >
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="设置">
            <IconButton color="inherit" onClick={onSettingsClick}>
              <SettingsRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
