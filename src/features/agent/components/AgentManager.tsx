/**
 * 运维角色管理 —— 面向煤矿现场运维人员的 AI 角色配置。
 *
 * 与通用「智能体」的区别（不照搬参考项目）：
 * 1. 提供开箱可用的角色模板，现场人员不必从空白提示词起步；
 * 2. 工具用中文业务名，不暴露 query_xxx 这类函数名；
 * 3. 模型按端点分组选择，同名模型能看清归属；
 * 4. 不做权限模式 / 工作目录 / 触发方式等与我们业务无关的配置项
 *    （工具全部只读无副作用，无需权限弹窗）。
 */
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";

import type { AiAgent } from "../proto/agent";
import { useAgentStore } from "../store/agentStore";

/** 可用工具（id 与 Rust tools.rs tool_defs() 同名），label/hint 为面向运维的中文说明 */
const AVAILABLE_TOOLS: { id: string; label: string; hint: string }[] = [
  { id: "query_devices", label: "设备查询", hint: "在线 / 离线 / 产品类型" },
  { id: "query_sensor_history", label: "传感器历史", hint: "粉尘 / 烟雾 / CO，支持聚合" },
  { id: "query_operation_logs", label: "操作日志", hint: "指令下发与执行结果" },
  { id: "query_device_events", label: "设备事件", hint: "上下线 / 故障 / 报警" },
  { id: "query_system_events", label: "系统事件", hint: "按模块记录，与设备无关" },
  { id: "query_dashboard_stats", label: "全局概览", hint: "在线率 / 故障 Top / 上报量" },
  { id: "query_scenes", label: "场景列表", hint: "可用场景及其绑定设备数" },
];

const ALL_TOOL_IDS = AVAILABLE_TOOLS.map((t) => t.id);

/**
 * 角色模板。
 * 注意：模板的工具白名单只使用当前已实现的工具，避免给出做不到的事。
 */
interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  toolIds: string[];
  systemPrompt: string;
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: "inspection",
    name: "设备巡检助手",
    description: "日常点检：设备在线情况与近期掉线、故障记录",
    toolIds: ["query_devices", "query_device_events", "query_scenes"],
    systemPrompt: `你是煤矿喷雾降尘监控系统的设备巡检助手。

职责：
1. 用「设备查询」掌握当前接入的集控器 / 分控器清单与在线状态，离线设备要单独列出并给出设备 ID。
2. 用「设备事件」核对近期掉线、重连、故障记录，帮助判断是偶发还是持续性问题。

回答要求：
- 面向现场运维人员，先给结论（共几台、在线几台、离线几台、哪些需要关注），再列明细。
- 所有结论必须来自工具返回的数据，不得编造设备状态或数量。`,
  },
  {
    key: "alarm",
    name: "报警分析助手",
    description: "故障归因：报警事件梳理，核对同时间段操作记录",
    toolIds: ["query_device_events", "query_operation_logs", "query_scenes"],
    systemPrompt: `你是煤矿喷雾降尘监控系统的报警分析助手。

职责：
1. 用「设备事件」拉取报警与故障类事件，按时间、设备、级别归纳。
2. 用「操作日志」核对同一时间窗口内是否下发过指令，判断报警与人为操作是否相关。

重要约束：
- 当前报警传感器数据为 2 字节位域，仅「烟雾」位（低字节第 4 位）有确定含义。
- 只能依据工具返回的已知数据作答；不得推测其他位对应的传感器类型，
  也不得声称知道确切的报警触发源。数据不足时直接说明「当前数据无法确定触发源」。

回答要求：先说影响范围（涉及哪些设备、持续多久），再说时间线，最后给处置建议。`,
  },
  {
    key: "audit",
    name: "操作审计助手",
    description: "指令追溯：谁在何时对哪台设备做了什么、结果如何",
    toolIds: ["query_operation_logs", "query_devices", "query_scenes"],
    systemPrompt: `你是煤矿喷雾降尘监控系统的操作审计助手。

职责：
1. 用「操作日志」查询指定时间窗口内的指令下发、MQTT 连接、设备删除等操作记录。
2. 用「设备查询」确认操作对象的设备身份（设备 ID、产品类型、当前在线状态）。

回答要求：
- 按「在什么时间、对哪台设备、执行了什么动作、结果如何、耗时多少」的结构化方式汇报。
- 重点关注失败的操作（result 非成功）与耗时异常的指令，主动提示。
- 不要遗漏失败项；未查询到的内容应说明「未查到」，不能当作不存在。`,
  },
  {
    key: "dust",
    name: "降尘效果评估助手",
    description: "粉尘趋势与喷雾效果：浓度变化、超标情况、在线率影响",
    toolIds: ["query_sensor_history", "query_dashboard_stats", "query_devices", "query_scenes"],
    systemPrompt: `你是煤矿喷雾降尘监控系统的降尘效果评估助手。

职责：
1. 用「传感器历史」查询粉尘（传感器类型编号 5）等数据。做趋势或均值类问题时记得带上 agg 与 step，
   避免拉回大量原始采样点。
2. 用「全局概览」获取在线率、故障分布等宏观指标，用于判断数据是否受设备掉线影响。
3. 用「设备查询」确认相关设备的身份与在线状态。

分析要求：
- 先给结论：观察窗口内的粉尘浓度范围与均值、是否存在明显超标点。
- 做前后对比（喷雾前后、班次之间）时，明确给出对比区间与变化幅度。
- 若数据点稀少，或设备在该时段内离线，必须说明结论的可靠性受限。

约束：不得编造测点数值；数据不足时说明「数据不足以判断降尘效果」。`,
  },
  {
    key: "handover",
    name: "交接班简报助手",
    description: "班次小结：设备状况 / 报警故障 / 操作记录三段式",
    toolIds: [...ALL_TOOL_IDS],
    systemPrompt: `你是煤矿喷雾降尘监控系统的交接班简报助手。

当用户询问「本班情况」「交接班」「今天怎么样」时，按三段式输出：
1. 设备状况：当前在线 / 离线数量，本班期间发生过掉线的设备（设备查询 + 设备事件）。
2. 报警与故障：本班期间的报警与故障事件，按级别归纳（设备事件）。
3. 操作记录：本班期间下发的指令与执行结果，标出失败项（操作日志）。

回答要求：
- 每段先给结论数字，再列关键明细。
- 无数据的段写「本班无记录」，不要省略，也不要编造。
- 时间范围以用户表述为准（本班 / 今天 / 最近 8 小时）；用户未说明时默认最近 8 小时。`,
  },
];

const inputSx = { "& .MuiInputBase-input, & .MuiOutlinedInput-input": { fontSize: 12.5 } } as const;

const groupHeaderSx = {
  opacity: 1,
  fontSize: 10.5,
  fontWeight: 700,
  color: "text.secondary",
  py: 0.5,
  mt: 0.5,
  borderTop: "1px solid",
  borderColor: "divider",
  cursor: "default",
  pointerEvents: "none",
} as const;

function emptyAgent(): AiAgent {
  return {
    id: "", name: "", description: "", modelId: "", systemPrompt: "",
    temperature: 0.7, maxIterations: 10, toolIds: [], createdAt: "", updatedAt: "",
  };
}

function toolLabel(id: string): string {
  return AVAILABLE_TOOLS.find((t) => t.id === id)?.label ?? id;
}

