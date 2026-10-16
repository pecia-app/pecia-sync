import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateReview} from './licensing-review.mjs';
import {isNoticeFile,loadSupplements} from './notice-supplements.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(root,path),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
const inputs=['package.json','package-lock.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','experiments/kfx/Cargo.toml','experiments/kfx/Cargo.lock','src-tauri/tauri.conf.json','src-tauri/tauri.macos.conf.json','scripts/licenses.mjs','scripts/licensing-review.mjs','scripts/source-bundle.mjs','.github/workflows/release.yml'];
const inputSha256=Object.fromEntries(await Promise.all(inputs.map(async path=>[path,hash(await read(path))])));
inputSha256['.gitattributes']=hash(await read('.gitattributes'));
inputSha256['scripts/source-test-selection.mjs']=hash(await read('scripts/source-test-selection.mjs'));
for(const path of ['scripts/notice-supplements.mjs','release/notice-supplements.json','scripts/preferred-source.mjs','release/preferred-source.json','scripts/verify-source.mjs','.github/workflows/source-audit.yml'])inputSha256[path]=hash(await read(path));
const supplements=await loadSupplements(root);
for(const supplement of supplements.values())for(const notice of supplement.notices)inputSha256[`LICENSES/third-party/${notice.file}`]=notice.sha256;
const mode=process.argv[2];
if(mode==='--release') {
  const review=JSON.parse(await read('release/licensing-review.json'));
  validateReview(review,inputSha256);
  for(const key of ['notices','preferredSource','platformRebuilds','bundledNativeLibraries']) {
    const path=review.evidence?.[key];
    if(!(await read(path)).trim())throw Error(`Empty evidence: ${key}`);
  }
  console.log('Licensing release review matches current inputs.');
} else if(mode==='--check') {
  const inventory=JSON.parse(await read('build/licenses/inventory.json'));
  for(const [path,digest] of Object.entries(inputSha256))if(inventory.inputSha256[path]!==digest)throw Error(`Regenerate notices: ${path}`);
  if(!inventory.packages.length)throw Error('Empty dependency inventory');
  if(hash(await read('build/licenses/THIRD-PARTY-NOTICES.txt'))!==inventory.noticesSha256)throw Error('Notices missing or modified');
  const config=JSON.parse(await read('src-tauri/tauri.conf.json'));
  if(config.bundle.license!=='GPL-3.0-or-later')throw Error('Incorrect distribution license');
  for(const path of ['LICENSE','LICENSES/MIT.txt','LICENSES/GPL-3.0-or-later.txt'])if(!(await read(path)).trim())throw Error(`Empty ${path}`);
  console.log(`License resources verified; ${inventory.packages.length} inventory records, ${inventory.warnings.length} items require review.`);
} else {
  const metadata=JSON.parse(execFileSync('cargo',['metadata','--locked','--format-version','1','--manifest-path','src-tauri/Cargo.toml'],{cwd:root,maxBuffer:32*1024*1024,encoding:'utf8'}));
  const records=metadata.packages.map(p=>({ecosystem:'cargo',name:p.name,version:p.version,license:p.license,authors:p.authors,source:p.source??'Pecia Sync source',directory:dirname(p.manifest_path),licenseFile:p.license_file}));
  const lock=JSON.parse(await read('package-lock.json'));
  const warnings=[];
  for(const [path,locked] of Object.entries(lock.packages)) {
    if(!path)continue;
    try {
      const pkg=JSON.parse(await read(`${path}/package.json`));
      if(pkg.version!==locked.version)throw Error(`Version mismatch: ${path}`);
      records.push({ecosystem:'npm',name:pkg.name,version:pkg.version,license:pkg.license,source:locked.resolved??pkg.repository?.url??'unspecified',directory:resolve(root,path)});
    }catch(error) {
      if(error.code==='ENOENT'&&locked.optional){warnings.push(`Optional package not installed on this host: ${path}`);continue;}
      throw error;
    }
  }
  const notices=['Pecia Sync dependency notices','Combined application: GPL-3.0-or-later. Component licenses remain intact.','Inventory includes build dependencies and is not a legal determination.',''];
  const packages=[];
  async function licenseFiles(dir,base=dir) {
    const found=[];
    for(const entry of await readdir(dir,{withFileTypes:true})) {
      if(entry.isSymbolicLink())continue;
      const path=join(dir,entry.name);
      if(entry.isDirectory()&&!['node_modules','target','.git'].includes(entry.name))found.push(...await licenseFiles(path,base));
      else if(entry.isFile()&&isNoticeFile(entry.name))found.push({path,label:relative(base,path)});
    }
    return found;
  }
  for(const record of records.sort((a,b)=>`${a.ecosystem}/${a.name}/${a.version}`.localeCompare(`${b.ecosystem}/${b.name}/${b.version}`))) {
    const {directory,licenseFile,...item}=record;
    const local=item.source==='Pecia Sync source';
    const files=local?[]:await licenseFiles(directory);
    const supplement=supplements.get(`${item.ecosystem}/${item.name}@${item.version}`);
    if(licenseFile&&!files.some(f=>resolve(f.path)===resolve(directory,licenseFile)))files.push({path:resolve(directory,licenseFile),label:'declared license file'});
    if(!item.license)warnings.push(`Missing license metadata: ${item.ecosystem}/${item.name}@${item.version}`);
    if(!files.length&&!local&&!supplement)warnings.push(`No license/notice text found: ${item.ecosystem}/${item.name}@${item.version}`);
    if(supplement?.reviewRequired)warnings.push(`Upstream legal review required: ${item.ecosystem}/${item.name}@${item.version}: ${supplement.reviewRequired}`);
    notices.push(`\n=== ${item.ecosystem}: ${item.name} ${item.version} ===`, `License: ${item.license??'REVIEW REQUIRED'}`, `Source: ${item.source}`);
    item.noticeFiles=[];
    if(supplement) {
      item.supplementProvenance={repository:supplement.repository,revision:supplement.revision,path:supplement.path,explanation:supplement.provenance,reviewRequired:supplement.reviewRequired};
      for(const notice of supplement.notices) {
        notices.push(`\n--- Upstream supplement: ${notice.url} ---`,notice.contents);
        item.noticeFiles.push({path:`LICENSES/third-party/${notice.file}`,sha256:notice.sha256,url:notice.url});
      }
    }
    for(const file of files.sort((a,b)=>a.label.localeCompare(b.label))) {
      if((await stat(file.path)).size>4*1024*1024)throw Error(`Unexpected notice size: ${item.name}`);
      const contents=await readFile(file.path,'utf8');
      notices.push(`\n--- ${file.label} ---\n${contents}`);
      item.noticeFiles.push({path:file.label,sha256:hash(contents)});
    }
    packages.push(item);
  }
  await mkdir(resolve(root,'build/licenses'),{recursive:true});
  const text=notices.join('\n')+'\n';
  await writeFile(resolve(root,'build/licenses/THIRD-PARTY-NOTICES.txt'),text);
  await writeFile(resolve(root,'build/licenses/inventory.json'),JSON.stringify({inputSha256,noticesSha256:hash(text),packages,warnings},null,2)+'\n');
  console.log(`Generated ${packages.length} dependency records. ${warnings.length} items require review; see build/licenses/inventory.json.`);
}
