// Extract only; never execute the installer.
import {readFile,readdir,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
if(process.platform!=='win32')throw Error('Windows packaging verification only');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const directory=resolve('src-tauri/target/release/bundle/nsis');
const names=(await readdir(directory)).filter(name=>name.endsWith('-setup.exe'));
assert.equal(names.length,1,'Expected one freshly built NSIS installer');
const installer=resolve(directory,names[0]);
const evidence=JSON.parse(await readFile('build/windows-plugin/build-evidence.json','utf8'));
const expected=await readFile('build/windows-plugin/plugin/nsis_tauri_utils.dll');
assert.equal(hash(expected),evidence.dllSha256,'Build evidence mismatch');
const payload=execFileSync('7z',['e','-so',installer,'$PLUGINSDIR/nsis_tauri_utils.dll'],{maxBuffer:16*1024*1024});
assert.ok(payload.length>0,'Plugin missing from installer');
assert.equal(hash(payload),evidence.dllSha256,'Installer did not use the controlled plugin');
await mkdir('build/installer-audit',{recursive:true});
await copyFile('build/windows-plugin/build-evidence.json','build/installer-audit/windows-plugin-build.json');
await writeFile('build/installer-audit/windows-plugin-verification.json',JSON.stringify({
  installer:names[0],installerSha256:hash(await readFile(installer)),pluginSha256:hash(payload),
  scope:'Exact controlled plugin payload match; not release approval',
},null,2)+'\n');
console.log('Extracted installer plugin matches controlled build exactly.');
