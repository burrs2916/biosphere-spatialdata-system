use crate::domain::datasource::DataSource;
use crate::domain::datasource::models::{DatabaseConnectionConfig, DatabaseType, GreptimeDBConnectionMode};
use crate::error::AppError;
use crate::infrastructure::database::datasource_repository::DatasourceRepository;
use crate::infrastructure::SqliteDatasourceRepository;
use serde::Serialize;
use tauri::State;

pub struct DatasourceState {
    pub repository: SqliteDatasourceRepository,
}

#[derive(Serialize)]
pub struct DbResult {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
}

#[tauri::command]
pub fn get_all_datasources(state: State<'_, DatasourceState>) -> Result<Vec<DataSource>, AppError> {
    state.repository.get_all()
}

#[tauri::command]
pub fn get_datasource(state: State<'_, DatasourceState>, id: String) -> Result<Option<DataSource>, AppError> {
    state.repository.get_by_id(&id)
}

#[tauri::command]
pub fn save_datasource(state: State<'_, DatasourceState>, ds: DataSource) -> Result<(), AppError> {
    state.repository.save(&ds)
}

#[tauri::command]
pub fn delete_datasource(state: State<'_, DatasourceState>, id: String) -> Result<(), AppError> {
    state.repository.delete(&id)
}

#[tauri::command]
pub async fn db_test_connection(config: DatabaseConnectionConfig, test_query: Option<String>) -> Result<DbResult, AppError> {
    let db_type_str: String = config.db_type.clone().into();

    match config.db_type {
        DatabaseType::GreptimeDB => {
            let mode = config.connection_mode.clone().unwrap_or(GreptimeDBConnectionMode::Postgresql);
            match mode {
                GreptimeDBConnectionMode::Postgresql => {
                    let conn_str = build_postgres_connection_string(&config);
                    match test_postgres_connection(&conn_str, test_query.as_deref()).await {
                        Ok(data) => Ok(DbResult {
                            success: true,
                            message: "GreptimeDB (PostgreSQL) 连接成功".to_string(),
                            data: Some(data),
                        }),
                        Err(e) => Ok(DbResult {
                            success: false,
                            message: format!("GreptimeDB (PostgreSQL) 连接失败: {}", e),
                            data: None,
                        }),
                    }
                }
                GreptimeDBConnectionMode::Mysql => {
                    let conn_str = build_mysql_connection_string(&config);
                    match test_mysql_connection(&conn_str, test_query.as_deref()).await {
                        Ok(data) => Ok(DbResult {
                            success: true,
                            message: "GreptimeDB (MySQL) 连接成功".to_string(),
                            data: Some(data),
                        }),
                        Err(e) => Ok(DbResult {
                            success: false,
                            message: format!("GreptimeDB (MySQL) 连接失败: {}", e),
                            data: None,
                        }),
                    }
                }
                GreptimeDBConnectionMode::HttpSql => {
                    match test_greptimedb_http_sql_connection(&config, test_query.as_deref()).await {
                        Ok(data) => Ok(DbResult {
                            success: true,
                            message: "GreptimeDB (HTTP SQL) 连接成功".to_string(),
                            data: Some(data),
                        }),
                        Err(e) => Ok(DbResult {
                            success: false,
                            message: format!("GreptimeDB (HTTP SQL) 连接失败: {}", e),
                            data: None,
                        }),
                    }
                }
                GreptimeDBConnectionMode::HttpPromql => {
                    match test_greptimedb_http_promql_connection(&config, test_query.as_deref()).await {
                        Ok(data) => Ok(DbResult {
                            success: true,
                            message: "GreptimeDB (HTTP PromQL) 连接成功".to_string(),
                            data: Some(data),
                        }),
                        Err(e) => Ok(DbResult {
                            success: false,
                            message: format!("GreptimeDB (HTTP PromQL) 连接失败: {}", e),
                            data: None,
                        }),
                    }
                }
            }
        }
        DatabaseType::Postgresql => {
            let conn_str = build_postgres_connection_string(&config);
            match test_postgres_connection(&conn_str, test_query.as_deref()).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: format!("{} 连接成功", db_type_str),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("{} 连接失败: {}", db_type_str, e),
                    data: None,
                }),
            }
        }
        DatabaseType::Mysql => {
            let conn_str = build_mysql_connection_string(&config);
            match test_mysql_connection(&conn_str, test_query.as_deref()).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: format!("{} 连接成功", db_type_str),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("{} 连接失败: {}", db_type_str, e),
                    data: None,
                }),
            }
        }
        DatabaseType::ClickHouse => {
            match test_clickhouse_connection(&config).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: "ClickHouse 连接成功".to_string(),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("ClickHouse 连接失败: {}", e),
                    data: None,
                }),
            }
        }
        DatabaseType::Redis => {
            match test_redis_connection(&config).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: "Redis 连接成功".to_string(),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("Redis 连接失败: {}", e),
                    data: None,
                }),
            }
        }
        DatabaseType::Mongodb => {
            match test_mongodb_connection(&config).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: "MongoDB 连接成功".to_string(),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("MongoDB 连接失败: {}", e),
                    data: None,
                }),
            }
        }
        DatabaseType::InfluxDB => {
            match test_influxdb_connection(&config).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: "InfluxDB 连接成功".to_string(),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("InfluxDB 连接失败: {}", e),
                    data: None,
                }),
            }
        }
    }
}

