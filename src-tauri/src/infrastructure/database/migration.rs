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
            strategy TEXT NOT NULL DEFAULT '{}',
            bound_components TEXT NOT NULL DEFAULT '[]',
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
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            editor_components TEXT,
            editor_layers TEXT,
            canvas_config TEXT,
            global_components TEXT,
            views TEXT,
            active_view_id TEXT,
            viewport_sync_rules TEXT
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS deleted_category_ids (
            id TEXT PRIMARY KEY
        )",
        [],
    )?;

    seed_scene_categories(conn)?;
    seed_component_categories(conn)?;
    seed_auth_config(conn)?;
    seed_auth_config_presets(conn)?;
    // 注意：seed_spray_scenes 必须在 ALTER TABLE（添加 editor_components/views 等列）之后调用
    // 因为 INSERT 语句引用了这些后添加的列。移到 init_tables 末尾调用。

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
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            group_id TEXT,
            cadbin_path TEXT
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

    if !ds_columns.contains(&"strategy".to_string()) {
        conn.execute(
            "ALTER TABLE data_sources ADD COLUMN strategy TEXT NOT NULL DEFAULT '{}'",
            [],
        )?;
    }

    if !ds_columns.contains(&"bound_components".to_string()) {
        conn.execute(
            "ALTER TABLE data_sources ADD COLUMN bound_components TEXT NOT NULL DEFAULT '[]'",
            [],
        )?;
    }

    if !ds_columns.contains(&"test_apis".to_string()) {
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

    if !scene_columns.contains(&"global_components".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN global_components TEXT", [])?;
    }

    if !scene_columns.contains(&"views".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN views TEXT", [])?;
    }

    if !scene_columns.contains(&"active_view_id".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN active_view_id TEXT", [])?;
    }

    if !scene_columns.contains(&"viewport_sync_rules".to_string()) {
        conn.execute("ALTER TABLE scenes ADD COLUMN viewport_sync_rules TEXT", [])?;
    }

    {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM component_categories WHERE id = 'ccat_decoration_title'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if exists == 0 {
            let now = chrono::Utc::now().timestamp();
            conn.execute(
                "INSERT OR IGNORE INTO component_categories (id, name, icon, color, sort_order, parent_id, description, created_at, updated_at)
                 VALUES ('ccat_decoration_title', '标题栏', 'title', '#4DD0E1', 5, NULL, '数据大屏标题栏组件', ?1, ?1)",
                rusqlite::params![now],
            )?;
            conn.execute(
                "UPDATE component_categories SET sort_order = 6 WHERE id = 'ccat_custom' AND sort_order = 5",
                [],
            )?;
        }
    }

    {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM component_categories WHERE id = 'ccat_datav'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if exists == 0 {
            let now = chrono::Utc::now().timestamp();
            conn.execute(
                "INSERT OR IGNORE INTO component_categories (id, name, icon, color, sort_order, parent_id, description, created_at, updated_at)
                 VALUES ('ccat_datav', 'DataV组件', 'data_object', '#7C4DFF', 6, NULL, 'DataV大屏装饰与边框组件', ?1, ?1)",
                rusqlite::params![now],
            )?;
            conn.execute(
                "UPDATE component_categories SET sort_order = 7 WHERE id = 'ccat_custom' AND sort_order <= 6",
                [],
            )?;
        }
    }

    // 扁平化：移除二级分组的 parent_id，让所有分组都在同一层级
    {
        conn.execute(
            "UPDATE component_categories SET parent_id = NULL WHERE parent_id IS NOT NULL",
            [],
        )?;
    }

    // 增量：合并旧的三个喷雾分组到"降尘喷雾"
    {
        let now = chrono::Utc::now().timestamp();
        // 确保"降尘喷雾"分组存在
        conn.execute(
            "INSERT OR IGNORE INTO scene_categories (id, name, icon, color, sort_order, description, created_at, updated_at)
             VALUES ('cat_spray_dedust', '降尘喷雾', 'water_drop', '#56D0E3', 0, '喷雾降尘系统监控场景', ?1, ?1)",
            rusqlite::params![now],
        )?;
        // 把旧分组下的场景迁移到"降尘喷雾"
        let old_cats = ["cat_spray_tunnel", "cat_spray_bridge", "cat_spray_mining"];
        for old_id in &old_cats {
            conn.execute(
                "UPDATE scenes SET category_id = 'cat_spray_dedust' WHERE category_id = ?1",
                rusqlite::params![old_id],
            )?;
            conn.execute(
                "DELETE FROM scene_categories WHERE id = ?1",
                rusqlite::params![old_id],
            )?;
        }
    }

    // 增量：确保喷雾系统种子场景存在
    {
        seed_spray_scenes(conn)?;
    }

    // 增量：为巷道喷雾监控场景追加"日志监控"视图（幂等）
    add_log_monitor_view(conn)?;

    // 增量：基于巷道场景克隆初始化廊桥/综采（幂等），使首次启动时即为完整可用大屏
    clone_tunnel_scene(conn)?;

    // 增量：对廊桥场景做针对性精简（移除 7 张隧道统计卡 + 重排，幂等），
    // 使其回归旧版 sprayv2/showlq 的极简大屏风格。必须在 clone_tunnel_scene 之后调用。
    customize_bridge_scene(conn)?;

    // 增量：对综采场景做针对性定制（移除 7 张隧道统计卡 + sceneMode 改 mining + 重排 + 注入 42，
    // 幂等），使其完整对齐旧版 sprayv2/showzc 采煤工作面监控并超越老项目体验。
    // 必须在 clone_tunnel_scene 之后调用。
    customize_mining_scene(conn)?;

    // 增量：在综采场景注入煤机位置趋势曲线组件（comp_mining_tunnel_43，industrial-shearer-curve）。
    // 后端已将 coalMachine.coalPosition 落库 GreptimeDB，曲线可拉取真实历史。
    // 幂等（自身 43 守卫），必须在 customize_mining_scene 之后调用。
    inject_shearer_curve(conn)?;

    // 增量：移除底部告警滚动条（industrial-alarm-carousel 与旧版 comp_tunnel_34），
    // 并修复三栏底部对齐（region-frame 统一到 y=1880）+ 恢复底部数据列表(comp_*_12) 满高 h280。
    // 幂等（组件不存在/尺寸已正确时跳过写入）。必须在 clone/customize/shearer/support_status 之后调用。
    remove_alarm_carousel(conn)?;

    // 增量：三喷雾场景全部 region-frame 边框统一写入「霓虹 + 闪烁 + 每框独立色」样式。
    // 幂等（与已有值相同则跳过写入）。
    style_spray_frames(conn)?;

    // 增量（2026-08-22 边框方案重构）：删除独立底部数据边框（comp_*_12_frame），
    // 并为每个内容组件注入统一的青蓝细线 frame 配置（前端 ComponentFrame 覆盖层读取绘制）。
    // 幂等（组件已含 frame 配置则跳过；无残留 12_frame 则仅写一次）。
    apply_component_frame_decorations(conn)?;

    // 增量：顶部主标题栏（comp_*_1, top-glow-title-frame）边框霓虹化——与模块边框「与模块一致」：
    // 开启组件原生 lineEffect=neon（DecorationWrapper 产出 deco-neon-flicker + glow），并由渲染器
    // 按 borderEnabled=true 画出矩形边框。仅 comp_*_1（主标题栏），不动 comp_*_2/3/4 子标题栏。
    style_spray_title_frames(conn)?;

    // 增量：整改场景视图布局——三列各自作为整体（列外框 + 框内内容）整体平移到对称网格
    // （边距 20 左右对称、列间缝 15 均匀），子标题对齐各自列框，工具栏浮点坐标取整。
    // 幂等（按 id 精确设置目标值，相同则跳过）。必须在所有 clone/customize 之后调用。
    align_spray_layout(conn)?;

    // 增量：综采场景注入"支架状态表"(industrial-support-status，对标 sprayv2/showzc 工作面状态 + 支架状态表)，
    // 并收缩左侧 sensor-monitor(41) 高度为该表腾出空间。幂等（support_status id 守卫）。
    inject_mining_support_status(conn)?;

    // 增量：清理并重排三个场景的"日志监控"视图——删除混入的大屏残留/装饰/分析图组件，
    // 仅保留 6 个日志面板并重排为铺满 4K 的 1px 网格布局，视图名带场景名。
    // 幂等（组件集合与坐标已匹配则跳过）。必须在 clone/customize/inject 之后调用，
    // 以免被后续迁移再次污染；仅动 view_log_monitor，绝不碰 view_default。
    cleanup_and_relayout_log_views(conn)?;

    // 增量 V2（2026-08-21）：将日志监控视图组件集合从 6 升级到 6 个 echarts 分析图
    // （drop device-event-table / system-event-table；add cmd-donut / result-donut
    //   / alarm-trend-stacked 替换旧 alarm-trend-chart）。
    // SHA-256 风格的 DefaultHasher 做幂等检测，hash 不等才覆盖写入（多跑零改动）。
    // 必须晚于 cleanup_and_relayout_log_views 调用（避免 V1 视图被 V2 覆盖后又被 V1 回退）。
    relayout_log_monitor_for_charts(conn)?;

    // 增量（2026-08-31）：设备绑定改为「严格绑定模型」——未绑定集控器 = 不显示任何设备。
    // 清空步骤（normalize_spray_device_bindings）已停用：留空本身是 intended 默认，
    // 不再自动清空；组件绑定应显式指向真实集控器（由属性面板勾选）。
    // normalize_spray_device_bindings(conn)?; // DISABLED: 严格绑定模型下不再清空

    Ok(())
}

fn seed_component_categories(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 读取用户已删除的分组 id，seed 时跳过
    let mut deleted_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    {
        let mut stmt = conn.prepare("SELECT id FROM deleted_category_ids")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        for row in rows {
            if let Ok(id) = row {
                deleted_ids.insert(id);
            }
        }
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
            1,
            None,
            "文本相关组件",
        ),
        (
            "ccat_basic_shape",
            "图形类",
            "crop_square",
            "#4FC3F7",
            2,
            None,
            "图形和形状组件",
        ),
        (
            "ccat_chart",
            "图表组件",
            "bar_chart",
            "#FF8A65",
            3,
            None,
            "数据可视化图表组件",
        ),
        (
            "ccat_chart_data",
            "数据图表",
            "bar_chart",
            "#FF8A65",
            4,
            None,
            "数据可视化图表",
        ),
        (
            "ccat_chart_metric",
            "指标卡片",
            "speed",
            "#FF8A65",
            5,
            None,
            "指标展示卡片",
        ),
        (
            "ccat_map",
            "地图组件",
            "map",
            "#81C784",
            6,
            None,
            "2D/3D 地图组件",
        ),
        (
            "ccat_media",
            "媒体组件",
            "videocam",
            "#BA68C8",
            7,
            None,
            "视频、音频等媒体组件",
        ),
        (
            "ccat_decoration",
            "装饰组件",
            "auto_awesome",
            "#FFD54F",
            8,
            None,
            "装饰性组件",
        ),
        (
            "ccat_decoration_title",
            "标题栏",
            "title",
            "#4DD0E1",
            9,
            None,
            "数据大屏标题栏组件",
        ),
        (
            "ccat_datav",
            "DataV组件",
            "data_object",
            "#7C4DFF",
            10,
            None,
            "DataV大屏装饰与边框组件",
        ),
    ];

    for (id, name, icon, color, sort_order, parent_id, description) in &seeds {
        // 跳过用户已删除的分组
        if deleted_ids.contains(*id) {
            continue;
        }
        conn.execute(
            "INSERT OR IGNORE INTO component_categories (id, name, icon, color, sort_order, parent_id, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            rusqlite::params![id, name, icon, color, sort_order, parent_id, description, now],
        )?;
    }

    Ok(())
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
            "cat_spray_dedust",
            "降尘喷雾",
            "water_drop",
            "#56D0E3",
            0,
            "喷雾降尘系统监控场景",
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

