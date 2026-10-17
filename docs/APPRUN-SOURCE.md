# AppRun source delivery

The legacy `AppRun.wrapped` bytes match the original AppImageKit and Tauri mirror
asset (SHA-256 `f30140a43a0a59e46db21bdefdf749b9e9f2c6946e92afabbacf98b8ae73fb4f`).
The original release identifies AppImageKit commit
`5735cc5bed206497cddfbd2a75e1982c2606c35d`. Its historical build log is unavailable.
See APPIMAGE-RUNTIME-REVIEW.md for the precise scope of that evidence.

The source candidate now includes `build/runtime-source/appimage-apprun/AppRun.c`
and `upstream-CMakeLists.txt` from that revision. The complete opening MIT
copyright/permission comment is included in generated dependency notices.
The source collector and offline verifier check both source-file hashes and the
notice hash. No prebuilt launcher is substituted or executed by collection.

AppRun.c includes only standard libc/POSIX headers, with no project-local header
or generated source dependency. The retained upstream CMake file supplies its
target definitions; it is reference material, not a standalone CMake project.
On Linux with a C compiler and libc development headers, from the source project:

```sh
cc -D_FILE_OFFSET_BITS=64 -DENABLE_BINRELOC \
  build/runtime-source/appimage-apprun/AppRun.c -o /tmp/pecia-AppRun
node --test scripts/apprun-source.test.mjs
```

The test compiles in a unique temporary directory and executes only a synthetic
desktop-entry fixture. It verifies executable lookup, working directory and
forwarding of filenames with spaces. It does not run Pecia, mutate a Kindle,
replace the shipped launcher or certify bit-for-bit reproduction of the legacy
binary. Source-archive verification runs it on Linux; other platforms skip it.

Upstream marks this legacy release obsolete. Upgrading or replacing the launcher
is a separate packaging/compatibility change. The outer AppImage runtime and its
static dependencies remain separate from this launcher source-delivery work.
