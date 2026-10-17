import {readFile, writeFile, mkdir, readdir, stat} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {execFileSync} from 'node:child_process';

export function sourceRequestArgument(request) {
  if (!/^[a-z0-9][a-z0-9+.-]+$/.test(request.sourcePackage) ||
      !/^[0-9][A-Za-z0-9.+:~\-]*$/.test(request.sourceVersion)) throw Error('Unsafe or incomplete source request');
  return `${request.sourcePackage}=${request.sourceVersion}`;
}
export function parseSourceChecksums(text) {
  const block = text.match(/^Checksums-Sha256:\s*\n((?:[ \t]+[^\n]+\n?)+)/m)?.[1];
  if (!block) throw Error('Source descriptor has no SHA-256 file list');
  const files = block.trim().split('\n').map(line => {
    const match = line.trim().match(/^([a-f0-9]{64})\s+([0-9]+)\s+([A-Za-z0-9][A-Za-z0-9_.+~\-]*)$/);
    if (!match || match[3].includes('..')) throw Error('Unsafe source descriptor entry');
    return {sha256: match[1], size: Number(match[2]), file: match[3]};
  });
  if (new Set(files.map(file => file.file)).size !== files.length) throw Error('Duplicate source descriptor entry');
  return files;
}
async function hash(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function verifySourceDirectory(directory, request) {
  const names = await readdir(directory), descriptors = names.filter(name => name.endsWith('.dsc'));
  if (descriptors.length !== 1) throw Error('Expected one source descriptor');
  const descriptor = descriptors[0], text = await readFile(join(directory, descriptor), 'utf8');
  if (text.match(/^Source: (.+)$/m)?.[1].trim() !== request.sourcePackage ||
      text.match(/^Version: (.+)$/m)?.[1].trim() !== request.sourceVersion) throw Error('Source descriptor version mismatch');
  const files = parseSourceChecksums(text);
  for (const file of files) {
    const path = join(directory, file.file);
    if ((await stat(path)).size !== file.size || await hash(path) !== file.sha256) throw Error(`Source archive checksum mismatch: ${file.file}`);
  }
  const extra = names.filter(name => name !== descriptor && !files.some(file => file.file === name));
  if (extra.length) throw Error(`Unexpected source download files: ${extra.join(', ')}`);
  return {descriptor, descriptorSha256: await hash(join(directory, descriptor)), files};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'linux') throw Error('Source capture requires the Linux build host');
  const output = resolve('build/installer-audit'), report = JSON.parse(await readFile(join(output, 'linux-native-provenance.json'), 'utf8'));
  const collected = [], failures = [];
  for (const request of report.sourceRequests) {
    const argument = sourceRequestArgument(request);
    const directory = join(output, 'native-source', request.sourcePackage + '-' + createHash('sha256').update(argument).digest('hex').slice(0, 12));
    await mkdir(directory, {recursive: true});
    try {
      // The build host's authenticated APT index selects the exact source;
      // --download-only never runs package build scripts or installs packages.
      execFileSync('apt-get', ['source', '--download-only', '--only-source', '--', argument], {
        cwd: directory, encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024,
      });
      const evidence = await verifySourceDirectory(directory, request);
      collected.push({...request, directory: directory.slice(output.length + 1), ...evidence});
      console.log(`Collected verified source archives: ${argument}`);
    } catch (error) { failures.push({...request, error: String(error.message).slice(0, 3000)}); }
  }
  await writeFile(join(output, 'linux-native-source.json'), JSON.stringify({
    revision: report.revision, scope: 'Exact-package and replay-verified mappings only. Not proof of source completeness for unresolved binaries, scripts, AppImage runtime, or nested assets.',
    collected, failures, unresolvedBinaries: report.unresolved,
  }, null, 2) + '\n');
  if (failures.length || !collected.length) throw Error(`Source capture incomplete: ${collected.length} collected, ${failures.length} failed`);
}
