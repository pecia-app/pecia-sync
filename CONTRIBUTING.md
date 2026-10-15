# Contributing to Pecia Sync

Thanks for helping make a local, inspectable importer for readers.

## Development

```sh
npm install
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Use `npm run tauri dev` to run the desktop app locally. CI also verifies builds
on macOS, Linux, and Windows.

## Privacy and device safety

Keep changes read-only by default. Never add background network activity,
telemetry, automatic updates, credentials, or operations that modify an
e-reader. Do not commit device backups, ebook files, reader databases, serial
numbers, account information, or real annotations. Use minimal sanitized
fixtures instead.

Documentation screenshots must use synthetic or clearly public-domain content,
never a contributor's real library, private annotations or copyrighted book
excerpts. Label fixture-based captures as such; do not present them as hardware
compatibility evidence. Capture the actual interface rather than a design mockup.

## Pull requests

Explain the device/firmware scope, add regression coverage, and state whether
the change was tested on physical hardware or only against a fixture. Keep the
compatibility matrix accurate: fixture coverage is not hardware support.
