import assert from "node:assert/strict";
import test from "node:test";
import { getCollectionFollowUp, parseVoiceIntent, shouldInspectAfterSpeech } from "./voice-intents.js";

test("fixed heart phrases trigger the heart action", () => {
  assert.deepEqual(parseVoiceIntent("叫叫，给我比个心"), { type: "heart" });
  assert.deepEqual(parseVoiceIntent("我想看你比心"), { type: "heart" });
  assert.equal(parseVoiceIntent("我今天很开心"), null);
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
