//! DWG diagnostic binary — parses all DWG files and prints entity type counts,
//! coordinate ranges, and outlier detection.

use acadrust::{entities::BoundaryEdge, DwgReader, EntityType};
use std::collections::HashMap;
use std::path::Path;

fn main() {
    let dir =
        "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/";
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_err) => {
            std::process::exit(1);
        }
    };

    let mut dwg_files: Vec<std::path::PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("dwg"))
                .unwrap_or(false)
        })
        .collect();
    dwg_files.sort();

    for file_path in &dwg_files {
        analyze_file(file_path);
    }
}

#[derive(Debug, Clone)]
struct CoordInfo {
    x: f64,
    y: f64,
    entity_type_name: String,
    layer: String,
    color: String,
    entity_mode: Option<u8>,
    invisible: bool,
    handle: String,
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
        EntityType::Polyline2D(_) => "Polyline2D",
        EntityType::Polyline3D(_) => "Polyline3D",
        EntityType::Spline(_) => "Spline",
        EntityType::Ellipse(_) => "Ellipse",
        EntityType::Solid(_) => "Solid",
        EntityType::Hatch(_) => "Hatch",
        EntityType::Dimension(_) => "Dimension",
        EntityType::Face3D(_) => "Face3D",
        EntityType::Block(_) => "Block",
        EntityType::BlockEnd(_) => "BlockEnd",
        EntityType::Ray(_) => "Ray",
        EntityType::XLine(_) => "XLine",
        EntityType::Viewport(_) => "Viewport",
        EntityType::AttributeDefinition(_) => "AttributeDef",
        EntityType::AttributeEntity(_) => "AttributeEntity",
        EntityType::Leader(_) => "Leader",
        EntityType::MultiLeader(_) => "MultiLeader",
        EntityType::MLine(_) => "MLine",
        EntityType::Mesh(_) => "Mesh",
        EntityType::RasterImage(_) => "RasterImage",
        EntityType::Solid3D(_) => "Solid3D",
        EntityType::Region(_) => "Region",
        EntityType::Body(_) => "Body",
        EntityType::Table(_) => "Table",
        EntityType::Tolerance(_) => "Tolerance",
        EntityType::PolyfaceMesh(_) => "PolyfaceMesh",
        EntityType::Wipeout(_) => "Wipeout",
        EntityType::Shape(_) => "Shape",
        EntityType::Underlay(_) => "Underlay",
        EntityType::Seqend(_) => "Seqend",
        EntityType::Ole2Frame(_) => "Ole2Frame",
        EntityType::PolygonMesh(_) => "PolygonMesh",
        EntityType::Unknown(_) => "Unknown",
    }
}

fn color_to_string(color: &acadrust::Color) -> String {
    match color {
        acadrust::Color::ByLayer => "ByLayer".to_string(),
        acadrust::Color::ByBlock => "ByBlock".to_string(),
        acadrust::Color::Index(idx) => format!("Idx({})", idx),
        acadrust::Color::Rgb { r, g, b } => format!("Rgb({},{},{})", r, g, b),
    }
}

fn mode_to_string(mode: Option<u8>) -> String {
    match mode {
        None => "None".to_string(),
        Some(0) => "0(owned)".to_string(),
        Some(1) => "1(paper)".to_string(),
        Some(2) => "2(model)".to_string(),
        Some(v) => format!("{}(?)", v),
    }
}

