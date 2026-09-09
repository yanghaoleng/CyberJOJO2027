import assert from 'node:assert/strict';
import test from 'node:test';
import { commitBaseUrlFromRemote, commitDateInShanghai, createChangelog, parseGitCommitLog } from './changelog-data.mjs';

const sha = (digit) => digit.repeat(40);
const base = 'https://github.com/yanghaoleng/CyberJOJO2027/commit';
const commit = (digit, committedAt, subject = `Update ${digit}`) => ({ sha: sha(digit), committedAt, subject });
const build = (commits, notes) => createChangelog({ head: sha('a'), commits, notes, commitBaseUrl: base, generatedAt: '2026-09-09T10:00:00.000Z' });

test('Shanghai day boundaries use commit instants rather than the source timezone date', () => {
  assert.equal(commitDateInShanghai('2026-09-08T15:59:59Z'), '2026-09-08');
  assert.equal(commitDateInShanghai('2026-09-08T16:00:00Z'), '2026-09-09');
  assert.equal(commitDateInShanghai('2026-09-09T00:30:00+09:00'), '2026-09-08');
  assert.equal(commitDateInShanghai('2026-09-08T23:30:00-07:00'), '2026-09-09');
});

test('one day contains multiple unique commits and all days and timestamps are newest first', () => {
  const early = commit('a', '2026-09-08T16:10:00Z');
  const late = commit('b', '2026-09-09T23:00:00+08:00');
  const result = build([commit('c', '2026-09-07T18:00:00+08:00'), early, late, { ...early }, commit('d', '2026-09-08T16:00:00+08:00')]);
  assert.deepEqual(result.days.map((day) => day.date), ['2026-09-09', '2026-09-08', '2026-09-07']);
  assert.deepEqual(result.days[0].commits.map((entry) => entry.sha), [sha('b'), sha('a')]);
  assert.equal(result.days.reduce((sum, day) => sum + day.commits.length, 0), 4);
  assert.equal(result.days[0].commits[1].committedAt, early.committedAt);
  assert.equal(result.days[0].commits[1].shortSha, 'aaaaaaa');
  assert.equal(result.days[0].commits[1].url, `${base}/${sha('a')}`);
  assert.equal(result.head, sha('a'));
  assert.equal(result.generatedAt, '2026-09-09T10:00:00.000Z');
  assert.equal(result.version, 1);
});

test('optional Chinese notes override only their day and cannot create dates without commits', () => {
  const rows = [commit('a', '2026-09-09T10:00:00+08:00'), commit('b', '2026-09-08T10:00:00+08:00')];
  const result = build(rows, { days: {
    '2026-09-09': { title: '  一起玩起来  ', items: ['增加互动玩法', '支持资源预览', '增加互动玩法', '  ', null] },
    '2026-09-10': { title: '尚未提交', items: ['不应出现'] },
  } });
  assert.deepEqual(result.days[0].items, ['增加互动玩法', '支持资源预览']);
  assert.equal(result.days[0].title, '一起玩起来');
  assert.equal(result.days[1].title, '更新记录');
  assert.deepEqual(result.days[1].items, ['Update b']);
  assert.equal(result.days.length, 2);
});

test('missing, empty or unusable notes fall back to real unique subjects', () => {
  const rows = [commit('a', '2026-09-09T10:00:00+08:00', '修复相册'), commit('b', '2026-09-09T11:00:00+08:00', '修复相册')];
  for (const notes of [undefined, {}, { days: {} }, { days: { '2026-09-09': { title: ' ', items: [] } } }, { days: { '2026-09-09': { items: [null, ' ', 1] } } }]) {
    const result = build(rows, notes);
    assert.equal(result.days[0].title, '更新记录');
    assert.deepEqual(result.days[0].items, ['修复相册']);
    assert.equal(result.days[0].commits.length, 2);
  }
  assert.deepEqual(build([]).days, []);
});

test('git log triples preserve punctuation and reject truncated records or invalid dates', () => {
  const subject = 'fix: 中文、引号 " and | pipes';
  const timestamp = '2026-09-09T10:11:12+08:00';
  assert.deepEqual(parseGitCommitLog(`${sha('a')}\0${subject}\0${timestamp}\0`), [{ sha: sha('a'), subject, committedAt: timestamp }]);
  assert.deepEqual(parseGitCommitLog(''), []);
  assert.throws(() => parseGitCommitLog(`${sha('a')}\0subject`), /field count/);
  assert.throws(() => build([commit('a', 'not-a-date')]), /committedAt/);
  assert.throws(() => build([{ ...commit('a', timestamp), sha: 'short' }]), /full SHA/);
});

test('current-repository URLs support HTTPS and SSH without exposing origin credentials', () => {
  for (const remote of ['https://github.com/yanghaoleng/CyberJOJO2027.git', 'git@github.com:yanghaoleng/CyberJOJO2027.git', 'ssh://git@github.com/yanghaoleng/CyberJOJO2027.git', 'https://user:private-token@github.com/yanghaoleng/CyberJOJO2027.git?private=value#fragment']) {
    assert.equal(commitBaseUrlFromRemote(remote), base);
  }
});
