// Real provider acceptance: synthesized speech enters Chromium's microphone
// device, travels through App's capture graph, and returns as live ASR.
// This checks the deployed integration, not a child's accent or a physical phone.
import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const url=process.env.QA_URL||'https://cyberjojo.mikeywa.site/words',origin=new URL(url).origin;
const directory=await mkdtemp('/tmp/word-prefixes-live-');let browser;
try{
 const silence=seconds=>Buffer.alloc(seconds*48000*2),parts=[silence(12)];
 for(const [index,text] of ['Apple.','Two blue bananas.','Three red oranges.'].entries()){
  const response=await fetch(`${origin}/api/speech`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({text,character:'lvdou'})});
  assert.equal(response.status,200);const message=await response.json();assert.equal(message.voiceSource,'domi-word-tts-v1');
  const mp3=`${directory}/${index}.mp3`,pcm=`${directory}/${index}.pcm`;await writeFile(mp3,Buffer.from(message.audio,'base64'));
  execFileSync('ffmpeg',['-loglevel','error','-y','-i',mp3,'-ar','48000','-ac','1','-f','s16le',pcm]);parts.push(await readFile(pcm),silence(18));
 }
 const pcm=Buffer.concat(parts),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(48000,24);header.writeUInt32LE(96000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
 const wav=`${directory}/input.wav`;await writeFile(wav,Buffer.concat([header,pcm]));
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${wav}`]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const messages=[],errors=[];let inputPackets=0;
 await page.addInitScript(()=>{const Original=WebSocket;window.qaVoiceSockets=[];window.WebSocket=class extends Original{constructor(...args){super(...args);if(String(args[0]).includes('/voice'))qaVoiceSockets.push(this)}}});
 page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>{if(!ws.url().includes('/voice'))return;ws.on('framesent',({payload})=>{if(typeof payload!=='string')inputPackets++});ws.on('framereceived',({payload})=>{if(typeof payload==='string'){try{const m=JSON.parse(payload);messages.push(m);if(m.type==='transcript'&&m.final)console.log('LIVE ASR',m.text);if(m.type==='error')console.log('LIVE ERROR',m.code)}catch{}}});});
 await page.goto(url);await page.getByRole('button',{name:'开始和叫叫聊聊',exact:true}).click();await page.waitForSelector('.word-bubble-play',{timeout:120000});
 for(const [index,word,count,color] of [[0,'apple',1,''],[1,'banana',2,'blue'],[2,'orange',3,'red']]){
  const bubble=page.locator(`.word-food-bubble[data-word="${word}"]`);await bubble.waitFor({timeout:45000});await bubble.locator('.food-model[data-model-status="ready"]').waitFor();
  assert.equal(await bubble.getAttribute('data-count'),String(count));assert.equal(await bubble.getAttribute('data-color'),color);
  assert.ok(messages.some(m=>m.type==='transcript'&&m.final&&m.text.toLowerCase().includes(word)));
  await page.screenshot({path:`/tmp/word-prefixes-live-${word}.png`});await bubble.tap();await page.waitForFunction(n=>document.querySelector('.word-bubble-play').dataset.wordLesson===String(n),index+2);
 }
 assert.ok(inputPackets>0);assert.equal(await page.locator('audio.guide-audio').evaluate(a=>a.playbackRate),1.5);
 await page.getByRole('button',{name:'结束单词泡泡'}).tap();
 const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyberjojo.activity-reports.v1'))[0].report);assert.equal(report.completedLessons,3);assert.ok(report.independentWords.includes('blue'));assert.ok(report.guidedWords.includes('red'));assert.ok(report.spokenPhrases.includes('two blue bananas'));
 const before=messages.length;
 await page.evaluate(()=>qaVoiceSockets.at(-1).send(JSON.stringify({type:'text',clientMessageId:crypto.randomUUID(),text:'Hello Domi, what is your favourite fruit?'})));
 // Provider "speaking" can arrive before the canonical TTS audio is ready.
 // Wait for the actual audio packet and its playback element, not that state.
 const responseDeadline=Date.now()+45000;
 const actualReply=()=>messages.slice(before).find(m=>m.type==='speech'&&!m.local&&m.character==='lvdou'&&m.voiceSource==='domi-word-tts-v1');
 while(!actualReply()){assert.ok(Date.now()<responseDeadline,'full conversation returns canonical TTS');await page.waitForTimeout(100);}
 await page.waitForFunction(text=>document.querySelector('audio.guide-audio').dataset.speechText===text,actualReply().text,{timeout:10000});
 assert.equal(messages.slice(before).some(m=>m.type==='speech_start'&&m.character==='lvdou'),false);
 assert.equal(await page.locator('audio.guide-audio').evaluate(a=>a.playbackRate),1.5);assert.deepEqual(errors,[]);
 console.log('PASS: production microphone -> actual ASR -> apple, 2 blue bananas, 3 red oranges -> feeding/report; real full conversation shares prompt voice and 1.5x playback');
}finally{await browser?.close();await rm(directory,{recursive:true,force:true})}
