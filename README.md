# Pecia Sync

An open-source, offline, read-only Kindle and Kobo library importer for
[Pecia](https://pecia.app).

## Beta status

Pecia Sync is currently `0.2.0` beta and intended for testing. Kindle MTP and
Kindle USB Drive Mode have been tested on macOS. Kobo support has automated
coverage against a sanitized SQLite fixture but still needs a physical-device
test; it is not yet a compatibility promise. See the
[compatibility matrix](docs/compatibility.md).

Sync writes a Goodreads-shaped CSV with optional `Pecia Sync …` columns for
progress, last-read date, source, device ID and opt-in highlights. It uses an
explicit local review step: Kindle reads visible object names, while Kobo reads
only its local library metadata database in read-only mode. Scanning never reads
ebook contents. Opening a book is a separate, explicit action.

## Highlights and notes (development, not in 0.2.0)

Use **Import from Kindle** to explicitly read `documents/My Clippings.txt`
from one connected Kindle over mounted USB or MTP. **Import file…** selects a
local copy instead. English and Spanish highlight/note entries
are supported. Review entries by book, search their text, filter new entries,
and export the filtered selection as one Markdown file for Obsidian or another
notes app. Nothing is automatically added to the library CSV.

Text stays in memory until the app closes or **Clear local history** is used.
Only SHA-256 entry fingerprints are saved locally to compare against the
previous successful import, including across restarts. Import the same source
for meaningful new-entry comparisons; switching files compares against the
previous file, not a per-device history. The first import marks every entry new.
The clear control removes both session text and this fingerprint history.

Clippings are an export log, not a live annotation database: deleted or edited
entries may remain, and copyright export limits can omit text. Exact repeated
entries are collapsed; changed text is preserved. Notes stay separate from
highlights. Book grouping uses the exact source heading, without guessing an
ISBN or merging with scanned library books. Dates retain the device's original
local text, without an inferred timezone.

Limits: UTF-8, 20 MB, 50,000 entries. Unsupported/malformed records and bookmarks
are counted and skipped. An empty/unsupported file or cancelled picker leaves
the previous import untouched. Cancelling leaves the panel unchanged without
a persistent message. **View highlights** appears after a successful import;
**Privacy & history** remains available for clearing fingerprints after restart.

When the clippings file is absent on MTP, the importer checks the Kindle's
annotation database and reads matching DRM-free KFX books into memory to recover
synced highlight passages. This experimental preview is not saved, fingerprinted,
or exportable; previous clippings imports remain intact. Pending edits suppress
the preview. Three passages were recovered on a physical Kindle and displayed
in the dev app; exact boundaries still require comparison with the device.
The card provides a manual quote carousel and a full review window.
Multiple devices or ambiguous matches are refused. No uploads, resets, deletes,
or saved device copies. Kobo annotations are not implemented.
See [KFX integration and release licensing requirements](docs/KFX-INTEGRATION.md).
The development executable now includes GPL-3.0-or-later decoder code and must
not be described or distributed as MIT-only; complete the release review first.
The source format was checked against
[KindleMate2's format documentation](https://github.com/lzcapp/KindleMate2/blob/main/formats.md).

Browser regression checks (synthetic data only): after `npm run build`, install
Playwright WebKit with `npx playwright install webkit`, ensure Chrome is installed,
then run `node scripts/test-highlights.mjs`.

## Offline reader (0.2.0 beta)

See the [reader guide](docs/reader-guide.md) for opening books, navigation,
bookmarks, resume behaviour and troubleshooting.

![Dashboard with a synthetic demonstration library](docs/screenshots/dashboard.png)

![Offline reader with original demonstration text](docs/screenshots/reader.png)

Screenshots capture the real webview interface in a browser at 1200 × 760.
Device responses and book contents are synthetic; they are not hardware-support
evidence. Native macOS window decorations are not included.

Double-click a supported book (or focus it and press Enter), or use **Open book**
to select a local file. EPUB, PDF, DRM-free MOBI and AZW3 are supported by bundled
parsers: no Calibre installation or network conversion is required. Direct
device opening currently supports mounted Kindle USB drives; MTP and Kobo users
can select a local copy. AZW is not supported.

Development builds additionally open a bounded subset of DRM-free,
single-container KFX, including a selected Kindle book over MTP. Conversion to
EPUB stays in memory and uses the existing inert renderer. This is not part of
the 0.2.0 installer. See the [KFX reader scope and validation](docs/KFX-READER.md)
and its GPL distribution release gate before distributing a build.

The reader provides section/page navigation, text sizing or PDF zoom, a local
bookmark and resume position. Positions are keyed by a content hash and stored
in local webview storage, separately from device progress and CSV exports.
No book content is persisted by the reader. Original files are never modified.

MOBI/AZW3 parsing uses pinned MIT-licensed
[Foliate-js](https://github.com/johnfactotum/foliate-js); its license ships in
public/licenses/foliate-js.txt. Its full HTML renderer is not used: extracted
text and embedded raster images pass through our inert allowlist renderer.
Book scripts, styles, external URLs, media and embedded fonts are not loaded.
Encryption is rejected, including encrypted headers in hybrid MOBI/KF8 files.
This is a simplified reflowable reader, not exact Kindle typesetting.

Limits: 32 MB input, 80 MB expanded content, 16 MB per section. Password-protected
PDFs and EPUBs with encryption declarations are currently unsupported.
Regression tests use synthetic content. Read-only parser checks succeeded for
one physical-device MOBI (29 sections) and one AZW3; no private book fixtures
are committed. Broader firmware/book compatibility is not yet guaranteed.

### Kindle progress observations

On mounted Kindle USB drives, review also reads
`system/fmcache/fmcache.db` with SQLite's read-only flag. The latest valid
`shared_reading_update_v2` percentage is matched to a visible book by its exact
filename content-ID suffix. Only the percentage and observation time are
returned alongside that book. Missing, inaccessible or incompatible caches
leave progress unavailable; they never imply unread.

These are temporary observations, not a complete or live reading history.
The device-reported value may differ from the on-screen percentage; Sync does
not adjust it. The review displays the observation time, and CSV exports carry
it in `Pecia Sync Progress Observed At`, separately from `Pecia Sync Last Read`.
The 2016 Kindle was inspected read-only; MTP progress extraction is not yet
implemented or validated on the 2024 Kindle. Progress scanning opens no ebook contents.

## Local Goodreads review

Before saving a CSV, Sync makes a small number of safe, local presentation
fixes that can improve matching in Goodreads, such as moving a trailing article
to the front of a title or separating an accidentally joined author name. The
review summary keeps this compact: it shows how many records are ready, which
ones were adjusted, and which need attention.

Sync never looks up books online, invents an ISBN, or guesses an author or
edition. Records with incomplete metadata, such as a missing author, are put in
an editable review queue. Any edits apply only to the CSV the reader explicitly
chooses to save; the e-reader is never changed. ISBNs remain the most reliable
way for Goodreads to match a particular edition.

## Non-negotiable boundary

- No sign-in, background network requests, telemetry, runtime updater, or
  downloader.
- No Amazon, Kobo or Adobe credentials.
- Book contents are read only after an explicit open action. No DRM licence is
  read, no protection is removed, and no content is uploaded or modified.
- Device discovery and metadata review happen only after the reader clicks the
  corresponding local action. Hardware serials are never returned to the UI.
- Nothing is installed or written to a connected e-reader.
- CSV output is saved only after the reader chooses its destination in the
  native save panel. Reader positions and bookmarks are stored locally.
- The app keeps no persistent logs. Its optional support email includes only
  the app version, OS/architecture, and a short in-memory record of safe
  operation counts—never book titles, files, databases, accounts or device IDs.

The source and Tauri capability manifest are public so these claims can be
audited.

## Development

```sh
npm install
npm test
npm run build
npm run tauri dev
cargo test --manifest-path src-tauri/Cargo.toml
```

CI verifies the project on macOS, Ubuntu and Windows and builds distributable
desktop packages. Tagged releases include checksums for every installer.

## Help, security and contributing

For reader support or compatibility reports, email
[hola@pecia.app](mailto:hola@pecia.app). Do not attach ebooks, Kindle/Kobo
databases, account information, or device serial numbers.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and test expectations,
and [SECURITY.md](SECURITY.md) for responsible disclosure. Release history is
kept in [CHANGELOG.md](CHANGELOG.md).
