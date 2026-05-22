use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AuthPreset {
    None,
    Keycloak,
    Auth0,
    Internal,
    Custom,
}

impl Default for AuthPreset {
    fn default() -> Self {
        Self::Custom
    }
}

impl From<String> for AuthPreset {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "none" => Self::None,
            "keycloak" => Self::Keycloak,
            "auth0" => Self::Auth0,
            "internal" => Self::Internal,
            _ => Self::Custom,
        }
    }
}

impl From<AuthPreset> for String {
    fn from(preset: AuthPreset) -> Self {
        match preset {
            AuthPreset::None => "none".to_string(),
            AuthPreset::Keycloak => "keycloak".to_string(),
            AuthPreset::Auth0 => "auth0".to_string(),
            AuthPreset::Internal => "internal".to_string(),
            AuthPreset::Custom => "custom".to_string(),
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
        Self::POST
    }
}

impl From<String> for HttpMethod {
    fn from(s: String) -> Self {
        match s.to_uppercase().as_str() {
            "GET" => Self::GET,
            "PUT" => Self::PUT,
            "DELETE" => Self::DELETE,
            _ => Self::POST,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseMapping {
    pub source_path: String,
    pub target_key: String,
    pub save_to_cache: bool,
    #[serde(default)]
    pub is_expiration_time: bool,
}

impl Default for ResponseMapping {
    fn default() -> Self {
        Self {
            source_path: String::new(),
            target_key: String::new(),
            save_to_cache: true,
            is_expiration_time: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiEndpoint {
    pub id: String,
    pub name: String,
    pub path: String,
    pub method: HttpMethod,
    pub response_mapping: Vec<ResponseMapping>,
    #[serde(default)]
    pub bind_to_menu: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub menu_icon: Option<String>,
    #[serde(default)]
    pub endpoint_type: Option<String>,
}

impl Default for ApiEndpoint {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: String::new(),
            path: String::new(),
            method: HttpMethod::POST,
            response_mapping: Vec::new(),
            bind_to_menu: false,
            menu_icon: None,
            endpoint_type: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeaderConfig {
    pub id: String,
    pub header_name: String,
    pub value_template: String,
    pub usage: HeaderUsage,
}

impl Default for HeaderConfig {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            header_name: String::new(),
            value_template: String::new(),
            usage: HeaderUsage::Both,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ParamLocation {
    Body,
    Query,
    FormData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HeaderUsage {
    Auth,
    Api,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UserDisplayType {
    None,
    Avatar,
    Name,
    Email,
    Tenant,
    Role,
    Custom,
}

impl Default for UserDisplayType {
    fn default() -> Self {
        Self::None
    }
}

impl From<String> for UserDisplayType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "avatar" => Self::Avatar,
            "name" => Self::Name,
            "email" => Self::Email,
            "tenant" => Self::Tenant,
            "role" => Self::Role,
            "custom" => Self::Custom,
            _ => Self::None,
        }
    }
}

impl From<UserDisplayType> for String {
    fn from(t: UserDisplayType) -> Self {
        match t {
            UserDisplayType::Avatar => "avatar".to_string(),
            UserDisplayType::Name => "name".to_string(),
            UserDisplayType::Email => "email".to_string(),
            UserDisplayType::Tenant => "tenant".to_string(),
            UserDisplayType::Role => "role".to_string(),
            UserDisplayType::Custom => "custom".to_string(),
            UserDisplayType::None => "none".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDisplayConfig {
    pub cache_key: String,
    pub display_type: UserDisplayType,
    #[serde(default)]
    pub custom_label: Option<String>,
}

impl Default for UserDisplayConfig {
    fn default() -> Self {
        Self {
            cache_key: String::new(),
            display_type: UserDisplayType::None,
            custom_label: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthParam {
    pub id: String,
    pub key: String,
    pub label: String,
    pub value: String,
    pub location: ParamLocation,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl Default for AuthParam {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            key: String::new(),
            label: String::new(),
            value: String::new(),
            location: ParamLocation::Body,
            required: false,
            description: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthConfig {
    pub enabled: bool,
    pub preset: AuthPreset,
    pub base_url: String,
    pub auth_params: Vec<AuthParam>,
    pub endpoints: Vec<ApiEndpoint>,
    pub header_config: Vec<HeaderConfig>,
    #[serde(default)]
    pub user_display_config: Vec<UserDisplayConfig>,
    pub timeout: i32,
    pub token_storage: String,
    pub token_key: String,
    pub token_header: String,
    pub token_prefix: String,
    pub refresh_enabled: bool,
    pub refresh_threshold: i32,
    pub login_redirect_path: String,
    pub login_redirect_param: String,
    pub login_auto_redirect: bool,
    pub whitelist: Vec<String>,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            preset: AuthPreset::Custom,
            base_url: String::new(),
            auth_params: Vec::new(),
            endpoints: Vec::new(),
            header_config: Vec::new(),
            user_display_config: Vec::new(),
            timeout: 10000,
            token_storage: "localStorage".to_string(),
            token_key: "auth_token".to_string(),
            token_header: "Authorization".to_string(),
            token_prefix: "Bearer ".to_string(),
            refresh_enabled: true,
            refresh_threshold: 300,
            login_redirect_path: "/login".to_string(),
            login_redirect_param: "redirect".to_string(),
            login_auto_redirect: true,
            whitelist: vec!["/login".to_string(), "/public/*".to_string()],
        }
    }
}
