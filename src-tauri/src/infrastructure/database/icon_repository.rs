use crate::domain::icons::{IconFileType, IconGroup, SystemIcon};
use crate::error::{AppError, AppResult};
use crate::infrastructure::database::Database;
use std::sync::Arc;

pub trait IconRepository: Send + Sync {
    fn get_all_groups(&self) -> AppResult<Vec<IconGroup>>;
    fn get_group(&self, id: &str) -> AppResult<Option<IconGroup>>;
    fn save_group(&self, group: &IconGroup) -> AppResult<()>;
    fn delete_group(&self, id: &str) -> AppResult<()>;

    fn get_all_icons(&self) -> AppResult<Vec<SystemIcon>>;
    fn get_icons_by_group(&self, group_id: &str) -> AppResult<Vec<SystemIcon>>;
    fn get_icon(&self, id: &str) -> AppResult<Option<SystemIcon>>;
    fn save_icon(&self, icon: &SystemIcon) -> AppResult<()>;
    fn delete_icon(&self, id: &str) -> AppResult<()>;
}

pub struct SqliteIconRepository {
    db: Arc<Database>,
}

impl Clone for SqliteIconRepository {
    fn clone(&self) -> Self {
        Self {
            db: self.db.clone(),
        }
    }
}

impl SqliteIconRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl IconRepository for SqliteIconRepository {
    fn get_all_groups(&self) -> AppResult<Vec<IconGroup>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, description, parent_id, updated_at
             FROM icon_groups
             ORDER BY updated_at DESC",
        )?;

        let groups = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let description: Option<String> = row.get(2)?;
            let parent_id: Option<String> = row.get(3)?;
            let updated_at: i64 = row.get(4)?;

            Ok(IconGroup {
                id,
                name,
                description,
                parent_id,
                updated_at,
            })
        })?;

        let mut result = Vec::new();
        for group in groups {
            result.push(group?);
        }

        Ok(result)
    }

    fn get_group(&self, id: &str) -> AppResult<Option<IconGroup>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let result = conn.query_row(
            "SELECT id, name, description, parent_id, updated_at
             FROM icon_groups
             WHERE id = ?1",
            [id],
            |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let description: Option<String> = row.get(2)?;
                let parent_id: Option<String> = row.get(3)?;
                let updated_at: i64 = row.get(4)?;

                Ok(IconGroup {
                    id,
                    name,
                    description,
                    parent_id,
                    updated_at,
                })
            },
        );

        match result {
            Ok(group) => Ok(Some(group)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    fn save_group(&self, group: &IconGroup) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "INSERT OR REPLACE INTO icon_groups (id, name, description, parent_id, updated_at)
             VALUES (?1, ?2, ?3, ?4, strftime('%s', 'now'))",
            rusqlite::params![&group.id, &group.name, &group.description, &group.parent_id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn delete_group(&self, id: &str) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "DELETE FROM system_icons WHERE group_id IN (SELECT id FROM icon_groups WHERE parent_id = ?1)",
            rusqlite::params![id],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        conn.execute(
            "DELETE FROM icon_groups WHERE parent_id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        conn.execute(
            "DELETE FROM system_icons WHERE group_id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        conn.execute(
            "DELETE FROM icon_groups WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn get_all_icons(&self) -> AppResult<Vec<SystemIcon>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, description, file_path, file_type, group_id, updated_at
             FROM system_icons
             ORDER BY updated_at DESC",
        )?;

        let icons = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let description: Option<String> = row.get(2)?;
            let file_path: String = row.get(3)?;
            let file_type_str: String = row.get(4)?;
            let group_id: String = row.get(5)?;
            let updated_at: i64 = row.get(6)?;

            let file_type = IconFileType::from(file_type_str);

            Ok(SystemIcon {
                id,
                name,
                description,
                file_path,
                file_type,
                group_id,
                updated_at,
            })
        })?;

        let mut result = Vec::new();
        for icon in icons {
            result.push(icon?);
        }

        Ok(result)
    }

    fn get_icons_by_group(&self, group_id: &str) -> AppResult<Vec<SystemIcon>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, description, file_path, file_type, group_id, updated_at
             FROM system_icons
             WHERE group_id = ?1
             ORDER BY updated_at DESC",
        )?;

        let icons = stmt.query_map([group_id], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let description: Option<String> = row.get(2)?;
            let file_path: String = row.get(3)?;
            let file_type_str: String = row.get(4)?;
            let group_id: String = row.get(5)?;
            let updated_at: i64 = row.get(6)?;

            let file_type = IconFileType::from(file_type_str);

            Ok(SystemIcon {
                id,
                name,
                description,
                file_path,
                file_type,
                group_id,
                updated_at,
            })
        })?;

        let mut result = Vec::new();
        for icon in icons {
            result.push(icon?);
        }

        Ok(result)
    }

    fn get_icon(&self, id: &str) -> AppResult<Option<SystemIcon>> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let result = conn.query_row(
            "SELECT id, name, description, file_path, file_type, group_id, updated_at
             FROM system_icons
             WHERE id = ?1",
            [id],
            |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let description: Option<String> = row.get(2)?;
                let file_path: String = row.get(3)?;
                let file_type_str: String = row.get(4)?;
                let group_id: String = row.get(5)?;
                let updated_at: i64 = row.get(6)?;

                let file_type = IconFileType::from(file_type_str);

                Ok(SystemIcon {
                    id,
                    name,
                    description,
                    file_path,
                    file_type,
                    group_id,
                    updated_at,
                })
            },
        );

        match result {
            Ok(icon) => Ok(Some(icon)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    fn save_icon(&self, icon: &SystemIcon) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let file_type_str: String = icon.file_type.clone().into();

        conn.execute(
            "INSERT OR REPLACE INTO system_icons (id, name, description, file_path, file_type, group_id, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%s', 'now'))",
            rusqlite::params![
                &icon.id,
                &icon.name,
                &icon.description,
                &icon.file_path,
                &file_type_str,
                &icon.group_id,
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn delete_icon(&self, id: &str) -> AppResult<()> {
        let conn = self
            .db
            .0
            .lock()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "DELETE FROM system_icons WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }
}
