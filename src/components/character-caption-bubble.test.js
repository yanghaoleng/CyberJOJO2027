import assert from "node:assert/strict";
import test from "node:test";
import { splitCharacterBubbleText } from "./character-caption-bubble.jsx";

test("character bubble keeps at most two compact lines and prefers punctuation breaks", () => {
  assert.deepEqual(splitCharacterBubbleText("我正在认真想一想，马上告诉你答案", 10), ["我正在认真想一想，", "马上告诉你答案"]);
  assert.deepEqual(splitCharacterBubbleText("这是一句没有标点的很长很长的话", 8), ["这是一句没有标点", "的很长很长的话"]);
});
