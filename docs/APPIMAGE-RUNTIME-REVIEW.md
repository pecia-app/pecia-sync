# AppImage launcher/runtime follow-up

17 October 2026. Engineering observations, not release clearance.
PR #20 merged as `d350b2b2b530286a67a51331a06216d3505a2d03` after nine
successful checks. The measurements below concern older retained audit payloads,
not a new installer built from that merge.

## Launcher

PR #23 subsequently delivered pinned launcher source/notices and passed the
Linux compile/launch fixture. It merged as
`2bded7eed37119194df1c67020b6189643bf7ff1`; historical binary reproduction
is still not claimed.

## Non-ELF inventory follow-up (18 October)

The retained PR #18 AppDir contains 2 scripts, 243 non-ELF regular assets and
30 symlinks. This is an older payload, not a final candidate measurement.
The scripts are the generated `AppRun` wrapper and GTK environment hook.
Assets include GNOME desktop settings schemas and their compiled cache;
the previous ELF-only source requests did not include gsettings-desktop-schemas.
This identifies a coverage gap, not yet the exact package/version attribution.

The native collector now embeds a hashed non-ELF inventory and raw link targets
in its provenance report, which is already delivered with the native source
supplement. Exact package-byte matches for regular assets contribute source
requests, alongside ELF matches. Changed/generated files and links remain
explicitly unresolved; no filename-based license exemptions are inferred.
Payload symlinks are never followed, including cycles and external targets.
Tests cover exact asset source mapping, changed bytes and link safety.
Fresh Linux CI must establish the actual additional source packages. Runtime
relinking, digest replay and resolution of remaining assets are still pending.

PR #24 merged as `77205fd88dec10cb473ce57dec91ede07bc79619`, with all six
triggered checks passing. Installer audit `39129391628`, Linux job
`117681248743`, captured source for `gsettings-desktop-schemas=46.1-0ubuntu1`.
Its audit checkout was `c7895f0816b78d7d68265a87cc2c3b84d410d7b8` (PR merge
snapshot), not the later squash merge. File mapping took about 34 minutes;
the follow-up caches host queries/hashes within one capture and rejects
unequal non-ELF bytes before package metadata lookup. Exact-byte matching
remains required; cache entries never survive between captures.

The retained packager reports `appimagetool, continuous build (git version
8c8c91f), build 295 built on 2025-12-04 17:56:36 UTC`. This was obtained by
running only its `--version` command in a disposable Linux container. The
earlier `854e19e` source inspection is not proof of this packager's behavior;
the exact source/digest procedure still needs reconciliation.

## Retained launcher provenance

