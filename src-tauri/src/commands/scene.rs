use crate::commands::logger::LoggerState;
use crate::domain::scene::{Scene, SceneCategory};
use crate::error::AppError;
use crate::infrastructure::database::scene_repository::SceneRepository;
use crate::infrastructure::SqliteSceneRepository;
use tauri::State;

pub struct SceneState {
    pub repository: SqliteSceneRepository,
}

fn log_scene_op(logger_state: &State<'_, LoggerState>, level: &str, module: &str, message: &str) {
    if let Ok(log_dir) = logger_state.log_dir.lock() {
        let entry = crate::commands::logger::LogEntry {
            level: level.to_string(),
            module: module.to_string(),
            message: message.to_string(),
            data: None,
            timestamp: None,
        };
        let _ = crate::commands::logger::write_log(&log_dir, &entry);
    }
}

#[tauri::command]
pub fn get_all_scenes(state: State<'_, SceneState>) -> Result<Vec<Scene>, AppError> {
    state.repository.get_all_scenes()
}

#[tauri::command]
pub fn get_scene(state: State<'_, SceneState>, id: String) -> Result<Option<Scene>, AppError> {
    state.repository.get_scene_by_id(&id)
}

#[tauri::command]
pub fn get_scenes_by_category(
    state: State<'_, SceneState>,
    category_id: String,
) -> Result<Vec<Scene>, AppError> {
    state.repository.get_scenes_by_category(&category_id)
}

#[tauri::command]
pub fn create_scene(
    state: State<'_, SceneState>,
    logger_state: State<'_, LoggerState>,
    scene: Scene,
) -> Result<(), AppError> {
    log_scene_op(
        &logger_state,
        "info",
        "SceneCommand",
        &format!(
            "Creating scene: id={}, name={}, thumbnail={}",
            scene.id,
            scene.name,
            scene.thumbnail.as_ref().unwrap_or(&"None".to_string())
        ),
    );
    let result = state.repository.save_scene(&scene);
    match &result {
        Ok(()) => log_scene_op(
            &logger_state,
            "info",
            "SceneCommand",
            &format!("Scene created: id={}", scene.id),
        ),
        Err(e) => log_scene_op(
            &logger_state,
            "error",
            "SceneCommand",
            &format!("Failed to create scene: id={}, error={}", scene.id, e),
        ),
    }
    result
}

#[tauri::command]
pub fn update_scene(
    state: State<'_, SceneState>,
    logger_state: State<'_, LoggerState>,
    scene: Scene,
) -> Result<(), AppError> {
    log_scene_op(
        &logger_state,
        "info",
        "SceneCommand",
        &format!(
            "Updating scene: id={}, name={}, thumbnail={}",
            scene.id,
            scene.name,
            scene.thumbnail.as_ref().unwrap_or(&"None".to_string())
        ),
    );
    let result = state.repository.save_scene(&scene);
    match &result {
        Ok(()) => log_scene_op(
            &logger_state,
            "info",
            "SceneCommand",
            &format!("Scene updated: id={}", scene.id),
        ),
        Err(e) => log_scene_op(
            &logger_state,
            "error",
            "SceneCommand",
            &format!("Failed to update scene: id={}, error={}", scene.id, e),
        ),
    }
    result
}

#[tauri::command]
pub fn delete_scene(
    state: State<'_, SceneState>,
    logger_state: State<'_, LoggerState>,
    id: String,
) -> Result<(), AppError> {
    log_scene_op(
        &logger_state,
        "info",
        "SceneCommand",
        &format!("Deleting scene: id={}", id),
    );
    let result = state.repository.delete_scene(&id);
    match &result {
        Ok(()) => log_scene_op(
            &logger_state,
            "info",
            "SceneCommand",
            &format!("Scene deleted: id={}", id),
        ),
        Err(e) => log_scene_op(
            &logger_state,
            "error",
            "SceneCommand",
            &format!("Failed to delete scene: id={}, error={}", id, e),
        ),
    }
    result
}

#[tauri::command]
pub fn get_all_categories(state: State<'_, SceneState>) -> Result<Vec<SceneCategory>, AppError> {
    state.repository.get_all_categories()
}

#[tauri::command]
pub fn get_category(
    state: State<'_, SceneState>,
    id: String,
) -> Result<Option<SceneCategory>, AppError> {
    state.repository.get_category_by_id(&id)
}

#[tauri::command]
pub fn save_category(
    state: State<'_, SceneState>,
    category: SceneCategory,
) -> Result<(), AppError> {
    state.repository.save_category(&category)
}

#[tauri::command]
pub fn delete_category(state: State<'_, SceneState>, id: String) -> Result<(), AppError> {
    state.repository.delete_category(&id)
}
