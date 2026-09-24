import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";
import WebSocket, { WebSocketServer } from "ws";

async function waitFor(condition, timeout = 6000) {
  const started = Date.now();
  while (!condition()) { if (Date.now() - started > timeout) throw new Error("Voice session test timed out"); await new Promise((resolve) => setTimeout(resolve, 15)); }
}
async function freePort() { const server = http.createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening"); const port = server.address().port; await new Promise((resolve) => server.close(resolve)); return port; }

test("cover warmup waits for activation, reuses upstream, and greets once even with early clicks", { timeout: 15000 }, async () => {
  const provider = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(provider, "listening");
  const sessions = [];
  provider.on("connection", socket => {
    const entry = { socket, messages: [] }; sessions.push(entry);
    socket.on("message", data => {
      const message = JSON.parse(data); entry.messages.push(message);
      if (message.type === "speech_text_buffer.commit") {
        socket.send(JSON.stringify({ type: "response.output_audio.started" }));
        socket.send(JSON.stringify({ type: "response.output_audio.delta", delta: "AAAAAA==" }));
        socket.send(JSON.stringify({ type: "response.output_audio.done" }));
      }
    });
  });
  const port = await freePort();
  const child = spawn(process.execPath, [fileURLToPath(new URL("./index.js", import.meta.url))], {
    env: { PATH: process.env.PATH, PORT: String(port), VOLC_ARK_API_KEY: "test-only", VOLC_SPEECH_API_KEY: "test-only", SEEDUPLEX_ENDPOINT: `ws://127.0.0.1:${provider.address().port}`, JOCAM_ALLOWED_ORIGINS: "http://127.0.0.1:5173" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = ""; child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
  const clients = [];
  try {
    await waitFor(() => output.includes("bridge listening"));
    for (const mode of ["ready-first", "click-first", "legacy-start", "domi-start"]) {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/voice`, { origin: "http://127.0.0.1:5173" }); clients.push(socket);
      await once(socket, "open");
      const messages = []; socket.on("message", data => messages.push(JSON.parse(data)));
      const send = value => socket.send(JSON.stringify(value));
      const count = sessions.length;
      send({ type: "start", inputMode: "voice", character: mode === "domi-start" ? "lvdou" : "jiaojiao", deferGreeting: mode !== "legacy-start" && mode !== "domi-start" });
      await waitFor(() => sessions.length === count + 1 && sessions.at(-1).messages.length > 0);
      const upstream = sessions.at(-1);
      const greetings = () => upstream.messages.filter(m => m.type === "speech_text_buffer.commit");
      if (mode !== "legacy-start") send({ type: "context", entries: [{ role: "user", text: "我读了小兔子的绘本" }] });
      if (mode === "click-first") { send({ type: "activate", storyDay: 2 }); send({ type: "activate", storyDay: 2 }); }
      if (mode === "ready-first") {
        // Audio input received before consent/activation must not reach upstream.
        socket.send(Buffer.alloc(640));
      }
      upstream.socket.send(JSON.stringify({ type: "session.created", session: { id: mode } }));
      await waitFor(() => messages.some(m => m.type === "ready"));
      if (mode === "ready-first") {
        assert.equal(greetings().length, 0);
        assert.equal(messages.some(m => m.type.startsWith("speech_")), false);
        assert.equal(upstream.messages.some(m => m.type === "input_audio_buffer.append"), false);
        send({ type: "activate", storyDay: 2 }); send({ type: "activate", storyDay: 2 });
      }
      await waitFor(() => messages.some(m => m.type === "speech_end"));
      assert.equal(greetings().length, 1);
      if (mode === "domi-start") {
        assert.match(greetings()[0].text, /I'm Domi/);
        assert.ok(upstream.messages.some(m => m.type === "session.create" && m.session.instructions.includes("Speak only English")));
      }
      if (mode === "ready-first" || mode === "click-first") {
        assert.ok(greetings()[0].text.includes("绘本"));
        assert.ok(upstream.messages.some(m => m.type === "session.update" && m.session.instructions.includes("第2次") && m.session.instructions.includes("我读了小兔子的绘本")));
      }
      assert.equal(sessions.length, count + 1, "activation must not reconnect the model");
      if (mode === "ready-first") {
        for (let turn = 0; turn < 4; turn++) {
          upstream.socket.send(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", text: `测试问题${turn}` }));
          const ids = [`turn-${turn}-a`, `turn-${turn}-b`];
          upstream.socket.send(JSON.stringify({ type: "response.function_call_arguments.done", items: ids.map(call_id => ({
            call_id, name: "respond_as_character", arguments: JSON.stringify({ action: "none", story: { thread: "none" } }),
          })) }));
          await waitFor(() => upstream.messages.some(m => m.type === "conversation.item.create" && m.items?.[0]?.call_id === ids[0]));
          const result = upstream.messages.find(m => m.type === "conversation.item.create" && m.items?.[0]?.call_id === ids[0]);
          assert.deepEqual(result.items.map(item => item.call_id), ids);
          upstream.socket.send(JSON.stringify({ type: "response.output_audio.started" }));
          upstream.socket.send(JSON.stringify({ type: "response.output_audio.delta", delta: "AAAAAA==" }));
          upstream.socket.send(JSON.stringify({ type: "response.output_audio.done" }));
          await waitFor(() => messages.filter(m => m.type === "speech_end").length === turn + 2);
        }
        upstream.socket.send(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", text: "我想Domi了" }));
        await waitFor(() => messages.some(m => m.type === "character_switch" && m.character === "lvdou"));
        assert.ok(upstream.messages.some(m => m.type === "session.update" && m.session.instructions.includes("Speak only English")));
        upstream.socket.send(JSON.stringify({ type: "response.canceled" }));
        await waitFor(() => greetings().some(m => m.text.includes("I'm Domi")));
        upstream.socket.send(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", text: "我想叫叫了" }));
        await waitFor(() => messages.some(m => m.type === "character_switch" && m.character === "jiaojiao"));
        upstream.socket.send(JSON.stringify({ type: "response.canceled" }));
        await waitFor(() => greetings().some(m => m.text.includes("绘本")));
      }
      socket.send(Buffer.alloc(640));
      await waitFor(() => upstream.messages.some(m => m.type === "input_audio_buffer.append"));
      const closed = once(socket, "close"); socket.close(); await closed;
    }
  } finally {
    for (const socket of clients) socket.terminate();
    child.kill("SIGTERM");
    for (const socket of provider.clients) socket.terminate();
    await new Promise(resolve => provider.close(resolve));
  }
});

test("text-only voice sessions preserve gameplay transcripts and let a newer turn preempt an unfinished reply", { timeout: 25000 }, async () => {
  const calls = [];
  let responseDelay = 30;
  let providerReturned = 0;
  const provider = http.createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    if (request.url === "/tts") { response.end(JSON.stringify({ code: 0, data: Buffer.from("mock audio").toString("base64") })); return; }
    calls.push(JSON.parse(Buffer.concat(chunks)));
    setTimeout(() => {
      providerReturned += 1;
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.end(`data: ${JSON.stringify({ type: "response.function_call_arguments.done", arguments: JSON.stringify({ text: "我在认真听你说。", action: "none" }) })}\n\n`);
    }, responseDelay);
  });
  provider.listen(0, "127.0.0.1"); await once(provider, "listening");
  const providerPort = provider.address().port;
  const port = await freePort();
  const setup = `const originalFetch=globalThis.fetch;globalThis.fetch=(url,options)=>originalFetch(String(url).includes('/tts/')?'http://127.0.0.1:${providerPort}/tts':url,options);`;
  const child = spawn(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(setup)}`, fileURLToPath(new URL("./index.js", import.meta.url))], {
    env: { PATH: process.env.PATH, PORT: String(port), VOLC_ARK_API_KEY: "test-only", VOLC_SPEECH_API_KEY: "test-only", VOLC_TTS_API_KEY: "test-only", VOLC_ARK_ENDPOINT: `http://127.0.0.1:${providerPort}/ark`, JOCAM_ALLOWED_ORIGINS: "http://127.0.0.1:5173" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = ""; child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { output += chunk; });
  let socket;
  try {
    await waitFor(() => output.includes("bridge listening"));
    socket = new WebSocket(`ws://127.0.0.1:${port}/voice`, { origin: "http://127.0.0.1:5173" });
    await once(socket, "open");
    const messages = []; socket.on("message", (data) => messages.push(JSON.parse(data)));
    const send = (value) => socket.send(JSON.stringify(value));
    send({ type: "start", inputMode: "text", character: "jiaojiao" });
    await waitFor(() => messages.some((message) => message.type === "ready"));
    send(null);
    send([]);
    send({ type: "context", entries: [null, [], 1, { text: { toString: null } }], moments: [null] });
    await waitFor(() => messages.filter((message) => message.code === "INVALID_MESSAGE").length === 2);
    assert.equal(child.exitCode, null);
    send({ type: "interaction_mode", mode: "toy" });
    send({ type: "local_speech", text: { toString: {}, valueOf: {} } });
    await waitFor(() => messages.filter((message) => message.code === "INVALID_MESSAGE").length === 3);
    assert.equal(child.exitCode, null);
    send({ type: "text", text: "它叫球球" });
    await waitFor(() => messages.some((message) => message.type === "transcript"));
    const transcript = messages.find((message) => message.type === "transcript");
    assert.equal(transcript.source, "gameplay"); assert.ok(transcript.id); assert.ok(transcript.sessionId); assert.equal(calls.length, 0);
    send({ type: "local_speech", text: "它叫球球，对吗？" });
    await waitFor(() => messages.some((message) => message.type === "speech"));
    assert.equal(messages.find((message) => message.type === "speech").local, true);
    await new Promise((resolve) => setTimeout(resolve, 710));
    responseDelay = 350;
    send({ type: "interaction_mode", mode: "none" });
    send({ type: "context", moments: [{ dayKey: "2026-09-08", event: "看见了小猫" }], entries: [] });
    send({ type: "text", text: "今天我搭积木倒了" });
    await waitFor(() => calls.length === 1);
    send({ type: "clear_memory" });
    await waitFor(() => providerReturned === 1);
    assert.equal(messages.filter((message) => message.type === "speech" && !message.local).length, 0);
    await new Promise((resolve) => setTimeout(resolve, 710));
    responseDelay = 1600;
    send({ type: "text", text: "第一句要保留" });
    await waitFor(() => calls.length === 2);
    await new Promise((resolve) => setTimeout(resolve, 750)); send({ type: "text", text: "第二句也要保留" });
    await waitFor(() => messages.some((message) => message.type === "transcript" && message.text === "第二句也要保留"));
    // The first turn is still waiting on the provider. The second must begin
    // immediately instead of sitting behind it in a per-session queue.
    await waitFor(() => calls.length === 3, 300);
    await new Promise((resolve) => setTimeout(resolve, 750)); send({ type: "text", text: "第三句不能覆盖第二句" });
    responseDelay = 20;
    await waitFor(() => calls.length === 4, 1000).catch((error) => {
      error.message += JSON.stringify({ calls: calls.map((call) => call.input.at(-1).content[0].text), errors: messages.filter((message) => message.type === "error").map((message) => message.code), childExitCode: child.exitCode, serverOutput: output });
      throw error;
    });
    assert.deepEqual(calls.slice(1).map((call) => call.input.at(-1).content[0].text), ["第一句要保留", "第二句也要保留", "第三句不能覆盖第二句"]);
    assert.ok(!JSON.stringify(calls[1]).includes("看见了小猫"));
    assert.ok(!output.includes("第一句要保留"));
    await waitFor(() => providerReturned === 4);
    send({ type: "interaction_mode", mode: "toy" });
    send({ type: "text", text: "我很难过，我想妈妈", clientMessageId: "test-emotion-transfer" });
    await waitFor(() => messages.some((message) => message.clientMessageId === "test-emotion-transfer"));
    const emotionalTranscript = messages.find((message) => message.clientMessageId === "test-emotion-transfer");
    assert.equal(emotionalTranscript.source, "gameplay");
    assert.equal(emotionalTranscript.id, "dialogue-test-emotion-transfer");
    const transcriptCount = messages.filter((message) => message.type === "transcript").length;
    send({ type: "interaction_mode", mode: "none" });
    send({ type: "resume_conversation", transcriptId: emotionalTranscript.id });
    send({ type: "resume_conversation", transcriptId: emotionalTranscript.id });
    await waitFor(() => calls.length === 5);
    assert.equal(calls[4].input.at(-1).content[0].text, "我很难过，我想妈妈");
    assert.equal(messages.filter((message) => message.type === "transcript").length, transcriptCount);
    assert.ok(!messages.some((message) => message.code === "TEXT_RATE_LIMIT"));
    send({ type: "text", text: "我很难过，我想妈妈", clientMessageId: "test-emotion-transfer" });
    await waitFor(() => messages.filter((message) => message.clientMessageId === "test-emotion-transfer").length === 2);
    assert.equal(calls.length, 5);
  } finally {
    socket?.close(); child.kill("SIGTERM");
    await new Promise((resolve) => { provider.close(resolve); provider.closeAllConnections(); });
  }
});
