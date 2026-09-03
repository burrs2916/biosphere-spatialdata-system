import { useState, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import type { EventBinding, SceneComponent } from "../../types/editor";
import { useEditorStore } from "../../store/editorStore";
import { getEventsForComponent, getActionsForTarget, type ActionInfo } from "../utils/eventActionRegistry";
import { NavigateToSceneParamsEditor } from "./NavigateToSceneParamsEditor";

interface EventBindingEditorProps {
  binding: EventBinding;
  onSave: (binding: EventBinding) => void;
  onCancel: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: "block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        color: "text.secondary",
        mb: 0.75,
        mt: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

/**
 * EventBindingEditor - 事件绑定编辑对话框
 * 提供完整的事件绑定配置表单
 */
export function EventBindingEditor({ binding, onSave, onCancel }: EventBindingEditorProps) {
  const components = useEditorStore((s) => s.components);
  const sourceComponent = components.find((c) => c.id === binding.sourceComponentId);

  const [sourceEvent, setSourceEvent] = useState<string>(binding.sourceEvent);
  const [targetComponentId, setTargetComponentId] = useState<string>(binding.targetComponentId);
  const [targetAction, setTargetAction] = useState<string>(binding.targetAction);
  const [params, setParams] = useState<Record<string, unknown>>(binding.params ?? {});
  const [condition, setCondition] = useState<string>(binding.condition ?? "");
  const [triggerSource, setTriggerSource] = useState<string>(binding.triggerSource ?? 'interaction');
  const [enabled, setEnabled] = useState<boolean>(binding.enabled !== false);
  const [throttle, setThrottle] = useState<string>(binding.throttle ? String(binding.throttle) : '');
  const [debounce, setDebounce] = useState<string>(binding.debounce ? String(binding.debounce) : '');

  const events = useMemo(
    () => getEventsForComponent(sourceComponent?.type, triggerSource),
    [sourceComponent?.type, triggerSource]
  );

  const targetComponent = components.find((c) => c.id === targetComponentId);

  const actions = useMemo(
    () => getActionsForTarget(targetComponent?.type),
    [targetComponent?.type]
  );

  const currentActionDef: ActionInfo | undefined = actions.find((a) => a.name === targetAction);

  const handleSave = () => {
    if (!sourceEvent || !targetComponentId || !targetAction) return;
    onSave({
      ...binding,
      sourceEvent,
      targetComponentId,
      targetAction,
      params: Object.keys(params).length > 0 ? params : undefined,
      condition: condition.trim() || undefined,
      triggerSource: triggerSource as 'interaction' | 'data' | 'threshold' | 'timer' | 'state',
      enabled,
      throttle: throttle ? parseInt(throttle, 10) : undefined,
      debounce: debounce ? parseInt(debounce, 10) : undefined,
    });
  };

  const isValid = sourceEvent && targetComponentId && targetAction;

  return (
    <Dialog
      open
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            maxHeight: "80vh",
          },
        },
      }}
    >
      {/* 标题栏 */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 1.5,
          fontSize: 15,
          fontWeight: 600,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        编辑事件绑定
        <IconButton size="small" onClick={onCancel} sx={{ ml: 1 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      {/* 表单内容 */}
      <DialogContent
        dividers
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          px: 2.5,
          py: 2,
        }}
      >
        {/* 第零部分：触发源类型 */}
        <Box>
          <SectionLabel>触发源</SectionLabel>
          <TextField
            select
            size="small"
            label="触发类型"
            value={triggerSource}
            onChange={(e) => {
              setTriggerSource(e.target.value);
              setSourceEvent(''); // 切换触发源时重置事件
            }}
            fullWidth
          >
            <MenuItem value="interaction">用户交互（点击/悬停）</MenuItem>
            <MenuItem value="data">数据变化</MenuItem>
            <MenuItem value="threshold">阈值越限</MenuItem>
            <MenuItem value="timer">定时触发</MenuItem>
          </TextField>
        </Box>

        {/* 第一部分：触发事件 */}
        <Box>
          <SectionLabel>触发条件</SectionLabel>
          <TextField
            select
            size="small"
            label="触发事件"
            value={sourceEvent}
            onChange={(e) => setSourceEvent(e.target.value)}
            fullWidth
            required
          >
            {events.map((event) => (
              <MenuItem key={event.name} value={event.name}>
                {event.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* 第二部分：目标与动作 */}
        <Box>
          <SectionLabel>目标动作</SectionLabel>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Autocomplete<SceneComponent>
              size="small"
              options={components}
              value={targetComponent ?? null}
              getOptionLabel={(opt) => opt.name || opt.type}
              onChange={(_, newValue) => {
                setTargetComponentId(newValue?.id ?? "");
                setTargetAction(""); // 切换目标时重置动作
                setParams({});
              }}
              renderInput={(inputProps) => (
                <TextField
                  {...inputProps}
                  label="目标组件"
                  required
                  placeholder="搜索组件..."
                />
              )}
              noOptionsText="无匹配组件"
              slotProps={{
                paper: {
                  sx: { zIndex: 1500 },
                },
              }}
            />

            <TextField
              select
              size="small"
              label="执行动作"
              value={targetAction}
              onChange={(e) => {
                setTargetAction(e.target.value);
                setParams({});
              }}
              fullWidth
              required
              disabled={!targetComponentId}
            >
              {actions.map((action) => (
                <MenuItem key={action.name} value={action.name}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {action.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {action.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        {/* 第三部分：动作参数 */}
        {currentActionDef?.paramsSchema && currentActionDef.paramsSchema.length > 0 && (
          <Box>
            <SectionLabel>动作参数</SectionLabel>
            {targetAction === "navigateToScene" ? (
              <NavigateToSceneParamsEditor params={params} onChange={setParams} />
            ) : targetAction === "navigate" ? (
              <TextField
                size="small"
                label="URL 地址"
                value={(params.url as string) ?? ""}
                onChange={(e) => setParams({ ...params, url: e.target.value })}
                placeholder="https://..."
                fullWidth
                required
              />
            ) : targetAction === "setData" ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField
                  size="small"
                  label="属性名"
                  value={(params.property as string) ?? ""}
                  onChange={(e) => setParams({ ...params, property: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  size="small"
                  label="值"
                  value={(params.value as string) ?? ""}
                  onChange={(e) => setParams({ ...params, value: e.target.value })}
                  fullWidth
                  required
                />
              </Box>
            ) : (
              currentActionDef.paramsSchema.map((field, i) => (
                <TextField
                  key={field.key}
                  size="small"
                  label={field.label}
                  value={(params[field.key] as string) ?? ""}
                  onChange={(e) =>
                    setParams({ ...params, [field.key]: e.target.value })
                  }
                  placeholder={field.placeholder}
                  required={field.required}
                  fullWidth
                  sx={i > 0 ? { mt: 1.5 } : undefined}
                />
              ))
            )}
          </Box>
        )}

        {/* 第四部分：条件表达式 */}
        <Box>
          <SectionLabel>条件表达式（可选）</SectionLabel>
          <TextField
            size="small"
            multiline
            minRows={1}
            maxRows={4}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="payload.value > 100"
            fullWidth
            sx={{
              "& .MuiInputBase-input": {
                fontFamily: "monospace",
                fontSize: "0.8rem",
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            可用变量: payload（事件携带的数据）
          </Typography>
        </Box>

        {/* 第五部分：运行时控制 */}
        <Box>
          <SectionLabel>运行时控制</SectionLabel>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <TextField
              select
              size="small"
              label="启用状态"
              value={enabled ? '1' : '0'}
              onChange={(e) => setEnabled(e.target.value === '1')}
              sx={{ flex: '1 1 120px' }}
            >
              <MenuItem value="1">启用</MenuItem>
              <MenuItem value="0">禁用</MenuItem>
            </TextField>
            <TextField
              size="small"
              label="节流(ms)"
              value={throttle}
              onChange={(e) => setThrottle(e.target.value)}
              placeholder="0"
              type="number"
              sx={{ flex: '1 1 100px' }}
            />
            <TextField
              size="small"
              label="防抖(ms)"
              value={debounce}
              onChange={(e) => setDebounce(e.target.value)}
              placeholder="0"
              type="number"
              sx={{ flex: '1 1 100px' }}
            />
          </Box>
        </Box>
      </DialogContent>

      {/* 底部按钮 */}
      <DialogActions
        sx={{
          px: 2.5,
          py: 1.5,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Button onClick={onCancel} size="small" sx={{ textTransform: "none" }}>
          取消
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          disabled={!isValid}
          sx={{ textTransform: "none", minWidth: 72 }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
