import assert from "node:assert/strict";
import test from "node:test";
import { arkInternals, looksLikeJiaojiaoCommand } from "./ark-command.js";

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
