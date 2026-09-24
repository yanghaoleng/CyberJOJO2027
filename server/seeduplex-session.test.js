import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleWavBase64,
  buildAudioAppend,
  buildGreet,
  buildMute,
  buildSessionCreate,
  buildSessionUpdate,
  buildToolResult,
  buildWavHeader,
  getSeeduplexConfig,
  parseDownstreamEvent,
  seeduplexInternals,
} from "./seeduplex-session.js";

test("seeduplex config is null without a speech key and enabled with one", () => {
  assert.equal(getSeeduplexConfig({}), null);
  assert.equal(getSeeduplexConfig({ VOLC_SPEECH_API_KEY: "key" }).enabled, true);
  assert.equal(getSeeduplexConfig({ SEEDUPLEX_API_KEY: "dup-key" }).apiKey, "dup-key");
  assert.equal(getSeeduplexConfig({ SEEDUPLEX_API_KEY: "dup-key" }).model, "1.2.6.1");
});

test("session.create carries persona instructions, pcm input and voice output", () => {
  const config = { model: "1.2.6.1" };
  const event = buildSessionCreate(config, {
    instructions: "你是叫叫，有自己的小烦恼。",
    voice: "zh_male_tiancaitongsheng_uranus_bigtts",
    context: [{ role: "user", text: "今天搭了积木" }, { role: "assistant", text: "好耶" }],
    tools: [{ type: "function", name: "respond_as_character" }],
  });
  assert.equal(event.type, "session.create");
  assert.equal(event.session.model, "1.2.6.1");
  assert.ok(event.session.instructions.includes("小烦恼"));
  assert.deepEqual(event.session.audio.input.format, { type: "pcm", rate: 16_000 });
  assert.equal(event.session.audio.output.format.type, "pcm");
  assert.equal(event.session.audio.output.voice, "zh_male_tiancaitongsheng_uranus_bigtts");
  assert.equal(event.session.dialog_context.length, 2);
  assert.equal(event.session.tools[0].name, "respond_as_character");
});

test("session.create truncates oversized history and instructions", () => {
  const event = buildSessionCreate({ model: "1.2.6.1" }, {
    instructions: "字".repeat(13_000),
    voice: "v",
    context: Array.from({ length: 50 }, (_, i) => ({ role: "user", text: `第${i}条` })),
  });
  assert.ok(event.session.instructions.length <= 12_000);
  assert.equal(event.session.dialog_context.length, 40);
});

test("audio append base64-encodes pcm and supports mute and greeting events", () => {
  const pcm = Buffer.from([0, 1, 2, 250]);
  const append = buildAudioAppend(pcm);
  assert.equal(append.type, "input_audio_buffer.append");
  assert.equal(append.audio, pcm.toString("base64"));
  assert.equal(buildMute(true).type, "input_audio_mute.commit");
  assert.equal(buildMute(false).type, "input_audio_unmute.commit");
  assert.equal(buildGreet("我来啦").type, "speech_text_buffer.commit");
  assert.equal(buildGreet("我来啦").text, "我来啦");
});

test("session.update only patches provided fields", () => {
  const voiceOnly = buildSessionUpdate({ voice: "new-voice" });
  assert.equal(voiceOnly.type, "session.update");
  assert.equal(voiceOnly.session.instructions, undefined);
  assert.equal(voiceOnly.session.audio.output.voice, "new-voice");
  const instructionsOnly = buildSessionUpdate({ instructions: "新指令" });
  assert.equal(instructionsOnly.session.audio, undefined);
  assert.equal(instructionsOnly.session.instructions, "新指令");
});

test("function call results are returned as tool items with the same call id", () => {
  const event = buildToolResult({ callId: "call-1" });
  assert.equal(event.type, "conversation.item.create");
  assert.equal(event.items[0].call_id, "call-1");
  assert.equal(event.items[0].role, "tool");
});

test("downstream transcription, text, audio and function-call events are parsed", () => {
  assert.deepEqual(parseDownstreamEvent('{"type":"session.created","session":{"id":"d1"}}'), { type: "session.created", sessionId: "d1" });
  assert.deepEqual(parseDownstreamEvent('{"type":"conversation.item.input_audio_transcription.delta","utterance":"今天"}'), { type: "conversation.item.input_audio_transcription.delta", text: "今天" });
  assert.deepEqual(parseDownstreamEvent('{"type":"conversation.item.input_audio_transcription.completed","utterance":"今天搭了积木"}'), { type: "conversation.item.input_audio_transcription.completed", itemId: "", text: "今天搭了积木" });
  assert.deepEqual(parseDownstreamEvent('{"type":"response.output_text.done","text":"我也有点好奇"}'), { type: "response.output_text.done", text: "我也有点好奇" });
  const audioDelta = parseDownstreamEvent('{"type":"response.output_audio.delta","audio":"QUJD"}');
  assert.equal(audioDelta.type, "response.output_audio.delta");
  assert.equal(audioDelta.audio, "QUJD");
  assert.deepEqual(parseDownstreamEvent('{"type":"response.output_audio.done","status_code":"0"}'), { type: "response.output_audio.done", statusCode: "0" });
  const fc = parseDownstreamEvent('{"type":"response.function_call_arguments.done","call_id":"c1","name":"respond_as_character","arguments":"{\\"action\\":\\"heart\\",\\"story\\":{\\"thread\\":\\"feelings\\"}}"}');
  assert.equal(fc.type, "response.function_call_arguments.done");
  assert.equal(fc.callId, "c1");
  assert.equal(fc.arguments.includes("heart"), true);
  const error = parseDownstreamEvent('{"type":"error","code":40000010,"message":"boom"}');
  assert.equal(error.type, "error");
  assert.equal(error.message, "boom");
});

test("malformed downstream events degrade to unknown without throwing", () => {
  assert.deepEqual(parseDownstreamEvent("not json"), { type: "unknown" });
  assert.deepEqual(parseDownstreamEvent(null), { type: "unknown" });
  assert.deepEqual(parseDownstreamEvent('{"type":"whatever"}'), { type: "whatever" });
});

test("internals expose the fixed duplex endpoint and model", () => {
  assert.equal(seeduplexInternals.DEFAULT_ENDPOINT, "wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue");
  assert.equal(seeduplexInternals.DEFAULT_MODEL, "1.2.6.1");
});


test("assembleWavBase64 builds a valid RIFF/WAVE header with pcm payload", () => {
  const chunks = [Buffer.from([1, 0, 2, 0]).toString("base64"), Buffer.from([3, 0, 4, 0]).toString("base64")];
  const wav = assembleWavBase64(chunks, 24_000);
  const buf = Buffer.from(wav, "base64");
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WAVE");
  assert.equal(buf.toString("ascii", 12, 16), "fmt ");
  assert.equal(buf.toString("ascii", 36, 40), "data");
  assert.equal(buf.readUInt16LE(20), 1);
  assert.equal(buf.readUInt16LE(22), 1);
  assert.equal(buf.readUInt32LE(24), 24_000);
  assert.equal(buf.readUInt16LE(34), 16);
  assert.equal(buf.readUInt32LE(40), 8);
  assert.equal(buf.length, 44 + 8);
  assert.deepEqual([...buf.subarray(44)], [1, 0, 2, 0, 3, 0, 4, 0]);
});

test("buildWavHeader matches RIFF spec sizes", () => {
  const header = buildWavHeader(8000, 24_000);
  assert.equal(header.length, 44);
  assert.equal(header.readUInt32LE(4), 36 + 8000);
});
