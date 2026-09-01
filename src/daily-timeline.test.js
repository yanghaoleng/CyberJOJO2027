import assert from "node:assert/strict";
import test from "node:test";
import {
  createConversationFingerprint,
  getLocalDayKey,
  groupConversationEntriesByDay,
  groupMediaCapturesByDay,
} from "./daily-timeline.js";

function localTime(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour).getTime();
}

test("media captures form a newest-first local-day timeline", () => {
  const timeline = groupMediaCapturesByDay([
    { id: "morning", createdAt: localTime(2026, 9, 1, 9) },
    { id: "yesterday", createdAt: localTime(2026, 8, 31, 20) },
    { id: "evening", createdAt: localTime(2026, 9, 1, 18) },
  ]);
  assert.deepEqual(timeline.map(({ dayKey }) => dayKey), ["2026-09-01", "2026-08-31"]);
  assert.deepEqual(timeline[0].items.map(({ id }) => id), ["evening", "morning"]);
  assert.equal(getLocalDayKey(localTime(2026, 9, 1)), "2026-09-01");
});

test("conversation entries keep chronological order inside each day", () => {
  const grouped = groupConversationEntriesByDay([
    { id: "answer", createdAt: localTime(2026, 9, 1, 12), text: "当然可以" },
    { id: "question", createdAt: localTime(2026, 9, 1, 10), text: "看看小猫" },
  ]);
  assert.deepEqual(grouped.get("2026-09-01").map(({ id }) => id), ["question", "answer"]);
});

test("conversation fingerprints change only when the source dialogue changes", () => {
  const entries = [{ id: "one", role: "user", text: "小猫好可爱", createdAt: 1 }];
  assert.equal(createConversationFingerprint(entries), createConversationFingerprint(entries.map((entry) => ({ ...entry }))));
  assert.notEqual(createConversationFingerprint(entries), createConversationFingerprint([{ ...entries[0], text: "小狗好可爱" }]));
});

