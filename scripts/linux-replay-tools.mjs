// Use the build's actual cache, not a separately downloaded or moving tool.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {describeReplayTools} from './linux-native-replay.mjs';

if (process.platform !== 'linux' || process.arch !== 'x64') throw Error('Replay tool pin currently covers Linux x64 only');
const path = resolve('src-tauri/target/.tauri/linuxdeploy-07333c6-x86_64.AppImage');
const sha256 = createHash('sha256').update(await readFile(path)).digest('hex');
// Tauri's pinned prepare_tools() zeroes offsets 8..10 (the AI marker) in
// its cached executable. Pin that exact result, not the untouched download.
const downloadSha256 = '36a2d7e274d12e1050d0e9ecfe11d339ed54720b2bec464c286d53f8b07f5c62';
const expected = 'bd9521cd5ff3ca351fecb78cd9b236a4e37b3621014ac05cac0c2d767ffa0474';
if (sha256 !== expected) throw Error(`linuxdeploy cache bytes changed: ${sha256}; expected ${expected}`);
const gtkPlugin = resolve('src-tauri/target/.tauri/linuxdeploy-plugin-gtk.sh');
const gtkSha256 = createHash('sha256').update(await readFile(gtkPlugin)).digest('hex');
if (gtkSha256 !== 'ef6b9a980417243bc62e0241b51dc49876032afd1bab9b4762389f961b406d9b') throw Error('GTK plugin changed; review replay transformations');
const destination = resolve('build/installer-audit/linuxdeploy-tools');
await mkdir(destination, {recursive: true});
execFileSync(path, ['--appimage-extract'], {cwd: destination, maxBuffer: 16 * 1024 * 1024});
const toolDirectory = join(destination, 'squashfs-root/usr/bin');
const tools = {strip: join(toolDirectory, 'strip'), patchelf: join(toolDirectory, 'patchelf')};
await writeFile(join(destination, 'provenance.json'), JSON.stringify({
  sourceUrl: 'https://github.com/tauri-apps/binary-releases/releases/download/linuxdeploy-07333c6/linuxdeploy-x86_64.AppImage',
  sha256, downloadSha256, cacheTransformation: 'Tauri zeroes bytes 8, 9, 10 of the downloaded AppImage',
  gtkPluginSha256: gtkSha256, tools: await describeReplayTools(tools),
}, null, 2) + '\n');
console.log('Retained and hashed the actual linuxdeploy replay tools.');
