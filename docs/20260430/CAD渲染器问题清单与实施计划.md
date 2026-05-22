# CAD 渲染器问题清单与实施计划

> 日期：2026-04-30
> 状态：Phase 1 已完成实施，Phase 2-3 待实施

---

## 一、已发现的问题

### 1. 渲染质量问题

| # | 问题 | 严重程度 | 状态 |
|---|------|---------|------|
| 1.1 | Point 实体渲染为模糊圆点，看起来像噪点 | 高 | ✅ 已修复 |
| 1.2 | LwPolyline 的 bulge（弧段）被忽略，圆弧多段线显示为直线段 | 高 | ✅ 已修复 |
| 1.3 | Color ByLayer 未处理，实体颜色为 ByLayer 时显示为白色 | 高 | ✅ 已修复 |
| 1.4 | Text/MText 渲染为十字叉号，无法阅读文字内容 | 高 | ✅ 已修复 |
| 1.5 | Spline 曲线仅使用控制点，忽略 fit_points 和 knots | 中 | ✅ 已修复 |
| 1.6 | Hatch 填充实体未渲染 | 中 | ✅ 已修复 |
| 1.7 | Insert（块引用）未渲染 | 中 | ✅ 已修复 |
| 1.8 | Dimension（标注）未渲染 | 中 | ✅ 已修复 |

### 2. 交互功能缺失

| # | 问题 | 严重程度 | 状态 |
|---|------|---------|------|
| 2.1 | 无鼠标滚轮缩放 | 高 | ✅ 已修复 |
| 2.2 | 无鼠标拖拽平移 | 高 | ✅ 已修复 |
| 2.3 | 缩放不以鼠标位置为中心 | 中 | ✅ 已修复 |

### 3. 与顶级 CAD 渲染器的差距

| # | 缺失功能 | 优先级 | 状态 |
|---|---------|--------|------|
| 3.1 | 线宽（LineWeight）渲染 — 不同线宽显示相同粗细 | 高 | ❌ 待实施 |
| 3.2 | 图层管理 — 图层可见性控制、冻结、锁定 | 高 | ❌ 待实施 |
| 3.3 | 实体选择与高亮 — 点击选中实体、高亮显示 | 高 | ❌ 待实施 |
| 3.4 | 块定义展开 — Insert 实体展开为实际几何图形 | 高 | ❌ 待实施 |
| 3.5 | TrueType 字体精确渲染 — 当前使用 Arial 替代 | 中 | ❌ 待实施 |
| 3.6 | 标注完整渲染 — 尺寸线、箭头、延伸线 | 中 | ❌ 待实施 |
| 3.7 | 填充图案渲染 — 非实心填充的线条图案 | 中 | ❌ 待实施 |
| 3.8 | 视图导航 — 窗口缩放、平移历史、视图命名 | 中 | ❌ 待实施 |
| 3.9 | 实体属性面板 — 显示选中实体的详细属性 | 低 | ❌ 待实施 |
| 3.10 | 打印/导出 — 导出为 PDF/SVG/PNG | 低 | ❌ 待实施 |
| 3.11 | 捕捉功能 — 端点、中点、圆心等对象捕捉 | 低 | ❌ 待实施 |
| 3.12 | 测量工具 — 距离、面积、角度测量 | 低 | ❌ 待实施 |

---

## 二、实施计划

### Phase 1：核心渲染修复（已完成 ✅）

**目标**：修复最基本的渲染问题，使图纸可读

| 任务 | 修改文件 | 说明 |
|------|---------|------|
| Point 十字标记渲染 | CadRenderer.ts | 将 PointsMaterial 改为 Line 组成的十字标记 |
| LwPolyline bulge 弧段 | models.rs, cad.rs, types.ts, CadRenderer.ts | Rust 端提取 bulge，前端实现 `_bulgeToArc()` 转换 |
| Color ByLayer 处理 | cad.rs | 创建 layer_colors 映射，ByLayer 时查找图层颜色 |
| Text Canvas 2D 渲染 | CadRenderer.ts | 使用 Canvas 2D 生成文字纹理贴图到 PlaneGeometry |
| 鼠标滚轮缩放 | CadRenderer.ts | 以鼠标位置为中心的滚轮缩放 |
| 鼠标拖拽平移 | CadRenderer.ts | 左键/中键拖拽平移视图 |
| Spline fit_points 支持 | models.rs, cad.rs, CadRenderer.ts | 提取 fit_points，优先使用 Catmull-Rom 插值 |
| 新增实体类型 | models.rs, cad.rs, types.ts, CadRenderer.ts | Insert、Hatch、Dimension 基础渲染 |

