//! 监控域工具集：AI 通过 function-calling 调用，Rust 侧直连边缘计算 HTTP API（127.0.0.1:8084）。
//! 全部只读、无副作用，因此不设权限确认环节。
//!
//! 工具集（面向煤矿喷雾降尘运维场景）：
//!   query_devices          设备清单与在线状态
//!   query_sensor_history   传感器历史（粉尘/烟雾/CO/温度等，支持聚合）
//!   query_operation_logs   操作日志（指令下发与执行结果）
//!   query_device_events    设备事件（上下线/故障/报警）
//!   query_system_events    系统事件（可按模块过滤）
//!   query_dashboard_stats  全局概览统计（在线率/故障 Top/传感器数据量）
//!   query_scenes           列出当前运行可用的场景及其绑定设备数
//!
//! 作用域 scope（三级）：
//!   1. 全矿（默认）：不传 device_id / scene；
//!   2. 单设备：传 device_id；
//!   3. 场景：传 scene=场景名称或 id，后端按前端解析好的「场景→设备集合」过滤。
//! 场景→设备的解析（含集控器→分控器→传感器子树展开）由前端完成并在运行时传入，
//! 后端只做只读过滤，不反向依赖 scenes DB。

use serde_json::{json, Value};

use super::types::{AgentScopeSerde, ToolDef};

const EDGE_BASE: &str = "http://127.0.0.1:8084";
const MAX_RESULT_CHARS: usize = 4000;

