import assert from "node:assert/strict";
import test from "node:test";
import { selectDailyOpening, recentOpeningIds, dailyOpeningText, buildDailyOpeningInstructions } from "./daily-opening.js";
const library = Array.from({ length: 90 }, (_, i) => ({ id: `event-${i}`, mode: i < 50 ? "story" : "question", title: `title-${i}`, opening: `opening-${i}`, question: "", followups: ["one", "two"], skip: "skip" }));
test("75% story selection, all entries reachable and last 12 never repeat", () => {
  let seed = 532; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const seen = new Set(); let stories = 0, recentIds = [];
  for (let i = 0; i < 18000; i++) {
    const event = selectDailyOpening({ library, random, recentIds });
    assert.ok(!recentIds.includes(event.id));
    seen.add(event.id); stories += event.mode === "story";
    recentIds = [...recentIds, event.id].slice(-12);
  }
  assert.equal(seen.size, 90); assert.ok(stories / 18000 > .73 && stories / 18000 < .77);
});
test("empty/small pools, stale ids and explicit resume degrade safely", () => {
  assert.equal(selectDailyOpening({ library: [] }), null);
  assert.match(dailyOpeningText(null), /不想说/);
  assert.equal(selectDailyOpening({ library: [library[0]], recentIds: [library[0].id] }).id, library[0].id);
  assert.equal(selectDailyOpening({ library, eventId: library[7].id, recentIds: [library[7].id] }), library[7]);
  assert.deepEqual(recentOpeningIds(["unknown", library[0].id, library[0].id], library), [library[0].id]);
  assert.ok(selectDailyOpening({ library: library.slice(50), random: () => 1 }).mode === "question");
});
test("only selected event enters prompt, with skip, fiction, one-question and reading boundaries", () => {
  const prompt = buildDailyOpeningInstructions(library[8]);
  assert.match(prompt, /opening-8/); assert.doesNotMatch(prompt, /opening-9/);
  for (const text of ["虚构", "单轮最多选一个", "最多一问", "立即接受", "不得立即改问", "停止", "主动聊书", "敏感资料"]) assert.ok(prompt.includes(text));
});

test("content schema, short openings and production draft gate", async () => {
  const { readFileSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const document = JSON.parse(readFileSync(new URL('./data/daily-openings.json', import.meta.url), 'utf8'));
  assert.equal(document.items.length, 90);
  assert.equal(new Set(document.items.map(event => event.id)).size, 90);
  for (const event of document.items) {
    assert.match(event.id, /^[a-zA-Z0-9_-]{1,80}$/);
    assert.ok(['story', 'question'].includes(event.mode));
    assert.ok(event.title && event.category && event.skip && event.tags.length);
    assert.ok(event.opening || event.question);
    assert.ok((event.opening + event.question).length <= 48, event.id);
    assert.ok(((event.opening + event.question).match(/[?？]/g) || []).length <= 1, event.id);
    assert.equal(event.followups.length, 2);
    assert.ok(event.followups.every(value => typeof value === 'string' && value.length));
  }
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import {DAILY_OPENINGS} from './server/daily-opening.js'; console.log(DAILY_OPENINGS.length)`], { cwd: new URL('../', import.meta.url), env: { PATH: process.env.PATH, NODE_ENV: 'production' }, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(Number(result.stdout.trim()), document.publishable === true ? 90 : 0);
});


test("selected event and skip boundaries survive realtime prompt size cap", async () => {
  const { buildCharacterInstructions } = await import('./ark-command.js');
  const { buildStoryInstructions } = await import('./story-arc.js');
  const { buildSessionUpdate } = await import('./seeduplex-session.js');
  const instructions = buildCharacterInstructions('jiaojiao', [buildDailyOpeningInstructions(library[8]), buildStoryInstructions(2, 'mid', { dailyOpening: true, context: { entries: [{ role: 'user', text: '过去的数据'.repeat(3000) }] } })].join('\n'));
  const sent = buildSessionUpdate({ instructions }).session.instructions;
  assert.ok(sent.length <= 12000);
  assert.ok(sent.includes('opening-8'));
  assert.ok(sent.includes('说停止就结束当前话题'));
  assert.ok(sent.includes('阅读拓展仅在孩子主动聊书'));
});
