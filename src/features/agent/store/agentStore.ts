/**
 * AI 助手 Zustand store —— 形状对齐 web-craft agentStore（裁剪：内置单助手，无 Ollama/Agent CRUD）
 */
import { create } from "zustand";
import type {
  AiAgent,
  AiConversation,
  AiEndpoint,
  AiMessage,
  AiModel,
  AiProvider,
} from "../proto/agent";
import * as agentService from "../services/agent.service";

const ACTIVE_MODEL_KEY = "ai-assistant-active-model";
const ACTIVE_AGENT_KEY = "ai-assistant-active-agent";

interface AgentState {
  providers: AiProvider[];
  endpoints: AiEndpoint[];
  models: AiModel[];
  agents: AiAgent[];
  conversations: AiConversation[];
  messages: AiMessage[];
  activeConversationId: string | null;
  activeModelId: string;
  /** 当前对话使用的智能体；空 = 默认助手（内置提示词） */
  activeAgentId: string;
  loading: boolean;
  error: string | null;

  /**
   * 抽屉开关（从 AppNavbar 局部状态提升而来，便于其他页面（如系统日志页）唤起 AI 助手）
   * + 待发送提示词：系统日志页「AI 辅助整理」一键把上下文注入并自动发问。
   */
  drawerOpen: boolean;
  /** 日志页注入的待发送提示词；AgentChat 消费后清空。为 null 时行为完全不变。 */
  pendingSeedPrompt: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** 打开抽屉并预填一条提示词（系统日志页调用） */
  seedAndOpen: (prompt: string) => void;
  /** AgentChat 发送完后调用，清空待发送提示词 */
  consumeSeed: () => void;

  loadConfig: () => Promise<void>;
  saveProvider: (provider: AiProvider) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  saveEndpoint: (endpoint: AiEndpoint) => Promise<void>;
  deleteEndpoint: (id: string) => Promise<void>;
  saveModel: (model: AiModel) => Promise<AiModel | null>;
  deleteModel: (id: string) => Promise<void>;
  setActiveModelId: (id: string) => void;

  loadAgents: () => Promise<void>;
  saveAgent: (agent: AiAgent) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  setActiveAgentId: (id: string) => void;

  /** 跨 tab 联动：对话页请求打开某个角色的编辑器，角色管理页消费后清空 */
  pendingAgentEditorId: string | null;
  requestAgentEditor: (agentId: string) => void;
  clearPendingAgentEditor: () => void;

  loadConversations: () => Promise<void>;
  createConversation: (title: string) => Promise<AiConversation | null>;
  deleteConversation: (id: string) => Promise<void>;
  clearMessages: (id: string) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  addMessage: (msg: AiMessage) => void;
  setActiveConversation: (id: string | null) => void;
}

function loadActiveModelId(): string {
  try {
    return localStorage.getItem(ACTIVE_MODEL_KEY) ?? "";
  } catch {
    return "";
  }
}

function loadActiveAgentId(): string {
  try {
    return localStorage.getItem(ACTIVE_AGENT_KEY) ?? "";
  } catch {
    return "";
  }
}

export const useAgentStore = create<AgentState>((set, get) => ({
  providers: [],
  endpoints: [],
  models: [],
  agents: [],
  conversations: [],
  messages: [],
  activeConversationId: null,
  activeModelId: loadActiveModelId(),
  activeAgentId: loadActiveAgentId(),
  loading: false,
  error: null,

  // 抽屉开关 + 待发送提示词（系统日志页「AI 辅助整理」唤起用）
  drawerOpen: false,
  pendingSeedPrompt: null,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  seedAndOpen: (prompt) => set({ pendingSeedPrompt: prompt, drawerOpen: true }),
  consumeSeed: () => set({ pendingSeedPrompt: null }),

  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const [providers, endpoints, models, agents] = await Promise.all([
        agentService.listProviders(),
        agentService.listEndpoints(),
        agentService.listModels(),
        agentService.listAgents().catch(() => [] as AiAgent[]),
      ]);
      const { activeModelId } = get();
      const stillValid = models.some((m) => m.id === activeModelId);
      set({
        providers,
        endpoints,
        models,
        agents,
        activeModelId: stillValid ? activeModelId : models[0]?.id ?? "",
        loading: false,
        error: null,
      });
      if (!stillValid && models[0]) get().setActiveModelId(models[0].id);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },

  saveProvider: async (provider) => {
    await agentService.saveProvider(provider);
    await get().loadConfig();
  },
  deleteProvider: async (id) => {
    await agentService.deleteProvider(id);
    await get().loadConfig();
  },
  saveEndpoint: async (endpoint) => {
    await agentService.saveEndpoint(endpoint);
    await get().loadConfig();
  },
  deleteEndpoint: async (id) => {
    await agentService.deleteEndpoint(id);
    await get().loadConfig();
  },
  saveModel: async (model) => {
    const saved = await agentService.saveModel(model);
    await get().loadConfig();
    return saved;
  },
  deleteModel: async (id) => {
    await agentService.deleteModel(id);
    await get().loadConfig();
  },
  setActiveModelId: (id) => {
    set({ activeModelId: id });
    try {
      localStorage.setItem(ACTIVE_MODEL_KEY, id);
    } catch { /* ignore */ }
  },

  loadAgents: async () => {
    try {
      const agents = await agentService.listAgents();
      set({ agents, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
  saveAgent: async (agent) => {
    await agentService.saveAgent(agent);
    await get().loadAgents();
  },
  deleteAgent: async (id) => {
    await agentService.deleteAgent(id);
    if (get().activeAgentId === id) get().setActiveAgentId("");
    await get().loadAgents();
  },
  setActiveAgentId: (id) => {
    set({ activeAgentId: id });
    try {
      localStorage.setItem(ACTIVE_AGENT_KEY, id);
    } catch { /* ignore */ }
  },

  pendingAgentEditorId: null,
  requestAgentEditor: (agentId) => set({ pendingAgentEditorId: agentId }),
  clearPendingAgentEditor: () => set({ pendingAgentEditorId: null }),

  loadConversations: async () => {
    try {
      const conversations = await agentService.listConversations();
      set({ conversations, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  createConversation: async (title) => {
    try {
      const conv = await agentService.createConversation(title);
      set({
        conversations: [conv, ...get().conversations],
        activeConversationId: conv.id,
        messages: [],
      });
      return conv;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },

  deleteConversation: async (id) => {
    try {
      await agentService.deleteConversation(id);
      const conversations = get().conversations.filter((c) => c.id !== id);
      const activeConversationId =
        get().activeConversationId === id ? null : get().activeConversationId;
      set({ conversations, activeConversationId, messages: [] });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  clearMessages: async (id) => {
    try {
      await agentService.clearMessages(id);
      if (get().activeConversationId === id) set({ messages: [] });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  loadMessages: async (conversationId) => {
    try {
      const messages = await agentService.listMessages(conversationId);
      set({ messages, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  addMessage: (msg) => set({ messages: [...get().messages, msg] }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
}));
