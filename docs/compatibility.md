# Compatibility matrix

This table records only tested combinations. A missing field means Sync omits it;
it never estimates progress or treats an untested device as supported.

| Device | Connection | Host | Library metadata | Progress | Status |
|---|---|---|---|---|---|
| Kindle Scribe 32GB (`1949:9981`) | MTP | macOS | MTP storage and book object names exposed | `system/cc.db` not exposed | Detection/title-metadata proof of concept complete; no cable-progress claim |
| Kindle 2016 | USB Drive Mode | macOS | `documents/` filenames and sidecar folders exposed | No standard `system/cc.db` found | Detection/title-metadata proof of concept complete; no cable-progress claim |
| Kobo eReader | USB storage | Sanitized fixture only | `.kobo/KoboReader.sqlite` title/author/ISBN, plus progress/date where exposed | Parsed from fixture | Not hardware-validated |

## Kindle Scribe 32GB probe — 4 October 2026

The device is visible to macOS as Amazon Kindle hardware but not as a mounted
volume. It exposes one internal storage area and lists object names such as KFX
book files and their sidecar metadata. A read-only filtered object listing
found no `system/cc.db` or `system` path. Pecia Sync uses a pure-Rust MTP
implementation for its native discovery and metadata review; `libmtp` was used
only as a development probe.

No object contents were downloaded, and no device operation that writes,
deletes, moves, copies or changes a property was used. The device serial number
is intentionally not recorded here.

## Kindle 2016 probe — 5 October 2026

In USB Drive Mode the reader mounted as a removable FAT32 volume. Pecia Sync
walked directory entries below `documents/` and selected supported book
filenames; it did not open those files. The usual progress database was not
present at the standard `system/cc.db` path, so the export deliberately leaves
progress, last-read and highlights blank.

## Kobo fixture coverage — 5 October 2026

Kobo's database schema is not an official stable interface. The fixture is an
in-memory database created from `src-tauri/fixtures/kobo/metadata.sql`; it has
fictional metadata only and contains no account data, book content, highlights,
or device identifier. The parser opens an actual Kobo database with SQLite's
read-only flag, tolerates absent optional ISBN/progress/date columns, and reads
only library-level records. A physical Kobo test is still required before
compatibility can be claimed.