pub fn tool_defs() -> Vec<ToolDef> {
    vec![
    ToolDef {
        name: "query_devices",
        description: "查询当前接入的监控设备清单与在线/离线状态。用于回答『现在有哪些设备/什么设备离线了/设备在线情况』。不传 device_id / scene 时返回全部设备；传 device_id 查单台；传 scene 限定到某场景绑定的设备。",
        parameters: json!({
            "type": "object",
            "properties": {
                "device_id": { "type": "string", "description": "设备 ID，精确查询单台设备；留空返回全部设备" },
                "scene": { "type": "string", "description": "场景范围：传场景名称或 id 限定到该场景绑定的设备（自动展开其集控器→分控器→传感器子树）；传 \"all\" 或留空表示全矿。与 device_id 互斥，同时传时 device_id 优先。" }
            },
            "required": []
        }),
    },
    ToolDef {
        name: "query_sensor_history",
        description: "查询传感器历史数据（粉尘、烟雾、CO、温度、风速、风压、CH4 等）。这是回答『粉尘浓度多少/有没有超标/喷雾前后粉尘变化/降尘效果』的唯一工具。可按设备与时间范围过滤，并支持聚合（agg）与采样步长（step）；做趋势或均值类问题时建议带 agg 与 step，避免返回过多原始点。传 scene 可限定到某场景的设备。",
        parameters: json!({
            "type": "object",
            "properties": {
                "hours": { "type": "number", "description": "查询最近 N 小时，默认 24" },
                "limit": { "type": "number", "description": "返回条数上限，默认 30" },
                "device_id": { "type": "string", "description": "设备 ID；留空表示全矿" },
                "scene": { "type": "string", "description": "场景范围：传场景名称或 id 限定到该场景绑定的设备；传 \"all\" 或留空表示全矿。与 device_id 互斥，同时传时 device_id 优先。" },
                "type": { "type": "string", "description": "传感器类型标识；不确定取值时留空（不过滤），先从返回结果中观察存在哪些类型" },
                "agg": { "type": "string", "description": "聚合方式，如 avg/max/min/count；留空返回原始采样点" },
                "step": { "type": "string", "description": "聚合步长，如 5m/30m/1h/1d；配合 agg 使用" }
            },
            "required": []
        }),
    },
    ToolDef {
        name: "query_operation_logs",
        description: "查询操作日志（指令下发、MQTT 连接、设备删除等系统操作记录），含命令码、执行结果与耗时。可按设备、动作、结果过滤。用于回答『最近执行过什么指令/哪些指令失败了/今天操作过哪些设备』。传 scene 可限定到某场景的设备。",
        parameters: json!({
            "type": "object",
            "properties": {
                "hours": { "type": "number", "description": "查询最近 N 小时，默认 24" },
                "limit": { "type": "number", "description": "返回条数上限，默认 30" },
                "device_id": { "type": "string", "description": "设备 ID；留空表示全矿" },
                "scene": { "type": "string", "description": "场景范围：传场景名称或 id 限定到该场景绑定的设备；传 \"all\" 或留空表示全矿。与 device_id 互斥，同时传时 device_id 优先。" },
                "action": { "type": "string", "description": "动作类型过滤；留空不过滤" },
                "result": { "type": "string", "description": "执行结果过滤，如 success/failure；留空不过滤" }
            },
            "required": []
        }),
    },
    ToolDef {
        name: "query_device_events",
        description: "查询设备事件（上线/离线/重连/故障/报警触发/配置变更等）。可按设备、类型与级别过滤。用于回答『最近有什么报警/设备掉线过吗/故障记录』。传 scene 可限定到某场景的设备。",
        parameters: json!({
            "type": "object",
            "properties": {
                "hours": { "type": "number", "description": "查询最近 N 小时，默认 24" },
                "limit": { "type": "number", "description": "返回条数上限，默认 30" },
                "device_id": { "type": "string", "description": "设备 ID；留空表示全矿" },
                "scene": { "type": "string", "description": "场景范围：传场景名称或 id 限定到该场景绑定的设备；传 \"all\" 或留空表示全矿。与 device_id 互斥，同时传时 device_id 优先。" },
                "type": { "type": "string", "description": "事件类型过滤，如 online/offline/reconnect/fault/alarm_trigger/alarm_clear/config_change/status_change；留空不过滤" },
                "level": { "type": "string", "description": "级别过滤：info/warn/error；留空不过滤" }
            },
            "required": []
        }),
    },
    ToolDef {
        name: "query_system_events",
        description: "查询系统级事件（按模块记录，与具体设备无关），用于回答『系统层面出过什么事/哪个模块报错』。该工具为模块级，不受 device_id / scene 范围限制。",
        parameters: json!({
            "type": "object",
            "properties": {
                "hours": { "type": "number", "description": "查询最近 N 小时，默认 24" },
                "limit": { "type": "number", "description": "返回条数上限，默认 30" },
                "module": { "type": "string", "description": "模块名过滤；留空不过滤" },
                "level": { "type": "string", "description": "级别过滤：info/warn/error；留空不过滤" }
            },
            "required": []
        }),
    },
    ToolDef {
        name: "query_dashboard_stats",
        description: "查询全局概览统计：事件总数、故障数、传感器上报量、平均在线率，以及故障最多的设备和在线率最低的设备。用于回答『整体运行情况怎么样/哪台设备问题最多/在线率如何』。回答宏观问题时优先用它，避免多次拉取明细。传 scene 可仅看该场景设备级明细（总量仍按全矿口径）。",
        parameters: json!({
            "type": "object",
            "properties": {
                "hours": { "type": "number", "description": "统计最近 N 小时，默认 24" },
                "step": { "type": "string", "description": "趋势聚合步长：5m/30m/1h/1d；留空用接口默认" },
                "fault_limit": { "type": "number", "description": "故障 Top N 的 N，默认 5" },
                "scene": { "type": "string", "description": "场景范围：传场景名称或 id 仅统计该场景绑定的设备明细；传 \"all\" 或留空表示全矿。与 device_id 互斥。" }
            },
            "required": []
        }),
    },
    ToolDef {
        name: "query_scenes",
        description: "列出当前运行可用的场景及其绑定的设备数量。当用户的问题需要限定到某个具体场景（如『这个巷道/廊桥/综采最近报警』）时，先调用本工具拿到场景名称/id，再在其它数据工具中传 scene 参数。",
        parameters: json!({
            "type": "object",
            "properties": {},
            "required": []
        }),
    },
    ]
}

