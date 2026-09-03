/**
 * SubControllerCard — 分控器卡片子组件
 *
 * 从 SprayControlToolbarRenderer.tsx 中抽出，负责单个分控器卡片的渲染：
 *   - 选中/在线/离线/喷洒状态视觉
 *   - pending 待确认动画
 *   - 状态变化闪动
 *   - Tooltip 悬浮详情
 *   - SVG 画像 + LED 灯
 */
import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import ButtonBase from "@mui/material/ButtonBase";
import { SubControllerFrame } from "../deviceVariants/DeviceSvgFrames";
import type { DeviceLiveStatus, StatusVisual, ControllerState } from "../deviceVariants/deviceStatus";
import { isAnySpraying } from "../deviceVariants/deviceStatus";
import type { VisualFeedback } from "./sprayControlStyles";

export interface SubControllerInfo {
  deviceId: string;
  productName: string;
  online: boolean;
  parentDeviceId: string;
  parentName: string;
  controllerState: ControllerState | null;
  controllerStateRaw?: number;
  batteryWarning: number;
  sprayStatusText: string;
  lastChangeTime: number;
  pendingSince: number;
  pendingAction?: "forceSpray" | "forceStop" | "loopStart" | "loopStop";
}

interface SubControllerCardProps {
  ctrl: SubControllerInfo;
  selected: boolean;
  feedback: VisualFeedback;
  flashing: boolean;
  pending: boolean;
  mainControllerCount: number;
  onToggle: (id: string, shiftKey: boolean) => void;
  mapControllerStatus: (ctrl: SubControllerInfo) => DeviceLiveStatus;
  mapStatusVisual: (ctrl: SubControllerInfo) => StatusVisual;
  buildScreenItems: (ctrl: SubControllerInfo, isSpraying: boolean) => Array<{ key: string; label: string; value: string; unit?: string }>;
}

/** 从 deviceId 中提取分控器协议编号 (1字节, 0-255) */
function extractControllerId(deviceId: string): number | null {
  const parts = deviceId.split(/[-\s_.]+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const n = Number(parts[i]);
    if (Number.isFinite(n) && n >= 0 && n <= 255 && String(n) === parts[i]) {
      return n;
    }
  }
  return null;
}