/// 升级迁移：对已存在的喷雾场景组件做就地修复
///
/// 生产环境中的旧数据可能使用过期的组件 type（如 double-wing-title-frame），
/// 这里对 comp_tunnel_1 做幂等升级，强制同步为最新版本（top-glow-title-frame + letterSpacing）。
/// 即使新用户从空库初始化，也会先被 seed 一次再被本函数校准，确保任何环境下效果一致。
fn upgrade_spray_scene_components(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 安全检查：editor_components 和 views 列可能还不存在（空库首次启动时，ALTER TABLE 在本函数之后执行）
    let scene_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scenes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    if !scene_columns.contains(&"editor_components".to_string()) {
        // 列不存在，说明是空库，不需要升级（种子插入会在后续步骤完成）
        return Ok(());
    }

    // ─── 升级列表：仅包含 type 需要变更的组件（industrial-data-card → industrial-stats-card, echart-line-basic → industrial-dust-trend） ───
    // 原则：升级代码只改 type + 补齐缺失的 config 字段，绝不覆盖位置/尺寸/已有config
    // 标题栏/边框/工具栏/视频/定时等组件不在升级列表中，因为它们的 type 没有变更
    let upgraded_comp_5 = r##"{"id":"comp_tunnel_5","type":"industrial-dust-trend","name":"粉尘浓度趋势","transform":{"x":30,"y":200,"width":600,"height":440,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":10,"locked":false,"visible":true,"config":{"title":"粉尘浓度趋势","smooth":true,"areaStyle":true,"theme":"dark","xAxisType":"time","yAxisType":"value","showDataZoom":true,"showGrid":true,"titleColor":"#4fc3f7","windowSize":120,"yAxisName":"mg/m³","selectedDeviceIds":[],"showSensorPortraits":true,"valuePrecision":2,"warningRatio":0.8}}"##;
    let upgraded_comp_13 = r##"{"id":"comp_tunnel_13","type":"industrial-stats-card","name":"左侧统计-在线","transform":{"x":30,"y":1340,"width":190,"height":120,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":18,"locked":false,"visible":true,"config":{"icon":"online","label":"在线设备","value":"28","unit":"台","theme":"dark","color":"#4caf50","statType":"online_devices","cardName":"在线设备","iconType":"online"}}"##;
    let upgraded_comp_14 = r##"{"id":"comp_tunnel_14","type":"industrial-stats-card","name":"左侧统计-喷雾","transform":{"x":230,"y":1340,"width":190,"height":120,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":19,"locked":false,"visible":true,"config":{"icon":"spray","label":"喷雾总数","value":"156","unit":"次","theme":"dark","color":"#4fc3f7","statType":"spray_count","cardName":"喷雾总数","iconType":"spray"}}"##;
    let upgraded_comp_15 = r##"{"id":"comp_tunnel_15","type":"industrial-stats-card","name":"左侧统计-告警","transform":{"x":430,"y":1340,"width":200,"height":120,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":20,"locked":false,"visible":true,"config":{"icon":"alarm","label":"告警数","value":"2","unit":"条","theme":"dark","color":"#ff9800","statType":"alarm_count","cardName":"告警数","iconType":"alarm"}}"##;
    let upgraded_comp_16 = r##"{"id":"comp_tunnel_16","type":"industrial-stats-card","name":"左侧统计-用水","transform":{"x":30,"y":1480,"width":600,"height":100,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":21,"locked":false,"visible":true,"config":{"icon":"water","label":"今日用水","value":"3.85","unit":"m³","theme":"dark","color":"#4fc3f7","showProgress":true,"progressValue":75,"statType":"water_usage_today","cardName":"今日用水","iconType":"water"}}"##;
    let upgraded_comp_17 = r##"{"id":"comp_tunnel_17","type":"industrial-stats-card","name":"左侧统计-压力","transform":{"x":30,"y":1600,"width":290,"height":100,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":22,"locked":false,"visible":true,"config":{"icon":"pressure","label":"主管压力","value":"0.85","unit":"MPa","theme":"dark","color":"#4fc3f7","statType":"main_pressure","cardName":"主管压力","iconType":"pressure"}}"##;
    let upgraded_comp_18 = r##"{"id":"comp_tunnel_18","type":"industrial-stats-card","name":"左侧统计-流量","transform":{"x":340,"y":1600,"width":290,"height":100,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":23,"locked":false,"visible":true,"config":{"icon":"flow","label":"总管流量","value":"12.5","unit":"L/s","theme":"dark","color":"#4fc3f7","statType":"total_flow","cardName":"总管流量","iconType":"flow"}}"##;
    let upgraded_comp_25 = r##"{"id":"comp_tunnel_25","type":"industrial-stats-card","name":"集控器-在线","transform":{"x":2890,"y":1320,"width":220,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":42,"locked":false,"visible":true,"config":{"icon":"controller","label":"集控器","value":"5","unit":"台","theme":"dark","color":"#4caf50","statType":"main_controllers_online","cardName":"集控器在线","iconType":"controller"}}"##;
    let upgraded_comp_26 = r##"{"id":"comp_tunnel_26","type":"industrial-stats-card","name":"集控器-运行","transform":{"x":3120,"y":1320,"width":220,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":43,"locked":false,"visible":true,"config":{"icon":"running","label":"运行中","value":"4","unit":"台","theme":"dark","color":"#4fc3f7","statType":"running_count","cardName":"运行中","iconType":"running"}}"##;
    let upgraded_comp_27 = r##"{"id":"comp_tunnel_27","type":"industrial-stats-card","name":"集控器-故障","transform":{"x":3350,"y":1320,"width":220,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":44,"locked":false,"visible":true,"config":{"icon":"fault","label":"故障","value":"1","unit":"台","theme":"dark","color":"#ff9800","statType":"fault_count","cardName":"故障","iconType":"fault"}}"##;
    let upgraded_comp_28 = r##"{"id":"comp_tunnel_28","type":"industrial-stats-card","name":"集控器-通信","transform":{"x":3570,"y":1320,"width":230,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":45,"locked":false,"visible":true,"config":{"icon":"signal","label":"通信","value":"98%","theme":"dark","color":"#4caf50","statType":"comm_rate","cardName":"通信","iconType":"signal"}}"##;
    let upgraded_comp_29 = r##"{"id":"comp_tunnel_29","type":"industrial-stats-card","name":"集控器-昨日喷雾","transform":{"x":2890,"y":1480,"width":450,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":46,"locked":false,"visible":true,"config":{"icon":"spray","label":"昨日喷雾","value":"286","unit":"次","theme":"dark","color":"#4fc3f7","showProgress":true,"progressValue":85,"statType":"spray_count_yesterday","cardName":"昨日喷雾","iconType":"spray"}}"##;
    let upgraded_comp_30 = r##"{"id":"comp_tunnel_30","type":"industrial-stats-card","name":"集控器-累计用水","transform":{"x":3350,"y":1480,"width":450,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":47,"locked":false,"visible":true,"config":{"icon":"water","label":"累计用水","value":"186.5","unit":"m³","theme":"dark","color":"#4fc3f7","statType":"water_usage_total","cardName":"累计用水","iconType":"water"}}"##;
    let upgraded_comp_31 = r##"{"id":"comp_tunnel_31","type":"industrial-stats-card","name":"集控器-累计时长","transform":{"x":2890,"y":1640,"width":450,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":48,"locked":false,"visible":true,"config":{"icon":"time","label":"运行时长","value":"286","unit":"小时","theme":"dark","color":"#4fc3f7","statType":"running_hours","cardName":"运行时长","iconType":"time"}}"##;
    let upgraded_comp_32 = r##"{"id":"comp_tunnel_32","type":"industrial-stats-card","name":"集控器-能效","transform":{"x":3350,"y":1640,"width":450,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":49,"locked":false,"visible":true,"config":{"icon":"energy","label":"节能率","value":"32","unit":"%","theme":"dark","color":"#4caf50","statType":"energy_saving_rate","cardName":"节能率","iconType":"energy"}}"##;

    // v3: 粉尘浓度预警报警面板（替代被移除的 comp_tunnel_29~33 右侧统计卡片+状态指示器）
    let upgraded_comp_42 = r##"{"id":"comp_tunnel_42","type":"industrial-dust-alarm-panel","name":"粉尘浓度预警报警","transform":{"x":2890,"y":1480,"width":910,"height":380,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":46,"locked":false,"visible":true,"config":{"title":"粉尘浓度预警报警","selectedDeviceIds":[],"warningRatio":0.8,"valuePrecision":2,"theme":"dark"}}"##;

    let upgrades: &[(&str, &str)] = &[
        ("comp_tunnel_5", upgraded_comp_5),
        ("comp_tunnel_13", upgraded_comp_13),
        ("comp_tunnel_14", upgraded_comp_14),
        ("comp_tunnel_15", upgraded_comp_15),
        ("comp_tunnel_16", upgraded_comp_16),
        ("comp_tunnel_17", upgraded_comp_17),
        ("comp_tunnel_18", upgraded_comp_18),
        ("comp_tunnel_25", upgraded_comp_25),
        ("comp_tunnel_26", upgraded_comp_26),
        ("comp_tunnel_27", upgraded_comp_27),
        ("comp_tunnel_28", upgraded_comp_28),
        ("comp_tunnel_29", upgraded_comp_29),
        ("comp_tunnel_30", upgraded_comp_30),
        ("comp_tunnel_31", upgraded_comp_31),
        ("comp_tunnel_32", upgraded_comp_32),
        ("comp_tunnel_42", upgraded_comp_42),
    ];

    // 1) 仅升级"巷道喷雾监控"场景（scene_spray_tunnel）
    //    说明：廊桥/综采场景是在巷道基础上克隆而来（组件 ID 带区域前缀
    //    comp_bridge_tunnel_* / comp_mining_tunnel_*）。若在此用未前缀的 comp_tunnel_*
    //    去匹配，会因"找不到对应 id"而向桥/采场景注入重复的 comp_tunnel_* 组件，造成 ID 撞车。
    //    桥/采场景的就地修复统一由 clone_tunnel_scene 处理（其克隆结果本身已是正确类型）。
    let mut stmt = conn.prepare(
        "SELECT id FROM scenes WHERE id = 'scene_spray_tunnel'"
    )?;
    let scene_ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    for scene_id in scene_ids {
        // ─── editor_components 升级 ───
        // 如果 editor_components 为 NULL，跳过该部分但继续处理 views
        let mut arr: serde_json::Value = serde_json::Value::Array(vec![]);
        if let Ok(components_json) = conn.query_row(
            "SELECT editor_components FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| row.get::<_, String>(0),
        ) {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&components_json);
            if let Ok(serde_json::Value::Array(a)) = parsed {
                arr = serde_json::Value::Array(a);
            }
        }

        let mut arr = match arr {
            serde_json::Value::Array(a) => a,
            _ => vec![], // 不应该到这里
        };

        // force_transform_ids 已清空 — 不再强制覆盖用户调整过的位置/尺寸
        // 历史原因：早期种子数据位置与用户调整不一致时需要强制同步，现在种子数据已对齐
        let force_transform_ids: [&str; 0] = [];

        let mut changed = false;
        for (target_id, new_json) in upgrades {
            let new_obj: serde_json::Value = match serde_json::from_str(new_json) {
                Ok(v) => v,
                Err(_) => continue,
            };

            // 在数组中查找 id 匹配项
            // 关键：只替换 type + 补齐 config 缺失字段，绝不覆盖 transform/位置/尺寸/已有config
            let mut found = false;
            for item in arr.iter_mut() {
                if item.get("id").and_then(|v| v.as_str()) == Some(*target_id) {
                    found = true;
                    let old_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    let new_type = new_obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

                    // 1. 替换 type（但不动 transform/位置/尺寸）
                    if old_type != new_type {
                        if let Some(t) = new_obj.get("type") {
                            item.as_object_mut().unwrap().insert("type".to_string(), t.clone());
                            changed = true;
                        }
                    }

                    // 2. 仅补齐缺失的 config 字段（不覆盖已有值）
                    if let (Some(old_cfg), Some(new_cfg)) = (
                        item.get_mut("config").and_then(|v| v.as_object_mut()),
                        new_obj.get("config").and_then(|v| v.as_object()),
                    ) {
                        for (k, v) in new_cfg {
                            if !old_cfg.contains_key(k) {
                                old_cfg.insert(k.clone(), v.clone());
                                changed = true;
                            }
                        }
                    }

                    // 3. force_transform_ids 的组件需要同步 transform（仅同步 transform 字段，不整体替换）
                    if force_transform_ids.contains(target_id) {
                        if let Some(new_transform) = new_obj.get("transform") {
                            if item.get("transform") != Some(new_transform) {
                                item.as_object_mut().unwrap().insert("transform".to_string(), new_transform.clone());
                                changed = true;
                            }
                        }
                    }
                    break;
                }
            }

            // 如果场景中不存在该 id，插入（生产环境数据残缺时使用）
            if !found {
                arr.push(new_obj);
                changed = true;
            }
        }

        // 清理老数据中的硬编码"采集器"/"传感器网格"/"分控器状态表格"卡片
        //   协议层（FY002 2.4.4）只定义 main / sub_controller / sensor 三大类；
        //   早期 seed 把"采集器-烟雾"等报警传感器 + "工业传感器网格" 静态全量预填到画布上，
        //   与"动态从设备 tab 拖入"的设计冲突。初始化时一律清空这些位置。
        //   comp_tunnel_36/37/38（采集/组态/集控三个区域边框）作为装饰层保留。
        //   comp_tunnel_22（分控器状态表格）已并入喷雾控制工具栏（v2 改版）→ 一并清理。
        let legacy_static_device_ids = [
            "comp_tunnel_6",  // 旧"工业传感器网格"（全量静态展示）
            "comp_tunnel_7",  // 旧"采集器-烟雾"  ← 协议层实为 18025 报警传感器
            "comp_tunnel_8",  // 旧"采集器-温度"  ← 18026
            "comp_tunnel_9",  // 旧"采集器-红外"  ← 18027
            "comp_tunnel_10", // 旧"采集器-触控"  ← 18028
            "comp_tunnel_11", // 旧"采集器-粉尘"  ← 18030
            "comp_tunnel_22", // 旧"分控器状态表格" ← 已并入喷雾控制工具栏（v2）
            "comp_tunnel_34", // 旧"告警轮播栏" ← 设备列表已下移替代
            "comp_tunnel_35", // 旧"底部状态栏" ← 设备列表已下移替代
            // ─── v3: 移除协议层无数据源的统计卡片 + 静态状态指示器 ───
            "comp_tunnel_16", // 旧"左侧统计-用水" ← 协议无累计用水量推送
            "comp_tunnel_17", // 旧"左侧统计-压力" ← 协议无主管压力传感器
            "comp_tunnel_18", // 旧"左侧统计-流量" ← 协议无总管流量推送
            "comp_tunnel_19", // 旧"左侧状态" ← 静态硬编码"系统正常"，无实际数据
            "comp_tunnel_29", // 旧"集控器-昨日喷雾" ← spray_count_yesterday 无数据源
            "comp_tunnel_30", // 旧"集控器-累计用水" ← water_usage_total 无数据源
            "comp_tunnel_31", // 旧"集控器-累计时长" ← running_hours 无数据源
            "comp_tunnel_32", // 旧"集控器-能效" ← energy_saving_rate 无数据源
            "comp_tunnel_33", // 旧"集控器状态" ← 静态硬编码，无实际数据
        ];
        let before_len = arr.len();
        arr.retain(|item| {
            let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
            !legacy_static_device_ids.contains(&id)
        });
        if arr.len() != before_len {
            changed = true;
        }

        // 清理 editor_components 中残留的过期 type（前端渲染用 views，但编辑器读 editor_components）
        //   industrial-device-list → industrial-scrolling-table（comp_tunnel_12 设备列表重命名）
        //   double-wing-title-frame → top-glow-title-frame（标题框重命名）
        //   echart-line-basic → industrial-dust-trend（粉尘趋势图重命名）
        //   industrial-data-card → industrial-stats-card（统计卡片重命名）
        let type_renames: &[(&str, &str)] = &[
            ("industrial-device-list", "industrial-scrolling-table"),
            ("double-wing-title-frame", "top-glow-title-frame"),
            ("echart-line-basic", "industrial-dust-trend"),
            ("industrial-data-card", "industrial-stats-card"),
        ];
        for item in arr.iter_mut() {
            if let Some(t) = item.get("type").and_then(|v| v.as_str()) {
                for (old_type, new_type) in type_renames {
                    if t == *old_type {
                        item.as_object_mut().unwrap().insert(
                            "type".to_string(),
                            serde_json::Value::String(new_type.to_string()),
                        );
                        changed = true;
                        break;
                    }
                }
            }
        }

        if changed {
            let new_components = serde_json::to_string(&arr).unwrap_or_else(|_| "[]".to_string());
            conn.execute(
                "UPDATE scenes SET editor_components = ?1, updated_at = strftime('%s','now') WHERE id = ?2",
                rusqlite::params![new_components, scene_id],
            )?;
        }

        // 同步清理 legacy 场景的 layout 字段（生产环境老数据可能同时污染 editor_components + layout）
        // 1) 移除 comp_tunnel_6~11 采集器死引用
        // 2) 补齐 comp_tunnel_40 传感器摆放区
        let mut layout_stmt = conn.prepare("SELECT layout FROM scenes WHERE id = ?1")?;
        if let Ok(layout_str) = layout_stmt.query_row(rusqlite::params![scene_id], |row| row.get::<_, String>(0)) {
            if let Ok(serde_json::Value::Array(mut layout_arr)) = serde_json::from_str::<serde_json::Value>(&layout_str) {
                let mut layout_changed = false;
                let before_layout_len = layout_arr.len();
                layout_arr.retain(|item| {
                    let id = item.get("componentId").and_then(|v| v.as_str()).unwrap_or("");
                    !legacy_static_device_ids.contains(&id)
                });
                if layout_arr.len() != before_layout_len {
                    layout_changed = true;
                }
                // 补齐 comp_tunnel_40（传感器摆放区），仅当场景中不存在时插入
                let has_40 = layout_arr.iter().any(|item| {
                    item.get("componentId").and_then(|v| v.as_str()) == Some("comp_tunnel_40")
                });
                if !has_40 {
                    layout_arr.push(serde_json::json!({
                        "componentId": "comp_tunnel_40",
                        "x": 20, "y": 660, "w": 620, "h": 600, "zIndex": 16
                    }));
                    layout_changed = true;
                }
                // 强制更新 comp_tunnel_12 位置（下移至底部，且收进底部数据边框框线内：
                // comp_tunnel_12_frame 为 y:1880/h:280，RegionFrame 框线内缩 padding=cornerLength/3=13.33，
                // 框线实际覆盖 1893.33~2146.67；列表取 y:1896/h:249 完整落在框线内，上下各留约 2.7px）
                for item in layout_arr.iter_mut() {
                    if item.get("componentId").and_then(|v| v.as_str()) == Some("comp_tunnel_12") {
                        if let Some(obj) = item.as_object_mut() {
                            let y = serde_json::json!(1896);
                            let h = serde_json::json!(249);
                            let w = serde_json::json!(3840);
                            let x = serde_json::json!(0);
                            if obj.get("y") != Some(&y) || obj.get("h") != Some(&h) {
                                obj.insert("x".to_string(), x);
                                obj.insert("y".to_string(), y);
                                obj.insert("w".to_string(), w);
                                obj.insert("h".to_string(), h);
                                layout_changed = true;
                            }
                        }
                    }
                }
                // 补齐 comp_tunnel_41（传感器实时监控），仅当场景中不存在时插入
                let has_41_layout = layout_arr.iter().any(|item| {
                    item.get("componentId").and_then(|v| v.as_str()) == Some("comp_tunnel_41")
                });
                if !has_41_layout {
                    layout_arr.push(serde_json::json!({
                        "componentId": "comp_tunnel_41",
                        "x": 30, "y": 670, "w": 600, "h": 580, "zIndex": 17
                    }));
                    layout_changed = true;
                }
                if layout_changed {
                    let new_layout = serde_json::to_string(&layout_arr).unwrap_or(layout_str);
                    conn.execute(
                        "UPDATE scenes SET layout = ?1, updated_at = strftime('%s','now') WHERE id = ?2",
                        rusqlite::params![new_layout, scene_id],
                    )?;
                }
            }
        }

        // 同步清理 legacy 场景的 views 字段（前端真正渲染的数据源！）
        // views[].components[].id 中可能仍含 comp_tunnel_6~11 采集器，
        // 这里同样清理掉并补齐 comp_tunnel_40 传感器摆放区。
        let mut views_stmt = conn.prepare("SELECT views FROM scenes WHERE id = ?1")?;
        if let Ok(views_str) = views_stmt.query_row(rusqlite::params![scene_id], |row| row.get::<_, String>(0)) {
            if let Ok(serde_json::Value::Array(mut views_arr)) = serde_json::from_str::<serde_json::Value>(&views_str) {
                let mut views_changed = false;
                for view in views_arr.iter_mut() {
                    if let Some(components) = view.get_mut("components").and_then(|v| v.as_array_mut()) {
                        let before_v = components.len();
                        components.retain(|c| {
                            let id = c.get("id").and_then(|v| v.as_str()).unwrap_or("");
                            !legacy_static_device_ids.contains(&id)
                        });
                        if components.len() != before_v {
                            views_changed = true;
                        }
                        // 补齐 comp_tunnel_40
                        let has_40 = components.iter().any(|c| {
                            c.get("id").and_then(|v| v.as_str()) == Some("comp_tunnel_40")
                        });
                        if !has_40 {
                            components.push(serde_json::json!({
                                "id": "comp_tunnel_40",
                                "type": "region-frame",
                                "name": "传感器摆放区",
                                "transform": {"x": 20, "y": 660, "width": 620, "height": 600, "rotation": 0, "scale": {"x": 1, "y": 1}},
                                "layerId": "layer_default",
                                "zIndex": 16,
                                "locked": false,
                                "visible": true,
                                "config": {
                                    "label": "传感器摆放区",
                                    "labelColor": "#4fc3f7",
                                    "labelFontSize": 14,
                                    "labelPosition": "top-left",
                                    "showLabel": true,
                                    "showIndex": false,
                                    "indexText": "01-A",
                                    "indexColor": "#4fc3f7",
                                    "stroke": "#4fc3f7",
                                    "strokeWidth": 1.5,
                                    "strokeDasharray": "6,4",
                                    "borderRadius": 6,
                                    "cornerLength": 24,
                                    "cornerThickness": 2,
                                    "cornerSize": 0,
                                    "cornerStyle": "rounded",
                                    "showCornerDots": false,
                                    "cornerDotSize": 3,
                                    "glowEnabled": true,
                                    "glowColor": "#4fc3f7",
                                    "glowIntensity": 2,
                                    "pulse": true,
                                    "flowLight": true,
                                    "flowSpeed": 5000,
                                    "fillColor": "rgba(79,195,247,0.03)",
                                    "fillOpacity": 0.05,
                                    "opacity": 1,
                                    "acceptsDeviceTypes": ["sensor", "alarm_sensor"]
                                }
                            }));
                            views_changed = true;
                        }

                        // 强制更新 comp_tunnel_12 位置（下移至底部且收进底部数据边框框线内：
                        // frame 为 y:1880/h:280，RegionFrame 框线内缩 13.33px → 1893.33~2146.67；
                        // 列表取 y:1896/h:249 完整落在框线内）
                        for c in components.iter_mut() {
                            if c.get("id").and_then(|v| v.as_str()) == Some("comp_tunnel_12") {
                                if let Some(tf) = c.get_mut("transform").and_then(|v| v.as_object_mut()) {
                                    let mut tf_changed = false;
                                    for (k, want) in [("x", serde_json::json!(0)), ("y", serde_json::json!(1896)), ("width", serde_json::json!(3840)), ("height", serde_json::json!(249))] {
                                        if tf.get(k) != Some(&want) {
                                            tf.insert(k.to_string(), want);
                                            tf_changed = true;
                                        }
                                    }
                                    if tf_changed { views_changed = true; }
                                }
                            }
                        }
                        // 强制对齐 comp_tunnel_12_frame（底部数据边框）风格，与其他主区框(36/37/38)一致：
                        // 细线青蓝、无四角光点、圆角8、带"巷道设备列表"左上角标题。避免粗亮蓝异类框。
                        for c in components.iter_mut() {
                            if c.get("id").and_then(|v| v.as_str()) == Some("comp_tunnel_12_frame") {
                                if let Some(cfg) = c.get_mut("config").and_then(|v| v.as_object_mut()) {
                                    let mut fc_changed = false;
                                    let want: [(&str, serde_json::Value); 11] = [
                                        ("label", serde_json::json!("巷道设备列表")),
                                        ("labelColor", serde_json::json!("#4fc3f7")),
                                        ("labelFontSize", serde_json::json!(14)),
                                        ("labelPosition", serde_json::json!("top-left")),
                                        ("showLabel", serde_json::json!(true)),
                                        ("stroke", serde_json::json!("#4fc3f7")),
                                        ("strokeWidth", serde_json::json!(1.5)),
                                        ("borderRadius", serde_json::json!(8)),
                                        ("cornerThickness", serde_json::json!(2.5)),
                                        ("showCornerDots", serde_json::json!(false)),
                                        ("glowIntensity", serde_json::json!(3)),
                                    ];
                                    for (k, val) in want.iter() {
                                        if cfg.get(*k) != Some(val) {
                                            cfg.insert((*k).to_string(), val.clone());
                                            fc_changed = true;
                                        }
                                    }
                                    // 删除粗框遗留的虚线描边（其他主区框无）
                                    if cfg.get("strokeDasharray").is_some() {
                                        cfg.remove("strokeDasharray");
                                        fc_changed = true;
                                    }
                                    if fc_changed { views_changed = true; }
                                }
                            }
                        }
                        // 补齐 comp_tunnel_41（传感器实时监控），仅当场景中不存在时插入
                        let has_41_view = components.iter().any(|c| {
                            c.get("id").and_then(|v| v.as_str()) == Some("comp_tunnel_41")
                        });
                        if !has_41_view {
                            components.push(serde_json::json!({
                                "id": "comp_tunnel_41",
                                "type": "industrial-sensor-monitor",
                                "name": "传感器实时监控",
                                "transform": {"x": 30, "y": 670, "width": 600, "height": 580, "rotation": 0, "scale": {"x": 1, "y": 1}},
                                "layerId": "layer_default",
                                "zIndex": 17,
                                "locked": false,
                                "visible": true,
                                "config": {
                                    "title": "传感器监控",
                                    "selectedDeviceIds": [],
                                    "columns": 4,
                                    "accentColor": "#4fc3f7",
                                    "showSparkline": true,
                                    "groupBy": "type"
                                }
                            }));
                            views_changed = true;
                        }

                        // 清理 region-frame 右上角噪点（末端小斜线 + 角点圆 + 编号）：
                        //   comp_tunnel_36/37/38/40 强制 cornerSize=0, showCornerDots=false, showIndex=false
                        let noise_frame_ids = ["comp_tunnel_36", "comp_tunnel_37", "comp_tunnel_38", "comp_tunnel_40"];
                        for c in components.iter_mut() {
                            let id = c.get("id").and_then(|v| v.as_str()).unwrap_or("");
                            if !noise_frame_ids.contains(&id) { continue; }
                            if let Some(cfg) = c.get_mut("config").and_then(|v| v.as_object_mut()) {
                                let mut touched = false;
                                for (k, want) in [("cornerSize", serde_json::json!(0)), ("showCornerDots", serde_json::json!(false)), ("showIndex", serde_json::json!(false))] {
                                    if cfg.get(k) != Some(&want) {
                                        cfg.insert(k.to_string(), want);
                                        touched = true;
                                    }
                                }
                                if touched { views_changed = true; }
                            }
                        }

                        // 同步修复 views 中残留的过期 type（与 editor_components 的 type_renames 保持一致）
                        //   前端渲染用 views，如果 type 未修复会导致组件加载失败
                        for c in components.iter_mut() {
                            if let Some(t) = c.get("type").and_then(|v| v.as_str()) {
                                for (old_type, new_type) in type_renames {
                                    if t == *old_type {
                                        c.as_object_mut().unwrap().insert(
                                            "type".to_string(),
                                            serde_json::Value::String(new_type.to_string()),
                                        );
                                        views_changed = true;
                                        break;
                                    }
                                }
                            }
                        }

                        // ─── 仅替换 type + 补齐 config 缺失字段，绝不覆盖位置/尺寸/已有config ───
                        // 关键：绝不能整体替换组件，否则用户调整过的位置/大小/配置全部丢失
                        let stats_upgrade_ids = [
                            "comp_tunnel_5", "comp_tunnel_13", "comp_tunnel_14", "comp_tunnel_15",
                            "comp_tunnel_16", "comp_tunnel_17", "comp_tunnel_18",
                            "comp_tunnel_25", "comp_tunnel_26", "comp_tunnel_27", "comp_tunnel_28",
                            "comp_tunnel_29", "comp_tunnel_30", "comp_tunnel_31", "comp_tunnel_32",
                        ];
                        for (target_id, new_json) in upgrades {
                            // 只处理统计卡片和粉尘趋势图，跳过其他组件
                            if !stats_upgrade_ids.contains(target_id) { continue; }
                            let new_obj: serde_json::Value = match serde_json::from_str(new_json) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };
                            for item in components.iter_mut() {
                                if item.get("id").and_then(|v| v.as_str()) == Some(*target_id) {
                                    let old_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                    let new_type = new_obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

                                    // 1. 替换 type（但不动 transform/位置/尺寸）
                                    if old_type != new_type {
                                        if let Some(t) = new_obj.get("type") {
                                            item.as_object_mut().unwrap().insert("type".to_string(), t.clone());
                                            views_changed = true;
                                        }
                                    }

                                    // 2. 仅补齐缺失的 config 字段（不覆盖已有值）
                                    if let (Some(old_cfg), Some(new_cfg)) = (
                                        item.get_mut("config").and_then(|v| v.as_object_mut()),
                                        new_obj.get("config").and_then(|v| v.as_object()),
                                    ) {
                                        for (k, v) in new_cfg {
                                            if !old_cfg.contains_key(k) {
                                                old_cfg.insert(k.clone(), v.clone());
                                                views_changed = true;
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                        }

                        // ─── 清理 views 中引用已删除组件的 bindings ───
                        if let Some(bindings) = view.get_mut("bindings").and_then(|v| v.as_array_mut()) {
                            let old_len = bindings.len();
                            // 移除引用 comp_tunnel_5/13~18/25~32/34/35 的旧 HTTP 绑定
                            // 新版组件从 deviceStore 直接聚合，不再需要外部数据绑定
                            bindings.retain(|b| {
                                let comp_id = b.get("componentId").and_then(|v| v.as_str()).unwrap_or("");
                                // 保留 comp_tunnel_12 的绑定（设备列表仍用 HTTP 数据源）
                                if comp_id == "comp_tunnel_12" { return true; }
                                // 移除所有引用旧统计卡片/粉尘图/告警轮播/底部状态的绑定
                                let remove_ids = [
                                    "comp_tunnel_5", "comp_tunnel_13", "comp_tunnel_14", "comp_tunnel_15",
                                    "comp_tunnel_16", "comp_tunnel_17", "comp_tunnel_18",
                                    "comp_tunnel_25", "comp_tunnel_26", "comp_tunnel_27", "comp_tunnel_28",
                                    "comp_tunnel_29", "comp_tunnel_30", "comp_tunnel_31", "comp_tunnel_32",
                                    "comp_tunnel_34", "comp_tunnel_35",
                                ];
                                !remove_ids.contains(&comp_id)
                            });
                            if bindings.len() != old_len {
                                views_changed = true;
                            }
                        }
                    }
                }
                if views_changed {
                    let new_views = serde_json::to_string(&views_arr).unwrap_or(views_str);
                    conn.execute(
                        "UPDATE scenes SET views = ?1, updated_at = strftime('%s','now') WHERE id = ?2",
                        rusqlite::params![new_views, scene_id],
                    )?;
                }
            }
        }
    }

    Ok(())
}

/// 基于"巷道喷雾监控"（scene_spray_tunnel）克隆初始化"廊桥喷雾监控"（scene_spray_bridge）
/// 与"综采喷雾监控"（scene_spray_mining），使它们首次启动即为"可直接使用"的完整大屏，
/// 而非空壳占位。
///
/// 实现：深拷贝隧道场景的 editor_components / views / layout，对其中所有组件 ID 做区域前缀化
/// （comp_tunnel_* → comp_{bridge|mining}_tunnel_*），并把显示文案中的"巷道"替换为"廊桥"/"综采"。
///
/// 幂等：若目标场景已包含区域前缀组件（说明已克隆过或用户在编辑器调整过），则跳过，避免覆盖。
fn clone_tunnel_scene(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 安全检查：views / editor_components / layout 列必须存在（空库早期阶段列尚未 ALTER 时不处理）
    let scene_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scenes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    if !scene_columns.contains(&"views".to_string())
        || !scene_columns.contains(&"editor_components".to_string())
    {
        return Ok(());
    }

    // 读取隧道场景的源内容（作为克隆模板）
    let src: Option<(String, String, String)> = conn
        .query_row(
            "SELECT editor_components, views, layout FROM scenes WHERE id = 'scene_spray_tunnel'",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .ok();
    let (src_ec, src_views, src_layout) = match src {
        Some(v) => v,
        None => return Ok(()), // 隧道场景不存在，跳过（理论上 seed 已插入）
    };

    // 目标场景：(场景 id, 显示名, 组件 ID 前缀)
    let targets: &[(&str, &str, &str)] = &[
        ("scene_spray_bridge", "廊桥", "bridge"),
        ("scene_spray_mining", "综采", "mining"),
    ];

    for (scene_id, region_name, prefix) in targets {
        // 解引用为 &str，便于 rusqlite params! 与 format! 直接使用
        let scene_id: &str = *scene_id;
        // 场景不存在则跳过（理论上 seed 已插入）
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM scenes WHERE id = ?1",
                rusqlite::params![scene_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if exists == 0 {
            continue;
        }

        // 幂等：已克隆过（editor_components 含区域前缀组件）则跳过，避免覆盖用户在编辑器中的调整
        let cur_ec: String = conn
            .query_row(
                "SELECT editor_components FROM scenes WHERE id = ?1",
                rusqlite::params![scene_id],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| "[]".to_string());
        let prefix_marker = format!("comp_{}_tunnel_1", prefix);
        if cur_ec.contains(&prefix_marker) {
            continue;
        }

        // 解析源 JSON（解析失败则退化为空数组，不影响其它字段）
        let ec_val: serde_json::Value =
            serde_json::from_str(&src_ec).unwrap_or(serde_json::Value::Array(vec![]));
        let views_val: serde_json::Value =
            serde_json::from_str(&src_views).unwrap_or(serde_json::Value::Array(vec![]));
        let layout_val: serde_json::Value =
            serde_json::from_str(&src_layout).unwrap_or(serde_json::Value::Array(vec![]));

        // 深拷贝变换：前缀化组件 ID + 替换"巷道"文案
        let new_ec = transform_clone(&ec_val, prefix, region_name);
        let mut new_views = transform_clone(&views_val, prefix, region_name);
        let new_layout = transform_clone(&layout_val, prefix, region_name);

        // 区域主监控大屏显示名：view_default 的 name 应为「{区域名}喷雾监控」
        // （"默认视图"不含"巷道"二字，transform_clone 的文案替换规则不会命中，故在此专用修正）
        if let serde_json::Value::Array(views_arr) = &mut new_views {
            for v in views_arr.iter_mut() {
                if let serde_json::Value::Object(vobj) = v {
                    if vobj.get("id").and_then(|x| x.as_str()) == Some("view_default") {
                        vobj.insert(
                            "name".to_string(),
                            serde_json::Value::String(format!("{}喷雾监控", region_name)),
                        );
                    }
                }
            }
        }

        let new_ec_str = serde_json::to_string(&new_ec).unwrap_or_else(|_| "[]".to_string());
        let new_views_str = serde_json::to_string(&new_views).unwrap_or_else(|_| "[]".to_string());
        let new_layout_str =
            serde_json::to_string(&new_layout).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "UPDATE scenes SET editor_components = ?1, views = ?2, layout = ?3, updated_at = strftime('%s','now') WHERE id = ?4",
            rusqlite::params![new_ec_str, new_views_str, new_layout_str, scene_id],
        )?;
    }

    Ok(())
}

/// 递归变换克隆内容：
/// 1) 组件 ID（所有 comp_ 开头的 id，出现在 id / componentId / 任意引用字段）统一插入区域前缀：
///    comp_tunnel_5 → comp_bridge_tunnel_5、comp_log_alarm_trend → comp_bridge_log_alarm_trend、
///    comp_<时间戳>_* → comp_bridge_<时间戳>_*。已带区域前缀的（comp_<prefix>_...）不再二次加前缀。
///    注意：隧道场景的日志监控视图等组件 ID 是 comp_log_*（非 comp_tunnel_*），必须一并前缀化，
///    否则桥/采场景会出现与隧道同名的 comp_log_*，造成 ID 撞车。
/// 2) 任意字符串值中的"巷道"替换为区域名（廊桥/综采）。
fn transform_clone(
    value: &serde_json::Value,
    prefix: &str,
    region_name: &str,
) -> serde_json::Value {
    match value {
        serde_json::Value::Object(obj) => {
            let mut new_obj = serde_json::Map::new();
            for (k, v) in obj {
                new_obj.insert(k.clone(), transform_clone(v, prefix, region_name));
            }
            serde_json::Value::Object(new_obj)
        }
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(
                arr.iter()
                    .map(|v| transform_clone(v, prefix, region_name))
                    .collect(),
            )
        }
        serde_json::Value::String(s) => {
            // 文案替换：巷道 → 廊桥/综采
            let mut out = if s.contains("巷道") {
                s.replace("巷道", region_name)
            } else {
                s.clone()
            };
            // 组件 ID 前缀化：所有 comp_ 开头的组件 id 统一加区域前缀；
            // 已带本区域前缀的（comp_<prefix>_...）跳过，避免二次加前缀导致 comp_bridge_bridge_...
            let region_prefix = format!("comp_{}_", prefix);
            if out.starts_with("comp_") && !out.starts_with(&region_prefix) {
                if let Some(rest) = out.strip_prefix("comp_") {
                    out = format!("comp_{}_{}", prefix, rest);
                }
            }
            serde_json::Value::String(out)
        }
        _ => value.clone(),
    }
}

/// 对"廊桥喷雾监控"场景（scene_spray_bridge）做针对性精简，使其回归旧版 sprayv2/showlq 的极简大屏风格
/// （仅粉尘趋势 + 传感器表 + CAD 图 + 视频，无统计看板）：
///
/// 1) 移除 7 张隧道统计卡：comp_bridge_tunnel_13/14/15/25/26/27/28（从 editor_components、
///    各 view 的 components、以及 layout 三处一并剔除）。
/// 2) 重排：左侧传感器区 40/41 与左侧边框 36、右侧报警面板 42 重新定位（见 `apply_bridge_reflow`）。
/// 3) 确保 42（粉尘浓度预警报警）存在于 view_default.components 中——隧道克隆体中 42 仅存在于
///    editor_components（不在 views），而廊桥大屏需要在默认视图直接展示该面板。
///
/// 必须在 clone_tunnel_scene 之后调用（此时 bridge 已由 tunnel 克隆而来，含完整组件）。
/// 幂等：若 bridge 的 editor_components 已不含 comp_bridge_tunnel_13（已精简或用户调整过），则跳过。
fn customize_bridge_scene(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 安全检查：views / editor_components / layout 列须存在
    let scene_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scenes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    if !scene_columns.contains(&"views".to_string())
        || !scene_columns.contains(&"editor_components".to_string())
    {
        return Ok(());
    }

    let scene_id = "scene_spray_bridge";

    // 幂等守卫：已含有水流量卡 comp_bridge_flow_1 说明定制（含水流量注入）已完成，跳过以免覆盖用户调整。
    // 注意：原守卫基于 comp_bridge_tunnel_13 是否存在；现改为基于水流量卡，使"已精简(13 已删)但水流量卡未注入"的库
    // 也能补注入（如早期已手工定制的开发库）。
    let cur_ec: String = conn
        .query_row(
            "SELECT editor_components FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "[]".to_string());
    if cur_ec.contains("comp_bridge_flow_1") {
        return Ok(());
    }

    // 读取当前 bridge 场景内容（已含 clone 结果）
    let (ec_str, views_str, layout_str): (String, String, String) = conn
        .query_row(
            "SELECT editor_components, views, layout FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        )
        .unwrap_or_else(|_| ("[]".to_string(), "[]".to_string(), "[]".to_string()));

    let mut ec: serde_json::Value =
        serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
    let mut views: serde_json::Value =
        serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
    let mut layout: serde_json::Value =
        serde_json::from_str(&layout_str).unwrap_or(serde_json::Value::Array(vec![]));

    // 要移除的 7 张隧道统计卡
    let remove: &[&str] = &[
        "comp_bridge_tunnel_13",
        "comp_bridge_tunnel_14",
        "comp_bridge_tunnel_15",
        "comp_bridge_tunnel_25",
        "comp_bridge_tunnel_26",
        "comp_bridge_tunnel_27",
        "comp_bridge_tunnel_28",
    ];

    // 1) editor_components 移除统计卡 + 重排 + 控制工具栏 sceneMode 修正
    if let serde_json::Value::Array(arr) = &mut ec {
        arr.retain(|c| !remove.contains(&c.get("id").and_then(|v| v.as_str()).unwrap_or("")));
        for c in arr.iter_mut() {
            apply_bridge_reflow(c);
            set_bridge_control_mode(c);
        }
    }

    // 2) 各 view 的 components 移除统计卡 + 重排 + 控制工具栏 sceneMode 修正
    if let serde_json::Value::Array(views_arr) = &mut views {
        for v in views_arr.iter_mut() {
            if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                comps.retain(|c| !remove.contains(&c.get("id").and_then(|x| x.as_str()).unwrap_or("")));
                for c in comps.iter_mut() {
                    apply_bridge_reflow(c);
                    set_bridge_control_mode(c);
                }
            }
        }
        // 确保 42 在 view_default.components（从 editor_components 复制并强制 transform）
        if let Some(vd) = views_arr
            .iter_mut()
            .find(|v| v.get("id").and_then(|x| x.as_str()) == Some("view_default"))
        {
            if let Some(comps) = vd.get_mut("components").and_then(|c| c.as_array_mut()) {
                let has42 = comps
                    .iter()
                    .any(|c| c.get("id").and_then(|x| x.as_str()) == Some("comp_bridge_tunnel_42"));
                if !has42 {
                    if let serde_json::Value::Array(ec_arr) = &ec {
                        if let Some(c42) = ec_arr
                            .iter()
                            .find(|c| c.get("id").and_then(|x| x.as_str()) == Some("comp_bridge_tunnel_42"))
                        {
                            let mut c42 = c42.clone();
                            if let Some(tf) = c42.get_mut("transform").and_then(|t| t.as_object_mut()) {
                                tf.insert("x".to_string(), serde_json::json!(2890));
                                tf.insert("y".to_string(), serde_json::json!(1320));
                                tf.insert("width".to_string(), serde_json::json!(910));
                                tf.insert("height".to_string(), serde_json::json!(540));
                            }
                            comps.push(c42);
                        }
                    }
                }
            }
        }
    }

    // 3) layout 移除统计卡 + 重排（layout 用 w/h 而非 width/height）
    if let serde_json::Value::Array(arr) = &mut layout {
        arr.retain(|c| {
            !remove.contains(&c.get("componentId").and_then(|x| x.as_str()).unwrap_or(""))
        });
        for c in arr.iter_mut() {
            let id = c.get("componentId").and_then(|x| x.as_str()).unwrap_or("");
            match id {
                "comp_bridge_tunnel_40" => {
                    set_i64_field(c, "y", 660);
                    set_i64_field(c, "h", 1160);
                }
                "comp_bridge_tunnel_41" => {
                    set_i64_field(c, "y", 670);
                    set_i64_field(c, "h", 1150);
                }
                _ => {}
            }
        }
    }

    // 4) 注入廊桥专属水流量监测卡片（老项目 showlq 左栏核心指标，协议 0x0626 流量数据可采集；
    //    复用 industrial-stats-card 全局聚合，不读 selectedDeviceIds，动态绑定合规）
    inject_bridge_flow_cards(&mut ec, &mut views, &mut layout);

    let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
    let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
    let new_layout = serde_json::to_string(&layout).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "UPDATE scenes SET editor_components = ?1, views = ?2, layout = ?3, updated_at = strftime('%s','now') WHERE id = ?4",
        rusqlite::params![new_ec, new_views, new_layout, scene_id],
    )?;

    Ok(())
}

/// 对"综采喷雾监控"场景（scene_spray_mining）做针对性定制，使其完整对齐旧版 sprayv2/showzc
/// （采煤工作面监控：煤机位置/方向、移架/落架/放煤、支架状态表、粉尘浓度、视频、定时、告警、控制按钮），
/// 并超越老项目的静态 GIF 大屏（新系统有 3D SensorFrame 造型、粉尘趋势曲线、滚动状态表等更强载体）。
///
/// 定制内容：
/// 1) 移除 7 张隧道统计卡：comp_mining_tunnel_13/14/15/25/26/27/28（从 editor_components、
///    各 view 的 components、以及 layout 三处一并剔除）。旧版 showzc 无这些 KPI 看板，且协议无对应采集字段。
/// 2) 重排：左区 40/41 与右区 42 拉伸填补删卡后的空白（见 `apply_mining_reflow`）。
/// 3) 综采喷雾控制工具栏（21）的 sceneMode 由克隆源的 "tunnel" 改为 "mining"，
///    使其显示综采专属控制按钮（前喷/后喷/清洗/强喷/强停/自动）而非巷道按钮。
/// 4) 确保 42（粉尘浓度预警报警）存在于 view_default.components 中——隧道克隆体中 42 仅存在于
///    editor_components（不在 views），而综采大屏需要在默认视图直接展示该面板。
///
/// 必须在 clone_tunnel_scene 之后调用（此时 mining 已由 tunnel 克隆而来，含完整组件）。
/// 幂等：若 view_default.components 已含 comp_mining_tunnel_42（定制已注入），则跳过以免覆盖用户调整。
fn customize_mining_scene(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 安全检查：views / editor_components / layout 列须存在
    let scene_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scenes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    if !scene_columns.contains(&"views".to_string())
        || !scene_columns.contains(&"editor_components".to_string())
    {
        return Ok(());
    }

    let scene_id = "scene_spray_mining";

    // 幂等守卫：view_default.components 已含 42 说明定制（含 42 注入）已完成，跳过以免覆盖用户调整。
    let views_cur: String = conn
        .query_row(
            "SELECT views FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "[]".to_string());
    if let Ok(views_val) = serde_json::from_str::<serde_json::Value>(&views_cur) {
        if let Some(views_arr) = views_val.as_array() {
            if let Some(vd) = views_arr
                .iter()
                .find(|v| v.get("id").and_then(|x| x.as_str()) == Some("view_default"))
            {
                if let Some(comps) = vd.get("components").and_then(|c| c.as_array()) {
                    if comps.iter().any(|c| {
                        c.get("id").and_then(|x| x.as_str()) == Some("comp_mining_tunnel_42")
                    }) {
                        return Ok(());
                    }
                }
            }
        }
    }

    // 读取当前 mining 场景内容（已含 clone 结果）
    let (ec_str, views_str, layout_str): (String, String, String) = conn
        .query_row(
            "SELECT editor_components, views, layout FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        )
        .unwrap_or_else(|_| ("[]".to_string(), "[]".to_string(), "[]".to_string()));

    let mut ec: serde_json::Value =
        serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
    let mut views: serde_json::Value =
        serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
    let mut layout: serde_json::Value =
        serde_json::from_str(&layout_str).unwrap_or(serde_json::Value::Array(vec![]));

    // 要移除的 7 张隧道统计卡
    let remove: &[&str] = &[
        "comp_mining_tunnel_13",
        "comp_mining_tunnel_14",
        "comp_mining_tunnel_15",
        "comp_mining_tunnel_25",
        "comp_mining_tunnel_26",
        "comp_mining_tunnel_27",
        "comp_mining_tunnel_28",
    ];

    // 1) editor_components 移除统计卡 + 重排 + 控制工具栏 sceneMode 修正
    if let serde_json::Value::Array(arr) = &mut ec {
        arr.retain(|c| !remove.contains(&c.get("id").and_then(|v| v.as_str()).unwrap_or("")));
        for c in arr.iter_mut() {
            apply_mining_reflow(c);
            set_mining_control_mode(c);
        }
    }

    // 2) 各 view 的 components 移除统计卡 + 重排 + 控制工具栏 sceneMode 修正
    if let serde_json::Value::Array(views_arr) = &mut views {
        for v in views_arr.iter_mut() {
            if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                comps.retain(|c| !remove.contains(&c.get("id").and_then(|x| x.as_str()).unwrap_or("")));
                for c in comps.iter_mut() {
                    apply_mining_reflow(c);
                    set_mining_control_mode(c);
                }
            }
        }
        // 确保 42 在 view_default.components（从 editor_components 复制并施加综采重排 transform）
        if let Some(vd) = views_arr
            .iter_mut()
            .find(|v| v.get("id").and_then(|x| x.as_str()) == Some("view_default"))
        {
            if let Some(comps) = vd.get_mut("components").and_then(|c| c.as_array_mut()) {
                let has42 = comps
                    .iter()
                    .any(|c| c.get("id").and_then(|x| x.as_str()) == Some("comp_mining_tunnel_42"));
                if !has42 {
                    if let serde_json::Value::Array(ec_arr) = &ec {
                        if let Some(c42) = ec_arr
                            .iter()
                            .find(|c| c.get("id").and_then(|x| x.as_str()) == Some("comp_mining_tunnel_42"))
                        {
                            let mut c42 = c42.clone();
                            apply_mining_reflow(&mut c42);
                            if let Some(tf) = c42.get_mut("transform").and_then(|t| t.as_object_mut()) {
                                if tf.get("x").is_none() {
                                    tf.insert("x".to_string(), serde_json::json!(2890));
                                }
                                if tf.get("width").is_none() {
                                    tf.insert("width".to_string(), serde_json::json!(910));
                                }
                            }
                            comps.push(c42);
                        }
                    }
                }
            }
        }
    }

    // 3) layout 移除统计卡 + 重排（layout 用 w/h 而非 width/height）
    if let serde_json::Value::Array(arr) = &mut layout {
        arr.retain(|c| {
            !remove.contains(&c.get("componentId").and_then(|x| x.as_str()).unwrap_or(""))
        });
        for c in arr.iter_mut() {
            let id = c.get("componentId").and_then(|x| x.as_str()).unwrap_or("");
            match id {
                "comp_mining_tunnel_40" => {
                    set_i64_field(c, "y", 660);
                    set_i64_field(c, "h", 1200);
                }
                "comp_mining_tunnel_41" => {
                    set_i64_field(c, "y", 670);
                    set_i64_field(c, "h", 1190);
                }
                _ => {}
            }
        }
    }

    let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
    let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
    let new_layout = serde_json::to_string(&layout).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "UPDATE scenes SET editor_components = ?1, views = ?2, layout = ?3, updated_at = strftime('%s','now') WHERE id = ?4",
        rusqlite::params![new_ec, new_views, new_layout, scene_id],
    )?;

    Ok(())
}

/// 综采专属：注入煤机位置趋势曲线组件（comp_mining_tunnel_43）。
/// 该组件（industrial-shearer-curve）复用 DustTrendRenderer 的 deviceStore 实时 + GreptimeDB 历史模式，
/// 等价于老项目 showzc 的煤机位置曲线；后端 data_processor.rs 已将 coalMachine.coalPosition /
/// coalMachine.motionDirection 落库 GreptimeDB（product_code=18, scene_mode="mining"），曲线可拉取真实历史。
///
/// 落点：中框(37) 下方、喷雾工具栏(21 底 y1685) 与滚动状态表(12 y1880) 之间的空闲带，
/// 居中整宽（x680, y1695, w2160, h170），与廊桥水流量卡(680/1280, y1695) 同高但更宽（综采用单条曲线不用双卡）。
/// 幂等：editor_components 已含 43 则直接跳过（与 customize_mining_scene 的 42 守卫相互独立，互不覆盖）。
fn inject_shearer_curve(conn: &Connection) -> Result<(), rusqlite::Error> {
    let scene_id = "scene_spray_mining";

    // 读取场景（场景不存在则跳过，防御性）
    let (ec_str, views_str, layout_str): (String, String, String) = match conn.query_row(
        "SELECT editor_components, views, layout FROM scenes WHERE id = ?1",
        rusqlite::params![scene_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
    ) {
        Ok(t) => t,
        Err(_) => return Ok(()),
    };

    let mut ec: serde_json::Value =
        serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
    let mut views: serde_json::Value =
        serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
    let mut layout: serde_json::Value =
        serde_json::from_str(&layout_str).unwrap_or(serde_json::Value::Array(vec![]));

    // 幂等：editor_components 已含 43 则跳过
    if let serde_json::Value::Array(arr) = &ec {
        if arr
            .iter()
            .any(|c| c.get("id").and_then(|v| v.as_str()) == Some("comp_mining_tunnel_43"))
        {
            return Ok(());
        }
    }

    let comp = serde_json::json!({
        "id": "comp_mining_tunnel_43",
        "type": "industrial-shearer-curve",
        "name": "煤机位置曲线",
        "transform": {"x": 680, "y": 1695, "width": 2160, "height": 170, "rotation": 0, "scale": {"x": 1, "y": 1}},
        "layerId": "layer_default",
        "zIndex": 50,
        "locked": false,
        "visible": true,
        "config": {
            "title": "煤机位置曲线",
            "smooth": true,
            "showArea": true,
            "showDataZoom": true,
            "yAxisName": "位置(号)",
            "selectedDeviceIds": [],
            "valuePrecision": 0,
            "historyEnabled": true,
            "historyRange": "6h",
            "historyAgg": "auto",
            "historyAutoRefresh": true,
            "yAxisMin": null,
            "yAxisMax": null
        }
    });

    // editor_components
    if let serde_json::Value::Array(arr) = &mut ec {
        arr.push(comp.clone());
    }
    // view_default.components
    if let serde_json::Value::Array(views_arr) = &mut views {
        for v in views_arr.iter_mut() {
            if v.get("id").and_then(|x| x.as_str()) == Some("view_default") {
                if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    if !comps.iter().any(|c| {
                        c.get("id").and_then(|x| x.as_str()) == Some("comp_mining_tunnel_43")
                    }) {
                        comps.push(comp.clone());
                    }
                }
            }
        }
    }
    // layout（稀疏 {componentId,x,y,w,h,zIndex}，渲染不使用但保持结构一致）
    if let serde_json::Value::Array(arr) = &mut layout {
        if !arr.iter().any(|c| {
            c.get("componentId").and_then(|v| v.as_str()) == Some("comp_mining_tunnel_43")
        }) {
            arr.push(serde_json::json!({
                "componentId": "comp_mining_tunnel_43",
                "x": 680, "y": 1695, "w": 2160, "h": 170, "zIndex": 50
            }));
        }
    }

    let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
    let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
    let new_layout = serde_json::to_string(&layout).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "UPDATE scenes SET editor_components = ?1, views = ?2, layout = ?3, updated_at = strftime('%s','now') WHERE id = ?4",
        rusqlite::params![new_ec, new_views, new_layout, scene_id],
    )?;

    Ok(())
}

/// 在组件对象（editor_components 或 view.components 中的一项）上重排综采大屏的关键组件 transform：
/// 拉伸左区 40/41 与右区 42 填补删除 7 张统计卡后的空白（仅调整 y / height，x / width 保持克隆原值）。
/// 非目标组件原样返回。
fn apply_mining_reflow(comp: &mut serde_json::Value) {
    let id = comp.get("id").and_then(|x| x.as_str()).unwrap_or("");
    let (y, h): (i64, i64) = match id {
        "comp_mining_tunnel_40" => (660, 1200),
        "comp_mining_tunnel_41" => (670, 1190),
        "comp_mining_tunnel_42" => (1320, 540),
        _ => return,
    };
    if let Some(tf) = comp.get_mut("transform").and_then(|t| t.as_object_mut()) {
        tf.insert("y".to_string(), serde_json::json!(y));
        tf.insert("height".to_string(), serde_json::json!(h));
    }
}

/// 综采的喷雾控制工具栏必须按综采自身模式运行：克隆源（巷道）的 `sceneMode` 是 "tunnel"，
/// 会导致综采显示巷道控制按钮与设备。这里统一改为 "mining"（sceneMode 枚举：tunnel|bridge|mining|scene5）。
/// 仅作用于 `industrial-spray-control-toolbar` 类型组件，其余组件不受影响。
fn set_mining_control_mode(comp: &mut serde_json::Value) {
    let is_toolbar =
        comp.get("type").and_then(|v| v.as_str()) == Some("industrial-spray-control-toolbar");
    if !is_toolbar {
        return;
    }
    if let Some(cfg) = comp.get_mut("config").and_then(|c| c.as_object_mut()) {
        cfg.insert("sceneMode".to_string(), serde_json::json!("mining"));
    }
}

/// 在组件对象（editor_components 或 view.components 中的一项）上重排廊桥大屏的关键组件 transform：
/// 仅调整 y / height（x / width 保持克隆原值），使左区传感器区与右侧报警面板布局回到极简风格。
/// 非目标组件原样返回。
fn apply_bridge_reflow(comp: &mut serde_json::Value) {
    let id = comp.get("id").and_then(|x| x.as_str()).unwrap_or("");
    let (y, h): (i64, i64) = match id {
        "comp_bridge_tunnel_40" => (660, 1160),
        "comp_bridge_tunnel_41" => (670, 1150),
        "comp_bridge_tunnel_42" => (1320, 540),
        "comp_bridge_tunnel_36" => (190, 1640),
        _ => return,
    };
    if let Some(tf) = comp.get_mut("transform").and_then(|t| t.as_object_mut()) {
        tf.insert("y".to_string(), serde_json::json!(y));
        tf.insert("height".to_string(), serde_json::json!(h));
    }
}

/// 廊桥的喷雾控制工具栏必须按廊桥自身模式运行：克隆源（巷道）的 `sceneMode` 是 "tunnel"，
/// 会导致廊桥显示巷道控制按钮与设备。这里统一改为 "bridge"（sceneMode 枚举：tunnel|bridge|mining|scene5）。
/// 仅作用于 `industrial-spray-control-toolbar` 类型组件，其余组件不受影响。
fn set_bridge_control_mode(comp: &mut serde_json::Value) {
    let is_toolbar =
        comp.get("type").and_then(|v| v.as_str()) == Some("industrial-spray-control-toolbar");
    if !is_toolbar {
        return;
    }
    if let Some(cfg) = comp.get_mut("config").and_then(|c| c.as_object_mut()) {
        cfg.insert("sceneMode".to_string(), serde_json::json!("bridge"));
    }
}

/// 廊桥专属：注入 2 张水流量监测卡片（老项目 showlq 左栏核心指标，协议 0x0626 流量数据设备主动上报可采集）。
/// 复用 `industrial-stats-card` + `IndustrialStatsCardRenderer` 的全局聚合（按 productCode=18040 流量计），
/// 不读 selectedDeviceIds —— 动态绑定合规（与 DustTrendRenderer 的 globalFallback 思路一致）。
///
/// 落点：中框(37, x665~2855, y190~1870) 下方、喷雾工具栏(21, y 底 1685) 与中框底(1870) 之间的空闲带，
/// 不挤占现有组件。幂等：已存在则跳过。
fn inject_bridge_flow_cards(
    ec: &mut serde_json::Value,
    views: &mut serde_json::Value,
    layout: &mut serde_json::Value,
) {
    let cards: Vec<serde_json::Value> = vec![
        serde_json::json!({
            "id": "comp_bridge_flow_1",
            "type": "industrial-stats-card",
            "name": "廊桥累计用水",
            "transform": {"x": 680, "y": 1695, "width": 580, "height": 165, "rotation": 0, "scale": {"x": 1, "y": 1}},
            "layerId": "layer_default",
            "zIndex": 50,
            "locked": false,
            "visible": true,
            "config": {
                "statType": "water_usage_total",
                "cardName": "廊桥累计用水",
                "iconType": "water",
                "unit": "m³",
                "color": "#4fc3f7",
                "theme": "dark",
                "precision": 2
            }
        }),
        serde_json::json!({
            "id": "comp_bridge_flow_2",
            "type": "industrial-stats-card",
            "name": "廊桥瞬时流量",
            "transform": {"x": 1280, "y": 1695, "width": 580, "height": 165, "rotation": 0, "scale": {"x": 1, "y": 1}},
            "layerId": "layer_default",
            "zIndex": 51,
            "locked": false,
            "visible": true,
            "config": {
                "statType": "total_flow",
                "cardName": "廊桥瞬时流量",
                "iconType": "flow",
                "unit": "L/s",
                "color": "#4fc3f7",
                "theme": "dark",
                "precision": 2
            }
        }),
    ];

    for card in &cards {
        let cid = card.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        // editor_components
        if let Some(arr) = ec.as_array_mut() {
            if !arr
                .iter()
                .any(|c| c.get("id").and_then(|v| v.as_str()) == Some(cid))
            {
                arr.push(card.clone());
            }
        }
        // view_default.components
        if let Some(views_arr) = views.as_array_mut() {
            for v in views_arr.iter_mut() {
                if v.get("id").and_then(|x| x.as_str()) == Some("view_default") {
                    if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                        if !comps
                            .iter()
                            .any(|c| c.get("id").and_then(|v| v.as_str()) == Some(cid))
                        {
                            comps.push(card.clone());
                        }
                    }
                }
            }
        }
        // layout（稀疏 {componentId,x,y,w,h,zIndex}，渲染不使用但保持结构一致）
        if let Some(arr) = layout.as_array_mut() {
            if !arr
                .iter()
                .any(|c| c.get("componentId").and_then(|v| v.as_str()) == Some(cid))
            {
                let tf = card.get("transform").and_then(|t| t.as_object());
                let get = |k: &str| {
                    tf.and_then(|t| t.get(k)).cloned().unwrap_or(serde_json::json!(0))
                };
                arr.push(serde_json::json!({
                    "componentId": cid,
                    "x": get("x"),
                    "y": get("y"),
                    "w": get("width"),
                    "h": get("height"),
                    "zIndex": card.get("zIndex").cloned().unwrap_or(serde_json::json!(50))
                }));
            }
        }
    }
}

/// 跨三场景：注入底部告警滚动条（industrial-alarm-carousel），对标 sprayv2 三页共有的"底部告警滚动"，
/// 并顺带做布局对齐（消除用户反馈的左/中/右三栏底部边框不齐）：
///  - 三栏 region-frame(36/37/38) 底部统一到 y=1880，与底部滚动数据列表顶部齐平；
///  - 底部滚动数据列表(comp_*_12, 即 industrial-scrolling-table) 高度由 280 缩为 190，
///    让出底部 80px 给告警滚动条；告警滚动条满宽置于画布最底(y=2080,h=80)。
/// 动态绑定：selectedDeviceIds 留空，由渲染器按 productCode=18 自动发现集控器告警。
/// 幂等：场景 editor_components 已含对应 alarm_carousel id 则整段跳过（含对齐/缩放，避免重复叠加）。
/// 移除底部告警滚动条（industrial-alarm-carousel 与旧版 comp_tunnel_34），
/// 并修复三栏底部对齐 + 恢复底部数据列表满高：
/// 移除底部告警滚动条（industrial-alarm-carousel 与旧版 comp_tunnel_34），
/// 并对齐三栏 region-frame 与底部数据列表：
///  - 删除三场景 editor_components/views/layout 中的 comp_tunnel_34 与 comp_*_alarm_carousel；
///  - 三栏 region-frame(36/37/38) 底部统一到 y=1880（h=1690），与底部数据列表顶部齐平；
///  - 底部滚动状态表格(comp_*_12) 内缩 12px，便于后续边框装饰（不再注入独立 12_frame，
///    边框由前端 ComponentFrame 覆盖层按组件自带 frame 配置绘制）。
/// 幂等：组件不存在时跳过删除；对齐/高度已正确时跳过写入（不更新 updated_at）。
fn remove_alarm_carousel(conn: &Connection) -> Result<(), rusqlite::Error> {
    // (scene_id, region36, region37, region38, scrolling_table_id)
    let scenes: Vec<(&str, &str, &str, &str, &str)> = vec![
        ("scene_spray_tunnel", "comp_tunnel_36", "comp_tunnel_37", "comp_tunnel_38", "comp_tunnel_12"),
        ("scene_spray_bridge", "comp_bridge_tunnel_36", "comp_bridge_tunnel_37", "comp_bridge_tunnel_38", "comp_bridge_tunnel_12"),
        ("scene_spray_mining", "comp_mining_tunnel_36", "comp_mining_tunnel_37", "comp_mining_tunnel_38", "comp_mining_tunnel_12"),
    ];

    for (scene_id, r36, r37, r38, st_id) in scenes {
        let (ec_str, views_str, layout_str): (String, String, String) = match conn.query_row(
            "SELECT editor_components, views, layout FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
            },
        ) {
            Ok(t) => t,
            Err(_) => continue,
        };

        let mut ec: serde_json::Value =
            serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut views: serde_json::Value =
            serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut layout: serde_json::Value =
            serde_json::from_str(&layout_str).unwrap_or(serde_json::Value::Array(vec![]));

        let suffix = scene_id.strip_prefix("scene_spray_").unwrap_or(scene_id);
        let alarm_id = format!("comp_{}_alarm_carousel", suffix);
        // 需要删除的组件 id（旧版告警轮播栏 + 本会话注入的告警滚动条）
        let drop_ids: Vec<String> = vec!["comp_tunnel_34".to_string(), alarm_id.clone()];

        let mut changed = false;

        // ── 1) 删除告警滚动组件（editor_components / views / layout）──
        if let serde_json::Value::Array(arr) = &mut ec {
            let before = arr.len();
            arr.retain(|c| {
                let id = c.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                !drop_ids.iter().any(|x| x == &id)
            });
            if arr.len() != before {
                changed = true;
            }
        }
        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                if let Some(comps) = v.get_mut("components") {
                    if let Some(arr) = comps.as_array_mut() {
                        let before = arr.len();
                        arr.retain(|c| {
                            let id = c.get("id").and_then(|x| x.as_str()).unwrap_or("").to_string();
                            !drop_ids.iter().any(|x| x == &id)
                        });
                        if arr.len() != before {
                            changed = true;
                        }
                    }
                }
            }
        }
        if let serde_json::Value::Array(arr) = &mut layout {
            let before = arr.len();
            arr.retain(|c| {
                let id = c.get("componentId").and_then(|v| v.as_str()).unwrap_or("").to_string();
                !drop_ids.iter().any(|x| x == &id)
            });
            if arr.len() != before {
                changed = true;
            }
        }

        // ── 2) 对齐三栏 region-frame 到 y=190/h=1690（底部 1880）──
        let region_ids: [&str; 3] = [r36, r37, r38];
        for id in region_ids.iter() {
            let id = *id;
            if set_comp_yh(&mut ec, id, 190, 1690) {
                changed = true;
            }
            if set_views_yh(&mut views, id, 190, 1690) {
                changed = true;
            }
            if set_layout_yh(&mut layout, id, 190, 1690) {
                changed = true;
            }
        }

        // ── 3) 底部滚动状态表格 comp_*_12 内缩 12px，给外圈边框让位 ──
        if set_comp_rect(&mut ec, st_id, 12, 1892, 3816, 256) {
            changed = true;
        }
        if set_views_rect(&mut views, st_id, 12, 1892, 3816, 256) {
            changed = true;
        }
        if set_layout_rect(&mut layout, st_id, 12, 1892, 3816, 256) {
            changed = true;
        }

        // 步骤 4（注入独立底部数据边框 comp_*_12_frame）已移除：
        // 2026-08-22 起改为每个内容组件自带边框装饰（见 apply_component_frame_decorations）。

        if !changed {
            continue;
        }

        let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
        let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
        let new_layout = serde_json::to_string(&layout).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "UPDATE scenes SET editor_components = ?1, views = ?2, layout = ?3, updated_at = strftime('%s','now') WHERE id = ?4",
            rusqlite::params![new_ec, new_views, new_layout, scene_id],
        )?;
    }

    Ok(())
}

