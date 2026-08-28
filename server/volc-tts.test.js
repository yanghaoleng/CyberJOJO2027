import assert from "node:assert/strict";
import test from "node:test";
import { getVolcTtsConfig, parseTtsResponse, synthesizeSpeech } from "./volc-tts.js";

test("TTS reuses the configured speech API key and keeps character voices distinct", () => {
  const config = getVolcTtsConfig({ VOLC_SPEECH_API_KEY: "test-key" });
  assert.equal(config.apiKey, "test-key");
  assert.notEqual(config.voices.jiaojiao, config.voices.lvdou);
  assert.equal(config.voices.jiaojiao, "zh_male_tiancaitongsheng_uranus_bigtts");
  assert.equal(config.voices.lvdou, "zh_male_naiqimengwa_uranus_bigtts");
  assert.notEqual(config.voiceProfiles.jiaojiao.speechRate, config.voiceProfiles.lvdou.speechRate);
  assert.equal(config.voiceProfiles.jiaojiao.pitchRate, 0);
  assert.equal(config.voiceProfiles.lvdou.pitchRate, 0);
});

test("TTS response parser joins streamed base64 audio chunks", () => {
  const audio = parseTtsResponse([
    JSON.stringify({ code: 0, data: Buffer.from("hello ").toString("base64") }),
    JSON.stringify({ code: 0, data: Buffer.from("world").toString("base64") }),
    JSON.stringify({ code: 20_000_000, message: "done" }),
  ].join("\n"));
  assert.equal(audio.toString(), "hello world");
});

test("TTS request selects the active character voice", async () => {
  const config = getVolcTtsConfig({ VOLC_SPEECH_API_KEY: "test-key" });
  let requestBody;
  const audio = await synthesizeSpeech("你好", "lvdou", config, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      text: async () => `${JSON.stringify({ code: 0, data: Buffer.from("mp3").toString("base64") })}\n`,
    };
  });
  assert.equal(requestBody.req_params.speaker, config.voices.lvdou);
  assert.equal(requestBody.req_params.audio_params.speech_rate, config.voiceProfiles.lvdou.speechRate);
  assert.equal(requestBody.req_params.audio_params.pitch_rate, config.voiceProfiles.lvdou.pitchRate);
  assert.equal(audio.toString(), "mp3");
});
