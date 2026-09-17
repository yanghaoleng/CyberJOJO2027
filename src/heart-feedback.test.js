import assert from "node:assert/strict";
import test from "node:test";
import { HEART_FEEDBACK_DURATION_MS, getFaceHeartPlacement, getHeartFeedbackFrame } from "./heart-feedback.js";

test("heart feedback enters, pulses, and exits within a bounded duration", () => {
  assert.equal(getHeartFeedbackFrame(0).opacity, 0);
  assert.ok(getHeartFeedbackFrame(800).opacity > 0.9);
  assert.equal(getHeartFeedbackFrame(HEART_FEEDBACK_DURATION_MS).opacity, 0);
});

test("single-heart placement follows the face upper-right and stays inside the frame", () => {
  const placement = getFaceHeartPlacement({ right: .62, top: .2 }, 720, 1280);
  assert.ok(placement.x > 720 * .62);
  assert.ok(placement.y < 1280 * .3);
  const corner = getFaceHeartPlacement({ right: .99, top: .01 }, 720, 1280);
  assert.ok(corner.x + corner.size * 1.22 <= 720);
  assert.ok(corner.y - corner.size * .8 >= 0);
  assert.equal(getFaceHeartPlacement(null, 720, 1280), null);
});
