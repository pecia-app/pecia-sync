import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(resolve(root,'release/preferred-source.json'),'utf8'));
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const lock=JSON.parse(await readFile(resolve(root,'package-lock.json'),'utf8'));
if(manifest.schemaVersion!==1)throw Error('Invalid preferred-source manifest');
const seen=new Set();await mkdir(resolve(root,'build/preferred-source'),{recursive:true});
for(const record of manifest.records){
  if(seen.has(record.name)||!pkg.dependencies[record.name])throw Error('Duplicate or unexpected source package');
  seen.add(record.name);
  if(lock.packages[`node_modules/${record.name}`]?.version!==record.version)throw Error(`Source version mismatch: ${record.name}`);
  if(!/^[a-f0-9]{40}$/.test(record.revision)||!/^[-\w]+\/[-\w.]+$/.test(record.repo)||!record.evidence)throw Error('Unpinned source record');
  if(record.url!==`https://codeload.github.com/${record.repo}/tar.gz/${record.revision}`||record.filename!==record.repo.replace('/','-')+'-'+record.revision+'.tar.gz'||!/^[a-f0-9]{64}$/.test(record.sha256))throw Error('Invalid source URL, path or checksum');
  const path=resolve(root,'build/preferred-source',record.filename);
  let bytes;
  try{bytes=await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!bytes){
    if(process.argv.includes('--offline'))throw Error(`Missing source archive: ${record.name}`);
    const response=await fetch(record.url,{signal:AbortSignal.timeout(300000)});
    if(!response.ok)throw Error(`Source fetch failed: ${record.name}: ${response.status}`);
    const chunks=[];let total=0;
    for await(const chunk of response.body){total+=chunk.length;if(total>256*1024*1024)throw Error('Source archive size limit');chunks.push(chunk);}
    bytes=Buffer.concat(chunks);
  }
  if(createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw Error(`Source checksum mismatch: ${record.name}`);
  await writeFile(path,bytes);
  console.log(`Verified preferred source: ${record.name}@${record.version}`);
}
for(const name of Object.keys(pkg.dependencies))if(!seen.has(name))throw Error(`Missing preferred source: ${name}`);
