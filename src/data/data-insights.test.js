import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyActivity, summarizeLocalData } from "./data-insights.js";

const now = new Date("2026-09-27T12:00:00+08:00").getTime();

test("groups only the requested local date window", () => {
  const days = buildDailyActivity({ now, days: 2, entries: [
    { role: "user", createdAt: new Date("2026-09-27T09:00:00+08:00").getTime(), sessionId: "a" },
    { role: "assistant", createdAt: new Date("2026-09-27T09:01:00+08:00").getTime(), sessionId: "a" },
  ], captures: [{ createdAt: new Date("2026-09-26T10:00:00+08:00").getTime() }] });
  assert.deepEqual(days.map(({ key, conversations, captures, sessions }) => ({ key, conversations, captures, sessions })), [
    { key: "2026-09-26", conversations: 0, captures: 1, sessions: 0 },
    { key: "2026-09-27", conversations: 1, captures: 0, sessions: 1 },
  ]);
});

test("summary excludes assistant replies from conversation count", () => {
  const result = summarizeLocalData({ now, entries: [
    { role: "user", createdAt: now, sessionId: "a" },
    { role: "assistant", createdAt: now, sessionId: "a" },
  ], captures: [{ createdAt: now }], summaries: [{ dayKey: "2026-09-27" }], friends: [{ id: "f" }] });
  assert.equal(result.conversations, 1);
  assert.equal(result.captures, 1);
  assert.equal(result.sessions, 1);
  assert.equal(result.activeDays, 1);
});
