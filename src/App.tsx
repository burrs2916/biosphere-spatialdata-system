import { alpha } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppTheme } from "./theme";
import { SideMenu, AppNavbar, AppFooter, SettingsDrawer } from "./components/layout";
import { DashboardPage, SceneEditorPage, DataSourcePage, PublishedScenesPage, ScenePreviewPage, ComponentManagementPage, ComponentPreviewPage, MapLibraryPage } from "./pages";
import { useLayoutStore } from "./store/layoutStore";
import { useAuthStore } from "./store/authStore";
import { useDataSourceStore } from "./store/datasourceStore";
import { useThemeStore } from "./store/themeStore";
import { useAppearanceStore } from "./store/appearanceStore";
import type { ThemeMode } from "./store/themeStore";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";

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
const STANDALONE_ROUTES = ["/preview", "/component-preview", "/map-editor"];

function isStandaloneRoute(pathname: string): boolean {
  return STANDALONE_ROUTES.some((r) => pathname.startsWith(r));
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
        <Route path="/map-editor/:libraryId" element={<Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><CircularProgress /></Box>}><MapEditorPage /></Suspense>} />
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
                <Route path="/scene" element={<SceneEditorPage />} />
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
                <Route path="/datasource" element={<DataSourcePage />} />
                <Route path="/published" element={<PublishedScenesPage />} />
                <Route path="/components" element={<ComponentManagementPage />} />
                <Route path="/map-library" element={<MapLibraryPage />} />
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

    return () => {
      abortController.abort();
    };
  }, [init, layoutInit, themeInit, appearanceInit, loadFromBackend]);

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
      </AppTheme>
    </BrowserRouter>
  );
}
