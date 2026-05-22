import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import SaveIcon from "@mui/icons-material/Save";
import { componentRegistry } from "../../editor/registry";
import type { ComponentDefinition } from "../../types/editor";
import { CATEGORY_LABELS } from "../../types/editor";
import { useEditorStore } from "../../store/editorStore";

const CATEGORY_ORDER: string[] = ["basic", "chart", "map", "media", "decoration", "custom"];

function ComponentChip({ definition }: { definition: ComponentDefinition }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("component-type", definition.type);
    e.dataTransfer.effectAllowed = "copy";
  };

  const addComponent = useEditorStore((s) => s.addComponent);

  const handleClick = () => {
    addComponent(definition.type);
  };

  return (
    <Tooltip title={definition.description || definition.name} arrow>
      <Chip
        icon={
          <Box
            sx={{
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            {definition.icon === "wallpaper" && "🖼"}
            {definition.icon === "text_fields" && "T"}
            {definition.icon === "image" && "📷"}
            {definition.icon === "crop_square" && "▢"}
            {definition.icon === "bar_chart" && "📊"}
            {definition.icon === "speed" && "⚡"}
            {definition.icon === "map" && "🗺"}
            {definition.icon === "architecture" && "📐"}
            {definition.icon === "public" && "🌍"}
            {definition.icon === "whatshot" && "🔥"}
            {definition.icon === "videocam" && "🎥"}
          </Box>
        }
        label={definition.name}
        size="small"
        variant="outlined"
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
        sx={{
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          "&:hover": {
            backgroundColor: "action.hover",
            borderColor: "primary.main",
          },
          transition: "all 0.15s",
        }}
      />
    </Tooltip>
  );
}

export function EditorToolbar() {
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const categories = componentRegistry.getCategories();
  const orderedCategories = CATEGORY_ORDER.filter((c) => categories.includes(c));

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderBottom: 1,
        borderColor: "divider",
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.02)"
            : "rgba(0,0,0,0.01)",
        overflow: "auto",
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        <Tooltip title="撤销">
          <IconButton size="small" onClick={undo} disabled={!canUndo()}>
            <UndoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="重做">
          <IconButton size="small" onClick={redo} disabled={!canRedo()}>
            <RedoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="保存">
          <IconButton size="small">
            <SaveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {orderedCategories.map((category, idx) => {
        const definitions = componentRegistry.getByCategory(category);
        if (definitions.length === 0) return null;

        return (
          <Box
            key={category}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              flexShrink: 0,
            }}
          >
            {idx > 0 && <Divider orientation="vertical" flexItem sx={{ mr: 0.5 }} />}
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 600,
                whiteSpace: "nowrap",
                minWidth: "fit-content",
              }}
            >
              {CATEGORY_LABELS[category]}
            </Typography>
            {definitions.map((def) => (
              <ComponentChip key={def.type} definition={def} />
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
