use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadHatchPatternLine {
    pub angle: f64,
    pub base_x: f64,
    pub base_y: f64,
    pub offset_x: f64,
    pub offset_y: f64,
    pub dashes: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadPoint {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadLwVertex {
    pub x: f64,
    pub y: f64,
    pub bulge: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadExtents {
    pub min: CadPoint,
    pub max: CadPoint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadLayer {
    pub name: String,
    pub color: i32,
    pub visible: bool,
    pub frozen: bool,
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CadEntity {
    Line {
        id: String,
        layer: String,
        color: i32,
        start: CadPoint,
        end: CadPoint,
        line_weight: f64,
    },
    Circle {
        id: String,
        layer: String,
        color: i32,
        center: CadPoint,
        radius: f64,
        line_weight: f64,
    },
    Arc {
        id: String,
        layer: String,
        color: i32,
        center: CadPoint,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
        line_weight: f64,
    },
    Polyline {
        id: String,
        layer: String,
        color: i32,
        vertices: Vec<CadPoint>,
        closed: bool,
        line_weight: f64,
    },
    LwPolyline {
        id: String,
        layer: String,
        color: i32,
        vertices: Vec<CadLwVertex>,
        closed: bool,
        line_weight: f64,
    },
    Ellipse {
        id: String,
        layer: String,
        color: i32,
        center: CadPoint,
        major_axis: CadPoint,
        minor_axis_ratio: f64,
        start_angle: f64,
        end_angle: f64,
        line_weight: f64,
    },
    Spline {
        id: String,
        layer: String,
        color: i32,
        control_points: Vec<CadPoint>,
        fit_points: Vec<CadPoint>,
        knots: Vec<f64>,
        degree: i32,
        line_weight: f64,
    },
    Text {
        id: String,
        layer: String,
        color: i32,
        position: CadPoint,
        height: f64,
        content: String,
        rotation: f64,
        horizontal_alignment: u8,
        vertical_alignment: u8,
    },
    MText {
        id: String,
        layer: String,
        color: i32,
        position: CadPoint,
        height: f64,
        content: String,
        width: f64,
        rotation: f64,
        attachment_point: u8,
        width_factor: f64,
        font_name: String,
        height_scale: f64,
    },
    Solid {
        id: String,
        layer: String,
        color: i32,
        points: Vec<CadPoint>,
    },
    Point {
        id: String,
        layer: String,
        color: i32,
        position: CadPoint,
    },
    Insert {
        id: String,
        layer: String,
        color: i32,
        block_name: String,
        position: CadPoint,
        x_scale: f64,
        y_scale: f64,
        z_scale: f64,
        rotation: f64,
    },
    Hatch {
        id: String,
        layer: String,
        color: i32,
        boundaries: Vec<Vec<CadLwVertex>>,
        pattern_name: String,
        pattern_type: i32,
        solid: bool,
        scale: f64,
        angle: f64,
        style: u8,
        pattern_lines: Vec<CadHatchPatternLine>,
    },
    Dimension {
        id: String,
        layer: String,
        color: i32,
        definition_point: CadPoint,
        text_midpoint: CadPoint,
        content: String,
        rotation: f64,
    },
    /// 引线标注（Leader）：由一系列顶点组成的折线，可带箭头。
    /// 渲染为折线段 + 可选的箭头标记。
    Leader {
        id: String,
        layer: String,
        color: i32,
        /// 引线路径顶点
        vertices: Vec<CadPoint>,
        /// 是否显示箭头
        arrow_enabled: bool,
    },
    /// 块属性实例（AttributeEntity）：INSERT 块中的属性值。
    /// 渲染方式同 Text，显示 tag: value 格式。
    AttributeEntity {
        id: String,
        layer: String,
        color: i32,
        position: CadPoint,
        height: f64,
        rotation: f64,
        /// 属性标签（如 "DRAWING_NO"）
        tag: String,
        /// 属性值（如 "A-001"）
        value: String,
    },
    /// 3D 面片（Face3D）：3~4 个顶点定义的平面。
    /// 渲染为填充三角形/四边形（复用 Solid 逻辑）。
    Face3D {
        id: String,
        layer: String,
        color: i32,
        points: Vec<CadPoint>,
        /// 不可见边标志位
        invisible_edges: u16,
    },
    /// 2D 多段线（Polyline2D）：与 LwPolyline 类似但有宽度信息。
    /// 映射为 LwPolyline 渲染。
    Polyline2D {
        id: String,
        layer: String,
        color: i32,
        vertices: Vec<CadLwVertex>,
        closed: bool,
        line_weight: f64,
    },
    /// 表格实体（Table）：简化为矩形网格 + 单元格文字。
    Table {
        id: String,
        layer: String,
        color: i32,
        position: CadPoint,
        height: f64,
        rotation: f64,
        /// 行数
        row_count: u32,
        /// 列数
        col_count: u32,
        /// 行高列表
        row_heights: Vec<f64>,
        /// 列宽列表
        col_widths: Vec<f64>,
        /// 单元格文字（行优先顺序），空字符串表示空白单元格
        cell_texts: Vec<String>,
    },
}

impl CadEntity {
    pub fn layer(&self) -> &str {
        match self {
            CadEntity::Line { layer, .. } => layer,
            CadEntity::Circle { layer, .. } => layer,
            CadEntity::Arc { layer, .. } => layer,
            CadEntity::Polyline { layer, .. } => layer,
            CadEntity::LwPolyline { layer, .. } => layer,
            CadEntity::Ellipse { layer, .. } => layer,
            CadEntity::Spline { layer, .. } => layer,
            CadEntity::Text { layer, .. } => layer,
            CadEntity::MText { layer, .. } => layer,
            CadEntity::Solid { layer, .. } => layer,
            CadEntity::Point { layer, .. } => layer,
            CadEntity::Insert { layer, .. } => layer,
            CadEntity::Hatch { layer, .. } => layer,
            CadEntity::Dimension { layer, .. } => layer,
            CadEntity::Leader { layer, .. } => layer,
            CadEntity::AttributeEntity { layer, .. } => layer,
            CadEntity::Face3D { layer, .. } => layer,
            CadEntity::Polyline2D { layer, .. } => layer,
            CadEntity::Table { layer, .. } => layer,
        }
    }

    pub fn set_layer(&mut self, new_layer: String) {
        match self {
            CadEntity::Line { layer, .. } => *layer = new_layer,
            CadEntity::Circle { layer, .. } => *layer = new_layer,
            CadEntity::Arc { layer, .. } => *layer = new_layer,
            CadEntity::Polyline { layer, .. } => *layer = new_layer,
            CadEntity::LwPolyline { layer, .. } => *layer = new_layer,
            CadEntity::Ellipse { layer, .. } => *layer = new_layer,
            CadEntity::Spline { layer, .. } => *layer = new_layer,
            CadEntity::Text { layer, .. } => *layer = new_layer,
            CadEntity::MText { layer, .. } => *layer = new_layer,
            CadEntity::Solid { layer, .. } => *layer = new_layer,
            CadEntity::Point { layer, .. } => *layer = new_layer,
            CadEntity::Insert { layer, .. } => *layer = new_layer,
            CadEntity::Hatch { layer, .. } => *layer = new_layer,
            CadEntity::Dimension { layer, .. } => *layer = new_layer,
            CadEntity::Leader { layer, .. } => *layer = new_layer,
            CadEntity::AttributeEntity { layer, .. } => *layer = new_layer,
            CadEntity::Face3D { layer, .. } => *layer = new_layer,
            CadEntity::Polyline2D { layer, .. } => *layer = new_layer,
            CadEntity::Table { layer, .. } => *layer = new_layer,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadDocument {
    pub file_name: String,
    pub version: String,
    pub profile: CadProfile,
    pub extents: Option<CadExtents>,
    pub layers: Vec<CadLayer>,
    pub entities: Vec<CadEntity>,
    pub entity_count: usize,
    pub coordinate_offset: CadPoint,
    #[serde(default)]
    pub deleted_snapshots: std::collections::HashMap<u32, CadEntity>,
}

bitflags::bitflags! {
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CadProfileFlags: u32 {
        const LARGE_COORDS        = 0b0001;
        const HEAVY_LWPOLY        = 0b0010;
        const HEAVY_HATCH         = 0b0100;
        const EXTREME_TEXT_HEIGHT = 0b1000;
        const DISTRIBUTED_COORDS  = 0b10000;
        const MEDIUM_ENTITY       = 0b100000;
        const MULTI_CLUSTER       = 0b1000000;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CadProfile {
    Light {
        entity_count: usize,
        coord_span_x: f64,
        coord_span_y: f64,
    },
    Standard {
        entity_count: usize,
        coord_span_x: f64,
        coord_span_y: f64,
        flags: CadProfileFlags,
    },
    Heavy {
        entity_count: usize,
        coord_span_x: f64,
        coord_span_y: f64,
        flags: CadProfileFlags,
    },
    Mega {
        entity_count: usize,
        flags: CadProfileFlags,
    },
    Ultra {
        entity_count: usize,
        flags: CadProfileFlags,
    },
    Simple {
        entity_count: usize,
        coord_span_x: f64,
        coord_span_y: f64,
    },
    LargeCoordinates {
        entity_count: usize,
        raw_span_x: f64,
        raw_span_y: f64,
    },
    HeavyLwPolyline {
        entity_count: usize,
        huge_polyline_count: usize,
        total_polyline_vertices: usize,
        max_vertices_per_polyline: usize,
    },
    HeavyHatch {
        entity_count: usize,
        hatch_count: usize,
        max_edges_per_path: usize,
    },
    HeavyEntity {
        entity_count: usize,
    },
    MediumEntity {
        entity_count: usize,
    },
    Complex {
        entity_count: usize,
        flags: CadProfileFlags,
    },
    Unparseable {
        error: String,
        file_size: u64,
    },
}

impl CadProfile {
    pub fn entity_count(&self) -> usize {
        match self {
            CadProfile::Light { entity_count, .. } => *entity_count,
            CadProfile::Standard { entity_count, .. } => *entity_count,
            CadProfile::Heavy { entity_count, .. } => *entity_count,
            CadProfile::Mega { entity_count, .. } => *entity_count,
            CadProfile::Ultra { entity_count, .. } => *entity_count,
            CadProfile::Simple { entity_count, .. } => *entity_count,
            CadProfile::LargeCoordinates { entity_count, .. } => *entity_count,
            CadProfile::HeavyLwPolyline { entity_count, .. } => *entity_count,
            CadProfile::HeavyHatch { entity_count, .. } => *entity_count,
            CadProfile::HeavyEntity { entity_count } => *entity_count,
            CadProfile::MediumEntity { entity_count } => *entity_count,
            CadProfile::Complex { entity_count, .. } => *entity_count,
            CadProfile::Unparseable { .. } => 0,
        }
    }

    pub fn to_header_flags(&self) -> u32 {
        let profile_type: u32 = match self {
            CadProfile::Light { .. } => 8,
            CadProfile::Standard { flags, .. } => 9 | (flags.bits() << 4),
            CadProfile::Heavy { flags, .. } => 10 | (flags.bits() << 4),
            CadProfile::Mega { flags, .. } => 11 | (flags.bits() << 4),
            CadProfile::Ultra { flags, .. } => 12 | (flags.bits() << 4),
            CadProfile::Simple { .. } => 0,
            CadProfile::LargeCoordinates { .. } => 1,
            CadProfile::HeavyLwPolyline { .. } => 2,
            CadProfile::HeavyHatch { .. } => 3,
            CadProfile::HeavyEntity { .. } => 6,
            CadProfile::MediumEntity { .. } => 7,
            CadProfile::Complex { flags, .. } => 4 | (flags.bits() << 4),
            CadProfile::Unparseable { .. } => 5,
        };
        profile_type
    }

    pub fn from_header_flags(flags: u32) -> Self {
        let profile_type = flags & 0x0F;
        let complex_flags = CadProfileFlags::from_bits_truncate((flags >> 4) & 0xFF);
        match profile_type {
            0 => CadProfile::Simple {
                entity_count: 0,
                coord_span_x: 0.0,
                coord_span_y: 0.0,
            },
            1 => CadProfile::LargeCoordinates {
                entity_count: 0,
                raw_span_x: 0.0,
                raw_span_y: 0.0,
            },
            2 => CadProfile::HeavyLwPolyline {
                entity_count: 0,
                huge_polyline_count: 0,
                total_polyline_vertices: 0,
                max_vertices_per_polyline: 0,
            },
            3 => CadProfile::HeavyHatch {
                entity_count: 0,
                hatch_count: 0,
                max_edges_per_path: 0,
            },
            4 => CadProfile::Complex {
                entity_count: 0,
                flags: complex_flags,
            },
            5 => CadProfile::Unparseable {
                error: String::new(),
                file_size: 0,
            },
            6 => CadProfile::HeavyEntity { entity_count: 0 },
            7 => CadProfile::MediumEntity { entity_count: 0 },
            8 => CadProfile::Light {
                entity_count: 0,
                coord_span_x: 0.0,
                coord_span_y: 0.0,
            },
            9 => CadProfile::Standard {
                entity_count: 0,
                coord_span_x: 0.0,
                coord_span_y: 0.0,
                flags: complex_flags,
            },
            10 => CadProfile::Heavy {
                entity_count: 0,
                coord_span_x: 0.0,
                coord_span_y: 0.0,
                flags: complex_flags,
            },
            11 => CadProfile::Mega {
                entity_count: 0,
                flags: complex_flags,
            },
            12 => CadProfile::Ultra {
                entity_count: 0,
                flags: complex_flags,
            },
            _ => CadProfile::Simple {
                entity_count: 0,
                coord_span_x: 0.0,
                coord_span_y: 0.0,
            },
        }
    }
}

impl Default for CadProfile {
    fn default() -> Self {
        CadProfile::Simple {
            entity_count: 0,
            coord_span_x: 0.0,
            coord_span_y: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub success: bool,
    pub document: Option<CadDocument>,
    pub error: Option<String>,
    #[serde(default)]
    pub diagnostics: Option<ParseDiagnostics>,
}

/// CAD 解析过程的诊断信息，用于前端展示解析报告和排查数据丢失。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseDiagnostics {
    /// acadrust 解析出的原始实体总数
    pub total_entities_raw: usize,
    /// 因图纸空间(entity_mode=1)跳过的实体数
    pub paper_space_skipped: usize,
    /// 因块定义(entity_mode=0)跳过的实体数
    pub block_def_skipped: usize,
    /// 因 invisible 标记跳过的实体数
    pub invisible_skipped: usize,
    /// 因不支持实体类型跳过的实体数（_ => None 分支）
    pub unsupported_skipped: usize,
    /// 因无效几何(NaN/Inf坐标)跳过的实体数
    pub invalid_geometry_skipped: usize,
    /// 因坐标离群点过滤丢弃的实体数
    pub outlier_skipped: usize,
    /// 因 Profile 优化策略简化/删除的实体数
    pub profile_simplified: usize,
    /// 不支持的实体类型名 → 出现次数
    pub unsupported_types: HashMap<String, usize>,
    /// INSERT 展开过程中遇到的最大嵌套深度
    pub insert_max_depth: u32,
    /// 是否检测到 INSERT 循环引用
    pub insert_cycle_detected: bool,
}
