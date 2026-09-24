import assert from "node:assert/strict";
import test from "node:test";
import { requestScene } from "./scene-request.js";

test("explicit vision requests retry short cooldowns and never wait for inline audio", async () => {
  const requests = [], delays = [];
  const result = await requestScene("/api/vision", { image: "frame" }, {
    wait: async (ms) => delays.push(ms),
    fetchImpl: async (_, options) => {
      requests.push(JSON.parse(options.body));
      return requests.length === 1 ? { status: 429, ok: false, json: async () => ({ retryAfterMs: 750 }) }
        : { status: 200, ok: true, json: async () => ({ ok: true, text: "这是一本绘本" }) };
    },
  });
  assert.deepEqual(delays, [750]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].source, "explicit");
  assert.equal(requests[0].includeAudio, false);
  assert.equal(result.text, "这是一本绘本");
});

test("long cooldowns fail promptly instead of leaving an endless analyzing state", async () => {
  await assert.rejects(requestScene("/api/vision", {}, {
    wait: () => assert.fail("must not wait eight seconds"),
    fetchImpl: async () => ({ status: 429, ok: false, json: async () => ({ retryAfterMs: 8000 }) }),
  }), /429/);
});
