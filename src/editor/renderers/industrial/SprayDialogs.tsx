/**
 * SprayDialogs — 喷雾控制工具栏的三个对话框组件
 *
 *   - SprayParamsDialog    (0x0614 喷雾参数设置)
 *   - WorkTimeDialog       (0x0617 工作时间设置)
 *   - LoopParamsDialog     (0x061b 循环喷参数设置)
 *
 * 从 SprayControlToolbarRenderer.tsx 中抽出，减少主组件体积。
 */
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

// ─── 喷雾参数传感器类型枚举（协议 spraySensorTypeRules）───
export const SPRAY_SENSOR_TYPES: Array<{ value: number; label: string }> = [
  { value: 0, label: "割煤机位置" },
  { value: 1, label: "移架" },
  { value: 2, label: "落架" },
  { value: 3, label: "放顶煤" },
  { value: 4, label: "烟雾" },
  { value: 5, label: "温度" },
  { value: 6, label: "红外" },
  { value: 7, label: "触控" },
  { value: 9, label: "粉尘" },
  { value: 10, label: "CO" },
  { value: 11, label: "火焰" },
  { value: 15, label: "清洗煤壁" },
];

// ─── 喷雾位置枚举（0x0614 sprayPosition）───
export const SPRAY_POSITIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "前喷" },
  { value: 1, label: "后喷" },
  { value: 2, label: "前后喷" },
];

// ─── 风向枚举 ───
export const WIND_DIRECTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "上风向" },
  { value: 1, label: "下风向" },
];

// ═══════════════════════════════════════════════
// SprayParamsDialog (0x0614)
// ═══════════════════════════════════════════════

export interface SprayParamsForm {
  sensorType: number;
  sprayPosition: number;
  windDirection: number;
  waterCurtainInterval: number;
  waterCurtainCount: number;
  sprayDelayTime: number; // 秒（提交时 ×1000 转毫秒）
}

interface SprayParamsDialogProps {
  open: boolean;
  form: SprayParamsForm;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (updater: (prev: SprayParamsForm) => SprayParamsForm) => void;
}

