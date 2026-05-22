use acadrust::entities::{AttachmentPoint, TextHorizontalAlignment, TextVerticalAlignment};
use acadrust::DwgReader;

fn main() {
    let file_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg";

    let data = std::fs::read(file_path).unwrap();
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    let mut v_lines: Vec<(f64, f64, f64)> = Vec::new();
    for entity in doc.entities() {
        if let acadrust::EntityType::Line(l) = entity {
            let p1 = &l.start;
            let p2 = &l.end;
            if (p1.x - p2.x).abs() < 0.01 {
                let y_min = p1.y.min(p2.y);
                let y_max = p1.y.max(p2.y);
                if y_max - y_min > 50.0 {
                    v_lines.push((p1.x, y_min, y_max));
                }
            }
        }
    }
    v_lines.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    v_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);
    for vl in &v_lines {}

    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
            if mt.attachment_point != AttachmentPoint::TopLeft {
                continue;
            }
            if mt.rotation.abs() > 0.1 {
                continue;
            }

            let p = &mt.insertion_point;
            let content_clean = mt
                .value
                .replace("{\\fFangSong_GB2312|b0|i0|c134|p49;", "")
                .replace("{\\fSimSun|b0|i0|c134|p2;", "")
                .replace("{\\fSimSun|b0|i0|c129|p2;", "")
                .replace("{\\fArial|b0|i0|c0|p32;", "")
                .replace("\\A1;", "")
                .replace("\\P", " ")
                .replace("{", "")
                .replace("}", "");

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

            if nearest_left_x == f64::NEG_INFINITY || nearest_right_x == f64::INFINITY {
                continue;
            }

            let cell_width = nearest_right_x - nearest_left_x;
            if cell_width > 300.0 || cell_width < 5.0 {
                continue;
            }

            let dist_to_left = p.x - nearest_left_x;
            let left_ratio = dist_to_left / cell_width;
        }
    }

    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
            if mt.attachment_point != AttachmentPoint::MiddleCenter {
                continue;
            }
            if mt.rotation.abs() > 0.1 {
                continue;
            }

            let p = &mt.insertion_point;
            let content_clean = mt
                .value
                .replace("{\\fFangSong_GB2312|b0|i0|c134|p49;", "")
                .replace("{\\fSimSun|b0|i0|c134|p2;", "")
                .replace("{\\fSimSun|b0|i0|c129|p2;", "")
                .replace("\\A1;", "")
                .replace("\\P", " ")
                .replace("{", "")
                .replace("}", "");

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

            if nearest_left_x == f64::NEG_INFINITY || nearest_right_x == f64::INFINITY {
                continue;
            }

            let cell_width = nearest_right_x - nearest_left_x;
            if cell_width > 300.0 || cell_width < 5.0 {
                continue;
            }

            let cell_center = (nearest_left_x + nearest_right_x) / 2.0;
            let dist_to_left = p.x - nearest_left_x;
            let dist_to_center = p.x - cell_center;
        }
    }

    for entity in doc.entities() {
        if let acadrust::EntityType::Text(t) = entity {
            if t.horizontal_alignment != TextHorizontalAlignment::Left {
                continue;
            }
            if t.vertical_alignment != TextVerticalAlignment::Baseline {
                continue;
            }
            if t.rotation.abs() > 0.1
                && (t.rotation - 1.5708).abs() > 0.1
                && (t.rotation - 6.28).abs() > 0.1
            {
                continue;
            }

            let p = &t.insertion_point;

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

            if nearest_left_x == f64::NEG_INFINITY || nearest_right_x == f64::INFINITY {
                continue;
            }

            let cell_width = nearest_right_x - nearest_left_x;
            if cell_width > 300.0 || cell_width < 5.0 {
                continue;
            }

            let dist_to_left = p.x - nearest_left_x;
            let left_ratio = dist_to_left / cell_width;
        }
    }
}
