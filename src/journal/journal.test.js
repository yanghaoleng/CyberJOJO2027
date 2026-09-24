import assert from "node:assert/strict";
import test from "node:test";
import { buildJournalContext, createConversationEntry, mergeJournalSummary } from "../conversation-journal.js";

test("recorded notes keep both companions and their original audio in one timeline", () => {
  const audioBlob = new Blob(["voice"], { type: "audio/mpeg" });
  const domi = createConversationEntry({ id: "domi-note", role: "assistant", source: "leave_note", character: "lvdou", text: "I found a leaf.", audioBlob, createdAt: 1780000000000 });
  const jiaojiao = createConversationEntry({ id: "jj-note", role: "assistant", source: "leave_note", character: "jiaojiao", text: "我读到一只小兔子。", audioBlob, createdAt: 1780000001000 });
  assert.equal(domi.audioBlob, audioBlob);
  assert.equal(jiaojiao.audioBlob, audioBlob);
  assert.equal(domi.source, "leave_note");
  assert.equal(mergeDailyTimeline([], [domi, jiaojiao]).length, 1);
});
import { mergeDailyTimeline } from "../daily-timeline.js";

const at = new Date(2026, 8, 9, 12).getTime();
const moment = { id: "m1", event: "积木倒了", feeling: "难过", thought: "", sourceEntryIds: ["u1"], evidenceQuote: "积木倒了，我有点难过" };

test("journal stores the entire bounded child utterance independently of subtitle length", () => {
  const text = "今天搭积木".repeat(70) + "后来我还是想试一试";
  const entry = createConversationEntry({ id: "u1", role: "user", text, source: "child_speech", sessionId: "s1", createdAt: at });
  assert.equal(entry.text, text); assert.equal(entry.sessionId, "s1"); assert.equal(entry.id, "u1");
  assert.equal(createConversationEntry({ text: "好".repeat(1200) }).text.length, 1000);
});

test("automatic summary cannot resurrect forgotten evidence or overwrite a child edit", () => {
  const previous = { dayKey: "2026-09-09", revision: 2, moments: [{ ...moment, event: "我后来搭好了", userEdited: true }], suppressedEntryIds: ["u1"] };
  const merged = mergeJournalSummary(previous, { moments: [moment, { id: "m2", event: "又提旧事", sourceEntryIds: ["u1"] }], processedEntryIds: ["u1"] });
  assert.equal(merged.revision, 2); assert.equal(merged.moments.length, 1); assert.equal(merged.moments[0].event, "我后来搭好了");
  const deleted = mergeJournalSummary({ ...previous, moments: [] }, { moments: [moment] });
  assert.deepEqual(deleted.moments, []);
});

test("new summary replaces reprocessed moments but preserves older moments whose raw evidence expired", () => {
  const earlier = { id: "old", event: "早上画了画", sourceEntryIds: ["expired"] };
  const merged = mergeJournalSummary({ moments: [earlier, moment] }, { processedEntryIds: ["u1", "u2"], moments: [{ id: "m-new", event: "不是难过，是有点生气", sourceEntryIds: ["u2"] }] });
  assert.deepEqual(merged.moments.map((item) => item.id), ["old", "m-new"]);
});

test("dialogue-only days and friends remain visible without photos", () => {
  const timeline = mergeDailyTimeline([], [{ role: "user", createdAt: at }], { "2026-09-08": { dayKey: "2026-09-08", moments: [moment] } }, [{ id: "f1", createdAt: at }]);
  assert.deepEqual(timeline.map((day) => day.dayKey), ["2026-09-09", "2026-09-08"]);
  assert.equal(timeline[0].items.length, 0); assert.equal(timeline[0].friends.length, 1);
});

test("forgotten sources and derived assistant memories do not reach the next session", () => {
  const context = buildJournalContext({ "2026-09-09": { dayKey: "2026-09-09", revision: 1, moments: [], suppressedEntryIds: ["u1"] } }, [
    { id: "u1", role: "user", text: "忘记我搭积木的事", createdAt: at },
    { id: "a1", role: "assistant", text: "你搭积木时很难过", createdAt: at + 1 },
    { id: "u2", role: "user", text: "我想看小猫", createdAt: at + 2 },
  ]);
  assert.deepEqual(context.entries.map((entry) => entry.id), ["u2"]);
  assert.equal(context.moments.length, 0);
});
