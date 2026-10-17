// Engineering evidence only. This script does not publish or approve a release.
import {createReadStream} from 'node:fs';
import {readdir,lstat,readlink,mkdir,writeFile,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const bundle=resolve('src-tauri/target/release/bundle');
const output=resolve('build/installer-audit');
const command=(name,args)=>execFileSync(name,args,{encoding:'utf8'}).trim();
async function sha256(path){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path))hash.update(chunk);
  return hash.digest('hex');
}
const files=[];
async function inventory(dir,prefix=''){
  for(const entry of (await readdir(dir)).sort()){
    const path=join(dir,entry),name=prefix+entry,info=await lstat(path);
    if(info.isSymbolicLink())files.push({path:name,type:'symlink',target:await readlink(path)});
    else if(info.isDirectory())await inventory(path,name+'/');
    else if(info.isFile())files.push({path:name,size:info.size,sha256:await sha256(path)});
    else throw Error(`Unexpected bundle entry: ${name}`);
  }
}
await inventory(bundle);
if(!files.some(file=>/\.(dmg|msi|exe|AppImage|deb|rpm)$/.test(file.path)))throw Error('No installer found');
await mkdir(output,{recursive:true});
const archive=join(output,'installer-bundles.tar.gz');
// Tar preserves macOS app symlinks/modes through GitHub's ZIP artifact wrapper.
execFileSync('tar',['-czf',archive,'-C',bundle,'.']);
await cp('build/licenses',join(output,'licenses'),{recursive:true});
if(process.platform==='linux'){
  // Preserve the build host package/source versions, not merely library filenames.
  // This is an over-inclusive evidence inventory, not a bundled-library mapping.
  const format='${binary:Package}\t${Version}\t${Architecture}\t${source:Package}\t${source:Version}\n';
  await writeFile(join(output,'linux-installed-packages.tsv'),execFileSync('dpkg-query',['-W',`-f=${format}`],{encoding:'utf8',maxBuffer:16*1024*1024}));
  await cp('/usr/share/common-licenses',join(output,'linux-common-licenses'),{recursive:true});
}
const report={purpose:'Non-publishing audit; not licensed for release by this report',revision:command('git',['rev-parse','HEAD']),runId:process.env.GITHUB_RUN_ID??null,platform:process.platform,architecture:process.arch,node:process.version,rust:command('rustc',['--version']),cargo:command('cargo',['--version']),archive:{file:'installer-bundles.tar.gz',sha256:await sha256(archive)},files};
await writeFile(join(output,'inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Recorded ${files.length} bundle entries for ${report.revision}. Installer payload extraction/review remains required.`);
