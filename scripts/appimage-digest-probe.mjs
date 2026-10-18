import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Historical evidence probe only, NOT a general AppImage verifier. Models the
// reused 4096-byte buffer of appimagetool 8c8c91f. Its C skipped bytes are not
// explicitly initialized; do not assume this model applies to other builds.
// Usage: node scripts/appimage-digest-probe.mjs retained.AppImage runtime-x86_64
if (process.argv.length !== 4) throw Error('Provide the retained AppImage and upstream runtime paths');
const file = await readFile(process.argv[2]);
assert.equal(createHash('sha256').update(file).digest('hex'),'f67004a393c6c76df3a90f2f97f1a4df052f84c18ce7881e21c04dbff46dc9db','Not the reviewed historical AppImage');
const table = Number(file.readBigUInt64LE(40)), size = file.readUInt16LE(58), count = file.readUInt16LE(60), namesIndex = file.readUInt16LE(62);
const names = Number(file.readBigUInt64LE(table + namesIndex * size + 24));
const sections = [];
for (let i=0;i<count;i++) {
 const p=table+i*size, n=names+file.readUInt32LE(p), name=file.toString('utf8',n,file.indexOf(0,n));
 if (['.digest_md5','.sha256_sig','.sig_key'].includes(name)) sections.push({name,offset:Number(file.readBigUInt64LE(p+24)),length:Number(file.readBigUInt64LE(p+32))});
}
console.log({size:file.length,sections});
const buffer=Buffer.alloc(4096), md5=createHash('md5');
let position=0, skip=0;
for(let remaining=file.length;remaining>0;remaining-=4096) {
 const start=position; let left=4096;
 if(skip>0) { const n=skip%4096===0?4096:skip%4096;left-=n;skip-=n;position+=n; }
 for(const s of sections.sort((a,b)=>['.digest_md5','.sha256_sig','.sig_key'].indexOf(a.name)-['.digest_md5','.sha256_sig','.sig_key'].indexOf(b.name))) {
  if(s.offset && s.length && s.offset-start>0 && s.offset-start<4096) {
   const begin=(s.offset-start)%4096;
   file.copy(buffer,0,position,Math.min(file.length,position+begin)); position+=begin;
   left-=begin+s.length;
   if(left<0){skip=-left;left=0;}
   position+=4096-left-begin;
  }
 }
 if(left>0){const n=Math.min(left,Math.max(0,file.length-position));file.copy(buffer,4096-left,position,position+n);position+=n;}
 md5.update(buffer);
}
const s=sections.find(s=>s.name==='.digest_md5');
const replayed=md5.digest();
assert.deepEqual(replayed,file.subarray(s.offset,s.offset+s.length));
const runtime=await readFile(process.argv[3]);
assert.equal(createHash('sha256').update(runtime).digest('hex'),'156f4bdbde9c52d01814600013e0a273f0118dc2de98975f3c8c63427ec79074');
replayed.copy(runtime,s.offset);
assert.deepEqual(runtime,file.subarray(0,runtime.length));
console.log({stored:replayed.toString('hex'),runtimePrefixBytes:runtime.length,fullPrefixMatch:true});
