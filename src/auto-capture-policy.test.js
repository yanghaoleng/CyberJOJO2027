import assert from "node:assert/strict";
import test from "node:test";
import { getTopicCaptureChange } from "./auto-capture-policy.js";

test("auto photos happen on a real topic title change, not a gesture caption or initial paint", () => {
  const defaultCaption = { kind: "subject", text: "我和叫叫一起聊聊天", secondLine: "聊聊天" };
  const pen = { kind: "subject", text: "我和Domi一起发现笔", secondLine: "发现笔" };
  assert.equal(getTopicCaptureChange("", defaultCaption).reason, "");
  assert.equal(getTopicCaptureChange(defaultCaption.text, pen).reason, `topic:${pen.text}`);
  assert.equal(getTopicCaptureChange(pen.text, pen).reason, "");
  assert.deepEqual(getTopicCaptureChange(pen.text, { kind: "day", text: "第3天" }), { title: pen.text, reason: "" });
  assert.equal(getTopicCaptureChange(pen.text, defaultCaption).reason, "");
});
