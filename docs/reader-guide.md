# Reading locally with Pecia Sync

This guide describes the reader in 0.2.0 beta. The older 0.1.2 installer does not
include it. KFX additions below apply only to development builds, not the 0.2.0
installer. Reading is offline; no Calibre installation or account is required.

![The reader with a fictional book and original demonstration text](screenshots/reader.png)

This is the actual interface, captured in a browser with synthetic book data.
It does not show a personal library or native window decorations.

## Open a book

1. Connect and unlock the Kindle, then click **Scan reader / Escanear lector**.
2. Double-click a book, or focus its row and press Enter.
3. For files on your Mac, or devices without direct content access, use
   **Open book / Abrir libro** and select a local file.

Direct device opening currently works for supported files on a mounted Kindle
USB drive. Development builds can also open a selected DRM-free KFX book from
a Kindle over MTP. Other MTP formats and Kobo require a local copy.
Duplicate filenames require selecting the intended file
with the picker.

| File | Reader behaviour |
|---|---|
| EPUB | Reflowable text and embedded raster images |
| PDF | Page view, zoom, and an expandable accessible-text view |
| DRM-free MOBI / AZW3 | Bundled parser; no external converter needed |
| DRM-free KFX (development) | Supported single-container subset; in-memory conversion, no external converter |
| AZW | Unsupported-format dialog |
| Encrypted ebook | Refused; Sync does not remove DRM |
| Password-protected PDF | Not supported yet |

Opening may take a moment while the local file is parsed. Errors appear in a
dialog; dismiss it and try a supported, unencrypted copy. Files above 32 MB are
rejected. Expanded book content is limited to 80 MB and each section to 16 MB.
EPUB encryption declarations, including font obfuscation, are currently rejected.

## Navigate and adjust reading

- Use the contents sidebar or bottom arrows to move between sections. For PDF,
  use the page selector or page arrows.
- The top slider changes text size for EPUB/MOBI/AZW3/KFX, or zoom for PDF.
- The heart-outline button saves one bookmark for the current book. **Go to
  bookmark / Ir al marcador** returns to it; saving again replaces it.
- **Back to library / Volver a biblioteca**, or Escape, closes the reader.

The sidebar prefers named contents entries. If none are available, it uses
section headings. Unnamed sections remain reachable with the bottom arrows.
Converted KFX internal identifiers are not shown as chapter names. If no named
sections exist, numbered section labels are used instead.
Multiple contents links within the same section currently share one destination.
Book styles, embedded fonts, scripts and external resources are not loaded, so
appearance can differ from the Kindle.

## Which page opens?

The first opening starts at the first section in the file. Later openings
restore the section and scroll position saved on this Mac. These are not the
Kindle's reading position.

For reflowable ebooks, the footer currently says **Chapter / Capítulo**, but
the number counts file sections—not necessarily publisher chapters or pages.
PDF numbers refer to pages.

## What is saved?

Only a local position and one bookmark, keyed by a hash of the book file, are
saved in the app's local webview storage. Book content is held in memory while
reading, not saved as a new copy by Sync. Changing the file changes its identity
and may start a new position. Clearing the app's webview storage resets positions.

Reading never updates the Kindle, the device-observed progress in the dashboard,
or progress exported to CSV. Scanning still reads metadata only; opening a book
is a separate explicit action.

See the [KFX limitations](KFX-READER.md), [compatibility matrix](compatibility.md) for tested scope and the
[security policy](../SECURITY.md) for the content-handling boundary.

## Reproduce documentation screenshots

With dependencies installed and Google Chrome available:

```sh
node scripts/capture-screenshots.mjs
```

The script starts an isolated local Vite server on port 1422, uses a fresh
browser context, mocks the native bridge and blocks non-local requests.
It generates an original two-section EPUB in memory and fictional device
metadata. It writes dashboard.png and reader.png to docs/screenshots/, then
checks next-section and return-to-library navigation. No Kindle is accessed.
To use a different installed Playwright browser channel, set SCREENSHOT_BROWSER.
Review both images before committing them.
