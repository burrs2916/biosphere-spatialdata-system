use crate::domain::cad::{
    cad_entities_bbox, cad_entity_bbox, CadDocument, CadEntity, CadExtents, CadLayer, CadLwVertex,
    CadPoint, CadProfile, CadProfileFlags, ParseDiagnostics, ParseResult,
};
use acadrust::entities::{
    BoundaryEdge, HatchPatternType, HatchStyleType, TextHorizontalAlignment, TextVerticalAlignment,
};
use acadrust::types::Matrix3;
use acadrust::{CadDocument as AcadDocument, Color, DwgReader, DxfReader, EntityType, Vector3};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

fn decode_dxf_unicode(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\\'
            && i + 1 < chars.len()
            && chars[i + 1] == 'U'
            && i + 2 < chars.len()
            && chars[i + 2] == '+'
        {
            let hex_start = i + 3;
            let mut hex_end = hex_start;
            while hex_end < chars.len() && hex_end - hex_start < 6 {
                let c = chars[hex_end];
                if c.is_ascii_hexdigit() {
                    hex_end += 1;
                } else {
                    break;
                }
            }
            if hex_end > hex_start {
                let hex_str: String = chars[hex_start..hex_end].iter().collect();
                if let Ok(code_point) = u32::from_str_radix(&hex_str, 16) {
                    if let Some(ch) = char::from_u32(code_point) {
                        result.push(ch);
                        i = hex_end;
                        continue;
                    }
                }
            }
        }
        result.push(chars[i]);
        i += 1;
    }
    result
}

fn fix_garbled_text(s: &str) -> String {
    let s = decode_dxf_unicode(s);

    let has_latin1_extended = s.chars().any(|c| (c as u32) >= 0x80 && (c as u32) <= 0xFF);
    if !has_latin1_extended {
        return s;
    }

    let mut result = String::with_capacity(s.len());
    let mut gbk_buf: Vec<u8> = Vec::new();

    for c in s.chars() {
        if (c as u32) <= 0xFF {
            gbk_buf.push(c as u8);
        } else {
            if !gbk_buf.is_empty() {
                result.push_str(&decode_gbk_segments(&gbk_buf));
                gbk_buf.clear();
            }
            result.push(c);
        }
    }

    if !gbk_buf.is_empty() {
        result.push_str(&decode_gbk_segments(&gbk_buf));
    }

    result
}

fn is_common_latin1_symbol(b: u8) -> bool {
    matches!(
        b,
        0xB0 | // °
        0xB1 | // ±
        0xB2 | // ²
        0xB3 | // ³
        0xB5 | // µ
        0xB9 | // ¹
        0xD7 | // ×
        0xF7 // ÷
    )
}

fn decode_gbk_segments(bytes: &[u8]) -> String {
    let mut result = String::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        let b = bytes[i];

        if b <= 0x7F {
            result.push(b as char);
            i += 1;
        } else if b >= 0x81 && b <= 0xFE && i + 1 < bytes.len() {
            let next = bytes[i + 1];
            if (next >= 0x40 && next <= 0x7E) || (next >= 0x80 && next <= 0xFE) {
                if is_common_latin1_symbol(b) && next.is_ascii_alphabetic() {
                    result.push(b as char);
                    i += 1;
                } else {
                    let (decoded, _, _) = encoding_rs::GBK.decode(&bytes[i..i + 2]);
                    let decoded_str = decoded.to_string();
                    if decoded_str.chars().count() == 1 && !decoded_str.contains('\u{FFFD}') {
                        result.push_str(&decoded_str);
                        i += 2;
                    } else {
                        result.push(b as char);
                        i += 1;
                    }
                }
            } else {
                result.push(b as char);
                i += 1;
            }
        } else {
            result.push(b as char);
            i += 1;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_gbk_segments_pure_gbk() {
        let gbk_bytes: Vec<u8> = vec![0xCB, 0xB5, 0xC3, 0xF7, 0xA3, 0xBA];
        let result = decode_gbk_segments(&gbk_bytes);
        assert_eq!(result, "说明：");
    }

    #[test]
    fn test_decode_gbk_segments_mixed_with_ascii() {
        let gbk_bytes: Vec<u8> = vec![0xCB, 0xB5, 0xC3, 0xF7, 0xA3, 0xBA, 0x20, 0x31, 0x2E];
        let result = decode_gbk_segments(&gbk_bytes);
        assert_eq!(result, "说明： 1.");
    }

    #[test]
    fn test_decode_gbk_segments_standalone_latin1() {
        let bytes: Vec<u8> = vec![0x6D, 0xB3, 0x2F, 0x6D, 0x69, 0x6E];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "m³/min");
    }

    #[test]
    fn test_decode_gbk_segments_mixed_gbk_and_superscript() {
        let bytes: Vec<u8> = vec![
            0xCB, 0xB5, 0xC3, 0xF7, 0xA3, 0xBA, 0x20, 0x31, 0x2E, 0xCD, 0xBC, 0xD6, 0xD0, 0xB7,
            0xE7, 0xC1, 0xBF, 0x51, 0xB5, 0xA5, 0xCE, 0xBB, 0xCE, 0xAA, 0x6D, 0xB3, 0x2F, 0x6D,
            0x69, 0x6E,
        ];
        let result = decode_gbk_segments(&bytes);
        assert!(result.contains("说明："));
        assert!(result.contains("m³/min"));
        assert!(!result.contains("Ë"));
        assert!(!result.contains("Ã"));
    }

    #[test]
    fn test_fix_garbled_text_mine_ventilation() {
        let garbled = "ËµÃ÷£º 1.Í¼ÖÐ·çÁ¿Qµ¥Î»Îªm³/min£¬·çËÙVµ¥Î»Îªm/s";
        let result = fix_garbled_text(garbled);
        assert!(
            result.contains("说明："),
            "Expected 说明： but got: {}",
            result
        );
        assert!(
            result.contains("m³/min"),
            "Expected m³/min but got: {}",
            result
        );
        assert!(result.contains("m/s"), "Expected m/s but got: {}", result);
        assert!(!result.contains("Ëµ"), "Should not contain garbled text");
    }

    #[test]
    fn test_fix_garbled_text_pure_ascii() {
        let result = fix_garbled_text("Hello World");
        assert_eq!(result, "Hello World");
    }

    #[test]
    fn test_fix_garbled_text_preserves_unicode() {
        let input = "说明： m³/min";
        let result = fix_garbled_text(input);
        assert_eq!(result, "说明： m³/min");
    }

    #[test]
    fn test_decode_gbk_segments_degree_symbol() {
        let bytes: Vec<u8> = vec![0x30, 0xB0, 0x43];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "0°C");
    }

    #[test]
    fn test_decode_gbk_segments_trailing_lead_byte() {
        let bytes: Vec<u8> = vec![0xCB, 0xB5, 0xC3];
        let result = decode_gbk_segments(&bytes);
        assert!(result.starts_with("说"));
    }

    #[test]
    fn test_fix_garbled_text_mine_full_text() {
        let garbled = "ËµÃ÷£º 1.Í¼ÖÐ·çÁ¿Qµ¥Î»Îªm³/min£¬·çËÙVµ¥Î»Îªm/s£¬ÏïµÀ¶ÏÃæSÎª©O£¬ÏïµÀ³¤¶ÈLµ¥Î»Îªm¡£ 2.Í¼ÖÐ±ê×¢·çÁ¿Îª Äê ÔÂ ÈÕÊµ²â·çÁ¿¡£";
        let result = fix_garbled_text(garbled);
        assert!(result.contains("说明："), "Result: {}", result);
        assert!(result.contains("m³/min"), "Result: {}", result);
        assert!(result.contains("m/s"), "Result: {}", result);
        assert!(result.contains("巷道"), "Result: {}", result);
        assert!(result.contains("实测"), "Result: {}", result);
    }

    #[test]
    fn test_decode_gbk_degree_celsius() {
        let bytes: Vec<u8> = vec![0x30, 0xB0, 0x43];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "0°C");
    }

    #[test]
    fn test_decode_gbk_degree_fahrenheit() {
        let bytes: Vec<u8> = vec![0x32, 0x35, 0xB0, 0x46];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "25°F");
    }

    #[test]
    fn test_decode_gbk_superscript_2_with_letter() {
        let bytes: Vec<u8> = vec![0xB2, 0x6D];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "²m");
    }

    #[test]
    fn test_decode_gbk_gbk_pair_with_b0_lead() {
        let bytes: Vec<u8> = vec![0xB0, 0xA1];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "啊");
    }

    #[test]
    fn test_decode_gbk_multiply_sign() {
        let bytes: Vec<u8> = vec![0x33, 0xD7, 0x34];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "3×4");
    }

    #[test]
    fn test_decode_gbk_plus_minus() {
        let bytes: Vec<u8> = vec![0xB1, 0x30, 0x2E, 0x35];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "±0.5");
    }

    #[test]
    fn test_decode_gbk_square_meter_symbol() {
        let bytes: Vec<u8> = vec![0xA9, 0x4F];
        let result = decode_gbk_segments(&bytes);
        assert_eq!(result, "㎡");
    }

    #[test]
    fn test_fix_garbled_text_mixed_unicode_and_garbled() {
        let input = "温度30°C，ËµÃ÷£º测试";
        let result = fix_garbled_text(input);
        assert!(result.contains("30°C"), "Result: {}", result);
        assert!(result.contains("说明："), "Result: {}", result);
    }
}

struct MTextFormatInfo {
    content: String,
    width_factor: f64,
    font_name: String,
    height_scale: f64,
}

fn parse_mtext_format(s: &str) -> MTextFormatInfo {
    let s = fix_garbled_text(s);
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::new();
    let mut i = 0;

    let mut width_factor: f64 = 1.0;
    let mut font_name = String::new();
    let mut height_scale: f64 = 1.0;

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

            let code_text: String = chars[i + 1..j].iter().collect();

            if cmd == 'W' || cmd == 'w' {
                if let Ok(wf) = code_text[1..].parse::<f64>() {
                    if wf > 0.0 {
                        width_factor = wf;
                    }
                }
            } else if cmd == 'F' || cmd == 'f' {
                let fname: String = code_text[1..].split('|').next().unwrap_or("").to_string();
                if !fname.is_empty() {
                    font_name = fname;
                }
            } else if cmd == 'H' || cmd == 'h' {
                let htext = &code_text[1..];
                if htext.ends_with('x') {
                    if let Ok(hs) = htext[..htext.len() - 1].parse::<f64>() {
                        if hs > 0.0 {
                            height_scale = hs;
                        }
                    }
                } else {
                    if let Ok(hs) = htext.parse::<f64>() {
                        if hs > 0.0 {
                            height_scale = hs;
                        }
                    }
                }
            }

            if j < chars.len() && chars[j] == ';' {
                i = j + 1;
                continue;
            }

            i = j;
            continue;
        }

        if chars[i] == '{' || chars[i] == '}' {
            i += 1;
            continue;
        }

        result.push(chars[i]);
        i += 1;
    }

    MTextFormatInfo {
        content: result.trim_end().to_string(),
        width_factor,
        font_name,
        height_scale,
    }
}

fn parse_dxf_from_bytes(
    data: Vec<u8>,
) -> Result<AcadDocument, Box<dyn std::error::Error + Send + Sync>> {
    let cursor = std::io::Cursor::new(data);
    let reader = DxfReader::from_reader(cursor)?;
    reader.read().map_err(|e| e.into())
}

