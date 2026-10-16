//! Experimental, memory-only single-container KFX highlight resolver.
pub mod positions;
pub mod reader;
use boko::kfx::{
    container,
    ion::{IonParser, IonValue},
};

const MAX_BYTES: usize = 80 * 1024 * 1024;
const MAX_ENTITIES: usize = 20000;

#[derive(Debug, PartialEq)]
pub enum Error {
    TooLarge,
    Encrypted,
    Unsupported,
    Invalid,
}

pub struct Entity<'a> {
    pub id: u32,
    pub kind: u32,
    payload: &'a [u8],
}

impl Entity<'_> {
    /// Explicit decoding only; callers must not log the resulting private text.
    pub fn decode(&self) -> Result<IonValue, Error> {
        IonParser::new(self.payload)
            .parse()
            .map_err(|_| Error::Invalid)
    }
}

fn region(bytes: &[u8], offset: usize, length: usize) -> Result<&[u8], Error> {
    let end = offset.checked_add(length).ok_or(Error::Invalid)?;
    bytes.get(offset..end).ok_or(Error::Invalid)
}

/// Read one CONT container. No filesystem, network, or device writes.
/// Multipart books and compressed/encrypted entity payloads are not supported.
pub fn entities(bytes: &[u8]) -> Result<Vec<Entity<'_>>, Error> {
    if bytes.len() > MAX_BYTES {
        return Err(Error::TooLarge);
    }
    if bytes.starts_with(b"\xeaDRMION\xee") {
        return Err(Error::Encrypted);
    }
    let header = container::parse_container_header(bytes).map_err(|_| Error::Invalid)?;
    if header.header_len < 18 || header.header_len > bytes.len() {
        return Err(Error::Invalid);
    }
    let info_bytes = region(
        &bytes[..header.header_len],
        header.container_info_offset,
        header.container_info_length,
    )?;
    let info = container::parse_container_info(info_bytes).map_err(|_| Error::Invalid)?;
    let (offset, length) = info.index.ok_or(Error::Invalid)?;
    if length % 24 != 0 {
        return Err(Error::Invalid);
    }
    if length / 24 > MAX_ENTITIES {
        return Err(Error::TooLarge);
    }
    let index = region(&bytes[..header.header_len], offset, length)?;
    let mut result = Vec::new();
    let mut ranges = Vec::new();
    let mut ids = std::collections::HashSet::new();
    for entry in container::parse_index_table(index, header.header_len) {
        if !ids.insert((entry.id, entry.type_id)) {
            return Err(Error::Invalid);
        }
        let raw = region(bytes, entry.offset, entry.length)?;
        if raw.len() < 10 || !raw.starts_with(b"ENTY") {
            return Err(Error::Invalid);
        }
        let header_size = container::read_u32_le(raw, 6).ok_or(Error::Invalid)? as usize;
        if header_size < 10 || header_size >= raw.len() {
            return Err(Error::Invalid);
        }
        let metadata = IonParser::new(&raw[10..header_size])
            .parse()
            .map_err(|_| Error::Invalid)?;
        if metadata.get(411).and_then(IonValue::as_int) != Some(0) {
            return Err(Error::Encrypted);
        }
        if metadata.get(410).and_then(IonValue::as_int) != Some(0) {
            return Err(Error::Unsupported);
        }
        let payload = &raw[header_size..];
        // Only Ion payloads are decoded by this prototype; raw media is skipped.
        if payload.starts_with(b"\xe0\x01\x00\xea") {
            result.push(Entity {
                id: entry.id,
                kind: entry.type_id,
                payload,
            });
        }
        ranges.push((entry.offset, entry.offset + entry.length));
    }
    ranges.sort_unstable();
    if ranges.windows(2).any(|p| p[0].1 > p[1].0) {
        return Err(Error::Invalid);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use boko::kfx::ion::IonWriter;
    fn fixture() -> Vec<u8> {
        let entity = boko::kfx::serialization::create_entity_data(&IonValue::String(
            "Synthetic passage — café".into(),
        ));
        let mut info = IonWriter::new();
        info.write_bvm();
        info.write_struct(&[
            (
                container::symbol_id_for_name("bcIndexTabOffset").unwrap(),
                IonValue::Int(128),
            ),
            (
                container::symbol_id_for_name("bcIndexTabLength").unwrap(),
                IonValue::Int(24),
            ),
        ]);
        let info = info.into_bytes();
        let mut bytes = vec![0; 152];
        bytes[..4].copy_from_slice(b"CONT");
        bytes[4..6].copy_from_slice(&1u16.to_le_bytes());
        bytes[6..10].copy_from_slice(&152u32.to_le_bytes());
        bytes[10..14].copy_from_slice(&18u32.to_le_bytes());
        bytes[14..18].copy_from_slice(&(info.len() as u32).to_le_bytes());
        bytes[18..18 + info.len()].copy_from_slice(&info);
        bytes[128..132].copy_from_slice(&1u32.to_le_bytes());
        bytes[132..136].copy_from_slice(&145u32.to_le_bytes());
        bytes[144..152].copy_from_slice(&(entity.len() as u64).to_le_bytes());
        bytes.extend(entity);
        bytes
    }
    #[test]
    fn decodes_synthetic_container_in_memory() {
        let bytes = fixture();
        let parsed = entities(&bytes).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(
            parsed[0].decode().unwrap().as_string(),
            Some("Synthetic passage — café")
        );
    }
    #[test]
    fn rejects_truncation_and_encryption() {
        let bytes = fixture();
        for end in 0..bytes.len() {
            assert!(entities(&bytes[..end]).is_err());
        }
        assert!(matches!(entities(b"\xeaDRMION\xee"), Err(Error::Encrypted)));
    }
    #[test]
    fn rejects_overflow_and_partial_index() {
        let mut bytes = fixture();
        bytes[136..144].copy_from_slice(&u64::MAX.to_le_bytes());
        assert!(entities(&bytes).is_err());
        let mut bytes = fixture();
        bytes[6..10].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(entities(&bytes).is_err());
    }
}