/// 三喷雾场景全部 region-frame 边框：统一写入「霓虹 + 闪烁 + 每框独立色」样式。
/// - pulse=true（呼吸/闪烁）、neonFlicker=true（锐利霓虹明灭）、glowEnabled=true + glowColor=模块色 + glowIntensity=3（霓虹辉光）
/// - stroke / labelColor / indexColor 均设为该模块专属霓虹色，实现「每个模块颜色不一样」。
/// 幂等：仅当实际有差异时才写入（不更新 updated_at）。仅作用于三喷雾场景的 region-frame 组件。
fn style_spray_frames(conn: &Connection) -> Result<(), rusqlite::Error> {
    let scenes: Vec<&str> = vec!["scene_spray_tunnel", "scene_spray_bridge", "scene_spray_mining"];
    for scene_id in scenes {
        let (ec_str, views_str): (String, String) = match conn.query_row(
            "SELECT editor_components, views FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        ) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let mut ec: serde_json::Value =
            serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut views: serde_json::Value =
            serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut changed = false;

        // editor_components
        if let serde_json::Value::Array(arr) = &mut ec {
            for item in arr.iter_mut() {
                if item.get("type").and_then(|v| v.as_str()) != Some("region-frame") {
                    continue;
                }
                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let color = frame_color(&id);
                let is_bottom = id.ends_with("_12_frame");
                if let Some(cfg) = item.get_mut("config") {
                    // 底部数据边框与其他主区框(36/37/38)保持一致的细线霓虹风格（strong=false），
                    // 不单独加粗加亮（之前 strong=true 导致底部框粗亮蓝异类，与用户"和其他保持一致"相悖）。
                    if set_frame_style(cfg, color, false) {
                        changed = true;
                    }
                }
                // 底部边框提到表格(z17)之上，确保整框霓虹可见、不被表格暗底吞掉
                if is_bottom {
                    let cur_z = item.get("zIndex").and_then(|v| v.as_i64()).unwrap_or(0);
                    if cur_z != 18 {
                        if let Some(o) = item.as_object_mut() {
                            o.insert("zIndex".to_string(), serde_json::json!(18));
                            changed = true;
                        }
                    }
                }
            }
        }

        // views -> view_default.components
        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                if v.get("id").and_then(|x| x.as_str()) != Some("view_default") {
                    continue;
                }
                if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    for item in comps.iter_mut() {
                        if item.get("type").and_then(|v| v.as_str()) != Some("region-frame") {
                            continue;
                        }
                        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let color = frame_color(&id);
                        let is_bottom = id.ends_with("_12_frame");
                        if let Some(cfg) = item.get_mut("config") {
                            // 底部数据边框与其他主区框(36/37/38)保持一致的细线霓虹风格（strong=false）。
                            if set_frame_style(cfg, color, false) {
                                changed = true;
                            }
                        }
                        // 底部边框提到表格(z17)之上，确保整框霓虹可见、不被表格暗底吞掉
                        if is_bottom {
                            let cur_z = item.get("zIndex").and_then(|v| v.as_i64()).unwrap_or(0);
                            if cur_z != 18 {
                                if let Some(o) = item.as_object_mut() {
                                    o.insert("zIndex".to_string(), serde_json::json!(18));
                                    changed = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        if !changed {
            continue;
        }
        let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
        let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE scenes SET editor_components = ?1, views = ?2, updated_at = strftime('%s','now') WHERE id = ?3",
            rusqlite::params![new_ec, new_views, scene_id],
        )?;
    }
    Ok(())
}

/// 2026-08-22 边框方案重构：删除独立的底部数据边框（comp_*_12_frame），
/// 改为每个内容组件自带边框装饰（边框 / 四角 / 发光 / 动画 / 流光）。
/// 本函数幂等：
///   1) 删除三喷雾场景中残留的 *_12_frame 组件（editor_components / views / layout）；
///   2) 为每个非结构性内容组件注入统一的青蓝细线 `frame` 配置（仅当 config.frame 不存在时写入，
///      不覆盖用户后续调整）。前端 EditorCanvasComponent 用 ComponentFrame 覆盖层读取该配置绘制边框。
fn apply_component_frame_decorations(conn: &Connection) -> Result<(), rusqlite::Error> {
    let frame_default = serde_json::json!({
        "enabled": true,
        "stroke": "#4fc3f7",
        "strokeWidth": 1.5,
        "strokeDasharray": "",
        "borderRadius": 8,
        "cornerLength": 40,
        "cornerThickness": 2.5,
        "cornerSize": 12,
        "cornerStyle": "rounded",
        "showCornerDots": true,
        "cornerDotSize": 4,
        "glowEnabled": true,
        "glowColor": "#4fc3f7",
        "glowIntensity": 3,
        "pulse": true,
        "neonFlicker": false,
        "flowLight": true,
        "flowSpeed": 5000,
        "fillColor": "rgba(79,195,247,0)",
        "fillOpacity": 0,
        "opacity": 1,
        "showIndex": false,
        "showLabel": false,
        "label": "",
        "indexText": "01"
    });

    let scenes: Vec<&str> = vec!["scene_spray_tunnel", "scene_spray_bridge", "scene_spray_mining"];
    for scene_id in scenes {
        let (ec_str, views_str, layout_str): (String, String, String) = match conn.query_row(
            "SELECT editor_components, views, layout FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
        ) {
            Ok(t) => t,
            Err(_) => continue,
        };

        let mut ec: serde_json::Value =
            serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut views: serde_json::Value =
            serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut layout: serde_json::Value =
            serde_json::from_str(&layout_str).unwrap_or(serde_json::Value::Array(vec![]));

        let mut changed = false;

        // 1) 删除残留的 *_12_frame 组件（旧独立底部数据边框）
        if let serde_json::Value::Array(arr) = &mut ec {
            let before = arr.len();
            arr.retain(|c| {
                let id = c.get("id").and_then(|v| v.as_str()).unwrap_or("");
                !id.ends_with("_12_frame")
            });
            if arr.len() != before {
                changed = true;
            }
        }
        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    let before = comps.len();
                    comps.retain(|c| {
                        let id = c.get("id").and_then(|x| x.as_str()).unwrap_or("");
                        !id.ends_with("_12_frame")
                    });
                    if comps.len() != before {
                        changed = true;
                    }
                }
            }
        }
        if let serde_json::Value::Array(arr) = &mut layout {
            let before = arr.len();
            arr.retain(|c| {
                let id = c.get("componentId").and_then(|v| v.as_str()).unwrap_or("");
                !id.ends_with("_12_frame")
            });
            if arr.len() != before {
                changed = true;
            }
        }

        // 2) 为每个内容组件注入 frame 配置（不存在才写，不覆盖已有/用户调整）
        let decorate = |item: &mut serde_json::Value, changed: &mut bool| {
            let ty = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if is_frame_excluded(ty) {
                return;
            }
            if let Some(cfg) = item.get_mut("config").and_then(|v| v.as_object_mut()) {
                if !cfg.contains_key("frame") {
                    cfg.insert("frame".to_string(), frame_default.clone());
                    *changed = true;
                }
            }
        };

        if let serde_json::Value::Array(arr) = &mut ec {
            for item in arr.iter_mut() {
                decorate(item, &mut changed);
            }
        }
        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    for item in comps.iter_mut() {
                        decorate(item, &mut changed);
                    }
                }
            }
        }

        if !changed {
            continue;
        }

        let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
        let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
        let new_layout = serde_json::to_string(&layout).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "UPDATE scenes SET editor_components = ?1, views = ?2, layout = ?3, updated_at = strftime('%s','now') WHERE id = ?4",
            rusqlite::params![new_ec, new_views, new_layout, scene_id],
        )?;
    }

    Ok(())
}

