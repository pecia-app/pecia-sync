# Installer and nested-asset audit — 17 October 2026

Status: partial engineering inspection; not release clearance.
Source baseline: `9b5b3cba7077af309abd447bcdf2aa65a8487c2f`.

## Verified PR #19 results

[Run 39029669412](https://github.com/pecia-app/pecia-sync/actions/runs/39029669412)
passed all three installer audit jobs at PR merge checkout
`efb60ce6fd48fb73de285383e6a059000dee09ed`. Linux artifact `12099602952`
records 177 regular ELF files: 175 verified distro-library payloads, plus
`AppRun.wrapped` and `usr/bin/pecia-sync` requiring separate provenance.
All 92 requested source-package versions were collected with zero failures.
The downloaded descriptors and archive sizes/SHA-256 values were independently
revalidated locally. Common-license reference verification also passed.

This supersedes the pending full-batch statements in the historical follow-up
below. The actual cached linuxdeploy hash is
`bd9521cd5ff3ca351fecb78cd9b236a4e37b3621014ac05cac0c2d767ffa0474`:
Tauri zeroes bytes 8–10 of the raw download (SHA-256
`36a2d7e274d12e1050d0e9ecfe11d339ed54720b2bec464c286d53f8b07f5c62`).
Both hashes and that transformation are recorded by the collector. The raw hash
quoted below must not be mistaken for the transformed cache hash.

PR #19 merged as `7027a96f5549fb885f156f4245efd9ec4da5b74e`.
Its [source audit](https://github.com/pecia-app/pecia-sync/actions/runs/39030971979)
passed on all three platforms. The separate
[merged-main installer audit](https://github.com/pecia-app/pecia-sync/actions/runs/39030969845)
must be considered independently; success on a PR snapshot is not a measurement
of later payload bytes.

The merged-main CI, source audit and installer audit all completed successfully.
The current working branch adds native-source delivery to the release workflow:
capture happens in the actual Linux packaging job, the packager revalidates
revision/coverage/descriptors/archive hashes, and a source supplement includes
the AppImage checksum and package extraction/build guidance. Audit CI exercises
the same packager. Local tests passed, including revalidation of all 92 retained
source packages; fresh workflow testing of this integration is still required.
Do not substitute an older audit's source collection for a new installer.
Launcher/runtime, non-ELF assets, Windows runtime/source/notices and nested
PDF.js material remain open. No release approval is implied by these results.

## Native transformation follow-up

The Linux artifact from run `39017795244`, checkout
`f4bcc57c8b10dad6030d845292213c1cba9807a7`, has 177 regular ELF files.
The initial zero-match report found candidates for 175 of them; their bytes had
changed during packaging. This was not 177 missing package identities.

A local isolated Ubuntu x86-64 replay downloaded the exact candidate binary
package versions and first compared their original bytes with the recorded host
SHA-256. Replaying linuxdeploy's strip/RPATH operations reproduced 167 complete
payload hashes. Seven additional payloads are byte-identical copies of already
verified runtime libraries; their development-package aliases require resolving
the symlink target's owner, now handled by the collector. The remaining WebKit
library reproduced exactly after the GTK plugin's additional `/usr` to `././`
byte substitution. Thus 175 distro-library payloads are accounted for in this
retained artifact. Pecia's executable and `AppRun.wrapped` require separate
provenance; this is not an assertion of complete source coverage.

The replay uses linuxdeploy `07333c6` from the actual build cache, pinned to
SHA-256 `36a2d7e274d12e1050d0e9ecfe11d339ed54720b2bec464c286d53f8b07f5c62`.
Its strip and patchelf versions/hashes are retained. The GTK script is pinned to
SHA-256 `ef6b9a980417243bc62e0241b51dc49876032afd1bab9b4762389f961b406d9b`.
Only full final-byte equality succeeds; filenames, build IDs, ignored sections,
and approximate matching cannot promote a candidate. Original files are never
modified. See the pinned
[linuxdeploy operations](https://github.com/linuxdeploy/linuxdeploy/blob/07333c6/src/core/appdir.cpp)
and [GTK plugin](https://github.com/tauri-apps/tauri/blob/30da1fd6e17de6107ecc850c95dfb16b5729f2dd/crates/tauri-bundler/src/bundle/linux/appimage/linuxdeploy-plugin-gtk.sh).

The Linux audit now requests exact source versions from authenticated Ubuntu
APT indexes, without building or installing the source packages. It verifies
the descriptor's package/version and every listed SHA-256/size, retains the
descriptor, original archives and distro patch archives, and reports failures.
A real gdk-pixbuf `2.42.10+dfsg-3ubuntu3.3` download passed these checks; the full
batch still needs a fresh CI run. Source capture is audit evidence, not yet an
attachment wired into the release workflow. Missing source, unresolved files,
outer runtime, scripts and non-ELF assets remain separate review items.

The same run's Windows installer was extracted without execution. All five
NSIS plugin payloads match the retained tool-cache input files exactly:

| Plugin | Payload/cache SHA-256 |
| --- | --- |
| StartMenu.dll | `fe330320459637d8dd2b5d84d07925c38ec264152ffd3b1760a4d44d76536caa` |
| System.dll | `8b4c47c4cf5e76ec57dd5a050d5acd832a0d532ee875d7b44f6cdaf68f90d37c` |
| nsDialogs.dll | `b1350f487692057c8ffde75dcc55287a52a3272240d4d4912f24464b27551fc0` |
| NSISdl.dll | `ddf40229dd9d6b268902d8dea88c8a04aacf1af218dd29f6dcd35babc54ac08d` |
| nsis_tauri_utils.dll | `5ba143b5db4a87d32d6e7802e033330aae56cbceabe0d1e3ba41948385ad4709` |

This closes plugin input-to-payload matching for that candidate, not the Windows
runtime/source/notice review or any legal assessment. No release approval changed.

## Engineering remediation in progress

Linux notice generation now copies the build host's full common-license texts
into `build/licenses/linux-common-licenses`, already included by the bundle's
resource mapping. A README explains the relocated equivalents of absolute
`/usr/share/common-licenses/NAME` references; upstream notices are not rewritten.
Hashes are checked by `licenses:check`. Fixture tests and an isolated Linux
container check (17 actual distro texts) passed. A new installer must still be
extracted to verify that these resources reach the final AppImage.

The non-publishing Linux audit now examines regular ELF files in AppDir and
queries the build host for candidate package ownership and exact source-package
versions. Only equal file hashes count as an automatic match. Patched libraries,
unknown files, application binaries and non-package tools stay unresolved.
The report records source requests, not downloaded corresponding source.
The outer AppImage runtime, scripts, symlinks and non-ELF assets are outside this
mapping's scope and still require review. Missing common-license references fail
the audit; unknown native mappings remain explicitly reported, not approved.

Bundler tools now use the project-local Tauri cache. Windows audits retain its
NSIS/WiX input files, hashes and archive for comparison with extracted installer
payloads. This does not itself establish licensing or matching source.
The previously extracted `nsis_tauri_utils.dll` has SHA-1
`75197fee3c6a814fe035788d1c34ead39349b860`, equal to the upstream bundler's
0.5.3 download pin in the retained Tauri 2.12.1 source archive. This is provenance
evidence for that one plugin, not clearance of all Windows components.

The retained PDF.js source explicitly identifies Liberation Sans 1.07.4.
Its OpenJPEG, QCMS and JBIG2 READMEs identify separate Mozilla build repositories,
but do not pin decoder revisions. Do not substitute their current branch tips
for matching source or remove assets merely because runtime fetching is disabled.

These changes require fresh Linux/Windows audit builds; final artifact/source
verification and the separate objc2 assessment remain open. No approval fields
or release tags were changed.

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
