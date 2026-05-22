pub const CADBIN_MAGIC: [u8; 4] = [b'C', b'A', b'D', b'B'];
/// v3 changes vs v2:
///   1) entity_id 全局唯一（来自 CadDocument.entities 索引），跨 chunk 不再重复
///   2) 变长 chunk（LWPOLYLINE/POLYLINE/SPLINE/SOLID/HATCH）不再写入冗余的 leading u32 count，
///      统一从 ChunkIndexEntry.entity_count 读取
///   3) MTEXT chunk 在 attachment_points (u8[n]) 后 4 字节对齐 padding，再写 text_indices (u32[n])
pub const CADBIN_VERSION: u32 = 4;
pub const FILE_HEADER_SIZE: usize = 128;

#[inline]
pub fn padding_bytes(current_offset: usize, alignment: usize) -> usize {
    let m = current_offset % alignment;
    if m == 0 {
        0
    } else {
        alignment - m
    }
}

pub const CHUNK_TAG_LINE: u8 = 0x01;
pub const CHUNK_TAG_CIRCLE: u8 = 0x02;
pub const CHUNK_TAG_ARC: u8 = 0x03;
pub const CHUNK_TAG_ELLIPSE: u8 = 0x04;
pub const CHUNK_TAG_LWPOLYLINE: u8 = 0x05;
pub const CHUNK_TAG_POLYLINE: u8 = 0x06;
pub const CHUNK_TAG_SPLINE: u8 = 0x07;
pub const CHUNK_TAG_TEXT: u8 = 0x08;
pub const CHUNK_TAG_MTEXT: u8 = 0x09;
pub const CHUNK_TAG_SOLID: u8 = 0x0A;
pub const CHUNK_TAG_POINT: u8 = 0x0C;
pub const CHUNK_TAG_INSERT: u8 = 0x0D;
pub const CHUNK_TAG_HATCH: u8 = 0x0E;
pub const CHUNK_TAG_DIMENSION: u8 = 0x0F;
pub const CHUNK_TAG_LEADER: u8 = 0x10;
pub const CHUNK_TAG_ATTRIBUTE: u8 = 0x11;
pub const CHUNK_TAG_FACE3D: u8 = 0x12;
pub const CHUNK_TAG_POLYLINE2D: u8 = 0x13;
pub const CHUNK_TAG_TABLE: u8 = 0x14;
#[allow(dead_code)]
pub const CHUNK_TAG_UNKNOWN: u8 = 0xFF;

pub const LAYER_FLAG_VISIBLE: u8 = 0x01;
pub const LAYER_FLAG_FROZEN: u8 = 0x02;
pub const LAYER_FLAG_LOCKED: u8 = 0x04;
pub const LAYER_FLAG_ON: u8 = 0x08;

pub const CHUNK_INDEX_ENTRY_SIZE: usize = 1 + 4 + 8 + 8;

pub const LINE_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 4 + 8 + 8 + 8 + 8;
pub const CIRCLE_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 4 + 8 + 8 + 8;
pub const ARC_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 4 + 8 + 8 + 8 + 8 + 8;
pub const ELLIPSE_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 4 + 8 + 8 + 8 + 8 + 8 + 8 + 8;
pub const TEXT_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 8 + 8 + 8 + 8 + 4;
pub const MTEXT_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 4 + 4;
#[allow(dead_code)]
pub const SOLID_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 8 * 8;
pub const POINT_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 8 + 8;
pub const INSERT_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 8 + 8 + 8 + 8 + 8 + 4;
pub const DIMENSION_BYTES_PER_ENTITY: usize = 4 + 4 + 4 + 8 + 8 + 8 + 8 + 8 + 8 + 4;

#[allow(dead_code)]
pub fn chunk_tag_name(tag: u8) -> &'static str {
    match tag {
        CHUNK_TAG_LINE => "LINE",
        CHUNK_TAG_CIRCLE => "CIRCLE",
        CHUNK_TAG_ARC => "ARC",
        CHUNK_TAG_ELLIPSE => "ELLIPSE",
        CHUNK_TAG_LWPOLYLINE => "LWPOLYLINE",
        CHUNK_TAG_POLYLINE => "POLYLINE",
        CHUNK_TAG_SPLINE => "SPLINE",
        CHUNK_TAG_TEXT => "TEXT",
        CHUNK_TAG_MTEXT => "MTEXT",
        CHUNK_TAG_SOLID => "SOLID",
        CHUNK_TAG_POINT => "POINT",
        CHUNK_TAG_INSERT => "INSERT",
        CHUNK_TAG_HATCH => "HATCH",
        CHUNK_TAG_DIMENSION => "DIMENSION",
        CHUNK_TAG_LEADER => "LEADER",
        CHUNK_TAG_ATTRIBUTE => "ATTRIBUTE",
        CHUNK_TAG_FACE3D => "FACE3D",
        CHUNK_TAG_POLYLINE2D => "POLYLINE2D",
        CHUNK_TAG_TABLE => "TABLE",
        CHUNK_TAG_UNKNOWN => "UNKNOWN",
        _ => "RESERVED",
    }
}
