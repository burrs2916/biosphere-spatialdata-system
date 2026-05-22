use acadrust::DwgReader;
use acadrust::entities::{TextHorizontalAlignment, TextVerticalAlignment, AttachmentPoint};

fn main() {
    let file_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg";

    let data = std::fs::read(file_path).unwrap();
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    for entity in doc.entities() {
        match entity {
            acadrust::EntityType::Text(t) => {
                let val = &t.value;
                if val.contains("名称") || val.contains("符号") || val.contains("备注") || val.contains("序号") || val.contains("编号") || val.contains("图例") {
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
                }
            }
            acadrust::EntityType::MText(mt) => {
                let val = &mt.value;
                if val.contains("名称") || val.contains("符号") || val.contains("备注") || val.contains("序号") || val.contains("编号") || val.contains("图例") {
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
                }
            }
            _ => {}
        }
    }

    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
            let ap = match mt.attachment_point {
                AttachmentPoint::TopCenter => Some(2u8),
                AttachmentPoint::BottomCenter => Some(8u8),
                AttachmentPoint::MiddleCenter => Some(5u8),
                _ => None,
            };
            if let Some(ap_val) = ap {
                let p = &mt.insertion_point;
                if mt.rotation.abs() < 0.1 {
                }
            }
        }
    }

    for entity in doc.entities() {
        if let acadrust::EntityType::Text(t) = entity {
            let is_center = matches!(t.horizontal_alignment, TextHorizontalAlignment::Center | TextHorizontalAlignment::Middle);
            if is_center {
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
            }
        }
    }
}
