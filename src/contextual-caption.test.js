import assert from "node:assert/strict";
import test from "node:test";
import { getContextualCaption } from "./contextual-caption.js";

test("thumbs up and heart always select the continuous-learning caption", () => {
  const caption = getContextualCaption({ gesture: "thumbs_up", day: 18 });
  assert.equal(caption.mode, "streak");
  assert.equal(caption.text, "坚持连续学习叫叫阅读第 18 天");
  assert.equal(getContextualCaption({ gesture: "heart", day: 18 }).mode, "streak");
});

test("food and toys receive specific activity captions", () => {
  assert.deepEqual(getContextualCaption({
    sceneReaction: { category: "dessert", subject: "草莓蛋糕" },
    characterLabel: "叫叫",
    day: 1,
  }), {
    kind: "subject",
    mode: "contextual",
    firstLine: "我和叫叫一起",
    secondLine: "打卡草莓蛋糕",
    text: "我和叫叫一起打卡草莓蛋糕",
  });
  assert.equal(getContextualCaption({
    sceneReaction: { category: "toy", subject: "积木" },
    characterLabel: "绿豆",
    day: 1,
  }).text, "我和绿豆一起玩积木");
});

test("books and idle states stay contextual instead of showing a reading count", () => {
  const caption = getContextualCaption({
    sceneReaction: { category: "object", subject: "一本故事书" },
    fallbackMode: "streak",
    day: 7,
  });
  assert.equal(caption.kind, "subject");
  assert.equal(caption.text, "我和叫叫一起聊一本故事书");
  assert.equal(getContextualCaption({ characterLabel: "叫叫", day: 7 }).text, "我和叫叫一起聊聊天");
});

test("a recent conversation topic takes precedence over camera recognition", () => {
  const caption = getContextualCaption({
    characterLabel: "叫叫",
    conversationTopic: "设计城堡",
    sceneReaction: { category: "toy", subject: "积木" },
  });
  assert.equal(caption.text, "我和叫叫一起设计城堡");
});
