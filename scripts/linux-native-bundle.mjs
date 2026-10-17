// Supplementary source delivery, not a declaration of complete source coverage.
import {readFile, writeFile, mkdir, readdir, lstat, cp, mkdtemp, rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sourceRequestArgument, verifySourceDirectory} from './linux-native-source.mjs';

async function hash(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
async function regularTree(path) {
  const info = await lstat(path);
  if (info.isDirectory()) {
    for (const name of await readdir(path)) await regularTree(join(path, name));
  } else if (!info.isFile()) throw Error('Source tree contains a symlink or special file');
}
export async function verifyCollection(root, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw Error('Invalid revision');
  const report = JSON.parse(await readFile(join(root, 'linux-native-source.json'), 'utf8'));
  const provenance = JSON.parse(await readFile(join(root, 'linux-native-provenance.json'), 'utf8'));
  if (report.revision !== revision || provenance.revision !== revision) throw Error('Native source revision mismatch');
  if (!Array.isArray(report.failures) || report.failures.length || !report.collected?.length) throw Error('Incomplete source collection');
  if (!Array.isArray(provenance.missingLicenseReferences) || provenance.missingLicenseReferences.length) throw Error('Missing native license references');
  const requested = provenance.sourceRequests.map(sourceRequestArgument).sort();
  const collected = report.collected.map(sourceRequestArgument).sort();
  if (new Set(collected).size !== collected.length || JSON.stringify(requested) !== JSON.stringify(collected)) throw Error('Source request coverage mismatch');
  const directories = new Set();
  if (!(await lstat(join(root, 'native-source'))).isDirectory()) throw Error('Source parent must be a real directory');
  for (const item of report.collected) {
    if (!/^native-source\/[A-Za-z0-9][A-Za-z0-9.+_-]*$/.test(item.directory) || item.directory.includes('..') || directories.has(item.directory)) throw Error('Unsafe or duplicate source directory');
    directories.add(item.directory);
    const directory = join(root, item.directory);
    await regularTree(directory);
    const verified = await verifySourceDirectory(directory, item);
    if (verified.descriptorSha256 !== item.descriptorSha256 ||
        verified.descriptor !== item.descriptor || JSON.stringify(verified.files) !== JSON.stringify(item.files)) throw Error('Source evidence checksum mismatch');
  }
  return {report, provenance};
}
export async function bundleNativeSource(root, bundleDirectory, output, revision) {
  const {report} = await verifyCollection(root, revision);
  const names = (await readdir(bundleDirectory)).filter(name => name.endsWith('.AppImage')).sort();
  if (names.length !== 1) throw Error('Expected one matching AppImage');
  const installerPath = join(bundleDirectory, names[0]);
  if (!(await lstat(installerPath)).isFile()) throw Error('AppImage must be a regular file');
  const installer = {file: names[0], sha256: await hash(installerPath)};
  const temp = await mkdtemp(join(tmpdir(), 'pecia-native-bundle-'));
  try {
    const staging = join(temp, 'native-source');
    await mkdir(staging);
    for (const item of report.collected) await cp(join(root, item.directory), join(staging, item.directory), {recursive: true});
    for (const file of ['linux-native-source.json', 'linux-native-provenance.json']) await cp(join(root, file), join(staging, file));
    // Recheck the bytes actually staged, not merely the original download tree.
    await verifyCollection(staging, revision);
    await writeFile(join(staging, 'SOURCE-REVISION.txt'), revision + '\n');
    await writeFile(join(staging, 'INSTALLER.json'), JSON.stringify({revision, installer}, null, 2) + '\n');
    await writeFile(join(staging, 'README.txt'), `Pecia Sync Linux native source supplement\nRevision: ${revision}\n\nThis archive accompanies the AppImage identified by INSTALLER.json.\nIt supplements, rather than replaces, the application source archive.\nEach native-source/ directory contains an exact Ubuntu source package (.dsc,\noriginal archives and distro patches). The JSON reports record payload hashes,\npackage versions, replay operations and unresolved files.\n\nOn Ubuntu with dpkg-dev installed, extract a package using:\n  dpkg-source -x native-source/<package-directory>/<package>.dsc\nRead its debian/control, debian/rules, debian/copyright and upstream build\ninstructions. Install its documented build dependencies before rebuilding\n(e.g. dpkg-buildpackage -b -uc -us in the extracted directory). These are\nper-package instructions, not a claim of bit-for-bit AppImage reproducibility.\n\nScope: verified distro-library mappings only. AppRun, the outer AppImage\nruntime, application source, scripts and other nested assets require separate\ncoverage. Unresolved entries are not waived by creating this archive.\n`);
    await mkdir(output, {recursive: true});
    const filename = `pecia-sync-native-source-${revision}.tar.gz`;
    execFileSync('tar', ['-czf', join(output, filename), '-C', temp, 'native-source']);
    await writeFile(join(output, 'NATIVE-SOURCE-SHA256SUMS.txt'), `${await hash(join(output, filename))}  ${filename}\n`);
    return {filename, installer, packages: report.collected.length};
  } finally { await rm(temp, {recursive: true, force: true}); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  console.log(await bundleNativeSource(resolve('build/installer-audit'), resolve('src-tauri/target/release/bundle/appimage'), resolve('build/native-source'), revision));
}
