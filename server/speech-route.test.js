import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createSpeechRequestHandler} from './speech-route.js';
import {DOMI_WORD_VOICE_SOURCE, DOMI_WORD_VOICE_ID} from './character-voice-policy.js';
import {getVolcTtsConfig, synthesizeSpeech} from './volc-tts.js';
function request(body, origin='https://cyberjojo.mikeywa.site') {
 const req=Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);
 req.url='/speech';req.method='POST';req.headers={origin,'content-type':'application/json','x-forwarded-for':'qa'};return req;
}
function response(){return {writeHead(status,headers){this.status=status;this.headers=headers},end(body){this.body=JSON.parse(body)}}}
test('cards, old notes and complete sentences use the word-prompt TTS configuration',async()=>{
 const sent=[];let time=10000;const config=getVolcTtsConfig({VOLC_SPEECH_API_KEY:'fixture'});
 const handler=createSpeechRequestHandler({allowedOrigins:new Set(['https://cyberjojo.mikeywa.site']),ttsConfig:config,now:()=>time,
 synthesize:(text,character,config)=>synthesizeSpeech(text,character,config,async(_url,options)=>{sent.push(JSON.parse(options.body));return{ok:true,text:async()=>JSON.stringify({code:0,data:'bXAz'})}})});
 for(const text of ['Apple.','Hi, I am Domi. Show me what you found.','We found a beautiful green leaf today.']){
  const res=response();await handler(request({text,character:'lvdou',voice:'other-voice'}),res);
  assert.equal(res.status,200);assert.equal(res.body.voiceSource,DOMI_WORD_VOICE_SOURCE);time+=1000;
 }
 assert.ok(sent.every(entry=>entry.req_params.speaker===DOMI_WORD_VOICE_ID));
 assert.deepEqual(sent[0].req_params.audio_params,sent[2].req_params.audio_params);
 const blocked=response();await handler(request({text:'Apple',character:'lvdou'},'https://other.test'),blocked);assert.equal(blocked.status,403);
 const invalid=response();await handler(request({text:'Apple',character:'jiaojiao'}),invalid);assert.equal(invalid.status,400);
 const large=response();await handler(request('x'.repeat(9000)),large);assert.equal(large.status,413);
 assert.equal(sent.length,3);
});
test('voice failure is explicit, never replaced with another audio source',async()=>{
 const handler=createSpeechRequestHandler({allowedOrigins:new Set(['https://cyberjojo.mikeywa.site']),synthesize:async()=>{throw new Error('provider unavailable')}});
 const res=response();await handler(request({text:'Apple',character:'lvdou'}),res);
 assert.equal(res.status,502);assert.equal(res.body.audio,undefined);
});