pub async fn execute_tool(
    name: &str,
    args: &Value,
    scope: &Option<AgentScopeSerde>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let text = match name {
        "query_devices" => query_devices(&client, args, scope).await?,
        "query_sensor_history" => query_sensors(&client, args, scope).await?,
        "query_operation_logs" => query_operations(&client, args, scope).await?,
        "query_device_events" => query_device_events(&client, args, scope).await?,
        "query_system_events" => query_system_events(&client, args).await?,
        "query_dashboard_stats" => query_dashboard_stats(&client, args, scope).await?,
        "query_scenes" => match scope {
            Some(s) => render_scenes(s),
            None => "当前运行未传入场景范围信息（前端未提供场景绑定），无法列出场景。通常需在场景视图内发起对话。".to_string(),
        },
        other => return Err(format!("未知工具: {other}")),
    };
    Ok(truncate(&text, MAX_RESULT_CHARS))
}

// ── 通用请求 ──

async fn edge_get(client: &reqwest::Client, path: &str) -> Result<Value, String> {
    let resp = client
        .get(format!("{EDGE_BASE}{path}"))
        .send()
        .await
        .map_err(|e| format!("请求边缘接口失败: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {e}"))?;
    if !status.is_success() {
        return Err(format!("边缘接口 HTTP {status}: {}", truncate(&text, 300)));
    }
    serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {e}"))
}

async fn edge_post(client: &reqwest::Client, path: &str, body: Value) -> Result<Value, String> {
    let resp = client
        .post(format!("{EDGE_BASE}{path}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求边缘接口失败: {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {e}"))?;
    if !status.is_success() {
        return Err(format!("边缘接口 HTTP {status}: {}", truncate(&text, 300)));
    }
    serde_json::from_str(&text).map_err(|e| format!("解析响应失败: {e}"))
}

/// 兼容后端多种响应壳：{data|items|rows|records|logs|events|points: [...], total: N} 或纯数组
fn extract_list(v: &Value) -> (Vec<Value>, i64) {
    for key in ["data", "points", "logs", "events", "records", "items", "rows"] {
        if let Some(arr) = v[key].as_array() {
            let total = v["total"].as_i64().unwrap_or(arr.len() as i64);
            return (arr.clone(), total);
        }
    }
    if let Some(arr) = v.as_array() {
        return (arr.clone(), arr.len() as i64);
    }
    (Vec::new(), 0)
}

/// 最近 N 小时的时间窗口（边缘接口约定的本地时间字符串）
fn time_window(hours: f64) -> (String, String) {
    let to = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let from = (chrono::Local::now() - chrono::Duration::milliseconds((hours * 3600.0 * 1000.0) as i64))
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();
    (from, to)
}

fn hours_of(args: &Value) -> f64 {
    args["hours"].as_f64().unwrap_or(24.0)
}

fn limit_of(args: &Value) -> u64 {
    args["limit"].as_u64().unwrap_or(30).clamp(1, 100)
}

/// 可选字符串参数：空串/null/"all" 一律视为「不过滤」
fn opt_str<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args[key]
        .as_str()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && *s != "all")
}

// ── 作用域（scope 三级）解析 ──

/// 作用域执行计划：决定走 API 单设备过滤、客户端集合过滤，还是全矿；
/// 以及未知场景报错、拉取条数上限。
struct ScopePlan {
    /// 走边缘 API 单设备过滤（legacy 路径，保持现有语义）
    api_device_id: Option<String>,
    /// 客户端按设备集合过滤（场景多设备）
    filter_ids: Option<Vec<String>>,
    /// 未匹配到任何场景，需明确报错（不静默回退全矿）
    unknown_scene: Option<String>,
    /// 本次请求拉取条数上限（场景多设备时放大到 100 以提高命中率）
    fetch_limit: u64,
}