/// 边框覆盖层排除清单（与前端 EditorCanvasComponent.isFrameExcluded 保持一致）：
/// region-frame（结构性外框）/ top-glow-title-frame（标题栏原生边框）/ cad-enhancer（CAD 装饰）/
/// datav-border / datav-decoration / decoration-*（纯装饰）/ *_12_frame（旧底部边框，已删除）。
fn is_frame_excluded(t: &str) -> bool {
    if t == "region-frame" || t == "top-glow-title-frame" || t == "cad-enhancer" {
        return true;
    }
    if t.starts_with("datav-border")
        || t.starts_with("datav-decoration")
        || t.starts_with("decoration-")
        || t.ends_with("_12_frame")
    {
        return true;
    }
    false
}

/// 把统一边框样式写入某个 region-frame 的 config（仅当不同才改）。返回是否有改动。
/// `strong`=true 时（底部滚动状态表格边框 *_12_frame）额外加粗描边/辉光/角标，确保霓虹在薄条上足够明显。
fn set_frame_style(cfg: &mut serde_json::Value, color: &str, strong: bool) -> bool {
    let mut changed = false;
    if let Some(o) = cfg.as_object_mut() {
        let glow_intensity = if strong { 6 } else { 3 };
        let line_intensity = if strong { 6 } else { 4 };
        let line_speed = if strong { 3000 } else { 2000 };
        let mut pairs: Vec<(&str, serde_json::Value)> = vec![
            // 组件自带的通用动画/线条效果（DecorationWrapper 消费）：线条效果=霓虹，
            // 自带 deco-neon-flicker + deco-neon-glow，即"闪烁+霓虹"由组件原生实现。
            ("lineEffect", serde_json::json!("neon")),
            ("lineEffectColor", serde_json::json!(color)),
            ("lineEffectIntensity", serde_json::json!(line_intensity)),
            ("lineEffectSpeed", serde_json::json!(line_speed)),
            ("lineEffectWidth", serde_json::json!(2)),
            ("animation", serde_json::json!("blink")),
            ("animationDuration", serde_json::json!(2)),
            ("pulse", serde_json::json!(true)),
            ("neonFlicker", serde_json::json!(true)),
            ("glowEnabled", serde_json::json!(true)),
            ("glowColor", serde_json::json!(color)),
            ("glowIntensity", serde_json::json!(glow_intensity)),
            ("flowLight", serde_json::json!(true)),
            ("stroke", serde_json::json!(color)),
            ("labelColor", serde_json::json!(color)),
            ("indexColor", serde_json::json!(color)),
            // 统一细线（1.5）：底部_12_frame 之前被 strong=true 写成 3，这里强制降回，
            // 与其他主区框(36/37/38 默认 1.5)保持一致。
            ("strokeWidth", serde_json::json!(1.5)),
            ("cornerThickness", serde_json::json!(2.5)),
        ];
        if strong {
            pairs.push(("strokeWidth", serde_json::json!(3)));
            pairs.push(("cornerLength", serde_json::json!(40)));
            pairs.push(("cornerThickness", serde_json::json!(3)));
        }
        for (k, v) in pairs {
            if o.get(k) != Some(&v) {
                o.insert(k.to_string(), v);
                changed = true;
            }
        }
    }
    changed
}

/// 按组件 id 返回其专属霓虹色（每个模块独立色，同场景内为同色系小跨度，避免杂乱）。
/// 冷色为主：巷道=蓝、廊桥=青绿、综采=紫，色相差控制在蓝/绿/紫三族内。
/// 未知 id 回退到青色。
fn frame_color(id: &str) -> &'static str {
    match id {
        // 巷道：蓝色系（小跨度）
        "comp_tunnel_36" => "#4fc3f7",
        "comp_tunnel_37" => "#42a5f5",
        "comp_tunnel_38" => "#1e88e5",
        "comp_tunnel_12_frame" => "#4fc3f7",
        "comp_tunnel_40" => "#5c6bc0",
        // 廊桥：青绿色系（小跨度）
        "comp_bridge_tunnel_36" => "#4db6ac",
        "comp_bridge_tunnel_37" => "#26a69a",
        "comp_bridge_tunnel_38" => "#66bb6a",
        "comp_bridge_12_frame" => "#80cbc4",
        "comp_bridge_tunnel_40" => "#4dd0e1",
        // 综采：蓝色系（与巷道一致，用户要求也改为蓝）
        "comp_mining_tunnel_36" => "#4fc3f7",
        "comp_mining_tunnel_37" => "#42a5f5",
        "comp_mining_tunnel_38" => "#1e88e5",
        "comp_mining_12_frame" => "#2979ff",
        "comp_mining_tunnel_40" => "#5c6bc0",
        _ => "#4fc3f7",
    }
}

/// 顶部所有标题框（comp_<scene>_1/2/3/4, type=top-glow-title-frame）加朴素边框：
/// 仅按 borderEnabled=true 让渲染器画出静态描边矩形，无霓虹辉光/闪烁（用户要求"简单边框即可"）。
/// 主标题 + 左/中/右子标题统一同款边框，使顶部标题区视觉成整体。
fn style_spray_title_frames(conn: &Connection) -> Result<(), rusqlite::Error> {
    let scenes: Vec<&str> = vec!["scene_spray_tunnel", "scene_spray_bridge", "scene_spray_mining"];
    for scene_id in scenes {
        let (ec_str, views_str): (String, String) = match conn.query_row(
            "SELECT editor_components, views FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        ) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let mut ec: serde_json::Value =
            serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut views: serde_json::Value =
            serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut changed = false;

        // editor_components
        if let serde_json::Value::Array(arr) = &mut ec {
            for item in arr.iter_mut() {
                if item.get("type").and_then(|v| v.as_str()) != Some("top-glow-title-frame") {
                    continue;
                }
                if let Some(cfg) = item.get_mut("config") {
                    if set_title_style(cfg) {
                        changed = true;
                    }
                }
            }
        }

        // views -> view_default.components
        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                if v.get("id").and_then(|x| x.as_str()) != Some("view_default") {
                    continue;
                }
                if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    for item in comps.iter_mut() {
                        if item.get("type").and_then(|v| v.as_str()) != Some("top-glow-title-frame") {
                            continue;
                        }
                        if let Some(cfg) = item.get_mut("config") {
                            if set_title_style(cfg) {
                                changed = true;
                            }
                        }
                    }
                }
            }
        }

        if !changed {
            continue;
        }
        let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
        let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE scenes SET editor_components = ?1, views = ?2, updated_at = strftime('%s','now') WHERE id = ?3",
            rusqlite::params![new_ec, new_views, scene_id],
        )?;
    }
    Ok(())
}

/// 取组件 id 最后一段（按 `_` 分割），用于精确匹配列外框/子标题等，
/// 避免 `comp_*_42`/`comp_*_43` 误命中 `_2`/`_3` 这类后缀判断。
fn last_seg(id: &str) -> &str {
    id.rsplit('_').next().unwrap_or("")
}

