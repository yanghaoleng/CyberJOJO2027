import assert from "node:assert/strict";
import test from "node:test";
import { parseCollectionDialogue } from "./collection-dialogue.js";

test("a collected object can be renamed in natural dialogue", () => {
  assert.deepEqual(parseCollectionDialogue("它叫小叶子"), { type: "name", name: "小叶子" });
  assert.deepEqual(parseCollectionDialogue("给它叫红苹果吧"), { type: "name", name: "红苹果" });
  assert.equal(parseCollectionDialogue("我们去看看吧"), null);
});
