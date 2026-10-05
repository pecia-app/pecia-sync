#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectedDevice {
    manufacturer: Option<String>,
    product: Option<String>,
    connection: String,
    vendor_id: u16,
    product_id: u16,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MetadataReview {
    manufacturer: String,
    model: String,
    storage_count: usize,
    object_count: usize,
    skipped_object_count: usize,
    book_names: Vec<String>,
    books: Vec<ReviewedBook>,
}

#[derive(serde::Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ReviewedBook {
    title: String,
    author: String,
    isbn: Option<String>,
    progress: Option<f64>,
    last_read: Option<String>,
    source: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticSnapshot {
    app_version: &'static str,
    operating_system: &'static str,
    architecture: &'static str,
}

/// Returns static application information for a user-initiated support email.
/// It does not read device data, write a log, or contact a network service.
#[tauri::command]
fn diagnostic_snapshot() -> DiagnosticSnapshot {
    DiagnosticSnapshot {
        app_version: env!("CARGO_PKG_VERSION"),
        operating_system: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
    }
}

/// Lists visible MTP devices without opening a device session or exposing a serial number.
#[tauri::command]
fn list_connected_devices() -> Result<Vec<ConnectedDevice>, String> {
    let mut devices = mtp_rs::mtp::MtpDevice::list_devices()
        .map(|devices| devices.into_iter().map(|device| ConnectedDevice {
            manufacturer: device.manufacturer,
            product: device.product,
            connection: "mtp".into(),
            vendor_id: device.vendor_id,
            product_id: device.product_id,
        }).collect::<Vec<_>>())
        .map_err(|error| error.to_string())?;
    devices.extend(legacy_kindle_volumes().into_iter().map(|_| ConnectedDevice {
        manufacturer: Some("Amazon".into()),
        product: Some("Kindle (USB Drive Mode)".into()),
        connection: "usb-drive".into(),
        vendor_id: 0,
        product_id: 0,
    }));
    devices.extend(kobo_volumes().into_iter().map(|_| ConnectedDevice {
        manufacturer: Some("Kobo".into()),
        product: Some("Kobo eReader (USB storage)".into()),
        connection: "kobo-usb".into(),
        vendor_id: 0,
        product_id: 0,
    }));
    Ok(devices)
}

/// Kobo readers normally mount as USB storage. Presence is checked by path only;
/// no database or book is opened during discovery.
fn kobo_volumes() -> Vec<std::path::PathBuf> {
    sysinfo::Disks::new_with_refreshed_list()
        .list()
        .iter()
        .filter(|disk| disk.is_removable())
        .map(|disk| disk.mount_point().to_path_buf())
        .filter(|mount_point| mount_point.join(".kobo").join("KoboReader.sqlite").is_file())
        .collect()
}

fn legacy_kindle_volumes() -> Vec<std::path::PathBuf> {
    sysinfo::Disks::new_with_refreshed_list()
        .list()
        .iter()
        .filter(|disk| disk.is_removable() && disk.name().to_string_lossy().eq_ignore_ascii_case("kindle"))
        .map(|disk| disk.mount_point().to_path_buf())
        .filter(|mount_point| mount_point.join("documents").is_dir())
        .collect()
}

fn is_book_filename(name: &str) -> bool {
    matches!(name.rsplit('.').next().unwrap_or_default().to_ascii_lowercase().as_str(), "azw" | "azw3" | "azw4" | "kfx" | "mobi" | "epub" | "pdf")
}

fn collect_legacy_metadata(path: &std::path::Path, object_count: &mut usize, skipped_object_count: &mut usize, book_names: &mut Vec<String>) {
    let entries = match std::fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => {
            *skipped_object_count += 1;
            return;
        }
    };
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                *skipped_object_count += 1;
                continue;
            }
        };
        *object_count += 1;
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => {
                *skipped_object_count += 1;
                continue;
            }
        };
        if file_type.is_dir() {
            collect_legacy_metadata(&entry.path(), object_count, skipped_object_count, book_names);
        } else if file_type.is_file() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if is_book_filename(&name) {
                book_names.push(name);
            }
        }
    }
}

/// Queries Kobo's library index with SQLite's read-only flag. The allowed column
/// names are selected from the schema first so older firmware can omit optional
/// progress/date fields without causing a write or a schema migration.
fn read_kobo_metadata(database_path: &std::path::Path) -> Result<Vec<ReviewedBook>, String> {
    let database = Connection::open_with_flags(database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("Could not open Kobo metadata read-only: {error}"))?;
    read_kobo_metadata_from_connection(&database)
}

fn read_kobo_metadata_from_connection(database: &Connection) -> Result<Vec<ReviewedBook>, String> {
    let mut schema = database.prepare("PRAGMA table_info(content)")
        .map_err(|error| format!("Kobo metadata schema is unavailable: {error}"))?;
    let columns = schema.query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<std::collections::HashSet<_>, _>>()
        .map_err(|error| error.to_string())?;
    if !columns.contains("Title") || !columns.contains("Attribution") || !columns.contains("ContentType") {
        return Err("This Kobo database does not expose the expected library metadata".into());
    }
    let isbn = if columns.contains("ISBN") { "ISBN" } else { "NULL" };
    let progress = if columns.contains("___PercentRead") { "___PercentRead" } else { "NULL" };
    let last_read = if columns.contains("DateLastRead") { "DateLastRead" } else { "NULL" };
    let accessibility = if columns.contains("Accessibility") { " AND Accessibility = 1" } else { "" };
    let query = format!(
        "SELECT Title, Attribution, {isbn}, {progress}, {last_read} FROM content WHERE ContentType = 6{accessibility} AND Title IS NOT NULL ORDER BY {last_read} DESC"
    );
    let mut statement = database.prepare(&query).map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok(ReviewedBook {
        title: row.get::<_, String>(0)?,
        author: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
        isbn: row.get(2)?,
        progress: row.get(3)?,
        last_read: row.get(4)?,
        source: "kobo".into(),
    })).map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

