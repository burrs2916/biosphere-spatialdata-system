use crate::domain::map_library::{MapLibrary, MapLibraryGroup, MapLibraryType, MapLibraryStatus};
use crate::domain::cad::{CadDocument, CadEntity, CadPoint, CadLayer};
use crate::error::AppError;
use crate::infrastructure::database::map_library_repository::{MapLibraryRepository, MapLibraryGroupRepository};
use crate::infrastructure::SqliteMapLibraryRepository;
use crate::commands::cad::parse_cad_from_bytes_sync;
use tauri::State;
use tauri::Manager;
use std::path::Path;

pub struct MapLibraryState {
    pub repository: SqliteMapLibraryRepository,
}

fn resolve_data_dir(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let data_dir = if cfg!(debug_assertions) {
        let project_root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or(Path::new("."));
        project_root.join("data")
    } else {
        app_data_dir
    };
    Ok(data_dir)
}

#[tauri::command]
pub fn get_all_map_libraries(state: State<'_, MapLibraryState>) -> Result<Vec<MapLibrary>, AppError> {
    state.repository.get_all()
}

#[tauri::command]
pub fn get_map_library(state: State<'_, MapLibraryState>, id: String) -> Result<Option<MapLibrary>, AppError> {
    state.repository.get_by_id(&id)
}

#[tauri::command]
pub fn get_map_libraries_by_type(
    state: State<'_, MapLibraryState>,
    map_type: String,
) -> Result<Vec<MapLibrary>, AppError> {
    let mt = MapLibraryType::from(map_type);
    state.repository.get_by_type(&mt)
}

#[tauri::command]
pub fn get_published_map_libraries(state: State<'_, MapLibraryState>) -> Result<Vec<MapLibrary>, AppError> {
    state.repository.get_published()
}

#[tauri::command]
pub fn get_published_map_libraries_by_type(
    state: State<'_, MapLibraryState>,
    map_type: String,
) -> Result<Vec<MapLibrary>, AppError> {
    let mt = MapLibraryType::from(map_type);
    state.repository.get_published_by_type(&mt)
}

#[tauri::command]
pub fn save_map_library(
    state: State<'_, MapLibraryState>,
    library: MapLibrary,
) -> Result<(), AppError> {
    state.repository.save(&library)
}

