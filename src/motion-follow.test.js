import assert from 'node:assert/strict';
import test from 'node:test';
import { mapMotionPose, createMotionRig, wrapAngle } from './motion-follow.js';
import { parseVoiceIntent } from './voice-intents.js';

test('motion wake words and stop words do not steal declined requests or feeding', () => {
  for (const text of ['叫叫，一二三木头人', '一、二、三，木头人', '叫叫123木头人', '我做什么你做什么', '你跟我学']) assert.deepEqual(parseVoiceIntent(text), { type: 'motion-follow', enabled: true });
  for (const text of ['结束跟随', '退出动作跟随', '不要跟我学']) assert.deepEqual(parseVoiceIntent(text), { type: 'motion-follow', enabled: false });
  assert.equal(parseVoiceIntent('不想玩一二三木头人'), null);
  assert.equal(parseVoiceIntent('给你吃苹果').type, 'feed');
});

test('camera mirroring swaps screen-side arms; partial bodies never fabricate legs', () => {
  const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
  for (const [i,x,y] of [[11,.65,.4],[12,.35,.4],[13,.7,.25],[15,.7,.1],[14,.3,.6],[16,.3,.8],[7,.55,.2],[8,.45,.21]]) p[i]={x,y,visibility:.99,presence:.99};
  const mirror = mapMotionPose(p, { mirrored: true, aspect: 1.5 });
  const raw = mapMotionPose(p, { mirrored: false, aspect: 1.5 });
  assert.ok(mirror.angles.upperL > 0); assert.ok(mirror.angles.upperR < 0);
  assert.ok(raw.angles.upperL < 0); assert.ok(raw.angles.upperR > 0);
  assert.equal(mirror.angles.thighL, null);
  p[11].visibility = .1; assert.equal(mapMotionPose(p), null);
});

test('rig uses actual bones before duplicate group names and restores after loss/disposal', () => {
  const bone = { rotation: Math.PI/2, worldTransform() { return {xx: Math.cos(this.rotation), xy: Math.sin(this.rotation)}; } };
  const instance = { artboard: { bone: name => name === 'IP_CJ_upperarm_L' ? bone : null, node(name) { assert.ok(name.startsWith('IP_CJ_head_'));return null; }, advance() {} }, advanceAndReportChanges() {} };
  const original = instance.advanceAndReportChanges;
  const rig = createMotionRig(instance); rig.install();
  rig.update({angles:{upperL:-Math.PI/2}}, 10);
  for(let i=0;i<10;i++) rig.afterAdvance(10+i*30);
  assert.ok(Math.abs(wrapAngle(bone.rotation+Math.PI/2))<.2);
  rig.afterAdvance(2000); assert.ok(Math.abs(wrapAngle(bone.rotation-Math.PI/2))>.1);
  rig.dispose(); assert.equal(bone.rotation,Math.PI/2); assert.equal(instance.advanceAndReportChanges,original);
});
