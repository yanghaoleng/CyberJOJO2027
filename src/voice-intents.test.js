import assert from "node:assert/strict";
import test from "node:test";
import { getCollectionFollowUp, parseVoiceIntent, shouldInspectAfterSpeech, shouldTriggerSceneAnalysis } from "./voice-intents.js";

test("inspection and collection of food do not accidentally launch feeding", () => {
  for (const phrase of ["叫叫看看这个苹果", "这是什么", "帮我看看这盆植物", "你看这个蛋糕", "叫叫看看这本书", "叫叫，看东西"]) {
    assert.equal(shouldTriggerSceneAnalysis(phrase), true);
    assert.equal(parseVoiceIntent(phrase), null);
  }
  assert.equal(parseVoiceIntent("帮我收藏这个苹果").type, "collect");
});

test("fixed heart phrases trigger the heart action", () => {
  assert.deepEqual(parseVoiceIntent("叫叫，给我比个心"), { type: "heart", size: "small" });
  assert.deepEqual(parseVoiceIntent("我想看你比心"), { type: "heart", size: "small" });
  assert.deepEqual(parseVoiceIntent("叫叫，来一个大爱心"), { type: "heart", size: "large" });
  assert.deepEqual(parseVoiceIntent("叫叫，比个花圈"), { type: "wreath" });
  assert.deepEqual(parseVoiceIntent("我要看爱心花圈"), { type: "wreath" });
  assert.equal(parseVoiceIntent("我今天很开心"), null);
});

test("food words begin the share-a-bite interaction", () => {
  for (const text of ["我想吃东西", "我饿了", "我想吃", "这里有美食", "这个好吃的给你",
    "我今天吃了苹果", "早餐吃的面条", "想吃蛋糕", "我喝了牛奶", "午饭是米饭", "给我一个棒棒糖", "汉堡真好吃"]) {
    assert.deepEqual(parseVoiceIntent(text), { type: "feed" }, text);
  }
  assert.equal(parseVoiceIntent("我今天很开心"), null);
  assert.notDeepEqual(parseVoiceIntent("给我比个心"), { type: "feed" });
});

test("natural collection phrases identify the requested object", () => {
  assert.deepEqual(parseVoiceIntent("帮我收集这个小水杯"), { type: "collect", subject: "这个小水杯" });
  assert.deepEqual(parseVoiceIntent("把这盆植物做成一张单词贴纸"), { type: "collect", subject: "这盆植物" });
  assert.deepEqual(parseVoiceIntent("收藏一下"), { type: "collect", subject: "镜头里的这个东西" });
});

test("visual inspection retries only after explicit camera readiness", () => {
  assert.equal(shouldInspectAfterSpeech("我放在中间了，你再看一下", "framing"), true);
  assert.equal(shouldInspectAfterSpeech("我今天在学校很开心", "framing"), false);
  assert.equal(shouldInspectAfterSpeech("你看看这个", "waiting"), true);
  assert.equal(shouldInspectAfterSpeech("你看看这个", "checking"), false);
});

test("collection follow-ups continue the topic", () => {
  assert.match(getCollectionFollowUp("book", "绘本"), /封面|读/);
  assert.match(getCollectionFollowUp("object", "杯子"), /哪里/);
});
