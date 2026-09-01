import assert from "node:assert/strict";
import test from "node:test";
import { arkInternals, getArkConfig, looksLikeJiaojiaoCommand } from "./ark-command.js";

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

test("command hints distinguish photo chat from action requests", () => {
  assert.equal(looksLikeJiaojiaoCommand("叫叫，比个赞"), true);
  assert.equal(looksLikeJiaojiaoCommand("我们今天一起读书"), false);
});

test("tool arguments accept only the action whitelist", () => {
  assert.equal(arkInternals.parseAction('{"action":"praise"}'), "praise");
  assert.equal(arkInternals.parseAction('{"action":"arbitrary_animation"}'), null);
});

test("character responses require text and discard arbitrary animation names", () => {
  assert.deepEqual(arkInternals.parseCharacterResponse('{"text":"这本书一定很有趣！","action":"happy"}'), {
    text: "这本书一定很有趣！",
    action: "happy",
  });
  assert.deepEqual(arkInternals.parseCharacterResponse('{"text":"我在听呢。","action":"arbitrary_animation"}'), {
    text: "我在听呢。",
    action: null,
  });
  assert.equal(arkInternals.parseCharacterResponse('{"action":"happy"}'), null);
});
