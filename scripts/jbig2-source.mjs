// Exact reproduction evidence, not historical provenance or release approval.
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

export const image='emscripten/emsdk@sha256:96617f27fe16421588241def73908fd348a7f9d260440ed0d00b36dcf7a063cc';
export const outputs={
  'jbig2.wasm':'466f45c2a61a698152fb5400c27e56ff2ceb73dcb71fde3fc366a502308eaab0',
  'jbig2_nowasm_fallback.js':'68686ced624a48c42f84cdaa482ec44b72b0de4dc84a0df903af1fb7b45b5d9a',
};
const hash=b=>createHash('sha256').update(b).digest('hex');
export function verifyOutput(name,built,shipped,expected=outputs[name]){
  assert.ok(expected,'Unknown JBIG2 output');
  assert.equal(hash(built),expected,`Rebuilt ${name} hash differs`);
  assert.deepEqual(built,shipped,`Shipped ${name} differs`);
  return {name,sha256:expected,bytes:built.length};
}
export async function rebuild(root=resolve(import.meta.dirname,'..')){
  const archives=[
    ['jbig2-wrapper.tar.gz','wrapper','20c52262116a471608e083bb21ac31591a1f953690d88928c0424bd715bcc0a7'],
    ['pdfium-source.tar.gz','pdfium','58098e1d4c63647c7bd8292b5f204bd0b633f8f4c9d4db6bc372445397371342'],
  ];
  // Verify all inputs before extracting or invoking upstream build scripts.
  for(const [file,,expected] of archives)assert.equal(hash(await readFile(join(root,'build/pdfjs-nested-source',file))),expected,`Archive differs: ${file}`);
  const scratch=await mkdtemp(join(tmpdir(),'pecia-jbig2-verify-'));
  for(const [file,dir] of archives){
    await mkdir(join(scratch,dir));
    execFileSync('tar',['-xf',join(root,'build/pdfjs-nested-source',file),'--strip-components=1','-C',join(scratch,dir)]);
  }
  await mkdir(join(scratch,'output'));
  execFileSync('docker',['run','--rm','--pull=never','--platform','linux/amd64','--network','none',
    '-v',`${join(scratch,'pdfium')}:/tmp/pdfium:ro`,
    '-v',`${join(scratch,'wrapper')}:/code:ro`,
    '-v',`${join(scratch,'output')}:/js`,
    '-w','/code','-e','PDFIUM=/tmp/pdfium','-e','INPUT=/code/src','-e','OUTPUT=/js',
    image,'sh','-c','BUILD_TYPE=wasm sh /code/compile.sh && BUILD_TYPE=js sh /code/compile.sh'],
    {stdio:'inherit'});
  const results=[];
  for(const name of Object.keys(outputs))results.push(verifyOutput(name,await readFile(join(scratch,'output',name)),await readFile(join(root,'node_modules/pdfjs-dist/wasm',name))));
  console.log('JBIG2 WASM and JavaScript fallback match exactly.');
  return {image,network:'none',freshSources:true,results,scope:'Exact reproduction; not release approval'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await rebuild();
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
}
