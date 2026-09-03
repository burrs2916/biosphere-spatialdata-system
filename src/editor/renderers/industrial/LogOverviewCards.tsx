/**
 * LogOverviewCards - 日志监控视图「场景状态概览卡」
 *
 * 让"巷道运行状态"一眼可见，4 张卡：
 *  1. 本场景设备在线/离线数
 *  2. 指令成功率（ok / 总指令，来自操作日志）
 *  3. 近 24h 故障次数（设备事件 fault/alarm）
 *  4. 重要告警条数（设备事件 level=error 或 alarm 类型）
 *
 * 数据来源：
 *  - 设备在线/离线：deviceStore.devices（按场景设备池 sceneDeviceIds 过滤）
 *  - 指令/事件统计：logMonitorStore 的查询结果（与下方表格同源，零额外请求）
 *
 * 设计：只读 store，不触发查询；展示本场景"运行健康度"，是日志监控视图的入口概览。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import type { ComponentRendererProps } from "../../../types/editor";
import { useLogMonitorStore } from "../../../store/logMonitorStore";
import { useDeviceStore } from "../../../store/deviceStore";

interface CardData {
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
  /** 点击跳转目标：切到事件 tab 或操作 tab 并预设筛选 */
  jump?: { logLevel?: string; eventType?: string; commandCode?: string };
}

