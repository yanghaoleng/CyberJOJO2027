import assert from "node:assert/strict";
import test from "node:test";
import { correctBrandTranscript } from "./brand-lexicon.js";
import { detectCharacterSwitchCommand } from "./character-switch-command.js";

test("voice commands summon green bean with natural phrasing", () => {
  for (const phrase of [
    "让绿豆出来",
    "把绿豆叫出来",
    "叫绿豆来",
    "切换到绿豆",
    "我想换绿豆",
  ]) assert.equal(detectCharacterSwitchCommand(phrase), "lvdou", phrase);
});

test("voice commands summon Jiaojiao after transcript correction", () => {
  for (const phrase of [
    "让叫叫出来",
    "叫叫回来吧",
    "换上叫叫",
    "请叫叫出场",
  ]) assert.equal(detectCharacterSwitchCommand(phrase), "jiaojiao", phrase);

  const corrected = correctBrandTranscript("让佳佳出来");
  assert.equal(corrected.text, "让叫叫出来");
  assert.equal(detectCharacterSwitchCommand(corrected.text), "jiaojiao");
});

test("character names in ordinary conversation do not switch characters", () => {
  assert.equal(detectCharacterSwitchCommand("绿豆今天好可爱"), null);
  assert.equal(detectCharacterSwitchCommand("我想和叫叫聊天"), null);
});
