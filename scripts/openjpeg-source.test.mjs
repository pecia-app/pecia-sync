import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyOutput} from './openjpeg-source.mjs';
test('OpenJPEG comparison requires both pinned bytes and shipped-byte equality',()=>{
  const bytes=Buffer.from('fixture');
  const expected=createHash('sha256').update(bytes).digest('hex');
  assert.equal(verifyOutput('fixture',bytes,bytes,expected).bytes,7);
  assert.throws(()=>verifyOutput('fixture',Buffer.from('changed'),bytes,expected),/hash differs/);
  assert.throws(()=>verifyOutput('fixture',bytes,Buffer.from('changed'),expected),/Shipped/);
  assert.throws(()=>verifyOutput('unknown',bytes,bytes),/Unknown/);
});
