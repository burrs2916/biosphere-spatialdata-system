//! AI Agent 引擎（精简版）：对话循环 + 流式增量 + function-calling 工具轮转 + 消息持久化 + 取消。
//! 事件契约对齐 web-craft：agent-chunk / agent-tool-call / agent-done / agent-error。

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde_json::json;
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;

use super::provider::{OpenAiCompatProvider, StreamCallbacks};
use super::store::AiStore;
use super::tools;
use super::types::{AgentScopeSerde, ChatMessage, ChatOutcome, ReqToolCall, ReqToolFn};

pub const DEFAULT_MAX_ITERATIONS: usize = 8;

/// 内置默认提示词：注入喷雾降尘业务术语与数据约束，避免模型把裸数字丢给用户或编造结论。
const SYSTEM_PROMPT: &str = r#"你是煤矿喷雾降尘监控系统的 AI 助手，面向现场运维人员回答问题。

【工作方式】
1. 涉及设备状态、传感器数据、报警、日志、操作记录的问题，必须调用工具获取真实数据后再回答，严禁凭印象编造。
2. 工具返回为空时，如实说明「未查到」，并可提示调整时间范围或指定设备 ID 再查。
3. 回答用简体中文，先给结论数字，再列关键明细，简明扼要。

【领域术语（用于把数字翻译成运维语言）】
- 传感器类型：0 风速、1 风压、2 CH4、3 CO、4 温度、5 粉尘。
- 喷洒模式：0 常不喷、1 常喷、2 循环喷。
- 目标类型：2 服务器、18 喷雾集控器。
- 设备层级：集控器 → 分控器 → 传感器。

【重要约束】
- 当前报警传感器数据为 2 字节位域，仅「烟雾」位（低字节第 4 位）有确定含义。只能依据工具返回的已知数据作答；
  不得推测其他位对应的传感器类型，也不得声称知道确切的报警触发源。数据不足时直接说明「当前数据无法确定触发源」。
- 注意区分两套场景口径：通讯协议中的 scene 取值为 0综采/1人机/2皮带/3掘进/4火灾；
  界面上的场景标识为 tunnel/bridge/mining/scene5，两者不是同一套，引用时必须说明来源。
- 本系统只提供只读查询能力。涉及喷雾下控、参数下发等控制类操作时，只做说明与建议，不要尝试执行。"#;

/// 全局运行句柄：conversation_id → 取消标志 & 任务
pub struct RunRegistry {
    cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
    tasks: Mutex<HashMap<String, JoinHandle<()>>>,
}