fn parse_dwg_from_bytes(
    data: Vec<u8>,
) -> Result<AcadDocument, Box<dyn std::error::Error + Send + Sync>> {
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    reader.read().map_err(|e| e.into())
}

/// 坐标值合理性阈值：超过此绝对值的有限坐标几乎一定是数据损坏
/// （常见于某些 CAD 实体含 10^250 级别的"phantom"坐标）。
/// 1e9 ≈ 十亿级，覆盖绝大部分真实矿用坐标（矿用坐标通常在十万级），
/// 但能过滤掉 10^15 及以上的荒谬值。
const COORD_SANITY_THRESHOLD: f64 = 1e9;

fn sanitize_f64(v: f64) -> f64 {
    if v.is_finite() && v.abs() < COORD_SANITY_THRESHOLD {
        v
    } else {
        0.0
    }
}

/// 检查单个 f64 值是否为有效坐标分量。
/// 与 sanitize_f64 不同，此函数不将无效值置零，而是返回 false 让调用方跳过整个实体。
fn is_valid_coord(v: f64) -> bool {
    v.is_finite() && v.abs() < COORD_SANITY_THRESHOLD
}

/// 安全的坐标转换：如果 x 或 y 是 NaN/Inf/超大值，返回 None。
/// 调用方应当跳过返回 None 的实体，而非画一个 (0,0) 的"幽灵几何"。
fn sanitize_point(x: f64, y: f64, z: f64) -> Option<CadPoint> {
    if !is_valid_coord(x) || !is_valid_coord(y) {
        return None;
    }
    let z = if is_valid_coord(z) {
        sanitize_f64(z)
    } else {
        0.0
    };
    Some(CadPoint {
        x: sanitize_f64(x),
        y: sanitize_f64(y),
        z,
    })
}

/// 保留旧行为的坐标转换，用于非关键坐标（如 z 轴辅助信息）。
/// 任何无效分量都会被置零，适用于可以容忍精度损失的辅助字段。
fn convert_point(x: f64, y: f64, z: f64) -> CadPoint {
    CadPoint {
        x: sanitize_f64(x),
        y: sanitize_f64(y),
        z: sanitize_f64(z),
    }
}

fn color_to_rgb(color: &Color) -> i32 {
    match color {
        Color::ByLayer => (255 << 16) | (255 << 8) | 255,
        Color::ByBlock => (255 << 16) | (255 << 8) | 255,
        Color::Index(idx) => {
            let colors = [
                (0, 0, 0),
                (255, 0, 0),
                (255, 255, 0),
                (0, 255, 0),
                (0, 255, 255),
                (0, 0, 255),
                (255, 0, 255),
                (255, 255, 255),
                (65, 65, 65),
                (128, 128, 128),
                (255, 0, 0),
                (255, 127, 127),
                (204, 0, 0),
                (204, 102, 102),
                (153, 0, 0),
                (153, 76, 76),
                (127, 0, 0),
                (127, 63, 63),
                (76, 0, 0),
                (76, 38, 38),
                (255, 63, 0),
                (255, 159, 127),
                (204, 51, 0),
                (204, 127, 102),
                (153, 38, 0),
                (153, 95, 76),
                (127, 31, 0),
                (127, 79, 63),
                (76, 19, 0),
                (76, 47, 38),
                (255, 127, 0),
                (255, 191, 127),
                (204, 102, 0),
                (204, 153, 102),
                (153, 76, 0),
                (153, 114, 76),
                (127, 63, 0),
                (127, 95, 63),
                (76, 38, 0),
                (76, 57, 38),
                (255, 191, 0),
                (255, 223, 127),
                (204, 153, 0),
                (204, 178, 102),
                (153, 114, 0),
                (153, 133, 76),
                (127, 95, 0),
                (127, 111, 63),
                (76, 57, 0),
                (76, 66, 38),
                (255, 255, 0),
                (255, 255, 127),
                (204, 204, 0),
                (204, 204, 102),
                (153, 153, 0),
                (153, 153, 76),
                (127, 127, 0),
                (127, 127, 63),
                (76, 76, 0),
                (76, 76, 38),
                (191, 255, 0),
                (223, 255, 127),
                (153, 204, 0),
                (178, 204, 102),
                (114, 153, 0),
                (133, 153, 76),
                (95, 127, 0),
                (111, 127, 63),
                (57, 76, 0),
                (66, 76, 38),
                (127, 255, 0),
                (191, 255, 127),
                (102, 204, 0),
                (153, 204, 102),
                (76, 153, 0),
                (114, 153, 76),
                (63, 127, 0),
                (95, 127, 63),
                (38, 76, 0),
                (57, 76, 38),
                (63, 255, 0),
                (159, 255, 127),
                (51, 204, 0),
                (127, 204, 102),
                (38, 153, 0),
                (95, 153, 76),
                (31, 127, 0),
                (79, 127, 63),
                (19, 76, 0),
                (47, 76, 38),
                (0, 255, 0),
                (127, 255, 127),
                (0, 204, 0),
                (102, 204, 102),
                (0, 153, 0),
                (76, 153, 76),
                (0, 127, 0),
                (63, 127, 63),
                (0, 76, 0),
                (38, 76, 38),
                (0, 255, 63),
                (127, 255, 159),
                (0, 204, 51),
                (102, 204, 127),
                (0, 153, 38),
                (76, 153, 95),
                (0, 127, 31),
                (63, 127, 79),
                (0, 76, 19),
                (38, 76, 47),
                (0, 255, 127),
                (127, 255, 191),
                (0, 204, 102),
                (102, 204, 153),
                (0, 153, 76),
                (76, 153, 114),
                (0, 127, 63),
                (63, 127, 95),
                (0, 76, 38),
                (38, 76, 57),
                (0, 255, 191),
                (127, 255, 223),
                (0, 204, 153),
                (102, 204, 178),
                (0, 153, 114),
                (76, 153, 133),
                (0, 127, 95),
                (63, 127, 111),
                (0, 76, 57),
                (38, 76, 66),
                (0, 255, 255),
                (127, 255, 255),
                (0, 204, 204),
                (102, 204, 204),
                (0, 153, 153),
                (76, 153, 153),
                (0, 127, 127),
                (63, 127, 127),
                (0, 76, 76),
                (38, 76, 76),
                (0, 191, 255),
                (127, 223, 255),
                (0, 153, 204),
                (102, 178, 204),
                (0, 114, 153),
                (76, 133, 153),
                (0, 95, 127),
                (63, 111, 127),
                (0, 57, 76),
                (38, 66, 76),
                (0, 127, 255),
                (127, 191, 255),
                (0, 102, 204),
                (102, 153, 204),
                (0, 76, 153),
                (76, 114, 153),
                (0, 63, 127),
                (63, 95, 127),
                (0, 38, 76),
                (38, 57, 76),
                (0, 63, 255),
                (127, 159, 255),
                (0, 51, 204),
                (102, 127, 204),
                (0, 38, 153),
                (76, 95, 153),
                (0, 31, 127),
                (63, 79, 127),
                (0, 19, 76),
                (38, 47, 76),
                (0, 0, 255),
                (127, 127, 255),
                (0, 0, 204),
                (102, 102, 204),
                (0, 0, 153),
                (76, 76, 153),
                (0, 0, 127),
                (63, 63, 127),
                (0, 0, 76),
                (38, 38, 76),
                (63, 0, 255),
                (159, 127, 255),
                (51, 0, 204),
                (127, 102, 204),
                (38, 0, 153),
                (95, 76, 153),
                (31, 0, 127),
                (79, 63, 127),
                (19, 0, 76),
                (47, 38, 76),
                (127, 0, 255),
                (191, 127, 255),
                (102, 0, 204),
                (153, 102, 204),
                (76, 0, 153),
                (114, 76, 153),
                (63, 0, 127),
                (95, 63, 127),
                (38, 0, 76),
                (57, 38, 76),
                (191, 0, 255),
                (223, 127, 255),
                (153, 0, 204),
                (178, 102, 204),
                (114, 0, 153),
                (133, 76, 153),
                (95, 0, 127),
                (111, 63, 127),
                (57, 0, 76),
                (66, 38, 76),
                (255, 0, 255),
                (255, 127, 255),
                (204, 0, 204),
                (204, 102, 204),
                (153, 0, 153),
                (153, 76, 153),
                (127, 0, 127),
                (127, 63, 127),
                (76, 0, 76),
                (76, 38, 76),
                (255, 0, 191),
                (255, 127, 223),
                (204, 0, 153),
                (204, 102, 178),
                (153, 0, 114),
                (153, 76, 133),
                (127, 0, 95),
                (127, 63, 111),
                (76, 0, 57),
                (76, 38, 66),
                (255, 0, 127),
                (255, 127, 191),
                (204, 0, 102),
                (204, 102, 153),
                (153, 0, 76),
                (153, 76, 114),
                (127, 0, 63),
                (127, 63, 95),
                (76, 0, 38),
                (76, 38, 57),
                (255, 0, 63),
                (255, 127, 159),
                (204, 0, 51),
                (204, 102, 127),
                (153, 0, 38),
                (153, 76, 95),
                (127, 0, 31),
                (127, 63, 79),
                (76, 0, 19),
                (76, 38, 47),
                (84, 84, 84),
                (127, 127, 127),
                (170, 170, 170),
                (212, 212, 212),
            ];
            let idx = (*idx as usize).min(colors.len() - 1);
            let (r, g, b) = colors[idx];
            (r << 16) | (g << 8) | b
        }
        Color::Rgb { r, g, b } => ((*r as i32) << 16) | ((*g as i32) << 8) | (*b as i32),
    }
}

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
            let c_max = global_max;
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

fn find_significant_cluster_range(sorted_vals: &[f64]) -> (f64, f64) {
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

    if significant.len() == 1 {
        let c = &significant[0];
        return (c.min, c.max);
    }

    let mut merged_min = f64::MAX;
    let mut merged_max = f64::MIN;
    for c in &significant {
        merged_min = merged_min.min(c.min);
        merged_max = merged_max.max(c.max);
    }

    (merged_min, merged_max)
}

fn calculate_extents(entities: &[CadEntity]) -> Option<CadExtents> {
    cad_entities_bbox(entities).and_then(|bounds| bounds.to_extents())
}

fn resolve_color(
    raw_color: &Color,
    layer: &str,
    layer_colors: &HashMap<String, i32>,
    insert_color: Option<i32>,
) -> i32 {
    match raw_color {
        Color::ByLayer => *layer_colors
            .get(layer)
            .unwrap_or(&(255 << 16 | 255 << 8 | 255)),
        Color::ByBlock => insert_color.unwrap_or(255 << 16 | 255 << 8 | 255),
        _ => color_to_rgb(raw_color),
    }
}

/// INSERT 块参照展开的最大嵌套深度。
/// 超过此深度的嵌套 INSERT 将被跳过，防止栈溢出。
/// AutoCAD 本身限制嵌套深度为 256，我们取更保守的值以兼顾性能。
const INSERT_MAX_DEPTH: u32 = 16;

