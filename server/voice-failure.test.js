import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyVoiceFailure} from './voice-failure.js';
test('explicit service authentication failures stop retries without leaking provider payloads',()=>{
 for(const text of ['Unexpected server response: 401','403 Forbidden private payload','Authentication failed','AccessDenied']) { const result=classifyVoiceFailure(new Error(text));assert.equal(result.retryable,false);assert.equal(result.code,'VOICE_AUTH_FAILED');assert.ok(!result.message.includes('private')); }
 for(const text of ['session readiness timeout','upstream session closed','heartbeat timeout','socket hang up'])assert.equal(classifyVoiceFailure(new Error(text)).retryable,true);
});
