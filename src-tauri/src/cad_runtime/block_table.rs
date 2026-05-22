use crate::cad_runtime::string_pool::StringPool;

pub struct BlockDef {
    pub name_idx: u32,
    pub base_x: f64,
    pub base_y: f64,
    pub base_z: f64,
    pub entity_start: u32,
    pub entity_count: u32,
}

pub struct BlockTable {
    blocks: Vec<BlockDef>,
}

const BLOCK_DEF_SIZE: usize = 4 + 8 + 8 + 8 + 4 + 4;

impl BlockTable {
    pub fn new() -> Self {
        BlockTable { blocks: Vec::new() }
    }

    pub fn add_block(
        &mut self,
        name_idx: u32,
        base_x: f64,
        base_y: f64,
        base_z: f64,
        entity_start: u32,
        entity_count: u32,
    ) {
        self.blocks.push(BlockDef {
            name_idx,
            base_x,
            base_y,
            base_z,
            entity_start,
            entity_count,
        });
    }

    pub fn from_cad_entities(
        string_pool: &mut StringPool,
        entities: &[crate::domain::cad::CadEntity],
    ) -> Self {
        use crate::domain::cad::CadEntity;

        let mut block_map: std::collections::HashMap<String, (f64, f64, f64, usize, usize)> =
            std::collections::HashMap::new();
        let mut current_block: Option<String> = None;
        let mut block_start = 0usize;
        let mut block_count = 0usize;

        for (i, entity) in entities.iter().enumerate() {
            let block_name = match entity {
                CadEntity::Insert { block_name, .. } => Some(block_name.clone()),
                _ => None,
            };

            if let Some(name) = block_name {
                if let Some(ref cur) = current_block {
                    if *cur != name {
                        block_map.insert(
                            cur.clone(),
                            (0.0, 0.0, 0.0, block_start, block_count),
                        );
                        current_block = Some(name);
                        block_start = i;
                        block_count = 1;
                    } else {
                        block_count += 1;
                    }
                } else {
                    current_block = Some(name);
                    block_start = i;
                    block_count = 1;
                }
            } else if let Some(ref _cur) = current_block {
                block_count += 1;
            }
        }

        if let Some(cur) = current_block {
            block_map.insert(cur, (0.0, 0.0, 0.0, block_start, block_count));
        }

        let mut table = BlockTable::new();
        let mut sorted_blocks: Vec<_> = block_map.into_iter().collect();
        sorted_blocks.sort_by(|a, b| a.0.cmp(&b.0));

        for (name, (_bx, _by, _bz, start, count)) in sorted_blocks {
            let name_idx = string_pool.intern(&name);
            table.add_block(name_idx, 0.0, 0.0, 0.0, start as u32, count as u32);
        }

        table
    }

    pub fn blocks(&self) -> &[BlockDef] {
        &self.blocks
    }

    pub fn len(&self) -> usize {
        self.blocks.len()
    }

    pub fn is_empty(&self) -> bool {
        self.blocks.is_empty()
    }

    pub fn serialize(&self) -> Vec<u8> {
        let count = self.blocks.len() as u16;
        let mut buf = Vec::with_capacity(2 + self.blocks.len() * BLOCK_DEF_SIZE);
        buf.extend_from_slice(&count.to_le_bytes());
        for block in &self.blocks {
            buf.extend_from_slice(&block.name_idx.to_le_bytes());
            buf.extend_from_slice(&block.base_x.to_le_bytes());
            buf.extend_from_slice(&block.base_y.to_le_bytes());
            buf.extend_from_slice(&block.base_z.to_le_bytes());
            buf.extend_from_slice(&block.entity_start.to_le_bytes());
            buf.extend_from_slice(&block.entity_count.to_le_bytes());
        }
        buf
    }

    pub fn deserialize(data: &[u8]) -> Result<(BlockTable, usize), String> {
        if data.len() < 2 {
            return Err("BlockTable: insufficient data for count".to_string());
        }
        let count = u16::from_le_bytes(data[0..2].try_into().unwrap()) as usize;
        let mut offset = 2;
        let mut blocks = Vec::with_capacity(count);
        for _ in 0..count {
            if offset + BLOCK_DEF_SIZE > data.len() {
                return Err("BlockTable: truncated block entry".to_string());
            }
            let name_idx = u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap());
            let base_x = f64::from_le_bytes(data[offset + 4..offset + 12].try_into().unwrap());
            let base_y = f64::from_le_bytes(data[offset + 12..offset + 20].try_into().unwrap());
            let base_z = f64::from_le_bytes(data[offset + 20..offset + 28].try_into().unwrap());
            let entity_start = u32::from_le_bytes(data[offset + 28..offset + 32].try_into().unwrap());
            let entity_count = u32::from_le_bytes(data[offset + 32..offset + 36].try_into().unwrap());
            blocks.push(BlockDef {
                name_idx,
                base_x,
                base_y,
                base_z,
                entity_start,
                entity_count,
            });
            offset += BLOCK_DEF_SIZE;
        }
        Ok((BlockTable { blocks }, offset))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_block_table_serialize_deserialize() {
        let mut table = BlockTable::new();
        table.add_block(0, 1.0, 2.0, 0.0, 0, 5);
        table.add_block(1, 10.0, 20.0, 0.0, 5, 3);

        let data = table.serialize();
        let (table2, consumed) = BlockTable::deserialize(&data).unwrap();
        assert_eq!(consumed, data.len());
        assert_eq!(table2.len(), 2);
        assert_eq!(table2.blocks()[0].name_idx, 0);
        assert_eq!(table2.blocks()[0].entity_start, 0);
        assert_eq!(table2.blocks()[0].entity_count, 5);
        assert_eq!(table2.blocks()[1].name_idx, 1);
        assert_eq!(table2.blocks()[1].base_x, 10.0);
    }

    #[test]
    fn test_empty_block_table() {
        let table = BlockTable::new();
        let data = table.serialize();
        let (table2, consumed) = BlockTable::deserialize(&data).unwrap();
        assert_eq!(consumed, 2);
        assert!(table2.is_empty());
    }
}
