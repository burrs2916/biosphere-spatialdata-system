/**
 * DeviceTreeRenderer — 设备拓扑树（集控器 → 分控器 → 传感器 卡片树 + 连线）
 *
 * 设计目标（用户需求）：
 *   - 不使用表格 / 统计卡，而是用「设备组件组动态渲染出来的画像」
 *   - 拓扑结构对齐左侧设备导航：最上面是集控器，其下是分控器，再下是传感器
 *   - 父子设备之间用连线表达从属关系（卡片树）
 *   - 充分利用大屏画布：内容按组件像素尺寸缩放填满
 *   - 设备状态颜色与左侧设备 tabs（DevicePalettePanel）完全一致：
 *       离线 → 灰（text.disabled）/ 故障·异常 → 橙（warning.main）/ 在线 → 绿（success.main）
 *
 * 数据来源：
 *   edge-conductor (0x061e 30s推送) → WebSocket → deviceStore.devices + deviceStates
 *     → 本组件从 useDeviceStore 读取，按 parentDeviceId 动态构建层级
 *     → 每个节点渲染 DeviceComponentRenderer（设备真实 SVG 画像）
 *     → 节点间用 SVG 直线 + 端点圆点连接
 *
 * 范围策略（与 industrial-sensor-monitor 一致）：
 *   config.deviceScope:
 *     "bound"（默认）→ 仅显示绑定的集控器及其子树（留空 = 不显示）
 *     "all"          → 覆盖设备表中全部集控器（设备状态监控大屏使用，动态发现不写死 ID）
 */
import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme, alpha } from "@mui/material/styles";
import { useThrottledDevices, useThrottledDeviceStates } from "../../../hooks/useThrottledDevices";
import type { ComponentRendererProps } from "../../../types/editor";
import { DeviceComponentRenderer } from "../deviceVariants/DeviceComponentRenderer";
import { resolveDeviceScope, resolveMainControllerIds } from "./deviceScope";
import {
  discoverSubControllerIds,
  discoverSensorIds,
  isSubControllerDevice,
  isSensorDevice,
  readParentDeviceId,
} from "../../../devices/productCodePredicates";

// ─── 布局尺寸（px，内部坐标；组件框超出时滚动。放大画像、充分利用画布空间） ───
const MC_W = 300;
const MC_H = 400;
const SC_W = 230;
const SC_H = 320;
const SE_W = 150;
const SE_H = 210;
const GAP_X = 110; // 集控器块之间的水平间距
const LEVEL_GAP = 210; // 集控器行 → 分控器行 的竖向间距（给连线留空间）
const SUB_GAP_X = 54; // 同一集控器下各分控器之间的间距
const SENSOR_GAP = 26; // 传感器之间的间距
const SENSOR_COLS = 3; // 每个分控器下传感器每行个数
const SENSOR_LEVEL_GAP = 96; // 分控器 → 首个传感器行 的竖向间距
const PAD = 64; // 外边距
const CAPTION_H = 44; // 底部名称标签高度

// 自适应缩放上下限：内容小于画布则放大填满（封顶），超出画布则整体缩小以全部容纳（下限）
// 确保任意数量集控器/分控器/传感器都能完整展开，不截断、不依赖滚动
const MAX_SCALE = 1.8;
const MIN_SCALE = 0.12;

// ─── 节点 / 连线数据结构 ───
interface TreeNode {
  id: string;
  kind: "main" | "sub" | "sensor";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 自定义显示名（如"未归组"合成根），优先于设备 productName */
  label?: string;
  /** 合成节点（非真实设备，仅用于兜底展示未归组设备） */
  synthetic?: boolean;
}
interface TreeEdge {
  from: string;
  to: string;
}
type StatusKey = "online" | "offline" | "fault" | "alarm";

/**
 * 根据设备表 + 集控器列表，计算树形绝对布局。
 * 纵向自上而下：集控器(顶) → 分控器(中) → 传感器(底，网格)；多个集控器并排成多列。
 *
 * 健壮性增强（P1）：
 *  - 集控器下「直接挂传感器」（无分控器中间层）也会被发现并渲染（directSensors）。
 *  - includeOrphans=true（仅全局视图 scope=all）时，未挂载到任何集控器/分控器的
 *    孤儿设备（parentDeviceId 指向缺失节点）会以"未归组"合成根兜底展示，不再静默丢弃。
 *    bound 严格绑定模式不传 includeOrphans，守住"未绑定不显示"红线。
 */
