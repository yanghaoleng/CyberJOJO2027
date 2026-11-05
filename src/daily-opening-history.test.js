import assert from "node:assert/strict";
import test from "node:test";
import { readOpeningHistory, rememberOpening } from "./daily-opening-history.js";
test("bounded local ids only, dedupe and private-mode fallback", () => {
  let value; const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  for (let i = 0; i < 30; i++) rememberOpening(`event-${i}`, storage);
  assert.equal(readOpeningHistory(storage).length, 12);
  rememberOpening("event-20", storage); assert.equal(readOpeningHistory(storage).at(-1), "event-20");
  assert.equal(readOpeningHistory(storage).length, 12);
  rememberOpening("<bad id>", storage); assert.equal(readOpeningHistory(storage).at(-1), "event-20");
  value = "broken"; assert.deepEqual(readOpeningHistory(storage), []);
  const blocked = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
  assert.doesNotThrow(() => rememberOpening("event-1", blocked)); assert.deepEqual(readOpeningHistory(blocked), []);
});
