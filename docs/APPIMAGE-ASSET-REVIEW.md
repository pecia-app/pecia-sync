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
| `immodules.cache` | Exact bytes via the generator's fallback-copy path (see below) |

The generator packages were pinned to the audit's versions: GLib
`2.80.0-6ubuntu3.9`, GTK `3.24.41-4ubuntu1.3`, GDK pixbuf
`2.42.10+dfsg-3ubuntu3.3`. The inspected AppDir was mounted read-only and
networking disabled. Query tools used copies of its modules inside the
disposable container and the original no-argument invocation plus the
generator's documented path substitution. No files in the inspected AppDir
were changed, and no whitespace normalization was used to claim a match.

The initial direct regeneration of `immodules.cache` produced one extra blank
line. The pinned GTK plugin's `search_tool` searches `libgtk-3-0`, but the
audited Ubuntu package installs the executable under `libgtk-3-0t64`, outside
PATH. Its fallback therefore retains the installed cache and applies the
documented module-path substitution. Replaying that copy/substitution yields
the exact packaged bytes. The diagnostic now checks the missing legacy tool
path and missing PATH command before using the fallback, rather than trimming
the difference away. All four cache comparisons pass locally.

`scripts/appimage-cache-replay.Dockerfile` and
`scripts/appimage-cache-replay.sh` retain this diagnostic. Build the image
from the Dockerfile on stdin, then run it with `--network none`, mounting
the inspected AppDir read-only at `/appdir` and the script read-only at
`/probe/replay.sh`; invoke `bash /probe/replay.sh`. Run only in a disposable
container: it replaces container module directories. The diagnostic fails on
any byte mismatch; it is not yet wired into CI. Repository availability of
these old package versions is not guaranteed.

### Wrapper and desktop generation

PR #29 merged as `a7831a995dc003af640eaeef8af17888e2649771` with all three
checks green. Subsequent local probes verified both remaining generated files:

- The outer shell wrapper matches `appdir_root_setup.cpp` at linuxdeploy
  `07333c6e942c7d71782b66be924c5d867f9dfdfc`, with its single GTK hook.
  SHA-256: `eb0b254ac0dae6543e6dd7cd02e1baf40a060de95b927313122d6b46323c00aa`.
- The desktop entry matches the delivered Tauri template, using product name,
  binary name and description from the exact audit checkout, with no category
  or MIME type. SHA-256:
  `f7ad117341d4b1241233f705b37778dcf9b85a84d9177801b519792e2c152cd3`.

`node scripts/appimage-generated-probe.mjs <historical-AppDir>` repeats these
comparisons. It requires the audit git object and collected source archives.
The linuxdeploy MIT notice and pinned main-repository archive are now part of
the runtime source/notice collection. The archive establishes template
provenance, not a complete rebuild of linuxdeploy's submodule-based toolchain;
the generated shell file is itself readable source.

All 48 initially unmatched regular files in this particular report now have
byte-level input/generation matches (41 copied resources, two startup scripts,
one desktop entry and four caches). This does not approve future artifacts or
resolve the independent platform/licensing review.

### Still open

- Repeat final candidate checks and supported Linux desktop/FUSE tests.

### Startup attribution follow-up — 23 October

The GTK hook's upstream generator at
`linuxdeploy/linuxdeploy-plugin-gtk@7a3fbc31a9e5075073ff8790f26effbac5f84453`
has the same emitted startup block except the `GDK_BACKEND` line: upstream
forces X11, while the retained Tauri generator comments that setting out.
Tauri's history records this change in commit
`7164de39574d616b762ba658f797f9657ea03b20` (PR #15786).

The upstream MIT notice attributes TheAssassin and the linuxdeploy contributors
(2018–2019). It was missing from the supplemental notice collection and is now
retained with SHA-256
`0718f6cadf38d2662f397591b777884c5389e65b9919aae6aca2bea87a52eac4`.
The source manifest also includes the pinned upstream archive, SHA-256
`a1aa0be16072c647b5f9fb418d330952ccd9d241f0678f6c6e615cff57c79fea`.
Tauri's source and elected MIT notice and linuxdeploy's outer-wrapper MIT
notice are already retained. This closes the identified missing startup
attribution input; final installer/source delivery must still be checked.

PR #27 merged as `b2e7191f4eda5d0c421da50917b31af76bbe9023` after all four
checks passed. Runtime CI `39154541990` passed all four synthetic combinations
(two rebuilt runtimes, gzip/zstd) in 1m56s. This verifies offline compressed
extraction/execution and argument preservation, not a real Pecia desktop launch.

### Candidate desktop launch check

The installer audit now invokes `scripts/linux-desktop-smoke.mjs` under Xvfb
and a fresh D-Bus session. It launches the actual candidate AppImage twice:
once using its normal FUSE path (requiring a live recorded AppImage mount),
then with `--appimage-extract-and-run`. Each launch gets isolated configuration
and cache directories. Software GL is selected for the virtual display.

The check requires a visible window titled Pecia Sync and captures its pixels,
geometry, runtime logs, AppImage hash, OS release and mount evidence under
`build/installer-audit/linux-desktop/`. No automatic fallback converts a failed
FUSE launch into a pass. Review both screenshots for a loaded interface before
claiming desktop startup validation. This is a headless X11 smoke test, not a
Wayland session, physical Kindle/Kobo connection, or full reader interaction
test.

On 23 October, [installer audit 39908624334](https://github.com/pecia-app/pecia-sync/actions/runs/39908624334)
passed at `2cc25ba72070f5e86c31fa4d3b6480600335183b` on Ubuntu 26.04.1
LTS. Both screenshots were inspected: the Spanish dashboard is fully rendered,
with readable navigation, cards and controls. Both are 1200×760 and have the
same SHA-256 `153b7b73dabdc3740bcf4c9f96fe30e1b678098038ce339ef69ea9c7ee13d52a`.
The tested AppImage SHA-256 is
`a739d3ce0c910ff55a37c37dcbf8205f6b9ea7e2fd824e80b769471bca3c5e89`.
The report records a live FUSE mount for the normal launch and no mount for
extraction mode. The implementation merged in PR #40.

Runtime logs contain missing AT-SPI accessibility-bus and GStreamer `appsink`
warnings. Successful dashboard rendering does not establish accessibility or
media functionality. This is verified X11/software-GL startup for this exact
artifact; final-candidate repetition, other desktop environments, reader
interaction and physical-device checks remain separate.
