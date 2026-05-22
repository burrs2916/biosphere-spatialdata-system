# GitHub 构建规则文档

本目录包含项目的 GitHub 构建和发布相关规则文档。

## 文档索引

| 文档 | 说明 |
|------|------|
| [分支策略.md](./分支策略.md) | Git 分支结构和命名规范 |
| [CI-CD工作流程.md](./CI-CD工作流程.md) | GitHub Actions CI/CD 配置说明 |
| [版本发布流程.md](./版本发布流程.md) | 版本号规范和发布步骤 |
| [分支保护规则.md](./分支保护规则.md) | GitHub 分支保护配置 |
| [开发工作流程.md](./开发工作流程.md) | 日常开发和提交流程 |

## 快速开始

### 新功能开发

```bash
# 1. 创建功能分支
git checkout develop
git checkout -b feature/new-feature

# 2. 开发并提交
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 3. 创建 PR 到 develop
```

### 发布新版本

```bash
# 1. 合并到 main
git checkout main
git merge develop
git push origin main

# 2. 创建 tag
git tag v0.2.0
git push origin v0.2.0
```

## 重要链接

- [GitHub 仓库](https://github.com/burrs2916/biosphere-spatialdata-system)
- [Actions](https://github.com/burrs2916/biosphere-spatialdata-system/actions)
- [Releases](https://github.com/burrs2916/biosphere-spatialdata-system/releases)
- [Branches](https://github.com/burrs2916/biosphere-spatialdata-system/branches)

## 相关文件

- `.github/workflows/ci.yml` - CI/CD 工作流配置
- `.github/CODEOWNERS` - 代码所有者配置
