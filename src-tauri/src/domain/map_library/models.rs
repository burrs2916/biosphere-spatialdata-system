use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MapLibraryType {
    Cad,
    Tile,
    Blueprint,
    Globe,
    Heatmap,
}

impl Default for MapLibraryType {
    fn default() -> Self {
        Self::Cad
    }
}

impl From<String> for MapLibraryType {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "tile" => Self::Tile,
            "blueprint" => Self::Blueprint,
            "globe" => Self::Globe,
            "heatmap" => Self::Heatmap,
            _ => Self::Cad,
        }
    }
}

impl From<MapLibraryType> for String {
    fn from(t: MapLibraryType) -> Self {
        match t {
            MapLibraryType::Cad => "cad".to_string(),
            MapLibraryType::Tile => "tile".to_string(),
            MapLibraryType::Blueprint => "blueprint".to_string(),
            MapLibraryType::Globe => "globe".to_string(),
            MapLibraryType::Heatmap => "heatmap".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MapLibraryStatus {
    Draft,
    Published,
    Archived,
}

impl Default for MapLibraryStatus {
    fn default() -> Self {
        Self::Draft
    }
}

impl From<String> for MapLibraryStatus {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "published" => Self::Published,
            "archived" => Self::Archived,
            _ => Self::Draft,
        }
    }
}

impl From<MapLibraryStatus> for String {
    fn from(s: MapLibraryStatus) -> Self {
        match s {
            MapLibraryStatus::Draft => "draft".to_string(),
            MapLibraryStatus::Published => "published".to_string(),
            MapLibraryStatus::Archived => "archived".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapLibraryBounds {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapLibrary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub map_type: MapLibraryType,
    pub data_dir: Option<String>,
    pub source_file: Option<String>,
    pub source_format: Option<String>,
    pub cadbin_path: Option<String>,
    pub coordinate_system: String,
    pub target_crs: String,
    pub bounds: Option<String>,
    pub layers: Option<String>,
    pub entity_count: i32,
    pub metadata: Option<String>,
    pub thumbnail: Option<String>,
    pub group_id: Option<String>,
    pub status: MapLibraryStatus,
    pub published_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Default for MapLibrary {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp();
        let id = format!("maplib_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
        Self {
            id,
            name: String::new(),
            description: None,
            map_type: MapLibraryType::Cad,
            data_dir: None,
            source_file: None,
            source_format: None,
            cadbin_path: None,
            coordinate_system: "EPSG:4490".to_string(),
            target_crs: "EPSG:3857".to_string(),
            bounds: None,
            layers: None,
            entity_count: 0,
            metadata: None,
            thumbnail: None,
            group_id: None,
            status: MapLibraryStatus::Draft,
            published_at: None,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapLibraryGroup {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub map_type: MapLibraryType,
    pub parent_id: Option<String>,
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Default for MapLibraryGroup {
    fn default() -> Self {
        let now = chrono::Utc::now().timestamp();
        let id = format!("mlgrp_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
        Self {
            id,
            name: String::new(),
            description: None,
            map_type: MapLibraryType::Cad,
            parent_id: None,
            sort_order: 0,
            created_at: now,
            updated_at: now,
        }
    }
}
