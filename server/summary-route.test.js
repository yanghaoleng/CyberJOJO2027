import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { createSummaryRequestHandler } from "./summary-route.js";

function createRequest({ body = "", method = "POST", origin = "https://cyberjojo.mikeywa.site", ip = "203.0.113.9" } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.url = "/conversation-summary";
  request.method = method;
  request.headers = { origin, "content-type": "application/json", "x-forwarded-for": ip };
  request.socket = { remoteAddress: ip };
  return request;
}

function createResponse() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; },
    end(body = "") { this.body = body; },
  };
}

test("summary route returns Mini summaries for an allowed origin", async () => {
  const handler = createSummaryRequestHandler({
    allowedOrigins: new Set(["https://cyberjojo.mikeywa.site"]),
    arkConfig: { summaryModel: "mini" },
    now: () => 20_000,
    summarizeDays: async (days) => ({
      summaries: [{ dayKey: days[0].dayKey, summary: "聊了今天看到的小猫。", source: "dialogue" }],
      usage: { input_tokens: 20, output_tokens: 8 },
    }),
  });
  const response = createResponse();
  await handler(createRequest({ body: JSON.stringify({ days: [{ dayKey: "2026-09-01", entries: [{ text: "小猫" }] }] }) }), response);
  assert.equal(response.status, 200);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://cyberjojo.mikeywa.site");
  assert.equal(JSON.parse(response.body).summaries[0].dayKey, "2026-09-01");
  assert.equal(JSON.parse(response.body).summaries[0].source, "dialogue");
  assert.deepEqual(JSON.parse(response.body).usage, { inputTokens: 20, outputTokens: 8 });
});

test("summary route rejects unknown origins and repeated requests", async () => {
  let currentTime = 30_000;
  const handler = createSummaryRequestHandler({
    allowedOrigins: new Set(["https://cyberjojo.mikeywa.site"]),
    arkConfig: {},
    now: () => currentTime,
    summarizeDays: async () => ({ summaries: [{ dayKey: "2026-09-01", summary: "概要" }] }),
  });
  const forbidden = createResponse();
  await handler(createRequest({ origin: "https://example.test", body: "{}" }), forbidden);
  assert.equal(forbidden.status, 403);
  const first = createResponse();
  await handler(createRequest({ body: "{}" }), first);
  assert.equal(first.status, 200);
  currentTime += 1_000;
  const limited = createResponse();
  await handler(createRequest({ body: "{}" }), limited);
  assert.equal(limited.status, 429);
  assert.equal(JSON.parse(limited.body).code, "SUMMARY_RATE_LIMIT");
});
