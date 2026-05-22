use crate::application::{
    DeletePresetConfigUseCase, GetConfigUseCase, GetPresetConfigUseCase, ResetConfigUseCase,
    SavePresetConfigUseCase, UpdateConfigUseCase,
};
use crate::domain::AuthConfig;
use crate::error::AppError;
use tauri::State;

pub struct AuthState {
    pub get_config_use_case: GetConfigUseCase<crate::infrastructure::SqliteAuthRepository>,
    pub update_config_use_case: UpdateConfigUseCase<crate::infrastructure::SqliteAuthRepository>,
    pub reset_config_use_case: ResetConfigUseCase<crate::infrastructure::SqliteAuthRepository>,
    pub get_preset_config_use_case:
        GetPresetConfigUseCase<crate::infrastructure::SqliteAuthRepository>,
    pub save_preset_config_use_case:
        SavePresetConfigUseCase<crate::infrastructure::SqliteAuthRepository>,
    pub delete_preset_config_use_case:
        DeletePresetConfigUseCase<crate::infrastructure::SqliteAuthRepository>,
}

#[tauri::command]
pub fn get_auth_config(state: State<'_, AuthState>) -> Result<AuthConfig, AppError> {
    state.get_config_use_case.execute()
}

#[tauri::command]
pub fn update_auth_config(state: State<'_, AuthState>, config: AuthConfig) -> Result<(), AppError> {
    state.update_config_use_case.execute(config)
}

#[tauri::command]
pub fn reset_auth_config(state: State<'_, AuthState>) -> Result<(), AppError> {
    state.reset_config_use_case.execute()
}

#[tauri::command]
pub fn get_preset_config(
    state: State<'_, AuthState>,
    preset: String,
) -> Result<Option<AuthConfig>, AppError> {
    state.get_preset_config_use_case.execute(&preset)
}

#[tauri::command]
pub fn save_preset_config(
    state: State<'_, AuthState>,
    preset: String,
    config: AuthConfig,
) -> Result<(), AppError> {
    state.save_preset_config_use_case.execute(&preset, &config)
}

#[tauri::command]
pub fn delete_preset_config(state: State<'_, AuthState>, preset: String) -> Result<(), AppError> {
    state.delete_preset_config_use_case.execute(&preset)
}