function computeLayout(
  devicesMap: Record<string, any>,
  mainIds: string[],
  includeOrphans: boolean,
): { nodes: TreeNode[]; edges: TreeEdge[]; totalW: number; totalH: number } {
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  const sensorGridWidth = (cols: number) => cols * SE_W + (cols - 1) * SENSOR_GAP;
  const fullGridW = sensorGridWidth(SENSOR_COLS);

  // 在指定块内铺传感器网格；cols 取实际数量与上限较小值，使少传感器时居中而非左对齐留白（P2）
  const placeSensors = (
    sensors: string[],
    blockX: number,
    blockW: number,
    sensorY0: number,
    parentId: string,
  ): number => {
    if (sensors.length === 0) return sensorY0;
    const cols = Math.min(SENSOR_COLS, sensors.length);
    const areaW = sensorGridWidth(cols);
    const areaX = blockX + (blockW - areaW) / 2;
    let bottom = sensorY0;
    sensors.forEach((sid, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = areaX + col * (SE_W + SENSOR_GAP);
      const sy = sensorY0 + row * (SE_H + SENSOR_GAP);
      nodes.push({ id: sid, kind: "sensor", x: sx, y: sy, w: SE_W, h: SE_H });
      edges.push({ from: parentId, to: sid });
      bottom = Math.max(bottom, sy + SE_H);
    });
    return bottom;
  };

  // 在 rootId 下方铺其子块（分控器子树 + 集控器直连传感器），返回本块宽与底部 Y
  const placeChildren = (
    subs: string[],
    directSensors: string[],
    cursorX: number,
    rootId: string,
    rootBottomY: number,
  ): { blockW: number; bottom: number } => {
    const blocks: { subId: string | null; sensors: string[]; blockW: number }[] = [];
    for (const subId of subs) {
      blocks.push({
        subId,
        sensors: discoverSensorIds(devicesMap, [subId]),
        blockW: Math.max(SC_W, fullGridW),
      });
    }
    if (directSensors.length > 0) {
      blocks.push({ subId: null, sensors: directSensors, blockW: fullGridW });
    }
    if (blocks.length === 0) return { blockW: MC_W, bottom: rootBottomY };

    const totalBlocksW =
      blocks.reduce((a, b) => a + b.blockW, 0) + (blocks.length - 1) * SUB_GAP_X;
    const blockW = Math.max(MC_W, totalBlocksW);
    const subY = rootBottomY + LEVEL_GAP;
    const blocksStartX = cursorX + (blockW - totalBlocksW) / 2;
    let bx = blocksStartX;
    let bottom = subY;

    for (const blk of blocks) {
      if (blk.subId) {
        const subX = bx + (blk.blockW - SC_W) / 2;
        nodes.push({ id: blk.subId, kind: "sub", x: subX, y: subY, w: SC_W, h: SC_H });
        edges.push({ from: rootId, to: blk.subId });
        bottom = Math.max(
          bottom,
          placeSensors(blk.sensors, bx, blk.blockW, subY + SC_H + SENSOR_LEVEL_GAP, blk.subId),
        );
      } else {
        // 集控器直连传感器：网格直接始于块顶部（无分控器节点）
        bottom = Math.max(bottom, placeSensors(blk.sensors, bx, blk.blockW, subY, rootId));
      }
      bx += blk.blockW + SUB_GAP_X;
    }
    return { blockW, bottom };
  };

  let cursorX = PAD;
  let maxBottom = 0;
  const advance = (blockW: number) => {
    cursorX += blockW + GAP_X;
  };

  // ── 真实集控器 ──
  for (const mcId of mainIds) {
    const subs = discoverSubControllerIds(devicesMap, [mcId]);
    const directSensors = discoverSensorIds(devicesMap, [mcId]);
    const { blockW, bottom } = placeChildren(subs, directSensors, cursorX, mcId, PAD + MC_H);
    const mcX = cursorX + (blockW - MC_W) / 2;
    nodes.push({ id: mcId, kind: "main", x: mcX, y: PAD, w: MC_W, h: MC_H });
    maxBottom = Math.max(maxBottom, bottom);
    advance(blockW);
  }

  // ── 未归组设备兜底（仅全局视图 scope=all，守住 bound 红线）──
  if (includeOrphans) {
    const placed = new Set(nodes.map((n) => n.id));
    const orphanSubs = Object.keys(devicesMap).filter(
      (id) => isSubControllerDevice(devicesMap[id]) && !placed.has(id),
    );
    const orphanSensorIds = Object.keys(devicesMap).filter(
      (id) => isSensorDevice(devicesMap[id]) && !placed.has(id),
    );
    const orphanSubSet = new Set(orphanSubs);
    // 直连传感器 = 父不是孤儿分控器的传感器（孤儿分控器自己的传感器由 placeChildren 内部发现，避免重复）
    const pseudoDirectSensors = orphanSensorIds.filter(
      (id) => !orphanSubSet.has(readParentDeviceId(devicesMap[id]) || ""),
    );
    if (orphanSubs.length > 0 || pseudoDirectSensors.length > 0) {
      const pseudoId = "__unGrouped__";
      const { blockW, bottom } = placeChildren(
        orphanSubs,
        pseudoDirectSensors,
        cursorX,
        pseudoId,
        PAD + MC_H,
      );
      const px = cursorX + (blockW - MC_W) / 2;
      nodes.push({
        id: pseudoId,
        kind: "main",
        x: px,
        y: PAD,
        w: MC_W,
        h: MC_H,
        label: "未归组",
        synthetic: true,
      });
      maxBottom = Math.max(maxBottom, bottom);
      advance(blockW);
    }
  }

  const totalW = cursorX > PAD ? cursorX - GAP_X + PAD : PAD;
  const totalH = maxBottom > 0 ? maxBottom + PAD : PAD;
  return { nodes, edges, totalW, totalH };
}

