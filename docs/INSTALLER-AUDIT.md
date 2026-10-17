# Installer and nested-asset audit — 17 October 2026

Status: partial engineering inspection; not release clearance.
Source baseline: `9b5b3cba7077af309abd447bcdf2aa65a8487c2f`.

## Fresh retained artifacts — follow-up

[Installer audit run 39010439200](https://github.com/pecia-app/pecia-sync/actions/runs/39010439200)
built all three platforms successfully at PR merge snapshot
`d30bac28afb6b254259a070e0ae21b6f84647750`. All downloaded bundle archive
SHA-256 digests matched their inventory reports. Artifact IDs are Linux
12093126090, macOS 12093101204 and Windows 12092767620. Retention is 14 days.
This supersedes the lack of candidate artifacts described in the historical
section below; these are audit candidates, not published releases.

7-Zip 26.04 and bsdtar extracted the DMG/HFS, MSI cabinet, NSIS, Debian,
RPM/cpio and AppImage/SquashFS payloads without running their executables.

- DMG, Debian, RPM, AppImage and NSIS each contain dependency notices identical
  to that platform's generated audit notice file, plus all 21 unique supplemental
  notice files with the expected SHA-256 values.
- The MSI cabinet contains matching bytes for those notices and all 21
  supplements. Installer destination-table mapping remains unverified; cabinet
  presence alone is not a complete MSI installation review.
- The DMG's executable and Info.plist match the separately retained macOS app.
  `otool -L` lists only Apple system paths. This is not static-code inspection
  or an automatic legal System Library exclusion.
- Debian declares `libwebkit2gtk-4.1-0` and `libgtk-3-0` as external package
  dependencies. AppImage instead carries WebKitGTK, GTK modules and numerous
  additional shared libraries; the two formats have materially different
  distribution payloads.
- NSIS includes StartMenu.dll, System.dll, nsDialogs.dll, NSISdl.dll and
  nsis_tauri_utils.dll under its installer plugin directory. Their precise
  versions/source/notices and installer runtime provenance still need mapping.

### Concrete unresolved AppImage findings

81 copied package copyright files refer to `/usr/share/common-licenses`, but
that directory is absent from the extracted AppImage. GLib's copyright file,
for example, references LGPL-2, LGPL-2.1, MPL-1.1, Apache-2.0 and CC0-1.0 there.
This is an incomplete-reference finding, not a conclusion that every referenced
license governs linked code or that every full text is absent elsewhere.

The source candidate includes Cargo/npm dependencies, not a matching collection
of the Ubuntu-built libraries bundled by linuxdeploy. Package filenames alone
do not establish exact source versions. The audit collector now retains the
Linux build host's binary/source package version inventory and common-license
texts as separate evidence on future runs. This does **not** add those texts
to installers, collect corresponding source, or establish which host packages
were bundled. Review mappings and remediate the actual distributed artifacts
before approval, including AppImage's runtime and AppRun components.

### Remaining decisions/work

Retain exact build-tool/plugin provenance for Windows; resolve Linux bundled
library source/notice obligations; finish nested PDF.js source review; obtain
the objc2 assessment described in OBJC2-REVIEW-BRIEF.md. The evidence improvements
do not authorize setting the release ledger to approved. If a narrower first
release is desired, omitting AppImage is a maintainer scope decision, not an
implicit change made by this audit.

## Available artifacts

Historical pre-follow-up observations:

Main CI run 38905641379 passed packaging on all three platforms, but its artifacts
API returns no retained artifacts. Windows/Linux installer payloads therefore
could not be inspected from that run. Existing published releases predate the
candidate and are not substitutes for candidate inspection.

The local `src-tauri/target/release/bundle/macos/Pecia Sync.app` is stale:
its embedded inventory still reports missing-notice findings fixed by PR #14.
Its resource directory has no supplemented third-party notice files. It is
excluded as evidence of current release completeness.

For identification only:

- Local executable SHA-256: `87ada415162904449128ae28738028a95e1265d1e67dc4c6222c3586bedb4639`.
- Local `Pecia Sync_0.2.0_aarch64.dmg` SHA-256: `63d77b4ca7d7b672789a447b34972b26f00c93243350b0dcb5a197171ded305a`.
- The DMG was hashed, not mounted or asserted identical to the app directory.

`otool -L` on that executable lists only `/usr/lib` and
`/System/Library/Frameworks` dependencies. A file inventory found no separate
dylib, WASM or font payloads in the app. This does not assess embedded/static
code or establish a legal System Library exclusion.

## PDF.js nested assets

The installed pdfjs-dist 6.4.299 package contains standard fonts, CMaps, ICC data,
WASM binaries and generated non-WASM fallbacks. The notice collector includes
the Foxit, Liberation, OpenJPEG, QCMS and JBIG2 notice files in its output.
The Liberation notice identifies GPL v2 with exceptions; do not infer that the
whole dependency is covered solely by PDF.js's top-level Apache-2.0 declaration.

Current `src/reader.ts` disables WASM and worker fetching and uses system fonts.
The current `dist/` inventory contains JavaScript/CSS/HTML and a Foliate notice,
not standalone font/WASM files. These observations are not proof of what every
embedded JavaScript bundle contains and do not settle source-archive duties.

Crucially, `scripts/source-bundle.mjs` copies all installed node_modules and the
entire pinned upstream archives. Thus optional fonts and generated binaries are
distributed in the source candidate even if unused by the application.
The pinned PDF.js upstream tar listing itself includes compiled font/WASM files
and generated JavaScript under `external/`, plus license files and README files.
Including that tarball alone must not be described as proving preferred-source
completeness for these nested components.

## Next evidence needed

1. Build and retain candidate installers in a non-publishing CI audit run from
   one recorded revision; retain platform/toolchain metadata and SHA-256 hashes.
2. Extract each installer without launching the app; inventory resource and
   native library files and inspect native linkage. Include AppImage runtime,
   bundled GTK-related libraries and Windows runtime/loader components where
   actually present, not assumed from package metadata.
3. Map each bundled third-party component to exact notices, source and build
   instructions; compare bundled notice resources with current generated output.
4. Resolve nested font/WASM source provenance or deliberately exclude unused
   assets from source candidates with rebuild tests. Do not silently prune files
   or rely on runtime disabling as proof they are not redistributed.
5. Verify final binaries and accompanying source together. Record reviewer and
   evidence only after all remaining findings are addressed.

The existing release workflow and licensing approval were not changed by this
inspection. No release was tagged, packaged for publication or published.
