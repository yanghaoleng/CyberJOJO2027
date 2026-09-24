import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { WebSocketServer } from "ws";
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
  SeeduplexSession,
  seeduplexInternals,
} from "./seeduplex-session.js";

test("greeting is sent only after the upstream acknowledges session creation", async (t) => {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(server, "listening");
  let acknowledge, session;
  const received = [];
  const created = new Promise((resolve) => {
    server.on("connection", (socket) => {
      socket.on("message", (data) => {
        const event = JSON.parse(String(data)); received.push(event);
        if (event.type === "session.create") { acknowledge = () => socket.send(JSON.stringify({ type: "session.created", session: { id: "test" } })); resolve(); }
      });
    });
  });
  t.after(() => { session.close(); for (const client of server.clients) client.terminate(); server.close(); });
  session = new SeeduplexSession({ config: { endpoint: `ws://127.0.0.1:${server.address().port}`, apiKey: "test", model: "test" }, onReady: () => session.greet("嗨，我来啦！") });
  const connected = session.connect();
  await created;
  assert.equal(session.ready, false);
  assert.equal(received.length, 1);
  const greeted = new Promise((resolve) => [...server.clients][0].on("message", (data) => { if (JSON.parse(String(data)).type === "speech_text_buffer.commit") resolve(); }));
  acknowledge();
  await connected; await greeted;
  assert.equal(session.ready, true);
  assert.equal(received.at(-1).text, "嗨，我来啦！");
});

test("partial transcripts use text deltas and completed events can fall back to accumulated text", () => {
  const transcripts = [];
  const session = new SeeduplexSession({ onTranscript: (entry) => transcripts.push(entry) });
  session._dispatch({ type: "conversation.item.input_audio_transcription.started" });
  for (const delta of ["娇", "娇，", "看看这个"]) session._dispatch(parseDownstreamEvent({ type: "conversation.item.input_audio_transcription.delta", delta }));
  session._dispatch({ type: "conversation.item.input_audio_transcription.completed", text: "" });
  assert.deepEqual(transcripts.map((entry) => entry.text), ["娇", "娇娇，", "娇娇，看看这个", "娇娇，看看这个"]);
  assert.equal(transcripts.at(-1).final, true);
});

test("streaming emits chunks before completion and drops audio after cancellation", () => {
  const emitted = [];
  const session = new SeeduplexSession({ onAudioStart: () => emitted.push("start"), onAudioDelta: ({ audio }) => emitted.push(audio), onAudioDone: ({ audio }) => emitted.push(`done:${audio}`), onCancel: () => emitted.push("cancel") });
  session._dispatch({ type: "response.output_audio.started" });
  session._dispatch({ type: "response.output_audio.delta", audio: "AAAAAA==" });
  assert.deepEqual(emitted, ["start", "AAAAAA=="]);
  assert.deepEqual(session.audioChunks, []);
  session._dispatch({ type: "response.output_audio.started" });
  assert.deepEqual(emitted, ["start", "AAAAAA=="], "a second sentence must not restart browser playback");
  session._dispatch({ type: "response.output_audio.done" });
  session.interrupt();
  session._dispatch({ type: "response.output_audio.delta", audio: "stale" });
  assert.deepEqual(emitted, ["start", "AAAAAA==", "done:", "cancel"]);
  session._dispatch({ type: "response.output_audio.started" });
  session._dispatch({ type: "response.output_audio.delta", audio: "new" });
  assert.equal(emitted.at(-1), "new");
});

test("late sentence starts cannot resurrect a reply while cancellation is pending", () => {
  let starts = 0;
  const session = new SeeduplexSession({ onAudioStart: () => starts++ });
  session.ready = true;
  session.socket = { readyState: 1, send() {} };
  session.interrupt();
  session._dispatch({ type: "response.output_audio.started" });
  assert.equal(starts, 0);
  session._dispatch({ type: "response.canceled" });
  session._dispatch({ type: "response.output_audio.started" });
  assert.equal(starts, 1);
});

test("seeduplex config is null without a speech key and enabled with one", () => {
  assert.equal(getSeeduplexConfig({}), null);
  assert.equal(getSeeduplexConfig({ VOLC_SPEECH_API_KEY: "key" }).enabled, true);
  assert.equal(getSeeduplexConfig({ SEEDUPLEX_API_KEY: "dup-key" }).apiKey, "dup-key");
  assert.equal(getSeeduplexConfig({ SEEDUPLEX_API_KEY: "dup-key" }).model, "1.2.6.1");
});

