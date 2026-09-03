/**
 * AI 助手 DTO —— 与 Rust 侧 plugins/ai_agent/types.rs serde(camelCase) 一一对应
 */

export interface AiProvider {
  id: string;
  name: string;
  apiKey: string;
  enabled: boolean;
  createdAt: string;
}

export interface AiEndpoint {
  id: string;
  providerId: string;
  /** 端点显示名（如 "OpenAI 官方"）；空则 UI 回退显示 URL */
  name: string;
  baseUrl: string;
  enabled: boolean;
  /** 跳过 TLS 证书校验（内网自签 https 网关，如煤矿现场本地服务） */
  insecure?: boolean;
  createdAt: string;
}

/** 智能体（对齐 web-craft ai_agents：人设 + 绑定模型 + 工具白名单） */
export interface AiAgent {
  id: string;
  name: string;
  description: string;
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxIterations: number;
  /** 允许的工具名列表；空 = 全部可用 */
  toolIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AiModel {
  id: string;
  endpointId: string;
  modelName: string;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string | null;
  toolArgs?: string | null;
  /** assistant 消息携带的工具调用 JSON（P0-1 落库，用于多轮回放还原） */
  toolCalls?: string | null;
  createdAt: string;
  seq: number;
}

export interface ToolCallEvent {
  id: string;
  name: string;
  arguments: string;
  status: "running" | "done" | "error";
  result?: string;
}

export interface AgentStatusEvent {
  conversationId: string;
  status: string;
  iteration: number;
  maxIterations: number;
  detail?: string;
}

/** 场景范围（scope 三级：全矿 / 单设备 / 场景）。
 *  前端在发起对话时构造：把「场景 → 设备 ID 集合（已展开子树）」解析好传给后端。 */
export interface SceneScopeInfo {
  id: string;
  name: string;
  /** 场景模式 tunnel/bridge/mining/scene5，可能为空 */
  sceneMode: string;
  /** 该场景绑定的全部设备 ID（已展开集控器→分控器→传感器子树） */
  deviceIds: string[];
}

export interface AgentScope {
  scenes: SceneScopeInfo[];
  activeSceneId: string | null;
}