fn scope_plan(args: &Value, scope: &Option<AgentScopeSerde>) -> ScopePlan {
    let limit = limit_of(args);
    // 1. 显式单设备优先（保持 legacy 行为）
    if let Some(id) = opt_str(args, "device_id") {
        return ScopePlan {
            api_device_id: Some(id.to_string()),
            filter_ids: None,
            unknown_scene: None,
            fetch_limit: limit,
        };
    }
    // 2. 场景
    if let Some(scene_arg) = opt_str(args, "scene") {
        if scene_arg == "all" || scene_arg == "全矿" {
            return ScopePlan {
                api_device_id: None,
                filter_ids: None,
                unknown_scene: None,
                fetch_limit: limit,
            };
        }
        if let Some(s) = scope {
            if let Some(sc) = s
                .scenes
                .iter()
                .find(|x| x.id == scene_arg || x.name == scene_arg)
            {
                let n = sc.device_ids.len();
                return ScopePlan {
                    api_device_id: None,
                    filter_ids: Some(sc.device_ids.clone()),
                    unknown_scene: None,
                    fetch_limit: if n > 1 { 100 } else { limit },
                };
            }
        }
        return ScopePlan {
            api_device_id: None,
            filter_ids: None,
            unknown_scene: Some(scene_arg.to_string()),
            fetch_limit: limit,
        };
    }
    // 3. 默认全矿
    ScopePlan {
        api_device_id: None,
        filter_ids: None,
        unknown_scene: None,
        fetch_limit: limit,
    }
}

fn unknown_scene_message(name: &str, scope: &Option<AgentScopeSerde>) -> String {
    let mut s = format!("未在可用场景范围中找到场景『{name}』。");
    if let Some(sc) = scope {
        if !sc.scenes.is_empty() {
            let names: Vec<String> = sc
                .scenes
                .iter()
                .map(|x| format!("{}（id={}）", x.name, x.id))
                .collect();
            s.push_str(&format!("可用场景：{}。", names.join("、")));
        }
    }
    s.push_str("如需全矿数据，请传 scene=\"all\"。");
    s
}

/// 客户端按设备集合过滤行（行需含 device_id 字段）
fn filter_by_ids(data: &mut Vec<Value>, ids: &[String]) {
    data.retain(|r| {
        r.get("device_id")
            .and_then(|v| v.as_str())
            .map(|d| ids.iter().any(|i| i == d))
            .unwrap_or(false)
    });
}

fn render_scenes(scope: &AgentScopeSerde) -> String {
    if scope.scenes.is_empty() {
        return "当前没有任何场景绑定信息。".to_string();
    }
    let mut lines = vec![format!(
        "共 {} 个场景（scope 三级：全矿 / 单设备 / 场景）：",
        scope.scenes.len()
    )];
    for sc in &scope.scenes {
        let active = if Some(&sc.id) == scope.active_scene_id.as_ref() {
            "【当前所在】"
        } else {
            ""
        };
        let mode = if sc.scene_mode.is_empty() { "—" } else { &sc.scene_mode };
        lines.push(format!(
            "- {}{}（id={}，模式={}，绑定 {} 台设备）",
            active, sc.name, sc.id, mode, sc.device_ids.len()
        ));
    }
    lines.push(
        "提示：在数据工具中传 scene=\"<名称或 id>\" 可限定到该场景的设备；scene=\"all\" 或留空为全矿；device_id 限定单台。"
            .to_string(),
    );
    lines.join("\n")
}

// ── 各工具实现 ──

