//! AI 助手类型定义（serde camelCase，与前端 DTO 对齐；架构对齐 web-craft ai_agent 模块）

use serde::{Deserialize, Serialize};

/// ── 三层模型配置（Provider → Endpoint → Model，与参考项目同构） ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProvider {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub created_at: String,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEndpoint {
    pub id: String,
    pub provider_id: String,
    /// 端点显示名（如 "OpenAI 官方" / "本地 Ollama"）；空则前端回退显示 URL
    #[serde(default)]
    pub name: String,
    /// OpenAI 兼容 base_url，如 https://api.openai.com/v1
    pub base_url: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 跳过 TLS 证书校验（内网自签 https 网关用，如煤矿现场本地服务）
    #[serde(default)]
    pub insecure: bool,
    #[serde(default)]
    pub created_at: String,
}

/// ── 智能体（对齐 web-craft ai_agents：人设 + 绑定模型 + 工具白名单） ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAgent {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// 绑定模型（ai_models.id）
    #[serde(default)]
    pub model_id: String,
    /// 系统提示词；空则使用内置默认
    #[serde(default)]
    pub system_prompt: String,
    #[serde(default = "default_temperature")]
    pub temperature: f64,
    #[serde(default = "default_max_iterations")]
    pub max_iterations: i64,
    /// 允许的工具名列表；空 = 全部可用
    #[serde(default)]
    pub tool_ids: Vec<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

fn default_temperature() -> f64 {
    0.7
}

fn default_max_iterations() -> i64 {
    10
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModel {
    pub id: String,
    pub endpoint_id: String,
    pub model_name: String,
    #[serde(default)]
    pub created_at: String,
}

/// ── 会话与消息 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConversation {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessage {
    pub id: String,
    pub conversation_id: String,
    /// user | assistant | tool
    pub role: String,
    #[serde(default)]
    pub content: String,
    /// tool 角色消息的来源工具名
    #[serde(default)]
    pub tool_name: Option<String>,
    /// tool 角色消息的调用参数（JSON 字符串，前端卡片展示）
    #[serde(default)]
    pub tool_args: Option<String>,
    /// assistant 角色消息请求的工具调用（OpenAI 请求格式数组的 JSON 字符串）。
    /// 必须持久化：否则下一轮回放历史时会出现没有前序 tool_calls 的孤立 tool 消息，
    /// 模型接口会直接返回 400。
    #[serde(default)]
    pub tool_calls: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub seq: i64,
}

/// ── 运行时事件载荷 ──

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallEvent {
    pub id: String,
    pub name: String,
    pub arguments: String,
    /// running | done | error
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
}

/// ── provider 请求/响应内部类型 ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ReqToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReqToolCall {
    pub id: String,
    /// OpenAI 格式固定 "function"
    #[serde(rename = "type")]
    pub kind: String,
    pub function: ReqToolFn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReqToolFn {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolDef {
    pub name: &'static str,
    pub description: &'static str,
    pub parameters: serde_json::Value,
}

/// 模型一轮输出：文本 + 请求的工具调用
#[derive(Debug, Default)]
pub struct ChatOutcome {
    pub content: String,
    pub tool_calls: Vec<(String, String, String)>, // (id, name, arguments)
}

/// ── 场景范围（scope 三级：全矿 / 单设备 / 场景）──
///
/// 由前端在每次运行时传入：前端拥有 scenes DB 与实时设备树，
/// 负责把「场景 → 设备 ID 集合（含集控器→分控器→传感器子树）」解析好，
/// 后端只做只读过滤，不反向依赖 scenes DB（ai_agent 独立库，且设备树仅前端持有）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneScopeSerde {
    pub id: String,
    pub name: String,
    /// 场景模式（tunnel/bridge/mining/scene5），可能为空
    #[serde(default)]
    pub scene_mode: String,
    /// 该场景绑定的全部设备 ID（已展开子树）
    #[serde(default)]
    pub device_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentScopeSerde {
    pub scenes: Vec<SceneScopeSerde>,
    #[serde(default)]
    pub active_scene_id: Option<String>,
}
