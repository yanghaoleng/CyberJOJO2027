import assert from "node:assert/strict";
import test from "node:test";
import {
  getUserSpeechBubblePlacement,
  getUserSpeechBubbleSizing,
} from "./speech-bubble-layout.js";

const BASE_LAYOUT = {
  targetWidth: 720,
  targetHeight: 1280,
  bubbleWidth: 280,
  bubbleHeight: 84,
  tailWidth: 26,
  tailHeight: 14,
  fontSize: 28,
};

test("rear-camera transcripts stay visible without a face anchor", () => {
  const placement = getUserSpeechBubblePlacement({
    ...BASE_LAYOUT,
    facingMode: "environment",
    anchor: null,
  });

  assert.equal(placement.placement, "rear-bottom-right");
  assert.ok(placement.bubbleX > BASE_LAYOUT.targetWidth * 0.7);
  assert.ok(placement.bubbleY > BASE_LAYOUT.targetHeight * 0.85);
  assert.ok(placement.tailTipOffset > 0);
});

test("front-camera transcripts still require and point toward a mouth anchor", () => {
  assert.equal(getUserSpeechBubblePlacement({
    ...BASE_LAYOUT,
    facingMode: "user",
    anchor: null,
  }), null);

  const placement = getUserSpeechBubblePlacement({
    ...BASE_LAYOUT,
    facingMode: "user",
    anchor: { x: 0.28, y: 0.58, eyeY: 0.48 },
  });
  assert.equal(placement.placement, "front-mouth");
  assert.ok(placement.tailTipOffset < 0);
});

test("tablet transcript bubbles use smaller type with larger internal breathing room", () => {
  const phone = getUserSpeechBubbleSizing({ targetWidth: 1280, targetHeight: 720 });
  const tablet = getUserSpeechBubbleSizing({
    targetWidth: 1280,
    targetHeight: 720,
    isTabletDevice: true,
  });

  assert.ok(tablet.fontSize < phone.fontSize);
  assert.ok(tablet.maxBubbleWidth < phone.maxBubbleWidth);
  assert.ok(tablet.horizontalPadding / tablet.fontSize > phone.horizontalPadding / phone.fontSize);
  assert.ok(tablet.verticalPadding / tablet.fontSize > phone.verticalPadding / phone.fontSize);
});
