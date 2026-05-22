import * as React from "react";
import { ThemeProvider, createTheme, alpha } from "@mui/material/styles";
import type { ThemeOptions } from "@mui/material/styles";
import { inputsCustomizations } from "./customizations";
import { dataDisplayCustomizations } from "./customizations";
import { feedbackCustomizations } from "./customizations";
import { navigationCustomizations } from "./customizations";
import { surfacesCustomizations } from "./customizations";
import { typography, shadows, gray, blue, green, orange, red, brand } from "./themePrimitives";
import type { ThemeConfig, ThemePreset } from "../store/themeStore";
import { generatePalette } from "./colorUtils";

const purple = {
  300: "#b388ff",
  600: "#7c4dff",
  800: "#6200ea",
};

interface AppThemeProps {
  children: React.ReactNode;
  disableCustomTheme?: boolean;
  themeComponents?: ThemeOptions["components"];
  config?: ThemeConfig;
}

const FONT_SIZE_MAP: Record<string, number> = {
  small: 13,
  medium: 14,
  large: 16,
};

const BORDER_RADIUS_MAP: Record<string, number> = {
  none: 0,
  small: 2,
  medium: 6,
  large: 12,
  round: 20,
};

function getPresetPrimary(preset: ThemePreset, customPrimary?: string) {
  if (preset === "custom" && customPrimary) {
    return generatePalette(customPrimary);
  }

  switch (preset) {
    case "blue":
      return {
        light: blue[300],
        main: blue[600],
        dark: blue[800],
        contrastText: "#ffffff",
      };
    case "green":
      return {
        light: green[300],
        main: green[600],
        dark: green[800],
        contrastText: "#ffffff",
      };
    case "orange":
      return {
        light: orange[300],
        main: orange[600],
        dark: orange[800],
        contrastText: "#ffffff",
      };
    case "purple":
      return {
        light: purple[300],
        main: purple[600],
        dark: purple[800],
        contrastText: "#ffffff",
      };
    case "default":
    default:
      return undefined;
  }
}

function buildColorSchemes(preset: ThemePreset, customPrimary?: string) {
  const presetPrimary = getPresetPrimary(preset, customPrimary);

  const lightPrimary = presetPrimary || {
    light: brand[300],
    main: brand[700],
    dark: brand[800],
    contrastText: "#ffffff",
  };

  const darkPrimary = presetPrimary
    ? {
        light: presetPrimary.light,
        main: presetPrimary.main,
        dark: presetPrimary.dark,
        contrastText: "#ffffff",
      }
    : {
        light: brand[400],
        main: brand[600],
        dark: brand[700],
        contrastText: "#ffffff",
      };

  return {
    light: {
      palette: {
        primary: lightPrimary,
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
        grey: { ...gray },
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
        baseShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
      },
    },
    dark: {
      palette: {
        primary: darkPrimary,
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
        grey: { ...gray },
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
        baseShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
      },
    },
  };
}

export default function AppTheme(props: AppThemeProps) {
  const { children, disableCustomTheme, themeComponents, config } = props;
  const resolvedPreset = config?.preset || "default";
  const customPrimary = config?.customPrimary;
  const fontSize = config?.fontSize || "medium";
  const borderRadius = config?.borderRadius || "medium";

  const theme = React.useMemo(() => {
    if (disableCustomTheme) return {};

    const colorSchemes = buildColorSchemes(resolvedPreset, customPrimary);
    const baseFontSize = FONT_SIZE_MAP[fontSize] || 14;
    const baseBorderRadius = BORDER_RADIUS_MAP[borderRadius] ?? 6;

    return createTheme({
      cssVariables: {
        colorSchemeSelector: "data-mui-color-scheme",
        cssVarPrefix: "template",
      },
      colorSchemes,
      typography: {
        ...typography,
        fontSize: baseFontSize,
      },
      shadows,
      shape: {
        borderRadius: baseBorderRadius,
      },
      components: {
        ...inputsCustomizations,
        ...dataDisplayCustomizations,
        ...feedbackCustomizations,
        ...navigationCustomizations,
        ...surfacesCustomizations,
        ...themeComponents,
      },
    });
  }, [disableCustomTheme, themeComponents, resolvedPreset, customPrimary, fontSize, borderRadius]);

  if (disableCustomTheme) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  return (
    <ThemeProvider theme={theme} disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
