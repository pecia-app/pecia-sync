# Licensing audit — 16 October 2026

Status: **distribution policy approved; binary release review still pending**.

The maintainer approved GPL-3.0-or-later distribution of the combined desktop
application, preserving existing MIT component notices. This is not approval
of a particular binary or a claim that every dependency obligation is resolved.

## Local inventory evidence

The first run of `npm run licenses:generate` on macOS produced 575 records
(locked Rust graph plus installed npm packages, including development tools).
No package in that inventory lacked a license identifier after setting the
desktop package metadata. The script reported 110 review items:

- 69 optional npm packages not installed on this host, mostly other-platform
  tool packages. These are not automatically licensing violations, nor proof
  that cross-platform source requirements are met.
- 41 packages with no separate license/notice file found by the collector.
  Some carry terms in source comments or upstream repository files. Investigate
  and preserve those exact notices rather than fabricating a copyright holder.

The generated `build/licenses/inventory.json` contains the precise versions,
sources and warning list; `THIRD-PARTY-NOTICES.txt` contains collected texts.
Both are ignored build outputs. Re-run after any dependency changes.

## Required follow-up before release

1. Resolve the 41 notice-file findings (including objc2-family crates, selectors,
   some Windows bindings and native npm tool packages). Record upstream revision
   evidence and package any required supplemental notices.
2. Audit preferred source for generated frontend distributions, particularly
   PDF.js, and add exact matching source/build material to the candidate where
   needed. A distribution tarball is not necessarily preferred source.
3. Inspect each platform's installer payload for bundled native libraries and
   assets; identify notices/source duties and justify any System Library
   exclusions. Do not infer the AppImage payload from Cargo metadata alone.
4. Generate the source archive from a clean committed checkout, test rebuilds
   on all claimed platforms, and verify that the published source corresponds
   to the published binaries. Source archive generation has not yet been
   validated end to end in this working tree.
5. Record review evidence, reviewer and current input hashes in
   `release/licensing-review.json` only after those checks pass.

Until then the release workflow intentionally refuses to package or publish a
tagged release. CI/local builds can still be used for engineering verification.
