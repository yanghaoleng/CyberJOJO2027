const DAY_MS = 86_400_000;

export function localDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function buildDailyActivity({ entries = [], captures = [], summaries = [], days = 30, now = Date.now() } = {}) {
  const result = Array.from({ length: days }, (_, index) => {
    const key = localDayKey(now - (days - index - 1) * DAY_MS);
    return { key, conversations: 0, captures: 0, summaries: 0, sessions: new Set() };
  });
  const byDay = new Map(result.map((day) => [day.key, day]));
  for (const entry of entries) {
    const day = byDay.get(localDayKey(entry.createdAt));
    if (!day) continue;
    if (entry.role === "user") day.conversations += 1;
    if (entry.sessionId) day.sessions.add(entry.sessionId);
  }
  for (const capture of captures) {
    const day = byDay.get(localDayKey(capture.createdAt));
    if (day) day.captures += 1;
  }
  for (const summary of summaries) {
    const day = byDay.get(String(summary.dayKey || ""));
    if (day) day.summaries += 1;
  }
  return result.map((day) => ({ ...day, sessions: day.sessions.size, total: day.conversations + day.captures }));
}

export function summarizeLocalData({ entries = [], captures = [], summaries = [], friends = [], now = Date.now() } = {}) {
  const days = buildDailyActivity({ entries, captures, summaries, now });
  const activeDays = days.filter((day) => day.total > 0 || day.summaries > 0).length;
  const userEntries = entries.filter((entry) => entry.role === "user");
  const sessions = new Set(entries.map((entry) => entry.sessionId).filter(Boolean)).size;
  const latestAt = Math.max(0, ...entries.map((entry) => Number(entry.createdAt) || 0), ...captures.map((capture) => Number(capture.createdAt) || 0));
  const recent = days.slice(-7);
  const previous = days.slice(-14, -7);
  const recentTotal = recent.reduce((sum, day) => sum + day.total, 0);
  const previousTotal = previous.reduce((sum, day) => sum + day.total, 0);
  return {
    days, activeDays, conversations: userEntries.length, captures: captures.length,
    summaries: summaries.length, friends: friends.length, sessions, latestAt,
    recentTotal, previousTotal,
    change: previousTotal ? (recentTotal - previousTotal) / previousTotal : null,
  };
}
