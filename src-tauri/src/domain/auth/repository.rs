use super::models::AuthConfig;
use crate::error::AppResult;

pub trait AuthRepository: Send + Sync {
    fn get_config(&self) -> AppResult<AuthConfig>;
    fn update_config(&self, config: &AuthConfig) -> AppResult<()>;
    fn reset_config(&self) -> AppResult<()>;
    fn get_preset_config(&self, preset: &str) -> AppResult<Option<AuthConfig>>;
    fn save_preset_config(&self, preset: &str, config: &AuthConfig) -> AppResult<()>;
    fn delete_preset_config(&self, preset: &str) -> AppResult<()>;
}