#[tauri::command]
pub async fn db_execute_query(
    config: DatabaseConnectionConfig,
    query: String,
) -> Result<DbResult, AppError> {
    let db_type_str: String = config.db_type.clone().into();

    match config.db_type {
        DatabaseType::GreptimeDB => {
            let mode = config.connection_mode.clone().unwrap_or(GreptimeDBConnectionMode::Postgresql);
            match mode {
                GreptimeDBConnectionMode::Postgresql => {
                    let conn_str = build_postgres_connection_string(&config);
                    match execute_postgres_query(&conn_str, &query).await {
                        Ok(data) => Ok(DbResult {
                            success: true,
                            message: "GreptimeDB (PostgreSQL) 查询成功".to_string(),
                            data: Some(data),
                        }),
                        Err(e) => Ok(DbResult {
                            success: false,
                            message: format!("GreptimeDB (PostgreSQL) 查询失败: {}", e),
                            data: None,
                        }),
                    }
                }
                GreptimeDBConnectionMode::Mysql => {
                    let conn_str = build_mysql_connection_string(&config);
                    match execute_mysql_query(&conn_str, &query).await {
                        Ok(data) => Ok(DbResult {
                            success: true,
                            message: "GreptimeDB (MySQL) 查询成功".to_string(),
                            data: Some(data),
                        }),
                        Err(e) => Ok(DbResult {
                            success: false,
                            message: format!("GreptimeDB (MySQL) 查询失败: {}", e),
                            data: None,
                        }),
                    }
                }
                GreptimeDBConnectionMode::HttpSql => {
                    match execute_greptimedb_http_sql_query(&config, &query).await {
                        Ok(data) => Ok(DbResult {
                            success: true,
                            message: "GreptimeDB (HTTP SQL) 查询成功".to_string(),
                            data: Some(data),
                        }),
                        Err(e) => Ok(DbResult {
                            success: false,
                            message: format!("GreptimeDB (HTTP SQL) 查询失败: {}", e),
                            data: None,
                        }),
                    }
                }
                GreptimeDBConnectionMode::HttpPromql => {
                    match execute_greptimedb_http_promql_query(&config, &query).await {
                        Ok(data) => Ok(DbResult {
                            success: true,
                            message: "GreptimeDB (HTTP PromQL) 查询成功".to_string(),
                            data: Some(data),
                        }),
                        Err(e) => Ok(DbResult {
                            success: false,
                            message: format!("GreptimeDB (HTTP PromQL) 查询失败: {}", e),
                            data: None,
                        }),
                    }
                }
            }
        }
        DatabaseType::Postgresql => {
            let conn_str = build_postgres_connection_string(&config);
            match execute_postgres_query(&conn_str, &query).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: format!("{} 查询成功", db_type_str),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("{} 查询失败: {}", db_type_str, e),
                    data: None,
                }),
            }
        }
        DatabaseType::Mysql => {
            let conn_str = build_mysql_connection_string(&config);
            match execute_mysql_query(&conn_str, &query).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: format!("{} 查询成功", db_type_str),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("{} 查询失败: {}", db_type_str, e),
                    data: None,
                }),
            }
        }
        DatabaseType::ClickHouse => {
            match execute_clickhouse_query(&config, &query).await {
                Ok(data) => Ok(DbResult {
                    success: true,
                    message: "ClickHouse 查询成功".to_string(),
                    data: Some(data),
                }),
                Err(e) => Ok(DbResult {
                    success: false,
                    message: format!("ClickHouse 查询失败: {}", e),
                    data: None,
                }),
            }
        }
        DatabaseType::Redis => Ok(DbResult {
            success: false,
            message: "Redis 查询暂不支持，请使用测试连接".to_string(),
            data: None,
        }),
        DatabaseType::Mongodb => Ok(DbResult {
            success: false,
            message: "MongoDB 查询暂不支持，请使用测试连接".to_string(),
            data: None,
        }),
        DatabaseType::InfluxDB => Ok(DbResult {
            success: false,
            message: "InfluxDB 查询暂不支持，请使用测试连接".to_string(),
            data: None,
        }),
    }
}

