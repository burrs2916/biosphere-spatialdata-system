use crate::cad_runtime::block_table::BlockTable;
use crate::cad_runtime::cadbin_spec::*;
use crate::cad_runtime::chunk_codec::{ChunkCodec, ChunkData, ChunkIndexEntry};
use crate::cad_runtime::rtree::CadSpatialIndex;
use crate::cad_runtime::string_pool::StringPool;
use crate::domain::cad::{CadDocument, CadLayer};

pub struct CadbinWriter;

impl CadbinWriter {
    pub fn write_to_bytes(doc: &CadDocument) -> Vec<u8> {
        let mut codec = ChunkCodec::new(StringPool::new());

        let chunks = codec.encode_entities(&doc.entities);
        let mut string_pool = codec.into_string_pool();

        let layer_data = Self::encode_layers(&mut string_pool, &doc.layers);
        let block_table = BlockTable::from_cad_entities(&mut string_pool, &doc.entities);
        let block_data = block_table.serialize();

        let spatial_index = CadSpatialIndex::from_entities(&doc.entities);
        let rtree_data = spatial_index.serialize();

        let string_data = string_pool.serialize();

        // assemble_chunks 返回 (chunk_data_buf, Vec<ChunkIndexEntry>)，
        // 其中 entry.offset 是相对于 chunk_data_buf 起始的偏移，下面需要加上 offset_chunks 转为绝对偏移。
        let (chunk_data, mut chunk_entries) = Self::assemble_chunks(&chunks);

        let (min_x, min_y, max_x, max_y) = if let Some(ref ext) = doc.extents {
            (ext.min.x, ext.min.y, ext.max.x, ext.max.y)
        } else {
            (0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64)
        };

        let entity_count = doc.entities.len() as u32;
        let layer_count = doc.layers.len() as u16;
        let chunk_count = chunks.len() as u16;

        let offset_strings = FILE_HEADER_SIZE as u64;
        let offset_layers = offset_strings + string_data.len() as u64;
        let offset_blocks = offset_layers + layer_data.len() as u64;
        let offset_rtree = offset_blocks + block_data.len() as u64;
        let offset_chunks = offset_rtree + rtree_data.len() as u64;
        let offset_chunk_index = offset_chunks + chunk_data.len() as u64;

        // 将 chunk index 中的偏移从"相对于 chunk data 区"转为"绝对文件偏移"，
        // 让前端 CadbinReader.readChunkData(entry) 可以直接 new DataView(buffer, entry.offset, entry.byteSize)。
        for entry in &mut chunk_entries {
            entry.offset += offset_chunks;
        }

        let chunk_index = Self::encode_chunk_index(&chunk_entries);

        let mut file = Vec::with_capacity(
            FILE_HEADER_SIZE
                + string_data.len()
                + layer_data.len()
                + block_data.len()
                + rtree_data.len()
                + chunk_data.len()
                + chunk_index.len(),
        );

        Self::write_header(
            &mut file,
            entity_count,
            layer_count,
            chunk_count,
            min_x,
            min_y,
            max_x,
            max_y,
            offset_rtree,
            offset_layers,
            offset_blocks,
            offset_chunks,
            offset_strings,
            offset_chunk_index,
            &doc.profile,
        );

        file.extend_from_slice(&string_data);
        file.extend_from_slice(&layer_data);
        file.extend_from_slice(&block_data);
        file.extend_from_slice(&rtree_data);
        file.extend_from_slice(&chunk_data);
        file.extend_from_slice(&chunk_index);

        file
    }

    #[allow(dead_code)]
    pub fn write_to_file(doc: &CadDocument, path: &str) -> Result<(), String> {
        let data = Self::write_to_bytes(doc);
        std::fs::write(path, data).map_err(|e| format!("Failed to write cadbin file: {}", e))
    }

