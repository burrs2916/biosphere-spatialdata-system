use acadrust::entities::AttachmentPoint;
use acadrust::DwgReader;

fn main() {
    let dwg_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dwg";
    let dxf_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/雨田煤业井下降尘喷雾布置图22.7.1.dxf";

    let dwg_data = std::fs::read(dwg_path).unwrap();
    let cursor = std::io::Cursor::new(dwg_data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    let legend_x_min = 2200.0;
    let legend_x_max = 2750.0;
    let legend_y_min = 1400.0;
    let legend_y_max = 1720.0;

    let mut dwg_mtexts: Vec<(f64, f64, f64, f64, u8, String, String)> = Vec::new();

    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
            let p = &mt.insertion_point;
            if p.x >= legend_x_min
                && p.x <= legend_x_max
                && p.y >= legend_y_min
                && p.y <= legend_y_max
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
                let cleaned = clean_mtext_format(&mt.value);
                dwg_mtexts.push((
                    p.x,
                    p.y,
                    mt.height,
                    mt.rectangle_width,
                    ap,
                    mt.value.clone(),
                    cleaned,
                ));
            }
        }
    }

    dwg_mtexts.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    for (_i, (_x, _y, _h, _rw, _ap, raw, clean)) in dwg_mtexts.iter().enumerate() {
        let _raw_preview: String = raw.chars().take(60).collect();
        let _clean_preview: String = clean.chars().take(40).collect();
    }

    let dxf_content = std::fs::read_to_string(dxf_path).unwrap();
    let dxf_lines: Vec<&str> = dxf_content.lines().collect();

    let mut dxf_mtexts: Vec<DxfMText> = Vec::new();
    let mut i = 0;
    while i < dxf_lines.len() {
        if dxf_lines[i].trim() == "MTEXT" {
            let mut mtext = DxfMText::default();
            let mut in_mtext = true;
            let mut j = i + 1;
            while j < dxf_lines.len() && in_mtext {
                let code = dxf_lines[j].trim();
                if code == "0" {
                    in_mtext = false;
                    break;
                }
                if j + 1 < dxf_lines.len() {
                    let value = dxf_lines[j + 1].trim();
                    match code {
                        "10" => mtext.x = value.parse().unwrap_or(0.0),
                        "20" => mtext.y = value.parse().unwrap_or(0.0),
                        "40" => mtext.height = value.parse().unwrap_or(0.0),
                        "41" => mtext.rect_width = value.parse().unwrap_or(0.0),
                        "71" => mtext.drawing_dir = value.parse().unwrap_or(0),
                        "72" => mtext.attach = value.parse().unwrap_or(1),
                        "1" => {
                            if mtext.content.is_empty() {
                                mtext.content = value.to_string();
                            } else {
                                mtext.content.push_str(value);
                            }
                        }
                        "3" => {
                            mtext.content.push_str(value);
                        }
                        _ => {}
                    }
                    j += 2;
                } else {
                    j += 1;
                }
            }
            dxf_mtexts.push(mtext);
            i = j;
        } else {
            i += 1;
        }
    }

    let legend_dxf_x_min = 0.0;
    let legend_dxf_x_max = 40.0;
    let legend_dxf_y_min = 90.0;
    let legend_dxf_y_max = 110.0;

    dxf_mtexts.retain(|m| {
        m.x >= legend_dxf_x_min
            && m.x <= legend_dxf_x_max
            && m.y >= legend_dxf_y_min
            && m.y <= legend_dxf_y_max
    });
    dxf_mtexts.sort_by(|a, b| b.y.partial_cmp(&a.y).unwrap_or(std::cmp::Ordering::Equal));

    for (_i, m) in dxf_mtexts.iter().enumerate() {
        let _preview: String = m.content.chars().take(80).collect();
    }

    let mut w075_count = 0;
    let mut w1_count = 0;
    let mut other_w_count = 0;

    for m in &dxf_mtexts {
        if m.content.contains("\\W0.750000") {
            w075_count += 1;
        } else if m.content.contains("\\W1.000000") {
            w1_count += 1;
        } else {
            other_w_count += 1;
        }
    }

    let mut font_counts: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();
    for m in &dxf_mtexts {
        let font = extract_font(&m.content);
        *font_counts.entry(font).or_insert(0) += 1;
    }
    for (_font, _count) in &font_counts {}

    let mut h_values: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for m in &dxf_mtexts {
        let h = extract_h_value(&m.content);
        *h_values.entry(h).or_insert(0) += 1;
    }
    let mut h_sorted: Vec<_> = h_values.iter().collect();
    h_sorted.sort_by(|a, b| b.1.cmp(a.1));
    for (_h, _count) in &h_sorted {}

    let mut dir_counts: std::collections::HashMap<i32, usize> = std::collections::HashMap::new();
    for m in &dxf_mtexts {
        *dir_counts.entry(m.drawing_dir).or_insert(0) += 1;
    }
    for (_dir, _count) in &dir_counts {}

    let mut attach_counts: std::collections::HashMap<i32, usize> = std::collections::HashMap::new();
    for m in &dxf_mtexts {
        *attach_counts.entry(m.attach).or_insert(0) += 1;
    }
    for (att, _count) in &attach_counts {
        let _desc = match att {
            1 => "TopLeft",
            2 => "TopCenter",
            3 => "TopRight",
            4 => "MiddleLeft",
            5 => "MiddleCenter",
            6 => "MiddleRight",
            7 => "BottomLeft",
            8 => "BottomCenter",
            9 => "BottomRight",
            _ => "Unknown",
        };
    }

    if !dwg_mtexts.is_empty() && !dxf_mtexts.is_empty() {
        let dwg_x_min = dwg_mtexts.iter().map(|m| m.0).fold(f64::INFINITY, f64::min);
        let dwg_x_max = dwg_mtexts
            .iter()
            .map(|m| m.0)
            .fold(f64::NEG_INFINITY, f64::max);
        let dwg_y_min = dwg_mtexts.iter().map(|m| m.1).fold(f64::INFINITY, f64::min);
        let dwg_y_max = dwg_mtexts
            .iter()
            .map(|m| m.1)
            .fold(f64::NEG_INFINITY, f64::max);

        let dxf_x_min = dxf_mtexts.iter().map(|m| m.x).fold(f64::INFINITY, f64::min);
        let dxf_x_max = dxf_mtexts
            .iter()
            .map(|m| m.x)
            .fold(f64::NEG_INFINITY, f64::max);
        let dxf_y_min = dxf_mtexts.iter().map(|m| m.y).fold(f64::INFINITY, f64::min);
        let dxf_y_max = dxf_mtexts
            .iter()
            .map(|m| m.y)
            .fold(f64::NEG_INFINITY, f64::max);

        let dwg_w = dwg_x_max - dwg_x_min;
        let dwg_h = dwg_y_max - dwg_y_min;
        let _dxf_w = dxf_x_max - dxf_x_min;
        let _dxf_h = dxf_y_max - dxf_y_min;

        dwg_w > 0.0 && dwg_h > 0.0;

        let dwg_h_avg: f64 = dwg_mtexts.iter().map(|m| m.2).sum::<f64>() / dwg_mtexts.len() as f64;
        let _dxf_h_avg: f64 =
            dxf_mtexts.iter().map(|m| m.height).sum::<f64>() / dxf_mtexts.len() as f64;

        if dwg_h_avg > 0.0 {}
    }

    let mut w075_total = 0;
    let mut w1_total = 0;
    let mut w_other_total = 0;
    let mut w_other_values: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();

    for _m in &dxf_mtexts {
        // already filtered to legend area, let's check all
    }

    let all_dxf_mtexts = parse_all_dxf_mtexts(&dxf_content);
    for m in &all_dxf_mtexts {
        if m.content.contains("\\W0.750000") {
            w075_total += 1;
        } else if m.content.contains("\\W1.000000") {
            w1_total += 1;
        } else {
            let w = extract_w_value(&m.content);
            if !w.is_empty() {
                *w_other_values.entry(w).or_insert(0) += 1;
                w_other_total += 1;
            }
        }
    }
    if w_other_total > 0 {
        for (_w, _count) in &w_other_values {}
    }

    let mut all_dwg_mtexts: Vec<(f64, f64, f64, u8, String)> = Vec::new();
    for entity in doc.entities() {
        if let acadrust::EntityType::MText(mt) = entity {
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
            all_dwg_mtexts.push((p.x, p.y, mt.height, ap, mt.value.clone()));
        }
    }

    let mut dwg_has_font = 0;
    let mut dwg_has_w = 0;
    let mut dwg_has_h = 0;
    let mut dwg_has_a = 0;
    let mut dwg_has_leading_space = 0;

    for (_, _, _, _, content) in &all_dwg_mtexts {
        if content.contains("\\f") || content.contains("\\F") {
            dwg_has_font += 1;
        }
        if content.contains("\\W") {
            dwg_has_w += 1;
        }
        if content.contains("\\H") {
            dwg_has_h += 1;
        }
        if content.contains("\\A") {
            dwg_has_a += 1;
        }
        let cleaned = clean_mtext_format(content);
        if cleaned.starts_with(' ') {
            dwg_has_leading_space += 1;
        }
    }
    let mut count = 0;
    for (_, _, _, _, content) in &all_dwg_mtexts {
        if content.contains("\\W") {
            count += 1;
            if count >= 10 {
                break;
            }
        }
    }
    let mut count = 0;
    for (_, _, _, _, content) in &all_dwg_mtexts {
        if content.contains("\\H") {
            count += 1;
            if count >= 10 {
                break;
            }
        }
    }
}

