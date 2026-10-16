# Security policy

Pecia Sync is a local, read-only desktop application. Please report suspected
security or privacy issues privately to [hola@pecia.app](mailto:hola@pecia.app)
with the subject `Pecia Sync security report`.

Do not include ebooks, Kindle/Kobo databases, account credentials, device
serial numbers, or personal highlights. Describe the affected version, host OS,
and the minimum steps to reproduce instead.

We will acknowledge reports and coordinate a fix before public disclosure.

## Reader boundary

Scanning remains metadata-only. Book contents are read only after an explicit
open action. The file picker grants access to the selected supported file;
direct device opens accept a basename rather than an arbitrary path and search
mounted Kindle documents directories. Development KFX opens also support exact
basename lookup under MTP documents, with bounded enumeration, a shared device
lock, and unique device/file requirements. Symlinks are skipped and duplicate
matches are refused. The app never writes to a device.

EPUB/MOBI/AZW3 and converted KFX documents are rebuilt using an allowlist of inert markup and local
raster images. The original document is never mounted as executable HTML.
Scripts, styles, external links, remote images, embedded fonts and media are
not loaded. PDF.js renders supplied bytes with XFA disabled; password-protected
PDFs are not supported. Network policy is not expanded for the reader.

Encrypted MOBI/KF8 headers, including hybrid records, are rejected before
parsing. EPUB encryption declarations are rejected. No DRM licences or
credentials are used and no protection is removed.

Development KFX conversion is in memory, after container/encryption preflight.
Source files are limited to 32 MiB, converted output to 80 MiB and the spine to
2,000 sections; EPUB expansion limits still apply. The inert HTML5 DOCTYPE is
stripped before XML parsing; external DTDs and entity declarations remain blocked.
Unsupported KFX structures fail closed. These bounds do not isolate the parser
or guarantee a hard process-memory limit. See [KFX reader scope](docs/KFX-READER.md).

Local reading positions and bookmarks are persisted, keyed by a content
hash. They are separate from device progress, CSV exports and support reports.
Book contents are not persisted by the reader or sent to a remote service.
Input and expanded-content bounds reduce resource exposure, but malformed book
parsers remain an attack surface; please report crashes or unexpected resource
loading with a minimal synthetic reproducer, not a private ebook.

## Highlights boundary (development)

Clippings are read only after an explicit import action, never by discovery
or a book scan. Direct USB import reads only `documents/My Clippings.txt` and
rejects symlink paths. Direct MTP import opens one Kindle by its current USB
location (never exposed to the frontend), lists root/documents metadata, and
streams only the exact clippings file with a 20 MB cap. Ambiguous devices/files
are refused. A shared device lock prevents concurrent scanning/import sessions;
MTP sessions are closed after success or failure. No device writes or resets.
The file picker accepts UTF-8 text files up to 20 MB; the parser
caps input at 50,000 entries. Source paths and annotation content are not logged
or included in diagnostics. No Kobo annotation query is made.

If the clippings file is absent over MTP, explicit import also reads bounded
annotation-database snapshots and matching DRM-free KFX books into memory.
Experimental recovered passages are preview-only: no persistence, fingerprints,
or export. Pending edits suppress recovery; unsupported maps are not guessed.
See `docs/KFX-INTEGRATION.md` for bounds and the GPL distribution release gate.

Clipping text and book headings are rendered using textContent. Markdown exports
escape source markup and are written only after a native save dialog. Exports
to detected Kindle/Kobo volumes or existing symlink destinations are refused.
Imported text remains in session memory, not localStorage. Only SHA-256 entry
fingerprints for the last successful import are persisted; these are local
comparison identifiers, not anonymized data or encryption. The clear-history
control removes them and the in-memory entries. Annotation import does not
alter the CSV export or reading-position stores.
