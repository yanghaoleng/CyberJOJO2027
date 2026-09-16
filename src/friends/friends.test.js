import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFriend } from "./friend-store.js";
import { parseToyDialogue } from "./toy-dialogue.js";

test("toy names can be corrected and confirmation only saves the review stage", () => {
  assert.deepEqual(parseToyDialogue("它叫球球"), { type: "name", name: "球球" });
  assert.deepEqual(parseToyDialogue("不叫球球，叫圆圆"), { type: "name", name: "圆圆" });
  assert.deepEqual(parseToyDialogue("不是小熊，是小狗"), { type: "kind", kind: "小狗" });
  assert.deepEqual(parseToyDialogue("确认收藏", "review"), { type: "confirm" });
  assert.equal(parseToyDialogue("确认收藏", "details"), null);
  assert.deepEqual(parseToyDialogue("取消", "review"), { type: "cancel" });
  assert.deepEqual(parseToyDialogue("这是之前的球球"), { type: "existing", name: "球球" });
  assert.deepEqual(parseToyDialogue("它每天陪我睡觉", "review"), { type: "description", text: "它每天陪我睡觉" });
});

test("friend collections own their sticker bytes and update without losing their original creation date", () => {
  const portraitBlob = new Blob(["photo"], { type: "image/jpeg" });
  const first = normalizeFriend({ id: "f1", name: "球球", portraitBlob, createdAt: 100 });
  assert.equal(first.portraitBlob, portraitBlob); assert.equal("captureId" in first, false);
  const updated = normalizeFriend({ name: "圆圆", kind: "玩偶" }, first);
  assert.equal(updated.id, "f1"); assert.equal(updated.createdAt, 100); assert.equal(updated.stickerBlob, portraitBlob); assert.equal(updated.version, 2);
  assert.throws(() => normalizeFriend({ name: "", portraitBlob }), /名字/);
  assert.throws(() => normalizeFriend({ name: "球球", portraitBlob: new Blob(["not a photo"]) }), /照片/);
});
