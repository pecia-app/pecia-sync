import {mkdtemp, readFile, writeFile, rm, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const execute = (file, args) => execFileSync(file, args, {encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024});

// Exact equal-length byte substitution from the pinned GTK plugin, not a
// normalization used to ignore differences in the final comparison.
export function replayWebkitPaths(bytes) {
  const result = Buffer.from(bytes), from = Buffer.from('/usr'), to = Buffer.from('././');
  let start = 0;
  while ((start = result.indexOf(from, start)) !== -1) { to.copy(result, start); start += from.length; }
  return result;
}

// Replay only on a private copy. Neither the installed package nor the AppDir
// is modified. A build ID, filename, or section similarity is never sufficient.
export async function replayNativeFile(hostPath, payloadPath, tools, command = execute) {
  const host = await readFile(hostPath), expected = digest(await readFile(payloadPath));
  const rpath = command(tools.patchelf, ['--print-rpath', payloadPath]).trim();
  if (rpath.length > 16384 || /[\r\n\0]/.test(rpath)) throw Error('Invalid payload RPATH');
  const originalRpath = command(tools.patchelf, ['--print-rpath', hostPath]).trim();
  const plans = originalRpath.startsWith('$')
    ? [['patchelf']]
    : [['strip', 'patchelf'], ['patchelf']];
  const attempts = [];
  const temp = await mkdtemp(join(tmpdir(), 'pecia-native-replay-'));
  try {
    for (const plan of plans) {
      const copy = join(temp, 'candidate.elf');
      await writeFile(copy, host); await chmod(copy, 0o600);
      const operations = [];
      try {
        for (const operation of plan) {
          const args = operation === 'strip' ? [copy] : ['--set-rpath', rpath, copy];
          command(tools[operation], args);
          operations.push({tool: operation, arguments: operation === 'strip' ? ['<copy>'] : ['--set-rpath', rpath, '<copy>']});
        }
      } catch (error) {
        attempts.push({plan, error: String(error.message).slice(0, 1000)});
        continue;
      }
      let sha256 = digest(await readFile(copy));
      if (sha256 === expected) return {matched: true, sha256, operations};
      if (basename(payloadPath).startsWith('libwebkit')) {
        const patched = replayWebkitPaths(await readFile(copy));
        sha256 = digest(patched);
        if (sha256 === expected) return {matched: true, sha256, operations: [...operations, {tool: 'gtk-plugin-byte-substitution', arguments: ['/usr', '././', 'global']}]};
      }
      attempts.push({plan, sha256});
    }
    return {matched: false, attempts};
  } finally { await rm(temp, {recursive: true, force: true}); }
}

export async function describeReplayTools(tools) {
  return Object.fromEntries(await Promise.all(Object.entries(tools).map(async ([name, path]) => [name, {
    sha256: digest(await readFile(path)), version: execute(path, ['--version']).trim(),
  }])));
}
