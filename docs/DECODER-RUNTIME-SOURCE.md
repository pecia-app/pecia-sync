# Decoder runtime source and notices

Engineering evidence, 23 October 2026; release approval remains pending.

The successful JBIG2 reproduction uses Emscripten 6.0.9; OpenJPEG uses 6.0.10.
Both complete Emscripten source archives are now checksum-pinned in
`release/pdfjs-nested-source.json` and included in source candidates. They
contain the generated JavaScript runtime inputs and bundled C/C++ runtime
sources, including musl, compiler-rt, libc++, libc++abi and related system code.

| Version | Source commit | Archive SHA-256 |
| --- | --- | --- |
| 6.0.9 | `4e4223852a0835923411059a3929907d7df1232e` | `426911732c683c5940e3e089782d90d272ec2738c933e53593f9e9a65ff6aa96` |
| 6.0.10 | `d6c521a7f05449857c76bd99e396895583cf2083` | `de630b2a6b736d1bac03b1016a21e365db29b4a3ca6e1457fb0281e1b72e7d59` |

## Source/image byte comparison

`python3 scripts/emscripten-runtime-probe.py <report.json>` reads the retained
archives and compares all regular files under `src/` and `system/`, plus
`LICENSE` and `AUTHORS`, with the digest-pinned compiler images used by the
reproduction scripts. Containers have networking disabled and pull disabled.
It passed locally for both images: 6,558 image files match exactly, with no
image-only files in the inspected trees. The archives additionally contain
seven `.gitignore`, `.clang-format` or `.clang-tidy` files omitted from the
images. Their explicit list is checked by the probe and retained in
`release/emscripten-runtime-evidence.json`.

This verifies the supplied runtime trees against the working reproduction
toolchains. It does not identify the historical upstream compiler invocation,
verify compiler executable bytes against source, or compare the whole Docker
filesystem. The successful decoder output comparisons remain separate evidence.

## Notice delivery

The PDF.js notice supplement now retains the full top-level Emscripten license
and authors text, musl's complete COPYRIGHT text, and the named license texts
under `system/` from both versions. Identical texts are deduplicated by checksum.
This includes LLVM runtime notices and optional components such as SDL,
mimalloc and OpenMP; inclusion does not assert that every component is linked
into either decoder. The original source archives retain file-level notices.
The generated application notices include these supplementary texts, and
changes invalidate release-review input hashes.

## Remaining scope

- QCMS's Rust standard-library runtime source and notice coverage need a
  separate assessment; its wrapper/crates and reproducible recipe are supplied.
- The compiler images themselves are build tools, not attached application
  binaries. This collection is not a full compiler/toolchain-source rebuild.
  Record a scoped distribution assessment before closing the overall review.
- Inspect the final source archives and application notice resources to ensure
  delivery of the collected sources and notices. No final-candidate claim is
  made by this local probe.
