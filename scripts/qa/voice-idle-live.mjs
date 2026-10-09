// Real provider test: 55 seconds of PCM silence, then a spoken Apple sample.
// Set QA_AUDIO_FILE to a mono 16 kHz s16le PCM file; no transcript fixtures.
import WebSocket from 'ws';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const audio=await readFile(process.env.QA_AUDIO_FILE || '/tmp/domi-apple-16k.pcm');
const origin = process.env.QA_ORIGIN || 'https://cyberjojo.mikeywa.site';
const socket=new WebSocket(origin.replace(/^http/, 'ws') + '/api/voice', {origin});
const silence=Buffer.alloc(640);let pump,heartbeat,pongs=0,nativePings=0,readyAt=0,offset=-1,finished=false;
const timeout=setTimeout(()=>done(new Error('Idle recovery live test timed out')),85000);
function done(error){if(finished)return;finished=true;clearTimeout(timeout);clearInterval(pump);clearInterval(heartbeat);socket.close();if(error){console.error(error);process.exitCode=1}else console.log('PASS: 55 seconds real quiet audio, browser/provider heartbeat, then actual Apple PCM recognized; no reconnection required');}
socket.on('error',done);socket.on('close',()=>{if(!finished)done(new Error('Live connection closed during quiet wait'));});
socket.on('ping',()=>nativePings++);
socket.on('open',()=>socket.send(JSON.stringify({type:'start',inputMode:'voice',character:'lvdou',resume:true})));
socket.on('message',data=>{
 const m=JSON.parse(data);
 if(m.type==='error')return done(new Error('Live provider reported '+m.code+' stage '+m.stage));
 if(m.type==='ready'){
  readyAt=Date.now();socket.send(JSON.stringify({type:'interaction_mode',mode:'feed'}));
  heartbeat=setInterval(()=>socket.send(JSON.stringify({type:'ping',id:String(Date.now())})),10000);
  pump=setInterval(()=>{if(socket.readyState!==1)return;if(Date.now()-readyAt>=55000&&offset<0)offset=0;
   if(offset>=0&&offset<audio.length){socket.send(audio.subarray(offset,offset+640));offset+=640;}else socket.send(silence);
  },20);console.log('Live quiet session ready');
 }
 if(m.type==='pong')pongs++;
 if(m.type==='transcript'&&m.final&&/apple/i.test(m.text)){
  assert.ok(Date.now()-readyAt>=55000);assert.ok(pongs>=5);assert.ok(nativePings>=2);done();
 }
});
