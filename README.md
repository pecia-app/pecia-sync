# Pecia Sync

An open-source, offline, read-only Kindle and Kobo library importer for
[Pecia](https://pecia.app).

## Beta status

Pecia Sync is currently `0.1.0` and intended for testing. Kindle MTP and
Kindle USB Drive Mode have been tested on macOS. Kobo support has automated
coverage against a sanitized SQLite fixture but still needs a physical-device
test; it is not yet a compatibility promise. See the
[compatibility matrix](docs/compatibility.md).

Sync writes a Goodreads-shaped CSV with optional `Pecia Sync …` columns for
progress, last-read date, source, device ID and opt-in highlights. It uses an
explicit local review step: Kindle reads visible object names, while Kobo reads
only its local library metadata database in read-only mode. It never reads
ebook contents.

## Non-negotiable boundary

- No sign-in, background network requests, telemetry, runtime updater, or
  downloader.
- No Amazon, Kobo or Adobe credentials.
- No ebook file, DRM licence, cover or book content is read, uploaded or changed.
- Device discovery and metadata review happen only after the reader clicks the
  corresponding local action. Hardware serials are never returned to the UI.
- Nothing is installed or written to a connected e-reader.
- The only output is a CSV saved only after the reader chooses its destination
  in the native save panel.
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
desktop packages. Tagged releases are published as draft prereleases with
checksums.

## Help, security and contributing

For reader support or compatibility reports, email
[hola@pecia.app](mailto:hola@pecia.app). Do not attach ebooks, Kindle/Kobo
databases, account information, or device serial numbers.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and test expectations,
and [SECURITY.md](SECURITY.md) for responsible disclosure. Release history is
kept in [CHANGELOG.md](CHANGELOG.md).
