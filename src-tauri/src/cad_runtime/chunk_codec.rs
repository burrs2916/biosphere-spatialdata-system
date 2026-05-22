use crate::cad_runtime::cadbin_spec::*;
use crate::cad_runtime::string_pool::StringPool;
use crate::domain::cad::{cad_entity_bbox, CadEntity};

pub struct ChunkIndexEntry {
    pub type_tag: u8,
    pub entity_count: u32,
    pub offset: u64,
    pub byte_size: u64,
}

pub struct ChunkData {
    pub tag: u8,
    pub entity_count: u32,
    pub data: Vec<u8>,
}

pub struct ChunkCodec {
    string_pool: StringPool,
}

impl ChunkCodec {
    pub fn new(string_pool: StringPool) -> Self {
        ChunkCodec { string_pool }
    }

    #[allow(dead_code)]
    pub fn string_pool_mut(&mut self) -> &mut StringPool {
        &mut self.string_pool
    }

    #[allow(dead_code)]
    pub fn string_pool(&self) -> &StringPool {
        &self.string_pool
    }

    pub fn into_string_pool(self) -> StringPool {
        self.string_pool
    }

    /// 把 entities 按类型分组，并保留它们在 doc.entities 中的全局索引作为 entity_id。
    /// v3: 全局唯一 ID，与 spatial_index 中的 SpatialEntry.entity_id 对齐。
    pub fn encode_entities(&mut self, entities: &[CadEntity]) -> Vec<ChunkData> {
        let mut groups: std::collections::HashMap<u8, Vec<(u32, &CadEntity)>> =
            std::collections::HashMap::new();

        for (gid, entity) in entities.iter().enumerate() {
            let tag = entity_to_tag(entity);
            groups.entry(tag).or_default().push((gid as u32, entity));
        }

        let mut chunks = Vec::new();
        for (tag, group) in groups {
            let data = match tag {
                CHUNK_TAG_LINE => self.encode_lines(&group),
                CHUNK_TAG_CIRCLE => self.encode_circles(&group),
                CHUNK_TAG_ARC => self.encode_arcs(&group),
                CHUNK_TAG_ELLIPSE => self.encode_ellipses(&group),
                CHUNK_TAG_LWPOLYLINE => self.encode_lwpolylines(&group),
                CHUNK_TAG_POLYLINE => self.encode_polylines(&group),
                CHUNK_TAG_SPLINE => self.encode_splines(&group),
                CHUNK_TAG_TEXT => self.encode_texts(&group),
                CHUNK_TAG_MTEXT => self.encode_mtexts(&group),
                CHUNK_TAG_SOLID => self.encode_solids(&group),
                CHUNK_TAG_POINT => self.encode_points(&group),
                CHUNK_TAG_INSERT => self.encode_inserts(&group),
                CHUNK_TAG_HATCH => self.encode_hatches(&group),
                CHUNK_TAG_DIMENSION => self.encode_dimensions(&group),
                _ => continue,
            };
            chunks.push(ChunkData {
                tag,
                entity_count: group.len() as u32,
                data,
            });
        }

        chunks.sort_by_key(|c| c.tag);
        chunks
    }

