import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {collectRuntimeSource} from './runtime-source.mjs';

test('delivered AppRun source compiles and launches a synthetic desktop entry', {skip:process.platform!=='linux'}, async()=>{
  await collectRuntimeSource(resolve('.'),true);
  const root=await mkdtemp(join(tmpdir(),'pecia-apprun-test-'));
  try {
    const launcher=join(root,'AppRun');
    execFileSync('cc',['-D_FILE_OFFSET_BITS=64','-DENABLE_BINRELOC',resolve('build/runtime-source/appimage-apprun/AppRun.c'),'-o',launcher],{timeout:60000});
    await mkdir(join(root,'usr/bin'),{recursive:true});
    await writeFile(join(root,'test.desktop'),'[Desktop Entry]\nType=Application\nName=Fixture\nExec=probe %F\n');
    await writeFile(join(root,'usr/bin/probe'),'#!/bin/sh\nprintf "%s\\n" "$PWD" "$@"\n',{mode:0o755});
    const result=execFileSync(launcher,['book with spaces.epub','second.pdf'],{encoding:'utf8',timeout:10000});
    assert.deepEqual(result.trimEnd().split('\n'),[join(root,'usr'),'book with spaces.epub','second.pdf']);
  }finally{await rm(root,{recursive:true,force:true});}
});