/// 整改三喷雾场景布局（按画布尺寸算出来的对称布局，非拍脑袋）：
/// - 左列边框贴画布左边 → 左缘=0，宽 640（0–640）
/// - 右列边框贴画布右边 → 右缘=3840，故左缘=2900，宽 940（2900–3840）
/// - 中列填满中间、列间缝压到 8px → 左缘=648，宽 2244（648–2892，与左列缝 8、与右列缝 8）
/// 子标题(comp_*_2/3/4)对齐各自列框(x/w 精确对齐)；标题/工具栏浮点坐标取整。
/// 幂等：平移量 = 目标列缘 − 列外框当前 x（每次重算，外框就位后变 0，无副作用）；
/// 每处写入均带"不同才改"守卫。必须在所有 clone/customize 之后调用（migrate 末尾）。
fn align_spray_layout(conn: &Connection) -> Result<(), rusqlite::Error> {
    let scenes: Vec<&str> = vec!["scene_spray_tunnel", "scene_spray_bridge", "scene_spray_mining"];
    // 目标列左缘与宽度（画布 3840×2160 的 1px 网格：
    //   左 0–640 ｜ 中 641–2899(宽2258) ｜ 右 2900–3840(宽940)，列缝=1px，左右框贴画布边缘(0 边距)。
    // 列内 1px 网格：框内留白/同排卡片间距/排间距均 1px；行高按自然高度比例缩放精确填满框高，
    // 组件拉伸至槽位（视图区域填满）；错乱重叠组件强制分行，不再互相重叠或越出画布。
    let left_target: f64 = 0.0;
    let mid_target: f64 = 641.0;
    let right_target: f64 = 2900.0;
    let left_w: f64 = 640.0;
    let mid_w: f64 = 2258.0;
    let right_w: f64 = 940.0;
    const CANVAS_W: f64 = 3840.0;
    const CANVAS_H: f64 = 2160.0;

    for scene_id in scenes {
        let (ec_str, views_str): (String, String) = match conn.query_row(
            "SELECT editor_components, views FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        ) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let mut ec: serde_json::Value =
            serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut views: serde_json::Value =
            serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut changed = false;

        // 采集 EC 对齐前的原始 rect(x/y/w)，供 view_default 修复被旧迁移推出画布的组件
        let mut ec_pre: std::collections::HashMap<String, (f64, f64, f64)> =
            std::collections::HashMap::new();
        if let serde_json::Value::Array(arr) = &ec {
            for it in arr.iter() {
                if let (Some(id), Some(tf)) =
                    (it.get("id").and_then(|v| v.as_str()), it.get("transform"))
                {
                    let r = (
                        tf.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        tf.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        tf.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    );
                    ec_pre.insert(id.to_string(), r);
                }
            }
        }

        // editor_components
        if let serde_json::Value::Array(arr) = &mut ec {
            if align_components(arr, left_target, mid_target, right_target, left_w, mid_w, right_w) {
                changed = true;
            }
        }
        // 仅处理 view_default（运行时渲染源）；日志监控等其它视图有独立布局，不参与三列网格
        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                if v.get("id").and_then(|x| x.as_str()) != Some("view_default") {
                    continue;
                }
                let comps = match v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    Some(c) => c,
                    None => continue,
                };
                // 修复越界组件：被旧迁移横向铺开推出画布的（x+w>3840 等），x/y/w 回填 EC 原值、h 保留自身
                for it in comps.iter_mut() {
                    let id = it.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if let Some(tf) = it.get_mut("transform").and_then(|t| t.as_object_mut()) {
                        let x = tf.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let y = tf.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let w = tf.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let h = tf.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        if x + w > CANVAS_W + 2.0 || x < -2.0 || y + h > CANVAS_H + 2.0 || y < -2.0 {
                            if let Some(&(px, py, pw)) = ec_pre.get(&id) {
                                let mut fixed = false;
                                for (k, nv) in [("x", px), ("y", py), ("width", pw)] {
                                    let nvj = serde_json::json!(nv);
                                    if tf.get(k) != Some(&nvj) {
                                        tf.insert(k.to_string(), nvj);
                                        fixed = true;
                                    }
                                }
                                if fixed {
                                    changed = true;
                                }
                            }
                        }
                    }
                }
                if align_components(comps, left_target, mid_target, right_target, left_w, mid_w, right_w) {
                    changed = true;
                }
            }
        }

        if !changed {
            continue;
        }
        let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
        let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE scenes SET editor_components = ?1, views = ?2, updated_at = strftime('%s','now') WHERE id = ?3",
            rusqlite::params![new_ec, new_views, scene_id],
        )?;
    }
    Ok(())
}

/// 对单个 components 数组执行 1px 网格对齐（三列大屏布局，幂等）。
/// - 主标题(comp_*_1)：0,0,3840,120；子标题(comp_*_2/3/4)：对齐列缘，y=121/h=68（与标题/列框均 1px 缝）。
/// - 列外框(comp_*_36/37/38)：精确对齐目标列缘/列宽（左0/中641/右2900，列缝 1px），y/h 不动。
/// - 底部满宽外框(comp_*_12_frame)：x=0/w=3840；底表(comp_*_12)：置于其内 1px 留白。
/// - 列内内容组件：按左缘归入列带（间隙中点划分，可找回被推出框的组件）；
///   按"y 重叠且横向不重叠"分行（互相重叠的错乱组件强制分到不同行，消灭重叠）；
///   行高按自然高度比例缩放后用最大余数法精确填满框高、行内宽度精确填满框宽，
///   组件高度拉伸至行槽（视图区域填满）。拉伸后高度和恰等于可用高 → 重跑分配不变（严格幂等）。
/// - 装饰层：cad-enhancer 精确吸附到 map-cad 的最终矩形（消除错位杂线）；
///   列内子边框（region-frame 且非 36/37/38/_12_frame）吸附到其覆盖(≥90% 高度)的内容组件并集矩形。
fn align_components(
    arr: &mut Vec<serde_json::Value>,
    left_target: f64,
    mid_target: f64,
    right_target: f64,
    left_w: f64,
    mid_w: f64,
    right_w: f64,
) -> bool {
    let mut changed = false;
    const PAD: f64 = 1.0;
    const CANVAS_W: f64 = 3840.0;
    const TITLE_H: f64 = 120.0;
    const SUB_Y: f64 = 121.0;
    const SUB_H: f64 = 68.0;
    // 列带边界（取相邻列中点的间隙）：左<640.5<中<2899.5<右。
    let left_right_gap: f64 = (left_target + left_w + mid_target) / 2.0;
    let mid_right_gap: f64 = (mid_target + mid_w + right_target) / 2.0;
    let col_targets = [("36", left_target, left_w), ("37", mid_target, mid_w), ("38", right_target, right_w)];
    let sub_targets = [("2", left_target, left_w), ("3", mid_target, mid_w), ("4", right_target, right_w)];
    let type_of = |it: &serde_json::Value| -> String {
        it.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string()
    };

    // 1) 绝对设值：主标题 / 子标题 / 列外框 / 底部满宽外框
    //    按 type+seg 联合匹配（纯 seg 会误伤 comp_bridge_flow_1/_2 这类尾段撞车的组件）
    for it in arr.iter_mut() {
        let id = it.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let seg = last_seg(&id).to_string();
        let ty = type_of(it);
        if id.ends_with("_12_frame") {
            // 底部数据边框：左右满宽贴画布边缘(x=0/w=3840)、底部贴画布底(y=1880/h=280→底2160)，
            // 顶部因列表在框内(框自1880起)自然留间距——与用户"顶部有间距、左右底顶格"要求一致。
            if set_comp_rect_it(it, 0.0, 1880.0, CANVAS_W, 280.0) {
                changed = true;
            }
            continue;
        }
        if ty == "top-glow-title-frame" && seg == "1" {
            if set_comp_rect_it(it, 0.0, 0.0, CANVAS_W, TITLE_H) {
                changed = true;
            }
            continue;
        }
        if ty == "top-glow-title-frame" {
            if let Some((nx, nw)) = sub_targets.iter().find(|&&(s, _, _)| s == seg).map(|&(_, x, w)| (x, w)) {
                if set_comp_rect_it(it, nx, SUB_Y, nw, SUB_H) {
                    changed = true;
                }
                continue;
            }
        }
        if ty == "region-frame" {
            if let Some((nx, nw)) = col_targets.iter().find(|&&(s, _, _)| s == seg).map(|&(_, x, w)| (x, w)) {
                if set_comp_xw(it, nx, nw) {
                    changed = true;
                }
                continue;
            }
        }
    }

    // 2) 底表置于 _12_frame 内（按 type+seg 匹配，排除撞车组件）
    //    关键：RegionFrameRenderer 实际框线比 transform 矩形内缩 padding = max(8, cornerLength/3)。
    //    底部边框 cornerLength=40 → 内缩 13.33px。若只按 transform 留 1px，列表顶/底会露在可见框线外
    //    （之前"没包住"的真因）。故这里额外减去 FRAME_INSET，使列表落在**可见框线**内。
    if let Some(f12) = arr
        .iter()
        .find(|it| it.get("id").and_then(|v| v.as_str()).unwrap_or("").ends_with("_12_frame"))
    {
        let ftf = f12.get("transform").cloned().unwrap_or(serde_json::Value::Null);
        let fx12 = ftf.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let fw12 = ftf.get("width").and_then(|v| v.as_f64()).unwrap_or(CANVAS_W);
        let fy12 = ftf.get("y").and_then(|v| v.as_f64()).unwrap_or(1880.0);
        let fh12 = ftf.get("height").and_then(|v| v.as_f64()).unwrap_or(280.0);
        const FRAME_INSET: f64 = 40.0 / 3.0; // = 13.33，与 RegionFrameRenderer padding 一致（SVG 实测框线内缩量）
        // 先定列表宽高（收进边框可见框线内侧 1px），边框 = 列表 + 2*(FRAME_INSET+PAD)。
        // 边框满宽贴画布(x=0/w=3840, 底2160) → 框线 13.33~3826.67 / 1893.33~2146.67；
        // 列表 = 框线内侧1px：x=14/y=1894/w=3813/h=252（四边均落在框线内，左右底也包住，顶部自然留间距）。
        let inner_x = (fx12 + FRAME_INSET + PAD).round();
        let inner_w = (fw12 - 2.0 * FRAME_INSET - 2.0 * PAD).round();
        let inner_y = (fy12 + FRAME_INSET + PAD).round();
        let inner_h = (fh12 - 2.0 * FRAME_INSET - 2.0 * PAD).round();
        for it in arr.iter_mut() {
            let id = it.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if type_of(it) == "industrial-scrolling-table" && last_seg(&id) == "12" && !id.ends_with("_12_frame") {
                if set_comp_rect_it(it, inner_x, inner_y, inner_w, inner_h) {
                    changed = true;
                }
            }
        }
    }

    // 3) 列内内容 1px 网格（比例缩放精确填满 + 拉伸至槽位）
    // packed: (列带, 对齐前 rect, 对齐后 rect)，供装饰层吸附
    let mut packed: Vec<(i64, (f64, f64, f64, f64), (f64, f64, f64, f64))> = Vec::new();
    for (ci, &(seg, tx, tw)) in col_targets.iter().enumerate() {
        // 读该列外框的 y/height
        let frame = match arr.iter().find(|it| last_seg(it.get("id").and_then(|v| v.as_str()).unwrap_or("")) == seg) {
            Some(f) => f.clone(),
            None => continue,
        };
        let ftf = frame.get("transform").cloned().unwrap_or(serde_json::Value::Null);
        let fy = ftf.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let fh = ftf.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);
        // 收集归入本列的内容组件：按左缘 x 落入本列带（间隙中点划分，可找回被推出框的组件）；
        // 按 type 排除结构性组件（标题/子标题/各类边框/cad-enhancer 装饰层/底表）——
        // 纯 seg 排除会误伤 comp_bridge_flow_1/_2（尾段 1/2 与标题撞车）
        let mut content: Vec<(usize, f64, f64, f64, f64)> = Vec::new();
        for (i, it) in arr.iter().enumerate() {
            let id = it.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let cseg = last_seg(id);
            if id.ends_with("_12_frame") {
                continue;
            }
            let ty = type_of(it);
            if ty == "top-glow-title-frame" || ty == "region-frame" || ty == "cad-enhancer" {
                continue;
            }
            if ty == "industrial-scrolling-table" && cseg == "12" {
                continue;
            }
            let tf = match it.get("transform") {
                Some(t) => t,
                None => continue,
            };
            let x = tf.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let w = tf.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let y = tf.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let h = tf.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);
            if w <= 0.0 || h <= 0.0 {
                continue;
            }
            let band = if x < left_right_gap { 0 } else if x < mid_right_gap { 1 } else { 2 };
            if band == ci as i64 {
                content.push((i, x, y, w, h));
            }
        }
        if content.is_empty() {
            continue;
        }
        // 按 (y, x) 排序；分行规则：与某行 y 重叠 且 与该行所有成员横向不重叠 → 并入该行，
        // 否则新行（互相重叠的错乱组件被强制分行 → 布局后不再重叠）
        content.sort_by(|a, b| {
            a.2.partial_cmp(&b.2)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        });
        let mut rows: Vec<Vec<(usize, f64, f64, f64, f64)>> = Vec::new();
        let mut row_bottoms: Vec<f64> = Vec::new();
        for c in content {
            let mut placed = false;
            for (ri, row) in rows.iter_mut().enumerate() {
                if c.2 >= row_bottoms[ri] - 0.5 {
                    continue; // 与该行无 y 重叠
                }
                let x_disjoint = row
                    .iter()
                    .all(|m| (m.1 + m.3) <= c.1 + 0.5 || (c.1 + c.3) <= m.1 + 0.5);
                if x_disjoint {
                    row.push(c);
                    row_bottoms[ri] = row_bottoms[ri].max(c.2 + c.4);
                    placed = true;
                    break;
                }
            }
            if !placed {
                rows.push(vec![c]);
                row_bottoms.push(c.2 + c.4);
            }
        }
        // 行高：行内自然高度(最大 h)按比例缩放到可用高，再用最大余数法精确分配（和恰为可用高）
        let n_rows = rows.len() as f64;
        let avail_h = fh - 2.0 * PAD - (n_rows - 1.0) * PAD;
        let natural: Vec<f64> = rows
            .iter()
            .map(|r| r.iter().map(|c| c.4).fold(0.0_f64, f64::max))
            .collect();
        let scaled: Vec<f64> = if avail_h > 0.0 {
            let sum: f64 = natural.iter().sum();
            if sum > 0.0 {
                natural.iter().map(|h| h * avail_h / sum).collect()
            } else {
                vec![avail_h / n_rows; rows.len()]
            }
        } else {
            natural.clone()
        };
        let alloc_row_h = largest_remainder_f64(&scaled, avail_h.round().max(0.0) as i64);
        // 逐排布局：行内宽度先按比例缩放（自然宽度和可能超出框内宽，如 flow_2 的 640>638），
        // 再用最大余数法精确填满框宽；组件高度拉伸至行槽高（视图区域填满）
        let mut y_cursor = fy + PAD;
        for (ri, row) in rows.iter().enumerate() {
            let n = row.len() as f64;
            let rh = *alloc_row_h.get(ri).unwrap_or(&0) as f64;
            let total_w = tw - 2.0 * PAD - (n - 1.0) * PAD;
            let ws: Vec<f64> = row.iter().map(|c| c.3).collect();
            let ws_scaled: Vec<f64> = if total_w > 0.0 {
                let wsum: f64 = ws.iter().sum();
                if wsum > 0.0 {
                    ws.iter().map(|w| w * total_w / wsum).collect()
                } else {
                    vec![total_w / n; row.len()]
                }
            } else {
                ws.clone()
            };
            let nw_alloc = largest_remainder_f64(&ws_scaled, total_w.round().max(0.0) as i64);
            let mut x_cursor = tx + PAD;
            for (j, c) in row.iter().enumerate() {
                let (idx, px, py, pw, ph) = *c;
                let nx = x_cursor.round();
                let ny = y_cursor.round();
                let nw = *nw_alloc.get(j).unwrap_or(&0) as f64;
                let nh = rh; // 拉伸至槽高
                if set_comp_rect_it(&mut arr[idx], nx, ny, nw, nh) {
                    changed = true;
                }
                packed.push((ci as i64, (px, py, pw, ph), (nx, ny, nw, nh)));
                x_cursor += nw + PAD;
            }
            y_cursor += rh + PAD;
        }
    }

    // 4) 装饰层吸附
    // 4a) cad-enhancer → 精确吸附 map-cad 最终矩形（装饰角标/辉光与 CAD 地图对齐，消除错位杂线）
    let map_rect = arr
        .iter()
        .find(|it| type_of(it) == "map-cad")
        .and_then(|m| m.get("transform"))
        .map(|tf| {
            (
                tf.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
                tf.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0),
                tf.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0),
                tf.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0),
            )
        });
    if let Some((mx, my, mw, mh)) = map_rect {
        for it in arr.iter_mut() {
            if type_of(it) == "cad-enhancer" {
                if set_comp_rect_it(it, mx, my, mw, mh) {
                    changed = true;
                }
            }
        }
    }
    // 4b) 列内子边框（region-frame 且非 36/37/38/_12_frame）→ 吸附到其覆盖(≥90% 高度)的内容组件并集矩形
    for it in arr.iter_mut() {
        if type_of(it) != "region-frame" {
            continue;
        }
        let id = it.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let seg = last_seg(&id).to_string();
        if id.ends_with("_12_frame") || ["36", "37", "38"].contains(&seg.as_str()) {
            continue;
        }
        let tf = match it.get("transform") {
            Some(t) => t.clone(),
            None => continue,
        };
        let sx = tf.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let sy = tf.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let sw = tf.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let sh = tf.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0);
        if sw <= 0.0 || sh <= 0.0 {
            continue;
        }
        let band = if sx < left_right_gap { 0 } else if sx < mid_right_gap { 1 } else { 2 };
        let mut ux0 = f64::MAX;
        let mut uy0 = f64::MAX;
        let mut ux1 = f64::MIN;
        let mut uy1 = f64::MIN;
        let mut any = false;
        for (b, pre, post) in &packed {
            if *b != band {
                continue;
            }
            let (_, py, _, ph) = *pre;
            if ph <= 0.0 {
                continue;
            }
            let overlap = (sy + sh).min(py + ph) - sy.max(py);
            if overlap / ph >= 0.9 {
                any = true;
                ux0 = ux0.min(post.0);
                uy0 = uy0.min(post.1);
                ux1 = ux1.max(post.0 + post.2);
                uy1 = uy1.max(post.1 + post.3);
            }
        }
        if any && ux1 > ux0 && uy1 > uy0 {
            if set_comp_rect_it(it, ux0, uy0, ux1 - ux0, uy1 - uy0) {
                changed = true;
            }
        }
    }
    changed
}

/// 精确设置 x/y/width/height（仅当改变才写）。返回是否改动。
fn set_comp_rect_it(it: &mut serde_json::Value, nx: f64, ny: f64, nw: f64, nh: f64) -> bool {
    let mut changed = false;
    if let Some(tf) = it.get_mut("transform").and_then(|t| t.as_object_mut()) {
        for (k, v) in [("x", nx), ("y", ny), ("width", nw), ("height", nh)] {
            let nvj = serde_json::json!(v);
            if tf.get(k) != Some(&nvj) {
                tf.insert(k.to_string(), nvj);
                changed = true;
            }
        }
    }
    changed
}

/// 最大余数法：把 total(int) 按比例分配给 floats，返回整数分配（和恰为 total）。
/// 用于列宽/排高精确填满框，确保重排幂等（重跑时槽高和=框高 → 不再变化）。
fn largest_remainder_f64(floats: &[f64], total: i64) -> Vec<i64> {
    if floats.is_empty() {
        return Vec::new();
    }
    if total <= 0 {
        return vec![0; floats.len()];
    }
    let floors: Vec<i64> = floats.iter().map(|f| f.floor().max(0.0) as i64).collect();
    let mut rem = total - floors.iter().sum::<i64>();
    if rem < 0 {
        rem = 0;
    }
    let mut order: Vec<usize> = (0..floats.len()).collect();
    order.sort_by(|&a, &b| {
        let fa = floats[a] - floors[a] as f64;
        let fb = floats[b] - floors[b] as f64;
        fb.partial_cmp(&fa)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(floats[b].partial_cmp(&floats[a]).unwrap_or(std::cmp::Ordering::Equal))
    });
    let mut res = floors;
    for k in 0..rem {
        res[order[(k as usize) % floats.len()]] += 1;
    }
    res
}

/// 精确设置 x/w（子标题对齐列框），仅当改变才写。返回是否改动。
fn set_comp_xw(it: &mut serde_json::Value, nx: f64, nw: f64) -> bool {
    let mut changed = false;
    if let Some(tf) = it.get_mut("transform").and_then(|t| t.as_object_mut()) {
        let nxj = serde_json::json!(nx);
        let nwj = serde_json::json!(nw);
        if tf.get("x") != Some(&nxj) {
            tf.insert("x".to_string(), nxj);
            changed = true;
        }
        if tf.get("width") != Some(&nwj) {
            tf.insert("width".to_string(), nwj);
            changed = true;
        }
    }
    changed
}

/// 把统一边框霓虹样式写入某个 top-glow-title-frame（仅 comp_*_1）的 config（仅当不同才改）。返回是否有改动。
fn set_title_style(cfg: &mut serde_json::Value) -> bool {
    let mut changed = false;
    if let Some(o) = cfg.as_object_mut() {
        // 朴素静态边框：仅开启 borderEnabled 让渲染器画矩形描边；
        // lineEffect/animation 置为 none 撤掉上版的霓虹辉光与闪烁（用户要求"简单边框即可"）。
        // 其余旧字段（lineEffectColor 等）惰性保留、对 lineEffect=none 无任何影响。
        let pairs: Vec<(&str, serde_json::Value)> = vec![
            ("borderEnabled", serde_json::json!(true)),
            ("lineEffect", serde_json::json!("none")),
            ("animation", serde_json::json!("none")),
        ];
        for (k, v) in pairs {
            if o.get(k) != Some(&v) {
                o.insert(k.to_string(), v);
                changed = true;
            }
        }
    }
    changed
}

/// 在 components 数组（editor_components 或 view.components）的某项 transform 上写入 y/height（仅当不同）。
/// 返回是否有改动。
fn set_comp_yh(items: &mut serde_json::Value, id: &str, y: i64, h: i64) -> bool {
    let mut changed = false;
    if let serde_json::Value::Array(arr) = items {
        for item in arr.iter_mut() {
            let idv = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if idv != id {
                continue;
            }
            if let Some(tf) = item.get_mut("transform").and_then(|t| t.as_object_mut()) {
                let yv = serde_json::json!(y);
                let hv = serde_json::json!(h);
                if tf.get("y") != Some(&yv) || tf.get("height") != Some(&hv) {
                    tf.insert("y".to_string(), yv);
                    tf.insert("height".to_string(), hv);
                    changed = true;
                }
            }
        }
    }
    changed
}

/// 在 views 数组的所有 view.components 上写入 y/height。返回是否有改动。
fn set_views_yh(views: &mut serde_json::Value, id: &str, y: i64, h: i64) -> bool {
    let mut changed = false;
    if let serde_json::Value::Array(views_arr) = views {
        for v in views_arr.iter_mut() {
            if let Some(comps) = v.get_mut("components") {
                if set_comp_yh(comps, id, y, h) {
                    changed = true;
                }
            }
        }
    }
    changed
}

/// 在 layout 数组（{componentId,x,y,w,h,zIndex}）的某项上写入 y/h（仅当不同）。返回是否有改动。
fn set_layout_yh(layout: &mut serde_json::Value, id: &str, y: i64, h: i64) -> bool {
    let mut changed = false;
    if let serde_json::Value::Array(arr) = layout {
        for item in arr.iter_mut() {
            let idv = item.get("componentId").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if idv != id {
                continue;
            }
            if let Some(obj) = item.as_object_mut() {
                let yv = serde_json::json!(y);
                let hv = serde_json::json!(h);
                if obj.get("y") != Some(&yv) || obj.get("h") != Some(&hv) {
                    obj.insert("y".to_string(), yv);
                    obj.insert("h".to_string(), hv);
                    changed = true;
                }
            }
        }
    }
    changed
}

/// 在 components 数组（editor_components 或 view.components）的某项 transform 上写入完整矩形（x/y/width/height）。
/// 返回是否有改动。
fn set_comp_rect(items: &mut serde_json::Value, id: &str, x: i64, y: i64, w: i64, h: i64) -> bool {
    let mut changed = false;
    if let serde_json::Value::Array(arr) = items {
        for item in arr.iter_mut() {
            let idv = item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if idv != id {
                continue;
            }
            if let Some(tf) = item.get_mut("transform").and_then(|t| t.as_object_mut()) {
                for (k, v) in [("x", x), ("y", y), ("width", w), ("height", h)] {
                    let jv = serde_json::json!(v);
                    if tf.get(k) != Some(&jv) {
                        tf.insert(k.to_string(), jv);
                        changed = true;
                    }
                }
            }
        }
    }
    changed
}

