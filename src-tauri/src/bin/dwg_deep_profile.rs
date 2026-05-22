use acadrust::{DwgReader, EntityType};
use std::collections::HashMap;

const DIR: &str =
    "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510";

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

fn collect_coord(entity: &EntityType, xs: &mut Vec<f64>, ys: &mut Vec<f64>) {
    match entity {
        EntityType::Line(l) => {
            for &(x, y) in &[(l.start.x, l.start.y), (l.end.x, l.end.y)] {
                if x.is_finite() && y.is_finite() && x.abs() < 1e9 && y.abs() < 1e9 {
                    xs.push(x);
                    ys.push(y);
                }
            }
        }
        EntityType::Circle(c) => {
            let x = c.center.x;
            let y = c.center.y;
            if x.is_finite() && y.is_finite() && x.abs() < 1e9 && y.abs() < 1e9 {
                xs.push(x);
                ys.push(y);
            }
        }
        EntityType::Arc(a) => {
            let x = a.center.x;
            let y = a.center.y;
            if x.is_finite() && y.is_finite() && x.abs() < 1e9 && y.abs() < 1e9 {
                xs.push(x);
                ys.push(y);
            }
        }
        EntityType::LwPolyline(lw) => {
            for v in &lw.vertices {
                let vx = v.location.x;
                let vy = v.location.y;
                if vx.is_finite() && vy.is_finite() && vx.abs() < 1e9 && vy.abs() < 1e9 {
                    xs.push(vx);
                    ys.push(vy);
                }
            }
        }
        EntityType::Text(t) => {
            let x = t.insertion_point.x;
            let y = t.insertion_point.y;
            if x.is_finite() && y.is_finite() && x.abs() < 1e9 && y.abs() < 1e9 {
                xs.push(x);
                ys.push(y);
            }
        }
        EntityType::MText(mt) => {
            let x = mt.insertion_point.x;
            let y = mt.insertion_point.y;
            if x.is_finite() && y.is_finite() && x.abs() < 1e9 && y.abs() < 1e9 {
                xs.push(x);
                ys.push(y);
            }
        }
        EntityType::Insert(ins) => {
            let x = ins.insert_point.x;
            let y = ins.insert_point.y;
            if x.is_finite() && y.is_finite() && x.abs() < 1e9 && y.abs() < 1e9 {
                xs.push(x);
                ys.push(y);
            }
        }
        _ => {}
    }
}

fn find_clusters(
    sorted: &[f64],
    num_buckets: usize,
    max_gap_buckets: usize,
) -> Vec<(f64, f64, usize)> {
    if sorted.is_empty() {
        return vec![];
    }
    let n = sorted.len();
    let global_min = sorted[0];
    let global_max = sorted[n - 1];
    let global_range = global_max - global_min;
    if global_range < 1e-6 {
        return vec![(global_min, global_max, n)];
    }

    let bucket_width = global_range / num_buckets as f64;
    let mut bucket_counts: Vec<usize> = vec![0; num_buckets];
    for &v in sorted {
        let idx = ((v - global_min) / bucket_width) as usize;
        let idx = idx.min(num_buckets - 1);
        bucket_counts[idx] += 1;
    }

    let mut clusters: Vec<(usize, usize, usize)> = Vec::new();
    let mut seg_start: Option<usize> = None;
    let mut seg_count = 0usize;
    let mut empty_run = 0usize;

    for i in 0..num_buckets {
        if bucket_counts[i] > 0 {
            if seg_start.is_none() {
                seg_start = Some(i);
            }
            seg_count += bucket_counts[i];
            empty_run = 0;
        } else {
            empty_run += 1;
            if empty_run > max_gap_buckets {
                if let Some(start) = seg_start {
                    if seg_count > 0 {
                        clusters.push((start, i - empty_run, seg_count));
                    }
                    seg_start = None;
                    seg_count = 0;
                }
            }
        }
    }
    if let Some(start) = seg_start {
        if seg_count > 0 {
            clusters.push((start, num_buckets - 1, seg_count));
        }
    }

    let mut result: Vec<(f64, f64, usize)> = clusters
        .into_iter()
        .map(|(s, e, c)| {
            let min_v = global_min + s as f64 * bucket_width;
            let max_v = global_min + (e + 1) as f64 * bucket_width;
            let precise_min = sorted
                .iter()
                .cloned()
                .find(|&v| v >= min_v)
                .unwrap_or(global_min);
            let precise_max = sorted
                .iter()
                .cloned()
                .rev()
                .find(|&v| v <= max_v)
                .unwrap_or(global_max);
            (precise_min, precise_max, c)
        })
        .collect();

    result.sort_by(|a, b| b.2.cmp(&a.2));
    result
}

