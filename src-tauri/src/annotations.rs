use std::{io::Read, path::Path};
const MAX_BYTES: u64 = 20 * 1024 * 1024;
use mtp_rs::mtp::{MtpDevice, Storage, ObjectInfo, ObjectHandle, ListingItem, ByteRange};
#[path = "annotation_preview.rs"]
mod preview;

#[derive(serde::Serialize)]
#[serde(untagged)]
pub enum KindleImport {
    Clippings(String),
    Database { highlights: u64, notes: u64, pending: u64, previews: Vec<preview::Passage> },
}

// Only count confirmed synced records. Pending edits may include deletions, so
// these are explicitly not advertised as the current annotation total.
fn database_counts(bytes: &[u8]) -> Result<(u64, u64, u64), String> {
    if bytes.len() > MAX_BYTES as usize { return Err("too-large".into()); }
    if bytes.len() < 100 || !bytes.starts_with(b"SQLite format 3\0") { return Err("invalid".into()); }
    // Never silently discard a WAL or alter a database header to open a snapshot.
    if bytes[18] != 1 || bytes[19] != 1 { return Err("database-snapshot".into()); }
    let read = || -> rusqlite::Result<(u64,u64,u64)> {
        let mut db = rusqlite::Connection::open_in_memory()?;
        db.deserialize_read_exact(rusqlite::MAIN_DB, bytes, bytes.len(), true)?;
        db.execute_batch("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;")?;
        let count = |sql: &str| db.query_row(sql, [], |r| r.get::<_, u64>(0));
        Ok((count("SELECT count(*) FROM server_view WHERE dataset=1")?,
            count("SELECT count(*) FROM server_view WHERE dataset=3")?,
            count("SELECT count(*) FROM local_edit WHERE dataset IN (1,3)")?))
    };
    read().map_err(|_| "database-schema".into())
}

async fn mtp_database(device: &MtpDevice) -> Result<KindleImport, String> {
    let storages = device.storages().await.map_err(|_| "unavailable")?;
    if storages.len() > 16 { return Err("ambiguous".into()); }
    let mut totals = (0,0,0);
    let mut found = 0;
    let mut previews = Vec::new();
    for storage in &storages {
        let mut parent = None;
        let mut available = true;
        for name in ["system", "ksdk", ".annotations"] {
            let folders = find_objects(storage, parent, name, true).await?;
            if folders.len() > 1 { return Err("ambiguous".into()); }
            if let Some(folder) = folders.first() { parent = Some(folder.handle); }
            else { available = false; break; }
        }
        if !available { continue; }
        let mut listing = storage.list_objects_stream(parent).await.map_err(|_| "unavailable")?;
        let mut accounts = Vec::new();
        let mut examined = 0;
        while let Some(item) = listing.next().await {
            examined += 1;
            if examined > 20000 { return Err("too-large".into()); }
            match item.map_err(|_| "unavailable")? {
                ListingItem::Object(o) if o.is_folder() && o.filename.starts_with("amzn1.account.") => accounts.push(o.handle),
                ListingItem::Object(_) => {},
                ListingItem::Skipped(_) => return Err("unavailable".into()),
            }
        }
        drop(listing);
        if accounts.len() > 16 { return Err("too-large".into()); }
        for account in accounts {
            // WAL snapshots require a coherent read of multiple files; defer
            // rather than report stale or incomplete results.
            if !find_objects(storage, Some(account), "ksdk_annotation_v1.db-wal", false).await?.is_empty() {
                return Err("database-snapshot".into());
            }
            let files = find_objects(storage, Some(account), "ksdk_annotation_v1.db", false).await?;
            if files.len() > 1 { return Err("ambiguous".into()); }
            for file in files {
                found += 1;
                if found > 16 || file.size > MAX_BYTES { return Err("too-large".into()); }
                let bytes = storage.read_range(file.handle, 0, file.size as u32).await.map_err(|_| "unavailable")?;
                if bytes.len() as u64 != file.size { return Err("unavailable".into()); }
                let counts = database_counts(&bytes)?;
                totals.0 += counts.0; totals.1 += counts.1; totals.2 += counts.2;
                // A pending deletion/edit can invalidate a synced record. Never
                // reconstruct it until reconciliation is implemented.
                if counts.2 == 0 && counts.0 > 0 {
                    previews.extend(preview::recover(storage, &bytes).await?);
                }
            }
        }
    }
    if found == 0 { return Err("not-found".into()); }
    if totals.2 > 0 { previews.clear(); }
    Ok(KindleImport::Database { highlights: totals.0, notes: totals.1, pending: totals.2, previews })
}

fn mounted_path(root: &Path) -> Result<std::path::PathBuf, String> {
    let path = root.join("documents/My Clippings.txt");
    for part in [root.join("documents"), path.clone()] {
        let info = part.symlink_metadata().map_err(|_| "not-found")?;
        if info.file_type().is_symlink() { return Err("invalid".into()); }
    }
    Ok(path)
}

