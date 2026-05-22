use crate::application::{
    GetAllGroupsUseCase, GetGroupUseCase, SaveGroupUseCase, DeleteGroupUseCase,
    GetAllIconsUseCase, GetIconsByGroupUseCase, GetIconUseCase, SaveIconUseCase, DeleteIconUseCase,
};
use crate::domain::icons::{SystemIcon, IconGroup, IconFileType};
use crate::error::AppError;
use tauri::State;
use std::path::PathBuf;
use std::fs;
use tauri::Manager;
use base64::Engine;

const MAX_ICON_FILE_SIZE: usize = 512 * 1024;

pub struct IconsState {
    pub get_all_groups_use_case: GetAllGroupsUseCase<crate::infrastructure::SqliteIconRepository>,
    pub get_group_use_case: GetGroupUseCase<crate::infrastructure::SqliteIconRepository>,
    pub save_group_use_case: SaveGroupUseCase<crate::infrastructure::SqliteIconRepository>,
    pub delete_group_use_case: DeleteGroupUseCase<crate::infrastructure::SqliteIconRepository>,
    pub get_all_icons_use_case: GetAllIconsUseCase<crate::infrastructure::SqliteIconRepository>,
    pub get_icons_by_group_use_case: GetIconsByGroupUseCase<crate::infrastructure::SqliteIconRepository>,
    pub get_icon_use_case: GetIconUseCase<crate::infrastructure::SqliteIconRepository>,
    pub save_icon_use_case: SaveIconUseCase<crate::infrastructure::SqliteIconRepository>,
    pub delete_icon_use_case: DeleteIconUseCase<crate::infrastructure::SqliteIconRepository>,
}

