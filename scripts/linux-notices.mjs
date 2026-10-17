import {readdir, readFile, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Package copyright files use these absolute paths. Keep their basenames and
// explain the relocated location without rewriting upstream copyright notices.
export async function collectCommonLicenses(source, destination) {
  await mkdir(destination, {recursive: true});
  const files = [];
  for (const name of (await readdir(source)).sort()) {
    if (!/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(name)) throw Error(`Unexpected license filename: ${name}`);
    const bytes = await readFile(join(source, name)); // Resolve distro alias symlinks into full texts.
    if (!bytes.length) throw Error(`Empty common license: ${name}`);
    await writeFile(join(destination, name), bytes);
    files.push({name, sha256: hash(bytes)});
  }
  if (!files.length) throw Error('No common license texts found');
  await writeFile(join(destination, 'manifest.json'), JSON.stringify({source, files}, null, 2) + '\n');
  await writeFile(join(destination, 'README.txt'),
    'Full texts copied from the Linux build host /usr/share/common-licenses.\n' +
    'References to /usr/share/common-licenses/NAME in bundled package copyright\n' +
    'files can be read here as NAME. This collection does not determine which\n' +
    'license applies to a component and does not replace corresponding source.\n');
}

export async function verifyCommonLicenses(destination) {
  const manifest = JSON.parse(await readFile(join(destination, 'manifest.json'), 'utf8'));
  if (!manifest.files?.length) throw Error('Empty common license manifest');
  for (const {name, sha256} of manifest.files) {
    if (!/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(name)) throw Error('Unsafe common license path');
    if (hash(await readFile(join(destination, name))) !== sha256) throw Error(`Common license changed: ${name}`);
  }
  return new Set(manifest.files.map(file => file.name));
}

export function commonLicenseReferences(text) {
  return [...new Set([...text.matchAll(/\/usr\/share\/common-licenses\/([A-Za-z0-9][A-Za-z0-9.+-]*)/g)]
    .map(match => match[1].replace(/[.]+$/, '')))];
}
