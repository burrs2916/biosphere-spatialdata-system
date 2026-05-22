use acadrust::entities::{AttachmentPoint, TextHorizontalAlignment, TextVerticalAlignment};
use acadrust::DwgReader;

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

    let mut lines: Vec<(f64, f64, f64, f64, String)> = Vec::new();
    let mut texts: Vec<(f64, f64, f64, String, u8, u8, f64)> = Vec::new();
    let mut mtexts: Vec<(f64, f64, f64, String, u8, f64)> = Vec::new();

    for entity in doc.entities() {
        match entity {
            acadrust::EntityType::Line(l) => {
                let p1 = &l.start;
                let p2 = &l.end;
                lines.push((p1.x, p1.y, p2.x, p2.y, l.common.layer.clone()));
            }
            acadrust::EntityType::Text(t) => {
                let p = &t.insertion_point;
                let h_align: u8 = match t.horizontal_alignment {
                    TextHorizontalAlignment::Left => 0,
                    TextHorizontalAlignment::Center => 1,
                    TextHorizontalAlignment::Right => 2,
                    TextHorizontalAlignment::Aligned => 3,
                    TextHorizontalAlignment::Middle => 4,
                    TextHorizontalAlignment::Fit => 5,
                };
                let v_align: u8 = match t.vertical_alignment {
                    TextVerticalAlignment::Baseline => 0,
                    TextVerticalAlignment::Bottom => 1,
                    TextVerticalAlignment::Middle => 2,
                    TextVerticalAlignment::Top => 3,
                };
                texts.push((
                    p.x,
                    p.y,
                    t.height,
                    t.value.clone(),
                    h_align,
                    v_align,
                    t.rotation,
                ));
            }
            acadrust::EntityType::MText(mt) => {
                let p = &mt.insertion_point;
                let ap: u8 = match mt.attachment_point {
                    AttachmentPoint::TopLeft => 1,
                    AttachmentPoint::TopCenter => 2,
                    AttachmentPoint::TopRight => 3,
                    AttachmentPoint::MiddleLeft => 4,
                    AttachmentPoint::MiddleCenter => 5,
                    AttachmentPoint::MiddleRight => 6,
                    AttachmentPoint::BottomLeft => 7,
                    AttachmentPoint::BottomCenter => 8,
                    AttachmentPoint::BottomRight => 9,
                };
                mtexts.push((p.x, p.y, mt.height, mt.value.clone(), ap, mt.rotation));
            }
            _ => {}
        }
    }

    let all_texts_x: Vec<f64> = texts.iter().map(|t| t.0).collect();
    let all_texts_y: Vec<f64> = texts.iter().map(|t| t.1).collect();
    if !all_texts_x.is_empty() {
        let _min_tx = all_texts_x.iter().cloned().fold(f64::INFINITY, f64::min);
        let _max_tx = all_texts_x
            .iter()
            .cloned()
            .fold(f64::NEG_INFINITY, f64::max);
        let _min_ty = all_texts_y.iter().cloned().fold(f64::INFINITY, f64::min);
        let _max_ty = all_texts_y
            .iter()
            .cloned()
            .fold(f64::NEG_INFINITY, f64::max);
    }

    let all_lines_x: Vec<f64> = lines.iter().flat_map(|l| vec![l.0, l.2]).collect();
    let all_lines_y: Vec<f64> = lines.iter().flat_map(|l| vec![l.1, l.3]).collect();
    if !all_lines_x.is_empty() {
        let _min_lx = all_lines_x.iter().cloned().fold(f64::INFINITY, f64::min);
        let _max_lx = all_lines_x
            .iter()
            .cloned()
            .fold(f64::NEG_INFINITY, f64::max);
        let _min_ly = all_lines_y.iter().cloned().fold(f64::INFINITY, f64::min);
        let _max_ly = all_lines_y
            .iter()
            .cloned()
            .fold(f64::NEG_INFINITY, f64::max);
    }

    let grid_size = 50.0;
    let mut grid_line_count: std::collections::HashMap<(i32, i32), usize> =
        std::collections::HashMap::new();
    for l in &lines {
        let cx = (l.0 + l.2) / 2.0;
        let cy = (l.1 + l.3) / 2.0;
        let gx = (cx / grid_size).floor() as i32;
        let gy = (cy / grid_size).floor() as i32;
        *grid_line_count.entry((gx, gy)).or_insert(0) += 1;
    }

    let mut sorted_grids: Vec<_> = grid_line_count.iter().collect();
    sorted_grids.sort_by(|a, b| b.1.cmp(a.1));
    for (_rank, ((gx, gy), _count)) in sorted_grids.iter().take(5).enumerate() {
        let x_min = *gx as f64 * grid_size;
        let y_min = *gy as f64 * grid_size;
        let _x_max = x_min + grid_size;
        let _y_max = y_min + grid_size;
    }
    for (_i, _t) in texts.iter().enumerate() {}
    for (_i, _t) in mtexts.iter().enumerate() {}
    let vertical_lines: Vec<(f64, f64, f64)> = lines
        .iter()
        .filter(|l| (l.0 - l.2).abs() < 0.01)
        .map(|l| (l.0, l.1.min(l.3), l.1.max(l.3)))
        .collect();

    if !vertical_lines.is_empty() {
        for (_i, t) in texts.iter().enumerate() {
            let mut min_dist = f64::INFINITY;
            let mut nearest_line_x = 0.0;
            for vl in &vertical_lines {
                let dist = (t.0 - vl.0).abs();
                if dist < min_dist {
                    min_dist = dist;
                    nearest_line_x = vl.0;
                }
            }
            let _direction = if t.0 < nearest_line_x { "左" } else { "右" };
        }
        for (_i, t) in mtexts.iter().enumerate() {
            let mut min_dist = f64::INFINITY;
            let mut nearest_line_x = 0.0;
            for vl in &vertical_lines {
                let dist = (t.0 - vl.0).abs();
                if dist < min_dist {
                    min_dist = dist;
                    nearest_line_x = vl.0;
                }
            }
            let _direction = if t.0 < nearest_line_x { "左" } else { "右" };
        }
    }
    if let Some(((best_gx, best_gy), _)) = sorted_grids.first() {
        let x_min = *best_gx as f64 * grid_size;
        let y_min = *best_gy as f64 * grid_size;
        let x_max = x_min + grid_size;
        let y_max = y_min + grid_size;
        let mut v_lines_in_area: Vec<(f64, f64, f64)> = Vec::new();
        for l in &lines {
            if (l.0 - l.2).abs() < 0.01 {
                let lx = l.0;
                let ly_min = l.1.min(l.3);
                let ly_max = l.1.max(l.3);
                if lx >= x_min && lx <= x_max && ly_min >= y_min && ly_max <= y_max {
                    v_lines_in_area.push((lx, ly_min, ly_max));
                }
            }
        }
        v_lines_in_area.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        v_lines_in_area.dedup_by(|a, b| (a.0 - b.0).abs() < 0.01);
        for _vl in &v_lines_in_area {}
        let mut h_lines_in_area: Vec<(f64, f64, f64)> = Vec::new();
        for l in &lines {
            if (l.1 - l.3).abs() < 0.01 {
                let ly = l.1;
                let lx_min = l.0.min(l.2);
                let lx_max = l.0.max(l.2);
                if ly >= y_min && ly <= y_max && lx_min >= x_min && lx_max <= x_max {
                    h_lines_in_area.push((ly, lx_min, lx_max));
                }
            }
        }
        h_lines_in_area.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        h_lines_in_area.dedup_by(|a, b| (a.0 - b.0).abs() < 0.01);
        for _hl in &h_lines_in_area {}
        for (_i, t) in texts.iter().enumerate() {
            if t.0 >= x_min && t.0 <= x_max && t.1 >= y_min && t.1 <= y_max {}
        }
        for (_i, t) in mtexts.iter().enumerate() {
            if t.0 >= x_min && t.0 <= x_max && t.1 >= y_min && t.1 <= y_max {}
        }
    }
    let mut h_align_counts: std::collections::HashMap<u8, usize> = std::collections::HashMap::new();
    let mut v_align_counts: std::collections::HashMap<u8, usize> = std::collections::HashMap::new();
    for t in &texts {
        *h_align_counts.entry(t.4).or_insert(0) += 1;
        *v_align_counts.entry(t.5).or_insert(0) += 1;
    }
    let mut ap_counts: std::collections::HashMap<u8, usize> = std::collections::HashMap::new();
    for t in &mtexts {
        *ap_counts.entry(t.4).or_insert(0) += 1;
    }
}
