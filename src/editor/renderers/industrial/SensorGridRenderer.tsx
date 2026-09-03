import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ComponentRendererProps } from "../../../types/editor";

// ─── 协议层传感器元数据（与字段解析规则.json 对齐） ───

/** 频率传感器：6 种，有连续数值 + 单位 */
const FREQ_SENSORS: Record<number, { key: string; label: string; unit: string; icon: string }> = {
  18010: { key: "wind_speed",    label: "风速", unit: "m/s",   icon: "🌬" },
  18011: { key: "wind_pressure", label: "风压", unit: "Pa",     icon: "🌀" },
  18012: { key: "ch4",           label: "CH₄", unit: "%LEL",   icon: "🔬" },
  18013: { key: "co",            label: "CO",  unit: "ppm",    icon: "🧪" },
  18014: { key: "temperature",   label: "温度", unit: "℃",     icon: "🌡" },
  18015: { key: "dust",          label: "粉尘", unit: "mg/m³", icon: "🌫" },
};

/** 报警传感器：12 种，绑定在分控器上，开关量 */
const ALARM_SENSORS: Record<number, { key: string; label: string; icon: string }> = {
  18020: { key: "coal_cutter",     label: "割煤机", icon: "⛏" },
  18021: { key: "frame_movement",  label: "移架",   icon: "📐" },
  18022: { key: "frame_drop",      label: "落架",   icon: "⬇" },
  18023: { key: "top_coal",        label: "放顶煤", icon: "🔻" },
  18024: { key: "smoke",           label: "烟雾",   icon: "💨" },
  18025: { key: "temp_alarm",      label: "温度",   icon: "🌡" },
  18026: { key: "infrared",        label: "红外",   icon: "📡" },
  18027: { key: "touch",           label: "触控",   icon: "✋" },
  18028: { key: "vibration",       label: "振动",   icon: "〰" },
  18029: { key: "dust_alarm",      label: "粉尘",   icon: "🌫" },
  18030: { key: "co_alarm",        label: "CO",     icon: "🧪" },
  18031: { key: "flame",           label: "火焰",   icon: "🔥" },
};

// ─── 设备数据接口（与 edge-conductor API DeviceWithProduct 对齐） ───

interface DeviceItem {
  device_id: string;
  device_key?: string;
  product_code: number;
  product_name?: string;
  device_category: string;
  online?: boolean;
  status?: string;
  fault?: boolean;
  mac?: string;
  ip?: string;
  parent_device_id?: string;
  connection_id?: string;
  last_heartbeat?: string;
  // 实时值（从 tagValues 推送填充）
  tagValues?: Record<string, unknown>;
  // 兼容 fieldMapping 转换后
  id?: string;
  name?: string;
  category?: string;
}

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

/** 从设备列表中过滤出传感器 */
function filterSensors(devices: DeviceItem[]): DeviceItem[] {
  return devices.filter(d => {
    const cat = d.device_category || d.category || "";
    return cat === "sensor" || cat === "Sensor";
  });
}

/** 获取传感器显示元数据 */
function getSensorDisplay(productCode: number) {
  const freq = FREQ_SENSORS[productCode];
  if (freq) return { ...freq, kind: "numeric" as const };
  const alarm = ALARM_SENSORS[productCode];
  if (alarm) return { ...alarm, kind: "alarm" as const };
  return { key: `unknown_${productCode}`, label: `传感器#${productCode}`, icon: "●", kind: "numeric" as const, unit: "" };
}

/**
 * 传感器列表组件 — API 驱动，拖放即用
 *
 * 使用方式：
 * 1. 拖到画布
 * 2. 配置数据源（指向 edge-conductor /api/devices）
 * 3. 组件自动过滤传感器，按类型分组渲染
 *
 * 数据格式兼容：
 * - { devices: DeviceItem[] } — edge-conductor 标准格式
 * - DeviceItem[] — 纯数组
 * - { data: DeviceItem[] } — data 字段包裹
 *
 * 自动识别：
 * - 频率传感器（风速/风压/CH4/CO/温度/粉尘）→ 显示实时值 + 单位
 * - 报警传感器（烟雾/红外/触控/振动等）→ 显示正常/报警状态
 */
