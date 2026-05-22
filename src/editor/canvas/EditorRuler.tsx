import React, { memo, useRef, useEffect } from "react";
import Ruler from "@scena/react-ruler";
import { useEditorStore } from "../../store/editorStore";
import { useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";

interface EditorRulerProps {
  children?: React.ReactNode;
  canvasWidth: number;
  canvasHeight: number;
  rulerVisible?: boolean;
}

const EditorRuler: React.FC<EditorRulerProps> = memo(({ children, canvasWidth: _canvasWidth, canvasHeight: _canvasHeight, rulerVisible = true }) => {
  const rulerXRef = useRef<Ruler | null>(null);
  const rulerYRef = useRef<Ruler | null>(null);
  const viewport = useEditorStore((s) => s.viewport);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const offset = rulerVisible ? 20 : 0;

  useEffect(() => {
    if (rulerXRef.current && rulerYRef.current) {
      rulerXRef.current.scroll(-viewport.offset.x / viewport.scale);
      rulerYRef.current.scroll(-viewport.offset.y / viewport.scale);
    }
  }, [viewport.offset, viewport.scale]);

  if (!rulerVisible) {
    return (
      <Box sx={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
        {children}
      </Box>
    );
  }

  const unit = Math.max(50, Math.floor(50 / viewport.scale));

  const bgColor = isDark ? "#1E1E2F" : "#f5f5f5";
  const borderColor = isDark ? "#3A3A4E" : "#ddd";
  const lineColor = isDark ? "#3A3A4E" : "#ccc";
  const textColor = isDark ? "#A0A0B2" : "#666";

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: bgColor,
        fontFamily: '"Inter", "Helvetica Neue", sans-serif',
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: offset,
          height: offset,
          color: textColor,
          textAlign: "center",
          fontSize: 10,
          top: 0,
          left: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          borderBottom: `1px solid ${borderColor}`,
          borderRight: `1px solid ${borderColor}`,
          zIndex: 10,
        }}
      >
        px
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: offset,
          right: 0,
          height: offset,
          backgroundColor: bgColor,
          borderBottom: `1px solid ${borderColor}`,
          zIndex: 5,
        }}
      >
        <Ruler
          ref={rulerXRef}
          type="horizontal"
          zoom={viewport.scale}
          unit={unit}
          segment={2}
          negativeRuler={true}
          scrollPos={-viewport.offset.x / viewport.scale}
          lineColor={lineColor}
          textColor={textColor}
          backgroundColor="transparent"
          textOffset={[0, 10]}
          style={{ width: "100%", height: "100%" }}
        />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: offset,
          left: 0,
          width: offset,
          bottom: 0,
          backgroundColor: bgColor,
          borderRight: `1px solid ${borderColor}`,
          zIndex: 5,
        }}
      >
        <Ruler
          ref={rulerYRef}
          type="vertical"
          zoom={viewport.scale}
          unit={unit}
          segment={2}
          negativeRuler={true}
          scrollPos={-viewport.offset.y / viewport.scale}
          lineColor={lineColor}
          textColor={textColor}
          backgroundColor="transparent"
          textOffset={[10, 0]}
          style={{ width: "100%", height: "100%" }}
        />
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: offset,
          left: offset,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
});

EditorRuler.displayName = "EditorRuler";

export default EditorRuler;
