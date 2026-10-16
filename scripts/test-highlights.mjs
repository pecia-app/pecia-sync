import {chromium,webkit} from '@playwright/test';
import {preview} from 'vite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const config=JSON.parse(await readFile(root+'/src-tauri/tauri.conf.json','utf8'));
const clip=(n)=>`A fictional journey (Demo Author)\n- Your ${n===1?'Note':'Highlight'} on page ${n} | Location ${n}\n\nSynthetic thought ${n} <img src=x onerror=alert(1)>\n==========\n`;
const source=Array.from({length:105},(_,i)=>clip(i+1)).join('')+clip(2);
const server=await preview({root,configFile:false,preview:{host:'127.0.0.1',port:1424,strictPort:true,headers:{'Content-Security-Policy':config.app.security.csp}},logLevel:'error'});
try {for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
 const browser=await engine.launch(name==='chromium'?{channel:'chrome'}:{});
 try {
 const page=await browser.newPage({viewport:{width:1200,height:760}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(source=>{
  window.testSource=source;window.exports=[];window.commands=[];
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
   window.commands.push(command);
   if(command==='diagnostic_snapshot')return {appVersion:'test',operatingSystem:'fixture',architecture:'fixture'};
   if(command==='open_clippings_file')return window.testSource;
   if(command==='import_kindle_clippings'){if(window.deviceError)throw window.deviceError;return window.testSource;}
   if(command==='save_annotations'){window.exports.push(args.contents);return true;}
   throw Error('Unexpected command '+command);
  }};
 },source);
 await page.goto('http://127.0.0.1:1424');
 await page.locator('[data-language="en"]').click();
 if((await page.evaluate(()=>window.commands)).includes('open_clippings_file'))throw Error('automatic content read');
 if(await page.getByRole('button',{name:'View highlights',exact:true}).isVisible())throw Error('empty view action');
 for(const height of [680,760]) {
  await page.setViewportSize({width:1200,height});
  const before=await page.locator('#annotations').boundingBox();
  await page.evaluate(()=>{window.savedSource=window.testSource;window.testSource=null;});
  await page.getByRole('button',{name:'Import file…',exact:true}).click();
  await page.getByRole('button',{name:'Import file…',exact:true}).waitFor({state:'visible'});
  const after=await page.locator('#annotations').boundingBox();
  if(after.height!==before.height)throw Error('cancel changed panel height');
  if(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1)) {
   console.log(await page.evaluate(()=>Object.fromEntries(['main','.content-grid','.right-column','#annotations','.pecia-panel','.books-panel','.sidebar','main>footer'].map(s=>{const e=document.querySelector(s);const r=e.getBoundingClientRect();return [s,{y:r.y,height:r.height,bottom:r.bottom,scroll:e.scrollHeight}]}))));
   throw Error('empty/cancel dashboard overflow at '+height);
  }
  await page.evaluate(()=>{window.testSource=window.savedSource;window.deviceError='not-found';});
  await page.getByRole('button',{name:'Import from Kindle',exact:true}).click();
  await page.getByText('My Clippings.txt was not found. Try Import file…',{exact:true}).waitFor();
  if(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1))throw Error('error dashboard overflow at '+height);
  await page.evaluate(()=>window.deviceError=null);
  await page.evaluate(()=>window.testSource={highlights:3,notes:0,pending:0});
  await page.getByRole('button',{name:'Import from Kindle',exact:true}).click();
  await page.getByText('3 highlights found. This version cannot recover their text yet.',{exact:true}).waitFor();
  if(await page.evaluate(()=>localStorage.getItem('pecia-clippings-seen-v1'))!==null)throw Error('database metadata persisted');
  if(await page.getByRole('button',{name:'View highlights',exact:true}).isVisible())throw Error('metadata advertised as imported text');
  if(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1))throw Error('database dashboard overflow at '+height);
  await page.evaluate(()=>window.testSource=window.savedSource);
 }
 await page.getByRole('button',{name:'Import from Kindle',exact:true}).click();
 await page.locator('.clipping-navigation span').filter({hasText:'1 / 105'}).waitFor();
 for (const width of [1200, 800, 500]) {
  await page.setViewportSize({width,height:760});
  const aligned=await page.evaluate(()=>{
   const metrics=[...document.querySelectorAll('.device-metric')];
   return ['strong','span'].every(tag=>{
    const tops=metrics.map(metric=>metric.querySelector(tag).getBoundingClientRect().top);
    return Math.abs(tops[0]-tops[1])<1;
   });
  });
  if(!aligned)throw Error('device counter rows misaligned at '+width);
 }
 await page.setViewportSize({width:1200,height:760});
 await page.getByRole('button',{name:'Next clipping',exact:true}).click();
 await page.locator('.clipping-navigation span').filter({hasText:'2 / 105'}).waitFor();
 await page.getByRole('button',{name:'Previous clipping',exact:true}).click();
 const stored=await page.evaluate(()=>JSON.stringify(localStorage));
 if(stored.includes('Synthetic')||stored.includes('fictional'))throw Error('content persisted');
 if(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1))throw Error('dashboard vertical overflow');
 await page.getByRole('button',{name:'View all highlights',exact:true}).click();
 if(await page.locator('.annotation-card').count()!==100)throw Error('pagination');
 const quote=page.locator('.annotation-card blockquote').first();
 if(await quote.evaluate(e=>{const s=getComputedStyle(e);return s.display!=='block'||s.fontStyle!=='italic'||s.overflow!=='visible'||e.scrollHeight>e.clientHeight+1;}))throw Error('full quote is clipped or unstyled');
 if(await page.locator('.annotation-card').first().locator('blockquote').count())throw Error('note styled as quotation');
 if(await page.locator('.annotation-card img').count())throw Error('unsafe DOM');
 await page.getByRole('button',{name:'Show more',exact:true}).click();
 if(await page.locator('.annotation-card').count()!==105)throw Error('more');
 await page.getByRole('searchbox',{name:'Search book, author or text'}).fill('Synthetic thought 105');
 await page.getByRole('button',{name:'Export selection as Markdown',exact:true}).click();
 await page.getByText('Markdown saved.',{exact:true}).waitFor();
 const exported=await page.evaluate(()=>window.exports[0]);
 if(!exported.includes('Synthetic thought 105')||exported.includes('Synthetic thought 104')||exported.includes('<img'))throw Error('export filter or escaping');
 await page.getByRole('searchbox',{name:'Search book, author or text'}).fill('');
 if(process.env.HIGHLIGHTS_SCREENSHOTS) await page.screenshot({path:process.env.HIGHLIGHTS_SCREENSHOTS+'/review-'+name+'.png'});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Import file…',exact:true}).click();
 await page.locator('.clipping-navigation span').filter({hasText:'1 / 105'}).waitFor();
 await page.reload();
 await page.locator('[data-language="en"]').click();
 await page.getByRole('button',{name:'Import file…',exact:true}).click();
 await page.locator('.clipping-navigation span').filter({hasText:'1 / 105'}).waitFor();
 await page.evaluate(()=>window.testSource=null);
 await page.getByRole('button',{name:'Import file…',exact:true}).click();
 if(await page.getByText('Import cancelled; existing data is unchanged.',{exact:true}).count())throw Error('cancel message appeared');
 await page.locator('.clipping-navigation span').filter({hasText:'1 / 105'}).waitFor();
 await page.getByRole('button',{name:'View all highlights',exact:true}).click();
 await page.getByRole('checkbox',{name:'New only',exact:true}).check();
 await page.getByText('No matching entries.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Clear local history',exact:true}).click();
 if(await page.evaluate(()=>localStorage.getItem('pecia-clippings-seen-v1'))!==null)throw Error('history not cleared');
 await page.evaluate(()=>window.testSource={highlights:3,notes:0,pending:0,previews:[{title:'Synthetic KFX book',text:'A recovered passage <img src=x>',start:10,end:39}]});
 await page.getByRole('button',{name:'Import from Kindle',exact:true}).click();
 await page.getByText('A recovered passage <img src=x>',{exact:true}).waitFor();
 for(const height of [680,760]) {
  await page.setViewportSize({width:1200,height});
  if(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1))throw Error('carousel overflow '+height);
 }
 if(!(await page.getByRole('button',{name:'Next clipping',exact:true}).isDisabled()))throw Error('single clipping navigation');
 await page.getByRole('button',{name:'View all highlights',exact:true}).click();
 for(const width of [1200,500]) {
  await page.setViewportSize({width,height:760});
  const layout=await page.locator('.annotations-dialog').evaluate(d=>{
   const h=d.querySelector('header'),b=h.querySelector('button'),n=d.querySelector('.annotation-preview-notice');
   const hr=h.getBoundingClientRect(),br=b.getBoundingClientRect(),nr=n.getBoundingClientRect();
   return {children:h.children.length,right:Math.abs(br.right-hr.right),below:nr.top>=hr.bottom,overflow:d.scrollWidth>d.clientWidth+1};
  });
  if(layout.children!==2||layout.right>1||!layout.below||layout.overflow)throw Error('preview header layout');
 }
 await page.setViewportSize({width:1200,height:760});
 if(await page.locator('.annotation-card img').count())throw Error('unsafe preview');
 if(!(await page.getByRole('button',{name:'Export selection as Markdown',exact:true}).isDisabled()))throw Error('unverified export enabled');
 if(await page.evaluate(()=>localStorage.getItem('pecia-clippings-seen-v1'))!==null)throw Error('preview persisted');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'View all highlights',exact:true}).click();
 await page.locator('.annotation-card').getByText('A recovered passage <img src=x>',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('[data-language="es"]').click();
 await page.getByRole('button',{name:'Privacidad e historial',exact:true}).click();
 await page.setViewportSize({width:500,height:700});
 if(await page.locator('.annotations-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1))throw Error('dialog overflow');
 if(errors.length)throw Error(errors.join(';'));
 console.log(name+': explicit import, 105 entries, dedup/new detection, pagination, search, safe filtered export, cancellation, clear, bilingual and narrow UI passed');
 }finally{await browser.close();}
}}finally{await new Promise(resolve=>server.httpServer.close(resolve));}
