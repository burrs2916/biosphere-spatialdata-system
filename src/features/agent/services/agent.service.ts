/**
 * AI 助手 Tauri 服务层 —— invoke 命令封装 + 事件订阅（契约对齐 web-craft agent.service）
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AiAgent,
  AiConversation,
  AiEndpoint,
  AiMessage,
  AiModel,
  AiProvider,
  AgentScope,
} from "../proto/agent";

// ── 三层模型配置 ──

export const listProviders = () => invoke<AiProvider[]>("ai_list_providers");
export const saveProvider = (provider: AiProvider) =>
  invoke<AiProvider>("ai_save_provider", { provider });
export const deleteProvider = (id: string) => invoke<void>("ai_delete_provider", { id });

export const listEndpoints = () => invoke<AiEndpoint[]>("ai_list_endpoints");
export const saveEndpoint = (endpoint: AiEndpoint) =>
  invoke<AiEndpoint>("ai_save_endpoint", { endpoint });
export const deleteEndpoint = (id: string) => invoke<void>("ai_delete_endpoint", { id });

export const listModels = () => invoke<AiModel[]>("ai_list_models");
export const saveModel = (model: AiModel) => invoke<AiModel>("ai_save_model", { model });
export const deleteModel = (id: string) => invoke<void>("ai_delete_model", { id });

// ── 会话与消息 ──

export const listConversations = () => invoke<AiConversation[]>("ai_list_conversations");
export const createConversation = (title: string) =>
  invoke<AiConversation>("ai_create_conversation", { title });
export const deleteConversation = (id: string) =>
  invoke<void>("ai_delete_conversation", { id });
export const clearMessages = (conversationId: string) =>
  invoke<void>("ai_clear_messages", { id: conversationId });
export const listMessages = (conversationId: string) =>
  invoke<AiMessage[]>("ai_list_messages", { conversationId });

// ── 运行 ──

/** 运行 Agent（流式事件经 agent-chunk/agent-tool-call 推送；resolve 返回最终文本）。
 *  agentId 提供时走智能体的模型/提示词/工具白名单；modelId 作为回退。
 *  scope 提供时把场景→设备范围注入工具（scope 三级：全矿 / 单设备 / 场景）。 */
export const runAgent = (
  conversationId: string,
  message: string,
  modelId?: string,
  agentId?: string,
  scope?: AgentScope | null,
) =>
  invoke<string>("ai_run_agent", {
    conversationId,
    message,
    modelId: modelId || null,
    agentId: agentId || null,
    scope: scope ?? null,
  });
export const stopAgent = (conversationId: string) =>
  invoke<void>("ai_stop_agent", { conversationId });

// ── 智能体 ──

export const listAgents = () => invoke<AiAgent[]>("ai_list_agents");
export const saveAgent = (agent: AiAgent) => invoke<AiAgent>("ai_save_agent", { agent });
export const deleteAgent = (id: string) => invoke<void>("ai_delete_agent", { id });

// ── 事件订阅 ──

export function onAgentChunk(
  handler: (payload: { conversationId: string; chunk: string }) => void,
): Promise<UnlistenFn> {
  return listen("agent-chunk", (e) => handler(e.payload as { conversationId: string; chunk: string }));
}

export function onAgentToolCall(
  handler: (payload: { conversationId: string; toolCall: import("../proto/agent").ToolCallEvent }) => void,
): Promise<UnlistenFn> {
  return listen("agent-tool-call", (e) =>
    handler(e.payload as { conversationId: string; toolCall: import("../proto/agent").ToolCallEvent }),
  );
}

export function onAgentDone(
  handler: (payload: { conversationId: string; response: string }) => void,
): Promise<UnlistenFn> {
  return listen("agent-done", (e) => handler(e.payload as { conversationId: string; response: string }));
}

export function onAgentError(
  handler: (payload: { conversationId: string; error: string }) => void,
): Promise<UnlistenFn> {
  return listen("agent-error", (e) => handler(e.payload as { conversationId: string; error: string }));
}

// ── 测试 ──

export const testEndpointConnection = (endpointId: string) =>
  invoke<string>("ai_test_endpoint_connection", { endpointId });
export const listRemoteModels = (endpointId: string) =>
  invoke<string[]>("ai_list_remote_models", { endpointId });
export const testModelChat = (modelId: string) =>
  invoke<string>("ai_test_model_chat", { modelId });
