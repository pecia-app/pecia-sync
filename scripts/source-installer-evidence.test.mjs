import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bundleInventory,sha256File,verifySourceInstallerEvidence} from './source-installer-evidence.mjs';

test('source build correspondence rejects changed installers, revisions, source hashes and platform',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecia-source-installer-'));
  try{
    await writeFile(join(dir,'candidate.dmg'),'installer bytes');
    const files=await bundleInventory(dir);
    const expected={revision:'a'.repeat(40),sourceSha256:'b'.repeat(64),platform:'darwin',architecture:'arm64',files};
    const report={schemaVersion:1,revision:expected.revision,sha256:expected.sourceSha256,platform:expected.platform,architecture:expected.architecture,packaging:{fromExtractedSource:true,files}};
    verifySourceInstallerEvidence(report,expected);
    for(const [field,value] of [['revision','c'.repeat(40)],['sourceSha256','d'.repeat(64)],['platform','win32'],['architecture','x64']])assert.throws(()=>verifySourceInstallerEvidence(report,{...expected,[field]:value}));
    assert.throws(()=>verifySourceInstallerEvidence({...report,packaging:{}},expected),/Missing extracted-source/);
    await writeFile(join(dir,'candidate.dmg'),'tampered installer');
    const changed=await bundleInventory(dir);
    assert.throws(()=>verifySourceInstallerEvidence(report,{...expected,files:changed}),/Retained bundle differs/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('bundle inventory hashes regular files and records symlinks without following them',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecia-bundle-inventory-'));
  try{
    await assert.rejects(bundleInventory(dir),/No installer/);
    await writeFile(join(dir,'candidate.dmg'),'fixture');
    if(process.platform!=='win32')await symlink('missing-target',join(dir,'link'));
    const files=await bundleInventory(dir);
    assert.equal(files[0].sha256,await sha256File(join(dir,'candidate.dmg')));
    if(process.platform!=='win32')assert.deepEqual(files[1],{path:'link',type:'symlink',target:'missing-target'});
  }finally{await rm(dir,{recursive:true,force:true});}
});
