/**
 * AgentChat —— AI 助手主聊天界面（对齐 web-craft：流式 Markdown + 工具调用卡片 + 停止）
 *
 * 布局（2026-09-02 重设计，解决「反人类」三处）：
 * - 左栏：常驻会话列表（可见/可切换）+ 顶部「新建对话」文字按钮 + 角色用 Chip 切换（无下拉框）。
 * - 每行会话：悬停出现「清空消息」(DeleteSweep) 与「删除会话」(DeleteOutline) 两个图标，二次确认。
 * - 右栏：聊天头部（☰ 收起列表 / 标题 / 角色管理 / 删除 / 设置）+ 消息流 + 输入区。
 * - 工具调用作为「可展开的证据卡」常驻历史，回答可审计（不再只在流式时一闪而过）。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";

import type { AiMessage, ToolCallEvent } from "../proto/agent";
import * as agentService from "../services/agent.service";
import { useAgentStore } from "../store/agentStore";
import { buildAgentScope } from "../utils/sceneScope";
import { toolDisplayName } from "../utils/toolLabels";

/** 空态快捷提问（降低现场人员上手门槛，一键发起业务咨询） */
const QUICK_PROMPTS: string[] = [
  "当前有哪些设备离线了？",
  "最近 1 小时粉尘浓度怎么样？",
  "今天下发了哪些指令？",
  "最近有哪些报警？",
];

