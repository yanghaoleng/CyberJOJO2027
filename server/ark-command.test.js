import assert from "node:assert/strict";
import test from "node:test";
import { arkInternals, createCharacterInput, getArkConfig, looksLikeJiaojiaoCommand, sanitizeConversationContext } from "./ark-command.js";

test("vision uses Mini with a separate credential and retains the Lite fallback", () => {
  const config = getArkConfig({ VOLC_ARK_API_KEY: "test-key" });
  assert.equal(config.model, "doubao-seed-2-0-lite-260215");
  assert.equal(config.visionModel, "doubao-seed-2-0-mini-260428");
  assert.equal(config.visionFallbackModel, "doubao-seed-2-0-lite-260215");
  assert.equal(config.visionApiKey, "test-key");
  assert.equal(config.summaryModel, "doubao-seed-2-0-mini-260428");
  assert.equal(config.summaryFallbackModel, "doubao-seed-2-0-lite-260215");
  assert.equal(config.summaryApiKey, "test-key");

  const upgraded = getArkConfig({
    VOLC_ARK_API_KEY: "test-key",
    VOLC_ARK_VISION_API_KEY: "vision-key",
  });
  assert.equal(upgraded.visionApiKey, "vision-key");
  assert.equal(upgraded.visionModel, "doubao-seed-2-0-mini-260428");
  assert.equal(upgraded.visionFallbackModel, "doubao-seed-2-0-lite-260215");
  assert.equal(upgraded.summaryApiKey, "vision-key");
  assert.equal(upgraded.summaryModel, "doubao-seed-2-0-mini-260428");
});

test("conversation context remains bounded and preserves dates and the current utterance ending", () => {
  const context = sanitizeConversationContext({ entries: Array.from({ length: 30 }, (_, i) => ({ role: "user", text: `第${i}次说话` })), moments: [
    { dayKey: "2026-09-08", event: "搭了积木", feeling: "开心" }, { dayKey: "today", event: "bad date" },
  ] });
  assert.equal(context.entries.length, 16);
  assert.equal(context.moments.length, 1);
  const text = "搭积木".repeat(200) + "后来我想再试一次";
  const input = createCharacterInput(text, "jiaojiao", context);
  assert.equal(input.at(-1).content[0].text, text);
  assert.ok(input[1].content[0].text.includes("2026-09-08"));
  assert.ok(input.some((message) => message.content[0].text === "第29次说话"));
});

test("malformed context members are ignored without throwing", () => {
  assert.deepEqual(sanitizeConversationContext(null), { entries: [], moments: [] });
  assert.deepEqual(sanitizeConversationContext({ entries: [null, [], 4, { text: { toString: null } }, { role: "user", text: "保留有效原话" }], moments: [null, [], { dayKey: { toString: null } }] }), {
    entries: [{ id: "", role: "user", text: "保留有效原话", character: "jiaojiao" }], moments: [],
  });
});

test("command hints distinguish photo chat from action requests", () => {
  assert.equal(looksLikeJiaojiaoCommand("叫叫，比个赞"), true);
  assert.equal(looksLikeJiaojiaoCommand("叫叫，给我比个心"), true);
  assert.equal(looksLikeJiaojiaoCommand("我们今天一起读书"), false);
});

test("tool arguments accept only the action whitelist", () => {
  assert.equal(arkInternals.parseAction('{"action":"praise"}'), "praise");
  assert.equal(arkInternals.parseAction('{"action":"heart"}'), "heart");
  assert.equal(arkInternals.parseAction('{"action":"arbitrary_animation"}'), null);
});

test("character responses require text and discard arbitrary animation names", () => {
  assert.deepEqual(arkInternals.parseCharacterResponse('{"text":"这本书一定很有趣！","action":"happy"}'), {
    text: "这本书一定很有趣！",
    action: "happy",
    story: { thread: "none" },
  });
  assert.deepEqual(arkInternals.parseCharacterResponse('{"text":"我在听呢。","action":"arbitrary_animation"}'), {
    text: "我在听呢。",
    action: null,
    story: { thread: "none" },
  });
  assert.equal(arkInternals.parseCharacterResponse('{"action":"happy"}'), null);
});

test("character responses only expose the bounded hidden-story directives", () => {
  assert.deepEqual(arkInternals.parseCharacterResponse('{"text":"拿近一点让我看看。","action":"curious","story":{"thread":"inspect"}}'), {
    text: "拿近一点让我看看。", action: "curious", story: { thread: "inspect" },
  });
  assert.equal(arkInternals.parseCharacterResponse('{"text":"好呀","action":"happy","story":{"thread":"open_browser"}}').story.thread, "none");
});