export function SensorGridRenderer({ config }: ComponentRendererProps) {
  const liveData = config.data as Record<string, unknown> | undefined;
  const dataField = (config.dataField as string) || "devices";
  const dataSourceId = config.dataSourceId as string | undefined;
  const accentColor = (config.accentColor as string) || "#4fc3f7";
  const columns = (config.columns as number) ?? 6;
  const title = (config.title as string) || "传感器列表";
  const showEmptySlots = (config.showEmptySlots as boolean) ?? false;
  void dataSourceId;

  // ─── 从 API 数据中提取传感器设备 ───
  const sensors: DeviceItem[] = useMemo(() => {
    let rawDevices: unknown[] = [];

    if (liveData && dataField) {
      const v = getNestedValue(liveData, dataField);
      if (Array.isArray(v) && v.length > 0) rawDevices = v;
    }
    if (rawDevices.length === 0 && liveData && Array.isArray(liveData.devices)) {
      rawDevices = liveData.devices;
    }
    if (rawDevices.length === 0 && liveData && Array.isArray(liveData.data)) {
      rawDevices = liveData.data;
    }
    if (rawDevices.length === 0 && Array.isArray(liveData)) {
      rawDevices = liveData;
    }

    // 过滤出传感器
    return filterSensors(rawDevices as DeviceItem[]);
  }, [liveData, dataField]);

  // ─── 按传感器类型分组 ───
  const grouped = useMemo(() => {
    const freqGroup: DeviceItem[] = [];
    const alarmGroup: DeviceItem[] = [];
    const unknownGroup: DeviceItem[] = [];

    for (const s of sensors) {
      const code = Number(s.product_code);
      if (FREQ_SENSORS[code]) {
        freqGroup.push(s);
      } else if (ALARM_SENSORS[code]) {
        alarmGroup.push(s);
      } else {
        unknownGroup.push(s);
      }
    }

    return { freqGroup, alarmGroup, unknownGroup };
  }, [sensors]);

  // ─── 汇总统计 ───
  const stats = useMemo(() => {
    let total = sensors.length;
    let online = 0;
    let fault = 0;
    for (const s of sensors) {
      const isOnline = s.online || s.status === "online" || s.status === "fault";
      const isFault = s.fault || s.status === "fault" || s.status === "alarm";
      if (isOnline && !isFault) online++;
      if (isFault) fault++;
    }
    const offline = total - online - fault;
    return { total, online, offline, fault };
  }, [sensors]);

  const hasData = sensors.length > 0;

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
        borderRadius: 1.5,
      }}
    >
      {/* ─── 标题栏 ─── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 0.8,
          borderBottom: `1px solid ${accentColor}22`,
          background: `linear-gradient(90deg, ${accentColor}0d, transparent)`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ width: 3, height: 14, background: accentColor, borderRadius: 0.5 }} />
        <Typography sx={{ fontSize: 13, color: accentColor, fontWeight: 700, letterSpacing: 1 }}>
          {title}
        </Typography>

        {hasData && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, ml: "auto" }}>
            <StatBadge label="总数" value={stats.total} color="#8899aa" />
            <StatBadge label="在线" value={stats.online} color="#4caf50" />
            {stats.fault > 0 && <StatBadge label="告警" value={stats.fault} color="#ef4444" />}
            <StatBadge label="离线" value={stats.offline} color="#6b7280" />
          </Box>
        )}
      </Box>

      {/* ─── 内容区 ─── */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", p: 1 }}>
        {!hasData ? (
          <EmptyState accentColor={accentColor} />
        ) : (
          <>
            {/* 频率传感器 */}
            {grouped.freqGroup.length > 0 && (
              <SensorSection
                title="频率传感器"
                subtitle="NUMERIC SENSORS"
                sensors={grouped.freqGroup}
                accentColor={accentColor}
                columns={columns}
              />
            )}

            {/* 报警传感器 */}
            {grouped.alarmGroup.length > 0 && (
              <SensorSection
                title="报警传感器"
                subtitle="ALARM SENSORS"
                sensors={grouped.alarmGroup}
                accentColor={accentColor}
                columns={columns}
              />
            )}

            {/* 未知类型 */}
            {grouped.unknownGroup.length > 0 && (
              <SensorSection
                title="其他传感器"
                subtitle="OTHER SENSORS"
                sensors={grouped.unknownGroup}
                accentColor={accentColor}
                columns={columns}
              />
            )}

            {/* 空槽位占位 */}
            {showEmptySlots && hasData && (
              <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 0.8 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Box
                    key={`slot-${i}`}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      py: 1,
                      px: 0.5,
                      borderRadius: 0.8,
                      border: `1px dashed ${accentColor}22`,
                      opacity: 0.3,
                    }}
                  >
                    <Typography sx={{ fontSize: 10, color: "#556677" }}>+ 添加</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

// ─── 子组件 ───

/** 统计徽章 */
function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
      <Typography sx={{ fontSize: 9, color: "#667788" }}>{label}</Typography>
      <Typography sx={{ fontSize: 10, color, fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

/** 传感器分组区域 */
function SensorSection({
  title,
  subtitle,
  sensors,
  accentColor,
  columns,
}: {
  title: string;
  subtitle: string;
  sensors: DeviceItem[];
  accentColor: string;
  columns: number;
}) {
  return (
    <Box sx={{ mb: 1.2 }}>
      {/* 分组标题 */}
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.8, mb: 0.5, px: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: accentColor, fontWeight: 600, letterSpacing: 0.5 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 8, color: "#445566", letterSpacing: 1 }}>
          {subtitle}
        </Typography>
        <Typography sx={{ fontSize: 9, color: "#556677", ml: "auto" }}>
          {sensors.length}
        </Typography>
      </Box>

      {/* 网格 */}
      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 0.8 }}>
        {sensors.map((s, idx) => (
          <SensorCard key={s.device_id || s.id || idx} sensor={s} accentColor={accentColor} />
        ))}
      </Box>
    </Box>
  );
}

/** 传感器卡片 */
function SensorCard({ sensor, accentColor }: { sensor: DeviceItem; accentColor: string }) {
  const code = Number(sensor.product_code);
  const meta = getSensorDisplay(code);
  const online = sensor.online || sensor.status === "online" || sensor.status === "fault";
  const isFault = sensor.fault || sensor.status === "fault" || sensor.status === "alarm";
  const name = sensor.product_name || sensor.name || meta.label;

  // 状态色
  const statusColor = isFault ? "#ef4444" : online ? "#4caf50" : "#6b7280";

  // 显示值
  const displayValue = useMemo(() => {
    if (meta.kind === "numeric") {
      // 尝试从 tagValues 或 metadata 取实时值
      const tv = sensor.tagValues;
      if (tv) {
        // 常见 tag key: value, currentValue, sensorValue
        const v = tv.value ?? tv.currentValue ?? tv.sensorValue;
        if (v !== undefined && v !== null) {
          return `${v}${meta.unit ? " " + meta.unit : ""}`;
        }
      }
      return online ? "--" + (meta.unit ? " " + meta.unit : "") : "离线";
    }
    // 报警型
    if (isFault) return "报警";
    if (online) return "正常";
    return "离线";
  }, [meta, sensor, online, isFault]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.2,
        py: 0.7,
        px: 0.5,
        borderRadius: 0.8,
        background: isFault
          ? "rgba(239,68,68,0.08)"
          : online
            ? `${accentColor}06`
            : "rgba(255,255,255,0.02)",
        border: `1px solid ${isFault ? "#ef444433" : online ? `${accentColor}18` : "transparent"}`,
        transition: "all 0.3s",
        cursor: "default",
        "&:hover": {
          background: isFault ? "rgba(239,68,68,0.12)" : `${accentColor}10`,
          borderColor: `${accentColor}33`,
        },
      }}
    >
      {/* 状态点 + 图标 */}
      <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography sx={{ fontSize: 15, lineHeight: 1 }}>{meta.icon}</Typography>
        <Box
          sx={{
            position: "absolute",
            top: -2,
            right: -4,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: statusColor,
            boxShadow: online ? `0 0 4px ${statusColor}55` : "none",
          }}
        />
      </Box>

      {/* 名称 */}
      <Typography
        sx={{
          fontSize: 9,
          color: isFault ? "#ef4444" : online ? "#bbccdd" : "#556677",
          fontWeight: 500,
          textAlign: "center",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
          mt: 0.2,
        }}
      >
        {name}
      </Typography>

      {/* 数值/状态 */}
      <Typography
        sx={{
          fontSize: meta.kind === "numeric" ? 11 : 9,
          color: isFault ? "#ef4444" : online ? accentColor : "#556677",
          fontWeight: meta.kind === "numeric" ? 700 : 500,
          fontFamily: meta.kind === "numeric" ? "'DIN Alternate', 'JetBrains Mono', monospace" : "inherit",
          lineHeight: 1.2,
        }}
      >
        {displayValue}
      </Typography>
    </Box>
  );
}

/** 空状态占位 */
function EmptyState({ accentColor }: { accentColor: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 1,
        opacity: 0.6,
      }}
    >
      {/* 虚线网格占位 */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.8, mb: 1 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              width: 36,
              height: 44,
              borderRadius: 0.8,
              border: `1px dashed ${accentColor}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        ))}
      </Box>
      <Typography sx={{ fontSize: 12, color: "#667788" }}>
        配置数据源后自动渲染传感器
      </Typography>
      <Typography sx={{ fontSize: 10, color: "#445566" }}>
        拖入组件 → 配置 API → 即刻显示
      </Typography>
    </Box>
  );
}
