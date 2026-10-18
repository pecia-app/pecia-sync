import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseOwners, matchStatus, collectNativeEvidence} from './linux-native-evidence.mjs';
import {collectCommonLicenses} from './linux-notices.mjs';
import {collectAssetEvidence} from './linux-asset-evidence.mjs';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('inventories scripts and assets without treating a filename as clearance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-assets-'));
  try {
    await writeFile(join(root, 'AppRun'), '#!/bin/sh\nexit 0\n');
    await writeFile(join(root, 'LICENSE'), 'fixture');
    await writeFile(join(root, 'empty'), '');
    await writeFile(join(root, 'binary'), Buffer.from([127, 69, 76, 70, 1]));
    const report = await collectAssetEvidence(root);
    assert.deepEqual(report.records.map(r => [r.path, r.kind]), [['AppRun', 'script'], ['LICENSE', 'asset'], ['empty', 'asset']]);
    assert.ok(report.records.every(r => r.status === 'needs-review' && /^[a-f0-9]{64}$/.test(r.sha256)));
    const before = report.records[0].sha256;
    await writeFile(join(root, 'AppRun'), '#!/bin/sh\nexit 1\n');
    assert.notEqual((await collectAssetEvidence(root)).records[0].sha256, before);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('records raw symlinks without following cycles, escapes or missing targets', {skip: process.platform === 'win32'}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-asset-links-'));
  try {
    for (const [name, target] of [['cycle', 'cycle'], ['escape', '../outside'], ['missing', 'absent'], ['absolute', '/nonexistent']]) await symlink(target, join(root, name));
    const report = await collectAssetEvidence(root);
    assert.equal(report.records.length, 4);
    assert.ok(report.records.every(r => r.kind === 'symlink' && !r.sha256));
    assert.equal(report.records.find(r => r.path === 'escape').target, '../outside');
    await assert.rejects(collectAssetEvidence(join(root, 'cycle')), /real directory/);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('parses multiarch package ownership without splitting its architecture', () => {
  assert.deepEqual(parseOwners('libfoo1:amd64: /usr/lib/x86_64-linux-gnu/libfoo.so.1\n'),
    [{owner: 'libfoo1:amd64', path: '/usr/lib/x86_64-linux-gnu/libfoo.so.1'}]);
  assert.deepEqual(parseOwners('diversion by other-package from: /usr/lib/libfoo.so\n'), []);
});

test('non-ELF exact matches add source requests; changed assets stay unresolved', {skip: process.platform === 'win32'}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-schema-test-'));
  try {
    const appdir = join(root, 'app'), source = join(root, 'common'), host = join(root, 'schema.xml');
    await mkdir(appdir); await mkdir(source);
    await writeFile(join(source, 'MIT'), 'fixture terms');
    await collectCommonLicenses(source, join(appdir, 'licenses/dependencies/linux-common-licenses'));
    await writeFile(join(appdir, 'binary'), Buffer.from([127, 69, 76, 70, 1]));
    await writeFile(host, '<schema/>'); await writeFile(join(appdir, 'schema.xml'), '<schema/>');
    const command = (name, args) => {
      if (name === 'git') return 'fixture-revision';
      if (args[0] === '-S') return args[1] === '*/schema.xml' ? `schemas: ${host}\n` : '';
      return 'schemas\t1.0\tall\tschema-source\t1.0';
    };
    const report = await collectNativeEvidence(appdir, join(root, 'report'), command);
    assert.deepEqual(report.sourceRequests, [{sourcePackage: 'schema-source', sourceVersion: '1.0'}]);
    assert.equal(report.assets.records.find(r => r.path === 'schema.xml').status, 'verified-package-match');
    await writeFile(host, '<changed/>');
    const changed = await collectNativeEvidence(appdir, join(root, 'report'), command);
    assert.deepEqual(changed.sourceRequests, []);
    assert.ok(changed.unresolvedAssets.includes('schema.xml'));
  } finally { await rm(root, {recursive: true, force: true}); }
});
test('same filename or modified bytes are not treated as a verified mapping', () => {
  assert.equal(matchStatus('a', 'b'), 'unverified-different-bytes');
  assert.equal(matchStatus('a', 'a'), 'exact-bytes');
});

test('reuses ownership and matching metadata per capture, skips unequal asset metadata', {skip: process.platform === 'win32'}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-query-cache-'));
  try {
    const appdir = join(root, 'app'), source = join(root, 'common'), host = join(root, 'terms'), wrong = join(root, 'wrong');
    await mkdir(appdir); await mkdir(source);
    await writeFile(join(source, 'MIT'), 'fixture terms');
    await collectCommonLicenses(source, join(appdir, 'licenses/dependencies/linux-common-licenses'));
    await writeFile(join(appdir, 'binary'), Buffer.from([127, 69, 76, 70, 1]));
    await writeFile(host, 'matching'); await writeFile(wrong, 'unrelated');
    for (const dir of ['a', 'b']) { await mkdir(join(appdir, dir)); await writeFile(join(appdir, dir, 'copyright'), 'matching'); }
    const queries = [], packages = [];
    const command = (name, args) => {
      if (name === 'git') return 'fixture-revision';
      if (args[0] === '-S') { queries.push(args[1]); return args[1] === '*/copyright' ? `correct: ${host}\nwrong: ${wrong}\n` : ''; }
      packages.push(args.at(-1));
      assert.equal(args.at(-1), 'correct');
      return 'correct\t1\tall\tcorrect-source\t1';
    };
    const result = await collectNativeEvidence(appdir, join(root, 'report'), command);
    assert.equal(queries.filter(q => q === '*/copyright').length, 1);
    assert.deepEqual(packages, ['correct']);
    assert.deepEqual(result.sourceRequests, [{sourcePackage: 'correct-source', sourceVersion: '1'}]);
    await writeFile(host, 'changed');
    const fresh = await collectNativeEvidence(appdir, join(root, 'report'), command);
    assert.deepEqual(fresh.sourceRequests, []); // No stale cross-capture hashes.
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('attributes symlink bytes to the runtime owner, not the development package', {skip: process.platform === 'win32'}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'pecia-owner-test-'));
  try {
    const appdir = join(root, 'app'), source = join(root, 'common');
    await mkdir(appdir); await mkdir(source);
    await writeFile(join(source, 'MIT'), 'fixture terms');
    await collectCommonLicenses(source, join(appdir, 'licenses/dependencies/linux-common-licenses'));
    const bytes = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1]);
    const target = join(root, 'runtime.so.1'), alias = join(root, 'dev.so');
    await writeFile(target, bytes); await symlink(target, alias);
    await writeFile(join(appdir, 'dev.so'), bytes);
    const canonical = await realpath(target);
    const command = (name, args) => {
      if (name === 'git') return 'fixture-revision';
      if (args[0] === '-S') return args[1] === canonical ? `runtime:amd64: ${canonical}\n` : `development:amd64: ${alias}\n`;
      assert.equal(args.at(-1), 'runtime:amd64');
      return 'runtime:amd64\t1.0-1\tamd64\truntime-source\t1.0-1';
    };
    const report = await collectNativeEvidence(appdir, join(root, 'report'), command);
    assert.equal(report.records[0].candidates[0].owner, 'runtime:amd64');
    assert.deepEqual(report.sourceRequests, [{sourcePackage: 'runtime-source', sourceVersion: '1.0-1'}]);
  } finally { await rm(root, {recursive: true, force: true}); }
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
    assert.equal(report.records[0].status, 'verified-package-match');
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
