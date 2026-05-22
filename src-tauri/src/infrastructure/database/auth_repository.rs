use crate::domain::auth::{AuthConfig, AuthRepository};
use crate::error::{AppError, AppResult};
use super::Database;
use std::sync::Arc;

#[derive(Clone)]
pub struct SqliteAuthRepository {
    db: Arc<Database>,
}

impl SqliteAuthRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl AuthRepository for SqliteAuthRepository {
    fn get_config(&self) -> AppResult<AuthConfig> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT enabled, preset, base_url, auth_params, endpoints, header_config, user_display_config, timeout, 
                    token_storage, token_key, token_header, token_prefix,
                    refresh_enabled, refresh_threshold, login_redirect_path, login_redirect_param,
                    login_auto_redirect, whitelist
             FROM auth_config WHERE id = 1"
        )?;

        let config = stmt.query_row([], |row| {
            let preset_str: String = row.get(1)?;
            let auth_params_str: String = row.get(3)?;
            let endpoints_str: String = row.get(4)?;
            let header_config_str: String = row.get(5)?;
            let user_display_config_str: String = row.get(6)?;
            
            let auth_params: Vec<crate::domain::auth::AuthParam> = 
                serde_json::from_str(&auth_params_str).unwrap_or_default();
            
            let mut endpoints: Vec<crate::domain::auth::ApiEndpoint> = 
                serde_json::from_str(&endpoints_str).unwrap_or_default();
            
            endpoints = endpoints.into_iter().map(|mut e| {
                if !e.bind_to_menu {
                    e.bind_to_menu = false;
                }
                e
            }).collect();
            
            let header_config: Vec<crate::domain::auth::HeaderConfig> = 
                serde_json::from_str(&header_config_str).unwrap_or_default();
            
            let user_display_config: Vec<crate::domain::auth::UserDisplayConfig> = 
                serde_json::from_str(&user_display_config_str).unwrap_or_default();
            
            let whitelist: Vec<String> = 
                serde_json::from_str(&row.get::<_, String>(17)?)
                    .unwrap_or_default();
            
            let login_auto_redirect = row.get::<_, i32>(16)? != 0;
            
            Ok(AuthConfig {
                enabled: row.get::<_, i32>(0)? != 0,
                preset: crate::domain::auth::AuthPreset::from(preset_str),
                base_url: row.get(2)?,
                auth_params,
                endpoints,
                header_config,
                user_display_config,
                timeout: row.get(7)?,
                token_storage: row.get(8)?,
                token_key: row.get(9)?,
                token_header: row.get(10)?,
                token_prefix: row.get(11)?,
                refresh_enabled: row.get::<_, i32>(12)? != 0,
                refresh_threshold: row.get(13)?,
                login_redirect_path: row.get(14)?,
                login_redirect_param: row.get(15)?,
                login_auto_redirect,
                whitelist,
            })
        })?;

        Ok(config)
    }

    fn update_config(&self, config: &AuthConfig) -> AppResult<()> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let whitelist_json = serde_json::to_string(&config.whitelist)?;
        let auth_params_json = serde_json::to_string(&config.auth_params)?;
        let endpoints_json = serde_json::to_string(&config.endpoints)?;
        let header_config_json = serde_json::to_string(&config.header_config)?;
        let user_display_config_json = serde_json::to_string(&config.user_display_config)?;
        let preset_str: String = config.preset.clone().into();

        conn.execute(
            "UPDATE auth_config SET
                enabled = ?1,
                preset = ?2,
                base_url = ?3,
                auth_params = ?4,
                endpoints = ?5,
                header_config = ?6,
                user_display_config = ?7,
                timeout = ?8,
                token_storage = ?9,
                token_key = ?10,
                token_header = ?11,
                token_prefix = ?12,
                refresh_enabled = ?13,
                refresh_threshold = ?14,
                login_redirect_path = ?15,
                login_redirect_param = ?16,
                login_auto_redirect = ?17,
                whitelist = ?18,
                updated_at = strftime('%s', 'now')
             WHERE id = 1",
            rusqlite::params![
                config.enabled as i32,
                &preset_str,
                &config.base_url,
                &auth_params_json,
                &endpoints_json,
                &header_config_json,
                &user_display_config_json,
                config.timeout,
                &config.token_storage,
                &config.token_key,
                &config.token_header,
                &config.token_prefix,
                config.refresh_enabled as i32,
                config.refresh_threshold,
                &config.login_redirect_path,
                &config.login_redirect_param,
                config.login_auto_redirect as i32,
                &whitelist_json,
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn reset_config(&self) -> AppResult<()> {
        let config = AuthConfig::default();
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let whitelist_json = serde_json::to_string(&config.whitelist)?;
        let auth_params_json = serde_json::to_string(&config.auth_params)?;
        let endpoints_json = serde_json::to_string(&config.endpoints)?;
        let header_config_json = serde_json::to_string(&config.header_config)?;
        let user_display_config_json = serde_json::to_string(&config.user_display_config)?;
        let preset_str: String = config.preset.clone().into();
        
        conn.execute(
            "UPDATE auth_config SET
                enabled = ?1,
                preset = ?2,
                base_url = ?3,
                auth_params = ?4,
                endpoints = ?5,
                header_config = ?6,
                user_display_config = ?7,
                timeout = ?8,
                token_storage = ?9,
                token_key = ?10,
                token_header = ?11,
                token_prefix = ?12,
                refresh_enabled = ?13,
                refresh_threshold = ?14,
                login_redirect_path = ?15,
                login_redirect_param = ?16,
                login_auto_redirect = ?17,
                whitelist = ?18,
                updated_at = strftime('%s', 'now')
             WHERE id = 1",
            rusqlite::params![
                config.enabled as i32,
                &preset_str,
                &config.base_url,
                &auth_params_json,
                &endpoints_json,
                &header_config_json,
                &user_display_config_json,
                config.timeout,
                &config.token_storage,
                &config.token_key,
                &config.token_header,
                &config.token_prefix,
                config.refresh_enabled as i32,
                config.refresh_threshold,
                &config.login_redirect_path,
                &config.login_redirect_param,
                config.login_auto_redirect as i32,
                &whitelist_json,
            ],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn get_preset_config(&self, preset: &str) -> AppResult<Option<AuthConfig>> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT config FROM auth_config_presets WHERE preset = ?1"
        )?;

        let result = stmt.query_row([preset], |row| {
            let config_str: String = row.get(0)?;
            Ok(config_str)
        });

        match result {
            Ok(config_str) => {
                let config: AuthConfig = serde_json::from_str(&config_str)
                    .map_err(|e| AppError::Internal(format!("Failed to parse preset config: {}", e)))?;
                Ok(Some(config))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    fn save_preset_config(&self, preset: &str, config: &AuthConfig) -> AppResult<()> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        let config_json = serde_json::to_string(config)
            .map_err(|e| AppError::Internal(format!("Failed to serialize config: {}", e)))?;

        conn.execute(
            "INSERT OR REPLACE INTO auth_config_presets (preset, config, updated_at) VALUES (?1, ?2, strftime('%s', 'now'))",
            rusqlite::params![preset, &config_json],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    fn delete_preset_config(&self, preset: &str) -> AppResult<()> {
        let conn = self.db.0.lock().map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "DELETE FROM auth_config_presets WHERE preset = ?1",
            rusqlite::params![preset],
        ).map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }
}
