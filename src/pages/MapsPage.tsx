import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import MapIcon from "@mui/icons-material/Map";
import DescriptionIcon from "@mui/icons-material/Description";
import ImageIcon from "@mui/icons-material/Image";
import PublicIcon from "@mui/icons-material/Public";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import SearchIcon from "@mui/icons-material/Search";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useMapLibraryStore } from "../store/mapLibraryStore";
import type { MapLibrary, MapLibraryType } from "../types/mapLibrary";
import { MAP_LIBRARY_TYPE_LABELS } from "../types/mapLibrary";

// Types whose published libraries can be rendered read-only in the browser.
// CAD uses the dedicated read-only CadPreviewViewer; Tile/Blueprint reuse their
// library-driven renderers. Globe/Heatmap are config-driven with no library
// load path and no store creation entry, so they stay "暂不支持浏览".
const BROWSABLE_TYPES: MapLibraryType[] = ["cad", "tile", "blueprint"];

const TYPE_OPTIONS: Array<MapLibraryType | "all"> = ["all", "cad", "tile", "blueprint", "globe", "heatmap"];

interface TypeMeta {
  icon: React.ReactNode;
  gradient: string;
  tint: string;
}

const TYPE_META: Record<MapLibraryType, TypeMeta> = {
  cad: { icon: <DescriptionIcon />, gradient: "linear-gradient(135deg,#1e3a8a 0%,#0ea5e9 100%)", tint: "#60a5fa" },
  tile: { icon: <MapIcon />, gradient: "linear-gradient(135deg,#065f46 0%,#10b981 100%)", tint: "#34d399" },
  blueprint: { icon: <ImageIcon />, gradient: "linear-gradient(135deg,#3730a3 0%,#6366f1 100%)", tint: "#a78bfa" },
  globe: { icon: <PublicIcon />, gradient: "linear-gradient(135deg,#0e7490 0%,#06b6d4 100%)", tint: "#22d3ee" },
  heatmap: { icon: <WhatshotIcon />, gradient: "linear-gradient(135deg,#9a3412 0%,#f97316 100%)", tint: "#fb923c" },
};

function formatDate(ts?: number): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("zh-CN");
  } catch {
    return "—";
  }
}

function MapCard({
  library,
  onOpen,
}: {
  library: MapLibrary;
  onOpen: (library: MapLibrary) => void;
}) {
  const isBrowsable = BROWSABLE_TYPES.includes(library.mapType);
  const meta = TYPE_META[library.mapType];
  const [thumbFailed, setThumbFailed] = useState(false);

  return (
    <Card
      elevation={0}
      onClick={isBrowsable ? () => onOpen(library) : undefined}
      sx={{
        borderRadius: 3,
        border: "1px solid var(--color-border-tertiary)",
        overflow: "hidden",
        cursor: isBrowsable ? "pointer" : "default",
        opacity: isBrowsable ? 1 : 0.72,
        backgroundColor: "var(--color-background-paper)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        "&:hover": isBrowsable
          ? {
              transform: "translateY(-3px)",
              borderColor: meta.tint,
              boxShadow: "0 10px 28px -12px rgba(0,0,0,0.45)",
            }
          : {},
      }}
    >
      <Box
        sx={{
          position: "relative",
          height: 150,
          background: meta.gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "1px solid var(--color-border-tertiary)",
        }}
      >
        {library.thumbnail && !thumbFailed ? (
          <img
            src={library.thumbnail}
            alt={library.name}
            style={{ width: "100%", height: "100%", objectFit: "contain", background: "#0a0a1a" }}
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <Box
            sx={{
              color: "rgba(255,255,255,0.92)",
              opacity: 0.92,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
              "& svg": { fontSize: 54 },
            }}
          >
            {meta.icon}
          </Box>
        )}

        <Chip
          label={MAP_LIBRARY_TYPE_LABELS[library.mapType]}
          size="small"
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            fontSize: 11,
            height: 22,
            color: "#fff",
            backgroundColor: "rgba(0,0,0,0.32)",
            border: "1px solid rgba(255,255,255,0.25)",
            backdropFilter: "blur(2px)",
          }}
        />

        {!isBrowsable && (
          <Tooltip title="该类型暂不支持浏览（globe/heatmap 为配置驱动，无库加载入口）">
            <Chip
              label="暂不支持浏览"
              size="small"
              sx={{
                position: "absolute",
                top: 10,
                right: 10,
                fontSize: 11,
                height: 22,
                color: "#fff",
                backgroundColor: "rgba(0,0,0,0.42)",
              }}
            />
          </Tooltip>
        )}
      </Box>

      <Box sx={{ p: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}
          title={library.name}
        >
          {library.name}
        </Typography>

        <Stack direction="row" spacing={0.75} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
          <Chip
            label={isBrowsable ? "可浏览 · 弹窗打开" : "只读未接入"}
            size="small"
            color={isBrowsable ? "success" : "default"}
            variant={isBrowsable ? "filled" : "outlined"}
            sx={{ fontSize: 11, height: 20 }}
          />
        </Stack>

        <Typography variant="caption" sx={{ display: "block", mt: 1, color: "var(--color-text-tertiary)" }}>
          实体 {library.entityCount} · 更新 {formatDate(library.updatedAt)}
        </Typography>
      </Box>
    </Card>
  );
}

