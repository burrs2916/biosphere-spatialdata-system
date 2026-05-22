use crate::domain::scene::{Scene, SceneCategory};
use crate::error::{AppError, AppResult};
use crate::infrastructure::database::Database;
use std::sync::Arc;

pub trait SceneRepository: Send + Sync {
    fn get_all_scenes(&self) -> AppResult<Vec<Scene>>;
    fn get_scene_by_id(&self, id: &str) -> AppResult<Option<Scene>>;
    fn get_scenes_by_category(&self, category_id: &str) -> AppResult<Vec<Scene>>;
    fn save_scene(&self, scene: &Scene) -> AppResult<()>;
    fn delete_scene(&self, id: &str) -> AppResult<()>;

    fn get_all_categories(&self) -> AppResult<Vec<SceneCategory>>;
    fn get_category_by_id(&self, id: &str) -> AppResult<Option<SceneCategory>>;
    fn save_category(&self, category: &SceneCategory) -> AppResult<()>;
    fn delete_category(&self, id: &str) -> AppResult<()>;
}

pub struct SqliteSceneRepository {
    db: Arc<Database>,
}

impl Clone for SqliteSceneRepository {
    fn clone(&self) -> Self {
        Self {
            db: self.db.clone(),
        }
    }
}

impl SqliteSceneRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    fn row_to_scene(&self, row: &rusqlite::Row) -> rusqlite::Result<Scene> {
        let id: String = row.get(0)?;
        let name: String = row.get(1)?;
        let description: Option<String> = row.get(2)?;
        let coordinate_system: String = row.get(3)?;
        let camera: String = row.get(4)?;
        let bounds: Option<String> = row.get(5)?;
        let layers: String = row.get(6)?;
        let bindings: String = row.get(7)?;
        let layout: String = row.get(8)?;
        let editor_components: Option<String> = row.get(9)?;
        let editor_layers: Option<String> = row.get(10)?;
        let canvas_config: Option<String> = row.get(11)?;
        let category_id: Option<String> = row.get(12)?;
        let tags: String = row.get(13)?;
        let thumbnail: Option<String> = row.get(14)?;
        let status_str: String = row.get(15)?;
        let metadata: String = row.get(16)?;
        let created_at: i64 = row.get(17)?;
        let updated_at: i64 = row.get(18)?;

        Ok(Scene {
            id,
            name,
            description,
            coordinate_system,
            camera,
            bounds,
            layers,
            bindings,
            layout,
            editor_components,
            editor_layers,
            canvas_config,
            category_id,
            tags,
            thumbnail,
            status: crate::domain::scene::SceneStatus::from(status_str),
            metadata,
            created_at,
            updated_at,
        })
    }

    fn row_to_category(&self, row: &rusqlite::Row) -> rusqlite::Result<SceneCategory> {
        let id: String = row.get(0)?;
        let name: String = row.get(1)?;
        let icon: Option<String> = row.get(2)?;
        let color: Option<String> = row.get(3)?;
        let sort_order: i32 = row.get(4)?;
        let parent_id: Option<String> = row.get(5)?;
        let description: Option<String> = row.get(6)?;
        let created_at: i64 = row.get(7)?;
        let updated_at: i64 = row.get(8)?;

        Ok(SceneCategory {
            id,
            name,
            icon,
            color,
            sort_order,
            parent_id,
            description,
            created_at,
            updated_at,
        })
    }
}

impl SceneRepository for SqliteSceneRepository {
    fn get_all_scenes(&self) -> AppResult<Vec<Scene>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, description, coordinate_system, camera, bounds, layers, bindings, layout, editor_components, editor_layers, canvas_config, category_id, tags, thumbnail, status, metadata, created_at, updated_at
             FROM scenes
             ORDER BY updated_at DESC"
        )?;

        let rows = stmt.query_map([], |row| self.row_to_scene(row))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }

        Ok(result)
    }

    fn get_scene_by_id(&self, id: &str) -> AppResult<Option<Scene>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let result = conn.query_row(
            "SELECT id, name, description, coordinate_system, camera, bounds, layers, bindings, layout, editor_components, editor_layers, canvas_config, category_id, tags, thumbnail, status, metadata, created_at, updated_at
             FROM scenes WHERE id = ?1",
            [id],
            |row| self.row_to_scene(row),
        );

        match result {
            Ok(scene) => Ok(Some(scene)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    fn get_scenes_by_category(&self, category_id: &str) -> AppResult<Vec<Scene>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, description, coordinate_system, camera, bounds, layers, bindings, layout, editor_components, editor_layers, canvas_config, category_id, tags, thumbnail, status, metadata, created_at, updated_at
             FROM scenes WHERE category_id = ?1
             ORDER BY updated_at DESC"
        )?;

        let rows = stmt.query_map([category_id], |row| self.row_to_scene(row))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }

        Ok(result)
    }

    fn save_scene(&self, scene: &Scene) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let status_str: String = scene.status.clone().into();

        conn.execute(
            "INSERT OR REPLACE INTO scenes (id, name, description, coordinate_system, camera, bounds, layers, bindings, layout, editor_components, editor_layers, canvas_config, category_id, tags, thumbnail, status, metadata, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, strftime('%s', 'now'))",
            rusqlite::params![
                &scene.id,
                &scene.name,
                &scene.description,
                &scene.coordinate_system,
                &scene.camera,
                &scene.bounds,
                &scene.layers,
                &scene.bindings,
                &scene.layout,
                &scene.editor_components,
                &scene.editor_layers,
                &scene.canvas_config,
                &scene.category_id,
                &scene.tags,
                &scene.thumbnail,
                &status_str,
                &scene.metadata,
                scene.created_at,
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn delete_scene(&self, id: &str) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute("DELETE FROM scenes WHERE id = ?1", rusqlite::params![id])
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn get_all_categories(&self) -> AppResult<Vec<SceneCategory>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, icon, color, sort_order, parent_id, description, created_at, updated_at
             FROM scene_categories
             ORDER BY sort_order ASC, name ASC"
        )?;

        let rows = stmt.query_map([], |row| self.row_to_category(row))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }

        Ok(result)
    }

    fn get_category_by_id(&self, id: &str) -> AppResult<Option<SceneCategory>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let result = conn.query_row(
            "SELECT id, name, icon, color, sort_order, parent_id, description, created_at, updated_at
             FROM scene_categories WHERE id = ?1",
            [id],
            |row| self.row_to_category(row),
        );

        match result {
            Ok(cat) => Ok(Some(cat)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    fn save_category(&self, category: &SceneCategory) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "INSERT OR REPLACE INTO scene_categories (id, name, icon, color, sort_order, parent_id, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, strftime('%s', 'now'))",
            rusqlite::params![
                &category.id,
                &category.name,
                &category.icon,
                &category.color,
                category.sort_order,
                &category.parent_id,
                &category.description,
                category.created_at,
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn delete_category(&self, id: &str) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "DELETE FROM scene_categories WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }
}
