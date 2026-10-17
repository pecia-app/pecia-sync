import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectCommonLicenses, verifyCommonLicenses, commonLicenseReferences} from './linux-notices.mjs';

test('copies full texts, verifies hashes, and rejects tampering', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-notices-test-'));
  try {
    const source = join(root, 'source'), output = join(root, 'output');
    await mkdir(source);
    await writeFile(join(source, 'LGPL-2.1'), 'fixture full terms\n');
    await collectCommonLicenses(source, output);
    assert.deepEqual([...await verifyCommonLicenses(output)], ['LGPL-2.1']);
    assert.equal(await readFile(join(output, 'LGPL-2.1'), 'utf8'), 'fixture full terms\n');
    await writeFile(join(output, 'LGPL-2.1'), 'changed');
    await assert.rejects(verifyCommonLicenses(output), /changed/);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('materializes distro alias symlinks', {skip: process.platform === 'win32'}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-notices-test-'));
  try {
    const source = join(root, 'source'), output = join(root, 'output');
    await mkdir(source);
    await writeFile(join(source, 'GPL-3'), 'fixture terms');
    await symlink('GPL-3', join(source, 'GPL'));
    await collectCommonLicenses(source, output);
    assert.deepEqual([...await verifyCommonLicenses(output)], ['GPL', 'GPL-3']);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('finds unique absolute common-license references without punctuation', () => {
  assert.deepEqual(commonLicenseReferences('See /usr/share/common-licenses/LGPL-2.1.\n' +
    '`/usr/share/common-licenses/Apache-2.0`; /usr/share/common-licenses/LGPL-2.1'), ['LGPL-2.1', 'Apache-2.0']);
});

test('rejects an empty collection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-notices-test-'));
  try {
    const source = join(root, 'source'); await mkdir(source);
    await assert.rejects(collectCommonLicenses(source, join(root, 'output')), /No common/);
  } finally { await rm(root, {recursive: true, force: true}); }
});
