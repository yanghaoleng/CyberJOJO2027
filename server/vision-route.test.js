import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { createVisionRequestHandler } from "./vision-route.js";

function createRequest({ body = "", method = "POST", origin = "https://cyberjojo.mikeywa.site", ip = "203.0.113.8" } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.url = "/vision";
  request.method = method;
  request.headers = {
    origin,
    "content-type": "application/json",
    "x-forwarded-for": ip,
  };
  request.socket = { remoteAddress: ip };
  return request;
}

function createResponse() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body;
    },
  };
}

test("vision route accepts an allowed origin and returns structured output", async () => {
  const handler = createVisionRequestHandler({
    allowedOrigins: new Set(["https://cyberjojo.mikeywa.site"]),
    arkConfig: { apiKey: "test" },
    now: () => 20_000,
    assessScene: async () => ({
      assessment: {
        evaluable: true,
        category: "dog",
        subject: "小狗",
        tone: "delighted",
        text: "这只小狗好可爱呀！",
        action: "happy",
        repeatKey: "dog:small",
        confidence: 0.92,
      },
      usage: { input_tokens: 640, output_tokens: 48 },
    }),
  });
  const request = createRequest({ body: JSON.stringify({ image: "data:image/jpeg;base64,AAAA" }) });
  const response = createResponse();
  assert.equal(await handler(request, response), true);
  assert.equal(response.status, 200);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "https://cyberjojo.mikeywa.site");
  assert.equal(JSON.parse(response.body).subject, "小狗");
  assert.deepEqual(JSON.parse(response.body).usage, { inputTokens: 640, outputTokens: 48 });
});

test("vision route rejects unknown origins and repeated calls", async () => {
  let currentTime = 30_000;
  const handler = createVisionRequestHandler({
    allowedOrigins: new Set(["https://cyberjojo.mikeywa.site"]),
    arkConfig: { apiKey: "test" },
    now: () => currentTime,
    assessScene: async () => ({ assessment: { evaluable: false }, usage: null }),
  });

  const forbiddenResponse = createResponse();
  await handler(createRequest({ origin: "https://example.test", body: "{}" }), forbiddenResponse);
  assert.equal(forbiddenResponse.status, 403);

  const firstResponse = createResponse();
  await handler(createRequest({ body: "{}" }), firstResponse);
  assert.equal(firstResponse.status, 200);
  currentTime += 1_000;
  const limitedResponse = createResponse();
  await handler(createRequest({ body: "{}" }), limitedResponse);
  assert.equal(limitedResponse.status, 429);
  assert.equal(JSON.parse(limitedResponse.body).code, "VISION_RATE_LIMIT");
});

test("vision route handles browser preflight without invoking the model", async () => {
  const handler = createVisionRequestHandler({
    allowedOrigins: new Set(["https://cyberjojo.mikeywa.site"]),
    arkConfig: { apiKey: "test" },
    assessScene: async () => assert.fail("model should not be called"),
  });
  const response = createResponse();
  await handler(createRequest({ method: "OPTIONS" }), response);
  assert.equal(response.status, 204);
  assert.equal(response.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
});