fn build_postgres_connection_string(config: &DatabaseConnectionConfig) -> String {
    let db = if config.database.is_empty() { "public" } else { &config.database };
    let mut conn_str = if config.username.is_empty() && config.password.is_empty() {
        format!(
            "postgres://{}:{}/{}",
            config.host, config.port, db
        )
    } else if config.password.is_empty() {
        format!(
            "postgres://{}@{}:{}/{}",
            config.username, config.host, config.port, db
        )
    } else {
        format!(
            "postgres://{}:{}@{}:{}/{}",
            config.username, config.password, config.host, config.port, db
        )
    };

    let ssl_mode = config.options.get("sslmode").map(|s| s.as_str()).unwrap_or("disable");
    conn_str = format!("{}?sslmode={}", conn_str, ssl_mode);

    conn_str
}

fn build_mysql_connection_string(config: &DatabaseConnectionConfig) -> String {
    let db = if config.database.is_empty() { "public" } else { &config.database };
    let mut conn_str = if config.username.is_empty() && config.password.is_empty() {
        format!(
            "mysql://{}:{}/{}",
            config.host, config.port, db
        )
    } else if config.password.is_empty() {
        format!(
            "mysql://{}@{}:{}/{}",
            config.username, config.host, config.port, db
        )
    } else {
        format!(
            "mysql://{}:{}@{}:{}/{}",
            config.username, config.password, config.host, config.port, db
        )
    };

    let ssl_mode = config.options.get("ssl-mode").map(|s| s.as_str()).unwrap_or("DISABLED");
    conn_str = format!("{}?ssl-mode={}", conn_str, ssl_mode);

    conn_str
}

async fn test_postgres_connection(conn_str: &str, test_query: Option<&str>) -> Result<serde_json::Value, String> {
    use sqlx::postgres::PgPoolOptions;
    use sqlx::Row;

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(conn_str)
        .await
        .map_err(|e| format!("{}", e))?;

    let query = test_query.unwrap_or("SELECT 1");
    let row = sqlx::query(query)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("{}", e))?;

    let result_value: serde_json::Value = if let Ok(i) = row.try_get::<i64, _>(0) {
        serde_json::json!(i)
    } else if let Ok(i) = row.try_get::<i32, _>(0) {
        serde_json::json!(i)
    } else {
        serde_json::Value::Null
    };

    pool.close().await;

    Ok(serde_json::json!({
        "result": result_value,
        "engine": "postgresql"
    }))
}

async fn execute_postgres_query(conn_str: &str, query: &str) -> Result<serde_json::Value, String> {
    use sqlx::postgres::PgPoolOptions;

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(conn_str)
        .await
        .map_err(|e| format!("{}", e))?;

    let result = sqlx::query(query)
        .execute(&pool)
        .await
        .map_err(|e| format!("{}", e))?;

    pool.close().await;

    Ok(serde_json::json!({
        "rowsAffected": result.rows_affected(),
        "engine": "postgresql"
    }))
}