/// 在 views 数组的所有 view.components 上写入完整矩形。返回是否有改动。
fn set_views_rect(views: &mut serde_json::Value, id: &str, x: i64, y: i64, w: i64, h: i64) -> bool {
    let mut changed = false;
    if let serde_json::Value::Array(views_arr) = views {
        for v in views_arr.iter_mut() {
            if let Some(comps) = v.get_mut("components") {
                if set_comp_rect(comps, id, x, y, w, h) {
                    changed = true;
                }
            }
        }
    }
    changed
}

/// 在 layout 数组（{componentId,x,y,w,h,zIndex}）的某项上写入完整矩形。返回是否有改动。
fn set_layout_rect(layout: &mut serde_json::Value, id: &str, x: i64, y: i64, w: i64, h: i64) -> bool {
    let mut changed = false;
    if let serde_json::Value::Array(arr) = layout {
        for item in arr.iter_mut() {
            let idv = item.get("componentId").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if idv != id {
                continue;
            }
            if let Some(obj) = item.as_object_mut() {
                for (k, v) in [("x", x), ("y", y), ("w", w), ("h", h)] {
                    let jv = serde_json::json!(v);
                    if obj.get(k) != Some(&jv) {
                        obj.insert(k.to_string(), jv);
                        changed = true;
                    }
                }
            }
        }
    }
    changed
}

/// 把组件 JSON 推入 editor_components（按 id 幂等）。返回是否新增。
fn push_if_absent_ec(ec: &mut serde_json::Value, comp: &serde_json::Value) -> bool {
    if let serde_json::Value::Array(arr) = ec {
        let id = comp.get("id").and_then(|v| v.as_str()).unwrap_or("");
        if !arr.iter().any(|c| c.get("id").and_then(|v| v.as_str()) == Some(id)) {
            arr.push(comp.clone());
            return true;
        }
    }
    false
}

/// 把组件 JSON 推入 view_default.components（按 id 幂等）。返回是否新增。
fn push_if_absent_view(views: &mut serde_json::Value, comp: &serde_json::Value) -> bool {
    if let serde_json::Value::Array(views_arr) = views {
        for v in views_arr.iter_mut() {
            if v.get("id").and_then(|x| x.as_str()) == Some("view_default") {
                if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    let id = comp.get("id").and_then(|x| x.as_str()).unwrap_or("");
                    if !comps.iter().any(|c| c.get("id").and_then(|x| x.as_str()) == Some(id)) {
                        comps.push(comp.clone());
                        return true;
                    }
                }
            }
        }
    }
    false
}

/// 把 layout 项推入 layout 数组（按 componentId 幂等）。返回是否新增。
fn push_if_absent_layout(layout: &mut serde_json::Value, item: &serde_json::Value) -> bool {
    if let serde_json::Value::Array(arr) = layout {
        let id = item.get("componentId").and_then(|v| v.as_str()).unwrap_or("");
        if !arr.iter().any(|c| c.get("componentId").and_then(|v| v.as_str()) == Some(id)) {
            arr.push(item.clone());
            return true;
        }
    }
    false
}



/// 综采专享：在综采场景注入"支架状态表"(industrial-support-status，对标 sprayv2/showzc 工作面状态 + 支架状态表)，
/// 并收缩左侧 sensor-monitor(41) 高度为该表腾出空间。
///
/// 落点：左栏(comp_mining_tunnel_36 区域框内，x≈30、宽≈600) 下半区，紧贴区域框底部 1880，
///       与底部滚动数据列表(comp_mining_tunnel_12, y=1880) 顶部齐平。
/// 前置：sensor-monitor(41) 经 apply_mining_reflow 拉到 y=670,h=1190(底 1860)；此处收缩为 h=560(底 1230)，
///       让出 1240~1880(640px) 给支架状态表。
/// 幂等：editor_components 已含 support_status id 则跳过；41 收缩同步幂等（仅当场景中存在 41 才缩）。
fn inject_mining_support_status(conn: &Connection) -> Result<(), rusqlite::Error> {
    let scene_id = "scene_spray_mining";
    let support_id = "comp_mining_tunnel_support_status";
    let monitor_id = "comp_mining_tunnel_41";

    let (ec_str, views_str, layout_str): (String, String, String) = match conn.query_row(
        "SELECT editor_components, views, layout FROM scenes WHERE id = ?1",
        rusqlite::params![scene_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        },
    ) {
        Ok(t) => t,
        Err(_) => return Ok(()),
    };

    let mut ec: serde_json::Value =
        serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
    let mut views: serde_json::Value =
        serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
    let mut layout: serde_json::Value =
        serde_json::from_str(&layout_str).unwrap_or(serde_json::Value::Array(vec![]));

    // 幂等：editor_components 已含 support_status 则跳过
    if let serde_json::Value::Array(arr) = &ec {
        if arr
            .iter()
            .any(|c| c.get("id").and_then(|v| v.as_str()) == Some(support_id))
        {
            return Ok(());
        }
    }

    let support_comp = serde_json::json!({
        "id": support_id,
        "type": "industrial-support-status",
        "name": "支架状态表",
        "transform": {"x": 30, "y": 1240, "width": 600, "height": 640, "rotation": 0, "scale": {"x": 1, "y": 1}},
        "layerId": "layer_default",
        "zIndex": 18,
        "locked": false,
        "visible": true,
        "config": {
            "title": "支架状态表",
            "selectedDeviceIds": []
        }
    });

    // 收缩 sensor-monitor(41) 高度：y=670,h=1190 → y=670,h=560（底部 1230），为支架状态表让位
    fn shrink_monitor(arr: &mut [serde_json::Value], monitor_id: &str) {
        for c in arr.iter_mut() {
            if c.get("id").and_then(|v| v.as_str()) == Some(monitor_id) {
                if let Some(tf) = c.get_mut("transform").and_then(|t| t.as_object_mut()) {
                    tf.insert("y".to_string(), serde_json::json!(670));
                    tf.insert("height".to_string(), serde_json::json!(560));
                }
            }
        }
    }
    fn push_support(arr: &mut Vec<serde_json::Value>, comp: &serde_json::Value, support_id: &str) {
        if !arr
            .iter()
            .any(|c| c.get("id").and_then(|v| v.as_str()) == Some(support_id))
        {
            arr.push(comp.clone());
        }
    }

    if let serde_json::Value::Array(arr) = &mut ec {
        shrink_monitor(arr, monitor_id);
        push_support(arr, &support_comp, support_id);
    }
    if let serde_json::Value::Array(views_arr) = &mut views {
        for v in views_arr.iter_mut() {
            if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                shrink_monitor(comps, monitor_id);
                push_support(comps, &support_comp, support_id);
            }
        }
    }
    // layout（稀疏结构同步，渲染不读但保持结构一致）
    if let serde_json::Value::Array(items) = &mut layout {
        for item in items.iter_mut() {
            if item.get("componentId").and_then(|v| v.as_str()) == Some(monitor_id) {
                if let Some(obj) = item.as_object_mut() {
                    obj.insert("y".to_string(), serde_json::json!(670));
                    obj.insert("h".to_string(), serde_json::json!(560));
                }
            }
        }
        if !items.iter().any(|c| {
            c.get("componentId").and_then(|v| v.as_str()) == Some(support_id)
        }) {
            items.push(serde_json::json!({
                "componentId": support_id,
                "x": 30, "y": 1240, "w": 600, "h": 640, "zIndex": 18
            }));
        }
    }

    let new_ec = serde_json::to_string(&ec).unwrap_or_else(|_| "[]".to_string());
    let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
    let new_layout = serde_json::to_string(&layout).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "UPDATE scenes SET editor_components = ?1, views = ?2, layout = ?3, updated_at = strftime('%s','now') WHERE id = ?4",
        rusqlite::params![new_ec, new_views, new_layout, scene_id],
    )?;

    Ok(())
}

/// 把组件数组里 id ∈ align_ids 的 transform 重排：
///  - 前 3 个（三栏 region-frame）：y=190, height=1690 → 底部对齐到 1880；
///  - 第 4 个（底部滚动数据列表）：y=1880, height=190 → 顶部对齐三栏底部。


/// 在 layout 数组的某项（{componentId,x,y,w,h,zIndex}）上写入整型字段。
fn set_i64_field(item: &mut serde_json::Value, key: &str, val: i64) {
    if let Some(obj) = item.as_object_mut() {
        obj.insert(key.to_string(), serde_json::json!(val));
    }
}

/// 日志监控视图的"清理 + 全屏重排"幂等迁移。
///
/// 问题背景：view_log_monitor 在手动编辑/克隆过程中混入了大屏残留组件
/// （region-frame 40、sensor-monitor 41、装饰 datav-decoration-7、echart-treemap/funnel/pie、
/// 综采 support_status 等），且坐标停留在 50/450 量级的小坐标角落，切换过去是一团重叠残片。
///
/// 本迁移：仅处理 view_log_monitor，**绝不碰 view_default**（大屏监控视图）；
///  1) 删除所有非日志组件，只保留 6 个日志面板
///     （overview-cards / log-filter-panel / operation-log-table / cmd-donut /
///      result-donut / alarm-trend-stacked）；
///  2) 把 6 个面板重排为铺满 4K 画布（3840×2160）的 1px 网格布局（无重叠、无溢出、上下左右填满）；
///  3) 视图 name 带场景名（"巷道/廊桥/综采喷雾 · 日志监控"），落实"当前场景"语义。
/// 幂等：组件集合与坐标均已匹配目标则跳过写入，多跑零改动。
/// 注：旧 log-stats-cards 与 alarm-trend-chart 已删除（前者与 overview-cards 重复，
/// 后者被 alarm-trend-stacked 取代），此处不再保留。
fn cleanup_and_relayout_log_views(conn: &Connection) -> Result<(), rusqlite::Error> {
    const LOG_VIEW_TYPES: &[&str] = &[
        "industrial-log-overview-cards",
        "industrial-log-filter-panel",
        "industrial-operation-log-table",
        "industrial-operation-cmd-donut",
        "industrial-operation-result-donut",
        "industrial-alarm-trend-stacked",
    ];
    /// 按组件类型返回 4K 全屏布局 (x, y, w, h)，1px 网格、无重叠、无溢出。
    fn log_layout_for(ty: &str) -> Option<(f64, f64, f64, f64)> {
        match ty {
            "industrial-log-overview-cards" => Some((50.0, 20.0, 1920.0, 120.0)),
            "industrial-log-filter-panel" => Some((8.0, 149.0, 900.0, 2003.0)),
            "industrial-operation-log-table" => Some((909.0, 279.0, 2923.0, 811.0)),
            "industrial-operation-cmd-donut" => Some((909.0, 1090.0, 1460.0, 540.0)),
            "industrial-operation-result-donut" => Some((2370.0, 1090.0, 1462.0, 540.0)),
            "industrial-alarm-trend-stacked" => Some((909.0, 1631.0, 2923.0, 659.0)),
            _ => None,
        }
    }

    let scenes: Vec<(&str, &str)> = vec![
        ("scene_spray_tunnel", "巷道喷雾 · 日志监控"),
        ("scene_spray_bridge", "廊桥喷雾 · 日志监控"),
        ("scene_spray_mining", "综采喷雾 · 日志监控"),
    ];

    for (scene_id, view_name) in scenes {
        let views_str: String = match conn.query_row(
            "SELECT views FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| row.get::<_, String>(0),
        ) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let mut views: serde_json::Value =
            serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut changed = false;

        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                let vid = v.get("id").and_then(|x| x.as_str()).unwrap_or("");
                if vid != "view_log_monitor" {
                    continue;
                }
                // 视图名带场景名
                if v.get("name").and_then(|x| x.as_str()) != Some(view_name) {
                    if let Some(o) = v.as_object_mut() {
                        o.insert("name".to_string(), serde_json::json!(view_name));
                        changed = true;
                    }
                }
                if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    let mut new_comps: Vec<serde_json::Value> = Vec::new();
                    for c in comps.iter() {
                        let ty = c.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        if !LOG_VIEW_TYPES.contains(&ty) {
                            // 非日志组件（大屏残留/装饰/分析图）→ 删除
                            changed = true;
                            continue;
                        }
                        let mut nc = c.clone();
                        if let Some((nx, ny, nw, nh)) = log_layout_for(ty) {
                            if let Some(tf) = nc.get_mut("transform").and_then(|t| t.as_object_mut()) {
                                for (k, val) in [("x", nx), ("y", ny), ("width", nw), ("height", nh)] {
                                    let vj = serde_json::json!(val);
                                    if tf.get(k) != Some(&vj) {
                                        tf.insert(k.to_string(), vj);
                                        changed = true;
                                    }
                                }
                            }
                        }
                        new_comps.push(nc);
                    }
                    *comps = new_comps;
                }
            }
        }

        if !changed {
            continue;
        }
        let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE scenes SET views = ?1, updated_at = strftime('%s','now') WHERE id = ?2",
            rusqlite::params![new_views, scene_id],
        )?;
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════
// 视图重排 V3（2026-08-22）：日志监控视图最终组件集合
// ═══════════════════════════════════════════════════════════════════
// 与 relayout_log_monitor_for_charts(V2) 的差异：
//   - drop `industrial-log-stats-cards`（与 overview-cards 重复，运行态 DB 已删）
//   - add `industrial-log-overview-cards`（场景状态一眼可见，V2 缺失）
//   - 组件集合固定为 6（overview / filter / operation-table / cmd-donut /
//     result-donut / alarm-trend-stacked）；alarm-trend-chart 旧版已删。
//   - 坐标对齐运行态 config.db 实测布局（0 重叠 / 0 溢出）。
//   - 幂等：DefaultHasher 哈希当前 view_log_monitor 组件 (类型,x,y,w,h,
//     必填字段) 拼接串；与目标哈希相等则完全跳过（多跑零改动）。
//
// 严禁触碰 view_default。view_log_monitor 之外其它视图不受影响。
// ═══════════════════════════════════════════════════════════════════

fn relayout_log_monitor_for_charts(conn: &Connection) -> Result<(), rusqlite::Error> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    /// V3 目标组件集合（6 个，全部为日志监控视图专用）。
    /// 注意：不含 device-event / system-event / 旧 alarm-trend / 旧 log-stats-cards。
    const LOG_VIEW_TYPES_V2: &[&str] = &[
        "industrial-log-overview-cards",
        "industrial-log-filter-panel",
        "industrial-operation-log-table",
        "industrial-operation-cmd-donut",
        "industrial-operation-result-donut",
        "industrial-alarm-trend-stacked",
    ];

    /// V3 目标坐标（对齐运行态 config.db 实测布局，0 重叠 / 0 溢出）
    fn log_layout_v2(ty: &str) -> Option<(f64, f64, f64, f64)> {
        match ty {
            "industrial-log-overview-cards"        => Some((2560.0,  100.0, 1280.0,  120.0)),
            "industrial-log-filter-panel"          => Some((   8.0,  149.0,  900.0, 2003.0)),
            "industrial-operation-log-table"       => Some(( 909.0,  279.0, 2923.0,  810.0)),
            "industrial-operation-cmd-donut"       => Some(( 909.0, 1090.0, 1460.0,  540.0)),
            "industrial-operation-result-donut"    => Some((2370.0, 1090.0, 1462.0,  540.0)),
            "industrial-alarm-trend-stacked"       => Some(( 909.0, 1631.0, 2923.0,  529.0)),
            _ => None,
        }
    }

    /// 新组件类型的 id 前缀映射（按场景前缀化避免三场景 id 撞车）
    fn log_view_component_id(scene_id: &str, ty: &str) -> String {
        let suffix = match ty {
            "industrial-log-overview-cards" => "overview",
            "industrial-log-filter-panel" => "filter",
            "industrial-operation-log-table" => "operation",
            "industrial-operation-cmd-donut" => "cmd_donut",
            "industrial-operation-result-donut" => "result_donut",
            "industrial-alarm-trend-stacked" => "alarm_stacked",
            _ => "comp",
        };
        let scene_tag = match scene_id {
            "scene_spray_tunnel" => "log",
            "scene_spray_bridge" => "bridge_log",
            "scene_spray_mining" => "mining_log",
            _ => "log",
        };
        format!("comp_{}_{}", scene_tag, suffix)
    }

    /// 新组件类型的显示名
    fn log_view_component_name(ty: &str) -> &'static str {
        match ty {
            "industrial-log-overview-cards" => "日志概览卡",
            "industrial-log-filter-panel" => "日志筛选面板",
            "industrial-operation-log-table" => "操作日志表格",
            "industrial-operation-cmd-donut" => "操作命令分布",
            "industrial-operation-result-donut" => "操作结果分布",
            "industrial-alarm-trend-stacked" => "告警趋势堆叠图",
            _ => "组件",
        }
    }

    /// 新组件类型的默认 zIndex（按 LOG_VIEW_TYPES_V2 顺序 1..=6）
    fn log_view_default_zindex(ty: &str) -> i64 {
        LOG_VIEW_TYPES_V2
            .iter()
            .position(|t| *t == ty)
            .map(|i| (i + 1) as i64)
            .unwrap_or(0)
    }

    let scenes: Vec<(&str, &str)> = vec![
        ("scene_spray_tunnel", "巷道喷雾 · 日志监控"),
        ("scene_spray_bridge", "廊桥喷雾 · 日志监控"),
        ("scene_spray_mining", "综采喷雾 · 日志监控"),
    ];

    for (scene_id, view_name) in scenes {
        let views_str: String = match conn.query_row(
            "SELECT views FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| row.get::<_, String>(0),
        ) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let mut views: serde_json::Value =
            serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut changed = false;

        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                let vid = v.get("id").and_then(|x| x.as_str()).unwrap_or("");
                if vid != "view_log_monitor" {
                    continue;
                }
                // 视图名带场景名
                if v.get("name").and_then(|x| x.as_str()) != Some(view_name) {
                    if let Some(o) = v.as_object_mut() {
                        o.insert("name".to_string(), serde_json::json!(view_name));
                        changed = true;
                    }
                }

                // ── 幂等哈希检测 ──
                // 用 V2 期望坐标计算"目标哈希"。
                let mut target_hasher = DefaultHasher::new();
                for ty in LOG_VIEW_TYPES_V2 {
                    ty.hash(&mut target_hasher);
                    if let Some((x, y, w, h)) = log_layout_v2(ty) {
                        x.to_bits().hash(&mut target_hasher);
                        y.to_bits().hash(&mut target_hasher);
                        w.to_bits().hash(&mut target_hasher);
                        h.to_bits().hash(&mut target_hasher);
                    }
                }
                let target_hash = target_hasher.finish();

                // 用当前 view_log_monitor 组件的 (类型, x, y, w, h, 必填字段齐全) 计算"当前哈希"。
                // 必填字段(id/config/zIndex/locked)参与 hash，避免早期空对象漏字段
                // (e.g. `serde_json::json!({})` fallback) 也能触发幂等命中。
                let mut current_hasher = DefaultHasher::new();
                if let Some(comps) = v.get("components").and_then(|c| c.as_array()) {
                    for c in comps {
                        if let Some(ty) = c.get("type").and_then(|t| t.as_str()) {
                            ty.hash(&mut current_hasher);
                            if let Some(tf) = c.get("transform").and_then(|t| t.as_object()) {
                                for k in ["x", "y", "width", "height"] {
                                    let val = tf
                                        .get(k)
                                        .and_then(|x| x.as_f64())
                                        .unwrap_or(0.0);
                                    val.to_bits().hash(&mut current_hasher);
                                }
                            }
                            // 必填字段是否存在的位标记
                            let has_id = c.get("id").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false);
                            let has_name = c.get("name").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false);
                            let has_config = c.get("config").is_some();
                            let has_zindex = c.get("zIndex").and_then(|v| v.as_i64()).is_some();
                            has_id.hash(&mut current_hasher);
                            has_name.hash(&mut current_hasher);
                            has_config.hash(&mut current_hasher);
                            has_zindex.hash(&mut current_hasher);
                        }
                    }
                }
                let current_hash = current_hasher.finish();

                // 仅当 V2 6 个组件 + 期望坐标完全等于当前状态才跳过。
                // 任一项不匹配则覆盖（强制同步到 V2）。
                let need_rewrite = target_hash != current_hash;
                if !need_rewrite {
                    // 已经匹配：仍可选择更新 view name（如场景名变更），但 components 不动。
                    continue;
                }

                // 重建 components：先丢弃所有非 V2 类型，再按目标顺序写入 6 个组件。
                let new_comps: Vec<serde_json::Value> = {
                    let mut existing: std::collections::HashMap<String, serde_json::Value> =
                        std::collections::HashMap::new();
                    if let Some(comps) = v.get("components").and_then(|c| c.as_array()) {
                        for c in comps {
                            if let Some(ty) = c.get("type").and_then(|t| t.as_str()) {
                                if LOG_VIEW_TYPES_V2.contains(&ty) {
                                    existing.insert(ty.to_string(), c.clone());
                                } else {
                                    changed = true;
                                }
                            } else {
                                changed = true;
                            }
                        }
                    }

                    LOG_VIEW_TYPES_V2
                        .iter()
                        .map(|ty| {
                            let (x, y, w, h) = log_layout_v2(ty).unwrap();
                            // V2 fallback：新建组件时补齐所有必填字段，
                            // 避免 EditorCanvas 的 `comp.config.embeddedInBorder11`
                            // / zIndex 排序 / React key 等触发 undefined 异常。
                            let mut nc = existing.remove(*ty).unwrap_or_else(|| {
                                serde_json::json!({
                                    "id": log_view_component_id(scene_id, ty),
                                    "name": log_view_component_name(ty),
                                    "type": ty,
                                    "transform": {
                                        "x": x, "y": y, "width": w, "height": h,
                                        "rotation": 0,
                                        "scale": { "x": 1, "y": 1 },
                                    },
                                    "layerId": "layer_log_default",
                                    "zIndex": log_view_default_zindex(ty),
                                    "locked": false,
                                    "visible": true,
                                    "config": {},
                                })
                            });
                            if let Some(o) = nc.as_object_mut() {
                                let tr = serde_json::json!({
                                    "x": x, "y": y, "width": w, "height": h,
                                    "rotation": 0,
                                    "scale": { "x": 1, "y": 1 },
                                });
                                if o.get("transform") != Some(&tr) {
                                    o.insert("transform".to_string(), tr);
                                    changed = true;
                                }
                                // 保留 type（必填）
                                if o.get("type").is_none() {
                                    o.insert("type".to_string(), serde_json::json!(ty));
                                    changed = true;
                                }
                                // 保留 visible=true（避免被潜在旧版组件误关闭）
                                if o.get("visible") != Some(&serde_json::json!(true)) {
                                    o.insert("visible".to_string(), serde_json::json!(true));
                                    changed = true;
                                }
                                // 强制重置 layerId：V2 全部并入日志层 layer_log_default
                                let lid = serde_json::json!("layer_log_default");
                                if o.get("layerId") != Some(&lid) {
                                    o.insert("layerId".to_string(), lid);
                                    changed = true;
                                }
                                // 补齐 id（缺失则新建唯一 id；与已有 id 撞车则保持原 id 不动）
                                if !o.contains_key("id") {
                                    o.insert(
                                        "id".to_string(),
                                        serde_json::json!(log_view_component_id(scene_id, ty)),
                                    );
                                    changed = true;
                                }
                                // 补齐 name（缺失则用默认名）
                                if !o.contains_key("name") {
                                    o.insert(
                                        "name".to_string(),
                                        serde_json::json!(log_view_component_name(ty)),
                                    );
                                    changed = true;
                                }
                                // 补齐 zIndex（缺失或为 0 时按 V2 顺序给值）
                                let default_z = serde_json::json!(log_view_default_zindex(ty));
                                if o.get("zIndex").is_none()
                                    || o.get("zIndex") == Some(&serde_json::json!(0))
                                {
                                    o.insert("zIndex".to_string(), default_z);
                                    changed = true;
                                }
                                // 补齐 config（缺失时给空对象，TS 端 `?.` 与 `?? 默认` 走 fallback）
                                if !o.contains_key("config") {
                                    o.insert("config".to_string(), serde_json::json!({}));
                                    changed = true;
                                }
                                // 补齐 locked
                                if !o.contains_key("locked") {
                                    o.insert("locked".to_string(), serde_json::json!(false));
                                    changed = true;
                                }
                            }
                            nc
                        })
                        .collect()
                };

                if let Some(comps) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    if comps.len() != new_comps.len() {
                        changed = true;
                    }
                    *comps = new_comps;
                } else if let Some(o) = v.as_object_mut() {
                    o.insert(
                        "components".to_string(),
                        serde_json::Value::Array(vec![]),
                    );
                    changed = true;
                }
            }
        }

        if !changed {
            continue;
        }
        let new_views = serde_json::to_string(&views).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE scenes SET views = ?1, updated_at = strftime('%s','now') WHERE id = ?2",
            rusqlite::params![new_views, scene_id],
        )?;
    }
    Ok(())
}

