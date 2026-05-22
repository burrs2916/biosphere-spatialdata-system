use super::models::{CadEntity, CadExtents, CadLwVertex, CadPoint};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CadBounds {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
}

impl CadBounds {
    pub fn empty() -> Self {
        Self {
            min_x: f64::MAX,
            min_y: f64::MAX,
            max_x: f64::MIN,
            max_y: f64::MIN,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.min_x == f64::MAX
    }

    pub fn is_finite(&self) -> bool {
        !self.is_empty()
            && self.min_x.is_finite()
            && self.min_y.is_finite()
            && self.max_x.is_finite()
            && self.max_y.is_finite()
    }

    pub fn expand_xy(&mut self, x: f64, y: f64) {
        if !x.is_finite() || !y.is_finite() {
            return;
        }
        self.min_x = self.min_x.min(x);
        self.min_y = self.min_y.min(y);
        self.max_x = self.max_x.max(x);
        self.max_y = self.max_y.max(y);
    }

    pub fn expand_point(&mut self, point: &CadPoint) {
        self.expand_xy(point.x, point.y);
    }

    pub fn expand_lw_vertex(&mut self, vertex: &CadLwVertex) {
        self.expand_xy(vertex.x, vertex.y);
    }

    pub fn union(&mut self, other: CadBounds) {
        if other.is_empty() {
            return;
        }
        self.expand_xy(other.min_x, other.min_y);
        self.expand_xy(other.max_x, other.max_y);
    }

    pub fn as_tuple(self) -> (f64, f64, f64, f64) {
        (self.min_x, self.min_y, self.max_x, self.max_y)
    }

    pub fn to_extents(self) -> Option<CadExtents> {
        if !self.is_finite() || self.max_x < self.min_x || self.max_y < self.min_y {
            return None;
        }
        Some(CadExtents {
            min: CadPoint {
                x: self.min_x,
                y: self.min_y,
                z: 0.0,
            },
            max: CadPoint {
                x: self.max_x,
                y: self.max_y,
                z: 0.0,
            },
        })
    }
}

pub fn cad_entity_bbox(entity: &CadEntity) -> CadBounds {
    match entity {
        CadEntity::Line { start, end, .. } => bounds_from_points([start, end]),
        CadEntity::Circle { center, radius, .. } => {
            let r = radius.abs();
            CadBounds {
                min_x: center.x - r,
                min_y: center.y - r,
                max_x: center.x + r,
                max_y: center.y + r,
            }
        }
        CadEntity::Arc { center, radius, .. } => {
            let r = radius.abs();
            CadBounds {
                min_x: center.x - r,
                min_y: center.y - r,
                max_x: center.x + r,
                max_y: center.y + r,
            }
        }
        CadEntity::Ellipse {
            center,
            major_axis,
            minor_axis_ratio,
            ..
        } => ellipse_bbox(center, major_axis, *minor_axis_ratio),
        CadEntity::Polyline { vertices, .. } => bounds_from_points(vertices.iter()),
        CadEntity::LwPolyline { vertices, .. } => {
            let mut bounds = CadBounds::empty();
            for vertex in vertices {
                bounds.expand_lw_vertex(vertex);
            }
            fallback_zero_bounds(bounds)
        }
        CadEntity::Spline {
            control_points,
            fit_points,
            ..
        } => {
            let mut bounds = CadBounds::empty();
            for point in control_points {
                bounds.expand_point(point);
            }
            for point in fit_points {
                bounds.expand_point(point);
            }
            fallback_zero_bounds(bounds)
        }
        CadEntity::Text {
            position,
            height,
            content,
            rotation,
            horizontal_alignment,
            vertical_alignment,
            ..
        } => {
            let width = estimate_text_width(content, *height, 1.0);
            let block_height = height.abs().max(1e-6);
            let col = match horizontal_alignment {
                1 | 4 => 1,
                2 | 3 | 5 => 2,
                _ => 0,
            };
            let row = match vertical_alignment {
                3 => 0,
                2 => 1,
                _ => 2,
            };
            anchored_text_bbox(position, width, block_height, *rotation, col, row)
        }
        CadEntity::MText {
            position,
            height,
            content,
            width,
            rotation,
            attachment_point,
            width_factor,
            height_scale,
            ..
        } => {
            let effective_height = (height * height_scale).abs().max(1e-6);
            let estimated_width = estimate_text_width(content, effective_height, *width_factor);
            let block_width = if *width > 0.0 {
                width.abs().max(estimated_width.min(width.abs()))
            } else {
                estimated_width
            };
            let line_count = content
                .split('\n')
                .filter(|line| !line.is_empty())
                .count()
                .max(1) as f64;
            let block_height = effective_height * line_count * 1.25;
            let ap = (*attachment_point).clamp(1, 9);
            let col = (ap - 1) % 3;
            let row = (ap - 1) / 3;
            anchored_text_bbox(position, block_width, block_height, *rotation, col, row)
        }
        CadEntity::Solid { points, .. } => bounds_from_points(points.iter()),
        CadEntity::Point { position, .. } => CadBounds {
            min_x: position.x - 1.0,
            min_y: position.y - 1.0,
            max_x: position.x + 1.0,
            max_y: position.y + 1.0,
        },
        CadEntity::Insert { position, .. } => CadBounds {
            min_x: position.x - 10.0,
            min_y: position.y - 10.0,
            max_x: position.x + 10.0,
            max_y: position.y + 10.0,
        },
        CadEntity::Hatch { boundaries, .. } => {
            let mut bounds = CadBounds::empty();
            for path in boundaries {
                for vertex in path {
                    bounds.expand_lw_vertex(vertex);
                }
            }
            fallback_zero_bounds(bounds)
        }
        CadEntity::Dimension {
            definition_point,
            text_midpoint,
            ..
        } => bounds_from_points([definition_point, text_midpoint]),
        CadEntity::Leader { vertices, .. } => {
            let mut bounds = CadBounds::empty();
            for point in vertices {
                bounds.expand_point(point);
            }
            fallback_zero_bounds(bounds)
        }
        CadEntity::AttributeEntity {
            position,
            height,
            tag,
            value,
            rotation,
            ..
        } => {
            let content = format!("{}: {}", tag, value);
            let width = estimate_text_width(&content, *height, 1.0);
            let block_height = height.abs().max(1e-6);
            anchored_text_bbox(position, width, block_height, *rotation, 0, 2)
        }
        CadEntity::Face3D { points, .. } => bounds_from_points(points.iter()),
        CadEntity::Polyline2D { vertices, .. } => {
            let mut bounds = CadBounds::empty();
            for vertex in vertices {
                bounds.expand_lw_vertex(vertex);
            }
            fallback_zero_bounds(bounds)
        }
        CadEntity::Table {
            position,
            height,
            rotation,
            row_count,
            col_count,
            row_heights,
            col_widths,
            ..
        } => {
            let total_w: f64 = col_widths.iter().sum::<f64>().max(1.0);
            let total_h: f64 = if row_heights.len() == *row_count as usize {
                row_heights.iter().sum()
            } else {
                *row_count as f64 * height.abs().max(1e-6) * 1.5
            };
            let total_h = total_h.max(1.0);
            anchored_text_bbox(position, total_w, total_h, *rotation, 0, 2)
        }
    }
}

pub fn cad_entities_bbox<'a>(
    entities: impl IntoIterator<Item = &'a CadEntity>,
) -> Option<CadBounds> {
    let mut bounds = CadBounds::empty();
    for entity in entities {
        bounds.union(cad_entity_bbox(entity));
    }
    if bounds.is_finite() {
        Some(bounds)
    } else {
        None
    }
}