#[derive(Default)]
struct DxfMText {
    x: f64,
    y: f64,
    height: f64,
    rect_width: f64,
    drawing_dir: i32,
    attach: i32,
    content: String,
}

fn parse_all_dxf_mtexts(content: &str) -> Vec<DxfMText> {
    let lines: Vec<&str> = content.lines().collect();
    let mut result = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        if lines[i].trim() == "MTEXT" {
            let mut mtext = DxfMText::default();
            let mut j = i + 1;
            while j + 1 < lines.len() {
                let code = lines[j].trim();
                if code == "0" {
                    break;
                }
                let value = lines[j + 1].trim();
                match code {
                    "10" => mtext.x = value.parse().unwrap_or(0.0),
                    "20" => mtext.y = value.parse().unwrap_or(0.0),
                    "40" => mtext.height = value.parse().unwrap_or(0.0),
                    "41" => mtext.rect_width = value.parse().unwrap_or(0.0),
                    "71" => mtext.drawing_dir = value.parse().unwrap_or(0),
                    "72" => mtext.attach = value.parse().unwrap_or(1),
                    "1" => {
                        if mtext.content.is_empty() {
                            mtext.content = value.to_string();
                        } else {
                            mtext.content.push_str(value);
                        }
                    }
                    "3" => {
                        mtext.content.push_str(value);
                    }
                    _ => {}
                }
                j += 2;
            }
            result.push(mtext);
            i = j;
        } else {
            i += 1;
        }
    }
    result
}

