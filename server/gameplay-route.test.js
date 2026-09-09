import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { createGameplayRequestHandler } from "./gameplay-route.js";

const origin = "https://cyberjojo.mikeywa.site";
const payload = { source: "food", image: "data:image/jpeg;base64,c21hbGw=", roundId: "r1", frameId: "f1" };
function req({ body = JSON.stringify(payload), method = "POST", headers = {}, url = "/gameplay" } = {}) {
  const request = Readable.from([Buffer.from(body)]);
  Object.assign(request, { method, url, headers: { origin, "content-type": "application/json", ...headers }, socket: { remoteAddress: "127.0.0.1" } });
  return request;
}
function res() { return { status: 0, body: "", headers: {}, writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } }; }

test("route validates origin, JSON and size before making any paid request", async () => {
  let calls = 0;
  const handler = createGameplayRequestHandler({ allowedOrigins: new Set([origin]), maxBodyBytes: 500, assess: async () => { calls += 1; return {}; } });
  for (const [input, status] of [[{ headers: { origin: "https://wrong.test" } }, 403], [{ body: "not JSON" }, 400], [{ body: "{}" }, 400], [{ body: "x".repeat(501) }, 413], [{ headers: { "content-type": "text/plain" } }, 415]]) {
    const response = res(); await handler(req(input), response); assert.equal(response.status, status);
  }
  const response = res(); await handler(req({ method: "OPTIONS" }), response); assert.equal(response.status, 204);
  assert.equal(calls, 0);
});

test("active gameplay requests have their own short cooldown, rolling cap and recovery", async () => {
  let time = 10_000, calls = 0;
  const handler = createGameplayRequestHandler({ allowedOrigins: new Set([origin]), now: () => time, minIntervalMs: 1500, maxRequestsPerMinute: 2,
    assess: async () => { calls += 1; return { evaluable: true, foodId: "apple" }; } });
  const first = res(); await handler(req(), first); assert.equal(first.status, 200);
  assert.equal(JSON.parse(first.body).roundId, "r1"); assert.equal(JSON.parse(first.body).frameId, "f1");
  time += 500;
  const limited = res(); await handler(req(), limited); assert.equal(limited.status, 429); assert.equal(JSON.parse(limited.body).retryAfterMs, 1000);
  time += 1000;
  const second = res(); await handler(req(), second); assert.equal(second.status, 200);
  time += 1500;
  const capped = res(); await handler(req(), capped); assert.equal(capped.status, 429);
  time += 60_000;
  const recovered = res(); await handler(req(), recovered); assert.equal(recovered.status, 200); assert.equal(calls, 3);
});

test("concurrent same-IP requests are rejected and failed calls release their slot", async () => {
  let finish, calls = 0, time = 20_000;
  const handler = createGameplayRequestHandler({ allowedOrigins: new Set([origin]), now: () => time, assess: async () => {
    calls += 1;
    if (calls === 1) return new Promise((resolve) => { finish = resolve; });
    throw new Error("private image/key content must not appear");
  } });
  const first = res(); const pending = handler(req(), first);
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  const simultaneous = res(); await handler(req(), simultaneous); assert.equal(simultaneous.status, 429);
  finish({ evaluable: false }); await pending;
  time += 2000;
  const failure = res(); await handler(req(), failure); assert.equal(failure.status, 502); assert.equal(failure.body.includes("private"), false);
  time += 2000;
  const retry = res(); await handler(req(), retry); assert.equal(retry.status, 502); assert.equal(calls, 3);
});
