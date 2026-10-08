import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist'), JMA=process.env.JMA_QA_ROOT;
if (!JMA) throw new Error('Set JMA_QA_ROOT to the companion source checkout');
const { getChapterLessons } = await import(path.join(JMA, 'dev/content/word-games.js'));
const out='/tmp/cyberjojo-word-qa';await mkdir(out,{recursive:true});
const desktop = process.env.QA_DEVICE === 'desktop';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-webgl','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:desktop?{width:1280,height:900}:{width:390,height:844},isMobile:!desktop,hasTouch:!desktop,userAgent:desktop?undefined:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',permissions:['camera','microphone'],reducedMotion:'reduce'});
try {
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let voiceSocket, wordSocket;
await page.routeWebSocket('**/api/word-realtime', socket=>{wordSocket=socket;socket.onMessage(raw=>{if(typeof raw!=='string')return;try{const d=JSON.parse(raw);if(d.type==='start')socket.send(JSON.stringify({type:'ready'}));if(d.type==='say'){socket.send(JSON.stringify({type:'event',event:350,data:{text:d.text}}));socket.send(Buffer.alloc(4800));socket.send(JSON.stringify({type:'event',event:359,data:{}}));}}catch{}});});
await page.routeWebSocket('**/api/voice', socket=>{voiceSocket=socket;socket.onMessage(raw=>{try{const d=JSON.parse(raw);if(d.type==='start'||d.type==='activate')socket.send(JSON.stringify({type:'ready',transport:'seeduplex'}));if(d.type==='text')socket.send(JSON.stringify({type:'transcript',final:true,text:d.text,clientMessageId:d.id}));}catch{}});});
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.riv':'application/octet-stream','.wasm':'application/wasm','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg'};
await page.route(/https:\/\/(cyberjojo|jma)\.mikeywa\.site\//,async route=>{
 const url=new URL(route.request().url());const cyber=url.hostname.startsWith('cyberjojo');
 if(url.pathname.startsWith('/api/')){
   if(url.pathname.includes('health'))return route.fulfill({json:{ok:true}});
   return route.fulfill({json:{ok:true,summaries:[],commands:[]}});
 }
 if (process.env.QA_LIVE === '1') return route.continue();
 let file=path.join(cyber?ROOT:JMA,decodeURIComponent(url.pathname));
 if(url.pathname==='/'||cyber&&!(await stat(file).catch(()=>null)))file=path.join(ROOT,'index.html');
 if(!cyber&&url.pathname==='/words')file=path.join(JMA,'words.html');
 try {const body=await readFile(file);return route.fulfill({body,contentType:types[path.extname(file)]||'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*',...(path.extname(file)==='.html'?{'Permissions-Policy':cyber?'camera=(self), microphone=(self "https://jma.mikeywa.site")':'microphone=(self), camera=()',...(!cyber?{'Content-Security-Policy':"frame-ancestors 'self' https://cyberjojo.mikeywa.site"}:{})}:{})}});}catch{return route.continue();}
});
await page.goto('https://cyberjojo.mikeywa.site/');
await page.getByRole('button',{name:'开始和叫叫聊聊',exact:true}).click();
await page.waitForSelector('.camera-stage.is-live',{timeout:30000});
console.log('LIVE');
await page.waitForTimeout(1500);
voiceSocket.send(JSON.stringify({type:'transcript',text:'我想要开口造世界',final:true}));
await page.locator('.activity-link-card').waitFor({timeout:20000});
await page.getByRole('button',{name:'进入小世界 ↗'}).click();
await page.locator('.activity-experience').waitFor(); assert.ok(await page.locator('.camera-source').first().evaluate(e=>e.srcObject.getAudioTracks().every(t=>!t.enabled))); await page.waitForTimeout(1500); console.log('FRAME',page.frames().map(f=>f.url()),'ERRORS',errors); await page.screenshot({path:out+'/opening.png'});
const frame=page.frameLocator('.activity-experience iframe');
await frame.locator('#choose-age').waitFor({timeout:20000});
await frame.locator('#choose-age').click();
await frame.locator('#continue-chapter').click();
await frame.locator('#word-options-toggle').waitFor({timeout:30000});
await page.screenshot({path:out+'/mobile-embedded.png'});
console.log('FRAME READY');
await frame.locator('#word-options-toggle').click();
const firstWord=frame.locator('[data-word]').first(); await firstWord.click();
await frame.locator('#word-panel').evaluate(()=>new Promise(resolve=>{const check=()=>window.__WORD_GAME__.status.busy||window.__WORD_GAME__.status.pendingWords?setTimeout(check,30):resolve();check();}));
await page.getByRole('button',{name:'‹ 退出',exact:true}).click();
await page.locator('.activity-experience').waitFor({state:'detached'});
assert.ok(await page.locator('.camera-source').first().evaluate(e=>e.srcObject.getAudioTracks().every(t=>t.enabled)));
const reports=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyberjojo.activity-reports.v1')));
assert.equal(reports.length,1);assert.equal(reports[0].report.status,'exited');assert.ok(reports[0].report.totalLessons>0);
assert.ok(reports[0].report.menuAttempts>=1);assert.ok(reports[0].report.words.length>=1);
console.log('EXIT REPORT',JSON.stringify(reports[0]));
await page.getByRole('button',{name:/打开作品列表/}).click();
await page.getByRole('button',{name:'玩法',exact:true}).click();
await page.locator('.activity-report-heading').first().click(); assert.equal(await page.locator('details.activity-report').count(),0);
await page.screenshot({path:out+'/mobile-report.png'});
await page.getByRole('button',{name:'关闭作品列表',exact:true}).click();
await page.waitForTimeout(500);
voiceSocket.send(JSON.stringify({type:'transcript',text:'跟读练习',final:true}));
await page.getByRole('button',{name:'进入小世界 ↗'}).click();
await frame.locator('#choose-age').click();await frame.locator('#continue-chapter').click();
const actualFrame=page.frames().find(f=>f.url().startsWith('https://jma.'));
await actualFrame.waitForFunction(()=>window.__WORD_GAME__?.status.view==='play'&&!window.__WORD_GAME__.status.busy);
const meta=await actualFrame.evaluate(()=>{const st=window.__WORD_GAME__.status;const journeys=JSON.parse(localStorage.getItem('jma.word-play.v1')).journeys;return {chapter:st.chapter,age:st.age,route:Object.values(journeys).find(j=>j.runId)?.routeIndex||0};});
const lessons=getChapterLessons(meta.chapter,meta.age,meta.route);
for(let i=0;i<lessons.length;i++) {
 await actualFrame.waitForFunction(()=>window.__WORD_GAME__.status.recording&&!window.__WORD_GAME__.status.busy&&!document.querySelector('.word-layout').hasAttribute('aria-busy'),{timeout:20000});
 for(const [event,data] of [[450,{}],[451,{results:[{text:i===0?`${lessons[i].example} dragon`:lessons[i].example}]}],[459,{}]])wordSocket.send(JSON.stringify({type:'event',event,data}));
 await actualFrame.waitForFunction(()=>!window.__WORD_GAME__.status.busy&&window.__WORD_GAME__.status.canAdvance,{timeout:20000});
 await frame.locator('#next-lesson').click();
}
await frame.getByRole('button',{name:'返回绿豆 · 收好练习记录'}).click();
await page.locator('.activity-experience').waitFor({state:'detached'});
const completed=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyberjojo.activity-reports.v1')));
assert.equal(completed.length,2);assert.equal(completed[0].report.status,'completed');assert.equal(completed[0].report.voiceAttempts,6);assert.equal(completed[0].report.completedLessons,6);assert.equal(completed[0].report.menuAttempts,0);assert.ok(completed[0].report.independentWords.includes('dragon'));assert.ok(completed[0].report.guidedWords.length>0);console.log('COMPLETED REPORT',JSON.stringify(completed[0]));
await page.reload();await page.getByRole('button',{name:'开始和叫叫聊聊',exact:true}).click();await page.waitForSelector('.camera-stage.is-live');
await page.getByRole('button',{name:/打开作品列表/}).click();await page.getByRole('button',{name:'玩法',exact:true}).click();
assert.equal(await page.locator('.activity-report').count(),2);assert.equal(await page.getByRole('region',{name:'自主念出的词',exact:true}).count(),2);await page.locator('.activity-report-heading').first().click(); assert.equal(await page.locator('details.activity-report').count(),0);await page.screenshot({path:out+'/completed-report.png'});
await page.getByRole('button',{name:'删除这条记录',exact:true}).first().click();assert.equal(await page.locator('.activity-report').count(),1);console.log('PERSISTENCE AND DELETE PASS');
await page.evaluate(()=>{const key='cyberjojo.activity-reports.v1';const records=JSON.parse(localStorage.getItem(key));for(const record of records){delete record.report.wordGroupsVersion;delete record.report.independentWords;delete record.report.guidedWords;}localStorage.setItem(key,JSON.stringify(records));});
await page.reload();await page.getByRole('button',{name:'开始和叫叫聊聊',exact:true}).click();await page.waitForSelector('.camera-stage.is-live');await page.getByRole('button',{name:/打开作品列表/}).click();
assert.ok(await page.getByText('已记录的词 · 未分组').count());assert.equal(await page.locator('details.activity-report').count(),0);console.log('LEGACY RECORD ALWAYS EXPANDED PASS');
console.log('ERRORS',JSON.stringify(errors));
await page.screenshot({path:out+'/returned.png'});
} finally { await browser.close(); }
