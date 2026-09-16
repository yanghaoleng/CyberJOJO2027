import test from "node:test";
import assert from "node:assert/strict";
import { runCollectionJob } from "./collection-job.js";
import { normalizeFriend, isUnreadCollection } from "./friend-store.js";

const original = new Blob(["camera-photo"], { type: "image/jpeg" });
const sticker = new Blob(["transparent-result"], { type: "image/png" });
const observation = { evaluable: true, label: "水杯", category: "object", bbox: [.2, .2, .4, .5], english: "cup", learning: "杯子可以装水" };
function setup() {
  let current = normalizeFriend({ id: "one", name: "这个杯子", originalBlob: original, status: "pending", createdAt: 100 });
  const writes = [];
  return { get record() { return current; }, writes, save: async (value) => { current = normalizeFriend(value, current); writes.push(current); return current; }, onUpdate() {} };
}
test("failed matting preserves the original and recognition, and retries the same image", async () => {
  const s = setup(); let observations = 0;
  const observe = async () => { observations++; return observation; };
  await assert.rejects(runCollectionJob(s.record, { ...s, observe, matte: async () => { throw new Error("offline"); } }));
  assert.equal(s.record.originalBlob, original);
  assert.equal(s.record.status, "pending"); assert.equal(s.record.attempts, 1);
  assert.equal(s.record.stickerBlob, null); assert.equal(isUnreadCollection(s.record), false);
  const ready = await runCollectionJob(s.record, { ...s, observe, matte: async (input) => { assert.equal(input, original); return sticker; } });
  assert.equal(observations, 1); assert.equal(ready.createdAt, 100);
  assert.equal(ready.originalBlob, original); assert.equal(ready.stickerBlob, sticker);
  assert.equal(isUnreadCollection(ready), true);
  const renamed = normalizeFriend({ name: "小蓝杯" }, ready);
  assert.equal(renamed.english, "cup"); assert.equal(renamed.learning, observation.learning);
  assert.equal(isUnreadCollection({ ...renamed, seenAt: 123 }), false);
});
test("an aborted page leaves a resumable job, and exhaustion retains a retryable original", async () => {
  const s = setup(); const controller = new AbortController();
  await assert.rejects(runCollectionJob(s.record, { ...s, signal: controller.signal, observe: async () => observation, matte: async () => { controller.abort(); return sticker; } }));
  assert.equal(s.record.status, "pending"); assert.equal(s.record.attempts, 0);
  for (let i = 0; i < 3; i++) await assert.rejects(runCollectionJob(s.record, { ...s, matte: async () => { throw new Error("failed"); } }));
  assert.equal(s.record.status, "failed"); assert.equal(s.record.originalBlob, original);
  assert.equal(isUnreadCollection({ stickerBlob: sticker, name: "legacy" }), false);
});
