import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceReconnect, voiceConnectionMessage } from './voice-reconnect.js';
function fixture() {
  let now=0,id=0,restarts=0,eligible=true; const timers=new Map(),states=[];
  const owner=new VoiceReconnect({restart:()=>restarts++,onChange:s=>states.push(s),eligible:()=>eligible,random:()=>.5,now:()=>now,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimer:id=>timers.delete(id)});
  const advance=ms=>{const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
  return {owner,timers,states,advance,restarts:()=>restarts,eligible:value=>eligible=value};
}
test('one jittered backoff timer, no duplicate recovery, unlimited retries capped safely',()=>{
 const f=fixture();f.owner.connecting();
 for(let i=1;i<=25;i++){f.owner.failed();f.owner.failed();assert.equal(f.timers.size,1);assert.equal(f.owner.attempt,i);const delay=f.owner.state.nextAt;assert.ok(voiceConnectionMessage(f.owner.state,delay-1000).includes('1 秒'));f.advance(36000);assert.equal(f.restarts(),i);f.owner.connecting();}
 f.owner.stop();assert.equal(f.timers.size,0);
});
test('offline and hidden periods do not consume attempts; recovery wakes once',()=>{
 const f=fixture();f.owner.connecting();f.owner.failed();f.owner.environment({online:false});f.advance(300000);assert.equal(f.restarts(),0);assert.equal(f.owner.attempt,1);assert.equal(f.owner.state.phase,'offline');
 f.owner.environment({online:true,visible:false});assert.equal(f.owner.state.phase,'hidden');f.owner.environment({visible:true});f.owner.environment({visible:true});f.advance(0);assert.equal(f.restarts(),1);assert.equal(f.timers.size,0);
});
test('only stable readiness resets flapping backoff; quiet background connections survive',()=>{
 const f=fixture();f.owner.connecting();f.owner.failed();f.advance(1000);f.owner.ready();f.advance(1000);f.owner.failed();assert.equal(f.owner.attempt,2);f.advance(3000);f.owner.ready();f.owner.environment({visible:false});assert.equal(f.owner.state.phase,'connected');f.advance(30001);assert.equal(f.owner.attempt,0);
});
test('close, rapid navigation and blocked permission/auth never auto restart',()=>{
 const f=fixture();f.owner.connecting();f.owner.failed();f.owner.stop();f.owner.environment({online:false});f.owner.environment({online:true});f.advance(300000);assert.equal(f.restarts(),0);assert.equal(f.timers.size,0);
 for(const code of ['voice_auth_failed','microphone_permission','microphone_missing']){f.owner.connecting();f.owner.block(code);f.owner.failed();f.owner.environment({online:false});f.owner.environment({online:true});f.advance(300000);assert.equal(f.owner.state.phase,'blocked');assert.equal(f.restarts(),0);assert.ok(voiceConnectionMessage(f.owner.state));}
 f.owner.stop();assert.equal(voiceConnectionMessage(f.owner.state),'');
});
test('ended/disabled device cannot reopen microphone from retry',()=>{
 const f=fixture();f.owner.connecting();f.owner.failed();f.eligible(false);f.advance(2000);assert.equal(f.restarts(),0);assert.equal(f.owner.state.code,'microphone_interrupted');
});


test('native browser timers retain their global receiver',()=>{
 const set=globalThis.setTimeout,clear=globalThis.clearTimeout;
 try {
  globalThis.setTimeout=function(){assert.equal(this,globalThis);return 1;};
  globalThis.clearTimeout=function(){assert.equal(this,globalThis);};
  const owner=new VoiceReconnect();owner.connecting();owner.ready();owner.stop();
 } finally {globalThis.setTimeout=set;globalThis.clearTimeout=clear;}
});
