import { randomUUID } from "node:crypto";

const DEFAULT_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const DEFAULT_RESOURCE_ID = "seed-tts-2.0";
const DEFAULT_VOICES = Object.freeze({
  jiaojiao: "zh_male_tiancaitongsheng_uranus_bigtts",
  lvdou: "zh_male_naiqimengwa_uranus_bigtts",
});
const DEFAULT_VOICE_PROFILES = Object.freeze({
  jiaojiao: Object.freeze({ speechRate: 4, pitchRate: 0 }),
  lvdou: Object.freeze({ speechRate: -2, pitchRate: 0 }),
});

function normalizeCharacter(character) {
  return character === "lvdou" ? "lvdou" : "jiaojiao";
}

export function getVolcTtsConfig(env = process.env) {
  const config = {
    endpoint: env.VOLC_TTS_ENDPOINT || DEFAULT_ENDPOINT,
    resourceId: env.VOLC_TTS_RESOURCE_ID || DEFAULT_RESOURCE_ID,
    apiKey: env.VOLC_TTS_API_KEY || env.VOLC_SPEECH_API_KEY || "",
    appId: env.VOLC_TTS_APP_ID || env.VOLC_SPEECH_APP_ID || "",
    accessKey: env.VOLC_TTS_ACCESS_KEY || env.VOLC_SPEECH_ACCESS_TOKEN || "",
    voices: {
      jiaojiao: env.JOCAM_TTS_JIAOJIAO_VOICE || DEFAULT_VOICES.jiaojiao,
      lvdou: env.JOCAM_TTS_LVDOU_VOICE || DEFAULT_VOICES.lvdou,
    },
    voiceProfiles: {
      jiaojiao: {
        speechRate: Number(env.JOCAM_TTS_JIAOJIAO_SPEECH_RATE ?? DEFAULT_VOICE_PROFILES.jiaojiao.speechRate),
        pitchRate: Number(env.JOCAM_TTS_JIAOJIAO_PITCH_RATE ?? DEFAULT_VOICE_PROFILES.jiaojiao.pitchRate),
      },
      lvdou: {
        speechRate: Number(env.JOCAM_TTS_LVDOU_SPEECH_RATE ?? DEFAULT_VOICE_PROFILES.lvdou.speechRate),
        pitchRate: Number(env.JOCAM_TTS_LVDOU_PITCH_RATE ?? DEFAULT_VOICE_PROFILES.lvdou.pitchRate),
      },
    },
  };
  const endpointHost = new URL(config.endpoint).hostname;
  if (!/(^|\.)(bytedance\.com|volces\.com)$/.test(endpointHost)) {
    throw new Error("Volcengine TTS endpoint is not an approved host");
  }
  if (!config.apiKey && !(config.appId && config.accessKey)) {
    throw new Error("Volcengine TTS credentials are not configured");
  }
  return config;
}

export function parseTtsResponse(payload) {
  const chunks = [];
  for (const line of String(payload || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    const code = Number(event.code || 0);
    if (code !== 0 && code !== 20_000_000) {
      throw new Error(`Volcengine TTS ${code}: ${event.message || "request failed"}`);
    }
    if (event.data) chunks.push(Buffer.from(event.data, "base64"));
  }
  if (!chunks.length) throw new Error("Volcengine TTS returned no audio");
  return Buffer.concat(chunks);
}

export async function synthesizeSpeech(text, character, config, fetchImpl = fetch) {
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!normalizedText) throw new Error("TTS text is empty");
  const activeCharacter = normalizeCharacter(character);
  const voiceProfile = config.voiceProfiles?.[activeCharacter] || DEFAULT_VOICE_PROFILES[activeCharacter];
  const requestId = randomUUID();
  const headers = {
    "Content-Type": "application/json",
    "X-Api-Resource-Id": config.resourceId,
    "X-Api-Request-Id": requestId,
  };
  if (config.apiKey) headers["X-Api-Key"] = config.apiKey;
  else {
    headers["X-Api-App-Id"] = config.appId;
    headers["X-Api-Access-Key"] = config.accessKey;
  }

  const response = await fetchImpl(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user: { uid: `jocam-${activeCharacter}` },
      req_params: {
        text: normalizedText,
        speaker: config.voices[activeCharacter],
        audio_params: {
          format: "mp3",
          sample_rate: 24_000,
          speech_rate: voiceProfile.speechRate,
          pitch_rate: voiceProfile.pitchRate,
        },
      },
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`Volcengine TTS request failed (${response.status}): ${detail}`);
  }
  return parseTtsResponse(await response.text());
}

export const ttsInternals = { DEFAULT_VOICES, DEFAULT_VOICE_PROFILES, normalizeCharacter };
