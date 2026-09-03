//! AI 助手 Tauri 命令：三层模型配置 CRUD + 会话/消息 + 运行/停止。
//! 命名前缀 ai_ 避免与现有命令冲突；只新增，不改动现有命令。

use std::sync::Arc;
use tauri::State;

use crate::plugins::ai_agent::engine::{self, RunRegistry};
use crate::plugins::ai_agent::provider::OpenAiCompatProvider;
use crate::plugins::ai_agent::store::AiStore;
use crate::plugins::ai_agent::types::{
    AgentScopeSerde, AiAgent, AiConversation, AiEndpoint, AiMessage, AiModel, AiProvider,
};

pub struct AiAgentState {
    pub store: Arc<AiStore>,
    pub registry: Arc<RunRegistry>,
}

// ── 三层模型配置 ──

#[tauri::command]
pub fn ai_save_provider(
    state: State<'_, AiAgentState>,
    provider: AiProvider,
) -> Result<AiProvider, String> {
    state.store.save_provider(provider)
}

#[tauri::command]
pub fn ai_list_providers(state: State<'_, AiAgentState>) -> Result<Vec<AiProvider>, String> {
    state.store.list_providers()
}

#[tauri::command]
pub fn ai_delete_provider(state: State<'_, AiAgentState>, id: String) -> Result<(), String> {
    state.store.delete_provider(&id)
}

#[tauri::command]
pub fn ai_save_endpoint(
    state: State<'_, AiAgentState>,
    endpoint: AiEndpoint,
) -> Result<AiEndpoint, String> {
    state.store.save_endpoint(endpoint)
}

#[tauri::command]
pub fn ai_list_endpoints(state: State<'_, AiAgentState>) -> Result<Vec<AiEndpoint>, String> {
    state.store.list_endpoints()
}

#[tauri::command]
pub fn ai_delete_endpoint(state: State<'_, AiAgentState>, id: String) -> Result<(), String> {
    state.store.delete_endpoint(&id)
}

#[tauri::command]
pub fn ai_save_model(state: State<'_, AiAgentState>, model: AiModel) -> Result<AiModel, String> {
    state.store.save_model(model)
}

#[tauri::command]
pub fn ai_list_models(state: State<'_, AiAgentState>) -> Result<Vec<AiModel>, String> {
    state.store.list_models()
}

#[tauri::command]
pub fn ai_delete_model(state: State<'_, AiAgentState>, id: String) -> Result<(), String> {
    state.store.delete_model(&id)
}

// ── 会话与消息 ──

#[tauri::command]
pub fn ai_create_conversation(
    state: State<'_, AiAgentState>,
    title: String,
) -> Result<AiConversation, String> {
    state.store.create_conversation(&title)
}

#[tauri::command]
pub fn ai_list_conversations(
    state: State<'_, AiAgentState>,
) -> Result<Vec<AiConversation>, String> {
    state.store.list_conversations()
}

#[tauri::command]
pub fn ai_delete_conversation(state: State<'_, AiAgentState>, id: String) -> Result<(), String> {
    state.store.delete_conversation(&id)
}

/// 清空会话消息但保留会话本身（前端「清除对话」按钮）
#[tauri::command]
pub fn ai_clear_messages(state: State<'_, AiAgentState>, id: String) -> Result<(), String> {
    state.store.clear_messages(&id)
}

#[tauri::command]
pub fn ai_list_messages(
    state: State<'_, AiAgentState>,
    conversation_id: String,
) -> Result<Vec<AiMessage>, String> {
    state.store.list_messages(&conversation_id)
}

// ── 智能体（Agent） ──

#[tauri::command]
pub fn ai_save_agent(state: State<'_, AiAgentState>, agent: AiAgent) -> Result<AiAgent, String> {
    state.store.save_agent(agent)
}

#[tauri::command]
pub fn ai_list_agents(state: State<'_, AiAgentState>) -> Result<Vec<AiAgent>, String> {
    state.store.list_agents()
}

#[tauri::command]
pub fn ai_delete_agent(state: State<'_, AiAgentState>, id: String) -> Result<(), String> {
    state.store.delete_agent(&id)
}

// ── 运行 ──

