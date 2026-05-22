use crate::error::AppError;
use crate::infrastructure::SqliteSettingsRepository;
use tauri::State;

pub struct SettingsState {
    pub repository: SqliteSettingsRepository,
}

#[tauri::command]
pub fn get_setting(state: State<'_, SettingsState>, key: String) -> Result<Option<String>, AppError> {
    state.repository.get(&key)
}

#[tauri::command]
pub fn set_setting(state: State<'_, SettingsState>, key: String, value: String) -> Result<(), AppError> {
    state.repository.set(&key, &value)
}

#[tauri::command]
pub fn delete_setting(state: State<'_, SettingsState>, key: String) -> Result<(), AppError> {
    state.repository.delete(&key)
}