async fn query_devices(
    client: &reqwest::Client,
    args: &Value,
    scope: &Option<AgentScopeSerde>,
) -> Result<String, String> {
    let v = edge_get(client, "/api/devices?limit=500").await?;
    let devices = v["devices"].as_array().cloned().unwrap_or_default();

    let plan = scope_plan(args, scope);
    if let Some(ref u) = plan.unknown_scene {
        return Ok(unknown_scene_message(u, scope));
    }

    // 单设备：精确查询
    if let Some(ref id) = plan.api_device_id {
        let hit: Vec<&Value> = devices
            .iter()
            .filter(|d| d["device_id"].as_str() == Some(id))
            .collect();
        if hit.is_empty() {
            return Ok(format!("未找到设备 ID 为 {id} 的设备。"));
        }
        return Ok(format!("命中 1 台设备：\n{}", device_line(hit[0])));
    }

    // 场景多设备 / 全矿：过滤到集合
    let filtered: Vec<&Value> = if let Some(ref ids) = plan.filter_ids {
        devices
            .iter()
            .filter(|d| {
                d["device_id"]
                    .as_str()
                    .map(|dd| ids.iter().any(|i| i == dd))
                    .unwrap_or(false)
            })
            .collect()
    } else {
        devices.iter().collect()
    };
    let total = filtered.len();
    let online = filtered
        .iter()
        .filter(|d| d["online"].as_bool() == Some(true))
        .count();
    let mut lines = vec![format!(
        "共 {total} 台设备，在线 {online}，离线 {}。",
        total - online
    )];
    for d in filtered.iter().take(60) {
        lines.push(format!("- {}", device_line(d)));
    }
    if total > 60 {
        lines.push(format!("（仅列出前 60 台，共 {total} 台）"));
    }
    Ok(lines.join("\n"))
}

fn device_line(d: &Value) -> String {
    let name = d["device_name"].as_str().or(d["product_name"].as_str()).unwrap_or("-");
    format!(
        "{} | ID {} | 产品码 {} | {}",
        name,
        d["device_id"].as_str().unwrap_or("?"),
        d["product_code"].as_i64().map(|c| c.to_string()).unwrap_or("?".into()),
        if d["online"].as_bool() == Some(true) { "在线" } else { "离线" },
    )
}

/// 传感器历史：POST /api/history/sensors
async fn query_sensors(
    client: &reqwest::Client,
    args: &Value,
    scope: &Option<AgentScopeSerde>,
) -> Result<String, String> {
    let plan = scope_plan(args, scope);
    if let Some(ref u) = plan.unknown_scene {
        return Ok(unknown_scene_message(u, scope));
    }
    let (from, to) = time_window(hours_of(args));
    let mut body = json!({
        "from": from,
        "to": to,
        "limit": plan.fetch_limit,
        "offset": 0,
    });
    if let Some(ref id) = plan.api_device_id {
        body["device_id"] = json!(id);
    }
    if let Some(t) = opt_str(args, "type") {
        body["type"] = json!(t);
    }
    if let Some(agg) = opt_str(args, "agg") {
        body["agg"] = json!(agg);
    }
    if let Some(step) = opt_str(args, "step") {
        body["step"] = json!(step);
    }

    let v = edge_post(client, "/api/history/sensors", body).await?;
    let (raw, server_total) = extract_list(&v);
    let mut data = raw;
    let total = if let Some(ref ids) = plan.filter_ids {
        filter_by_ids(&mut data, ids);
        data.len() as i64
    } else {
        server_total
    };
    if data.is_empty() {
        return Ok(format!("在 {from} ~ {to} 时间范围内没有查到传感器数据（可能是设备未上报或时间范围内无数据）。"));
    }
    // 展示条数受用户 limit 约束
    let limit = limit_of(args) as usize;
    if data.len() > limit {
        data.truncate(limit);
    }

    // 统计出现的传感器类型，便于模型在不确定 type 取值时获知可选值
    let mut types: Vec<String> = Vec::new();
    for p in &data {
        if let Some(t) = p["type"].as_str() {
            if !types.contains(&t.to_string()) {
                types.push(t.to_string());
            }
        }
    }

    let mut lines = vec![format!("共匹配 {total} 条，显示前 {} 条（时间范围 {from} ~ {to}）：", data.len())];
    if !types.is_empty() {
        lines.push(format!("数据中包含的传感器类型：{}", types.join("、")));
    }
    for p in &data {
        let value = p["value"]
            .as_f64()
            .map(|x| format!("{x:.2}"))
            .or_else(|| p["value"].as_i64().map(|x| x.to_string()))
            .unwrap_or_else(|| "-".into());
        let unit = p["unit"].as_str().unwrap_or("");
        lines.push(format!(
            "- [{}] 设备 {} | 类型 {} | 值 {}{}",
            p["timestamp"].as_str().unwrap_or("?"),
            p["device_id"].as_str().unwrap_or("?"),
            p["type"].as_str().unwrap_or("?"),
            value,
            if unit.is_empty() { String::new() } else { format!(" {unit}") },
        ));
    }
    Ok(lines.join("\n"))
}