impl RunRegistry {
    pub fn new() -> Self {
        Self {
            cancels: Mutex::new(HashMap::new()),
            tasks: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, conv_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.cancels
            .lock()
            .unwrap()
            .insert(conv_id.to_string(), flag.clone());
        flag
    }

    pub fn attach_task(&self, conv_id: &str, task: JoinHandle<()>) {
        self.tasks.lock().unwrap().insert(conv_id.to_string(), task);
    }

    pub fn cancel(&self, conv_id: &str) {
        if let Some(flag) = self.cancels.lock().unwrap().get(conv_id) {
            flag.store(true, Ordering::SeqCst);
        }
    }

    pub fn cleanup(&self, conv_id: &str) {
        self.cancels.lock().unwrap().remove(conv_id);
        if let Some(task) = self.tasks.lock().unwrap().remove(conv_id) {
            task.abort();
        }
    }
}

/// 运行守卫：函数任意返回路径（含 `?` 提前返回与取消）都会触发 `Drop`，
/// 自动调用 `registry.cleanup`，避免取消标志 / 任务句柄泄漏。
/// 取代原先散落在成功/超限两处的手工 `registry.cleanup` 调用。
struct RunGuard {
    registry: Arc<RunRegistry>,
    conv_id: String,
}

impl RunGuard {
    fn new(registry: Arc<RunRegistry>, conv_id: String) -> Self {
        Self { registry, conv_id }
    }
}

impl Drop for RunGuard {
    fn drop(&mut self) {
        self.registry.cleanup(&self.conv_id);
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn run_agent(
    app: AppHandle,
    store: Arc<AiStore>,
    registry: Arc<RunRegistry>,
    conversation_id: String,
    message: String,
    base_url: String,
    api_key: String,
    model: String,
    system_prompt: String,
    temperature: Option<f64>,
    max_iterations: usize,
    allowed_tools: Vec<String>,
    insecure: bool,
    scope: Option<AgentScopeSerde>,
) -> Result<String, String> {
    // 1. 持久化用户消息；空标题会话用首条消息截断做标题
    store.append_message(super::types::AiMessage {
        id: format!("msg-{}", uuid::Uuid::new_v4().simple()),
        conversation_id: conversation_id.clone(),
        role: "user".into(),
        content: message.clone(),
        tool_name: None,
        tool_args: None,
        tool_calls: None,
        created_at: chrono::Local::now()
            .format("%Y-%m-%d %H:%M:%S%.3f")
            .to_string(),
        seq: 0,
    })?;
    let conv_list = store.list_conversations()?;
    let is_new = conv_list
        .iter()
        .find(|c| c.id == conversation_id)
        .map(|c| c.title.is_empty() || c.title == "新对话")
        .unwrap_or(true);
    if is_new {
        let title: String = message.chars().take(18).collect();
        store.touch_conversation(&conversation_id, Some(&title))?;
    } else {
        store.touch_conversation(&conversation_id, None)?;
    }

    // 2. 组装对话历史（system + 历史 + 本条 user）；智能体提示词替换内置默认
    let mut effective_system = if system_prompt.trim().is_empty() {
        SYSTEM_PROMPT.to_string()
    } else {
        system_prompt
    };
    // 注入场景范围说明（scope 三级），让模型知道可用场景与如何限定
    let scope_text = build_scope_prompt(&scope);
    if !scope_text.is_empty() {
        effective_system = format!("{effective_system}\n\n{scope_text}");
    }
    let history = store.list_messages(&conversation_id)?;
    let mut chat: Vec<ChatMessage> = vec![ChatMessage {
        role: "system".into(),
        content: Some(effective_system),
        tool_calls: None,
        tool_call_id: None,
        name: None,
    }];
    let mut expected_calls: HashSet<String> = HashSet::new();
    for m in &history {
        match m.role.as_str() {
            "tool" => {
                let call_id = m.tool_name.clone().unwrap_or_default();
                // 防御：孤立 tool 消息（脏历史 / 前序无对应 assistant tool_calls）
                // 直接跳过，避免回放成「无前序 tool_calls 的 tool」触发协议 400。
                if !expected_calls.contains(&call_id) {
                    continue;
                }
                expected_calls.remove(&call_id);
                chat.push(ChatMessage {
                    role: "tool".into(),
                    content: Some(m.content.clone()),
                    tool_calls: None,
                    tool_call_id: Some(call_id.clone()),
                    name: m.tool_name.clone(),
                });
            }
            "assistant" => {
                // 还原 assistant(tool_calls)，使后续 tool 消息能正确配对
                let tool_calls = m
                    .tool_calls
                    .as_ref()
                    .and_then(|s| serde_json::from_str::<Vec<ReqToolCall>>(s).ok());
                if let Some(ref tcs) = tool_calls {
                    for tc in tcs {
                        expected_calls.insert(tc.id.clone());
                    }
                }
                chat.push(ChatMessage {
                    role: "assistant".into(),
                    content: if m.content.is_empty() {
                        None
                    } else {
                        Some(m.content.clone())
                    },
                    tool_calls,
                    tool_call_id: None,
                    name: None,
                });
            }
            _ => {
                chat.push(ChatMessage {
                    role: "user".into(),
                    content: Some(m.content.clone()),
                    tool_calls: None,
                    tool_call_id: None,
                    name: None,
                });
            }
        }
    }

    // 3. 引擎循环（工具集按智能体白名单过滤）
    let provider = OpenAiCompatProvider {
        base_url,
        api_key,
        model,
        temperature,
        insecure,
    };
    let tool_defs: Vec<super::types::ToolDef> = {
        let all = tools::tool_defs();
        if allowed_tools.is_empty() {
            all
        } else {
            all.into_iter()
                .filter(|d| allowed_tools.iter().any(|n| n == d.name))
                .collect()
        }
    };
    let cancel = registry.register(&conversation_id);
    let is_cancelled = move || cancel.load(Ordering::SeqCst);
    // 守卫：run_agent 任意路径返回（成功 / 超限 / 取消 / 错误 `?`）都自动 cleanup，杜绝泄漏
    let _guard = RunGuard::new(registry.clone(), conversation_id.clone());

    let mut final_content = String::new();
    for _iteration in 0..max_iterations {
        if is_cancelled() {
            let _ = app.emit(
                "agent-error",
                json!({ "conversationId": conversation_id, "error": "已取消" }),
            );
            return Err("已取消".into());
        }
        let outcome: ChatOutcome = {
            let handle = app.clone();
            provider
                .chat_stream(
                    &chat,
                    &tool_defs,
                    StreamCallbacks {
                        on_chunk: &|chunk: &str| {
                            let _ = handle.emit(
                                "agent-chunk",
                                serde_json::json!({ "conversationId": conversation_id, "chunk": chunk }),
                            );
                        },
                        is_cancelled: &is_cancelled,
                    },
                )
                .await
                .map_err(|e| e.to_string())?
        };

        if outcome.tool_calls.is_empty() {
            // 纯文本回答：持久化 + 完成
            final_content = outcome.content;
            store.append_message(super::types::AiMessage {
                id: format!("msg-{}", uuid::Uuid::new_v4().simple()),
                conversation_id: conversation_id.clone(),
                role: "assistant".into(),
                content: final_content.clone(),
                tool_name: None,
                tool_args: None,
                tool_calls: None,
                created_at: chrono::Local::now()
                    .format("%Y-%m-%d %H:%M:%S%.3f")
                    .to_string(),
                seq: 0,
            })?;
            let _ = app.emit(
                "agent-done",
                serde_json::json!({ "conversationId": conversation_id, "response": final_content }),
            );
            return Ok(final_content);
        }

        // 工具调用：回放 assistant(tool_calls) 消息，逐个执行 + 持久化 + 推送卡片
        let reply_calls: Vec<ReqToolCall> = outcome
            .tool_calls
            .iter()
            .map(|(id, name, args)| ReqToolCall {
                id: id.clone(),
                kind: "function".into(),
                function: ReqToolFn {
                    name: name.clone(),
                    arguments: args.clone(),
                },
            })
            .collect();
        // P0-1 核心修复：assistant(tool_calls) 必须落库。否则下一轮回放会出现
        // 没有前序 tool_calls 的孤立 tool 消息，触发 OpenAI 协议 400 并使会话永久失效。
        // 同时清理函数名为空的无效调用，避免回放时模型报 `Tool '' is not available`。
        let persistent_calls: Vec<ReqToolCall> = reply_calls
            .iter()
            .filter(|c| !c.function.name.is_empty())
            .cloned()
            .collect();
        let tool_calls_json = if persistent_calls.is_empty() {
            None
        } else {
            serde_json::to_string(&persistent_calls).ok()
        };
        store.append_message(super::types::AiMessage {
            id: format!("msg-{}", uuid::Uuid::new_v4().simple()),
            conversation_id: conversation_id.clone(),
            role: "assistant".into(),
            content: outcome.content.clone(),
            tool_name: None,
            tool_args: None,
            tool_calls: tool_calls_json,
            created_at: chrono::Local::now()
                .format("%Y-%m-%d %H:%M:%S%.3f")
                .to_string(),
            seq: 0,
        })?;
        chat.push(ChatMessage {
            role: "assistant".into(),
            content: if outcome.content.is_empty() {
                None
            } else {
                Some(outcome.content.clone())
            },
            tool_calls: Some(reply_calls),
            tool_call_id: None,
            name: None,
        });

        for (call_id, name, args) in &outcome.tool_calls {
            // 停止按钮在工具执行期间也生效：进入下一个工具前先检查取消标志
            if is_cancelled() {
                let _ = app.emit(
                    "agent-error",
                    json!({ "conversationId": conversation_id, "error": "已取消" }),
                );
                return Err("已取消".into());
            }
            let _ = app.emit(
                "agent-tool-call",
                serde_json::json!({
                    "conversationId": conversation_id,
                    "toolCall": { "id": call_id, "name": name, "arguments": args, "status": "running" }
                }),
            );
            let result = tools::execute_tool(
                name,
                &serde_json::from_str::<serde_json::Value>(args).unwrap_or(json!({})),
                &scope,
            )
            .await
            .unwrap_or_else(|e| format!("工具执行失败: {e}"));
            let failed = result.starts_with("工具执行失败");
            let _ = app.emit(
                "agent-tool-call",
                serde_json::json!({
                    "conversationId": conversation_id,
                    "toolCall": { "id": call_id, "name": name, "arguments": args,
                                  "status": if failed { "error" } else { "done" }, "result": result.clone() }
                }),
            );
            // 持久化工具结果（role=tool，tool_call_id 用调用 id 供协议回放）
            store.append_message(super::types::AiMessage {
                id: format!("msg-{}", uuid::Uuid::new_v4().simple()),
                conversation_id: conversation_id.clone(),
                role: "tool".into(),
                content: result.clone(),
                tool_name: Some(call_id.clone()),
                tool_args: Some(args.clone()),
                tool_calls: None,
                created_at: chrono::Local::now()
                    .format("%Y-%m-%d %H:%M:%S%.3f")
                    .to_string(),
                seq: 0,
            })?;
            chat.push(ChatMessage {
                role: "tool".into(),
                content: Some(result),
                tool_calls: None,
                tool_call_id: Some(call_id.clone()),
                name: Some(name.clone()),
            });
        }
    }

    let err = format!("达到最大迭代次数（{max_iterations}），已停止");
    let _ = app.emit(
        "agent-error",
        serde_json::json!({ "conversationId": conversation_id, "error": err }),
    );
    Err(err)
}

/// 把运行时传入的场景范围（scope 三级）注入 system prompt，
/// 让模型知道有哪些场景、各自绑定多少设备，以及如何在工具中限定。
fn build_scope_prompt(scope: &Option<AgentScopeSerde>) -> String {
    let Some(s) = scope else { return String::new() };
    if s.scenes.is_empty() {
        return String::new();
    }
    let mut lines = vec![
        "【场景范围（scope 三级：全矿 / 单设备 / 场景）】".to_string(),
        "可用场景（工具里 scene 参数传名称或 id 均可）：".to_string(),
    ];
    for sc in &s.scenes {
        let active = if Some(&sc.id) == s.active_scene_id.as_ref() {
            "（当前所在场景）"
        } else {
            ""
        };
        let mode = if sc.scene_mode.is_empty() {
            "—"
        } else {
            &sc.scene_mode
        };
        lines.push(format!(
            "- {}（id={}，模式={}，绑定 {} 台设备）{}",
            sc.name,
            sc.id,
            mode,
            sc.device_ids.len(),
            active
        ));
    }
    lines.push(
        "默认查询全矿。若用户问题明显指向某场景（如『这个巷道/廊桥/综采最近报警』），请在数据工具中传 scene=\"<场景名称或 id>\" 限定到该场景的设备；传 scene=\"all\" 或留空表示全矿；传 device_id 限定单台设备。"
            .to_string(),
    );
    lines
        .push("注意：系统事件（query_system_events）为模块级，不受场景/设备范围限制。".to_string());
    lines.join("\n")
}