    fn write_header(
        buf: &mut Vec<u8>,
        entity_count: u32,
        layer_count: u16,
        chunk_count: u16,
        min_x: f64,
        min_y: f64,
        max_x: f64,
        max_y: f64,
        offset_rtree: u64,
        offset_layers: u64,
        offset_blocks: u64,
        offset_chunks: u64,
        offset_strings: u64,
        offset_chunk_index: u64,
        profile: &crate::domain::cad::CadProfile,
    ) {
        buf.resize(FILE_HEADER_SIZE, 0);

        buf[0..4].copy_from_slice(&CADBIN_MAGIC);
        buf[4..8].copy_from_slice(&CADBIN_VERSION.to_le_bytes());
        let flags = profile.to_header_flags();
        buf[8..12].copy_from_slice(&flags.to_le_bytes());
        buf[12..16].copy_from_slice(&entity_count.to_le_bytes());
        buf[16..18].copy_from_slice(&layer_count.to_le_bytes());
        buf[18..20].copy_from_slice(&chunk_count.to_le_bytes());

        buf[20..28].copy_from_slice(&min_x.to_le_bytes());
        buf[28..36].copy_from_slice(&min_y.to_le_bytes());
        buf[36..44].copy_from_slice(&max_x.to_le_bytes());
        buf[44..52].copy_from_slice(&max_y.to_le_bytes());

        buf[52..60].copy_from_slice(&offset_rtree.to_le_bytes());
        buf[60..68].copy_from_slice(&offset_layers.to_le_bytes());
        buf[68..76].copy_from_slice(&offset_blocks.to_le_bytes());
        buf[76..84].copy_from_slice(&offset_chunks.to_le_bytes());
        buf[84..92].copy_from_slice(&offset_strings.to_le_bytes());
        buf[92..100].copy_from_slice(&offset_chunk_index.to_le_bytes());
    }

    fn encode_layers(string_pool: &mut StringPool, layers: &[CadLayer]) -> Vec<u8> {
        let count = layers.len() as u16;
        let mut buf = Vec::with_capacity(2 + layers.len() * 17);
        buf.extend_from_slice(&count.to_le_bytes());

        for layer in layers {
            let name_idx = string_pool.intern(&layer.name);
            let color = if layer.color >= 0 {
                layer.color as u32
            } else {
                0xFFFFFFFF
            };
            let flags = (if layer.visible { LAYER_FLAG_VISIBLE } else { 0 })
                | (if layer.frozen { LAYER_FLAG_FROZEN } else { 0 })
                | (if layer.locked { LAYER_FLAG_LOCKED } else { 0 })
                | (LAYER_FLAG_ON);

            buf.extend_from_slice(&name_idx.to_le_bytes());
            buf.extend_from_slice(&color.to_le_bytes());
            buf.extend_from_slice(&0.0f32.to_le_bytes());
            buf.extend_from_slice(&flags.to_le_bytes());
        }

        buf
    }

    fn assemble_chunks(chunks: &[ChunkData]) -> (Vec<u8>, Vec<ChunkIndexEntry>) {
        let mut chunk_data_buf = Vec::new();
        let mut entries = Vec::with_capacity(chunks.len());

        for chunk in chunks {
            let offset = chunk_data_buf.len() as u64;
            let byte_size = chunk.data.len() as u64;
            chunk_data_buf.extend_from_slice(&chunk.data);
            entries.push(ChunkIndexEntry {
                type_tag: chunk.tag,
                entity_count: chunk.entity_count,
                offset,
                byte_size,
            });
        }

        (chunk_data_buf, entries)
    }

    fn encode_chunk_index(entries: &[ChunkIndexEntry]) -> Vec<u8> {
        let count = entries.len() as u16;
        let mut buf = Vec::with_capacity(2 + entries.len() * CHUNK_INDEX_ENTRY_SIZE);
        buf.extend_from_slice(&count.to_le_bytes());
        for entry in entries {
            buf.push(entry.type_tag);
            buf.extend_from_slice(&entry.entity_count.to_le_bytes());
            buf.extend_from_slice(&entry.offset.to_le_bytes());
            buf.extend_from_slice(&entry.byte_size.to_le_bytes());
        }
        buf
    }
}

#[allow(dead_code)]
pub struct CadbinFileInfo {
    pub version: u32,
    pub entity_count: u32,
    pub layer_count: u16,
    pub chunk_count: u16,
    pub bounds: (f64, f64, f64, f64),
    pub offset_rtree: u64,
    pub offset_layers: u64,
    pub offset_blocks: u64,
    pub offset_chunks: u64,
    pub offset_strings: u64,
    pub offset_chunk_index: u64,
}

pub struct CadbinReader;

