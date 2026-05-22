use std::sync::Arc;
use crate::domain::component_plugin::*;
use crate::error::AppError;
use crate::infrastructure::database::Database;
use tauri::State;

pub struct ComponentPluginState {
    pub db: Arc<Database>,
}

#[tauri::command]
pub fn get_all_component_plugins(state: State<'_, ComponentPluginState>) -> Result<Vec<ComponentPlugin>, AppError> {
    ComponentPluginRepository::get_all_plugins(&state.db)
}

#[tauri::command]
pub fn get_enabled_component_plugins(state: State<'_, ComponentPluginState>) -> Result<Vec<ComponentPlugin>, AppError> {
    ComponentPluginRepository::get_enabled_plugins(&state.db)
}

#[tauri::command]
pub fn get_component_plugin_by_type(state: State<'_, ComponentPluginState>, plugin_type: String) -> Result<Option<ComponentPlugin>, AppError> {
    ComponentPluginRepository::get_plugin_by_type(&state.db, &plugin_type)
}

#[tauri::command]
pub fn create_component_plugin(state: State<'_, ComponentPluginState>, payload: CreateComponentPluginPayload) -> Result<ComponentPlugin, AppError> {
    ComponentPluginRepository::create_plugin(&state.db, &payload)
}

#[tauri::command]
pub fn update_component_plugin(state: State<'_, ComponentPluginState>, payload: UpdateComponentPluginPayload) -> Result<(), AppError> {
    ComponentPluginRepository::update_plugin(&state.db, &payload)
}

#[tauri::command]
pub fn delete_component_plugin(state: State<'_, ComponentPluginState>, id: String) -> Result<(), AppError> {
    ComponentPluginRepository::delete_plugin(&state.db, &id)
}

#[tauri::command]
pub fn toggle_component_plugin(state: State<'_, ComponentPluginState>, id: String, enabled: bool) -> Result<(), AppError> {
    ComponentPluginRepository::toggle_plugin(&state.db, &id, enabled)
}

#[tauri::command]
pub fn get_component_categories(state: State<'_, ComponentPluginState>) -> Result<Vec<ComponentCategory>, AppError> {
    ComponentPluginRepository::get_all_categories(&state.db)
}

#[tauri::command]
pub fn create_component_category(state: State<'_, ComponentPluginState>, payload: CreateCategoryPayload) -> Result<ComponentCategory, AppError> {
    ComponentPluginRepository::create_category(&state.db, &payload)
}

#[tauri::command]
pub fn update_component_category(state: State<'_, ComponentPluginState>, payload: UpdateCategoryPayload) -> Result<(), AppError> {
    ComponentPluginRepository::update_category(&state.db, &payload)
}

#[tauri::command]
pub fn delete_component_category(state: State<'_, ComponentPluginState>, id: String) -> Result<(), AppError> {
    ComponentPluginRepository::delete_category(&state.db, &id)
}

#[tauri::command]
pub fn move_plugin_to_category(state: State<'_, ComponentPluginState>, plugin_id: String, category: String) -> Result<(), AppError> {
    ComponentPluginRepository::move_plugin_to_category(&state.db, &plugin_id, &category)
}
