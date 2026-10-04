# Pecia Sync

An open-source, offline, read-only Kindle and Kobo library importer for
[Pecia](https://pecia.app).

## Current foundation

Sync writes a Goodreads-shaped CSV with optional `Pecia Sync …` columns for
exact progress, last-read date, source, device ID and opt-in highlights. Device
readers are the next milestone; until then the app does not request device-file
access.

## Non-negotiable boundary

- No sign-in, network requests, telemetry, updater, downloader or installer.
- No Amazon, Kobo or Adobe credentials.
- No ebook file, DRM licence, cover or book content is read, uploaded or changed.
- Nothing is installed or written to a connected e-reader.
- The only output is a CSV the reader deliberately saves locally.

The source and Tauri capability manifest are public so these claims can be
audited.

## Development

```sh
npm install
npm test
npm run build
npm run tauri dev
```

CI verifies the project on macOS, Ubuntu and Windows. Device parsing begins
with Kobo, then the 2016 Kindle mass-storage path; recent MTP Kindle support is
a compatibility gate, not a promise.
