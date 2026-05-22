import type { ThemeOptions } from "@mui/material/styles";

export const inputsCustomizations: ThemeOptions["components"] = {
  MuiButtonBase: {
    styleOverrides: {
      root: {
        textTransform: "none",
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: "none",
        fontWeight: 600,
      },
    },
  },
  MuiInputBase: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
  MuiFilledInput: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        "&:before": {
          display: "none",
        },
        "&:after": {
          display: "none",
        },
      },
    },
  },
};

export const dataDisplayCustomizations: ThemeOptions["components"] = {
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 4,
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderColor: "var(--template-palette-divider)",
      },
    },
  },
  MuiPaper: {
    variants: [
      {
        props: { variant: "highlighted" },
        style: ({ theme }) => ({
          backgroundColor: theme.vars
            ? `rgba(${theme.vars.palette.primary.mainChannel} / 0.08)`
            : "rgba(33, 53, 71, 0.08)",
          backgroundImage: "none",
        }),
      },
    ],
  },
};

export const feedbackCustomizations: ThemeOptions["components"] = {
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
};

export const navigationCustomizations: ThemeOptions["components"] = {
  MuiMenuItem: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: "none",
        fontWeight: 600,
      },
    },
  },
};

export const surfacesCustomizations: ThemeOptions["components"] = {
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        borderColor: "var(--template-palette-divider)",
        backgroundImage: "none",
      },
    },
  },
  MuiAccordion: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        "&:before": {
          display: "none",
        },
      },
    },
  },
};
