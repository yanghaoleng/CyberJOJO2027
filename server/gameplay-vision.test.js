import assert from "node:assert/strict";
import test from "node:test";
import { assessGameplay, normalizeGameplayBox, normalizeQuestObject, normalizeQuestTarget, parseGameplayAssessment, validateGameplayRequest } from "./gameplay-vision.js";

const image = "data:image/jpeg;base64,c21hbGw=";
const request = (source = "food") => ({ source, image, roundId: "round-1", frameId: "frame-1", character: "jiaojiao" });
const base = { evaluable: true, confidence: 0.95, text: "看见了", bbox: [0.2, 0.2, 0.4, 0.4] };

test("gameplay request validation rejects invalid images, stale identifiers and incomplete verification", () => {
  assert.equal(validateGameplayRequest(request()).source, "food");
  for (const body of [{ ...request(), source: "other" }, { ...request(), image: "https://example.com/x.jpg" }, { ...request(), roundId: "x\nignore" }, request("verify"), { ...request("verify"), target: { kind: "color", value: "red" }, point: { x: 2, y: 0.5 } }]) {
    assert.throws(() => validateGameplayRequest(body), { statusCode: 400 });
  }
  assert.equal(validateGameplayRequest({ ...request("verify"), target: { kind: "color", value: "red", prompt: "untrusted instructions" }, point: { x: 0.5, y: 0.5 } }).target.prompt, "找一个红色的东西");
});

test("food and toy observations do not fabricate supported objects from low confidence", () => {
  assert.equal(parseGameplayAssessment("food", { ...base, foodId: "apple" }).foodId, "apple");
  assert.equal(parseGameplayAssessment("food", { ...base, foodId: "steak" }).evaluable, false);
  assert.equal(parseGameplayAssessment("food", { ...base, confidence: 0.7, foodId: "cake" }).foodId, null);
  const unclearToy = parseGameplayAssessment("toy", { ...base, confidence: 0.5, kind: "小熊", appearance: "棕色毛绒" });
  assert.equal(unclearToy.kind, ""); assert.equal(unclearToy.appearance, "");
  assert.equal(parseGameplayAssessment("toy", { ...base, kind: "小熊", appearance: "棕色毛绒" }).evaluable, true);
  assert.equal(parseGameplayAssessment("food", "bad json"), null);
  assert.equal(parseGameplayAssessment("food", { ...base, confidence: NaN }), null);
});

test("conversation-led observation only returns a clear, bounded object category", () => {
  const clearBook = parseGameplayAssessment("observe", {
    evaluable: true, confidence: 0.92, bbox: [0.3, 0.2, 0.3, 0.5], label: "绘本", category: "book", text: "看到了绘本",
  });
  assert.equal(clearBook.evaluable, true);
  assert.equal(clearBook.label, "绘本");
  assert.equal(clearBook.category, "book");
  const unclear = parseGameplayAssessment("observe", {
    evaluable: true, confidence: 0.6, bbox: [0.3, 0.2, 0.3, 0.5], label: "绘本", category: "book", text: "",
  });
  assert.equal(unclear.evaluable, false);
  assert.equal(unclear.label, "");
  assert.equal(unclear.category, "");
});

test("a collection observation requires a precise object and child-safe learning copy", () => {
  const collection = parseGameplayAssessment("collect", {
    evaluable: true, confidence: 0.93, bbox: [0.3, 0.2, 0.3, 0.5], label: "小盆栽", category: "plant",
    english: "plant", learning: "让它靠近明亮的窗边，土干了再请大人帮忙浇水。", text: "收进图鉴吧",
  });
  assert.equal(collection.evaluable, true);
  assert.equal(collection.english, "plant");
  assert.match(collection.learning, /窗边/);
  assert.equal(parseGameplayAssessment("collect", { ...base, label: "绘本", category: "book", english: "book" }).evaluable, true);
  assert.equal(parseGameplayAssessment("collect", { ...base, label: "杯子", category: "object", confidence: .78, bbox: [.01, .01, .95, .95] }).evaluable, true);
  assert.equal(parseGameplayAssessment("collect", { ...base, label: "杯子", category: "object", bbox: null }).evaluable, false);
  assert.equal(validateGameplayRequest(request("collect")).source, "collect");
});

