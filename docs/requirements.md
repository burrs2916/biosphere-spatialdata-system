# SpatialData System 需求文档

## 一、项目概述

### 1.1 项目名称
SpatialData System - 空间数据可视化大屏平台

### 1.2 项目定位
通用型空间数据可视化平台，不依赖任何特定硬件或云平台，通过插件化架构适配各种边缘设备，为用户提供开箱即用的大屏可视化解决方案。

### 1.3 目标用户
- 边缘计算运维人员
- 工业物联网监控人员
- 数据中心管理人员
- 智慧城市/园区运营人员

### 1.4 核心价值
- **零代码配置** - 通过 JSON 定义大屏布局和数据源
- **离线运行** - 本地存储，断网可展示历史数据
- **跨平台** - 支持 Windows / macOS / Linux
- **高性能** - Rust 后端，低资源占用
- **可扩展** - 插件化架构，支持自定义数据源

---

## 二、功能需求

### 2.1 核心功能模块

```
┌─────────────────────────────────────────────────────────────────┐
│                    SpatialData System                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  大屏管理    │  │  数据源管理  │  │  组件库     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  告警中心    │  │  数据查询    │  │  系统设置   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                        数据层                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   SQLite    │  │    Sled     │  │  文件存储    │             │
│  │  (持久化)    │  │  (内存缓存)  │  │  (导出)     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 功能清单

#### 2.2.1 大屏管理
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 大屏创建 | 创建新的大屏页面，设置名称、分辨率 | P0 |
| 大屏编辑 | 拖拽布局、添加/删除组件 | P0 |
| 大屏预览 | 全屏预览大屏效果 | P0 |
| 大屏保存 | 保存大屏配置到本地 | P0 |
| 大屏导出 | 导出为图片/PDF | P1 |
| 大屏模板 | 预设模板快速创建 | P2 |

#### 2.2.2 数据源管理
| 功能 | 描述 | 优先级 |
|------|------|--------|
| HTTP 数据源 | REST API 数据接入 | P0 |
| MQTT 数据源 | MQTT 实时数据订阅 | P0 |
| WebSocket 数据源 | WebSocket 实时数据 | P1 |
| 模拟数据源 | 内置模拟数据，用于演示 | P0 |
| 数据库数据源 | 直连数据库查询 | P2 |
| Modbus 数据源 | 工业协议支持 | P2 |

#### 2.2.3 可视化组件
| 组件类型 | 具体组件 | 优先级 |
|----------|----------|--------|
| 图表类 | 折线图、柱状图、饼图、散点图 | P0 |
| 指标类 | 数字指标卡、仪表盘、进度条 | P0 |
| 地图类 | 2D地图、3D地图、拓扑图 | P1 |
| 表格类 | 数据表格、排名列表 | P0 |
| 媒体类 | 图片、视频、iframe | P1 |
| 装饰类 | 边框、标题、装饰元素 | P1 |
| 交互类 | 按钮、下拉框、时间选择器 | P2 |

#### 2.2.4 告警中心
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 告警规则 | 配置阈值、条件表达式 | P0 |
| 实时告警 | 告警弹窗、声音提醒 | P0 |
| 告警历史 | 告警记录查询 | P1 |
| 告警通知 | 邮件/短信/Webhook 通知 | P2 |

#### 2.2.5 数据查询
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 历史数据查询 | 按时间范围查询历史数据 | P0 |
| 实时数据监控 | 实时数据流展示 | P0 |
| 数据导出 | 导出 CSV/JSON | P1 |
| 数据聚合 | 分钟/小时/天聚合 | P1 |

#### 2.2.6 系统设置
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 主题切换 | 深色/浅色/科技蓝等 | P0 |
| 语言切换 | 中文/英文 | P1 |
| 数据清理 | 清理历史数据 | P1 |
| 系统信息 | 版本、资源占用 | P2 |

---

## 三、技术架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         表现层 (Presentation)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    前端 (HTML/CSS/JS)                        │   │
│  │  · 大屏渲染引擎  · 组件库  · 拖拽编辑器  · 主题系统          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │ Tauri IPC
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         应用层 (Application)                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Tauri Commands                            │   │
│  │  · 大屏管理  · 数据源管理  · 告警管理  · 系统设置            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         业务层 (Business)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Dashboard    │  │ DataSource   │  │ Alert        │             │
│  │ Service      │  │ Service      │  │ Service      │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Metric       │  │ Plugin       │  │ Export       │             │
│  │ Service      │  │ Manager      │  │ Service      │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         数据层 (Data)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ SQLite       │  │ Sled         │  │ File         │             │
│  │ Repository   │  │ Cache        │  │ Storage      │             │
│  │              │  │              │  │              │             │
│  │ · 配置存储    │  │ · 实时数据    │  │ · 导出文件    │             │
│  │ · 历史数据    │  │ · 热点查询    │  │ · 备份文件    │             │
│  │ · 告警记录    │  │ · 状态缓存    │  │ · 日志文件    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         基础设施层 (Infrastructure)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ HTTP Client  │  │ MQTT Client  │  │ WebSocket    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Logger       │  │ Config       │  │ Utils        │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 技术选型

#### 3.2.1 后端技术栈 (Rust)

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 应用框架 | Tauri | 2.x | 桌面应用框架 |
| 数据库 | rusqlite | 0.31 | SQLite 持久化存储 |
| 缓存 | sled | 0.34 | 嵌入式 KV 存储 |
| 序列化 | serde / serde_json | 1.x | JSON 序列化 |
| 异步运行时 | tokio | 1.x | 异步任务调度 |
| HTTP 客户端 | reqwest | 0.12 | HTTP 请求 |
| MQTT 客户端 | rumqttc | 0.24 | MQTT 协议 |
| 日志 | tracing / tracing-subscriber | 0.1 | 日志系统 |
| 配置 | config | 0.14 | 配置管理 |
| 错误处理 | thiserror / anyhow | 1.x | 错误处理 |

#### 3.2.2 前端技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 语言 | TypeScript | 类型安全 |
| 图表库 | ECharts | 数据可视化 |
| 地图 | Leaflet / Mapbox | 地图展示 |
| 拖拽 | Sortable.js | 拖拽编辑 |
| 样式 | CSS3 / TailwindCSS | 样式系统 |

### 3.3 模块划分

```
biosphere-spatialdata-system/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                 # 程序入口
│   │   ├── lib.rs                  # 库入口
│   │   ├── commands/               # Tauri 命令
│   │   │   ├── mod.rs
│   │   │   ├── dashboard.rs        # 大屏管理命令
│   │   │   ├── datasource.rs       # 数据源命令
│   │   │   ├── alert.rs            # 告警命令
│   │   │   └── system.rs           # 系统命令
│   │   ├── services/               # 业务服务
│   │   │   ├── mod.rs
│   │   │   ├── dashboard_service.rs
│   │   │   ├── datasource_service.rs
│   │   │   ├── alert_service.rs
│   │   │   └── metric_service.rs
│   │   ├── repositories/           # 数据仓库
│   │   │   ├── mod.rs
│   │   │   ├── sqlite_repo.rs
│   │   │   └── sled_cache.rs
│   │   ├── models/                 # 数据模型
│   │   │   ├── mod.rs
│   │   │   ├── dashboard.rs
│   │   │   ├── datasource.rs
│   │   │   ├── metric.rs
│   │   │   └── alert.rs
│   │   ├── plugins/                # 数据源插件
│   │   │   ├── mod.rs
│   │   │   ├── http_plugin.rs
│   │   │   ├── mqtt_plugin.rs
│   │   │   ├── websocket_plugin.rs
│   │   │   └── mock_plugin.rs
│   │   ├── infrastructure/         # 基础设施
│   │   │   ├── mod.rs
│   │   │   ├── config.rs
│   │   │   ├── logging.rs
│   │   │   └── error.rs
│   │   └── utils/                  # 工具函数
│   │       └── mod.rs
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── src/                            # 前端代码
│   ├── index.html
│   ├── main.ts
│   ├── styles/
│   ├── components/
│   └── pages/
└── docs/
    └── requirements.md
