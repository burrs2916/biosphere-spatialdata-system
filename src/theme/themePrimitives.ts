import { createTheme, alpha, PaletteMode, Shadows } from "@mui/material/styles";

declare module "@mui/material/Paper" {
  interface PaperPropsVariantOverrides {
    highlighted: true;
  }
}

declare module "@mui/material/styles" {
  interface ColorRange {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  }

  interface PaletteColor extends ColorRange {}

  interface Palette {
    baseShadow: string;
  }
}

const defaultTheme = createTheme();

const customShadows: Shadows = [...defaultTheme.shadows];

export const brand = {
  50: "#e8eef5",
  100: "#c5d4e6",
  200: "#9fb8d4",
  300: "#799cc2",
  400: "#5c85b5",
  500: "#3f6ea8",
  600: "#3763a0",
  700: "#2a5688",
  800: "#1e3f66",
  900: "#142a45",
};

export const gray = {
  50: "#f9fafb",
  100: "#f3f4f6",
  200: "#e5e7eb",
  300: "#d1d5db",
  400: "#9ca3af",
  500: "#6b7280",
  600: "#4b5563",
  700: "#374151",
  800: "#1f2937",
  900: "#111827",
};

export const green = {
  50: "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  300: "#6ee7b7",
  400: "#34d399",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
  900: "#064e3b",
};

export const orange = {
  50: "#fffbeb",
  100: "#fef3c7",
  200: "#fde68a",
  300: "#fcd34d",
  400: "#fbbf24",
  500: "#f59e0b",
  600: "#d97706",
  700: "#b45309",
  800: "#92400e",
  900: "#78350f",
};

export const red = {
  50: "#fef2f2",
  100: "#fee2e2",
  200: "#fecaca",
  300: "#fca5a5",
  400: "#f87171",
  500: "#ef4444",
  600: "#dc2626",
  700: "#b91c1c",
  800: "#991b1b",
  900: "#7f1d1d",
};

export const blue = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  300: "#93c5fd",
  400: "#60a5fa",
  500: "#3b82f6",
  600: "#2563eb",
  700: "#1d4ed8",
  800: "#1e40af",
  900: "#1e3a8a",
};