test("quest only starts with an actual localized reference and supported color", () => {
  assert.equal(parseGameplayAssessment("quest", { ...base, target: { kind: "color", value: "red" } }).target.prompt, "找一个红色的东西");
  for (const change of [{ bbox: [0, 0, 0, 0] }, { bbox: [0.9, 0.2, 0.4, 0.4] }, { target: { kind: "color", value: "rainbow" } }]) {
    assert.equal(parseGameplayAssessment("quest", { ...base, target: { kind: "color", value: "red" }, ...change }).evaluable, false);
  }
  assert.equal(normalizeGameplayBox([0, 0, -1, 1]), null);
  assert.equal(normalizeGameplayBox([0, 0, Infinity, 1]), null);
});

test("verification rejects a correct-color object elsewhere and incorrect observed color", () => {
  const target = { kind: "color", value: "red" };
  const correct = { ...base, matched: true, observedValue: "red" };
  assert.equal(parseGameplayAssessment("verify", correct, { target, point: { x: 0.4, y: 0.4 } }).matched, true);
  assert.equal(parseGameplayAssessment("verify", correct, { target, point: { x: 0.8, y: 0.4 } }).matched, false);
  assert.equal(parseGameplayAssessment("verify", { ...correct, observedValue: "blue" }, { target, point: { x: 0.4, y: 0.4 } }).matched, false);
  assert.equal(parseGameplayAssessment("verify", { ...correct, matched: "true" }, { target, point: { x: 0.4, y: 0.4 } }).matched, false);
  assert.equal(parseGameplayAssessment("verify", { ...correct, confidence: 0.7 }, { target, point: { x: 0.4, y: 0.4 } }).matched, false);
});

test("object quests use a closed vocabulary and normalize common aliases before verification", () => {
  const pairs = [["水杯", "杯子"], [" 马克杯 ", "杯子"], ["Mug", "杯子"], ["绘本", "书本"], ["皮球", "球"], ["毛绒小熊", "毛绒玩具"]];
  for (const [alias, canonical] of pairs) {
    assert.equal(normalizeQuestObject(alias), canonical);
    assert.equal(normalizeQuestTarget({ kind: "object", value: alias }).value, canonical);
    const quest = parseGameplayAssessment("quest", { ...base, target: { kind: "object", value: alias } });
    assert.equal(quest.evaluable, true);
    assert.equal(quest.target.prompt, `找一找${canonical}`);
    const verified = parseGameplayAssessment("verify", { ...base, matched: true, observedValue: alias }, { target: { kind: "object", value: canonical }, point: { x: 0.4, y: 0.4 } });
    assert.equal(verified.matched, true);
    assert.equal(verified.observedValue, canonical);
  }
  for (const value of ["刀具", "药瓶", "电插座", "人物", "杯子旁边的东西", "none", "constructor"]) {
    assert.equal(normalizeQuestObject(value), null);
    assert.equal(parseGameplayAssessment("quest", { ...base, target: { kind: "object", value } }).evaluable, false);
    assert.throws(() => validateGameplayRequest({ ...request("verify"), target: { kind: "object", value }, point: { x: 0.4, y: 0.4 } }), { statusCode: 400 });
  }
  assert.equal(normalizeQuestTarget({ kind: "color", value: "constructor" }), null);
});

test("object verification cannot succeed when the observed object contradicts the target", () => {
  const target = { kind: "object", value: "杯子" };
  const selection = { target, point: { x: 0.4, y: 0.4 } };
  for (const observedValue of ["椅子", "水瓶", "none", "红色", "火焰", ""]) {
    const result = parseGameplayAssessment("verify", { ...base, matched: true, observedValue, text: "太棒了你找到了" }, selection);
    assert.equal(result.matched, false, `must not accept ${observedValue} as a cup`);
    assert.notEqual(result.text, "太棒了你找到了");
  }
  assert.equal(parseGameplayAssessment("verify", { ...base, matched: true, observedValue: "水杯" }, { target, point: { x: 0.9, y: 0.9 } }).matched, false);
  assert.equal(parseGameplayAssessment("verify", { ...base, matched: false, observedValue: "水杯" }, selection).matched, false);
});