fn bounds_from_points<'a>(points: impl IntoIterator<Item = &'a CadPoint>) -> CadBounds {
    let mut bounds = CadBounds::empty();
    for point in points {
        bounds.expand_point(point);
    }
    fallback_zero_bounds(bounds)
}

fn fallback_zero_bounds(bounds: CadBounds) -> CadBounds {
    if bounds.is_empty() {
        CadBounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x: 0.0,
            max_y: 0.0,
        }
    } else {
        bounds
    }
}

fn ellipse_bbox(center: &CadPoint, major_axis: &CadPoint, minor_axis_ratio: f64) -> CadBounds {
    let major_len = (major_axis.x * major_axis.x + major_axis.y * major_axis.y).sqrt();
    if major_len <= 0.0 || !major_len.is_finite() {
        return CadBounds {
            min_x: center.x,
            min_y: center.y,
            max_x: center.x,
            max_y: center.y,
        };
    }

    let ux = major_axis.x;
    let uy = major_axis.y;
    let minor_len = major_len * minor_axis_ratio.abs();
    let vx = -uy / major_len * minor_len;
    let vy = ux / major_len * minor_len;
    let dx = (ux * ux + vx * vx).sqrt();
    let dy = (uy * uy + vy * vy).sqrt();

    CadBounds {
        min_x: center.x - dx,
        min_y: center.y - dy,
        max_x: center.x + dx,
        max_y: center.y + dy,
    }
}

fn anchored_text_bbox(
    position: &CadPoint,
    width: f64,
    height: f64,
    rotation: f64,
    col: u8,
    row: u8,
) -> CadBounds {
    let width = width.abs().max(1e-6);
    let height = height.abs().max(1e-6);

    let (min_x, max_x) = match col {
        1 => (-width / 2.0, width / 2.0),
        2 => (-width, 0.0),
        _ => (0.0, width),
    };
    let (min_y, max_y) = match row {
        0 => (-height, 0.0),
        1 => (-height / 2.0, height / 2.0),
        _ => (0.0, height),
    };

    let cos = rotation.cos();
    let sin = rotation.sin();
    let mut bounds = CadBounds::empty();
    for (x, y) in [
        (min_x, min_y),
        (min_x, max_y),
        (max_x, min_y),
        (max_x, max_y),
    ] {
        let rx = position.x + x * cos - y * sin;
        let ry = position.y + x * sin + y * cos;
        bounds.expand_xy(rx, ry);
    }
    fallback_zero_bounds(bounds)
}

fn estimate_text_width(content: &str, height: f64, width_factor: f64) -> f64 {
    let height = height.abs().max(1e-6);
    let width_factor = if width_factor.is_finite() && width_factor > 0.0 {
        width_factor
    } else {
        1.0
    };

    let max_units = content
        .split('\n')
        .map(|line| {
            line.chars()
                .map(|ch| {
                    if ch.is_whitespace() {
                        0.35
                    } else if ch.is_ascii() {
                        0.62
                    } else {
                        1.0
                    }
                })
                .sum::<f64>()
        })
        .fold(0.0, f64::max);

    (max_units.max(1.0) * height * width_factor).max(height)
}