#[allow(dead_code)]
impl CadbinReader {
    pub fn read_header(data: &[u8]) -> Result<CadbinFileInfo, String> {
        if data.len() < FILE_HEADER_SIZE {
            return Err("CadbinReader: data too small for header".to_string());
        }

        let magic = &data[0..4];
        if magic != CADBIN_MAGIC {
            return Err("CadbinReader: invalid magic bytes".to_string());
        }

        let version = u32::from_le_bytes(data[4..8].try_into().unwrap());
        let entity_count = u32::from_le_bytes(data[12..16].try_into().unwrap());
        let layer_count = u16::from_le_bytes(data[16..18].try_into().unwrap());
        let chunk_count = u16::from_le_bytes(data[18..20].try_into().unwrap());

        let min_x = f64::from_le_bytes(data[20..28].try_into().unwrap());
        let min_y = f64::from_le_bytes(data[28..36].try_into().unwrap());
        let max_x = f64::from_le_bytes(data[36..44].try_into().unwrap());
        let max_y = f64::from_le_bytes(data[44..52].try_into().unwrap());

        let offset_rtree = u64::from_le_bytes(data[52..60].try_into().unwrap());
        let offset_layers = u64::from_le_bytes(data[60..68].try_into().unwrap());
        let offset_blocks = u64::from_le_bytes(data[68..76].try_into().unwrap());
        let offset_chunks = u64::from_le_bytes(data[76..84].try_into().unwrap());
        let offset_strings = u64::from_le_bytes(data[84..92].try_into().unwrap());
        let offset_chunk_index = u64::from_le_bytes(data[92..100].try_into().unwrap());

        Ok(CadbinFileInfo {
            version,
            entity_count,
            layer_count,
            chunk_count,
            bounds: (min_x, min_y, max_x, max_y),
            offset_rtree,
            offset_layers,
            offset_blocks,
            offset_chunks,
            offset_strings,
            offset_chunk_index,
        })
    }

    pub fn read_string_pool(data: &[u8], offset: u64) -> Result<(StringPool, usize), String> {
        let start = offset as usize;
        if start >= data.len() {
            return Err("CadbinReader: string pool offset out of bounds".to_string());
        }
        StringPool::deserialize(&data[start..])
    }

    pub fn read_spatial_index(
        data: &[u8],
        offset: u64,
        byte_size: u64,
    ) -> Result<CadSpatialIndex, String> {
        let start = offset as usize;
        let end = start + byte_size as usize;
        if end > data.len() {
            return Err("CadbinReader: spatial index out of bounds".to_string());
        }
        let (index, consumed) = CadSpatialIndex::deserialize(&data[start..end])?;
        if consumed != byte_size as usize {
            return Err(format!(
                "CadbinReader: spatial index size mismatch, expected {}, consumed {}",
                byte_size, consumed
            ));
        }
        Ok(index)
    }

    pub fn read_block_table(data: &[u8], offset: u64) -> Result<(BlockTable, usize), String> {
        let start = offset as usize;
        if start >= data.len() {
            return Err("CadbinReader: block table offset out of bounds".to_string());
        }
        BlockTable::deserialize(&data[start..])
    }

    pub fn read_chunk_data(data: &[u8], offset: u64, byte_size: u64) -> Result<Vec<u8>, String> {
        let start = offset as usize;
        let end = start + byte_size as usize;
        if end > data.len() {
            return Err("CadbinReader: chunk data out of bounds".to_string());
        }
        Ok(data[start..end].to_vec())
    }

