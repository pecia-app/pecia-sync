# Windows installer review

Status: partial engineering evidence, not release clearance.

## Scope

Inspected retained Windows artifact `12144397240` from
[run 39148125244](https://github.com/pecia-app/pecia-sync/actions/runs/39148125244),
checkout `506d07d88adb4695a5143005b1588e4eb7df03db`.
The MSI `Pecia Sync_0.2.0_x64_en-US.msi` has SHA-256
`66cc044203a9924d9fd8ed70087fc337791ef622878637b69b7fd9cc154aada5`.
This is a historical audit candidate, not a measurement of the next release.

On 19 October 2026, `msiinfo` from Ubuntu 24.04's `msitools` package
exported the MSI tables in a disposable Linux container with the artifact
mounted read-only. Neither the installer nor its custom actions were run.

## Destination and feature mapping

Joining `File.Component_` to `Component.Directory_`, then following the
`Directory` parent chain, establishes these authored destinations:

| Resource | Destination relative to `INSTALLDIR` |
| --- | --- |
| Project license and licensing guide | `licenses/LICENSE`, `licenses/LICENSING.md` |
| Dependency inventory and notices | `licenses/dependencies/inventory.json`, `licenses/dependencies/THIRD-PARTY-NOTICES.txt` |
| GPL and MIT texts | `licenses/texts/` |
| Supplemental hash-named notices | `licenses/texts/third-party/` |

`INSTALLDIR` defaults to `ProgramFiles64Folder/Pecia Sync`. All 35 license
resource components appear under `MainProgram` in `FeatureComponents`;
that feature has level 1, and their component conditions are empty.
These are authored paths and feature membership, not an observed Windows
installation. Older cabinet byte comparisons in [INSTALLER-AUDIT.md](INSTALLER-AUDIT.md)
remain scoped to their own candidate; do not conflate those hashes with this MSI.

## Embedded installer components

The `Binary` table contains `WixUIWixca` plus six WiX UI image/icon streams.
`CustomAction` invokes its `ValidatePath` and `PrintEula` entry points.
Therefore WiX cannot be dismissed wholesale as a build-only dependency.
Match this DLL and the UI resources to the retained WiX inputs, identify
matching source, and include their applicable notices before closing review.
The retained `WixTools314/LICENSE.TXT` identifies the Microsoft Reciprocal
License (MS-RL); this observation is not a compatibility determination or a
claim that every embedded resource has the same file-level terms.

`DownloadAndInvokeBootstrapper` contains a PowerShell command to download
Microsoft's WebView2 bootstrapper from `https://go.microsoft.com/fwlink/p/?LinkId=2124703`
and run it with `/silent /install`. This identifies a download action, not an
embedded fixed WebView2 runtime or proof that the action always executes.
Review its scheduling/conditions and the intended installation requirements
separately; no network download was triggered during inspection.

## NSIS source/notice follow-up

The retained NSIS `COPYING` distinguishes its general zlib/libpng terms from
zlib, bzip2 and LZMA compression-module terms. It identifies CPL 1.0 for LZMA
and includes a linking exception later in the file. Do not label the whole
installer MIT or infer its active compressor from the presence of all tools.
The earlier five-plugin byte matches are recorded in INSTALLER-AUDIT.md.
Matching source revisions, the actual stub/compressor, plugin-specific notices,
and their delivery in the final distribution remain to be established.

## Remaining checks

### Pinned-source follow-up

The retained Tauri bundler source pins `wix3141rtm/wix314-binaries.zip`
to SHA-256 `6ac824e1642d6f7277d0ed7ea09411a508f6116ba6fae0aa5f2c7daa2ff43d31`.
The upstream tag resolves to `b40e9a32c24033e11b77baf2c91a704382f898ed`.
Its codeload source archive has SHA-256
`d8f11d479cfacbeaf3bda133c2b00a200457fbc239d1e3b0edd6463fbb9853d9`.
All six embedded UI bitmap/icon streams match the files under
`src/ext/UIExtension/wixlib/Bitmaps/` exactly. The hash-guarded
`scripts/windows-msi-probe.sh` reproduces this check using `msiinfo`, `tar`,
`cmp`, and `sha256sum`; run it in a disposable environment with read-only inputs.
It takes the historical MSI and the pinned WiX source tarball as arguments.

The embedded `Binary.WixUIWixca` DLL has SHA-256
`7f47d98ab25cfea9b3a2e898c3376cc9ba1cd893b4948b0c27caa530fd0e34cc`.
The source's `src/ext/UIExtension/ca/DriveCheck.cpp` and `PrintEula.cpp`
implement the observed entry points. `uica.vcxproj` also links `dutil.lib`
and `wcautil.lib`. These paths identify candidate source, not a verified DLL
rebuild or a claim that the three custom-action translation units alone suffice.

The WebView2 action is scheduled at sequence 6599 with condition
`NOT(REMOVE OR INSTALLED_WEBVIEW2_VERSION)`. Thus its authored behavior is
conditional, not an unconditional download. Detection correctness and runtime
behavior have not been exercised on Windows.

The `nsis_tauri_utils-v0.5.3` tag resolves to
`13d9edd27b69310e108d6fbd49f90992f8a05390`; its codeload source archive has
SHA-256 `9b277f7cdec4277b48d319c32e10b5dc4303e9efce8c3b44f1db77f86a8131c7`.
The crate declares 0.5.3 and inherits `MIT or Apache-2.0` from its workspace.
The release recipe uses `cargo build --release` and publishes the
`i686-pc-windows-msvc` DLL. The archive contains no Cargo.lock, and dependencies
include `windows-sys` and `semver`; resolving them today would not prove the
historical release dependency graph. Source/notice delivery and that dependency
gap remain open. `release/runtime-source.json` now pins both complete repository
archives and their license texts (MIT elected for the Tauri plugin). The existing
source-bundle pipeline collects these archives and verifies them offline; notice
generation includes their texts in the installer resources. This is partial
source delivery, not proof of a complete historical rebuild. In particular,
the plugin's transitive dependencies are not supplied by its repository archive.
Final installers still need extraction to verify delivery.

### Runtime mapping and delivery follow-up

The same audit's retained `WixUIExtension.dll` has SHA-256
`c6b8227782a7268b54c0c161ca300fae869a53ce9889d19c16b6b900ac468dc3`.
Its embedded cabinet begins at byte 9952 and is 82254 bytes long. Extracting
cabinet entry `6` produces the exact MSI custom-action DLL SHA-256 quoted above.
This closes input-to-payload matching for that DLL, not a source rebuild.

7-Zip reports `LZMA:23`, solid compression, NSIS-3 Unicode and a 52736-byte
embedded stub for this audit's NSIS installer (SHA-256
`af58f40023d5d2bf67c8dc31983a06a20a3e04041bae32959fab4cdd64ef614a`).
The Tauri NSIS 3.11 binary-release description identifies the official
SourceForge NSIS 3.11 zip as its original. The official source tarball is now
checksum-pinned in the source manifest along with the complete `COPYING`
and NSISdl-specific notice. This includes the LZMA linking exception without
assuming it waives source obligations for the compression module itself.
The source archive SHA-256 is
`19e72062676ebdc67c11dc032ba80b979cdbffd3886c60b04bb442cdd401ff4b`;
upstream `v311` resolves to `7359413009afd4f0fff472d841fc2f2cc0e0a5f8`.
No bit-for-bit stub rebuild is claimed.

