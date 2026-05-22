use acadrust::entities::{AttachmentPoint, TextHorizontalAlignment, TextVerticalAlignment};
use acadrust::DwgReader;

fn main() {
    let file_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg";

    let data = std::fs::read(file_path).unwrap();
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    let mut all_lines: Vec<(f64, f64, f64, f64)> = Vec::new();
    let mut all_texts: Vec<(f64, f64, f64, String, u8, u8, f64, bool, f64)> = Vec::new();

    for entity in doc.entities() {
        match entity {
            acadrust::EntityType::Line(l) => {
                let p1 = &l.start;
                let p2 = &l.end;
                all_lines.push((p1.x, p1.y, p2.x, p2.y));
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
                all_texts.push((
                    p.x,
                    p.y,
                    t.height,
                    t.value.clone(),
                    h_align,
                    v_align,
                    t.rotation,
                    false,
                    0.0,
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
                all_texts.push((
                    p.x,
                    p.y,
                    mt.height,
                    mt.value.chars().take(60).collect::<String>(),
                    ap,
                    0,
                    mt.rotation,
                    true,
                    mt.rectangle_width,
                ));
            }
            _ => {}
        }
    }

    let mut v_lines: Vec<(f64, f64, f64, f64)> = Vec::new();
    for l in &all_lines {
        if (l.0 - l.2).abs() < 0.01 {
            let y_min = l.1.min(l.3);
            let y_max = l.1.max(l.3);
            let len = y_max - y_min;
            v_lines.push((l.0, y_min, y_max, len));
        }
    }
    v_lines.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap());
    for _vl in v_lines.iter().take(20) {}

    let mut h_lines: Vec<(f64, f64, f64, f64)> = Vec::new();
    for l in &all_lines {
        if (l.1 - l.3).abs() < 0.01 {
            let x_min = l.0.min(l.2);
            let x_max = l.0.max(l.2);
            let len = x_max - x_min;
            h_lines.push((l.1, x_min, x_max, len));
        }
    }
    h_lines.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap());
    for _hl in h_lines.iter().take(20) {}

    let long_h: Vec<_> = h_lines.iter().filter(|l| l.3 > 100.0).collect();
    let long_v: Vec<_> = v_lines.iter().filter(|l| l.3 > 100.0).collect();

    if !long_h.is_empty() && !long_v.is_empty() {
        let h_y_min = long_h.iter().map(|l| l.0).fold(f64::INFINITY, f64::min);
        let h_y_max = long_h.iter().map(|l| l.0).fold(f64::NEG_INFINITY, f64::max);
        let v_x_min = long_v.iter().map(|l| l.0).fold(f64::INFINITY, f64::min);
        let v_x_max = long_v.iter().map(|l| l.0).fold(f64::NEG_INFINITY, f64::max);

        let table_x_min = v_x_min - 5.0;
        let table_x_max = v_x_max + 5.0;
        let table_y_min = h_y_min - 5.0;
        let table_y_max = h_y_max + 5.0;

        let mut table_v_lines: Vec<(f64, f64, f64)> = Vec::new();
        for vl in &long_v {
            if vl.0 >= table_x_min && vl.0 <= table_x_max {
                table_v_lines.push((vl.0, vl.1, vl.2));
            }
        }
        table_v_lines.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        table_v_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);
        for _vl in &table_v_lines {}

        let mut table_h_lines: Vec<(f64, f64, f64)> = Vec::new();
        for hl in &long_h {
            if hl.0 >= table_y_min && hl.0 <= table_y_max {
                table_h_lines.push((hl.0, hl.1, hl.2));
            }
        }
        table_h_lines.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        table_h_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);
        for _hl in &table_h_lines {}
        for t in &all_texts {
            let (px, py, height, content, ap, _va, rotation, is_mtext, rect_width) = t;
            let (px, py, _height, _content, _ap, rotation, is_mtext, _rect_width) = (
                *px,
                *py,
                *height,
                content.as_str(),
                *ap,
                *rotation,
                *is_mtext,
                *rect_width,
            );
            if px >= table_x_min && px <= table_x_max && py >= table_y_min && py <= table_y_max {
                if rotation.abs() > 0.1 && (rotation - 1.5708).abs() > 0.1 {
                    continue;
                }

                let mut nearest_left_x = f64::NEG_INFINITY;
                let mut nearest_right_x = f64::INFINITY;
                for vl in &table_v_lines {
                    if vl.0 < px && vl.0 > nearest_left_x {
                        nearest_left_x = vl.0;
                    }
                    if vl.0 > px && vl.0 < nearest_right_x {
                        nearest_right_x = vl.0;
                    }
                }

                let _type_str = if is_mtext { "MText" } else { "Text" };
                let _cell_info =
                    if nearest_left_x > f64::NEG_INFINITY && nearest_right_x < f64::INFINITY {
                        format!(
                            "左线={:.4} 右线={:.4} 单元宽={:.4} 距左={:.4}",
                            nearest_left_x,
                            nearest_right_x,
                            nearest_right_x - nearest_left_x,
                            px - nearest_left_x
                        )
                    } else if nearest_left_x > f64::NEG_INFINITY {
                        format!("左线={:.4} 距左={:.4}", nearest_left_x, px - nearest_left_x)
                    } else {
                        "无左线".to_string()
                    };
            }
        }
    }
}
