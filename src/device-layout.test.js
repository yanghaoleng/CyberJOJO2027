import assert from "node:assert/strict";
import test from "node:test";
import {
  CHARACTER_LEFT_OVERFLOW_RATIO,
  TABLET_CHARACTER_SCALE_MULTIPLIER,
  getCharacterScaleMultiplier,
  getTabletThinkingIndicatorPosition,
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

test("tablet thinking indicator follows the scaled character head anchor", () => {
  assert.equal(CHARACTER_LEFT_OVERFLOW_RATIO, 0.045);
  const portrait = getTabletThinkingIndicatorPosition("portrait");
  const landscape = getTabletThinkingIndicatorPosition("landscape");

  assert.ok(Math.abs(portrait.left - 13.1) < 0.001);
  assert.ok(Math.abs(portrait.bottom - 21.76) < 0.001);
  assert.ok(Math.abs(landscape.left - 16.3) < 0.001);
  assert.ok(Math.abs(landscape.bottom - 46.08) < 0.001);
});
