import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {runtimeNotices, collectRuntimeSource, validateRuntimeManifest, downloadRuntimeSource} from './runtime-source.mjs';
const hash = (bytes, algorithm='sha256') => createHash(algorithm).update(bytes).digest('hex');
test('retries transient source failures with a bound, but not permanent failures',async()=>{
  let calls=0;const delays=[];
  const bytes=await downloadRuntimeSource('https://zlib.net/source',async()=>{
    calls++;
    if(calls===1)throw new TypeError('fetch failed',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}});
    return calls===2 ? new Response('busy',{status:503}) : new Response('source');
  },async ms=>delays.push(ms));
  assert.equal(bytes.toString(),'source');assert.equal(calls,3);assert.deepEqual(delays,[1000,2000]);
  calls=0;
  await assert.rejects(downloadRuntimeSource('https://zlib.net/source',async()=>{calls++;return new Response('busy',{status:503});},async()=>{}),/503/);
  assert.equal(calls,3);
  calls=0;
  await assert.rejects(downloadRuntimeSource('https://zlib.net/source',async()=>{calls++;return new Response('missing',{status:404});},async()=>{assert.fail('Permanent error retried');}),/404/);
  assert.equal(calls,1);
});
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'pecia-runtime-source-test-'));
  try {
    const notice='fixture notice\n', bytes=Buffer.from('fixture source');
    const manifest={schemaVersion:1,records:[{name:'fixture',version:'1.0-r0',license:'MIT',runtimeRevision:'a'.repeat(40),sourceRevision:'b'.repeat(40),recipeRevision:'c'.repeat(40),evidence:'fixture',notice:{file:hash(notice)+'.txt',sha256:hash(notice),url:'https://raw.githubusercontent.com/example/repo/commit/LICENSE'},files:[{file:'source.tar.gz',url:'https://github.com/example/repo/source.tar.gz',sha256:hash(bytes),sha512:hash(bytes,'sha512')}]}]};
    await mkdir(join(root,'release'));
    await mkdir(join(root,'LICENSES/third-party'),{recursive:true});
    await writeFile(join(root,'release/runtime-source.json'),JSON.stringify(manifest));
    await writeFile(join(root,'LICENSES/third-party',manifest.records[0].notice.file),notice);
    await fn({root,manifest,bytes});
  } finally {await rm(root,{recursive:true,force:true});}
}
test('fetches verified source then verifies offline without network',()=>fixture(async ({root,bytes})=>{
  let requests=0;
  assert.equal(await collectRuntimeSource(root,false,async()=>{requests++;return new Response(bytes);}),1);
  assert.equal(requests,1);
  assert.equal(await collectRuntimeSource(root,true,()=>{throw Error('Unexpected network');}),1);
  await writeFile(join(root,'build/runtime-source/fixture/source.tar.gz'),'tampered');
  await assert.rejects(collectRuntimeSource(root,true),/checksum mismatch/);
}));
test('missing offline sources and changed notices fail closed',()=>fixture(async ({root,manifest})=>{
  await assert.rejects(collectRuntimeSource(root,true),/Missing runtime source/);
  await writeFile(join(root,'LICENSES/third-party',manifest.records[0].notice.file),'changed');
  await assert.rejects(runtimeNotices(root),/notice checksum/);
}));
test('rejects traversal, duplicate records and non-HTTPS sources',()=>fixture(async ({manifest})=>{
  const invalid=structuredClone(manifest);invalid.records[0].files[0].file='../outside';
  assert.throws(()=>validateRuntimeManifest(invalid),/Invalid runtime file/);
  const duplicate=structuredClone(manifest);duplicate.records.push(duplicate.records[0]);
  assert.throws(()=>validateRuntimeManifest(duplicate),/duplicate runtime package/);
  const url=structuredClone(manifest);url.records[0].files[0].url='http://github.com/file';
  assert.throws(()=>validateRuntimeManifest(url),/URL/);
}));
test('rejects bad downloads and validates SHA-512 as well as SHA-256',()=>fixture(async ({root,manifest,bytes})=>{
  await assert.rejects(collectRuntimeSource(root,false,async()=>new Response('wrong')),/checksum mismatch/);
  manifest.records[0].files[0].sha512='0'.repeat(128);
  await writeFile(join(root,'release/runtime-source.json'),JSON.stringify(manifest));
  await assert.rejects(collectRuntimeSource(root,false,async()=>new Response(bytes)),/checksum mismatch/);
}));
test('repository runtime notices have exact upstream bytes',async()=>{
  const records=await runtimeNotices();
  assert.ok(records.some(record=>record.name==='mimalloc2'&&record.version==='2.1.7-r0'));
  assert.deepEqual(records.map(record=>record.name).sort(),['appimage-apprun','appimage-type2-runtime','libfuse','linuxdeploy-gtk-hook','linuxdeploy-wrapper','mimalloc2','musl','nsis','nsis-tauri-utils','squashfuse','wix-ui','zlib','zstd']);
  assert.match(records.find(record=>record.name==='nsis').contents,/SPECIAL EXCEPTION FOR LZMA COMPRESSION MODULE/);
  assert.match(records.find(record=>record.name==='wix-ui').contents,/Microsoft Reciprocal License/);
  assert.match(records.find(record=>record.name==='nsis-tauri-utils').evidence,/No upstream Cargo.lock/);
  const musl=records.find(record=>record.name==='musl');
  assert.equal(musl.files.length,17);
  assert.ok(musl.files.some(file=>file.file==='CVE-2026-40200.patch'&&file.sha512));
  assert.ok(records.find(record=>record.name==='libfuse').contents.includes('GNU LESSER GENERAL PUBLIC LICENSE'));
});
test('accepts official source hosts but rejects lookalikes',()=>fixture(async ({manifest})=>{
  for(const host of ['musl.libc.org','zlib.net','codeload.github.com','downloads.sourceforge.net']){
    const changed=structuredClone(manifest);changed.records[0].files[0].url=`https://${host}/source.tar.gz`;
    assert.doesNotThrow(()=>validateRuntimeManifest(changed));
  }
  for(const host of ['zlib.net.evil.example','downloads.sourceforge.net.evil.example','example.com']){
    const changed=structuredClone(manifest);changed.records[0].files[0].url=`https://${host}/source.tar.gz`;
    assert.throws(()=>validateRuntimeManifest(changed),/URL/);
  }
}));
