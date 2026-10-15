# Changelog

## 0.2.0 — beta

- Add a laptop-sized, bilingual dashboard with one-click scanning, book search,
  progress filters and CSV export.
- Read dated Kindle progress observations where exposed by mounted USB drives;
  missing data remains unknown and is never interpreted as unread.
- Add an offline, in-app reader for EPUB, PDF and DRM-free MOBI/AZW3, with
  contents navigation, text sizing/PDF zoom, a local bookmark and resume position.
- Bundle the reader parsers: no Calibre or network conversion is required.
- Use the Pecia logo in the interface and app icons, including native rebuilds
  when icons change.
- Add reader, privacy and compatibility documentation with synthetic screenshots.

Known beta limitations: KFX/AZW and DRM-protected books are unsupported;
highlights are not connected. Direct content opening is limited to mounted
Kindle USB drives; other connections require a local copy. Reader positions
stay on this computer and do not update Kindle progress. Reflowable section
counts are currently labelled as chapters. macOS packages are ad-hoc signed,
not Apple-notarized.

## 0.1.2 — beta

- Add an editable, local Goodreads matching review: safe title and author
  cleanup is shown before export, while incomplete records are flagged for
  correction instead of silently guessed.

## 0.1.1 — beta

- Fix the macOS bundle's ad-hoc signature so it opens through the normal
  Gatekeeper override instead of being reported as damaged.

## 0.1.0 — beta

- Offline, read-only CSV export compatible with Goodreads import fields.
- Kindle metadata review through MTP and USB Drive Mode.
- Kobo read-only metadata parser with sanitized fixture coverage; physical-device
  validation is still pending.
- Spanish-first interface with English switch, visible app version, and opt-in
  privacy-safe support diagnostics.
- Cross-platform CI and draft prerelease packaging for macOS, Linux, and Windows.
