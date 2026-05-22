use acadrust::DwgReader;
use acadrust::entities::{TextHorizontalAlignment, TextVerticalAlignment, AttachmentPoint};

fn main() {
    let file_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg";

    let data = std::fs::read(file_path).unwrap();
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    let x_min = 3130.0;
    let x_max = 3430.0;
    let y_min = 1980.0;
    let y_max = 2340.0;

    for entity in doc.entities() {
        match entity {
            acadrust::EntityType::Text(t) => {
                let p = &t.insertion_point;
                if p.x >= x_min && p.x <= x_max && p.y >= y_min && p.y <= y_max {
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
                }
            }
            acadrust::EntityType::MText(mt) => {
                let p = &mt.insertion_point;
                if p.x >= x_min && p.x <= x_max && p.y >= y_min && p.y <= y_max {
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
                }
            }
            _ => {}
        }
    }

    let mut mtexts: Vec<(f64, f64, f64, u8, f64, String)> = Vec::new();
    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
            if mt.attachment_point == AttachmentPoint::TopLeft && mt.rotation.abs() < 0.1 {
                let p = &mt.insertion_point;
                mtexts.push((p.x, p.y, mt.height, 1, mt.rectangle_width, mt.value.chars().take(60).collect::<String>()));
            }
        }
    }
    mtexts.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

    for mt in mtexts.iter().take(50) {
    }

    let mut ap_counts: [usize; 10] = [0; 10];
    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
            let ap: usize = match mt.attachment_point {
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
            ap_counts[ap] += 1;
        }
    }

    let ap_names = ["", "TopLeft", "TopCenter", "TopRight", "MiddleLeft", "MiddleCenter", "MiddleRight", "BottomLeft", "BottomCenter", "BottomRight"];
    for i in 1..=9 {
        if ap_counts[i] > 0 {
        }
    }

    let mut hv_counts: [[usize; 4]; 6] = [[0; 4]; 6];
    for entity in doc.entities() {
        if let acadrust::EntityType::Text(t) = entity {
            let h: usize = match t.horizontal_alignment {
                TextHorizontalAlignment::Left => 0,
                TextHorizontalAlignment::Center => 1,
                TextHorizontalAlignment::Right => 2,
                TextHorizontalAlignment::Aligned => 3,
                TextHorizontalAlignment::Middle => 4,
                TextHorizontalAlignment::Fit => 5,
            };
            let v: usize = match t.vertical_alignment {
                TextVerticalAlignment::Baseline => 0,
                TextVerticalAlignment::Bottom => 1,
                TextVerticalAlignment::Middle => 2,
                TextVerticalAlignment::Top => 3,
            };
            hv_counts[h][v] += 1;
        }
    }

    let h_names = ["Left", "Center", "Right", "Aligned", "Middle", "Fit"];
    let v_names = ["Baseline", "Bottom", "Middle", "Top"];
    for h in 0..6 {
        for v in 0..4 {
            if hv_counts[h][v] > 0 {
            }
        }
    }
}
