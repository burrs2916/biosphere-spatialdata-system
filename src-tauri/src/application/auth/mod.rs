use crate::domain::auth::AuthRepository;
use crate::domain::AuthConfig;
use crate::error::{AppError, AppResult};

pub struct GetConfigUseCase<R: AuthRepository> {
    repository: R,
}

impl<R: AuthRepository> GetConfigUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self) -> AppResult<AuthConfig> {
        self.repository.get_config()
    }
}

pub struct UpdateConfigUseCase<R: AuthRepository> {
    repository: R,
}

impl<R: AuthRepository> UpdateConfigUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, config: AuthConfig) -> AppResult<()> {
        if config.enabled && config.base_url.is_empty() {
            return Err(AppError::Validation("启用认证时必须设置服务地址".to_string()));
        }
        
        let preset_str: String = config.preset.clone().into();
        self.repository.save_preset_config(&preset_str, &config)?;
        self.repository.update_config(&config)
    }
}

pub struct ResetConfigUseCase<R: AuthRepository> {
    repository: R,
}

impl<R: AuthRepository> ResetConfigUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self) -> AppResult<()> {
        self.repository.reset_config()
    }
}

pub struct GetPresetConfigUseCase<R: AuthRepository> {
    repository: R,
}

impl<R: AuthRepository> GetPresetConfigUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, preset: &str) -> AppResult<Option<AuthConfig>> {
        self.repository.get_preset_config(preset)
    }
}

pub struct SavePresetConfigUseCase<R: AuthRepository> {
    repository: R,
}

impl<R: AuthRepository> SavePresetConfigUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, preset: &str, config: &AuthConfig) -> AppResult<()> {
        self.repository.save_preset_config(preset, config)
    }
}

pub struct DeletePresetConfigUseCase<R: AuthRepository> {
    repository: R,
}

impl<R: AuthRepository> DeletePresetConfigUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, preset: &str) -> AppResult<()> {
        self.repository.delete_preset_config(preset)
    }
}