/**
 * Open a map preview in its own independent, movable, resizable Tauri window.
 * Each call uses a unique window label so multiple previews can be opened in
 * parallel without blocking the main application.
 */
function openPreviewWindow(library: MapLibrary) {
  const label = `map-preview-${library.id}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const url = `/map-preview/${encodeURIComponent(library.id)}?type=${library.mapType}`;
  try {
    const win = new WebviewWindow(label, {
      title: library.name,
      url,
      width: 980,
      height: 680,
      resizable: true,
      decorations: true,
      center: false,
    });
    win.once("tauri://error", (e) => console.error("[MapsPage] failed to open preview window", e));
  } catch (err) {
    console.error("[MapsPage] WebviewWindow create failed", err);
  }
}

export default function MapsPage() {
  const libraries = useMapLibraryStore((s) => s.libraries);
  const isLoading = useMapLibraryStore((s) => s.isLoading);
  const loadPublished = useMapLibraryStore((s) => s.loadPublished);

  const [typeFilter, setTypeFilter] = useState<MapLibraryType | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadPublished();
  }, [loadPublished]);

  const published = useMemo(() => libraries.filter((l) => l.status === "published"), [libraries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return published.filter((l) => {
      if (typeFilter !== "all" && l.mapType !== typeFilter) return false;
      if (q && !l.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [published, typeFilter, query]);

  const handleOpen = (library: MapLibrary) => {
    openPreviewWindow(library);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: { xs: 2, sm: 3 } }}>
      <Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg,#1e3a8a,#0ea5e9)",
              color: "#fff",
              boxShadow: "0 6px 16px -8px rgba(14,165,233,0.7)",
              "& svg": { fontSize: 24 },
            }}
          >
            <MapIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.2 }}>
              地图浏览
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--color-text-secondary)", mt: 0.25 }}>
              查看已发布的地图库（只读）。点击 CAD / 瓦片 / 蓝图会以独立窗口打开预览，可拖动、可多开，不遮挡主应用；globe / heatmap 暂不支持。
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", sm: "center" }, flexWrap: "wrap", gap: 1.5 }}
      >
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
          {TYPE_OPTIONS.map((t) => {
            const active = typeFilter === t;
            return (
              <Chip
                key={t}
                label={t === "all" ? "全部" : MAP_LIBRARY_TYPE_LABELS[t]}
                size="small"
                clickable
                onClick={() => setTypeFilter(t)}
                sx={{
                  borderRadius: 999,
                  px: 0.5,
                  height: 30,
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#fff" : "var(--color-text-secondary)",
                  backgroundColor: active ? "var(--color-primary, #0ea5e9)" : "var(--color-background-paper)",
                  border: active ? "1px solid transparent" : "1px solid var(--color-border-tertiary)",
                  "&:hover": { backgroundColor: active ? "var(--color-primary, #0ea5e9)" : "var(--color-background-secondary)" },
                }}
              />
            );
          })}
        </Stack>

        <Box sx={{ flex: 1, minWidth: { sm: 200 }, maxWidth: { sm: 320 }, ml: { sm: "auto" } }}>
          <TextField
            size="small"
            fullWidth
            placeholder="搜索图纸名称…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "var(--color-text-tertiary)" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 999,
                backgroundColor: "var(--color-background-paper)",
              },
            }}
          />
        </Box>
      </Stack>

      {isLoading && published.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box
          sx={{
            py: 10,
            textAlign: "center",
            border: "1px dashed var(--color-border-tertiary)",
            borderRadius: 3,
          }}
        >
          <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
            {published.length === 0 ? "暂无已发布的地图库" : "没有匹配的地图库"}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 2,
          }}
        >
          {filtered.map((lib) => (
            <MapCard key={lib.id} library={lib} onOpen={handleOpen} />
          ))}
        </Box>
      )}
    </Box>
  );
}