async fn test_mysql_connection(conn_str: &str, test_query: Option<&str>) -> Result<serde_json::Value, String> {
    use sqlx::mysql::MySqlPoolOptions;

    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(conn_str)
        .await
        .map_err(|e| format!("{}", e))?;

    let query = test_query.unwrap_or("SELECT 1");
    let row: (i32,) = sqlx::query_as(query)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("{}", e))?;

    pool.close().await;

    Ok(serde_json::json!({
        "result": row.0,
        "engine": "mysql"
    }))
}

async fn execute_mysql_query(conn_str: &str, query: &str) -> Result<serde_json::Value, String> {
    use sqlx::mysql::MySqlPoolOptions;

    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(conn_str)
        .await
        .map_err(|e| format!("{}", e))?;

    let result = sqlx::query(query)
        .execute(&pool)
        .await
        .map_err(|e| format!("{}", e))?;

    pool.close().await;

    Ok(serde_json::json!({
        "rowsAffected": result.rows_affected(),
        "engine": "mysql"
    }))
}

fn build_greptimedb_sql_url(config: &DatabaseConnectionConfig) -> String {
    let db = if config.database.is_empty() { "public" } else { &config.database };
    format!("http://{}:{}/v1/sql?db={}", config.host, config.port, db)
}

fn build_greptimedb_promql_url(config: &DatabaseConnectionConfig) -> String {
    let db = if config.database.is_empty() { "public" } else { &config.database };
    format!("http://{}:{}/v1/promql?db={}", config.host, config.port, db)
}

async fn test_greptimedb_http_sql_connection(config: &DatabaseConnectionConfig, test_query: Option<&str>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    if let Some(query) = test_query {
        let url = build_greptimedb_sql_url(config);
        let mut request = client.post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&[("sql", query)]);

        if !config.username.is_empty() {
            request = request.basic_auth(&config.username, Some(&config.password));
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("{}", e))?;

        if response.status().is_success() {
            let body: serde_json::Value = response.json().await.unwrap_or(serde_json::json!({}));
            Ok(serde_json::json!({
                "queryResult": body,
                "engine": "greptimedb-http-sql"
            }))
        } else {
            let status = response.status();
            let error_body = response.text().await.unwrap_or_default();
            Err(format!("HTTP {} - {}", status, error_body))
        }
    } else {
        let url = format!("http://{}:{}/v1/health", config.host, config.port);
        let response = client.get(&url)
            .send()
            .await
            .map_err(|e| format!("{}", e))?;

        if response.status().is_success() {
            let body: serde_json::Value = response.json().await.unwrap_or(serde_json::json!({}));
            Ok(serde_json::json!({
                "health": body,
                "engine": "greptimedb-http-sql"
            }))
        } else {
            Err(format!("HTTP {}", response.status()))
        }
    }
}

async fn execute_greptimedb_http_sql_query(config: &DatabaseConnectionConfig, query: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    let url = build_greptimedb_sql_url(config);
    let mut request = client.post(&url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&[("sql", query)]);

    if !config.username.is_empty() {
        request = request.basic_auth(&config.username, Some(&config.password));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("{}", e))?;

    if response.status().is_success() {
        let body: serde_json::Value = response.json().await.unwrap_or(serde_json::json!({}));
        Ok(serde_json::json!({
            "data": body,
            "engine": "greptimedb-http-sql"
        }))
    } else {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        Err(format!("HTTP {} - {}", status, error_body))
    }
}

async fn test_greptimedb_http_promql_connection(config: &DatabaseConnectionConfig, test_query: Option<&str>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    let url = build_greptimedb_promql_url(config);
    let mut request = client.get(&url);

    let now = chrono::Utc::now();
    let start = now - chrono::Duration::minutes(1);
    let end = now;
    let start_ts = start.timestamp().to_string();
    let end_ts = end.timestamp().to_string();

    let query = test_query.unwrap_or("up");
    request = request.query(&[
        ("query", query),
        ("start", &start_ts),
        ("end", &end_ts),
        ("step", "60"),
    ]);

    if !config.username.is_empty() {
        request = request.basic_auth(&config.username, Some(&config.password));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("{}", e))?;

    if response.status().is_success() {
        let body: serde_json::Value = response.json().await.unwrap_or(serde_json::json!({}));
        Ok(serde_json::json!({
            "queryResult": body,
            "engine": "greptimedb-http-promql"
        }))
    } else {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        Err(format!("HTTP {} - {}", status, error_body))
    }
}