fn extract_font(content: &str) -> String {
    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\\' && i + 1 < chars.len() && (chars[i + 1] == 'f' || chars[i + 1] == 'F') {
            let mut j = i + 2;
            let mut font = String::new();
            while j < chars.len() && chars[j] != '|' && chars[j] != ';' && chars[j] != '\\' {
                font.push(chars[j]);
                j += 1;
            }
            return font;
        }
        i += 1;
    }
    "无".to_string()
}

fn extract_h_value(content: &str) -> String {
    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\\' && i + 1 < chars.len() && chars[i + 1] == 'H' {
            let mut j = i + 2;
            let mut val = String::new();
            while j < chars.len() && (chars[j].is_ascii_digit() || chars[j] == '.') {
                val.push(chars[j]);
                j += 1;
            }
            return val;
        }
        i += 1;
    }
    "无".to_string()
}

fn extract_w_value(content: &str) -> String {
    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\\' && i + 1 < chars.len() && chars[i + 1] == 'W' {
            let mut j = i + 2;
            let mut val = String::new();
            while j < chars.len() && (chars[j].is_ascii_digit() || chars[j] == '.') {
                val.push(chars[j]);
                j += 1;
            }
            return val;
        }
        i += 1;
    }
    String::new()
}

fn clean_mtext_format(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::new();
    let mut i = 0;

    while i < chars.len() {
        if chars[i] == '\\' && i + 1 < chars.len() {
            let cmd = chars[i + 1];
            if cmd == 'P'
                && i + 2 < chars.len()
                && (chars[i + 2] == 'X' || chars[i + 2] == 'Y' || chars[i + 2] == 'Z')
            {
                i += 3;
                while i < chars.len() && chars[i] != '\\' {
                    i += 1;
                }
                continue;
            }
            if cmd == 'P' {
                result.push('\n');
                i += 2;
                continue;
            }
            let mut j = i + 1;
            while j < chars.len()
                && chars[j] != ';'
                && chars[j] != '\\'
                && chars[j] != '{'
                && chars[j] != '}'
            {
                j += 1;
            }
            if j < chars.len() && chars[j] == ';' {
                i = j + 1;
                continue;
            }
        }
        if chars[i] == '{' || chars[i] == '}' {
            i += 1;
            continue;
        }
        result.push(chars[i]);
        i += 1;
    }
    result.trim_end().to_string()
}
