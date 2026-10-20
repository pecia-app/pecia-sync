// Reproduction evidence only: not historical provenance or licensing approval.
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,cp,writeFile,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const prepared=join(root,'build/qcms-source');
const hash=b=>createHash('sha256').update(b).digest('hex');
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024});
const expected='663d86126d5f5fcb1c61490f94353e2a8375660b8c5498ab3ebab5a34b08800e';
const lock=await readFile(join(root,'release/qcms-experiment/Cargo.lock'));
if(process.argv.includes('--prepare')){
  const archive=join(root,'build/pdfjs-nested-source/qcms-wrapper.tar.gz');
  assert.equal(hash(await readFile(archive)),'c0ca3cb21a8411009138e51992553de26c8df22ee10392e189d5dc9d91e3b27c');
  const scratch=await mkdtemp(join(tmpdir(),'pecia-qcms-source-'));
  run('tar',['-xzf',archive,'--strip-components=1','-C',scratch]);
  await writeFile(join(scratch,'Cargo.lock'),lock);
  run('cargo',['vendor','--locked','--versioned-dirs','vendor'],scratch);
  await mkdir(join(scratch,'.cargo'),{recursive:true});
  await writeFile(join(scratch,'.cargo/config.toml'),'[source.crates-io]\nreplace-with = "vendored-sources"\n[source.vendored-sources]\ndirectory = "vendor"\n');
  await mkdir(prepared,{recursive:true});
  for(const name of ['Cargo.toml','Cargo.lock','src','js','vendor','.cargo'])await cp(join(scratch,name),join(prepared,name),{recursive:true});
}
assert.deepEqual(await readFile(join(prepared,'Cargo.lock')),lock,'Candidate lockfile differs');
run('cargo',['metadata','--frozen','--offline','--format-version','1'],prepared);
if(process.argv.includes('--rebuild')){
  const scratch=await mkdtemp(join(tmpdir(),'pecia-qcms-verify-'));
  await cp(prepared,scratch,{recursive:true});
  // Fresh container-local target directory; no network or existing target reuse.
  run('docker',['run','--rm','--platform','linux/amd64','--network','none',
    '-v',`${scratch}:/work`,'-e','CARGO_TARGET_DIR=/tmp/qcms-target',
    '-e','RUSTFLAGS=--remap-path-prefix=/work/vendor=/usr/local/cargo/registry/src/index.crates.io-1949cf8c6b5b557f',
    'pecia-qcms-rebuild:verification','sh','-c',
    'cargo build --frozen --release --target wasm32-unknown-unknown && wasm-bindgen --target web --no-typescript --out-name qcms --out-dir output /tmp/qcms-target/wasm32-unknown-unknown/release/qcms_pdf_js.wasm && /opt/binaryen-version_117/bin/wasm-opt output/qcms_bg.wasm -o output/qcms.optimized.wasm -O']);
  const bytes=await readFile(join(scratch,'output/qcms.optimized.wasm'));
  assert.equal(hash(bytes),expected,'QCMS reproduction hash differs');
  assert.deepEqual(bytes,await readFile(join(root,'node_modules/pdfjs-dist/wasm/qcms_bg.wasm')),'Shipped QCMS differs');
  await writeFile(join(prepared,'verification.json'),JSON.stringify({sha256:expected,bytes:bytes.length,network:'none',freshTarget:true,scope:'Exact WASM reproduction; not release approval'},null,2)+'\n');
  console.log(`QCMS exact reproduction passed: ${expected}`);
}else console.log('QCMS vendored dependency metadata verified offline; WASM rebuild not requested.');
