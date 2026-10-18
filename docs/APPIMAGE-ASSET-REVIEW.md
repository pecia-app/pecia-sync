# AppImage non-ELF asset review

18 October 2026. Engineering evidence, not release authorization.

## Scope

Installer audit `39148125244`, Linux artifact `12144158464`, checkout
`506d07d88adb4695a5143005b1588e4eb7df03db`. These observations do not certify
a later installer. The report contains 205 package-matched non-ELF files,
48 unmatched regular files and 30 symlinks. It requests 98 source packages;
the earlier ELF-only audit requested 92. This may be over-inclusive: identical
copyright text can match more than one package.

## Links

Resolving raw targets against the report's file inventory, without reading
through filesystem links, found no missing, cyclic, absolute or escaping
targets in this artifact. Twenty-seven aliases terminate at package-verified
ELF libraries. The other three terminate at Pecia's icon/desktop files, whose
application-input mapping remains separate. Link resolution does not grant a
license or establish the provenance of an otherwise-unverified target.

## GTK startup hook

The delivered Tauri source archive at revision
`30da1fd6e17de6107ecc850c95dfb16b5729f2dd` contains the bundler's embedded
`linuxdeploy-plugin-gtk.sh`. Its SHA-256 is
`ef6b9a980417243bc62e0241b51dc49876032afd1bab9b4762389f961b406d9b`,
matching the actual build-tool pin in `scripts/linux-replay-tools.mjs`.

The literal startup-hook block plus the seven generated environment exports,
using the observed Ubuntu paths and the generator's relocation rules, produces
SHA-256 `b817312524dc34aff9faa0f2cf1f91f8a17cede909816cde85f11e7fcf8882a5`.
That matches the complete bundled `apprun-hooks/linuxdeploy-plugin-gtk.sh`.
`node scripts/gtk-hook-probe.mjs` repeats this historical byte comparison using
the source archive under `build/preferred-source`. It does not execute the hook.
This establishes a delivered generator for the observed bytes, not a separate
license assessment of every contributor or blanket approval of generated files.

## Remaining work

### Copied resources and cache replay (18 October)

PR #28 merged as `6d2bb88ed9f0ab1ca97adc2faa708574b26217f6` after all
three checks passed. Follow-up inspection remains scoped to the earlier audit
checkout above, not that new merge's installer.

All 41 inspected copied resources matched exactly: 37 license/notice files
and four icons. Tracked resources were compared with `git show` at the exact
audit checkout; generated notice files were compared with the same audit's
retained `licenses` directory. The root `Pecia Sync.png` matches
`src-tauri/icons/128x128@2x.png`, not the 128-pixel icon. This checks copying,
not the completeness or legal interpretation of notice contents.

Offline cache regeneration in a disposable Ubuntu 24.04 container gave:

| Cache | Result |
| --- | --- |
| `gschemas.compiled` | Exact bytes |
| `loaders.cache` | Exact bytes |
| `giomodule.cache` | Exact bytes |
| `immodules.cache` | Same content plus one final blank line in regenerated output; not an exact match |

The generator packages were pinned to the audit's versions: GLib
`2.80.0-6ubuntu3.9`, GTK `3.24.41-4ubuntu1.3`, GDK pixbuf
`2.42.10+dfsg-3ubuntu3.3`. The inspected AppDir was mounted read-only and
networking disabled. Query tools used copies of its modules inside the
disposable container and the original no-argument invocation plus the
generator's documented path substitution. No files in the inspected AppDir
were changed, and no whitespace normalization was used to claim a match.

`scripts/appimage-cache-replay.Dockerfile` and
`scripts/appimage-cache-replay.sh` retain this diagnostic. Build the image
from the Dockerfile on stdin, then run it with `--network none`, mounting
the inspected AppDir read-only at `/appdir` and the script read-only at
`/probe/replay.sh`; invoke `bash /probe/replay.sh`. Run only in a disposable
container: it replaces container module directories. The current diagnostic
exits nonzero for the known GTK difference. It is not wired as a passing CI
gate. Repository availability of these old package versions is not guaranteed.

### Still open

- Map the desktop file to its exact generation inputs.
- Reconcile the generated outer `AppRun` shell wrapper with its generator.
- Explain the GTK input-method cache's final blank-line difference. The other
  three caches have exact replay evidence above.
- Confirm required attribution for generated startup code.
- Repeat final candidate checks and supported Linux desktop/FUSE tests.

PR #27 merged as `b2e7191f4eda5d0c421da50917b31af76bbe9023` after all four
checks passed. Runtime CI `39154541990` passed all four synthetic combinations
(two rebuilt runtimes, gzip/zstd) in 1m56s. This verifies offline compressed
extraction/execution and argument preservation, not a real Pecia desktop launch.