export default function LogOverviewCards(_props: ComponentRendererProps) {
  const sceneDeviceIds = useLogMonitorStore((s) => s.sceneDeviceIds);
  const selectedDeviceIds = useLogMonitorStore((s) => s.selectedDeviceIds);
  const statsEvents = useLogMonitorStore((s) => s.statsEvents);
  const statsOps = useLogMonitorStore((s) => s.statsOps);
  const report = useLogMonitorStore((s) => s.report);
  const setActiveTab = useLogMonitorStore((s) => s.setActiveTab);
  const setQueryParams = useLogMonitorStore((s) => s.setQueryParams);
  const devices = useDeviceStore((s) => s.devices);
  const deviceIsLoading = useDeviceStore((s) => s.isLoading);
  const lastLoadedAt = useDeviceStore((s) => s.lastLoadedAt);

  // deviceStore 是否已就绪：从未加载（lastLoadedAt 为 null）或正在加载 → 视为未就绪，避免假 0
  const deviceReady = lastLoadedAt != null && Object.keys(devices).length > 0;

  // 自动刷新由 LogFilterPanel 中央 30s 定时器统一负责（queryEventsForStats/queryOpsForStats/bumpRefresh），
  // 本组件只被动读 store，避免重复定时器打架。

  // 概览卡点击跳转：切到对应 tab 并预设筛选（喷雾触发→操作 tab + commandCode）
  const handleCardClick = (jump?: CardData["jump"]) => {
    if (!jump) return;
    if (jump.commandCode) {
      setActiveTab("operation");
      setQueryParams({
        commandCode: jump.commandCode,
        logLevel: "all",
        eventType: "all",
      });
    } else {
      setActiveTab("event");
      setQueryParams({
        logLevel: jump.logLevel ?? "all",
        eventType: jump.eventType ?? "all",
      });
    }
  };

  const cards: CardData[] = useMemo(() => {
    // ── 设备在线/离线（严格消费主视图绑定的设备池）──
    let online = 0;
    let offline = 0;
    let total = 0;
    let onlineUnknown = false;
    let sceneUnbound = false;
    if (deviceReady) {
      // 优先按多选设备画像收窄（与下方表格/图表同口径：选中若干分控器 → 只看这些）；
      // 未选中任何设备时回退到本场景绑定的整棵设备子树，避免"全量"错觉。
      const ids = selectedDeviceIds.length > 0 ? selectedDeviceIds : sceneDeviceIds;
      if (ids.length === 0) {
        sceneUnbound = true;
      } else {
        total = ids.length;
        for (const id of ids) {
          const d = devices[id];
          if (d?.online) online += 1;
          else offline += 1;
        }
      }
    } else {
      onlineUnknown = true;
    }

    // ── 指令成功率（来自概览专用统计样本，不依赖表格分页）──
    const ops = statsOps.data;
    const opTotal = ops.length;
    const opOk = ops.filter(
      (o) => {
        const r = String(o.result ?? "").toLowerCase();
        return r === "ok" || r === "success" || r === "0";
      },
    ).length;
    const successRate = opTotal > 0 ? Math.round((opOk / opTotal) * 100) : 0;

    // ── 近 24h 故障 / 重要告警（足量统计样本，不再只看表格 20 条）──
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const events = statsEvents.data;
    let fault24 = 0;
    let alarm = 0;
    for (const e of events) {
      const ts = new Date(e.timestamp).getTime();
      const isRecent = !Number.isNaN(ts) && ts >= since;
      const et = String(e.event_type ?? "").toLowerCase();
      const lvl = String(e.level ?? "").toLowerCase();
      if (isRecent && (et === "fault" || et === "alarm" || lvl === "error")) {
        fault24 += 1;
      }
      if (et === "alarm" || et === "fault" || lvl === "error") {
        alarm += 1;
      }
    }

    // ── 喷雾触发次数（协议真源：0x0619 喷洒控制 / 0x061b 循环喷洒 / 0x0628 喷洒控制2；
    //     DB 中 command_code 存小写无 0x 前缀，如 061d）──
    const SPRAY_CMD_CODES = new Set(["0619", "061b", "0628"]);
    const sprayOps = statsOps.data;
    let sprayCount = 0;
    for (const o of sprayOps) {
      const cc = String(o.command_code ?? "").toLowerCase();
      if (SPRAY_CMD_CODES.has(cc)) sprayCount += 1;
    }

    return [
      {
        label: "设备在线",
        value: sceneUnbound ? "未绑定" : onlineUnknown ? "加载中" : `${online}/${total}`,
        sub: sceneUnbound
          ? "主视图未绑定数据源"
          : onlineUnknown
            ? deviceIsLoading
              ? "设备库加载中…"
              : "设备库未加载"
            : selectedDeviceIds.length > 0
              ? offline > 0
                ? `已选 ${total} 台 · ${offline} 离线`
                : `已选 ${total} 台 · 全部在线`
              : offline > 0
                ? `${offline} 台离线`
                : "全部在线",
        color: sceneUnbound ? "#90a4ae" : onlineUnknown ? "#90a4ae" : offline > 0 ? "#ffb74d" : "#4caf50",
        bg: sceneUnbound
          ? "rgba(144,164,174,0.10)"
          : onlineUnknown
            ? "rgba(144,164,174,0.10)"
            : offline > 0
              ? "rgba(255,183,77,0.10)"
              : "rgba(76,175,80,0.10)",
      },
      {
        label: "指令成功率",
        value: `${successRate}%`,
        sub: opTotal > 0 ? `近 ${opTotal} 条指令` : "暂无指令",
        color: successRate >= 90 ? "#4caf50" : successRate >= 70 ? "#ffb74d" : "#ef5350",
        bg: successRate >= 90 ? "rgba(76,175,80,0.10)" : "rgba(255,183,77,0.10)",
      },
      {
        label: "喷雾触发",
        value: `${sprayCount}`,
        sub: sprayCount > 0 ? "点击查看喷雾指令" : "暂无喷雾触发",
        color: sprayCount > 0 ? "#5A9ED6" : "#90a4ae",
        bg: sprayCount > 0 ? "rgba(90,158,214,0.12)" : "rgba(144,164,174,0.10)",
        jump: { commandCode: "0619,061b,0628" },
      },
      {
        label: "近24h故障",
        value: `${fault24}`,
        sub: fault24 > 0 ? "点击查看故障" : "正常",
        color: fault24 > 0 ? "#ef5350" : "#4caf50",
        bg: fault24 > 0 ? "rgba(239,83,80,0.12)" : "rgba(76,175,80,0.10)",
        jump: { eventType: "fault" },
      },
      {
        label: "重要告警",
        value: `${alarm}`,
        sub: alarm > 0 ? "点击查看告警" : "无告警",
        color: alarm > 0 ? "#ffa726" : "#4caf50",
        bg: alarm > 0 ? "rgba(255,167,38,0.12)" : "rgba(76,175,80,0.10)",
        jump: { logLevel: "error" },
      },
      {
        label: "健康评分",
        value: report ? `${report.health_score}` : "—",
        sub: report ? report.health_level : "报告中",
        color: report
          ? report.health_score >= 90
            ? "#4caf50"
            : report.health_score >= 70
              ? "#ffb74d"
              : "#ef5350"
          : "#90a4ae",
        bg: report
          ? report.health_score >= 90
            ? "rgba(76,175,80,0.10)"
            : report.health_score >= 70
              ? "rgba(255,183,77,0.10)"
              : "rgba(239,83,80,0.12)"
          : "rgba(144,164,174,0.10)",
      },
      {
        label: "粉尘超标",
        value: report ? `${report.summary.dust_exceed_minutes}min` : "—",
        sub: report
          ? report.summary.dust_peak >= 10
            ? `峰值 ${report.summary.dust_peak} mg/m³`
            : "未超标"
          : "报告中",
        color: report
          ? report.summary.dust_exceed_minutes > 0
            ? "#ffa726"
            : "#4caf50"
          : "#90a4ae",
        bg: report
          ? report.summary.dust_exceed_minutes > 0
            ? "rgba(255,167,38,0.12)"
            : "rgba(76,175,80,0.10)"
          : "rgba(144,164,174,0.10)",
      },
    ];
  }, [selectedDeviceIds, sceneDeviceIds, statsEvents.data, statsOps.data, report, devices, deviceReady, deviceIsLoading]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 1,
        p: 1,
      }}
    >
      {cards.map((c) => {
        const clickable = Boolean(c.jump);
        return (
          <Box
            key={c.label}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => handleCardClick(c.jump) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(c.jump);
                    }
                  }
                : undefined
            }
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              border: "1px solid rgba(120,144,156,0.3)",
              background: c.bg,
              ...(clickable
                ? {
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
                    "&:hover": {
                      borderColor: "rgba(90,158,214,0.8)",
                      boxShadow: "0 0 0 1px rgba(90,158,214,0.4) inset",
                      background: "rgba(90,158,214,0.08)",
                    },
                    "&:focus-visible": {
                      outline: "2px solid rgba(90,158,214,0.9)",
                      outlineOffset: 1,
                    },
                  }
                : {}),
            }}
          >
            <Typography sx={{ fontSize: 11, color: "rgba(176,190,197,0.7)", letterSpacing: 1 }}>
              {c.label}
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: c.color, lineHeight: 1.1, my: 0.3 }}>
              {c.value}
            </Typography>
            <Typography sx={{ fontSize: 10, color: "rgba(176,190,197,0.6)" }}>
              {c.sub}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
