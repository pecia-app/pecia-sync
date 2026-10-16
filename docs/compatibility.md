# Compatibility matrix

Device scanning and in-app reading are separate capabilities. Fixture coverage
is not a hardware-support promise; missing progress never means unread.

## Device scanning

### Development: MTP annotation database fallback

When `documents/My Clippings.txt` is absent, an explicit Import from Kindle
action checks `system/ksdk/.annotations/amzn1.account.*/ksdk_annotation_v1.db`.
The database is read into memory only (20 MiB per database, at most 16).
The UI reports synced highlight/note record counts and pending edit counts;
these are **not current annotation totals or imported text**. Existing imports
and local fingerprints are preserved. Pending edits are not reconciled.
WAL snapshots and unsupported schemas are refused rather than guessed.
Mounted USB devices still use the clippings-file importer only.

A read-only physical MTP probe on 15 October 2026 found two databases and three
synced highlight records. Those records contained positions, not highlight text.
The development app now recovers supported DRM-free KFX passages into an
experimental preview. Three passages were displayed from a physical Kindle;
exact endpoints remain subject to user comparison. Notes, pending-edit
reconciliation, and DRM-protected content are unsupported. Synthetic tests cover
counts, rejected snapshots, position resolution, and the preview UI;
no real annotation database or book content is retained as a fixture.

| Device | Connection | Host | Metadata | Progress | Validation |
|---|---|---|---|---|---|
| Kindle Scribe 32GB | MTP | macOS | Storage and book object names | Not exposed by current implementation | Physical-device detection and metadata probe |
| Kindle 2016 | USB Drive Mode | macOS | Filenames below documents/ | Optional, dated fmcache observations | Physical-device scan and dashboard exercised |
| Kobo eReader | USB storage | Synthetic fixture | Title/author/ISBN and optional fields from KoboReader.sqlite | Parsed from fixture | Not hardware-validated |

### Kindle Scribe probe — 4 October 2026

The device exposed MTP storage and KFX/sidecar object names but no mounted
volume or standard system/cc.db path. No ebook contents were downloaded during
the probe. Native scanning uses pure-Rust MTP; libmtp was only a development
probe. No serial number is recorded here.

### Kindle 2016 — 5 and 15 October 2026

The initial USB Drive Mode probe inspected filenames only and found no standard
system/cc.db. Later testing established that system/fmcache/fmcache.db can expose
temporary shared_reading_update_v2 observations.

Sync now reads that cache with SQLite's read-only flag and matches valid
percentages and timestamps to exact visible book filenames. Observations may
be stale, absent or different from the on-screen percentage. Sync does not
adjust them. The dashboard and CSV distinguish observation time from last-read
time. This does not establish 2024 Kindle/MTP progress support.

### Kobo fixture — 5 October 2026

Tests use an in-memory database built from src-tauri/fixtures/kobo/metadata.sql.
It contains fictional metadata only. The production parser uses SQLite
read-only mode and tolerates absent optional columns. A physical Kobo test is
still required.

## Highlights and notes (development, not in 0.2.0)

Explicit `Import from Kindle` reads `documents/My Clippings.txt` over mounted USB
or MTP. File selection additionally supports local
copies in UTF-8, with English/Spanish highlight and note metadata. Synthetic
tests cover parsing, duplicates, raw local dates, safe Markdown, new-entry
history and review UI, including cancellation/layout checks at laptop sizes.
Physical MTP connection and root/documents metadata enumeration were validated
on 15 October 2026. No clippings text file was present on that Kindle, so actual
content transfer still needs validation. No real annotations were logged or saved.
Kobo annotations, other languages and note-to-highlight
linking are not implemented. The file is an append-style export history, not
proof of current annotations or an exhaustive collection. No device writes.

## In-app reader (development)

| Format / path | Implemented | Evidence / limits |
|---|---|---|
| EPUB | Local, reflowable reader | Synthetic parsing/sanitization tests; broader visual validation pending |
| PDF | Local page renderer and zoom | Production build verified; end-to-end manual PDF validation pending |
| DRM-free MOBI | Bundled Foliate-js parser | Synthetic tests, read-only physical-file parser check, user exercised native macOS reader |
| DRM-free AZW3 / KF8 | Bundled Foliate-js parser | One physical-file parser check; broader visual validation pending |
| DRM-free KFX (development only) | Bounded single-container conversion in memory | Synthetic round trip and frontend regression tests; user confirmed native macOS reading and corrected contents labels on 16 October 2026; broader compatibility unverified |
| AZW | No | Unsupported-format dialog |
| Encrypted books | No | Encryption rejection tests; no DRM removal |
| Mounted Kindle USB content | Yes, for supported formats | Read-only open; bounded basename lookup, symlinks skipped, ambiguity rejected |
| Kindle MTP KFX content (development only) | Yes | Exact selected filename; unique device/file, bounded lookup and read; no device writes |
| Other MTP formats / Kobo direct content | No | Select a local copy instead |

Reader position is local to this app and is never written to the device or
merged into the dashboard's observed progress. Reflowable rendering deliberately
omits original CSS, fonts, scripts, remote resources and media.

CI builds on macOS, Ubuntu and Windows; that is not equivalent to physical-device
or visual-reader validation on all three platforms. No private ebooks or
screenshots are included in fixtures. See the [reader guide](reader-guide.md).