The retained `NSIS/Stubs/lzma_solid-x86-unicode` has SHA-256
`a0d065b62d34be5f0aaaf7c162e101a5e25d7cd3eb10a13fdb37f91b02ebfce2`.
Its `.text`, `.rdata` and `.data` sections match the historical installer
byte-for-byte. `.rsrc` differs (4608 versus 18432 bytes). The hash-guarded
`scripts/windows-nsis-probe.mjs INSTALLER STUB` reproduces these observations;
it does not verify PE headers, resources or the appended installer payload.
Section equality is deliberately not promoted to whole-file verification.

Upstream plugin release run `21344433681` (`version or publish`, 26 January
2026) is successful for commit `13d9edd27b69310e108d6fbd49f90992f8a05390`.
On 19 October its log endpoint returned HTTP 410 and its artifact inventory was
empty. The release asset digest matches the previously verified plugin hash,
but this does not recover its transitive dependency versions. A proposed
remediation is a controlled plugin rebuild using a committed Cargo.lock and
vendored dependencies, selected through a custom installer template and
verified in the new installer. Do not
describe a fresh dependency resolution as the historical release graph.

The controlled replacement is now staged in `release/windows-plugin/Cargo.lock`
and `scripts/windows-plugin.mjs`. Preparation verifies the pinned source archive,
vendors seven registry packages with `cargo vendor --locked`, and verifies Cargo
metadata offline. Windows builds use `--frozen`, the explicit i686 MSVC target,
and produce a DLL/lockfile hash report. A non-publishing Windows workflow uses
Rust 1.97.0 to test this build. Local preparation and offline metadata validation
passed. The Windows DLL build subsequently passed in the installer audits
recorded below.

The Windows configuration now selects a custom NSIS template generated from
the pinned Tauri source. Only its additional-plugin directory is changed;
the original cache hash validation is not disabled. The Windows pre-build
command builds the controlled DLL before packaging. Use Rust 1.97.0 with the
`i686-pc-windows-msvc` target installed. The Windows audit and release jobs
install that toolchain and extract the installer plugin with 7-Zip to compare
its SHA-256 with the controlled build report. A mismatch fails the job.

Notice generation includes the controlled plugin workspace and dependency
metadata. Source archives include its source, lockfile and vendored dependencies,
excluding generated DLLs, targets and the host-specific installer template.
Extracted-source verification checks plugin metadata offline. Local preparation,
notice checks and template tests passed. Windows installer audit
[39215544950](https://github.com/pecia-app/pecia-sync/actions/runs/39215544950)
passed the controlled build and installer plugin comparison at
`518daaf5be933d517deb2be0beee7b34706131b2`; audit
[39396696008](https://github.com/pecia-app/pecia-sync/actions/runs/39396696008)
confirmed the comparison at `51e7279d984ccc863279a9c76825417b2dcfaafc`.
Final release-candidate checks remain pending. No claim is made that the replacement reproduces
the historical upstream DLL.

### Remaining work after these mappings

- Verify complete WiX build inputs and final source/notice delivery;
  its embedded DLL matches the retained tool, and six UI resources match source.
- Finish NSIS stub/build provenance and repeat the controlled plugin comparison
  for the final release candidate.
- Verify WebView2 action conditions and document installation behavior.
- Repeat destination, feature and byte checks on the final release candidate.

No release approval fields have changed.
