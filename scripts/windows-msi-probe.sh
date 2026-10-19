#!/bin/sh
# Historical, read-only MSI probe. Requires msitools, tar and sha256sum.
set -eu
msi=${1:?MSI path required}
source=${2:?WiX source archive required}
check() {
  actual=$(sha256sum "$1" | cut -d ' ' -f 1)
  test "$actual" = "$2" || { echo "Unexpected input: $1" >&2; exit 1; }
}
check "$msi" 66cc044203a9924d9fd8ed70087fc337791ef622878637b69b7fd9cc154aada5
check "$source" d8f11d479cfacbeaf3bda133c2b00a200457fbc239d1e3b0edd6463fbb9853d9
for pair in Banner:bannrbmp.bmp Dialog:dlgbmp.bmp Exclam:exclamic.ico Info:info.ico New:New.ico Up:Up.ico; do
  name=${pair%%:*}
  file=${pair#*:}
  kind=Bmp
  case "$name" in Exclam|Info) kind=Ico;; esac
  stream=Binary.WixUI_${kind}_${name}
  # Capture before hashing so a failed extraction cannot be hidden by a pipe.
  # MSI streams contain binary NUL bytes, so use temporary files, not variables.
  directory=$(mktemp -d)
  msiinfo extract "$msi" "$stream" > "$directory/payload"
  tar -xOf "$source" "wix3-b40e9a32c24033e11b77baf2c91a704382f898ed/src/ext/UIExtension/wixlib/Bitmaps/$file" > "$directory/source"
  cmp "$directory/payload" "$directory/source"
  printf 'MATCH %s ' "$stream"
  sha256sum "$directory/payload"
done
for table in CustomAction InstallExecuteSequence; do
  msiinfo export "$msi" "$table"
done
