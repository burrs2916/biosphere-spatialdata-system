use acadrust::{DwgReader, EntityType};
use std::collections::HashMap;

fn main() {
    let file_path = "/Users/liwenchao/EdgeView/biosphere/biosphere-spatialdata-system/docs/需求分析/20260510/西沟煤矿降尘系统布置图通风科修改2004.dwg";

    let data = std::fs::read(file_path).unwrap();
    let cursor = std::io::Cursor::new(data);
    let mut reader = DwgReader::from_stream(cursor);
    let doc = reader.read().unwrap();

    let mut y_values: Vec<(String, f64, f64)> = Vec::new();
    let mut insert_details: Vec<(String, f64, f64, f64, f64, f64)> = Vec::new();
    let mut text_details: Vec<(String, f64, f64, f64)> = Vec::new();

    for entity in doc.entities() {
        match &entity {
            EntityType::Line(l) => {
                y_values.push(("Line".to_string(), l.start.y, l.end.y));
            }
            EntityType::MText(mt) => {
                text_details.push((
                    "MText".to_string(),
                    mt.insertion_point.x,
                    mt.insertion_point.y,
                    mt.height,
                ));
                y_values.push((
                    "MText".to_string(),
                    mt.insertion_point.y,
                    mt.insertion_point.y,
                ));
            }
            EntityType::Text(t) => {
                text_details.push((
                    "Text".to_string(),
                    t.insertion_point.x,
                    t.insertion_point.y,
                    t.height,
                ));
                y_values.push(("Text".to_string(), t.insertion_point.x, t.insertion_point.y));
            }
            EntityType::Insert(ins) => {
                insert_details.push((
                    ins.block_name.clone(),
                    ins.insert_point.x,
                    ins.insert_point.y,
                    ins.x_scale(),
                    ins.y_scale(),
                    ins.rotation,
                ));
                y_values.push(("Insert".to_string(), ins.insert_point.y, ins.insert_point.y));
            }
            EntityType::Circle(c) => {
                y_values.push((
                    "Circle".to_string(),
                    c.center.y - c.radius,
                    c.center.y + c.radius,
                ));
            }
            EntityType::Arc(a) => {
                y_values.push((
                    "Arc".to_string(),
                    a.center.y - a.radius,
                    a.center.y + a.radius,
                ));
            }
            EntityType::LwPolyline(lw) => {
                for v in &lw.vertices {
                    y_values.push(("LwPolyline".to_string(), v.location.y, v.location.y));
                }
            }
            _ => {}
        }
    }

    let mut all_y: Vec<f64> = y_values
        .iter()
        .flat_map(|(_, y1, y2)| [*y1, *y2])
        .filter(|y| y.is_finite())
        .collect();
    all_y.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    if !all_y.is_empty() {
        let p5 = all_y[all_y.len() * 5 / 100];
        let p10 = all_y[all_y.len() * 10 / 100];
        let p25 = all_y[all_y.len() * 25 / 100];
        let p50 = all_y[all_y.len() * 50 / 100];
        let p75 = all_y[all_y.len() * 75 / 100];
        let p90 = all_y[all_y.len() * 90 / 100];
        let p95 = all_y[all_y.len() * 95 / 100];

        let negative_y: Vec<f64> = all_y.iter().cloned().filter(|&y| y < 0.0).collect();
        let positive_y: Vec<f64> = all_y.iter().cloned().filter(|&y| y >= 0.0).collect();

        let below_minus_1000 = all_y.iter().filter(|&&y| y < -1000.0).count();
        let above_5000 = all_y.iter().filter(|&&y| y > 5000.0).count();
        let between = all_y
            .iter()
            .filter(|&&y| y >= -1000.0 && y <= 5000.0)
            .count();
    }

    let mut by_block: HashMap<String, Vec<(f64, f64, f64, f64, f64)>> = HashMap::new();
    for (name, x, y, sx, sy, rot) in &insert_details {
        by_block
            .entry(name.clone())
            .or_default()
            .push((*x, *y, *sx, *sy, *rot));
    }

    let mut block_stats: Vec<_> = by_block
        .iter()
        .map(|(name, items)| {
            let ys: Vec<f64> = items.iter().map(|(_, y, _, _, _)| *y).collect();
            let min_y = ys.iter().cloned().fold(f64::INFINITY, f64::min);
            let max_y = ys.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            (name.clone(), items.len(), min_y, max_y)
        })
        .collect();
    block_stats.sort_by(|a, b| b.1.cmp(&a.1));
    for (name, count, min_y, max_y) in &block_stats {}

    let empty_vec = Vec::new();
    let rte_items = by_block.get("RTE").unwrap_or(&empty_vec);
    if !rte_items.is_empty() {
        for (i, (x, y, sx, sy, rot)) in rte_items.iter().take(20).enumerate() {}
    }
    let mut text_by_y_range: HashMap<String, usize> = HashMap::new();
    for (_, _, y, h) in &text_details {
        let range = if *y < -1000.0 {
            "Y < -1000"
        } else if *y < 0.0 {
            "-1000 <= Y < 0"
        } else if *y < 1000.0 {
            "0 <= Y < 1000"
        } else if *y < 3000.0 {
            "1000 <= Y < 3000"
        } else if *y < 5000.0 {
            "3000 <= Y < 5000"
        } else {
            "Y >= 5000"
        };
        *text_by_y_range.entry(range.to_string()).or_insert(0) += 1;
    }
    let mut ranges = text_by_y_range.iter().collect::<Vec<_>>();
    ranges.sort_by(|a, b| b.1.cmp(a.1));
    for (range, count) in &ranges {}
    let small_texts: Vec<_> = text_details
        .iter()
        .filter(|(_, _, _, h)| *h < 1.0)
        .collect();
    for (i, (t, x, y, h)) in small_texts.iter().take(20).enumerate() {}
    let mut negative_entities: Vec<String> = Vec::new();
    for entity in doc.entities() {
        match &entity {
            EntityType::Line(l) => {
                if l.start.y < -1000.0 || l.end.y < -1000.0 {
                    negative_entities.push(format!(
                        "Line ({:.1},{:.1}) -> ({:.1},{:.1})",
                        l.start.x, l.start.y, l.end.x, l.end.y
                    ));
                }
            }
            EntityType::MText(mt) => {
                if mt.insertion_point.y < -1000.0 {
                    negative_entities.push(format!(
                        "MText ({:.1},{:.1}) h={:.2} value={:.30}...",
                        mt.insertion_point.x, mt.insertion_point.y, mt.height, mt.value
                    ));
                }
            }
            EntityType::Insert(ins) => {
                if ins.insert_point.y < -1000.0 {
                    negative_entities.push(format!(
                        "Insert {} ({:.1},{:.1})",
                        ins.block_name, ins.insert_point.x, ins.insert_point.y
                    ));
                }
            }
            _ => {}
        }
    }
    for e in negative_entities.iter().take(30) {}
    let mut high_entities: Vec<String> = Vec::new();
    for entity in doc.entities() {
        match &entity {
            EntityType::Line(l) => {
                if l.start.y > 5000.0 || l.end.y > 5000.0 {
                    high_entities.push(format!(
                        "Line ({:.1},{:.1}) -> ({:.1},{:.1})",
                        l.start.x, l.start.y, l.end.x, l.end.y
                    ));
                }
            }
            EntityType::MText(mt) => {
                if mt.insertion_point.y > 5000.0 {
                    high_entities.push(format!(
                        "MText ({:.1},{:.1}) h={:.2} value={:.30}...",
                        mt.insertion_point.x, mt.insertion_point.y, mt.height, mt.value
                    ));
                }
            }
            EntityType::Insert(ins) => {
                if ins.insert_point.y > 5000.0 {
                    high_entities.push(format!(
                        "Insert {} ({:.1},{:.1})",
                        ins.block_name, ins.insert_point.x, ins.insert_point.y
                    ));
                }
            }
            _ => {}
        }
    }
    for e in high_entities.iter().take(30) {}
}
