import { useState, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ComponentRendererProps } from "../../../types/editor";

// ─── 设备数据接口（对齐 edge-conductor /api/devices 返回结构）───

interface DeviceItem {
  device_id: string;
  mac?: string;
  product_code: number | string;
  device_category: string;
  online?: boolean;
  status?: string;
  fault?: boolean;
  fault_reason?: string;
  parent_device_id?: string;
  parent_product_code?: number | string;
  product_name?: string;
  category_name?: string;
  device_type?: string;
  connection_id?: string;
  last_heartbeat?: string;
  // 兼容 fieldMapping 转换后的字段
  id?: string;
  name?: string;
  category?: string;
}

// ─── 产品码→名称 映射（对齐协议 product_code）───

const PRODUCT_NAMES: Record<number, string> = {
  18: "喷雾降尘分站",
  18001: "喷雾分控器",
  18002: "无线信号采集器",
  18003: "有线信号采集器",
  18010: "风速传感器",
  18011: "风压传感器",
  18012: "CH4传感器",
  18013: "CO传感器",
  18014: "温度传感器",
  18015: "粉尘传感器",
  18020: "割煤机位置传感器",
  18021: "移架传感器",
  18022: "落架传感器",
  18023: "放顶煤传感器",
  18024: "烟雾传感器",
  18025: "温度报警传感器",
  18026: "红外传感器",
  18027: "触控传感器",
  18028: "振动传感器",
  18029: "粉尘报警传感器",
  18030: "CO报警传感器",
  18031: "火焰传感器",
  18040: "流量计",
  18041: "压力泵",
};

const CATEGORY_LABELS: Record<string, string> = {
  main_controller: "集控器",
  sub_controller: "分控器",
  sensor: "传感器",
  auxiliary: "辅助设备",
};

const CATEGORY_ICONS: Record<string, string> = {
  main_controller: "◈",
  sub_controller: "◇",
  sensor: "●",
  auxiliary: "◆",
};

// ─── 工具函数 ───

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function getProductName(item: DeviceItem): string {
  if (item.product_name) return item.product_name;
  if (item.name) return item.name;
  const code = Number(item.product_code);
  return PRODUCT_NAMES[code] || `设备${code}`;
}

function getCategory(item: DeviceItem): string {
  if (item.device_category) return item.device_category;
  if (item.category) return item.category;
  const code = Number(item.product_code);
  if (code === 18) return "main_controller";
  if (code === 18001) return "sub_controller";
  if (code >= 18040) return "auxiliary";
  return "sensor";
}

function isOnline(item: DeviceItem): boolean {
  if (typeof item.online === "boolean") return item.online;
  if (item.status === "online" || item.status === "running") return true;
  return false;
}

// ─── 渲染器 ───

/**
 * 设备列表组件 — 工业大屏风格
 *
 * 从数据源动态获取设备列表，按设备类型分组展示。
 * 支持：
 * - 按 device_category 自动分组（集控器/分控器/传感器/辅助）
 * - 传感器按 product_code 细分
 * - 点击集控器过滤其下属设备
 * - 搜索/过滤
 * - 每个设备行：状态灯 + 类型图标 + 名称 + MAC + 在线状态
 */