fn get_icons_base_dir(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {}", e)))?;
    let icons_dir = app_data_dir.join("icons");
    fs::create_dir_all(&icons_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create icons directory: {}", e)))?;
    Ok(icons_dir)
}

#[tauri::command]
pub fn get_all_groups(state: State<'_, IconsState>) -> Result<Vec<IconGroup>, AppError> {
    state.get_all_groups_use_case.execute()
}

#[tauri::command]
pub fn get_group(state: State<'_, IconsState>, id: String) -> Result<Option<IconGroup>, AppError> {
    state.get_group_use_case.execute(&id)
}

#[tauri::command]
pub fn save_group(state: State<'_, IconsState>, group: IconGroup) -> Result<(), AppError> {
    if let Some(ref parent_id) = group.parent_id {
        let parent = state.get_group_use_case.execute(parent_id)?;
        match parent {
            None => {
                return Err(AppError::Validation("父分组不存在".to_string()));
            }
            Some(parent) => {
                if parent.parent_id.is_some() {
                    return Err(AppError::Validation("不支持多层嵌套，子分组不能再创建子分组".to_string()));
                }
            }
        }
    }
    state.save_group_use_case.execute(group)
}

#[tauri::command]
pub fn delete_group(
    app: tauri::AppHandle,
    state: State<'_, IconsState>,
    id: String,
) -> Result<(), AppError> {
    let icons_base_dir = get_icons_base_dir(&app)?;

    let all_groups = state.get_all_groups_use_case.execute()?;
    let sub_group_ids: Vec<String> = all_groups
        .iter()
        .filter(|g| g.parent_id.as_deref() == Some(id.as_str()))
        .map(|g| g.id.clone())
        .collect();

    for sub_id in &sub_group_ids {
        let sub_dir = icons_base_dir.join(&id).join(sub_id);
        if sub_dir.exists() {
            let _ = fs::remove_dir_all(&sub_dir);
        }
    }

    let group_dir = icons_base_dir.join(&id);
    if group_dir.exists() {
        let _ = fs::remove_dir_all(&group_dir);
    }
    
    state.delete_group_use_case.execute(&id)?;
    
    Ok(())
}

#[tauri::command]
pub fn get_all_icons(state: State<'_, IconsState>) -> Result<Vec<SystemIcon>, AppError> {
    state.get_all_icons_use_case.execute()
}

#[tauri::command]
pub fn get_icons_by_group(state: State<'_, IconsState>, group_id: String) -> Result<Vec<SystemIcon>, AppError> {
    state.get_icons_by_group_use_case.execute(&group_id)
}

#[tauri::command]
pub fn get_icon(state: State<'_, IconsState>, id: String) -> Result<Option<SystemIcon>, AppError> {
    state.get_icon_use_case.execute(&id)
}

#[tauri::command]
pub fn save_icon(state: State<'_, IconsState>, icon: SystemIcon) -> Result<(), AppError> {
    state.save_icon_use_case.execute(icon)
}

#[tauri::command]
pub fn delete_icon(
    app: tauri::AppHandle,
    state: State<'_, IconsState>,
    id: String,
) -> Result<(), AppError> {
    let icon = state.get_icon_use_case.execute(&id)?;
    
    state.delete_icon_use_case.execute(&id)?;
    
    if let Some(icon) = icon {
        let icons_base_dir = get_icons_base_dir(&app)?;
        let icon_file_path = icons_base_dir.join(&icon.file_path);
        if icon_file_path.exists() {
            let _ = fs::remove_file(&icon_file_path);
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn upload_icon(
    app: tauri::AppHandle,
    state: State<'_, IconsState>,
    name: Option<String>,
    description: Option<String>,
    group_id: String,
    file_data: Vec<u8>,
    file_name: String,
) -> Result<String, AppError> {
    if file_data.len() > MAX_ICON_FILE_SIZE {
        return Err(AppError::Validation(format!(
            "图标文件大小不能超过 {}KB",
            MAX_ICON_FILE_SIZE / 1024
        )));
    }

    let group_exists = state.get_group_use_case.execute(&group_id)?;
    if group_exists.is_none() {
        return Err(AppError::Validation("指定的分组不存在".to_string()));
    }

    let file_ext = file_name.split('.').last().unwrap_or("svg");
    let file_type = IconFileType::from(file_ext.to_string());
    let file_type_str: String = file_type.clone().into();
    
    let icon_id = format!("icon_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
    let save_file_name = format!("{}.{}", icon_id, file_type_str);

    let auto_name = name.unwrap_or_else(|| {
        std::path::Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("未命名图标")
            .to_string()
    });
    
    let icons_base_dir = get_icons_base_dir(&app)?;
    let group_dir = if let Some(ref parent_id) = group_exists.as_ref().unwrap().parent_id {
        icons_base_dir.join(parent_id).join(&group_id)
    } else {
        icons_base_dir.join(&group_id)
    };
    fs::create_dir_all(&group_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create icons directory: {}", e)))?;
    
    let file_path = group_dir.join(&save_file_name);
    fs::write(&file_path, &file_data)
        .map_err(|e| AppError::Internal(format!("Failed to write icon file: {}", e)))?;
    
    let relative_path = if let Some(ref parent_id) = group_exists.as_ref().unwrap().parent_id {
        format!("{}/{}/{}", parent_id, group_id, save_file_name)
    } else {
        format!("{}/{}", group_id, save_file_name)
    };
    
    let updated_at = chrono::Utc::now().timestamp();
    
    let icon = SystemIcon {
        id: icon_id.clone(),
        name: auto_name,
        description,
        file_path: relative_path,
        file_type,
        group_id,
        updated_at,
    };
    
    state.save_icon_use_case.execute(icon)?;
    
    Ok(icon_id)
}

#[tauri::command]
pub fn get_icon_file_url(app: tauri::AppHandle, file_path: String) -> Result<String, AppError> {
    let icons_base_dir = get_icons_base_dir(&app)?;
    let full_path = icons_base_dir.join(&file_path);
    
    if !full_path.exists() {
        return Err(AppError::Validation("图标文件不存在".to_string()));
    }
    
    let data = fs::read(&full_path)
        .map_err(|e| AppError::Internal(format!("Failed to read icon file: {}", e)))?;
    
    let ext = full_path.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("svg")
        .to_lowercase();
    
    let mime = match ext.as_str() {
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    };
    
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub fn get_icon_file_urls(app: tauri::AppHandle, state: State<'_, IconsState>) -> Result<std::collections::HashMap<String, String>, AppError> {
    let icons = state.get_all_icons_use_case.execute()?;
    let icons_base_dir = get_icons_base_dir(&app)?;
    let mut urls = std::collections::HashMap::new();
    
    for icon in &icons {
        let full_path = icons_base_dir.join(&icon.file_path);
        if full_path.exists() {
            if let Ok(data) = fs::read(&full_path) {
                let ext = full_path.extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("svg")
                    .to_lowercase();
                
                let mime = match ext.as_str() {
                    "svg" => "image/svg+xml",
                    "png" => "image/png",
                    "jpg" | "jpeg" => "image/jpeg",
                    "gif" => "image/gif",
                    "webp" => "image/webp",
                    _ => "application/octet-stream",
                };
                
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                urls.insert(icon.id.clone(), format!("data:{};base64,{}", mime, b64));
            }
        }
    }
    
    Ok(urls)
}
