import assert from "node:assert/strict";
import test from "node:test";
import {
  parseConversationSummaries,
  summarizeConversationDays,
  validateConversationDays,
  validateJournalMoments,
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
    entries: [{ id: "2026-09-01-entry-0", role: "user", source: "child_speech", character: "jiaojiao", text: "今天看小猫", createdAt: 12 }],
    image: "",
    source: "dialogue",
  }]);
  assert.throws(() => validateConversationDays([]), /1 to 14 days/);
  assert.throws(() => validateConversationDays([{ dayKey: "today", entries: [{ text: "hi" }] }]), /day is invalid/);
  assert.throws(() => validateConversationDays([{ dayKey: "2026-09-01", entries: [] }]), /no usable source/);
  assert.equal(validateConversationDays([{
    dayKey: "2026-09-01",
    entries: [],
    image: "data:image/jpeg;base64,/9j/2Q==",
  }])[0].source, "captures");
});

test("journal moments require verbatim child evidence and never infer an unspoken feeling", () => {
  const entries = [
    { id: "child-1", role: "user", source: "child_speech", text: "今天积木倒了。我想再搭一次。" },
    { id: "ai-1", role: "assistant", text: "你一定很难过吧" },
    { id: "game-1", role: "user", source: "gameplay", text: "它叫今天积木倒了" },
  ];
  const result = validateJournalMoments([
    { event: "今天积木倒了", feeling: "很难过", thought: "我想再搭一次", evidence_quote: entries[0].text, source_entry_ids: ["child-1", "ai-1"] },
    { event: "你一定很难过", feeling: "难过", evidence_quote: entries[1].text, source_entry_ids: ["ai-1"] },
    { event: "后来成功了", evidence_quote: entries[0].text, source_entry_ids: ["child-1"] },
    { event: "今天积木倒了", evidence_quote: "今天积木倒了", source_entry_ids: ["missing-id", "game-1"] },
  ], entries, "2026-09-09");
  assert.equal(result.length, 1);
  assert.equal(result[0].event, "今天积木倒了");
  assert.equal(result[0].feeling, "");
  assert.equal(result[0].thought, "我想再搭一次");
  assert.deepEqual(result[0].sourceEntryIds, ["child-1"]);
});

test("summary input keeps long utterance endings and excludes forgotten or gameplay entries", () => {
  const text = "今天" + "搭积木".repeat(200) + "后来我很开心";
  const result = validateConversationDays([{ dayKey: "2026-09-09", suppressedEntryIds: ["forgotten"], entries: [
    { id: "long", role: "user", text }, { id: "forgotten", text: "不要再提这件事" }, { id: "toy", source: "gameplay", text: "它叫球球" },
  ] }]);
  assert.equal(result[0].entries.length, 1);
  assert.equal(result[0].entries[0].text, text);
  assert.ok(result[0].entries[0].text.endsWith("后来我很开心"));
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

test("photo-only days send one low-detail collage to Mini", async () => {
  let requestBody;
  const result = await summarizeConversationDays([{
    dayKey: "2026-09-01",
    entries: [],
    image: "data:image/jpeg;base64,/9j/2Q==",
  }], {
    endpoint: "https://ark.example.test/responses",
    summaryApiKey: "mini-key",
    summaryModel: "doubao-mini",
  }, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return createSseResponse([{
      type: "response.function_call_arguments.done",
      arguments: JSON.stringify({ summaries: [{
        day_key: "2026-09-01",
        summary: "一位小女孩拍到了桌上的绘本和一只彩色玩具。",
      }] }),
    }]);
  });
  const imageInput = requestBody.input[1].content.find(({ type }) => type === "input_image");
  assert.deepEqual(imageInput, {
    type: "input_image",
    image_url: "data:image/jpeg;base64,/9j/2Q==",
    detail: "low",
  });
  assert.equal(result.summaries[0].source, "captures");
  assert.equal(result.summaries[0].summary, "画面中的人物拍到了桌上的绘本和一只彩色玩具。");
});
