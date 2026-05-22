use super::models::*;
use crate::error::{AppError, AppResult};
use crate::infrastructure::database::Database;
use rusqlite::params;
use std::sync::Arc;

pub struct ComponentPluginRepository;

impl ComponentPluginRepository {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self
    }

    fn row_to_plugin(row: &rusqlite::Row) -> rusqlite::Result<ComponentPlugin> {
        Ok(ComponentPlugin {
            id: row.get(0)?,
            plugin_type: row.get(1)?,
            name: row.get(2)?,
            version: row.get(3)?,
            description: row.get(4)?,
            icon: row.get(5)?,
            category: row.get(6)?,
            default_size: row.get(7)?,
            default_config: row.get(8)?,
            capabilities: row.get(9)?,
            config_schema: row.get(10)?,
            events: row.get(11)?,
            actions: row.get(12)?,
            data_schema: row.get(13)?,
            renderer_entry: row.get(14)?,
            renderer_format: row.get(15)?,
            dependencies: row.get(16)?,
            permissions: row.get(17)?,
            author: row.get(18)?,
            homepage: row.get(19)?,
            thumbnail: row.get(20)?,
            built_in: row.get::<_, i32>(21)? != 0,
            enabled: row.get::<_, i32>(22)? != 0,
            installed_at: row.get(23)?,
            updated_at: row.get(24)?,
        })
    }

    const SELECT_ALL: &'static str =
        "SELECT id, type, name, version, description, icon, category, default_size, default_config,
                    capabilities, config_schema, events, actions, data_schema, renderer_entry,
                    renderer_format, dependencies, permissions, author, homepage, thumbnail,
                    built_in, enabled, installed_at, updated_at FROM component_plugins";

    pub fn get_all_plugins(db: &Arc<Database>) -> AppResult<Vec<ComponentPlugin>> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn
            .prepare(&format!("{} ORDER BY category, name", Self::SELECT_ALL))
            .map_err(|e| AppError::Database(e.to_string()))?;
        let plugins = stmt
            .query_map([], Self::row_to_plugin)
            .map_err(|e| AppError::Database(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(plugins)
    }

    pub fn get_plugin_by_type(
        db: &Arc<Database>,
        plugin_type: &str,
    ) -> AppResult<Option<ComponentPlugin>> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn
            .prepare(&format!("{} WHERE type = ?1", Self::SELECT_ALL))
            .map_err(|e| AppError::Database(e.to_string()))?;
        let result = stmt.query_row(params![plugin_type], Self::row_to_plugin);
        match result {
            Ok(plugin) => Ok(Some(plugin)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    pub fn get_enabled_plugins(db: &Arc<Database>) -> AppResult<Vec<ComponentPlugin>> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn
            .prepare(&format!(
                "{} WHERE enabled = 1 ORDER BY category, name",
                Self::SELECT_ALL
            ))
            .map_err(|e| AppError::Database(e.to_string()))?;
        let plugins = stmt
            .query_map([], Self::row_to_plugin)
            .map_err(|e| AppError::Database(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(plugins)
    }

    pub fn create_plugin(
        db: &Arc<Database>,
        payload: &CreateComponentPluginPayload,
    ) -> AppResult<ComponentPlugin> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().timestamp();
        let id = format!("cp_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

        conn.execute(
            "INSERT INTO component_plugins (id, type, name, version, description, icon, category,
             default_size, default_config, capabilities, config_schema, events, actions, data_schema,
             renderer_entry, renderer_format, dependencies, permissions, author, homepage, thumbnail,
             built_in, enabled, installed_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, 1, ?23, ?23)",
            params![
                id,
                payload.plugin_type,
                payload.name,
                payload.version.as_deref().unwrap_or("1.0.0"),
                payload.description,
                payload.icon,
                payload.category.as_deref().unwrap_or("custom"),
                payload.default_size.as_deref().unwrap_or("{}"),
                payload.default_config.as_deref().unwrap_or("{}"),
                payload.capabilities.as_deref().unwrap_or("{}"),
                payload.config_schema.as_deref().unwrap_or("[]"),
                payload.events.as_deref().unwrap_or("[]"),
                payload.actions.as_deref().unwrap_or("[]"),
                payload.data_schema,
                payload.renderer_entry,
                payload.renderer_format.as_deref().unwrap_or("module"),
                payload.dependencies.as_deref().unwrap_or("[]"),
                payload.permissions.as_deref().unwrap_or("[]"),
                payload.author,
                payload.homepage,
                payload.thumbnail,
                payload.built_in.unwrap_or(false) as i32,
                now,
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(ComponentPlugin {
            id,
            plugin_type: payload.plugin_type.clone(),
            name: payload.name.clone(),
            version: payload
                .version
                .clone()
                .unwrap_or_else(|| "1.0.0".to_string()),
            description: payload.description.clone(),
            icon: payload.icon.clone(),
            category: payload
                .category
                .clone()
                .unwrap_or_else(|| "custom".to_string()),
            default_size: payload
                .default_size
                .clone()
                .unwrap_or_else(|| "{}".to_string()),
            default_config: payload
                .default_config
                .clone()
                .unwrap_or_else(|| "{}".to_string()),
            capabilities: payload
                .capabilities
                .clone()
                .unwrap_or_else(|| "{}".to_string()),
            config_schema: payload
                .config_schema
                .clone()
                .unwrap_or_else(|| "[]".to_string()),
            events: payload.events.clone().unwrap_or_else(|| "[]".to_string()),
            actions: payload.actions.clone().unwrap_or_else(|| "[]".to_string()),
            data_schema: payload.data_schema.clone(),
            renderer_entry: payload.renderer_entry.clone(),
            renderer_format: payload
                .renderer_format
                .clone()
                .unwrap_or_else(|| "module".to_string()),
            dependencies: payload
                .dependencies
                .clone()
                .unwrap_or_else(|| "[]".to_string()),
            permissions: payload
                .permissions
                .clone()
                .unwrap_or_else(|| "[]".to_string()),
            author: payload.author.clone(),
            homepage: payload.homepage.clone(),
            thumbnail: payload.thumbnail.clone(),
            built_in: payload.built_in.unwrap_or(false),
            enabled: true,
            installed_at: now,
            updated_at: now,
        })
    }

    pub fn update_plugin(
        db: &Arc<Database>,
        payload: &UpdateComponentPluginPayload,
    ) -> AppResult<()> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().timestamp();

        let mut set_clauses: Vec<String> = vec!["updated_at = ?".to_string()];
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

        macro_rules! add_field {
            ($field:expr, $value:expr) => {
                if let Some(ref v) = $value {
                    set_clauses.push(format!("{} = ?", $field));
                    param_values.push(Box::new(v.clone()));
                }
            };
        }

        macro_rules! add_bool_field {
            ($field:expr, $value:expr) => {
                if let Some(v) = $value {
                    set_clauses.push(format!("{} = ?", $field));
                    param_values.push(Box::new(v as i32));
                }
            };
        }

        add_field!("name", payload.name);
        add_field!("version", payload.version);
        add_field!("description", payload.description);
        add_field!("icon", payload.icon);
        add_field!("category", payload.category);
        add_field!("default_size", payload.default_size);
        add_field!("default_config", payload.default_config);
        add_field!("capabilities", payload.capabilities);
        add_field!("config_schema", payload.config_schema);
        add_field!("events", payload.events);
        add_field!("actions", payload.actions);
        add_field!("data_schema", payload.data_schema);
        add_field!("renderer_entry", payload.renderer_entry);
        add_field!("renderer_format", payload.renderer_format);
        add_field!("dependencies", payload.dependencies);
        add_field!("permissions", payload.permissions);
        add_field!("author", payload.author);
        add_field!("homepage", payload.homepage);
        add_field!("thumbnail", payload.thumbnail);
        add_bool_field!("enabled", payload.enabled);

        if set_clauses.len() == 1 {
            return Ok(());
        }

        let sql = format!(
            "UPDATE component_plugins SET {} WHERE id = ?",
            set_clauses.join(", ")
        );

        param_values.push(Box::new(payload.id.clone()));

        conn.execute(
            &sql,
            rusqlite::params_from_iter(param_values.iter().map(|v| v.as_ref())),
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    pub fn delete_plugin(db: &Arc<Database>, id: &str) -> AppResult<()> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        conn.execute(
            "DELETE FROM component_plugins WHERE id = ?1 AND built_in = 0",
            params![id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub fn toggle_plugin(db: &Arc<Database>, id: &str, enabled: bool) -> AppResult<()> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE component_plugins SET enabled = ?1, updated_at = ?2 WHERE id = ?3",
            params![enabled as i32, now, id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub fn get_all_categories(db: &Arc<Database>) -> AppResult<Vec<ComponentCategory>> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, icon, color, sort_order, parent_id, description, created_at, updated_at
             FROM component_categories ORDER BY sort_order"
        ).map_err(|e| AppError::Database(e.to_string()))?;

        let categories = stmt
            .query_map([], |row| {
                Ok(ComponentCategory {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    color: row.get(3)?,
                    sort_order: row.get(4)?,
                    parent_id: row.get(5)?,
                    description: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(categories)
    }

    pub fn create_category(
        db: &Arc<Database>,
        payload: &CreateCategoryPayload,
    ) -> AppResult<ComponentCategory> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO component_categories (id, name, icon, color, sort_order, parent_id, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            params![
                payload.id,
                payload.name,
                payload.icon,
                payload.color,
                payload.sort_order.unwrap_or(0),
                payload.parent_id,
                payload.description,
                now,
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(ComponentCategory {
            id: payload.id.clone(),
            name: payload.name.clone(),
            icon: payload.icon.clone(),
            color: payload.color.clone(),
            sort_order: payload.sort_order.unwrap_or(0),
            parent_id: payload.parent_id.clone(),
            description: payload.description.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_category(db: &Arc<Database>, payload: &UpdateCategoryPayload) -> AppResult<()> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().timestamp();

        let mut set_clauses: Vec<String> = vec!["updated_at = ?".to_string()];
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];

        macro_rules! add_field {
            ($field:expr, $value:expr) => {
                if let Some(ref v) = $value {
                    set_clauses.push(format!("{} = ?", $field));
                    param_values.push(Box::new(v.clone()));
                }
            };
        }

        add_field!("name", payload.name);
        add_field!("icon", payload.icon);
        add_field!("color", payload.color);
        if let Some(v) = payload.sort_order {
            set_clauses.push("sort_order = ?".to_string());
            param_values.push(Box::new(v));
        }
        add_field!("parent_id", payload.parent_id);
        add_field!("description", payload.description);

        if set_clauses.len() == 1 {
            return Ok(());
        }

        let sql = format!(
            "UPDATE component_categories SET {} WHERE id = ?",
            set_clauses.join(", ")
        );

        param_values.push(Box::new(payload.id.clone()));

        conn.execute(
            &sql,
            rusqlite::params_from_iter(param_values.iter().map(|v| v.as_ref())),
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    pub fn delete_category(db: &Arc<Database>, id: &str) -> AppResult<()> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        conn.execute(
            "DELETE FROM component_categories WHERE id = ?1",
            params![id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    pub fn move_plugin_to_category(
        db: &Arc<Database>,
        plugin_id: &str,
        category: &str,
    ) -> AppResult<()> {
        let conn = db.0.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE component_plugins SET category = ?1, updated_at = ?2 WHERE id = ?3",
            params![category, now, plugin_id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }
}
