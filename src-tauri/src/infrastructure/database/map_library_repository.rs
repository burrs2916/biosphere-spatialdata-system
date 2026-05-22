use crate::domain::map_library::{MapLibrary, MapLibraryGroup, MapLibraryStatus, MapLibraryType};
use crate::error::{AppError, AppResult};
use crate::infrastructure::database::Database;
use std::sync::Arc;

#[allow(dead_code)]
pub trait MapLibraryRepository: Send + Sync {
    fn get_all(&self) -> AppResult<Vec<MapLibrary>>;
    fn get_by_id(&self, id: &str) -> AppResult<Option<MapLibrary>>;
    fn get_by_type(&self, map_type: &MapLibraryType) -> AppResult<Vec<MapLibrary>>;
    fn get_by_group(&self, group_id: &str) -> AppResult<Vec<MapLibrary>>;
    fn get_published(&self) -> AppResult<Vec<MapLibrary>>;
    fn get_published_by_type(&self, map_type: &MapLibraryType) -> AppResult<Vec<MapLibrary>>;
    fn save(&self, library: &MapLibrary) -> AppResult<()>;
    fn delete(&self, id: &str) -> AppResult<()>;
}

#[allow(dead_code)]
pub trait MapLibraryGroupRepository: Send + Sync {
    fn get_all_groups(&self) -> AppResult<Vec<MapLibraryGroup>>;
    fn get_groups_by_type(&self, map_type: &MapLibraryType) -> AppResult<Vec<MapLibraryGroup>>;
    fn get_group_by_id(&self, id: &str) -> AppResult<Option<MapLibraryGroup>>;
    fn save_group(&self, group: &MapLibraryGroup) -> AppResult<()>;
    fn delete_group(&self, id: &str) -> AppResult<()>;
}

pub struct SqliteMapLibraryRepository {
    db: Arc<Database>,
}

impl Clone for SqliteMapLibraryRepository {
    fn clone(&self) -> Self {
        Self {
            db: self.db.clone(),
        }
    }
}

impl SqliteMapLibraryRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    const SELECT_FIELDS: &'static str = "id, name, description, map_type, data_dir, source_file, source_format, cadbin_path, coordinate_system, target_crs, bounds, layers, entity_count, metadata, thumbnail, group_id, status, published_at, created_at, updated_at";

    fn row_to_library(&self, row: &rusqlite::Row) -> rusqlite::Result<MapLibrary> {
        Ok(MapLibrary {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            map_type: MapLibraryType::from(row.get::<_, String>(3)?),
            data_dir: row.get(4)?,
            source_file: row.get(5)?,
            source_format: row.get(6)?,
            cadbin_path: row.get(7)?,
            coordinate_system: row.get(8)?,
            target_crs: row.get(9)?,
            bounds: row.get(10)?,
            layers: row.get(11)?,
            entity_count: row.get(12)?,
            metadata: row.get(13)?,
            thumbnail: row.get(14)?,
            group_id: row.get(15)?,
            status: MapLibraryStatus::from(row.get::<_, String>(16)?),
            published_at: row.get(17)?,
            created_at: row.get(18)?,
            updated_at: row.get(19)?,
        })
    }
}

