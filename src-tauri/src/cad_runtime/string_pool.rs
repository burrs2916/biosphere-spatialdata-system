use std::collections::HashMap;

pub struct StringPool {
    strings: Vec<String>,
    index: HashMap<String, u32>,
}

impl StringPool {
    pub fn new() -> Self {
        StringPool {
            strings: Vec::new(),
            index: HashMap::new(),
        }
    }

    pub fn intern(&mut self, s: &str) -> u32 {
        if let Some(&idx) = self.index.get(s) {
            return idx;
        }
        let idx = self.strings.len() as u32;
        self.strings.push(s.to_string());
        self.index.insert(s.to_string(), idx);
        idx
    }

    pub fn get(&self, idx: u32) -> Option<&str> {
        self.strings.get(idx as usize).map(|s| s.as_str())
    }

    pub fn len(&self) -> usize {
        self.strings.len()
    }

    pub fn is_empty(&self) -> bool {
        self.strings.is_empty()
    }

    pub fn serialize(&self) -> Vec<u8> {
        let mut buf = Vec::new();
        let count = self.strings.len() as u32;
        buf.extend_from_slice(&count.to_le_bytes());
        for s in &self.strings {
            let bytes = s.as_bytes();
            let len = bytes.len() as u16;
            buf.extend_from_slice(&len.to_le_bytes());
            buf.extend_from_slice(bytes);
        }
        buf
    }

    pub fn deserialize(data: &[u8]) -> Result<(StringPool, usize), String> {
        let mut offset = 0;
        if data.len() < 4 {
            return Err("StringPool: insufficient data for count".to_string());
        }
        let count = u32::from_le_bytes(data[0..4].try_into().unwrap()) as usize;
        offset += 4;

        let mut pool = StringPool::new();
        for _ in 0..count {
            if offset + 2 > data.len() {
                return Err("StringPool: insufficient data for string length".to_string());
            }
            let len = u16::from_le_bytes(data[offset..offset + 2].try_into().unwrap()) as usize;
            offset += 2;
            if offset + len > data.len() {
                return Err("StringPool: insufficient data for string content".to_string());
            }
            let s = std::str::from_utf8(&data[offset..offset + len])
                .map_err(|e| format!("StringPool: invalid utf8: {}", e))?;
            pool.intern(s);
            offset += len;
        }

        Ok((pool, offset))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intern_dedup() {
        let mut pool = StringPool::new();
        let a = pool.intern("hello");
        let b = pool.intern("world");
        let c = pool.intern("hello");
        assert_eq!(a, 0);
        assert_eq!(b, 1);
        assert_eq!(c, 0);
        assert_eq!(pool.len(), 2);
    }

    #[test]
    fn test_serialize_deserialize() {
        let mut pool = StringPool::new();
        pool.intern("图层1");
        pool.intern("图层2");
        pool.intern("文字内容测试");

        let data = pool.serialize();
        let (pool2, consumed) = StringPool::deserialize(&data).unwrap();
        assert_eq!(consumed, data.len());
        assert_eq!(pool2.get(0), Some("图层1"));
        assert_eq!(pool2.get(1), Some("图层2"));
        assert_eq!(pool2.get(2), Some("文字内容测试"));
    }
}