```

---

## 四、数据库设计

### 4.1 SQLite 表结构

#### 4.1.1 大屏配置表 (dashboards)

```sql
CREATE TABLE dashboards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,
    layout JSON NOT NULL,           -- 布局配置
    components JSON NOT NULL,       -- 组件配置
    theme TEXT DEFAULT 'dark',      -- 主题
    is_active BOOLEAN DEFAULT 0,    -- 是否激活
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.2 数据源表 (data_sources)

```sql
CREATE TABLE data_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,             -- http/mqtt/websocket/mock
    config JSON NOT NULL,           -- 连接配置
    status TEXT DEFAULT 'inactive', -- active/inactive/error
    last_connected_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.3 指标数据表 (metrics)

```sql
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL,
    tags JSON,                      -- 额外标签
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES data_sources(id)
);

CREATE INDEX idx_metrics_source ON metrics(source_id);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX idx_metrics_name ON metrics(metric_name);
```

#### 4.1.4 告警规则表 (alert_rules)

```sql
CREATE TABLE alert_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_id TEXT,
    metric_name TEXT NOT NULL,
    condition TEXT NOT NULL,        -- 条件表达式
    severity TEXT DEFAULT 'warning',-- info/warning/critical
    enabled BOOLEAN DEFAULT 1,
    notify_config JSON,             -- 通知配置
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES data_sources(id)
);
```

#### 4.1.5 告警历史表 (alert_history)

```sql
CREATE TABLE alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL,
    metric_value REAL,
    message TEXT,
    severity TEXT,
    status TEXT DEFAULT 'active',   -- active/resolved/acknowledged
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
);

