import { alpha } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppTheme } from "./theme";
import { SideMenu, AppNavbar, AppFooter, SettingsDrawer } from "./components/layout";
import { DashboardPage, SceneEditorPage, DataSourcePage, PublishedScenesPage, ScenePreviewPage, ComponentManagementPage, ComponentPreviewPage, MapLibraryPage, MapsPage, MapPreviewPage, AlertCenterPage, LogsPage, HistoryPage, AboutPage, HelpPage } from "./pages";
import { useLayoutStore } from "./store/layoutStore";
import { useAuthStore } from "./store/authStore";
import { useDataSourceStore } from "./store/datasourceStore";
import { useDeviceAdapterStore } from "./store/deviceAdapterStore";
import { useThemeStore } from "./store/themeStore";
import { useAppearanceStore } from "./store/appearanceStore";
import { subscribeLogMonitorToScene } from "./store/logMonitorStore";
import { ensureDevicesLoaded } from "./store/deviceStore";
import { useSceneStore } from "./store/sceneStore";
import type { ThemeMode } from "./store/themeStore";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import Button from "@mui/material/Button";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import Typography from "@mui/material/Typography";
import ToastHost from "./utils/ToastHost";
import { showToast } from "./utils/toastStore";

const MapEditorPage = lazy(() => import("./pages/MapEditorPage"));

function getSystemMode(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemMode();
  return mode;
}

const FULLSCREEN_ROUTES = ["/scene"];
const STANDALONE_ROUTES = ["/preview", "/component-preview", "/map-editor", "/map-preview"];

function isStandaloneRoute(pathname: string): boolean {
  return STANDALONE_ROUTES.some((r) => pathname.startsWith(r));
}

/**
 * 配置面路由守卫（复用项目已有的 authStore 配置驱动登录）。
 * - authStore.enabled === false：不拦截，直接渲染。
 * - enabled 且已登录：渲染。
 * - enabled 且未登录：显示「需要登录」占位，按钮唤起已配置的 webhook 登录。
 */
function ConfigGate({ children }: { children: React.ReactNode }) {
  const enabled = useAuthStore((s) => s.enabled);
  const currentUser = useAuthStore((s) => s.currentUser);

  if (!enabled || currentUser) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 10, gap: 1 }}>
      <LockRoundedIcon sx={{ fontSize: 44, color: "text.disabled", mb: 0.5 }} />
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        该页面需要登录
      </Typography>
      <Typography variant="body2" color="text.secondary">
        配置功能仅对管理员开放，请先登录
      </Typography>
      <Button
        variant="contained"
        sx={{ mt: 1.5 }}
        onClick={() => {
          void useAuthStore.getState().performLogin().catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[ConfigGate] 登录失败:", msg);
            showToast(`登录失败：${msg}`, "error");
          });
        }}
      >
        登录
      </Button>
    </Box>
  );
}

