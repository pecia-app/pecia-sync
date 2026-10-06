# Changelog

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
