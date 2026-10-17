import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseOwners, matchStatus, collectNativeEvidence} from './linux-native-evidence.mjs';
import {collectCommonLicenses} from './linux-notices.mjs';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('parses multiarch package ownership without splitting its architecture', () => {
  assert.deepEqual(parseOwners('libfoo1:amd64: /usr/lib/x86_64-linux-gnu/libfoo.so.1\n'),
    [{owner: 'libfoo1:amd64', path: '/usr/lib/x86_64-linux-gnu/libfoo.so.1'}]);
  assert.deepEqual(parseOwners('diversion by other-package from: /usr/lib/libfoo.so\n'), []);
});
test('same filename or modified bytes are not treated as a verified mapping', () => {
  assert.equal(matchStatus('a', 'b'), 'unverified-different-bytes');
  assert.equal(matchStatus('a', 'a'), 'exact-bytes');
});

test('collector records exact source versions, keeps changed files unresolved, and checks packaged texts', {skip: process.platform === 'win32'}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-native-test-'));
  try {
    const appdir = join(root, 'app'), output = join(root, 'report'), source = join(root, 'common');
    await mkdir(appdir); await mkdir(source);
    await writeFile(join(source, 'MIT'), 'fixture terms');
    await collectCommonLicenses(source, join(appdir, 'licenses/dependencies/linux-common-licenses'));
    await writeFile(join(appdir, 'copyright'), 'See /usr/share/common-licenses/MIT');
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1]);
    await writeFile(join(appdir, 'libfixture.so'), elf);
    const host = join(root, 'host.so'); await writeFile(host, elf);
    // Emulate the Linux package database, not a real user's installed packages.
    const command = (name, args) => {
      if (name === 'git') return 'fixture-revision';
      if (args[0] === '-S') return `fixture:amd64: ${host}\n`;
      return 'fixture:amd64\t1.2-3\tamd64\tfixture-source\t1.2-3';
    };
    const report = await collectNativeEvidence(appdir, output, command);
    assert.equal(report.records[0].status, 'exact-package-match');
    assert.deepEqual(report.sourceRequests, [{sourcePackage: 'fixture-source', sourceVersion: '1.2-3'}]);
    await writeFile(host, Buffer.concat([elf, Buffer.from([2])]));
    const modified = await collectNativeEvidence(appdir, output, command);
    assert.deepEqual(modified.unresolved, ['libfixture.so']);
    assert.deepEqual(modified.sourceRequests, []);
    await writeFile(join(appdir, 'copyright'), 'See /usr/share/common-licenses/MISSING');
    await assert.rejects(collectNativeEvidence(appdir, output, command), /Missing referenced license/);
    const failed = JSON.parse(await readFile(join(output, 'linux-native-provenance.json'), 'utf8'));
    assert.deepEqual(failed.missingLicenseReferences, ['MISSING']);
  } finally { await rm(root, {recursive: true, force: true}); }
});
