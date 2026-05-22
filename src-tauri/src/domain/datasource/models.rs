use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DataSourceType {
    Http,
    WebSocket,
    Mqtt,
    Database,
}

impl Default for DataSourceType {
    fn default() -> Self {
        Self::Http
    }
}

impl From<String> for DataSourceType {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "websocket" => Self::WebSocket,
            "mqtt" => Self::Mqtt,
            "database" => Self::Database,
            _ => Self::Http,
        }
    }
}

impl From<DataSourceType> for String {
    fn from(t: DataSourceType) -> Self {
        match t {
            DataSourceType::Http => "http".to_string(),
            DataSourceType::WebSocket => "websocket".to_string(),
            DataSourceType::Mqtt => "mqtt".to_string(),
            DataSourceType::Database => "database".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE,
}

impl Default for HttpMethod {
    fn default() -> Self {
        Self::GET
    }
}

impl From<String> for HttpMethod {
    fn from(s: String) -> Self {
        match s.to_uppercase().as_str() {
            "POST" => Self::POST,
            "PUT" => Self::PUT,
            "DELETE" => Self::DELETE,
            _ => Self::GET,
        }
    }
}

impl From<HttpMethod> for String {
    fn from(method: HttpMethod) -> Self {
        match method {
            HttpMethod::GET => "GET".to_string(),
            HttpMethod::POST => "POST".to_string(),
            HttpMethod::PUT => "PUT".to_string(),
            HttpMethod::DELETE => "DELETE".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    GreptimeDB,
    Mysql,
    Postgresql,
    Mongodb,
    Redis,
    InfluxDB,
    ClickHouse,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GreptimeDBConnectionMode {
    Postgresql,
    Mysql,
    #[serde(rename = "http-sql")]
    HttpSql,
    #[serde(rename = "http-promql")]
    HttpPromql,
}

impl Default for GreptimeDBConnectionMode {
    fn default() -> Self {
        Self::Postgresql
    }
}

impl From<String> for GreptimeDBConnectionMode {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "mysql" => Self::Mysql,
            "http-sql" => Self::HttpSql,
            "http-promql" => Self::HttpPromql,
            _ => Self::Postgresql,
        }
    }
}

impl From<GreptimeDBConnectionMode> for String {
    fn from(m: GreptimeDBConnectionMode) -> Self {
        match m {
            GreptimeDBConnectionMode::Postgresql => "postgresql".to_string(),
            GreptimeDBConnectionMode::Mysql => "mysql".to_string(),
            GreptimeDBConnectionMode::HttpSql => "http-sql".to_string(),
            GreptimeDBConnectionMode::HttpPromql => "http-promql".to_string(),
        }
    }
}





impl Default for DatabaseType {
    fn default() -> Self {
        Self::Mysql
    }
}

impl From<String> for DatabaseType {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "greptimedb" => Self::GreptimeDB,
            "mysql" => Self::Mysql,
            "postgresql" => Self::Postgresql,
            "mongodb" => Self::Mongodb,
            "redis" => Self::Redis,
            "influxdb" => Self::InfluxDB,
            "clickhouse" => Self::ClickHouse,
            _ => Self::Mysql,
        }
    }
}

impl From<DatabaseType> for String {
    fn from(t: DatabaseType) -> Self {
        match t {
            DatabaseType::GreptimeDB => "greptimedb".to_string(),
            DatabaseType::Mysql => "mysql".to_string(),
            DatabaseType::Postgresql => "postgresql".to_string(),
            DatabaseType::Mongodb => "mongodb".to_string(),
            DatabaseType::Redis => "redis".to_string(),
            DatabaseType::InfluxDB => "influxdb".to_string(),
            DatabaseType::ClickHouse => "clickhouse".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSourceHeader {
    pub id: String,
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

impl Default for DataSourceHeader {
    fn default() -> Self {
        Self {
            id: String::new(),
            key: String::new(),
            value: String::new(),
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSourceResponseMapping {
    pub id: String,
    pub source_path: String,
    pub target_key: String,
    pub save_to_cache: bool,
}

impl Default for DataSourceResponseMapping {
    fn default() -> Self {
        Self {
            id: String::new(),
            source_path: String::new(),
            target_key: String::new(),
            save_to_cache: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseConnectionConfig {
    pub db_type: DatabaseType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connection_mode: Option<GreptimeDBConnectionMode>,
    pub host: String,
    pub port: u32,
    pub username: String,
    pub password: String,
    pub database: String,
    pub options: std::collections::HashMap<String, String>,
}

impl Default for DatabaseConnectionConfig {
    fn default() -> Self {
        Self {
            db_type: DatabaseType::Mysql,
            connection_mode: None,
            host: "localhost".to_string(),
            port: 3306,
            username: String::new(),
            password: String::new(),
            database: String::new(),
            options: std::collections::HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseTestConfig {
    pub query: String,
}

impl Default for DatabaseTestConfig {
    fn default() -> Self {
        Self {
            query: "SELECT 1".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MqttProtocol {
    Mqtt,
    Mqtts,
    Ws,
    Wss,
}

impl Default for MqttProtocol {
    fn default() -> Self {
        Self::Mqtt
    }
}

impl From<String> for MqttProtocol {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "mqtts" => Self::Mqtts,
            "ws" => Self::Ws,
            "wss" => Self::Wss,
            _ => Self::Mqtt,
        }
    }
}

impl From<MqttProtocol> for String {
    fn from(p: MqttProtocol) -> Self {
        match p {
            MqttProtocol::Mqtt => "mqtt".to_string(),
            MqttProtocol::Mqtts => "mqtts".to_string(),
            MqttProtocol::Ws => "ws".to_string(),
            MqttProtocol::Wss => "wss".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MqttVersion {
    #[serde(rename = "3.1.1")]
    V311,
    #[serde(rename = "5.0")]
    V5,
}

impl Default for MqttVersion {
    fn default() -> Self {
        Self::V311
    }
}

impl From<String> for MqttVersion {
    fn from(s: String) -> Self {
        match s.as_str() {
            "5.0" => Self::V5,
            _ => Self::V311,
        }
    }
}

impl From<MqttVersion> for String {
    fn from(v: MqttVersion) -> Self {
        match v {
            MqttVersion::V311 => "3.1.1".to_string(),
            MqttVersion::V5 => "5.0".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttConnectionConfig {
    pub protocol: MqttProtocol,
    pub host: String,
    pub port: u32,
    pub username: String,
    pub password: String,
    pub client_id: String,
    pub keep_alive: u32,
    pub clean_session: bool,
    pub version: MqttVersion,
    pub reconnect: bool,
    pub reconnect_interval: u32,
    pub reconnect_attempts: u32,
}

impl Default for MqttConnectionConfig {
    fn default() -> Self {
        Self {
            protocol: MqttProtocol::Mqtt,
            host: "localhost".to_string(),
            port: 1883,
            username: String::new(),
            password: String::new(),
            client_id: format!("edgeview_{}", &uuid::Uuid::new_v4().to_string()[..8]),
            keep_alive: 60,
            clean_session: true,
            version: MqttVersion::V311,
            reconnect: true,
            reconnect_interval: 5000,
            reconnect_attempts: 10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSocketConfig {
    pub reconnect: bool,
    pub reconnect_interval: u32,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            reconnect: true,
            reconnect_interval: 5000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSourceConnection {
    pub url: String,
    pub headers: Vec<DataSourceHeader>,
    pub timeout: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub database: Option<DatabaseConnectionConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub database_test: Option<DatabaseTestConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mqtt: Option<MqttConnectionConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub websocket: Option<WebSocketConfig>,
}

impl Default for DataSourceConnection {
    fn default() -> Self {
        Self {
            url: String::new(),
            headers: Vec::new(),
            timeout: 10000,
            database: None,
            database_test: None,
            mqtt: None,
            websocket: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestApi {
    pub id: String,
    pub name: String,
    pub path: String,
    pub method: HttpMethod,
    pub body: Option<String>,
}

impl Default for TestApi {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            path: String::new(),
            method: HttpMethod::GET,
            body: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSource {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub ds_type: DataSourceType,
    pub description: Option<String>,
    pub enabled: bool,
    pub connection: DataSourceConnection,
    pub response_mapping: Vec<DataSourceResponseMapping>,
    pub test_apis: Vec<TestApi>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Default for DataSource {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: format!("ds_{}", uuid::Uuid::new_v4().to_string().replace("-", "")),
            name: String::new(),
            ds_type: DataSourceType::Http,
            description: None,
            enabled: true,
            connection: DataSourceConnection::default(),
            response_mapping: Vec::new(),
            test_apis: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }
}
