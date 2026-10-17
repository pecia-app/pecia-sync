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

## Notice and source follow-up

The collector now recognizes SPDX/dotted license filenames but rejects code
modules such as `copying.rs`. The latter exposed an additional objc2-foundation
finding that had been incorrectly counted as a notice. All original 41 missing
file findings, plus that false positive, now have collected upstream notice
material. This does **not** mean all legal questions are resolved.

`release/notice-supplements.json` has 101 exact package/version mappings,
including sibling native npm packages for other platforms. The checked-in
`LICENSES/third-party/` texts are keyed by SHA-256 and checked on every
generation/check. Rust provenance comes from published `.cargo_vcs_info.json`
where available; exceptions identify their parent package/release basis.
Published npm gitHeads or immutable release commits identify frontend notices.
No template copyright holder was invented. Supplement changes invalidate release
review hashes.

The refreshed local inventory still contains 575 packages, with **zero missing
notice-file findings**. It retains 69 optional-platform informational warnings
and 20 explicit legal-review flags for one upstream family: objc2/block2/dispatch2.
Their [upstream licensing summary](https://github.com/madsmtm/objc2/blob/8852b424193ca41602281b3d7540d7c8ed51e49a/LICENSE.md)
discusses uncertainty concerning Apple SDK-derived bindings and references
standard license terms rather than including their full text. The summary is
preserved, not treated as legal clearance. A qualified review or upstream
clarification is still needed before marking this family approved.

Preferred-source archives for every direct frontend dependency are now pinned
by package version, upstream commit and SHA-256 in `release/preferred-source.json`:
PDF.js, fflate, Tauri API, the opener plugin and Foliate-js. PDF.js's upstream
commit matches the `pdfjsBuild` identifier in the installed distribution.
These archives include original source/build material rather than only npm's
compiled files. Source candidates include the archives and preserve relative
npm executable symlinks instead of links to the packaging machine.

A temporary clean audit snapshot was archived, extracted, and verified on macOS
arm64. Its 34 frontend tests, 7 licensing tests, TypeScript/Vite build and 12
native tests passed; 2 hardware tests remained ignored. Cargo used vendored
dependencies in offline mode. This validates the local source mechanics, not
bit-for-bit reproduction of a release binary or complete legal compliance.
The temporary snapshot is not a release commit. Subsequent PR #15 source-audit
CI passed on macOS, Linux and Windows; see
[platform evidence](RELEASE-SOURCE-EVIDENCE.md) for exact revisions, archive
hashes and scope. This supersedes the earlier pending cross-platform check,
but does not certify installer payloads or a future release archive.

Inspection of the previously built macOS app found dynamic references only to
`/usr/lib` and `/System/Library/Frameworks`, with no separately bundled dylibs,
WASM or font files. This is limited payload evidence, not an assessment of all
statically linked code or a legal System Library determination. Windows and
Linux payloads, especially AppImage contents, still need separate inspection.

## Required follow-up before release

1. Resolve the objc2-family upstream legal question and full-terms attribution
   review. Collecting upstream summaries is not legal clearance.
2. Review the now-included frontend source archives for any nested third-party
   source/notices needed by the actual distributed build.
3. Inspect each platform's installer payload for bundled native libraries and
   assets; identify notices/source duties and justify any System Library
   exclusions. Do not infer the AppImage payload from Cargo metadata alone.
4. Generate the source archive from a clean committed checkout, test rebuilds
   on all claimed platforms, and verify that the published source corresponds
   to the published binaries. Source archive generation has been
   validated locally and on all three CI platforms. Final release archive and
   binary correspondence still needs verification.
5. Record review evidence, reviewer and current input hashes in
   `release/licensing-review.json` only after those checks pass.

Until then the release workflow intentionally refuses to package or publish a
tagged release. CI/local builds can still be used for engineering verification.