fn extract_coords(entity: &EntityType) -> Vec<(f64, f64)> {
    let mut coords = Vec::new();
    match entity {
        EntityType::Line(line) => {
            coords.push((line.start.x, line.start.y));
            coords.push((line.end.x, line.end.y));
        }
        EntityType::Circle(circle) => {
            coords.push((circle.center.x, circle.center.y));
        }
        EntityType::Arc(arc) => {
            coords.push((arc.center.x, arc.center.y));
        }
        EntityType::Point(point) => {
            coords.push((point.location.x, point.location.y));
        }
        EntityType::Text(text) => {
            coords.push((text.insertion_point.x, text.insertion_point.y));
        }
        EntityType::MText(mtext) => {
            coords.push((mtext.insertion_point.x, mtext.insertion_point.y));
        }
        EntityType::Insert(insert) => {
            coords.push((insert.insert_point.x, insert.insert_point.y));
        }
        EntityType::LwPolyline(lwpoly) => {
            for v in &lwpoly.vertices {
                coords.push((v.location.x, v.location.y));
            }
        }
        EntityType::Polyline(poly) => {
            for v in &poly.vertices {
                coords.push((v.location.x, v.location.y));
            }
        }
        EntityType::Polyline2D(poly2d) => {
            for v in &poly2d.vertices {
                coords.push((v.location.x, v.location.y));
            }
        }
        EntityType::Polyline3D(poly3d) => {
            for v in &poly3d.vertices {
                coords.push((v.position.x, v.position.y));
            }
        }
        EntityType::Spline(spline) => {
            for p in &spline.control_points {
                coords.push((p.x, p.y));
            }
            for p in &spline.fit_points {
                coords.push((p.x, p.y));
            }
        }
        EntityType::Ellipse(ellipse) => {
            coords.push((ellipse.center.x, ellipse.center.y));
        }
        EntityType::Solid(solid) => {
            coords.push((solid.first_corner.x, solid.first_corner.y));
            coords.push((solid.second_corner.x, solid.second_corner.y));
            coords.push((solid.third_corner.x, solid.third_corner.y));
            coords.push((solid.fourth_corner.x, solid.fourth_corner.y));
        }
        EntityType::Hatch(hatch) => {
            for path in &hatch.paths {
                for edge in &path.edges {
                    match edge {
                        BoundaryEdge::Line(le) => {
                            coords.push((le.start.x, le.start.y));
                            coords.push((le.end.x, le.end.y));
                        }
                        BoundaryEdge::CircularArc(ae) => {
                            coords.push((ae.center.x, ae.center.y));
                        }
                        BoundaryEdge::EllipticArc(ee) => {
                            coords.push((ee.center.x, ee.center.y));
                        }
                        BoundaryEdge::Polyline(pe) => {
                            for v in &pe.vertices {
                                coords.push((v.x, v.y));
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
        EntityType::Dimension(dim) => {
            let base = dim.base();
            coords.push((base.definition_point.x, base.definition_point.y));
            coords.push((base.text_middle_point.x, base.text_middle_point.y));
        }
        // For types without clear coordinate extraction, skip
        _ => {}
    }
    coords
}

fn analyze_file(file_path: &Path) {
    let _file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("?");
    let _file_size = std::fs::metadata(file_path).map(|m| m.len()).unwrap_or(0);

    let data = match std::fs::read(file_path) {
        Ok(d) => d,
        Err(_e) => {
            return;
        }
    };

    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = match reader.read() {
        Ok(d) => d,
        Err(_e) => {
            return;
        }
    };

    // 1. Count entities by type
    let mut type_counts: HashMap<String, usize> = HashMap::new();
    let mut mode_counts: HashMap<String, usize> = HashMap::new();
    let mut invisible_count: usize = 0;
    let mut visible_count: usize = 0;

    // Collect all coordinate info
    let mut all_coords: Vec<CoordInfo> = Vec::new();

    let mut total_entities: usize = 0;

    for entity in doc.entities() {
        total_entities += 1;
        let type_name = entity_type_name(entity).to_string();
        *type_counts.entry(type_name.clone()).or_insert(0) += 1;

        let common = entity.common();
        let mode_str = mode_to_string(common.entity_mode);
        *mode_counts.entry(mode_str).or_insert(0) += 1;

        if common.invisible {
            invisible_count += 1;
        } else {
            visible_count += 1;
        }

        // Extract coordinates
        let coords = extract_coords(entity);
        for (x, y) in coords {
            if x.is_finite() && y.is_finite() {
                all_coords.push(CoordInfo {
                    x,
                    y,
                    entity_type_name: type_name.clone(),
                    layer: common.layer.clone(),
                    color: color_to_string(&common.color),
                    entity_mode: common.entity_mode,
                    invisible: common.invisible,
                    handle: format!("{:?}", common.handle),
                });
            }
        }
    }

    // 2. Print total count and count by type
    let mut type_vec: Vec<_> = type_counts.iter().collect();
    type_vec.sort_by(|a, b| b.1.cmp(a.1));
    for (_type_name, _count) in &type_vec {}

    // 3. Count by entity_mode and invisible
    let mut mode_vec: Vec<_> = mode_counts.iter().collect();
    mode_vec.sort_by(|a, b| a.0.cmp(b.0));
    for (_mode, _count) in &mode_vec {}

    // 4. Coordinate ranges (ALL entities)
    if all_coords.is_empty() {
        return;
    }

    let (_min_x, _max_x) = all_coords
        .iter()
        .map(|c| c.x)
        .fold((f64::MAX, f64::MIN), |(mn, mx), v| (mn.min(v), mx.max(v)));
    let (_min_y, _max_y) = all_coords
        .iter()
        .map(|c| c.y)
        .fold((f64::MAX, f64::MIN), |(mn, mx), v| (mn.min(v), mx.max(v)));

    // 5. Coordinate ranges excluding paper space (entity_mode != Some(1))
    let non_paper_coords: Vec<&CoordInfo> = all_coords
        .iter()
        .filter(|c| c.entity_mode != Some(1))
        .collect();
    if non_paper_coords.is_empty() {
    } else {
        let (_min_x2, _max_x2) = non_paper_coords
            .iter()
            .map(|c| c.x)
            .fold((f64::MAX, f64::MIN), |(mn, mx), v| (mn.min(v), mx.max(v)));
        let (_min_y2, _max_y2) = non_paper_coords
            .iter()
            .map(|c| c.y)
            .fold((f64::MAX, f64::MIN), |(mn, mx), v| (mn.min(v), mx.max(v)));
    }

    // 6. Outlier detection using MAD (Median Absolute Deviation)

    // Use non-paper-space coordinates for outlier computation
    if non_paper_coords.len() < 5 {
        return;
    }

    let mut xs: Vec<f64> = non_paper_coords.iter().map(|c| c.x).collect();
    let mut ys: Vec<f64> = non_paper_coords.iter().map(|c| c.y).collect();
    xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    ys.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let median_x = median(&xs);
    let median_y = median(&ys);

    // MAD = median(|xi - median|)
    let mut deviations_x: Vec<f64> = xs.iter().map(|v| (v - median_x).abs()).collect();
    let mut deviations_y: Vec<f64> = ys.iter().map(|v| (v - median_y).abs()).collect();
    deviations_x.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    deviations_y.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let mad_x = median(&deviations_x);
    let mad_y = median(&deviations_y);

    // Use max of MAD and a small epsilon to avoid division by near-zero
    let effective_mad_x = if mad_x > 1e-6 { mad_x } else { 1.0 };
    let effective_mad_y = if mad_y > 1e-6 { mad_y } else { 1.0 };

    let threshold = 5.0;
    let mut outliers: Vec<&CoordInfo> = Vec::new();

    for ci in &non_paper_coords {
        let dev_x = (ci.x - median_x).abs() / effective_mad_x;
        let dev_y = (ci.y - median_y).abs() / effective_mad_y;
        // Flag if either X or Y is an outlier
        if dev_x > threshold || dev_y > threshold {
            outliers.push(ci);
        }
    }

    // Also check paper-space entities - they are inherently outliers
    let paper_coords: Vec<&CoordInfo> = all_coords
        .iter()
        .filter(|c| c.entity_mode == Some(1))
        .collect();

    if outliers.is_empty() && paper_coords.is_empty() {
    } else {
        if !paper_coords.is_empty() {
            let (_pmin_x, _pmax_x) = paper_coords
                .iter()
                .map(|c| c.x)
                .fold((f64::MAX, f64::MIN), |(mn, mx), v| (mn.min(v), mx.max(v)));
            let (_pmin_y, _pmax_y) = paper_coords
                .iter()
                .map(|c| c.y)
                .fold((f64::MAX, f64::MIN), |(mn, mx), v| (mn.min(v), mx.max(v)));
            // Show sample of paper space entities
            let mut paper_by_type: HashMap<String, usize> = HashMap::new();
            for c in &paper_coords {
                *paper_by_type.entry(c.entity_type_name.clone()).or_insert(0) += 1;
            }
            let mut pv: Vec<_> = paper_by_type.iter().collect();
            pv.sort_by(|a, b| b.1.cmp(a.1));
            for (_t, _cnt) in &pv {}
        }

        if !outliers.is_empty() {
            // Group outliers by entity type
            let mut outlier_by_type: HashMap<String, usize> = HashMap::new();
            let mut outlier_by_layer: HashMap<String, usize> = HashMap::new();
            for c in &outliers {
                *outlier_by_type
                    .entry(c.entity_type_name.clone())
                    .or_insert(0) += 1;
                *outlier_by_layer.entry(c.layer.clone()).or_insert(0) += 1;
            }

            let mut ot: Vec<_> = outlier_by_type.iter().collect();
            ot.sort_by(|a, b| b.1.cmp(a.1));
            for (_t, _cnt) in &ot {}

            let mut ol: Vec<_> = outlier_by_layer.iter().collect();
            ol.sort_by(|a, b| b.1.cmp(a.1));
            for (_l, _cnt) in &ol {}

            // Print first 20 outlier entities (deduplicated by handle)
            let mut seen_handles: std::collections::HashSet<String> =
                std::collections::HashSet::new();
            let mut printed = 0;
            for c in &outliers {
                if seen_handles.insert(c.handle.clone()) {
                    let _dev_x = (c.x - median_x).abs() / effective_mad_x;
                    let _dev_y = (c.y - median_y).abs() / effective_mad_y;
                    printed += 1;
                    if printed >= 20 {
                        break;
                    }
                }
            }
        }
    }
}

fn median(sorted: &[f64]) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let mid = sorted.len() / 2;
    if sorted.len().is_multiple_of(2) {
        (sorted[mid - 1] + sorted[mid]) / 2.0
    } else {
        sorted[mid]
    }
}