fn explode_insert_recursive(
    insert: &acadrust::entities::Insert,
    doc: &AcadDocument,
    insert_color: i32,
    layer_colors: &HashMap<String, i32>,
    entities: &mut Vec<CadEntity>,
    entity_count: &mut usize,
    depth: u32,
    visited: &mut HashSet<String>,
) {
    // 深度限制：防止过深嵌套导致栈溢出
    if depth > INSERT_MAX_DEPTH {
        return;
    }

    // 循环引用检测：如果块名已在访问路径中，跳过
    let block_name = insert.block_name.clone();
    if visited.contains(&block_name) {
        return;
    }
    visited.insert(block_name.clone());

    let exploded = insert.explode_from_document(doc);
    for sub_entity in exploded {
        if let EntityType::Insert(ref nested_insert) = sub_entity {
            let nested_layer = nested_insert.common.layer.clone();
            let nested_insert_color = resolve_color(
                &nested_insert.common.color,
                &nested_layer,
                layer_colors,
                Some(insert_color),
            );
            explode_insert_recursive(
                nested_insert,
                doc,
                nested_insert_color,
                layer_colors,
                entities,
                entity_count,
                depth + 1,
                visited,
            );
            continue;
        }

        *entity_count += 1;
        let id = format!("entity_{}", entity_count);
        let layer = fix_garbled_text(&sub_entity.common().layer);
        let color = resolve_color(
            &sub_entity.common().color,
            &sub_entity.common().layer,
            layer_colors,
            Some(insert_color),
        );
        let line_weight = 1.0;

        if let Some(cad_entity) = convert_entity(sub_entity, id, layer, color, line_weight) {
            entities.push(cad_entity);
        }
    }

    // 回溯：移除当前块名，允许同名块在不同分支中出现
    visited.remove(&block_name);
}

/// 取一个 CadEntity 的坐标边界框 (min_x, max_x, min_y, max_y)。
/// 用于判断实体是否在主集群范围之外——完全在范围外的实体应被视为散点丢弃。
fn entity_coord_bounds(entity: &CadEntity) -> (f64, f64, f64, f64) {
    let bounds = cad_entity_bbox(entity);
    (bounds.min_x, bounds.max_x, bounds.min_y, bounds.max_y)
}

fn collect_raw_coords(entities: &[CadEntity], xs: &mut Vec<f64>, ys: &mut Vec<f64>) {
    for entity in entities {
        match entity {
            CadEntity::Line { start, end, .. } => {
                xs.push(start.x);
                ys.push(start.y);
                xs.push(end.x);
                ys.push(end.y);
            }
            CadEntity::Circle { center, .. } => {
                xs.push(center.x);
                ys.push(center.y);
            }
            CadEntity::Arc { center, .. } => {
                xs.push(center.x);
                ys.push(center.y);
            }
            CadEntity::Ellipse { center, .. } => {
                xs.push(center.x);
                ys.push(center.y);
            }
            CadEntity::Polyline { vertices, .. } => {
                for v in vertices {
                    xs.push(v.x);
                    ys.push(v.y);
                }
            }
            CadEntity::LwPolyline { vertices, .. } => {
                for v in vertices {
                    xs.push(v.x);
                    ys.push(v.y);
                }
            }
            CadEntity::Spline {
                control_points,
                fit_points,
                ..
            } => {
                for p in control_points {
                    xs.push(p.x);
                    ys.push(p.y);
                }
                for p in fit_points {
                    xs.push(p.x);
                    ys.push(p.y);
                }
            }
            CadEntity::Text { position, .. } | CadEntity::MText { position, .. } => {
                xs.push(position.x);
                ys.push(position.y);
            }
            CadEntity::Solid { points, .. } => {
                for p in points {
                    xs.push(p.x);
                    ys.push(p.y);
                }
            }
            CadEntity::Point { position, .. } => {
                xs.push(position.x);
                ys.push(position.y);
            }
            CadEntity::Insert { position, .. } => {
                xs.push(position.x);
                ys.push(position.y);
            }
            CadEntity::Hatch { boundaries, .. } => {
                for path in boundaries {
                    for v in path {
                        xs.push(v.x);
                        ys.push(v.y);
                    }
                }
            }
            CadEntity::Dimension {
                definition_point,
                text_midpoint,
                ..
            } => {
                xs.push(definition_point.x);
                ys.push(definition_point.y);
                xs.push(text_midpoint.x);
                ys.push(text_midpoint.y);
            }
            CadEntity::Leader { vertices, .. } => {
                for v in vertices {
                    xs.push(v.x);
                    ys.push(v.y);
                }
            }
            CadEntity::AttributeEntity { position, .. } => {
                xs.push(position.x);
                ys.push(position.y);
            }
            CadEntity::Face3D { points, .. } => {
                for p in points {
                    xs.push(p.x);
                    ys.push(p.y);
                }
            }
            CadEntity::Polyline2D { vertices, .. } => {
                for v in vertices {
                    xs.push(v.x);
                    ys.push(v.y);
                }
            }
            CadEntity::Table { position, .. } => {
                xs.push(position.x);
                ys.push(position.y);
            }
        }
    }
}

