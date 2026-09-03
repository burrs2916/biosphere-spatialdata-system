import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { useToastStore } from "./toastStore";

/**
 * 全局 toast 宿主：挂载在 AppTheme 内，跟随应用主题（明暗/配色）。
 * 任何地方都可经 showToast() 命令式触发。
 */
export default function ToastHost() {
  const open = useToastStore((s) => s.open);
  const message = useToastStore((s) => s.message);
  const severity = useToastStore((s) => s.severity);
  const closeToast = useToastStore((s) => s.closeToast);

  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={closeToast}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity={severity}
        variant="filled"
        onClose={closeToast}
        sx={{ width: "100%", maxWidth: "90vw" }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
