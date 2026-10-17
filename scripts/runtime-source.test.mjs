import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {runtimeNotices, collectRuntimeSource, validateRuntimeManifest} from './runtime-source.mjs';
const hash = (bytes, algorithm='sha256') => createHash(algorithm).update(bytes).digest('hex');
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
  assert.deepEqual(records.map(record=>record.name).sort(),['appimage-apprun','appimage-type2-runtime','libfuse','mimalloc2','musl','squashfuse','zlib','zstd']);
  const musl=records.find(record=>record.name==='musl');
  assert.equal(musl.files.length,17);
  assert.ok(musl.files.some(file=>file.file==='CVE-2026-40200.patch'&&file.sha512));
  assert.ok(records.find(record=>record.name==='libfuse').contents.includes('GNU LESSER GENERAL PUBLIC LICENSE'));
});
test('accepts official source hosts but rejects lookalikes',()=>fixture(async ({manifest})=>{
  for(const host of ['musl.libc.org','zlib.net','codeload.github.com']){
    const changed=structuredClone(manifest);changed.records[0].files[0].url=`https://${host}/source.tar.gz`;
    assert.doesNotThrow(()=>validateRuntimeManifest(changed));
  }
  for(const host of ['zlib.net.evil.example','example.com']){
    const changed=structuredClone(manifest);changed.records[0].files[0].url=`https://${host}/source.tar.gz`;
    assert.throws(()=>validateRuntimeManifest(changed),/URL/);
  }
}));
