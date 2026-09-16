import assert from "node:assert/strict";
import test from "node:test";
import { getStickerCropBox } from "./sticker-matting.js";

test("sticker crop preserves a recognised object and adds a safe margin", () => {
  assert.deepEqual(getStickerCropBox(1000, 800, [0.4, 0.25, 0.2, 0.4]), {
    x: 355.2, y: 155.2, width: 289.6, height: 409.6,
  });
});

test("sticker crop never travels outside the camera frame", () => {
  assert.deepEqual(getStickerCropBox(1000, 800, [0.91, 0.88, 0.2, 0.2]), {
    x: 744, y: 584, width: 256, height: 216,
  });
});