#[allow(dead_code)]
fn median_sorted(sorted: &[f64]) -> f64 {
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

fn apply_coordinate_offset(entity: &mut CadEntity, offset_x: f64, offset_y: f64) {
    match entity {
        CadEntity::Line { start, end, .. } => {
            start.x -= offset_x;
            start.y -= offset_y;
            end.x -= offset_x;
            end.y -= offset_y;
        }
        CadEntity::Circle { center, .. } => {
            center.x -= offset_x;
            center.y -= offset_y;
        }
        CadEntity::Arc { center, .. } => {
            center.x -= offset_x;
            center.y -= offset_y;
        }
        CadEntity::Ellipse { center, .. } => {
            center.x -= offset_x;
            center.y -= offset_y;
        }
        CadEntity::Polyline { vertices, .. } => {
            for v in vertices {
                v.x -= offset_x;
                v.y -= offset_y;
            }
        }
        CadEntity::LwPolyline { vertices, .. } => {
            for v in vertices {
                v.x -= offset_x;
                v.y -= offset_y;
            }
        }
        CadEntity::Spline {
            control_points,
            fit_points,
            ..
        } => {
            for p in control_points {
                p.x -= offset_x;
                p.y -= offset_y;
            }
            for p in fit_points {
                p.x -= offset_x;
                p.y -= offset_y;
            }
        }
        CadEntity::Text { position, .. } | CadEntity::MText { position, .. } => {
            position.x -= offset_x;
            position.y -= offset_y;
        }
        CadEntity::Solid { points, .. } => {
            for p in points {
                p.x -= offset_x;
                p.y -= offset_y;
            }
        }
        CadEntity::Point { position, .. } => {
            position.x -= offset_x;
            position.y -= offset_y;
        }
        CadEntity::Insert { position, .. } => {
            position.x -= offset_x;
            position.y -= offset_y;
        }
        CadEntity::Hatch { boundaries, .. } => {
            for path in boundaries {
                for v in path {
                    v.x -= offset_x;
                    v.y -= offset_y;
                }
            }
        }
        CadEntity::Dimension {
            definition_point,
            text_midpoint,
            ..
        } => {
            definition_point.x -= offset_x;
            definition_point.y -= offset_y;
            text_midpoint.x -= offset_x;
            text_midpoint.y -= offset_y;
        }
        CadEntity::Leader { vertices, .. } => {
            for v in vertices {
                v.x -= offset_x;
                v.y -= offset_y;
            }
        }
        CadEntity::AttributeEntity { position, .. } => {
            position.x -= offset_x;
            position.y -= offset_y;
        }
        CadEntity::Face3D { points, .. } => {
            for p in points {
                p.x -= offset_x;
                p.y -= offset_y;
            }
        }
        CadEntity::Polyline2D { vertices, .. } => {
            for v in vertices {
                v.x -= offset_x;
                v.y -= offset_y;
            }
        }
        CadEntity::Table { position, .. } => {
            position.x -= offset_x;
            position.y -= offset_y;
        }
    }
}

/// 矿用 CAD 图常常是「图框/标题在图纸空间(paper space)、设备线路在模型空间(model space)」的两套坐标系。
/// 模型空间坐标范围在数十万级别，图纸空间是 A0/A1 那种 0~1000 的小范围。
/// 二者混在一起渲染时，`extents` 被两套坐标拉爆，结果就是图被压成一个点。
///
/// entity_mode 语义：
///   None 或 Some(2) → 模型空间实体（应该保留）
///   Some(1)         → 图纸空间实体（过滤）
///   Some(0)         → "owned" 实体，即属于某个块定义（BlockTable）的子实体。
///                      它们的坐标是块局部坐标系（通常在原点附近），
///                      实际渲染应通过 INSERT 展开获得（explode_insert_recursive），
///                      不应作为顶层实体直接渲染——否则会在原点附近产生大量"散点"。
fn is_in_paper_space(common: &acadrust::entities::EntityCommon) -> bool {
    matches!(common.entity_mode, Some(1))
}

fn is_block_definition(common: &acadrust::entities::EntityCommon) -> bool {
    matches!(common.entity_mode, Some(0))
}

fn profile_dwg(doc: &AcadDocument, file_size: u64) -> CadProfile {
    let mut entity_count = 0;
    let mut lwpoly_huge = 0;
    let mut _lwpoly_total_verts = 0;
    let mut lwpoly_max_verts = 0;
    let mut hatch_count = 0;
    let mut hatch_max_edges = 0;
    let mut text_extreme = 0;
    let mut min_x = f64::MAX;
    let mut max_x = f64::MIN;
    let mut min_y = f64::MAX;
    let mut max_y = f64::MIN;

    for entity in doc.entities() {
        entity_count += 1;
        match &entity {
            EntityType::LwPolyline(lw) => {
                let n = lw.vertices.len();
                _lwpoly_total_verts += n;
                lwpoly_max_verts = lwpoly_max_verts.max(n);
                if n > 1000 {
                    lwpoly_huge += 1;
                }
                for v in &lw.vertices {
                    let x = v.location.x;
                    let y = v.location.y;
                    if x.is_finite() && y.is_finite() {
                        min_x = min_x.min(x);
                        max_x = max_x.max(x);
                        min_y = min_y.min(y);
                        max_y = max_y.max(y);
                    }
                }
            }
            EntityType::Hatch(h) => {
                hatch_count += 1;
                for p in &h.paths {
                    hatch_max_edges = hatch_max_edges.max(p.edges.len());
                }
            }
            EntityType::Text(t) => {
                if t.height > 1000.0 || t.height < 0.01 {
                    text_extreme += 1;
                }
                let p = &t.insertion_point;
                if p.x.is_finite() && p.y.is_finite() {
                    min_x = min_x.min(p.x);
                    max_x = max_x.max(p.x);
                    min_y = min_y.min(p.y);
                    max_y = max_y.max(p.y);
                }
            }
            EntityType::MText(mt) => {
                if mt.height > 1000.0 || mt.height < 0.01 {
                    text_extreme += 1;
                }
                let p = &mt.insertion_point;
                if p.x.is_finite() && p.y.is_finite() {
                    min_x = min_x.min(p.x);
                    max_x = max_x.max(p.x);
                    min_y = min_y.min(p.y);
                    max_y = max_y.max(p.y);
                }
            }
            EntityType::Line(l) => {
                for p in [&l.start, &l.end] {
                    if p.x.is_finite() && p.y.is_finite() {
                        min_x = min_x.min(p.x);
                        max_x = max_x.max(p.x);
                        min_y = min_y.min(p.y);
                        max_y = max_y.max(p.y);
                    }
                }
            }
            EntityType::Circle(c) => {
                let x = c.center.x;
                let y = c.center.y;
                let r = c.radius;
                if x.is_finite() && y.is_finite() && r.is_finite() {
                    min_x = min_x.min(x - r);
                    max_x = max_x.max(x + r);
                    min_y = min_y.min(y - r);
                    max_y = max_y.max(y + r);
                }
            }
            EntityType::Arc(a) => {
                let x = a.center.x;
                let y = a.center.y;
                let r = a.radius;
                if x.is_finite() && y.is_finite() && r.is_finite() {
                    min_x = min_x.min(x - r);
                    max_x = max_x.max(x + r);
                    min_y = min_y.min(y - r);
                    max_y = max_y.max(y + r);
                }
            }
            EntityType::Insert(ins) => {
                let x = ins.insert_point.x;
                let y = ins.insert_point.y;
                if x.is_finite() && y.is_finite() {
                    min_x = min_x.min(x);
                    max_x = max_x.max(x);
                    min_y = min_y.min(y);
                    max_y = max_y.max(y);
                }
            }
            EntityType::Spline(sp) => {
                for p in &sp.control_points {
                    if p.x.is_finite() && p.y.is_finite() {
                        min_x = min_x.min(p.x);
                        max_x = max_x.max(p.x);
                        min_y = min_y.min(p.y);
                        max_y = max_y.max(p.y);
                    }
                }
                for p in &sp.fit_points {
                    if p.x.is_finite() && p.y.is_finite() {
                        min_x = min_x.min(p.x);
                        max_x = max_x.max(p.x);
                        min_y = min_y.min(p.y);
                        max_y = max_y.max(p.y);
                    }
                }
            }
            EntityType::Polyline(poly) => {
                for v in &poly.vertices {
                    let x = v.location.x;
                    let y = v.location.y;
                    if x.is_finite() && y.is_finite() {
                        min_x = min_x.min(x);
                        max_x = max_x.max(x);
                        min_y = min_y.min(y);
                        max_y = max_y.max(y);
                    }
                }
            }
            EntityType::Ellipse(el) => {
                let x = el.center.x;
                let y = el.center.y;
                if x.is_finite() && y.is_finite() {
                    let major_len = (el.major_axis.x.powi(2) + el.major_axis.y.powi(2)).sqrt();
                    if major_len.is_finite() {
                        let r = major_len;
                        min_x = min_x.min(x - r);
                        max_x = max_x.max(x + r);
                        min_y = min_y.min(y - r);
                        max_y = max_y.max(y + r);
                    } else {
                        min_x = min_x.min(x);
                        max_x = max_x.max(x);
                        min_y = min_y.min(y);
                        max_y = max_y.max(y);
                    }
                }
            }
            EntityType::Solid(s) => {
                for p in [
                    &s.first_corner,
                    &s.second_corner,
                    &s.third_corner,
                    &s.fourth_corner,
                ] {
                    if p.x.is_finite() && p.y.is_finite() {
                        min_x = min_x.min(p.x);
                        max_x = max_x.max(p.x);
                        min_y = min_y.min(p.y);
                        max_y = max_y.max(p.y);
                    }
                }
            }
            EntityType::Point(pt) => {
                let x = pt.location.x;
                let y = pt.location.y;
                if x.is_finite() && y.is_finite() {
                    min_x = min_x.min(x);
                    max_x = max_x.max(x);
                    min_y = min_y.min(y);
                    max_y = max_y.max(y);
                }
            }
            EntityType::Dimension(dim) => {
                let base = dim.base();
                let p = &base.definition_point;
                if p.x.is_finite() && p.y.is_finite() {
                    min_x = min_x.min(p.x);
                    max_x = max_x.max(p.x);
                    min_y = min_y.min(p.y);
                    max_y = max_y.max(p.y);
                }
                let p2 = &base.text_middle_point;
                if p2.x.is_finite() && p2.y.is_finite() {
                    min_x = min_x.min(p2.x);
                    max_x = max_x.max(p2.x);
                    min_y = min_y.min(p2.y);
                    max_y = max_y.max(p2.y);
                }
            }
            _ => {}
        }
    }

    let coord_span_x = if max_x.is_finite() && min_x.is_finite() {
        max_x - min_x
    } else {
        0.0
    };
    let coord_span_y = if max_y.is_finite() && min_y.is_finite() {
        max_y - min_y
    } else {
        0.0
    };

    let has_large_coords = coord_span_x > 1_000_000.0 || coord_span_y > 1_000_000.0;
    let has_heavy_lwpoly = lwpoly_huge > 0;
    let has_heavy_hatch = hatch_count > 2000 || hatch_max_edges > 100;
    let has_extreme_text = text_extreme > 0;
    let has_heavy_entity = entity_count >= 30000 || file_size > 20_000_000;
    let has_medium_entity = entity_count >= 5000 && !has_heavy_entity;

    let mut xs_sample = Vec::new();
    let mut ys_sample = Vec::new();
    for entity in doc.entities() {
        match &entity {
            EntityType::Line(l) => {
                if l.start.x.is_finite() && l.start.y.is_finite() {
                    xs_sample.push(l.start.x);
                    ys_sample.push(l.start.y);
                }
                if l.end.x.is_finite() && l.end.y.is_finite() {
                    xs_sample.push(l.end.x);
                    ys_sample.push(l.end.y);
                }
            }
            EntityType::Circle(c) => {
                if c.center.x.is_finite() && c.center.y.is_finite() {
                    xs_sample.push(c.center.x);
                    ys_sample.push(c.center.y);
                }
            }
            EntityType::Insert(ins) => {
                if ins.insert_point.x.is_finite() && ins.insert_point.y.is_finite() {
                    xs_sample.push(ins.insert_point.x);
                    ys_sample.push(ins.insert_point.y);
                }
            }
            EntityType::LwPolyline(lw) => {
                for v in lw.vertices.iter().take(5) {
                    if v.location.x.is_finite() && v.location.y.is_finite() {
                        xs_sample.push(v.location.x);
                        ys_sample.push(v.location.y);
                    }
                }
            }
            _ => {}
        }
        if xs_sample.len() >= 10000 {
            break;
        }
    }
    xs_sample.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    ys_sample.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let x_clusters = find_all_clusters(&xs_sample, 2);
    let y_clusters = find_all_clusters(&ys_sample, 2);

    let sig_x_count = x_clusters
        .iter()
        .filter(|c| c.count as f64 / xs_sample.len().max(1) as f64 > 0.05)
        .count();
    let sig_y_count = y_clusters
        .iter()
        .filter(|c| c.count as f64 / ys_sample.len().max(1) as f64 > 0.05)
        .count();
    let cluster_count = sig_x_count.max(sig_y_count);
    let has_distributed_coords = cluster_count > 1;
    let has_multi_cluster = cluster_count >= 3;

    let mut flags = CadProfileFlags::empty();
    if has_large_coords {
        flags |= CadProfileFlags::LARGE_COORDS;
    }
    if has_heavy_lwpoly {
        flags |= CadProfileFlags::HEAVY_LWPOLY;
    }
    if has_heavy_hatch {
        flags |= CadProfileFlags::HEAVY_HATCH;
    }
    if has_extreme_text {
        flags |= CadProfileFlags::EXTREME_TEXT_HEIGHT;
    }
    if has_distributed_coords {
        flags |= CadProfileFlags::DISTRIBUTED_COORDS;
    }
    if has_medium_entity {
        flags |= CadProfileFlags::MEDIUM_ENTITY;
    }
    if has_multi_cluster {
        flags |= CadProfileFlags::MULTI_CLUSTER;
    }

    if entity_count < 5000 && cluster_count <= 2 && !has_large_coords {
        CadProfile::Light {
            entity_count,
            coord_span_x,
            coord_span_y,
        }
    } else if entity_count < 15000 && cluster_count <= 3 {
        let mut f = flags;
        f.set(CadProfileFlags::LARGE_COORDS, false);
        f.set(CadProfileFlags::MULTI_CLUSTER, false);
        CadProfile::Standard {
            entity_count,
            coord_span_x,
            coord_span_y,
            flags: f,
        }
    } else if entity_count < 30000 && cluster_count <= 5 {
        CadProfile::Heavy {
            entity_count,
            coord_span_x,
            coord_span_y,
            flags,
        }
    } else if entity_count < 50000
        || (cluster_count >= 3 && cluster_count <= 8 && entity_count < 50000)
    {
        CadProfile::Mega {
            entity_count,
            flags,
        }
    } else {
        CadProfile::Ultra {
            entity_count,
            flags,
        }
    }
}

const LWPOLYLINE_VERTEX_LIMIT: usize = 5000;

fn apply_lwpolyline_decimation(entities: &mut Vec<CadEntity>) {
    for entity in entities.iter_mut() {
        if let CadEntity::LwPolyline {
            vertices, closed, ..
        } = entity
        {
            if vertices.len() > LWPOLYLINE_VERTEX_LIMIT {
                let step = (vertices.len() as f64 / LWPOLYLINE_VERTEX_LIMIT as f64).ceil() as usize;
                let mut decimated = Vec::with_capacity(LWPOLYLINE_VERTEX_LIMIT + 1);
                let mut i = 0;
                while i < vertices.len() {
                    decimated.push(vertices[i].clone());
                    i += step;
                }
                if let Some(last) = vertices.last() {
                    if decimated.last().map(|v| (v.x, v.y)) != Some((last.x, last.y)) {
                        decimated.push(last.clone());
                    }
                }
                if *closed {
                    if let Some(first) = decimated.first() {
                        if decimated.last().map(|v| (v.x, v.y)) != Some((first.x, first.y)) {
                            decimated.push(first.clone());
                        }
                    }
                }
                let _original = vertices.len();
                *vertices = decimated;
            }
        }
    }
}

const HATCH_MAX_EDGES_PER_PATH: usize = 100;

fn apply_hatch_simplification(entities: &mut Vec<CadEntity>) {
    for entity in entities.iter_mut() {
        if let CadEntity::Hatch {
            boundaries, solid, ..
        } = entity
        {
            boundaries.retain(|path| path.len() <= HATCH_MAX_EDGES_PER_PATH);
            if !*solid && boundaries.iter().map(|p| p.len()).sum::<usize>() > 500 {
                boundaries.clear();
            }
        }
    }
}

const TEXT_HEIGHT_MIN: f64 = 0.1;
const TEXT_HEIGHT_MAX: f64 = 500.0;

fn apply_text_height_clamping(entities: &mut Vec<CadEntity>) {
    for entity in entities.iter_mut() {
        match entity {
            CadEntity::Text { height, .. } | CadEntity::MText { height, .. } => {
                *height = height.clamp(TEXT_HEIGHT_MIN, TEXT_HEIGHT_MAX);
            }
            _ => {}
        }
    }
}

const SMALL_TEXT_THRESHOLD: f64 = 0.5;

fn apply_small_text_simplification(entities: &mut Vec<CadEntity>) {
    entities.retain(|entity| match entity {
        CadEntity::Text { height, .. } | CadEntity::MText { height, .. } => {
            *height >= SMALL_TEXT_THRESHOLD
        }
        _ => true,
    });
}

fn apply_profile_strategies(entities: &mut Vec<CadEntity>, profile: &CadProfile) {
    match profile {
        CadProfile::Light { .. } => {}
        CadProfile::Standard { flags, .. } => {
            if flags.contains(CadProfileFlags::HEAVY_LWPOLY) {
                apply_lwpolyline_decimation(entities);
            }
            if flags.contains(CadProfileFlags::MEDIUM_ENTITY) {
                apply_small_text_simplification(entities);
            }
        }
        CadProfile::Heavy { flags, .. } => {
            if flags.contains(CadProfileFlags::HEAVY_LWPOLY)
                || flags.contains(CadProfileFlags::LARGE_COORDS)
            {
                apply_lwpolyline_decimation(entities);
            }
            if flags.contains(CadProfileFlags::HEAVY_HATCH) {
                apply_hatch_simplification(entities);
            }
            if flags.contains(CadProfileFlags::EXTREME_TEXT_HEIGHT) {
                apply_text_height_clamping(entities);
            }
            if flags.contains(CadProfileFlags::MEDIUM_ENTITY) {
                apply_small_text_simplification(entities);
            }
        }
        CadProfile::Mega { flags, .. } => {
            apply_lwpolyline_decimation(entities);
            if flags.contains(CadProfileFlags::HEAVY_HATCH) {
                apply_hatch_simplification(entities);
            }
            apply_text_height_clamping(entities);
            apply_small_text_simplification(entities);
        }
        CadProfile::Ultra { flags, .. } => {
            apply_lwpolyline_decimation(entities);
            apply_hatch_simplification(entities);
            apply_text_height_clamping(entities);
            apply_small_text_simplification(entities);
            let _ = flags;
        }
        CadProfile::Simple { .. } => {}
        CadProfile::LargeCoordinates { .. } => {}
        CadProfile::HeavyLwPolyline { .. } => {
            apply_lwpolyline_decimation(entities);
        }
        CadProfile::HeavyHatch { .. } => {
            apply_hatch_simplification(entities);
        }
        CadProfile::HeavyEntity { .. } => {
            apply_lwpolyline_decimation(entities);
            apply_small_text_simplification(entities);
        }
        CadProfile::MediumEntity { .. } => {
            apply_small_text_simplification(entities);
        }
        CadProfile::Complex { flags, .. } => {
            if flags.contains(CadProfileFlags::HEAVY_LWPOLY) {
                apply_lwpolyline_decimation(entities);
            }
            if flags.contains(CadProfileFlags::HEAVY_HATCH) {
                apply_hatch_simplification(entities);
            }
            if flags.contains(CadProfileFlags::EXTREME_TEXT_HEIGHT) {
                apply_text_height_clamping(entities);
            }
            if flags.contains(CadProfileFlags::MEDIUM_ENTITY) {
                apply_small_text_simplification(entities);
            }
        }
        CadProfile::Unparseable { .. } => {}
    }
}

fn convert_document(
    doc: AcadDocument,
    file_name: String,
    file_size: u64,
) -> (CadDocument, ParseDiagnostics) {
    let profile = profile_dwg(&doc, file_size);

    let mut entities = Vec::new();
    let mut entity_count = 0;
    let mut paper_space_skipped: usize = 0;
    let mut block_def_skipped: usize = 0;
    let mut invisible_skipped: usize = 0;
    let mut unsupported_types: HashMap<String, usize> = HashMap::new();

    let layer_colors: HashMap<String, i32> = doc
        .layers
        .iter()
        .map(|layer| (layer.name.clone(), color_to_rgb(&layer.color)))
        .collect();
    // 同时保留按图层名快速取 layer 元信息（frozen / off / locked），用于过滤
    let layer_meta: HashMap<String, (bool, bool)> = doc
        .layers
        .iter()
        .map(|l| (l.name.clone(), (l.is_frozen(), l.is_locked())))
        .collect();
    let _ = layer_meta;

    for entity in doc.entities() {
        entity_count += 1;

        let common = entity.common();
        if is_in_paper_space(common) {
            paper_space_skipped += 1;
            continue;
        }
        if is_block_definition(common) {
            // 块定义实体（entity_mode=0）属于 BlockTable，其坐标是块局部坐标。
            // 已通过 explode_insert_recursive 在 INSERT 点展开，不应重复渲染。
            block_def_skipped += 1;
            continue;
        }
        if common.invisible {
            invisible_skipped += 1;
            continue;
        }

        if let EntityType::Insert(ref insert) = entity {
            let insert_layer = insert.common.layer.clone();
            let insert_color =
                resolve_color(&insert.common.color, &insert_layer, &layer_colors, None);
            explode_insert_recursive(
                insert,
                &doc,
                insert_color,
                &layer_colors,
                &mut entities,
                &mut entity_count,
                0,
                &mut HashSet::new(),
            );
            continue;
        }

        let id = format!("entity_{}", entity_count);
        let layer = fix_garbled_text(&entity.common().layer);
        let color = resolve_color(
            &entity.common().color,
            &entity.common().layer,
            &layer_colors,
            None,
        );
        let line_weight = 1.0;

        if let Some(cad_entity) = convert_entity(entity.clone(), id, layer, color, line_weight) {
            entities.push(cad_entity);
        } else {
            // 区分"不支持类型"和"无效几何"：检查是否是已知的支持类型
            let type_name = match &entity {
                EntityType::Line(_)
                | EntityType::Circle(_)
                | EntityType::Arc(_)
                | EntityType::LwPolyline(_)
                | EntityType::Polyline(_)
                | EntityType::Ellipse(_)
                | EntityType::Spline(_)
                | EntityType::Text(_)
                | EntityType::MText(_)
                | EntityType::Solid(_)
                | EntityType::Point(_)
                | EntityType::Insert(_)
                | EntityType::Hatch(_)
                | EntityType::Dimension(_) => "valid_type_invalid_geom".to_string(),
                other => {
                    let full_name = format!("{:?}", other);
                    let short_name = full_name.split('(').next().unwrap_or("Unknown");
                    *unsupported_types.entry(short_name.to_string()).or_insert(0) += 1;
                    short_name.to_string()
                }
            };
            let _ = type_name;
        }
    }
    if paper_space_skipped > 0 || invisible_skipped > 0 || block_def_skipped > 0 {}

    apply_profile_strategies(&mut entities, &profile);

    let mut xs = Vec::with_capacity(entities.len() * 2);
    let mut ys = Vec::with_capacity(entities.len() * 2);
    collect_raw_coords(&entities, &mut xs, &mut ys);

    let (cluster_min_x, cluster_max_x) = if !xs.is_empty() {
        xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        find_significant_cluster_range(&xs)
    } else {
        (0.0, 0.0)
    };
    let (cluster_min_y, cluster_max_y) = if !ys.is_empty() {
        ys.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        find_significant_cluster_range(&ys)
    } else {
        (0.0, 0.0)
    };

    let cluster_span_x = cluster_max_x - cluster_min_x;
    let cluster_span_y = cluster_max_y - cluster_min_y;
    // 大幅放宽离群点过滤 margin（50% + 5000），防止误删图纸角落的细节视图。
    // 之前 margin 仅 5% + 200，对于矿图等大坐标图纸太容易误删有效实体。
    let margin_x = (cluster_span_x * 0.5).max(5000.0);
    let margin_y = (cluster_span_y * 0.5).max(5000.0);
    let reject_min_x = cluster_min_x - margin_x;
    let reject_max_x = cluster_max_x + margin_x;
    let reject_min_y = cluster_min_y - margin_y;
    let reject_max_y = cluster_max_y + margin_y;

    let before_count = entities.len();
    entities.retain(|entity| {
        let (ex_min, ex_max, ey_min, ey_max) = entity_coord_bounds(entity);
        // 如果实体完全在主集群范围之外（含 margin），则丢弃
        !(ex_max < reject_min_x
            || ex_min > reject_max_x
            || ey_max < reject_min_y
            || ey_min > reject_max_y)
    });
    let rejected_outliers = before_count - entities.len();
    // 离群点丢弃统计将在 Step 6 (ParseDiagnostics) 中通过 ParseResult 报告

    // 重新收集过滤后的坐标，用于 offset 计算
    xs.clear();
    ys.clear();
    collect_raw_coords(&entities, &mut xs, &mut ys);

    // 使用最小值而不是中值作为偏移，让坐标从(0,0)开始
    // 这可以避免超大坐标范围导致的渲染精度问题
    let offset_x = if !xs.is_empty() {
        xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        xs[0] // 使用最小值
    } else {
        0.0
    };
    let offset_y = if !ys.is_empty() {
        ys.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        ys[0] // 使用最小值
    } else {
        0.0
    };

    if offset_x != 0.0 || offset_y != 0.0 {
        for entity in &mut entities {
            apply_coordinate_offset(entity, offset_x, offset_y);
        }
    }

    let extents = calculate_extents(&entities);

    let layers: Vec<CadLayer> = doc
        .layers
        .iter()
        .map(|layer| CadLayer {
            name: fix_garbled_text(&layer.name),
            color: color_to_rgb(&layer.color),
            visible: true,
            frozen: layer.is_frozen(),
            locked: layer.is_locked(),
        })
        .collect();
    let unsupported_skipped: usize = unsupported_types.values().sum();

    let cad_doc = CadDocument {
        file_name,
        version: format!("{:?}", doc.version),
        profile,
        extents,
        layers,
        entities,
        entity_count,
        coordinate_offset: CadPoint {
            x: offset_x,
            y: offset_y,
            z: 0.0,
        },
        deleted_snapshots: Default::default(),
    };

    let diagnostics = ParseDiagnostics {
        total_entities_raw: entity_count,
        paper_space_skipped,
        block_def_skipped,
        invisible_skipped,
        unsupported_skipped,
        invalid_geometry_skipped: 0, // 由 convert_entity 内部统计
        outlier_skipped: rejected_outliers,
        profile_simplified: 0, // 由 apply_profile_strategies 内部统计
        unsupported_types,
        insert_max_depth: 0, // 由 explode_insert_recursive 内部统计
        insert_cycle_detected: false,
    };

    (cad_doc, diagnostics)
}

fn is_standard_normal(normal: &Vector3) -> bool {
    const EPS: f64 = 1e-10;
    normal.x.abs() < EPS && normal.y.abs() < EPS && (normal.z - 1.0).abs() < EPS
}

fn ocs_to_wcs(point: Vector3, normal: Vector3) -> Vector3 {
    if is_standard_normal(&normal) {
        return point;
    }
    let matrix = Matrix3::arbitrary_axis(normal);
    matrix * point
}

fn convert_entity(
    entity: EntityType,
    id: String,
    layer: String,
    color: i32,
    line_weight: f64,
) -> Option<CadEntity> {
    match entity {
        EntityType::Line(line) => {
            let start = sanitize_point(line.start.x, line.start.y, line.start.z)?;
            let end = sanitize_point(line.end.x, line.end.y, line.end.z)?;
            Some(CadEntity::Line {
                id,
                layer,
                color,
                start,
                end,
                line_weight,
            })
        }
        EntityType::Circle(circle) => {
            let radius = sanitize_f64(circle.radius);
            if radius <= 0.0 {
                return None;
            }
            let center = if !is_standard_normal(&circle.normal) {
                ocs_to_wcs(circle.center, circle.normal)
            } else {
                circle.center
            };
            let center = sanitize_point(center.x, center.y, center.z)?;
            Some(CadEntity::Circle {
                id,
                layer,
                color,
                center,
                radius,
                line_weight,
            })
        }
        EntityType::Arc(arc) => {
            let radius = sanitize_f64(arc.radius);
            if radius <= 0.0 {
                return None;
            }
            let center = if !is_standard_normal(&arc.normal) {
                ocs_to_wcs(arc.center, arc.normal)
            } else {
                arc.center
            };
            let center = sanitize_point(center.x, center.y, center.z)?;
            Some(CadEntity::Arc {
                id,
                layer,
                color,
                center,
                radius,
                start_angle: sanitize_f64(arc.start_angle),
                end_angle: sanitize_f64(arc.end_angle),
                line_weight,
            })
        }
        EntityType::LwPolyline(lwpoly) => {
            let vertices: Vec<CadLwVertex> = if !is_standard_normal(&lwpoly.normal) {
                let matrix = Matrix3::arbitrary_axis(lwpoly.normal);
                lwpoly
                    .vertices
                    .iter()
                    .filter_map(|v| {
                        let wcs =
                            matrix * Vector3::new(v.location.x, v.location.y, lwpoly.elevation);
                        if is_valid_coord(wcs.x) && is_valid_coord(wcs.y) {
                            Some(CadLwVertex {
                                x: sanitize_f64(wcs.x),
                                y: sanitize_f64(wcs.y),
                                bulge: sanitize_f64(v.bulge),
                            })
                        } else {
                            None
                        }
                    })
                    .collect()
            } else {
                lwpoly
                    .vertices
                    .iter()
                    .filter_map(|v| {
                        if is_valid_coord(v.location.x) && is_valid_coord(v.location.y) {
                            Some(CadLwVertex {
                                x: sanitize_f64(v.location.x),
                                y: sanitize_f64(v.location.y),
                                bulge: sanitize_f64(v.bulge),
                            })
                        } else {
                            None
                        }
                    })
                    .collect()
            };
            // 至少需要2个有效顶点才能构成线段
            if vertices.len() < 2 {
                return None;
            }
            Some(CadEntity::LwPolyline {
                id,
                layer,
                color,
                vertices,
                closed: lwpoly.is_closed,
                line_weight,
            })
        }
        EntityType::Polyline(poly) => {
            let vertices: Vec<CadPoint> = poly
                .vertices
                .iter()
                .filter_map(|v| sanitize_point(v.location.x, v.location.y, v.location.z))
                .collect();
            // 至少需要2个有效顶点
            if vertices.len() < 2 {
                return None;
            }
            Some(CadEntity::Polyline {
                id,
                layer,
                color,
                vertices,
                closed: poly.is_closed(),
                line_weight,
            })
        }
        EntityType::Ellipse(ellipse) => {
            let minor_ratio = sanitize_f64(ellipse.minor_axis_ratio);
            if minor_ratio <= 0.0 {
                return None;
            }
            let (center, major_axis) = if !is_standard_normal(&ellipse.normal) {
                let matrix = Matrix3::arbitrary_axis(ellipse.normal);
                (matrix * ellipse.center, matrix * ellipse.major_axis)
            } else {
                (ellipse.center, ellipse.major_axis)
            };
            let center = sanitize_point(center.x, center.y, center.z)?;
            // major_axis 不是坐标而是向量，用 convert_point 容忍零值
            Some(CadEntity::Ellipse {
                id,
                layer,
                color,
                center,
                major_axis: convert_point(major_axis.x, major_axis.y, major_axis.z),
                minor_axis_ratio: minor_ratio,
                start_angle: sanitize_f64(ellipse.start_parameter),
                end_angle: sanitize_f64(ellipse.end_parameter),
                line_weight,
            })
        }
        EntityType::Spline(spline) => {
            // Spline 的控制点和拟合点使用 sanitize_point 过滤无效坐标
            let control_points: Vec<CadPoint> = spline
                .control_points
                .iter()
                .filter_map(|p| sanitize_point(p.x, p.y, p.z))
                .collect();
            let fit_points: Vec<CadPoint> = spline
                .fit_points
                .iter()
                .filter_map(|p| sanitize_point(p.x, p.y, p.z))
                .collect();
            // 至少需要有控制点或拟合点
            if control_points.is_empty() && fit_points.is_empty() {
                return None;
            }
            Some(CadEntity::Spline {
                id,
                layer,
                color,
                control_points,
                fit_points,
                knots: spline.knots.iter().map(|k| sanitize_f64(*k)).collect(),
                degree: spline.degree,
                line_weight,
            })
        }
        EntityType::Text(text) => {
            let height = sanitize_f64(text.height);
            if height <= 0.0 {
                return None;
            }
            let position = if !is_standard_normal(&text.normal) {
                ocs_to_wcs(text.insertion_point, text.normal)
            } else {
                text.insertion_point
            };
            let position = sanitize_point(position.x, position.y, position.z)?;
            Some(CadEntity::Text {
                id,
                layer,
                color,
                position,
                height,
                content: fix_garbled_text(&text.value),
                rotation: sanitize_f64(text.rotation),
                horizontal_alignment: match text.horizontal_alignment {
                    TextHorizontalAlignment::Left => 0,
                    TextHorizontalAlignment::Center => 1,
                    TextHorizontalAlignment::Right => 2,
                    TextHorizontalAlignment::Aligned => 3,
                    TextHorizontalAlignment::Middle => 4,
                    TextHorizontalAlignment::Fit => 5,
                },
                vertical_alignment: match text.vertical_alignment {
                    TextVerticalAlignment::Baseline => 0,
                    TextVerticalAlignment::Bottom => 1,
                    TextVerticalAlignment::Middle => 2,
                    TextVerticalAlignment::Top => 3,
                },
            })
        }
        EntityType::MText(mtext) => {
            let height = sanitize_f64(mtext.height);
            if height <= 0.0 {
                return None;
            }
            let position = if !is_standard_normal(&mtext.normal) {
                ocs_to_wcs(mtext.insertion_point, mtext.normal)
            } else {
                mtext.insertion_point
            };
            let position = sanitize_point(position.x, position.y, position.z)?;
            let fmt = parse_mtext_format(&mtext.value);
            Some(CadEntity::MText {
                id,
                layer,
                color,
                position,
                height,
                content: fmt.content,
                width: sanitize_f64(mtext.rectangle_width),
                rotation: sanitize_f64(mtext.rotation),
                attachment_point: mtext.attachment_point as u8,
                width_factor: fmt.width_factor,
                font_name: fmt.font_name,
                height_scale: fmt.height_scale,
            })
        }
        EntityType::Solid(solid) => {
            let points = if !is_standard_normal(&solid.normal) {
                let matrix = Matrix3::arbitrary_axis(solid.normal);
                vec![
                    {
                        let p = matrix * solid.first_corner;
                        convert_point(p.x, p.y, p.z)
                    },
                    {
                        let p = matrix * solid.second_corner;
                        convert_point(p.x, p.y, p.z)
                    },
                    {
                        let p = matrix * solid.third_corner;
                        convert_point(p.x, p.y, p.z)
                    },
                    {
                        let p = matrix * solid.fourth_corner;
                        convert_point(p.x, p.y, p.z)
                    },
                ]
            } else {
                vec![
                    convert_point(
                        solid.first_corner.x,
                        solid.first_corner.y,
                        solid.first_corner.z,
                    ),
                    convert_point(
                        solid.second_corner.x,
                        solid.second_corner.y,
                        solid.second_corner.z,
                    ),
                    convert_point(
                        solid.third_corner.x,
                        solid.third_corner.y,
                        solid.third_corner.z,
                    ),
                    convert_point(
                        solid.fourth_corner.x,
                        solid.fourth_corner.y,
                        solid.fourth_corner.z,
                    ),
                ]
            };
            // 至少需要3个有效点才能构成面
            let valid_points: Vec<CadPoint> = points
                .into_iter()
                .filter(|p| is_valid_coord(p.x) && is_valid_coord(p.y))
                .collect();
            if valid_points.len() < 3 {
                return None;
            }
            Some(CadEntity::Solid {
                id,
                layer,
                color,
                points: valid_points,
            })
        }
        EntityType::Point(point) => {
            let position = if !is_standard_normal(&point.normal) {
                ocs_to_wcs(point.location, point.normal)
            } else {
                point.location
            };
            let position = sanitize_point(position.x, position.y, position.z)?;
            Some(CadEntity::Point {
                id,
                layer,
                color,
                position,
            })
        }
        EntityType::Insert(insert) => {
            let position = sanitize_point(
                insert.insert_point.x,
                insert.insert_point.y,
                insert.insert_point.z,
            )?;
            Some(CadEntity::Insert {
                id,
                layer,
                color,
                block_name: fix_garbled_text(&insert.block_name),
                position,
                x_scale: sanitize_f64(insert.x_scale()),
                y_scale: sanitize_f64(insert.y_scale()),
                z_scale: sanitize_f64(insert.z_scale()),
                rotation: sanitize_f64(insert.rotation),
            })
        }
        EntityType::Hatch(hatch) => {
            let ocs_matrix = if !is_standard_normal(&hatch.normal) {
                Some(Matrix3::arbitrary_axis(hatch.normal))
            } else {
                None
            };
            let elevation = hatch.elevation;
            let transform_hatch_point = |x: f64, y: f64| -> (f64, f64) {
                if let Some(matrix) = ocs_matrix {
                    let wcs = matrix * Vector3::new(x, y, elevation);
                    (sanitize_f64(wcs.x), sanitize_f64(wcs.y))
                } else {
                    (sanitize_f64(x), sanitize_f64(y))
                }
            };
            let boundaries: Vec<Vec<CadLwVertex>> = hatch
                .paths
                .iter()
                .map(|path| {
                    let edge_verts: Vec<Vec<CadLwVertex>> = path
                        .edges
                        .iter()
                        .map(|edge| match edge {
                            BoundaryEdge::Line(line_edge) => {
                                let (sx, sy) =
                                    transform_hatch_point(line_edge.start.x, line_edge.start.y);
                                let (ex, ey) =
                                    transform_hatch_point(line_edge.end.x, line_edge.end.y);
                                vec![
                                    CadLwVertex {
                                        x: sx,
                                        y: sy,
                                        bulge: 0.0,
                                    },
                                    CadLwVertex {
                                        x: ex,
                                        y: ey,
                                        bulge: 0.0,
                                    },
                                ]
                            }
                            BoundaryEdge::CircularArc(arc_edge) => {
                                let radius = sanitize_f64(arc_edge.radius);
                                if radius <= 0.0 {
                                    return vec![];
                                }
                                let segments = 16;
                                let mut verts = Vec::with_capacity(segments + 1);
                                let mut angle_range = sanitize_f64(arc_edge.end_angle)
                                    - sanitize_f64(arc_edge.start_angle);
                                if angle_range < 0.0 {
                                    angle_range += std::f64::consts::PI * 2.0;
                                }
                                let (cx, cy) =
                                    transform_hatch_point(arc_edge.center.x, arc_edge.center.y);
                                for i in 0..=segments {
                                    let a = sanitize_f64(arc_edge.start_angle)
                                        + (i as f64 / segments as f64) * angle_range;
                                    verts.push(CadLwVertex {
                                        x: cx + radius * a.cos(),
                                        y: cy + radius * a.sin(),
                                        bulge: 0.0,
                                    });
                                }
                                verts
                            }
                            BoundaryEdge::Polyline(poly_edge) => poly_edge
                                .vertices
                                .iter()
                                .map(|v| {
                                    let (px, py) = transform_hatch_point(v.x, v.y);
                                    CadLwVertex {
                                        x: px,
                                        y: py,
                                        bulge: sanitize_f64(v.z),
                                    }
                                })
                                .collect(),
                            BoundaryEdge::EllipticArc(ellipse_edge) => {
                                let major_len = (ellipse_edge.major_axis_endpoint.x.powi(2)
                                    + ellipse_edge.major_axis_endpoint.y.powi(2))
                                .sqrt();
                                let minor_len =
                                    major_len * sanitize_f64(ellipse_edge.minor_axis_ratio);
                                if major_len <= 0.0 || minor_len <= 0.0 {
                                    return vec![];
                                }
                                let segments = 16;
                                let mut verts = Vec::with_capacity(segments + 1);
                                let mut angle_range = sanitize_f64(ellipse_edge.end_angle)
                                    - sanitize_f64(ellipse_edge.start_angle);
                                if angle_range < 0.0 {
                                    angle_range += std::f64::consts::PI * 2.0;
                                }
                                let rotation = (ellipse_edge.major_axis_endpoint.y)
                                    .atan2(ellipse_edge.major_axis_endpoint.x);
                                let (cx, cy) = transform_hatch_point(
                                    ellipse_edge.center.x,
                                    ellipse_edge.center.y,
                                );
                                for i in 0..=segments {
                                    let a = sanitize_f64(ellipse_edge.start_angle)
                                        + (i as f64 / segments as f64) * angle_range;
                                    let x = a.cos() * major_len;
                                    let y = a.sin() * minor_len;
                                    let rot_x = x * rotation.cos() - y * rotation.sin();
                                    let rot_y = x * rotation.sin() + y * rotation.cos();
                                    verts.push(CadLwVertex {
                                        x: cx + rot_x,
                                        y: cy + rot_y,
                                        bulge: 0.0,
                                    });
                                }
                                verts
                            }
                            _ => vec![],
                        })
                        .collect();

                    let mut merged: Vec<CadLwVertex> = Vec::new();
                    for (ei, verts) in edge_verts.iter().enumerate() {
                        if verts.is_empty() {
                            continue;
                        }
                        if ei == 0 {
                            merged.extend_from_slice(verts);
                        } else {
                            if let (Some(last), Some(first)) = (merged.last(), verts.first()) {
                                if (last.x - first.x).abs() < 1e-6
                                    && (last.y - first.y).abs() < 1e-6
                                {
                                    merged.extend_from_slice(&verts[1..]);
                                } else {
                                    merged.extend_from_slice(verts);
                                }
                            } else {
                                merged.extend_from_slice(verts);
                            }
                        }
                    }
                    merged
                })
                .collect();
            Some(CadEntity::Hatch {
                id,
                layer,
                color,
                boundaries,
                pattern_name: fix_garbled_text(&hatch.pattern.name),
                pattern_type: match hatch.pattern_type {
                    HatchPatternType::UserDefined => 0,
                    HatchPatternType::Predefined => 1,
                    HatchPatternType::Custom => 2,
                },
                solid: hatch.is_solid,
                scale: sanitize_f64(hatch.pattern_scale),
                angle: sanitize_f64(hatch.pattern_angle),
                style: match hatch.style {
                    HatchStyleType::Normal => 0,
                    HatchStyleType::Outer => 1,
                    HatchStyleType::Ignore => 2,
                },
                pattern_lines: hatch
                    .pattern
                    .lines
                    .iter()
                    .map(|pl| crate::domain::cad::CadHatchPatternLine {
                        angle: sanitize_f64(pl.angle),
                        base_x: sanitize_f64(pl.base_point.x),
                        base_y: sanitize_f64(pl.base_point.y),
                        offset_x: sanitize_f64(pl.offset.x),
                        offset_y: sanitize_f64(pl.offset.y),
                        dashes: pl.dash_lengths.iter().map(|d| sanitize_f64(*d)).collect(),
                    })
                    .collect(),
            })
        }
        EntityType::Dimension(dim) => {
            let base = dim.base();
            let (def_pt, mid_pt) = if !is_standard_normal(&base.normal) {
                let matrix = Matrix3::arbitrary_axis(base.normal);
                let dp = matrix * base.definition_point;
                let mp = matrix * base.text_middle_point;
                (dp, mp)
            } else {
                (base.definition_point, base.text_middle_point)
            };
            Some(CadEntity::Dimension {
                id,
                layer,
                color,
                definition_point: convert_point(def_pt.x, def_pt.y, def_pt.z),
                text_midpoint: convert_point(mid_pt.x, mid_pt.y, mid_pt.z),
                content: fix_garbled_text(&base.text),
                rotation: sanitize_f64(base.text_rotation),
            })
        }
        EntityType::Leader(leader) => {
            let vertices: Vec<CadPoint> = leader
                .vertices
                .iter()
                .filter_map(|v| sanitize_point(v.x, v.y, v.z))
                .collect();
            if vertices.len() < 2 {
                return None;
            }
            Some(CadEntity::Leader {
                id,
                layer,
                color,
                vertices,
                arrow_enabled: leader.arrow_enabled,
            })
        }
        EntityType::AttributeEntity(attr) => {
            let height = sanitize_f64(attr.height);
            if height <= 0.0 {
                return None;
            }
            let position = sanitize_point(
                attr.insertion_point.x,
                attr.insertion_point.y,
                attr.insertion_point.z,
            )?;
            Some(CadEntity::AttributeEntity {
                id,
                layer,
                color,
                position,
                height,
                rotation: sanitize_f64(attr.rotation),
                tag: fix_garbled_text(&attr.tag),
                value: fix_garbled_text(&attr.value),
            })
        }
        EntityType::Face3D(face) => {
            let points: Vec<CadPoint> = vec![
                convert_point(
                    face.first_corner.x,
                    face.first_corner.y,
                    face.first_corner.z,
                ),
                convert_point(
                    face.second_corner.x,
                    face.second_corner.y,
                    face.second_corner.z,
                ),
                convert_point(
                    face.third_corner.x,
                    face.third_corner.y,
                    face.third_corner.z,
                ),
                convert_point(
                    face.fourth_corner.x,
                    face.fourth_corner.y,
                    face.fourth_corner.z,
                ),
            ]
            .into_iter()
            .filter(|p| is_valid_coord(p.x) && is_valid_coord(p.y))
            .collect();
            if points.len() < 3 {
                return None;
            }
            Some(CadEntity::Face3D {
                id,
                layer,
                color,
                points,
                invisible_edges: face.invisible_edges.bits() as u16,
            })
        }
        EntityType::Polyline2D(poly2d) => {
            let vertices: Vec<CadLwVertex> = poly2d
                .vertices
                .iter()
                .filter_map(|v| {
                    if is_valid_coord(v.location.x) && is_valid_coord(v.location.y) {
                        Some(CadLwVertex {
                            x: sanitize_f64(v.location.x),
                            y: sanitize_f64(v.location.y),
                            bulge: sanitize_f64(v.bulge),
                        })
                    } else {
                        None
                    }
                })
                .collect();
            if vertices.len() < 2 {
                return None;
            }
            Some(CadEntity::Polyline2D {
                id,
                layer,
                color,
                vertices,
                closed: poly2d.is_closed(),
                line_weight,
            })
        }
        EntityType::Table(table) => {
            let position = sanitize_point(
                table.insertion_point.x,
                table.insertion_point.y,
                table.insertion_point.z,
            )?;
            let row_count = table.rows.len() as u32;
            let col_count = table.columns.len() as u32;
            let row_heights: Vec<f64> = table.rows.iter().map(|r| sanitize_f64(r.height)).collect();
            let col_widths: Vec<f64> = table
                .columns
                .iter()
                .map(|c| sanitize_f64(c.width))
                .collect();
            // 提取单元格文字
            let mut cell_texts = Vec::new();
            for row in &table.rows {
                for cell in &row.cells {
                    let text = cell
                        .contents
                        .iter()
                        .map(|c| fix_garbled_text(&c.value.text))
                        .collect::<Vec<_>>()
                        .join("");
                    cell_texts.push(text);
                }
            }
            Some(CadEntity::Table {
                id,
                layer,
                color,
                position,
                height: sanitize_f64(table.rows.first().map(|r| r.height).unwrap_or(1.0)),
                rotation: 0.0,
                row_count,
                col_count,
                row_heights,
                col_widths,
                cell_texts,
            })
        }
        _ => None,
    }
}

#[tauri::command]
pub async fn parse_cad_file(file_path: String) -> ParseResult {
    parse_cad_file_sync(file_path)
}

pub fn parse_cad_file_sync(file_path: String) -> ParseResult {
    let path = std::path::Path::new(&file_path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(e) => {
            return ParseResult {
                success: false,
                document: None,
                error: Some(format!("Failed to read file: {}", e)),
                diagnostics: None,
            };
        }
    };

    let file_size = data.len() as u64;
    let result = match extension.as_str() {
        "dxf" => parse_dxf_from_bytes(data),
        "dwg" => parse_dwg_from_bytes(data),
        _ => {
            return ParseResult {
                success: false,
                document: None,
                error: Some(format!("Unsupported file format: {}", extension)),
                diagnostics: None,
            };
        }
    };

    match result {
        Ok(doc) => {
            let (cad_doc, diagnostics) = convert_document(doc, file_name, file_size);
            ParseResult {
                success: true,
                document: Some(cad_doc),
                error: None,
                diagnostics: Some(diagnostics),
            }
        }
        Err(e) => ParseResult {
            success: false,
            document: None,
            error: Some(format!("Failed to parse CAD file: {}", e)),
            diagnostics: None,
        },
    }
}

#[tauri::command]
pub async fn parse_cad_from_bytes(data: Vec<u8>, file_name: String) -> ParseResult {
    parse_cad_from_bytes_sync(data, file_name)
}

pub fn parse_cad_from_bytes_sync(data: Vec<u8>, file_name: String) -> ParseResult {
    let extension = file_name
        .rsplit('.')
        .next()
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    let file_size = data.len() as u64;
    let result = match extension.as_str() {
        "dxf" => parse_dxf_from_bytes(data),
        "dwg" => parse_dwg_from_bytes(data),
        _ => {
            return ParseResult {
                success: false,
                document: None,
                error: Some(format!("Unsupported file format: {}", extension)),
                diagnostics: None,
            };
        }
    };

    match result {
        Ok(doc) => {
            let (cad_doc, diagnostics) = convert_document(doc, file_name, file_size);
            ParseResult {
                success: true,
                document: Some(cad_doc),
                error: None,
                diagnostics: Some(diagnostics),
            }
        }
        Err(e) => ParseResult {
            success: false,
            document: None,
            error: Some(format!("Failed to parse CAD file: {}", e)),
            diagnostics: None,
        },
    }
}

#[tauri::command]
pub async fn import_cad_to_cadbin(
    file_path: String,
    output_dir: Option<String>,
) -> Result<String, String> {
    let parse_result = parse_cad_file_sync(file_path.clone());
    if !parse_result.success {
        return Err(parse_result
            .error
            .unwrap_or_else(|| "Parse failed".to_string()));
    }
    let doc = parse_result
        .document
        .ok_or_else(|| "No document after parse".to_string())?;

    let cadbin_data = crate::cad_runtime::cadbin_writer::CadbinWriter::write_to_bytes(&doc);

    let path = std::path::Path::new(&file_path);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");

    let out_dir = match &output_dir {
        Some(dir) => std::path::PathBuf::from(dir),
        None => path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from(".")),
    };

    std::fs::create_dir_all(&out_dir).map_err(|e| format!("Failed to create output dir: {}", e))?;

    let output_path = out_dir.join(format!("{}.cadbin", stem));
    let output_str = output_path.to_string_lossy().to_string();

    std::fs::write(&output_path, &cadbin_data)
        .map_err(|e| format!("Failed to write cadbin: {}", e))?;

    Ok(output_str)
}

