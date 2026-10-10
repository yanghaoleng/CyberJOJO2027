import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";
import WebSocket, { WebSocketServer } from "ws";

async function waitFor(condition, timeout = 6000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("Word voice test timed out");
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}

test("word practice sends microphone audio to unmuted ASR and DOMI uses prompt TTS for every spoken response", { timeout: 20000 }, async () => {
  const ttsRequests = [];
  let failTts = false;
  const tts = http.createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    ttsRequests.push(JSON.parse(Buffer.concat(chunks)));
    if (failTts) { response.writeHead(503); response.end("fixture temporarily unavailable"); return; }
    response.end(JSON.stringify({ code: 0, data: Buffer.from("fixture mp3").toString("base64") }));
  });
  tts.listen(0, "127.0.0.1"); await once(tts, "listening");
  const provider = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(provider, "listening");
  let upstream, muted = false, audioPackets = 0;
  const providerMessages = [];
  provider.on("connection", socket => {
    upstream = socket;
    socket.on("message", data => {
      const message = JSON.parse(data); providerMessages.push(message);
      if (message.type === "session.create") socket.send(JSON.stringify({ type: "session.created", session: { id: "practice" } }));
      if (message.type === "input_audio_mute.commit") muted = true;
      if (message.type === "input_audio_unmute.commit") muted = false;
      if (message.type === "response.cancel") socket.send(JSON.stringify({ type: "response.canceled" }));
      if (message.type === "input_audio_buffer.append") {
        audioPackets++;
        if (!muted) socket.send(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", text: "apple" }));
      }
    });
  });
  const portReservation = http.createServer(); portReservation.listen(0, "127.0.0.1"); await once(portReservation, "listening");
  const port = portReservation.address().port; await new Promise(resolve => portReservation.close(resolve));
  const setup = `const originalFetch=globalThis.fetch;globalThis.fetch=(url,options)=>originalFetch('http://127.0.0.1:${tts.address().port}',options);`;
  const child = spawn(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(setup)}`, fileURLToPath(new URL("./index.js", import.meta.url))], {
    env: { PATH: process.env.PATH, PORT: String(port), VOLC_ARK_API_KEY: "fixture", VOLC_SPEECH_API_KEY: "fixture", SEEDUPLEX_ENDPOINT: `ws://127.0.0.1:${provider.address().port}`, JOCAM_ALLOWED_ORIGINS: "http://127.0.0.1:5173" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = ""; child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
  let client;
  const reply = text => {
    upstream.send(JSON.stringify({ type: "response.output_audio.started" }));
    upstream.send(JSON.stringify({ type: "response.output_text.done", text }));
    upstream.send(JSON.stringify({ type: "response.output_audio.delta", delta: "AAAAAA==" }));
    upstream.send(JSON.stringify({ type: "response.output_audio.done" }));
  };
  try {
    await waitFor(() => output.includes("bridge listening"));
    client = new WebSocket(`ws://127.0.0.1:${port}/voice`, { origin: "http://127.0.0.1:5173" }); await once(client, "open");
    const messages = []; client.on("message", data => messages.push(JSON.parse(data)));
    const send = message => client.send(JSON.stringify(message));
    send({ type: "start", inputMode: "voice", character: "lvdou", resume: true });
    await waitFor(() => messages.some(m => m.type === "ready"));
    send({ type: "ping", id: "health-fixture" });
    await waitFor(() => messages.some(m => m.type === "pong" && m.id === "health-fixture"));
    send({ type: "interaction_mode", mode: "feed" });
    send({ type: "local_speech", text: "Can you say apple?" });
    await waitFor(() => messages.some(m => m.type === "speech" && m.local));
    assert.equal(muted, false, "gameplay must not mute recognition input");
    client.send(Buffer.alloc(640, 12));
    await waitFor(() => messages.some(m => m.type === "transcript" && m.final && m.text === "apple"));
    assert.ok(audioPackets > 0);
    assert.equal(messages.find(m => m.type === "transcript").source, "gameplay");
    const before = messages.length;
    reply("Unrelated free-chat reply");
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(messages.slice(before).some(m => m.type.startsWith("speech")), false);
    assert.equal(ttsRequests.length, 1, "practice must not synthesize a competing free-chat response");
    send({ type: "interaction_mode", mode: "none" });
    await waitFor(() => providerMessages.filter(m => m.type === "input_audio_unmute.commit").length >= 3);
    reply("Hello! Let's find something together.");
    await waitFor(() => messages.some(m => m.type === "speech" && !m.local));
    assert.equal(messages.some(m => ["speech_start", "speech_chunk"].includes(m.type)), false, "DOMI never plays the other PCM timbre");
    assert.equal(ttsRequests.length, 2);
    assert.ok(ttsRequests.every(r => r.req_params.speaker === "zh_male_naiqimengwa_uranus_bigtts"));
    assert.deepEqual(ttsRequests[0].req_params.audio_params, ttsRequests[1].req_params.audio_params);
    assert.equal(messages.find(m => m.type === "speech" && !m.local).character, "lvdou");
    assert.ok(messages.filter(m => m.type === "speech").every(m => m.voiceSource === "domi-word-tts-v1"));
    failTts = true;
    const beforeFailure = messages.length;
    reply("The voice provider is temporarily unavailable.");
    await waitFor(() => messages.slice(beforeFailure).some(m => m.type === "diagnostic" && m.stage === "synthesis" && m.code === "speech_failed"));
    assert.equal(client.readyState, WebSocket.OPEN, "a TTS failure must not break a healthy microphone connection");
    assert.ok(messages.slice(beforeFailure).some(m => m.type === "ai" && m.state === "idle"));
    failTts = false;
    reply("I am back and listening.");
    await waitFor(() => messages.some(m => m.type === "speech" && m.text === "I am back and listening."));
    send({ type: "interaction_mode", mode: "feed" });
    send({ type: "local_speech", character: "lvdou", replace: true, text: "two bananas" });
    await waitFor(() => messages.some(m => m.type === "speech" && m.text === "two bananas"));
    const afterFirstPrompt = messages.length;
    send({ type: "local_speech", character: "lvdou", replace: true, text: "three bananas" });
    send({ type: "local_speech", character: "lvdou", replace: true, text: "five purple oranges" });
    await waitFor(() => messages.some(m => m.type === "speech" && m.text === "five purple oranges"));
    assert.equal(messages.slice(afterFirstPrompt).some(m => m.type === "speech" && m.text === "three bananas"), false, "rapid suggestions read only the final prompt");
    send({ type: "local_speech", character: "lvdou", replace: true, text: "one pink apple" });
    send({ type: "interaction_mode", mode: "none" });
    await new Promise(resolve => setTimeout(resolve, 750));
    assert.equal(messages.some(m => m.type === "speech" && m.text === "one pink apple"), false, "leaving practice cancels pending prompt TTS");
  } finally {
    client?.terminate(); child.kill("SIGTERM");
    for (const socket of provider.clients) socket.terminate();
    await new Promise(resolve => provider.close(resolve)); await new Promise(resolve => tts.close(resolve));
  }
});