    pub fn read_chunk_index(data: &[u8], offset: u64) -> Result<Vec<ChunkIndexEntry>, String> {
        let start = offset as usize;
        if start + 2 > data.len() {
            return Err("CadbinReader: chunk index out of bounds".to_string());
        }
        let count = u16::from_le_bytes(data[start..start + 2].try_into().unwrap()) as usize;
        let mut entries = Vec::with_capacity(count);
        let mut pos = start + 2;

        for _ in 0..count {
            if pos + CHUNK_INDEX_ENTRY_SIZE > data.len() {
                return Err("CadbinReader: truncated chunk index entry".to_string());
            }
            let type_tag = data[pos];
            let entity_count = u32::from_le_bytes(data[pos + 1..pos + 5].try_into().unwrap());
            let chunk_offset = u64::from_le_bytes(data[pos + 5..pos + 13].try_into().unwrap());
            let byte_size = u64::from_le_bytes(data[pos + 13..pos + 21].try_into().unwrap());
            entries.push(ChunkIndexEntry {
                type_tag,
                entity_count,
                offset: chunk_offset,
                byte_size,
            });
            pos += CHUNK_INDEX_ENTRY_SIZE;
        }

        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::cad::{CadDocument, CadEntity, CadExtents, CadLayer, CadPoint};

    fn make_test_document() -> CadDocument {
        let entities = vec![
            CadEntity::Line {
                id: "1".to_string(),
                layer: "0".to_string(),
                color: 0xFFFFFF,
                start: CadPoint {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                },
                end: CadPoint {
                    x: 100.0,
                    y: 100.0,
                    z: 0.0,
                },
                line_weight: 0.25,
            },
            CadEntity::Circle {
                id: "2".to_string(),
                layer: "0".to_string(),
                color: 0xFF0000,
                center: CadPoint {
                    x: 50.0,
                    y: 50.0,
                    z: 0.0,
                },
                radius: 25.0,
                line_weight: 0.25,
            },
        ];
        CadDocument {
            file_name: "test.dwg".to_string(),
            version: "R2018".to_string(),
            profile: crate::domain::cad::CadProfile::Simple {
                entity_count: 2,
                coord_span_x: 100.0,
                coord_span_y: 100.0,
            },
            extents: Some(CadExtents {
                min: CadPoint {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                },
                max: CadPoint {
                    x: 100.0,
                    y: 100.0,
                    z: 0.0,
                },
            }),
            layers: vec![CadLayer {
                name: "0".to_string(),
                color: 7,
                visible: true,
                frozen: false,
                locked: false,
            }],
            entities,
            entity_count: 2,
            coordinate_offset: CadPoint {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            deleted_snapshots: Default::default(),
        }
    }

    #[test]
    fn test_cadbin_write_and_read_header() {
        let doc = make_test_document();
        let data = CadbinWriter::write_to_bytes(&doc);

        assert!(data.len() > FILE_HEADER_SIZE);
        assert_eq!(&data[0..4], &CADBIN_MAGIC);

        let info = CadbinReader::read_header(&data).unwrap();
        assert_eq!(info.version, CADBIN_VERSION);
        assert_eq!(info.entity_count, 2);
        assert_eq!(info.layer_count, 1);
        assert_eq!(info.bounds.0, 0.0);
        assert_eq!(info.bounds.2, 100.0);
    }

    #[test]
    fn test_cadbin_string_pool_roundtrip() {
        let doc = make_test_document();
        let data = CadbinWriter::write_to_bytes(&doc);
        let info = CadbinReader::read_header(&data).unwrap();

        let (pool, _) = CadbinReader::read_string_pool(&data, info.offset_strings).unwrap();
        assert!(pool.len() > 0);
    }

    #[test]
    fn test_cadbin_chunk_index_roundtrip() {
        let doc = make_test_document();
        let data = CadbinWriter::write_to_bytes(&doc);
        let info = CadbinReader::read_header(&data).unwrap();

        let entries = CadbinReader::read_chunk_index(&data, info.offset_chunk_index).unwrap();
        assert_eq!(entries.len() as u16, info.chunk_count);
        assert!(entries.iter().any(|e| e.type_tag == CHUNK_TAG_LINE));
        assert!(entries.iter().any(|e| e.type_tag == CHUNK_TAG_CIRCLE));
    }

    #[test]
    fn test_cadbin_spatial_index_roundtrip() {
        let doc = make_test_document();
        let data = CadbinWriter::write_to_bytes(&doc);
        let info = CadbinReader::read_header(&data).unwrap();

        // rtree 段紧跟在 blocks 之后、chunks 之前，所以 rtree 的大小是 offset_chunks - offset_rtree。
        let rtree_size = info.offset_chunks - info.offset_rtree;
        let index = CadbinReader::read_spatial_index(&data, info.offset_rtree, rtree_size).unwrap();
        assert_eq!(index.len(), 2);

        let result = index.query(0.0, 0.0, 10.0, 10.0);
        assert!(result.contains(&0));
    }
}
