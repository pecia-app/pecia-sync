# OpenJPEG reproduction experiment — 20 October 2026

The initial offline build differed, but relinking with upstream's source paths
produced a **byte-for-byte match** for the shipped WASM. The separately compiled
JavaScript fallback also matches exactly. No application assets
or approval records changed. This is reproduction evidence, not proof of the
historical toolchain.

Inputs verified against the nested-source manifest:

- Wrapper `13eaf130b252d748560569fffb83fd9432597840`, archive SHA-256
  `e51b1257ae3ff914ec6cb0b6abb459ba0b138166b401692b4df24156763c7b6b`.
- OpenJPEG `8314119b067c0fc77834731168daaebd379fdb12`, archive SHA-256
  `e723e8babb2188e8743308842bb1bfc9809f0375cd964cfeac2fb17285094321`.
- The wrapper's buffer-stream patch, applied with `patch -p1`.
- Linux amd64 image `emscripten/emsdk:6.0.10`, resolved digest
  `sha256:e077d54e2b8970575ebc4f185ac1de0b95c05f2b266134d4ba27449af7aebf65`.

Emscripten 6.0.10 was published before the wrapper's 1 October update and was
the latest release at that date. This is candidate selection, not historical
build provenance. The shipped WASM has no custom sections identifying its
compiler. The upstream Actions API returned only two older runs, neither at
the pinned wrapper commit.

Extracted sources were mounted under `/experiment` in a network-disabled
container, with `OPENJPEG=/experiment/openjpeg`,
`INPUT=/experiment/wrapper/src`, and `OUTPUT=/experiment/output`. After applying
the patch, the unmodified wrapper scripts were run:

```sh
BUILD_TYPE=wasm sh /experiment/wrapper/compile_lib.sh
BUILD_TYPE=wasm sh /experiment/wrapper/compile.sh
```

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| Shipped | 251131 | `95e5002597af0824004aa57b1900fe019715db389e37640b1e58395e42f00cc5` |
| Candidate | 251136 | `54fe5a34321badb45caa2fecb3fd9992c6dc8317d0ab37001cd84fdd5e8833f0` |

## Upstream source paths

The candidate embeds `/experiment/openjpeg/src/bin/common/color.c`; the shipped
WASM embeds `/tmp/openjpeg/src/bin/common/color.c`. Mounting the patched source
at `/tmp/openjpeg`, the wrapper at `/code`, and setting `OPENJPEG=/tmp/openjpeg`
and `INPUT=/code/src` before rerunning `BUILD_TYPE=wasm sh /code/compile.sh`
produced the shipped hash:

`95e5002597af0824004aa57b1900fe019715db389e37640b1e58395e42f00cc5`.

Host `cmp` also confirmed all bytes match. This run reused the previously
compiled static OpenJPEG library; the wrapper and color conversion source were
recompiled, and the fresh container rebuilt its Emscripten system libraries
offline. No post-build binary editing was performed. A fully clean repeat
remains a separate check.

## JavaScript fallback

In the same network-disabled container, with the upstream paths above and a
previously absent `build_js` directory, ran the unmodified wrapper scripts:

```sh
BUILD_TYPE=js sh /code/compile_lib.sh
BUILD_TYPE=js sh /code/compile.sh
```

The resulting `openjpeg_nowasm_fallback.js` is 445781 bytes with SHA-256
`9047b34b6bc142d85e4b0aa1b08b0b9baad4c6f8b7ac87641b9e8f90eb6fd23e`.
It matches the installed PDF.js fallback by both hash and full `cmp`.
This branch built its static OpenJPEG library and Emscripten system libraries
from source. The toolchain image itself was prepared beforehand.

Emscripten emitted a deprecation warning for upstream's `WASM=0` option, but
completed successfully. Keep the toolchain pinned for reproduction; future
toolchain migration requires a separate compatibility review.

The automated fresh-source repeat described below passed on 20 October 2026.
Both outputs matched their pinned hashes and installed PDF.js bytes. It reused
only the pinned toolchain image, not compiled OpenJPEG objects or build folders.
The local report was retained at
`/private/tmp/pecia-openjpeg-clean-verification.json`.

Remaining: run extracted-archive CI, review toolchain-source and notice
coverage, and continue the independent JBIG2/font investigations.

## Automated verification

`scripts/openjpeg-source.mjs` verifies both source archive hashes, extracts
them into a new temporary directory, applies the wrapper patch, and builds both
outputs using upstream paths in a fresh, network-disabled container. It never
reuses an existing OpenJPEG build directory. Both the pinned output hash and
byte equality with the installed PDF.js asset must pass.

Prepare the toolchain online, then run:

```sh
docker pull --platform linux/amd64 emscripten/emsdk@sha256:e077d54e2b8970575ebc4f185ac1de0b95c05f2b266134d4ba27449af7aebf65
node scripts/openjpeg-source.mjs /tmp/openjpeg-verification.json
```

The optional report is written only after both comparisons pass. Linux
source-audit CI enables this from the extracted source archive with
`PECIA_VERIFY_OPENJPEG=1`, and uploads `openjpeg-verification.json` alongside
the general source report. macOS/Windows run the comparison unit test but do
not perform the container rebuild. The existing nested-source collector already
supplies both required source archives.

The Docker image is a prebuilt toolchain, not a complete toolchain-source
delivery. Reproduction does not close toolchain or notice coverage, other
decoder/font questions, or release approval.
