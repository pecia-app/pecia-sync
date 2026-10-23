# JBIG2 reproduction experiment — 21 October 2026

Engineering evidence; release approval remains pending. No application assets
are replaced by this experiment.

Result: Emscripten 6.0.9 produced **byte-for-byte matches** for both shipped
outputs in the fresh-source verification run. This demonstrates a working
reproduction recipe, not the historical upstream toolchain.

## Inputs and scope

- Wrapper `15f6f9357c5e5e30285eb83aa08e5fe1a16ab77a`, archive SHA-256
  `20c52262116a471608e083bb21ac31591a1f953690d88928c0424bd715bcc0a7`.
- PDFium `bb1f9f71e7b15afdd5937adf8cfe5807522b882f`, archive SHA-256
  `58098e1d4c63647c7bd8292b5f204bd0b633f8f4c9d4db6bc372445397371342`.

Both archives are already delivered through the nested-source collector.
The wrapper's `compile.sh` lists the decoder translation units explicitly and
uses its supplied `build/build_config.h` and `build/buildflag.h` instead of
running PDFium's GN/gclient build. A successful network-disabled build using
only these two archives establishes that this recipe does not require fetching
PDFium's external DEPS. It does not establish that the entire PDFium repository
can be built without them, or settle toolchain source and notice coverage.

## Initial compiler candidate

The pre-existing Emscripten 6.0.10 image produced successful, nonmatching builds:

| Asset | Shipped bytes | Candidate bytes | Candidate SHA-256 |
| --- | ---: | ---: | --- |
| `jbig2.wasm` | 103671 | 103615 | `669e18f63dd2f2eb0da441d362b853da9df0b1b210a2cb209ccc7e371dac98cd` |
| `jbig2_nowasm_fallback.js` | 152009 | 151940 | `1ba08dcfb07efb3ed39af4756d4a34d8592b36ae4012a5983820b2d1e1e6bbab` |

The WASM code and data sections differ; this is not merely custom metadata.
The [PDF.js update](https://github.com/mozilla/pdf.js/commit/c3a2798726365a6a36f7dd78bcaa51dc298395f6)
was committed on 18 September. Emscripten's
[release history](https://github.com/emscripten-core/emscripten/releases)
places 6.0.9 on 1 September and 6.0.10 on 21 September. That makes 6.0.9 a
better next candidate, not proof of the historical compiler.

## Fresh-source verification

`scripts/jbig2-source.mjs` verifies both archive checksums before extraction,
then runs the unmodified wrapper script for WASM and JavaScript in a fresh,
network-disabled container. Source mounts are read-only, with PDFium at
`/tmp/pdfium`, the wrapper at `/code` and outputs at `/js`. Both the pinned
output hash and full byte equality with installed PDF.js must pass before a
success report is written.

The candidate Emscripten 6.0.9 image is pinned by digest:

```sh
docker pull --platform linux/amd64 emscripten/emsdk@sha256:96617f27fe16421588241def73908fd348a7f9d260440ed0d00b36dcf7a063cc
node scripts/jbig2-source.mjs /tmp/jbig2-verification.json
```

The local run passed on 21 October 2026. It extracted new source directories,
recompiled both outputs and required no downloaded PDFium external DEPS:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `jbig2.wasm` | 103671 | `466f45c2a61a698152fb5400c27e56ff2ceb73dcb71fde3fc366a502308eaab0` |
| `jbig2_nowasm_fallback.js` | 152009 | `68686ced624a48c42f84cdaa482ec44b72b0de4dc84a0df903af1fb7b45b5d9a` |

Both hashes and full byte comparisons passed. The local report was retained at
`/private/tmp/pecia-jbig2-verification.json`; it is not a final release artifact.
The build reused only the prebuilt compiler image, with no previous JBIG2
objects or target directories. No post-build byte edits were applied.

Extracted-source verification now supports `PECIA_VERIFY_JBIG2=1`. The manual
Linux source-audit job prepares the pinned image, enables the rebuild and
uploads `jbig2-verification.json`. macOS/Windows run comparison and source
tampering regression tests without the container rebuild. The existing source
collector already supplies both archives. CI execution of this new check
remains pending.

The image is a prebuilt toolchain, not complete toolchain-source delivery.
Wrapper build headers carry Chromium BSD-style notices in addition to the
wrapper's Apache license. Review their applicable notice delivery separately;
do not infer all file-level terms from the wrapper's top-level license.

## Header notice delivery — 22 October 2026

The wrapper's `build/build_config.h` opens with Chromium's 2012 copyright
and BSD-license reference; `build/buildflag.h` carries the corresponding 2015
notice. The top-level Apache license alone does not convey these file-level
notices. A `pdfjs-dist@6.4.299` supplement now adds the verbatim three-line
`build_config.h` notice and the full Chromium BSD license to the generated
application notices. The full license includes the 2015 attribution. Both
retained texts are checksum-verified by the existing supplement loader and
included in release-review input hashes. Full headers remain in the retained
wrapper source archive.

The license was fetched from Chromium revision
`f71e47fc0edf5b2bae628835c5d9def62169b65d`; it also matches the license at
`3a50e012e4c9b8a410a4e2b12bf577e69ee8f755` (tag `130.0.6723.58`).
`buildflag.h` matches the latter revision byte-for-byte. `build_config.h`
differs from both inspected revisions; neither is claimed as its exact
upstream source. Its retained wrapper bytes have SHA-256
`14ce6d5c00c6fc7f6a167d627a38f7be672a37e1a1f552869532de88390bdc41`.

This improves notice delivery, but exact `build_config.h` upstream mapping,
toolchain source coverage, and final installer inspection remain open. PR #35
merged as `4ff489ff5b54570e0f285b119afe99c7df74ec27`. Source audit
[39798086732](https://github.com/pecia-app/pecia-sync/actions/runs/39798086732)
was queued when checked; no successful CI reproduction is claimed here.

## Verified CI and exact header mapping — 22 October 2026

Source audit [39798086732](https://github.com/pecia-app/pecia-sync/actions/runs/39798086732)
passed on all three platforms at `26a78c12cd0ac1b9e89c35608f80b5b337fa28aa`.
The first Linux attempt timed out downloading runtime source; its retry passed.
The retained Linux `jbig2-verification.json` confirms fresh sources, disabled
container networking and both exact output hashes shown above. The extracted
source archive SHA-256 was
`79a9a5ee168f0e6874c81514e4311802b9a99615b60813fd2bb9e715bcaffecf`.
This is evidence for that audit revision, not the later release candidate.

The wrapper history identifies its header import as the initial commit
[`76bb4402080eebef2bd09eea985e446f6ec9909c`](https://github.com/mozilla/pdf.js.jbig2/commit/76bb4402080eebef2bd09eea985e446f6ec9909c),
dated 2 January 2026. Comparing Chromium's last header revision before that
date produced an exact full-file match for `build/build_config.h` at
[`444cda9b1f3be33fffb7c6f93e50d33d4bd39635`](https://github.com/chromium/chromium/blob/444cda9b1f3be33fffb7c6f93e50d33d4bd39635/build/build_config.h).
Both files have SHA-256
`14ce6d5c00c6fc7f6a167d627a38f7be672a37e1a1f552869532de88390bdc41`.
The complete `LICENSE` at that same revision hashes to
`368cca1106be99d39ecd32a38d8305585d802a475effb66380b91ffc9bcf709b`,
matching the already retained Chromium license supplement. This resolves the
previously open exact header mapping. It does not prove when upstream copied
the file or close decoder toolchain-source and final-delivery requirements.