export const getDesignTokens = (mode: PaletteMode) => {
  customShadows[1] =
    mode === "dark"
      ? "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)"
      : "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)";

  return {
    palette: {
      mode,
      primary: {
        light: brand[300],
        main: brand[700],
        dark: brand[800],
        contrastText: "#ffffff",
        ...(mode === "dark" && {
          contrastText: "#ffffff",
          light: brand[400],
          main: brand[600],
          dark: brand[700],
        }),
      },
      secondary: {
        light: gray[300],
        main: gray[500],
        dark: gray[700],
        contrastText: "#ffffff",
      },
      info: {
        light: blue[300],
        main: blue[500],
        dark: blue[700],
        contrastText: "#ffffff",
      },
      warning: {
        light: orange[300],
        main: orange[500],
        dark: orange[700],
        contrastText: "#ffffff",
      },
      error: {
        light: red[300],
        main: red[500],
        dark: red[700],
        contrastText: "#ffffff",
      },
      success: {
        light: green[300],
        main: green[500],
        dark: green[700],
        contrastText: "#ffffff",
      },
      grey: {
        ...gray,
      },
      divider: mode === "dark" ? alpha(gray[700], 0.6) : alpha(gray[300], 0.4),
      background: {
        default: mode === "dark" ? gray[900] : "#f5f7fa",
        paper: mode === "dark" ? gray[800] : "#ffffff",
      },
      text: {
        primary: gray[800],
        secondary: gray[600],
        ...(mode === "dark" && { primary: "#f9fafb", secondary: gray[400] }),
      },
      action: {
        hover: alpha(gray[200], 0.2),
        selected: `${alpha(gray[200], 0.3)}`,
        ...(mode === "dark" && {
          hover: alpha(gray[600], 0.2),
          selected: alpha(gray[600], 0.3),
        }),
      },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: {
        fontSize: defaultTheme.typography.pxToRem(48),
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: -0.02,
      },
      h2: {
        fontSize: defaultTheme.typography.pxToRem(36),
        fontWeight: 600,
        lineHeight: 1.25,
      },
      h3: {
        fontSize: defaultTheme.typography.pxToRem(30),
        fontWeight: 600,
        lineHeight: 1.25,
      },
      h4: {
        fontSize: defaultTheme.typography.pxToRem(24),
        fontWeight: 600,
        lineHeight: 1.5,
      },
      h5: {
        fontSize: defaultTheme.typography.pxToRem(20),
        fontWeight: 600,
        lineHeight: 1.5,
      },
      h6: {
        fontSize: defaultTheme.typography.pxToRem(18),
        fontWeight: 600,
        lineHeight: 1.6,
      },
      subtitle1: {
        fontSize: defaultTheme.typography.pxToRem(18),
        lineHeight: 1.6,
      },
      subtitle2: {
        fontSize: defaultTheme.typography.pxToRem(14),
        fontWeight: 500,
        lineHeight: 1.6,
      },
      body1: {
        fontSize: defaultTheme.typography.pxToRem(16),
        lineHeight: 1.6,
      },
      body2: {
        fontSize: defaultTheme.typography.pxToRem(14),
        fontWeight: 400,
        lineHeight: 1.6,
      },
      caption: {
        fontSize: defaultTheme.typography.pxToRem(12),
        fontWeight: 400,
        lineHeight: 1.5,
      },
      button: {
        textTransform: "none",
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 6,
    },
    shadows: customShadows,
  };
};

export const colorSchemes = {
  light: {
    palette: {
      primary: {
        light: brand[300],
        main: brand[700],
        dark: brand[800],
        contrastText: "#ffffff",
      },
      secondary: {
        light: gray[300],
        main: gray[500],
        dark: gray[700],
        contrastText: "#ffffff",
      },
      info: {
        light: blue[300],
        main: blue[500],
        dark: blue[700],
        contrastText: "#ffffff",
      },
      warning: {
        light: orange[300],
        main: orange[500],
        dark: orange[700],
        contrastText: "#ffffff",
      },
      error: {
        light: red[300],
        main: red[500],
        dark: red[700],
        contrastText: "#ffffff",
      },
      success: {
        light: green[300],
        main: green[500],
        dark: green[700],
        contrastText: "#ffffff",
      },
      grey: {
        ...gray,
      },
      divider: alpha(gray[300], 0.4),
      background: {
        default: "#f5f7fa",
        paper: "#ffffff",
      },
      text: {
        primary: gray[800],
        secondary: gray[600],
      },
      action: {
        hover: alpha(gray[200], 0.2),
        selected: `${alpha(gray[200], 0.3)}`,
      },
      baseShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
    },
  },
  dark: {
    palette: {
      primary: {
        light: brand[400],
        main: brand[600],
        dark: brand[700],
        contrastText: "#ffffff",
      },
      secondary: {
        light: gray[300],
        main: gray[500],
        dark: gray[700],
        contrastText: "#ffffff",
      },
      info: {
        light: blue[300],
        main: blue[500],
        dark: blue[700],
        contrastText: "#ffffff",
      },
      warning: {
        light: orange[300],
        main: orange[500],
        dark: orange[700],
        contrastText: "#ffffff",
      },
      error: {
        light: red[300],
        main: red[500],
        dark: red[700],
        contrastText: "#ffffff",
      },
      success: {
        light: green[300],
        main: green[500],
        dark: green[700],
        contrastText: "#ffffff",
      },
      grey: {
        ...gray,
      },
      divider: alpha(gray[700], 0.6),
      background: {
        default: gray[900],
        paper: gray[800],
      },
      text: {
        primary: "#f9fafb",
        secondary: gray[400],
      },
      action: {
        hover: alpha(gray[600], 0.2),
        selected: alpha(gray[600], 0.3),
      },
      baseShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
    },
  },
};

export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  h1: {
    fontSize: defaultTheme.typography.pxToRem(48),
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: -0.02,
  },
  h2: {
    fontSize: defaultTheme.typography.pxToRem(36),
    fontWeight: 600,
    lineHeight: 1.25,
  },
  h3: {
    fontSize: defaultTheme.typography.pxToRem(30),
    fontWeight: 600,
    lineHeight: 1.25,
  },
  h4: {
    fontSize: defaultTheme.typography.pxToRem(24),
    fontWeight: 600,
    lineHeight: 1.5,
  },
  h5: {
    fontSize: defaultTheme.typography.pxToRem(20),
    fontWeight: 600,
    lineHeight: 1.5,
  },
  h6: {
    fontSize: defaultTheme.typography.pxToRem(18),
    fontWeight: 600,
    lineHeight: 1.6,
  },
  subtitle1: {
    fontSize: defaultTheme.typography.pxToRem(18),
    lineHeight: 1.6,
  },
  subtitle2: {
    fontSize: defaultTheme.typography.pxToRem(14),
    fontWeight: 500,
    lineHeight: 1.6,
  },
  body1: {
    fontSize: defaultTheme.typography.pxToRem(16),
    lineHeight: 1.6,
  },
  body2: {
    fontSize: defaultTheme.typography.pxToRem(14),
    fontWeight: 400,
    lineHeight: 1.6,
  },
  caption: {
    fontSize: defaultTheme.typography.pxToRem(12),
    fontWeight: 400,
    lineHeight: 1.5,
  },
  button: {
    textTransform: "none",
    fontWeight: 500,
  },
};

export const shape = {
  borderRadius: 6,
};

const defaultShadows: Shadows = [
  "none",
  "var(--template-palette-baseShadow)",
  ...defaultTheme.shadows.slice(2),
] as Shadows;

export const shadows = defaultShadows;
