// Uses the deployed voice bridge and provider. No transcript/socket fixtures.
import WebSocket from 'ws';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.QA_ORIGIN||'https://cyberjojo.mikeywa.site';
const wsUrl=origin.replace(/^http/,'ws')+'/api/voice';
const socket=new WebSocket(wsUrl,{origin});
const timeout=setTimeout(()=>{socket.terminate();throw new Error('TTS sample timed out')},25000);
socket.on('open',()=>socket.send(JSON.stringify({type:'start',inputMode:'text',character:'lvdou',resume:true})));
socket.on('message',async data=>{
 const m=JSON.parse(data);
 if(m.type==='ready')socket.send(JSON.stringify({type:'local_speech',text:'Apple.'}));
 if(m.type==='speech'){
  assert.equal(m.character,'lvdou');assert.ok(m.audio);
  await writeFile('/tmp/domi-apple.mp3',Buffer.from(m.audio,'base64'));
  clearTimeout(timeout);socket.close();console.log('Real DOMI TTS sample saved for microphone path verification');
 }
 if(m.type==='error')throw new Error(m.code);
});
