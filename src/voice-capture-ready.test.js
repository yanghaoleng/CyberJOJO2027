import test from 'node:test';import assert from 'node:assert/strict';import {resumeVoiceCapture} from './voice-capture-ready.js';
test('capture setup bounds blocked resume and supports navigation cancellation',async()=>{
 await resumeVoiceCapture({resume:async()=>{}});
 await assert.rejects(resumeVoiceCapture({resume:()=>new Promise(()=>{})},{timeoutMs:5}),{name:'NotAllowedError'});
 let resumedAfterCancel=false;const controller=new AbortController();const pending=resumeVoiceCapture({resume:()=>{resumedAfterCancel=true;return new Promise(()=>{});}},{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(resumedAfterCancel,false);
 const canceled=new AbortController();canceled.abort();let called=false;await assert.rejects(resumeVoiceCapture({resume:()=>{called=true;}},{signal:canceled.signal}),{name:'AbortError'});assert.equal(called,false);
});
