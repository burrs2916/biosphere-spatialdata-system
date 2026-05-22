use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IconGroup {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub updated_at: i64,
}

impl Default for IconGroup {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            description: None,
            parent_id: None,
            updated_at: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum IconFileType {
    Svg,
    Png,
    Jpg,
}

impl Default for IconFileType {
    fn default() -> Self {
        Self::Svg
    }
}

impl From<String> for IconFileType {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "svg" => Self::Svg,
            "png" => Self::Png,
            "jpg" | "jpeg" => Self::Jpg,
            _ => Self::Svg,
        }
    }
}

impl From<IconFileType> for String {
    fn from(file_type: IconFileType) -> Self {
        match file_type {
            IconFileType::Svg => "svg".to_string(),
            IconFileType::Png => "png".to_string(),
            IconFileType::Jpg => "jpg".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SystemIcon {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub file_path: String,
    pub file_type: IconFileType,
    pub group_id: String,
    pub updated_at: i64,
}

impl Default for SystemIcon {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            description: None,
            file_path: String::new(),
            file_type: IconFileType::Svg,
            group_id: String::new(),
            updated_at: 0,
        }
    }
}
