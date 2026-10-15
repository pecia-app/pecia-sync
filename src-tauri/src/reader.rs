use std::{io::Read, path::{Path, PathBuf}};

const MAX_BYTES: u64 = 32 * 1024 * 1024;

#[derive(serde::Serialize)]
pub struct ReaderFile {
    name: String,
    bytes: Vec<u8>,
}

fn supported(path: &Path) -> bool {
    matches!(path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().as_str(), "epub" | "pdf" | "mobi" | "azw3")
}

fn read_book(path: &Path) -> Result<ReaderFile, String> {
    if !supported(path) { return Err("unsupported".into()); }
    let file = std::fs::File::open(path).map_err(|_| "unavailable")?;
    let metadata = file.metadata().map_err(|_| "unavailable")?;
    if !metadata.is_file() || metadata.len() > MAX_BYTES { return Err("too-large".into()); }
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1).read_to_end(&mut bytes).map_err(|_| "unavailable")?;
    if bytes.len() as u64 > MAX_BYTES { return Err("too-large".into()); }
    let signature_ok = if path.extension().and_then(|s| s.to_str()).unwrap_or("").eq_ignore_ascii_case("pdf") {
        bytes.starts_with(b"%PDF-")
    } else if matches!(path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().as_str(), "mobi" | "azw3") {
        bytes.get(60..68) == Some(b"BOOKMOBI")
    } else { bytes.starts_with(b"PK\x03\x04") };
    if !signature_ok { return Err("invalid".into()); }
    Ok(ReaderFile { name: path.file_name().unwrap().to_string_lossy().into_owned(), bytes })
}

fn find_files(root: &Path, name: &str, depth: usize, remaining: &mut usize, found: &mut Vec<PathBuf>) {
    if depth > 32 || *remaining == 0 { return; }
    let Ok(entries) = std::fs::read_dir(root) else { return; };
    for entry in entries.flatten() {
        if *remaining == 0 { return; }
        *remaining -= 1;
        let Ok(kind) = entry.file_type() else { continue; };
        // Never traverse symlinks out of the device or follow directory cycles.
        if kind.is_dir() {
            find_files(&entry.path(), name, depth + 1, remaining, found);
        } else if kind.is_file() && entry.file_name() == name {
            found.push(entry.path());
        }
    }
}

fn resolve_book(roots: &[PathBuf], name: &str) -> Result<PathBuf, String> {
    if name.contains(['/', '\\']) || name == "." || name == ".." || !supported(Path::new(name)) {
        return Err("unsupported".into());
    }
    let mut found = Vec::new();
    let mut remaining = 20_000;
    for root in roots { find_files(root, name, 0, &mut remaining, &mut found); }
    // Partial traversal cannot establish uniqueness safely.
    if remaining == 0 || found.len() > 1 { return Err("ambiguous".into()); }
    found.pop().ok_or_else(|| "unavailable".into())
}

/// The only new content-read boundary. A user gesture either opens the native
/// picker or requests an exact EPUB/PDF basename on a currently mounted Kindle.
/// No caller-supplied filesystem paths, device writes, or content persistence.
#[tauri::command]
pub async fn open_reader_file(filename: Option<String>) -> Result<Option<ReaderFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = if let Some(name) = filename {
            let roots: Vec<_> = super::legacy_kindle_volumes().iter().map(|p| p.join("documents")).collect();
            resolve_book(&roots, &name)?
        } else {
            let Some(path) = rfd::FileDialog::new().add_filter("Books", &["epub", "pdf", "mobi", "azw3"]).pick_file()
                else { return Ok(None); };
            path
        };
        read_book(&path).map(Some)
    }).await.map_err(|_| "unavailable".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unsupported_paths_before_reading() {
        for name in ["../secret.pdf", "/tmp/a.epub", "folder\\a.pdf", "a.kfx", "a.azw"] {
            assert_eq!(resolve_book(&[], name).unwrap_err(), "unsupported");
        }
        assert_eq!(resolve_book(&[], "Book.pdf").unwrap_err(), "unavailable");
    }
    #[test]
    fn only_reads_supported_signatures_and_rejects_ambiguity() {
        let root = std::env::temp_dir().join(format!("pecia-reader-test-{}", std::process::id()));
        std::fs::create_dir_all(root.join("nested")).unwrap();
        let path = root.join("sample.pdf");
        std::fs::write(&path, b"%PDF-1.4\nfixture").unwrap();
        assert_eq!(read_book(&path).unwrap().name, "sample.pdf");
        assert_eq!(resolve_book(&[root.clone()], "sample.pdf").unwrap(), path);
        std::fs::write(root.join("nested/sample.pdf"), b"%PDF-1.4").unwrap();
        assert_eq!(resolve_book(&[root.clone()], "sample.pdf").unwrap_err(), "ambiguous");
        std::fs::write(root.join("invalid.epub"), b"not a zip").unwrap();
        assert_eq!(read_book(&root.join("invalid.epub")).err().unwrap(), "invalid");
        std::fs::remove_dir_all(root).unwrap();
    }
}