fn median_sorted(sorted: &[f64]) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let n = sorted.len();
    if n % 2 == 0 {
        (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0
    } else {
        sorted[n / 2]
    }
}

fn analyze_file(path: &std::path::Path) {
    let file_name = path.file_name().unwrap().to_string_lossy();
    let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(e) => {
            return;
        }
    };

    let result = DwgReader::from_stream(std::io::Cursor::new(data)).read();
    let doc = match result {
        Ok(d) => d,
        Err(e) => {
            return;
        }
    };

    let mut entity_count = 0usize;
    let mut lwpoly_huge = 0usize;
    let mut lwpoly_max_verts = 0usize;
    let mut hatch_count = 0usize;
    let mut hatch_max_edges = 0usize;
    let mut text_extreme = 0usize;
    let mut text_tiny = 0usize;
    let mut insert_count = 0usize;
    let mut insert_neg_scale = 0usize;
    let mut insert_names: HashMap<String, usize> = HashMap::new();
    let mut insert_neg_names: HashMap<String, usize> = HashMap::new();
    let mut all_xs: Vec<f64> = Vec::new();
    let mut all_ys: Vec<f64> = Vec::new();
    let mut text_heights: Vec<f64> = Vec::new();
    let mut min_x = f64::MAX;
    let mut max_x = f64::MIN;
    let mut min_y = f64::MAX;
    let mut max_y = f64::MIN;

    for entity in doc.entities() {
        entity_count += 1;
        let common = entity.common();
        if common.invisible {
            continue;
        }

        collect_coord(&entity, &mut all_xs, &mut all_ys);

        match &entity {
            EntityType::LwPolyline(lw) => {
                let n = lw.vertices.len();
                lwpoly_max_verts = lwpoly_max_verts.max(n);
                if n > 1000 {
                    lwpoly_huge += 1;
                }
            }
            EntityType::Hatch(h) => {
                hatch_count += 1;
                for p in &h.paths {
                    hatch_max_edges = hatch_max_edges.max(p.edges.len());
                }
            }
            EntityType::Text(t) => {
                text_heights.push(t.height);
                if t.height > 1000.0 || t.height < 0.01 {
                    text_extreme += 1;
                }
                if t.height < 0.5 {
                    text_tiny += 1;
                }
            }
            EntityType::MText(mt) => {
                text_heights.push(mt.height);
                if mt.height > 1000.0 || mt.height < 0.01 {
                    text_extreme += 1;
                }
                if mt.height < 0.5 {
                    text_tiny += 1;
                }
            }
            EntityType::Insert(ins) => {
                insert_count += 1;
                *insert_names.entry(ins.block_name.clone()).or_insert(0) += 1;
                let sx = ins.x_scale();
                let sy = ins.y_scale();
                if sx < 0.0 || sy < 0.0 {
                    insert_neg_scale += 1;
                    *insert_neg_names.entry(ins.block_name.clone()).or_insert(0) += 1;
                }
            }
            _ => {}
        }
    }

    if !all_xs.is_empty() {
        let gx_min = all_xs.iter().cloned().fold(f64::INFINITY, f64::min);
        let gx_max = all_xs.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let gy_min = all_ys.iter().cloned().fold(f64::INFINITY, f64::min);
        let gy_max = all_ys.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        min_x = gx_min;
        max_x = gx_max;
        min_y = gy_min;
        max_y = gy_max;
    }

    let coord_span_x = if max_x.is_finite() && min_x.is_finite() {
        max_x - min_x
    } else {
        0.0
    };
    let coord_span_y = if max_y.is_finite() && min_y.is_finite() {
        max_y - min_y
    } else {
        0.0
    };
    let has_large_coords = coord_span_x > 1_000_000.0 || coord_span_y > 1_000_000.0;
    let has_heavy_lwpoly = lwpoly_huge > 0;
    let has_heavy_hatch = hatch_count > 2000 || hatch_max_edges > 100;
    let has_extreme_text = text_extreme > 0;
    let has_heavy_entity = entity_count >= 30000 || file_size > 20_000_000;

    let mut problem_count = 0usize;
    if has_large_coords {
        problem_count += 1;
    }
    if has_heavy_lwpoly {
        problem_count += 1;
    }
    if has_heavy_hatch {
        problem_count += 1;
    }
    if has_extreme_text {
        problem_count += 1;
    }

    let current_profile = if entity_count == 0 {
        "Unparseable(空文件)".to_string()
    } else if problem_count == 0 && !has_heavy_entity {
        "Simple".to_string()
    } else if problem_count == 0 && has_heavy_entity {
        "HeavyEntity".to_string()
    } else if problem_count == 1 {
        if has_large_coords {
            "LargeCoordinates".to_string()
        } else if has_heavy_lwpoly {
            "HeavyLwPolyline".to_string()
        } else if has_heavy_hatch {
            "HeavyHatch".to_string()
        } else {
            "Complex(ExtText)".to_string()
        }
    } else if problem_count >= 2 {
        format!(
            "Complex(flags={:04b})",
            (if has_large_coords { 1 } else { 0 })
                | (if has_heavy_lwpoly { 2 } else { 0 })
                | (if has_heavy_hatch { 4 } else { 0 })
                | (if has_extreme_text { 8 } else { 0 })
        )
    } else {
        "Simple(fallback)".to_string()
    };
    let has_large_coords_new = coord_span_x > 1_000_000.0 || coord_span_y > 1_000_000.0;
    let _has_distributed_coords = false;
    let has_medium_entity = entity_count >= 5000;
    let has_heavy_entity_new = entity_count >= 30000 || file_size > 20_000_000;

    let all_xs_sorted = {
        let mut v = all_xs.clone();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        v
    };
    let all_ys_sorted = {
        let mut v = all_ys.clone();
        v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        v
    };

    let x_clusters = find_clusters(&all_xs_sorted, 100, 2);
    let y_clusters = find_clusters(&all_ys_sorted, 100, 2);

    let has_multi_cluster_x = x_clusters.len() > 1;
    let has_multi_cluster_y = y_clusters.len() > 1;
    let has_distributed_coords_new = has_multi_cluster_x || has_multi_cluster_y;

    let new_problem_count = (if has_large_coords_new { 1 } else { 0 })
        + (if has_heavy_lwpoly { 1 } else { 0 })
        + (if has_heavy_hatch { 1 } else { 0 })
        + (if has_extreme_text { 1 } else { 0 })
        + (if has_distributed_coords_new { 1 } else { 0 });

    let new_profile = if entity_count == 0 {
        "Unparseable".to_string()
    } else if new_problem_count == 0 && !has_medium_entity && !has_heavy_entity_new {
        "Simple".to_string()
    } else if new_problem_count == 0 && has_medium_entity && !has_heavy_entity_new {
        "MediumEntity".to_string()
    } else if new_problem_count == 0 && has_heavy_entity_new {
        "HeavyEntity".to_string()
    } else if new_problem_count >= 1 {
        let mut flags = String::new();
        if has_large_coords_new {
            flags.push_str("LC ");
        }
        if has_heavy_lwpoly {
            flags.push_str("LP ");
        }
        if has_heavy_hatch {
            flags.push_str("HH ");
        }
        if has_extreme_text {
            flags.push_str("ET ");
        }
        if has_distributed_coords_new {
            flags.push_str("DC ");
        }
        if has_medium_entity {
            flags.push_str("ME ");
        }
        format!("Complex[{}]", flags.trim())
    } else {
        "Simple".to_string()
    };
    if !x_clusters.is_empty() {
        for (i, (cmin, cmax, count)) in x_clusters.iter().enumerate() {
            let span = cmax - cmin;
            let pct = *count as f64 / all_xs.len() as f64 * 100.0;
        }
        if x_clusters.len() >= 2 {
            let gap = x_clusters[0].0 - x_clusters[1].0;
            let gap_abs = gap.abs();
            let max_span =
                (x_clusters[0].1 - x_clusters[0].0).max(x_clusters[1].1 - x_clusters[1].0);
            let gap_ratio = if max_span > 0.0 {
                gap_abs / max_span
            } else {
                0.0
            };
        }
    }
    if !y_clusters.is_empty() {
        for (i, (cmin, cmax, count)) in y_clusters.iter().enumerate() {
            let span = cmax - cmin;
            let pct = *count as f64 / all_ys.len() as f64 * 100.0;
        }
        if y_clusters.len() >= 2 {
            let gap = y_clusters[0].0 - y_clusters[1].0;
            let gap_abs = gap.abs();
            let max_span =
                (y_clusters[0].1 - y_clusters[0].0).max(y_clusters[1].1 - y_clusters[1].0);
            let gap_ratio = if max_span > 0.0 {
                gap_abs / max_span
            } else {
                0.0
            };
        }
    }
    if !all_xs_sorted.is_empty() && !all_ys_sorted.is_empty() {
        let (main_x_min, main_x_max, _) = if !x_clusters.is_empty() {
            (x_clusters[0].0, x_clusters[0].1, x_clusters[0].2)
        } else {
            (
                all_xs_sorted[0],
                all_xs_sorted[all_xs_sorted.len() - 1],
                all_xs_sorted.len(),
            )
        };
        let (main_y_min, main_y_max, _) = if !y_clusters.is_empty() {
            (y_clusters[0].0, y_clusters[0].1, y_clusters[0].2)
        } else {
            (
                all_ys_sorted[0],
                all_ys_sorted[all_ys_sorted.len() - 1],
                all_ys_sorted.len(),
            )
        };

        let margin_x = (main_x_max - main_x_min).max(200.0);
        let margin_y = (main_y_max - main_y_min).max(200.0);
        let reject_min_x = main_x_min - margin_x;
        let reject_max_x = main_x_max + margin_x;
        let reject_min_y = main_y_min - margin_y;
        let reject_max_y = main_y_max + margin_y;

        let mut outlier_count = 0usize;
        let mut retained_xs: Vec<f64> = Vec::new();
        let mut retained_ys: Vec<f64> = Vec::new();

        for i in 0..all_xs.len() {
            let x = all_xs[i];
            let y = all_ys[i];
            if x >= reject_min_x && x <= reject_max_x && y >= reject_min_y && y <= reject_max_y {
                retained_xs.push(x);
                retained_ys.push(y);
            } else {
                outlier_count += 1;
            }
        }

        let retained_pct = if !all_xs.is_empty() {
            retained_xs.len() as f64 / all_xs.len() as f64 * 100.0
        } else {
            0.0
        };

        retained_xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        retained_ys.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let offset_x = median_sorted(&retained_xs);
        let offset_y = median_sorted(&retained_ys);

        if x_clusters.len() >= 2 || y_clusters.len() >= 2 {
            if y_clusters.len() >= 2 {
                let c1_pct = y_clusters[0].2 as f64 / all_ys.len() as f64 * 100.0;
                let c2_pct = y_clusters[1].2 as f64 / all_ys.len() as f64 * 100.0;
                if (main_y_min..=main_y_max).contains(&y_clusters[1].0)
                    || y_clusters[1].0 >= reject_min_y && y_clusters[1].1 <= reject_max_y
                {
                } else {
                }
            }
        }
    }
    if !insert_neg_names.is_empty() {
        let mut sorted: Vec<_> = insert_neg_names.iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(a.1));
        for (name, count) in sorted.iter().take(5) {}
    }
    if !text_heights.is_empty() {
        let min_h = text_heights.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_h = text_heights
            .iter()
            .cloned()
            .fold(f64::NEG_INFINITY, f64::max);
        let avg_h = text_heights.iter().sum::<f64>() / text_heights.len() as f64;
        let tiny_count = text_heights.iter().filter(|&&h| h < 0.5).count();
        let tiny_pct = tiny_count as f64 / text_heights.len() as f64 * 100.0;
        if tiny_pct > 10.0 {}
    }
    let mut risks: Vec<String> = Vec::new();
    if entity_count >= 10000 && entity_count < 30000 {
        risks.push(format!(
            "中等实体数({})→当前Simple,建议MediumEntity",
            entity_count
        ));
    }
    if entity_count >= 30000 {
        risks.push(format!("大量实体({})→当前HeavyEntity", entity_count));
    }
    if coord_span_x > 1_000_000.0 || coord_span_y > 1_000_000.0 {
        risks.push(format!("大坐标跨度(X={},Y={})", coord_span_x, coord_span_y));
    }
    if x_clusters.len() > 1 || y_clusters.len() > 1 {
        risks.push(format!(
            "多集群分布(X={},Y={})",
            x_clusters.len(),
            y_clusters.len()
        ));
    }
    if lwpoly_huge > 0 {
        risks.push(format!(
            "超大多段线({}条>1000顶点, 最大{}顶点)",
            lwpoly_huge, lwpoly_max_verts
        ));
    }
    if hatch_count > 2000 || hatch_max_edges > 100 {
        risks.push(format!(
            "复杂填充(count={}, max_edges={})",
            hatch_count, hatch_max_edges
        ));
    }
    if insert_neg_scale > 0 {
        risks.push(format!("负缩放块({}个)", insert_neg_scale));
    }
    if text_tiny > 50 {
        risks.push(format!("大量小文字({}个<0.5)", text_tiny));
    }
    if text_extreme > 0 {
        risks.push(format!("异常文字高度({}个)", text_extreme));
    }
    if coord_span_x > 1e8 || coord_span_y > 1e8 {
        risks.push("坐标极端异常(>1亿), 可能是解析错误".to_string());
    }
    if !all_xs.is_empty() {
        let outlier_ratio = {
            let (main_x_min, main_x_max, _) =
                x_clusters
                    .first()
                    .copied()
                    .unwrap_or((min_x, max_x, all_xs.len()));
            let (main_y_min, main_y_max, _) =
                y_clusters
                    .first()
                    .copied()
                    .unwrap_or((min_y, max_y, all_ys.len()));
            let mx = (main_x_max - main_x_min).max(200.0);
            let my = (main_y_max - main_y_min).max(200.0);
            let out_count = all_xs
                .iter()
                .zip(all_ys.iter())
                .filter(|(&x, &y)| {
                    x < main_x_min - mx
                        || x > main_x_max + mx
                        || y < main_y_min - my
                        || y > main_y_max + my
                })
                .count();
            out_count as f64 / all_xs.len() as f64 * 100.0
        };
        if outlier_ratio > 5.0 {
            risks.push(format!("离群点比例高({:.1}%)", outlier_ratio));
        }
    }

    if risks.is_empty() {
    } else {
        for (i, risk) in risks.iter().enumerate() {}
    }
}

fn main() {
    let path = std::path::Path::new(DIR);
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
            if ext == "dwg" {
                dwg_files.push(entry.path());
            }
        }
    }

    dwg_files.sort_by_key(|p| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0));

    for file in &dwg_files {
        analyze_file(file);
    }
}