The `AppRun.wrapped` payload retained from checkout
`f4bcc57c8b10dad6030d845292213c1cba9807a7` has SHA-256
`f30140a43a0a59e46db21bdefdf749b9e9f2c6946e92afabbacf98b8ae73fb4f`.
It matches both Tauri's `apprun-old/AppRun-x86_64` asset digest and a downloaded
original [AppImageKit continuous asset](https://github.com/AppImage/AppImageKit/releases/tag/continuous).
That release identifies commit `5735cc5bed206497cddfbd2a75e1982c2606c35d`.
Its `src/AppRun.c` includes an MIT permission notice. The release-linked build
run `4369243945` returns HTTP 404, so historical build-log reconciliation is
unavailable. Upstream labels this legacy release obsolete; a replacement would
need an explicit packaging change and functional testing, not a silent swap.

## Outer runtime

Inspected the AppImage in installer audit `39029669412`, checkout
`efb60ce6fd48fb73de285383e6a059000dee09ed`, without executing it.
Its embedded version string identifies `8f39b89` in AppImage/type2-runtime.
The [upstream release](https://github.com/AppImage/type2-runtime/releases/tag/continuous)
and successful [build run](https://github.com/AppImage/type2-runtime/actions/runs/36463736478)
identify full revision `8f39b89e2ac31e1640b3d3f7e9a5108e6ce805fa`.

- Downloaded runtime: 944632 bytes, SHA-256
  `156f4bdbde9c52d01814600013e0a273f0118dc2de98975f3c8c63427ec79074`.
- Pinned GitHub source tarball: SHA-256
  `c449eb42c2190820872631f5e22f8e15b1e985a36dc4a9e2de3585bb7536c785`.
- Comparing all runtime-length bytes with the AppImage prefix yields exactly
  16 differences at offsets 932096–932111. The ELF section table identifies
  these bytes as `.digest_md5`. This is a precise difference report, not a
  full-byte match or an approved transformation replay. A trial MD5 over the
  whole image with that field zeroed did not reproduce the stored digest;
  the packager's digest procedure still needs inspection.

The pinned runtime LICENSE contains MIT terms and separately lists statically
linked musl, libfuse, squashfuse, libzstd and zlib. Top-level MIT attribution
alone is not a complete notice/source assessment of the executable.

`scripts/common/install-dependencies.sh` pins:

| Source | Version | Archive SHA-256 |
| --- | --- | --- |
| libfuse | 3.15.0 | `70589cfd5e1cff7ccd6ac91c86c01be340b227285c5e200baa284e401eea2ca0` |
| squashfuse | 0.5.2 | `db0238c5981dabbd80ee09ae15387f390091668ca060a7bc38047912491443d3` |

The libfuse build applies the repository's `patches/libfuse/mount.c.diff` and
builds a static library. Those patches/build instructions must accompany any
source delivery that relies on this build provenance.

`scripts/docker/Dockerfile` uses `alpine:3.21` without exact package versions or
an image digest in the source. The historical x86-64 build log was subsequently
retrieved from run `36463736478` and resolves these inputs:

| Build input | Recorded value |
| --- | --- |
| Alpine base image | `sha256:ce64758a109eb420d874a118f87920e625e12d3634e03b4a5573fd9f6e5d3507` |
| musl-dev | `1.2.5-r11` |
| zstd-static / zstd-dev | `1.5.6-r2` |
| zlib-static / zlib-dev | `1.3.2-r0` |
| mimalloc2-dev | `2.1.7-r0` |
| Built local image | `sha256:88df3617a948f806bf92659513362c16e095b09bb9a7aeabb865467a8dc5f6fc` |

The `build (x86_64, ubuntu-24.04)` log records package installation on
2026-09-28 at 18:14 UTC and the final clang link command at 18:14:54 UTC:
`-static -static-pie ... -lsquashfuse -lsquashfuse_ll -lzstd -lz -lfuse3 -lmimalloc`.
This agrees with the pinned runtime Makefile. Unlike a package's mere presence
in the environment, these explicit link inputs identify libraries to review.
In particular, mimalloc is linked but not listed in the runtime's top-level
third-party summary; its own notice/source must not be omitted.

This closes the missing historical package-version evidence, not delivery of
the packages' preferred source, Alpine patches/build recipes or full notices.
Retrieve those exact revisions next; do not substitute current Alpine packages.

## Digest investigation

### Historical replay verified on 18 October

PR #25 merged as `c3e09a38b4fd78e507e8cf2d32534543c501e3c8` after all
six triggered checks passed. Its Linux mapping step took 98 seconds versus
about 34 minutes previously, and settings-schema source collection still passed.

The actual retained packager identifies revision
`8c8c91f762b412a19f4e8d2c4b35afb98f2d7c81`. Its executable SHA-256 is
`58d3047a420e1dfa365ef0ad495b728b56627803cb6b75ed816b7a4fa9713720`;
that revision's `src/digest.c` SHA-256 is
`272049fa8a8324bf844e37b5ce940152b5ebb8e57ec50d4d7a4e1496c6f36636`.

The retained AppImage from audit `39029669412` has SHA-256
`f67004a393c6c76df3a90f2f97f1a4df052f84c18ce7881e21c04dbff46dc9db`.
Replaying the chunk algorithm reproduces its stored digest
`486c6245dbe85c83a996ca62d50d13f1`. Writing those 16 bytes into a memory copy
of the pinned upstream runtime makes all 944632 prefix bytes match exactly.
Neither the AppImage nor runtime was executed or modified for this comparison.

`scripts/appimage-digest-probe.mjs` retains this read-only historical check:
pass the retained AppImage and upstream runtime as its two arguments. It
rejects other input hashes. This is deliberately not a generic verifier:
upstream C does not initialize the skipped buffer regions, and the successful
replay models buffer reuse for this binary/artifact. It must not be generalized
to arbitrary compiler builds or final candidates without fresh evidence.
Full runtime source rebuild/relink and final-candidate checks remain open.

### Earlier investigation (superseded for the historical artifact above)

Appimagetool source at `854e19e951900cf141245b384d45735942521abe` calls
`appimage_type2_digest_md5` and writes its result into `.digest_md5`.
Its bundled `src/digest.c` handles `.digest_md5`, `.sha256_sig` and `.sig_key`
in a 4096-byte chunk loop. That is not equivalent to the earlier trial that
zeroed only the digest and hashed the file. This source is an explanatory lead,
not yet a verified identification of the packager used for our artifact.
Do not classify the runtime as a replay-verified full-byte match until the
actual packager provenance and transformation have been reconciled.

## Next implementation steps

### Remaining runtime source inputs collected

The source manifest now covers the runtime itself and all six library inputs
identified in its build: musl, libfuse, squashfuse, zstd, zlib and mimalloc.
It includes full upstream source archives and full notice texts. The libfuse
notice bundle retains LICENSE, LGPL2.txt, GPL2.txt and AUTHORS separately labelled;
the archive preserves file-level copyright and license statements. BSD-3-Clause
is elected for zstd; its alternative license remains intact in the source.

The musl 1.2.5-r11 source record includes its APKBUILD and all 16 checksummed
inputs (upstream archive plus patches/helper files). zlib 1.3.2-r0 and zstd
1.5.6-r2 include their exact recipes and source archives. Recipe input SHA-512
and downloaded SHA-256 values are both checked by offline verification.
The runtime archive includes its libfuse mount patch and original build scripts.

These files are delivered in the application source archive under
`build/runtime-source/<component>/`, not only retained in audit artifacts.
To modify/relink the runtime, extract its source and the dependency sources,
apply the recorded distro/runtime patches, and follow runtime BUILD.md plus
scripts/common/install-dependencies.sh and src/runtime/Makefile. Use the retained
Alpine APKBUILD files for distro-specific build options (including secure mimalloc).
The upstream build scripts use network downloads; substitute the verified local
archives for those downloads when rebuilding from this source collection.
The dependency environment still needs the stated toolchain/build tools.

Source collection and hash verification are implemented; an offline full-runtime
rebuild/relink test and final installer matching are not yet established. This
does not close the AppRun launcher, runtime digest replay, non-ELF assets or
other-platform findings. No release approval is implied.

### mimalloc coverage implemented

`release/runtime-source.json` records mimalloc 2.1.7-r0 and its exact source,
notice and Alpine recipe revisions. The source archive and patch were downloaded
and checked against both SHA-256 and the recipe's SHA-512 values. The recipe
selects the secure static library through `libmimalloc.a`.

The full upstream MIT text is now included in generated dependency notices on
all platforms (source candidates are all-target). Source candidates include the
upstream archive, `APKBUILD` and `cmake-add-insecure-suffix.patch` under
`build/runtime-source/mimalloc2/`. Extract the upstream archive, apply the patch
with `patch -p1`, and follow the recipe's secure build (`MI_SECURE=ON`) and CMake
flags. The recipe records the complete build/check/package steps; an Alpine
build environment with its declared cmake/samurai dependencies is needed.
Extraction and compilation are not executed by the source collector.

Offline source verification checks all included files. Source/notice manifest
changes invalidate the release gate's input hashes. This remedies the identified
mimalloc omission, not the other runtime libraries, runtime digest replay, or
final installer/source correspondence. No approval status has changed.

1. Collect exact source/notices and Alpine build recipes for the now-identified
   runtime dependencies, or use a reproducibly pinned source-built runtime with
   appropriate testing. Preserve libfuse and runtime patches/build inputs.
2. Reproduce the packager's runtime digest change and verify the actual final
   candidate, keeping matching rules specific rather than ignoring arbitrary bytes.
3. Include the verified runtime/launcher material in release source delivery and
   bundled notices, separately from the Ubuntu library supplement added in PR #20.
4. Review non-ELF scripts/assets and test the AppImage on a supported Linux host.

No runtime was executed, no release was published, and no approval was recorded.