function AgentDialog({
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: AiAgent | null;
}) {
  const store = useAgentStore();
  const [form, setForm] = useState<AiAgent>(emptyAgent());
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : { ...emptyAgent(), modelId: store.activeModelId });
      setNameError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const applyTemplate = (tpl: RoleTemplate) => {
    setForm((f) => ({
      ...f,
      name: f.name.trim() || tpl.name,
      description: f.description.trim() || tpl.description,
      toolIds: [...tpl.toolIds],
      systemPrompt: f.systemPrompt.trim() || tpl.systemPrompt,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    await store.saveAgent({ ...form, name: form.name.trim() });
    onClose();
  };

  const toggleTool = (id: string) => {
    setForm((f) => ({
      ...f,
      toolIds: f.toolIds.includes(id) ? f.toolIds.filter((t) => t !== id) : [...f.toolIds, id],
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15 }}>{initial ? "编辑运维角色" : "新建运维角色"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "12px !important" }}>
        {!initial && (
          <Box>
            <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>
              从模板开始（可选，点击后填充名称 / 描述 / 工具 / 提示词）
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {ROLE_TEMPLATES.map((t) => (
                <Chip
                  key={t.key}
                  size="small"
                  label={t.name}
                  onClick={() => applyTemplate(t)}
                  title={t.description}
                  sx={{ height: 22, fontSize: 11 }}
                />
              ))}
            </Box>
          </Box>
        )}

        <TextField
          autoFocus label="名称" value={form.name}
          onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setNameError(false); }}
          error={nameError} helperText={nameError ? "名称必填" : " "}
          fullWidth size="small" sx={inputSx}
        />
        <TextField
          label="描述" value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          fullWidth size="small" placeholder="一句话说明这个角色负责什么"
          sx={inputSx}
        />
        <TextField
          select label="绑定模型" value={form.modelId}
          onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
          fullWidth size="small" sx={inputSx}
          helperText="按端点分组，同名模型可看清归属；不绑定则跟随对话页当前模型"
        >
          <MenuItem value="" sx={{ fontSize: 12 }}>（跟随对话页默认模型）</MenuItem>
          {store.endpoints.flatMap((ep) => {
            const epModels = store.models.filter((m) => m.endpointId === ep.id);
            if (epModels.length === 0) return [];
            const groupTitle = ep.name
              ? `${ep.name} · ${ep.baseUrl.replace(/^https?:\/\//, "")}`
              : ep.baseUrl.replace(/^https?:\/\//, "");
            return [
              <MenuItem key={`ep-${ep.id}`} disabled sx={groupHeaderSx}>
                {groupTitle}
              </MenuItem>,
              ...epModels.map((m) => (
                <MenuItem
                  key={m.id}
                  value={m.id}
                  sx={{ fontSize: 12 }}
                  title={`${groupTitle}`}
                >
                  {m.modelName}
                </MenuItem>
              )),
            ];
          })}
        </TextField>
        <TextField
          label="系统提示词（职责与回答方式）" value={form.systemPrompt}
          onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
          multiline minRows={5} maxRows={10}
          fullWidth size="small" sx={inputSx}
          placeholder="留空则使用内置默认提示词（煤矿喷雾降尘监控助手）"
        />
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <TextField
            label="温度" type="number" value={form.temperature}
            onChange={(e) => setForm((f) => ({ ...f, temperature: Math.min(2, Math.max(0, Number(e.target.value) || 0)) }))}
            size="small" sx={{ ...inputSx, flex: 1 }}
            slotProps={{ htmlInput: { step: 0.1, min: 0, max: 2 } }}
          />
          <TextField
            label="最大迭代" type="number" value={form.maxIterations}
            onChange={(e) => setForm((f) => ({ ...f, maxIterations: Math.min(30, Math.max(1, Math.round(Number(e.target.value) || 1))) }))}
            size="small" sx={{ ...inputSx, flex: 1 }}
            slotProps={{ htmlInput: { min: 1, max: 30 } }}
            helperText="工具调用轮数上限"
          />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.25 }}>
            可用工具（不勾选 = 全部可用）
          </Typography>
          {AVAILABLE_TOOLS.map((t) => (
            <FormControlLabel
              key={t.id}
              control={
                <Checkbox
                  size="small"
                  checked={form.toolIds.includes(t.id)}
                  onChange={() => toggleTool(t.id)}
                  sx={{ py: 0.25 }}
                />
              }
              label={
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                  <Typography sx={{ fontSize: 12 }}>{t.label}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: "text.disabled" }}>{t.hint}</Typography>
                </Box>
              }
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">取消</Button>
        <Button onClick={() => void handleSave()} variant="contained" size="small">保存</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AgentManager() {
  const store = useAgentStore();
  const { agents, models, endpoints } = store;
  const [dialog, setDialog] = useState<{ open: boolean; data: AiAgent | null }>({ open: false, data: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: "" });

  useEffect(() => {
    void store.loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从对话页「管理角色」跳转过来时，自动打开对应角色的编辑器
  useEffect(() => {
    const pendingId = store.pendingAgentEditorId;
    if (!pendingId) return;
    const target = agents.find((a) => a.id === pendingId);
    if (target) {
      setDialog({ open: true, data: target });
    }
    store.clearPendingAgentEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.pendingAgentEditorId, agents]);

  const modelLabelOf = (agent: AiAgent) => {
    if (!agent.modelId) return "跟随默认模型";
    const m = models.find((x) => x.id === agent.modelId);
    if (!m) return "未知模型";
    const ep = endpoints.find((e) => e.id === m.endpointId);
    return ep?.name ? `${m.modelName} · ${ep.name}` : m.modelName;
  };

  const createFromTemplate = (tpl: RoleTemplate) => {
    setDialog({
      open: true,
      data: {
        ...emptyAgent(),
        modelId: store.activeModelId,
        name: tpl.name,
        description: tpl.description,
        toolIds: [...tpl.toolIds],
        systemPrompt: tpl.systemPrompt,
      },
    });
  };

  return (
    <Box sx={{ p: 1.25, overflow: "auto", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>运维角色</Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small" variant="contained" startIcon={<AddRoundedIcon />}
          onClick={() => setDialog({ open: true, data: null })}
          sx={{ fontSize: 11 }}
        >
          新建角色
        </Button>
      </Box>
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 1.25 }}>
        角色 = 职责提示词 + 绑定模型 + 可用工具。在对话页顶部可切换当前使用的角色。
      </Typography>

      {/* 角色模板：一键创建，避免现场人员从空白提示词起步 */}
      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.5 }}>从模板创建</Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>
        {ROLE_TEMPLATES.map((t) => (
          <Box
            key={t.key}
            onClick={() => createFromTemplate(t)}
            sx={{
              display: "flex", alignItems: "center", gap: 1,
              border: "1px dashed", borderColor: "divider", borderRadius: 1,
              px: 1, py: 0.6, cursor: "pointer",
              "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
            }}
          >
            <SupportAgentRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{t.name}</Typography>
              <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>{t.description}</Typography>
            </Box>
            <Chip
              size="small"
              label={`${t.toolIds.length} 工具`}
              sx={{ height: 16, fontSize: 9 }}
            />
          </Box>
        ))}
      </Box>

      <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.5 }}>已创建的角色</Typography>
      {agents.length === 0 ? (
        <Box
          sx={{
            border: "1px dashed", borderColor: "divider", borderRadius: 1,
            py: 2.5, textAlign: "center",
          }}
        >
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            还没有角色，可从上方模板一键创建，或点右上角「新建角色」
          </Typography>
        </Box>
      ) : (
        agents.map((a) => (
          <Box
            key={a.id}
            sx={{
              display: "flex", alignItems: "center", gap: 1,
              border: "1px solid", borderColor: "divider", borderRadius: 1,
              px: 1, py: 0.75, mb: 0.5,
            }}
          >
            <SupportAgentRoundedIcon sx={{ fontSize: 18, color: "success.main" }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.name}
              </Typography>
              <Typography sx={{ fontSize: 10.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.description || "（无描述）"} · {modelLabelOf(a)}
              </Typography>
            </Box>
            <Tooltip title={a.toolIds.length === 0 ? ALL_TOOL_IDS.map(toolLabel).join("、") : a.toolIds.map(toolLabel).join("、")}>
              <Chip
                size="small"
                label={a.toolIds.length === 0 ? "全部工具" : a.toolIds.map(toolLabel).join(" · ")}
                sx={{ height: 16, fontSize: 9, maxWidth: 130 }}
              />
            </Tooltip>
            <Tooltip title="编辑"><IconButton size="small" onClick={() => setDialog({ open: true, data: a })}><EditRoundedIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
            <Tooltip title="删除">
              <IconButton size="small" onClick={() => setDeleteConfirm({ id: a.id, name: a.name })}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ))
      )}

      <AgentDialog
        open={dialog.open}
        initial={dialog.data}
        onClose={() => setDialog({ open: false, data: null })}
      />

      {/* 删除确认 */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15 }}>删除运维角色</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12.5 }}>
            确定删除「{deleteConfirm?.name}」？该操作不可恢复（历史会话消息不受影响）。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} size="small">取消</Button>
          <Button
            color="error" variant="contained" size="small"
            onClick={async () => {
              if (deleteConfirm) {
                await store.deleteAgent(deleteConfirm.id);
                setSnackbar({ open: true, message: "角色已删除" });
              }
              setDeleteConfirm(null);
            }}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2200}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}
