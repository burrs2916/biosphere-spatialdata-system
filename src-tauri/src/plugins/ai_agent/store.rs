//! AI 助手持久化：独立 SQLite 文件（app_data_dir/ai_agent.db），不触碰应用现有数据库。
//! 与 web-craft 一致用 SQLite 存配置/会话/消息；rusqlite + Mutex（命令内短临界区）。

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

use super::types::{AiAgent, AiConversation, AiEndpoint, AiMessage, AiModel, AiProvider};

pub struct AiStore {
    conn: Mutex<Connection>,
}

fn now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string()
}

fn gen_id(prefix: &str) -> String {
    format!("{}-{}", prefix, uuid::Uuid::new_v4().simple())
}

impl AiStore {
    pub fn new(db_path: &Path) -> Result<Self, String> {
        if let Some(dir) = db_path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS ai_providers (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, api_key TEXT DEFAULT '',
                enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS ai_endpoints (
                id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, name TEXT DEFAULT '',
                base_url TEXT NOT NULL, enabled INTEGER DEFAULT 1, created_at TEXT DEFAULT '', insecure INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS ai_agents (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
                model_id TEXT DEFAULT '', system_prompt TEXT DEFAULT '',
                temperature REAL DEFAULT 0.7, max_iterations INTEGER DEFAULT 10,
                tool_ids TEXT DEFAULT '[]',
                created_at TEXT DEFAULT '', updated_at TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS ai_models (
                id TEXT PRIMARY KEY, endpoint_id TEXT NOT NULL, model_name TEXT NOT NULL,
                created_at TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS ai_conversations (
                id TEXT PRIMARY KEY, title TEXT NOT NULL,
                created_at TEXT DEFAULT '', updated_at TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS ai_messages (
                id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
                content TEXT DEFAULT '', tool_name TEXT, tool_args TEXT,
                created_at TEXT DEFAULT '', seq INTEGER DEFAULT 0, tool_calls TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, seq);
            "#,
        )
        .map_err(|e| e.to_string())?;
        // legacy db compat: add enabled column (silently skip if exists)
        let _ = conn.execute_batch(
            "ALTER TABLE ai_providers ADD COLUMN enabled INTEGER DEFAULT 1;",
        );
        let _ = conn.execute_batch(
            "ALTER TABLE ai_endpoints ADD COLUMN enabled INTEGER DEFAULT 1;",
        );
        let _ = conn.execute_batch(
            "ALTER TABLE ai_endpoints ADD COLUMN name TEXT DEFAULT '';",
        );
        let _ = conn.execute_batch(
            "ALTER TABLE ai_endpoints ADD COLUMN insecure INTEGER DEFAULT 0;",
        );
        // legacy db compat: assistant 消息的工具调用（旧库没有该列，跳过即可）
        let _ = conn.execute_batch(
            "ALTER TABLE ai_messages ADD COLUMN tool_calls TEXT;",
        );
        Ok(Self { conn: Mutex::new(conn) })
    }

    // ── Provider ──
    pub fn save_provider(&self, mut p: AiProvider) -> Result<AiProvider, String> {
        if p.id.is_empty() {
            p.id = gen_id("prov");
            p.created_at = now();
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO ai_providers (id, name, api_key, enabled, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET name=?2, api_key=?3, enabled=?4",
            [&p.id, &p.name, &p.api_key, &(p.enabled as i64).to_string(), &p.created_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(p)
    }

    pub fn list_providers(&self) -> Result<Vec<AiProvider>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut st = conn
            .prepare("SELECT id, name, api_key, enabled, created_at FROM ai_providers ORDER BY created_at")
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                Ok(AiProvider {
                    id: r.get(0)?, name: r.get(1)?, api_key: r.get(2)?,
                    enabled: r.get::<_, i64>(3)? != 0, created_at: r.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn delete_provider(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_endpoints WHERE provider_id=?1", [id]).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_models WHERE endpoint_id IN (SELECT id FROM ai_endpoints WHERE provider_id=?1)", [id]).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_providers WHERE id=?1", [id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    // ── Endpoint ──
    pub fn save_endpoint(&self, mut e: AiEndpoint) -> Result<AiEndpoint, String> {
        if e.id.is_empty() {
            e.id = gen_id("endp");
            e.created_at = now();
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO ai_endpoints (id, provider_id, name, base_url, enabled, created_at, insecure) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET provider_id=?2, name=?3, base_url=?4, enabled=?5, insecure=?7",
            [&e.id, &e.provider_id, &e.name, &e.base_url, &(e.enabled as i64).to_string(), &e.created_at, &(e.insecure as i64).to_string()],
        )
        .map_err(|e| e.to_string())?;
        Ok(e)
    }

    pub fn list_endpoints(&self) -> Result<Vec<AiEndpoint>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut st = conn
            .prepare("SELECT id, provider_id, name, base_url, enabled, created_at, insecure FROM ai_endpoints ORDER BY created_at")
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                Ok(AiEndpoint {
                    id: r.get(0)?, provider_id: r.get(1)?, name: r.get(2)?, base_url: r.get(3)?,
                    enabled: r.get::<_, i64>(4)? != 0, created_at: r.get(5)?,
                    insecure: r.get::<_, i64>(6)? != 0,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn delete_endpoint(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_models WHERE endpoint_id=?1", [id]).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_endpoints WHERE id=?1", [id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    // ── Model ──
    pub fn save_model(&self, mut m: AiModel) -> Result<AiModel, String> {
        if m.id.is_empty() {
            m.id = gen_id("model");
            m.created_at = now();
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO ai_models (id, endpoint_id, model_name, created_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET endpoint_id=?2, model_name=?3",
            [&m.id, &m.endpoint_id, &m.model_name, &m.created_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(m)
    }

    pub fn list_models(&self) -> Result<Vec<AiModel>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut st = conn
            .prepare("SELECT id, endpoint_id, model_name, created_at FROM ai_models ORDER BY created_at")
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                Ok(AiModel {
                    id: r.get(0)?, endpoint_id: r.get(1)?, model_name: r.get(2)?, created_at: r.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn delete_model(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_models WHERE id=?1", [id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_model_chain(&self, model_id: &str) -> Result<(AiModel, AiEndpoint, AiProvider), String> {
        let models = self.list_models()?;
        let model = models
            .into_iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| "模型不存在".to_string())?;
        let endpoints = self.list_endpoints()?;
        let endpoint = endpoints
            .into_iter()
            .find(|e| e.id == model.endpoint_id)
            .ok_or_else(|| "端点不存在".to_string())?;
        let providers = self.list_providers()?;
        let provider = providers
            .into_iter()
            .find(|p| p.id == endpoint.provider_id)
            .ok_or_else(|| "供应商不存在".to_string())?;
        Ok((model, endpoint, provider))
    }

    /// 端点 → 供应商链（连接测试用）
    pub fn get_model_chain_for_endpoint(&self, endpoint_id: &str) -> Result<(AiEndpoint, AiProvider), String> {
        let endpoints = self.list_endpoints()?;
        let endpoint = endpoints
            .into_iter()
            .find(|e| e.id == endpoint_id)
            .ok_or_else(|| "端点不存在".to_string())?;
        let providers = self.list_providers()?;
        let provider = providers
            .into_iter()
            .find(|p| p.id == endpoint.provider_id)
            .ok_or_else(|| "供应商不存在".to_string())?;
        Ok((endpoint, provider))
    }

    // ── Agent（智能体） ──
    pub fn save_agent(&self, mut a: AiAgent) -> Result<AiAgent, String> {
        if a.id.is_empty() {
            a.id = gen_id("agent");
            a.created_at = now();
        }
        a.updated_at = now();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tool_ids = serde_json::to_string(&a.tool_ids).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO ai_agents (id, name, description, model_id, system_prompt, temperature, max_iterations, tool_ids, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET name=?2, description=?3, model_id=?4, system_prompt=?5,
               temperature=?6, max_iterations=?7, tool_ids=?8, updated_at=?10",
            [
                &a.id, &a.name, &a.description, &a.model_id, &a.system_prompt,
                &a.temperature.to_string(), &a.max_iterations.to_string(), &tool_ids,
                &a.created_at, &a.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(a)
    }

    pub fn list_agents(&self) -> Result<Vec<AiAgent>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut st = conn
            .prepare(
                "SELECT id, name, description, model_id, system_prompt, temperature, max_iterations, tool_ids, created_at, updated_at
                 FROM ai_agents ORDER BY created_at",
            )
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                let tool_ids_raw: String = r.get(7)?;
                Ok((
                    r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?, r.get::<_, String>(4)?,
                    r.get::<_, f64>(5)?, r.get::<_, i64>(6)?, tool_ids_raw,
                    r.get::<_, String>(8)?, r.get::<_, String>(9)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            let (id, name, description, model_id, system_prompt, temperature, max_iterations, tool_ids_raw, created_at, updated_at) =
                row.map_err(|e| e.to_string())?;
            out.push(AiAgent {
                id, name, description, model_id, system_prompt, temperature, max_iterations,
                tool_ids: serde_json::from_str(&tool_ids_raw).unwrap_or_default(),
                created_at, updated_at,
            });
        }
        Ok(out)
    }

    pub fn get_agent(&self, id: &str) -> Result<AiAgent, String> {
        self.list_agents()?
            .into_iter()
            .find(|a| a.id == id)
            .ok_or_else(|| "智能体不存在".to_string())
    }

    pub fn delete_agent(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_agents WHERE id=?1", [id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    // ── Conversation ──
    pub fn create_conversation(&self, title: &str) -> Result<AiConversation, String> {
        let c = AiConversation {
            id: gen_id("conv"),
            title: title.to_string(),
            created_at: now(),
            updated_at: now(),
        };
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO ai_conversations (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            [&c.id, &c.title, &c.created_at, &c.updated_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(c)
    }

    pub fn list_conversations(&self) -> Result<Vec<AiConversation>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut st = conn
            .prepare("SELECT id, title, created_at, updated_at FROM ai_conversations ORDER BY updated_at DESC")
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                Ok(AiConversation {
                    id: r.get(0)?, title: r.get(1)?, created_at: r.get(2)?, updated_at: r.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn delete_conversation(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_messages WHERE conversation_id=?1", [id]).map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_conversations WHERE id=?1", [id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 清空会话消息但保留会话本身（「清除对话」语义）；标题复位为「新对话」。
    pub fn clear_messages(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM ai_messages WHERE conversation_id=?1", [id]).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE ai_conversations SET title='新对话', updated_at=?2 WHERE id=?1",
            [id, &now()],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn touch_conversation(&self, id: &str, title: Option<&str>) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        if let Some(t) = title {
            conn.execute("UPDATE ai_conversations SET title=?2, updated_at=?3 WHERE id=?1", [id, t, &now()])
                .map_err(|e| e.to_string())?;
        } else {
            conn.execute("UPDATE ai_conversations SET updated_at=?2 WHERE id=?1", [id, &now()])
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    // ── Message ──
    pub fn append_message(&self, m: AiMessage) -> Result<AiMessage, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let seq: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(seq), 0) + 1 FROM ai_messages WHERE conversation_id=?1",
                [&m.conversation_id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO ai_messages (id, conversation_id, role, content, tool_name, tool_args, created_at, seq, tool_calls)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            [
                &m.id, &m.conversation_id, &m.role, &m.content,
                &m.tool_name.clone().unwrap_or_default(),
                &m.tool_args.clone().unwrap_or_default(),
                &m.created_at, &seq.to_string(),
                &m.tool_calls.clone().unwrap_or_default(),
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(AiMessage { seq, ..m })
    }

    pub fn list_messages(&self, conversation_id: &str) -> Result<Vec<AiMessage>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut st = conn
            .prepare(
                "SELECT id, conversation_id, role, content, tool_name, tool_args, created_at, seq, tool_calls
                 FROM ai_messages WHERE conversation_id=?1 ORDER BY seq",
            )
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([conversation_id], |r| {
                Ok(AiMessage {
                    id: r.get(0)?,
                    conversation_id: r.get(1)?,
                    role: r.get(2)?,
                    content: r.get(3)?,
                    tool_name: r.get(4)?,
                    tool_args: r.get(5)?,
                    created_at: r.get(6)?,
                    seq: r.get(7)?,
                    tool_calls: r.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}