/// 操作日志：POST /api/history/operations（真实返回 { logs: [...], total }）
async fn query_operations(
    client: &reqwest::Client,
    args: &Value,
    scope: &Option<AgentScopeSerde>,
) -> Result<String, String> {
    let plan = scope_plan(args, scope);
    if let Some(ref u) = plan.unknown_scene {
        return Ok(unknown_scene_message(u, scope));
    }
    let (from, to) = time_window(hours_of(args));
    let mut body = json!({
        "from": from,
        "to": to,
        "limit": plan.fetch_limit,
        "offset": 0,
    });
    if let Some(ref id) = plan.api_device_id {
        body["device_id"] = json!(id);
    }
    if let Some(a) = opt_str(args, "action") {
        body["action"] = json!(a);
    }
    if let Some(r) = opt_str(args, "result") {
        body["result"] = json!(r);
    }

    let v = edge_post(client, "/api/history/operations", body).await?;
    let (raw, server_total) = extract_list(&v);
    let mut data = raw;
    let total = if let Some(ref ids) = plan.filter_ids {
        filter_by_ids(&mut data, ids);
        data.len() as i64
    } else {
        server_total
    };
    if data.is_empty() {
        return Ok(format!("在 {from} ~ {to} 时间范围内没有查到操作日志。"));
    }
    let limit = limit_of(args) as usize;
    if data.len() > limit {
        data.truncate(limit);
    }

    let failed = data
        .iter()
        .filter(|r| {
            r["result"]
                .as_str()
                .map(|s| !s.eq_ignore_ascii_case("success") && s != "0")
                .unwrap_or(false)
        })
        .count();

    let mut lines = vec![format!("共匹配 {total} 条操作日志，显示前 {} 条（{from} ~ {to}）：", data.len())];
    if failed > 0 {
        lines.push(format!("其中执行结果非成功的约 {failed} 条，回答时请注意标注失败项。"));
    }
    for item in &data {
        lines.push(format!(
            "- [{}] 设备 {} | 动作 {} | 命令码 {} | 结果 {} | 耗时 {}ms",
            item["timestamp"].as_str().unwrap_or("?"),
            item["device_id"].as_str().unwrap_or("-"),
            item["action"].as_str().unwrap_or("?"),
            item["command_code"].as_str().unwrap_or("-"),
            item["result"].as_str().unwrap_or("?"),
            item["duration_ms"].as_i64().map(|d| d.to_string()).unwrap_or("-".into()),
        ));
    }
    Ok(lines.join("\n"))
}

