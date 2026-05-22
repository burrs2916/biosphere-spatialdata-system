use acadrust::{DwgReader, EntityType};
use std::collections::HashMap;

fn main() {
    let files = [
        "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/井下避灾线路图（202505).dwg",
        "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg",
        "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/西沟煤矿降尘系统布置图通风科修改2004.dwg",
    ];

    for file_path in &files {
        let file_name = std::path::Path::new(file_path)
            .file_name()
            .unwrap()
            .to_string_lossy()
            .to_string();
        let file_size = std::fs::metadata(file_path).map(|m| m.len()).unwrap_or(0);

        let data = match std::fs::read(file_path) {
            Ok(d) => d,
            Err(e) => {
                continue;
            }
        };

        let cursor = std::io::Cursor::new(data);
        let mut reader = DwgReader::from_stream(cursor);
        let doc = match reader.read() {
            Ok(d) => d,
            Err(e) => {
                continue;
            }
        };

        let mut entity_count = 0usize;
        let mut type_dist: HashMap<String, usize> = HashMap::new();
        let mut min_x = f64::MAX;
        let mut max_x = f64::MIN;
        let mut min_y = f64::MAX;
        let mut max_y = f64::MIN;

        let mut lwpoly_huge = 0usize;
        let mut lwpoly_total_verts = 0usize;
        let mut lwpoly_max_verts = 0usize;
        let mut hatch_count = 0usize;
        let mut hatch_max_edges = 0usize;
        let mut text_extreme = 0usize;
        let mut text_heights: Vec<f64> = Vec::new();
        let mut insert_count = 0usize;
        let mut insert_block_names: HashMap<String, usize> = HashMap::new();

        let mut coord_samples: Vec<(f64, f64)> = Vec::new();

        for entity in doc.entities() {
            entity_count += 1;
            let type_name = match &entity {
                EntityType::Line(_) => "Line",
                EntityType::Circle(_) => "Circle",
                EntityType::Arc(_) => "Arc",
                EntityType::LwPolyline(lw) => {
                    let n = lw.vertices.len();
                    lwpoly_total_verts += n;
                    lwpoly_max_verts = lwpoly_max_verts.max(n);
                    if n > 1000 { lwpoly_huge += 1; }
                    for v in &lw.vertices {
                        let x = v.location.x; let y = v.location.y;
                        if x.is_finite() && y.is_finite() {
                            min_x = min_x.min(x); max_x = max_x.max(x);
                            min_y = min_y.min(y); max_y = max_y.max(y);
                            coord_samples.push((x, y));
                        }
                    }
                    "LwPolyline"
                }
                EntityType::Hatch(h) => {
                    hatch_count += 1;
                    for p in &h.paths {
                        hatch_max_edges = hatch_max_edges.max(p.edges.len());
                    }
                    "Hatch"
                }
                EntityType::Text(t) => {
                    text_heights.push(t.height);
                    if t.height > 1000.0 || t.height < 0.01 { text_extreme += 1; }
                    let p = &t.insertion_point;
                    if p.x.is_finite() && p.y.is_finite() {
                        min_x = min_x.min(p.x); max_x = max_x.max(p.x);
                        min_y = min_y.min(p.y); max_y = max_y.max(p.y);
                        coord_samples.push((p.x, p.y));
                    }
                    "Text"
                }
                EntityType::MText(mt) => {
                    text_heights.push(mt.height);
                    if mt.height > 1000.0 || mt.height < 0.01 { text_extreme += 1; }
                    let p = &mt.insertion_point;
                    if p.x.is_finite() && p.y.is_finite() {
                        min_x = min_x.min(p.x); max_x = max_x.max(p.x);
                        min_y = min_y.min(p.y); max_y = max_y.max(p.y);
                        coord_samples.push((p.x, p.y));
                    }
                    "MText"
                }
                EntityType::Insert(ins) => {
                    insert_count += 1;
                    *insert_block_names.entry(ins.block_name.clone()).or_insert(0) += 1;
                    let x = ins.insert_point.x; let y = ins.insert_point.y;
                    if x.is_finite() && y.is_finite() {
                        min_x = min_x.min(x); max_x = max_x.max(x);
                        min_y = min_y.min(y); max_y = max_y.max(y);
                        coord_samples.push((x, y));
                    }
                    "Insert"
                }
                EntityType::Spline(sp) => {
                    for p in &sp.control_points {
                        if p.x.is_finite() && p.y.is_finite() {
                            min_x = min_x.min(p.x); max_x = max_x.max(p.x);
                            min_y = min_y.min(p.y); max_y = max_y.max(p.y);
                            coord_samples.push((p.x, p.y));
                        }
                    }
                    for p in &sp.fit_points {
                        if p.x.is_finite() && p.y.is_finite() {
                            min_x = min_x.min(p.x); max_x = max_x.max(p.x);
                            min_y = min_y.min(p.y); max_y = max_y.max(p.y);
                            coord_samples.push((p.x, p.y));
                        }
                    }
                    "Spline"
                }
                EntityType::Polyline(poly) => {
                    for v in &poly.vertices {
                        let x = v.location.x; let y = v.location.y;
                        if x.is_finite() && y.is_finite() {
                            min_x = min_x.min(x); max_x = max_x.max(x);
                            min_y = min_y.min(y); max_y = max_y.max(y);
                            coord_samples.push((x, y));
                        }
                    }
                    "Polyline"
                }
                EntityType::Ellipse(el) => {
                    let x = el.center.x; let y = el.center.y;
                    if x.is_finite() && y.is_finite() {
                        min_x = min_x.min(x); max_x = max_x.max(x);
                        min_y = min_y.min(y); max_y = max_y.max(y);
                        coord_samples.push((x, y));
                    }
                    "Ellipse"
                }
                EntityType::Solid(s) => {
                    for p in [&s.first_corner, &s.second_corner, &s.third_corner, &s.fourth_corner] {
                        if p.x.is_finite() && p.y.is_finite() {
                            min_x = min_x.min(p.x); max_x = max_x.max(p.x);
                            min_y = min_y.min(p.y); max_y = max_y.max(p.y);
                        }
                    }
                    "Solid"
                }
                EntityType::Point(pt) => {
                    let x = pt.location.x; let y = pt.location.y;
                    if x.is_finite() && y.is_finite() {
                        min_x = min_x.min(x); max_x = max_x.max(x);
                        min_y = min_y.min(y); max_y = max_y.max(y);
                        coord_samples.push((x, y));
                    }
                    "Point"
                }
                EntityType::Dimension(dim) => {
                    let base = dim.base();
                    let p = &base.definition_point;
                    if p.x.is_finite() && p.y.is_finite() {
                        min_x = min_x.min(p.x); max_x = max_x.max(p.x);
                        min_y = min_y.min(p.y); max_y = max_y.max(p.y);
                    }
                    "Dimension"
                }
                _ => "Other",
            };
            *type_dist.entry(type_name.to_string()).or_insert(0) += 1;
        }

        let coord_span_x = if max_x.is_finite() && min_x.is_finite() { max_x - min_x } else { 0.0 };
        let coord_span_y = if max_y.is_finite() && min_y.is_finite() { max_y - min_y } else { 0.0 };

        let has_large_coords = coord_span_x > 1_000_000.0 || coord_span_y > 1_000_000.0;
        let has_heavy_lwpoly = lwpoly_huge > 0;
        let has_heavy_hatch = hatch_count > 2000 || hatch_max_edges > 100;
        let has_extreme_text = text_extreme > 0;
        let has_heavy_entity = entity_count >= 30000 || file_size > 20_000_000;

        let problem_count = [has_large_coords, has_heavy_lwpoly, has_heavy_hatch, has_extreme_text]
            .iter().filter(|&&x| x).count();

        let profile = if problem_count == 0 && !has_heavy_entity {
            "Simple"
        } else if problem_count == 0 && has_heavy_entity {
            "HeavyEntity"
        } else if problem_count == 1 {
            if has_large_coords { "LargeCoordinates" }
            else if has_heavy_lwpoly { "HeavyLwPolyline" }
            else if has_heavy_hatch { "HeavyHatch" }
            else { "Complex(EXTREME_TEXT)" }
        } else if problem_count >= 2 {
            "Complex"
        } else {
            "Simple(fallback)"
        };

        if !coord_samples.is_empty() {
            let mut xs: Vec<f64> = coord_samples.iter().map(|c| c.0).filter(|x| x.is_finite()).collect();
            let mut ys: Vec<f64> = coord_samples.iter().map(|c| c.1).filter(|y| y.is_finite()).collect();
            xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            ys.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

            if !xs.is_empty() && !ys.is_empty() {
                let x_p10 = xs[xs.len() * 10 / 100];
                let x_p90 = xs[xs.len() * 90 / 100];
                let y_p10 = ys[ys.len() * 10 / 100];
                let y_p90 = ys[ys.len() * 90 / 100];

                let outlier_x_low = xs.iter().filter(|&&x| x < x_p10 - (x_p90 - x_p10) * 2.0).count();
                let outlier_x_high = xs.iter().filter(|&&x| x > x_p90 + (x_p90 - x_p10) * 2.0).count();
                let outlier_y_low = ys.iter().filter(|&&y| y < y_p10 - (y_p90 - y_p10) * 2.0).count();
                let outlier_y_high = ys.iter().filter(|&&y| y > y_p90 + (y_p90 - y_p10) * 2.0).count();
            }
        }
        let mut types: Vec<_> = type_dist.iter().collect();
        types.sort_by(|a, b| b.1.cmp(a.1));
        for (t, c) in &types {
        }
        if !text_heights.is_empty() {
            text_heights.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let very_small = text_heights.iter().filter(|&&h| h < 0.01).count();
            let very_large = text_heights.iter().filter(|&&h| h > 1000.0).count();
            let normal = text_heights.iter().filter(|&&h| h >= 0.01 && h <= 1000.0).count();

            let height_dist: HashMap<u64, usize> = text_heights.iter()
                .map(|&h| (h * 10.0).round() as u64)
                .fold(HashMap::new(), |mut acc, h| { *acc.entry(h).or_insert(0) += 1; acc });
            let mut h_dist: Vec<_> = height_dist.iter().collect();
            h_dist.sort_by(|a, b| b.1.cmp(a.1));
            for (h_bucket, count) in h_dist.iter().take(10) {
            }
        }
        let mut block_names: Vec<_> = insert_block_names.iter().collect();
        block_names.sort_by(|a, b| b.1.cmp(a.1));
        for (name, count) in block_names.iter().take(15) {
        }
    }
}
