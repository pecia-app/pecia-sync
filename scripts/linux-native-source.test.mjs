import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {sourceRequestArgument, parseSourceChecksums, verifySourceDirectory} from './linux-native-source.mjs';

test('source requests preserve distro revisions/epochs and reject options or paths', () => {
  assert.equal(sourceRequestArgument({sourcePackage: 'glib2.0', sourceVersion: '2:2.80.0-6ubuntu3.8'}), 'glib2.0=2:2.80.0-6ubuntu3.8');
  assert.throws(() => sourceRequestArgument({sourcePackage: '--download', sourceVersion: '1'}));
  assert.throws(() => sourceRequestArgument({sourcePackage: 'glib2.0', sourceVersion: '../../x'}));
  assert.throws(() => parseSourceChecksums('Checksums-Sha256:\n ' + 'a'.repeat(64) + ' 1 ../evil\n'));
});
test('checks source identity and all descriptor hashes, rejecting tampering', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-source-test-'));
  try {
    const bytes = Buffer.from('fixture source'), sha256 = createHash('sha256').update(bytes).digest('hex');
    const request = {sourcePackage: 'fixture', sourceVersion: '1.0-2'};
    await writeFile(join(root, 'fixture.tar.xz'), bytes);
    await writeFile(join(root, 'fixture.dsc'), `Source: fixture\nVersion: 1.0-2\nChecksums-Sha256:\n ${sha256} ${bytes.length} fixture.tar.xz\n`);
    assert.equal((await verifySourceDirectory(root, request)).files.length, 1);
    await assert.rejects(verifySourceDirectory(root, {...request, sourceVersion: '1.0-3'}), /version mismatch/);
    await writeFile(join(root, 'fixture.tar.xz'), 'tampered');
    await assert.rejects(verifySourceDirectory(root, request), /checksum mismatch/);
  } finally { await rm(root, {recursive: true, force: true}); }
});
