import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateReview} from './licensing-review.mjs';
import {isNoticeFile,loadSupplements} from './notice-supplements.mjs';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseArchiveListing,frontendTestArgs} from './source-test-selection.mjs';
test('source test selection is identical for LF and Windows CRLF tar listings',()=>{
  const names=['project/','project/scripts/test-highlights.mjs','project/src/lib/reader.test.ts','project/src/lib/clippings.test.ts','project/node_modules/example/test.ts'];
  for(const delimiter of ['\n','\r\n']){
    const parsed=parseArchiveListing(names.join(delimiter)+delimiter);
    assert.deepEqual(parsed,names);
    assert.deepEqual(frontendTestArgs(parsed),['node_modules/tsx/dist/cli.mjs','--test','src/lib/clippings.test.ts','src/lib/reader.test.ts']);
  }
});
test('source verifier refuses empty test selection instead of enabling auto-discovery',()=>{
  assert.throws(()=>frontendTestArgs([]),/No frontend unit tests/);
  assert.throws(()=>frontendTestArgs(['project/scripts/test-highlights.mjs']),/No frontend unit tests/);
});
test('Git preserves upstream notice bytes with Windows autocrlf enabled',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecia-notice-checkout-'));
  try {
    const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
    git('init');git('config','core.autocrlf','true');
    await copyFile(new URL('../.gitattributes',import.meta.url),join(root,'.gitattributes'));
    await mkdir(join(root,'LICENSES/third-party'),{recursive:true});
    const fixtures=['Upstream notice\nSecond line\n','Upstream notice\r\nSecond line\r\n'];
    for(const [index,contents] of fixtures.entries())await writeFile(join(root,`LICENSES/third-party/${index}.txt`),contents);
    git('add','.gitattributes','LICENSES/third-party');
    for(const index of fixtures.keys())await rm(join(root,`LICENSES/third-party/${index}.txt`));
    git('checkout-index','--all','--force');
    for(const [index,contents] of fixtures.entries())assert.equal(await readFile(join(root,`LICENSES/third-party/${index}.txt`),'utf8'),contents);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('notice names exclude code modules',()=>{
  for(const name of ['LICENSE','LICENSE-MIT','LICENSE.MIT','LICENSE.BSD-3-Clause','LICENSE.spdx','LICENSE-APACHE-2.0','license.txt','COPYING.md','NOTICE'])assert.equal(isNoticeFile(name),true,name);
  for(const name of ['copying.rs','copyright.js','LICENSE.ts','authors.py'])assert.equal(isNoticeFile(name),false,name);
});
test('supplements require matching bytes and immutable provenance',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pecia-notice-test-'));
  await mkdir(join(root,'release'));await mkdir(join(root,'LICENSES/third-party'),{recursive:true});
  const contents='Synthetic license fixture',sha256=createHash('sha256').update(contents).digest('hex');
  const record={id:'cargo/fixture@1.0.0',repository:'https://github.com/example/fixture',revision:'a'.repeat(40),notices:[{file:sha256+'.txt',sha256,url:'https://example.com/LICENSE'}]};
  const save=()=>writeFile(join(root,'release/notice-supplements.json'),JSON.stringify({schemaVersion:1,records:[record]}));
  await save();await writeFile(join(root,'LICENSES/third-party',sha256+'.txt'),contents);
  assert.equal((await loadSupplements(root)).get(record.id).notices[0].contents,contents);
  await writeFile(join(root,'LICENSES/third-party',sha256+'.txt'),'changed');
  await assert.rejects(loadSupplements(root),/checksum/);
  record.revision='main';await save();await assert.rejects(loadSupplements(root),/provenance/);
});
const hashes={'package-lock.json':'test-digest'};
const approved=()=>({status:'approved',reviewedBy:'Reviewer',inputSha256:hashes,evidence:Object.fromEntries(['notices','preferredSource','platformRebuilds','bundledNativeLibraries'].map(key=>[key,'docs/review.md']))});
test('pending review blocks publication',()=>assert.throws(()=>validateReview({status:'pending'},hashes),/pending/));
test('approval requires a named reviewer and all evidence',()=>{
  const review=approved();review.reviewedBy='';assert.throws(()=>validateReview(review,hashes),/pending/);
  for(const key of Object.keys(approved().evidence)){const review=approved();delete review.evidence[key];assert.throws(()=>validateReview(review,hashes),/evidence/);}
});
test('evidence cannot escape the repository docs',()=>{
  const review=approved();review.evidence.notices='docs/../../private';assert.throws(()=>validateReview(review,hashes),/evidence/);
});
test('changed inputs invalidate approval',()=>assert.throws(()=>validateReview(approved(),{'package-lock.json':'changed'}),/stale/));
test('complete matching review passes structural validation',()=>assert.doesNotThrow(()=>validateReview(approved(),hashes)));
