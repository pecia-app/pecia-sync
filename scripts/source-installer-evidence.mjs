import {createReadStream} from 'node:fs';
import {readdir,lstat,readlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export async function sha256File(path){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path))hash.update(chunk);
  return hash.digest('hex');
}
export async function bundleInventory(directory){
  const files=[];
  async function walk(dir,prefix=''){
    for(const entry of (await readdir(dir)).sort()){
      const path=join(dir,entry),name=prefix+entry,info=await lstat(path);
      if(info.isSymbolicLink())files.push({path:name,type:'symlink',target:await readlink(path)});
      else if(info.isDirectory())await walk(path,name+'/');
      else if(info.isFile())files.push({path:name,size:info.size,sha256:await sha256File(path)});
      else throw Error(`Unexpected bundle entry: ${name}`);
    }
  }
  await walk(directory);
  assert.ok(files.some(file=>/\.(dmg|msi|exe|AppImage|deb|rpm)$/.test(file.path)&&file.sha256),'No installer found');
  return files;
}
export function verifySourceInstallerEvidence(report,{revision,sourceSha256,platform,architecture,files}){
  assert.equal(report.schemaVersion,1,'Unknown source build evidence schema');
  assert.equal(report.revision,revision,'Source build revision mismatch');
  assert.equal(report.sha256,sourceSha256,'Source archive differs from build evidence');
  assert.equal(report.platform,platform,'Source build platform mismatch');
  assert.equal(report.architecture,architecture,'Source build architecture mismatch');
  assert.equal(report.packaging?.fromExtractedSource,true,'Missing extracted-source packaging evidence');
  assert.ok(files.length,'Empty installer inventory');
  assert.deepEqual(report.packaging.files,files,'Retained bundle differs from extracted-source build');
}
