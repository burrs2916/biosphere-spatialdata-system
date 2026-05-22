use acadrust::{DwgReader, EntityType};
use std::collections::HashMap;
use std::time::Instant;

fn entity_type_name(et: &EntityType) -> &'static str {
    match et {
        EntityType::Line(_) => "Line",
        EntityType::Circle(_) => "Circle",
        EntityType::Arc(_) => "Arc",
        EntityType::LwPolyline(_) => "LwPolyline",
        EntityType::Polyline(_) => "Polyline",
        EntityType::Ellipse(_) => "Ellipse",
        EntityType::Spline(_) => "Spline",
        EntityType::Text(_) => "Text",
        EntityType::MText(_) => "MText",
        EntityType::Solid(_) => "Solid",
        EntityType::Point(_) => "Point",
        EntityType::Insert(_) => "Insert",
        EntityType::Hatch(_) => "Hatch",
        EntityType::Dimension(_) => "Dimension",
        _ => "Other",
    }
}

fn analyze_dwg(path: &std::path::Path) {
    let _file_name = path.file_name().unwrap().to_string_lossy();
    let _file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(_e) => {
            return;
        }
    };

    let start = Instant::now();
    let result = DwgReader::from_stream(std::io::Cursor::new(data)).read();
    let _parse_time = start.elapsed();

    match result {
        Ok(doc) => {
            let mut type_counts: HashMap<&'static str, usize> = HashMap::new();
            let mut layer_counts: HashMap<String, usize> = HashMap::new();
            let mut total_entities = 0;
            let mut invisible = 0;
            let mut inserts = 0;
            let mut insert_names: HashMap<String, usize> = HashMap::new();
            let mut hatch_boundary_sizes: Vec<usize> = Vec::new();
            let mut spline_fit_points: Vec<usize> = Vec::new();
            let mut spline_control_points: Vec<usize> = Vec::new();
            let mut lwpoly_vertex_counts: Vec<usize> = Vec::new();
            let mut text_heights: Vec<f64> = Vec::new();
            let _coord_samples: Vec<(f64, f64)> = Vec::new();
            let mut min_x = f64::MAX;
            let mut max_x = f64::MIN;
            let mut min_y = f64::MAX;
            let mut max_y = f64::MIN;

            for entity in doc.entities() {
                total_entities += 1;
                let common = entity.common();

                if common.invisible {
                    invisible += 1;
                    continue;
                }

                let type_name = entity_type_name(entity);
                *type_counts.entry(type_name).or_insert(0) += 1;
                *layer_counts.entry(common.layer.clone()).or_insert(0) += 1;

                match &entity {
                    EntityType::Line(l) => {
                        for (x, y) in [(l.start.x, l.start.y), (l.end.x, l.end.y)] {
                            if x.is_finite() && y.is_finite() && x.abs() < 1e9 && y.abs() < 1e9 {
                                min_x = min_x.min(x);
                                max_x = max_x.max(x);
                                min_y = min_y.min(y);
                                max_y = max_y.max(y);
                            }
                        }
                    }
                    EntityType::Circle(c) => {
                        let x = c.center.x;
                        let y = c.center.y;
                        let r = c.radius;
                        if x.is_finite() && y.is_finite() && r.is_finite() && r > 0.0 {
                            min_x = min_x.min(x - r);
                            max_x = max_x.max(x + r);
                            min_y = min_y.min(y - r);
                            max_y = max_y.max(y + r);
                        }
                    }
                    EntityType::Insert(ins) => {
                        inserts += 1;
                        *insert_names.entry(ins.block_name.clone()).or_insert(0) += 1;
                    }
                    EntityType::Hatch(h) => {
                        for p in &h.paths {
                            hatch_boundary_sizes.push(p.edges.len());
                        }
                    }
                    EntityType::Spline(sp) => {
                        spline_fit_points.push(sp.fit_points.len());
                        spline_control_points.push(sp.control_points.len());
                    }
                    EntityType::LwPolyline(lw) => {
                        lwpoly_vertex_counts.push(lw.vertices.len());
                    }
                    EntityType::Text(t) => {
                        text_heights.push(t.height);
                    }
                    EntityType::MText(mt) => {
                        text_heights.push(mt.height);
                    }
                    _ => {}
                }
            }

            if min_x.is_finite() {
                max_x.is_finite();
            }
            let mut sorted_types: Vec<_> = type_counts.iter().collect();
            sorted_types.sort_by(|a, b| b.1.cmp(a.1));
            for (_t, c) in sorted_types {
                let _pct = (*c as f64 / total_entities as f64) * 100.0;
            }

            if !insert_names.is_empty() {
                let mut sorted_ins: Vec<_> = insert_names.iter().collect();
                sorted_ins.sort_by(|a, b| b.1.cmp(a.1));
                for (_name, _count) in sorted_ins.iter().take(10) {}
            }

            if !hatch_boundary_sizes.is_empty() {
                let _max_b = hatch_boundary_sizes.iter().max().unwrap();
                let _avg_b = hatch_boundary_sizes.iter().sum::<usize>() as f64
                    / hatch_boundary_sizes.len() as f64;
                let _total_edges: usize = hatch_boundary_sizes.iter().sum();
            }

            if !spline_fit_points.is_empty() {
                let _max_fp = spline_fit_points.iter().max().unwrap();
                let _max_cp = spline_control_points.iter().max().unwrap();
            }

            if !lwpoly_vertex_counts.is_empty() {
                let _max_v = lwpoly_vertex_counts.iter().max().unwrap();
                let _avg_v = lwpoly_vertex_counts.iter().sum::<usize>() as f64
                    / lwpoly_vertex_counts.len() as f64;
                let _huge: Vec<_> = lwpoly_vertex_counts.iter().filter(|&&v| v > 1000).collect();
                let _total_verts: usize = lwpoly_vertex_counts.iter().sum();
            }

            if !text_heights.is_empty() {
                let _min_h = text_heights.iter().cloned().fold(f64::INFINITY, f64::min);
                let _max_h = text_heights
                    .iter()
                    .cloned()
                    .fold(f64::NEG_INFINITY, f64::max);
                let _avg_h = text_heights.iter().sum::<f64>() / text_heights.len() as f64;
                let _tiny = text_heights.iter().filter(|&&h| h < 0.1).count();
                let _huge = text_heights.iter().filter(|&&h| h > 1000.0).count();
            }
            let mut sorted_layers: Vec<_> = layer_counts.iter().collect();
            sorted_layers.sort_by(|a, b| b.1.cmp(a.1));
            for (_name, _count) in sorted_layers.iter().take(10) {}
        }
        Err(_e) => {}
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        std::process::exit(1);
    }

    let input = &args[1];
    let path = std::path::Path::new(input);

    let mut dwg_files: Vec<std::path::PathBuf> = Vec::new();

    if path.is_dir() {
        for entry in std::fs::read_dir(path).unwrap() {
            let entry = entry.unwrap();
            let ext = entry
                .path()
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if ext == "dwg" || ext == "dxf" {
                dwg_files.push(entry.path());
            }
        }
    }

    dwg_files.sort_by_key(|p| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0));

    for file in &dwg_files {
        analyze_dwg(file);
    }
}
