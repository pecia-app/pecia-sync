#!/bin/bash
# Synthetic fixture only; run inside the disposable runtime-build container.
set -euo pipefail
test -f /.dockerenv
test "${PECIA_RUNTIME_REBUILD:-}" = 1
fixture_root=$(mktemp -d /tmp/pecia-runtime-smoke.XXXXXX)
mkdir "$fixture_root/payload"
printf '#!/bin/sh\nprintf "fixture:%%s\\n" "$1"\n' > "$fixture_root/payload/AppRun"
chmod +x "$fixture_root/payload/AppRun"
printf 'Pecia synthetic compression fixture.\n%.0s' {1..4096} > "$fixture_root/payload/content.txt"
printf 'fixture:book with spaces.epub\n' > "$fixture_root/expected"
for compression in gzip zstd; do
  mksquashfs "$fixture_root/payload" "$fixture_root/$compression.squashfs" -noappend -comp "$compression" -processors 2
  for runtime in runtime-rebuilt runtime-relinked; do
    image="$fixture_root/$runtime-$compression.AppImage"
    cat "/out/$runtime" "$fixture_root/$compression.squashfs" > "$image"
    chmod +x "$image"
    mkdir "$fixture_root/$runtime-$compression"
    (
      cd "$fixture_root/$runtime-$compression"
      "$image" --appimage-extract
      cmp squashfs-root/AppRun "$fixture_root/payload/AppRun"
      cmp squashfs-root/content.txt "$fixture_root/payload/content.txt"
    )
    "$image" --appimage-extract-and-run 'book with spaces.epub' > "$fixture_root/actual"
    cmp "$fixture_root/expected" "$fixture_root/actual"
    printf '%s %s: extraction, execution and argument preservation passed\n' "$runtime" "$compression"
  done
done