/// 设备事件：POST /api/history/events（真实返回 { events: [...], total }）
async fn query_device_events(
    client: &reqwest::Client,
    args: &Value,
    scope: &Option<AgentScopeSerde>,
) -> Result<String, String> {
    let plan = scope_plan(args, scope);
    if let Some(ref u) = plan.unknown_scene {
        return Ok(unknown_scene_message(u, scope));
    }
    let (from, to) = time_window(hours_of(args));
    let mut body = json!({
        "from": from,
        "to": to,
        "limit": plan.fetch_limit,
        "offset": 0,
    });
    if let Some(ref id) = plan.api_device_id {
        body["device_id"] = json!(id);
    }
    if let Some(t) = opt_str(args, "type") {
        body["type"] = json!(t);
    }
    if let Some(l) = opt_str(args, "level") {
        body["level"] = json!(l);
    }

    let v = edge_post(client, "/api/history/events", body).await?;
    let (raw, server_total) = extract_list(&v);
    let mut data = raw;
    let total = if let Some(ref ids) = plan.filter_ids {
        filter_by_ids(&mut data, ids);
        data.len() as i64
    } else {
        server_total
    };
    if data.is_empty() {
        return Ok(format!("在 {from} ~ {to} 时间范围内没有查到设备事件。"));
    }
    let limit = limit_of(args) as usize;
    if data.len() > limit {
        data.truncate(limit);
    }

    let mut lines = vec![format!("共匹配 {total} 条设备事件，显示前 {} 条（{from} ~ {to}）：", data.len())];
    lines.push(
        "注意：报警传感器数据当前为 2 字节位域，仅『烟雾』位有确定含义，不得据此推断具体触发源。"
            .to_string(),
    );
    for item in &data {
        lines.push(format!(
            "- [{}] 设备 {} | 类型 {} | 级别 {} | 原因 {}",
            item["timestamp"].as_str().unwrap_or("?"),
            item["device_id"].as_str().unwrap_or("?"),
            item["event_type"].as_str().unwrap_or("?"),
            item["level"].as_str().unwrap_or("-"),
            item["reason"].as_str().unwrap_or("-"),
        ));
    }
    Ok(lines.join("\n"))
}

/// 系统事件：POST /api/history/system（真实返回 { events: [...], total }）
/// 模块级，不受设备/场景范围限制。
async fn query_system_events(client: &reqwest::Client, args: &Value) -> Result<String, String> {
    let (from, to) = time_window(hours_of(args));
    let mut body = json!({
        "from": from,
        "to": to,
        "limit": limit_of(args),
        "offset": 0,
    });
    if let Some(m) = opt_str(args, "module") {
        body["module"] = json!(m);
    }
    if let Some(l) = opt_str(args, "level") {
        body["level"] = json!(l);
    }
    if let Some(t) = opt_str(args, "type") {
        body["type"] = json!(t);
    }

    let v = edge_post(client, "/api/history/system", body).await?;
    let (data, total) = extract_list(&v);
    if data.is_empty() {
        return Ok(format!("在 {from} ~ {to} 时间范围内没有查到系统事件。"));
    }
    let limit = limit_of(args) as usize;
    let data: Vec<Value> = if data.len() > limit {
        data.into_iter().take(limit).collect()
    } else {
        data
    };

    let mut lines = vec![format!("共匹配 {total} 条系统事件，显示前 {} 条（{from} ~ {to}）：", data.len())];
    for item in &data {
        lines.push(format!(
            "- [{}] 模块 {} | 类型 {} | 级别 {} | {}",
            item["timestamp"].as_str().unwrap_or("?"),
            item["module"].as_str().unwrap_or("-"),
            item["event_type"].as_str().unwrap_or("?"),
            item["level"].as_str().unwrap_or("-"),
            item["message"].as_str().unwrap_or("-"),
        ));
    }
    Ok(lines.join("\n"))
}

