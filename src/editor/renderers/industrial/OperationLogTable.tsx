/**
 * OperationLogTable - 操作日志分页表格
 *
 * 列：时间、请求ID、命令码、操作动作、设备ID、结果、耗时、操作人
 * - 结果列用颜色区分（ok=绿色, fail=红色, partial=橙色）
 * - 支持展开行查看详情（payload、result_msg）
 * - 分页控件
 * - 挂载时自动查询一次，分页/参数变化时重新查询
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { useEffect, useState, useCallback } from "react";
import type { ComponentRendererProps } from "../../../types/editor";
import { useLogMonitorStore } from "../../../store/logMonitorStore";
import { useDeviceStore } from "../../../store/deviceStore";
import { useSprayLogStore, ACTION_LABELS, RESULT_META } from "../../../store/sprayLogStore";
import { formatTimestamp, type OperationLog } from "../../../services/historyApi";
import { decodeCommandCode, decodeAction, isResultFailure } from "../../../services/logDecoder";

/** 结果颜色映射 */
function getResultColor(result?: string): "success" | "error" | "warning" | "default" {
  const r = String(result ?? "").toLowerCase();
  if (r === "ok" || r === "success" || r === "0") return "success";
  if (r === "fail" || r === "error" || r === "failed") return "error";
  if (r === "partial") return "warning";
  return "default";
}

function getResultLabel(result?: string): string {
  const r = String(result ?? "").toLowerCase();
  if (r === "ok" || r === "success" || r === "0") return "成功";
  if (r === "fail" || r === "error" || r === "failed") return "失败";
  if (r === "partial") return "部分";
  return result || "-";
}

