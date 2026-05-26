use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SceneStatus {
    Draft,
    Published,
    Archived,
}

impl Default for SceneStatus {
    fn default() -> Self {
        Self::Draft
    }
}

impl From<String> for SceneStatus {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "published" => Self::Published,
            "archived" => Self::Archived,
            _ => Self::Draft,
        }
    }
}

impl From<SceneStatus> for String {
    fn from(s: SceneStatus) -> Self {
        match s {
            SceneStatus::Draft => "draft".to_string(),
            SceneStatus::Published => "published".to_string(),
            SceneStatus::Archived => "archived".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneCategory {
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

impl Default for SceneCategory {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: format!("cat_{}", uuid::Uuid::new_v4().to_string().replace("-", "")),
            name: String::new(),
            icon: None,
            color: None,
            sort_order: 0,
            parent_id: None,
            description: None,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: String,
    pub name: String,
    pub description: Option<String>,

    pub coordinate_system: String,
    pub camera: String,
    pub bounds: Option<String>,

    pub layers: String,
    pub bindings: String,
    pub variables: Option<String>,
    pub layout: String,

    pub editor_components: Option<String>,
    pub editor_layers: Option<String>,
    pub canvas_config: Option<String>,

    pub global_components: Option<String>,
    pub views: Option<String>,
    pub active_view_id: Option<String>,

    pub category_id: Option<String>,
    pub tags: String,
    pub thumbnail: Option<String>,

    pub status: SceneStatus,

    pub metadata: String,

    pub created_at: i64,
    pub updated_at: i64,
}

impl Default for Scene {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: format!(
                "scene_{}",
                uuid::Uuid::new_v4().to_string().replace("-", "")
            ),
            name: String::new(),
            description: None,
            coordinate_system: "EPSG:3857".to_string(),
            camera: "{}".to_string(),
            bounds: None,
            layers: "[]".to_string(),
            bindings: "[]".to_string(),
            variables: None,
            layout: "[]".to_string(),
            editor_components: None,
            editor_layers: None,
            canvas_config: None,
            global_components: None,
            views: None,
            active_view_id: None,
            category_id: None,
            tags: "[]".to_string(),
            thumbnail: None,
            status: SceneStatus::Draft,
            metadata: "{}".to_string(),
            created_at: now,
            updated_at: now,
        }
    }
}
