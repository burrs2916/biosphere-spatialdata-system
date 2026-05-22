use crate::cad_runtime::chunk_codec::entity_bbox;
use crate::domain::cad::CadEntity;

pub struct SpatialEntry {
    pub entity_id: u32,
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
}

pub struct CadSpatialIndex {
    entries: Vec<SpatialEntry>,
}

const ENTRY_SIZE: usize = 4 + 8 + 8 + 8 + 8;

#[allow(dead_code)]
impl CadSpatialIndex {
    pub fn new() -> Self {
        CadSpatialIndex {
            entries: Vec::new(),
        }
    }

    pub fn from_entities(entities: &[CadEntity]) -> Self {
        let mut index = CadSpatialIndex::new();
        for (i, entity) in entities.iter().enumerate() {
            let (min_x, min_y, max_x, max_y) = entity_bbox(entity);
            if min_x.is_finite() && min_y.is_finite() && max_x.is_finite() && max_y.is_finite() {
                index.entries.push(SpatialEntry {
                    entity_id: i as u32,
                    min_x,
                    min_y,
                    max_x,
                    max_y,
                });
            }
        }
        index.entries.sort_by(|a, b| {
            let ma = morton_code((a.min_x + a.max_x) / 2.0, (a.min_y + a.max_y) / 2.0);
            let mb = morton_code((b.min_x + b.max_x) / 2.0, (b.min_y + b.max_y) / 2.0);
            ma.cmp(&mb)
        });
        index
    }

    pub fn insert(&mut self, entity_id: u32, min_x: f64, min_y: f64, max_x: f64, max_y: f64) {
        self.entries.push(SpatialEntry {
            entity_id,
            min_x,
            min_y,
            max_x,
            max_y,
        });
    }

    pub fn query(&self, min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> Vec<u32> {
        self.entries
            .iter()
            .filter(|e| {
                e.min_x <= max_x && e.max_x >= min_x && e.min_y <= max_y && e.max_y >= min_y
            })
            .map(|e| e.entity_id)
            .collect()
    }

    pub fn query_point(&self, x: f64, y: f64, tolerance: f64) -> Vec<u32> {
        self.query(x - tolerance, y - tolerance, x + tolerance, y + tolerance)
    }

    pub fn serialize(&self) -> Vec<u8> {
        let count = self.entries.len() as u32;
        let mut buf = Vec::with_capacity(4 + self.entries.len() * ENTRY_SIZE);
        buf.extend_from_slice(&count.to_le_bytes());
        for entry in &self.entries {
            buf.extend_from_slice(&entry.entity_id.to_le_bytes());
            buf.extend_from_slice(&entry.min_x.to_le_bytes());
            buf.extend_from_slice(&entry.min_y.to_le_bytes());
            buf.extend_from_slice(&entry.max_x.to_le_bytes());
            buf.extend_from_slice(&entry.max_y.to_le_bytes());
        }
        buf
    }

    pub fn deserialize(data: &[u8]) -> Result<(CadSpatialIndex, usize), String> {
        if data.len() < 4 {
            return Err("SpatialIndex: insufficient data for count".to_string());
        }
        let count = u32::from_le_bytes(data[0..4].try_into().unwrap()) as usize;
        let mut offset = 4;
        let mut entries = Vec::with_capacity(count);
        for _ in 0..count {
            if offset + ENTRY_SIZE > data.len() {
                return Err("SpatialIndex: truncated entry".to_string());
            }
            let entity_id = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap());
            let min_x = f64::from_le_bytes(data[offset + 4..offset + 12].try_into().unwrap());
            let min_y = f64::from_le_bytes(data[offset + 12..offset + 20].try_into().unwrap());
            let max_x = f64::from_le_bytes(data[offset + 20..offset + 28].try_into().unwrap());
            let max_y = f64::from_le_bytes(data[offset + 28..offset + 36].try_into().unwrap());
            entries.push(SpatialEntry {
                entity_id,
                min_x,
                min_y,
                max_x,
                max_y,
            });
            offset += ENTRY_SIZE;
        }
        Ok((CadSpatialIndex { entries }, offset))
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

fn morton_code(x: f64, y: f64) -> u64 {
    let ix = if x >= 0.0 {
        x.to_bits()
    } else {
        u64::MAX - x.to_bits()
    };
    let iy = if y >= 0.0 {
        y.to_bits()
    } else {
        u64::MAX - y.to_bits()
    };
    split_by_1(ix) | (split_by_1(iy) << 1)
}

fn split_by_1(x: u64) -> u64 {
    let mut x = x & 0x00000000FFFFFFFF;
    x = (x | (x << 16)) & 0x0000FFFF0000FFFF;
    x = (x | (x << 8)) & 0x00FF00FF00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F0F0F0F0F;
    x = (x | (x << 2)) & 0x3333333333333333;
    x = (x | (x << 1)) & 0x5555555555555555;
    x
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spatial_index_query() {
        let mut index = CadSpatialIndex::new();
        index.insert(0, 0.0, 0.0, 10.0, 10.0);
        index.insert(1, 20.0, 20.0, 30.0, 30.0);
        index.insert(2, 5.0, 5.0, 15.0, 15.0);

        let result = index.query(0.0, 0.0, 10.0, 10.0);
        assert!(result.contains(&0));
        assert!(result.contains(&2));
        assert!(!result.contains(&1));
    }

    #[test]
    fn test_spatial_index_serialize_deserialize() {
        let mut index = CadSpatialIndex::new();
        index.insert(0, 0.0, 0.0, 10.0, 10.0);
        index.insert(1, 20.0, 20.0, 30.0, 30.0);

        let data = index.serialize();
        let (index2, consumed) = CadSpatialIndex::deserialize(&data).unwrap();
        assert_eq!(consumed, data.len());
        assert_eq!(index2.len(), 2);

        let result = index2.query(0.0, 0.0, 10.0, 10.0);
        assert!(result.contains(&0));
    }
}
