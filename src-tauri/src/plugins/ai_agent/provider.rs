//! OpenAI 兼容 Provider：/chat/completions 流式（SSE）+ function-calling。
//! 对齐 web-craft openai_provider 的职责（裁剪版：仅 OpenAI 兼容协议）。

use serde_json::{json, Value};

use super::types::{ChatMessage, ChatOutcome, ToolDef};

pub struct OpenAiCompatProvider {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    /// 采样温度；None = 不下发（用服务端默认）
    pub temperature: Option<f64>,
    /// 跳过 TLS 证书校验（内网自签 https 网关，如煤矿现场本地服务）
    pub insecure: bool,
}

pub struct StreamCallbacks<'a> {
    /// 收到文本增量
    pub on_chunk: &'a (dyn Fn(&str) + Send + Sync),
    /// 收到取消信号（返回 true 则中断）
    pub is_cancelled: &'a (dyn Fn() -> bool + Send + Sync),
}

pub struct ProviderError(pub String);

impl std::fmt::Display for ProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// 按字符边界截断（按字节切片会在中文 UTF-8 上 panic）
fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let mut out: String = s.chars().take(max).collect();
        out.push_str("…");
        out
    }
}

fn parse_provider_payload(text: &str) -> Result<Value, ProviderError> {
    serde_json::from_str(text).map_err(|e| ProviderError(format!("解析响应失败: {e}")))
}

impl OpenAiCompatProvider {
    /// 构造 reqwest client：insecure=true 时跳过 TLS 证书校验（内网自签 https 网关）
    fn http_client(&self) -> reqwest::Client {
        let mut builder = reqwest::Client::builder();
        if self.insecure {
            builder = builder.danger_accept_invalid_certs(true);
        }
        builder.build().unwrap_or_else(|_| reqwest::Client::new())
    }

    fn build_body(&self, messages: &[ChatMessage], tools: &[ToolDef]) -> Value {
        let mut body = json!({
            "model": self.model,
            "messages": messages,
            "stream": true,
        });
        if let Some(t) = self.temperature {
            body["temperature"] = json!(t);
        }
        if !tools.is_empty() {
            body["tools"] = json!(
                tools.iter()
                    .map(|t| json!({
                        "type": "function",
                        "function": { "name": t.name, "description": t.description, "parameters": t.parameters }
                    }))
                    .collect::<Vec<_>>()
            );
        }
        body
    }

    /// 流式对话一轮：文本增量经 on_chunk 回调；工具调用完整累积后随 ChatOutcome 返回。
    pub async fn chat_stream(
        &self,
        messages: &[ChatMessage],
        tools: &[ToolDef],
        cb: StreamCallbacks<'_>,
    ) -> Result<ChatOutcome, ProviderError> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let client = self.http_client();
        let mut req = client
            .post(&url)
            .json(&self.build_body(messages, tools));
        if !self.api_key.is_empty() {
            req = req.bearer_auth(&self.api_key);
        }
        let mut resp = req
            .send()
            .await
            .map_err(|e| ProviderError(format!("请求模型接口失败: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(ProviderError(format!("模型接口 HTTP {status}: {}", truncate(&text, 500))));
        }

        let mut outcome = ChatOutcome::default();
        // tool_calls 按 index 累积（OpenAI 流式分片下发）
        let mut pending_calls: Vec<(usize, String, String, String)> = Vec::new(); // (index, id, name, args)
        let mut buffer = String::new();

        while let Some(chunk) = resp.chunk().await.map_err(|e| ProviderError(format!("读取流失败: {e}")))? {
            if (cb.is_cancelled)() {
                return Err(ProviderError("已取消".into()));
            }
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].trim_end_matches('\r').to_string();
                buffer.drain(..=pos);
                let data = match line.strip_prefix("data:") {
                    Some(d) => d.trim(),
                    None => continue,
                };
                if data == "[DONE]" {
                    return Ok(finalize(outcome, &mut pending_calls));
                }
                let payload: Value = match serde_json::from_str(data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let delta = &payload["choices"][0]["delta"];
                if let Some(text) = delta["content"].as_str() {
                    if !text.is_empty() {
                        (cb.on_chunk)(text);
                        outcome.content.push_str(text);
                    }
                }
                if let Some(tcs) = delta["tool_calls"].as_array() {
                    for tc in tcs {
                        let idx = tc["index"].as_u64().unwrap_or(0) as usize;
                        let entry = match pending_calls.iter_mut().find(|(i, ..)| *i == idx) {
                            Some(e) => e,
                            None => {
                                pending_calls.push((idx, String::new(), String::new(), String::new()));
                                pending_calls.last_mut().unwrap()
                            }
                        };
                        if let Some(id) = tc["id"].as_str() {
                            entry.1 = id.to_string();
                        }
                        if let Some(name) = tc["function"]["name"].as_str() {
                            entry.2.push_str(name);
                        }
                        if let Some(args) = tc["function"]["arguments"].as_str() {
                            entry.3.push_str(args);
                        }
                    }
                }
            }
        }
        Ok(finalize(outcome, &mut pending_calls))
    }

    /// 非流式单轮对话（模型连通性测试用）
    pub async fn chat_once(&self, prompt: &str) -> Result<String, ProviderError> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let client = reqwest::Client::new();
        let body = json!({
            "model": self.model,
            "messages": [{ "role": "user", "content": prompt }],
            "max_tokens": 32,
        });
        let resp = client
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError(format!("请求模型接口失败: {e}")))?;
        let status = resp.status();
        let text = resp.text().await.map_err(|e| ProviderError(format!("读取响应失败: {e}")))?;
        if !status.is_success() {
            return Err(ProviderError(format!("HTTP {status}: {}", truncate(&text, 300))));
        }
        let payload = parse_provider_payload(&text)?;
        Ok(payload["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("(空回复)")
            .to_string())
    }

    /// 连接测试：GET /models
    pub async fn list_remote_models(&self) -> Result<Vec<String>, ProviderError> {
        let url = format!("{}/models", self.base_url.trim_end_matches('/'));
        let client = self.http_client();
        let mut req = client.get(&url);
        if !self.api_key.is_empty() {
            req = req.bearer_auth(&self.api_key);
        }
        let resp = req
            .send()
            .await
            .map_err(|e| ProviderError(format!("请求失败: {e}")))?;
        let status = resp.status();
        let text = resp.text().await.map_err(|e| ProviderError(format!("读取响应失败: {e}")))?;
        if !status.is_success() {
            return Err(ProviderError(format!("HTTP {status}: {}", truncate(&text, 300))));
        }
        let payload = parse_provider_payload(&text)?;
        let ids: Vec<String> = payload["data"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        Ok(ids)
    }
}

fn finalize(mut outcome: ChatOutcome, pending: &mut Vec<(usize, String, String, String)>) -> ChatOutcome {
    pending.sort_by_key(|(i, ..)| *i);
    for (_, id, name, args) in pending.drain(..) {
        outcome.tool_calls.push((id, name, args));
    }
    outcome
}
