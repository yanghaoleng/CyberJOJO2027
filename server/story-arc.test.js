import assert from "node:assert/strict";
import test from "node:test";
import { AGE_GROUPS, STORY_ARC_DAYS, STORY_ARCS, buildStoryInstructions, getStoryArc } from "./story-arc.js";

test("story arc provides five grounded days for every age group", () => {
  assert.equal(STORY_ARC_DAYS, 5);
  for (const group of AGE_GROUPS) {
    assert.equal(STORY_ARCS[group].length, STORY_ARC_DAYS, `${group} should have ${STORY_ARC_DAYS} days`);
    for (const day of STORY_ARCS[group]) {
      assert.equal(day.day >= 1 && day.day <= STORY_ARC_DAYS, true, `${group} day ${day.day} in range`);
      assert.ok(day.title && day.premise && day.opening && day.hook && day.guide, `${group} day ${day.day} complete`);
    }
  }
});

test("getStoryArc ends after five days instead of restarting the same adventure", () => {
  assert.equal(getStoryArc(1, "low").day, 1);
  assert.equal(getStoryArc(7, "high").day, 5);
  assert.equal(getStoryArc(8, "mid").day, 5);
  assert.equal(getStoryArc(0, "mid").day, 1);
  assert.equal(getStoryArc(3, "unknown").title, STORY_ARCS.mid[2].title);
});

test("buildStoryInstructions includes premise, hook and closing guidance", () => {
  const opening = buildStoryInstructions(1, "low", { closing: false });
  assert.ok(opening.includes("第1天"));
  assert.ok(opening.includes(STORY_ARCS.low[0].title));
  assert.ok(opening.includes(STORY_ARCS.low[0].opening));
  assert.ok(opening.includes("三分钟"));
  assert.ok(!opening.includes("收尾：今天的故事已经讲了约三分钟"));
  const closing = buildStoryInstructions(1, "low", { closing: true });
  assert.ok(closing.includes("现在自然收尾"));
  assert.ok(closing.includes(STORY_ARCS.low[0].hook));
});

test("advice is grounded in actual child messages, never invented from the script", () => {
  const text = buildStoryInstructions(2, "mid", { context: { entries: [{ role: "user", text: "在桥下面放块积木" }] } });
  assert.ok(text.includes("在桥下面放块积木"));
  assert.ok(text.includes("不能把剧情预设当成孩子的回答"));
  assert.ok(text.includes("不是孩子的亲身经历"));
  assert.ok(text.includes("孩子换话题就跟上"));
  for (const group of AGE_GROUPS) assert.ok(!JSON.stringify(STORY_ARCS[group]).includes("邮戳"));
});

test("each story hook points forward to the next day", () => {
  for (const group of AGE_GROUPS) {
    for (let index = 0; index < STORY_ARC_DAYS - 1; index += 1) {
      const current = STORY_ARCS[group][index];
      assert.ok(/明天|第二天|下周|下一次|下一段|明天我们|明天开始/.test(current.hook), `${group} day ${current.day} hook points forward`);
    }
  }
});