fn matching(info: &ObjectInfo, name: &str, folder: bool) -> bool {
    info.filename.eq_ignore_ascii_case(name) && info.is_folder() == folder
}

async fn find_objects(storage: &Storage, parent: Option<ObjectHandle>, name: &str, folder: bool) -> Result<Vec<ObjectInfo>, String> {
    let mut listing = storage.list_objects_stream(parent).await.map_err(|_| "unavailable")?;
    let mut matches = Vec::new();
    let mut count = 0;
    while let Some(item) = listing.next().await {
        count += 1;
        if count > 20000 { return Err("too-large".into()); }
        match item.map_err(|_| "unavailable")? {
            ListingItem::Object(info) => if matching(&info, name, folder) { matches.push(info); },
            // An unreadable object could be a second match: do not guess.
            ListingItem::Skipped(_) => return Err("unavailable".into()),
        }
    }
    Ok(matches)
}

async fn mtp_clippings(device: &MtpDevice) -> Result<String, String> {
    if !device.device_info().model.to_ascii_lowercase().contains("kindle") { return Err("no-device".into()); }
    let storages = device.storages().await.map_err(|_| "unavailable")?;
    if storages.len() > 16 { return Err("ambiguous".into()); }
    let mut candidates = Vec::new();
    for storage in &storages {
        let folders = find_objects(&storage, None, "documents", true).await?;
        if folders.len() > 1 { return Err("ambiguous".into()); }
        if let Some(folder) = folders.first() {
            for file in find_objects(&storage, Some(folder.handle), "My Clippings.txt", false).await? {
                candidates.push((storage, file));
            }
        }
    }
    if candidates.len() > 1 { return Err("ambiguous".into()); }
    let (storage, file) = candidates.pop().ok_or("not-found")?;
    if file.size > MAX_BYTES { return Err("too-large".into()); }
    let mut download = storage.download(file.handle, ByteRange::Full).await.map_err(|_| "unavailable")?;
    let mut bytes = Vec::new();
    while let Some(chunk) = download.next_chunk().await {
        let chunk = match chunk {
            Ok(chunk) => chunk,
            Err(_) => { let _ = download.cancel(std::time::Duration::from_secs(2)).await; return Err("unavailable".into()); }
        };
        if bytes.len() as u64 + chunk.len() as u64 > MAX_BYTES {
            let _ = download.cancel(std::time::Duration::from_secs(2)).await;
            return Err("too-large".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.len() as u64 != file.size { return Err("unavailable".into()); }
    String::from_utf8(bytes).map_err(|_| "invalid".into())
}

/// Explicit import; database fallback reads matching DRM-free KFX books in memory.
#[tauri::command]
pub async fn import_kindle_clippings() -> Result<KindleImport, String> {
    let _guard = super::DEVICE_ACCESS.try_lock().map_err(|_| "busy")?;
    let mounts = super::legacy_kindle_volumes();
    let devices: Vec<_> = MtpDevice::list_devices().map_err(|_| "unavailable")?.into_iter()
        .filter(|d| d.vendor_id == 0x1949 || d.product.as_deref().unwrap_or("").to_ascii_lowercase().contains("kindle"))
        .collect();
    if mounts.len() + devices.len() > 1 { return Err("ambiguous".into()); }
    if let Some(root) = mounts.into_iter().next() {
        return tauri::async_runtime::spawn_blocking(move || read_clippings(&mounted_path(&root)?))
            .await.map_err(|_| "unavailable".to_string())?.map(KindleImport::Clippings);
    }
    let info = devices.first().ok_or("no-device")?;
    let device = MtpDevice::builder().timeout(std::time::Duration::from_secs(15))
        .open_by_location(info.location_id).await.map_err(|_| "unavailable")?;
    let result = match mtp_clippings(&device).await {
        Ok(text) => Ok(KindleImport::Clippings(text)),
        Err(error) if error == "not-found" => mtp_database(&device).await,
        Err(error) => Err(error),
    };
    let closed = device.close().await;
    match result { Ok(text) => { closed.map_err(|_| "unavailable")?; Ok(text) }, Err(error) => Err(error) }
}

fn read_clippings(path: &Path) -> Result<String, String> {
    if !path.extension().is_some_and(|s| s.eq_ignore_ascii_case("txt")) { return Err("invalid".into()); }
    let file = std::fs::File::open(path).map_err(|_| "unavailable")?;
    let info = file.metadata().map_err(|_| "unavailable")?;
    if !info.is_file() || info.len() > MAX_BYTES { return Err("too-large".into()); }
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1).read_to_end(&mut bytes).map_err(|_| "unavailable")?;
    if bytes.len() as u64 > MAX_BYTES { return Err("too-large".into()); }
    String::from_utf8(bytes).map_err(|_| "invalid".into())
}

/// Explicit selection only. No annotation access during discovery or book scans.
#[tauri::command]
pub async fn open_clippings_file() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let path = rfd::FileDialog::new().set_title("My Clippings.txt").add_filter("Kindle clippings (UTF-8)", &["txt"]).pick_file();
        path.map(|p| read_clippings(&p)).transpose()
    }).await.map_err(|_| "unavailable".to_string())?
}