export const SubControllerCard = React.memo(function SubControllerCard({
  ctrl, selected, feedback, flashing, pending, mainControllerCount,
  onToggle, mapControllerStatus, mapStatusVisual, buildScreenItems,
}: SubControllerCardProps) {
  const isSpraying = isAnySpraying(ctrl.controllerState);
  const controllerNo = extractControllerId(ctrl.deviceId);

  return (
    <Tooltip
      key={ctrl.deviceId}
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{ctrl.productName}</Typography>
          <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "monospace", mb: 0.5 }}>
            ID: {ctrl.deviceId}
            {controllerNo !== null && ` · 编号 #${controllerNo}`}
          </Typography>
          <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.1)", pt: 0.5, mt: 0.5 }}>
            <Typography sx={{ fontSize: 14, color: ctrl.online ? "#4ade80" : "#9ca3af" }}>
              {ctrl.online ? `● 在线 · ${ctrl.sprayStatusText || "待机"}` : "○ 离线"}
            </Typography>
            {pending && (
              <Typography sx={{ fontSize: 13, color: feedback.glowColor, fontWeight: 600 }}>
                ⏳ 等待确认: {ctrl.pendingAction === "forceSpray" ? "强喷" : ctrl.pendingAction === "forceStop" ? "强停" : ctrl.pendingAction === "loopStart" ? "循环喷" : "停循环"}
              </Typography>
            )}
            <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              所属集控: {ctrl.parentName}
            </Typography>
            {ctrl.controllerState?.batteryWarn && (
              <Typography sx={{ fontSize: 13, color: "#f59e0b" }}>
                ⚠ 电池预警（0x{ctrl.batteryWarning.toString(16).padStart(4, "0")}）
              </Typography>
            )}
            {ctrl.controllerState?.commFault && (
              <Typography sx={{ fontSize: 13, color: "#ef4444" }}>✕ 通讯故障</Typography>
            )}
            {ctrl.controllerState && (
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                state=0x{Object.entries(ctrl.controllerState)
                  .filter(([k, v]) => v && k !== "batteryWarn" && k !== "commFault")
                  .map(([k]) => k)
                  .join("|") || "0"}
              </Typography>
            )}
          </Box>
          <Typography sx={{ fontSize: 12, color: "text.disabled", mt: 0.5, fontStyle: "italic" }}>
            点击: 多选切换 · Shift+点击: 单选
          </Typography>
        </Box>
      }
      arrow
      placement="top"
    >
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: 120 }}>
        <ButtonBase
          onClick={(e) => onToggle(ctrl.deviceId, e.shiftKey)}
          sx={{
            position: "relative",
            display: "flex", flexDirection: "column", alignItems: "center",
            width: 120, height: 120,
            p: 0.5,
            borderRadius: 1.5,
            // ── 边框颜色：选中 > pending > 闪动 > 喷洒 > 在线/离线 ──
            border: selected ? "3px solid" : "2px solid",
            borderColor: selected
              ? "rgba(79,195,247,1)"
              : pending
                ? `${feedback.glowColor}`
                : flashing
                  ? "rgba(76,175,80,1)"
                  : feedback.animType === "forceSpray"
                    ? "rgba(0,188,212,0.5)"
                    : feedback.animType === "spraying"
                      ? "rgba(76,175,80,0.4)"
                      : ctrl.online
                        ? "rgba(255,255,255,0.18)"
                        : "rgba(255,255,255,0.08)",
            // ── 背景色 ──
            backgroundColor: selected
              ? "rgba(79,195,247,0.45)"
              : pending
                ? `${feedback.glowColor}15`
                : feedback.animType === "forceSpray"
                  ? "rgba(0,188,212,0.18)"
                  : isSpraying
                    ? "rgba(59,130,246,0.22)"
                    : ctrl.online
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.02)",
            // ── 阴影/光晕 ──
            boxShadow: selected
              ? "0 0 16px rgba(79,195,247,0.7), inset 0 0 8px rgba(79,195,247,0.3)"
              : pending
                ? `0 0 14px ${feedback.glowColor}80, inset 0 0 8px ${feedback.glowColor}30`
                : flashing
                  ? "0 0 18px rgba(76,175,80,0.9), inset 0 0 12px rgba(76,175,80,0.4)"
                  : feedback.animType === "forceSpray"
                    ? `0 0 12px ${feedback.glowColor}60`
                    : isSpraying
                      ? "0 0 10px rgba(59,130,246,0.4)"
                      : "none",
            cursor: ctrl.online ? "pointer" : "not-allowed",
            opacity: ctrl.online ? 1 : 0.45,
            filter: ctrl.online ? "none" : "grayscale(0.6)",
            transition: "all 0.15s ease",
            // ── 动画：全局 CSS keyframes（sprayControlStyles.ts 注入）──
            ...(pending ? { ["--glow-color" as string]: feedback.glowColor } : {}),
            animation: flashing
              ? "sprayFlash 0.8s ease-out"
              : pending
                ? "pendingPulse 1.5s ease-in-out infinite"
                : feedback.animType === "forceSpray"
                  ? "forceSprayBreathe 2s ease-in-out infinite"
                  : "none",
            "&:hover": ctrl.online ? {
              backgroundColor: selected
                ? "rgba(79,195,247,0.55)"
                : pending
                  ? `${feedback.glowColor}25`
                  : "rgba(255,255,255,0.12)",
              borderColor: selected
                ? "rgba(79,195,247,0.8)"
                : pending
                  ? `${feedback.glowColor}`
                  : "rgba(79,195,247,0.6)",
            } : {},
          }}
        >
          {/* 状态变化指示器（右上角） */}
          {(flashing || pending) && (
            <Box sx={{
              position: "absolute", top: -6, right: -6,
              width: 14, height: 14, borderRadius: "50%",
              backgroundColor: pending ? feedback.glowColor : "#4caf50",
              border: "2px solid rgba(0,20,40,0.95)",
              boxShadow: pending
                ? `0 0 10px ${feedback.glowColor}`
                : "0 0 8px rgba(76,175,80,0.9)",
              animation: pending
                ? "pendingDotPulse 1.2s ease-in-out infinite"
                : "flashDot 0.8s ease-out",
              pointerEvents: "none",
            }} />
          )}
          {/* 编号徽章 */}
          {controllerNo !== null && (
            <Box sx={{
              position: "absolute", top: 2, right: 2,
              minWidth: 22, height: 22, px: 0.5,
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: selected
                ? "rgba(79,195,247,0.95)"
                : isSpraying
                  ? "rgba(59,130,246,0.95)"
                  : ctrl.online
                    ? "rgba(255,255,255,0.85)"
                    : "rgba(255,255,255,0.4)",
              color: selected || isSpraying ? "#fff" : "#1a1a1a",
              fontSize: 13, fontWeight: 700, fontFamily: "monospace",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              pointerEvents: "none",
            }}>
              {controllerNo}
            </Box>
          )}
          {/* 离线/故障水印 */}
          {!ctrl.online && (
            <Box sx={{
              position: "absolute", bottom: 2, left: 2,
              px: 0.5, py: 0.125, borderRadius: 0.5,
              fontSize: 10, fontWeight: 700,
              backgroundColor: "rgba(0,0,0,0.7)", color: "#9ca3af",
              pointerEvents: "none",
            }}>离线</Box>
          )}
          {ctrl.controllerState?.commFault && (
            <Box sx={{
              position: "absolute", bottom: 2, left: 2,
              px: 0.5, py: 0.125, borderRadius: 0.5,
              fontSize: 10, fontWeight: 700,
              backgroundColor: "rgba(244,67,54,0.9)", color: "#fff",
              pointerEvents: "none",
            }}>通讯故障</Box>
          )}
          {/* 分控器画像 SVG */}
          <Box sx={{
            flex: 1, width: "100%", position: "relative",
            pointerEvents: "none",
          }}>
            <SubControllerFrame
              label={ctrl.deviceId}
              parentName={mainControllerCount > 1 ? undefined : ctrl.parentName}
              isTemplate={false}
              status={mapControllerStatus(ctrl)}
              statusVisual={mapStatusVisual(ctrl)}
              screenItems={buildScreenItems(ctrl, isSpraying)}
              controllerState={ctrl.controllerStateRaw}
            />
          </Box>
        </ButtonBase>

        {/* 分控器名称 + device_id */}
        <Box sx={{
          mt: 0.5, width: "100%",
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", lineHeight: 1.15,
        }}>
          <Typography sx={{
            fontSize: 14, fontWeight: 600,
            color: selected
              ? "rgba(79,195,247,1)"
              : ctrl.online
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.4)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
          }}>
            {ctrl.productName}
          </Typography>
          <Typography sx={{
            fontSize: 12, fontFamily: "monospace",
            color: selected
              ? "rgba(79,195,247,0.85)"
              : ctrl.online
                ? "rgba(255,255,255,0.5)"
                : "rgba(255,255,255,0.3)",
          }}>
            {ctrl.deviceId}
          </Typography>
        </Box>
      </Box>
    </Tooltip>
  );
});
