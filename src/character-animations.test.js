import assert from "node:assert/strict";
import test from "node:test";
import { CHARACTER_TIMELINES, resolveCharacterAnimation } from "./character-animations.js";

test("compact character keeps gameplay, frighten and OK reactions available", () => {
  const available = ["TalkingEmotion_Curious", "TalkingEmotion_Surprised", "TalkingEmotion_Praise"];
  assert.equal(resolveCharacterAnimation("TalkingEmotion_Expectation", available), available[0]);
  assert.equal(resolveCharacterAnimation("TalkingEmotion_Frighten", available), available[1]);
  assert.equal(resolveCharacterAnimation("TalkingEmotion_Sure", available), available[2]);
});

test("original reactions remain preferred and absent reactions are not reported as playable", () => {
  assert.equal(resolveCharacterAnimation("TalkingEmotion_Sure", ["TalkingEmotion_Sure", "TalkingEmotion_Praise"]), "TalkingEmotion_Sure");
  assert.equal(resolveCharacterAnimation("TalkingEmotion_Sure", []), null);
  assert.equal(resolveCharacterAnimation("Unknown", ["TalkingEmotion_Normal"]), null);
});

test("reserved whole-body reaction falls back until the matching Rive timeline arrives", () => {
  assert.equal(
    resolveCharacterAnimation(CHARACTER_TIMELINES.HEART_FULL_BODY, ["TalkingEmotion_Happy"]),
    "TalkingEmotion_Happy",
  );
  assert.equal(
    resolveCharacterAnimation(CHARACTER_TIMELINES.HEART_FULL_BODY, [CHARACTER_TIMELINES.HEART_FULL_BODY]),
    CHARACTER_TIMELINES.HEART_FULL_BODY,
  );
});
