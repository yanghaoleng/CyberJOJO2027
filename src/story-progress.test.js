import test from "node:test";
import assert from "node:assert/strict";
import { getStoryVisit } from "./story-progress.js";
test("story advances only on actual visits, once per day, without skipping absent days", () => {
  let value = null;
  const storage = { getItem: () => value, setItem: (_, data) => { value = data; } };
  const visit = (date, activate = true) => getStoryVisit({ storage, now: new Date(`${date}T12:00:00+08:00`).getTime(), activate });
  assert.equal(visit("2026-09-24", false), 1); assert.equal(value, null);
  assert.equal(visit("2026-09-24"), 1); assert.equal(visit("2026-09-24"), 1);
  assert.equal(visit("2026-10-02"), 2); assert.equal(visit("2026-10-02"), 2);
  for (const date of ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]) visit(date);
  assert.equal(visit("2026-10-07"), 6);
  value = "broken"; assert.equal(visit("2026-10-08"), 1);
});
