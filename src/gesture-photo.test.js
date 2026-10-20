import test from "node:test";
import assert from "node:assert/strict";
import { respondToCameraGesture, resolveGestureCaption, encodePhoto } from "./gesture-photo.js";
import { advanceGestureTracker, createGestureTracker } from "./gesture-recognition.js";
import { persistMediaCaptureWithRetry } from "./media-library.js";

test("a stable thumbs-up takes one photo; release and repeat takes another even inside the topic cooldown", () => {
  let tracker = createGestureTracker(), photos = 0, replies = 0;
  const frame = (gesture, now) => {
    const update = advanceGestureTracker(tracker, gesture, now);
    tracker = update.state;
    if (update.trigger) respondToCameraGesture(update.trigger, {
      playAnimation: () => { replies++; return true; }, capturePhoto: () => { photos++; },
    });
  };
  for (let at = 0; at < 5000; at += 180) frame("thumbs_up", at);
  assert.equal(photos, 1);
  frame(null, 5000); frame(null, 5180);
  frame("thumbs_up", 5400); frame("thumbs_up", 5580); frame("thumbs_up", 5760);
  assert.equal(photos, 2); assert.equal(replies, 2);
});

test("missing or throwing Rive animation never prevents the immediate photo", () => {
  for (const playAnimation of [() => false, () => { throw new Error("Rive unavailable"); }]) {
    let captured = false;
    assert.equal(respondToCameraGesture("thumbs_up", { playAnimation, capturePhoto: () => { captured = true; } }), false);
    assert.equal(captured, true);
  }
  let count = 0;
  respondToCameraGesture("heart_small", { playAnimation: () => true, capturePhoto: () => count++ });
  assert.equal(count, 0);
});

test("partner recognition uses bounded visual labels, not arbitrary or sensitive model text", async () => {
  const caption = await resolveGestureCaption({ characterLabel: "叫叫", identifyPartner: async () => ({ kind: "blue_clothes", confidence: .95, personCount: 1 }) });
  assert.equal(caption.text, "叫叫和穿蓝衣的朋友礼貌互赞");
  for (const partner of [null, { kind: "glasses", confidence: .5, personCount: 1 }, { kind: "hat", confidence: .99, personCount: 2 }, { kind: "英俊男性", confidence: 1, personCount: 1 }]) {
    assert.equal((await resolveGestureCaption({ characterLabel: "叫叫", identifyPartner: async () => partner })).text, "叫叫和新用户礼貌互赞");
  }
});

test("offline and stalled vision never block a local photo; timeout cancels the request", async () => {
  const offline = await resolveGestureCaption({ characterLabel: "叫叫", identifyPartner: async () => { throw new Error("offline"); } });
  assert.equal(offline.text, "叫叫和新用户礼貌互赞");
  let signal;
  const stalled = await resolveGestureCaption({ characterLabel: "叫叫", timeoutMs: 5, identifyPartner: (value) => { signal = value; return new Promise(() => {}); } });
  assert.equal(stalled.text, offline.text); assert.equal(signal.aborted, true);
});

test("null or empty JPEG encoding retries, then falls back to PNG", async () => {
  const calls = [], photo = new Blob(["photo"], { type: "image/png" });
  assert.equal(await encodePhoto({ toBlob(resolve, type) { calls.push(type); resolve(calls.length < 3 ? null : photo); } }), photo);
  assert.deepEqual(calls, ["image/jpeg", "image/jpeg", "image/png"]);
  await assert.rejects(encodePhoto({ toBlob(resolve) { resolve(new Blob([])); } }), /encoding failed/);
});

test("encoding and transient persistence failure leave exactly one committed capture with the event caption", async () => {
  const caption = await resolveGestureCaption({ characterLabel: "叫叫", identifyPartner: async () => null });
  const blob = await encodePhoto({ toBlob(resolve) { resolve(new Blob(["frozen thumbs-up frame"])); } });
  const capture = { id: "gesture-one", blob, createdAt: 12, source: "gesture:thumbs_up", captionText: caption.text };
  const stored = new Map(), delays = []; let attempts = 0;
  await persistMediaCaptureWithRetry(capture, {
    store: async value => { attempts++; if (attempts === 1) throw new Error("transaction aborted"); stored.set(value.id, value); return true; },
    wait: async ms => delays.push(ms),
  });
  assert.equal(attempts, 2); assert.equal(stored.size, 1);
  assert.equal(stored.get("gesture-one").captionText, "叫叫和新用户礼貌互赞");
  assert.deepEqual(delays, [150]);
});

test("unavailable storage and quota errors cannot report persistence success", async () => {
  let attempts = 0;
  await assert.rejects(persistMediaCaptureWithRetry({ id: "one" }, { store: async () => { attempts++; return false; }, wait: async () => {} }), /unavailable/);
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(persistMediaCaptureWithRetry({ id: "one" }, { store: async () => { attempts++; throw new DOMException("Full", "QuotaExceededError"); } }), { name: "QuotaExceededError" });
  assert.equal(attempts, 1);
});
