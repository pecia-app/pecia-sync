# QCMS rebuild experiment — 19 October 2026

Result: the path-remapped, optimized offline build **exactly matches** the
shipped decoder, confirmed again with a fresh target directory. Earlier stages
below document the nonmatching intermediate results. No application assets were
replaced. This is not release clearance or proof of the historical build setup.

Inputs:

- Wrapper `2ae4ee72334782928210ba4050e3e77d9b2d35be`, checksum-pinned in
  `release/pdfjs-nested-source.json`.
- Rust 1.97.1, matching shipped WASM producer metadata.
- wasm-bindgen CLI 0.2.126, installed with its published lockfile; it selected
  walrus 0.26.4, also matching producer metadata.
- `release/qcms-experiment/Cargo.lock`: derived by updating only wasm-bindgen
  to 0.2.126 in the wrapper's repository lockfile. Other versions were retained
  where Cargo permitted. This is a candidate resolution, not a recovered
  historical lockfile. Thirteen registry packages were vendored.

The recipe is `scripts/qcms-rebuild.Dockerfile`. Build an amd64 image, extract
the verified wrapper archive to a scratch directory, replace its Cargo.lock with
the candidate, and run `cargo vendor --locked --versioned-dirs vendor` there.
Use Cargo's emitted source-replacement config with a relative `vendor` directory.
Mount that scratch directory at `/work` and disable container networking for:

```sh
cargo build --frozen --release --target wasm32-unknown-unknown
wasm-bindgen --target web --no-typescript --out-name qcms --out-dir output \
  target/wasm32-unknown-unknown/release/qcms_pdf_js.wasm
```

Observed image ID:
`c7d9a40da6072cc7aa21d07c21fff1946562a6f2defb0f220421a8d5e9ceed64`.
Source and output were isolated under `/private/tmp/pecia-qcms-rebuild`.

| WASM | Bytes | SHA-256 |
| --- | ---: | --- |
| Shipped | 96589 | `663d86126d5f5fcb1c61490f94353e2a8375660b8c5498ab3ebab5a34b08800e` |
| Experiment | 116368 | `a1a8af4c8b49123ca1e8925b0330cb2c0773f470268749694aae685dd064f2c7` |

The code section differs (89952 versus 95610 bytes), as do several other
sections. This is not merely a timestamp or custom-metadata discrepancy.
The experiment did not run wasm-pack's wasm-opt stage; its version/settings,
the full historical dependency resolution, and build-path effects remain
unresolved. Matching the compiler and bindgen versions alone is insufficient.

## Optimizer experiment

wasm-pack v0.15.0's `src/install/mod.rs` pins its fallback download to Binaryen
117, and `src/manifest/mod.rs` defaults release optimization to `-O`. This is
a candidate pipeline, not proof of which wasm-pack or PATH optimizer upstream
used. Source: https://github.com/wasm-bindgen/wasm-pack/tree/v0.15.0/src

Downloaded `binaryen-version_117-x86_64-linux.tar.gz` from the official
WebAssembly/binaryen version_117 release. Archive SHA-256:
`3dc677006555b355ea2da5e82602065a161d5e83eaefd3f759afa00b96e83212`.
Extracted into the scratch directory and ran inside the same network-disabled
amd64 container:

```sh
./binaryen-version_117/bin/wasm-opt output/qcms_bg.wasm \
  -o output/qcms_bg.optimized.wasm -O
```

The optimized result is 96337 bytes, SHA-256
`33551aaae8d87b12ec0d50fced45eea5da5536f84f20d4c71ea6da9ba1656935`.
It remains different from the shipped 96589-byte decoder. Section comparison
finds identical type, import, function, table, memory, export, element, data-count,
and both custom sections. The code section now has the same length (89952)
but different bytes; globals and data also differ. The data section accounts
for the entire size difference (4954 versus 5206 bytes). Build-path strings
and their addresses are a candidate explanation to investigate, not a proven
explanation or an equivalence claim.

## Exact reproduction through compiler path remapping

Rebuilding under `/tmp` alone produced 96333 bytes with SHA-256
`c1d13375e3b451e42f0a03ba72ebc920cc4762fd00f42e2cabb00f0cd5430b57`.
It did not match. Inspection found five embedded dependency source paths:
four from qcms and one from wasm-bindgen. The shipped binary uses Cargo's
registry directory; the experiment uses `/work/vendor`.

With the scratch source mounted at `/work`, set this compiler environment:

```sh
export RUSTFLAGS='--remap-path-prefix=/work/vendor=/usr/local/cargo/registry/src/index.crates.io-1949cf8c6b5b557f'
cargo build --frozen --release --target wasm32-unknown-unknown
wasm-bindgen --target web --no-typescript --out-name qcms --out-dir output-remapped \
  target/wasm32-unknown-unknown/release/qcms_pdf_js.wasm
./binaryen-version_117/bin/wasm-opt output-remapped/qcms_bg.wasm \
  -o output-remapped/qcms_bg.optimized.wasm -O
```

Result: **96589 bytes**, SHA-256
`663d86126d5f5fcb1c61490f94353e2a8375660b8c5498ab3ebab5a34b08800e`.
Host `cmp` confirmed full byte equality with
`node_modules/pdfjs-dist/wasm/qcms_bg.wasm`. No post-build byte patching was used.

A second network-disabled container run used an empty
`CARGO_TARGET_DIR=/tmp/qcms-clean-target`, recompiling all dependencies, with
the same remapping and optimizer. Its output also passed `cmp` against the
shipped decoder and had the same SHA-256. The vendored source and toolchain
image were reused; compiled target artifacts were not.

This establishes a working reproduction recipe for this WASM asset. It does
not recover the historical lockfile or prove that upstream used these exact
inputs. Remaining work: integrate the recipe and all required sources/tooling
into the source-verification workflow, verify their notice coverage, and finish
the independent OpenJPEG, JBIG2, and Liberation investigations. No application
asset or release-approval ledger was changed.

## Integrated verification

`scripts/source-bundle.mjs` now prepares and includes `build/qcms-source`:
the checksum-verified wrapper, candidate lockfile, and thirteen vendored registry
packages (including their license files). `scripts/qcms-source.mjs` checks that
lockfile and resolves metadata offline. The source verifier always runs that
check; metadata validation alone is explicitly not a WASM rebuild.

Build the verification toolchain while networking is available:

```sh
docker build --platform linux/amd64 -f scripts/qcms-rebuild.Dockerfile \
  -t pecia-qcms-rebuild:verification .
node scripts/qcms-source.mjs --prepare
node scripts/qcms-source.mjs --rebuild
```

The rebuild uses a fresh container-local target directory, disables networking,
and fails unless both the pinned hash and the installed PDF.js bytes match.
It writes `build/qcms-source/verification.json` only after success. Source bundle
creation excludes that report so an old result cannot stand in for verification.
Set `PECIA_VERIFY_QCMS=1` when running `scripts/verify-source.mjs` to run the
same check from the extracted source archive. The Linux source-audit CI job
enables it; macOS and Windows perform the offline metadata check only.

Toolchain image creation still downloads Rust components, wasm-bindgen CLI's
locked build dependencies, and the checksum-pinned Binaryen executable archive.
Those toolchain sources are not fully collected by this change. Accordingly,
this is reproduction integration, not a claim of complete Corresponding Source
or notice clearance for the toolchain or the other PDF.js assets.