/// Opens one MTP session after an explicit UI request and reads object metadata
/// only. It never calls download, upload, rename, move, copy, delete, or reset.
#[tauri::command]
async fn review_visible_metadata(connection: String) -> Result<MetadataReview, String> {
    if connection == "kobo-usb" {
        let mount_point = kobo_volumes().into_iter().next()
            .ok_or_else(|| "No mounted Kobo volume found".to_string())?;
        let books = read_kobo_metadata(&mount_point.join(".kobo").join("KoboReader.sqlite"))?;
        return Ok(MetadataReview {
            manufacturer: "Kobo".into(),
            model: "Kobo eReader (USB storage)".into(),
            storage_count: 1,
            object_count: books.len(),
            skipped_object_count: 0,
            book_names: Vec::new(),
            books,
        });
    }
    if connection == "usb-drive" {
        let mount_point = legacy_kindle_volumes().into_iter().next()
            .ok_or_else(|| "No mounted Kindle USB Drive Mode volume found".to_string())?;
        let mut object_count = 0;
        let mut skipped_object_count = 0;
        let mut book_names = Vec::new();
        collect_legacy_metadata(&mount_point.join("documents"), &mut object_count, &mut skipped_object_count, &mut book_names);
        return Ok(MetadataReview {
            manufacturer: "Amazon".into(),
            model: "Kindle (USB Drive Mode)".into(),
            storage_count: 1,
            object_count,
            skipped_object_count,
            book_names,
            books: Vec::new(),
        });
    }
    let device = mtp_rs::mtp::MtpDevice::open_first()
        .await
        .map_err(|error| error.to_string())?;
    let info = device.device_info().clone();
    let storages = device.storages().await.map_err(|error| error.to_string())?;
    let storage_count = storages.len();
    let mut object_count = 0;
    let mut skipped_object_count = 0;
    let mut book_names = Vec::new();

    for storage in storages {
        let listing = storage
            .collect_objects_recursive(None)
            .await
            .map_err(|error| error.to_string())?;
        object_count += listing.objects.len();
        skipped_object_count += listing.skipped.len();
        for object in listing.objects {
            let name = object.filename;
            if is_book_filename(&name) {
                book_names.push(name);
            }
        }
    }

    device.close().await.map_err(|error| error.to_string())?;
    Ok(MetadataReview {
        manufacturer: info.manufacturer,
        model: info.model,
        storage_count,
        object_count,
        skipped_object_count,
        book_names,
        books: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sanitized_kobo_library_metadata() {
        let database = Connection::open_in_memory().unwrap();
        database.execute_batch(include_str!("../fixtures/kobo/metadata.sql")).unwrap();
        assert_eq!(read_kobo_metadata_from_connection(&database).unwrap(), vec![
            ReviewedBook { title: "The Left Hand of Darkness".into(), author: "Ursula K. Le Guin".into(), isbn: Some("9780441478125".into()), progress: Some(0.62), last_read: Some("2026-10-05T09:30:00Z".into()), source: "kobo".into() },
            ReviewedBook { title: "Solenoide".into(), author: "Mircea Cărtărescu".into(), isbn: None, progress: Some(1.0), last_read: Some("2026-09-30T18:12:00Z".into()), source: "kobo".into() },
        ]);
    }

    #[test]
    fn kindle_mtp_filters_visible_book_object_names() {
        assert!(is_book_filename("El extranjero - Camus_A1B2C3D4E5F6.kfx"));
        assert!(is_book_filename("A book.azw3"));
        assert!(!is_book_filename("metadata.sdr"));
    }

    #[test]
    fn kindle_usb_drive_walks_names_without_reading_contents() {
        let root = std::env::temp_dir().join(format!("pecia-sync-test-{}", std::process::id()));
        let documents = root.join("documents").join("sidecars");
        std::fs::create_dir_all(&documents).unwrap();
        std::fs::write(documents.join("Clean Coder, The - Robert C. Martin_XYZ1234567.kfx"), "not read").unwrap();
        std::fs::write(documents.join("sidecar.sdr"), "not read").unwrap();
        let (mut objects, mut skipped, mut names) = (0, 0, Vec::new());
        collect_legacy_metadata(&root.join("documents"), &mut objects, &mut skipped, &mut names);
        std::fs::remove_dir_all(&root).unwrap();
        assert_eq!(objects, 3);
        assert_eq!(skipped, 0);
        assert_eq!(names, vec!["Clean Coder, The - Robert C. Martin_XYZ1234567.kfx"]);
    }
}

/// Saves the caller-provided CSV only after the reader selects a destination in
/// the native save panel. Cancelling the panel writes nothing.
#[tauri::command]
fn save_csv(default_filename: String, contents: String, dialog_title: String) -> Result<bool, String> {
    let path = rfd::FileDialog::new()
        .set_title(dialog_title)
        .set_file_name(default_filename)
        .add_filter("CSV", &["csv"])
        .save_file();

    match path {
        Some(path) => {
            std::fs::write(path, contents).map_err(|error| error.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_connected_devices, review_visible_metadata, save_csv, diagnostic_snapshot])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
use rusqlite::{Connection, OpenFlags};
