use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentCategory {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
    pub parent_id: Option<String>,
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentPlugin {
    pub id: String,
    #[serde(rename = "type")]
    pub plugin_type: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub category: String,
    pub default_size: String,
    pub default_config: String,
    pub capabilities: String,
    pub config_schema: String,
    pub events: String,
    pub actions: String,
    pub data_schema: Option<String>,
    pub renderer_entry: Option<String>,
    pub renderer_format: String,
    pub dependencies: String,
    pub permissions: String,
    pub author: Option<String>,
    pub homepage: Option<String>,
    pub thumbnail: Option<String>,
    pub built_in: bool,
    pub enabled: bool,
    pub installed_at: i64,
    pub updated_at: i64,
}

impl Default for ComponentPlugin {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: format!("cp_{}", uuid::Uuid::new_v4().to_string().replace("-", "")),
            plugin_type: String::new(),
            name: String::new(),
            version: "1.0.0".to_string(),
            description: None,
            icon: None,
            category: "custom".to_string(),
            default_size: "{}".to_string(),
            default_config: "{}".to_string(),
            capabilities: "{}".to_string(),
            config_schema: "[]".to_string(),
            events: "[]".to_string(),
            actions: "[]".to_string(),
            data_schema: None,
            renderer_entry: None,
            renderer_format: "module".to_string(),
            dependencies: "[]".to_string(),
            permissions: "[]".to_string(),
            author: None,
            homepage: None,
            thumbnail: None,
            built_in: false,
            enabled: true,
            installed_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateComponentPluginPayload {
    pub plugin_type: String,
    pub name: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub category: Option<String>,
    pub default_size: Option<String>,
    pub default_config: Option<String>,
    pub capabilities: Option<String>,
    pub config_schema: Option<String>,
    pub events: Option<String>,
    pub actions: Option<String>,
    pub data_schema: Option<String>,
    pub renderer_entry: Option<String>,
    pub renderer_format: Option<String>,
    pub dependencies: Option<String>,
    pub permissions: Option<String>,
    pub author: Option<String>,
    pub homepage: Option<String>,
    pub thumbnail: Option<String>,
    pub built_in: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateComponentPluginPayload {
    pub id: String,
    pub name: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub category: Option<String>,
    pub default_size: Option<String>,
    pub default_config: Option<String>,
    pub capabilities: Option<String>,
    pub config_schema: Option<String>,
    pub events: Option<String>,
    pub actions: Option<String>,
    pub data_schema: Option<String>,
    pub renderer_entry: Option<String>,
    pub renderer_format: Option<String>,
    pub dependencies: Option<String>,
    pub permissions: Option<String>,
    pub author: Option<String>,
    pub homepage: Option<String>,
    pub thumbnail: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryPayload {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
    pub parent_id: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryPayload {
    pub id: String,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
    pub parent_id: Option<String>,
    pub description: Option<String>,
}
