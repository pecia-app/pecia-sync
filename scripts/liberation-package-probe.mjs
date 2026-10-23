// Read-only binary/source correspondence evidence; does not rebuild or approve fonts.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const binaryHash='efd381517f958b01969343634ffcbdd60056be7779af84c6f53a005090430204';
const originalHash='ad98b7498dc2992f7f0868f79b65ce4a720a3acdb63ab3f1f1cb6881117a5406';
const patchesHash='45ea32aab7eed82061493edbf5ef621d6fd7f074cb79ae45206014913ca5f313';
const bytes=await readFile(process.argv[2]??'');
assert.equal(hash(bytes),binaryHash,'Unexpected Debian package bytes');
assert.equal(bytes.subarray(0,8).toString(),'!<arch>\n');
const members=new Map();
for(let offset=8;offset<bytes.length;){
  const header=bytes.subarray(offset,offset+60);
  assert.equal(header.length,60);assert.equal(header.subarray(58).toString(),'`\n');
  const name=header.subarray(0,16).toString().trim().replace(/\/$/,'');
  const size=Number(header.subarray(48,58).toString().trim());
  assert.ok(Number.isSafeInteger(size)&&size>=0&&offset+60+size<=bytes.length);
  assert.ok(!members.has(name));
  members.set(name,bytes.subarray(offset+60,offset+60+size));offset+=60+size+(size%2);
}
const source=join(root,'build/pdfjs-nested-source/liberation-source.tar.xz');
assert.equal(hash(await readFile(source)),'96938a0437a73e215898e0475a0c00ea9e251547f7e69cd76012163bb16c7375');
const tar=(path,name)=>execFileSync('tar',['-xOf',path,name],{maxBuffer:16*1024*1024});
assert.equal(hash(tar(source,'liberation-fonts-1.07.4-1.src/liberation-fonts-1.07.4.tar.gz')),originalHash);
assert.equal(hash(await readFile(join(root,'build/pdfjs-nested-source/liberation-debian-patches.tar.xz'))),patchesHash);
const descriptor=await readFile(join(root,'release/liberation-source.dsc'),'utf8');
assert.ok(descriptor.includes('Version: 1:1.07.4-11\n'));
assert.ok(descriptor.includes(originalHash+' 2937949 fonts-liberation_1.07.4.orig.tar.gz'));
assert.ok(descriptor.includes(patchesHash+' 17248 fonts-liberation_1.07.4-11.debian.tar.xz'));
const scratch=await mkdtemp(join(tmpdir(),'pecia-liberation-probe-'));
try{
  for(const name of ['control.tar.xz','data.tar.xz']){
    assert.ok(members.has(name),`Missing ${name}`);
    await writeFile(join(scratch,name),members.get(name));
  }
  const control=tar(join(scratch,'control.tar.xz'),'./control').toString();
  assert.ok(control.includes('Package: fonts-liberation\n'));
  assert.ok(control.includes('Version: 1:1.07.4-11\n'));
  const fonts=[];
  for(const style of ['Regular','Bold','Italic','BoldItalic']){
    const name=`LiberationSans-${style}.ttf`;
    const font=tar(join(scratch,'data.tar.xz'),'./usr/share/fonts/truetype/liberation/'+name);
    assert.deepEqual(font,await readFile(join(root,'node_modules/pdfjs-dist/standard_fonts',name)),`${name} differs`);
    fonts.push({name,sha256:hash(font),bytes:font.length});
  }
  const report={package:'fonts-liberation',version:'1:1.07.4-11',binarySha256:binaryHash,originalSourceSha256:originalHash,debianPatchesSha256:patchesHash,fonts,scope:'Exact Debian package bytes and declared source mapping; not a font rebuild or verification of the descriptor PGP signature.'};
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await rm(scratch,{recursive:true,force:true});}
