# CI/CD 工作流程

## 工作流文件

- `.github/workflows/ci.yml` - 主要 CI/CD 工作流

## 触发条件

```yaml
on:
  push:
    branches: [main, develop]
    tags:
      - 'v*'
  pull_request:
    branches: [main, develop]
```

| 触发事件 | 说明 |
|----------|------|
| Push to `main` | 触发完整构建和发布 |
| Push to `develop` | 触发代码检查 |
| Push tag `v*` | 触发正式发布 |
| PR to `main`/`develop` | 触发代码检查 |

## 工作流阶段

### 1. frontend-check

```yaml
frontend-check:
  runs-on: ubuntu-latest
  steps:
    - pnpm install
    - pnpm exec tsc --noEmit
```

**检查内容**：
- TypeScript 类型检查

### 2. rust-check

```yaml
rust-check:
  runs-on: ubuntu-22.04
  steps:
    - cargo fmt -- --check
    - cargo clippy --all-features -- -W clippy::all
    - cargo test --all-features
```

**检查内容**：
- Rust 代码格式检查
- Clippy 静态分析
- 单元测试

### 3. publish-tauri

```yaml
publish-tauri:
  needs: [frontend-check, rust-check]
  if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))
  strategy:
    matrix:
      - macOS-arm64
      - macOS-x64
      - Linux
      - Windows
```

**构建平台**：
- macOS (Apple Silicon + Intel)
- Linux (Ubuntu)
- Windows

**触发条件**：
- Push to `main` → 构建并发布 prerelease
- Push tag `v*` → 构建并发布正式版

## CI 行为矩阵

| 事件 | frontend-check | rust-check | publish-tauri |
|------|----------------|------------|---------------|
| PR to develop | ✅ | ✅ | ❌ |
| PR to main | ✅ | ✅ | ❌ |
| Push to develop | ✅ | ✅ | ❌ |
| Push to main | ✅ | ✅ | ✅ (prerelease) |
| Push tag `v*` | ✅ | ✅ | ✅ (正式发布) |

## 构建产物

### macOS

- `SpatialData.System_x.x.x_aarch64.dmg` - Apple Silicon
- `SpatialData.System_x.x.x_x64.dmg` - Intel

### Linux

- `SpatialData.System_x.x.x_amd64.AppImage`
- `SpatialData.System_x.x.x_amd64.deb`

### Windows

- `SpatialData.System_x.x.x_x64.msi`
- `SpatialData.System_x.x.x_x64-setup.exe`

## 缓存策略

使用 `swatinem/rust-cache@v2` 缓存 Rust 编译产物：

```yaml
- uses: swatinem/rust-cache@v2
  with:
    workspaces: ./src-tauri -> target
    key: spatialdata-v1
```

**优势**：
- 减少 CI 时间 (首次 ~15min, 后续 ~5min)
- 节省 GitHub Actions 配额

## 并发控制

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**效果**：
- 同一分支的新 push 会取消正在运行的旧任务
- 避免资源浪费
