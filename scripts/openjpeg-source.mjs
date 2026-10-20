// Exact reproduction evidence, not historical provenance or release approval.
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

export const image='emscripten/emsdk@sha256:e077d54e2b8970575ebc4f185ac1de0b95c05f2b266134d4ba27449af7aebf65';
export const outputs={
  'openjpeg.wasm':'95e5002597af0824004aa57b1900fe019715db389e37640b1e58395e42f00cc5',
  'openjpeg_nowasm_fallback.js':'9047b34b6bc142d85e4b0aa1b08b0b9baad4c6f8b7ac87641b9e8f90eb6fd23e',
};
const hash=b=>createHash('sha256').update(b).digest('hex');
export function verifyOutput(name,built,shipped,expected=outputs[name]){
  assert.ok(expected,'Unknown OpenJPEG output');
  assert.equal(hash(built),expected,`Rebuilt ${name} hash differs`);
  assert.deepEqual(built,shipped,`Shipped ${name} differs`);
  return {name,sha256:expected,bytes:built.length};
}
export async function rebuild(root=resolve(import.meta.dirname,'..')){
  const archives=[
    ['openjpeg-wrapper.tar.gz','wrapper','e51b1257ae3ff914ec6cb0b6abb459ba0b138166b401692b4df24156763c7b6b'],
    ['openjpeg-source.tar.gz','openjpeg','e723e8babb2188e8743308842bb1bfc9809f0375cd964cfeac2fb17285094321'],
  ];
  // Verify all inputs before extracting or invoking build scripts.
  for(const [file,,expected] of archives)assert.equal(hash(await readFile(join(root,'build/pdfjs-nested-source',file))),expected,`Archive differs: ${file}`);
  const scratch=await mkdtemp(join(tmpdir(),'pecia-openjpeg-verify-'));
  for(const [file,dir] of archives){
    await mkdir(join(scratch,dir));
    execFileSync('tar',['-xzf',join(root,'build/pdfjs-nested-source',file),'--strip-components=1','-C',join(scratch,dir)]);
  }
  await mkdir(join(scratch,'output'));
  execFileSync('docker',['run','--rm','--pull=never','--platform','linux/amd64','--network','none',
    '-v',`${join(scratch,'openjpeg')}:/tmp/openjpeg`,
    '-v',`${join(scratch,'wrapper')}:/code:ro`,
    '-v',`${join(scratch,'output')}:/js`,
    '-e','OPENJPEG=/tmp/openjpeg','-e','INPUT=/code/src','-e','OUTPUT=/js',
    image,'sh','-c',
    'cd /tmp/openjpeg && patch -p1 < /code/0001-Add-support-for-buffer-based-stream-see-https-github.patch && BUILD_TYPE=wasm sh /code/compile_lib.sh && BUILD_TYPE=wasm sh /code/compile.sh && BUILD_TYPE=js sh /code/compile_lib.sh && BUILD_TYPE=js sh /code/compile.sh'],
    {stdio:'inherit'});
  const results=[];
  for(const name of Object.keys(outputs))results.push(verifyOutput(name,await readFile(join(scratch,'output',name)),await readFile(join(root,'node_modules/pdfjs-dist/wasm',name))));
  console.log('OpenJPEG WASM and JavaScript fallback match exactly.');
  return {image,network:'none',freshSources:true,results,scope:'Exact reproduction; not release approval'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await rebuild();
  const destination=process.argv[2];
  if(destination)await writeFile(destination,JSON.stringify(report,null,2)+'\n');
}
