import assert from "node:assert/strict";
import test from "node:test";
import {
  createCaptureFingerprint,
  selectRepresentativeCaptures,
} from "./capture-summary.js";

test("representative captures span the whole day", () => {
  const captures = Array.from({ length: 9 }, (_, index) => ({
    id: String(index),
    createdAt: index + 1,
  })).reverse();
  assert.deepEqual(
    selectRepresentativeCaptures(captures).map(({ id }) => id),
    ["0", "3", "5", "8"],
  );
});

test("capture fingerprints include media changes but ignore display urls", () => {
  const captures = [{
    id: "photo-one",
    type: "photo",
    createdAt: 10,
    blob: { size: 120, type: "image/jpeg" },
    url: "blob:first",
  }];
  assert.equal(
    createCaptureFingerprint(captures),
    createCaptureFingerprint([{ ...captures[0], url: "blob:second" }]),
  );
  assert.notEqual(
    createCaptureFingerprint(captures),
    createCaptureFingerprint([{ ...captures[0], blob: { size: 121, type: "image/jpeg" } }]),
  );
});