CREATE INDEX idx_alert_history_triggered ON alert_history(triggered_at);
```

#### 4.1.6 系统配置表 (settings)

```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Sled 缓存结构

| Key 前缀 | 用途 | 数据类型 |
|----------|------|----------|
| `metric:latest:{source_id}:{metric_name}` | 最新指标值 | JSON |
| `metric:hourly:{source_id}:{metric_name}:{hour}` | 小时聚合 | JSON |
| `state:datasource:{source_id}` | 数据源状态 | JSON |
| `state:connection:{source_id}` | 连接状态 | JSON |
| `cache:query:{hash}` | 查询缓存 | JSON |

---

## 五、接口设计

### 5.1 Tauri Commands 接口

#### 5.1.1 大屏管理

```rust
#[tauri::command]
fn create_dashboard(name: String, width: i32, height: i32) -> Result<Dashboard, String>;

#[tauri::command]
fn get_dashboard(id: String) -> Result<Dashboard, String>;

#[tauri::command]
fn list_dashboards() -> Result<Vec<Dashboard>, String>;

#[tauri::command]
fn update_dashboard(id: String, dashboard: DashboardUpdate) -> Result<Dashboard, String>;

#[tauri::command]
fn delete_dashboard(id: String) -> Result<(), String>;

#[tauri::command]
fn export_dashboard(id: String, format: String) -> Result<String, String>;
```

#### 5.1.2 数据源管理

```rust
#[tauri::command]
fn create_data_source(config: DataSourceConfig) -> Result<DataSource, String>;

#[tauri::command]
fn get_data_source(id: String) -> Result<DataSource, String>;

#[tauri::command]
fn list_data_sources() -> Result<Vec<DataSource>, String>;

#[tauri::command]
fn test_data_source(id: String) -> Result<bool, String>;

#[tauri::command]
fn delete_data_source(id: String) -> Result<(), String>;
```

#### 5.1.3 数据查询

```rust
#[tauri::command]
fn query_metrics(
    source_id: String,
    metric_name: String,
    start_time: i64,
    end_time: i64,
    interval: Option<String>
) -> Result<Vec<MetricPoint>, String>;

#[tauri::command]
fn get_latest_metrics(source_id: String) -> Result<HashMap<String, f64>, String>;

#[tauri::command]
fn subscribe_metrics(source_id: String, metric_names: Vec<String>) -> Result<(), String>;
```

#### 5.1.4 告警管理

```rust
#[tauri::command]
fn create_alert_rule(rule: AlertRule) -> Result<AlertRule, String>;

#[tauri::command]
fn list_alert_rules() -> Result<Vec<AlertRule>, String>;

#[tauri::command]
fn get_alert_history(rule_id: Option<String>, limit: i32) -> Result<Vec<AlertRecord>, String>;

#[tauri::command]
fn acknowledge_alert(alert_id: i64) -> Result<(), String>;
```

#### 5.1.5 系统设置

```rust
#[tauri::command]
fn get_settings() -> Result<Settings, String>;

#[tauri::command]
fn update_settings(settings: SettingsUpdate) -> Result<Settings, String>;

#[tauri::command]
fn get_system_info() -> Result<SystemInfo, String>;

#[tauri::command]
fn clear_cache() -> Result<(), String>;
```

---

## 六、数据模型

### 6.1 核心模型定义

