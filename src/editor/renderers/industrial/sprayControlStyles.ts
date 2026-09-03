/**
 * sprayControlStyles — 喷雾控制工具栏的公共样式和动画
 *
 * 将 @keyframes 和卡片样式函数从 SprayControlToolbarRenderer.tsx 中抽出，
 * 避免每个卡片实例都内联定义 keyframes，减少重复。
 */

// ─── 全局 CSS keyframes（注入一次即可，通过 className 引用）───
export const SPRAY_CONTROL_KEYFRAMES_CSS = `
@keyframes sprayFlash {
  0%   { box-shadow: 0 0 24px rgba(76,175,80,1), inset 0 0 16px rgba(76,175,80,0.6); transform: scale(1.05); }
  50%  { box-shadow: 0 0 18px rgba(76,175,80,0.9), inset 0 0 12px rgba(76,175,80,0.4); transform: scale(1.02); }
  100% { box-shadow: 0 0 0px rgba(76,175,80,0); transform: scale(1.0); }
}
@keyframes pendingPulse {
  0%   { box-shadow: 0 0 8px var(--glow-color, #FFC107)50, inset 0 0 4px var(--glow-color, #FFC107)20; }
  50%  { box-shadow: 0 0 20px var(--glow-color, #FFC107)90, inset 0 0 10px var(--glow-color, #FFC107)40; }
  100% { box-shadow: 0 0 8px var(--glow-color, #FFC107)50, inset 0 0 4px var(--glow-color, #FFC107)20; }
}
@keyframes forceSprayBreathe {
  0%   { box-shadow: 0 0 8px rgba(0,188,212,0.3), inset 0 0 4px rgba(0,188,212,0.1); }
  50%  { box-shadow: 0 0 16px rgba(0,188,212,0.7), inset 0 0 8px rgba(0,188,212,0.3); }
  100% { box-shadow: 0 0 8px rgba(0,188,212,0.3), inset 0 0 4px rgba(0,188,212,0.1); }
}
@keyframes flashDot {
  0%   { transform: scale(0); opacity: 0; }
  50%  { transform: scale(1.5); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.7; }
}
@keyframes pendingDotPulse {
  0%   { transform: scale(0.8); opacity: 0.6; }
  50%  { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.6; }
}
@keyframes spraySpin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// ─── 视觉反馈类型 ───
export interface VisualFeedback {
  glowColor: string;
  glowIntensity: number;
  animType: "pending" | "spraying" | "forceSpray" | "stopped" | "none";
}

// ─── 动画 class 名称 ───
export function getCardAnimationClass(flashing: boolean, pending: boolean, feedback: VisualFeedback): string {
  if (flashing) return "spray-card-flash";
  if (pending) return "spray-card-pending";
  if (feedback.animType === "forceSpray") return "spray-card-force-breathe";
  return "";
}

export function getDotAnimationClass(pending: boolean): string {
  return pending ? "spray-dot-pending" : "spray-dot-flash";
}

// ─── 注入全局 CSS（仅注入一次）───
let cssInjected = false;
export function injectSprayControlCSS() {
  if (cssInjected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.id = "spray-control-keyframes";
  style.textContent = SPRAY_CONTROL_KEYFRAMES_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}
