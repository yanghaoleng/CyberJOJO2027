import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createMattingRequestHandler } from "./matting-route.js";

test("matting gateway bounds uploads and origin before forwarding, and streams a PNG without caching", async () => {
  let calls = 0;
  const handle = createMattingRequestHandler({ allowedOrigins: new Set(["https://cyberjojo.mikeywa.site"]), fetchImpl: async (_url, options) => { calls++; assert.equal(options.body.toString(), "jpeg"); return new Response(new Uint8Array([137,80,78,71]), { headers: { "Content-Type": "image/png" } }); } });
  const server = http.createServer(async (req, res) => { if (!await handle(req, res)) { res.writeHead(404); res.end(); } });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/matting`;
  const headers = { Origin: "https://cyberjojo.mikeywa.site", "Content-Type": "image/jpeg" };
  try {
    assert.equal((await fetch(url, { method: "POST", headers: { ...headers, Origin: "https://elsewhere.test" }, body: "jpeg" })).status, 403);
    assert.equal(calls, 0);
    assert.equal((await fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: "jpeg" })).status, 415);
    const result = await fetch(url, { method: "POST", headers, body: "jpeg" });
    assert.equal(result.status, 200); assert.equal(result.headers.get("content-type"), "image/png");
    assert.equal(result.headers.get("cache-control"), "no-store"); assert.equal(calls, 1);
    assert.equal((await fetch(url, { method: "POST", headers, body: "jpeg" })).status, 429);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