export function DeviceListRenderer({ config }: ComponentRendererProps) {
  const liveData = config.data as Record<string, unknown> | undefined;
  const dataField = (config.dataField as string) || "devices";
  const dataSourceId = config.dataSourceId as string | undefined;
  const accentColor = (config.accentColor as string) || "#4fc3f7";
  const showSearch = (config.showSearch as boolean) ?? true;
  const groupByCategory = (config.groupByCategory as boolean) ?? true;
  const showMac = (config.showMac as boolean) ?? true;
  const expandAll = (config.expandAll as boolean) ?? true;

  const [searchText, setSearchText] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedParent, setSelectedParent] = useState<string | null>(null);

  // ─── 获取设备数据 ───
  const devices: DeviceItem[] = useMemo(() => {
    if (liveData && dataField) {
      const v = getNestedValue(liveData, dataField);
      if (Array.isArray(v) && v.length > 0) return v as DeviceItem[];
    }
    if (liveData && Array.isArray(liveData.devices)) return liveData.devices as DeviceItem[];
    if (liveData && Array.isArray(liveData.items)) return liveData.items as DeviceItem[];
    if (liveData && Array.isArray(liveData.data)) return liveData.data as DeviceItem[];
    if (Array.isArray(liveData)) return liveData as DeviceItem[];
    return (config.staticDevices as DeviceItem[]) || [];
  }, [liveData, dataField, config.staticDevices]);

  // ─── 分组 ───
  const grouped = useMemo(() => {
    const groups: Record<string, DeviceItem[]> = {};
    for (const d of devices) {
      const cat = getCategory(d);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    }
    return groups;
  }, [devices]);

  const categoryOrder = ["main_controller", "sub_controller", "sensor", "auxiliary"];

  // ─── 过滤 ───
  const filteredDevices = useMemo(() => {
    let result = devices;
    // 按选中的集控器过滤
    if (selectedParent) {
      result = result.filter(d => d.parent_device_id === selectedParent || d.device_id === selectedParent);
    }
    // 按搜索文本过滤
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(d => {
        const name = getProductName(d).toLowerCase();
        const mac = (d.mac || "").toLowerCase();
        const id = (d.device_id || d.id || "").toLowerCase();
        return name.includes(lower) || mac.includes(lower) || id.includes(lower);
      });
    }
    return result;
  }, [devices, selectedParent, searchText]);

  const filteredGrouped = useMemo(() => {
    const groups: Record<string, DeviceItem[]> = {};
    for (const d of filteredDevices) {
      const cat = getCategory(d);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    }
    return groups;
  }, [filteredDevices]);

  // ─── 统计 ───
  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter(d => isOnline(d)).length;
    const fault = devices.filter(d => d.fault || d.status === "fault" || d.status === "error").length;
    const offline = total - online;
    return { total, online, offline, fault };
  }, [devices]);

  const toggleGroup = useCallback((cat: string) => {
    setExpandedGroups(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // 默认展开所有分组
  const isExpanded = useCallback((cat: string) => {
    if (expandAll && expandedGroups[cat] === undefined) return true;
    return expandedGroups[cat] ?? false;
  }, [expandAll, expandedGroups]);

  // ─── 渲染 ───

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(10,20,40,0.95) 0%, rgba(8,15,30,0.98) 100%)",
        border: `1px solid ${accentColor}33`,
        borderRadius: 1,
        fontFamily: "'Inter', 'SF Pro', -apple-system, sans-serif",
      }}
    >
      {/* ─── 头部统计条 ─── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2,
          py: 1,
          borderBottom: `1px solid ${accentColor}22`,
          background: `linear-gradient(90deg, ${accentColor}0d, transparent)`,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: 13, color: accentColor, fontWeight: 700, letterSpacing: 1 }}>
          设备列表
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, ml: "auto" }}>
          <StatBadge label="总计" value={stats.total} color={accentColor} />
          <StatBadge label="在线" value={stats.online} color="#4caf50" />
          <StatBadge label="离线" value={stats.offline} color="#6b7280" />
          {stats.fault > 0 && <StatBadge label="故障" value={stats.fault} color="#ef4444" />}
        </Box>
      </Box>

      {/* ─── 搜索栏 ─── */}
      {showSearch && (
        <Box sx={{ px: 1.5, py: 0.8, flexShrink: 0 }}>
          <input
            type="text"
            placeholder="搜索设备名称/MAC/ID..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{
              width: "100%",
              padding: "4px 10px",
              background: "rgba(79,195,247,0.06)",
              border: `1px solid ${accentColor}33`,
              borderRadius: 4,
              color: "#e0e0e0",
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </Box>
      )}

      {/* ─── 集控器快速过滤 ─── */}
      {grouped.main_controller && grouped.main_controller.length > 0 && (
        <Box
          sx={{
            display: "flex",
            gap: 0.8,
            px: 1.5,
            py: 0.6,
            overflowX: "auto",
            flexShrink: 0,
            borderBottom: `1px solid ${accentColor}11`,
          }}
        >
          <FilterChip
            label="全部"
            active={selectedParent === null}
            onClick={() => setSelectedParent(null)}
            accentColor={accentColor}
          />
          {grouped.main_controller.map(mc => (
            <FilterChip
              key={mc.device_id || mc.id}
              label={getProductName(mc)}
              active={selectedParent === (mc.device_id || mc.id)}
              onClick={() => setSelectedParent(
                selectedParent === (mc.device_id || mc.id) ? null : (mc.device_id || mc.id || null)
              )}
              accentColor={accentColor}
              online={isOnline(mc)}
            />
          ))}
        </Box>
      )}

      {/* ─── 设备列表 ─── */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {filteredDevices.length === 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5 }}>
            <Typography sx={{ fontSize: 13, color: "#8899aa" }}>
              {devices.length === 0 ? "等待设备数据..." : "无匹配设备"}
            </Typography>
          </Box>
        ) : groupByCategory ? (
          categoryOrder
            .filter(cat => filteredGrouped[cat] && filteredGrouped[cat].length > 0)
            .map(cat => (
              <DeviceGroup
                key={cat}
                category={cat}
                devices={filteredGrouped[cat]}
                expanded={isExpanded(cat)}
                onToggle={() => toggleGroup(cat)}
                accentColor={accentColor}
                showMac={showMac}
                onSelectParent={setSelectedParent}
                selectedParent={selectedParent}
              />
            ))
        ) : (
          filteredDevices.map(d => (
            <DeviceRow key={d.device_id || d.id || `dev-${d.product_code || 'unknown'}`} device={d} accentColor={accentColor} showMac={showMac} />
          ))
        )}
      </Box>

      {/* ─── 底部数据源状态 ─── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.5,
          borderTop: `1px solid ${accentColor}22`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dataSourceId ? (devices.length > 0 ? "#4caf50" : "#ff9800") : "#6b7280",
          }}
        />
        <Typography sx={{ fontSize: 10, color: "#667788" }}>
          {dataSourceId
            ? devices.length > 0
              ? `已连接 · ${devices.length} 台设备`
              : "数据源已配置 · 等待数据"
            : "未绑定数据源"}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── 子组件 ───

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography sx={{ fontSize: 10, color: "#8899aa" }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color, fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  accentColor,
  online,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accentColor: string;
  online?: boolean;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.3,
        borderRadius: 0.5,
        cursor: "pointer",
        fontSize: 11,
        color: active ? accentColor : "#8899aa",
        background: active ? `${accentColor}1a` : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? accentColor + "44" : "transparent"}`,
        whiteSpace: "nowrap",
        transition: "all 0.2s",
        "&:hover": { background: `${accentColor}15` },
      }}
    >
      {online !== undefined && (
        <Box
          sx={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: online ? "#4caf50" : "#6b7280",
          }}
        />
      )}
      {label}
    </Box>
  );
}

function DeviceGroup({
  category,
  devices,
  expanded,
  onToggle,
  accentColor,
  showMac,
  onSelectParent,
  selectedParent,
}: {
  category: string;
  devices: DeviceItem[];
  expanded: boolean;
  onToggle: () => void;
  accentColor: string;
  showMac: boolean;
  onSelectParent: (id: string | null) => void;
  selectedParent: string | null;
}) {
  const onlineCount = devices.filter(d => isOnline(d)).length;
  const catLabel = CATEGORY_LABELS[category] || category;
  const catIcon = CATEGORY_ICONS[category] || "●";

  return (
    <Box>
      {/* 分组标题 */}
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.6,
          cursor: "pointer",
          background: `linear-gradient(90deg, ${accentColor}0d, transparent)`,
          borderBottom: `1px solid ${accentColor}11`,
          "&:hover": { background: `${accentColor}15` },
        }}
      >
        <Typography sx={{ fontSize: 10, color: accentColor, transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          ▶
        </Typography>
        <Typography sx={{ fontSize: 11, color: accentColor, fontWeight: 600 }}>
          {catIcon} {catLabel}
        </Typography>
        <Typography sx={{ fontSize: 10, color: "#667788", ml: "auto" }}>
          {onlineCount}/{devices.length} 在线
        </Typography>
      </Box>

      {/* 展开的设备列表 */}
      {expanded && (
        <Box>
          {devices.map(d => (
            <DeviceRow
              key={d.device_id || d.id || Math.random()}
              device={d}
              accentColor={accentColor}
              showMac={showMac}
              isMainController={category === "main_controller"}
              isSelected={selectedParent === (d.device_id || d.id)}
              onSelect={() => {
                const id = d.device_id || d.id || null;
                onSelectParent(selectedParent === id ? null : id);
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function DeviceRow({
  device,
  accentColor,
  showMac,
  isMainController,
  isSelected,
  onSelect,
}: {
  device: DeviceItem;
  accentColor: string;
  showMac: boolean;
  isMainController?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const online = isOnline(device);
  const isFault = device.fault || device.status === "fault" || device.status === "error";
  const name = getProductName(device);
  const mac = device.mac || "";
  const category = getCategory(device);
  const productCode = Number(device.product_code);

  // 传感器细分图标
  const sensorIcon = useMemo(() => {
    if (category !== "sensor") return CATEGORY_ICONS[category] || "●";
    if (productCode >= 18010 && productCode <= 18015) return "◇"; // 数值型
    if (productCode >= 18020 && productCode <= 18031) return "◈"; // 报警型
    return "●";
  }, [category, productCode]);

  const statusColor = isFault ? "#ef4444" : online ? "#4caf50" : "#6b7280";
  const statusText = isFault ? "故障" : online ? "在线" : "离线";

  return (
    <Box
      onClick={isMainController ? onSelect : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.6,
        borderBottom: `1px solid ${accentColor}08`,
        cursor: isMainController ? "pointer" : "default",
        background: isSelected
          ? `${accentColor}1a`
          : isFault
            ? "rgba(239,68,68,0.05)"
            : "transparent",
        "&:hover": { background: isSelected ? `${accentColor}1a` : `${accentColor}08` },
      }}
    >
      {/* 状态灯 */}
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: statusColor,
          boxShadow: online ? `0 0 6px ${statusColor}88` : "none",
          flexShrink: 0,
        }}
      />

      {/* 类型图标 */}
      <Typography sx={{ fontSize: 12, color: accentColor, flexShrink: 0, width: 14, textAlign: "center" }}>
        {sensorIcon}
      </Typography>

      {/* 设备名称 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 12,
            color: isFault ? "#ef4444" : "#e0e0e0",
            fontWeight: isMainController ? 600 : 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </Typography>
        {showMac && mac && (
          <Typography sx={{ fontSize: 9, color: "#556677", fontFamily: "monospace" }}>
            {mac}
          </Typography>
        )}
      </Box>

      {/* 状态标签 */}
      <Typography
        sx={{
          fontSize: 10,
          color: statusColor,
          fontWeight: 500,
          flexShrink: 0,
          px: 0.5,
          borderRadius: 0.3,
          background: `${statusColor}1a`,
        }}
      >
        {statusText}
      </Typography>
    </Box>
  );
}