/// 运行 Agent：agent 中心制（对齐 web-craft run_agent）。
/// - `agentId` 提供时：用智能体的模型绑定/系统提示词/温度/迭代上限/工具白名单；
///   智能体未绑定模型则回退 `modelId`。
/// - `agentId` 为空：走默认助手（内置提示词 + `modelId`）。
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn ai_run_agent(
    app: tauri::AppHandle,
    state: State<'_, AiAgentState>,
    conversation_id: String,
    message: String,
    model_id: Option<String>,
    agent_id: Option<String>,
    scope: Option<AgentScopeSerde>,
) -> Result<String, String> {
    let store = state.store.clone();
    let registry = state.registry.clone();

    let (
        base_url,
        api_key,
        model,
        system_prompt,
        temperature,
        max_iterations,
        allowed_tools,
        insecure,
    ) = match agent_id.as_deref().filter(|s| !s.is_empty()) {
        Some(agent_id) => {
            let agent = store.get_agent(agent_id)?;
            let mid = if agent.model_id.is_empty() {
                model_id.ok_or_else(|| "智能体未绑定模型，且未选择默认模型".to_string())?
            } else {
                agent.model_id.clone()
            };
            let (model, endpoint, provider) = store.get_model_chain(&mid)?;
            (
                endpoint.base_url,
                provider.api_key,
                model.model_name,
                agent.system_prompt.clone(),
                Some(agent.temperature),
                agent.max_iterations.max(1) as usize,
                agent.tool_ids.clone(),
                endpoint.insecure,
            )
        }
        None => {
            let mid = model_id.ok_or_else(|| "缺少模型".to_string())?;
            let (model, endpoint, provider) = store.get_model_chain(&mid)?;
            (
                endpoint.base_url,
                provider.api_key,
                model.model_name,
                String::new(),
                None,
                engine::DEFAULT_MAX_ITERATIONS,
                Vec::new(),
                endpoint.insecure,
            )
        }
    };

    // 以独立任务运行：① 让「停止」能真正中断（task.abort 可切断工具执行中的 await）；
    // ② attach_task 注册句柄后，RunRegistry::cleanup 的 task.abort() 才真正生效。
    // 用 oneshot 信号等待任务结束/被中断，保持前端 invoke 契约不变（runAgent 仍等到完成才 resolve）。
    let (done_tx, done_rx) = tokio::sync::oneshot::channel::<()>();
    let run_handle = tokio::spawn({
        let app = app.clone();
        let store = store.clone();
        let registry = registry.clone();
        let conversation_id = conversation_id.clone();
        async move {
            let _ = engine::run_agent(
                app,
                store,
                registry,
                conversation_id,
                message,
                base_url,
                api_key,
                model,
                system_prompt,
                temperature,
                max_iterations,
                allowed_tools,
                insecure,
                scope,
            )
            .await;
            let _ = done_tx.send(());
        }
    });
    registry.attach_task(&conversation_id, run_handle);
    // 等待任务结束信号；被中断（stop 调 cleanup → abort）时发送端被丢弃 → Err → 返回「已取消」
    match done_rx.await {
        Ok(()) => Ok(String::new()),
        Err(_) => Err("已取消".into()),
    }
}

#[tauri::command]
pub fn ai_stop_agent(
    state: State<'_, AiAgentState>,
    conversation_id: String,
) -> Result<(), String> {
    // 置位取消标志（工具循环/迭代开头/流式 chunk 间的协作式检查）+ 中断任务句柄
    // （cleanup 的 task.abort() 可真正切断正在执行工具 await 的运行）。
    state.registry.cancel(&conversation_id);
    state.registry.cleanup(&conversation_id);
    Ok(())
}

// ── 测试 ──

/// 端点连接测试：GET {base}/models
#[tauri::command]
pub async fn ai_test_endpoint_connection(
    state: State<'_, AiAgentState>,
    endpoint_id: String,
) -> Result<String, String> {
    let (endpoint, provider) = state.store.get_model_chain_for_endpoint(&endpoint_id)?;
    if !endpoint.enabled {
        return Err("端点已停用".into());
    }
    let p = OpenAiCompatProvider {
        base_url: endpoint.base_url,
        api_key: provider.api_key,
        model: "test".into(),
        temperature: None,
        insecure: endpoint.insecure,
    };
    let models = p.list_remote_models().await.map_err(|e| e.to_string())?;
    Ok(format!("连接成功，远端共 {} 个模型", models.len()))
}

/// 模型对话测试：非流式单轮
#[tauri::command]
pub async fn ai_test_model_chat(
    state: State<'_, AiAgentState>,
    model_id: String,
) -> Result<String, String> {
    let (model, endpoint, provider) = state.store.get_model_chain(&model_id)?;
    if !endpoint.enabled {
        return Err("端点已停用".into());
    }
    let p = OpenAiCompatProvider {
        base_url: endpoint.base_url,
        api_key: provider.api_key,
        model: model.model_name,
        temperature: None,
        insecure: endpoint.insecure,
    };
    let reply = p
        .chat_once("请回复：连接成功")
        .await
        .map_err(|e| e.to_string())?;
    Ok(format!("模型回复: {}", reply))
}

/// 拉取端点远端模型列表（供前端「一键添加模型」）：GET {base}/models
#[tauri::command]
pub async fn ai_list_remote_models(
    state: State<'_, AiAgentState>,
    endpoint_id: String,
) -> Result<Vec<String>, String> {
    let (endpoint, provider) = state.store.get_model_chain_for_endpoint(&endpoint_id)?;
    if !endpoint.enabled {
        return Err("端点已停用".into());
    }
    let p = OpenAiCompatProvider {
        base_url: endpoint.base_url,
        api_key: provider.api_key,
        model: String::new(),
        temperature: None,
        insecure: endpoint.insecure,
    };
    p.list_remote_models().await.map_err(|e| e.to_string())
}
