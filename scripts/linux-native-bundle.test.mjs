import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifySourceDirectory} from './linux-native-source.mjs';
import {verifyCollection, bundleNativeSource} from './linux-native-bundle.mjs';
const revision = 'a'.repeat(40);
async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'pecia-native-delivery-test-'));
  try {
    const directory = 'native-source/fixture-123', path = join(root, directory);
    await mkdir(path, {recursive: true});
    const bytes = Buffer.from('source'), sha = createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(path, 'fixture.tar.xz'), bytes);
    await writeFile(join(path, 'fixture.dsc'), `Source: fixture\nVersion: 1.0\nChecksums-Sha256:\n ${sha} ${bytes.length} fixture.tar.xz\n`);
    const request = {sourcePackage: 'fixture', sourceVersion: '1.0'};
    const report = {revision, failures: [], collected: [{...request, directory, ...await verifySourceDirectory(path, request)}]};
    const provenance = {revision, sourceRequests: [request], missingLicenseReferences: [], unresolved: ['AppRun.wrapped']};
    const save = async () => {
      await writeFile(join(root, 'linux-native-source.json'), JSON.stringify(report));
      await writeFile(join(root, 'linux-native-provenance.json'), JSON.stringify(provenance));
    };
    await save();
    await fn({root, path, report, provenance, save});
  } finally { await rm(root, {recursive: true, force: true}); }
}
test('native delivery revalidates archives and binds installer bytes', () => fixture(async ({root}) => {
  const bundle = join(root, 'bundle'), output = join(root, 'output');
  await mkdir(bundle);
  await writeFile(join(bundle, 'fixture.AppImage'), 'installer');
  const result = await bundleNativeSource(root, bundle, output, revision);
  assert.equal(result.packages, 1);
  const unpacked = join(root, 'unpacked'); await mkdir(unpacked);
  execFileSync('tar', ['-xzf', join(output, result.filename), '-C', unpacked]);
  const staged = join(unpacked, 'native-source');
  await verifyCollection(staged, revision);
  assert.deepEqual(JSON.parse(await readFile(join(staged, 'INSTALLER.json'), 'utf8')), {revision, installer: result.installer});
  assert.equal(result.installer.sha256, createHash('sha256').update('installer').digest('hex'));
  const archiveHash = createHash('sha256').update(await readFile(join(output, result.filename))).digest('hex');
  assert.equal(await readFile(join(output, 'NATIVE-SOURCE-SHA256SUMS.txt'), 'utf8'), `${archiveHash}  ${result.filename}\n`);
}));
test('rejects stale revisions, failed or missing packages and notice gaps', () => fixture(async ({root, report, provenance, save}) => {
  await assert.rejects(verifyCollection(root, 'b'.repeat(40)), /revision mismatch/);
  report.failures.push({}); await save();
  await assert.rejects(verifyCollection(root, revision), /Incomplete/);
  report.failures = []; provenance.sourceRequests = []; await save();
  await assert.rejects(verifyCollection(root, revision), /coverage mismatch/);
  provenance.missingLicenseReferences = ['GPL-2']; await save();
  await assert.rejects(verifyCollection(root, revision), /license references/);
}));
test('rejects traversal, duplicate package records and modified source bytes', () => fixture(async ({root, path, report, save}) => {
  const item = report.collected[0];
  item.directory = '../outside'; await save();
  await assert.rejects(verifyCollection(root, revision), /Unsafe/);
  item.directory = 'native-source/fixture-123'; report.collected.push({...item}); await save();
  await assert.rejects(verifyCollection(root, revision), /coverage mismatch/);
  report.collected.pop(); await save();
  await writeFile(join(path, 'fixture.tar.xz'), 'tamper');
  await assert.rejects(verifyCollection(root, revision), /checksum mismatch/);
}));
test('rejects source symlinks', {skip: process.platform === 'win32'}, () => fixture(async ({root, path}) => {
  await symlink('fixture.tar.xz', join(path, 'extra'));
  await assert.rejects(verifyCollection(root, revision), /symlink/);
}));
