use acadrust::{DwgReader, EntityType};
use std::collections::HashMap;

const FILE: &str = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/沙吉海煤业2023年3月份最新修改通防图纸.dwg";

fn main() {
    let data = std::fs::read(FILE).unwrap();
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    let mut type_counts: HashMap<&'static str, usize> = HashMap::new();
    let mut all_x: Vec<f64> = Vec::new();
    let mut all_y: Vec<f64> = Vec::new();
    let mut text_heights: Vec<f64> = Vec::new();
    let mut lwpoly_max_verts: usize = 0;
    let mut lwpoly_huge: usize = 0;
    let mut hatch_count: usize = 0;
    let mut hatch_max_edges: usize = 0;
    let mut insert_count: usize = 0;
    let mut layer_counts: HashMap<String, usize> = HashMap::new();
    let mut entity_count = 0usize;

    // Cluster 1 and Cluster 2 entity breakdown
    let mut cluster1_types: HashMap<&'static str, usize> = HashMap::new();
    let mut cluster2_types: HashMap<&'static str, usize> = HashMap::new();
    let mut cluster1_layers: HashMap<String, usize> = HashMap::new();
    let mut cluster2_layers: HashMap<String, usize> = HashMap::new();

    for entity in doc.entities() {
        entity_count += 1;
        let common = entity.common();
        if common.invisible { continue; }

        let type_name = match &entity {
            EntityType::Line(_) => "Line",
            EntityType::Circle(_) => "Circle",
            EntityType::Arc(_) => "Arc",
            EntityType::LwPolyline(_) => "LwPolyline",
            EntityType::MText(_) => "MText",
            EntityType::Text(_) => "Text",
            EntityType::Solid(_) => "Solid",
            EntityType::Hatch(_) => "Hatch",
            EntityType::Spline(_) => "Spline",
            EntityType::Insert(_) => "Insert",
            EntityType::Point(_) => "Point",
            EntityType::Dimension(_) => "Dimension",
            EntityType::Ellipse(_) => "Ellipse",
            _ => "Other",
        };
        *type_counts.entry(type_name).or_insert(0) += 1;
        *layer_counts.entry(common.layer.clone()).or_insert(0) += 1;

        let mut cx = f64::NAN;
        let mut cy = f64::NAN;

        match &entity {
            EntityType::Line(l) => {
                cx = (l.start.x + l.end.x) / 2.0;
                cy = (l.start.y + l.end.y) / 2.0;
                if l.start.x.is_finite() { all_x.push(l.start.x); all_y.push(l.start.y); }
                if l.end.x.is_finite() { all_x.push(l.end.x); all_y.push(l.end.y); }
            }
            EntityType::Circle(c) => {
                cx = c.center.x; cy = c.center.y;
                if c.center.x.is_finite() { all_x.push(c.center.x); all_y.push(c.center.y); }
            }
            EntityType::Arc(a) => {
                cx = a.center.x; cy = a.center.y;
                if a.center.x.is_finite() { all_x.push(a.center.x); all_y.push(a.center.y); }
            }
            EntityType::LwPolyline(lw) => {
                let n = lw.vertices.len();
                lwpoly_max_verts = lwpoly_max_verts.max(n);
                if n > 1000 { lwpoly_huge += 1; }
                for v in lw.vertices.iter().take(5) {
                    if v.location.x.is_finite() {
                        all_x.push(v.location.x); all_y.push(v.location.y);
                    }
                }
                if !lw.vertices.is_empty() {
                    cx = lw.vertices[0].location.x;
                    cy = lw.vertices[0].location.y;
                }
            }
            EntityType::MText(mt) => {
                cx = mt.insertion_point.x; cy = mt.insertion_point.y;
                text_heights.push(mt.height);
                if mt.insertion_point.x.is_finite() { all_x.push(mt.insertion_point.x); all_y.push(mt.insertion_point.y); }
            }
            EntityType::Text(t) => {
                cx = t.insertion_point.x; cy = t.insertion_point.y;
                text_heights.push(t.height);
                if t.insertion_point.x.is_finite() { all_x.push(t.insertion_point.x); all_y.push(t.insertion_point.y); }
            }
            EntityType::Solid(_) => {}
            EntityType::Hatch(h) => {
                hatch_count += 1;
                for p in &h.paths {
                    hatch_max_edges = hatch_max_edges.max(p.edges.len());
                }
            }
            EntityType::Insert(ins) => {
                insert_count += 1;
                cx = ins.insert_point.x; cy = ins.insert_point.y;
                if ins.insert_point.x.is_finite() { all_x.push(ins.insert_point.x); all_y.push(ins.insert_point.y); }
            }
            EntityType::Point(pt) => {
                cx = pt.location.x; cy = pt.location.y;
                if pt.location.x.is_finite() { all_x.push(pt.location.x); all_y.push(pt.location.y); }
            }
            EntityType::Spline(sp) => {
                if !sp.control_points.is_empty() {
                    cx = sp.control_points[0].x;
                    cy = sp.control_points[0].y;
                }
                for p in &sp.control_points {
                    if p.x.is_finite() { all_x.push(p.x); all_y.push(p.y); }
                }
            }
            _ => {}
        }

        if cx.is_finite() && cy.is_finite() {
            // Cluster 1: small coords
            if cx > -500000.0 && cx < 500000.0 && cy > -500000.0 && cy < 500000.0 {
                *cluster1_types.entry(type_name).or_insert(0) += 1;
                *cluster1_layers.entry(common.layer.clone()).or_insert(0) += 1;
            }
            // Cluster 2: large negative X, large positive Y
            else if cx < -2000000.0 || cy > 5000000.0 {
                *cluster2_types.entry(type_name).or_insert(0) += 1;
                *cluster2_layers.entry(common.layer.clone()).or_insert(0) += 1;
            }
        }
    }
    let mut sorted: Vec<_> = type_counts.iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(a.1));
    for (t, c) in &sorted {
    }
    all_x.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    all_y.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    if !all_x.is_empty() && !all_y.is_empty() {
    }
    let c1_total: usize = cluster1_types.values().sum();
    let mut c1_sorted: Vec<_> = cluster1_types.iter().collect();
    c1_sorted.sort_by(|a, b| b.1.cmp(a.1));
    for (t, c) in c1_sorted.iter().take(8) {
    }
    let mut c1l: Vec<_> = cluster1_layers.iter().collect();
    c1l.sort_by(|a, b| b.1.cmp(a.1));
    for (l, c) in c1l.iter().take(5) {
    }
    let c2_total: usize = cluster2_types.values().sum();
    let mut c2_sorted: Vec<_> = cluster2_types.iter().collect();
    c2_sorted.sort_by(|a, b| b.1.cmp(a.1));
    for (t, c) in c2_sorted.iter().take(8) {
    }
    let mut c2l: Vec<_> = cluster2_layers.iter().collect();
    c2l.sort_by(|a, b| b.1.cmp(a.1));
    for (l, c) in c2l.iter().take(5) {
    }
    if !text_heights.is_empty() {
        let min_h = text_heights.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_h = text_heights.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let avg_h = text_heights.iter().sum::<f64>() / text_heights.len() as f64;
        let tiny = text_heights.iter().filter(|&&h| h < 0.5).count();
    }
    
    // 模拟 find_significant_cluster_range
    let clusters_x = find_clusters(&all_x, 100, 2);
    let clusters_y = find_clusters(&all_y, 100, 2);
    for (i, c) in clusters_x.iter().enumerate() {
        let pct = c.2 as f64 / all_x.len() as f64 * 100.0;
        if pct > 0.5 {
        }
    }
    for (i, c) in clusters_y.iter().enumerate() {
        let pct = c.2 as f64 / all_y.len() as f64 * 100.0;
        if pct > 0.5 {
        }
    }

    // 模拟新归一化
    let sig_x: Vec<_> = clusters_x.iter().filter(|c| c.2 as f64 / all_x.len() as f64 > 0.01).collect();
    let sig_y: Vec<_> = clusters_y.iter().filter(|c| c.2 as f64 / all_y.len() as f64 > 0.01).collect();
    
    if !sig_x.is_empty() && !sig_y.is_empty() {
        let final_min_x = sig_x.iter().map(|c| c.0).fold(f64::INFINITY, f64::min);
        let final_max_x = sig_x.iter().map(|c| c.1).fold(f64::NEG_INFINITY, f64::max);
        let final_min_y = sig_y.iter().map(|c| c.0).fold(f64::INFINITY, f64::min);
        let final_max_y = sig_y.iter().map(|c| c.1).fold(f64::NEG_INFINITY, f64::max);
        
        let span_x = final_max_x - final_min_x;
        let span_y = final_max_y - final_min_y;
        let margin_x = (span_x * 0.05).max(200.0);
        let margin_y = (span_y * 0.05).max(200.0);
        
        // 计算偏移后范围
        let offset_x = median(&all_x);
        let offset_y = median(&all_y);
        
        // 前端视口适配问题
        let normalized_span_x = final_max_x - offset_x - (final_min_x - offset_x);
        let normalized_span_y = final_max_y - offset_y - (final_min_y - offset_y);
        
        // 两个集群之间的距离
        if sig_x.len() >= 2 {
            let mut sig_x_sorted = sig_x.clone();
            sig_x_sorted.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
            let gap_x = (sig_x_sorted[1].0 - sig_x_sorted[0].1).abs();
        }
        if sig_y.len() >= 2 {
            let mut sig_y_sorted = sig_y.clone();
            sig_y_sorted.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
            let gap_y = (sig_y_sorted[1].0 - sig_y_sorted[0].1).abs();
        }
    }
}

