const VISION_ACTIONS = ["praise", "surprised", "think", "happy", "frighten", "curious"];
const VISION_CATEGORIES = ["food", "dessert", "cat", "dog", "animal", "object"];
const VISION_TONES = ["delighted", "curious", "cautious"];
const MIN_EVALUABLE_CONFIDENCE = 0.82;
const MAX_IMAGE_DATA_URL_LENGTH = 240_000;

const CHARACTER_PROMPTS = Object.freeze({
  jiaojiao: "你是叫叫，一只热情、活泼、喜欢陪小朋友记录生活的小鸡朋友。",
  lvdou: "你是绿豆，一个沉稳一点、偶尔幽默、会认真观察生活的赛博朋友。",
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function emptyAssessment(confidence = 0) {
  return {
    evaluable: false,
    category: null,
    subject: "",
    tone: null,
    text: "",
    action: null,
    repeatKey: "",
    confidence: clamp(Number(confidence) || 0, 0, 1),
  };
}

export function parseSceneAssessment(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  const confidence = clamp(Number(parsed?.confidence) || 0, 0, 1);
  if (!parsed?.evaluable || confidence < MIN_EVALUABLE_CONFIDENCE) {
    return emptyAssessment(confidence);
  }

  const category = VISION_CATEGORIES.includes(parsed.category) ? parsed.category : null;
  const tone = VISION_TONES.includes(parsed.tone) ? parsed.tone : null;
  const subject = cleanText(parsed.subject, 24);
  const text = cleanText(parsed.text, 42);
  if (!category || !tone || !subject || !text) return emptyAssessment(confidence);

  const action = VISION_ACTIONS.includes(parsed.action) ? parsed.action : null;
  const repeatKey = cleanText(parsed.repeat_key, 36) || `${category}:${subject}`;
  return {
    evaluable: true,
    category,
    subject,
    tone,
    text,
    action,
    repeatKey,
    confidence,
  };
}

export function validateVisionImage(image) {
  const normalized = String(image || "");
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(normalized)) {
    throw new Error("Vision image must be a base64 JPEG data URL");
  }
  if (normalized.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("Vision image is too large");
  }
  return normalized;
}

async function readVisionSse(response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let buffer = "";
  let argumentsText = "";
  let assessment = null;
  let usage = null;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const data = block.split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!data || data === "[DONE]") continue;

      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }

      if (event.type === "response.function_call_arguments.delta") {
        argumentsText += event.delta || "";
      }
      if (event.type === "response.function_call_arguments.done") {
        assessment = parseSceneAssessment(event.arguments || argumentsText) || assessment;
      }
      if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
        assessment = parseSceneAssessment(event.item.arguments || argumentsText) || assessment;
      }
      if (event.type === "response.completed") {
        usage = event.response?.usage || usage;
        for (const item of event.response?.output || []) {
          if (item.type === "function_call") {
            assessment = parseSceneAssessment(item.arguments || argumentsText) || assessment;
          }
        }
      }
    }

    if (done) break;
  }

  return assessment ? { assessment, usage } : null;
}

export async function assessCameraScene(image, character, config, fetchImpl = fetch) {
  const imageDataUrl = validateVisionImage(image);
  const activeCharacter = character === "lvdou" ? "lvdou" : "jiaojiao";
  const models = [...new Set([
    config.visionModel || config.model,
    config.visionFallbackModel,
  ].filter(Boolean))];
  let lastError = null;

  for (const [modelIndex, model] of models.entries()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        store: false,
        thinking: { type: "disabled" },
        max_output_tokens: 220,
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: `${CHARACTER_PROMPTS[activeCharacter]}
你正在通过儿童相机看一张低清实时画面。只有当主体非常清楚且适合准确评价时，才设置 evaluable=true。
可评价主体仅限：食物、具体甜点、猫、狗、其他常见动物，或非常明确且适合儿童互动的日常物品。模糊、遮挡、无法确定、人脸或身体为主体、屏幕文字、危险情境时必须返回 evaluable=false。
评价要像角色当场看到后自然说出的一句话，不超过 26 个汉字。可以热情夸赞，也可以在食物出现肉眼明显发霉、严重变色、萎蔫时谨慎说“看起来有点怪怪的，先请大人看看”。绝不声称已经闻到、尝到，也不判断食品一定变质、有毒或能否食用。
不要评价人的长相、年龄、身体、健康或身份。不要使用 emoji。为相同主体生成稳定、简短的 repeat_key，并选择最贴合的预置动作；没有合适动作使用 none。必须调用 comment_on_camera_scene。`,
            }],
          },
          {
            role: "user",
            content: [
              { type: "input_image", image_url: imageDataUrl, detail: "low" },
              { type: "input_text", text: "看看现在镜头里的主要内容。只有足够确定时才评价。" },
            ],
          },
        ],
        tools: [{
          type: "function",
          name: "comment_on_camera_scene",
          description: "判断相机画面是否适合评价，并生成一句儿童友好的角色反应",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              evaluable: { type: "boolean" },
              category: { type: "string", enum: [...VISION_CATEGORIES, "none"] },
              subject: { type: "string" },
              tone: { type: "string", enum: [...VISION_TONES, "none"] },
              text: { type: "string" },
              action: { type: "string", enum: [...VISION_ACTIONS, "none"] },
              repeat_key: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: [
              "evaluable",
              "category",
              "subject",
              "tone",
              "text",
              "action",
              "repeat_key",
              "confidence",
            ],
          },
          strict: true,
        }],
        tool_choice: { type: "function", name: "comment_on_camera_scene" },
      }),
      signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 260);
        lastError = new Error(`Ark vision request failed (${response.status}): ${detail}`);
        const canFallback = [403, 404].includes(response.status) && modelIndex < models.length - 1;
        if (canFallback) continue;
        throw lastError;
      }

      const result = await readVisionSse(response);
      if (!result?.assessment) throw new Error("Ark vision returned no structured assessment");
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Ark vision has no configured model");
}

export const visionInternals = {
  MAX_IMAGE_DATA_URL_LENGTH,
  MIN_EVALUABLE_CONFIDENCE,
  VISION_ACTIONS,
  VISION_CATEGORIES,
  VISION_TONES,
  emptyAssessment,
  readVisionSse,
};
