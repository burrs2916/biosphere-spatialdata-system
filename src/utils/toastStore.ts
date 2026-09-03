import { create } from "zustand";

export type ToastSeverity = "error" | "warning" | "info" | "success";

interface ToastState {
  open: boolean;
  message: string;
  severity: ToastSeverity;
  showToast: (message: string, severity?: ToastSeverity) => void;
  closeToast: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  open: false,
  message: "",
  severity: "error",
  showToast: (message, severity = "error") => set({ open: true, message, severity }),
  closeToast: () => set({ open: false }),
}));

/** 命令式入口：在非 React 组件（如 authGate）里也能直接弹 toast。 */
export function showToast(message: string, severity: ToastSeverity = "error") {
  useToastStore.getState().showToast(message, severity);
}