#[tauri::command]
pub async fn save_annotations(contents: String) -> Result<bool, String> {
    if contents.len() > 100 * 1024 * 1024 { return Err("too-large".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new().set_file_name("pecia-highlights.md").add_filter("Markdown", &["md"]).save_file() else { return Ok(false); };
        if !path.extension().is_some_and(|s| s.eq_ignore_ascii_case("md")) { return Err("invalid".into()); }
        // Even an explicit export must not write back to an attached e-reader.
        let parent = path.parent().and_then(|p| p.canonicalize().ok()).ok_or("unavailable")?;
        if super::legacy_kindle_volumes().into_iter().chain(super::kobo_volumes()).any(|mount| parent.starts_with(mount)) {
            return Err("device-write".into());
        }
        if path.symlink_metadata().is_ok_and(|m| m.file_type().is_symlink()) { return Err("invalid".into()); }
        std::fs::write(path, contents).map_err(|_| "unavailable")?;
        Ok(true)
    }).await.map_err(|_| "unavailable".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires explicit consent; reads matching KFX books in memory, logs no text"]
    fn physical_kindle_preview_read_only() {
        match tauri::async_runtime::block_on(import_kindle_clippings()).expect("Preview command failed") {
            KindleImport::Database{highlights,pending,previews,..}=>{
                assert_eq!(pending,0);assert!(highlights>0);assert_eq!(previews.len() as u64,highlights);
            },
            _=>panic!("Expected database fallback"),
        }
    }
    #[test]
    fn database_fallback_counts_only_supported_synced_records() {
        let db = rusqlite::Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE server_view(dataset INTEGER); CREATE TABLE local_edit(dataset INTEGER);
            INSERT INTO server_view VALUES(1),(1),(3),(9);
            INSERT INTO local_edit VALUES(1),(3),(8);").unwrap();
        let bytes = db.serialize(rusqlite::MAIN_DB).unwrap();
        assert_eq!(database_counts(&bytes).unwrap(), (2,1,2));
        let mut wal = bytes.to_vec(); wal[18] = 2;
        assert_eq!(database_counts(&wal).unwrap_err(), "database-snapshot");
        assert_eq!(database_counts(b"not sqlite").unwrap_err(), "invalid");
        let empty = rusqlite::Connection::open_in_memory().unwrap();
        empty.execute_batch("CREATE TABLE unsupported(id INTEGER)").unwrap();
        assert_eq!(database_counts(&empty.serialize(rusqlite::MAIN_DB).unwrap()).unwrap_err(), "database-schema");
    }
    #[test]
    #[ignore = "requires explicit consent and one connected Kindle; reads clippings in memory only"]
    fn physical_kindle_clippings_read_only() {
        let text = tauri::async_runtime::block_on(import_kindle_clippings()).expect("Kindle import failed");
        if let KindleImport::Clippings(text) = text {
            assert!(text.len() as u64 <= MAX_BYTES);
            assert!(text.is_empty() || text.contains("=========="), "Unexpected clipping structure");
        }
    }
    #[test]
    fn matches_only_the_clippings_filename() {
        let mut info = ObjectInfo::default();
        info.filename = "My Clippings.txt".into();
        assert!(matching(&info,"My Clippings.txt",false));
        assert!(!matching(&info,"My Clippings.txt",true));
        for name in ["Book.epub","My Clippings.txt.bak","../My Clippings.txt"] {
            info.filename = name.into(); assert!(!matching(&info,"My Clippings.txt",false));
        }
    }
    #[cfg(unix)]
    #[test]
    fn mounted_import_rejects_symlink_escape() {
        let root = std::env::temp_dir().join(format!("pecia-clippings-link-{}",std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::os::unix::fs::symlink(std::env::temp_dir(),root.join("documents")).unwrap();
        assert_eq!(mounted_path(&root).unwrap_err(),"invalid");
        std::fs::remove_file(root.join("documents")).unwrap(); std::fs::remove_dir(root).unwrap();
    }
    #[test]
    fn validates_text_without_modifying_source() {
        let path = std::env::temp_dir().join(format!("pecia-clippings-{}.txt",std::process::id()));
        let original = b"Synthetic Book\n- Your Note at location 1\n\nOriginal note\n==========\n";
        std::fs::write(&path, original).unwrap();
        assert_eq!(read_clippings(&path).unwrap().as_bytes(),original);
        assert_eq!(std::fs::read(&path).unwrap(),original);
        std::fs::write(&path,[255,254,0]).unwrap();
        assert_eq!(read_clippings(&path).unwrap_err(),"invalid");
        std::fs::File::create(&path).unwrap().set_len(MAX_BYTES+1).unwrap();
        assert_eq!(read_clippings(&path).unwrap_err(),"too-large");
        std::fs::remove_file(path).unwrap();
        assert_eq!(read_clippings(Path::new("book.epub")).unwrap_err(),"invalid");
    }
}
