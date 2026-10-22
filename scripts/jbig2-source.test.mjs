import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyOutput,rebuild} from './jbig2-source.mjs';
test('JBIG2 comparison requires pinned bytes and shipped-byte equality',()=>{
  const bytes=Buffer.from('fixture');
  const expected=createHash('sha256').update(bytes).digest('hex');
  assert.equal(verifyOutput('fixture',bytes,bytes,expected).bytes,7);
  assert.throws(()=>verifyOutput('fixture',Buffer.from('changed'),bytes,expected),/hash differs/);
  assert.throws(()=>verifyOutput('fixture',bytes,Buffer.from('changed'),expected),/Shipped/);
  assert.throws(()=>verifyOutput('unknown',bytes,bytes),/Unknown/);
});
test('JBIG2 rejects altered source archives before extraction or Docker',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecia-jbig2-test-'));
  try{
    await mkdir(join(root,'build/pdfjs-nested-source'),{recursive:true});
    await writeFile(join(root,'build/pdfjs-nested-source/jbig2-wrapper.tar.gz'),'tampered');
    await assert.rejects(rebuild(root),/Archive differs: jbig2-wrapper/);
  }finally{await rm(root,{recursive:true,force:true});}
});
