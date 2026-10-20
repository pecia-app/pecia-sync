import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {collectNestedSources,validateNestedSources} from './pdfjs-nested-source.mjs';
const bytes=Buffer.from('source fixture');
const manifest=()=>({schemaVersion:1,records:[{name:'fixture',file:'fixture.tar.gz',sha256:createHash('sha256').update(bytes).digest('hex'),url:'https://codeload.github.com/example/project/tar.gz/revision',evidence:'fixture only'}]});
test('rejects unsafe paths, hosts and duplicate records',()=>{
  for(const change of [m=>m.records[0].file='../escape.tar.gz',m=>m.records[0].url='https://www.sourceware.org.evil.example/file',m=>m.records.push(m.records[0])]){
    const m=manifest();change(m);assert.throws(()=>validateNestedSources(m));
  }
});
test('accepts the crate source host but not a lookalike',()=>{
  const m=manifest();m.records[0].url='https://static.crates.io/crates/qcms/qcms-0.3.0.crate';
  assert.doesNotThrow(()=>validateNestedSources(m));
  m.records[0].url='https://static.crates.io.evil.example/qcms.crate';
  assert.throws(()=>validateNestedSources(m),/URL/);
});
test('collects exact bytes and fails closed offline or when tampered',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecia-nested-test-'));
  try{
    await mkdir(join(root,'release'));await writeFile(join(root,'release/pdfjs-nested-source.json'),JSON.stringify(manifest()));
    await assert.rejects(collectNestedSources(root,true),/Missing/);
    await assert.rejects(collectNestedSources(root,false,async()=>new Response('wrong')),/checksum/);
    assert.equal(await collectNestedSources(root,false,async()=>new Response(bytes)),1);
    assert.equal(await collectNestedSources(root,true,()=>{throw Error('Network forbidden');}),1);
    await writeFile(join(root,'build/pdfjs-nested-source/fixture.tar.gz'),'modified');
    await assert.rejects(collectNestedSources(root,true),/checksum/);
  }finally{await rm(root,{recursive:true,force:true});}
});
