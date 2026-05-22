use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: String,
    pub mime_type: String,
    pub thumbnail: Option<String>,
}

fn mime_from_ext(path: &str) -> &str {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".bmp") {
        "image/bmp"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".ico") {
        "image/x-icon"
    } else if lower.ends_with(".ai") {
        "application/adobe-illustrator"
    } else if lower.ends_with(".eps") {
        "application/postscript"
    } else if lower.ends_with(".psd") {
        "image/vnd.adobe.photoshop"
    } else if lower.ends_with(".tiff") || lower.ends_with(".tif") {
        "image/tiff"
    } else if lower.ends_with(".mp4") {
        "video/mp4"
    } else if lower.ends_with(".webm") {
        "video/webm"
    } else if lower.ends_with(".ogg") {
        "video/ogg"
    } else if lower.ends_with(".mov") {
        "video/quicktime"
    } else if lower.ends_with(".avi") {
        "video/x-msvideo"
    } else {
        "application/octet-stream"
    }
}

fn get_project_root() -> Result<PathBuf, String> {
    let exe_dir = std::env::current_exe().map_err(|e| format!("Failed to get exe path: {}", e))?;
    let mut dir = exe_dir.parent().ok_or("Failed to get exe directory")?;

    while dir.parent().is_some() {
        if dir.join("package.json").exists() || dir.join("Cargo.toml").exists() {
            return Ok(dir.to_path_buf());
        }
        dir = dir.parent().unwrap();
    }

    let cwd = std::env::current_dir().map_err(|e| format!("Failed to get current dir: {}", e))?;
    Ok(cwd)
}

fn get_assets_dir(category: &str, subcategory: &str) -> Result<PathBuf, String> {
    let project_root = get_project_root()?;
    let assets_dir = project_root.join("assets").join(category).join(subcategory);
    fs::create_dir_all(&assets_dir).map_err(|e| format!("Failed to create assets dir: {}", e))?;
    Ok(assets_dir)
}

#[tauri::command]
pub fn read_file_as_data_url(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let bytes =
        fs::read(path).map_err(|e| format!("Failed to read file '{}': {}", file_path, e))?;

    let mime = mime_from_ext(&file_path);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub fn get_project_assets_dir(category: String, subcategory: String) -> Result<String, String> {
    let dir = get_assets_dir(&category, &subcategory)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_assets(category: String, subcategory: String) -> Result<Vec<AssetInfo>, String> {
    let assets_dir = get_assets_dir(&category, &subcategory)?;

    if !assets_dir.exists() {
        return Ok(vec![]);
    }

    let mut assets = Vec::new();

    let entries =
        fs::read_dir(&assets_dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let metadata =
            fs::metadata(&path).map_err(|e| format!("Failed to read metadata: {}", e))?;

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let modified = metadata
            .modified()
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y-%m-%d %H:%M:%S").to_string()
            })
            .unwrap_or_default();

        let mime_str = file_name.clone();
        let mime = mime_from_ext(&mime_str);

        let thumbnail = if mime.starts_with("image/") {
            None
        } else {
            None
        };

        assets.push(AssetInfo {
            name: file_name,
            path: path.to_string_lossy().to_string(),
            size: metadata.len(),
            modified,
            mime_type: mime.to_string(),
            thumbnail,
        });
    }

    assets.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(assets)
}

#[tauri::command]
pub fn save_asset(
    category: String,
    subcategory: String,
    file_name: String,
    data: Vec<u8>,
) -> Result<AssetInfo, String> {
    let assets_dir = get_assets_dir(&category, &subcategory)?;

    let timestamp = chrono::Utc::now().timestamp_millis();
    let unique_name = format!("{}_{}", timestamp, file_name);
    let file_path = assets_dir.join(&unique_name);

    fs::write(&file_path, &data).map_err(|e| format!("Failed to write file: {}", e))?;

    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("Failed to read metadata: {}", e))?;

    let modified = metadata
        .modified()
        .map(|t| {
            let datetime: chrono::DateTime<chrono::Local> = t.into();
            datetime.format("%Y-%m-%d %H:%M:%S").to_string()
        })
        .unwrap_or_default();

    let mime_str = unique_name.clone();
    let mime = mime_from_ext(&mime_str);

    Ok(AssetInfo {
        name: unique_name,
        path: file_path.to_string_lossy().to_string(),
        size: metadata.len(),
        modified,
        mime_type: mime.to_string(),
        thumbnail: None,
    })
}

#[tauri::command]
pub fn delete_asset(file_path: String) -> Result<bool, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))?;

    Ok(true)
}

#[tauri::command]
pub fn get_asset_thumbnail(file_path: String, max_size: u32) -> Result<String, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let mime = mime_from_ext(&file_path);

    if !mime.starts_with("image/") {
        return Err(format!("Not an image file: {}", mime));
    }

    let bytes = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    let data_url = format!("data:{};base64,{}", mime, b64);

    if max_size > 0 {
        let estimated_size = (b64.len() as f64 * 0.75) as u64;
        if estimated_size > (max_size as u64) * 1024 {
            return Ok(data_url);
        }
    }

    Ok(data_url)
}

#[tauri::command]
pub fn save_background_asset(
    _app: tauri::AppHandle,
    file_name: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let result = save_asset(
        "backgrounds".to_string(),
        "images".to_string(),
        file_name,
        data,
    )?;
    Ok(result.path)
}

#[tauri::command]
pub fn rename_asset(file_path: String, new_name: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let parent = path.parent().ok_or("Failed to get parent directory")?;

    let new_path = parent.join(&new_name);

    if new_path.exists() {
        return Err(format!("File already exists: {}", new_name));
    }

    fs::rename(&path, &new_path).map_err(|e| format!("Failed to rename file: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}
