import assert from "node:assert/strict";
import test from "node:test";
import { HEART_FEEDBACK_DURATION_MS, getHeartFeedbackFrame } from "./heart-feedback.js";

test("heart feedback enters, pulses, and exits within a bounded duration", () => {
  assert.equal(getHeartFeedbackFrame(0).opacity, 0);
  assert.ok(getHeartFeedbackFrame(800).opacity > 0.9);
  assert.equal(getHeartFeedbackFrame(HEART_FEEDBACK_DURATION_MS).opacity, 0);
});
