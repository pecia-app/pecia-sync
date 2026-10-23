// Launch the real candidate under Xvfb; never treat process survival as UI validation.
import {spawn,execFileSync} from 'node:child_process';
import {readdir,mkdir,mkdtemp,readFile,writeFile,stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {sha256File} from './source-installer-evidence.mjs';
import assert from 'node:assert/strict';

assert.equal(process.platform,'linux');
assert.ok(process.env.DISPLAY,'Run inside xvfb-run and dbus-run-session');
const directory=resolve('src-tauri/target/release/bundle/appimage');
const names=(await readdir(directory)).filter(name=>name.endsWith('.AppImage'));
assert.equal(names.length,1,'Expected one candidate AppImage');
const app=join(directory,names[0]);
const output=resolve('build/installer-audit/linux-desktop');
await mkdir(output,{recursive:true});
const report={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),appImage:names[0],sha256:await sha256File(app),
  display:process.env.DISPLAY,osRelease:await readFile('/etc/os-release','utf8'),modes:[],
  scope:'Real AppImage launch under Xvfb. Screenshots require visual inspection; not physical-device or full reader validation.'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  for(const mode of ['fuse','extract-and-run']){
    const result={mode,status:'running'};report.modes.push(result);
    if(mode==='fuse')assert.ok((await stat('/dev/fuse')).isCharacterDevice(),'FUSE device unavailable');
    const home=await mkdtemp(join(tmpdir(),'pecia-desktop-'));
    const env={...process.env,HOME:home,XDG_CONFIG_HOME:join(home,'config'),XDG_CACHE_HOME:join(home,'cache'),XDG_DATA_HOME:join(home,'data'),LIBGL_ALWAYS_SOFTWARE:'1'};
    delete env.APPIMAGE_EXTRACT_AND_RUN;
    const log=createWriteStream(join(output,`${mode}.log`));
    const child=spawn(app,mode==='fuse'?[]:['--appimage-extract-and-run'],{env,detached:true,stdio:['ignore','pipe','pipe']});
    let spawnError;
    child.on('error',error=>{spawnError=error;});
    child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
    try{
      let window;
      for(let attempt=0;attempt<45;attempt++){
        if(spawnError)throw spawnError;
        assert.equal(child.exitCode,null,`AppImage exited before window appeared: ${child.exitCode}`);
        try{window=execFileSync('xdotool',['search','--onlyvisible','--name','^Pecia Sync$'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split('\n')[0];}catch{}
        if(window)break;
        await delay(1000);
      }
      assert.ok(window,'No visible Pecia Sync window within 45 seconds');
      await delay(5000);
      assert.equal(child.exitCode,null,'AppImage exited before capture');
      result.window=window;
      result.geometry=execFileSync('xdotool',['getwindowgeometry','--shell',window],{encoding:'utf8'}).trim();
      result.screenshot=`${mode}.png`;
      execFileSync('import',['-window',window,join(output,result.screenshot)]);
      result.screenshotSha256=await sha256File(join(output,result.screenshot));
      const mounts=await readFile('/proc/self/mountinfo','utf8');
      result.appImageMounts=mounts.split('\n').filter(line=>line.includes('/.mount_'));
      if(mode==='fuse')assert.ok(result.appImageMounts.length,'No live AppImage FUSE mount recorded');
      result.status='captured';
    }catch(error){
      result.status='failed';result.error=error.message;
      try{execFileSync('import',['-window','root',join(output,`${mode}-failure.png`)]);}catch{}
      throw error;
    }finally{
      if(child.pid)try{process.kill(-child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
      await delay(1000);log.end();
    }
  }
}finally{
  await writeFile(join(output,'desktop-smoke.json'),JSON.stringify(report,null,2)+'\n');
}
console.log('Both AppImage launch modes captured. Inspect screenshots before claiming desktop validation.');
