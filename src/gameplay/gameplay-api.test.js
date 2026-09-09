import assert from "node:assert/strict";
import test from "node:test";
import { requestGameplay } from "./gameplay-api.js";

const request = { source: "verify", roundId: "round-current", frameId: "frame-current", image: "data:image/jpeg;base64,c21hbGw=" };
function browserStub() {
  const previous = globalThis.window;
  globalThis.window = { location: { hostname: "localhost", origin: "http://localhost:5173" } };
  return () => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; };
}

test("client refuses a successful response that belongs to an old round or a different frame", async () => {
  const restore = browserStub();
  try {
    for (const stale of [{ roundId: "old" }, { frameId: "old" }, { source: "food" }]) {
      await assert.rejects(requestGameplay(request, { fetchImpl: async () => Response.json({ ...request, ...stale, ok: true, matched: true }) }), /这一轮已经换了/);
    }
  } finally { restore(); }
});

test("client exposes a bounded retry time and recovers on the user's next request", async () => {
  const restore = browserStub();
  try {
    await assert.rejects(requestGameplay(request, { fetchImpl: async () => Response.json({ ok: false, retryAfterMs: 1700 }, { status: 429 }) }), (error) => error.status === 429 && error.retryAfterMs === 1700);
    const result = await requestGameplay(request, { fetchImpl: async () => Response.json({ ...request, ok: true, matched: false }) });
    assert.equal(result.matched, false);
  } finally { restore(); }
});

test("a cancelled client request reaches fetch already aborted", async () => {
  const restore = browserStub();
  const controller = new AbortController(); controller.abort();
  try {
    await assert.rejects(requestGameplay(request, { signal: controller.signal, fetchImpl: async (_url, options) => {
      assert.equal(options.signal.aborted, true); throw new DOMException("Aborted", "AbortError");
    } }), { name: "AbortError" });
  } finally { restore(); }
});
