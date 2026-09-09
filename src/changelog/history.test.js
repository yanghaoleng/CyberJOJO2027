import assert from "node:assert/strict";
import test from "node:test";
import { mergeHistory } from "./history.js";

const commit = "a".repeat(40);
test("multiple releases and code updates share one Shanghai calendar day", () => {
  const days = mergeHistory([{ date: "2026-09-10", title: "变化", items: ["一个更新"], commits: [{ sha: commit }] }], [
    { id: "first", commit, releasedAt: "2026-09-09T16:01:00Z" },
    { id: "second", commit, releasedAt: "2026-09-10T02:00:00Z" },
    { id: "first", commit, releasedAt: "2026-09-09T16:01:00Z" },
  ]);
  assert.equal(days.length, 1);
  assert.equal(days[0].commits.length, 1);
  assert.deepEqual(days[0].releases.map((item) => item.id), ["second", "first"]);
});
test("releasing older code uses the release date without moving its commit history", () => {
  const days = mergeHistory([{ date: "2026-09-09", title: "变化", items: [], commits: [{ sha: commit }] }], [
    { id: "release", commit, releasedAt: "2026-09-12T03:00:00Z" },
    { id: "invalid", commit, releasedAt: "bad date" },
  ]);
  assert.deepEqual(days.map((item) => item.date), ["2026-09-12", "2026-09-09"]);
  assert.equal(days[0].commits.length, 0);
  assert.equal(days[1].releases.length, 0);
});
