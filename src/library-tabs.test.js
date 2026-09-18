import test from "node:test";
import assert from "node:assert/strict";
import { getLibraryTabAfterSwipe } from "./library-tabs.js";

test("a left swipe selects the next library tab", () => {
  assert.equal(getLibraryTabAfterSwipe("days", -64), "all");
  assert.equal(getLibraryTabAfterSwipe("all", -64), "friends");
});

test("a right swipe selects the previous library tab", () => {
  assert.equal(getLibraryTabAfterSwipe("friends", 64), "all");
  assert.equal(getLibraryTabAfterSwipe("all", 64), "days");
});

test("short swipes and edge swipes keep the current tab", () => {
  assert.equal(getLibraryTabAfterSwipe("all", 47), "all");
  assert.equal(getLibraryTabAfterSwipe("days", 64), "days");
  assert.equal(getLibraryTabAfterSwipe("friends", -64), "friends");
});