test("full-frame boxes cannot bypass selected-object checks while large localized objects remain valid", () => {
  for (const bbox of [[0, 0, 1, 1], [0.02, 0.02, 0.96, 0.96], [0, 0, 1, 0.86]]) {
    assert.equal(normalizeGameplayBox(bbox), null);
    const quest = parseGameplayAssessment("quest", { ...base, bbox, target: { kind: "color", value: "red" } });
    assert.equal(quest.evaluable, false);
    assert.equal(quest.target, null);
    for (const target of [{ kind: "color", value: "red" }, { kind: "object", value: "杯子" }]) {
      const verification = parseGameplayAssessment("verify", { ...base, bbox, matched: true, observedValue: target.value }, { target, point: { x: 0.5, y: 0.5 } });
      assert.equal(verification.matched, false);
      assert.equal(verification.evaluable, false);
      assert.equal(verification.bbox, null);
      assert.match(verification.text, /退远/);
    }
  }
  for (const bbox of [[0.05, 0.05, 0.9, 0.9], [0, 0.1, 1, 0.8], [0.1, 0, 0.8, 1]]) {
    assert.deepEqual(normalizeGameplayBox(bbox), bbox);
    assert.equal(parseGameplayAssessment("verify", { ...base, bbox, matched: true, observedValue: "水杯" }, { target: { kind: "object", value: "杯子" }, point: { x: 0.5, y: 0.5 } }).matched, true);
  }
});

function sse(value) {
  const content = `data: ${JSON.stringify({ type: "response.function_call_arguments.done", arguments: JSON.stringify(value) })}\n\n`;
  return new Response(content, { status: 200, headers: { "content-type": "text/event-stream" } });
}

test("gameplay uses configured vision credentials and authorized fallback without storing images", async () => {
  const sent = [];
  const result = await assessGameplay(request(), { endpoint: "https://example.test/responses", apiKey: "text-key", visionApiKey: "vision-key", visionModel: "configured-first", visionFallbackModel: "configured-fallback" }, {
    fetchImpl: async (_url, options) => {
      sent.push({ body: JSON.parse(options.body), auth: options.headers.Authorization });
      return sent.length === 1 ? new Response("not authorized", { status: 403 }) : sse({ ...base, foodId: "apple" });
    },
  });
  assert.equal(result.foodId, "apple");
  assert.deepEqual(sent.map((entry) => entry.body.model), ["configured-first", "configured-fallback"]);
  assert.equal(sent[0].auth, "Bearer vision-key");
  assert.equal(sent[0].body.store, false);
  assert.equal(sent[0].body.input[1].content[0].image_url, image);
  assert.equal(sent[0].body.tools[0].parameters.additionalProperties, false);
});

test("the model receives the same canonical object vocabulary enforced by the parser", async () => {
  const config = { endpoint: "https://example.test/responses", apiKey: "test", model: "configured" };
  const target = { kind: "object", value: "杯子" };
  let sent;
  const result = await assessGameplay({ ...request("verify"), target, point: { x: 0.4, y: 0.4 } }, config, {
    fetchImpl: async (_url, options) => {
      sent = JSON.parse(options.body);
      return sse({ ...base, matched: true, observedValue: "杯子" });
    },
  });
  const vocabulary = sent.tools[0].parameters.properties.observedValue.enum;
  assert.ok(vocabulary.includes("杯子") && vocabulary.includes("椅子") && vocabulary.includes("none"));
  assert.equal(vocabulary.includes("药瓶"), false);
  assert.match(sent.input[0].content[0].text, /水杯\/马克杯写“杯子”/);
  assert.equal(result.matched, true);
});

test("invalid model JSON and caller cancellation never become gameplay success", async () => {
  const config = { endpoint: "https://example.test", apiKey: "test", model: "configured" };
  await assert.rejects(assessGameplay(request(), config, { fetchImpl: async () => sse({ evaluable: true, confidence: "high" }) }), /output invalid/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(assessGameplay(request(), config, { signal: controller.signal, fetchImpl: async (_url, options) => {
    assert.equal(options.signal.aborted, true); throw new DOMException("Aborted", "AbortError");
  } }), { name: "AbortError" });
});

 test("named box dimensions normalize without guessing corner coordinates", () => {
  assert.deepEqual(normalizeGameplayBox({ x: 0.2, y: 0.3, width: 0.4, height: 0.5 }), [0.2, 0.3, 0.4, 0.5]);
  assert.equal(normalizeGameplayBox({ x: 0.7, y: 0.3, width: 0.5, height: 0.5 }), null);
});