impl MapLibraryRepository for SqliteMapLibraryRepository {
    fn get_all(&self) -> AppResult<Vec<MapLibrary>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM map_libraries ORDER BY updated_at DESC",
            Self::SELECT_FIELDS
        ))?;
        let libraries = stmt
            .query_map([], |row| self.row_to_library(row))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(libraries)
    }

    fn get_by_id(&self, id: &str) -> AppResult<Option<MapLibrary>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM map_libraries WHERE id = ?1",
            Self::SELECT_FIELDS
        ))?;
        let result = stmt.query_row([id], |row| self.row_to_library(row)).ok();
        Ok(result)
    }

    fn get_by_type(&self, map_type: &MapLibraryType) -> AppResult<Vec<MapLibrary>> {
        let type_str: String = map_type.clone().into();
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM map_libraries WHERE map_type = ?1 ORDER BY updated_at DESC",
            Self::SELECT_FIELDS
        ))?;
        let libraries = stmt
            .query_map([type_str], |row| self.row_to_library(row))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(libraries)
    }

    fn get_by_group(&self, group_id: &str) -> AppResult<Vec<MapLibrary>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM map_libraries WHERE group_id = ?1 ORDER BY updated_at DESC",
            Self::SELECT_FIELDS
        ))?;
        let libraries = stmt
            .query_map([group_id], |row| self.row_to_library(row))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(libraries)
    }

    fn get_published(&self) -> AppResult<Vec<MapLibrary>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM map_libraries WHERE status = 'published' ORDER BY updated_at DESC",
            Self::SELECT_FIELDS
        ))?;
        let libraries = stmt
            .query_map([], |row| self.row_to_library(row))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(libraries)
    }

    fn get_published_by_type(&self, map_type: &MapLibraryType) -> AppResult<Vec<MapLibrary>> {
        let type_str: String = map_type.clone().into();
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            &format!("SELECT {} FROM map_libraries WHERE status = 'published' AND map_type = ?1 ORDER BY updated_at DESC", Self::SELECT_FIELDS)
        )?;
        let libraries = stmt
            .query_map([type_str], |row| self.row_to_library(row))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(libraries)
    }

    fn save(&self, library: &MapLibrary) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let type_str: String = library.map_type.clone().into();
        let status_str: String = library.status.clone().into();
        conn.execute(
            "INSERT OR REPLACE INTO map_libraries (id, name, description, map_type, data_dir, source_file, source_format, cadbin_path, coordinate_system, target_crs, bounds, layers, entity_count, metadata, thumbnail, group_id, status, published_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
            rusqlite::params![
                library.id,
                library.name,
                library.description,
                type_str,
                library.data_dir,
                library.source_file,
                library.source_format,
                library.cadbin_path,
                library.coordinate_system,
                library.target_crs,
                library.bounds,
                library.layers,
                library.entity_count,
                library.metadata,
                library.thumbnail,
                library.group_id,
                status_str,
                library.published_at,
                library.created_at,
                library.updated_at,
            ],
        )?;
        Ok(())
    }

    fn delete(&self, id: &str) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        conn.execute("DELETE FROM map_libraries WHERE id = ?1", [id])?;
        Ok(())
    }
}

impl MapLibraryGroupRepository for SqliteMapLibraryRepository {
    fn get_all_groups(&self) -> AppResult<Vec<MapLibraryGroup>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, map_type, parent_id, sort_order, created_at, updated_at FROM map_library_groups ORDER BY sort_order, created_at"
        )?;
        let groups = stmt
            .query_map([], |row| {
                Ok(MapLibraryGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    map_type: MapLibraryType::from(row.get::<_, String>(3)?),
                    parent_id: row.get(4)?,
                    sort_order: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(groups)
    }

    fn get_groups_by_type(&self, map_type: &MapLibraryType) -> AppResult<Vec<MapLibraryGroup>> {
        let type_str: String = map_type.clone().into();
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, map_type, parent_id, sort_order, created_at, updated_at FROM map_library_groups WHERE map_type = ?1 ORDER BY sort_order, created_at"
        )?;
        let groups = stmt
            .query_map([type_str], |row| {
                Ok(MapLibraryGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    map_type: MapLibraryType::from(row.get::<_, String>(3)?),
                    parent_id: row.get(4)?,
                    sort_order: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(groups)
    }

    fn get_group_by_id(&self, id: &str) -> AppResult<Option<MapLibraryGroup>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, map_type, parent_id, sort_order, created_at, updated_at FROM map_library_groups WHERE id = ?1"
        )?;
        let result = stmt
            .query_row([id], |row| {
                Ok(MapLibraryGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    map_type: MapLibraryType::from(row.get::<_, String>(3)?),
                    parent_id: row.get(4)?,
                    sort_order: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })
            .ok();
        Ok(result)
    }

    fn save_group(&self, group: &MapLibraryGroup) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        let type_str: String = group.map_type.clone().into();
        conn.execute(
            "INSERT OR REPLACE INTO map_library_groups (id, name, description, map_type, parent_id, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                group.id,
                group.name,
                group.description,
                type_str,
                group.parent_id,
                group.sort_order,
                group.created_at,
                group.updated_at,
            ],
        )?;
        Ok(())
    }

    fn delete_group(&self, id: &str) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Database(e.to_string()))?;
        conn.execute(
            "UPDATE map_libraries SET group_id = NULL WHERE group_id = ?1",
            [id],
        )?;
        conn.execute("DELETE FROM map_library_groups WHERE id = ?1", [id])?;
        Ok(())
    }
}