export function SprayParamsDialog({ open, form, loading, onClose, onSubmit, onFormChange }: SprayParamsDialogProps) {
  const inputStyle: React.CSSProperties = { width: "100%", padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 14 };
  const labelStyle = { fontSize: 13, minWidth: 90, color: "rgba(0,0,0,0.7)", flexShrink: 0 };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>喷雾参数设置（0x0614）</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "12px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={labelStyle}>传感器类型</Typography>
          <select value={form.sensorType} onChange={e => onFormChange(f => ({ ...f, sensorType: parseInt(e.target.value) }))} style={inputStyle}>
            {SPRAY_SENSOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={labelStyle}>喷雾位置</Typography>
          <select value={form.sprayPosition} onChange={e => onFormChange(f => ({ ...f, sprayPosition: parseInt(e.target.value) }))} style={inputStyle}>
            {SPRAY_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={labelStyle}>风向</Typography>
          <select value={form.windDirection} onChange={e => onFormChange(f => ({ ...f, windDirection: parseInt(e.target.value) }))} style={inputStyle}>
            {WIND_DIRECTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={labelStyle}>水幕间隔</Typography>
          <input type="number" min={0} max={255} value={form.waterCurtainInterval}
            onChange={e => onFormChange(f => ({ ...f, waterCurtainInterval: parseInt(e.target.value) || 0 }))} style={inputStyle} />
          <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>秒</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={labelStyle}>水幕次数</Typography>
          <input type="number" min={0} max={255} value={form.waterCurtainCount}
            onChange={e => onFormChange(f => ({ ...f, waterCurtainCount: parseInt(e.target.value) || 0 }))} style={inputStyle} />
          <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>次</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={labelStyle}>喷雾延时</Typography>
          <input type="number" min={0} max={65} value={form.sprayDelayTime}
            onChange={e => onFormChange(f => ({ ...f, sprayDelayTime: parseInt(e.target.value) || 0 }))} style={inputStyle} />
          <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>秒（下发时自动转毫秒）</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <ButtonBase onClick={onClose} sx={{ px: 2, py: 0.75, color: "rgba(0,0,0,0.6)" }}>取消</ButtonBase>
        <ButtonBase onClick={onSubmit} disabled={loading}
          sx={{ px: 2.5, py: 0.75, borderRadius: 1, backgroundColor: "rgba(6,182,212,0.9)", color: "#fff",
            "&:hover": { backgroundColor: "rgba(6,182,212,1)" }, "&:disabled": { opacity: 0.5, cursor: "not-allowed" } }}>
          {loading ? "下发中..." : "确认下发"}
        </ButtonBase>
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════
// WorkTimeDialog (0x0617)
// ═══════════════════════════════════════════════

export interface WorkTimeSlot {
  enabled: number;
  startMinute: number;
  endMinute: number;
}

interface WorkTimeDialogProps {
  open: boolean;
  slots: WorkTimeSlot[];
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onSlotsChange: (updater: (prev: WorkTimeSlot[]) => WorkTimeSlot[]) => void;
  /** 分控器位置编号（有值=分控器级别 0x0621，无值=集控器级别 0x0617） */
  position?: number;
  /** 分控器名称（用于标题显示） */
  controllerName?: string;
}

function minuteToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** HH:mm 字符串转分钟数 */
function hhmmToMinute(s: string): number {
  const parts = s.split(":");
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0]) || 0;
  const m = parseInt(parts[1]) || 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

export function WorkTimeDialog({ open, slots, loading, onClose, onSubmit, onSlotsChange, position, controllerName }: WorkTimeDialogProps) {
  const isSubController = position !== undefined;
  const title = isSubController
    ? `分控器工作时间设置（0x0621）— ${controllerName ?? `位置${position}`} [#${position}]`
    : "工作时间设置（0x0617）";
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "12px !important" }}>
        {slots.map((slot, idx) => (
          <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 13, minWidth: 50, color: "rgba(0,0,0,0.7)" }}>时段{idx + 1}</Typography>
            <input type="checkbox" checked={slot.enabled === 1}
              onChange={e => onSlotsChange(prev => prev.map((s, i) => i === idx ? { ...s, enabled: e.target.checked ? 1 : 0 } : s))}
              style={{ width: 18, height: 18 }} />
            <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.5)" }}>启用</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <input type="time" value={minuteToHHMM(slot.startMinute)}
                onChange={e => onSlotsChange(prev => prev.map((s, i) => i === idx ? { ...s, startMinute: hhmmToMinute(e.target.value) } : s))}
                style={{ width: 90, padding: "4px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13 }} />
            </Box>
            <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.4)" }}>→</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <input type="time" value={minuteToHHMM(slot.endMinute)}
                onChange={e => onSlotsChange(prev => prev.map((s, i) => i === idx ? { ...s, endMinute: hhmmToMinute(e.target.value) } : s))}
                style={{ width: 90, padding: "4px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13 }} />
            </Box>
          </Box>
        ))}
        <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.5)", fontStyle: "italic" }}>
          时间格式：HH:mm（如 08:00 - 17:30）
        </Typography>
      </DialogContent>
      <DialogActions>
        <ButtonBase onClick={onClose} sx={{ px: 2, py: 0.75, color: "rgba(0,0,0,0.6)" }}>取消</ButtonBase>
        <ButtonBase onClick={onSubmit} disabled={loading}
          sx={{ px: 2.5, py: 0.75, borderRadius: 1, backgroundColor: "rgba(167,139,250,0.9)", color: "#fff",
            "&:hover": { backgroundColor: "rgba(167,139,250,1)" }, "&:disabled": { opacity: 0.5, cursor: "not-allowed" } }}>
          {loading ? "下发中..." : "确认下发"}
        </ButtonBase>
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════
// LoopParamsDialog (0x061b)
// ═══════════════════════════════════════════════

export interface LoopParamsForm {
  continuousCurtainCount: number;
  sprayDurationSecs: number;
  stopDurationSecs: number;
}

interface LoopParamsDialogProps {
  open: boolean;
  form: LoopParamsForm;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (updater: (prev: LoopParamsForm) => LoopParamsForm) => void;
}

export function LoopParamsDialog({ open, form, loading, onClose, onSubmit, onFormChange }: LoopParamsDialogProps) {
  const inputStyle: React.CSSProperties = { width: 80, padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", fontSize: 14 };
  const labelStyle = { fontSize: 14, minWidth: 100, color: "rgba(0,0,0,0.7)" };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>循环喷参数设置（0x061b）</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={labelStyle}>水幕次数</Typography>
          <input type="number" min={1} max={255} value={form.continuousCurtainCount}
            onChange={e => onFormChange(f => ({ ...f, continuousCurtainCount: Math.max(1, parseInt(e.target.value) || 1) }))} style={inputStyle} />
          <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>次</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={labelStyle}>喷雾时长</Typography>
          <input type="number" min={1} max={65535} value={form.sprayDurationSecs}
            onChange={e => onFormChange(f => ({ ...f, sprayDurationSecs: Math.max(1, parseInt(e.target.value) || 1) }))} style={inputStyle} />
          <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>秒</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={labelStyle}>停止时长</Typography>
          <input type="number" min={1} max={65535} value={form.stopDurationSecs}
            onChange={e => onFormChange(f => ({ ...f, stopDurationSecs: Math.max(1, parseInt(e.target.value) || 1) }))} style={inputStyle} />
          <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>秒</Typography>
        </Box>
        <Typography sx={{ fontSize: 12, color: "rgba(0,0,0,0.5)", fontStyle: "italic" }}>
          喷雾 {form.sprayDurationSecs}s → 停止 {form.stopDurationSecs}s，循环 {form.continuousCurtainCount} 次
        </Typography>
      </DialogContent>
      <DialogActions>
        <ButtonBase onClick={onClose} sx={{ px: 2, py: 0.75, color: "rgba(0,0,0,0.6)" }}>取消</ButtonBase>
        <ButtonBase onClick={onSubmit} disabled={loading}
          sx={{ px: 2.5, py: 0.75, borderRadius: 1, backgroundColor: "rgba(16,185,129,0.9)", color: "#fff",
            "&:hover": { backgroundColor: "rgba(16,185,129,1)" }, "&:disabled": { opacity: 0.5, cursor: "not-allowed" } }}>
          {loading ? "下发中..." : "确认开始循环喷"}
        </ButtonBase>
      </DialogActions>
    </Dialog>
  );
}
