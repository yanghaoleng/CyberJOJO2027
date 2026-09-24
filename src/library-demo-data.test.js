import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_FRIENDS, DEMO_RECORDS, DEMO_TIMELINE } from "./library-demo-data.js";

test("library demo data shows both English word teaching and Jiaojiao idiom creation", () => {
  const domi = DEMO_FRIENDS.filter((friend) => friend.character === "lvdou");
  const jiaojiao = DEMO_FRIENDS.filter((friend) => friend.character === "jiaojiao");
  assert.ok(domi.length >= 2);
  assert.ok(domi.every((friend) => !/[\u3400-\u9fff]/.test(friend.learning || "")));
  assert.equal(jiaojiao.length, 2);
  assert.ok(jiaojiao.every((friend) => friend.nameSource === "user-idiom" && friend.idiom && friend.sourceIdiom));
  assert.ok(jiaojiao.every((friend) => friend.dialogueContext?.some((entry) => entry.role === "user")));
  assert.match(DEMO_RECORDS["2026-09-19"].summary, /刻桌求见/);
  assert.ok(DEMO_TIMELINE.find((day) => day.dayKey === "2026-09-19")?.friends.some((friend) => friend.id === "demo-friend-jiaojiao-bear"));
});
