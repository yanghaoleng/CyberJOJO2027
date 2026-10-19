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

test("health connector example is the newest simulated day and keeps unknown breakfast distinct", async () => {
  const { DEMO_HEALTH } = await import("./health-demo-data.js");
  assert.equal(DEMO_TIMELINE[0].dayKey, DEMO_HEALTH.dayKey);
  assert.equal(DEMO_TIMELINE[0].health.id, DEMO_HEALTH.id);
  assert.equal(DEMO_RECORDS[DEMO_HEALTH.dayKey].source, "demo-health");
  assert.match(DEMO_HEALTH.mealStatus, /尚未确认/);
  assert.match(DEMO_HEALTH.explanation, /不等于/);
  assert.match(DEMO_HEALTH.voice, /身边的大人/);
  assert.match(DEMO_HEALTH.symptoms, /主动说/);
  assert.ok(DEMO_HEALTH.metrics.every(metric => metric.source));
  assert.equal(DEMO_HEALTH.pushStatus, "已向家长发送紧急通知");
  assert.match(DEMO_HEALTH.explanation, /不能确诊/);
});
