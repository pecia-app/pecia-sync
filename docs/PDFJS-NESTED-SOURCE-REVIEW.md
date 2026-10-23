# PDF.js nested source review

Engineering inspection, 19 October 2026. Partial evidence, not release approval.

## Delivered bytes

Pecia pins PDF.js `d0991a0d53f3bb3a7307e3b83f279c1d117aafb3`
for `pdfjs-dist` 6.4.299. Direct byte comparisons against that retained source
archive passed for these installed npm assets:

| Asset | SHA-256 |
| --- | --- |
| openjpeg.wasm | `95e5002597af0824004aa57b1900fe019715db389e37640b1e58395e42f00cc5` |
| jbig2.wasm | `466f45c2a61a698152fb5400c27e56ff2ceb73dcb71fde3fc366a502308eaab0` |
| qcms_bg.wasm | `663d86126d5f5fcb1c61490f94353e2a8375660b8c5498ab3ebab5a34b08800e` |
| LiberationSans-Regular.ttf | `f8ace1f892b2bd9dc1792ba7f097fa7588f84fed48321480e04de5390828221f` |
| LiberationSans-Bold.ttf | `361c61b82d575c5c35fd9157fda8b0194bcfcd0d88ea8521a4fb5dd53d33dddc` |
| LiberationSans-Italic.ttf | `832b4406dbef23628800d3aaad21048534ac84d7e3ad955be83b8172ed8ef512` |
| LiberationSans-BoldItalic.ttf | `a224075ac17495ad0a3af3bc0a419ac0704a8b3fd1095456201fb9b095fc281d` |

This verifies copies of generated assets, not their preferred editable source.
The source distribution includes full node_modules; disabling runtime WASM use
does not remove these distributed files. JS fallbacks and Foxit fonts remain
separate inventory items; the seven checks above do not cover them.

## Decoder source anchors