function AppLayout({ setSettingsOpen }: { setSettingsOpen: (v: boolean) => void }) {
  const location = useLocation();
  const layoutConfig = useLayoutStore((state) => state.config);
  const isFullscreen = FULLSCREEN_ROUTES.includes(location.pathname);
  const standalone = isStandaloneRoute(location.pathname);

  const contentPaddingMap: Record<string, string> = { none: "0px", small: "8px", medium: "24px", large: "40px" };
  const contentPad = contentPaddingMap[layoutConfig.contentPadding] ?? "24px";

  if (standalone) {
    return (
      <Routes>
        <Route path="/preview/:sceneId" element={<ScenePreviewPage />} />
        <Route path="/component-preview/:componentType" element={<ComponentPreviewPage />} />
        <Route path="/map-editor/:libraryId" element={<Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><CircularProgress /></Box>}><ConfigGate><MapEditorPage /></ConfigGate></Suspense>} />
        <Route path="/map-preview/:id" element={<MapPreviewPage />} />
      </Routes>
    );
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <SideMenu />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
        }}
      >
        <AppNavbar onSettingsClick={() => setSettingsOpen(true)} />
        <Box
          component="main"
          sx={(theme) => ({
            flex: 1,
            overflow: isFullscreen ? "hidden" : "auto",
            backgroundColor: theme.vars
              ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
              : alpha(theme.palette.background.default, 1),
            display: "flex",
            flexDirection: "column",
          })}
        >
          {isFullscreen ? (
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Routes>
                <Route path="/scene" element={<ConfigGate><SceneEditorPage /></ConfigGate>} />
              </Routes>
            </Box>
          ) : (
            <Box
              sx={{
                p: contentPad,
                maxWidth: { sm: "100%", md: "1700px" },
                mx: "auto",
                minHeight: "100%",
                width: "100%",
                flex: 1,
              }}
            >
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/datasource" element={<ConfigGate><DataSourcePage /></ConfigGate>} />
                <Route path="/published" element={<PublishedScenesPage />} />
                <Route path="/components" element={<ConfigGate><ComponentManagementPage /></ConfigGate>} />
                <Route path="/map-library" element={<ConfigGate><MapLibraryPage /></ConfigGate>} />
                <Route path="/maps" element={<MapsPage />} />
                <Route path="/alerts" element={<AlertCenterPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/help" element={<HelpPage />} />
              </Routes>
            </Box>
          )}
        </Box>
        {!isFullscreen && <AppFooter />}
      </Box>
    </Box>
  );
}

export default function App() {
  const layoutInit = useLayoutStore((state) => state.init);
  const init = useAuthStore((state) => state.init);
  const initialized = useAuthStore((state) => state.initialized);
  const loadFromBackend = useDataSourceStore((state) => state.loadFromBackend);
  const loadAdapters = useDeviceAdapterStore((state) => state.loadFromBackend);

  const themeConfig = useThemeStore((state) => state.config);
  const themeInit = useThemeStore((state) => state.init);
  const themeInitialized = useThemeStore((state) => state.initialized);

  const appearanceInit = useAppearanceStore((state) => state.init);

  const resolvedMode = useMemo(() => resolveMode(themeConfig.mode), [themeConfig.mode]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    init();
    layoutInit();
    themeInit();
    appearanceInit();
    loadFromBackend();
    loadAdapters();
    // 常驻订阅：日志监控设备池实时跟随主场景喷雾控制工具栏绑定的集控器。
    // 提到 App 启动而非仅 LogFilterPanel 挂载，保证"主场景改完集控器、日志监控未打开"时
    // sceneDeviceIds 也已同步，打开日志监控即最新、改完即时联动（避免只在视图开着时才联动）。
    subscribeLogMonitorToScene();
    // 主页首启数据初始化：设备加载 + 报警订阅 + 实时轮询、场景列表。
    // 竞态修复：ensureDevicesLoaded 内部对适配器/数据源做同步快照，若不等
    // loadFromBackend/loadAdapters 完成就调用，会读到空列表早退，且内部
    // _autoLoaded 防重入会永久拦截重试（在线设备恒 0）。故必须 await 就绪后再触发。
    void (async () => {
      try {
        await Promise.all([loadFromBackend(), loadAdapters()]);
        await ensureDevicesLoaded();
      } catch { /* 启动初始化失败不阻塞 UI */ }
    })();
    void useSceneStore.getState().loadScenes();

    return () => {
      abortController.abort();
    };
  }, [init, layoutInit, themeInit, appearanceInit, loadFromBackend, loadAdapters]);

  useEffect(() => {
    if (themeConfig.mode === "system" && typeof window !== "undefined" && window.matchMedia) {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => {
        useThemeStore.getState().setMode("system");
      };
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [themeConfig.mode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-mui-color-scheme", resolvedMode);
  }, [resolvedMode]);

  if (!initialized || !themeInitialized) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <AppTheme config={themeConfig}>
        <CssBaseline enableColorScheme />
        <AppLayout setSettingsOpen={setSettingsOpen} />
        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ToastHost />
      </AppTheme>
    </BrowserRouter>
  );
}
