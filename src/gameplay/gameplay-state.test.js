import assert from "node:assert/strict";
import test from "node:test";
import { advanceFrameStability, createRoundGuard, getMouthTarget, isNearMouth, rawPointFromStage, stageBoxFromRaw } from "./gameplay-state.js";

test("mouth hit region uses the supplied actual mouth anchor and rejects distant release", () => {
  const mouth = getMouthTarget({ x: -40, y: 150, width: 250, height: 300, mouthX: 103, mouthY: 221 }, { width: 390, height: 600 });
  assert.equal(mouth.x, 103); assert.equal(mouth.y, 221);
  assert.equal(isNearMouth({ x: 103, y: 221 }, mouth), true);
  assert.equal(isNearMouth({ x: 170, y: 221 }, mouth), false);
  assert.equal(getMouthTarget(null, { width: 1, height: 1 }), null);
});

test("camera selection and returned box agree through cover crop and front-camera mirror", () => {
  const frame = { width: 640, height: 480, mirrored: true };
  const stage = { width: 390, height: 600 };
  const point = rawPointFromStage({ x: 95, y: 300 }, frame, stage);
  assert.equal(point.y, 0.5); assert.equal(point.x, 0.625);
  const box = stageBoxFromRaw([point.x - 0.05, point.y - 0.05, 0.1, 0.1], frame, stage);
  assert.ok(Math.abs(box.x + box.width / 2 - 95) < 0.0001);
  assert.ok(Math.abs(box.y + box.height / 2 - 300) < 0.0001);
  const landscapeFrame = { width: 480, height: 640, mirrored: false };
  const landscape = { width: 800, height: 400 };
  assert.deepEqual(rawPointFromStage({ x: 400, y: 200 }, landscapeFrame, landscape), { x: 0.5, y: 0.5 });
  assert.equal(stageBoxFromRaw([0.9, 0, 0.2, 0.1], frame, stage), null);
});

test("stability gate rejects camera movement even after a stable period", () => {
  let state = advanceFrameStability(null, [100, 100, 100], 0);
  state = advanceFrameStability(state, [101, 100, 101], 600); assert.equal(state.steady, false);
  state = advanceFrameStability(state, [100, 101, 100], 1200); assert.equal(state.steady, true);
  state = advanceFrameStability(state, [180, 180, 180], 1600); assert.equal(state.steady, false);
});

test("a new round and cancellation invalidate outstanding old responses", () => {
  const guard = createRoundGuard();
  const first = guard.next(); assert.equal(guard.isCurrent(first), true);
  const second = guard.next(); assert.equal(guard.isCurrent(first), false); assert.equal(guard.isCurrent(second), true);
  guard.cancel(); assert.equal(guard.isCurrent(second), false);
});
