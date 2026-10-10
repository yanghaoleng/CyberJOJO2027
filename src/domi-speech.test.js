import test from 'node:test';
import assert from 'node:assert/strict';
import {requestDomiSpeech,createDomiSpeechPlayback} from './domi-speech.js';
import {DOMI_WORD_VOICE_SOURCE} from '../server/character-voice-policy.js';
import {createConversationEntry} from './conversation-journal.js';
test('DOMI requires the word voice identity instead of trusting arbitrary audio',async()=>{
 let body;
 const message=await requestDomiSpeech('Apple',{fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return{ok:true,json:async()=>({ok:true,character:'lvdou',voiceSource:DOMI_WORD_VOICE_SOURCE,audio:'bXAz'})}}});
 assert.equal(body.character,'lvdou');assert.equal(message.voiceSource,DOMI_WORD_VOICE_SOURCE);
 await assert.rejects(requestDomiSpeech('Hello',{fetchImpl:async()=>({ok:true,json:async()=>({ok:true,character:'lvdou',audio:'bXAz'})})}),/Invalid DOMI voice/);
});
test('saved notes preserve verified identity and replay at the same 150 percent without changing pitch',async t=>{
 const original=globalThis.Audio;const players=[];
 globalThis.Audio=class {constructor(url){this.url=url;this.dataset={};players.push(this)}set src(value){this.url=value;this.playbackRate=1}addEventListener(){}async play(){}pause(){}removeAttribute(){}load(){}};
 t.after(()=>{globalThis.Audio=original});
 const blob=new Blob(['voice'],{type:'audio/mpeg'});
 const note=createConversationEntry({text:'I am Domi',character:'lvdou',role:'assistant',source:'leave_note',voiceSource:DOMI_WORD_VOICE_SOURCE,audioBlob:blob});
 assert.equal(note.voiceSource,DOMI_WORD_VOICE_SOURCE);
 const player=createDomiSpeechPlayback();t.after(player.stop);await player.play(note.text,note.audioBlob);
 assert.equal(players[0].playbackRate,1.5);assert.equal(players[0].preservesPitch,true);
 assert.equal(players[0].defaultPlaybackRate,1.5);
});
