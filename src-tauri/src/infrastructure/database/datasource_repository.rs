use crate::domain::datasource::DataSource;
use crate::error::{AppError, AppResult};
use crate::infrastructure::database::Database;
use std::sync::Arc;

pub trait DatasourceRepository: Send + Sync {
    fn get_all(&self) -> AppResult<Vec<DataSource>>;
    fn get_by_id(&self, id: &str) -> AppResult<Option<DataSource>>;
    fn save(&self, ds: &DataSource) -> AppResult<()>;
    fn delete(&self, id: &str) -> AppResult<()>;
}

pub struct SqliteDatasourceRepository {
    db: Arc<Database>,
}

impl Clone for SqliteDatasourceRepository {
    fn clone(&self) -> Self {
        Self { db: self.db.clone() }
    }
}

impl SqliteDatasourceRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    fn row_to_datasource(&self, row: &rusqlite::Row) -> rusqlite::Result<DataSource> {
        let id: String = row.get(0)?;
        let name: String = row.get(1)?;
        let type_str: String = row.get(2)?;
        let description: Option<String> = row.get(3)?;
        let enabled: i32 = row.get(4)?;
        let connection_str: String = row.get(5)?;
        let response_mapping_str: String = row.get(6)?;
        let test_apis_str: String = row.get(7)?;
        let created_at: i64 = row.get(8)?;
        let updated_at: i64 = row.get(9)?;

        Ok(DataSource {
            id,
            name,
            ds_type: crate::domain::datasource::DataSourceType::from(type_str),
            description,
            enabled: enabled != 0,
            connection: serde_json::from_str(&connection_str).unwrap_or_default(),
            response_mapping: serde_json::from_str(&response_mapping_str).unwrap_or_default(),
            test_apis: serde_json::from_str(&test_apis_str).unwrap_or_default(),
            created_at,
            updated_at,
        })
    }
}

impl DatasourceRepository for SqliteDatasourceRepository {
    fn get_all(&self) -> AppResult<Vec<DataSource>> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, type, description, enabled, connection, response_mapping, test_apis, created_at, updated_at
             FROM data_sources
             ORDER BY updated_at DESC"
        )?;

        let rows = stmt.query_map([], |row| self.row_to_datasource(row))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }

        Ok(result)
    }

    fn get_by_id(&self, id: &str) -> AppResult<Option<DataSource>> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let result = conn.query_row(
            "SELECT id, name, type, description, enabled, connection, response_mapping, test_apis, created_at, updated_at
             FROM data_sources WHERE id = ?1",
            [id],
            |row| self.row_to_datasource(row),
        );

        match result {
            Ok(ds) => Ok(Some(ds)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    fn save(&self, ds: &DataSource) -> AppResult<()> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let type_str: String = ds.ds_type.clone().into();
        let connection_json = serde_json::to_string(&ds.connection)
            .map_err(|e| AppError::Serialization(e.to_string()))?;
        let response_mapping_json = serde_json::to_string(&ds.response_mapping)
            .map_err(|e| AppError::Serialization(e.to_string()))?;
        let test_apis_json = serde_json::to_string(&ds.test_apis)
            .map_err(|e| AppError::Serialization(e.to_string()))?;

        conn.execute(
            "INSERT OR REPLACE INTO data_sources (id, name, type, description, enabled, connection, response_mapping, test_apis, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, strftime('%s', 'now'))",
            rusqlite::params![
                &ds.id,
                &ds.name,
                &type_str,
                &ds.description,
                ds.enabled as i32,
                &connection_json,
                &response_mapping_json,
                &test_apis_json,
                ds.created_at,
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn delete(&self, id: &str) -> AppResult<()> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "DELETE FROM data_sources WHERE id = ?1",
            rusqlite::params![id],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }
}
