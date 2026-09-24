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

test("missing either companion and saying Domi switches by voice", () => {
  for (const phrase of ["我想叫叫了", "想要见叫叫", "I miss Jiaojiao"]) assert.equal(detectCharacterSwitchCommand(phrase), "jiaojiao", phrase);
  for (const phrase of ["我想绿豆了", "想要见Domi", "I want to see Domi"]) assert.equal(detectCharacterSwitchCommand(phrase), "lvdou", phrase);
  assert.equal(detectCharacterSwitchCommand("今天我和绿豆看了一本书"), null);
});

test("calling either companion by name alone also switches", () => {
  for (const phrase of ["叫叫", "Jiaojiao!"]) assert.equal(detectCharacterSwitchCommand(phrase), "jiaojiao", phrase);
  for (const phrase of ["绿豆", "Domi!"]) assert.equal(detectCharacterSwitchCommand(phrase), "lvdou", phrase);
});
