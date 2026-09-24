import assert from "node:assert/strict";
import test from "node:test";
import { parseCollectionDialogue, parseRealIdiomSuggestion } from "./collection-dialogue.js";

test("a collected object can be renamed in natural dialogue", () => {
  assert.deepEqual(parseCollectionDialogue("它叫小叶子"), { type: "name", name: "小叶子" });
  assert.deepEqual(parseCollectionDialogue("给它叫红苹果吧"), { type: "name", name: "红苹果" });
  assert.equal(parseCollectionDialogue("我们去看看吧"), null);
});

test("a child can add a creative idiom and its meaning through dialogue", () => {
  assert.deepEqual(parseCollectionDialogue("我编的成语叫刻桌求见"), { type: "idiom", idiom: "刻桌求见" });
  assert.deepEqual(parseCollectionDialogue("刻桌求见", { expectCreativeIdiom: true }), { type: "idiom", idiom: "刻桌求见" });
  assert.equal(parseCollectionDialogue("刻桌求见"), null);
  assert.deepEqual(parseCollectionDialogue("意思是朋友在课桌上做记号，想见到同桌"), { type: "idiomMeaning", idiomMeaning: "朋友在课桌上做记号" });
});

test("Jiaojiao's established idiom and definition are kept separate from made-up words", () => {
  assert.deepEqual(parseRealIdiomSuggestion("成语刻舟求剑，意思是拘泥旧办法，不知道情况已经变了。"), { sourceIdiom: "刻舟求剑", sourceMeaning: "拘泥旧办法，不知道情况已经变了" });
  assert.equal(parseRealIdiomSuggestion("我编的新成语刻桌求见，意思是想见同桌。"), null);
});
