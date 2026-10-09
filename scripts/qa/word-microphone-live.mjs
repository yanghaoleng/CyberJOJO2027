// A real audio file is captured by Chromium's microphone device, sent by App's
// audio graph, and transcribed by the live provider. No injected transcripts.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'chrome',headless:true,args:[
 '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
 '--use-file-for-fake-audio-capture=/tmp/domi-apple-input.wav'
]});
const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const messages=[],errors=[];let inputPackets=0;
p.on('pageerror',e=>errors.push(e.message));
p.on('websocket',ws=>{
 if(!ws.url().includes('/voice'))return;
 ws.on('framesent',({payload})=>{if(typeof payload!=='string')inputPackets++;});
 ws.on('framereceived',({payload})=>{if(typeof payload==='string'){try{const m=JSON.parse(payload);messages.push(m);if(m.type==='transcript')console.log('LIVE ASR',m.text,m.final);if(m.type==='error')console.log('LIVE ERROR',m.code);}catch{}}});
});
try{
 await p.goto(process.env.QA_URL||'https://cyberjojo.mikeywa.site/words');
 await p.getByRole('button',{name:'开始和叫叫聊聊',exact:true}).click();
 await p.waitForSelector('.word-bubble-play',{timeout:120000});
 assert.equal(await p.locator('.word-bubble-tip').count(),0);
 await p.waitForSelector('.word-food-bubble[data-word="apple"]',{timeout:55000});
 assert.ok(messages.some(m=>m.type==='transcript'&&m.final&&/apple/i.test(m.text)));
 assert.ok(inputPackets>0);
 assert.equal(await p.locator('audio.guide-audio').evaluate(a=>a.playbackRate),1.5);
 await p.screenshot({path:'/tmp/word-microphone-live.png'});
 await p.locator('.word-food-bubble[data-word="apple"]').click();
 await p.waitForFunction(()=>document.querySelector('.word-bubble-play').dataset.wordLesson==='2');
 await p.getByRole('button',{name:'结束单词泡泡'}).click();
 const report=await p.evaluate(()=>JSON.parse(localStorage.getItem('cyberjojo.activity-reports.v1'))[0].report);
 assert.ok(report.guidedWords.includes('apple'));assert.ok(report.completedLessons>=1);
 assert.deepEqual(errors,[]);
 console.log('PASS: captured microphone WAV -> production ASR -> apple bubble -> feeding -> saved report; 1.5x pitch-preserved voice; no bottom tip');
}finally{await b.close()}