/// 全局概览：POST /api/history/dashboard/stats
/// 注意：GreptimeDB 未就绪时接口会以 HTTP 200 返回 { code, msg } 错误体，需单独识别。
async fn query_dashboard_stats(
    client: &reqwest::Client,
    args: &Value,
    scope: &Option<AgentScopeSerde>,
) -> Result<String, String> {
    let plan = scope_plan(args, scope);
    if let Some(ref u) = plan.unknown_scene {
        return Ok(unknown_scene_message(u, scope));
    }
    let (from, to) = time_window(hours_of(args));
    let mut body = json!({ "from": from, "to": to });
    if let Some(step) = opt_str(args, "step") {
        body["step"] = json!(step);
    }
    let fault_limit = args["fault_limit"].as_u64().unwrap_or(5).clamp(1, 20);
    body["fault_limit"] = json!(fault_limit);

    let mut v = edge_post(client, "/api/history/dashboard/stats", body).await?;
    if let Some(msg) = v["msg"].as_str() {
        if v["code"].is_number() {
            return Err(format!("统计接口返回错误：{msg}"));
        }
    }

    // 场景范围：仅对设备级明细做过滤（总量仍为全矿口径）
    let scope_note = if let Some(ref ids) = plan.filter_ids {
        if let Some(arr) = v.get_mut("fault_top").and_then(|x| x.as_array_mut()) {
            arr.retain(|x| {
                x["key"]
                    .as_str()
                    .map(|k| ids.iter().any(|i| i == k))
                    .unwrap_or(false)
            });
        }
        if let Some(arr) = v.get_mut("online_rate").and_then(|x| x.as_array_mut()) {
            arr.retain(|x| {
                x["device_id"]
                    .as_str()
                    .map(|k| ids.iter().any(|i| i == k))
                    .unwrap_or(false)
            });
        }
        if let Some(arr) = v.get_mut("sensor_volume").and_then(|x| x.as_array_mut()) {
            arr.retain(|x| {
                x["device_id"]
                    .as_str()
                    .map(|k| ids.iter().any(|i| i == k))
                    .unwrap_or(false)
            });
        }
        format!("（仅统计本场景 {} 台设备的明细；事件/故障总量仍为全矿口径）", ids.len())
    } else {
        String::new()
    };

    let s = &v["summary"];
    let mut lines = vec![format!(
        "统计区间 {from} ~ {to}：事件总数 {}，故障事件 {}，传感器上报 {} 条，平均在线率 {:.1}%。",
        s["total_events"].as_i64().unwrap_or(0),
        s["fault_events"].as_i64().unwrap_or(0),
        s["total_sensors"].as_i64().unwrap_or(0),
        s["avg_online_rate"].as_f64().unwrap_or(0.0) * 100.0,
    )];

    let fault_top: Vec<String> = v["fault_top"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .take(fault_limit as usize)
                .map(|x| format!("{}（{} 次）", x["key"].as_str().unwrap_or("?"), x["count"].as_i64().unwrap_or(0)))
                .collect()
        })
        .unwrap_or_default();
    if !fault_top.is_empty() {
        lines.push(format!("故障最多：{}。", fault_top.join("、")));
    }

    // 在线率最低的几台设备（数组已按下游顺序给出，这里取前 5 个最低）
    let mut rates: Vec<(String, f64)> = v["online_rate"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|x| (x["device_id"].as_str().unwrap_or("?").to_string(), x["rate"].as_f64().unwrap_or(0.0)))
                .collect()
        })
        .unwrap_or_default();
    rates.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    if !rates.is_empty() {
        let worst: Vec<String> = rates
            .iter()
            .take(5)
            .map(|(id, r)| format!("{id} {:.1}%", r * 100.0))
            .collect();
        lines.push(format!("在线率最低的设备：{}。", worst.join("、")));
    }

    let volumes: Vec<String> = v["sensor_volume"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .take(5)
                .map(|x| {
                    format!(
                        "{} / {} 共 {} 条",
                        x["device_id"].as_str().unwrap_or("?"),
                        x["sensor_type"].as_str().unwrap_or("?"),
                        x["count"].as_i64().unwrap_or(0)
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    if !volumes.is_empty() {
        lines.push(format!("传感器上报量前列：{}。", volumes.join("；")));
    }

    if !scope_note.is_empty() {
        lines.push(scope_note);
    }

    Ok(lines.join("\n"))
}

/// 按字符边界截断（中文 UTF-8 下按字节切片会 panic）
fn truncate(s: &str, max: usize) -> String {
    let count = s.chars().count();
    if count <= max {
        s.to_string()
    } else {
        let mut out: String = s.chars().take(max).collect();
        out.push_str("…(已截断)");
        out
    }
}