/**
 * 状态判定：与左侧设备 tabs（DevicePalettePanel）完全一致
 *  - 离线                → 灰（text.disabled）
 *  - 在线 + fault/alarm  → 橙（warning.main）
 *  - 在线 + 其他         → 绿（success.main）
 */
function getTabStatus(
  dev: any,
  deviceStates: Record<string, string | undefined> | undefined,
): { text: string; key: StatusKey } {
  const online = !!dev?.online;
  const sn = String(deviceStates?.[dev?.deviceId ?? ""] ?? "").toLowerCase();
  if (!online) return { text: "离线", key: "offline" };
  if (sn.includes("fault")) return { text: "故障", key: "fault" };
  if (sn.includes("alarm")) return { text: "异常", key: "alarm" };
  return { text: "在线", key: "online" };
}

// ─── 空状态 ───
function EmptyState({ scope }: { scope: "bound" | "all" }) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#66788a",
        fontSize: 13,
      }}
    >
      {scope === "all"
        ? "暂无设备（设备未接入或尚未加载）"
        : "请在右侧属性面板绑定集控器"}
    </Box>
  );
}

// ─── 状态图例（固定浮层，不随内容滚动）：与左侧设备 tabs 同一套状态色 ───
function StatusLegend({ accentColor }: { accentColor: string }) {
  const theme = useTheme();
  const items: { text: string; color: string }[] = [
    { text: "在线", color: theme.palette.success.main },
    { text: "离线", color: theme.palette.text.disabled },
    { text: "故障", color: theme.palette.warning.main },
    { text: "异常", color: theme.palette.warning.main },
  ];
  return (
    <Box
      sx={{
        position: "absolute",
        left: 16,
        bottom: 16,
        zIndex: 5,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        px: 1.25,
        py: 1,
        borderRadius: 1,
        bgcolor: "rgba(8,16,28,0.72)",
        border: `1px solid ${accentColor}33`,
        backdropFilter: "blur(2px)",
      }}
    >
      <Typography
        sx={{ fontSize: 10, fontWeight: 700, color: "#cfe0f0", letterSpacing: "0.05em", mb: 0.25 }}
      >
        设备状态
      </Typography>
      {items.map((it) => (
        <Box key={it.text} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              bgcolor: it.color,
              boxShadow: `0 0 5px ${it.color}`,
              flexShrink: 0,
            }}
          />
          <Typography sx={{ fontSize: 11, color: "#dce7f2", lineHeight: 1.2 }}>{it.text}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── 聚合摘要（固定浮层，右上角）：屏幕上展示设备的在线/异常汇总（P2）───
function StatusSummary({
  total,
  online,
  alarm,
  accentColor,
}: {
  total: number;
  online: number;
  alarm: number;
  accentColor: string;
}) {
  const theme = useTheme();
  const items: { label: string; value: number; color: string }[] = [
    { label: "设备总数", value: total, color: "#dce7f2" },
    { label: "在线", value: online, color: theme.palette.success.main },
    { label: "异常/故障", value: alarm, color: theme.palette.warning.main },
  ];
  return (
    <Box
      sx={{
        position: "absolute",
        right: 16,
        top: 16,
        zIndex: 5,
        pointerEvents: "none",
        display: "flex",
        gap: 1.5,
        px: 1.25,
        py: 1,
        borderRadius: 1,
        bgcolor: "rgba(8,16,28,0.72)",
        border: `1px solid ${accentColor}33`,
        backdropFilter: "blur(2px)",
      }}
    >
      {items.map((it) => (
        <Box key={it.label} sx={{ textAlign: "center", minWidth: 46 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: it.color, lineHeight: 1 }}>
            {it.value}
          </Typography>
          <Typography sx={{ fontSize: 10, color: "#9fb3c8", mt: 0.25 }}>{it.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── 主组件 ───
export function DeviceTreeRenderer({
  config,
  mode,
  width,
  height,
}: ComponentRendererProps) {
  const theme = useTheme();
  const accentColor = (config.accentColor as string) || "#4fc3f7";
  const showLabels = (config.showLabels as boolean) ?? true;

  const rawSelectedIds = (config.selectedDeviceIds as string[]) ?? [];
  // 设备范围模式：缺省 bound（严格绑定）；大屏模板显式设 all = 覆盖全矿
  const deviceScope = resolveDeviceScope(config);

  // 从 deviceStore 读取所有设备（节流，降低高频推送下的重渲染开销）
  const devicesMap = useThrottledDevices(500) as Record<string, any>;
  // 状态机状态名（fault/alarm/...）：与设备 tabs 共用同一数据源。
  // P0 优化：改用节流快照（项目现成 hook），避免状态机每次跳变都让整棵树（含全部 N 个画像子组件）重渲染。
  const deviceStates = useThrottledDeviceStates(500);

  // 状态色映射（与左侧设备 tabs 完全一致，解析自当前主题）
  const statusColors: Record<StatusKey, string> = {
    online: theme.palette.success.main,
    offline: theme.palette.text.disabled,
    fault: theme.palette.warning.main,
    alarm: theme.palette.warning.main,
  };

  // ─── 确定目标集控器 ───
  const mainControllerIds = useMemo(
    () => resolveMainControllerIds(devicesMap, rawSelectedIds, deviceScope),
    [rawSelectedIds, devicesMap, deviceScope],
  );

  const { nodes, edges, totalW, totalH } = useMemo(
    () => computeLayout(devicesMap, mainControllerIds, deviceScope === "all"),
    [devicesMap, mainControllerIds, deviceScope],
  );

  // 按组件像素尺寸（=大屏画布 3840×2160）自适应缩放，保证全部节点完整可见：
  //  - 内容小于画布 → 放大填满（最多 1.8×），充分利用画布
  //  - 内容超出画布 → 整体缩小（最低 0.12×）以全部容纳，不截断、不滚动
  const availW = width && width > 0 ? width : 3840;
  const availH = height && height > 0 ? height : 2160;
  const fit = totalW > 0 && totalH > 0 ? Math.min(availW / totalW, availH / totalH) : 1;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fit));

  // 空状态以「实际渲染出的节点数」判定（含未归组兜底根），
  // 避免 scope=all 下仅有孤儿传感器时误判为无设备。
  if (nodes.length === 0) {
    return <EmptyState scope={deviceScope} />;
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // P2 聚合摘要：统计屏幕上展示的真实设备（排除合成"未归组"根），节流刷新
  const summary = useMemo(() => {
    let total = 0;
    let online = 0;
    let alarm = 0;
    for (const n of nodes) {
      if (n.synthetic) continue;
      const st = getTabStatus(devicesMap[n.id], deviceStates);
      total += 1;
      if (st.key === "online") online += 1;
      else if (st.key === "fault" || st.key === "alarm") alarm += 1;
    }
    return { total, online, alarm };
  }, [nodes, devicesMap, deviceStates]);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        bgcolor: "transparent",
      }}
    >
      {/* 滚动内容层：内部内容按计算尺寸绝对定位、整体居中；超出组件框时滚动 */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          overflow: "auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {/* 缩放容器：决定滚动区域大小 = 内容缩放后的尺寸 */}
        <Box
          sx={{
            position: "relative",
            width: totalW * scale,
            height: totalH * scale,
            flexShrink: 0,
          }}
        >
          {/* 内容层：在 totalW×totalH 坐标空间内绝对定位，整体缩放填满画布 */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: totalW,
              height: totalH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {/* ─── 连线层（SVG 覆盖，不拦截事件） ─── */}
            <svg
              width={totalW}
              height={totalH}
              style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
            >
              {edges.map((e, i) => {
                const p = nodeById.get(e.from);
                const c = nodeById.get(e.to);
                if (!p || !c) return null;
                const x1 = p.x + p.w / 2;
                const y1 = p.y + p.h;
                const x2 = c.x + c.w / 2;
                const y2 = c.y;
                return (
                  <g key={i}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={accentColor}
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                    />
                    <circle cx={x1} cy={y1} r={2.5} fill={accentColor} />
                    <circle cx={x2} cy={y2} r={2.5} fill={accentColor} />
                  </g>
                );
              })}
            </svg>

            {/* ─── 节点层（每个节点 = 设备画像 + 名称标签） ─── */}
            {nodes.map((n) => {
              const dev = devicesMap[n.id];
              const st = getTabStatus(dev, deviceStates);
              const statusColor = statusColors[st.key];
              const name = n.label ?? dev?.productName ?? dev?.name ?? n.id;
              const portraitH = n.h - (showLabels ? CAPTION_H : 0);

              // ── 合成"未归组"根：仅展示兜底，不渲染设备画像 ──
              if (n.synthetic) {
                return (
                  <Box
                    key={n.id}
                    title="未归组：未挂载到任何集控器/分控器的设备"
                    sx={{
                      position: "absolute",
                      left: n.x,
                      top: n.y,
                      width: n.w,
                      height: n.h,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 1.5,
                      background: "rgba(255,170,60,0.06)",
                      border: "1.5px dashed rgba(255,170,60,0.55)",
                      color: "#ffcf8a",
                      overflow: "hidden",
                    }}
                  >
                    <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{name}</Typography>
                    <Typography sx={{ fontSize: 11, opacity: 0.8, mt: 0.5 }}>未挂载到集控器</Typography>
                  </Box>
                );
              }

              return (
                <Box
                  key={n.id}
                  title={`${name} · ${st.text} · ${n.id}`}
                  sx={{
                    position: "absolute",
                    left: n.x,
                    top: n.y,
                    width: n.w,
                    height: n.h,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    borderRadius: 1.5,
                    // 设备画像自带产品色（集控器=红 / 分控器=灰 / 传感器=蓝，见组件库 device 分组默认色）
                    // + 离线时 DeviceComponentRenderer 自动转灰（deviceStatus bodyScheme）。
                    // 因此节点框用中性描边，状态只靠「小圆点 + 文字」表达，避免与产品色打架。
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    opacity: st.key === "offline" ? 0.6 : 1,
                    overflow: "hidden",
                  }}
                >
                  {/* 设备画像（动态渲染，从 store 取实时状态） */}
                  <Box
                    sx={{
                      flex: 1,
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      p: 0.5,
                    }}
                  >
                    <DeviceComponentRenderer
                      config={{
                        deviceId: n.id,
                        productCode: dev?.productCode,
                        variant: "control-panel",
                      }}
                      componentId={`tree-${n.id}`}
                      width={Math.max(24, n.w - 8)}
                      height={Math.max(24, portraitH - 4)}
                      mode={mode === "preview" ? "preview" : "edit"}
                    />
                  </Box>

                  {/* 名称 / ID 标签 + 状态点（状态点 + 状态文字用状态色） */}
                  {showLabels && (
                    <Box
                      sx={{
                        height: CAPTION_H,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 0.75,
                        borderTop: "1px solid rgba(255,255,255,0.12)",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: statusColor,
                          boxShadow: `0 0 6px ${alpha(statusColor, 0.8)}`,
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ minWidth: 0, lineHeight: 1.1 }}>
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#e3edf7",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {name}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 10,
                            fontFamily: "monospace",
                            color: statusColor,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {st.text} · {n.id}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* ─── 聚合摘要 + 状态图例（固定浮层，不随内容滚动）─── */}
      <StatusSummary
        total={summary.total}
        online={summary.online}
        alarm={summary.alarm}
        accentColor={accentColor}
      />
      <StatusLegend accentColor={accentColor} />
    </Box>
  );
}

export default DeviceTreeRenderer;
