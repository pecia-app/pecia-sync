// Controlled replacement build, not a reconstruction of upstream's dependency graph.
import {readFile, mkdir, copyFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {controlledPluginTemplate} from './windows-plugin-template.mjs';
const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, 'build/windows-plugin');
const run = (command, args, cwd = directory) => execFileSync(command, args, {cwd, encoding:'utf8', maxBuffer:32*1024*1024});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const archive = resolve(root, 'build/runtime-source/nsis-tauri-utils/nsis-tauri-utils.tar.gz');
if (hash(await readFile(archive)) !== '9b277f7cdec4277b48d319c32e10b5dc4303e9efce8c3b44f1db77f86a8131c7') throw Error('Plugin source checksum mismatch');
await mkdir(directory, {recursive:true});
if (process.argv.includes('--prepare')) {
  run('tar', ['-xzf', archive, '--strip-components=1', '-C', directory]);
  await copyFile(resolve(root, 'release/windows-plugin/Cargo.lock'), resolve(directory, 'Cargo.lock'));
  const config = run('cargo', ['vendor', '--locked', '--versioned-dirs', 'vendor']);
  await mkdir(resolve(directory, '.cargo'), {recursive:true});
  // Replace upstream target configuration with an explicit, portable vendor config.
  await writeFile(resolve(directory, '.cargo/config.toml'), config);
}
if (hash(await readFile(resolve(directory, 'Cargo.lock'))) !== hash(await readFile(resolve(root, 'release/windows-plugin/Cargo.lock')))) throw Error('Plugin lockfile mismatch');
run('cargo', ['metadata', '--locked', '--offline', '--format-version', '1']);
if (process.argv.includes('--build')) {
  if (process.platform !== 'win32') throw Error('Plugin build requires Windows MSVC');
  if (!run('rustc',['--version']).startsWith('rustc 1.97.0 ')) throw Error('Controlled plugin build requires Rust 1.97.0');
  run('cargo', ['build', '--frozen', '--release', '--target', 'i686-pc-windows-msvc', '-p', 'nsis-tauri-utils']);
  const dll = resolve(directory, 'target/i686-pc-windows-msvc/release/nsis_tauri_utils.dll');
  await mkdir(resolve(directory, 'plugin'), {recursive:true});
  await copyFile(dll, resolve(directory, 'plugin/nsis_tauri_utils.dll'));
  run(process.execPath,['scripts/preferred-source.mjs'],root);
  const tauriArchive=resolve(root,'build/preferred-source/tauri-apps-tauri-30da1fd6e17de6107ecc850c95dfb16b5729f2dd.tar.gz');
  const template=run('tar',['-xOf',tauriArchive,'tauri-30da1fd6e17de6107ecc850c95dfb16b5729f2dd/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi']);
  await writeFile(resolve(directory,'installer.nsi'),controlledPluginTemplate(template,resolve(directory,'plugin')));
  await writeFile(resolve(directory, 'build-evidence.json'), JSON.stringify({
    sourceRevision:'13d9edd27b69310e108d6fbd49f90992f8a05390',
    lockSha256:hash(await readFile(resolve(directory,'Cargo.lock'))),
    dllSha256:hash(await readFile(dll)), rust:run('rustc',['--version']).trim(),
    scope:'Controlled replacement; not upstream binary reproduction or release approval',
  }, null, 2)+'\n');
}
console.log('Controlled plugin source and locked offline dependency metadata verified.');
