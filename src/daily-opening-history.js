const KEY = "jocam-daily-opening-ids-v1";
export const OPENING_HISTORY_LIMIT = 12;
const valid = id => typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
export function readOpeningHistory(storage) {
  try {
    storage ??= globalThis.localStorage;
    const saved = JSON.parse(storage?.getItem(KEY) || "[]");
    return [...new Set((Array.isArray(saved) ? saved : []).filter(valid))].slice(-OPENING_HISTORY_LIMIT);
  } catch { return []; }
}
export function rememberOpening(id, storage) {
  if (!valid(id)) return;
  try {
    storage ??= globalThis.localStorage;
    const ids = [...readOpeningHistory(storage).filter(value => value !== id), id].slice(-OPENING_HISTORY_LIMIT);
    storage?.setItem(KEY, JSON.stringify(ids));
  } catch { /* No storage is a supported session-only mode. */ }
}
