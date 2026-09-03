/**
 * DevicePalettePanel — 设备库面板
 *
 * 两区架构：
 * - ① 设备接入区（顶部，可折叠）：显示已接入的设备连接 + 配置入口
 * - ② 设备列表区（中部，主体）：按类别分组显示设备，拖拽到画布
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Collapse from "@mui/material/Collapse";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CircleIcon from "@mui/icons-material/Circle";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsInputAntennaIcon from "@mui/icons-material/SettingsInputAntenna";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import { useDeviceStore, ensureDevicesLoaded } from "../../store/deviceStore";
import { useDevicePlacementStore } from "../../store/devicePlacementStore";
import { useDeviceAdapterStore } from "../../store/deviceAdapterStore";
import {
  useAlarmHistoryStore,
  isAlarmSoundEnabled,
  isAlarmNotifyEnabled,
  setAlarmPreferences,
} from "../../store/alarmHistoryStore";
import { useDataSourceStore } from "../../store/datasourceStore";
import { useEditorStore } from "../../store/editorStore";
import { logger } from "../../utils/logger";
import { DEVICE_CATEGORY_LABELS } from "../../types/device";
import type { DeviceCategory, DeviceInstance } from "../../types/device";
import { DeviceAdapterConfigPanel } from "./DeviceAdapterConfigPanel";
import { ControlPanelRenderer } from "../renderers/deviceVariants/CardVariantRenderer";
import { componentRegistry } from "../registry";
import { LazyVisible } from "../components/LazyVisible";
import { DEFAULT_PRODUCT_CODE_MAPPING } from "../../devices/edgeConductorDefaults";

const CATEGORY_ORDER: DeviceCategory[] = ["main", "sub", "sensor", "auxiliary"];

export function DevicePalettePanel() {
  const devices = useDeviceStore((s) => s.devices);
  const products = useDeviceStore((s) => s.products);
  const isLoading = useDeviceStore((s) => s.isLoading);
  const error = useDeviceStore((s) => s.error);
  const deviceStates = useDeviceStore((s) => s.deviceStates) as Record<string, string>;
  const reload = useDeviceStore((s) => s.reload);

  const adapters = useDeviceAdapterStore((s) => s.adapters);

  const activeViewId = useEditorStore((s) => s.activeViewId);
  const placementsByView = useDevicePlacementStore((s) => s.placementsByView);
  const placedDeviceIds = useMemo(
    () => new Set((placementsByView[activeViewId] ?? []).map((p) => p.deviceId)),
    [placementsByView, activeViewId],
  );

  const setDraggedDeviceId = useEditorStore((s) => s.setDraggedDeviceId);

  // 订阅数据源变化，确保 linkedAdapters 计算时能拿到最新状态
  const dataSources = useDataSourceStore((s) => s.dataSources);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<DeviceCategory, boolean>>({
    main: false,
    sub: false,
    sensor: false,
    auxiliary: false,
  });
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sensorsOnly, setSensorsOnly] = useState(false);
  const [dataSourceExpanded, setDataSourceExpanded] = useState(true);

  // 子面板状态
  const [showAdapterConfig, setShowAdapterConfig] = useState(false);

  useEffect(() => {
    void ensureDevicesLoaded();
  }, []);

  const grouped = useMemo(() => {
    const all = Object.values(devices);
    const q = search.trim().toLowerCase();
    const filtered = all.filter((d) => {
      if (sensorsOnly && d.category !== "sensor") return false;
      if (onlineOnly && !d.online) return false;
      if (!q) return true;
      return (
        d.deviceId.toLowerCase().includes(q) ||
        d.productName.toLowerCase().includes(q) ||
        d.productCode.toLowerCase().includes(q)
      );
    });
    const map: Record<DeviceCategory, DeviceInstance[]> = {
      main: [],
      sub: [],
      sensor: [],
      auxiliary: [],
    };
    for (const d of filtered) map[d.category]?.push(d);
    return map;
  }, [devices, search, onlineOnly, sensorsOnly]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, device: DeviceInstance, variantId?: string) => {
      logger.info("DevicePalettePanel", "Drag start", {
        deviceId: device.deviceId,
        productCode: device.productCode,
        variantId,
      });
      setDraggedDeviceId(device.deviceId);
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("application/x-device-id", device.deviceId);
      e.dataTransfer.setData("application/x-product-code", device.productCode);
      if (variantId) {
        e.dataTransfer.setData("application/x-device-variant", variantId);
      }
      // 验证 dataTransfer 是否设置成功
      logger.info("DevicePalettePanel", "DataTransfer set", {
        deviceIdData: e.dataTransfer.getData("application/x-device-id"),
        productCodeData: e.dataTransfer.getData("application/x-product-code"),
      });
    },
    [setDraggedDeviceId],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedDeviceId(null);
  }, [setDraggedDeviceId]);

  const toggleCategory = (cat: DeviceCategory) => {
    setCollapsed((s) => ({ ...s, [cat]: !s[cat] }));
  };

  const hasAdapters = adapters.length > 0;

  // 计算已接入的适配器（有数据源关联的）
  const linkedAdapters = useMemo(() => {
    const dsStore = useDataSourceStore.getState();
    return adapters.filter((a) => a.dataSourceId && dsStore.getDataSource(a.dataSourceId));
  }, [adapters, dataSources]);

  // 子面板：适配器配置
  if (showAdapterConfig) {
    return <DeviceAdapterConfigPanel onClose={() => setShowAdapterConfig(false)} />;
  }

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ① 设备接入区 */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Box
          onClick={() => setDataSourceExpanded(!dataSourceExpanded)}
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1,
            py: 0.5,
            cursor: "pointer",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {dataSourceExpanded ? (
            <ExpandLessIcon sx={{ fontSize: 14 }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 14 }} />
          )}
          <StorageIcon sx={{ fontSize: 13, ml: 0.5, color: "text.secondary" }} />
          <Typography sx={{ fontSize: 10, fontWeight: 600, ml: 0.5, flex: 1, color: "text.secondary" }}>
            设备接入
          </Typography>
          {linkedAdapters.length > 0 ? (
            <Chip
              size="small"
              label={`${linkedAdapters.length} 已接入`}
              color="success"
              sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.5 } }}
            />
          ) : (
            <Chip
              size="small"
              label="未接入"
              sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.5 } }}
            />
          )}
        </Box>
        <Collapse in={dataSourceExpanded} timeout="auto">
          <Box sx={{ px: 1, pb: 0.75 }}>
            {/* 已配置的设备接入列表 */}
            {linkedAdapters.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, mb: 0.5 }}>
                {linkedAdapters.map((adapter) => {
                  const ds = useDataSourceStore.getState().getDataSource(adapter.dataSourceId);
                  if (!ds) return null;
                  const isConnected = ds.status === "connected";
                  return (
                    <Box
                      key={adapter.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        bgcolor: "action.hover",
                        fontSize: 9,
                      }}
                    >
                      <CircleIcon sx={{ fontSize: 6, color: isConnected ? "success.main" : "grey.400" }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 9, lineHeight: 1.2 }} noWrap>
                          {adapter.name || ds.name || "未命名"}
                        </Typography>
                        <Typography sx={{ fontSize: 8, color: "text.disabled", lineHeight: 1.2 }} noWrap>
                          {ds.connection.url}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: 8, color: "text.disabled", flexShrink: 0 }}>
                        {ds.type.toUpperCase()}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            ) : null}

            {/* 配置入口按钮 */}
            <Button
              size="small"
              fullWidth
              variant={hasAdapters ? "outlined" : "contained"}
              startIcon={<SettingsInputAntennaIcon sx={{ fontSize: 12 }} />}
              onClick={() => setShowAdapterConfig(true)}
              sx={{ fontSize: 9, textTransform: "none", py: 0.25 }}
            >
              {hasAdapters ? "管理设备接入" : "配置设备接入"}
            </Button>

            {!hasAdapters && (
              <Typography sx={{ fontSize: 8, color: "text.disabled", textAlign: "center", mt: 0.5 }}>
                先在"数据源管理"中配置连接，再在此处接入设备
              </Typography>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* ② 设备统计 + 健康指示（增强：在原有"设备列表区"上方插入） */}
      <DeviceStatsBar />

      {/* ② 设备列表区 */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: 0.75 }}>
          <TextField
            size="small"
            placeholder="搜索设备 / IP / 型号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 14 }} />
                  </InputAdornment>
                ),
                sx: { fontSize: 11, height: 28 },
              },
            }}
          />
          <Tooltip title="刷新设备">
            <IconButton size="small" onClick={() => reload()} disabled={isLoading}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Chip
            size="small"
            label={sensorsOnly ? "仅传感器" : "全部设备"}
            onClick={() => setSensorsOnly(!sensorsOnly)}
            color={sensorsOnly ? "primary" : "default"}
            sx={{ fontSize: 10, height: 20 }}
          />
          <Chip
            size="small"
            label={onlineOnly ? "仅在线" : "全部"}
            onClick={() => setOnlineOnly(!onlineOnly)}
            color={onlineOnly ? "primary" : "default"}
            sx={{ fontSize: 10, height: 20 }}
          />
          <Chip
            size="small"
            label={`共 ${Object.values(devices).length}`}
            sx={{ fontSize: 10, height: 20 }}
            variant="outlined"
          />
        </Box>
      </Box>

      {/* 错误提示：网络连不上按“数据源未连接”离线态友好提示（warning），其余按错误（error） */}
      {error && (() => {
        const isNetworkError = /Failed to fetch|NetworkError|Load failed|timeout|aborted|ECONNREFUSED|Could not connect/i.test(error);
        return (
          <Box
            sx={{
              p: 1,
              fontSize: 11,
              borderBottom: 1,
              borderColor: "divider",
              color: isNetworkError ? "warning.main" : "error.main",
            }}
          >
            {isNetworkError ? "数据源未连接，设备显示为离线态" : `加载失败: ${error}`}
          </Box>
        );
      })()}

      {/* 设备分组列表 */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {CATEGORY_ORDER.map((cat) => {
          const list = grouped[cat];
          if (list.length === 0) return null;
          return (
            <Box key={cat}>
              <Box
                onClick={() => toggleCategory(cat)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1,
                  py: 0.5,
                  cursor: "pointer",
                  bgcolor: "action.hover",
                  "&:hover": { bgcolor: "action.selected" },
                }}
              >
                {collapsed[cat] ? (
                  <ExpandMoreIcon sx={{ fontSize: 14 }} />
                ) : (
                  <ExpandLessIcon sx={{ fontSize: 14 }} />
                )}
                <Typography sx={{ fontSize: 11, fontWeight: 600, ml: 0.5, flex: 1 }}>
                  {DEVICE_CATEGORY_LABELS[cat]} ({list.length})
                </Typography>
              </Box>
              <Collapse in={!collapsed[cat]} timeout="auto">
                {list.map((device) => {
                  // ─── 应用产品码映射：数字编码 → 字符串编码 ───
                  const mappedCode = DEFAULT_PRODUCT_CODE_MAPPING[Number(device.productCode)] ?? device.productCode;
                  const product = products[mappedCode] || products[device.productCode];
                  const isPlaced = placedDeviceIds.has(device.deviceId);
                  const variants = product?.variants ?? [];
                  return (
                    <Box
                      key={device.deviceId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, device)}
                      onDragEnd={handleDragEnd}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        px: 1.25,
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: "divider",
                        opacity: device.online ? 1 : 0.55,
                        cursor: "grab",
                        "&:hover": { bgcolor: "action.hover" },
                        "&:active": { cursor: "grabbing", bgcolor: "action.selected" },
                        transition: "background-color 0.15s",
                      }}
                    >
                      {/* 设备图标（惰性渲染：进入视口后才渲染重量级 ControlPanelRenderer） */}
                      <Box
                        sx={{
                          width: 56,
                          height: 42,
                          flexShrink: 0,
                          overflow: "hidden",
                          borderRadius: 1,
                          bgcolor: "background.paper",
                          border: 1,
                          borderColor: "divider",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <LazyVisible width={56} height={38}>
                          <Box
                            sx={{
                              width: 56,
                              height: 38,
                              overflow: "hidden",
                              borderRadius: 0.75,
                              background: "linear-gradient(180deg, #07111f 0%, #0d1b2a 50%, #101827 100%)",
                              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                            }}
                          >
                            {(() => {
                              const regDef = componentRegistry.get(`device:${mappedCode}`);
                              const cfg = (regDef?.defaultConfig ?? {}) as Record<string, any>;
                              // ─── 根据 product.tags 生成预览默认 contentConfig ───
                              // 数值型传感器：显示 sensorValue
                              // 报警传感器：显示 alarm + batteryWarning
                              // 清洗煤壁：显示 cleanTrigger
                              const previewContentConfig = (() => {
                                if (!product?.tags) return undefined;
                                const isNumericSensor = product.tags.some(t => t.id === 'sensorValue');
                                const isAlarmSensor = product.tags.some(t => t.id === 'alarm');
                                const isCleanWall = product.tags.some(t => t.id === 'cleanTrigger');
                                if (isNumericSensor) {
                                  return {
                                    screenTags: ['sensorValue', 'sensorFrequency'],
                                  };
                                }
                                if (isAlarmSensor) {
                                  return {
                                    screenTags: ['alarm', 'batteryWarning'],
                                  };
                                }
                                if (isCleanWall) {
                                  return {
                                    screenTags: ['cleanTrigger'],
                                  };
                                }
                                return undefined;
                              })();
                              return (
                                <ControlPanelRenderer
                                  device={device}
                                  product={product}
                                  width={56}
                                  height={38}
                                  mode="preview"
                                  isTemplate={false}
                                  isPending={false}
                                  forceOnline={true}
                                  hideScreenContent={true}
                                  styleConfig={{
                                    bodyColor: cfg.bodyColor as string | undefined,
                                    screenColor: cfg.screenColor as string | undefined,
                                    borderColor: cfg.borderColor as string | undefined,
                                  }}
                                  contentConfig={previewContentConfig}
                                />
                              );
                            })()}
                          </Box>
                        </LazyVisible>
                      </Box>

                      {/* 设备信息 */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }} noWrap>
                            {device.productName}
                          </Typography>
                          {isPlaced && (
                            <Tooltip title="已放置在当前视图">
                              <CheckCircleIcon sx={{ fontSize: 12, color: "success.main" }} />
                            </Tooltip>
                          )}
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                          {(() => {
                            // 统一状态判断：与滚动表格一致
                            // online=false -> 离线（灰）
                            // online=true + stateName 含 fault -> 故障（橙）
                            // online=true + stateName 含 alarm -> 异常（橙）
                            // online=true + 其他 -> 正常（绿）
                            const sn = String(deviceStates[device.deviceId] ?? "").toLowerCase();
                            const isFault = sn.includes("fault");
                            const isAlarm = sn.includes("alarm");
                            const color = !device.online ? "text.disabled" : (isFault || isAlarm) ? "warning.main" : "success.main";
                            const label = !device.online ? "离线" : isFault ? "故障" : isAlarm ? "异常" : "在线";
                            return (
                              <>
                                <CircleIcon sx={{ fontSize: 7, color }} />
                                <Typography sx={{ fontSize: 9, color: "text.secondary", lineHeight: 1.2 }} noWrap>
                                  {label} · {device.deviceId}
                                </Typography>
                              </>
                            );
                          })()}
                        </Box>
                        {/* Variant 标签 */}
                        {variants.length > 0 && (
                          <Box sx={{ display: "flex", gap: 0.25, mt: 0.25, flexWrap: "wrap" }}>
                            {variants.map((v) => (
                              <Chip
                                key={v.id}
                                size="small"
                                label={v.name}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, device, v.id);
                                }}
                                onDragEnd={handleDragEnd}
                                variant={v.id === product?.defaultVariant ? "filled" : "outlined"}
                                color={v.id === product?.defaultVariant ? "primary" : "default"}
                                sx={{
                                  fontSize: 8,
                                  height: 16,
                                  cursor: "grab",
                                  "&:active": { cursor: "grabbing" },
                                  "& .MuiChip-label": { px: 0.5 },
                                }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Collapse>
            </Box>
          );
        })}
        {isLoading && (
          <Box sx={{ p: 2, textAlign: "center", color: "text.secondary", fontSize: 11 }}>加载中...</Box>
        )}
        {!isLoading && Object.values(grouped).every((l) => l.length === 0) && (
          <Box sx={{ p: 2, textAlign: "center", color: "text.secondary", fontSize: 11 }}>
            {search ? "无匹配设备" : hasAdapters ? "设备接入已配置，点击刷新获取设备" : "请先配置设备接入"}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// DeviceStatsBar — 设备统计 + 健康指示（增强模块，纯展示，不影响其他）
// ═══════════════════════════════════════════════════════════════

interface DeviceStatsBarProps {
  // 当前未传 prop，从 store 取
}

function DeviceStatsBar(_props: DeviceStatsBarProps = {}) {
  const devices = useDeviceStore((s) => s.devices);
  const activeProvider = useDeviceStore((s) => s.activeProvider);

  // === P1-2：数据源健康状态（协议运行 + MQTT 连接），从 discovery 获取 ===
  const [healthInfo, setHealthInfo] = useState<{
    mqttConnected: boolean;
    protocolsRunning: number;
    protocolsTotal: number;
  } | null>(null);
  useEffect(() => {
    if (!activeProvider || typeof (activeProvider as any).getDiscoveryInfo !== "function") return;
    let cancelled = false;
    const fetchHealth = async () => {
      try {
        const info = await (activeProvider as any).getDiscoveryInfo();
        if (cancelled || !info) return;
        const protoRunning = (info.protocols ?? []).filter((p: any) => p.runtimeState === "RUNNING").length;
        setHealthInfo({
          mqttConnected: info.mqtt?.connected ?? false,
          protocolsRunning: protoRunning,
          protocolsTotal: (info.protocols ?? []).length,
        });
      } catch { /* discovery 不可用，静默 */ }
    };
    fetchHealth();
    const id = setInterval(fetchHealth, 30_000); // 30s 刷新
    return () => { cancelled = true; clearInterval(id); };
  }, [activeProvider]);
  // === 增强 P4：报警行（纯展示：未确认数，确认操作收敛到告警中心/通知中心） ===
  const unreadEnterCount = useAlarmHistoryStore((s) => s.unreadEnterCount);
  const recentAlarms = useAlarmHistoryStore((s) => s.records);

  // === 增强 P6-2：声音 / 通知开关（受 store 中 cachedPrefs 控制） ===
  const [soundOn, setSoundOn] = useState<boolean>(() => isAlarmSoundEnabled());
  const [notifyOn, setNotifyOn] = useState<boolean>(() => isAlarmNotifyEnabled());
  const toggleSound = useCallback(() => {
    setSoundOn((v) => {
      const next = !v;
      void setAlarmPreferences({ soundEnabled: next });
      return next;
    });
  }, []);
  const toggleNotify = useCallback(() => {
    setNotifyOn((v) => {
      const next = !v;
      void setAlarmPreferences({ notifyEnabled: next });
      return next;
    });
  }, []);

  // 1) 在线/总数：从本地 devices 算（兜底用，discovery 失败也不会空白）
  const allDevices = Object.values(devices);
  const total = allDevices.length;
  const online = allDevices.filter((d) => d.online).length;
  const offline = total - online;

  return (
    <Box
      sx={{
        px: 1,
        py: 0.75,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        flexShrink: 0,
      }}
    >
      {/* 设备统计行：在线 / 离线 / 总数 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary" }}>设备</Typography>
        <Tooltip title="在线设备数">
          <Chip
            size="small"
            label={`在线 ${online}`}
            color={online > 0 ? "success" : "default"}
            sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.75 } }}
          />
        </Tooltip>
        <Tooltip title="离线设备数">
          <Chip
            size="small"
            label={`离线 ${offline}`}
            color={offline > 0 ? "warning" : "default"}
            sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.75 } }}
          />
        </Tooltip>
        <Tooltip title="设备总数">
          <Chip
            size="small"
            label={`总数 ${total}`}
            variant="outlined"
            sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.75 } }}
          />
        </Tooltip>
      </Box>

      {/* === P1-2：数据源健康状态行（协议运行 + MQTT 连接） === */}
      {healthInfo && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary" }}>链路</Typography>
          <Tooltip title={healthInfo.mqttConnected ? "MQTT 已连接" : "MQTT 未连接"}>
            <Chip
              size="small"
              label={`MQTT ${healthInfo.mqttConnected ? "已连接" : "未连接"}`}
              color={healthInfo.mqttConnected ? "success" : "warning"}
              variant={healthInfo.mqttConnected ? "filled" : "outlined"}
              sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.75 } }}
            />
          </Tooltip>
          <Tooltip title={`协议运行 ${healthInfo.protocolsRunning}/${healthInfo.protocolsTotal}`}>
            <Chip
              size="small"
              label={`协议 ${healthInfo.protocolsRunning}/${healthInfo.protocolsTotal}`}
              color={healthInfo.protocolsRunning === healthInfo.protocolsTotal ? "success" : "warning"}
              variant={healthInfo.protocolsRunning > 0 ? "filled" : "outlined"}
              sx={{ fontSize: 9, height: 16, "& .MuiChip-label": { px: 0.75 } }}
            />
          </Tooltip>
        </Box>
      )}

      {/* === 增强 P4：报警行（纯展示：未确认数/历史数；确认操作收敛到告警中心/通知中心） === */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary" }}>报警</Typography>
        <Tooltip title="未确认报警数（在告警中心处理）">
          <Box
            sx={{
              display: "flex", alignItems: "center", gap: 0.5,
              px: 0.5, py: 0.1, borderRadius: 0.5,
              bgcolor: unreadEnterCount > 0 ? "error.main" : "action.hover",
              color: unreadEnterCount > 0 ? "common.white" : "text.secondary",
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: unreadEnterCount > 0 ? "common.white" : "error.main" }} />
            <Typography sx={{ fontSize: 9 }}>未确认 {unreadEnterCount}</Typography>
          </Box>
        </Tooltip>
        {recentAlarms.length > 0 && (
          <Typography sx={{ fontSize: 9, color: "text.disabled" }}>
            历史 {recentAlarms.length}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {/* === 增强 P6-2：声音/通知快捷开关 === */}
        <Tooltip title={soundOn ? "已开启报警提示音（点击关闭）" : "已关闭报警提示音（点击开启）"}>
          <IconButton size="small" onClick={toggleSound} sx={{ p: 0.25 }}>
            {soundOn ? (
              <VolumeUpIcon sx={{ fontSize: 14, color: "primary.main" }} />
            ) : (
              <VolumeOffIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={notifyOn ? "已开启系统通知（点击关闭）" : "已关闭系统通知（点击开启）"}>
          <IconButton size="small" onClick={toggleNotify} sx={{ p: 0.25 }}>
            {notifyOn ? (
              <NotificationsActiveIcon sx={{ fontSize: 14, color: "primary.main" }} />
            ) : (
              <NotificationsOffIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

    </Box>
  );
}