    fn encode_lines(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut line_weights = Vec::with_capacity(n * 4);
        let mut start_x = Vec::with_capacity(n * 8);
        let mut start_y = Vec::with_capacity(n * 8);
        let mut end_x = Vec::with_capacity(n * 8);
        let mut end_y = Vec::with_capacity(n * 8);

        for (gid, entity) in entities.iter() {
            if let CadEntity::Line {
                id: _,
                layer,
                color,
                start,
                end,
                line_weight,
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                line_weights.push((*line_weight as f32).to_le_bytes());
                start_x.push(start.x.to_le_bytes());
                start_y.push(start.y.to_le_bytes());
                end_x.push(end.x.to_le_bytes());
                end_y.push(end.y.to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * LINE_BYTES_PER_ENTITY);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes(&mut buf, &line_weights);
        append_bytes_8(&mut buf, &start_x);
        append_bytes_8(&mut buf, &start_y);
        append_bytes_8(&mut buf, &end_x);
        append_bytes_8(&mut buf, &end_y);
        buf
    }

    fn encode_circles(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut line_weights = Vec::with_capacity(n * 4);
        let mut center_x = Vec::with_capacity(n * 8);
        let mut center_y = Vec::with_capacity(n * 8);
        let mut radii = Vec::with_capacity(n * 8);

        for (gid, entity) in entities.iter() {
            if let CadEntity::Circle {
                id: _,
                layer,
                color,
                center,
                radius,
                line_weight,
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                line_weights.push((*line_weight as f32).to_le_bytes());
                center_x.push(center.x.to_le_bytes());
                center_y.push(center.y.to_le_bytes());
                radii.push(radius.to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * CIRCLE_BYTES_PER_ENTITY);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes(&mut buf, &line_weights);
        append_bytes_8(&mut buf, &center_x);
        append_bytes_8(&mut buf, &center_y);
        append_bytes_8(&mut buf, &radii);
        buf
    }

    fn encode_arcs(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut line_weights = Vec::with_capacity(n * 4);
        let mut center_x = Vec::with_capacity(n * 8);
        let mut center_y = Vec::with_capacity(n * 8);
        let mut radii = Vec::with_capacity(n * 8);
        let mut start_angles = Vec::with_capacity(n * 8);
        let mut end_angles = Vec::with_capacity(n * 8);

        for (gid, entity) in entities.iter() {
            if let CadEntity::Arc {
                id: _,
                layer,
                color,
                center,
                radius,
                start_angle,
                end_angle,
                line_weight,
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                line_weights.push((*line_weight as f32).to_le_bytes());
                center_x.push(center.x.to_le_bytes());
                center_y.push(center.y.to_le_bytes());
                radii.push(radius.to_le_bytes());
                start_angles.push(start_angle.to_le_bytes());
                end_angles.push(end_angle.to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * ARC_BYTES_PER_ENTITY);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes(&mut buf, &line_weights);
        append_bytes_8(&mut buf, &center_x);
        append_bytes_8(&mut buf, &center_y);
        append_bytes_8(&mut buf, &radii);
        append_bytes_8(&mut buf, &start_angles);
        append_bytes_8(&mut buf, &end_angles);
        buf
    }

    fn encode_ellipses(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut line_weights = Vec::with_capacity(n * 4);
        let mut center_x = Vec::with_capacity(n * 8);
        let mut center_y = Vec::with_capacity(n * 8);
        let mut major_x = Vec::with_capacity(n * 8);
        let mut major_y = Vec::with_capacity(n * 8);
        let mut ratios = Vec::with_capacity(n * 8);
        let mut start_angles = Vec::with_capacity(n * 8);
        let mut end_angles = Vec::with_capacity(n * 8);

        for (gid, entity) in entities.iter() {
            if let CadEntity::Ellipse {
                id: _,
                layer,
                color,
                center,
                major_axis,
                minor_axis_ratio,
                start_angle,
                end_angle,
                line_weight,
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                line_weights.push((*line_weight as f32).to_le_bytes());
                center_x.push(center.x.to_le_bytes());
                center_y.push(center.y.to_le_bytes());
                major_x.push(major_axis.x.to_le_bytes());
                major_y.push(major_axis.y.to_le_bytes());
                ratios.push(minor_axis_ratio.to_le_bytes());
                start_angles.push(start_angle.to_le_bytes());
                end_angles.push(end_angle.to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * ELLIPSE_BYTES_PER_ENTITY);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes(&mut buf, &line_weights);
        append_bytes_8(&mut buf, &center_x);
        append_bytes_8(&mut buf, &center_y);
        append_bytes_8(&mut buf, &major_x);
        append_bytes_8(&mut buf, &major_y);
        append_bytes_8(&mut buf, &ratios);
        append_bytes_8(&mut buf, &start_angles);
        append_bytes_8(&mut buf, &end_angles);
        buf
    }

    fn encode_lwpolylines(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let mut buf = Vec::new();
        for (gid, entity) in entities.iter() {
            if let CadEntity::LwPolyline {
                id: _,
                layer,
                color,
                vertices,
                closed,
                line_weight,
            } = entity
            {
                let entity_id = *gid;
                let layer_idx = self.string_pool.intern(layer);
                let color_val = *color as u32;
                let lw_val = *line_weight as f32;
                let closed_val: u8 = if *closed { 1 } else { 0 };
                let vert_count = vertices.len() as u32;

                buf.extend_from_slice(&entity_id.to_le_bytes());
                buf.extend_from_slice(&layer_idx.to_le_bytes());
                buf.extend_from_slice(&color_val.to_le_bytes());
                buf.extend_from_slice(&lw_val.to_le_bytes());
                buf.extend_from_slice(&closed_val.to_le_bytes());
                buf.extend_from_slice(&vert_count.to_le_bytes());

                for v in vertices {
                    buf.extend_from_slice(&v.x.to_le_bytes());
                    buf.extend_from_slice(&v.y.to_le_bytes());
                    buf.extend_from_slice(&v.bulge.to_le_bytes());
                }
            }
        }
        buf
    }

    fn encode_polylines(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let mut buf = Vec::new();
        for (gid, entity) in entities.iter() {
            if let CadEntity::Polyline {
                id: _,
                layer,
                color,
                vertices,
                closed,
                line_weight,
            } = entity
            {
                let entity_id = *gid;
                let layer_idx = self.string_pool.intern(layer);
                let color_val = *color as u32;
                let lw_val = *line_weight as f32;
                let closed_val: u8 = if *closed { 1 } else { 0 };
                let vert_count = vertices.len() as u32;

                buf.extend_from_slice(&entity_id.to_le_bytes());
                buf.extend_from_slice(&layer_idx.to_le_bytes());
                buf.extend_from_slice(&color_val.to_le_bytes());
                buf.extend_from_slice(&lw_val.to_le_bytes());
                buf.extend_from_slice(&closed_val.to_le_bytes());
                buf.extend_from_slice(&vert_count.to_le_bytes());

                for v in vertices {
                    buf.extend_from_slice(&v.x.to_le_bytes());
                    buf.extend_from_slice(&v.y.to_le_bytes());
                    buf.extend_from_slice(&v.z.to_le_bytes());
                }
            }
        }
        buf
    }

    fn encode_splines(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let mut buf = Vec::new();
        for (gid, entity) in entities.iter() {
            if let CadEntity::Spline {
                id: _,
                layer,
                color,
                control_points,
                fit_points,
                knots,
                degree,
                line_weight,
            } = entity
            {
                let entity_id = *gid;
                let layer_idx = self.string_pool.intern(layer);
                let color_val = *color as u32;
                let lw_val = *line_weight as f32;
                let ctrl_count = control_points.len() as u32;
                let fit_count = fit_points.len() as u32;
                let knot_count = knots.len() as u32;

                buf.extend_from_slice(&entity_id.to_le_bytes());
                buf.extend_from_slice(&layer_idx.to_le_bytes());
                buf.extend_from_slice(&color_val.to_le_bytes());
                buf.extend_from_slice(&lw_val.to_le_bytes());
                buf.extend_from_slice(&(*degree as u32).to_le_bytes());
                buf.extend_from_slice(&ctrl_count.to_le_bytes());
                buf.extend_from_slice(&fit_count.to_le_bytes());
                buf.extend_from_slice(&knot_count.to_le_bytes());

                for p in control_points {
                    buf.extend_from_slice(&p.x.to_le_bytes());
                    buf.extend_from_slice(&p.y.to_le_bytes());
                    buf.extend_from_slice(&p.z.to_le_bytes());
                }
                for p in fit_points {
                    buf.extend_from_slice(&p.x.to_le_bytes());
                    buf.extend_from_slice(&p.y.to_le_bytes());
                    buf.extend_from_slice(&p.z.to_le_bytes());
                }
                for k in knots {
                    buf.extend_from_slice(&k.to_le_bytes());
                }
            }
        }
        buf
    }

    fn encode_texts(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut pos_x = Vec::with_capacity(n * 8);
        let mut pos_y = Vec::with_capacity(n * 8);
        let mut heights = Vec::with_capacity(n * 8);
        let mut rotations = Vec::with_capacity(n * 8);
        let mut h_aligns = Vec::with_capacity(n);
        let mut v_aligns = Vec::with_capacity(n);
        let mut text_indices = Vec::with_capacity(n * 4);

        for (gid, entity) in entities.iter() {
            if let CadEntity::Text {
                id: _,
                layer,
                color,
                position,
                height,
                content,
                rotation,
                horizontal_alignment,
                vertical_alignment,
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                pos_x.push(position.x.to_le_bytes());
                pos_y.push(position.y.to_le_bytes());
                heights.push(height.to_le_bytes());
                rotations.push(rotation.to_le_bytes());
                h_aligns.push(*horizontal_alignment);
                v_aligns.push(*vertical_alignment);
                text_indices.push(self.string_pool.intern(content).to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * TEXT_BYTES_PER_ENTITY);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes_8(&mut buf, &pos_x);
        append_bytes_8(&mut buf, &pos_y);
        append_bytes_8(&mut buf, &heights);
        append_bytes_8(&mut buf, &rotations);
        buf.extend_from_slice(&h_aligns);
        buf.extend_from_slice(&v_aligns);
        append_bytes(&mut buf, &text_indices);
        buf
    }

    fn encode_mtexts(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut pos_x = Vec::with_capacity(n * 8);
        let mut pos_y = Vec::with_capacity(n * 8);
        let mut heights = Vec::with_capacity(n * 8);
        let mut widths = Vec::with_capacity(n * 8);
        let mut rotations = Vec::with_capacity(n * 8);
        let mut attachment_points = Vec::with_capacity(n);
        let mut width_factors = Vec::with_capacity(n * 8);
        let mut height_scales = Vec::with_capacity(n * 8);
        let mut font_indices = Vec::with_capacity(n * 4);
        let mut text_indices = Vec::with_capacity(n * 4);

        for (gid, entity) in entities.iter() {
            if let CadEntity::MText {
                id: _,
                layer,
                color,
                position,
                height,
                content,
                width,
                rotation,
                attachment_point,
                width_factor,
                font_name,
                height_scale,
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                pos_x.push(position.x.to_le_bytes());
                pos_y.push(position.y.to_le_bytes());
                heights.push(height.to_le_bytes());
                widths.push(width.to_le_bytes());
                rotations.push(rotation.to_le_bytes());
                attachment_points.push(*attachment_point);
                width_factors.push(width_factor.to_le_bytes());
                height_scales.push(height_scale.to_le_bytes());
                font_indices.push(self.string_pool.intern(font_name).to_le_bytes());
                text_indices.push(self.string_pool.intern(content).to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * MTEXT_BYTES_PER_ENTITY + 4);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes_8(&mut buf, &pos_x);
        append_bytes_8(&mut buf, &pos_y);
        append_bytes_8(&mut buf, &heights);
        append_bytes_8(&mut buf, &widths);
        append_bytes_8(&mut buf, &rotations);
        append_bytes_raw(&mut buf, &attachment_points);
        append_bytes_8(&mut buf, &width_factors);
        append_bytes_8(&mut buf, &height_scales);
        let pad = padding_bytes(buf.len(), 4);
        for _ in 0..pad {
            buf.push(0);
        }
        append_bytes(&mut buf, &font_indices);
        append_bytes(&mut buf, &text_indices);
        buf
    }

    fn encode_solids(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let mut buf = Vec::new();
        for (gid, entity) in entities.iter() {
            if let CadEntity::Solid {
                id: _,
                layer,
                color,
                points,
            } = entity
            {
                let entity_id = *gid;
                let layer_idx = self.string_pool.intern(layer);
                let color_val = *color as u32;
                let point_count = points.len() as u32;

                buf.extend_from_slice(&entity_id.to_le_bytes());
                buf.extend_from_slice(&layer_idx.to_le_bytes());
                buf.extend_from_slice(&color_val.to_le_bytes());
                buf.extend_from_slice(&point_count.to_le_bytes());

                for p in points {
                    buf.extend_from_slice(&p.x.to_le_bytes());
                    buf.extend_from_slice(&p.y.to_le_bytes());
                }
            }
        }
        buf
    }

    fn encode_points(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut pos_x = Vec::with_capacity(n * 8);
        let mut pos_y = Vec::with_capacity(n * 8);

        for (gid, entity) in entities.iter() {
            if let CadEntity::Point {
                id: _,
                layer,
                color,
                position,
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                pos_x.push(position.x.to_le_bytes());
                pos_y.push(position.y.to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * POINT_BYTES_PER_ENTITY);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes_8(&mut buf, &pos_x);
        append_bytes_8(&mut buf, &pos_y);
        buf
    }

    fn encode_inserts(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut pos_x = Vec::with_capacity(n * 8);
        let mut pos_y = Vec::with_capacity(n * 8);
        let mut scale_x = Vec::with_capacity(n * 8);
        let mut scale_y = Vec::with_capacity(n * 8);
        let mut rotations = Vec::with_capacity(n * 8);
        let mut block_name_indices = Vec::with_capacity(n * 4);

        for (gid, entity) in entities.iter() {
            if let CadEntity::Insert {
                id: _,
                layer,
                color,
                block_name,
                position,
                x_scale,
                y_scale,
                rotation,
                ..
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                pos_x.push(position.x.to_le_bytes());
                pos_y.push(position.y.to_le_bytes());
                scale_x.push(x_scale.to_le_bytes());
                scale_y.push(y_scale.to_le_bytes());
                rotations.push(rotation.to_le_bytes());
                block_name_indices.push(self.string_pool.intern(block_name).to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * INSERT_BYTES_PER_ENTITY);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes_8(&mut buf, &pos_x);
        append_bytes_8(&mut buf, &pos_y);
        append_bytes_8(&mut buf, &scale_x);
        append_bytes_8(&mut buf, &scale_y);
        append_bytes_8(&mut buf, &rotations);
        append_bytes(&mut buf, &block_name_indices);
        buf
    }

    fn encode_hatches(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let mut buf = Vec::new();
        for (gid, entity) in entities.iter() {
            if let CadEntity::Hatch {
                id: _,
                layer,
                color,
                boundaries,
                pattern_name,
                pattern_type,
                solid,
                scale,
                angle,
                style,
                pattern_lines,
            } = entity
            {
                let entity_id = *gid;
                let layer_idx = self.string_pool.intern(layer);
                let color_val = *color as u32;
                let pattern_idx = self.string_pool.intern(pattern_name);
                let solid_val: u8 = if *solid { 1 } else { 0 };
                let boundary_count = boundaries.len() as u32;
                let pline_count = pattern_lines.len() as u32;

                buf.extend_from_slice(&entity_id.to_le_bytes());
                buf.extend_from_slice(&layer_idx.to_le_bytes());
                buf.extend_from_slice(&color_val.to_le_bytes());
                buf.extend_from_slice(&(*pattern_type as u32).to_le_bytes());
                buf.extend_from_slice(&pattern_idx.to_le_bytes());
                buf.extend_from_slice(&solid_val.to_le_bytes());
                buf.extend_from_slice(&scale.to_le_bytes());
                buf.extend_from_slice(&angle.to_le_bytes());
                buf.extend_from_slice(&style.to_le_bytes());
                buf.extend_from_slice(&boundary_count.to_le_bytes());

                for path in boundaries {
                    let vert_count = path.len() as u32;
                    buf.extend_from_slice(&vert_count.to_le_bytes());
                    for v in path {
                        buf.extend_from_slice(&v.x.to_le_bytes());
                        buf.extend_from_slice(&v.y.to_le_bytes());
                        buf.extend_from_slice(&v.bulge.to_le_bytes());
                    }
                }

                buf.extend_from_slice(&pline_count.to_le_bytes());
                for pl in pattern_lines {
                    let dash_count = pl.dashes.len() as u32;
                    buf.extend_from_slice(&pl.angle.to_le_bytes());
                    buf.extend_from_slice(&pl.base_x.to_le_bytes());
                    buf.extend_from_slice(&pl.base_y.to_le_bytes());
                    buf.extend_from_slice(&pl.offset_x.to_le_bytes());
                    buf.extend_from_slice(&pl.offset_y.to_le_bytes());
                    buf.extend_from_slice(&dash_count.to_le_bytes());
                    for d in &pl.dashes {
                        buf.extend_from_slice(&d.to_le_bytes());
                    }
                }
            }
        }
        buf
    }

    fn encode_dimensions(&mut self, entities: &[(u32, &CadEntity)]) -> Vec<u8> {
        let n = entities.len();
        let mut ids = Vec::with_capacity(n * 4);
        let mut layers = Vec::with_capacity(n * 4);
        let mut colors = Vec::with_capacity(n * 4);
        let mut def_x = Vec::with_capacity(n * 8);
        let mut def_y = Vec::with_capacity(n * 8);
        let mut mid_x = Vec::with_capacity(n * 8);
        let mut mid_y = Vec::with_capacity(n * 8);
        let mut rotations = Vec::with_capacity(n * 8);
        let mut text_indices = Vec::with_capacity(n * 4);

        for (gid, entity) in entities.iter() {
            if let CadEntity::Dimension {
                id: _,
                layer,
                color,
                definition_point,
                text_midpoint,
                content,
                rotation,
            } = entity
            {
                ids.push(gid.to_le_bytes());
                layers.push(self.string_pool.intern(layer).to_le_bytes());
                colors.push((*color as u32).to_le_bytes());
                def_x.push(definition_point.x.to_le_bytes());
                def_y.push(definition_point.y.to_le_bytes());
                mid_x.push(text_midpoint.x.to_le_bytes());
                mid_y.push(text_midpoint.y.to_le_bytes());
                rotations.push(rotation.to_le_bytes());
                text_indices.push(self.string_pool.intern(content).to_le_bytes());
            }
        }

        let mut buf = Vec::with_capacity(n * DIMENSION_BYTES_PER_ENTITY);
        append_bytes(&mut buf, &ids);
        append_bytes(&mut buf, &layers);
        append_bytes(&mut buf, &colors);
        append_bytes_8(&mut buf, &def_x);
        append_bytes_8(&mut buf, &def_y);
        append_bytes_8(&mut buf, &mid_x);
        append_bytes_8(&mut buf, &mid_y);
        append_bytes_8(&mut buf, &rotations);
        append_bytes(&mut buf, &text_indices);
        buf
    }
}

fn entity_to_tag(entity: &CadEntity) -> u8 {
    match entity {
        CadEntity::Line { .. } => CHUNK_TAG_LINE,
        CadEntity::Circle { .. } => CHUNK_TAG_CIRCLE,
        CadEntity::Arc { .. } => CHUNK_TAG_ARC,
        CadEntity::Ellipse { .. } => CHUNK_TAG_ELLIPSE,
        CadEntity::LwPolyline { .. } => CHUNK_TAG_LWPOLYLINE,
        CadEntity::Polyline { .. } => CHUNK_TAG_POLYLINE,
        CadEntity::Spline { .. } => CHUNK_TAG_SPLINE,
        CadEntity::Text { .. } => CHUNK_TAG_TEXT,
        CadEntity::MText { .. } => CHUNK_TAG_MTEXT,
        CadEntity::Solid { .. } => CHUNK_TAG_SOLID,
        CadEntity::Point { .. } => CHUNK_TAG_POINT,
        CadEntity::Insert { .. } => CHUNK_TAG_INSERT,
        CadEntity::Hatch { .. } => CHUNK_TAG_HATCH,
        CadEntity::Dimension { .. } => CHUNK_TAG_DIMENSION,
        CadEntity::Leader { .. } => CHUNK_TAG_LEADER,
        CadEntity::AttributeEntity { .. } => CHUNK_TAG_ATTRIBUTE,
        CadEntity::Face3D { .. } => CHUNK_TAG_FACE3D,
        CadEntity::Polyline2D { .. } => CHUNK_TAG_POLYLINE2D,
        CadEntity::Table { .. } => CHUNK_TAG_TABLE,
    }
}

fn append_bytes(buf: &mut Vec<u8>, arrays: &[[u8; 4]]) {
    for arr in arrays {
        buf.extend_from_slice(arr);
    }
}

fn append_bytes_8(buf: &mut Vec<u8>, arrays: &[[u8; 8]]) {
    for arr in arrays {
        buf.extend_from_slice(arr);
    }
}

fn append_bytes_raw(buf: &mut Vec<u8>, data: &[u8]) {
    buf.extend_from_slice(data);
}

pub fn entity_bbox(entity: &CadEntity) -> (f64, f64, f64, f64) {
    cad_entity_bbox(entity).as_tuple()
}
