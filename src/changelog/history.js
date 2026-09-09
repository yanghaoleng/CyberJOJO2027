export const releaseDay = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

// A later release belongs to its actual release day, even when its code is older.
export function mergeHistory(codeDays = [], releaseRecords = []) {
  const days = new Map(codeDays.map((day) => [day.date, { ...day, releases: [] }]));
  const seen = new Set();
  for (const release of releaseRecords) {
    if (!release?.id || seen.has(release.id) || !/^[a-f0-9]{40}$/.test(release.commit || "")
      || !Number.isFinite(Date.parse(release.releasedAt))) continue;
    seen.add(release.id);
    const date = releaseDay(release.releasedAt);
    if (!days.has(date)) days.set(date, { date, title: "版本发布", items: ["新版本已上线。"], commits: [], releases: [] });
    days.get(date).releases.push(release);
  }
  return [...days.values()].map((day) => ({ ...day,
    releases: day.releases.sort((a, b) => Date.parse(b.releasedAt) - Date.parse(a.releasedAt)),
  })).sort((a, b) => b.date.localeCompare(a.date));
}
