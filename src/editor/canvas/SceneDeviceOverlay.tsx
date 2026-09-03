/**
 * SceneDeviceOverlay — 场景级设备覆盖层
 *
 * 渲染在 EditorCanvas 顶层，从 devicePlacementStore 读取当前视图的设备摆位，
 * 自动合并设备元信息（来自 deviceStore），渲染设备图标。
 *
 * 支持：
 * - pixel 坐标：直接定位
 * - cad 坐标：V2 时通过 parentComponentId 找到 CAD 组件做转换
 * - hover/click 反馈
 * - 在线/离线状态色
 * - 简易 Faceplate 卡片（inline 模式）
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/Delete";
import { useEditorStore } from "../../store/editorStore";
import { useDeviceStore } from "../../store/deviceStore";
import type { DeviceInstance } from "../../types/device";
import { useThrottledDevices } from "../../hooks/useThrottledDevices";
import { useDevicePlacementStore } from "../../store/devicePlacementStore";
import { DEVICE_CATEGORY_LABELS } from "../../types/device";
import type { ProductTag } from "../../types/device";
import type { DevicePlacement } from "../../types/devicePlacement";
import { buildCommandParams, resolveCommandTargetDevice } from "../../devices/deviceCommands";

const STATUS_COLOR = (online: boolean) => (online ? "#4caf50" : "#9e9e9e");

const EMPTY_PLACEMENTS: import("../../types/devicePlacement").DevicePlacement[] = [];

export interface SceneDeviceOverlayProps {
  viewId: string;
  /** 编辑态可以删除/移动；预览态只能点击 */
  editable?: boolean;
  markerSize?: number;
}

