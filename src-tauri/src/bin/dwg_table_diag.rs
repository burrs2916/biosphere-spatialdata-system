use acadrust::entities::{AttachmentPoint, TextHorizontalAlignment, TextVerticalAlignment};
use acadrust::DwgReader;

fn main() {
    let file_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg";

    let data = std::fs::read(file_path).unwrap();
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    let target_x_min = 3340.0;
    let target_x_max = 3450.0;
    let target_y_min = 1970.0;
    let target_y_max = 2420.0;

    let mut v_lines: Vec<(f64, f64, f64)> = Vec::new();
    let mut h_lines: Vec<(f64, f64, f64)> = Vec::new();

    for entity in doc.entities() {
        if let acadrust::EntityType::Line(l) = entity {
            let p1 = &l.start;
            let p2 = &l.end;
            if (p1.x - p2.x).abs() < 0.01 {
                let lx = p1.x;
                let ly_min = p1.y.min(p2.y);
                let ly_max = p1.y.max(p2.y);
                if ly_max >= target_y_min
                    && ly_min <= target_y_max
                    && lx >= target_x_min - 20.0
                    && lx <= target_x_max + 20.0
                {
                    v_lines.push((lx, ly_min, ly_max));
                }
            } else if (p1.y - p2.y).abs() < 0.01 {
                let ly = p1.y;
                let lx_min = p1.x.min(p2.x);
                let lx_max = p1.x.max(p2.x);
                if lx_max >= target_x_min - 20.0
                    && lx_min <= target_x_max + 20.0
                    && ly >= target_y_min
                    && ly <= target_y_max
                {
                    h_lines.push((ly, lx_min, lx_max));
                }
            }
        }
    }

    v_lines.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    v_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);
    for _vl in &v_lines {}

    h_lines.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    h_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);
    for _hl in &h_lines {}
    for entity in doc.entities() {
        if let acadrust::EntityType::Text(t) = entity {
            let p = &t.insertion_point;
            if p.x >= target_x_min - 20.0
                && p.x <= target_x_max + 20.0
                && p.y >= target_y_min
                && p.y <= target_y_max
            {
                let _h_align: u8 = match t.horizontal_alignment {
                    TextHorizontalAlignment::Left => 0,
                    TextHorizontalAlignment::Center => 1,
                    TextHorizontalAlignment::Right => 2,
                    TextHorizontalAlignment::Aligned => 3,
                    TextHorizontalAlignment::Middle => 4,
                    TextHorizontalAlignment::Fit => 5,
                };
                let _v_align: u8 = match t.vertical_alignment {
                    TextVerticalAlignment::Baseline => 0,
                    TextVerticalAlignment::Bottom => 1,
                    TextVerticalAlignment::Middle => 2,
                    TextVerticalAlignment::Top => 3,
                };
            }
        }
    }
    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
            let p = &mt.insertion_point;
            if p.x >= target_x_min - 20.0
                && p.x <= target_x_max + 20.0
                && p.y >= target_y_min
                && p.y <= target_y_max
            {
                let _ap: u8 = match mt.attachment_point {
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
            }
        }
    }
    if !v_lines.is_empty() {
        for entity in doc.entities() {
            let (px, _py, _content, _ap, is_mtext) = match entity {
                acadrust::EntityType::Text(t) => {
                    let p = &t.insertion_point;
                    if p.x >= target_x_min - 20.0
                        && p.x <= target_x_max + 20.0
                        && p.y >= target_y_min
                        && p.y <= target_y_max
                    {
                        let h: u8 = match t.horizontal_alignment {
                            TextHorizontalAlignment::Left => 0,
                            TextHorizontalAlignment::Center => 1,
                            TextHorizontalAlignment::Right => 2,
                            _ => 0,
                        };
                        (p.x, p.y, t.value.clone(), h, false)
                    } else {
                        continue;
                    }
                }
                acadrust::EntityType::MText(mt) => {
                    let p = &mt.insertion_point;
                    if p.x >= target_x_min - 20.0
                        && p.x <= target_x_max + 20.0
                        && p.y >= target_y_min
                        && p.y <= target_y_max
                    {
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
                        (
                            p.x,
                            p.y,
                            mt.value.chars().take(40).collect::<String>(),
                            ap,
                            true,
                        )
                    } else {
                        continue;
                    }
                }
                _ => continue,
            };

            let mut nearest_left_x = f64::NEG_INFINITY;
            let mut nearest_right_x = f64::INFINITY;
            for vl in &v_lines {
                if vl.0 < px && vl.0 > nearest_left_x {
                    nearest_left_x = vl.0;
                }
                if vl.0 > px && vl.0 < nearest_right_x {
                    nearest_right_x = vl.0;
                }
            }

            let _cell_width =
                if nearest_right_x < f64::INFINITY && nearest_left_x > f64::NEG_INFINITY {
                    nearest_right_x - nearest_left_x
                } else {
                    f64::NAN
                };

            let _dist_to_left = px - nearest_left_x;
            let _dist_to_right = if nearest_right_x < f64::INFINITY {
                nearest_right_x - px
            } else {
                f64::NAN
            };

            let _type_str = if is_mtext { "MText" } else { "Text" };
        }
    }
}
