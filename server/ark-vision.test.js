import assert from "node:assert/strict";
import test from "node:test";
import { assessCameraScene, parseSceneAssessment, validateVisionImage } from "./ark-vision.js";

const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from("small-jpeg").toString("base64")}`;

function createSseResponse(argumentsValue) {
  const payload = [
    `data: ${JSON.stringify({ type: "response.function_call_arguments.done", arguments: argumentsValue })}\n\n`,
    `data: ${JSON.stringify({ type: "response.completed", response: { usage: { input_tokens: 700, output_tokens: 55 } } })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
  const bytes = new TextEncoder().encode(payload);
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

test("scene assessments accept only confident and complete reactions", () => {
  assert.deepEqual(parseSceneAssessment(JSON.stringify({
    evaluable: true,
    category: "dessert",
    subject: "草莓蛋糕",
    tone: "delighted",
    text: "哇，这个草莓蛋糕看起来好香！",
    action: "happy",
    repeat_key: "dessert:strawberry-cake",
    confidence: 0.94,
  })), {
    evaluable: true,
    category: "dessert",
    subject: "草莓蛋糕",
    tone: "delighted",
    text: "哇，这个草莓蛋糕看起来好香！",
    action: "happy",
    repeatKey: "dessert:strawberry-cake",
    confidence: 0.94,
  });

  assert.equal(parseSceneAssessment("not-json"), null);
  assert.equal(parseSceneAssessment(JSON.stringify({ evaluable: true, confidence: 0.5 })).evaluable, false);
});

test("vision images are restricted to bounded base64 JPEG data URLs", () => {
  assert.equal(validateVisionImage(JPEG_DATA_URL), JPEG_DATA_URL);
  assert.throws(() => validateVisionImage("data:image/png;base64,AAAA"), /base64 JPEG/);
  assert.throws(
    () => validateVisionImage(`data:image/jpeg;base64,${"A".repeat(240_001)}`),
    /too large/,
  );
});

test("vision requests send low-detail images and return usage", async () => {
  let requestBody;
  const result = await assessCameraScene(JPEG_DATA_URL, "jiaojiao", {
    apiKey: "test-key",
    model: "test-model",
    visionModel: "fast-vision-model",
    endpoint: "https://ark.example.test/responses",
  }, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return createSseResponse(JSON.stringify({
      evaluable: true,
      category: "cat",
      subject: "橘猫",
      tone: "delighted",
      text: "这只橘猫也太可爱啦！",
      action: "praise",
      repeat_key: "cat:orange",
      confidence: 0.93,
    }));
  });

  const imageInput = requestBody.input[1].content.find(({ type }) => type === "input_image");
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.model, "fast-vision-model");
  assert.deepEqual(requestBody.thinking, { type: "disabled" });
  assert.equal(imageInput.detail, "low");
  assert.equal(imageInput.image_url, JPEG_DATA_URL);
  assert.equal(requestBody.tool_choice.name, "comment_on_camera_scene");
  assert.equal(result.assessment.subject, "橘猫");
  assert.deepEqual(result.usage, { input_tokens: 700, output_tokens: 55 });
});

test("vision falls back to an authorized model when the preferred model is unavailable", async () => {
  const requestedModels = [];
  const result = await assessCameraScene(JPEG_DATA_URL, "jiaojiao", {
    apiKey: "test-key",
    model: "safe-model",
    visionModel: "fast-model",
    visionFallbackModel: "safe-model",
    endpoint: "https://ark.example.test/responses",
  }, async (_url, options) => {
    const { model } = JSON.parse(options.body);
    requestedModels.push(model);
    if (model === "fast-model") {
      return {
        ok: false,
        status: 403,
        text: async () => "AccessDenied",
      };
    }
    return createSseResponse(JSON.stringify({
      evaluable: false,
      category: "none",
      subject: "",
      tone: "none",
      text: "",
      action: "none",
      repeat_key: "",
      confidence: 0.2,
    }));
  });

  assert.deepEqual(requestedModels, ["fast-model", "safe-model"]);
  assert.equal(result.assessment.evaluable, false);
});
