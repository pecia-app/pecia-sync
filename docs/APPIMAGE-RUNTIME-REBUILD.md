# AppImage runtime functional rebuild

18 October 2026. Local engineering evidence; not release approval.

The pinned runtime and all six linked library inputs were rebuilt from the
checksum-verified `build/runtime-source` collection with Docker networking
disabled: patched musl 1.2.5-r11, zlib 1.3.2, zstd 1.5.6, secure mimalloc
2.1.7 with its Alpine patch, libfuse 3.15.0 with the runtime mount patch, and
squashfuse 0.5.2. Zlib checks and all three mimalloc tests passed.

The upstream runtime Makefile linked a static PIE executable; its version
command succeeded. Rebuilding with `GIT_COMMIT=pecia-relink-test` produced a
second executable whose version command reported that value.

| Local result | SHA-256 |
| --- | --- |
| Runtime, default upstream developer-build version | `1adc75121812a4859e0687e7131d42c456f6291965d66786a8f184bd876bd869` |
| Relinked version-test runtime | `eee12636ea58aa0cbc7574670afb49ffb55e637bc537e80f652fc2359881571b` |

These are observations, not reproducibility targets. The first harness stopped
after musl compilation because its script was edited while executing. The
successful continuation reused those completed musl objects in a checkpointed
disposable container, then built the remaining components and both runtimes.
The retained recipe below instead requires a fresh build directory; a clean
CI replay subsequently passed (details below). No release binary was replaced.

The `AppImage runtime source rebuild` workflow now performs that clean replay
on a fresh Ubuntu runner and disposable Alpine container. Source collection and
toolchain preparation may use the network; the actual compilation runs with
`--network none`, a read-only checkout and a fresh `/tmp/rebuild` directory.
It checks for unexpected dynamic-library dependencies and retains revision,
input hashes, toolchain image/package details, logs and runtime hashes for 14
days. Executables are not uploaded. CI success is not release authorization.

Clean CI run `39151279693` passed in 2m11s on audit checkout
`c5b3633a34b3cf2126e7e5beaa8ab839268dcfde`. Both runtime hashes matched
the local observations above, and the static dependency check passed. PR #26
merged as `4ca1b394972850072e502d160597feed9ee83f3c` with all four checks green.

The follow-up adds a synthetic `AppRun` fixture compressed with both gzip and
zstd. Each rebuilt runtime must extract identical fixture bytes and execute
the fixture with a space-containing argument intact. This runs without FUSE,
networking, or launching Pecia, and does not replace Linux desktop/FUSE testing.
All four local combinations (two runtimes, two compression methods) passed.
The fixture includes a repetitive content file to exercise compressed data,
not just a small launcher. Fresh CI coverage is wired into the rebuild workflow.

## Repeat the check

Use a disposable Docker container only: the recipe installs libraries into
the container's `/usr`. Do not run it directly on a host or mount a host system
directory there. Run from the repository root after collecting sources with
`node scripts/runtime-source.mjs` (that collection step needs network access).

```sh
docker build --platform linux/amd64 -t pecia-runtime-rebuild:review - < scripts/runtime-rebuild.Dockerfile
runtime_output=$(mktemp -d)
docker run --rm --platform linux/amd64 --network none \
  -v "$PWD:/work:ro" -v "$runtime_output:/out" \
  pecia-runtime-rebuild:review bash /work/scripts/runtime-rebuild.sh
```

The Dockerfile pins the historically observed Alpine base-image digest. Build
tool packages are installed from Alpine repositories during image preparation,
not pinned individually; retain the resulting image ID and package list for
each run. The local toolchain image before the environment-guard addition was
`sha256:14099fa01903b97cf55c0ca828ed1f76594afb1cf674d4c133ad8700fbba47b8`.
It used GCC 14.2 and clang 19.1.4 under x86-64 emulation on macOS.
Both source compilation phases used `--network none` and a read-only repository.

## Scope and differences

- This checks usable source and relinking, not historical byte-for-byte equality.
- Zstd uses its upstream static Makefile build, not Alpine's PGO/LTO build.
- Musl is built static-only; libfuse examples/tests are disabled. Secure mimalloc
  is retained. The original distro recipes remain included for historical flags.
- The runtime is not stripped or AppImage-packaged. Its default source version
  marker is `UNSUPPORTED_LOCAL_DEVELOPER_BUILD`, not the release commit.
- Synthetic extraction tests do not test FUSE mounting, Pecia desktop launch,
  library replacement inside a final AppImage, or Linux platform support.
- Final candidate correspondence and remaining platform/license findings are
  still open. Do not populate the approval ledger from this result alone.
