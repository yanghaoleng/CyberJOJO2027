import test from "node:test";
import assert from "node:assert/strict";
import { VoiceHealth, appendVoiceLog } from "./voice-health.js";
const healthy = { visible: true, online: true, ready: true, capture: true };
test("minutes of quiet remain healthy when microphone and heartbeat progress", () => {
  const health = new VoiceHealth();
  for (let now = 2000; now <= 240000; now += 2000) {
    health.packet(now, 0, false, 21);
    assert.equal(health.check(now, healthy), null);
    const id = health.ping(now); if (id) health.pong(now + 10, id);
  }
});
test("missing heartbeat and frozen microphone are classified separately", () => {
  const health = new VoiceHealth(); const id = health.ping(10000);
  health.pong(11000, "stale"); assert.equal(health.pendingPing.id, id);
  health.packet(19000, 0, false, 21);
  assert.equal(health.check(19000, healthy), "connection_timeout");
  health.pong(19001, id);
  assert.equal(health.check(26000, healthy), "microphone_paused");
  assert.equal(health.check(26000, { ...healthy, online: false }), "network_offline");
  assert.equal(health.check(26000, { ...healthy, trackLive: false }), "microphone_interrupted");
});
test("recognition watchdog accepts ongoing long speech and ignores character audio", () => {
  const health = new VoiceHealth();
  for (let now = 21; now < 20000; now += 21) health.packet(now, .08, true, 21);
  assert.equal(health.check(20000, healthy), null);
  for (let now = 20000; now < 22000; now += 21) health.packet(now, .08, false, 21);
  health.packet(39000, 0, false, 21);
  assert.equal(health.check(39000, healthy), "recognition_timeout");
  health.transcript(39001);
  assert.equal(health.check(39002, healthy), null);
});
test("background time cannot create a false watchdog timeout on return", () => {
  const health = new VoiceHealth(); health.ping(10000);
  assert.equal(health.check(300000, { ...healthy, visible: false }), null);
  assert.equal(health.check(300001, healthy), null);
});
test("diagnostic report is bounded and excludes conversation and provider data", () => {
  let log = [];
  for (let i = 0; i < 200; i++) log = appendVoiceLog(log, "fault", { code: "speech_failed", text: "child private text", audio: "secret", apiKey: "secret" });
  assert.equal(log.length, 120); assert.deepEqual(Object.keys(log[0]), ["at", "event", "code"]);
});