/// 设备绑定类组件的类型白名单 —— 这些组件的 `config.selectedDeviceIds` 需要清空，
/// 改为「留空 = 由 edge-conductor GET /api/devices 动态发现」。
const DEVICE_BINDING_TYPES: [&str; 5] = [
    "industrial-dust-trend",
    "industrial-scrolling-table",
    "industrial-spray-control-toolbar",
    "industrial-timing-card",
    "industrial-sensor-monitor",
];

/// 清空单个组件的 `config.selectedDeviceIds`（仅对设备绑定类组件生效）。
///
/// 返回是否发生了改动。已是空数组或字段不存在时返回 false，保证幂等。
fn clear_device_binding(comp: &mut serde_json::Value) -> bool {
    let is_target = comp
        .get("type")
        .and_then(|v| v.as_str())
        .map(|t| DEVICE_BINDING_TYPES.contains(&t))
        .unwrap_or(false);
    if !is_target {
        return false;
    }

    let cfg = match comp.get_mut("config").and_then(|c| c.as_object_mut()) {
        Some(c) => c,
        None => return false,
    };

    match cfg.get("selectedDeviceIds") {
        // 已为空数组 → 无需改动
        Some(v) if v.as_array().map(|a| a.is_empty()).unwrap_or(false) => return false,
        // 字段不存在 → 渲染器本就按「留空」处理，无需写入
        None => return false,
        _ => {}
    }

    cfg.insert(
        "selectedDeviceIds".to_string(),
        serde_json::Value::Array(vec![]),
    );
    true
}

/// [DISABLED] 历史上用于清空三喷雾场景写死的设备 ID。
///
/// 原意图：「留空 = 动态发现全部」。但产品最终确定的语义是**严格绑定模型**：
/// 未绑定集控器 = 不显示任何设备（只有显式勾选集控器才显示其下属分控器/传感器）。
/// 因此「留空」本身是 intended 默认状态，不应再被自动清空；组件绑定应显式指向真实集控器。
///
/// 该步骤的调用已在 `migrate()` 中移除，函数保留仅作历史参考，不再执行。
#[allow(dead_code)]
fn normalize_spray_device_bindings(conn: &Connection) -> Result<(), rusqlite::Error> {
    let scene_ids = [
        "scene_spray_tunnel",
        "scene_spray_bridge",
        "scene_spray_mining",
    ];

    for scene_id in scene_ids.iter() {
        let (ec_str, views_str): (String, String) = match conn.query_row(
            "SELECT editor_components, views FROM scenes WHERE id = ?1",
            rusqlite::params![scene_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        ) {
            Ok(t) => t,
            Err(_) => continue,
        };

        let mut ec: serde_json::Value =
            serde_json::from_str(&ec_str).unwrap_or(serde_json::Value::Array(vec![]));
        let mut views: serde_json::Value =
            serde_json::from_str(&views_str).unwrap_or(serde_json::Value::Array(vec![]));

        let mut changed = false;

        if let serde_json::Value::Array(arr) = &mut ec {
            for comp in arr.iter_mut() {
                if clear_device_binding(comp) {
                    changed = true;
                }
            }
        }

        if let serde_json::Value::Array(views_arr) = &mut views {
            for v in views_arr.iter_mut() {
                if let Some(arr) = v.get_mut("components").and_then(|c| c.as_array_mut()) {
                    for comp in arr.iter_mut() {
                        if clear_device_binding(comp) {
                            changed = true;
                        }
                    }
                }
            }
        }

        if changed {
            conn.execute(
                "UPDATE scenes SET editor_components = ?1, views = ?2 WHERE id = ?3",
                rusqlite::params![ec.to_string(), views.to_string(), scene_id],
            )?;
        }
    }

    Ok(())
}

/// 为"巷道喷雾监控"场景（scene_spray_tunnel）追加"日志监控"视图（view_log_monitor）。
///
/// 幂等升级迁移：若 views 中已存在 id="view_log_monitor" 的视图则直接返回，多次执行不会重复添加。
/// canvasConfig 复用场景中默认视图（view_default）的 4K 画布配置，保证与默认视图一致。
/// 必须在 seed_spray_scenes 之后调用（此时场景已完成种子插入或已存在）。
fn add_log_monitor_view(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 安全检查：views 列可能还不存在（防御性，正常流程下 migrate 已通过 ALTER TABLE 添加）
    let scene_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(scenes)")?
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    if !scene_columns.contains(&"views".to_string()) {
        return Ok(());
    }

    // 读取 scene_spray_tunnel 的 views 字段；场景不存在 / views 为空时跳过
    let views_str: String = match conn.query_row(
        "SELECT views FROM scenes WHERE id = 'scene_spray_tunnel'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        Ok(s) if !s.is_empty() => s,
        _ => return Ok(()),
    };

    let mut views_arr: Vec<serde_json::Value> = match serde_json::from_str::<serde_json::Value>(&views_str) {
        Ok(serde_json::Value::Array(a)) => a,
        _ => return Ok(()), // views 不是合法 JSON 数组，不处理
    };

    // 幂等检查：已存在 view_log_monitor 则直接返回
    if views_arr
        .iter()
        .any(|v| v.get("id").and_then(|i| i.as_str()) == Some("view_log_monitor"))
    {
        return Ok(());
    }

    // 复用默认视图的 canvasConfig（4K 画布配置），保证与默认视图一致；缺失时使用兜底配置
    let canvas_config = views_arr
        .iter()
        .find(|v| v.get("id").and_then(|i| i.as_str()) == Some("view_default"))
        .and_then(|v| v.get("canvasConfig").cloned())
        .unwrap_or_else(|| {
            serde_json::json!({
                "width": 3840, "height": 2160, "orientation": "landscape", "adaptationType": "scale", "lockAspectRatio": false,
                "background": {"type":"gradient","color":"#1a2a4a","gradient":{"direction":"radial","colors":["#1e3a6b","#0a1525"]},"imageUrl":"","imageFit":"cover","videoUrl":"","videoAutoplay":true,"videoMuted":true,"videoLoop":true},
                "grid":{"visible":true,"size":40,"snapToGrid":false,"dragStep":1,"resizeStep":1,"minorColor":"rgba(79,195,247,0.08)","majorColor":"rgba(79,195,247,0.18)","opacity":0.6,"brightness":1},
                "ruler":{"visible":true},
                "guide":{"visible":true,"color":"#ff3b30","opacity":0.6,"lineWidth":1,"lineStyle":"dashed","preset":"center","customVertical":[],"customHorizontal":[],"snapToGuide":true,"snapToElement":true,"snapThreshold":5,"draggable":false,"showLabel":false},
                "viewport":{"minScale":0.1,"maxScale":5,"zoomStep":0.15}
            })
        });

    // ─── 日志监控视图的图层 ───
    let log_layer = serde_json::json!({
        "id": "layer_log_default",
        "name": "日志图层",
        "type": "layer",
        "visible": true,
        "locked": false,
        "isDefault": true,
        "children": []
    });

    // ─── 日志监控视图的 6 个组件（与 relayout_log_monitor_for_charts V3 目标一致）───
    // 布局（对齐运行态 config.db 实测，0 重叠 / 0 溢出）：
    //   右上(x=2560): 概览卡(2560,100,1280,120)  ← 场景状态一眼可见（避开预览态顶部浮层）
    //   左列(x=8):   筛选面板(8,149,900,2003)
    //   右列(x=909): 操作日志表格(909,279,2923,810) | 命令Donut(909,1090) | 结果Donut(2370,1090) | 告警堆叠(909,1631,2923,529)
    // 注：旧 log-stats-cards 与 alarm-trend-chart 已删除（前者与 overview-cards 重复，
    // 后者被 alarm-trend-stacked 严格超集替代）。
    let log_components = serde_json::json!([
        {
            "id": "comp_log_overview",
            "type": "industrial-log-overview-cards",
            "name": "日志概览卡",
            "transform": {"x": 2560, "y": 100, "width": 1280, "height": 120, "rotation": 0, "scale": {"x": 1, "y": 1}},
            "layerId": "layer_log_default",
            "zIndex": 1,
            "locked": false,
            "visible": true,
            "config": {}
        },
        {
            "id": "comp_log_filter",
            "type": "industrial-log-filter-panel",
            "name": "日志筛选面板",
            "transform": {"x": 8, "y": 149, "width": 900, "height": 2003, "rotation": 0, "scale": {"x": 1, "y": 1}},
            "layerId": "layer_log_default",
            "zIndex": 2,
            "locked": false,
            "visible": true,
            "config": {}
        },
        {
            "id": "comp_log_operation",
            "type": "industrial-operation-log-table",
            "name": "操作日志表格",
            "transform": {"x": 909, "y": 279, "width": 2923, "height": 810, "rotation": 0, "scale": {"x": 1, "y": 1}},
            "layerId": "layer_log_default",
            "zIndex": 3,
            "locked": false,
            "visible": true,
            "config": {}
        },
        {
            "id": "comp_log_cmd_donut",
            "type": "industrial-operation-cmd-donut",
            "name": "操作命令分布",
            "transform": {"x": 909, "y": 1090, "width": 1460, "height": 540, "rotation": 0, "scale": {"x": 1, "y": 1}},
            "layerId": "layer_log_default",
            "zIndex": 4,
            "locked": false,
            "visible": true,
            "config": {}
        },
        {
            "id": "comp_log_result_donut",
            "type": "industrial-operation-result-donut",
            "name": "操作结果分布",
            "transform": {"x": 2370, "y": 1090, "width": 1462, "height": 540, "rotation": 0, "scale": {"x": 1, "y": 1}},
            "layerId": "layer_log_default",
            "zIndex": 5,
            "locked": false,
            "visible": true,
            "config": {}
        },
        {
            "id": "comp_log_alarm_stacked",
            "type": "industrial-alarm-trend-stacked",
            "name": "告警趋势堆叠图",
            "transform": {"x": 909, "y": 1631, "width": 2923, "height": 529, "rotation": 0, "scale": {"x": 1, "y": 1}},
            "layerId": "layer_log_default",
            "zIndex": 6,
            "locked": false,
            "visible": true,
            "config": {}
        }
    ]);

    // ─── 构造日志监控视图并追加到 views 数组 ───
    let log_view = serde_json::json!({
        "id": "view_log_monitor",
        "name": "日志监控",
        "icon": "receipt_long",
        "components": log_components,
        "layers": [log_layer],
        "canvasConfig": canvas_config,
        "viewport": {"scale": 1, "offset": {"x": 0, "y": 0}},
        "eventBindings": []
    });

    views_arr.push(log_view);

    let new_views = serde_json::to_string(&views_arr).unwrap_or(views_str);
    conn.execute(
        "UPDATE scenes SET views = ?1, updated_at = strftime('%s','now') WHERE id = 'scene_spray_tunnel'",
        rusqlite::params![new_views],
    )?;

    Ok(())
}

/// 初始化认证配置（Keycloak）
///
/// 没有此配置，前端无法完成登录/注销/刷新 Token 流程，
/// 导致需要认证的 API 全部返回 401。
fn seed_auth_config(conn: &Connection) -> Result<(), rusqlite::Error> {
    // 如果 auth_config 已被用户配置过（base_url 非空 = 已设置过认证服务器），则跳过
    // 旧逻辑检查 enabled!=0，但如果用户禁用了认证(enabled=0)但保留了自定义配置，
    // 重启时会被覆盖。改用 base_url="" 判断"从未配置过"更安全。
    let base_url: String = conn.query_row(
        "SELECT base_url FROM auth_config WHERE id = 1",
        [],
        |row| row.get(0),
    )?;
    if !base_url.is_empty() {
        return Ok(()); // 用户已配置过认证服务器，不覆盖
    }

    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE auth_config SET
            enabled = 1,
            preset = 'keycloak',
            base_url = 'http://localhost:48085',
            auth_params = ?1,
            endpoints = ?2,
            header_config = ?3,
            user_display_config = ?4,
            timeout = 10000,
            token_storage = 'localStorage',
            token_key = 'accessToken',
            token_header = 'Authorization',
            token_prefix = 'Bearer ',
            refresh_enabled = 1,
            refresh_threshold = 300,
            login_redirect_path = '/login',
            login_redirect_param = 'redirect',
            login_auto_redirect = 1,
            whitelist = '[]',
            updated_at = ?5
         WHERE id = 1",
        rusqlite::params![
            r##"[{"id":"73bvm1z","key":"username","label":"用户名","value":"iot_admin","location":"body","required":true},{"id":"nmo4i6b","key":"password","label":"密码","value":"admin123","location":"body","required":true}]"##,
            r##"[{"id":"its2tnd","name":"登录","path":"/admin-api/system/auth/login","method":"POST","responseMapping":[{"sourcePath":"data.accessToken","targetKey":"accessToken","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.refreshToken","targetKey":"refreshToken","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.userId","targetKey":"userId","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.expiresTime","targetKey":"expiresTime","saveToCache":true,"isExpirationTime":true}],"bindToMenu":true,"menuIcon":"icon_94a3e95c1b924835ba31cfb7a4aafc90","endpointType":"login"},{"id":"ven2art","name":"注销","path":"/admin-api/system/auth/logout","method":"POST","responseMapping":[],"bindToMenu":true,"menuIcon":"icon_77c17ba414234cbaa429131c5106cac7","endpointType":"logout"},{"id":"8xcy2zo","name":"刷新","path":"/admin-api/system/auth/refresh-token","method":"POST","responseMapping":[{"sourcePath":"data.accessToken","targetKey":"accessToken","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.refreshToken","targetKey":"refreshToken","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.userId","targetKey":"userId","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.expiresTime","targetKey":"expiresTime","saveToCache":true,"isExpirationTime":false}],"bindToMenu":false,"menuIcon":"refresh","endpointType":"refresh"}]"##,
            r##"[{"id":"j0v1tr9","headerName":"Authorization","valueTemplate":"Bearer ${accessToken}","usage":"both"},{"id":"kgo3tjc","headerName":"tenant-id","valueTemplate":"162","usage":"both"}]"##,
            r##"[{"cacheKey":"userId","displayType":"custom","customLabel":"用户ID"}]"##,
            now,
        ],
    )?;

    Ok(())
}

/// 初始化认证预设（Keycloak）
fn seed_auth_config_presets(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM auth_config_presets", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT OR IGNORE INTO auth_config_presets (preset, config, updated_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![
            "keycloak",
            r##"{"enabled":true,"preset":"keycloak","baseUrl":"http://localhost:48085","authParams":[{"id":"73bvm1z","key":"username","label":"用户名","value":"iot_admin","location":"body","required":true},{"id":"nmo4i6b","key":"password","label":"密码","value":"admin123","location":"body","required":true}],"endpoints":[{"id":"its2tnd","name":"登录","path":"/admin-api/system/auth/login","method":"POST","responseMapping":[{"sourcePath":"data.accessToken","targetKey":"accessToken","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.refreshToken","targetKey":"refreshToken","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.userId","targetKey":"userId","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.expiresTime","targetKey":"expiresTime","saveToCache":true,"isExpirationTime":true}],"bindToMenu":true,"menuIcon":"icon_94a3e95c1b924835ba31cfb7a4aafc90","endpointType":"login"},{"id":"ven2art","name":"注销","path":"/admin-api/system/auth/logout","method":"POST","responseMapping":[],"bindToMenu":true,"menuIcon":"icon_77c17ba414234cbaa429131c5106cac7","endpointType":"logout"},{"id":"8xcy2zo","name":"刷新","path":"/admin-api/system/auth/refresh-token","method":"POST","responseMapping":[{"sourcePath":"data.accessToken","targetKey":"accessToken","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.refreshToken","targetKey":"refreshToken","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.userId","targetKey":"userId","saveToCache":true,"isExpirationTime":false},{"sourcePath":"data.expiresTime","targetKey":"expiresTime","saveToCache":true,"isExpirationTime":false}],"bindToMenu":false,"menuIcon":"refresh","endpointType":"refresh"}],"headerConfig":[{"id":"j0v1tr9","headerName":"Authorization","valueTemplate":"Bearer ${accessToken}","usage":"both"},{"id":"kgo3tjc","headerName":"tenant-id","valueTemplate":"162","usage":"both"}],"userDisplayConfig":[{"cacheKey":"userId","displayType":"custom","customLabel":"用户ID"}],"timeout":10000,"tokenStorage":"localStorage","tokenKey":"accessToken","tokenHeader":"Authorization","tokenPrefix":"Bearer ","refreshEnabled":true,"refreshThreshold":300,"loginRedirectPath":"/login","loginRedirectParam":"redirect","loginAutoRedirect":true,"whitelist":[]}"##,
            now,
        ],
    )?;

    Ok(())
}

/// 初始化用户设置（device_adapters / theme / layout / alarm_prefs_v1）
///
/// device_adapters 是关键配置：没有它，前端 deviceStore 无法连接 edge-conductor，
/// 所有设备数据（集控器/分控器/传感器）均为空，场景组件全部显示无数据。
fn seed_user_settings(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM user_settings", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();

    // 1. device_adapters — 边缘网关适配器（关联边缘计算数据源 ds_1776244070218_jgjoqw）
    conn.execute(
        "INSERT OR IGNORE INTO user_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![
            "device_adapters",
            r##"[{"id":"adapter_1780917188370_l6e2","name":"边缘网关","type":"edge-conductor","enabled":true,"dataSourceId":"ds_1776244070218_jgjoqw","apiMapping":{"deviceListPath":"/api/devices","deviceStatsPath":"/devices/stats","wsStatusPath":"/ws/device/status"},"fieldMapping":{"deviceId":"device_id","productCode":"product_code","productName":"product_name","deviceCategory":"device_category","online":"online","ip":"ip","mac":"mac","lastHeartbeat":"last_heartbeat","parentDeviceId":"parent_device_id","parentProductCode":"parent_product_code"},"categoryMapping":{"main_controller":"main","sub_controller":"sub","sensor":"sensor"},"productCodeMapping":{}}]"##,
            now,
        ],
    )?;

    // 2. theme — 主题设置
    conn.execute(
        "INSERT OR IGNORE INTO user_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![
            "theme",
            r##"{"mode":"light","preset":"default","customPrimary":"#ff4013","fontSize":"medium","borderRadius":"medium"}"##,
            now,
        ],
    )?;

    // 3. layout — 布局设置
    conn.execute(
        "INSERT OR IGNORE INTO user_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![
            "layout",
            r##"{"preset":"default","sidebarCollapsed":false,"sidebarWidth":240,"sidebarPosition":"left","contentPadding":"medium","navbarStyle":"standard"}"##,
            now,
        ],
    )?;

    // 4. alarm_prefs_v1 — 告警偏好
    conn.execute(
        "INSERT OR IGNORE INTO user_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![
            "alarm_prefs_v1",
            r##"{"soundEnabled":true,"notifyEnabled":true}"##,
            now,
        ],
    )?;

    Ok(())
}

/// 初始化默认数据源（边缘计算 / Redis / GreptimeDB / MQTT / MySQL / PostgreSQL）
fn seed_data_sources(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM data_sources", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();

    // 1. 边缘计算（HTTP 数据源，指向 edge-conductor）
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (id, name, type, description, enabled, connection, response_mapping, strategy, bound_components, test_apis, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '{}', '[]', ?7, ?8, ?8)",
        rusqlite::params![
            "ds_1776244070218_jgjoqw",
            "边缘计算",
            "http",
            "",
            1,
            r##"{"url":"http://localhost:8084","headers":[{"id":"h_1776303870061_vxue","key":"Content-Type","value":"application/json","enabled":true}],"timeout":10000}"##,
            r##"[{"id":"api_1776256187200_a3xc","name":"health","path":"/api/system/health-check","method":"POST","body":null}]"##,
            now,
        ],
    )?;

    // 2. Redis
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (id, name, type, description, enabled, connection, response_mapping, strategy, bound_components, test_apis, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '{}', '[]', '[]', ?7, ?7)",
        rusqlite::params![
            "ds_1776421454707_6m1cb6",
            "Redis",
            "database",
            "",
            1,
            r##"{"url":"","headers":[],"timeout":10000,"database":{"dbType":"redis","host":"localhost","port":6379,"username":"","password":"","database":"","options":{}},"databaseTest":{"query":"PING"}}"##,
            now,
        ],
    )?;

    // 3. 边缘计算GreptimeDB
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (id, name, type, description, enabled, connection, response_mapping, strategy, bound_components, test_apis, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '{}', '[]', '[]', ?7, ?7)",
        rusqlite::params![
            "ds_1776323284750_us1o43",
            "边缘计算GreptimeDB",
            "database",
            "",
            1,
            r##"{"url":"mqtt://127.0.0.1:18830","headers":[],"timeout":10000,"database":{"dbType":"greptimedb","connectionMode":"http-sql","host":"localhost","port":4000,"username":"","password":"","database":"public","options":{}},"databaseTest":{"query":"SELECT 1"}}"##,
            now,
        ],
    )?;

    // 4. MQTT Broker
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (id, name, type, description, enabled, connection, response_mapping, strategy, bound_components, test_apis, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '{}', '[]', '[]', ?7, ?7)",
        rusqlite::params![
            "ds_1776323734001_iuf4wz",
            "MQTT Broker",
            "mqtt",
            "",
            1,
            r##"{"url":"tcp://127.0.0.1:18830","headers":[],"timeout":10000,"mqtt":{"protocol":"mqtt","host":"localhost","port":18830,"username":"Test","password":"test","clientId":"edgeview_3m1tefyg","keepAlive":60,"cleanSession":true,"version":"3.1.1","reconnect":true,"reconnectInterval":5000,"reconnectAttempts":10}}"##,
            now,
        ],
    )?;

    // 5. 云端MySQL
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (id, name, type, description, enabled, connection, response_mapping, strategy, bound_components, test_apis, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '{}', '[]', '[]', ?7, ?7)",
        rusqlite::params![
            "ds_1776316978292_o2bkbg",
            "云端MySQL",
            "database",
            "",
            1,
            r##"{"url":"","headers":[],"timeout":10000,"database":{"dbType":"mysql","host":"localhost","port":3306,"username":"root","password":"lili@112357","database":"dfy-test-db","options":{}},"databaseTest":{"query":"SELECT 1"}}"##,
            now,
        ],
    )?;

    // 6. 云端PostgreSQL
    conn.execute(
        "INSERT OR IGNORE INTO data_sources (id, name, type, description, enabled, connection, response_mapping, strategy, bound_components, test_apis, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '{}', '[]', '[]', ?7, ?7)",
        rusqlite::params![
            "ds_1776421779450_wipi39",
            "云端PostgreSQL",
            "database",
            "",
            1,
            r##"{"url":"","headers":[],"timeout":10000,"database":{"dbType":"postgresql","host":"localhost","port":5432,"username":"burrs","password":"123456","database":"burrs_cloud","options":{}},"databaseTest":{"query":"SELECT 1"}}"##,
            now,
        ],
    )?;

    Ok(())
}