```rust
pub struct Dashboard {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub width: i32,
    pub height: i32,
    pub layout: serde_json::Value,
    pub components: Vec<Component>,
    pub theme: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct Component {
    pub id: String,
    pub type: ComponentType,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub config: serde_json::Value,
    pub data_source_id: Option<String>,
}

pub enum ComponentType {
    LineChart,
    BarChart,
    PieChart,
    Gauge,
    MetricCard,
    Table,
    Map,
    Video,
    Image,
    Text,
    Iframe,
}

pub struct DataSource {
    pub id: String,
    pub name: String,
    pub type: DataSourceType,
    pub config: DataSourceConfig,
    pub status: DataSourceStatus,
    pub last_connected_at: Option<DateTime<Utc>>,
}

pub enum DataSourceType {
    Http,
    Mqtt,
    WebSocket,
    Mock,
    Database,
    Modbus,
}

pub struct DataSourceConfig {
    pub url: Option<String>,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<serde_json::Value>,
    pub interval: Option<i32>,
    pub topic: Option<String>,
    pub host: Option<String>,
    pub port: Option<i32>,
}

pub struct MetricPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
    pub tags: HashMap<String, String>,
}

pub struct AlertRule {
    pub id: String,
    pub name: String,
    pub source_id: Option<String>,
    pub metric_name: String,
    pub condition: String,
    pub severity: AlertSeverity,
    pub enabled: bool,
    pub notify_config: Option<NotifyConfig>,
}

pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}
```

---

## 七、插件系统设计

### 7.1 数据源插件接口

```rust
pub trait DataSourcePlugin: Send + Sync {
    fn name(&self) -> &str;
    fn connect(&mut self, config: &DataSourceConfig) -> Result<(), Error>;
    fn disconnect(&mut self) -> Result<(), Error>;
    fn is_connected(&self) -> bool;
    fn fetch(&self, query: &Query) -> Result<Vec<MetricPoint>, Error>;
    fn subscribe(&mut self, callback: Box<dyn Fn(MetricPoint) + Send>) -> Result<(), Error>;
}
```

### 7.2 插件注册机制

```rust
pub struct PluginRegistry {
    plugins: HashMap<String, Box<dyn DataSourcePlugin>>,
}

impl PluginRegistry {
    pub fn register(&mut self, plugin: Box<dyn DataSourcePlugin>);
    pub fn get(&self, name: &str) -> Option<&Box<dyn DataSourcePlugin>>;
    pub fn list(&self) -> Vec<&str>;
}
```

---

## 八、开发计划

### 8.1 阶段一：基础框架 (Week 1-2)

- [x] 项目初始化
- [ ] 数据库模块搭建 (SQLite + Sled)
- [ ] 基础模型定义
- [ ] Tauri Commands 框架
- [ ] 前端基础框架

### 8.2 阶段二：核心功能 (Week 3-4)

- [ ] 大屏管理功能
- [ ] 数据源管理 (HTTP + Mock)
- [ ] 基础图表组件
- [ ] 实时数据更新

### 8.3 阶段三：完善功能 (Week 5-6)

- [ ] MQTT 数据源
- [ ] 告警系统
- [ ] 主题系统
- [ ] 数据导出

### 8.4 阶段四：优化与测试 (Week 7-8)

- [ ] 性能优化
- [ ] 单元测试
- [ ] 集成测试
- [ ] 文档完善

---

## 九、非功能性需求

### 9.1 性能要求

| 指标 | 要求 |
|------|------|
| 启动时间 | < 3 秒 |
| 内存占用 | < 200 MB (空闲) |
| CPU 占用 | < 5% (空闲) |
| 数据刷新延迟 | < 100ms |
| 大屏渲染 | 60 FPS |

### 9.2 可靠性要求

- 断网自动重连
- 数据本地持久化
- 异常自动恢复
- 日志完整记录

### 9.3 安全性要求

- 敏感配置加密存储
- 数据传输加密 (HTTPS/MQTTS)
- 输入验证与过滤

### 9.4 兼容性要求

| 平台 | 版本 |
|------|------|
| Windows | 10+ |
| macOS | 10.15+ |
| Linux | Ubuntu 20.04+ |

---

## 十、附录

### 10.1 参考项目

- Grafana - 可视化平台
- ThingsBoard - IoT 平台
- DataEase - 开源 BI 工具

### 10.2 相关文档

- [Tauri 官方文档](https://tauri.app/)
- [ECharts 文档](https://echarts.apache.org/)
- [Rusqlite 文档](https://docs.rs/rusqlite/)
- [Sled 文档](https://docs.rs/sled/)
