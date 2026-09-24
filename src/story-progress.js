import { getLocalDayKey } from "./daily-timeline.js";
const KEY = "jocam-story-reading-v1";
export function getStoryVisit({ storage, now = Date.now(), activate = false } = {}) {
  try { if (storage === undefined) storage = globalThis.localStorage; } catch { /* storage may be blocked */ }
  const today = getLocalDayKey(now);
  let saved;
  try { saved = JSON.parse(storage?.getItem(KEY) || "null"); } catch { /* local-only fallback */ }
  const valid = saved && Number.isInteger(saved.day) && saved.day >= 1 && saved.day <= 6 && /^\d{4}-\d{2}-\d{2}$/.test(saved.date);
  // 6 is a completion marker, not another chapter or a repeated day-five finale.
  const day = valid ? Math.min(6, saved.day + (today > saved.date ? 1 : 0)) : 1;
  if (activate) { try { storage?.setItem(KEY, JSON.stringify({ day, date: today })); } catch { /* private browsing */ } }
  return day;
}
