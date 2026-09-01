const MAX_DAYS = 14;
const MAX_ENTRIES_PER_DAY = 60;
const MAX_ENTRY_TEXT_LENGTH = 180;
const MAX_TOTAL_TEXT_LENGTH = 24_000;
const MAX_IMAGE_DATA_URL_LENGTH = 210_000;

function cleanText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function validateConversationDays(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_DAYS) {
    throw Object.assign(new Error("Conversation summary requires 1 to 14 days"), { statusCode: 400 });
  }
  const seenDays = new Set();
  let totalTextLength = 0;
  return value.map((day) => {
    const dayKey = String(day?.dayKey || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || seenDays.has(dayKey)) {
      throw Object.assign(new Error("Conversation summary day is invalid"), { statusCode: 400 });
    }
    seenDays.add(dayKey);
    if (!Array.isArray(day.entries) || day.entries.length > MAX_ENTRIES_PER_DAY) {
      throw Object.assign(new Error("Conversation summary entries are invalid"), { statusCode: 400 });
    }
    const entries = day.entries.map((entry) => {
      const text = cleanText(entry?.text, MAX_ENTRY_TEXT_LENGTH);
      if (!text) throw Object.assign(new Error("Conversation summary text is empty"), { statusCode: 400 });
      totalTextLength += text.length;
      return {
        role: entry?.role === "assistant" ? "assistant" : "user",
        character: entry?.character === "lvdou" ? "lvdou" : "jiaojiao",
        text,
        createdAt: Number(entry?.createdAt) || 0,
      };
    });
    const image = String(day?.image || "");
    if (image && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)) {
      throw Object.assign(new Error("Conversation summary image must be a base64 JPEG data URL"), { statusCode: 400 });
    }
    if (image.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw Object.assign(new Error("Conversation summary image is too large"), { statusCode: 413 });
    }
    if (!entries.length && !image) {
      throw Object.assign(new Error("Conversation summary day has no usable source"), { statusCode: 400 });
    }
    return { dayKey, entries, image, source: entries.length ? "dialogue" : "captures" };
  }).map((day) => {
    if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
      throw Object.assign(new Error("Conversation summary text is too large"), { statusCode: 413 });
    }
    return day;
  });
}

export function parseConversationSummaries(value, expectedDayKeys = []) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  const expected = new Set(expectedDayKeys);
  const summaries = [];
  const seen = new Set();
  for (const item of parsed?.summaries || []) {
    const dayKey = String(item?.day_key || "");
    const summary = cleanText(item?.summary, 120);
    if (!expected.has(dayKey) || seen.has(dayKey) || !summary) continue;
    seen.add(dayKey);
    summaries.push({ dayKey, summary });
  }
  return summaries.length ? summaries : null;
}

async function readSummarySse(response, expectedDayKeys) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let buffer = "";
  let argumentsText = "";
  let summaries = null;
  let usage = null;

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
      if (event.type === "response.function_call_arguments.delta") argumentsText += event.delta || "";
      if (event.type === "response.function_call_arguments.done") {
        summaries = parseConversationSummaries(event.arguments || argumentsText, expectedDayKeys) || summaries;
      }
      if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
        summaries = parseConversationSummaries(event.item.arguments || argumentsText, expectedDayKeys) || summaries;
      }
      if (event.type === "response.completed") {
        usage = event.response?.usage || usage;
        for (const item of event.response?.output || []) {
          if (item.type === "function_call") {
            summaries = parseConversationSummaries(item.arguments || argumentsText, expectedDayKeys) || summaries;
          }
        }
      }
    }
    if (done) break;
  }
  return summaries ? { summaries, usage } : null;
}

function createSummaryInput(days) {
  return days.flatMap((day) => {
    if (day.entries.length) {
      return [{
        type: "input_text",
        text: JSON.stringify({
          day_key: day.dayKey,
          source: "dialogue",
          dialogue: day.entries.map((entry) => ({
            speaker: entry.role === "user" ? "小朋友" : entry.character === "lvdou" ? "绿豆" : "叫叫",
            text: entry.text,
          })),
        }),
      }];
    }
    return [
      {
        type: "input_text",
        text: JSON.stringify({
          day_key: day.dayKey,
          source: "captures",
          instruction: "这一天没有可用对话，请根据紧随其后的低清作品拼图写当天小记。",
        }),
      },
      { type: "input_image", image_url: day.image, detail: "low" },
    ];
  });
}

export async function summarizeConversationDays(rawDays, config, fetchImpl = fetch) {
  const days = validateConversationDays(rawDays);
  const dayKeys = days.map(({ dayKey }) => dayKey);
  const models = [...new Set([
    config.summaryModel || config.visionModel || config.model,
    config.summaryFallbackModel || config.visionFallbackModel || config.model,
  ].filter(Boolean))];
  let lastError = null;

  for (const [modelIndex, model] of models.entries()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9_000);
    try {
      const response = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.summaryApiKey || config.visionApiKey || config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          stream: true,
          store: false,
          thinking: { type: "disabled" },
          max_output_tokens: 520,
          input: [
            {
              role: "system",
              content: [{
                type: "input_text",
                text: "你是儿童相机的日记整理员。请为每一天分别写一句自然温暖的中文当天小记。有对话时，只概括小朋友聊了什么、角色怎样回应；没有对话时，只根据对应的低清作品拼图概括当天拍到了什么。只写输入中真实出现且能看清的内容，不补充人物身份、年龄、情绪、健康、地点或活动，不评价小朋友，不判断食物是否新鲜或安全。画面不清楚时，只写高把握的可见事物。每句 18 到 52 个汉字，不使用 emoji。必须调用 summarize_daily_conversations。",
              }],
            },
            {
              role: "user",
              content: createSummaryInput(days),
            },
          ],
          tools: [{
            type: "function",
            name: "summarize_daily_conversations",
            description: "按日期返回每天的当天小记",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                summaries: {
                  type: "array",
                  minItems: days.length,
                  maxItems: days.length,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      day_key: { type: "string", enum: dayKeys },
                      summary: { type: "string" },
                    },
                    required: ["day_key", "summary"],
                  },
                },
              },
              required: ["summaries"],
            },
            strict: true,
          }],
          tool_choice: { type: "function", name: "summarize_daily_conversations" },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 260);
        lastError = new Error(`Ark summary request failed (${response.status}): ${detail}`);
        if ([403, 404].includes(response.status) && modelIndex < models.length - 1) continue;
        throw lastError;
      }
      const result = await readSummarySse(response, dayKeys);
      if (!result?.summaries) throw new Error("Ark summary returned no structured summaries");
      const sourceByDay = new Map(days.map(({ dayKey, source }) => [dayKey, source]));
      return {
        ...result,
        summaries: result.summaries.map((summary) => ({
          ...summary,
          source: sourceByDay.get(summary.dayKey) || "dialogue",
        })),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error("Ark summary has no configured model");
}

export const summaryInternals = {
  MAX_DAYS,
  MAX_ENTRIES_PER_DAY,
  MAX_ENTRY_TEXT_LENGTH,
  MAX_TOTAL_TEXT_LENGTH,
  MAX_IMAGE_DATA_URL_LENGTH,
  createSummaryInput,
  readSummarySse,
};
