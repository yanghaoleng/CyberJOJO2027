import assert from "node:assert/strict";
import test from "node:test";
import { PcmSpeechPlayer } from "./pcm-speech-player.js";

function harness() {
  const scheduled = [];
  const events = [];
  const context = {
    currentTime: 10, destination: {}, resume: async () => {},
    createBuffer: (_, size, rate) => ({ samples: new Float32Array(size), getChannelData() { return this.samples; }, sampleRate: rate }),
    createBufferSource: () => ({ connect() {}, disconnect() {}, start(at) { this.at = at; scheduled.push(this); }, stop() { this.stopped = true; } }),
  };
  return { scheduled, events, player: new PcmSpeechPlayer(context, { onStart: () => events.push("start"), onEnd: () => events.push("end") }) };
}
const pcm = (...samples) => {
  const bytes = Buffer.alloc(samples.length * 4);
  samples.forEach((sample, index) => bytes.writeFloatLE(sample, index * 4));
  return bytes;
};

test("speech starts on the first chunk and schedules subsequent chunks contiguously", () => {
  const { player, scheduled, events } = harness();
  player.start("a");
  player.append("a", pcm(0.5, -0.5).toString("base64"));
  assert.deepEqual(events, ["start"]);
  assert.deepEqual([...scheduled[0].buffer.samples], [0.5, -0.5]);
  player.append("a", pcm(0.25).toString("base64"));
  assert.equal(scheduled[1].at, scheduled[0].at + 2 / 24000);
  player.end("a");
  assert.equal(player.playing, true);
  scheduled[0].onended(); scheduled[1].onended();
  assert.deepEqual(events, ["start", "end"]);
});

test("split samples are reassembled and cancellation stops queued audio and rejects stale chunks", () => {
  const { player, scheduled } = harness();
  player.start("a");
  const bytes = pcm(0.75);
  player.append("a", bytes.subarray(0, 3).toString("base64"));
  assert.equal(scheduled.length, 0);
  player.append("a", bytes.subarray(3).toString("base64"));
  assert.equal(scheduled[0].buffer.samples[0], 0.75);
  player.start("b");
  assert.equal(scheduled[0].stopped, true);
  player.append("a", bytes.toString("base64"));
  player.end("a");
  assert.equal(player.streamId, "b");
  assert.equal(scheduled.length, 1);
  player.append("b", pcm(NaN, 5, -5).toString("base64"));
  assert.deepEqual([...scheduled[1].buffer.samples], [0, 1, -1]);
});

function createAudioContext() {
  return {
    currentTime: 0,
    destination: {},
    resume: async () => {},
    createBuffer: (_channels, frames, sampleRate) => ({
      duration: frames / sampleRate,
      getChannelData: () => new Float32Array(frames),
    }),
    createBufferSource: () => {
      const source = {
        onended: null,
        connect() {},
        disconnect() {},
        start() {},
        stop() { source.onended?.(); },
      };
      return source;
    },
  };
}

test("a stream that never delivers its first chunk is released", async () => {
  const stalled = [];
  const player = new PcmSpeechPlayer(createAudioContext(), {
    startTimeoutMs: 10,
    chunkTimeoutMs: 10,
    onStall: (event) => stalled.push(event),
  });
  player.start("stream-1");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(stalled, [{ streamId: "stream-1", phase: "first_chunk" }]);
  assert.equal(player.streamId, "");
});

test("a stream with a gap after audio is released instead of blocking the queue", async () => {
  const stalled = [];
  const player = new PcmSpeechPlayer(createAudioContext(), {
    startTimeoutMs: 50,
    chunkTimeoutMs: 10,
    onStall: (event) => stalled.push(event),
  });
  player.start("stream-2");
  player.append("stream-2", "AAAAAA==");
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(stalled, [{ streamId: "stream-2", phase: "chunk" }]);
  assert.equal(player.streamId, "");
});