async fn execute_greptimedb_http_promql_query(config: &DatabaseConnectionConfig, query: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    let url = build_greptimedb_promql_url(config);
    let mut request = client.get(&url);

    let now = chrono::Utc::now();
    let start = now - chrono::Duration::hours(1);
    let end = now;
    let start_ts = start.timestamp().to_string();
    let end_ts = end.timestamp().to_string();

    request = request.query(&[
        ("query", query),
        ("start", &start_ts),
        ("end", &end_ts),
        ("step", "60"),
    ]);

    if !config.username.is_empty() {
        request = request.basic_auth(&config.username, Some(&config.password));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("{}", e))?;

    if response.status().is_success() {
        let body: serde_json::Value = response.json().await.unwrap_or(serde_json::json!({}));
        Ok(serde_json::json!({
            "data": body,
            "engine": "greptimedb-http-promql"
        }))
    } else {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        Err(format!("HTTP {} - {}", status, error_body))
    }
}

async fn test_clickhouse_connection(config: &DatabaseConnectionConfig) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    let url = format!("http://{}:{}/?query=SELECT+1", config.host, config.port);

    let mut request = client.get(&url);
    if !config.username.is_empty() {
        request = request.basic_auth(&config.username, Some(&config.password));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("{}", e))?;

    if response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        Ok(serde_json::json!({
            "result": body.trim(),
            "engine": "clickhouse"
        }))
    } else {
        Err(format!("HTTP {}", response.status()))
    }
}

async fn execute_clickhouse_query(config: &DatabaseConnectionConfig, query: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    let url = format!("http://{}:{}/?query={}", config.host, config.port, urlencoding::encode(query));

    let mut request = client.get(&url);
    if !config.username.is_empty() {
        request = request.basic_auth(&config.username, Some(&config.password));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("{}", e))?;

    if response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        Ok(serde_json::json!({
            "data": body,
            "engine": "clickhouse"
        }))
    } else {
        Err(format!("HTTP {}", response.status()))
    }
}

async fn test_redis_connection(config: &DatabaseConnectionConfig) -> Result<serde_json::Value, String> {
    let addr = format!("redis://{}:{}", config.host, config.port);
    let addr = if !config.password.is_empty() {
        format!("redis://:{}@{}:{}", config.password, config.host, config.port)
    } else {
        addr
    };

    let client = redis::Client::open(addr.as_str())
        .map_err(|e| format!("Redis 客户端创建失败: {}", e))?;

    let mut conn = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| format!("{}", e))?;

    redis::cmd("PING")
        .query_async::<String>(&mut conn)
        .await
        .map_err(|e| format!("{}", e))?;

    Ok(serde_json::json!({
        "host": config.host,
        "port": config.port,
        "engine": "redis"
    }))
}

async fn test_mongodb_connection(config: &DatabaseConnectionConfig) -> Result<serde_json::Value, String> {
    let uri = if !config.username.is_empty() {
        format!(
            "mongodb://{}:{}@{}:{}/{}?directConnection=true",
            config.username, config.password, config.host, config.port, config.database
        )
    } else {
        format!(
            "mongodb://{}:{}/{}?directConnection=true",
            config.host, config.port, config.database
        )
    };

    let client = mongodb::Client::with_uri_str(&uri)
        .await
        .map_err(|e| format!("{}", e))?;

    let db = client.database(&config.database);
    db.run_command(mongodb::bson::doc! { "ping": 1 })
        .await
        .map_err(|e| format!("{}", e))?;

    Ok(serde_json::json!({
        "host": config.host,
        "port": config.port,
        "database": config.database,
        "engine": "mongodb"
    }))
}

async fn test_influxdb_connection(config: &DatabaseConnectionConfig) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    let url = format!("http://{}:{}/health", config.host, config.port);

    let mut request = client.get(&url);
    if !config.username.is_empty() {
        request = request.basic_auth(&config.username, Some(&config.password));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("{}", e))?;

    if response.status().is_success() {
        let body: serde_json::Value = response.json().await.unwrap_or(serde_json::json!({}));
        Ok(serde_json::json!({
            "health": body,
            "engine": "influxdb"
        }))
    } else {
        Err(format!("HTTP {}", response.status()))
    }
}
