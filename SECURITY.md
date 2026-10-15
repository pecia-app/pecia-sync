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
only mounted Kindle documents directories. Symlinks are skipped and duplicate
matches are refused. The app never writes to a device.

EPUB/MOBI/AZW3 documents are rebuilt using an allowlist of inert markup and local
raster images. The original document is never mounted as executable HTML.
Scripts, styles, external links, remote images, embedded fonts and media are
not loaded. PDF.js renders supplied bytes with XFA disabled; password-protected
PDFs are not supported. Network policy is not expanded for the reader.

Encrypted MOBI/KF8 headers, including hybrid records, are rejected before
parsing. EPUB encryption declarations are rejected. No DRM licences or
credentials are used and no protection is removed.

Only local reading positions and bookmarks are persisted, keyed by a content
hash. They are separate from device progress, CSV exports and support reports.
Book contents are not persisted by the reader or sent to a remote service.
Input and expanded-content bounds reduce resource exposure, but malformed book
parsers remain an attack surface; please report crashes or unexpected resource
loading with a minimal synthetic reproducer, not a private ebook.
