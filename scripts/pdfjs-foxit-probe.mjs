// Exact byte extraction from pinned PDFium arrays; not a font-design source claim.
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const hash=b=>createHash('sha256').update(b).digest('hex');
const archive='build/pdfjs-nested-source/pdfium-source.tar.gz';
assert.equal(hash(await readFile(archive)),'58098e1d4c63647c7bd8292b5f204bd0b633f8f4c9d4db6bc372445397371342');
const directory='node_modules/pdfjs-dist/standard_fonts';
const names=(await readdir(directory)).filter(name=>/^Foxit.*\.pfb$/.test(name)).sort();
assert.equal(names.length,10,'Expected the ten pinned PDF.js Foxit fonts');
for(const name of names){
  const source=execFileSync('tar',['-xOf',archive,`pdfium-bb1f9f71e7b15afdd5937adf8cfe5807522b882f/core/fxge/fontdata/chromefontdata/${name.replace('.pfb','.cpp')}`],{encoding:'utf8'});
  const match=source.match(/const std::array<uint8_t, (\d+)> \w+ = \{\{([\s\S]*?)\}\};/);
  assert.ok(match,`Unexpected source array: ${name}`);
  const tokens=match[2].split(',').map(token=>token.trim()).filter(Boolean);
  assert.ok(tokens.every(token=>/^0x[0-9a-f]{1,2}$/i.test(token)));
  const bytes=Buffer.from(tokens.map(token=>Number.parseInt(token,16)));
  assert.equal(bytes.length,Number(match[1]));
  assert.deepEqual(bytes,await readFile(`${directory}/${name}`),`Font differs: ${name}`);
  console.log(`MATCH ${name} ${hash(bytes)}`);
}
