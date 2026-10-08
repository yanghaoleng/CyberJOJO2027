import test from 'node:test';
import assert from 'node:assert/strict';
import { activityUrl, readActivityMessage } from './activity-contract.js';
const frame = {}, session = 'session-123';
const report = {status:'completed',voiceAttempts:4,menuAttempts:2,completedLessons:3,totalLessons:6,durationSeconds:25,words:['cat','cat','blue'],chapter:'花园'};
const event = (patch = {}) => ({origin:'https://jma.mikeywa.site',source:frame,data:{protocol:'cyberjojo.activity.v1',activityId:'words',sessionId:session,type:'result',report},...patch});
test('the registered activity preserves canonical route and binds the session', () => {
 const url = new URL(activityUrl('words', session)); assert.equal(url.pathname,'/words'); assert.equal(url.searchParams.get('session'),session);
});
test('only the active iframe and session can return a report', () => {
 assert.equal(readActivityMessage(event({origin:'https://attacker.example'}),frame,session),null);
 assert.equal(readActivityMessage(event({source:{}}),frame,session),null);
 assert.equal(readActivityMessage(event(),frame,'other-session'),null);
 assert.deepEqual(readActivityMessage(event(),frame,session).report.words,['cat','blue']);
});
test('unbounded counts and impossible results are rejected', () => {
 for (const patch of [{status:'playing'},{voiceAttempts:-1},{completedLessons:7},{durationSeconds:Infinity},{words:['x'.repeat(41)]}]) {
  assert.equal(readActivityMessage(event({data:{...event().data,report:{...report,...patch}}}),frame,session),null);
 }
});
test('keeps validated word groups and supports earlier ungrouped reports', () => {
 const grouped={...report,wordGroupsVersion:1,independentWords:['blue'],guidedWords:['cat']};
 assert.deepEqual(readActivityMessage(event({data:{...event().data,report:grouped}}),frame,session).report.independentWords,['blue']);
 assert.equal(readActivityMessage(event(),frame,session).report.wordGroupsVersion,undefined);
 for (const patch of [{guidedWords:['blue']},{independentWords:['dragon']},{wordGroupsVersion:2},{guidedWords:null}]) assert.equal(readActivityMessage(event({data:{...event().data,report:{...grouped,...patch}}}),frame,session),null);
});
