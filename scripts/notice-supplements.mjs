import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

export function isNoticeFile(name) {
  // A Rust module named copying.rs is code, not a license document.
  return /^(?:licen[sc]e|copying|copyright|notice|authors)(?:(?:[-_][a-z0-9.-]+)|(?:\.(?:MIT|BSD-[0-9]-Clause|APACHE(?:-2\.0)?)))?(?:\.(?:txt|md|markdown|rst|html|spdx))?$/i.test(name);
}
export async function loadSupplements(root) {
  const manifest=JSON.parse(await readFile(resolve(root,'release/notice-supplements.json'),'utf8'));
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.records))throw Error('Invalid notice supplements schema');
  const result=new Map();
  for(const record of manifest.records) {
    if(!/^(cargo|npm)\/.+@[^@]+$/.test(record.id)||result.has(record.id))throw Error('Invalid or duplicate notice supplement ID');
    if(!/^[a-f0-9]{40}$/.test(record.revision)||!record.repository?.startsWith('https://github.com/'))throw Error(`Missing pinned provenance: ${record.id}`);
    if(!record.notices?.length)throw Error(`Empty notice supplement: ${record.id}`);
    const notices=[];
    for(const notice of record.notices) {
      if(!/^[a-f0-9]{64}\.txt$/.test(notice.file)||notice.file!==notice.sha256+'.txt'||!notice.url?.startsWith('https://'))throw Error(`Invalid notice reference: ${record.id}`);
      const contents=await readFile(resolve(root,'LICENSES/third-party',notice.file),'utf8');
      if(createHash('sha256').update(contents).digest('hex')!==notice.sha256)throw Error(`Notice checksum mismatch: ${record.id}`);
      notices.push({...notice,contents});
    }
    result.set(record.id,{...record,notices});
  }
  return result;
}
