export const ACTIVITY_PROTOCOL = 'cyberjojo.activity.v1';
const siteOrigin = typeof window === 'undefined' ? 'https://cyberjojo.mikeywa.site' : window.location.origin;
export const ACTIVITIES = Object.freeze({
  words: { id: 'words', title: '开口造世界', subtitle: '跟着读一读，用英语变出你的小世界', url: `${siteOrigin}/words`, origin: siteOrigin },
});
export function activityUrl(id, sessionId) {
  const url = new URL(ACTIVITIES[id].url);
  url.searchParams.set('host', 'cyberjojo'); url.searchParams.set('session', sessionId);
  return url.href;
}
export function readActivityMessage(event, frameWindow, sessionId, id = 'words') {
  const data = event.data;
  if (event.source !== frameWindow || event.origin !== ACTIVITIES[id]?.origin || !data || data.protocol !== ACTIVITY_PROTOCOL || data.sessionId !== sessionId || data.activityId !== id) return null;
  if (!['ready', 'progress', 'result'].includes(data.type)) return null;
  if (data.type === 'ready') return { type: 'ready' };
  const report = data.report;
  if (data.type === 'result' && report?.status === 'playing') return null;
  if (!report || !['playing', 'completed', 'exited'].includes(report.status)) return null;
  const integer = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
  if (!integer(report.voiceAttempts, 10000) || !integer(report.menuAttempts, 10000) || !integer(report.completedLessons, 1000) || !integer(report.totalLessons, 1000) || report.completedLessons > report.totalLessons || !integer(report.durationSeconds, 86400)) return null;
  if (!Array.isArray(report.words) || report.words.length > 200 || report.words.some(word => typeof word !== 'string' || word.length > 40)) return null;
  let groups = {};
  if (report.wordGroupsVersion !== undefined) {
    const validWords = value => Array.isArray(value) && value.length <= 200 && value.every(word => typeof word === 'string' && word.length <= 40 && report.words.includes(word));
    if (report.wordGroupsVersion !== 1 || !validWords(report.independentWords) || !validWords(report.guidedWords) || report.independentWords.some(word => report.guidedWords.includes(word))) return null;
    groups = { wordGroupsVersion: 1, independentWords: [...new Set(report.independentWords)], guidedWords: [...new Set(report.guidedWords)] };
  }
  return { type: data.type, report: { status: report.status, voiceAttempts: report.voiceAttempts, menuAttempts: report.menuAttempts, completedLessons: report.completedLessons, totalLessons: report.totalLessons, durationSeconds: report.durationSeconds, words: [...new Set(report.words)], chapter: String(report.chapter || '').slice(0, 80), ...groups } };
}
const KEY = 'cyberjojo.activity-reports.v1';
export function loadActivityReports() {
  try { const records = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(records) ? records.filter(r => r?.id && ACTIVITIES[r.activityId] && r.report).slice(0, 200) : []; } catch { return []; }
}
export function saveActivityReport(record) {
  const records = [record, ...loadActivityReports().filter(r => r.id !== record.id)].slice(0, 200);
  localStorage.setItem(KEY, JSON.stringify(records)); return records;
}
export function deleteActivityReport(id) {
  const records = loadActivityReports().filter(r => r.id !== id); localStorage.setItem(KEY, JSON.stringify(records)); return records;
}