export default function OperationLogTable({ config }: ComponentRendererProps) {
  const title = (config.title as string) ?? "操作日志";
  const autoQuery = (config.autoQuery as boolean) ?? true;
  const defaultPageSize = (config.pageSize as number) ?? 20;

  const operationLogs = useLogMonitorStore((s) => s.operationLogs);
  const loading = useLogMonitorStore((s) => s.loading);
  const currentPage = useLogMonitorStore((s) => s.currentPage);
  const pageSize = useLogMonitorStore((s) => s.pageSize);
  const error = useLogMonitorStore((s) => s.error);
  const queryOperationLogs = useLogMonitorStore((s) => s.queryOperationLogs);
  const setCurrentPage = useLogMonitorStore((s) => s.setCurrentPage);
  const setPageSize = useLogMonitorStore((s) => s.setPageSize);
  const sceneDeviceIds = useLogMonitorStore((s) => s.sceneDeviceIds);
  const selectedDeviceIds = useLogMonitorStore((s) => s.selectedDeviceIds);

  // 本会话本地指令流（工具栏下发，全局 sprayLogStore；与后端历史操作记录互补）
  const localLogs = useSprayLogStore((s) => s.logs);

  const [expandedRow, setExpandedRow] = useState<string | number | null>(null);

  // 初始化 pageSize
  useEffect(() => {
    if (defaultPageSize !== pageSize) {
      setPageSize(defaultPageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动查询
  useEffect(() => {
    if (autoQuery) {
      void queryOperationLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, sceneDeviceIds, selectedDeviceIds]);

  const toggleRow = useCallback((id: string | number | undefined) => {
    if (id === undefined) return;
    setExpandedRow((prev) => (prev === id ? null : id));
  }, []);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(22,38,62,0.92) 0%, rgba(16,28,48,0.95) 100%)",
        border: "1px solid rgba(120,144,156,0.4)",
        borderRadius: 1.5,
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.6,
          borderBottom: "1px solid rgba(120,144,156,0.3)",
          background: "linear-gradient(90deg, rgba(120,144,156,0.12), transparent)",
          flexShrink: 0,
        }}
      >
        <Box sx={{ width: 3, height: 14, background: "#B0BEC5", borderRadius: 0.5 }} />
        <Typography sx={{ fontSize: 13, color: "#B0BEC5", fontWeight: 700, letterSpacing: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 10, color: "rgba(176,190,197,0.5)", ml: "auto" }}>
          共 {operationLogs.total} 条
        </Typography>
      </Box>

      {/* 本会话本地指令浮条（工具栏下发的实时指令流，全局 sprayLogStore） */}
      {localLogs.length > 0 && (
        <Box sx={{
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,152,0,0.25)",
          background: "rgba(255,152,0,0.05)",
          px: 1.25, py: 0.5,
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
            <Typography sx={{ fontSize: 11, color: "rgba(255,152,0,0.9)", fontWeight: 700, letterSpacing: 0.5 }}>
              本会话本地指令（{localLogs.length}）
            </Typography>
            <Typography sx={{ fontSize: 10, color: "rgba(176,190,197,0.5)" }}>
              工具栏实时下发 · 刷新即清空
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Box
              onClick={() => useSprayLogStore.getState().clearLogs()}
              sx={{ fontSize: 10, color: "rgba(255,255,255,0.45)", cursor: "pointer", "&:hover": { color: "#ef4444" } }}
            >
              清空
            </Box>
          </Box>
          <Box sx={{ maxHeight: 76, overflowY: "auto", "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,152,0,0.3)", borderRadius: 2 } }}>
            {localLogs.slice(0, 8).map((log) => {
              const meta = RESULT_META[log.result] ?? RESULT_META.pending;
              const targetLabel = log.targetSubs.length > 0
                ? `${log.targetSubs.length} 分控`
                : log.targetMains.length > 0
                  ? `${log.targetMains.length} 集控`
                  : "广播";
              return (
                <Box key={log.id} sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.15 }}>
                  <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", flexShrink: 0 }}>
                    {log.time}
                  </Typography>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: meta.color, flexShrink: 0 }} />
                  {log.commandCode !== "-" && (
                    <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", flexShrink: 0 }}>
                      0x{log.commandCode}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600, flexShrink: 0 }}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "rgba(79,195,247,0.85)", flexShrink: 0 }}>
                    → {targetLabel}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {log.message}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {log.durationMs > 0 && (
                    <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
                      {log.durationMs}ms
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* 表格 */}
      <TableContainer sx={{ flex: 1, overflow: "auto" }}>
        {loading && operationLogs.data.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 120 }}>
            <CircularProgress size={24} sx={{ color: "rgba(90,158,214,0.7)" }} />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12, color: "#ef4444" }}>{error}</Typography>
          </Box>
        ) : operationLogs.data.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12, color: "rgba(176,190,197,0.4)" }}>暂无操作日志</Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={headerCellSx} width={32} />
                <TableCell sx={headerCellSx} width={140}>时间</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 120 }}>请求ID</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 170 }}>指令名(命令码)</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 110 }}>操作动作</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 120 }}>设备ID</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 130 }}>设备名称</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 90 }}>命令码</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 160 }}>下发目标</TableCell>
                <TableCell sx={headerCellSx} width={70}>结果</TableCell>
                <TableCell sx={headerCellSx} width={80} align="right">耗时(ms)</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 90 }}>操作人</TableCell>
                <TableCell sx={{ ...headerCellSx, width: 170 }}>结果消息</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {operationLogs.data.map((row, idx) => {
                const rowId = row.id ?? idx;
                const isOpen = expandedRow === rowId;
                return (
                  <LogRow key={rowId} row={row} isOpen={isOpen} onToggle={() => toggleRow(rowId)} />
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* 分页 */}
      <TablePagination
        component="div"
        count={operationLogs.total}
        page={currentPage}
        onPageChange={(_, page) => setCurrentPage(page)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => setPageSize(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="每页"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
        sx={paginationSx}
      />
    </Box>
  );
}

/** 单行 + 展开详情 */
function LogRow({ row, isOpen, onToggle }: {
  row: OperationLog;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const failed = isResultFailure(row.result);
  const cmd = decodeCommandCode(row.command_code);
  const devices = useDeviceStore((s) => s.devices);
  // 下发目标（集控器 + 分控器合并，后端以额外字段返回，类型索引签名兜底）
  const targetMains = (row.target_mains as string[] | undefined) ?? [];
  const targetSubs = (row.target_subs as string[] | undefined) ?? [];
  const targetText = [...targetMains, ...targetSubs].join(", ") || "-";
  // 命令码原始 hex
  const cmdHex = row.command_code
    ? String(row.command_code).toLowerCase().startsWith("0x")
      ? String(row.command_code)
      : "0x" + String(row.command_code)
    : "-";
  // 设备名称：device_id 解析为设备库产品名，回退原始 ID
  const deviceName = row.device_id
    ? (devices[row.device_id]?.productName ?? row.device_id)
    : "-";
  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{
          cursor: "pointer",
          bgcolor: failed ? "rgba(229,68,68,0.14)" : undefined,
          "&:hover": { bgcolor: failed ? "rgba(229,68,68,0.22)" : "rgba(90,158,214,0.06)" },
        }}
      >
        <TableCell sx={bodyCellSx}>
          <IconButton size="small" sx={{ p: 0, color: "rgba(176,190,197,0.6)" }}>
            {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={bodyCellSx}>{formatTimestamp(row.timestamp)}</TableCell>
        <TableCell sx={{ ...bodyCellSx, fontFamily: "monospace", fontSize: 10, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }} title={row.request_id || undefined}>{row.request_id || "-"}</TableCell>
        <TableCell sx={{ ...bodyCellSx, whiteSpace: "normal" }}>
          <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <Typography sx={{ fontSize: 11, color: failed ? "#ff8a80" : "#e0e8f0", fontWeight: 600 }}>
              {cmd.name}
            </Typography>
            {cmd.raw && (
              <Typography sx={{ fontSize: 9, color: "rgba(176,190,197,0.5)", fontFamily: "monospace" }}>
                {cmd.raw}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell sx={bodyCellSx}>{decodeAction(row.action)}</TableCell>
        <TableCell sx={{ ...bodyCellSx, fontFamily: "monospace", fontSize: 10 }}>{row.device_id || "-"}</TableCell>
        <TableCell sx={{ ...bodyCellSx, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }} title={typeof deviceName === "string" ? deviceName : undefined}>{deviceName}</TableCell>
        <TableCell sx={{ ...bodyCellSx, fontFamily: "monospace", fontSize: 10 }}>{cmdHex}</TableCell>
        <TableCell sx={{ ...bodyCellSx, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }} title={targetText !== "-" ? targetText : undefined}>{targetText}</TableCell>
        <TableCell sx={bodyCellSx}>
          <Chip
            label={getResultLabel(row.result)}
            size="small"
            color={getResultColor(row.result)}
            sx={{ height: 18, fontSize: 10, minWidth: 40 }}
          />
        </TableCell>
        <TableCell sx={{ ...bodyCellSx, align: "right", fontFamily: "monospace" }}>
          {row.duration_ms !== undefined ? row.duration_ms : "-"}
        </TableCell>
        <TableCell sx={bodyCellSx}>{row.operator || "-"}</TableCell>
        <TableCell sx={{ ...bodyCellSx, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "normal" }} title={row.result_msg || undefined}>{row.result_msg || "-"}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell sx={{ py: 0, border: "none" }} colSpan={13}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <Box sx={{ p: 1.5, my: 0.5, bgcolor: "rgba(0,0,0,0.25)", borderRadius: 1, border: "1px solid rgba(120,144,156,0.2)" }}>
              <DetailField label="指令名" value={cmd.name} />
              <DetailField label="下发目标-集控器" value={(row.target_mains as string | undefined) || undefined} mono />
              <DetailField label="下发目标-分控器" value={(row.target_subs as string | undefined) || undefined} mono />
              <DetailField label="结果消息" value={row.result_msg} />
              <DetailField label="Payload" value={row.payload != null ? JSON.stringify(row.payload, null, 2) : undefined} mono />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

/** 详情字段 */
function DetailField({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography component="span" sx={{ fontSize: 10, color: "rgba(176,190,197,0.5)", mr: 1 }}>{label}:</Typography>
      <Typography
        component="span"
        sx={{
          fontSize: 11,
          color: "#e0e8f0",
          fontFamily: mono ? "monospace" : "inherit",
          whiteSpace: mono ? "pre-wrap" : "normal",
          wordBreak: "break-all",
        }}
      >
        {value || "-"}
      </Typography>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 样式常量
// ═══════════════════════════════════════════════════════════════════

const headerCellSx = {
  bgcolor: "rgba(40,58,82,0.9)",
  color: "#B0BEC5",
  fontSize: 11,
  fontWeight: 600,
  borderBottom: "1px solid rgba(120,144,156,0.3)",
  py: 0.6,
  px: 1,
  whiteSpace: "nowrap",
} as const;

const bodyCellSx = {
  color: "#e0e8f0",
  fontSize: 11,
  borderBottom: "1px solid rgba(120,144,156,0.12)",
  py: 0.5,
  px: 1,
  whiteSpace: "nowrap",
} as const;

const paginationSx = {
  color: "rgba(176,190,197,0.7)",
  fontSize: 11,
  borderTop: "1px solid rgba(120,144,156,0.3)",
  flexShrink: 0,
  "& .MuiTablePagination-select": { fontSize: 11, color: "rgba(176,190,197,0.7)" },
  "& .MuiTablePagination-selectIcon": { color: "rgba(176,190,197,0.5)" },
  "& .MuiTablePagination-actions button": { color: "rgba(176,190,197,0.7)" },
} as const;
