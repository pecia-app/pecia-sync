import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const safe = value => typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_.+-]*$/.test(value) && !value.includes('..');
export function validateRuntimeManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !manifest.records?.length) throw Error('Invalid runtime source manifest');
  const names = new Set();
  for (const record of manifest.records) {
    if (!safe(record.name) || !safe(record.version) || names.has(record.name)) throw Error('Invalid or duplicate runtime package');
    names.add(record.name);
    if (![record.runtimeRevision, record.sourceRevision, record.recipeRevision].every(value => /^[a-f0-9]{40}$/.test(value)) || !record.evidence || !record.license) throw Error('Missing runtime provenance');
    if (!record.notice || record.notice.file !== record.notice.sha256 + '.txt') throw Error('Invalid runtime notice');
    if (!Array.isArray(record.files) || !record.files.length) throw Error('Missing runtime sources');
    const files = new Set();
    for (const file of [record.notice, ...record.files]) {
      if (!safe(file.file) || files.has(file.file) || !/^[a-f0-9]{64}$/.test(file.sha256) ||
          (file.sha512 !== undefined && !/^[a-f0-9]{128}$/.test(file.sha512))) throw Error('Invalid runtime file');
      files.add(file.file);
      const url = new URL(file.url);
      if (url.protocol !== 'https:' || !['github.com', 'raw.githubusercontent.com', 'codeload.github.com', 'musl.libc.org', 'zlib.net', 'downloads.sourceforge.net'].includes(url.hostname) || url.username || url.password) throw Error('Invalid runtime source URL');
    }
  }
  return manifest;
}
export async function runtimeNotices(project = root) {
  const manifest = validateRuntimeManifest(JSON.parse(await readFile(join(project, 'release/runtime-source.json'), 'utf8')));
  return Promise.all(manifest.records.map(async record => {
    const bytes = await readFile(join(project, 'LICENSES/third-party', record.notice.file));
    if (hash(bytes) !== record.notice.sha256) throw Error('Runtime notice checksum mismatch');
    return {...record, contents: bytes.toString('utf8')};
  }));
}
export async function downloadRuntimeSource(url, fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const transientCodes = new Set(['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(url, {signal: AbortSignal.timeout(300000)});
      if (!response.ok) {
        await response.body?.cancel();
        const error = Error(`Runtime source download failed: ${response.status} (${url})`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 64 * 1024 * 1024) throw Error('Runtime source size limit');
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      if (attempt === 2 || !(error.retryable || transientCodes.has(error.code) || transientCodes.has(error.cause?.code) || error.name === 'TimeoutError')) throw error;
      console.warn(`Retrying runtime source download (${attempt + 2}/3): ${url}`);
      await pause(1000 * 2 ** attempt);
    }
  }
}
export async function collectRuntimeSource(project = root, offline = false, fetcher = fetch) {
  const records = await runtimeNotices(project);
  for (const record of records) {
    const directory = join(project, 'build/runtime-source', record.name);
    await mkdir(directory, {recursive: true});
    for (const file of record.files) {
      const path = join(directory, file.file);
      let bytes;
      try { bytes = await readFile(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!bytes) {
        if (offline) throw Error(`Missing runtime source: ${file.file}`);
        bytes = await downloadRuntimeSource(file.url, fetcher);
      }
      if (hash(bytes) !== file.sha256 || (file.sha512 && hash(bytes, 'sha512') !== file.sha512)) throw Error(`Runtime source checksum mismatch: ${file.file}`);
      if (!offline) await writeFile(path, bytes);
    }
  }
  return records.length;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Verified ${await collectRuntimeSource(root, process.argv.includes('--offline'))} runtime source packages (partial coverage).`);
}
