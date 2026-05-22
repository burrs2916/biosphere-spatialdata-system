import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import DriveFileMoveOutlineIcon from "@mui/icons-material/SwapHoriz";
import { resolveIcon } from "../../editor/plugins";
import type { ComponentPluginItem, ComponentCategoryNode } from "../../types/component";

interface PluginCardProps {
  plugin: ComponentPluginItem;
  onMove?: (plugin: ComponentPluginItem, targetCatId: string) => void;
  allCategories?: ComponentCategoryNode[];
  currentCategoryId?: string;
  onClick?: (plugin: ComponentPluginItem) => void;
  size?: "small" | "medium";
}

export function PluginCard({
  plugin,
  onMove,
  allCategories,
  currentCategoryId,
  onClick,
  size = "medium",
}: PluginCardProps) {
  const icon = resolveIcon(plugin.icon, "widgets", size === "small" ? 20 : 22);
  const [hovered, setHovered] = useState(false);
  const [moveAnchor, setMoveAnchor] = useState<null | HTMLElement>(null);

  const handleMoveClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMoveAnchor(e.currentTarget);
  };

  const handleMoveTo = (targetCatId: string) => {
    setMoveAnchor(null);
    onMove?.(plugin, targetCatId);
  };

  const isSmall = size === "small";

  return (
    <Paper
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick?.(plugin)}
      sx={{
        p: isSmall ? 0.75 : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        borderRadius: 1,
        cursor: "pointer",
        border: "1px solid",
        borderColor: "divider",
        opacity: plugin.enabled ? 1 : 0.5,
        position: "relative",
        transition: "all 0.15s",
        "&:hover": {
          bgcolor: "action.hover",
          borderColor: "primary.main",
          transform: "scale(1.05)",
        },
      }}
    >
      <Box
        sx={{
          width: isSmall ? 32 : 36,
          height: isSmall ? 32 : 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.04)",
          borderRadius: 0.75,
          color: "text.secondary",
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontSize: isSmall ? 8 : 9,
          fontWeight: 500,
          textAlign: "center",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        {plugin.name}
      </Typography>

      {hovered && onMove && allCategories && allCategories.length > 1 && (
        <Box
          sx={{
            position: "absolute",
            top: 2,
            right: 2,
          }}
        >
          <IconButton
            size="small"
            onClick={handleMoveClick}
            sx={{ p: 0.25, bgcolor: "background.paper", color: "text.disabled", "&:hover": { color: "primary.main" } }}
          >
            <DriveFileMoveOutlineIcon sx={{ fontSize: 10 }} />
          </IconButton>
        </Box>
      )}
      {onMove && allCategories && (
        <Menu
          anchorEl={moveAnchor}
          open={Boolean(moveAnchor)}
          onClose={() => setMoveAnchor(null)}
          slotProps={{ paper: { sx: { maxHeight: 200 } } }}
        >
          {allCategories
            .filter((cat) => cat.id !== currentCategoryId)
            .map((cat) => (
              <MenuItem
                key={cat.id}
                onClick={() => handleMoveTo(cat.id)}
                sx={{ fontSize: 11 }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: cat.color || "text.secondary" }}>
                    {resolveIcon(cat.icon, "folder", 10)}
                  </Box>
                  {cat.name}
                </Box>
              </MenuItem>
            ))}
        </Menu>
      )}
    </Paper>
  );
}

interface ComponentGridCardProps {
  definition: any;
  onClick?: (definition: any) => void;
  onDragStart?: (e: React.DragEvent, type: string) => void;
}

export function ComponentGridCard({ definition, onClick, onDragStart }: ComponentGridCardProps) {
  const icon = resolveIcon(definition.icon, "widgets", 22);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-component-type", definition.type);
    e.dataTransfer.effectAllowed = "copy";
    onDragStart?.(e, definition.type);
  };

  const handleClick = () => {
    onClick?.(definition);
  };

  return (
    <Tooltip title={definition.description || definition.name} arrow placement="top">
      <Paper
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
        sx={{
          p: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
          borderRadius: 1,
          cursor: "grab",
          border: "1px solid",
          borderColor: "divider",
          transition: "all 0.15s",
          "&:hover": {
            bgcolor: "action.hover",
            borderColor: "primary.main",
            transform: "scale(1.05)",
          },
          "&:active": {
            cursor: "grabbing",
            transform: "scale(0.98)",
          },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)",
            borderRadius: 0.75,
            color: "text.secondary",
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontSize: 9,
            fontWeight: 500,
            textAlign: "center",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {definition.name}
        </Typography>
      </Paper>
    </Tooltip>
  );
}
