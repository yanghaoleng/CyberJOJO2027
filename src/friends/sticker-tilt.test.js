import test from "node:test";
import assert from "node:assert/strict";
import { orientationTilt, pointerTilt } from "./sticker-tilt.js";

test("phone tilt calibrates upright, clamps extremes and ignores missing sensors", () => {
  const neutral = { beta: 70, gamma: 5 };
  assert.deepEqual(orientationTilt(neutral, neutral), { x: 0, y: 0 });
  assert.deepEqual(orientationTilt({ beta: 45, gamma: 30 }, neutral), { x: 1, y: -1 });
  assert.deepEqual(orientationTilt({ beta: 170, gamma: -85 }, neutral), { x: -1, y: 1 });
  assert.equal(orientationTilt({ beta: null, gamma: null }, neutral), null);
  assert.equal(orientationTilt({ beta: NaN, gamma: 3 }, neutral), null);
  assert.equal(orientationTilt({ beta: -179, gamma: 0 }, { beta: 179, gamma: 0 }).y, 2 / 25);
});

test("landscape rotates sensor axes with the screen", () => {
  const value = orientationTilt({ beta: 25, gamma: 0 }, { beta: 0, gamma: 0 }, 90);
  assert.equal(value.x, 1);
  assert.ok(Math.abs(value.y) < .0001);
});

test("each sticker corner maps to its own perspective and out-of-bounds inputs stay bounded", () => {
  const rect = { left: 10, top: 20, width: 100, height: 200 };
  assert.deepEqual(pointerTilt(10, 20, rect), { x: -1, y: -1 });
  assert.deepEqual(pointerTilt(110, 20, rect), { x: 1, y: -1 });
  assert.deepEqual(pointerTilt(10, 220, rect), { x: -1, y: 1 });
  assert.deepEqual(pointerTilt(110, 220, rect), { x: 1, y: 1 });
  assert.deepEqual(pointerTilt(60, 120, rect), { x: 0, y: 0 });
  assert.deepEqual(pointerTilt(-100, 900, rect), { x: -1, y: 1 });
});
