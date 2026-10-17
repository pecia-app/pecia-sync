// Capture facts only; never accept an Xcode agreement or launch the application.
import {execFileSync} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,posix} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function discoverAgreementPaths(root,list){
  const found=[];let visited=0;
  async function walk(dir,depth){
    let entries;
    try{entries=await list(dir);}catch(error){if(error.code==='ENOENT')return;throw error;}
    for(const entry of entries){
      if(++visited>10000)throw Error('Agreement discovery exceeded entry limit');
      const path=posix.join(dir,entry.name);
      if(entry.isSymbolicLink())continue;
      if(entry.isFile()&&/^(?:license|agreement)[^/]*\.(?:rtf|pdf|txt|html|plist)$/i.test(entry.name))found.push(path);
      else if(entry.isDirectory()&&depth<2)await walk(path,depth+1);
    }
  }
  await walk(root,0);return found.sort();
}

export async function collectMacEvidence({run,read,list,env={}}){
  const selectedDeveloper=run('xcode-select',['-p']);
  const developer=env.DEVELOPER_DIR||selectedDeveloper;
  const sdk=run('xcrun',['--sdk','macosx','--show-sdk-path']);
  const result={
    revision:run('git',['rev-parse','HEAD']),
    runId:env.GITHUB_RUN_ID??null,
    imageOS:env.ImageOS??null,imageVersion:env.ImageVersion??null,
    os:run('sw_vers',[]),architecture:run('uname',['-m']),
    selectedDeveloper,effectiveDeveloper:developer,
    overrides:{DEVELOPER_DIR:env.DEVELOPER_DIR??null,SDKROOT:env.SDKROOT??null,MACOSX_DEPLOYMENT_TARGET:env.MACOSX_DEPLOYMENT_TARGET??null},
    xcode:run('xcodebuild',['-version']),
    sdk:{path:sdk,version:run('xcrun',['--sdk','macosx','--show-sdk-version']),build:run('xcrun',['--sdk','macosx','--show-sdk-build-version'])},
    clang:run('xcrun',['--sdk','macosx','clang','--version']),
    normalDependencies:run('cargo',['tree','--locked','--manifest-path','src-tauri/Cargo.toml','--target','aarch64-apple-darwin','-e','normal','--prefix','none']),
    agreement:null,agreementCandidates:[],acceptance:'Not determined: installed text is not evidence of who accepted it or under what contract.'
  };
  const contents=developer.replace(/\/Contents\/Developer\/?$/,'/Contents');
  if(contents!==developer){
    // These are macOS paths even when the collector is tested on Windows.
    const resources=posix.join(contents,'Resources');
    const known=['License.rtf','English.lproj/License.rtf','en.lproj/License.rtf'];
    for(const path of known.map(name=>posix.join(resources,name))){
      try{
        const bytes=await read(path);
        result.agreement={path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
        break;
      }catch(error){if(error.code!=='ENOENT')throw error;}
    }
    if(list)for(const path of await discoverAgreementPaths(resources,list)){
      const bytes=await read(path);
      if(bytes.length>5*1024*1024)throw Error('Agreement candidate exceeds size limit');
      result.agreementCandidates.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
    }
  }
  result.agreementEvidence=result.agreement?'Installed agreement located; maintainer must confirm applicability and acceptance context.':'Missing installed agreement; reviewer packet remains incomplete.';
  return result;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.platform!=='darwin')throw Error('macOS evidence must be captured on the macOS build host');
  const stage=process.argv[2];
  if(!['before','after'].includes(stage))throw Error('Expected before or after');
  const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
  const data=await collectMacEvidence({run,read:readFile,list:path=>readdir(path,{withFileTypes:true}),env:process.env});
  const output=resolve('build/installer-audit');await mkdir(output,{recursive:true});
  if(stage==='after'){
    const before=JSON.parse(await readFile(join(output,'macos-toolchain-before.json'),'utf8'));
    if(JSON.stringify(before)!==JSON.stringify(data))throw Error('macOS toolchain evidence changed during build');
  }
  await writeFile(join(output,`macos-toolchain-${stage}.json`),JSON.stringify(data,null,2)+'\n');
  if(data.agreement)await cp(data.agreement.path,join(output,'macos-installed-agreement.rtf'));
  if(data.agreementCandidates.length){
    const directory=join(output,'macos-agreement-candidates');await mkdir(directory,{recursive:true});
    for(const candidate of data.agreementCandidates)await cp(candidate.path,join(directory,candidate.sha256+posix.extname(candidate.path)));
  }
  console.log(`Captured macOS ${stage}-build facts. ${data.agreementEvidence}`);
}
