use crate::domain::auth::{
    ApiEndpoint, AuthConfig, AuthParam, AuthPreset, HeaderConfig, UserDisplayConfig,
};
use rusqlite::Connection;

pub fn init_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS auth_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enabled INTEGER NOT NULL DEFAULT 0,
            preset TEXT NOT NULL DEFAULT 'custom',
            base_url TEXT NOT NULL DEFAULT '',
            auth_params TEXT NOT NULL DEFAULT '[]',
            endpoints TEXT NOT NULL DEFAULT '[]',
            header_config TEXT NOT NULL DEFAULT '[]',
            user_display_config TEXT NOT NULL DEFAULT '[]',
            timeout INTEGER NOT NULL DEFAULT 10000,
            token_storage TEXT NOT NULL DEFAULT 'localStorage',
            token_key TEXT NOT NULL DEFAULT 'auth_token',
            token_header TEXT NOT NULL DEFAULT 'Authorization',
            token_prefix TEXT NOT NULL DEFAULT 'Bearer ',
            refresh_enabled INTEGER NOT NULL DEFAULT 1,
            refresh_threshold INTEGER NOT NULL DEFAULT 300,
            login_redirect_path TEXT NOT NULL DEFAULT '/login',
            login_redirect_param TEXT NOT NULL DEFAULT 'redirect',
            login_auto_redirect INTEGER NOT NULL DEFAULT 1,
            whitelist TEXT NOT NULL DEFAULT '[]',
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute("INSERT OR IGNORE INTO auth_config (id) VALUES (1)", [])?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS auth_config_presets (
            preset TEXT PRIMARY KEY,
            config TEXT NOT NULL DEFAULT '{}',
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS icon_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            parent_id TEXT,
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS system_icons (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            group_id TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS data_sources (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'http',
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            connection TEXT NOT NULL DEFAULT '{}',
            response_mapping TEXT NOT NULL DEFAULT '[]',
            test_apis TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS scene_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            color TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            parent_id TEXT,
            description TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS scenes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            coordinate_system TEXT NOT NULL DEFAULT 'EPSG:3857',
            camera TEXT NOT NULL DEFAULT '{}',
            bounds TEXT,
            layers TEXT NOT NULL DEFAULT '[]',
            bindings TEXT NOT NULL DEFAULT '[]',
            variables TEXT,
            layout TEXT NOT NULL DEFAULT '[]',
            category_id TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            thumbnail TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            metadata TEXT NOT NULL DEFAULT '{}',
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS component_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            color TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            parent_id TEXT,
            description TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS component_plugins (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            version TEXT NOT NULL DEFAULT '1.0.0',
            description TEXT,
            icon TEXT,
            category TEXT NOT NULL DEFAULT 'custom',
            default_size TEXT NOT NULL DEFAULT '{}',
            default_config TEXT NOT NULL DEFAULT '{}',
            capabilities TEXT NOT NULL DEFAULT '{}',
            config_schema TEXT NOT NULL DEFAULT '[]',
            events TEXT NOT NULL DEFAULT '[]',
            actions TEXT NOT NULL DEFAULT '[]',
            data_schema TEXT,
            renderer_entry TEXT,
            renderer_format TEXT NOT NULL DEFAULT 'module',
            dependencies TEXT NOT NULL DEFAULT '[]',
            permissions TEXT NOT NULL DEFAULT '[]',
            author TEXT,
            homepage TEXT,
            thumbnail TEXT,
            built_in INTEGER NOT NULL DEFAULT 0,
            enabled INTEGER NOT NULL DEFAULT 1,
            installed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    seed_scene_categories(conn)?;
    seed_component_categories(conn)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS map_libraries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            map_type TEXT NOT NULL DEFAULT 'cad',
            data_dir TEXT,
            source_file TEXT,
            source_format TEXT,
            geojson_path TEXT,
            coordinate_system TEXT NOT NULL DEFAULT 'EPSG:4490',
            target_crs TEXT NOT NULL DEFAULT 'EPSG:3857',
            bounds TEXT,
            layers TEXT,
            entity_count INTEGER NOT NULL DEFAULT 0,
            metadata TEXT,
            thumbnail TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            published_at INTEGER,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS map_library_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            map_type TEXT NOT NULL DEFAULT 'cad',
            parent_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    Ok(())
}

pub fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(auth_config)")?
        .query_map([], |row| row.get(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !columns.contains(&"preset".to_string()) {
        conn.execute(
            "ALTER TABLE auth_config ADD COLUMN preset TEXT NOT NULL DEFAULT 'custom'",
            [],
        )?;
    }

    if !columns.contains(&"auth_params".to_string()) {
        conn.execute(
            "ALTER TABLE auth_config ADD COLUMN auth_params TEXT NOT NULL DEFAULT '[]'",
            [],
        )?;
    }

    if !columns.contains(&"endpoints".to_string()) {
        conn.execute(
            "ALTER TABLE auth_config ADD COLUMN endpoints TEXT NOT NULL DEFAULT '[]'",
            [],
        )?;
    }

    if !columns.contains(&"header_config".to_string()) {
        conn.execute(
            "ALTER TABLE auth_config ADD COLUMN header_config TEXT NOT NULL DEFAULT '[]'",
            [],
        )?;
    }

    if !columns.contains(&"user_display_config".to_string()) {
        conn.execute(
            "ALTER TABLE auth_config ADD COLUMN user_display_config TEXT NOT NULL DEFAULT '[]'",
            [],
        )?;
    }

    let preset_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(auth_config_presets)")?
        .query_map([], |row| row.get(1))?
        .filter_map(|r| r.ok())
        .collect();

    if preset_columns.is_empty() {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS auth_config_presets (
                preset TEXT PRIMARY KEY,
                config TEXT NOT NULL DEFAULT '{}',
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        if let Some(config) = build_config_from_db(conn) {
            let preset_str: String = config.preset.clone().into();
            if let Ok(config_json) = serde_json::to_string(&config) {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO auth_config_presets (preset, config, updated_at) VALUES (?1, ?2, strftime('%s', 'now'))",
                    rusqlite::params![&preset_str, &config_json],
                );
            }
        }
    }

    let icon_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(system_icons)")?
        .query_map([], |row| row.get(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !icon_columns.is_empty()
        && icon_columns.contains(&"category".to_string())
        && !icon_columns.contains(&"group_id".to_string())
    {
        conn.execute(
            "ALTER TABLE system_icons ADD COLUMN group_id TEXT NOT NULL DEFAULT 'default'",
            [],
        )?;
        conn.execute("UPDATE system_icons SET group_id = category", [])?;
        conn.execute(
            "INSERT OR IGNORE INTO icon_groups (id, name, updated_at) VALUES ('default', '默认分组', strftime('%s', 'now'))",
            [],
        )?;
    }

    let group_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(icon_groups)")?
        .query_map([], |row| row.get(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !group_columns.is_empty() && !group_columns.contains(&"parent_id".to_string()) {
        conn.execute("ALTER TABLE icon_groups ADD COLUMN parent_id TEXT", [])?;
    }

    let ds_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(data_sources)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    if ds_columns.contains(&"strategy".to_string())
        && !ds_columns.contains(&"test_apis".to_string())
    {
        conn.execute(
            "ALTER TABLE data_sources ADD COLUMN test_apis TEXT NOT NULL DEFAULT '[]'",
            [],
        )?;
    }

    let ml_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(map_libraries)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !ml_columns.is_empty() && !ml_columns.contains(&"data_dir".to_string()) {
        conn.execute("ALTER TABLE map_libraries ADD COLUMN data_dir TEXT", [])?;
    }

    if !ml_columns.is_empty() && !ml_columns.contains(&"group_id".to_string()) {
        conn.execute("ALTER TABLE map_libraries ADD COLUMN group_id TEXT", [])?;
    }

    if !ml_columns.is_empty() && !ml_columns.contains(&"cadbin_path".to_string()) {
        conn.execute("ALTER TABLE map_libraries ADD COLUMN cadbin_path TEXT", [])?;
    }

    {
        let mut stmt = conn.prepare(
            "SELECT id, data_dir FROM map_libraries WHERE map_type = 'cad' AND cadbin_path IS NULL AND data_dir IS NOT NULL"
        )?;
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect();

        for (lib_id, data_dir) in rows {
            let cadbin_rel = format!("{}/data.cadbin", data_dir);
            let _ = conn.execute(
                "UPDATE map_libraries SET cadbin_path = ?1 WHERE id = ?2",
                rusqlite::params![cadbin_rel, lib_id],
            );
        }
    }

    let scene_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scenes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !scene_columns.contains(&"editor_components".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN editor_components TEXT", [])?;
    }

    if !scene_columns.contains(&"editor_layers".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN editor_layers TEXT", [])?;
    }

    if !scene_columns.contains(&"canvas_config".to_string()) {
        if scene_columns.contains(&"canvas_size".to_string()) {
            conn.execute(
                "ALTER TABLE scenes RENAME COLUMN canvas_size TO canvas_config",
                [],
            )?;
        } else {
            conn.execute("ALTER TABLE scenes ADD COLUMN canvas_config TEXT", [])?;
        }
    }

    if !scene_columns.contains(&"variables".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN variables TEXT", [])?;
    }

    if !scene_columns.contains(&"global_components".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN global_components TEXT", [])?;
    }

    if !scene_columns.contains(&"views".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN views TEXT", [])?;
    }

    if !scene_columns.contains(&"active_view_id".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN active_view_id TEXT", [])?;
    }

    Ok(())
}

fn seed_component_categories(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM component_categories", [], |row| {
        row.get(0)
    })?;

    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();
    let seeds: Vec<(&str, &str, &str, &str, i32, Option<&str>, &str)> = vec![
        (
            "ccat_basic",
            "基础组件",
            "palette",
            "#4FC3F7",
            0,
            None,
            "文本、图片、形状等基础组件",
        ),
        (
            "ccat_basic_text",
            "文本类",
            "text_fields",
            "#4FC3F7",
            0,
            Some("ccat_basic"),
            "文本相关组件",
        ),
        (
            "ccat_basic_shape",
            "图形类",
            "crop_square",
            "#4FC3F7",
            1,
            Some("ccat_basic"),
            "图形和形状组件",
        ),
        (
            "ccat_chart",
            "图表组件",
            "bar_chart",
            "#FF8A65",
            1,
            None,
            "数据可视化图表组件",
        ),
        (
            "ccat_chart_data",
            "数据图表",
            "bar_chart",
            "#FF8A65",
            0,
            Some("ccat_chart"),
            "数据可视化图表",
        ),
        (
            "ccat_chart_metric",
            "指标卡片",
            "speed",
            "#FF8A65",
            1,
            Some("ccat_chart"),
            "指标展示卡片",
        ),
        (
            "ccat_map",
            "地图组件",
            "map",
            "#81C784",
            2,
            None,
            "2D/3D 地图组件",
        ),
        (
            "ccat_media",
            "媒体组件",
            "videocam",
            "#BA68C8",
            3,
            None,
            "视频、音频等媒体组件",
        ),
        (
            "ccat_decoration",
            "装饰组件",
            "auto_awesome",
            "#FFD54F",
            4,
            None,
            "装饰性组件",
        ),
        (
            "ccat_custom",
            "自定义组件",
            "widgets",
            "#A1887F",
            5,
            None,
            "用户自定义组件",
        ),
    ];

    for (id, name, icon, color, sort_order, parent_id, description) in &seeds {
        conn.execute(
            "INSERT OR IGNORE INTO component_categories (id, name, icon, color, sort_order, parent_id, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            rusqlite::params![id, name, icon, color, sort_order, parent_id, description, now],
        )?;
    }

    Ok(())
}

fn build_config_from_db(conn: &Connection) -> Option<AuthConfig> {
    let result = conn.query_row(
        "SELECT enabled, preset, base_url, auth_params, endpoints, header_config, user_display_config, timeout,
                token_storage, token_key, token_header, token_prefix,
                refresh_enabled, refresh_threshold, login_redirect_path, login_redirect_param,
                login_auto_redirect, whitelist
         FROM auth_config WHERE id = 1",
        [],
        |row| {
            let enabled: i32 = row.get(0)?;
            let preset_str: String = row.get(1)?;
            let base_url: String = row.get(2)?;
            let auth_params_str: String = row.get(3)?;
            let endpoints_str: String = row.get(4)?;
            let header_config_str: String = row.get(5)?;
            let user_display_config_str: String = row.get(6)?;
            let timeout: i32 = row.get(7)?;
            let token_storage: String = row.get(8)?;
            let token_key: String = row.get(9)?;
            let token_header: String = row.get(10)?;
            let token_prefix: String = row.get(11)?;
            let refresh_enabled: i32 = row.get(12)?;
            let refresh_threshold: i32 = row.get(13)?;
            let login_redirect_path: String = row.get(14)?;
            let login_redirect_param: String = row.get(15)?;
            let login_auto_redirect: i32 = row.get(16)?;
            let whitelist_str: String = row.get(17)?;

            let auth_params: Vec<AuthParam> = serde_json::from_str(&auth_params_str).unwrap_or_default();
            let endpoints: Vec<ApiEndpoint> = serde_json::from_str(&endpoints_str).unwrap_or_default();
            let header_config: Vec<HeaderConfig> = serde_json::from_str(&header_config_str).unwrap_or_default();
            let user_display_config: Vec<UserDisplayConfig> = serde_json::from_str(&user_display_config_str).unwrap_or_default();
            let whitelist: Vec<String> = serde_json::from_str(&whitelist_str).unwrap_or_default();

            Ok(AuthConfig {
                enabled: enabled != 0,
                preset: AuthPreset::from(preset_str),
                base_url,
                auth_params,
                endpoints,
                header_config,
                user_display_config,
                timeout,
                token_storage,
                token_key,
                token_header,
                token_prefix,
                refresh_enabled: refresh_enabled != 0,
                refresh_threshold,
                login_redirect_path,
                login_redirect_param,
                login_auto_redirect: login_auto_redirect != 0,
                whitelist,
            })
        },
    );

    result.ok()
}

fn seed_scene_categories(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM scene_categories", [], |row| {
        row.get(0)
    })?;

    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();
    let seeds = vec![
        (
            "cat_default",
            "默认分组",
            "folder",
            "#757575",
            -1,
            "未指定分类的场景",
        ),
        (
            "cat_comprehensive",
            "综合监控",
            "monitoring",
            "#2196F3",
            0,
            "实时数据监控场景",
        ),
        (
            "cat_spatial",
            "空间分析",
            "spatial",
            "#4CAF50",
            1,
            "GIS 分析与测量场景",
        ),
        (
            "cat_device",
            "设备管理",
            "device",
            "#FF9800",
            2,
            "IoT 设备标注场景",
        ),
        (
            "cat_dashboard",
            "数据展示",
            "dashboard",
            "#9C27B0",
            3,
            "仪表盘与报表场景",
        ),
        (
            "cat_engineering",
            "工程图纸",
            "engineering",
            "#607D8B",
            4,
            "CAD/BIM 查看场景",
        ),
    ];

    for (id, name, icon, color, sort_order, description) in seeds {
        conn.execute(
            "INSERT OR IGNORE INTO scene_categories (id, name, icon, color, sort_order, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            rusqlite::params![id, name, icon, color, sort_order, description, now],
        )?;
    }

    Ok(())
}
