import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {collectMacEvidence} from './macos-build-evidence.mjs';

test('captures selected toolchain and exact agreement without accepting it',async()=>{
  const calls=[],bytes=Buffer.from('Synthetic agreement');
  const run=(cmd,args)=>{calls.push([cmd,args]);return cmd==='xcode-select'?'/Applications/Xcode.app/Contents/Developer':'fixture';};
  const data=await collectMacEvidence({run,read:async()=>bytes,env:{ImageVersion:'test-image'}});
  assert.equal(data.agreement.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(data.imageVersion,'test-image');
  assert.match(data.acceptance,/Not determined/);
  assert.ok(!calls.some(([,args])=>args.some(arg=>arg.includes('license'))));
  assert.ok(calls.some(([cmd,args])=>cmd==='cargo'&&args.includes('normal')));
});
test('honors developer override and keeps missing agreement explicit',async()=>{
  const paths=[];
  const data=await collectMacEvidence({run:()=>'/Applications/Default.app/Contents/Developer',read:async path=>{paths.push(path);throw Object.assign(Error('missing'),{code:'ENOENT'});},env:{DEVELOPER_DIR:'/Applications/Pinned.app/Contents/Developer',SDKROOT:'/sdk'}});
  assert.equal(data.effectiveDeveloper,'/Applications/Pinned.app/Contents/Developer');
  assert.equal(data.overrides.SDKROOT,'/sdk');
  assert.ok(paths.every(path=>path.startsWith('/Applications/Pinned.app/')));
  assert.equal(data.agreement,null);
  assert.match(data.agreementEvidence,/incomplete/);
});