**修改的文件清单**：
- `src-tauri/src/domain/cad/models.rs` — 新增 CadLwVertex、Insert、Hatch、Dimension 数据结构
- `src-tauri/src/commands/cad.rs` — Color ByLayer、bulge 提取、新实体转换
- `src/editor/cad/types.ts` — TypeScript 类型同步更新
- `src/editor/cad/CadRenderer.ts` — 全部渲染改进

### Phase 2：渲染质量提升（待实施）

**目标**：使渲染效果接近专业 CAD 查看器

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 线宽渲染 | P0 | 使用 THREE.Line2 + LineMaterial 实现可变线宽 |
| 块定义展开 | P0 | Rust 端提取 block 定义，前端递归渲染 Insert |
| 图层管理 | P1 | 图层面板、可见性切换、颜色覆盖 |
| 实体选择 | P1 | Raycaster 点击选中、高亮显示 |
| 标注完整渲染 | P2 | 尺寸线、箭头、延伸线、文字对齐 |
| 填充图案 | P2 | 非实心填充的线条图案渲染 |

### Phase 3：高级功能（待实施）

**目标**：达到专业级 CAD 查看器体验

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 视图导航 | P1 | 窗口缩放、视图历史、命名视图 |
| 实体属性面板 | P2 | 选中实体显示详细属性信息 |
| TrueType 字体 | P2 | 加载 SHX/TTF 字体文件精确渲染 |
| 对象捕捉 | P3 | 端点、中点、圆心等 OSNAP |
| 测量工具 | P3 | 距离、面积、角度测量 |
| 打印导出 | P3 | PDF/SVG/PNG 导出 |

---

## 三、技术要点

### 3.1 Bulge 转弧段算法

LwPolyline 中每个顶点的 bulge 值表示到下一个顶点之间的弧段：

```
included_angle = 4 * atan(|bulge|)
radius = chord_length / (2 * sin(included_angle / 2))
sagitta = radius * (1 - cos(included_angle / 2))
center = midpoint + sign * perpendicular * sagitta
```

- bulge > 0：逆时针弧
- bulge < 0：顺时针弧
- bulge = 0：直线段

### 3.2 Color ByLayer 解析

CAD 实体颜色可以是：
- 具体颜色值（RGB）
- ByLayer：使用所属图层的颜色
- ByBlock：使用所属块的颜色

Rust 端在 `convert_document` 中预计算 `layer_colors: HashMap<String, i32>`，转换实体时查找。

### 3.3 鼠标交互

- **滚轮缩放**：以鼠标位置为中心，调整 camera frustum
- **拖拽平移**：记录起始位置，计算世界坐标偏移量

### 3.4 Text 渲染

使用 Canvas 2D API 生成文字纹理：
1. 创建离屏 Canvas
2. 绘制文字到 Canvas
3. 创建 CanvasTexture
4. 贴图到 PlaneGeometry
5. 设置 transparent + depthTest: false

---

## 四、已知限制

1. **块引用（Insert）**：当前仅显示位置标记和块名，未展开块定义的几何图形
2. **字体**：使用 Arial 替代 CAD 专用字体（SHX），排版可能不一致
3. **Spline**：使用 Catmull-Rom 近似，非精确 NURBS 计算
4. **Hatch 图案**：仅支持实心填充，线条图案未实现
5. **Dimension**：仅显示定义点到文字中点的连线和文字，缺少尺寸线、箭头等
6. **线宽**：所有线段使用相同宽度，未反映 CAD 线宽设置
