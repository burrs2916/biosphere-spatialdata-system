import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MapIcon from "@mui/icons-material/Map";
import { SceneEditor } from "../editor/SceneEditor";
import { useSceneStore } from "../store/sceneStore";

export default function SceneEditorPage() {
  const activeSceneId = useSceneStore((s) => s.activeSceneId);
  const scenes = useSceneStore((s) => s.scenes);
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? null;

  if (!activeScene) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
          gap: 1,
        }}
      >
        <MapIcon sx={{ fontSize: 56, opacity: 0.25 }} />
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          请选择或新建场景
        </Typography>
        <Typography variant="body2">
          在左侧导航栏顶部选择已有场景，或点击"新建场景"创建
        </Typography>
      </Box>
    );
  }

  return <SceneEditor />;
}
