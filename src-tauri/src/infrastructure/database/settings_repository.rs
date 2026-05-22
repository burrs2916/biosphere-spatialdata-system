use crate::error::{AppError, AppResult};
use rusqlite::OptionalExtension;
use super::Database;
use std::sync::Arc;

pub struct SqliteSettingsRepository {
    db: Arc<Database>,
}

impl SqliteSettingsRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    pub fn get(&self, key: &str) -> AppResult<Option<String>> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare("SELECT value FROM user_settings WHERE key = ?1")?;
        let result = stmt.query_row([key], |row| row.get::<_, String>(0)).optional()?;

        Ok(result)
    }

    pub fn set(&self, key: &str, value: &str) -> AppResult<()> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES (?1, ?2, strftime('%s', 'now'))",
            [key, value],
        )?;

        Ok(())
    }

    pub fn delete(&self, key: &str) -> AppResult<()> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute("DELETE FROM user_settings WHERE key = ?1", [key])?;

        Ok(())
    }
}
