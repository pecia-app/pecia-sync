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

- Map Pecia license copies, generated notices, icons and desktop file to the
  exact audit checkout/build inputs.
- Reconcile the generated outer `AppRun` shell wrapper with its generator.
- Verify generated GTK/GIO/pixbuf/schema caches and their generation inputs;
  the source generator describes the commands, but exact cache replay is not
  yet recorded.
- Confirm required attribution for generated startup code.
- Repeat final candidate checks and supported Linux desktop/FUSE tests.

PR #27 merged as `b2e7191f4eda5d0c421da50917b31af76bbe9023` after all four
checks passed. Runtime CI `39154541990` passed all four synthetic combinations
(two rebuilt runtimes, gzip/zstd) in 1m56s. This verifies offline compressed
extraction/execution and argument preservation, not a real Pecia desktop launch.