fn find_clusters(sorted: &[f64], num_buckets: usize, max_gap: usize) -> Vec<(f64, f64, usize)> {
    if sorted.is_empty() { return vec![]; }
    let n = sorted.len();
    let gmin = sorted[0];
    let gmax = sorted[n-1];
    let range = gmax - gmin;
    if range < 1e-6 { return vec![(gmin, gmax, n)]; }
    
    let bw = range / num_buckets as f64;
    let mut bc: Vec<usize> = vec![0; num_buckets];
    for &v in sorted {
        let idx = ((v - gmin) / bw) as usize;
        let idx = idx.min(num_buckets - 1);
        bc[idx] += 1;
    }
    
    let mut clusters: Vec<(f64, f64, usize)> = Vec::new();
    let mut seg_start: Option<usize> = None;
    let mut seg_count = 0usize;
    let mut empty = 0usize;
    
    for i in 0..num_buckets {
        if bc[i] > 0 {
            if seg_start.is_none() { seg_start = Some(i); }
            seg_count += bc[i];
            empty = 0;
        } else {
            empty += 1;
            if empty > max_gap {
                if let Some(start) = seg_start {
                    if seg_count > 0 {
                        let end = i - empty;
                        let cmin = gmin + start as f64 * bw;
                        let cmax = gmin + (end + 1) as f64 * bw;
                        let pmin = sorted.iter().cloned().find(|&v| v >= cmin).unwrap_or(gmin);
                        let pmax = sorted.iter().rev().cloned().find(|&v| v <= cmax).unwrap_or(gmax);
                        clusters.push((pmin, pmax, seg_count));
                    }
                    seg_start = None;
                    seg_count = 0;
                }
            }
        }
    }
    if let Some(start) = seg_start {
        if seg_count > 0 {
            let cmin = gmin + start as f64 * bw;
            let pmin = sorted.iter().cloned().find(|&v| v >= cmin).unwrap_or(gmin);
            clusters.push((pmin, gmax, seg_count));
        }
    }
    if clusters.is_empty() { clusters.push((gmin, gmax, n)); }
    clusters.sort_by(|a, b| b.2.cmp(&a.2));
    clusters
}

fn median(sorted: &[f64]) -> f64 {
    if sorted.is_empty() { return 0.0; }
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 0 { (sorted[mid-1] + sorted[mid]) / 2.0 } else { sorted[mid] }
}
