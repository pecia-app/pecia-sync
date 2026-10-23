// Collect source candidates, not a certification of matching generated binaries.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateNestedSources(manifest) {
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.records)||!manifest.records.length)throw Error('Invalid nested sources');
  const names=new Set(),files=new Set();
  for(const item of manifest.records){
    if(!/^[a-z][a-z0-9-]*$/.test(item.name)||names.has(item.name)||!/^[-a-z0-9]+\.tar\.(gz|xz)$/.test(item.file)||files.has(item.file)||!/^[a-f0-9]{64}$/.test(item.sha256)||!item.evidence)throw Error('Invalid nested source record');
    const url=new URL(item.url);
    if(url.protocol!=='https:'||url.username||url.password||!['codeload.github.com','pdfium.googlesource.com','www.sourceware.org','static.crates.io','deb.debian.org'].includes(url.hostname))throw Error('Invalid nested source URL');
    names.add(item.name);files.add(item.file);
  }
  return manifest;
}
export async function collectNestedSources(project=root,offline=false,fetcher=fetch){
  const manifest=validateNestedSources(JSON.parse(await readFile(join(project,'release/pdfjs-nested-source.json'),'utf8')));
  const output=join(project,'build/pdfjs-nested-source');await mkdir(output,{recursive:true});
  for(const item of manifest.records){
    const path=join(output,item.file);let bytes;
    try{bytes=await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!bytes){
      if(offline)throw Error(`Missing nested source: ${item.name}`);
      const response=await fetcher(item.url,{signal:AbortSignal.timeout(300000)});
      if(!response.ok)throw Error(`Nested source download failed: ${response.status}`);
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;if(size>64*1024*1024)throw Error('Nested source size limit');chunks.push(chunk);}
      bytes=Buffer.concat(chunks);
    }
    if(hash(bytes)!==item.sha256)throw Error(`Nested source checksum mismatch: ${item.name}`);
    if(!offline)await writeFile(path,bytes);
  }
  return manifest.records.length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(`Verified ${await collectNestedSources(root,process.argv.includes('--offline'))} nested source candidates (partial coverage).`);