test("all parallel function calls retain their ids and are returned in one result", () => {
  const sent = [], called = [];
  const session = new SeeduplexSession({ onFunctionCall: call => { called.push(call); if (call.callId === "b") throw new Error("unsupported"); } });
  session.ready = true; session.socket = { readyState: 1, send: data => sent.push(JSON.parse(data)), close() {} };
  session._dispatch(parseDownstreamEvent({ type: "response.function_call_arguments.done", items: [
    { call_id: "a", name: "respond_as_character", arguments: '{"action":"heart"}' },
    { call_id: "b", name: "unsupported", arguments: {} },
  ] }));
  assert.deepEqual(called.map(c => c.callId), ["a", "b"]);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].items.map(c => c.call_id), ["a", "b"]);
  assert.equal(JSON.parse(sent[0].items[1].content[0].text).ok, false);
});

test("missing cancellation ack fails closed instead of permanently swallowing future replies", async () => {
  const errors = [], sent = [];
  const session = new SeeduplexSession({ config: { cancelTimeoutMs: 15 }, onError: error => errors.push(error.message) });
  session.ready = true; session.socket = { readyState: 1, send: data => sent.push(JSON.parse(data)), close() {} };
  session.interrupt(); session.interrupt();
  assert.equal(sent.filter(e => e.type === "response.cancel").length, 1);
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(session.closed, true); assert.equal(errors.length, 1);
  assert.match(errors[0], /cancel acknowledgement timeout/);
});

test("a silent reply timeout is bounded while muted gameplay never starts that watchdog", async () => {
  const errors = [];
  const session = new SeeduplexSession({ config: { responseTimeoutMs: 15 }, onError: error => errors.push(error.message) });
  session.ready = true; session.socket = { readyState: 1, send() {}, close() {} };
  session.setMuted(true);
  session._dispatch({ type: "conversation.item.input_audio_transcription.completed", text: "问题" });
  await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(errors.length, 0);
  session.setMuted(false);
  session._dispatch({ type: "conversation.item.input_audio_transcription.completed", text: "再问一次" });
  await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(errors.length, 1);
  assert.equal(session.closed, true);
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
  const asrContext = JSON.parse(event.session.extension.asr.extra.context);
  assert.ok(asrContext.hotwords.some(({ word }) => word === "叫叫"));
  assert.equal(asrContext.correct_words["娇娇"], "叫叫");
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
  assert.ok(instructionsOnly.session.instructions.endsWith("新指令"));
  assert.ok(instructionsOnly.session.instructions.includes("叫叫"));
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
  assert.equal(fc.calls[0].callId, "c1");
  assert.equal(fc.calls[0].arguments.includes("heart"), true);
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


test("assembleWavBase64 converts float32 pcm to int16 wav payload", () => {
  // 0.5f -> 00 00 00 3F ; -0.5f -> 00 00 00 BF （32bit float 小端）
  const chunks = [
    Buffer.from([0, 0, 0, 0x3f]).toString("base64"),
    Buffer.from([0, 0, 0, 0xbf]).toString("base64"),
  ];
  const wav = assembleWavBase64(chunks, 24_000);
  const buf = Buffer.from(wav, "base64");
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WAVE");
  assert.equal(buf.toString("ascii", 12, 16), "fmt ");
  assert.equal(buf.toString("ascii", 36, 40), "data");
  assert.equal(buf.readUInt16LE(20), 1); // PCM
  assert.equal(buf.readUInt16LE(22), 1); // mono
  assert.equal(buf.readUInt32LE(24), 24_000);
  assert.equal(buf.readUInt16LE(34), 16); // 16bit
  assert.equal(buf.readUInt32LE(40), 4); // 2 samples * 2 bytes
  assert.equal(buf.length, 44 + 4);
  // 0.5*32767 -> 16384 (0x4000) ; -0.5*32767 -> Math.round(-16383.5) = -16383
  assert.equal(buf.readInt16LE(44), 16384);
  assert.equal(buf.readInt16LE(46), -16383);
});

test("assembleWavBase64 passes through when payload is not float32-sized", () => {
  // 3 字节（非 4 的倍数）→ 原样透传
  const chunks = [Buffer.from([1, 0, 2]).toString("base64")];
  const wav = assembleWavBase64(chunks, 24_000);
  const buf = Buffer.from(wav, "base64");
  assert.equal(buf[40], 3); // data size 低字节
  assert.equal(buf.length, 44 + 3);
  assert.deepEqual([...buf.subarray(44)], [1, 0, 2]);
});

test("buildWavHeader matches RIFF spec sizes", () => {
  const header = buildWavHeader(8000, 24_000);
  assert.equal(header.length, 44);
  assert.equal(header.readUInt32LE(4), 36 + 8000);
});
