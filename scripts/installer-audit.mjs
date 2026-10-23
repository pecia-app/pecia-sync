// Engineering evidence only. This script does not publish or approve a release.
import {bundleInventory,verifySourceInstallerEvidence} from './source-installer-evidence.mjs';
import {createReadStream} from 'node:fs';
import {readdir,lstat,mkdir,writeFile,cp,readFile} from 'node:fs/promises';
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
const files=await bundleInventory(bundle);
let sourceBuild;
if(process.env.PECIA_REQUIRE_SOURCE_BUILD==='1'){
  sourceBuild=JSON.parse(await readFile('build/source/source-verification.json','utf8'));
  const revision=command('git',['rev-parse','HEAD']);
  const sourceArchive=`pecia-sync-source-${revision}.tar.gz`;
  const digest=await sha256(resolve('build/source',sourceArchive));
  verifySourceInstallerEvidence(sourceBuild,{revision,sourceSha256:digest,platform:process.platform,architecture:process.arch,files});
  sourceBuild={archive:sourceArchive,sha256:digest,verification:'source-verification.json',fromExtractedSource:true};
}
await mkdir(output,{recursive:true});
const archive=join(output,'installer-bundles.tar.gz');
// Tar preserves macOS app symlinks/modes through GitHub's ZIP artifact wrapper.
execFileSync('tar',['-czf',archive,'-C',bundle,'.']);
await cp('build/licenses',join(output,'licenses'),{recursive:true});
if(process.platform==='win32'){
  // useLocalToolsDir makes the actual WiX/NSIS inputs discoverable without
  // guessing a user's cache path. Retain them as audit inputs, not release assets.
  const tools=resolve('src-tauri/target/.tauri');
  const toolFiles=[];
  async function inspectTools(dir,prefix=''){
    for(const name of (await readdir(dir)).sort()){
      const path=join(dir,name),info=await lstat(path);
      if(info.isSymbolicLink())throw Error(`Unexpected tool-cache symlink: ${path}`);
      if(info.isDirectory())await inspectTools(path,prefix+name+'/');
      else if(info.isFile())toolFiles.push({path:prefix+name,size:info.size,sha256:await sha256(path)});
    }
  }
  await inspectTools(tools);
  if(!toolFiles.some(file=>/nsis_tauri_utils\.dll$/i.test(file.path)))throw Error('Missing NSIS tool provenance');
  const toolsArchive=join(output,'windows-bundler-tools.tar.gz');
  execFileSync('tar',['-czf',toolsArchive,'-C',tools,'.']);
  await writeFile(join(output,'windows-bundler-tools.json'),JSON.stringify({
    scope:'Actual cached bundler inputs; not source completeness, payload mapping, or licensing approval.',
    revision:command('git',['rev-parse','HEAD']),
    archiveSha256:await sha256(toolsArchive),files:toolFiles,
  },null,2)+'\n');
}
if(process.platform==='linux'){
  // Preserve the build host package/source versions, not merely library filenames.
  // This is an over-inclusive evidence inventory, not a bundled-library mapping.
  const format='${binary:Package}\t${Version}\t${Architecture}\t${source:Package}\t${source:Version}\n';
  await writeFile(join(output,'linux-installed-packages.tsv'),execFileSync('dpkg-query',['-W',`-f=${format}`],{encoding:'utf8',maxBuffer:16*1024*1024}));
  await cp('/usr/share/common-licenses',join(output,'linux-common-licenses'),{recursive:true});
}
if(sourceBuild)await cp('build/source/source-verification.json',join(output,'source-verification.json'));
const report={sourceBuild,purpose:'Non-publishing audit; not licensed for release by this report',revision:command('git',['rev-parse','HEAD']),runId:process.env.GITHUB_RUN_ID??null,platform:process.platform,architecture:process.arch,node:process.version,rust:command('rustc',['--version']),cargo:command('cargo',['--version']),archive:{file:'installer-bundles.tar.gz',sha256:await sha256(archive)},files};
await writeFile(join(output,'inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Recorded ${files.length} bundle entries for ${report.revision}. Installer payload extraction/review remains required.`);
