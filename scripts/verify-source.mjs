import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readlink,readdir,cp,mkdir,lstat} from 'node:fs/promises';
import {resolve,dirname,basename,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {bundleInventory} from './source-installer-evidence.mjs';
import {parseArchiveListing,frontendTestArgs} from './source-test-selection.mjs';
let input=process.argv[2];
if(!input){
  const archives=(await readdir('build/source')).filter(name=>/^pecia-sync-source-[a-f0-9]{40}\.tar\.gz$/.test(name));
  if(archives.length!==1)throw Error('Specify the source archive when multiple candidates exist');
  input=resolve('build/source',archives[0]);
}
const archive=resolve(input);
if(!/^pecia-sync-source-[a-f0-9]{40}\.tar\.gz$/.test(basename(archive)))throw Error('Expected a generated source archive');
const checksum=(await readFile(resolve(dirname(archive),'SOURCE-SHA256SUMS.txt'),'utf8')).trim();
const digest=createHash('sha256').update(await readFile(archive)).digest('hex');
if(checksum!==`${digest}  ${basename(archive)}`)throw Error('Source archive checksum mismatch');
const names=parseArchiveListing(execFileSync('tar',['-tf',archive],{encoding:'utf8',maxBuffer:64*1024*1024}));
if(names.some(name=>!name.startsWith('project/')||name.split('/').includes('..')))throw Error('Unsafe source archive paths');
const testArgs=frontendTestArgs(names);
const destination=await mkdtemp(resolve(tmpdir(),'pecia-source-verify-'));
execFileSync('tar',['-xf',archive,'-C',destination]);
const project=resolve(destination,'project');
const revision=(await readFile(resolve(project,'SOURCE-REVISION.txt'),'utf8')).split('\n')[0];
if(basename(archive)!==`pecia-sync-source-${revision}.tar.gz`)throw Error('Source revision mismatch');
// Native Windows npm installs use .cmd wrappers rather than POSIX links.
if(process.platform!=='win32')for(const name of ['vite','tsx','tsc'])if(isAbsolute(await readlink(resolve(project,'node_modules/.bin',name))))throw Error('Source contains host-specific dependency links');
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:project,stdio:'inherit',env:{...process.env,CARGO_NET_OFFLINE:'true'}});
console.log(`Verifying extracted source at ${project}`);
run(process.execPath,['scripts/preferred-source.mjs','--offline']);
run(process.execPath,['scripts/runtime-source.mjs','--offline']);
run(process.execPath,['scripts/pdfjs-nested-source.mjs','--offline']);
run(process.execPath,['--test','scripts/pdfjs-nested-source.test.mjs']);
run(process.execPath,['scripts/pdfjs-foxit-probe.mjs']);
run(process.execPath,['--test','scripts/openjpeg-source.test.mjs']);
if(process.env.PECIA_VERIFY_OPENJPEG==='1')run(process.execPath,['scripts/openjpeg-source.mjs',resolve(dirname(archive),'openjpeg-verification.json')]);
run(process.execPath,['--test','scripts/jbig2-source.test.mjs']);
if(process.env.PECIA_VERIFY_JBIG2==='1')run(process.execPath,['scripts/jbig2-source.mjs',resolve(dirname(archive),'jbig2-verification.json')]);
run(process.execPath,['scripts/qcms-source.mjs',...(process.env.PECIA_VERIFY_QCMS==='1'?['--rebuild']:[])]);
run(process.execPath,['scripts/windows-plugin.mjs']);
run(process.execPath,['--test','scripts/runtime-source.test.mjs']);
run(process.execPath,['--test','scripts/apprun-source.test.mjs']);
run(process.execPath,['scripts/licenses.mjs']);
run(process.execPath,['scripts/licenses.mjs','--check']);
// Invoke Node entry points directly; this also works without shell-specific npm wrappers.
run(process.execPath,['--test','scripts/licensing.test.mjs']);
run(process.execPath,testArgs);
run(process.execPath,['node_modules/typescript/bin/tsc']);
run(process.execPath,['node_modules/vite/bin/vite.js','build']);
// Reuse the release profile for packaging instead of retaining a second debug tree.
run('cargo',['test',...(process.env.PECIA_PACKAGE_SOURCE==='1'?['--release']:[]),'--locked','--offline','--manifest-path','src-tauri/Cargo.toml']);
const report={schemaVersion:1,revision,sha256:digest,platform:process.platform,architecture:process.arch,node:process.version,rust:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),checks:['preferred-source checksums','license resources','licensing tests','frontend tests','TypeScript','Vite build','offline native tests'],extractedTo:project};
if(process.env.PECIA_PACKAGE_SOURCE==='1'){
  const checkout=resolve('.');
  if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==revision)throw Error('Packaging checkout differs from source revision');
  const bundle='src-tauri/target/release/bundle';
  // Refuse stale installers; never overlay a prior candidate's bundle.
  try{await lstat(resolve(checkout,bundle));throw Error('Packaging destination already exists');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  run(process.execPath,['node_modules/@tauri-apps/cli/tauri.js','build']);
  if(process.platform==='win32')run(process.execPath,['scripts/windows-plugin-verify.mjs']);
  report.packaging={fromExtractedSource:true,cargoOffline:true,
    scope:'Built from this extracted archive; native bundler tools may download online. Not bit-for-bit reproducibility or release approval.',
    files:await bundleInventory(resolve(project,bundle))};
  await mkdir(resolve(checkout,'src-tauri/target/release'),{recursive:true});
  await cp(resolve(project,bundle),resolve(checkout,bundle),{recursive:true,dereference:false,verbatimSymlinks:true});
  await cp(resolve(project,'build/licenses'),resolve(checkout,'build/licenses'),{recursive:true});
  if(process.platform==='win32'){
    await cp(resolve(project,'src-tauri/target/.tauri'),resolve(checkout,'src-tauri/target/.tauri'),{recursive:true});
    await cp(resolve(project,'build/installer-audit'),resolve(checkout,'build/installer-audit'),{recursive:true});
  }
}
await writeFile(resolve(dirname(archive),'source-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log('Extracted source verification passed. This is not cross-platform or legal sign-off.');