const markdownSx = {
  fontSize: 13,
  lineHeight: 1.6,
  wordBreak: "break-word",
  "& p": { my: 0.5 },
  "& pre": { bgcolor: "rgba(0,0,0,0.3)", borderRadius: 1, p: 1, overflow: "auto", fontSize: 12 },
  "& code": { fontFamily: "monospace", fontSize: 12 },
  "& table": { borderCollapse: "collapse", "& td, & th": { border: "1px solid rgba(120,144,156,0.35)", px: 0.75, py: 0.25 } },
  "& ul, & ol": { my: 0.5, pl: 2.5 },
} as const;

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 流式期间的工具卡片（可折叠，显示参数与结果） */
function ToolCallCard({ call }: { call: ToolCallEvent }) {
  const [expanded, setExpanded] = useState(false);
  const running = call.status === "running";
  const failed = call.status === "error";
  return (
    <Box
      sx={{
        my: 0.5,
        border: "1px solid rgba(120,144,156,0.35)",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "rgba(120,144,156,0.08)",
      }}
    >
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.4, cursor: "pointer" }}
      >
        {running ? (
          <CircularProgress size={11} sx={{ color: "primary.main" }} />
        ) : (
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: failed ? "error.main" : "success.main" }} />
        )}
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary" }} title={call.name}>
          工具 · {toolDisplayName(call.name)}
        </Typography>
        <Chip
          size="small"
          label={running ? "执行中" : failed ? "失败" : "完成"}
          color={running ? "primary" : failed ? "error" : "success"}
          sx={{ height: 15, fontSize: 9, "& .MuiChip-label": { px: 0.5 } }}
        />
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: 14 }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Box>
      {expanded && (
        <Box sx={{ px: 1, pb: 0.75 }}>
          <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            参数: {call.arguments}
          </Typography>
          {call.result && (
            <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", mt: 0.5, maxHeight: 160, overflow: "auto" }}>
              结果: {call.result}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

/** 历史中常驻的工具调用证据卡（可折叠，默认收起，点击展开参数与结果） */
function ToolEvidence({ name, args, result }: { name: string; args?: string | null; result?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box
      sx={{
        my: 0.5,
        border: "1px solid rgba(120,144,156,0.3)",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "rgba(120,144,156,0.06)",
      }}
    >
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.35, cursor: "pointer" }}
      >
        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "success.main" }} />
        <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: "text.secondary" }} title={name}>
          数据查询 · {toolDisplayName(name)}
        </Typography>
        <Chip size="small" label="已查" color="success" sx={{ height: 14, fontSize: 8.5, "& .MuiChip-label": { px: 0.5 } }} />
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: 13 }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 13 }} />}
        </IconButton>
      </Box>
      {expanded && (
        <Box sx={{ px: 1, pb: 0.6 }}>
          {args && (
            <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              参数: {args}
            </Typography>
          )}
          {result && (
            <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", mt: 0.4, maxHeight: 200, overflow: "auto" }}>
              结果: {result}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

export interface AgentChatProps {
  onOpenSettings: () => void;
  /** 跳转到运维角色 tab；若当前已选中角色，会同时打开该角色的编辑器 */
  onManageAgent: () => void;
}

export default function AgentChat({ onOpenSettings, onManageAgent }: AgentChatProps) {
  const store = useAgentStore();
  const {
    conversations, messages, activeConversationId, activeModelId, activeAgentId,
    agents, models, loading, error,
  } = store;

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [runNotice, setRunNotice] = useState<{ text: string; kind: "info" | "warn" } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; kind: "clear" | "delete" } | null>(null);
  const [showRail, setShowRail] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingRef = useRef(false);

  // 系统日志页「AI 辅助整理」注入的待发送提示词：消费后自动发问，再清空。
  // 为 null 时本 effect 不做事，完全不影响原有交互。
  const pendingSeedPrompt = useAgentStore((s) => s.pendingSeedPrompt);
  const consumeSeed = useAgentStore((s) => s.consumeSeed);
  const handleSendRef = useRef<((override?: string) => Promise<void>) | null>(null);
  const lastSeedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingSeedPrompt) {
      // 清空后允许同内容再次触发（如再次点击同一场景）
      lastSeedRef.current = null;
      return;
    }
    // 去重：React 18 StrictMode 会双调用 effect，避免同一条提示词被发两次
    if (lastSeedRef.current === pendingSeedPrompt) return;
    lastSeedRef.current = pendingSeedPrompt;
    const prompt = pendingSeedPrompt;
    consumeSeed();
    // 等一拍，确保 store 状态已落库再发问
    setTimeout(() => void handleSendRef.current?.(prompt), 0);
  }, [pendingSeedPrompt, consumeSeed]);

  // 事件订阅（挂载一次；按 conversationId 过滤）
  useEffect(() => {
    const unlisteners: Promise<import("@tauri-apps/api/event").UnlistenFn>[] = [];
    unlisteners.push(
      agentService.onAgentChunk(({ conversationId, chunk }) => {
        if (conversationId === useAgentStore.getState().activeConversationId && streamingRef.current) {
          setStreamingContent((prev) => prev + chunk);
        }
      }),
    );
    unlisteners.push(
      agentService.onAgentToolCall(({ conversationId, toolCall }) => {
        if (conversationId !== useAgentStore.getState().activeConversationId) return;
        setToolCalls((prev) => {
          const idx = prev.findIndex((t) => t.id === toolCall.id);
          if (idx === -1) return [...prev, toolCall];
          const next = [...prev];
          next[idx] = toolCall;
          return next;
        });
      }),
    );
    // 明确提示：达到迭代上限 / 用户中断（此前仅定义未订阅）
    unlisteners.push(
      agentService.onAgentError(({ conversationId, error }) => {
        if (conversationId !== useAgentStore.getState().activeConversationId) return;
        if (error === "已取消") {
          setRunNotice({ text: "已停止回答", kind: "info" });
        } else {
          setRunNotice(null);
        }
      }),
    );
    unlisteners.push(
      agentService.onAgentDone(({ conversationId }) => {
        if (conversationId !== useAgentStore.getState().activeConversationId) return;
        setRunNotice(null);
      }),
    );
    return () => {
      unlisteners.forEach((p) => void p.then((un) => un()));
    };
  }, []);

  // 自动滚动到底
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent, toolCalls.length]);

  // 初始加载
  useEffect(() => {
    void store.loadConfig();
    void store.loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切会话加载消息
  useEffect(() => {
    if (activeConversationId) void store.loadMessages(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // 由 assistant(tool_calls) 建立 call_id → 函数名 映射，供历史工具消息还原中文名
  const callNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of messages) {
      if (m.role === "assistant" && m.toolCalls) {
        try {
          const calls = JSON.parse(m.toolCalls) as { id: string; function: { name: string } }[];
          for (const c of calls) map[c.id] = c.function.name;
        } catch {
          /* 忽略损坏的 tool_calls */
        }
      }
    }
    return map;
  }, [messages]);

  const activeModel = models.find((m) => m.id === activeModelId);
  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const activeTitle = activeConversationId
    ? (conversations.find((c) => c.id === activeConversationId)?.title ?? "对话")
    : "新对话";

  const handleSend = async (override?: string) => {
    const message = (override ?? input).trim();
    if (!message || isStreaming) return;
    if (!activeAgent && (!activeModelId || !activeModel)) {
      setRunError("请先在「模型配置」中选择模型，或在「智能体」中选择一个已绑定模型的智能体");
      return;
    }
    setInput("");
    setRunError(null);
    setRunNotice(null);
    setIsStreaming(true);
    streamingRef.current = true;
    setStreamingContent("");
    setToolCalls([]);

    let convId = activeConversationId;
    try {
      if (!convId) {
        const conv = await store.createConversation(message.slice(0, 18) || "新对话");
        if (!conv) throw new Error("创建会话失败");
        convId = conv.id;
      } else {
        store.addMessage({
          id: `local-user-${Date.now()}`,
          conversationId: convId,
          role: "user",
          content: message,
          createdAt: new Date().toISOString(),
          seq: messages.length + 1,
        });
      }
      // 场景范围（scope 三级）：前端解析「场景→设备集合」随请求传给后端做只读过滤
      const scope = buildAgentScope();
      await agentService.runAgent(
        convId,
        message,
        activeModelId || undefined,
        activeAgentId || undefined,
        scope,
      );
      // 完成：以后端持久化为准刷新消息
      await store.loadMessages(convId);
      await store.loadConversations();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 「已取消」由 agent-error 事件转为中性提示，这里不再重复红色报错
      if (msg !== "已取消") setRunError(msg);
      if (convId) await store.loadMessages(convId);
    } finally {
      setIsStreaming(false);
      streamingRef.current = false;
      setStreamingContent("");
      setToolCalls([]);
    }
  };
  // 关键：把最新闭包（含当前 state）赋给 ref，否则「AI 辅助整理」注入的 seed 提示词
  // 通过 handleSendRef.current?.(prompt) 调用时 ref 为 null，会被静默吞掉、agent 永不发问。
  handleSendRef.current = handleSend;

  const handleStop = async () => {
    if (!activeConversationId) return;
    await agentService.stopAgent(activeConversationId);
  };

  /** 管理当前角色：先登记待编辑的角色，再切到运维角色 tab */
  const handleManageAgent = () => {
    if (activeAgentId) store.requestAgentEditor(activeAgentId);
    onManageAgent();
  };

  const handleNewConversation = async () => {
    await store.createConversation("新对话");
  };

  const handleDeleteConversation = async (id: string) => {
    await store.deleteConversation(id);
  };

  /** 清空消息（保留会话） / 删除会话 二次确认 */
  const confirmAction = async () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "clear") {
      await store.clearMessages(confirmTarget.id);
    } else {
      await handleDeleteConversation(confirmTarget.id);
    }
    setConfirmTarget(null);
  };

  const renderMessage = (m: AiMessage) => {
    if (m.role === "user") {
      return (
        <Box key={m.id} sx={{ display: "flex", justifyContent: "flex-end", mb: 1.25, gap: 0.5 }}>
          <Box sx={{ maxWidth: "80%" }}>
            <Box sx={{ bgcolor: "primary.main", color: "#fff", borderRadius: 1.5, px: 1.25, py: 0.6 }}>
              <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</Typography>
            </Box>
            <Typography sx={{ fontSize: 9.5, color: "text.disabled", textAlign: "right", mt: 0.25, mr: 0.5 }}>
              {fmtTime(m.createdAt)}
            </Typography>
          </Box>
          <PersonRoundedIcon sx={{ fontSize: 17, color: "primary.main", mt: 0.25, flexShrink: 0 }} />
        </Box>
      );
    }
    if (m.role === "tool") {
      const fnName = (m.toolName && callNameById[m.toolName]) || m.toolName || "";
      return (
        <Box key={m.id} sx={{ pl: 2.25 }}>
          <ToolEvidence name={fnName} args={m.toolArgs} result={m.content} />
        </Box>
      );
    }
    // assistant：仅含工具调用、无正文时不渲染空气泡（由下方证据卡表达）
    if (!m.content?.trim() && m.toolCalls) return null;
    return (
      <Box key={m.id} sx={{ display: "flex", mb: 1.25, gap: 0.5 }}>
        <SmartToyRoundedIcon sx={{ fontSize: 17, color: "success.main", mt: 0.25, flexShrink: 0 }} />
        <Box sx={{ maxWidth: "88%" }}>
          <Box sx={{ bgcolor: "action.hover", borderRadius: 1.5, px: 1.25, py: 0.6, overflow: "auto" }}>
            <Box sx={markdownSx}>
              <Markdown remarkPlugins={[remarkGfm]}>{m.content || "…"}</Markdown>
            </Box>
          </Box>
          <Typography sx={{ fontSize: 9.5, color: "text.disabled", mt: 0.25, ml: 0.5 }}>
            {fmtTime(m.createdAt)}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* 左栏：会话列表 + 角色切换 */}
      {showRail && (
        <Box
          sx={{
            width: 184,
            flexShrink: 0,
            borderRight: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            bgcolor: "action.hover",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1 }}>对话</Typography>
          </Box>

          <Box sx={{ px: 1, pb: 0.75 }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={handleNewConversation}
              sx={{ fontSize: 12, justifyContent: "flex-start", textTransform: "none" }}
            >
              新建对话
            </Button>
          </Box>

          <Box sx={{ px: 1, py: 0.5, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography sx={{ fontSize: 10.5, color: "text.secondary", mb: 0.5 }}>当前运维角色</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              <Chip
                size="small"
                label="默认助手"
                color={activeAgentId === "" ? "primary" : "default"}
                variant={activeAgentId === "" ? "filled" : "outlined"}
                onClick={() => store.setActiveAgentId("")}
                sx={{ fontSize: 11, height: 22 }}
              />
              {agents.map((a) => (
                <Chip
                  key={a.id}
                  size="small"
                  label={a.name}
                  color={activeAgentId === a.id ? "primary" : "default"}
                  variant={activeAgentId === a.id ? "filled" : "outlined"}
                  onClick={() => store.setActiveAgentId(a.id)}
                  sx={{ fontSize: 11, height: 22 }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ flex: 1, overflow: "auto", py: 0.5 }}>
            {conversations.length === 0 ? (
              <Typography sx={{ fontSize: 11, color: "text.secondary", textAlign: "center", py: 2, px: 1 }}>
                还没有会话，点上方 + 新建
              </Typography>
            ) : (
              conversations.map((c) => {
                const active = c.id === activeConversationId;
                return (
                  <Box
                    key={c.id}
                    onClick={() => store.setActiveConversation(c.id)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      pl: 0.75,
                      pr: 0.5,
                      py: 0.6,
                      cursor: "pointer",
                      borderLeft: "3px solid",
                      borderColor: active ? "primary.main" : "transparent",
                      bgcolor: active ? "action.selected" : "transparent",
                      "&:hover": { bgcolor: active ? "action.selected" : "action.hover" },
                    }}
                  >
                    <ChatRoundedIcon sx={{ fontSize: 15, color: active ? "primary.main" : "text.disabled", flexShrink: 0 }} />
                    <Typography
                      sx={{
                        fontSize: 12,
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: active ? "text.primary" : "text.secondary",
                      }}
                      title={c.title}
                    >
                      {c.title}
                    </Typography>
                    <Box sx={{ display: "flex", flexShrink: 0, alignItems: "center" }}>
                      <IconButton
                        size="small"
                        title="清空消息"
                        sx={{ p: 0, opacity: 0.4, "&:hover": { opacity: 1, color: "info.main" } }}
                        onClick={(e) => { e.stopPropagation(); setConfirmTarget({ id: c.id, kind: "clear" }); }}
                      >
                        <DeleteSweepRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{ p: 0, opacity: 0.45, "&:hover": { opacity: 1, color: "error.main" } }}
                        onClick={(e) => { e.stopPropagation(); setConfirmTarget({ id: c.id, kind: "delete" }); }}
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      )}

      {/* 右栏：聊天区 */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, position: "relative" }}>
        {/* 聊天头部 */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, px: 0.75, py: 0.5, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
          <IconButton size="small" onClick={() => setShowRail((v) => !v)} title="会话列表">
            <MenuRoundedIcon fontSize="small" />
          </IconButton>
          <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeTitle}
          </Typography>
          {loading && <CircularProgress size={14} sx={{ color: "primary.main", mr: 0.25 }} />}
          <Tooltip title="管理当前角色">
            <IconButton size="small" onClick={handleManageAgent}><SupportAgentRoundedIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="删除当前会话">
            <span>
              <IconButton
                size="small"
                disabled={!activeConversationId}
                onClick={() => activeConversationId && setConfirmTarget({ id: activeConversationId, kind: "delete" })}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton size="small" onClick={onOpenSettings} title="模型配置">
            <SettingsRoundedIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* 消息流 */}
        <Box sx={{ flex: 1, overflow: "auto", px: 1.25, py: 1 }}>
          {messages.length === 0 && !isStreaming && (
            <Box sx={{ textAlign: "center", py: 3, px: 1 }}>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {activeAgent
                  ? `当前角色：${activeAgent.name}${activeAgent.description ? ` · ${activeAgent.description}` : ""}`
                  : `当前模型：${activeModel ? activeModel.modelName : "未配置（点右上角 ⚙ 配置）"}`}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1.5, mb: 1 }}>
                试试直接问（点击即可发起）：
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, justifyContent: "center" }}>
                {QUICK_PROMPTS.map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    size="small"
                    onClick={() => void handleSend(q)}
                    sx={{ fontSize: 11, cursor: "pointer", "&:hover": { bgcolor: "action.selected" } }}
                  />
                ))}
              </Box>
            </Box>
          )}
          {messages.map(renderMessage)}
          {/* 工具调用卡片（流式期间） */}
          {isStreaming &&
            toolCalls.map((t) => <ToolCallCard key={t.id} call={t} />)}
          {/* 流式输出 */}
          {isStreaming && streamingContent && (
            <Box sx={{ display: "flex", mb: 1.25, gap: 0.5 }}>
              <SmartToyRoundedIcon sx={{ fontSize: 17, color: "success.main", mt: 0.25, flexShrink: 0 }} />
              <Box sx={{ maxWidth: "88%" }}>
                <Box sx={{ bgcolor: "action.hover", borderRadius: 1.5, px: 1.25, py: 0.6 }}>
                  <Box sx={markdownSx}>
                    <Markdown remarkPlugins={[remarkGfm]}>{streamingContent + "▌"}</Markdown>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
          {isStreaming && !streamingContent && toolCalls.length === 0 && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
              <CircularProgress size={18} sx={{ color: "primary.main" }} />
            </Box>
          )}
          {runError && (
            <Typography sx={{ fontSize: 11, color: "error.main", textAlign: "center", py: 0.5 }}>{runError}</Typography>
          )}
          {error && (
            <Typography sx={{ fontSize: 11, color: "error.main", textAlign: "center", py: 0.5 }}>{error}</Typography>
          )}
          {runNotice && (
            <Typography
              sx={{
                fontSize: 11,
                textAlign: "center",
                py: 0.5,
                color: runNotice.kind === "info" ? "text.secondary" : "warning.main",
              }}
            >
              {runNotice.text}
            </Typography>
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* 输入区 */}
        <Box sx={{ display: "flex", gap: 0.5, p: 1, borderTop: "1px solid", borderColor: "divider", alignItems: "flex-end", flexShrink: 0 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder={activeModel ? "输入问题，Enter 发送…" : "请先配置模型（右上角 ⚙）"}
            value={input}
            disabled={isStreaming}
            inputRef={inputRef}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleSend();
              }
            }}
            sx={{ "& .MuiInputBase-input": { fontSize: 13 } }}
          />
          {isStreaming ? (
            <IconButton color="error" onClick={() => void handleStop()} title="停止">
              <StopRoundedIcon />
            </IconButton>
          ) : (
            <IconButton color="primary" onClick={() => void handleSend()} disabled={!input.trim()} title="发送">
              <SendRoundedIcon />
            </IconButton>
          )}
        </Box>

        {!activeModel && !loading && (
          <Box sx={{ px: 1, pb: 0.5 }}>
            <Button fullWidth size="small" variant="outlined" onClick={onOpenSettings}>
              配置模型（供应商 → 端点 → 模型）
            </Button>
          </Box>
        )}

        <Dialog open={!!confirmTarget} onClose={() => setConfirmTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: 15 }}>
            {confirmTarget?.kind === "clear" ? "清空消息" : "删除会话"}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 12.5 }}>
              {confirmTarget?.kind === "clear"
                ? "确定清空当前会话的所有消息？会话本身会保留，此操作不可恢复。"
                : "确定删除当前会话？对话记录将被清空且不可恢复。"}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmTarget(null)} size="small">取消</Button>
            <Button
              color="error"
              variant="contained"
              size="small"
              onClick={() => void confirmAction()}
            >
              {confirmTarget?.kind === "clear" ? "清空" : "删除"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
