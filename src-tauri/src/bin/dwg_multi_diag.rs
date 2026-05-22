use acadrust::entities::{AttachmentPoint, TextHorizontalAlignment, TextVerticalAlignment};
use acadrust::DwgReader;

fn analyze_file(file_path: &str) {
    let data = match std::fs::read(file_path) {
        Ok(d) => d,
        Err(e) => {
            return;
        }
    };
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = match reader.read() {
        Ok(d) => d,
        Err(e) => {
            return;
        }
    };

    let mut all_lines: Vec<(f64, f64, f64, f64)> = Vec::new();
    let mut mtext_list: Vec<(f64, f64, f64, String, u8, f64, f64)> = Vec::new();
    let mut text_list: Vec<(f64, f64, f64, String, u8, u8, f64)> = Vec::new();

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
                text_list.push((
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
                mtext_list.push((
                    p.x,
                    p.y,
                    mt.height,
                    mt.value.chars().take(60).collect::<String>(),
                    ap,
                    mt.rotation,
                    mt.rectangle_width,
                ));
            }
            _ => {}
        }
    }

    let mut v_lines: Vec<(f64, f64, f64)> = Vec::new();
    for l in &all_lines {
        if (l.0 - l.2).abs() < 0.01 {
            v_lines.push((l.0, l.1.min(l.3), l.1.max(l.3)));
        }
    }
    v_lines.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    v_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);

    let mut h_lines: Vec<(f64, f64, f64)> = Vec::new();
    for l in &all_lines {
        if (l.1 - l.3).abs() < 0.01 {
            h_lines.push((l.1, l.0.min(l.2), l.0.max(l.2)));
        }
    }
    h_lines.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    h_lines.dedup_by(|a, b| (a.0 - b.0).abs() < 0.5);

    let file_name = file_path.rsplit('/').next().unwrap_or(file_path);

    let mut overflow_count = 0;
    let mut center_offset_count = 0;
    let mut total_in_table = 0;
    for t in &mtext_list {
        let (px, py, height, content, ap, rotation, rect_w) = t;

        if rotation.abs() > 0.1
            && (rotation - 1.5708).abs() > 0.1
            && (rotation - 3.14159).abs() > 0.1
        {
            continue;
        }

        let mut nearest_left_x = f64::NEG_INFINITY;
        let mut nearest_right_x = f64::INFINITY;
        let mut nearest_bottom_y = f64::NEG_INFINITY;
        let mut nearest_top_y = f64::INFINITY;
        for vl in &v_lines {
            if *py >= vl.1 && *py <= vl.2 {
                if vl.0 < *px && vl.0 > nearest_left_x {
                    nearest_left_x = vl.0;
                }
                if vl.0 > *px && vl.0 < nearest_right_x {
                    nearest_right_x = vl.0;
                }
            }
        }
        for hl in &h_lines {
            if *px >= hl.1 && *px <= hl.2 {
                if hl.0 > *py && hl.0 < nearest_top_y {
                    nearest_top_y = hl.0;
                }
                if hl.0 < *py && hl.0 > nearest_bottom_y {
                    nearest_bottom_y = hl.0;
                }
            }
        }

        if nearest_left_x == f64::NEG_INFINITY || nearest_right_x == f64::INFINITY {
            continue;
        }

        let cell_width = nearest_right_x - nearest_left_x;
        if cell_width < 2.0 || cell_width > 300.0 {
            continue;
        }

        let dist_to_left = px - nearest_left_x;
        let cell_center_x = (nearest_left_x + nearest_right_x) / 2.0;

        total_in_table += 1;

        let is_left_align = *ap == 1 || *ap == 4 || *ap == 7;
        let is_center_align = *ap == 2 || *ap == 5 || *ap == 8;
        let is_right_align = *ap == 3 || *ap == 6 || *ap == 9;

        if is_left_align && dist_to_left < 0.5 {
            overflow_count += 1;
        }

        if is_center_align {
            let dist_to_center = px - cell_center_x;
            if dist_to_center.abs() > cell_width * 0.15 {
                center_offset_count += 1;
            }
        }

        if is_right_align {
            let dist_to_right = nearest_right_x - px;
            if dist_to_right < 0.5 {
                overflow_count += 1;
            }
        }
    }
    for t in &text_list {
        let (px, py, height, content, h_align, v_align, rotation) = t;

        if rotation.abs() > 0.1
            && (rotation - 1.5708).abs() > 0.1
            && (rotation - 3.14159).abs() > 0.1
        {
            continue;
        }

        let mut nearest_left_x = f64::NEG_INFINITY;
        let mut nearest_right_x = f64::INFINITY;
        for vl in &v_lines {
            if *py >= vl.1 && *py <= vl.2 {
                if vl.0 < *px && vl.0 > nearest_left_x {
                    nearest_left_x = vl.0;
                }
                if vl.0 > *px && vl.0 < nearest_right_x {
                    nearest_right_x = vl.0;
                }
            }
        }

        if nearest_left_x == f64::NEG_INFINITY || nearest_right_x == f64::INFINITY {
            continue;
        }

        let cell_width = nearest_right_x - nearest_left_x;
        if cell_width < 2.0 || cell_width > 300.0 {
            continue;
        }

        let dist_to_left = px - nearest_left_x;
        let cell_center_x = (nearest_left_x + nearest_right_x) / 2.0;

        total_in_table += 1;

        let is_left_align = *h_align == 0 || *h_align == 3 || *h_align == 5;
        let is_center_align = *h_align == 1 || *h_align == 4;

        if is_left_align && dist_to_left < 0.5 {
            overflow_count += 1;
        }

        if is_center_align {
            let dist_to_center = px - cell_center_x;
            if dist_to_center.abs() > cell_width * 0.15 {
                center_offset_count += 1;
            }
        }
    }
    if overflow_count > 0 || center_offset_count > 0 {
    } else {
    }
}

fn main() {
    let dir =
        "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510";

    let files = [
        "雨田煤业井下降尘喷雾布置图22.7.1.dwg",
        "嘉阳煤矿通风系统图（2021.12）(1).dwg",
        "2022年5月26日通防图 (防尘喷雾布置）.dwg",
        "采掘工程平面图2022.08.dwg",
        "沙吉海煤业2023年3月份最新修改通防图纸.dwg",
        "5.防尘系统图(1).dwg",
        "采掘（通风系统图）5.14.dwg",
        "防尘、消防、供水施救、隔爆系统（一成）示意图.dwg",
        "防尘系统图-音西.dwg",
        "2023.10月 防尘系统图.dwg",
        "库尔勒金川矿业有限公司塔什店二井田煤矿2023年10月防尘系统图.dwg",
        "2023.11.12 自动喷雾布置图.dwg",
        "西沟煤矿降尘系统布置图通风科修改2004.dwg",
        "通风系统图(1).dwg",
        "通风系统图(2).dwg",
        "采掘工程平面图（启封）.dwg",
        "托克逊县盘吉煤业有限公司煤矿智能防尘系统升级图.dwg",
        "宝平煤矿9-10煤层采掘工程平面图-已标注.dwg",
        "通风系统底图.dwg",
        "井下避灾线路图（202505).dwg",
    ];

    for f in &files {
        let path = format!("{}/{}", dir, f);
        analyze_file(&path);
    }
}
