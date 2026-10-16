import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readlink,readdir} from 'node:fs/promises';
import {resolve,dirname,basename,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
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
const names=execFileSync('tar',['-tf',archive],{encoding:'utf8',maxBuffer:64*1024*1024}).split('\n').filter(Boolean);
if(names.some(name=>!name.startsWith('project/')||name.split('/').includes('..')))throw Error('Unsafe source archive paths');
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
run(process.execPath,['scripts/licenses.mjs']);
run(process.execPath,['scripts/licenses.mjs','--check']);
// Invoke Node entry points directly; this also works without shell-specific npm wrappers.
run(process.execPath,['--test','scripts/licensing.test.mjs']);
run(process.execPath,['node_modules/tsx/dist/cli.mjs','--test',...names.filter(name=>/^project\/src\/lib\/[^/]+\.test\.ts$/.test(name)).map(name=>name.slice(8))]);
run(process.execPath,['node_modules/typescript/bin/tsc']);
run(process.execPath,['node_modules/vite/bin/vite.js','build']);
run('cargo',['test','--locked','--offline','--manifest-path','src-tauri/Cargo.toml']);
await writeFile(resolve(dirname(archive),'source-verification.json'),JSON.stringify({revision,sha256:digest,platform:process.platform,architecture:process.arch,node:process.version,rust:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),checks:['preferred-source checksums','license resources','licensing tests','frontend tests','TypeScript','Vite build','offline native tests'],extractedTo:project},null,2)+'\n');
console.log('Extracted source verification passed. This is not cross-platform or legal sign-off.');
