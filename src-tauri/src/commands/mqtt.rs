use crate::application::MqttService;
use crate::domain::datasource::models::MqttConnectionConfig;
use crate::error::AppError;
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

pub struct MqttState {
    pub service: Arc<Mutex<MqttService>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttResult {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn mqtt_connect(
    app_handle: AppHandle,
    state: State<'_, MqttState>,
    source_id: String,
    config: MqttConnectionConfig,
) -> Result<MqttResult, AppError> {
    let service = state.service.lock().await;
    match service.connect(&source_id, &config, app_handle).await {
        Ok(conn_state) => Ok(MqttResult {
            success: true,
            message: format!("已连接到 {}", conn_state.broker),
            data: Some(serde_json::to_value(&conn_state).unwrap_or_default()),
        }),
        Err(e) => Ok(MqttResult {
            success: false,
            message: format!("连接失败: {}", e),
            data: None,
        }),
    }
}

#[tauri::command]
pub async fn mqtt_disconnect(
    state: State<'_, MqttState>,
    source_id: String,
) -> Result<MqttResult, AppError> {
    let service = state.service.lock().await;
    match service.disconnect(&source_id).await {
        Ok(()) => Ok(MqttResult {
            success: true,
            message: "已断开连接".to_string(),
            data: None,
        }),
        Err(e) => Ok(MqttResult {
            success: false,
            message: format!("断开失败: {}", e),
            data: None,
        }),
    }
}

#[tauri::command]
pub async fn mqtt_subscribe(
    state: State<'_, MqttState>,
    source_id: String,
    topic: String,
    qos: u8,
) -> Result<MqttResult, AppError> {
    let service = state.service.lock().await;
    match service.subscribe(&source_id, &topic, qos).await {
        Ok(()) => Ok(MqttResult {
            success: true,
            message: format!("已订阅 {}", topic),
            data: None,
        }),
        Err(e) => Ok(MqttResult {
            success: false,
            message: format!("订阅失败: {}", e),
            data: None,
        }),
    }
}

#[tauri::command]
pub async fn mqtt_unsubscribe(
    state: State<'_, MqttState>,
    source_id: String,
    topic: String,
) -> Result<MqttResult, AppError> {
    let service = state.service.lock().await;
    match service.unsubscribe(&source_id, &topic).await {
        Ok(()) => Ok(MqttResult {
            success: true,
            message: format!("已取消订阅 {}", topic),
            data: None,
        }),
        Err(e) => Ok(MqttResult {
            success: false,
            message: format!("取消订阅失败: {}", e),
            data: None,
        }),
    }
}

#[tauri::command]
pub async fn mqtt_publish(
    state: State<'_, MqttState>,
    source_id: String,
    topic: String,
    payload: String,
    qos: u8,
    retain: bool,
) -> Result<MqttResult, AppError> {
    let service = state.service.lock().await;
    match service
        .publish(&source_id, &topic, &payload, qos, retain)
        .await
    {
        Ok(()) => Ok(MqttResult {
            success: true,
            message: format!("已发布到 {}", topic),
            data: None,
        }),
        Err(e) => Ok(MqttResult {
            success: false,
            message: format!("发布失败: {}", e),
            data: None,
        }),
    }
}

#[tauri::command]
pub async fn mqtt_get_state(
    state: State<'_, MqttState>,
    source_id: String,
) -> Result<MqttResult, AppError> {
    let service = state.service.lock().await;
    match service.get_state(&source_id).await {
        Ok(conn_state) => Ok(MqttResult {
            success: true,
            message: String::new(),
            data: Some(serde_json::to_value(&conn_state).unwrap_or_default()),
        }),
        Err(e) => Ok(MqttResult {
            success: false,
            message: format!("获取状态失败: {}", e),
            data: None,
        }),
    }
}

#[tauri::command]
pub async fn mqtt_test_connection(config: MqttConnectionConfig) -> Result<MqttResult, AppError> {
    match MqttService::test_connection(&config).await {
        Ok(true) => Ok(MqttResult {
            success: true,
            message: format!("连接 {}:{} 成功", config.host, config.port),
            data: None,
        }),
        Ok(false) => Ok(MqttResult {
            success: false,
            message: "连接失败".to_string(),
            data: None,
        }),
        Err(e) => Ok(MqttResult {
            success: false,
            message: format!("连接失败: {}", e),
            data: None,
        }),
    }
}