/// 初始化喷雾系统种子场景（巷道 / 廊桥 / 综采）
fn seed_spray_scenes(conn: &Connection) -> Result<(), rusqlite::Error> {
    // ─── 0) 先初始化数据源和用户设置（场景组件引用数据源 ID，必须先插入） ───
    seed_data_sources(conn)?;
    seed_user_settings(conn)?;

    // ─── 1) 已存在场景的升级迁移（生产环境数据修复） ───
    // 不论场景是否存在，都先对 comp_tunnel_1/2/3/4 执行就地更新，
    // 这样新用户（空库）走完种子插入后也会被再次校准，老用户则能修复老数据。
    upgrade_spray_scene_components(conn)?;

    // ─── 2) 首次种子数据插入（空库） ───
    // 如果已有任一种子场景则跳过
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM scenes WHERE id IN ('scene_default','scene_spray_tunnel','scene_spray_bridge','scene_spray_mining')",
        [],
        |row| row.get(0),
    )?;
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();

    // ─── 4K 画布配置（中深蓝科技风背景） ───
    // ─── 4K 画布配置（带深蓝科技渐变）───
    // 背景层次：深蓝径向渐变 + 水平/垂直方向渐变（中心稍亮、四角更暗）
    let canvas_config_4k = r##"{"width":3840,"height":2160,"orientation":"landscape","adaptationType":"scale","lockAspectRatio":false,"background":{"type":"gradient","color":"#1a2a4a","gradient":{"direction":"radial","colors":["#1e3a6b","#0a1525"]},"imageUrl":"","imageFit":"cover","videoUrl":"","videoAutoplay":true,"videoMuted":true,"videoLoop":true},"grid":{"visible":true,"size":40,"snapToGrid":false,"dragStep":1,"resizeStep":1,"minorColor":"rgba(79,195,247,0.08)","majorColor":"rgba(79,195,247,0.18)","opacity":0.6,"brightness":1},"ruler":{"visible":true},"guide":{"visible":true,"color":"#ff3b30","opacity":0.6,"lineWidth":1,"lineStyle":"dashed","preset":"center","customVertical":[],"customHorizontal":[],"snapToGuide":true,"snapToElement":true,"snapThreshold":5,"draggable":false,"showLabel":false},"viewport":{"minScale":0.1,"maxScale":5,"zoomStep":0.15}}"##;

    // ─── 巷道场景的 20 个组件（4K画布精确布局 + 装饰组件） ───
    // 画布尺寸: 3840 × 2160
    // ─── 巷道场景数据绑定配置 ───
    let tunnel_bindings = "[]";

    // 布局分区: 顶部(0-120) | 主体(140-2000) | 底部(2020-2100)
    //          左侧(20-640) | 中间(660-2860) | 右侧(2880-3820)
    let tunnel_components = r##"[{"id":"comp_tunnel_1","type":"top-glow-title-frame","name":"顶部标题栏","transform":{"x":0,"y":0,"width":3840,"height":120,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":1,"locked":false,"visible":true,"config":{"text":"巷道喷雾降尘智能监控大屏","subtext":"SMART MONITORING PLATFORM","color":"#4fc3f7","fontSize":100,"letterSpacing":20,"textPosition":60,"textStrokeColor":"#0a1f3d","textStrokeWidth":4,"textGlowEnabled":true,"textGlowIntensity":8,"stroke":"#4fc3f7","strokeWidth":2,"subLineEnabled":true,"subLineOffset":6,"subLineOpacity":0.45,"lineStyle":"gradient","endCapStyle":"diamond","centerDecor":"diamond","linePosition":30,"lineLength":70,"decorSize":120,"bgBarEnabled":true,"bgBarColor":"#4fc3f7","bgBarOpacity":0.12,"bgBarHeight":50,"badgeLeft":"","badgeRight":"","badgeColor":"#4fc3f7","badgeFontSize":14,"badgeShowTime":true,"glowEnabled":true,"glowColor":"#4fc3f7","glowIntensity":4,"glowPulse":true,"flowLight":true,"speed":3000,"fillColor":"rgba(79,195,247,0.05)","fillOpacity":0.1,"opacity":1}},{"id":"comp_tunnel_2","type":"top-glow-title-frame","name":"左侧标题","transform":{"x":10,"y":130,"width":640,"height":60,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":2,"locked":false,"visible":true,"config":{"text":"采集监控区","subtext":"DATA ACQUISITION","color":"#ffffff","fontSize":22,"letterSpacing":4,"textPosition":55,"textStrokeColor":"#0a1f3d","textStrokeWidth":1,"textGlowEnabled":true,"textGlowIntensity":2,"stroke":"#4fc3f7","strokeWidth":1.5,"subLineEnabled":true,"subLineOffset":4,"subLineOpacity":0.4,"lineStyle":"gradient","endCapStyle":"diamond","centerDecor":"none","linePosition":30,"lineLength":80,"decorSize":90,"bgBarEnabled":true,"bgBarColor":"#4fc3f7","bgBarOpacity":0.1,"bgBarHeight":55,"badgeLeft":"F1","badgeRight":"","badgeColor":"#4fc3f7","badgeFontSize":12,"badgeShowTime":false,"glowEnabled":true,"glowColor":"#4fc3f7","glowIntensity":3,"glowPulse":true,"flowLight":true,"speed":3500,"fillColor":"rgba(79,195,247,0.05)","fillOpacity":0.1,"opacity":1}},{"id":"comp_tunnel_3","type":"top-glow-title-frame","name":"中间标题","transform":{"x":660,"y":130,"width":2200,"height":60,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":3,"locked":false,"visible":true,"config":{"text":"设备组态区","subtext":"EQUIPMENT SCADA","color":"#ffffff","fontSize":22,"letterSpacing":4,"textPosition":55,"textStrokeColor":"#0a1f3d","textStrokeWidth":1,"textGlowEnabled":true,"textGlowIntensity":2,"stroke":"#4fc3f7","strokeWidth":1.5,"subLineEnabled":true,"subLineOffset":4,"subLineOpacity":0.4,"lineStyle":"gradient","endCapStyle":"diamond","centerDecor":"none","linePosition":30,"lineLength":60,"decorSize":90,"bgBarEnabled":true,"bgBarColor":"#4fc3f7","bgBarOpacity":0.1,"bgBarHeight":55,"badgeLeft":"","badgeRight":"","badgeColor":"#4fc3f7","badgeFontSize":12,"badgeShowTime":false,"glowEnabled":true,"glowColor":"#4fc3f7","glowIntensity":3,"glowPulse":true,"flowLight":true,"speed":3000,"fillColor":"rgba(79,195,247,0.05)","fillOpacity":0.1,"opacity":1}},{"id":"comp_tunnel_4","type":"top-glow-title-frame","name":"右侧标题","transform":{"x":2870,"y":130,"width":950,"height":60,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":4,"locked":false,"visible":true,"config":{"text":"集控管理区","subtext":"CENTRAL CONTROL","color":"#ffffff","fontSize":22,"letterSpacing":4,"textPosition":55,"textStrokeColor":"#0a1f3d","textStrokeWidth":1,"textGlowEnabled":true,"textGlowIntensity":2,"stroke":"#4fc3f7","strokeWidth":1.5,"subLineEnabled":true,"subLineOffset":4,"subLineOpacity":0.4,"lineStyle":"gradient","endCapStyle":"diamond","centerDecor":"none","linePosition":30,"lineLength":80,"decorSize":90,"bgBarEnabled":true,"bgBarColor":"#4fc3f7","bgBarOpacity":0.1,"bgBarHeight":55,"badgeLeft":"","badgeRight":"F3","badgeColor":"#4fc3f7","badgeFontSize":12,"badgeShowTime":false,"glowEnabled":true,"glowColor":"#4fc3f7","glowIntensity":3,"glowPulse":true,"flowLight":true,"speed":3200,"fillColor":"rgba(79,195,247,0.05)","fillOpacity":0.1,"opacity":1}},{"id":"comp_tunnel_5","type":"industrial-dust-trend","name":"粉尘浓度趋势","transform":{"x":30,"y":200,"width":600,"height":440,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":10,"locked":false,"visible":true,"config":{"title":"粉尘浓度趋势","smooth":true,"areaStyle":true,"theme":"dark","xAxisType":"time","yAxisType":"value","showDataZoom":true,"showGrid":true,"titleColor":"#4fc3f7","windowSize":120,"yAxisName":"mg/m³","selectedDeviceIds":[],"showSensorPortraits":true,"valuePrecision":2,"warningRatio":0.8}},{"id":"comp_tunnel_12","type":"industrial-scrolling-table","name":"巷道设备列表","transform":{"x":0,"y":1880,"width":3840,"height":280,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":17,"locked":false,"visible":true,"config":{"scrollSpeed":30,"scrollDirection":"vertical","headerBgColor":"#1a3a6e","rowBgColor":"rgba(79,195,247,0.08)","textColor":"#ffffff","columns":[{"key":"id","label":"编号","type":"text","width":"15%"},{"key":"name","label":"巷道名称","type":"text","width":"35%"},{"key":"status","label":"在线","type":"status","width":"20%"},{"key":"count","label":"分控器","type":"text","width":"15%"},{"key":"fault","label":"故障","type":"status","width":"15%"}],"dataSourceId":"ds_1776244070218_jgjoqw","selectedDeviceIds":["1234567891","1234567891_1","1234567891_1_a6","1234567891_2","1234567891_2_a7","1234567891_3","1234567891_3_a6","1234567891_3_a7"],"columnMappings":[{"key":"状态","value":"status"},{"key":"设备ID","value":"device_id"}]}},{"id":"comp_tunnel_13","type":"industrial-stats-card","name":"左侧统计-在线","transform":{"x":30,"y":1340,"width":190,"height":120,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":18,"locked":false,"visible":true,"config":{"icon":"online","label":"在线设备","value":"28","unit":"台","theme":"dark","color":"#4caf50","statType":"online_devices","cardName":"在线设备","iconType":"online"}},{"id":"comp_tunnel_14","type":"industrial-stats-card","name":"左侧统计-喷雾","transform":{"x":230,"y":1340,"width":190,"height":120,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":19,"locked":false,"visible":true,"config":{"icon":"spray","label":"喷雾总数","value":"156","unit":"次","theme":"dark","color":"#4fc3f7","statType":"spray_count","cardName":"喷雾总数","iconType":"spray"}},{"id":"comp_tunnel_15","type":"industrial-stats-card","name":"左侧统计-告警","transform":{"x":430,"y":1340,"width":200,"height":120,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":20,"locked":false,"visible":true,"config":{"icon":"alarm","label":"告警数","value":"2","unit":"条","theme":"dark","color":"#ff9800","statType":"alarm_count","cardName":"告警数","iconType":"alarm"}},{"id":"comp_tunnel_20","type":"map-cad","name":"CAD 地图","transform":{"x":680,"y":200,"width":2160,"height":1200,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":30,"locked":false,"visible":true,"config":{"backgroundColor":"#0d1729","lineColor":"#4fc3f7","showGrid":true,"gridColor":"rgba(79,195,247,0.2)","mapLibraryId":""}},{"id":"comp_tunnel_21","type":"industrial-spray-control-toolbar","name":"喷雾控制工具栏","transform":{"x":680,"y":1420,"width":2160,"height":265.301204819277,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":31,"locked":false,"visible":true,"config":{"sceneMode":"tunnel","hasPermission":true,"deviceCode":"","theme":"dark","selectedDeviceIds":["1234567891_1","1234567891_2","1234567891"]}},{"id":"comp_tunnel_23","type":"industrial-video-player","name":"视频监控","transform":{"x":2890,"y":200,"width":910,"height":540,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":40,"locked":false,"visible":true,"config":{"videoTitle":"巷道入口实时监控","videoUrl":"","autoPlay":true,"showControls":true,"theme":"dark"}},{"id":"comp_tunnel_24","type":"industrial-timing-card","name":"定时任务设置","transform":{"x":2890,"y":760,"width":910,"height":540,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":41,"locked":false,"visible":true,"config":{"timingMode":"normal","theme":"dark","selectedDeviceIds":["1234567891"]}},{"id":"comp_tunnel_25","type":"industrial-stats-card","name":"集控器-在线","transform":{"x":2890,"y":1320,"width":220,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":42,"locked":false,"visible":true,"config":{"icon":"controller","label":"集控器","value":"5","unit":"台","theme":"dark","color":"#4caf50","statType":"main_controllers_online","cardName":"集控器在线","iconType":"controller"}},{"id":"comp_tunnel_26","type":"industrial-stats-card","name":"集控器-运行","transform":{"x":3120,"y":1320,"width":220,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":43,"locked":false,"visible":true,"config":{"icon":"running","label":"运行中","value":"4","unit":"台","theme":"dark","color":"#4fc3f7","statType":"running_count","cardName":"运行中","iconType":"running"}},{"id":"comp_tunnel_27","type":"industrial-stats-card","name":"集控器-故障","transform":{"x":3350,"y":1320,"width":220,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":44,"locked":false,"visible":true,"config":{"icon":"fault","label":"故障","value":"1","unit":"台","theme":"dark","color":"#ff9800","statType":"fault_count","cardName":"故障","iconType":"fault"}},{"id":"comp_tunnel_28","type":"industrial-stats-card","name":"集控器-通信","transform":{"x":3570,"y":1320,"width":230,"height":140,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":45,"locked":false,"visible":true,"config":{"icon":"signal","label":"通信","value":"98%","theme":"dark","color":"#4caf50","statType":"comm_rate","cardName":"通信","iconType":"signal"}},{"id":"comp_tunnel_42","type":"industrial-dust-alarm-panel","name":"粉尘浓度预警报警","transform":{"x":2890,"y":1480,"width":910,"height":380,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":46,"locked":false,"visible":true,"config":{"title":"粉尘浓度预警报警","selectedDeviceIds":[],"warningRatio":0.8,"valuePrecision":2,"theme":"dark"}},{"id":"comp_tunnel_36","type":"region-frame","name":"左侧采集区边框","transform":{"x":15,"y":190,"width":640,"height":1600,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":5,"locked":false,"visible":true,"config":{"label":"采集监控区","labelColor":"#4fc3f7","labelFontSize":14,"labelPosition":"top-left","showLabel":true,"showIndex":false,"indexText":"01","indexColor":"#4fc3f7","stroke":"#4fc3f7","strokeWidth":1.5,"borderRadius":8,"cornerLength":40,"cornerThickness":2.5,"cornerSize":0,"cornerStyle":"rounded","showCornerDots":false,"cornerDotSize":4,"glowEnabled":true,"glowColor":"#4fc3f7","glowIntensity":3,"pulse":true,"flowLight":true,"flowSpeed":4000,"fillColor":"rgba(79,195,247,0.05)","fillOpacity":0.1,"opacity":1}},{"id":"comp_tunnel_37","type":"region-frame","name":"中间组态区边框","transform":{"x":665,"y":190,"width":2190,"height":1680,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":6,"locked":false,"visible":true,"config":{"label":"设备组态区","labelColor":"#4fc3f7","labelFontSize":14,"labelPosition":"top-left","showLabel":true,"showIndex":false,"indexText":"02","indexColor":"#4fc3f7","stroke":"#4fc3f7","strokeWidth":1.5,"borderRadius":8,"cornerLength":40,"cornerThickness":2.5,"cornerSize":0,"cornerStyle":"rounded","showCornerDots":false,"cornerDotSize":4,"glowEnabled":true,"glowColor":"#4fc3f7","glowIntensity":3,"pulse":true,"flowLight":true,"flowSpeed":4500,"fillColor":"rgba(79,195,247,0.05)","fillOpacity":0.1,"opacity":1}},{"id":"comp_tunnel_38","type":"region-frame","name":"右侧集控区边框","transform":{"x":2875,"y":190,"width":940,"height":1680,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":7,"locked":false,"visible":true,"config":{"label":"集控管理区","labelColor":"#4fc3f7","labelFontSize":14,"labelPosition":"top-left","showLabel":true,"showIndex":false,"indexText":"03","indexColor":"#4fc3f7","stroke":"#4fc3f7","strokeWidth":1.5,"borderRadius":8,"cornerLength":40,"cornerThickness":2.5,"cornerSize":0,"cornerStyle":"rounded","showCornerDots":false,"cornerDotSize":4,"glowEnabled":true,"glowColor":"#4fc3f7","glowIntensity":3,"pulse":true,"flowLight":true,"flowSpeed":3800,"fillColor":"rgba(79,195,247,0.05)","fillOpacity":0.1,"opacity":1}},{"id":"comp_tunnel_39","type":"cad-enhancer","name":"CAD 装饰增强层","transform":{"x":680,"y":200,"width":2160,"height":1200,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":25,"locked":false,"visible":true,"config":{"accent":"#4fc3f7","accent2":"#aedfff","showCorners":true,"cornerSize":14,"dotSize":2.5,"showHalo":true,"opacity":1}},{"id":"comp_tunnel_40","type":"region-frame","name":"传感器摆放区","transform":{"x":20,"y":660,"width":620,"height":600,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":16,"locked":false,"visible":true,"config":{"label":"传感器摆放区","labelColor":"#4fc3f7","labelFontSize":14,"labelPosition":"top-left","showLabel":true,"showIndex":false,"indexText":"01-A","indexColor":"#4fc3f7","stroke":"#4fc3f7","strokeWidth":1.5,"strokeDasharray":"6,4","borderRadius":6,"cornerLength":24,"cornerThickness":2,"cornerSize":0,"cornerStyle":"rounded","showCornerDots":false,"cornerDotSize":3,"glowEnabled":true,"glowColor":"#4fc3f7","glowIntensity":2,"pulse":true,"flowLight":true,"flowSpeed":5000,"fillColor":"rgba(79,195,247,0.03)","fillOpacity":0.05,"opacity":1,"acceptsDeviceTypes":["sensor","alarm_sensor"]}},{"id":"comp_tunnel_41","type":"industrial-sensor-monitor","name":"传感器实时监控","transform":{"x":30,"y":670,"width":600,"height":580,"rotation":0,"scale":{"x":1,"y":1}},"layerId":"layer_default","zIndex":17,"locked":false,"visible":true,"config":{"title":"传感器监控","selectedDeviceIds":["1234567891"],"columns":4,"accentColor":"#4fc3f7","showSparkline":true,"groupBy":"type","cardStyle":"compact"}}]"##;

    // ─── 标准图层（带所有必需字段）───
    let default_layer_node = r#"[{"id":"layer_default","name":"默认图层","type":"layer","visible":true,"locked":false,"opacity":1,"blendMode":"normal","parentId":null,"children":[],"order":0,"expanded":true,"isDefault":true}]"#;

    // ─── 巷道场景的 view（包含 components, layers, canvasConfig）───
    let tunnel_view = format!(
        r##"[{{
            "id":"view_default",
            "name":"巷道喷雾监控",
            "icon":"dashboard",
            "components":{components},
            "layers":{layers},
            "canvasConfig":{canvas},
            "viewport":{{"scale":1,"offset":{{"x":0,"y":0}}}},
            "eventBindings":[]
        }}]"##,
        components = tunnel_components,
        layers = default_layer_node,
        canvas = canvas_config_4k,
    );

    // ─── 空场景的 view（廊桥/综采）───
    let empty_view = format!(
        r##"[{{
            "id":"view_default",
            "name":"主监控大屏",
            "icon":"dashboard",
            "components":[],
            "layers":{layers},
            "canvasConfig":{canvas},
            "viewport":{{"scale":1,"offset":{{"x":0,"y":0}}}},
            "eventBindings":[]
        }}]"##,
        layers = default_layer_node,
        canvas = canvas_config_4k,
    );

    let empty_layout = "[]";
    let empty_components = "[]";
    let default_layers = default_layer_node;

    // ─── 巷道场景画布布局（编辑器 legacy layout 字段，与 editor_components.transform 同源）
    //   注意：本字段在新版编辑器中已废弃（v1 残留），真实布局由 view.components[*].transform 决定。
    //   仅保留与真实组件 ID 相对应的合法引用，删除 comp_tunnel_7~17 等历史死引用。
    let tunnel_layout = r#"[
      {"componentId":"comp_tunnel_1","x":20,"y":80,"w":620,"h":120,"zIndex":10},
      {"componentId":"comp_tunnel_2","x":20,"y":130,"w":640,"h":60,"zIndex":11},
      {"componentId":"comp_tunnel_3","x":660,"y":130,"w":2200,"h":60,"zIndex":12},
      {"componentId":"comp_tunnel_4","x":2870,"y":130,"w":950,"h":60,"zIndex":13}
    ]"#;

    // ─── 廊桥和综采场景：暂保持空状态，后续可基于巷道复制调整 ───

    // 巷道喷雾监控（预置完整组件 - 使用 views 字段）
    conn.execute(
        "INSERT OR IGNORE INTO scenes
         (id, name, description, coordinate_system, camera, bounds, layers, bindings, variables, layout, category_id, tags, thumbnail, status, metadata, created_at, updated_at, editor_components, editor_layers, canvas_config, views, active_view_id, global_components)
         VALUES (?1, ?2, ?3, 'EPSG:3857', '{}', NULL, ?4, ?5, NULL, ?6, ?7, '[]', NULL, ?8, '{}', ?9, ?9, ?10, ?11, ?12, ?13, ?14, '[]')",
        rusqlite::params![
            "scene_spray_tunnel",
            "巷道喷雾监控",
            "巷道喷雾降尘系统实时监控大屏（4K画布，左-中-右-下布局）",
            default_layers,
            tunnel_bindings,
            tunnel_layout,
            "cat_spray_dedust",
            "draft",
            now,
            tunnel_components,
            default_layers,
            canvas_config_4k,
            tunnel_view,
            "view_default"
        ],
    )?;

    // 廊桥喷雾监控（空场景 - 使用 views 字段）
    conn.execute(
        "INSERT OR IGNORE INTO scenes
         (id, name, description, coordinate_system, camera, bounds, layers, bindings, variables, layout, category_id, tags, thumbnail, status, metadata, created_at, updated_at, editor_components, editor_layers, canvas_config, views, active_view_id, global_components)
         VALUES (?1, ?2, ?3, 'EPSG:3857', '{}', NULL, ?4, '[]', NULL, ?5, ?6, '[]', NULL, ?7, '{}', ?8, ?8, ?9, ?10, ?11, ?12, ?13, '[]')",
        rusqlite::params![
            "scene_spray_bridge",
            "廊桥喷雾监控",
            "廊桥喷雾降尘系统实时监控大屏（4K画布）",
            default_layers,
            empty_layout,
            "cat_spray_dedust",
            "draft",
            now,
            empty_components,
            default_layers,
            canvas_config_4k,
            empty_view,
            "view_default"
        ],
    )?;

    // 综采喷雾监控（空场景 - 使用 views 字段）
    conn.execute(
        "INSERT OR IGNORE INTO scenes
         (id, name, description, coordinate_system, camera, bounds, layers, bindings, variables, layout, category_id, tags, thumbnail, status, metadata, created_at, updated_at, editor_components, editor_layers, canvas_config, views, active_view_id, global_components)
         VALUES (?1, ?2, ?3, 'EPSG:3857', '{}', NULL, ?4, '[]', NULL, ?5, ?6, '[]', NULL, ?7, '{}', ?8, ?8, ?9, ?10, ?11, ?12, ?13, '[]')",
        rusqlite::params![
            "scene_spray_mining",
            "综采喷雾监控",
            "综采工作面喷雾降尘系统实时监控大屏（4K画布）",
            default_layers,
            empty_layout,
            "cat_spray_dedust",
            "draft",
            now,
            empty_components,
            default_layers,
            canvas_config_4k,
            empty_view,
            "view_default"
        ],
    )?;

    // 默认场景（空壳占位符，归属 cat_default，用户可自由编辑）
    conn.execute(
        "INSERT OR IGNORE INTO scenes
         (id, name, description, coordinate_system, camera, bounds, layers, bindings, variables, layout, category_id, tags, thumbnail, status, metadata, created_at, updated_at, editor_components, editor_layers, canvas_config, views, active_view_id, global_components)
         VALUES (?1, ?2, ?3, 'EPSG:3857', '{}', NULL, ?4, '[]', NULL, ?5, ?6, '[]', NULL, ?7, '{}', ?8, ?8, ?9, ?10, ?11, ?12, ?13, '[]')",
        rusqlite::params![
            "scene_default",
            "默认场景",
            "系统默认空白场景",
            default_layers,
            empty_layout,
            "cat_default",
            "draft",
            now,
            empty_components,
            default_layers,
            canvas_config_4k,
            empty_view,
            "view_default"
        ],
    )?;

    Ok(())
}
