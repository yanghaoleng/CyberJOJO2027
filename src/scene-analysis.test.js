import assert from "node:assert/strict";
import test from "node:test";
import {
  SCENE_INITIAL_DELAY_MS,
  SCENE_MIN_REQUEST_INTERVAL_MS,
  advanceSceneGate,
  createSceneFingerprint,
  createSceneGate,
  finishSceneRequest,
  getSceneDifference,
  getVisionCaptureSize,
  shouldShowSceneReaction,
} from "./scene-analysis.js";

function solidImage(red, green, blue, width = 16, height = 16) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = 255;
  }
  return { data, width, height };
}

test("scene fingerprints distinguish large visual changes", () => {
  const dark = createSceneFingerprint(solidImage(20, 20, 20));
  const nearDark = createSceneFingerprint(solidImage(24, 22, 21));
  const bright = createSceneFingerprint(solidImage(230, 210, 190));
  assert.ok(getSceneDifference(dark, nearDark) < 0.045);
  assert.ok(getSceneDifference(dark, bright) > 0.5);
});

test("scene gate waits for a stable frame, cooldown, and genuinely new content", () => {
  const cake = createSceneFingerprint(solidImage(220, 80, 90));
  const cat = createSceneFingerprint(solidImage(80, 120, 190));
  let gate = createSceneGate(0);

  let update = advanceSceneGate(gate, cake, SCENE_INITIAL_DELAY_MS);
  gate = update.state;
  assert.equal(update.shouldRequest, false);

  update = advanceSceneGate(gate, cake, SCENE_INITIAL_DELAY_MS + 1_600);
  gate = update.state;
  assert.equal(update.shouldRequest, true);
  gate = finishSceneRequest(gate, update.fingerprint, true);

  update = advanceSceneGate(gate, cake, SCENE_INITIAL_DELAY_MS + SCENE_MIN_REQUEST_INTERVAL_MS + 2_000);
  gate = update.state;
  assert.equal(update.shouldRequest, false);

  update = advanceSceneGate(gate, cat, SCENE_INITIAL_DELAY_MS + SCENE_MIN_REQUEST_INTERVAL_MS + 3_600);
  gate = update.state;
  assert.equal(update.shouldRequest, false);
  update = advanceSceneGate(gate, cat, SCENE_INITIAL_DELAY_MS + SCENE_MIN_REQUEST_INTERVAL_MS + 5_200);
  assert.equal(update.shouldRequest, true);
});

test("failed requests can retry after cooldown and reaction keys are suppressed", () => {
  const scene = createSceneFingerprint(solidImage(100, 150, 80));
  let gate = createSceneGate(0);
  gate = advanceSceneGate(gate, scene, SCENE_INITIAL_DELAY_MS).state;
  const first = advanceSceneGate(gate, scene, SCENE_INITIAL_DELAY_MS + 1_600);
  gate = finishSceneRequest(first.state, first.fingerprint, false);
  const retry = advanceSceneGate(gate, scene, first.state.lastRequestAt + SCENE_MIN_REQUEST_INTERVAL_MS);
  assert.equal(retry.shouldRequest, true);

  const history = new Map([["cat:orange", 10_000]]);
  assert.equal(shouldShowSceneReaction(history, "cat:orange", 20_000), false);
  assert.equal(shouldShowSceneReaction(history, "cat:black", 20_000), true);
});

test("vision capture sizing preserves aspect ratio without upscaling", () => {
  assert.deepEqual(getVisionCaptureSize(1280, 720), { width: 640, height: 360 });
  assert.deepEqual(getVisionCaptureSize(360, 640), { width: 360, height: 640 });
  assert.deepEqual(getVisionCaptureSize(0, 0), { width: 0, height: 0 });
});
