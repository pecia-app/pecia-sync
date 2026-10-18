// Non-publishing evidence. A filename or package-owner guess is not provenance.
import {readFile, readdir, lstat, realpath, writeFile, mkdir} from 'node:fs/promises';
import {join, basename, dirname, relative, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {commonLicenseReferences, verifyCommonLicenses} from './linux-notices.mjs';
import {replayNativeFile} from './linux-native-replay.mjs';
import {collectAssetEvidence} from './linux-asset-evidence.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (cmd, args) => execFileSync(cmd, args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
export function parseOwners(text) {
  return text.split('\n').flatMap(line => {
    const match = line.match(/^([A-Za-z0-9][A-Za-z0-9+.:,-]*): (\/.*)$/);
    return match ? match[1].split(',').map(owner => ({owner, path: match[2]})) : [];
  });
}
export function matchStatus(payloadHash, hostHash) {
  return payloadHash === hostHash ? 'exact-bytes' : 'unverified-different-bytes';
}
async function* walk(root) {
  for (const name of (await readdir(root)).sort()) {
    const path = join(root, name), info = await lstat(path);
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) yield* walk(path);
    else if (info.isFile()) yield path;
  }
}
export async function collectNativeEvidence(appdir, output, command = run, replayTools = null) {
  const records = [], references = new Set(), sourcePackages = new Map(), noticeDirectories = [];
  const assets = await collectAssetEvidence(appdir);
  const assetRecords = new Map(assets.records.map(record => [record.path, record]));
  for await (const path of walk(appdir)) {
    const bytes = await readFile(path), name = relative(appdir, path);
    if (('/' + name).endsWith('/licenses/dependencies/linux-common-licenses/manifest.json')) noticeDirectories.push(dirname(path));
    if (basename(path) === 'copyright') {
      for (const reference of commonLicenseReferences(bytes.toString('utf8'))) references.add(reference);
    }
    const elf = bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
    const record = elf ? {path: name, sha256: hash(bytes)} : assetRecords.get(name.split('\\').join('/'));
    record.candidates = [];
    // linuxdeploy strips and rewrites RPATH. Accept either original exact bytes
    // or a full-byte match after a recorded replay on a private host-file copy.
    let owners = [];
    try { owners = parseOwners(command('dpkg-query', ['-S', `*/${basename(path)}`])); }
    catch (error) { if (error.status !== 1) throw error; }
    const resolvedOwners = [];
    for (const candidate of owners) {
      try {
        if ((await lstat(candidate.path)).isSymbolicLink()) {
          const target = await realpath(candidate.path);
          // A development-package .so symlink does not own the runtime bytes.
          // Resolve its target and ask for that file's actual package owner.
          const targetOwners = parseOwners(command('dpkg-query', ['-S', target]));
          resolvedOwners.push(...targetOwners.filter(owner => owner.path === target).map(owner => ({...owner, viaSymlink: candidate.path})));
        } else resolvedOwners.push(candidate);
      } catch (error) { if (error.code !== 'ENOENT' && error.status !== 1) throw error; }
    }
    for (const candidate of resolvedOwners) {
      let host;
      try { host = await readFile(candidate.path); }
      catch (error) { if (['ENOENT', 'EISDIR'].includes(error.code)) continue; throw error; }
      const hostSha256 = hash(host);
      const fields = command('dpkg-query', ['-W', '-f=${binary:Package}\t${Version}\t${Architecture}\t${source:Package}\t${source:Version}', candidate.owner]).split('\t');
      if (fields.length !== 5 || fields.some(field => !field.trim())) throw Error(`Incomplete package metadata: ${candidate.owner}`);
      const [binaryPackage, binaryVersion, architecture, sourcePackage, sourceVersion] = fields;
      let status = matchStatus(record.sha256, hostSha256), replay;
      if (elf && status !== 'exact-bytes' && replayTools) {
        try {
          replay = await replayNativeFile(candidate.path, path, replayTools);
          if (replay.matched) status = 'exact-replayed-bytes';
        } catch (error) { replay = {matched: false, error: String(error.message).slice(0, 1000)}; }
      }
      const mapping = {...candidate, hostSha256, status, binaryPackage, binaryVersion, architecture, sourcePackage, sourceVersion};
      if (replay) mapping.replay = replay;
      record.candidates.push(mapping);
      if (['exact-bytes', 'exact-replayed-bytes'].includes(status)) sourcePackages.set(`${sourcePackage}=${sourceVersion}`, {sourcePackage, sourceVersion});
    }
    record.status = record.candidates.some(candidate => ['exact-bytes', 'exact-replayed-bytes'].includes(candidate.status)) ? 'verified-package-match' : 'unresolved';
    if (elf) records.push(record);
  }
  if (!records.length) throw Error('No ELF payloads found in AppDir');
  if (noticeDirectories.length !== 1) throw Error(`Expected one packaged common-license directory, found ${noticeDirectories.length}`);
  const texts = await verifyCommonLicenses(noticeDirectories[0]);
  const missingLicenseReferences = [...references].sort().filter(name => !texts.has(name));
  const report = {
    scope: 'AppDir ELF records plus a non-ELF asset/link inventory. Regular files are mapped by exact package bytes; ELF transformations may be replayed. Not the outer runtime or complete corresponding source. Symlinks are not followed in the payload.',
    revision: command('git', ['rev-parse', 'HEAD']).trim(),
    missingLicenseReferences,
    assets,
    unresolvedAssets: assets.records.filter(record => record.status !== 'verified-package-match').map(record => record.path),
    sourceRequests: [...sourcePackages.values()].sort((a, b) => a.sourcePackage.localeCompare(b.sourcePackage)),
    unresolved: records.filter(record => record.status === 'unresolved').map(record => record.path),
    records,
  };
  await mkdir(output, {recursive: true});
  await writeFile(join(output, 'linux-native-provenance.json'), JSON.stringify(report, null, 2) + '\n');
  if (missingLicenseReferences.length) throw Error(`Missing referenced license texts: ${missingLicenseReferences.join(', ')}`);
  console.log(`${records.length} ELF files inspected; ${report.unresolved.length} unresolved. Source requests are not collected source or release approval.`);
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'linux') throw Error('Native provenance capture must run on the Linux build host');
  const base = resolve('src-tauri/target/release/bundle/appimage');
  const dirs = (await readdir(base, {withFileTypes: true})).filter(entry => entry.isDirectory() && entry.name.endsWith('.AppDir'));
  if (dirs.length !== 1) throw Error(`Expected exactly one AppDir; found ${dirs.length}`);
  const toolsRoot = process.env.PECIA_REPLAY_TOOLS;
  if (!toolsRoot) throw Error('PECIA_REPLAY_TOOLS must identify the retained linuxdeploy tool directory');
  const tools = {strip: resolve(toolsRoot, 'strip'), patchelf: resolve(toolsRoot, 'patchelf')};
  await collectNativeEvidence(join(base, dirs[0].name), resolve('build/installer-audit'), run, tools);
}
