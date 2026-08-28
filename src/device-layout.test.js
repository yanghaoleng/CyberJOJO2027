import assert from "node:assert/strict";
import test from "node:test";
import {
  TABLET_CHARACTER_SCALE_MULTIPLIER,
  getCharacterScaleMultiplier,
  isTabletViewport,
} from "./device-layout.js";

test("recognizes portrait and landscape iPad viewports without classifying phones or desktops", () => {
  assert.equal(isTabletViewport({ width: 768, height: 1024, isMobileDevice: true }), true);
  assert.equal(isTabletViewport({ width: 1366, height: 1024, isMobileDevice: true }), true);
  assert.equal(isTabletViewport({ width: 390, height: 844, isMobileDevice: true }), false);
  assert.equal(isTabletViewport({ width: 1024, height: 768, isMobileDevice: false }), false);
});

test("tablet characters use exactly 64 percent of the existing display scale", () => {
  assert.equal(TABLET_CHARACTER_SCALE_MULTIPLIER, 0.64);
  assert.equal(getCharacterScaleMultiplier(true), 0.64);
  assert.equal(getCharacterScaleMultiplier(false), 1);
});
