use acadrust::entities::{AttachmentPoint, TextHorizontalAlignment, TextVerticalAlignment};
use acadrust::DwgReader;

fn main() {
    let file_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg";

    let data = std::fs::read(file_path).unwrap();
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    let legend_x_min = 2200.0;
    let legend_x_max = 2700.0;
    let legend_y_min = 1430.0;
    let legend_y_max = 1700.0;

    let mut v_lines: Vec<(f64, f64, f64)> = Vec::new();
    for entity in doc.entities() {
        if let acadrust::EntityType::Line(l) = entity {
            let p1 = &l.start;
            let p2 = &l.end;
            if (p1.x - p2.x).abs() < 0.01 {
                let y_min = p1.y.min(p2.y);
                let y_max = p1.y.max(p2.y);
                if p1.x >= legend_x_min - 10.0
                    && p1.x <= legend_x_max + 10.0
                    && y_max >= legend_y_min
                    && y_min <= legend_y_max
                {
                    v_lines.push((p1.x, y_min, y_max));
                }
            }
        }
    }
    v_lines.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    v_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);
    for _vl in &v_lines {}

    let mut h_lines: Vec<(f64, f64, f64)> = Vec::new();
    for entity in doc.entities() {
        if let acadrust::EntityType::Line(l) = entity {
            let p1 = &l.start;
            let p2 = &l.end;
            if (p1.y - p2.y).abs() < 0.01 {
                let x_min = p1.x.min(p2.x);
                let x_max = p1.x.max(p2.x);
                if p1.y >= legend_y_min - 10.0
                    && p1.y <= legend_y_max + 10.0
                    && x_max >= legend_x_min
                    && x_min <= legend_x_max
                {
                    h_lines.push((p1.y, x_min, x_max));
                }
            }
        }
    }
    h_lines.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    h_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);
    for _hl in &h_lines {}

    for entity in doc.entities() {
        match entity {
            acadrust::EntityType::Text(t) => {
                let p = &t.insertion_point;
                if p.x >= legend_x_min
                    && p.x <= legend_x_max
                    && p.y >= legend_y_min
                    && p.y <= legend_y_max
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
            acadrust::EntityType::MText(mt) => {
                let p = &mt.insertion_point;
                if p.x >= legend_x_min
                    && p.x <= legend_x_max
                    && p.y >= legend_y_min
                    && p.y <= legend_y_max
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

                    let mut nearest_left_x = f64::NEG_INFINITY;
                    let mut nearest_right_x = f64::INFINITY;
                    for vl in &v_lines {
                        if vl.0 < p.x && vl.0 > nearest_left_x {
                            nearest_left_x = vl.0;
                        }
                        if vl.0 > p.x && vl.0 < nearest_right_x {
                            nearest_right_x = vl.0;
                        }
                    }

                    let _cell_info =
                        if nearest_left_x > f64::NEG_INFINITY && nearest_right_x < f64::INFINITY {
                            let cell_w = nearest_right_x - nearest_left_x;
                            let cell_center = (nearest_left_x + nearest_right_x) / 2.0;
                            format!(
                                "左线={:.4} 右线={:.4} 单元宽={:.4} 距左={:.4} 距中心={:.4}",
                                nearest_left_x,
                                nearest_right_x,
                                cell_w,
                                p.x - nearest_left_x,
                                p.x - cell_center
                            )
                        } else {
                            "无单元格".to_string()
                        };
                }
            }
            _ => {}
        }
    }
    let legend2_x_min = 2460.0;
    let legend2_x_max = 2700.0;
    let legend2_y_min = 1430.0;
    let legend2_y_max = 1700.0;

    let mut v_lines2: Vec<(f64, f64, f64)> = Vec::new();
    for entity in doc.entities() {
        if let acadrust::EntityType::Line(l) = entity {
            let p1 = &l.start;
            let p2 = &l.end;
            if (p1.x - p2.x).abs() < 0.01 {
                let y_min = p1.y.min(p2.y);
                let y_max = p1.y.max(p2.y);
                if p1.x >= legend2_x_min - 10.0
                    && p1.x <= legend2_x_max + 10.0
                    && y_max >= legend2_y_min
                    && y_min <= legend2_y_max
                {
                    v_lines2.push((p1.x, y_min, y_max));
                }
            }
        }
    }
    v_lines2.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    v_lines2.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);
    for _vl in &v_lines2 {}

    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
            let p = &mt.insertion_point;
            if p.x >= legend2_x_min
                && p.x <= legend2_x_max
                && p.y >= legend2_y_min
                && p.y <= legend2_y_max
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

                let mut nearest_left_x = f64::NEG_INFINITY;
                let mut nearest_right_x = f64::INFINITY;
                for vl in &v_lines2 {
                    if vl.0 < p.x && vl.0 > nearest_left_x {
                        nearest_left_x = vl.0;
                    }
                    if vl.0 > p.x && vl.0 < nearest_right_x {
                        nearest_right_x = vl.0;
                    }
                }

                let _cell_info =
                    if nearest_left_x > f64::NEG_INFINITY && nearest_right_x < f64::INFINITY {
                        let cell_w = nearest_right_x - nearest_left_x;
                        let cell_center = (nearest_left_x + nearest_right_x) / 2.0;
                        format!(
                            "左线={:.4} 右线={:.4} 单元宽={:.4} 距左={:.4} 距中心={:.4}",
                            nearest_left_x,
                            nearest_right_x,
                            cell_w,
                            p.x - nearest_left_x,
                            p.x - cell_center
                        )
                    } else {
                        "无单元格".to_string()
                    };
            }
        }
    }
}
