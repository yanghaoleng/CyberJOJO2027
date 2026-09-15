import assert from "node:assert/strict";
import test from "node:test";
import { getRecentConversationTopic } from "./conversation-topic.js";

test("recent child speech provides a compact, specific live-caption topic", () => {
  assert.equal(getRecentConversationTopic([
    { role: "user", text: "我想给城堡设计一个会飞的门" },
    { role: "assistant", text: "好呀" },
  ]), "设计城堡");
  assert.equal(getRecentConversationTopic([
    { role: "user", text: "我们搭积木吧" },
    { role: "user", text: "然后再设计一个城堡" },
  ]), "设计城堡");
});

test("a vague conversation keeps the neutral caption fallback", () => {
  assert.equal(getRecentConversationTopic([{ role: "user", text: "你好呀" }]), "");
});
