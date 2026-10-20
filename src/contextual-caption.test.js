import assert from "node:assert/strict";
import test from "node:test";
import { getContextualCaption } from "./contextual-caption.js";

test("thumbs up uses mutual-like copy, never a reading streak or conversation topic", () => {
  const caption = getContextualCaption({ gesture: "thumbs_up", day: 18 });
  assert.equal(caption.mode, "contextual");
  assert.equal(caption.text, "叫叫和新用户礼貌互赞");
  assert.equal(caption.interaction, "mutual_like");
  assert.equal(getContextualCaption({ gesture: "thumbs_up", conversationTopic: "读书", characterLabel: "Domi",
    interactionPartner: { kind: "glasses", confidence: .96, personCount: 1 } }).text, "Domi和戴眼镜的朋友礼貌互赞");
});

test("unrelated heart captions retain their existing behavior", () => {
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
