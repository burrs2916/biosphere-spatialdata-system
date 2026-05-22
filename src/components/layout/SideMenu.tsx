import { styled } from "@mui/material/styles";
import MuiDrawer, { drawerClasses } from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SelectContent from "./SelectContent";
import MenuContent from "./MenuContent";
import CardAlert from "./CardAlert";
import OptionsMenu from "./OptionsMenu";
import { useLayoutStore } from "../../store/layoutStore";
import { useAuthStore } from "../../store/authStore";
import type { AuthPreset } from "../../services/tauri";

const AUTH_PRESETS: AuthPreset[] = ["keycloak", "auth0", "internal", "custom"];

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<{ collapsed: boolean }>(({ theme, collapsed }) => ({
  width: collapsed ? 64 : 240,
  flexShrink: 0,
  boxSizing: "border-box",
  position: "relative",
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  [`& .${drawerClasses.paper}`]: {
    width: collapsed ? 64 : 240,
    boxSizing: "border-box",
    position: "relative",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: "hidden",
  },
}));

export default function SideMenu() {
  const sidebarCollapsed = useLayoutStore((state) => state.config.sidebarCollapsed);
  const authEnabled = useAuthStore((state) => state.enabled);
  const preset = useAuthStore((state) => state.preset);
  const currentUser = useAuthStore((state) => state.currentUser);
  const userDisplayConfig = useAuthStore((state) => state.webhook?.userDisplayConfig || []);
  const getCachedValue = useAuthStore((state) => state.getCachedValue);

  const isAuthenticated = !!currentUser;
  const isAuthRequired = AUTH_PRESETS.includes(preset);

  const getDisplayValue = (type: string): string => {
    const config = userDisplayConfig.find((c) => c.displayType === type);
    if (config) {
      const value = getCachedValue(config.cacheKey);
      return value || "";
    }
    return "";
  };

  const customConfig = userDisplayConfig.find((c) => c.displayType === "custom");
  const customValue = customConfig ? getCachedValue(customConfig.cacheKey) : "";
  const customLabel = customConfig?.customLabel;

  const hasDisplayConfig = userDisplayConfig.some((c) => c.displayType !== "none");

  const nameFromCache = getDisplayValue("name");
  const emailFromCache = getDisplayValue("email");
  const tenantFromCache = getDisplayValue("tenant");
  const roleFromCache = getDisplayValue("role");
  
  const displayName = nameFromCache || currentUser?.displayName || currentUser?.username || (isAuthenticated && !hasDisplayConfig ? "用户" : (!isAuthenticated ? "未登录" : ""));
  const displayEmail = emailFromCache || currentUser?.email || (isAuthenticated && !hasDisplayConfig ? "" : (!isAuthenticated ? "点击登录" : ""));
  const avatarValue = getDisplayValue("avatar");
  
  const isAvatarUrl = avatarValue && (avatarValue.startsWith("http://") || avatarValue.startsWith("https://") || avatarValue.startsWith("data:"));
  
  const avatarLetter = isAuthenticated
    ? (nameFromCache || currentUser?.displayName || currentUser?.username || "U")[0].toUpperCase()
    : "?";

  const displayItems = [
    { key: "name", label: "名称", value: nameFromCache || currentUser?.displayName || currentUser?.username },
    { key: "email", label: "邮箱", value: emailFromCache || currentUser?.email },
    { key: "tenant", label: "租户", value: tenantFromCache },
    { key: "role", label: "角色", value: roleFromCache },
    { key: "custom", label: customLabel || "自定义", value: customValue, isCustom: true },
  ].filter(item => item.value);

  return (
    <Drawer
      variant="permanent"
      collapsed={sidebarCollapsed}
      sx={{
        display: { xs: "none", md: "block" },
        [`& .${drawerClasses.paper}`]: {
          backgroundColor: "background.paper",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: sidebarCollapsed ? "center" : "flex-start",
          p: sidebarCollapsed ? 1 : 1.5,
          minHeight: 56,
        }}
      >
        {!sidebarCollapsed && <SelectContent />}
      </Box>
      <Divider />
      <Box
        sx={{
          overflow: "auto",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MenuContent collapsed={sidebarCollapsed} />
        {!sidebarCollapsed && <CardAlert />}
      </Box>
      {authEnabled && isAuthRequired && (
        <Box
          sx={{
            p: sidebarCollapsed ? 1 : 2,
            gap: sidebarCollapsed ? 0 : 1.5,
            display: "flex",
            alignItems: "center",
            borderTop: "1px solid",
            borderColor: "divider",
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
            "&:hover": {
              bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            },
          }}
        >
          <Tooltip title={sidebarCollapsed ? displayName : ""} placement="right">
            <Box
              sx={{
                position: "relative",
                "&:hover": {
                  transform: "scale(1.05)",
                  transition: "transform 0.2s ease-in-out",
                },
              }}
            >
              {isAvatarUrl ? (
                <Avatar
                  sx={{
                    width: sidebarCollapsed ? 40 : 44,
                    height: sidebarCollapsed ? 40 : 44,
                    border: "2px solid",
                    borderColor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.08)",
                  }}
                  src={avatarValue}
                  alt={displayName}
                />
              ) : isAuthenticated ? (
                <Avatar
                  sx={{
                    width: sidebarCollapsed ? 40 : 44,
                    height: sidebarCollapsed ? 40 : 44,
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "primary.dark"
                        : "primary.light",
                    color: (theme) =>
                      theme.palette.mode === "dark"
                        ? "primary.contrastText"
                        : "primary.dark",
                    border: "2px solid",
                    borderColor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.08)",
                  }}
                >
                  <PersonRoundedIcon sx={{ fontSize: sidebarCollapsed ? "1.25rem" : "1.4rem" }} />
                </Avatar>
              ) : (
                <Avatar
                  sx={{
                    width: sidebarCollapsed ? 40 : 44,
                    height: sidebarCollapsed ? 40 : 44,
                    bgcolor: "grey.400",
                    fontSize: sidebarCollapsed ? "1.25rem" : "1.35rem",
                    fontWeight: 600,
                    border: "2px solid",
                    borderColor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.08)",
                  }}
                >
                  {avatarLetter}
                </Avatar>
              )}
              {isAuthenticated && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "success.main",
                    border: "2px solid",
                    borderColor: "background.paper",
                  }}
                />
              )}
            </Box>
          </Tooltip>
          {!sidebarCollapsed && (
            <>
              <Box sx={{ mr: "auto", minWidth: 0, flex: 1 }}>
                {!hasDisplayConfig ? (
                  <>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        lineHeight: 1.3,
                        color: "text.primary",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayName}
                    </Typography>
                    {displayEmail && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          lineHeight: 1.4,
                          mt: 0.25,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        {displayEmail}
                      </Typography>
                    )}
                  </>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                    }}
                  >
                    {displayItems.map((item) => (
                      <Box
                        key={item.key}
                        sx={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: (theme) =>
                              theme.palette.mode === "dark"
                                ? "primary.light"
                                : "primary.dark",
                            flexShrink: 0,
                            letterSpacing: 0.2,
                          }}
                        >
                          {item.label}:
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.primary",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
              <OptionsMenu />
            </>
          )}
        </Box>
      )}
    </Drawer>
  );
}
