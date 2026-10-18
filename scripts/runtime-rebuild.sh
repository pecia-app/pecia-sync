#!/bin/bash
# Run ONLY in the disposable toolchain container; installs into its /usr.
set -euxo pipefail
test -f /etc/alpine-release
test -f /.dockerenv
test "${PECIA_RUNTIME_REBUILD:-}" = 1
apk info -v > /out/toolchain-packages.txt
clang --version > /out/compiler.txt
cd /work
node scripts/runtime-source.mjs --offline
test ! -e /tmp/rebuild
mkdir /tmp/rebuild
cd /tmp/rebuild
inputs=/work/build/runtime-source
tar xf "$inputs/appimage-type2-runtime/type2-runtime.tar.gz"
runtime=/tmp/rebuild/type2-runtime-8f39b89e2ac31e1640b3d3f7e9a5108e6ce805fa
tar xf "$inputs/musl/musl-1.2.5.tar.gz"
cd musl-1.2.5
for patchfile in handle-aux-at_base.patch isatty-glibc-align.patch ldso-fix-non-functional-fix-to-early-dynamic-PAGE_SI.patch loongarch64-Add-lsx-and-lasx-vector-structure-defini.patch loongarch64-add-TLSDESC-support.patch loongarch64-add-fpu-and-simd-context-to-signal.h.patch loongarch64-add-bits-hwcap.h.patch CVE-2025-26519.patch CVE-2026-6042.patch CVE-2026-40200.patch; do
  patch -p1 < "$inputs/musl/$patchfile"
done
./configure --prefix=/usr --disable-shared --enable-debug
make -j2
make install
cc -c "$inputs/musl/__stack_chk_fail_local.c" -o /tmp/stack.o
ar r /usr/lib/libssp_nonshared.a /tmp/stack.o
cd /tmp/rebuild
tar xf "$inputs/zlib/zlib-1.3.2.tar.gz"
cd zlib-1.3.2
CFLAGS=-O2 ./configure --prefix=/usr --static
make -j2
make check
make install
cd /tmp/rebuild
tar xf "$inputs/zstd/zstd-1.5.6.tar.gz"
cd zstd-1.5.6
# Functional rebuild, not historical PGO/bit-for-bit reproduction.
make -C lib -j2 libzstd.a
install -m644 lib/libzstd.a /usr/lib/libzstd.a
install -m644 lib/zstd.h lib/zdict.h lib/zstd_errors.h /usr/include/
cd /tmp/rebuild
tar xf "$inputs/mimalloc2/mimalloc-2.1.7.tar.gz"
cd mimalloc-2.1.7
patch -p1 < "$inputs/mimalloc2/cmake-add-insecure-suffix.patch"
CFLAGS=-D__USE_ISOC11 cmake -B out -G Ninja -DCMAKE_INSTALL_PREFIX=/usr -DMI_INSTALL_TOPLEVEL=ON -DCMAKE_BUILD_TYPE=Release -DMI_SECURE=ON
cmake --build out -j2
ctest --test-dir out --output-on-failure
cmake --install out
ln -s libmimalloc-secure.a /usr/lib/libmimalloc.a
cd /tmp/rebuild
tar xf "$inputs/libfuse/fuse-3.15.0.tar.xz"
cd fuse-3.15.0
patch -p1 < "$runtime/patches/libfuse/mount.c.diff"
meson setup build --prefix=/usr --default-library=static -Dexamples=false -Dtests=false
ninja -C build -j2 install
cd /tmp/rebuild
tar xf "$inputs/squashfuse/squashfuse-0.5.2.tar.gz"
cd squashfuse-0.5.2
./autogen.sh
CFLAGS='-ffunction-sections -fdata-sections -Os' ./configure LDFLAGS=-static
make -j2
make install
install -m644 ./*.h /usr/local/include/squashfuse/
cd "$runtime/src/runtime"
make runtime
file runtime
readelf -d runtime > /out/runtime-dynamic.txt
if grep -q '(NEEDED)' /out/runtime-dynamic.txt; then
  echo 'Unexpected shared library dependency in runtime' >&2
  exit 1
fi
./runtime --appimage-version
cp runtime /out/runtime-rebuilt
sha256sum /usr/lib/libc.a /usr/lib/libz.a /usr/lib/libzstd.a /usr/lib/libmimalloc-secure.a /usr/lib/libfuse3.a /usr/local/lib/libsquashfuse.a /usr/local/lib/libsquashfuse_ll.a /out/runtime-rebuilt
# Prove a changed compile-time version can be relinked and executed too.
make -B runtime GIT_COMMIT=pecia-relink-test
./runtime --appimage-version 2>&1 | grep -F pecia-relink-test
cp runtime /out/runtime-relinked
sha256sum /out/runtime-rebuilt /out/runtime-relinked > /out/runtime.sha256
bash /work/scripts/runtime-smoke.sh