#[tauri::command]
pub async fn read_cadbin_file(file_path: String) -> Result<Vec<u8>, String> {
    let data =
        std::fs::read(&file_path).map_err(|e| format!("Failed to read cadbin file: {}", e))?;

    let _info = crate::cad_runtime::cadbin_writer::CadbinReader::read_header(&data)
        .map_err(|e| format!("Invalid cadbin file: {}", e))?;

    Ok(data)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadFileAnalysis {
    pub file_name: String,
    pub file_size_bytes: u64,
    pub parse_success: bool,
    pub parse_error: Option<String>,
    pub parse_time_ms: u64,
    pub raw_entity_count: usize,
    pub layer_count: usize,
    pub invisible_count: usize,
    pub insert_count: usize,
    pub type_distribution: HashMap<String, usize>,
    pub layer_distribution: HashMap<String, usize>,
    pub insert_block_names: HashMap<String, usize>,
    pub hatch_count: usize,
    pub hatch_max_edges_per_path: usize,
    pub spline_count: usize,
    pub spline_max_fit_points: usize,
    pub spline_max_control_points: usize,
    pub lwpoly_count: usize,
    pub lwpoly_max_vertices: usize,
    pub lwpoly_huge_vertex_count: usize,
    pub text_count: usize,
    pub text_min_height: f64,
    pub text_max_height: f64,
    pub converted_entity_count: usize,
    pub converted_type_distribution: HashMap<String, usize>,
    pub outlier_rejected_count: usize,
    pub extents: Option<CadExtents>,
}

#[tauri::command]
pub fn analyze_cad_files(directory: String) -> Result<Vec<CadFileAnalysis>, String> {
    let dir = std::path::Path::new(&directory);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", directory));
    }

    let mut results = Vec::new();
    let mut entries: Vec<std::path::PathBuf> = Vec::new();

    for entry in std::fs::read_dir(dir).map_err(|e| format!("read_dir failed: {}", e))? {
        let entry = entry.map_err(|e| format!("entry failed: {}", e))?;
        let ext = entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        if ext == "dwg" || ext == "dxf" {
            entries.push(entry.path());
        }
    }

    entries.sort_by_key(|p| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0));

    for path in entries {
        let file_name = path.file_name().unwrap().to_string_lossy().to_string();
        let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        let data = match std::fs::read(&path) {
            Ok(d) => d,
            Err(e) => {
                results.push(CadFileAnalysis {
                    file_name,
                    file_size_bytes: file_size,
                    parse_success: false,
                    parse_error: Some(format!("Read failed: {}", e)),
                    parse_time_ms: 0,
                    raw_entity_count: 0,
                    layer_count: 0,
                    invisible_count: 0,
                    insert_count: 0,
                    type_distribution: HashMap::new(),
                    layer_distribution: HashMap::new(),
                    insert_block_names: HashMap::new(),
                    hatch_count: 0,
                    hatch_max_edges_per_path: 0,
                    spline_count: 0,
                    spline_max_fit_points: 0,
                    spline_max_control_points: 0,
                    lwpoly_count: 0,
                    lwpoly_max_vertices: 0,
                    lwpoly_huge_vertex_count: 0,
                    text_count: 0,
                    text_min_height: 0.0,
                    text_max_height: 0.0,
                    converted_entity_count: 0,
                    converted_type_distribution: HashMap::new(),
                    outlier_rejected_count: 0,
                    extents: None,
                });
                continue;
            }
        };

        let start = std::time::Instant::now();
        let result = match extension.as_str() {
            "dxf" => parse_dxf_from_bytes(data),
            "dwg" => parse_dwg_from_bytes(data),
            _ => Err("Unsupported format".into()),
        };
        let parse_time_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok(doc) => {
                let mut type_dist: HashMap<String, usize> = HashMap::new();
                let mut layer_dist: HashMap<String, usize> = HashMap::new();
                let mut insert_names: HashMap<String, usize> = HashMap::new();
                let mut invisible_count = 0;
                let mut insert_count = 0;
                let mut hatch_count = 0;
                let mut hatch_max_edges = 0;
                let mut spline_count = 0;
                let mut spline_max_fp = 0;
                let mut spline_max_cp = 0;
                let mut lwpoly_count = 0;
                let mut lwpoly_max_v = 0;
                let mut lwpoly_huge = 0;
                let mut text_count = 0;
                let mut text_min_h = f64::MAX;
                let mut text_max_h = f64::MIN;
                let mut raw_entity_count = 0;

                for entity in doc.entities() {
                    raw_entity_count += 1;
                    let common = entity.common();
                    if common.invisible {
                        invisible_count += 1;
                        continue;
                    }

                    let type_name = match &entity {
                        EntityType::Line(_) => "Line",
                        EntityType::Circle(_) => "Circle",
                        EntityType::Arc(_) => "Arc",
                        EntityType::LwPolyline(_) => "LwPolyline",
                        EntityType::Polyline(_) => "Polyline",
                        EntityType::Ellipse(_) => "Ellipse",
                        EntityType::Spline(_) => "Spline",
                        EntityType::Text(_) => "Text",
                        EntityType::MText(_) => "MText",
                        EntityType::Solid(_) => "Solid",
                        EntityType::Point(_) => "Point",
                        EntityType::Insert(_) => "Insert",
                        EntityType::Hatch(_) => "Hatch",
                        EntityType::Dimension(_) => "Dimension",
                        _ => "Other",
                    };
                    *type_dist.entry(type_name.to_string()).or_insert(0) += 1;
                    *layer_dist.entry(common.layer.clone()).or_insert(0) += 1;

                    match &entity {
                        EntityType::Insert(ins) => {
                            insert_count += 1;
                            *insert_names.entry(ins.block_name.clone()).or_insert(0) += 1;
                        }
                        EntityType::Hatch(h) => {
                            hatch_count += 1;
                            for p in &h.paths {
                                hatch_max_edges = hatch_max_edges.max(p.edges.len());
                            }
                        }
                        EntityType::Spline(sp) => {
                            spline_count += 1;
                            spline_max_fp = spline_max_fp.max(sp.fit_points.len());
                            spline_max_cp = spline_max_cp.max(sp.control_points.len());
                        }
                        EntityType::LwPolyline(lw) => {
                            lwpoly_count += 1;
                            lwpoly_max_v = lwpoly_max_v.max(lw.vertices.len());
                            if lw.vertices.len() > 1000 {
                                lwpoly_huge += 1;
                            }
                        }
                        EntityType::Text(t) => {
                            text_count += 1;
                            text_min_h = text_min_h.min(t.height);
                            text_max_h = text_max_h.max(t.height);
                        }
                        EntityType::MText(mt) => {
                            text_count += 1;
                            text_min_h = text_min_h.min(mt.height);
                            text_max_h = text_max_h.max(mt.height);
                        }
                        _ => {}
                    }
                }

                let layer_count = doc.layers.len();

                let before_convert = raw_entity_count;
                let (cad_doc, _diagnostics) = convert_document(doc, file_name.clone(), file_size);
                let converted_count = cad_doc.entities.len();
                let outlier_rejected = before_convert - converted_count - invisible_count;

                let mut conv_type_dist: HashMap<String, usize> = HashMap::new();
                for e in &cad_doc.entities {
                    let t = match e {
                        CadEntity::Line { .. } => "Line",
                        CadEntity::Circle { .. } => "Circle",
                        CadEntity::Arc { .. } => "Arc",
                        CadEntity::Polyline { .. } => "Polyline",
                        CadEntity::LwPolyline { .. } => "LwPolyline",
                        CadEntity::Ellipse { .. } => "Ellipse",
                        CadEntity::Spline { .. } => "Spline",
                        CadEntity::Text { .. } => "Text",
                        CadEntity::MText { .. } => "MText",
                        CadEntity::Solid { .. } => "Solid",
                        CadEntity::Point { .. } => "Point",
                        CadEntity::Insert { .. } => "Insert",
                        CadEntity::Hatch { .. } => "Hatch",
                        CadEntity::Dimension { .. } => "Dimension",
                        CadEntity::Leader { .. } => "Leader",
                        CadEntity::AttributeEntity { .. } => "AttributeEntity",
                        CadEntity::Face3D { .. } => "Face3D",
                        CadEntity::Polyline2D { .. } => "Polyline2D",
                        CadEntity::Table { .. } => "Table",
                    };
                    *conv_type_dist.entry(t.to_string()).or_insert(0) += 1;
                }

                results.push(CadFileAnalysis {
                    file_name,
                    file_size_bytes: file_size,
                    parse_success: true,
                    parse_error: None,
                    parse_time_ms,
                    raw_entity_count,
                    layer_count,
                    invisible_count,
                    insert_count,
                    type_distribution: type_dist,
                    layer_distribution: layer_dist,
                    insert_block_names: insert_names,
                    hatch_count,
                    hatch_max_edges_per_path: hatch_max_edges,
                    spline_count,
                    spline_max_fit_points: spline_max_fp,
                    spline_max_control_points: spline_max_cp,
                    lwpoly_count,
                    lwpoly_max_vertices: lwpoly_max_v,
                    lwpoly_huge_vertex_count: lwpoly_huge,
                    text_count,
                    text_min_height: if text_min_h == f64::MAX {
                        0.0
                    } else {
                        text_min_h
                    },
                    text_max_height: if text_max_h == f64::MIN {
                        0.0
                    } else {
                        text_max_h
                    },
                    converted_entity_count: converted_count,
                    converted_type_distribution: conv_type_dist,
                    outlier_rejected_count: outlier_rejected,
                    extents: cad_doc.extents,
                });
            }
            Err(e) => {
                results.push(CadFileAnalysis {
                    file_name,
                    file_size_bytes: file_size,
                    parse_success: false,
                    parse_error: Some(format!("{}", e)),
                    parse_time_ms,
                    raw_entity_count: 0,
                    layer_count: 0,
                    invisible_count: 0,
                    insert_count: 0,
                    type_distribution: HashMap::new(),
                    layer_distribution: HashMap::new(),
                    insert_block_names: HashMap::new(),
                    hatch_count: 0,
                    hatch_max_edges_per_path: 0,
                    spline_count: 0,
                    spline_max_fit_points: 0,
                    spline_max_control_points: 0,
                    lwpoly_count: 0,
                    lwpoly_max_vertices: 0,
                    lwpoly_huge_vertex_count: 0,
                    text_count: 0,
                    text_min_height: 0.0,
                    text_max_height: 0.0,
                    converted_entity_count: 0,
                    converted_type_distribution: HashMap::new(),
                    outlier_rejected_count: 0,
                    extents: None,
                });
            }
        }
    }

    Ok(results)
}
