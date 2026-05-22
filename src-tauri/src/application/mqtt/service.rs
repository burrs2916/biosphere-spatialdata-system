use crate::domain::datasource::models::{MqttConnectionConfig, MqttProtocol};
use rumqttc::{AsyncClient, Event, Incoming, MqttOptions, QoS, Transport};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttMessage {
    pub source_id: String,
    pub topic: String,
    pub payload: String,
    pub qos: u8,
    pub retain: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttConnectionState {
    pub connected: bool,
    pub client_id: String,
    pub broker: String,
    pub subscriptions: Vec<String>,
}

struct MqttConnection {
    client: AsyncClient,
    event_loop_handle: tokio::task::JoinHandle<()>,
    state: MqttConnectionState,
}

pub struct MqttService {
    connections: Arc<Mutex<HashMap<String, MqttConnection>>>,
}

impl MqttService {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn build_mqtt_options(client_id: &str, config: &MqttConnectionConfig) -> MqttOptions {
        let mut opts = match config.protocol {
            MqttProtocol::Mqtt => MqttOptions::new(client_id, &config.host, config.port as u16),
            MqttProtocol::Mqtts => {
                let mut o = MqttOptions::new(client_id, &config.host, config.port as u16);
                o.set_transport(Transport::tls_with_default_config());
                o
            }
            MqttProtocol::Ws => {
                let url = format!("ws://{}:{}", config.host, config.port);
                MqttOptions::new(client_id, &url, config.port as u16)
            }
            MqttProtocol::Wss => {
                let url = format!("wss://{}:{}", config.host, config.port);
                let mut o = MqttOptions::new(client_id, &url, config.port as u16);
                o.set_transport(Transport::tls_with_default_config());
                o
            }
        };

        if !config.username.is_empty() {
            opts.set_credentials(&config.username, &config.password);
        }
        opts.set_keep_alive(std::time::Duration::from_secs(config.keep_alive as u64));
        opts.set_clean_session(config.clean_session);

        opts
    }

    pub async fn connect(
        &self,
        source_id: &str,
        config: &MqttConnectionConfig,
        app_handle: AppHandle,
    ) -> Result<MqttConnectionState, String> {
        self.disconnect(source_id).await.ok();

        let mqttoptions = Self::build_mqtt_options(&config.client_id, config);
        let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);

        let sid = source_id.to_string();
        let connections = self.connections.clone();
        let event_loop_handle = tokio::spawn(async move {
            loop {
                match eventloop.poll().await {
                    Ok(Event::Incoming(Incoming::ConnAck(_))) => {
                        let mut conns = connections.lock().await;
                        if let Some(conn) = conns.get_mut(&sid) {
                            conn.state.connected = true;
                        }
                        let _ = app_handle.emit(
                            "mqtt-status",
                            serde_json::json!({
                                "sourceId": sid,
                                "connected": true,
                            }),
                        );
                    }
                    Ok(Event::Incoming(Incoming::Publish(publish))) => {
                        let payload = String::from_utf8_lossy(&publish.payload).to_string();
                        let msg = MqttMessage {
                            source_id: sid.clone(),
                            topic: publish.topic.clone(),
                            payload,
                            qos: publish.qos as u8,
                            retain: publish.retain,
                        };
                        let _ = app_handle.emit("mqtt-message", &msg);
                    }
                    Ok(Event::Incoming(Incoming::Disconnect)) => {
                        let mut conns = connections.lock().await;
                        if let Some(conn) = conns.get_mut(&sid) {
                            conn.state.connected = false;
                        }
                        let _ = app_handle.emit(
                            "mqtt-status",
                            serde_json::json!({
                                "sourceId": sid,
                                "connected": false,
                            }),
                        );
                        break;
                    }
                    Err(e) => {
                        let mut conns = connections.lock().await;
                        if let Some(conn) = conns.get_mut(&sid) {
                            conn.state.connected = false;
                        }
                        let _ = app_handle.emit(
                            "mqtt-status",
                            serde_json::json!({
                                "sourceId": sid,
                                "connected": false,
                                "error": format!("{:?}", e),
                            }),
                        );
                        break;
                    }
                    _ => {}
                }
            }
        });

        let state = MqttConnectionState {
            connected: false,
            client_id: config.client_id.clone(),
            broker: format!(
                "{}://{}:{}",
                String::from(config.protocol.clone()),
                config.host,
                config.port
            ),
            subscriptions: Vec::new(),
        };

        let conn = MqttConnection {
            client,
            event_loop_handle,
            state,
        };

        let mut conns = self.connections.lock().await;
        let result_state = conn.state.clone();
        conns.insert(source_id.to_string(), conn);

        Ok(result_state)
    }

    pub async fn disconnect(&self, source_id: &str) -> Result<(), String> {
        let mut conns = self.connections.lock().await;
        if let Some(conn) = conns.remove(source_id) {
            let _ = conn.client.disconnect().await;
            conn.event_loop_handle.abort();
        }
        Ok(())
    }

    pub async fn subscribe(&self, source_id: &str, topic: &str, qos: u8) -> Result<(), String> {
        let mut conns = self.connections.lock().await;
        let conn = conns.get_mut(source_id).ok_or("MQTT 未连接")?;
        let q = match qos {
            1 => QoS::AtLeastOnce,
            2 => QoS::ExactlyOnce,
            _ => QoS::AtMostOnce,
        };
        conn.client
            .subscribe(topic, q)
            .await
            .map_err(|e| e.to_string())?;
        if !conn.state.subscriptions.contains(&topic.to_string()) {
            conn.state.subscriptions.push(topic.to_string());
        }
        Ok(())
    }

    pub async fn unsubscribe(&self, source_id: &str, topic: &str) -> Result<(), String> {
        let mut conns = self.connections.lock().await;
        let conn = conns.get_mut(source_id).ok_or("MQTT 未连接")?;
        conn.client
            .unsubscribe(topic)
            .await
            .map_err(|e| e.to_string())?;
        conn.state.subscriptions.retain(|t| t != topic);
        Ok(())
    }

    pub async fn publish(
        &self,
        source_id: &str,
        topic: &str,
        payload: &str,
        qos: u8,
        retain: bool,
    ) -> Result<(), String> {
        let conns = self.connections.lock().await;
        let conn = conns.get(source_id).ok_or("MQTT 未连接")?;
        let q = match qos {
            1 => QoS::AtLeastOnce,
            2 => QoS::ExactlyOnce,
            _ => QoS::AtMostOnce,
        };
        conn.client
            .publish(topic, q, retain, payload)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_state(&self, source_id: &str) -> Result<MqttConnectionState, String> {
        let conns = self.connections.lock().await;
        let conn = conns.get(source_id).ok_or("MQTT 未连接")?;
        Ok(conn.state.clone())
    }

    pub async fn test_connection(config: &MqttConnectionConfig) -> Result<bool, String> {
        let client_id = format!("edgeview_test_{}", &uuid::Uuid::new_v4().to_string()[..8]);
        let mqttoptions = Self::build_mqtt_options(&client_id, config);
        let (_client, mut eventloop) = AsyncClient::new(mqttoptions, 5);

        let timeout = std::time::Duration::from_secs(10);
        let start = std::time::Instant::now();

        loop {
            match tokio::time::timeout(std::time::Duration::from_secs(3), eventloop.poll()).await {
                Ok(Ok(Event::Incoming(Incoming::ConnAck(_)))) => {
                    return Ok(true);
                }
                Ok(Ok(Event::Incoming(Incoming::Disconnect))) => {
                    return Err("连接被断开".to_string());
                }
                Ok(Err(e)) => {
                    return Err(format!("连接失败: {}", e));
                }
                Ok(_) => {
                    if start.elapsed() > timeout {
                        return Err("连接超时".to_string());
                    }
                }
                Err(_) => {
                    return Err("连接超时".to_string());
                }
            }
        }
    }
}