- [PDF.js OpenJPEG update](https://github.com/mozilla/pdf.js/commit/f78635555020f8ffc271d911db89b8a5069d295e)
  names OpenJPEG `8314119b067c0fc77834731168daaebd379fdb12`.
  The latest wrapper commit preceding that update is
  `13eaf130b252d748560569fffb83fd9432597840`; its
  [Dockerfile](https://github.com/mozilla/pdf.js.openjpeg/blob/13eaf130b252d748560569fffb83fd9432597840/Dockerfile)
  selects the same revision and applies a buffer-stream patch. This is a strong
  candidate wrapper mapping, not proof of the exact compiler invocation.
- [PDF.js JBIG2 update](https://github.com/mozilla/pdf.js/commit/c3a2798726365a6a36f7dd78bcaa51dc298395f6)
  identifies PDFium `bb1f9f71`. The latest preceding wrapper commit is
  `15f6f9357c5e5e30285eb83aa08e5fe1a16ab77a`; its
  [Dockerfile](https://github.com/mozilla/pdf.js.jbig2/blob/15f6f9357c5e5e30285eb83aa08e5fe1a16ab77a/Dockerfile)
  pins PDFium `bb1f9f71e7b15afdd5937adf8cfe5807522b882f`.
  Wrapper build files and PDFium source must both be considered.
- [PDF.js QCMS update](https://github.com/mozilla/pdf.js/commit/e7acffcef36eec7e77ade4f77e5e8ca0639c44d2)
  explicitly links wrapper `2ae4ee72334782928210ba4050e3e77d9b2d35be`.
  Its Cargo.toml uses `qcms = "0.3"` and `wasm-bindgen = "0.2"`.
  Although the repository has a Cargo.lock, its
  [Dockerfile](https://github.com/mozilla/pdf.js.qcms/blob/2ae4ee72334782928210ba4050e3e77d9b2d35be/Dockerfile)
  does not copy it into the image and runs `cargo update`. Do not assume that
  repository lockfile describes the shipped binary's dependency resolution.

OpenJPEG and JBIG2 use `emscripten/emsdk:latest`; QCMS uses `rust:latest` and
unpinned `cargo install` commands for wasm-pack and wasm-bindgen-cli. A rebuild
today is not automatically a historical reproduction. Prefer retained upstream
build evidence or a deliberate, tested controlled rebuild over invented pins.
The follow-up collector now includes the three wrapper repositories, underlying
OpenJPEG and PDFium archives, and the Liberation source candidate described below.
This is partial coverage: PDFium's external DEPS and QCMS's actual historical
dependency resolution are not supplied by those repository archives alone.

## Fonts

The pinned PDF.js `external/standard_fonts/README.md` states the Liberation
files are unmodified release 1.07.4, with GPLv2 plus its font exception.
It explicitly distinguishes the SIL-licensed 2.x releases. Locate the matching
1.07.4 editable font source and verify the four release binaries; do not
substitute current Liberation sources. Glyph order is used by PDF.js width
and scale-factor tables, so replacing the fonts requires coordinated testing.

The same README says the Foxit PFBs were extracted from PDFium and carries a
2014 copyright attribution, but does not give the extraction revision. A date
alone is not an exact source mapping.

## Next work

### Collected source candidates

`release/pdfjs-nested-source.json` pins eight archive URLs and SHA-256 values.
`scripts/pdfjs-nested-source.mjs` verifies downloads and supports fail-closed
offline verification. Source packaging includes these archives; extracted-source
verification checks them offline. Changes invalidate the release-review input
hashes. Archives retain upstream license files; additional notice review remains
necessary before treating this as complete distribution coverage.

The [Cygwin source archive](https://www.sourceware.org/pub/cygwin/noarch/release/liberation-fonts/liberation-fonts-1.07.4-1-src.tar.xz)
has SHA-256 `96938a0437a73e215898e0475a0c00ea9e251547f7e69cd76012163bb16c7375`.
It contains the original `liberation-fonts-1.07.4.tar.gz` with SHA-256
`ad98b7498dc2992f7f0868f79b65ce4a720a3acdb63ab3f1f1cb6881117a5406`.
That tarball includes all four Liberation Sans editable SFD sources, FontForge
scripts, Makefile, License.txt and COPYING. However, all four Sans fonts in the
corresponding Cygwin binary package differ from PDF.js's bytes. This is a
version-matched source candidate, not a demonstrated exact font rebuild.

### Remaining work

### Foxit extraction and QCMS binary evidence

The ten shipped Foxit PFB files all match the corresponding byte arrays under
`core/fxge/fontdata/chromefontdata/Foxit*.cpp` in the pinned PDFium archive
`bb1f9f71e7b15afdd5937adf8cfe5807522b882f` exactly. The read-only,
archive-hash-guarded `scripts/pdfjs-foxit-probe.mjs` parses only hexadecimal byte
literals, checks declared array lengths, and compares all bytes. It passed for
all ten fonts and is now part of extracted-source verification. This closes
the extraction mapping to supplied source arrays, not a claim about original
font-design files or the historical date of extraction.

The shipped QCMS WASM (SHA-256 recorded above) provides stronger evidence than
the wrapper's repository lockfile. Parsing its `producers` custom section without
instantiating or executing it reports:

- Rust compiler: `1.97.1 (8bab26f4f 2026-07-14)`.
- walrus: `0.26.4`.
- wasm-bindgen: `0.2.126`.

Embedded panic-path strings also identify `qcms-0.3.0` and
`wasm-bindgen-0.2.126`. The wrapper's committed Cargo.lock instead pins
wasm-bindgen **0.2.100**. Thus that lockfile is demonstrably not the dependency
resolution used for the shipped binary. These observations narrow the rebuild
inputs but do not reveal every transitive crate, wasm-pack version or optimizer
setting. Do not silently replace the wrapper's lockfile and label it historical.

### Updated remaining work

Follow-up table-level comparison of the Cygwin fonts found differences in
`glyf`, `hmtx`, `loca`, `maxp`, and layout tables for all four styles, not merely
`head` timestamps/checksums. Some tables match (including `name`), but this does
not establish identical outlines/metrics or explain the build transformation.

The QCMS wrapper repository returned no GitHub Actions runs for its pinned
commit during this inspection. The two crate versions directly visible in the
WASM are now collected: qcms 0.3.0 (archive checksum matches the repository
lockfile) and wasm-bindgen 0.2.126. Their crate archives retain upstream license
files. This is not complete coverage of macro/support crates or toolchain
dependencies, and is not a reconstructed historical Cargo.lock.

1. Complete decoder dependency coverage and verify the candidate source mappings.
2. Resolve QCMS dependency/build inputs or prepare a controlled rebuild.
3. Verify Liberation 1.07.4 source-to-binary correspondence and review whether
   the delivered Foxit arrays are sufficient preferred source for the intended scope.
4. Check JS fallback assets and final candidate source/notice delivery.

The release approval ledger remains pending.

### JBIG2 reproduction follow-up — 21 October 2026

The pinned wrapper and PDFium archives now reproduce both `jbig2.wasm` and
`jbig2_nowasm_fallback.js` exactly using Emscripten 6.0.9. The upstream script
builds only the listed decoder translation units, with wrapper-supplied build
headers; this subset compiled offline without PDFium's external DEPS.
The earlier warning about those absent DEPS remains relevant to a full PDFium
build, but they were not required by this successful decoder recipe.

See [inputs, output hashes and verification recipe](JBIG2-REBUILD-EXPERIMENT.md).
The fresh-source check is integrated into the manual Linux source audit;
its CI run is pending. Compiler source/notices, Chromium header attribution,
font source questions and final delivery remain separate review items.

### Liberation package/source correspondence — 23 October 2026

All four PDF.js Liberation Sans files match Debian's
[`fonts-liberation_1.07.4-11_all.deb`](https://deb.debian.org/debian/pool/main/f/fonts-liberation/fonts-liberation_1.07.4-11_all.deb)
**byte for byte**. The package SHA-256 is
`efd381517f958b01969343634ffcbdd60056be7779af84c6f53a005090430204`.
Its control metadata identifies `fonts-liberation` version `1:1.07.4-11`.
The package contains the same four font hashes listed at the top of this review.

The corresponding Debian source descriptor is retained as
`release/liberation-source.dsc`. Its two SHA-256 inputs are:

- Original SFD source: `ad98b7498dc2992f7f0868f79b65ce4a720a3acdb63ab3f1f1cb6881117a5406`,
  already delivered inside the Cygwin source archive.
- Debian patches/build packaging: `45ea32aab7eed82061493edbf5ef621d6fd7f074cb79ae45206014913ca5f313`,
  now collected as `liberation-debian-patches.tar.xz`.

The patches include upstream's May 2014 Serbian-glyph correction, which removes
the extra alternate glyphs found in the earlier unpatched source/binary release.
The fonts shipped by PDF.js each have 681 glyphs; the older release has 682
regular/bold glyphs and 687 italic/bold-italic glyphs. Thus the earlier
version-only source candidate omitted relevant changes. Do not use the upstream
README's “unmodified release” wording as a substitute for the matched Debian
source package.

To reconstruct editable source, extract the original nested tarball, extract
the Debian archive into that source directory, and apply `debian/patches/series`
in order with `patch -p1`. Debian's `debian/rules` uses debhelper; its descriptor
requires `debhelper-compat (= 11)`, FontForge and fonttools. The upstream Makefile
and FontForge export scripts remain in the original archive. This records a
package-to-source mapping, not a locally demonstrated font rebuild.

`node scripts/liberation-package-probe.mjs <downloaded-deb> <report.json>`
checks the package hash, control version, four full byte comparisons, original
source hash and Debian patch hash against the retained source descriptor.
It passed locally. Applying all four patches in series to a fresh original
source extraction also passed, leaving 681 glyphs in each Sans SFD. The binary
comparison report is retained in
`release/liberation-package-evidence.json`. The descriptor was fetched over
HTTPS from Debian; its embedded PGP signature was not independently verified.
The package/source correspondence is established; final archive delivery and
notice inspection remain required for the release candidate.
