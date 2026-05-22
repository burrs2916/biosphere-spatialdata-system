use crate::domain::icons::{IconGroup, SystemIcon};
use crate::error::{AppError, AppResult};
use crate::infrastructure::icon_repository::IconRepository;

pub struct GetAllGroupsUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> GetAllGroupsUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self) -> AppResult<Vec<IconGroup>> {
        self.repository.get_all_groups()
    }
}

pub struct GetGroupUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> GetGroupUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, id: &str) -> AppResult<Option<IconGroup>> {
        self.repository.get_group(id)
    }
}

pub struct SaveGroupUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> SaveGroupUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, group: IconGroup) -> AppResult<()> {
        if group.name.is_empty() {
            return Err(AppError::Validation("分组名称不能为空".to_string()));
        }
        self.repository.save_group(&group)
    }
}

pub struct DeleteGroupUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> DeleteGroupUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, id: &str) -> AppResult<()> {
        self.repository.delete_group(id)
    }
}

pub struct GetAllIconsUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> GetAllIconsUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self) -> AppResult<Vec<SystemIcon>> {
        self.repository.get_all_icons()
    }
}

pub struct GetIconsByGroupUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> GetIconsByGroupUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, group_id: &str) -> AppResult<Vec<SystemIcon>> {
        self.repository.get_icons_by_group(group_id)
    }
}

pub struct GetIconUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> GetIconUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, id: &str) -> AppResult<Option<SystemIcon>> {
        self.repository.get_icon(id)
    }
}

pub struct SaveIconUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> SaveIconUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, icon: SystemIcon) -> AppResult<()> {
        if icon.name.is_empty() {
            return Err(AppError::Validation("图标名称不能为空".to_string()));
        }
        if icon.file_path.is_empty() {
            return Err(AppError::Validation("图标文件路径不能为空".to_string()));
        }
        if icon.group_id.is_empty() {
            return Err(AppError::Validation("图标分组不能为空".to_string()));
        }
        self.repository.save_icon(&icon)
    }
}

pub struct DeleteIconUseCase<R: IconRepository> {
    repository: R,
}

impl<R: IconRepository> DeleteIconUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn execute(&self, id: &str) -> AppResult<()> {
        self.repository.delete_icon(id)
    }
}
