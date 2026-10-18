import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const source=execFileSync('tar',['-xOf','build/preferred-source/tauri-apps-tauri-30da1fd6e17de6107ecc850c95dfb16b5729f2dd.tar.gz','tauri-30da1fd6e17de6107ecc850c95dfb16b5729f2dd/crates/tauri-bundler/src/bundle/linux/appimage/linuxdeploy-plugin-gtk.sh']);
assert.equal(createHash('sha256').update(source).digest('hex'),'ef6b9a980417243bc62e0241b51dc49876032afd1bab9b4762389f961b406d9b');
const initial=source.toString().match(/cat > "\$HOOKFILE" <<\\EOF\n([\s\S]*?)\nEOF/)[1]+'\n';
// Observed Ubuntu paths, applying the generator's /usr/lib relocation rules.
const values={GSETTINGS_SCHEMA_DIR:'/usr/share/glib-2.0/schemas',GI_TYPELIB_PATH:'/usr/lib/girepository-1.0',GIO_MODULE_DIR:'/usr/lib/gio/modules',GTK_EXE_PREFIX:'/usr',GTK_PATH:'/usr/lib/gtk-3.0',GTK_IM_MODULE_FILE:'/usr/lib/gtk-3.0/3.0.0/immodules.cache',GDK_PIXBUF_MODULE_FILE:'/usr/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache'};
const hook=initial+Object.entries(values).map(([key,value])=>`export ${key}="$APPDIR/${value}"\n`).join('');
const hash=createHash('sha256').update(hook).digest('hex');
assert.equal(hash,'b817312524dc34aff9faa0f2cf1f91f8a17cede909816cde85f11e7fcf8882a5');
console.log({hookSha256:hash,exactMatch:true});
