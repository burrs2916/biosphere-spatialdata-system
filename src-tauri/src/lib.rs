mod application;
mod cad_runtime;
mod commands;
mod domain;
mod error;
mod infrastructure;

use application::MqttService;
use application::{
    DeleteGroupUseCase, DeleteIconUseCase, GetAllGroupsUseCase, GetAllIconsUseCase,
    GetGroupUseCase, GetIconUseCase, GetIconsByGroupUseCase, SaveGroupUseCase, SaveIconUseCase,
};
use application::{
    DeletePresetConfigUseCase, GetConfigUseCase, GetPresetConfigUseCase, ResetConfigUseCase,
    SavePresetConfigUseCase, UpdateConfigUseCase,
};
use commands::{
    init_logger_state, AuthState, ComponentPluginState, DatasourceState, IconsState,
    MapLibraryState, MqttState, SceneState, SettingsState,
};
use infrastructure::database::{init_tables, migrate};
use infrastructure::{
    Database, SqliteAuthRepository, SqliteDatasourceRepository, SqliteIconRepository,
    SqliteMapLibraryRepository, SqliteSceneRepository, SqliteSettingsRepository,
};
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db = Database::new(app.handle()).expect("Failed to initialize database");

            {
                let conn = db.0.lock().unwrap();
                init_tables(&conn).expect("Failed to initialize tables");
                migrate(&conn).expect("Failed to migrate database");
            }

            let db_arc = Arc::new(db);

            let auth_repo = SqliteAuthRepository::new(db_arc.clone());
            let settings_repo = SqliteSettingsRepository::new(db_arc.clone());
            let icon_repo = SqliteIconRepository::new(db_arc.clone());
            let datasource_repo = SqliteDatasourceRepository::new(db_arc.clone());
            let scene_repo = SqliteSceneRepository::new(db_arc.clone());
            let map_library_repo = SqliteMapLibraryRepository::new(db_arc.clone());

            let auth_state = AuthState {
                get_config_use_case: GetConfigUseCase::new(auth_repo.clone()),
                update_config_use_case: UpdateConfigUseCase::new(auth_repo.clone()),
                reset_config_use_case: ResetConfigUseCase::new(auth_repo.clone()),
                get_preset_config_use_case: GetPresetConfigUseCase::new(auth_repo.clone()),
                save_preset_config_use_case: SavePresetConfigUseCase::new(auth_repo.clone()),
                delete_preset_config_use_case: DeletePresetConfigUseCase::new(auth_repo),
            };

            let settings_state = SettingsState {
                repository: settings_repo,
            };

            let icons_state = IconsState {
                get_all_groups_use_case: GetAllGroupsUseCase::new(icon_repo.clone()),
                get_group_use_case: GetGroupUseCase::new(icon_repo.clone()),
                save_group_use_case: SaveGroupUseCase::new(icon_repo.clone()),
                delete_group_use_case: DeleteGroupUseCase::new(icon_repo.clone()),
                get_all_icons_use_case: GetAllIconsUseCase::new(icon_repo.clone()),
                get_icons_by_group_use_case: GetIconsByGroupUseCase::new(icon_repo.clone()),
                get_icon_use_case: GetIconUseCase::new(icon_repo.clone()),
                save_icon_use_case: SaveIconUseCase::new(icon_repo.clone()),
                delete_icon_use_case: DeleteIconUseCase::new(icon_repo),
            };

            let datasource_state = DatasourceState {
                repository: datasource_repo,
            };

            let mqtt_service = Arc::new(tokio::sync::Mutex::new(MqttService::new()));
            let mqtt_state = MqttState {
                service: mqtt_service,
            };

            let scene_state = SceneState {
                repository: scene_repo,
            };

            let component_plugin_state = ComponentPluginState { db: db_arc.clone() };

            let map_library_state = MapLibraryState {
                repository: map_library_repo,
            };

            let logger_state = init_logger_state();

            app.manage(auth_state);
            app.manage(settings_state);
            app.manage(icons_state);
            app.manage(datasource_state);
            app.manage(mqtt_state);
            app.manage(scene_state);
            app.manage(component_plugin_state);
            app.manage(map_library_state);
            app.manage(logger_state);

            let window = app.get_webview_window("main").unwrap();
            window.set_title("SpatialData System")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_auth_config,
            commands::update_auth_config,
            commands::reset_auth_config,
            commands::get_preset_config,
            commands::save_preset_config,
            commands::delete_preset_config,
            commands::get_setting,
            commands::set_setting,
            commands::delete_setting,
            commands::get_all_groups,
            commands::get_group,
            commands::save_group,
            commands::delete_group,
            commands::get_all_icons,
            commands::get_icons_by_group,
            commands::get_icon,
            commands::save_icon,
            commands::delete_icon,
            commands::upload_icon,
            commands::get_icon_file_url,
            commands::get_icon_file_urls,
            commands::get_all_datasources,
            commands::get_datasource,
            commands::save_datasource,
            commands::delete_datasource,
            commands::db_test_connection,
            commands::db_execute_query,
            commands::mqtt_connect,
            commands::mqtt_disconnect,
            commands::mqtt_subscribe,
            commands::mqtt_unsubscribe,
            commands::mqtt_publish,
            commands::mqtt_get_state,
            commands::mqtt_test_connection,
            commands::get_all_scenes,
            commands::get_scene,
            commands::get_scenes_by_category,
            commands::create_scene,
            commands::update_scene,
            commands::delete_scene,
            commands::get_all_categories,
            commands::get_category,
            commands::save_category,
            commands::delete_category,
            commands::write_log_entry,
            commands::write_log_batch,
            commands::get_log_dir_path,
            commands::read_file_as_data_url,
            commands::save_background_asset,
            commands::get_project_assets_dir,
            commands::list_assets,
            commands::save_asset,
            commands::delete_asset,
            commands::get_asset_thumbnail,
            commands::rename_asset,
            commands::get_all_component_plugins,
            commands::get_enabled_component_plugins,
            commands::get_component_plugin_by_type,
            commands::create_component_plugin,
            commands::update_component_plugin,
            commands::delete_component_plugin,
            commands::toggle_component_plugin,
            commands::get_component_categories,
            commands::create_component_category,
            commands::update_component_category,
            commands::delete_component_category,
            commands::move_plugin_to_category,
            commands::parse_cad_file,
            commands::parse_cad_from_bytes,
            commands::import_cad_to_cadbin,
            commands::read_cadbin_file,
            commands::analyze_cad_files,
            commands::get_all_map_libraries,
            commands::get_map_library,
            commands::get_map_libraries_by_type,
            commands::get_published_map_libraries,
            commands::get_published_map_libraries_by_type,
            commands::save_map_library,
            commands::delete_map_library,
            commands::import_cad_to_map_library,
            commands::import_cad_file_to_map_library,
            commands::import_cad_doc_to_map_library,
            commands::create_tile_map_library,
            commands::create_blueprint_map_library,
            commands::publish_map_library,
            commands::unpublish_map_library,
            commands::read_map_library_cadbin,
            commands::read_map_library_layer_manifest,
            commands::get_map_library_groups,
            commands::create_map_library_group,
            commands::update_map_library_group,
            commands::delete_map_library_group,
            commands::move_library_to_group,
            commands::update_cadbin_text_entity,
            commands::update_cadbin_entity_color,
            commands::update_cadbin_entity_layer,
            commands::update_cadbin_entity_props,
            commands::move_cadbin_entity,
            commands::delete_cadbin_entity,
            commands::restore_cadbin_entity,
            commands::add_cadbin_entity,
            commands::update_cadbin_layer_props,
            commands::create_cadbin_layer,
            commands::delete_cadbin_layer,
            commands::rename_cadbin_layer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
