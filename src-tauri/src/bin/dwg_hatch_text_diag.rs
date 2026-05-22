use acadrust::{entities::BoundaryEdge, DwgReader, EntityType};
use std::collections::HashMap;

fn main() {
    let file_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg";

    let data = match std::fs::read(file_path) {
        Ok(d) => d,
        Err(_e) => {
            std::process::exit(1);
        }
    };

    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = match reader.read() {
        Ok(d) => d,
        Err(_e) => {
            std::process::exit(1);
        }
    };

    let mut hatch_count = 0;
    let mut text_count = 0;
    let mut mtext_count = 0;
    let mut other_counts: HashMap<String, usize> = HashMap::new();

    for entity in doc.entities() {
        let common = entity.common();
        if common.entity_mode == Some(0) || common.entity_mode == Some(1) {
            continue;
        }
        if common.invisible {
            continue;
        }

        match &entity {
            EntityType::Hatch(_) => hatch_count += 1,
            EntityType::Text(_) => text_count += 1,
            EntityType::MText(_) => mtext_count += 1,
            _ => {
                let name = entity_type_name(&entity);
                *other_counts.entry(name.to_string()).or_insert(0) += 1;
            }
        }
    }
    let mut ov: Vec<_> = other_counts.iter().collect();
    ov.sort_by(|a, b| b.1.cmp(a.1));
    for (name, count) in &ov {}

    let mut hatch_idx = 0;
    for entity in doc.entities() {
        let common = entity.common();
        if common.entity_mode == Some(0) || common.entity_mode == Some(1) || common.invisible {
            continue;
        }

        if let EntityType::Hatch(hatch) = &entity {
            hatch_idx += 1;
            for (li, line) in hatch.pattern.lines.iter().enumerate() {}

            for (pi, path) in hatch.paths.iter().enumerate() {
                for (ei, edge) in path.edges.iter().enumerate() {
                    match edge {
                        BoundaryEdge::Line(le) => {}
                        BoundaryEdge::CircularArc(ae) => {}
                        BoundaryEdge::Polyline(pe) => {
                            for (vi, v) in pe.vertices.iter().enumerate() {
                                print!("      v[{}]: ({:.4},{:.4}) bulge={:.4}", vi, v.x, v.y, v.z);
                                if vi % 3 == 2 {
                                } else {
                                    print!("  ");
                                }
                            }
                            if pe.vertices.len() % 3 != 0 {}
                        }
                        BoundaryEdge::EllipticArc(ee) => {}
                        BoundaryEdge::Spline(se) => {}
                    }
                }
            }

            let mut all_x = Vec::new();
            let mut all_y = Vec::new();
            for path in &hatch.paths {
                for edge in &path.edges {
                    match edge {
                        BoundaryEdge::Line(le) => {
                            all_x.push(le.start.x);
                            all_y.push(le.start.y);
                            all_x.push(le.end.x);
                            all_y.push(le.end.y);
                        }
                        BoundaryEdge::CircularArc(ae) => {
                            all_x.push(ae.center.x);
                            all_y.push(ae.center.y);
                        }
                        BoundaryEdge::Polyline(pe) => {
                            for v in &pe.vertices {
                                all_x.push(v.x);
                                all_y.push(v.y);
                            }
                        }
                        BoundaryEdge::EllipticArc(ee) => {
                            all_x.push(ee.center.x);
                            all_y.push(ee.center.y);
                        }
                        _ => {}
                    }
                }
            }
            if !all_x.is_empty() {
                let min_x = all_x.iter().cloned().fold(f64::MAX, f64::min);
                let max_x = all_x.iter().cloned().fold(f64::MIN, f64::max);
                let min_y = all_y.iter().cloned().fold(f64::MAX, f64::min);
                let max_y = all_y.iter().cloned().fold(f64::MIN, f64::max);
            }
        }
    }

    let mut text_idx = 0;
    for entity in doc.entities() {
        let common = entity.common();
        if common.entity_mode == Some(0) || common.entity_mode == Some(1) || common.invisible {
            continue;
        }

        if let EntityType::Text(text) = &entity {
            text_idx += 1;
            if let Some(ap) = text.alignment_point {}
        }

        if let EntityType::MText(mtext) = &entity {
            text_idx += 1;
        }
    }
    for layer in doc.layers.iter() {}
}

fn entity_type_name(entity: &EntityType) -> &'static str {
    match entity {
        EntityType::Line(_) => "Line",
        EntityType::Circle(_) => "Circle",
        EntityType::Arc(_) => "Arc",
        EntityType::Point(_) => "Point",
        EntityType::Text(_) => "Text",
        EntityType::MText(_) => "MText",
        EntityType::Insert(_) => "Insert",
        EntityType::LwPolyline(_) => "LwPolyline",
        EntityType::Polyline(_) => "Polyline",
        EntityType::Spline(_) => "Spline",
        EntityType::Ellipse(_) => "Ellipse",
        EntityType::Solid(_) => "Solid",
        EntityType::Hatch(_) => "Hatch",
        EntityType::Dimension(_) => "Dimension",
        _ => "Other",
    }
}
