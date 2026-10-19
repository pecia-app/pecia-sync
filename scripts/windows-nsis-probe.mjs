// Historical read-only section comparison; does not certify the whole installer.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const [installerPath, stubPath] = process.argv.slice(2);
if (!installerPath || !stubPath) throw Error('Usage: node windows-nsis-probe.mjs INSTALLER STUB');
const installer = await readFile(installerPath), stub = await readFile(stubPath);
assert.equal(hash(installer), 'af58f40023d5d2bf67c8dc31983a06a20a3e04041bae32959fab4cdd64ef614a');
assert.equal(hash(stub), 'a0d065b62d34be5f0aaaf7c162e101a5e25d7cd3eb10a13fdb37f91b02ebfce2');
function sections(bytes) {
  assert.equal(bytes.toString('ascii', 0, 2), 'MZ');
  const pe = bytes.readUInt32LE(60);
  assert.equal(bytes.toString('ascii', pe, pe + 4), 'PE\0\0');
  const count = bytes.readUInt16LE(pe + 6), start = pe + 24 + bytes.readUInt16LE(pe + 20);
  const result = new Map();
  for (let i = 0; i < count; i++) {
    const entry = start + i * 40;
    const name = bytes.toString('ascii', entry, entry + 8).replaceAll('\0', '');
    const size = bytes.readUInt32LE(entry + 16), offset = bytes.readUInt32LE(entry + 20);
    assert.ok(offset + size <= bytes.length);
    assert.ok(!result.has(name));
    result.set(name, bytes.subarray(offset, offset + size));
  }
  return result;
}
const actual = sections(installer), original = sections(stub);
for (const name of ['.text', '.rdata', '.data']) {
  assert.ok(actual.has(name) && original.has(name));
  assert.deepEqual(actual.get(name), original.get(name));
  console.log(`MATCH ${name} ${hash(actual.get(name))}`);
}
assert.notDeepEqual(actual.get('.rsrc'), original.get('.rsrc'));
console.log('Resource section differs. PE headers, resources and appended payload are NOT verified by this probe.');
