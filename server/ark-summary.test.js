import assert from "node:assert/strict";
import test from "node:test";
import {
  parseConversationSummaries,
  summarizeConversationDays,
  validateConversationDays,
} from "./ark-summary.js";

function createSseResponse(events, status = 200) {
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(payload, { status, headers: { "Content-Type": "text/event-stream" } });
}

test("conversation days are bounded and normalized", () => {
  assert.deepEqual(validateConversationDays([{
    dayKey: "2026-09-01",
    entries: [{ role: "user", character: "jiaojiao", text: "  今天看小猫  ", createdAt: 12 }],
  }]), [{
    dayKey: "2026-09-01",
    entries: [{ role: "user", character: "jiaojiao", text: "今天看小猫", createdAt: 12 }],
  }]);
  assert.throws(() => validateConversationDays([]), /1 to 14 days/);
  assert.throws(() => validateConversationDays([{ dayKey: "today", entries: [{ text: "hi" }] }]), /day is invalid/);
});

test("summary parser ignores unknown dates and empty text", () => {
  assert.deepEqual(parseConversationSummaries(JSON.stringify({ summaries: [
    { day_key: "2026-09-01", summary: "聊到了窗边的小猫，叫叫也夸它很可爱。" },
    { day_key: "2026-08-31", summary: "不该出现" },
  ] }), ["2026-09-01"]), [{
    dayKey: "2026-09-01",
    summary: "聊到了窗边的小猫，叫叫也夸它很可爱。",
  }]);
});

test("daily summaries use Mini and return usage", async () => {
  let requestBody;
  let authorization;
  const result = await summarizeConversationDays([{
    dayKey: "2026-09-01",
    entries: [
      { role: "user", text: "这只小猫好可爱", character: "jiaojiao", createdAt: 1 },
      { role: "assistant", text: "它像一团小棉花", character: "jiaojiao", createdAt: 2 },
    ],
  }], {
    endpoint: "https://ark.example.test/responses",
    summaryApiKey: "mini-key",
    summaryModel: "doubao-mini",
  }, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    authorization = options.headers.Authorization;
    return createSseResponse([
      {
        type: "response.function_call_arguments.done",
        arguments: JSON.stringify({ summaries: [{
          day_key: "2026-09-01",
          summary: "聊到了可爱的小猫，叫叫说它像一团小棉花。",
        }] }),
      },
      { type: "response.completed", response: { usage: { input_tokens: 92, output_tokens: 31 } } },
    ]);
  });
  assert.equal(authorization, "Bearer mini-key");
  assert.equal(requestBody.model, "doubao-mini");
  assert.equal(requestBody.thinking.type, "disabled");
  assert.equal(result.summaries[0].dayKey, "2026-09-01");
  assert.deepEqual(result.usage, { input_tokens: 92, output_tokens: 31 });
});

