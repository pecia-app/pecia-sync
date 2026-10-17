import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {writeFileSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {replayNativeFile, replayWebkitPaths} from './linux-native-replay.mjs';

test('GTK plugin byte substitution preserves binary data and input bytes', () => {
  const bytes = Buffer.concat([Buffer.from([0, 255]), Buffer.from('/usr/lib:/usr/share')]);
  const result = replayWebkitPaths(bytes);
  assert.equal(result.length, bytes.length);
  assert.deepEqual(result.subarray(0, 2), Buffer.from([0, 255]));
  assert.equal(result.subarray(2).toString(), '././/lib:././/share');
  assert.equal(bytes.subarray(2).toString(), '/usr/lib:/usr/share');
});

test('replay requires exact full bytes and never edits the inputs', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'pecia-replay-test-'));
  try {
    const host = join(temp, 'host'), payload = join(temp, 'payload');
    await writeFile(host, 'original'); await writeFile(payload, 'original-stripped-patched');
    const command = (tool, args) => {
      if (args[0] === '--print-rpath') return args[1] === payload ? '$ORIGIN\n' : '\n';
      const copy = args.at(-1);
      assert.notEqual(copy, host); assert.notEqual(copy, payload);
      writeFileSync(copy, readFileSync(copy, 'utf8') + (tool === 'strip' ? '-stripped' : '-patched'));
      return '';
    };
    const result = await replayNativeFile(host, payload, {strip: 'strip', patchelf: 'patchelf'}, command);
    assert.equal(result.matched, true);
    assert.deepEqual(result.operations.map(operation => operation.tool), ['strip', 'patchelf']);
    assert.equal(await readFile(host, 'utf8'), 'original');
    await writeFile(payload, 'different');
    assert.equal((await replayNativeFile(host, payload, {strip: 'strip', patchelf: 'patchelf'}, command)).matched, false);
    assert.equal(await readFile(payload, 'utf8'), 'different');
  } finally { await rm(temp, {recursive: true, force: true}); }
});

test('replay tool failure remains unverified', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'pecia-replay-test-'));
  try {
    const host = join(temp, 'host'), payload = join(temp, 'payload');
    await writeFile(host, 'original'); await writeFile(payload, 'different');
    const command = (_, args) => {
      if (args[0] === '--print-rpath') return '';
      throw Error('fixture tool failed');
    };
    const result = await replayNativeFile(host, payload, {strip: 'strip', patchelf: 'patchelf'}, command);
    assert.equal(result.matched, false);
    assert.equal(result.attempts.length, 2);
  } finally { await rm(temp, {recursive: true, force: true}); }
});
