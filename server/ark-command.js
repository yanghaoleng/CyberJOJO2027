const ACTIONS = ["praise", "surprised", "think", "happy", "frighten", "curious"];
const COMMAND_HINT = /(?:叫叫|小鸡|比(?:个)?赞|点赞|夸夸|惊讶|吃惊|想一想|思考|开心|笑一个|害怕|吓一跳|好奇|鼓励)/;
const CHARACTER_PROMPTS = Object.freeze({
  jiaojiao: "你是叫叫，一只热情、活泼、喜欢阅读和陪伴小朋友记录生活的小鸡朋友。",
  lvdou: "你是绿豆，一个沉稳一点、偶尔幽默、会认真接住小朋友每句话的赛博朋友。",
});

function parseAction(value) {
  try {
    const action = JSON.parse(value)?.action;
    return ACTIONS.includes(action) ? action : null;
  } catch {
    return null;
  }
}

function parseCharacterResponse(value) {
  try {
    const parsed = JSON.parse(value);
    const text = String(parsed?.text || "").replace(/\s+/g, " ").trim().slice(0, 48);
    if (!text) return null;
    const action = ACTIONS.includes(parsed.action) ? parsed.action : null;
    return { text, action };
  } catch {
    return null;
  }
}

async function readSse(response, onDelta) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let buffer = "";
  let argumentsText = "";
  let finalResponse = null;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";
    for (const eventBlock of events) {
      const data = eventBlock.split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") continue;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }

      if (event.type === "response.output_text.delta" && event.delta) onDelta?.(event.delta);
      if (event.type === "response.function_call_arguments.delta") argumentsText += event.delta || "";
      if (event.type === "response.function_call_arguments.done") {
        finalResponse = parseCharacterResponse(event.arguments || argumentsText) || finalResponse;
      }
      if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
        finalResponse = parseCharacterResponse(event.item.arguments || argumentsText) || finalResponse;
      }
      if (event.type === "response.completed") {
        for (const item of event.response?.output || []) {
          if (item.type === "function_call") {
            finalResponse = parseCharacterResponse(item.arguments) || finalResponse;
          }
        }
      }
    }
    if (done) break;
  }
  return finalResponse;
}

export function getArkConfig(env = process.env) {
  if (!env.VOLC_ARK_API_KEY) throw new Error("Volcengine Ark API key is not configured");
  const model = env.VOLC_ARK_MODEL || "doubao-seed-2-0-lite-260215";
  return {
    apiKey: env.VOLC_ARK_API_KEY,
    visionApiKey: env.VOLC_ARK_VISION_API_KEY || env.VOLC_ARK_API_KEY,
    model,
    visionModel: env.VOLC_ARK_VISION_MODEL || "doubao-seed-2-0-mini-260428",
    visionFallbackModel: env.VOLC_ARK_VISION_FALLBACK_MODEL || model,
    endpoint: env.VOLC_ARK_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/responses",
  };
}

export function looksLikeJiaojiaoCommand(text) {
  return COMMAND_HINT.test(String(text || ""));
}

export async function inferCharacterResponse(text, character, config, onDelta) {
  const activeCharacter = character === "lvdou" ? "lvdou" : "jiaojiao";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: `${CHARACTER_PROMPTS[activeCharacter]}请针对用户刚刚说的话给出一句自然、具体、适合儿童的中文回应，不超过 28 个汉字，不要复述用户整句话，也不要提出连续多个问题。选择最贴合的动作；没有合适动作就用 none。必须调用 respond_as_character。`,
            }],
          },
          { role: "user", content: [{ type: "input_text", text: String(text).slice(0, 120) }] },
        ],
        tools: [{
          type: "function",
          name: "respond_as_character",
          description: "让当前角色用一句话回应用户，并选择一个可选表情动作",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string", description: "角色要说的简短中文回应" },
              action: { type: "string", enum: [...ACTIONS, "none"] },
            },
            required: ["text", "action"],
          },
          strict: true,
        }],
        tool_choice: { type: "function", name: "respond_as_character" },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Ark request failed (${response.status}): ${detail}`);
    }
    return await readSse(response, onDelta);
  } finally {
    clearTimeout(timeout);
  }
}

export const arkInternals = { ACTIONS, parseAction, parseCharacterResponse, readSse };