export function SceneDeviceOverlay({
  viewId,
  editable = true,
  markerSize = 28,
}: SceneDeviceOverlayProps) {
  const placementsByView = useDevicePlacementStore((s) => s.placementsByView);
  const placements = useMemo(
    () => placementsByView[viewId] ?? EMPTY_PLACEMENTS,
    [placementsByView, viewId],
  );
  const devices = useThrottledDevices<DeviceInstance>(500);
  const products = useDeviceStore((s) => s.products);
  const removePlacement = useDevicePlacementStore((s) => s.removePlacement);
  const viewport = useEditorStore((s) => s.viewport);
  const canvasConfig = useEditorStore((s) => s.canvasConfig);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activePlacementId, setActivePlacementId] = useState<string | null>(null);

  /** canvas 坐标 → 屏幕 px 偏移（结合 viewport 缩放/位移）*/
  const canvasToOverlay = useCallback(
    (placement: DevicePlacement): { x: number; y: number } | null => {
      if (placement.position.type === "pixel") {
        return { x: placement.position.x, y: placement.position.y };
      }
      // CAD 坐标 V2 处理：通过 parentComponentId 找 CAD 组件做转换
      return null;
    },
    [],
  );

  const activePlacement = activePlacementId
    ? placements.find((p) => p.id === activePlacementId)
    : null;
  const activeDevice = activePlacement ? devices[activePlacement.deviceId] : null;
  const activeProduct = activeDevice ? products[activeDevice.productCode] : null;

  return (
    <>
      {/* canvas 内部坐标系：跟随 viewport 变换 */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          width: canvasConfig.width,
          height: canvasConfig.height,
          transformOrigin: "0 0",
          transform: `translate(${viewport.offset.x}px, ${viewport.offset.y}px) scale(${viewport.scale})`,
          pointerEvents: "none",
          zIndex: 200,
        }}
      >
        {placements.map((placement) => {
          const device = devices[placement.deviceId];
          if (!device) return null;
          const product = products[device.productCode];
          const pos = canvasToOverlay(placement);
          if (!pos) return null;

          const isHover = hoveredId === placement.id;
          const isActive = activePlacementId === placement.id;
          const color = STATUS_COLOR(device.online);
          const icon = placement.iconOverride ?? product?.icon ?? "📦";

          return (
            <Box
              key={placement.id}
              sx={{
                position: "absolute",
                left: pos.x - markerSize / 2,
                top: pos.y - markerSize / 2,
                width: markerSize,
                height: markerSize,
                pointerEvents: "auto",
                cursor: "pointer",
                transition: "transform 0.15s",
                transform: isHover || isActive ? "scale(1.25)" : "scale(1)",
                zIndex: isActive ? 30 : 20,
              }}
              onMouseEnter={() => setHoveredId(placement.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setActivePlacementId(isActive ? null : placement.id);
              }}
            >
              <Tooltip
                title={
                  <Box sx={{ p: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                      {device.productName}
                    </Typography>
                    <Typography variant="caption" sx={{ color, display: "block" }}>
                      {device.online ? "在线" : "离线"} · {DEVICE_CATEGORY_LABELS[device.category]}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {device.deviceId}
                    </Typography>
                  </Box>
                }
                arrow
                placement="top"
              >
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    bgcolor: `${color}cc`,
                    border: `2px solid ${color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: markerSize * 0.55,
                    boxShadow: `0 0 8px ${color}66`,
                  }}
                >
                  {icon}
                </Box>
              </Tooltip>

              {placement.labelVisible !== false && (
                <Typography
                  sx={{
                    position: "absolute",
                    top: markerSize + 2,
                    left: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    color: "rgba(255,255,255,0.95)",
                    backgroundColor: "rgba(0,0,0,0.65)",
                    px: 0.5,
                    borderRadius: 0.25,
                    fontSize: 10,
                    pointerEvents: "none",
                  }}
                >
                  {device.productName}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Faceplate 弹卡（inline 模式占位）— 浮层不跟随 viewport 缩放 */}
      {activePlacement && activeDevice && (
        <Paper
          elevation={6}
          sx={{
            position: "absolute",
            right: 16,
            top: 64,
            width: 280,
            zIndex: 1500,
            p: 1.25,
            pointerEvents: "auto",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
            <Box sx={{ fontSize: 20 }}>{activeProduct?.icon ?? "📦"}</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }} noWrap>
                {activeDevice.productName}
              </Typography>
              <Typography sx={{ fontSize: 10, color: "text.secondary" }} noWrap>
                {activeDevice.deviceId}
              </Typography>
            </Box>
            {editable && (
              <Tooltip title="从此视图移除">
                <IconButton
                  size="small"
                  onClick={() => {
                    removePlacement(viewId, activePlacement.id);
                    setActivePlacementId(null);
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={() => setActivePlacementId(null)}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 0.5, fontSize: 11 }}>
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>状态</Typography>
            <Typography sx={{ fontSize: 11, color: STATUS_COLOR(activeDevice.online) }}>
              {activeDevice.online ? "在线" : "离线"}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>类别</Typography>
            <Typography sx={{ fontSize: 11 }}>{DEVICE_CATEGORY_LABELS[activeDevice.category]}</Typography>
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>产品</Typography>
            <Typography sx={{ fontSize: 11 }}>{activeDevice.productName}</Typography>
            {activeDevice.parentDeviceId && (
              <>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>父设备</Typography>
                <Typography sx={{ fontSize: 11 }}>{activeDevice.parentDeviceId}</Typography>
              </>
            )}
          </Box>

          {activeProduct && activeProduct.tags.length > 0 && (
            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: "divider" }}>
              <Typography sx={{ fontSize: 10, color: "text.secondary", mb: 0.5 }}>
                测点 ({activeProduct.tags.length})
              </Typography>
              {/* === 增强：实时值 + 控制命令（subscribeData / writeTag 接入） === */}
              <FaceplateLiveControl
                deviceId={activeDevice.deviceId}
                tags={activeProduct.tags.slice(0, 8)}
                online={activeDevice.online}
                category={activeDevice.category}
                parentDeviceId={activeDevice.parentDeviceId}
              />
              {activeProduct.tags.length > 8 && (
                <Box sx={{ fontSize: 10, color: "text.secondary" }}>
                  +{activeProduct.tags.length - 8}
                </Box>
              )}
            </Box>
          )}
        </Paper>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// FaceplateLiveControl — 实时值显示 + 控制命令
// 增强模块：subscribeData / writeTag 接入；
// 不破坏：原 chip 显示保留，UI 替换为更可用的控制条
// ═══════════════════════════════════════════════════════════════

interface FaceplateLiveControlProps {
  deviceId: string;
  tags: ProductTag[];
  online: boolean;
  category?: string;
  parentDeviceId?: string;
}

function FaceplateLiveControl({ deviceId, tags, online, category, parentDeviceId }: FaceplateLiveControlProps) {
  const subscribeData = useDeviceStore((s) => s.subscribeData);
  const writeTag = useDeviceStore((s) => s.writeTag);
  const sendCommand = useDeviceStore((s) => s.sendCommand);

  // 每 tag 缓存最新值；onUnmount 自动取消订阅
  const [values, setValues] = useState<Record<string, unknown>>({});
  // 控制命令回执反馈（内联 Snackbar）
  const [feedback, setFeedback] = useState<{ open: boolean; msg: string; severity: "success" | "warning" | "error" }>({
    open: false, msg: "", severity: "success",
  });
  // === 增强：稳定 tagId 列表字符串作为依赖，避免父组件重渲染时反复 unsubscribe/resubscribe ===
  const tagIdsKey = useMemo(() => tags.map((t) => t.id).join("|"), [tags]);
  const lastUpdateRef = useRef<number>(Date.now());
  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    if (!deviceId || tagIdsKey === "") return;
    const unsubs: Array<() => void> = [];
    for (const t of tags) {
      const u = subscribeData(deviceId, t.id, (v) => {
        lastUpdateRef.current = Date.now();
        setIsStale(false);
        setValues((prev) => ({ ...prev, [t.id]: v }));
      });
      if (typeof u === "function") unsubs.push(u);
    }
    return () => {
      for (const u of unsubs) {
        try { u(); } catch { /* swallow */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, tagIdsKey, subscribeData]);

  // 实时数据过期检测：60s 无更新标记 stale
  useEffect(() => {
    const id = setInterval(() => {
      setIsStale(Date.now() - lastUpdateRef.current > 60_000);
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  const formatValue = (v: unknown, unit?: string): string => {
    if (v === undefined || v === null) return "—";
    if (typeof v === "boolean") return v ? "开" : "关";
    if (typeof v === "number") return `${v}${unit ?? ""}`;
    return `${String(v)}${unit ?? ""}`;
  };

  // 命令下发中状态：正在下发的 tagId 集合，下发期间控件 disabled
  const [dispatchingTagIds, setDispatchingTagIds] = useState<Set<string>>(new Set());

  /**
   * 写入某 tag：
   * - tag 带 commandCode → 走结构化 sendCommand，按回执 code 反馈状态
   * - 否则 → 走 writeTag（MQTT 通道），成功/失败仅粗粒度提示
   * 下发期间控件 disabled，防止重复操作
   */
  const dispatchWrite = useCallback(
    async (tag: ProductTag, value: unknown) => {
      // 正在下发中：忽略
      if (dispatchingTagIds.has(tag.id)) return;
      setDispatchingTagIds((prev) => new Set(prev).add(tag.id));

      try {
        if (tag.commandCode) {
          const ctx = { deviceId, category, parentDeviceId };
          const params = buildCommandParams(tag.commandCode, tag.id, value, ctx);
          const targetDeviceId = resolveCommandTargetDevice(ctx);
          const result = await sendCommand(targetDeviceId, tag.commandCode, params);
          if (result.success) {
            setFeedback({ open: true, msg: `${tag.name}：命令已下发`, severity: "success" });
          } else {
            const severity = result.code === 503 || result.code === 404 ? "warning" : "error";
            setFeedback({ open: true, msg: `${tag.name}：${result.msg}`, severity });
          }
        } else {
          try {
            await writeTag(deviceId, tag.id, value);
            setFeedback({ open: true, msg: `${tag.name}：已写入`, severity: "success" });
          } catch {
            setFeedback({ open: true, msg: `${tag.name}：写入失败`, severity: "error" });
          }
        }
      } finally {
        setDispatchingTagIds((prev) => {
          const next = new Set(prev);
          next.delete(tag.id);
          return next;
        });
      }
    },
    [deviceId, category, parentDeviceId, sendCommand, writeTag, dispatchingTagIds],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {tags.map((tag) => {
        const v = values[tag.id];
        const isBool = tag.dataType === "boolean";
        const isWritable = tag.writable === true;
        return (
          <Box
            key={tag.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: 10,
              px: 0.5,
              py: 0.25,
              bgcolor: "action.hover",
              borderRadius: 0.5,
            }}
          >
            <Typography sx={{ fontSize: 10, flex: 1, minWidth: 0 }} noWrap>
              {tag.name}
              {tag.unit && (
                <Box component="span" sx={{ color: "text.secondary", ml: 0.25 }}>
                  ({tag.unit})
                </Box>
              )}
            </Typography>
            {isWritable && isBool && online ? (
              <Switch
                size="small"
                checked={v === true}
                disabled={dispatchingTagIds.has(tag.id)}
                onChange={(_, checked) => {
                  void dispatchWrite(tag, checked);
                }}
                sx={{ p: 0, ml: 0.25 }}
              />
            ) : isWritable && !isBool && online ? (
              <Button
                size="small"
                disabled={dispatchingTagIds.has(tag.id)}
                variant="outlined"
                sx={{ fontSize: 9, py: 0, px: 0.5, minWidth: 0, lineHeight: 1.2 }}
                onClick={() => {
                  const raw = prompt(`设置 ${tag.name}${tag.unit ? ` (${tag.unit})` : ""}`, String(v ?? ""));
                  if (raw === null) return;
                  const num = Number(raw);
                  void dispatchWrite(tag, isNaN(num) ? raw : num);
                }}
              >
                写入
              </Button>
            ) : null}
            <Typography
              sx={{
                fontSize: 10,
                color: isBool ? (v === true ? "success.main" : "text.disabled") : "text.primary",
                minWidth: 24,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatValue(v, tag.unit)}
            </Typography>
          </Box>
        );
      })}
      {!online && (
        <Typography sx={{ fontSize: 9, color: "text.disabled", textAlign: "center" }}>
          设备离线，控制不可用
        </Typography>
      )}
      {online && isStale && (
        <Typography sx={{ fontSize: 9, color: "warning.main", textAlign: "center" }}>
          实时数据已过期（&gt;60s 无更新）
        </Typography>
      )}
      <Snackbar
        open={feedback.open}
        autoHideDuration={2500}
        onClose={() => setFeedback((f) => ({ ...f, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={feedback.severity}
          variant="filled"
          onClose={() => setFeedback((f) => ({ ...f, open: false }))}
          sx={{ fontSize: 11, py: 0, alignItems: "center" }}
        >
          {feedback.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

