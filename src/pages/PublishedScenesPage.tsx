import { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import UnpublishedRoundedIcon from "@mui/icons-material/UnpublishedRounded";
import { useSceneStore } from "../store/sceneStore";
import { openLiveWindow } from "../utils/previewWindow";
import type { SceneDSL } from "../types/scene";

const SCENE_COVER_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
  "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
];

function getSceneGradient(sceneId: string): string {
  let hash = 0;
  for (let i = 0; i < sceneId.length; i++) {
    hash = sceneId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SCENE_COVER_GRADIENTS[Math.abs(hash) % SCENE_COVER_GRADIENTS.length];
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function PublishedScenesPage() {
  const scenes = useSceneStore((s) => s.scenes);
  const loadScenes = useSceneStore((s) => s.loadScenes);
  const unpublishScene = useSceneStore((s) => s.unpublishScene);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "info" }>({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  const publishedScenes = scenes.filter((s) => s.status === "published");

  const handleOpen = useCallback((scene: SceneDSL) => {
    openLiveWindow(scene.id, scene.name);
  }, []);

  const handleUnpublish = useCallback(async (scene: SceneDSL) => {
    await unpublishScene(scene.id);
    setSnackbar({ open: true, message: `场景「${scene.name}」已取消发布`, severity: "info" });
  }, [unpublishScene]);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <PublicRoundedIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            已发布场景
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            点击卡片即可打开使用已发布的场景
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={`${publishedScenes.length} 个已发布`}
          color="primary"
          variant="outlined"
          size="small"
        />
      </Box>

      {publishedScenes.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 12,
            color: "text.secondary",
          }}
        >
          <UnpublishedRoundedIcon sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 500, opacity: 0.6 }}>
            暂无已发布场景
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.4, mt: 0.5 }}>
            在场景编辑器中发布场景后，将在此处显示
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {publishedScenes.map((scene) => {
            const cover = scene.thumbnail || getSceneGradient(scene.id);
            const isGradient = cover.startsWith("linear-gradient(");

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={scene.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      borderColor: "primary.main",
                      boxShadow: 4,
                    },
                  }}
                >
                  <CardActionArea onClick={() => handleOpen(scene)}>
                    <Box
                      sx={{
                        height: 140,
                        background: isGradient ? cover : undefined,
                        backgroundImage: !isGradient ? `url(${cover})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "flex-end",
                        p: 1,
                      }}
                    >
                      <Chip
                        size="small"
                        label="已发布"
                        color="success"
                        sx={{
                          bgcolor: "rgba(0,0,0,0.5)",
                          color: "#fff",
                          backdropFilter: "blur(4px)",
                          "& .MuiChip-label": { px: 1, fontSize: "0.7rem" },
                        }}
                      />
                    </Box>
                    <CardContent sx={{ pb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
                        {scene.name}
                      </Typography>
                      {scene.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                          {scene.description}
                        </Typography>
                      )}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
                        <Typography variant="caption" color="text.disabled">
                          发布于 {scene.publishedAt ? formatTimestamp(scene.publishedAt) : formatTimestamp(scene.updatedAt)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                  <CardActions sx={{ pt: 0, px: 1.5, pb: 1.5, justifyContent: "flex-end", gap: 0.25 }}>
                    <Tooltip title="取消发布">
                      <IconButton size="small" onClick={() => handleUnpublish(scene)} sx={{ color: "text.secondary" }}>
                        <UnpublishedRoundedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
