// Inventory is evidence, not source/license clearance. Never follow payload links.
import {readdir, lstat, readFile, readlink} from 'node:fs/promises';
import {join, relative, resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';

export async function collectAssetEvidence(appdir) {
  const root = resolve(appdir), records = [];
  if (!(await lstat(root)).isDirectory()) throw Error('AppDir must be a real directory');
  async function walk(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name), info = await lstat(path);
      const entry = {path: relative(root, path).split(sep).join('/')};
      if (info.isSymbolicLink()) {
        // Record raw targets, including broken, absolute, cyclic and escaping links.
        // Do not resolve/read them: even an internal link can traverse another link.
        records.push({...entry, kind: 'symlink', target: await readlink(path), status: 'needs-review'});
      } else if (info.isDirectory()) await walk(path);
      else if (info.isFile()) {
        const bytes = await readFile(path);
        if (bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) continue;
        records.push({...entry, kind: bytes.subarray(0, 2).toString() === '#!' ? 'script' : 'asset',
          size: bytes.length, mode: info.mode & 0o777,
          sha256: createHash('sha256').update(bytes).digest('hex'), status: 'needs-review'});
      } else records.push({...entry, kind: 'special-file', status: 'needs-review'});
    }
  }
  await walk(root);
  return {scope: 'All non-ELF regular files, symlinks and special files in AppDir. No symlinks followed. Classification is not provenance or license approval.', records};
}
