import assert from "node:assert/strict";
import test from "node:test";
import { getContextualCaption } from "./contextual-caption.js";

test("thumbs up always selects the continuous-learning caption", () => {
  const caption = getContextualCaption({ gesture: "thumbs_up", day: 18 });
  assert.equal(caption.mode, "streak");
  assert.equal(caption.text, "坚持连续学习叫叫阅读第 18 天");
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

test("books keep the default reading-days caption even when classified as an object", () => {
  const caption = getContextualCaption({
    sceneReaction: { category: "object", subject: "一本故事书" },
    fallbackMode: "streak",
    day: 7,
  });
  assert.equal(caption.kind, "day");
  assert.equal(caption.text, "我和叫叫一起阅读的第 07 天");
});
