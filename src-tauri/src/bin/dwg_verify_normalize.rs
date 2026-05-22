use acadrust::{DwgReader, EntityType};
use std::collections::HashMap;

struct CoordCluster {
    min: f64,
    max: f64,
    count: usize,
}

fn find_all_clusters(sorted_vals: &[f64], max_gap_buckets: usize) -> Vec<CoordCluster> {
    if sorted_vals.len() <= 1 {
        return vec![CoordCluster {
            min: sorted_vals[0],
            max: sorted_vals[0],
            count: sorted_vals.len(),
        }];
    }
    let n = sorted_vals.len();
    let global_min = sorted_vals[0];
    let global_max = sorted_vals[n - 1];
    let global_range = global_max - global_min;
    if global_range < 1e-6 {
        return vec![CoordCluster {
            min: global_min,
            max: global_max,
            count: n,
        }];
    }
    let num_buckets = (n / 5).clamp(50, 200);
    let bucket_width = global_range / num_buckets as f64;
    let mut bucket_counts: Vec<usize> = vec![0; num_buckets];
    for &v in sorted_vals {
        let idx = ((v - global_min) / bucket_width) as usize;
        let idx = idx.min(num_buckets - 1);
        bucket_counts[idx] += 1;
    }
    let mut clusters: Vec<CoordCluster> = Vec::new();
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
                        let end = i - empty_run;
                        let c_min = global_min + start as f64 * bucket_width;
                        let c_max = global_min + (end + 1) as f64 * bucket_width;
                        let precise_min = sorted_vals
                            .iter()
                            .cloned()
                            .find(|&v| v >= c_min)
                            .unwrap_or(global_min);
                        let precise_max = sorted_vals
                            .iter()
                            .rev()
                            .cloned()
                            .find(|&v| v <= c_max)
                            .unwrap_or(global_max);
                        clusters.push(CoordCluster {
                            min: precise_min,
                            max: precise_max,
                            count: seg_count,
                        });
                    }
                    seg_start = None;
                    seg_count = 0;
                }
            }
        }
    }
    if let Some(start) = seg_start {
        if seg_count > 0 {
            let c_min = global_min + start as f64 * bucket_width;
            let precise_min = sorted_vals
                .iter()
                .cloned()
                .find(|&v| v >= c_min)
                .unwrap_or(global_min);
            clusters.push(CoordCluster {
                min: precise_min,
                max: global_max,
                count: seg_count,
            });
        }
    }
    if clusters.is_empty() {
        clusters.push(CoordCluster {
            min: global_min,
            max: global_max,
            count: n,
        });
    }
    clusters.sort_by(|a, b| b.count.cmp(&a.count));
    clusters
}

fn find_significant_cluster_range_v2(sorted_vals: &[f64]) -> (f64, f64) {
    if sorted_vals.is_empty() {
        return (0.0, 0.0);
    }
    let clusters = find_all_clusters(sorted_vals, 2);
    let total = sorted_vals.len();
    let significant: Vec<&CoordCluster> = clusters
        .iter()
        .filter(|c| c.count as f64 / total as f64 > 0.01)
        .collect();
    if significant.is_empty() {
        return (sorted_vals[0], sorted_vals[sorted_vals.len() - 1]);
    }
    if significant.len() <= 1 {
        let c = &significant[0];
        return (c.min, c.max);
    }
    let primary = &significant[0];
    let primary_span = primary.max - primary.min;
    let mut merged_min = primary.min;
    let mut merged_max = primary.max;
    const GAP_TO_SPAN_RATIO: f64 = 10.0;
    for i in 1..significant.len() {
        let c = &significant[i];
        let gap = if c.min > merged_max {
            c.min - merged_max
        } else if c.max < merged_min {
            merged_min - c.max
        } else {
            0.0
        };
        let candidate_span = c.max - c.min;
        let larger_span = primary_span.max(candidate_span);
        if gap > 0.0 && larger_span > 0.0 && gap / larger_span > GAP_TO_SPAN_RATIO {
            continue;
        }
        merged_min = merged_min.min(c.min);
        merged_max = merged_max.max(c.max);
    }
    (merged_min, merged_max)
}

fn median(sorted: &[f64]) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 0 {
        (sorted[mid - 1] + sorted[mid]) / 2.0
    } else {
        sorted[mid]
    }
}

fn analyze(path: &str, name: &str) {
    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(_) => {
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

    let mut xs: Vec<f64> = Vec::new();
    let mut ys: Vec<f64> = Vec::new();
    let mut entity_count = 0;

    for entity in doc.entities() {
        entity_count += 1;
        match &entity {
            EntityType::Line(l) => {
                if l.start.x.is_finite() {
                    xs.push(l.start.x);
                    ys.push(l.start.y);
                }
                if l.end.x.is_finite() {
                    xs.push(l.end.x);
                    ys.push(l.end.y);
                }
            }
            EntityType::Circle(c) => {
                if c.center.x.is_finite() {
                    xs.push(c.center.x);
                    ys.push(c.center.y);
                }
            }
            EntityType::Insert(ins) => {
                if ins.insert_point.x.is_finite() {
                    xs.push(ins.insert_point.x);
                    ys.push(ins.insert_point.y);
                }
            }
            EntityType::LwPolyline(lw) => {
                for v in lw.vertices.iter().take(5) {
                    if v.location.x.is_finite() {
                        xs.push(v.location.x);
                        ys.push(v.location.y);
                    }
                }
            }
            EntityType::MText(mt) => {
                if mt.insertion_point.x.is_finite() {
                    xs.push(mt.insertion_point.x);
                    ys.push(mt.insertion_point.y);
                }
            }
            EntityType::Text(t) => {
                if t.insertion_point.x.is_finite() {
                    xs.push(t.insertion_point.x);
                    ys.push(t.insertion_point.y);
                }
            }
            _ => {}
        }
        if xs.len() >= 10000 {
            break;
        }
    }

    xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    ys.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let (xmin, xmax) = find_significant_cluster_range_v2(&xs);
    let (ymin, ymax) = find_significant_cluster_range_v2(&ys);
    let span_x = xmax - xmin;
    let span_y = ymax - ymin;

    // 计算偏移
    let filtered_xs: Vec<f64> = xs
        .iter()
        .cloned()
        .filter(|&x| {
            x >= xmin - (span_x * 0.05).max(200.0) && x <= xmax + (span_x * 0.05).max(200.0)
        })
        .collect();
    let filtered_ys: Vec<f64> = ys
        .iter()
        .cloned()
        .filter(|&y| {
            y >= ymin - (span_y * 0.05).max(200.0) && y <= ymax + (span_y * 0.05).max(200.0)
        })
        .collect();
    let ox = median(&filtered_xs);
    let oy = median(&filtered_ys);
}

fn main() {
    let dir =
        "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510";
    let files = [
        ("西沟煤矿降尘系统布置图通风科修改2004.dwg", true),
        ("沙吉海煤业2023年3月份最新修改通防图纸.dwg", true),
        ("井下避灾线路图（202505).dwg", false),
        ("雨田煤业井下降尘喷雾布置图22.7.1.dwg", false),
        ("通风系统图(1).dwg", true),
        ("5.防尘系统图(1).dwg", true),
        ("采掘（通风系统图）5.14.dwg", true),
        ("防尘系统图-音西.dwg", true),
    ];
    for (name, _) in &files {
        let path = format!("{}/{}", dir, name);
        analyze(&path, name);
    }
}