#[tauri::command]
pub fn delete_map_library(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<(), AppError> {
    if let Some(lib) = state.repository.get_by_id(&id)? {
        if let Some(ref data_dir_rel) = lib.data_dir {
            let data_dir = resolve_data_dir(&app_handle)
                .map_err(|e| AppError::Internal(e))?;
            let lib_dir = data_dir.join(data_dir_rel);
            if lib_dir.exists() {
                let _ = std::fs::remove_dir_all(lib_dir);
            }
        }
    }
    state.repository.delete(&id)
}

fn compute_bounds_and_layers(doc: &CadDocument) -> (Option<String>, Option<String>, i32) {
    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;
    let mut entity_count_per_layer: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut count = 0i32;

    for entity in &doc.entities {
        count += 1;
        let (layer, xs_ys): (String, Vec<(f64, f64)>) = match entity {
            CadEntity::Line { layer, start, end, .. } => (layer.clone(), vec![(start.x, start.y), (end.x, end.y)]),
            CadEntity::Circle { layer, center, .. } => (layer.clone(), vec![(center.x, center.y)]),
            CadEntity::Arc { layer, center, .. } => (layer.clone(), vec![(center.x, center.y)]),
            CadEntity::Ellipse { layer, center, .. } => (layer.clone(), vec![(center.x, center.y)]),
            CadEntity::Polyline { layer, vertices, .. } => (layer.clone(), vertices.iter().map(|v| (v.x, v.y)).collect()),
            CadEntity::LwPolyline { layer, vertices, .. } => (layer.clone(), vertices.iter().map(|v| (v.x, v.y)).collect()),
            CadEntity::Spline { layer, control_points, fit_points, .. } => {
                let mut pts: Vec<(f64, f64)> = control_points.iter().map(|p| (p.x, p.y)).collect();
                pts.extend(fit_points.iter().map(|p| (p.x, p.y)));
                (layer.clone(), pts)
            }
            CadEntity::Text { layer, position, .. } | CadEntity::MText { layer, position, .. } => (layer.clone(), vec![(position.x, position.y)]),
            CadEntity::Point { layer, position, .. } => (layer.clone(), vec![(position.x, position.y)]),
            CadEntity::Insert { layer, position, .. } => (layer.clone(), vec![(position.x, position.y)]),
            CadEntity::Solid { layer, points, .. } => (layer.clone(), points.iter().map(|p| (p.x, p.y)).collect()),
            CadEntity::Hatch { layer, boundaries, .. } => {
                let mut pts = Vec::new();
                for path in boundaries { for v in path { pts.push((v.x, v.y)); } }
                (layer.clone(), pts)
            }
            CadEntity::Dimension { layer, definition_point, text_midpoint, .. } => {
                (layer.clone(), vec![(definition_point.x, definition_point.y), (text_midpoint.x, text_midpoint.y)])
            }
            CadEntity::Leader { layer, vertices, .. } => (layer.clone(), vertices.iter().map(|v| (v.x, v.y)).collect()),
            CadEntity::AttributeEntity { layer, position, .. } => (layer.clone(), vec![(position.x, position.y)]),
            CadEntity::Face3D { layer, points, .. } => (layer.clone(), points.iter().map(|p| (p.x, p.y)).collect()),
            CadEntity::Polyline2D { layer, vertices, .. } => (layer.clone(), vertices.iter().map(|v| (v.x, v.y)).collect()),
            CadEntity::Table { layer, position, .. } => (layer.clone(), vec![(position.x, position.y)]),
        };
        *entity_count_per_layer.entry(layer).or_insert(0) += 1;
        for (x, y) in xs_ys {
            if x < min_x { min_x = x; }
            if x > max_x { max_x = x; }
            if y < min_y { min_y = y; }
            if y > max_y { max_y = y; }
        }
    }

    let bounds = if min_x <= max_x && min_y <= max_y {
        Some(serde_json::to_string(&crate::domain::map_library::MapLibraryBounds { min_x, min_y, max_x, max_y }).unwrap_or_else(|_| "{}".to_string()))
    } else {
        None
    };

    let mut layer_infos: Vec<serde_json::Value> = doc.layers.iter().map(|l| {
        let ec = entity_count_per_layer.get(&l.name).copied().unwrap_or(0);
        serde_json::json!({
            "name": l.name,
            "entityCount": ec,
            "visible": l.visible,
            "locked": l.locked,
        })
    }).collect();
    layer_infos.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    let layers_json = serde_json::to_string(&layer_infos).unwrap_or_else(|_| "[]".to_string());

    (bounds, Some(layers_json), count)
}

fn persist_cad_library(
    state: &State<'_, MapLibraryState>,
    app_handle: &tauri::AppHandle,
    doc: CadDocument,
    file_name: String,
    name: String,
    target_crs: Option<String>,
    source_bytes: Option<&[u8]>,
) -> Result<MapLibrary, AppError> {
    let data_dir = resolve_data_dir(app_handle)
        .map_err(|e| AppError::Internal(e))?;

    let lib_id = format!("maplib_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
    let data_dir_rel = format!("map_libraries/{}", lib_id);

    let lib_dir = data_dir.join(&data_dir_rel);
    std::fs::create_dir_all(&lib_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create library dir: {}", e)))?;

    let source_ext = file_name.rsplit('.').next().unwrap_or("dwg").to_lowercase();
    if let Some(bytes) = source_bytes {
        let source_dest = lib_dir.join(format!("source.{}", source_ext));
        std::fs::write(&source_dest, bytes)
            .map_err(|e| AppError::Internal(format!("Failed to save source file: {}", e)))?;
    }

    let cadbin_data = crate::cad_runtime::cadbin_writer::CadbinWriter::write_to_bytes(&doc);
    let cadbin_rel = format!("map_libraries/{}/data.cadbin", lib_id);
    let cadbin_full_path = data_dir.join(&cadbin_rel);
    std::fs::write(&cadbin_full_path, &cadbin_data)
        .map_err(|e| AppError::Internal(format!("Failed to write cadbin: {}", e)))?;

    let doc_json_path = lib_dir.join("doc.json");
    let doc_json = serde_json::to_string(&doc)
        .map_err(|e| AppError::Internal(format!("Failed to serialize doc.json: {}", e)))?;
    std::fs::write(&doc_json_path, doc_json.as_bytes())
        .map_err(|e| AppError::Internal(format!("Failed to write doc.json: {}", e)))?;

    let (bounds_json, layers_json, entity_count) = compute_bounds_and_layers(&doc);

    let now = chrono::Utc::now().timestamp();

    let library = MapLibrary {
        id: lib_id,
        name,
        description: Some(format!("Imported from {}", file_name)),
        map_type: MapLibraryType::Cad,
        data_dir: Some(data_dir_rel),
        source_file: Some(file_name),
        source_format: Some(source_ext),
        cadbin_path: Some(cadbin_rel),
        coordinate_system: "local".to_string(),
        target_crs: target_crs.unwrap_or_else(|| "local".to_string()),
        bounds: bounds_json,
        layers: layers_json,
        entity_count,
        metadata: None,
        thumbnail: None,
        group_id: None,
        status: MapLibraryStatus::Draft,
        published_at: None,
        created_at: now,
        updated_at: now,
    };

    state.repository.save(&library)?;
    Ok(library)
}

#[tauri::command]
pub fn import_cad_to_map_library(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    data: Vec<u8>,
    file_name: String,
    name: String,
    target_crs: Option<String>,
) -> Result<MapLibrary, AppError> {
    let parse_result = parse_cad_from_bytes_sync(data.clone(), file_name.clone());

    if !parse_result.success {
        return Err(AppError::Domain(parse_result.error.unwrap_or_else(|| "Parse failed".to_string())));
    }

    let doc = parse_result.document
        .ok_or_else(|| AppError::Domain("No document after parse".to_string()))?;

    persist_cad_library(&state, &app_handle, doc, file_name, name, target_crs, Some(&data))
}

#[tauri::command]
pub fn import_cad_file_to_map_library(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    file_path: String,
    name: String,
    target_crs: Option<String>,
) -> Result<MapLibrary, AppError> {
    let path = Path::new(&file_path);
    let file_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let data = std::fs::read(path)
        .map_err(|e| AppError::Internal(format!("Failed to read file: {}", e)))?;

    import_cad_to_map_library(state, app_handle, data, file_name, name, target_crs)
}

#[tauri::command]
pub fn import_cad_doc_to_map_library(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    doc: CadDocument,
    file_name: String,
    name: String,
    target_crs: Option<String>,
    source_bytes: Option<Vec<u8>>,
) -> Result<MapLibrary, AppError> {
    persist_cad_library(
        &state,
        &app_handle,
        doc,
        file_name,
        name,
        target_crs,
        source_bytes.as_deref(),
    )
}

#[tauri::command]
pub fn create_tile_map_library(
    state: State<'_, MapLibraryState>,
    name: String,
    description: Option<String>,
    tile_url: String,
    tile_type: Option<String>,
    min_zoom: Option<i32>,
    max_zoom: Option<i32>,
    coordinate_system: Option<String>,
    api_key: Option<String>,
) -> Result<MapLibrary, AppError> {
    let now = chrono::Utc::now().timestamp();
    let lib_id = format!("maplib_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

    let tile_config = serde_json::json!({
        "tileUrl": tile_url,
        "tileType": tile_type.unwrap_or_else(|| "xyz".to_string()),
        "minZoom": min_zoom.unwrap_or(0),
        "maxZoom": max_zoom.unwrap_or(18),
        "apiKey": api_key.unwrap_or_default(),
    });

    let library = MapLibrary {
        id: lib_id,
        name,
        description,
        map_type: MapLibraryType::Tile,
        data_dir: None,
        source_file: None,
        source_format: Some("tile".to_string()),
        cadbin_path: None,
        coordinate_system: coordinate_system.unwrap_or_else(|| "EPSG:3857".to_string()),
        target_crs: "EPSG:3857".to_string(),
        bounds: None,
        layers: None,
        entity_count: 0,
        metadata: Some(tile_config.to_string()),
        thumbnail: None,
        group_id: None,
        status: MapLibraryStatus::Draft,
        published_at: None,
        created_at: now,
        updated_at: now,
    };

    state.repository.save(&library)?;
    Ok(library)
}

#[tauri::command]
pub fn create_blueprint_map_library(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    name: String,
    description: Option<String>,
    image_path: String,
    bounds: String,
    coordinate_system: Option<String>,
) -> Result<MapLibrary, AppError> {
    let src_path = Path::new(&image_path);
    let image_name = src_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("image.png")
        .to_string();

    let image_data = std::fs::read(src_path)
        .map_err(|e| AppError::Internal(format!("Failed to read image file: {}", e)))?;

    let now = chrono::Utc::now().timestamp();
    let lib_id = format!("maplib_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
    let data_dir_rel = format!("map_libraries/{}", lib_id);

    let data_dir = resolve_data_dir(&app_handle)
        .map_err(|e| AppError::Internal(e))?;
    let lib_dir = data_dir.join(&data_dir_rel);
    std::fs::create_dir_all(&lib_dir).map_err(|e| AppError::Internal(format!("Failed to create library dir: {}", e)))?;

    let image_ext = image_name.rsplit('.').next().unwrap_or("png").to_lowercase();
    let image_dest = lib_dir.join(format!("image.{}", image_ext));
    std::fs::write(&image_dest, &image_data).map_err(|e| AppError::Internal(format!("Failed to save image: {}", e)))?;

    let image_rel = format!("map_libraries/{}/image.{}", lib_id, image_ext);

    let image_config = serde_json::json!({
        "imagePath": image_rel,
        "imageName": image_name,
    });

    let library = MapLibrary {
        id: lib_id,
        name,
        description,
        map_type: MapLibraryType::Blueprint,
        data_dir: Some(data_dir_rel),
        source_file: Some(image_name),
        source_format: Some(image_ext),
        cadbin_path: None,
        coordinate_system: coordinate_system.unwrap_or_else(|| "EPSG:3857".to_string()),
        target_crs: "EPSG:3857".to_string(),
        bounds: Some(bounds),
        layers: None,
        entity_count: 0,
        metadata: Some(image_config.to_string()),
        thumbnail: None,
        group_id: None,
        status: MapLibraryStatus::Draft,
        published_at: None,
        created_at: now,
        updated_at: now,
    };

    state.repository.save(&library)?;
    Ok(library)
}

#[tauri::command]
pub fn publish_map_library(
    state: State<'_, MapLibraryState>,
    id: String,
) -> Result<MapLibrary, AppError> {
    let mut library = state.repository.get_by_id(&id)?
        .ok_or_else(|| AppError::NotFound(format!("Map library not found: {}", id)))?;

    let now = chrono::Utc::now().timestamp();
    library.status = MapLibraryStatus::Published;
    library.published_at = Some(now);
    library.updated_at = now;

    state.repository.save(&library)?;
    Ok(library)
}

#[tauri::command]
pub fn unpublish_map_library(
    state: State<'_, MapLibraryState>,
    id: String,
) -> Result<MapLibrary, AppError> {
    let mut library = state.repository.get_by_id(&id)?
        .ok_or_else(|| AppError::NotFound(format!("Map library not found: {}", id)))?;

    library.status = MapLibraryStatus::Draft;
    library.published_at = None;
    library.updated_at = chrono::Utc::now().timestamp();

    state.repository.save(&library)?;
    Ok(library)
}

#[tauri::command]
pub fn read_map_library_cadbin(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<Vec<u8>, AppError> {
    let library = state.repository.get_by_id(&id)?
        .ok_or_else(|| AppError::NotFound(format!("Map library not found: {}", id)))?;

    let cadbin_rel = library.cadbin_path
        .ok_or_else(|| AppError::Domain("No cadbin file for this library".to_string()))?;

    let data_dir = resolve_data_dir(&app_handle)
        .map_err(|e| AppError::Internal(e))?;
    let full_path = data_dir.join(&cadbin_rel);

    std::fs::read(&full_path)
        .map_err(|e| AppError::Internal(format!("Failed to read cadbin file: {}", e)))
}

#[tauri::command]
pub fn read_map_library_layer_manifest(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<serde_json::Value, AppError> {
    let library = state.repository.get_by_id(&id)?
        .ok_or_else(|| AppError::NotFound(format!("Map library not found: {}", id)))?;

    let data_dir_rel = library.data_dir
        .ok_or_else(|| AppError::Domain("No data dir for this library".to_string()))?;

    let data_dir = resolve_data_dir(&app_handle)
        .map_err(|e| AppError::Internal(e))?;
    let manifest_path = data_dir.join(&data_dir_rel).join("layers_manifest.json");

    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| AppError::Internal(format!("Failed to read manifest: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| AppError::Internal(format!("Failed to parse manifest: {}", e)))
}

#[tauri::command]
pub fn get_map_library_groups(
    state: State<'_, MapLibraryState>,
    map_type: String,
) -> Result<Vec<MapLibraryGroup>, AppError> {
    let mt = MapLibraryType::from(map_type);
    state.repository.get_groups_by_type(&mt)
}

#[tauri::command]
pub fn create_map_library_group(
    state: State<'_, MapLibraryState>,
    name: String,
    description: Option<String>,
    map_type: String,
    parent_id: Option<String>,
) -> Result<MapLibraryGroup, AppError> {
    let now = chrono::Utc::now().timestamp();
    let group = MapLibraryGroup {
        id: format!("mlgrp_{}", uuid::Uuid::new_v4().to_string().replace("-", "")),
        name,
        description,
        map_type: MapLibraryType::from(map_type),
        parent_id,
        sort_order: 0,
        created_at: now,
        updated_at: now,
    };
    state.repository.save_group(&group)?;
    Ok(group)
}

#[tauri::command]
pub fn update_map_library_group(
    state: State<'_, MapLibraryState>,
    id: String,
    name: String,
    description: Option<String>,
) -> Result<MapLibraryGroup, AppError> {
    let mut group = state.repository.get_group_by_id(&id)?
        .ok_or_else(|| AppError::NotFound(format!("Group not found: {}", id)))?;
    group.name = name;
    group.description = description;
    group.updated_at = chrono::Utc::now().timestamp();
    state.repository.save_group(&group)?;
    Ok(group)
}

#[tauri::command]
pub fn delete_map_library_group(
    state: State<'_, MapLibraryState>,
    id: String,
) -> Result<(), AppError> {
    state.repository.delete_group(&id)
}

#[tauri::command]
pub fn move_library_to_group(
    state: State<'_, MapLibraryState>,
    library_id: String,
    group_id: Option<String>,
) -> Result<(), AppError> {
    let mut library = state.repository.get_by_id(&library_id)?
        .ok_or_else(|| AppError::NotFound(format!("Library not found: {}", library_id)))?;
    library.group_id = group_id;
    library.updated_at = chrono::Utc::now().timestamp();
    state.repository.save(&library)
}

/// 编辑 cadbin 中某个 Text/MText 实体的内容并持久化。
/// 流程：读 sidecar doc.json → 改 entities[entity_id].content → 重写 doc.json + data.cadbin。
/// entity_id 是 cadbin 中分配的全局索引（= 前端 SceneNode.id）。
#[tauri::command]
pub fn update_cadbin_text_entity(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    entity_id: u32,
    new_content: String,
) -> Result<(), AppError> {
    let library = state.repository.get_by_id(&library_id)?
        .ok_or_else(|| AppError::NotFound(format!("Map library not found: {}", library_id)))?;

    let data_dir_rel = library.data_dir.clone()
        .ok_or_else(|| AppError::Domain("No data dir for this library".to_string()))?;

    let data_dir = resolve_data_dir(&app_handle)
        .map_err(|e| AppError::Internal(e))?;
    let lib_dir = data_dir.join(&data_dir_rel);
    let doc_json_path = lib_dir.join("doc.json");

    let mut doc: CadDocument = if doc_json_path.exists() {
        let doc_json_bytes = std::fs::read(&doc_json_path)
            .map_err(|e| AppError::Internal(format!("Failed to read doc.json: {}", e)))?;
        serde_json::from_slice(&doc_json_bytes)
            .map_err(|e| AppError::Internal(format!("doc.json 解析失败: {}", e)))?
    } else {
        // 老图库没有 doc.json：尝试从落盘的源文件 source.{dwg,dxf} 重新解析一份
        let candidates = ["source.dwg", "source.dxf"];
        let mut found_source: Option<std::path::PathBuf> = None;
        for name in &candidates {
            let p = lib_dir.join(name);
            if p.exists() {
                found_source = Some(p);
                break;
            }
        }
        let source_path = found_source.ok_or_else(|| AppError::Domain(
            "无法编辑文字：doc.json 与 source.{dwg,dxf} 都不存在。请重新导入该 CAD 图库。".to_string()
        ))?;
        let source_name = library.source_file.clone()
            .unwrap_or_else(|| source_path.file_name().and_then(|n| n.to_str()).unwrap_or("source.dwg").to_string());
        let bytes = std::fs::read(&source_path)
            .map_err(|e| AppError::Internal(format!("Failed to read source file: {}", e)))?;
        let pr = parse_cad_from_bytes_sync(bytes, source_name);
        if !pr.success {
            return Err(AppError::Domain(format!(
                "源文件重解析失败: {}", pr.error.unwrap_or_default()
            )));
        }
        let parsed_doc = pr.document
            .ok_or_else(|| AppError::Domain("源文件解析后 document 为空".to_string()))?;
        // 顺手把 doc.json 补上，方便下次直接编辑
        if let Ok(j) = serde_json::to_string(&parsed_doc) {
            let _ = std::fs::write(&doc_json_path, j.as_bytes());
        }
        parsed_doc
    };

    let idx = entity_id as usize;
    if idx >= doc.entities.len() {
        return Err(AppError::Domain(format!(
            "entity_id 越界: {} (总 {} 个实体)",
            entity_id, doc.entities.len()
        )));
    }

    match &mut doc.entities[idx] {
        CadEntity::Text { content, .. } => *content = new_content,
        CadEntity::MText { content, .. } => *content = new_content,
        other => {
            return Err(AppError::Domain(format!(
                "实体 {} 不是 Text/MText (实际类型 {:?})",
                entity_id,
                std::mem::discriminant(other)
            )));
        }
    }

    let cadbin_data = crate::cad_runtime::cadbin_writer::CadbinWriter::write_to_bytes(&doc);

    let cadbin_rel = library.cadbin_path.clone()
        .ok_or_else(|| AppError::Domain("No cadbin file for this library".to_string()))?;
    let cadbin_full_path = data_dir.join(&cadbin_rel);

    let new_doc_json = serde_json::to_string(&doc)
        .map_err(|e| AppError::Internal(format!("Failed to serialize doc.json: {}", e)))?;
    std::fs::write(&doc_json_path, new_doc_json.as_bytes())
        .map_err(|e| AppError::Internal(format!("Failed to write doc.json: {}", e)))?;
    std::fs::write(&cadbin_full_path, &cadbin_data)
        .map_err(|e| AppError::Internal(format!("Failed to write cadbin: {}", e)))?;

    let mut updated_library = library;
    updated_library.updated_at = chrono::Utc::now().timestamp();
    state.repository.save(&updated_library)?;

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// 通用 cadbin 编辑：颜色 / 图层 / 移动 / 删除 / 图层属性
// 共享思路与 update_cadbin_text_entity 一致：读 doc.json（或回退到 source 重解析）→
// 改 in-memory CadDocument → 重写 doc.json + data.cadbin。
// 短期方案：性能不是瓶颈（单次写盘 ≤ 几 MB），但能让前端真正"所见即所得"。
// ─────────────────────────────────────────────────────────────────────────────

/// 通用：拿到 (lib, lib_dir, doc_json_path, doc, cadbin_full_path)。
fn load_cad_document_for_edit(
    state: &State<'_, MapLibraryState>,
    app_handle: &tauri::AppHandle,
    library_id: &str,
) -> Result<(MapLibrary, std::path::PathBuf, std::path::PathBuf, std::path::PathBuf, CadDocument), AppError> {
    let library = state.repository.get_by_id(library_id)?
        .ok_or_else(|| AppError::NotFound(format!("Map library not found: {}", library_id)))?;

    let data_dir_rel = library.data_dir.clone()
        .ok_or_else(|| AppError::Domain("No data dir for this library".to_string()))?;
    let data_dir = resolve_data_dir(app_handle)
        .map_err(|e| AppError::Internal(e))?;
    let lib_dir = data_dir.join(&data_dir_rel);
    let doc_json_path = lib_dir.join("doc.json");

    let cadbin_rel = library.cadbin_path.clone()
        .ok_or_else(|| AppError::Domain("No cadbin file for this library".to_string()))?;
    let cadbin_full_path = data_dir.join(&cadbin_rel);

    let doc: CadDocument = if doc_json_path.exists() {
        let bytes = std::fs::read(&doc_json_path)
            .map_err(|e| AppError::Internal(format!("Failed to read doc.json: {}", e)))?;
        serde_json::from_slice(&bytes)
            .map_err(|e| AppError::Internal(format!("doc.json 解析失败: {}", e)))?
    } else {
        let candidates = ["source.dwg", "source.dxf"];
        let mut found_source: Option<std::path::PathBuf> = None;
        for name in &candidates {
            let p = lib_dir.join(name);
            if p.exists() { found_source = Some(p); break; }
        }
        let source_path = found_source.ok_or_else(|| AppError::Domain(
            "无法编辑：doc.json 与 source.{dwg,dxf} 都不存在。请重新导入该 CAD 图库。".to_string()
        ))?;
        let source_name = library.source_file.clone()
            .unwrap_or_else(|| source_path.file_name().and_then(|n| n.to_str()).unwrap_or("source.dwg").to_string());
        let bytes = std::fs::read(&source_path)
            .map_err(|e| AppError::Internal(format!("Failed to read source file: {}", e)))?;
        let pr = parse_cad_from_bytes_sync(bytes, source_name);
        if !pr.success {
            return Err(AppError::Domain(format!("源文件重解析失败: {}", pr.error.unwrap_or_default())));
        }
        let parsed_doc = pr.document
            .ok_or_else(|| AppError::Domain("源文件解析后 document 为空".to_string()))?;
        if let Ok(j) = serde_json::to_string(&parsed_doc) {
            let _ = std::fs::write(&doc_json_path, j.as_bytes());
        }
        parsed_doc
    };

    Ok((library, lib_dir, doc_json_path, cadbin_full_path, doc))
}

fn save_doc_and_cadbin(
    state: &State<'_, MapLibraryState>,
    library: MapLibrary,
    doc: &CadDocument,
    doc_json_path: &Path,
    cadbin_full_path: &Path,
) -> Result<usize, AppError> {
    let new_doc_json = serde_json::to_string(doc)
        .map_err(|e| AppError::Internal(format!("Failed to serialize doc.json: {}", e)))?;
    std::fs::write(doc_json_path, new_doc_json.as_bytes())
        .map_err(|e| AppError::Internal(format!("Failed to write doc.json: {}", e)))?;

    let cadbin_data = crate::cad_runtime::cadbin_writer::CadbinWriter::write_to_bytes(doc);
    std::fs::write(cadbin_full_path, &cadbin_data)
        .map_err(|e| AppError::Internal(format!("Failed to write cadbin: {}", e)))?;

    let mut updated = library;
    updated.updated_at = chrono::Utc::now().timestamp();
    state.repository.save(&updated)?;
    Ok(cadbin_data.len())
}

/// 取实体的 layer 字段引用（用于通用读写）。
fn entity_layer_mut(e: &mut CadEntity) -> &mut String {
    match e {
        CadEntity::Line { layer, .. }
        | CadEntity::Circle { layer, .. }
        | CadEntity::Arc { layer, .. }
        | CadEntity::Polyline { layer, .. }
        | CadEntity::LwPolyline { layer, .. }
        | CadEntity::Ellipse { layer, .. }
        | CadEntity::Spline { layer, .. }
        | CadEntity::Text { layer, .. }
        | CadEntity::MText { layer, .. }
        | CadEntity::Solid { layer, .. }
        | CadEntity::Point { layer, .. }
        | CadEntity::Insert { layer, .. }
        | CadEntity::Hatch { layer, .. }
        | CadEntity::Dimension { layer, .. }
        | CadEntity::Leader { layer, .. }
        | CadEntity::AttributeEntity { layer, .. }
        | CadEntity::Face3D { layer, .. }
        | CadEntity::Polyline2D { layer, .. }
        | CadEntity::Table { layer, .. } => layer,
    }
}

/// 取实体的 color 字段引用。
fn entity_color_mut(e: &mut CadEntity) -> &mut i32 {
    match e {
        CadEntity::Line { color, .. }
        | CadEntity::Circle { color, .. }
        | CadEntity::Arc { color, .. }
        | CadEntity::Polyline { color, .. }
        | CadEntity::LwPolyline { color, .. }
        | CadEntity::Ellipse { color, .. }
        | CadEntity::Spline { color, .. }
        | CadEntity::Text { color, .. }
        | CadEntity::MText { color, .. }
        | CadEntity::Solid { color, .. }
        | CadEntity::Point { color, .. }
        | CadEntity::Insert { color, .. }
        | CadEntity::Hatch { color, .. }
        | CadEntity::Dimension { color, .. }
        | CadEntity::Leader { color, .. }
        | CadEntity::AttributeEntity { color, .. }
        | CadEntity::Face3D { color, .. }
        | CadEntity::Polyline2D { color, .. }
        | CadEntity::Table { color, .. } => color,
    }
}

/// 平移实体所有几何点。注意 hatch/polyline 类的 vertices 也要走。
fn translate_entity(e: &mut CadEntity, dx: f64, dy: f64) {
    let shift_pt = |p: &mut CadPoint| { p.x += dx; p.y += dy; };
    match e {
        CadEntity::Line { start, end, .. } => { shift_pt(start); shift_pt(end); }
        CadEntity::Circle { center, .. }
        | CadEntity::Arc { center, .. }
        | CadEntity::Ellipse { center, .. } => shift_pt(center),
        CadEntity::Polyline { vertices, .. } => for v in vertices { shift_pt(v); },
        CadEntity::LwPolyline { vertices, .. } => for v in vertices { v.x += dx; v.y += dy; },
        CadEntity::Spline { control_points, fit_points, .. } => {
            for p in control_points { shift_pt(p); }
            for p in fit_points { shift_pt(p); }
        }
        CadEntity::Text { position, .. } | CadEntity::MText { position, .. } => shift_pt(position),
        CadEntity::Solid { points, .. } => for p in points { shift_pt(p); },
        CadEntity::Point { position, .. } => shift_pt(position),
        CadEntity::Insert { position, .. } => shift_pt(position),
        CadEntity::Hatch { boundaries, .. } => {
            for path in boundaries {
                for v in path { v.x += dx; v.y += dy; }
            }
        }
        CadEntity::Dimension { definition_point, text_midpoint, .. } => {
            shift_pt(definition_point); shift_pt(text_midpoint);
        }
        CadEntity::Leader { vertices, .. } => for v in vertices { shift_pt(v); },
        CadEntity::AttributeEntity { position, .. } => shift_pt(position),
        CadEntity::Face3D { points, .. } => for p in points { shift_pt(p); },
        CadEntity::Polyline2D { vertices, .. } => for v in vertices { v.x += dx; v.y += dy; },
        CadEntity::Table { position, .. } => shift_pt(position),
    }
}

#[tauri::command]
pub fn update_cadbin_entity_color(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    entity_id: u32,
    new_color: i32,
) -> Result<(), AppError> {
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;
    let idx = entity_id as usize;
    if idx >= doc.entities.len() {
        return Err(AppError::Domain(format!("entity_id 越界: {} (总 {} 个实体)", entity_id, doc.entities.len())));
    }
    *entity_color_mut(&mut doc.entities[idx]) = new_color;
    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

#[tauri::command]
pub fn update_cadbin_entity_layer(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    entity_id: u32,
    new_layer: String,
) -> Result<(), AppError> {
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;
    let idx = entity_id as usize;
    if idx >= doc.entities.len() {
        return Err(AppError::Domain(format!("entity_id 越界: {} (总 {} 个实体)", entity_id, doc.entities.len())));
    }
    *entity_layer_mut(&mut doc.entities[idx]) = new_layer.clone();
    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

#[tauri::command]
pub fn update_cadbin_entity_props(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    entity_id: u32,
    props_json: String,
) -> Result<(), AppError> {
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;
    let idx = entity_id as usize;
    if idx >= doc.entities.len() {
        return Err(AppError::Domain(format!("entity_id 越界: {} (总 {} 个实体)", entity_id, doc.entities.len())));
    }
    let props: serde_json::Value = serde_json::from_str(&props_json)
        .map_err(|e| AppError::Domain(format!("解析属性 JSON 失败: {}", e)))?;
    let entity_json = serde_json::to_value(&doc.entities[idx])
        .map_err(|e| AppError::Domain(format!("序列化实体失败: {}", e)))?;
    let merged = json_merge(entity_json, props);
    let updated: CadEntity = serde_json::from_value(merged)
        .map_err(|e| AppError::Domain(format!("合并属性后反序列化失败: {}", e)))?;
    doc.entities[idx] = updated;
    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

fn json_merge(mut base: serde_json::Value, patch: serde_json::Value) -> serde_json::Value {
    if let (serde_json::Value::Object(ref mut base_map), serde_json::Value::Object(patch_map)) = (&mut base, patch) {
        for (k, v) in patch_map {
            base_map.insert(k, v);
        }
    }
    base
}

#[tauri::command]
pub fn move_cadbin_entity(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    entity_id: u32,
    dx: f64,
    dy: f64,
) -> Result<(), AppError> {
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;
    let idx = entity_id as usize;
    if idx >= doc.entities.len() {
        return Err(AppError::Domain(format!("entity_id 越界: {} (总 {} 个实体)", entity_id, doc.entities.len())));
    }
    translate_entity(&mut doc.entities[idx], dx, dy);
    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

/// 删除实体：注意——entity_id 是 cadbin 里基于 *索引* 的全局 id；删除后剩余实体的 id 会"塌缩"。
/// 为了保持 id 稳定（前端的 selectedId / 撤销栈不会失效），我们用一个"墓碑"型实体替换它而不是真正 remove：
/// 选用 Point + 不可见图层 "__deleted__"，几何放原位，前端遇到该图层直接不渲染。
const DELETED_LAYER: &str = "__deleted__";

#[tauri::command]
pub fn delete_cadbin_entity(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    entity_id: u32,
) -> Result<(), AppError> {
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;
    let idx = entity_id as usize;
    if idx >= doc.entities.len() {
        return Err(AppError::Domain(format!("entity_id 越界: {} (总 {} 个实体)", entity_id, doc.entities.len())));
    }

    // 取一个原始坐标作为墓碑位置
    let pos = match &doc.entities[idx] {
        CadEntity::Line { start, .. } => start.clone(),
        CadEntity::Circle { center, .. } | CadEntity::Arc { center, .. } | CadEntity::Ellipse { center, .. } => center.clone(),
        CadEntity::Polyline { vertices, .. } => vertices.first().cloned().unwrap_or(CadPoint{ x:0.0, y:0.0, z:0.0 }),
        CadEntity::LwPolyline { vertices, .. } => vertices.first().map(|v| CadPoint{ x:v.x, y:v.y, z:0.0 }).unwrap_or(CadPoint{ x:0.0, y:0.0, z:0.0 }),
        CadEntity::Spline { control_points, .. } => control_points.first().cloned().unwrap_or(CadPoint{ x:0.0, y:0.0, z:0.0 }),
        CadEntity::Text { position, .. } | CadEntity::MText { position, .. } => position.clone(),
        CadEntity::Solid { points, .. } => points.first().cloned().unwrap_or(CadPoint{ x:0.0, y:0.0, z:0.0 }),
        CadEntity::Point { position, .. } => position.clone(),
        CadEntity::Insert { position, .. } => position.clone(),
        CadEntity::Hatch { boundaries, .. } => boundaries.first().and_then(|b| b.first()).map(|v| CadPoint{ x:v.x, y:v.y, z:0.0 }).unwrap_or(CadPoint{ x:0.0, y:0.0, z:0.0 }),
        CadEntity::Dimension { definition_point, .. } => definition_point.clone(),
        CadEntity::Leader { vertices, .. } => vertices.first().cloned().unwrap_or(CadPoint{ x:0.0, y:0.0, z:0.0 }),
        CadEntity::AttributeEntity { position, .. } => position.clone(),
        CadEntity::Face3D { points, .. } => points.first().cloned().unwrap_or(CadPoint{ x:0.0, y:0.0, z:0.0 }),
        CadEntity::Polyline2D { vertices, .. } => vertices.first().map(|v| CadPoint{ x:v.x, y:v.y, z:0.0 }).unwrap_or(CadPoint{ x:0.0, y:0.0, z:0.0 }),
        CadEntity::Table { position, .. } => position.clone(),
    };

    let id_str = match &doc.entities[idx] {
        CadEntity::Line { id, .. }
        | CadEntity::Circle { id, .. }
        | CadEntity::Arc { id, .. }
        | CadEntity::Polyline { id, .. }
        | CadEntity::LwPolyline { id, .. }
        | CadEntity::Ellipse { id, .. }
        | CadEntity::Spline { id, .. }
        | CadEntity::Text { id, .. }
        | CadEntity::MText { id, .. }
        | CadEntity::Solid { id, .. }
        | CadEntity::Point { id, .. }
        | CadEntity::Insert { id, .. }
        | CadEntity::Hatch { id, .. }
        | CadEntity::Dimension { id, .. }
        | CadEntity::Leader { id, .. }
        | CadEntity::AttributeEntity { id, .. }
        | CadEntity::Face3D { id, .. }
        | CadEntity::Polyline2D { id, .. }
        | CadEntity::Table { id, .. } => id.clone(),
    };

    let original_entity = doc.entities[idx].clone();
    doc.deleted_snapshots.insert(entity_id, original_entity);

    doc.entities[idx] = CadEntity::Point {
        id: id_str,
        layer: DELETED_LAYER.to_string(),
        color: 0,
        position: pos,
    };

    if !doc.layers.iter().any(|l| l.name == DELETED_LAYER) {
        doc.layers.push(crate::domain::cad::CadLayer {
            name: DELETED_LAYER.to_string(),
            color: 0,
            visible: false,
            frozen: true,
            locked: true,
        });
    }

    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

#[derive(serde::Deserialize)]
pub struct LayerPropsUpdate {
    pub color: Option<i32>,
    pub visible: Option<bool>,
    pub frozen: Option<bool>,
    pub locked: Option<bool>,
}

#[tauri::command]
pub fn update_cadbin_layer_props(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    layer_name: String,
    props: LayerPropsUpdate,
) -> Result<(), AppError> {
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;

    let layer = doc.layers.iter_mut().find(|l| l.name == layer_name)
        .ok_or_else(|| AppError::Domain(format!("图层不存在: {}", layer_name)))?;

    if let Some(c) = props.color { layer.color = c; }
    if let Some(v) = props.visible { layer.visible = v; }
    if let Some(f) = props.frozen { layer.frozen = f; }
    if let Some(l) = props.locked { layer.locked = l; }

    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    // 仅在 debug 模式下输出，避免生产环境日志泛滥
    #[cfg(debug_assertions)]
    Ok(())
}

#[tauri::command]
pub fn create_cadbin_layer(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    layer_name: String,
    color: Option<i32>,
) -> Result<(), AppError> {
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;

    if doc.layers.iter().any(|l| l.name == layer_name) {
        return Err(AppError::Domain(format!("图层已存在: {}", layer_name)));
    }

    doc.layers.push(CadLayer {
        name: layer_name,
        color: color.unwrap_or(7),
        visible: true,
        frozen: false,
        locked: false,
    });

    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

#[tauri::command]
pub fn delete_cadbin_layer(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    layer_name: String,
    delete_entities: bool,
) -> Result<(), AppError> {
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;

    let layer_idx = doc.layers.iter().position(|l| l.name == layer_name)
        .ok_or_else(|| AppError::Domain(format!("图层不存在: {}", layer_name)))?;

    if delete_entities {
        doc.entities.retain(|e| e.layer() != layer_name);
    } else {
        for e in &mut doc.entities {
            if e.layer() == layer_name {
                e.set_layer("0".to_string());
            }
        }
    }

    doc.layers.remove(layer_idx);

    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

#[tauri::command]
pub fn rename_cadbin_layer(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    old_name: String,
    new_name: String,
) -> Result<(), AppError> {
    if old_name == new_name { return Ok(()); }
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;

    if doc.layers.iter().any(|l| l.name == new_name) {
        return Err(AppError::Domain(format!("图层名称已存在: {}", new_name)));
    }

    let layer = doc.layers.iter_mut().find(|l| l.name == old_name)
        .ok_or_else(|| AppError::Domain(format!("图层不存在: {}", old_name)))?;
    layer.name = new_name.clone();

    for e in &mut doc.entities {
        if e.layer() == old_name {
            e.set_layer(new_name.clone());
        }
    }

    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

#[tauri::command]
pub fn restore_cadbin_entity(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    entity_id: u32,
    entity_type: String,
    snapshot: String,
) -> Result<(), AppError> {
    let _entity_type = entity_type;
    let _snapshot = snapshot;
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;
    let idx = entity_id as usize;
    if idx >= doc.entities.len() {
        return Err(AppError::Domain(format!("entity_id 越界: {} (总 {} 个实体)", entity_id, doc.entities.len())));
    }

    let original = doc.deleted_snapshots.remove(&entity_id)
        .ok_or_else(|| AppError::Domain(format!(
            "找不到实体 {} 的删除快照，无法恢复",
            entity_id
        )))?;

    doc.entities[idx] = original;

    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(())
}

#[tauri::command]
pub fn add_cadbin_entity(
    state: State<'_, MapLibraryState>,
    app_handle: tauri::AppHandle,
    library_id: String,
    entity_json: String,
) -> Result<u32, AppError> {
    let entity: CadEntity = serde_json::from_str(&entity_json)
        .map_err(|e| AppError::Domain(format!("解析实体 JSON 失败: {}", e)))?;
    let (lib, _lib_dir, doc_json_path, cadbin_full_path, mut doc) =
        load_cad_document_for_edit(&state, &app_handle, &library_id)?;
    let new_id = doc.entities.len() as u32;
    doc.entities.push(entity);
    doc.entity_count = doc.entities.len();
    let _bytes = save_doc_and_cadbin(&state, lib, &doc, &doc_json_path, &cadbin_full_path)?;
    Ok(new_id)
}
