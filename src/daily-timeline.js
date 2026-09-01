export function getLocalDayKey(createdAt) {
  const date = new Date(Number(createdAt || 0));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function groupMediaCapturesByDay(captures = []) {
  const days = new Map();
  const sorted = [...captures].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
  for (const capture of sorted) {
    const dayKey = getLocalDayKey(capture?.createdAt);
    if (!dayKey) continue;
    if (!days.has(dayKey)) days.set(dayKey, []);
    days.get(dayKey).push(capture);
  }
  return [...days].map(([dayKey, items]) => ({ dayKey, items }));
}

export function groupConversationEntriesByDay(entries = []) {
  const days = new Map();
  const sorted = [...entries].sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
  for (const entry of sorted) {
    const dayKey = getLocalDayKey(entry?.createdAt);
    if (!dayKey) continue;
    if (!days.has(dayKey)) days.set(dayKey, []);
    days.get(dayKey).push(entry);
  }
  return days;
}

export function createConversationFingerprint(entries = []) {
  let hash = 2166136261;
  for (const entry of entries) {
    const value = `${entry.id || ""}|${entry.role || ""}|${entry.character || ""}|${entry.text || ""}|${entry.createdAt || 0}`;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${entries.length}-${(hash >>> 0).toString(36)}`;
}

