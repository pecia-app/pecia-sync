#!/bin/bash
set -euo pipefail
test -f /.dockerenv
test "${PECIA_CACHE_REPLAY:-}" = 1
unresolved=0
cp -a /appdir/usr/share/glib-2.0/schemas /tmp/schemas
glib-compile-schemas /tmp/schemas
cmp /appdir/usr/share/glib-2.0/schemas/gschemas.compiled /tmp/schemas/gschemas.compiled
echo 'schemas: exact replay'
export LD_LIBRARY_PATH=/appdir/usr/lib
mv /usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules /tmp/host-immodules
cp -a /appdir/usr/lib/gtk-3.0/3.0.0/immodules /usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules
/usr/lib/x86_64-linux-gnu/libgtk-3-0t64/gtk-query-immodules-3.0 | sed 's|/usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules/||g' > /tmp/immodules.cache
if cmp /appdir/usr/lib/gtk-3.0/3.0.0/immodules.cache /tmp/immodules.cache; then echo 'immodules: exact replay'; else unresolved=$((unresolved+1)); fi
mv /usr/lib/x86_64-linux-gnu/gdk-pixbuf-2.0/2.10.0/loaders /tmp/host-loaders
cp -a /appdir/usr/lib/gdk-pixbuf-2.0/2.10.0/loaders /usr/lib/x86_64-linux-gnu/gdk-pixbuf-2.0/2.10.0/loaders
/usr/lib/x86_64-linux-gnu/gdk-pixbuf-2.0/gdk-pixbuf-query-loaders | sed 's|/usr/lib/x86_64-linux-gnu/gdk-pixbuf-2.0/2.10.0/loaders/||g' > /tmp/loaders.cache
if cmp /appdir/usr/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache /tmp/loaders.cache; then echo 'pixbuf: exact replay'; else unresolved=$((unresolved+1)); fi
cp -a /appdir/usr/lib/gio/modules /tmp/gio-modules
gio-querymodules /tmp/gio-modules
if cmp /appdir/usr/lib/gio/modules/giomodule.cache /tmp/gio-modules/giomodule.cache; then echo 'gio: exact replay'; else unresolved=$((unresolved+1)); fi
exit "$unresolved"
