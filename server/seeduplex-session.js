import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { buildHotwordContext, getBrandTerms } from "./brand-lexicon.js";

/**
 * 豆包实时语音模型 3.0（Seeduplex）全双工端到端语音会话。
 * 协议：wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue
 * 把 ASR + LLM + TTS 三个环节合并为一路 WebSocket S2S，
 * 上行音频（16k PCM）直接送模型，下行直接拿流式语音（float32 PCM 24k）。
 */

const DEFAULT_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue";
const DEFAULT_MODEL = "1.2.6.1";
const DEFAULT_VOICES = Object.freeze({
  jiaojiao: "zh_male_tiancaitongsheng_uranus_bigtts",
  lvdou: "zh_male_naiqimengwa_uranus_bigtts",
});
// PCM avoids the iOS <audio> ogg_opus limitation. Web Audio plays float32 chunks;
// non-streaming consumers retain the int16 WAV conversion below.
const OUTPUT_AUDIO_TYPE = "pcm";
const OUTPUT_AUDIO_RATE = 24_000;
const withBrandHints = (instructions) => `专有名词：本应用的角色名字写作“叫叫”和“绿豆”。称呼叫叫时不要写成“娇娇”或“佳佳”。遵循下文当前角色的身份。\n${String(instructions || "")}`.slice(0, 12_000);

export function getSeeduplexConfig(env = process.env) {
  const apiKey = String(env.SEEDUPLEX_API_KEY || env.VOLC_SPEECH_API_KEY || "").trim();
  if (!apiKey) return null;
  return {
    enabled: true,
    endpoint: env.SEEDUPLEX_ENDPOINT || DEFAULT_ENDPOINT,
    apiKey,
    model: env.SEEDUPLEX_MODEL || DEFAULT_MODEL,
    hotwords: getBrandTerms(env),
    voices: {
      jiaojiao: env.JOCAM_SEEDUPLEX_JIAOJIAO_VOICE || env.JOCAM_TTS_JIAOJIAO_VOICE || DEFAULT_VOICES.jiaojiao,
      lvdou: env.JOCAM_SEEDUPLEX_LVDOU_VOICE || env.JOCAM_TTS_LVDOU_VOICE || DEFAULT_VOICES.lvdou,
    },
  };
}

export function buildSessionCreate(config, { instructions, voice, context = [], tools = [] }) {
  const history = Array.isArray(context) ? context.slice(0, 40).filter((entry) => String(entry?.text || "").trim()).map((entry) => ({
    role: entry.role === "assistant" ? "assistant" : "user",
    text: `${entry.role === "assistant" ? `[${entry.character === "lvdou" ? "Domi" : "叫叫"}] ` : ""}${String(entry.text || "").slice(0, 1000)}`,
  })).filter((entry) => entry.text) : [];
  return {
    type: "session.create",
    session: {
      model: config.model,
      instructions: withBrandHints(instructions),
      audio: {
        input: { format: { type: "pcm", rate: 16_000 } },
        output: {
          format: { type: OUTPUT_AUDIO_TYPE, rate: OUTPUT_AUDIO_RATE },
          voice,
        },
      },
      ...(history.length ? { dialog_context: history } : {}),
      // Seeduplex's documented ASR extension, not a prompt-only spelling hint.
      extension: { asr: { extra: { context: JSON.stringify({
        ...JSON.parse(buildHotwordContext(config.hotwords) || "{}"),
        correct_words: { "娇娇": "叫叫", "佳佳": "叫叫", "驴豆": "绿豆" },
      }) } } },
      ...(tools.length ? { tools } : {}),
    },
  };
}

export function buildFunctionCallTool() {
  return {
    type: "function",
    name: "respond_as_character",
    description: "选择当前角色要做的表情动作（不改变语音回复内容）",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          enum: ["praise", "surprised", "think", "happy", "frighten", "curious", "heart", "none"],
          description: "角色伴随语音播放的表情动作；没有合适动作就用 none",
        },
        story: {
          type: "object",
          additionalProperties: false,
          properties: {
            thread: {
              type: "string",
              enum: ["none", "feelings", "explore", "inspect", "follow_up"],
            },
          },
          required: ["thread"],
        },
      },
      required: ["action", "story"],
    },
  };
}

function extractBase64Audio(event) {
  // Seeduplex 全双工下行音频字段为 delta（Base64 PCM/Opus）；部分事件兼容 audio 字段
  return typeof event.delta === "string" && event.delta
    ? event.delta
    : typeof event.audio === "string" && event.audio
      ? event.audio
      : "";
}

// 标准 RIFF/WAVE 头（PCM 16bit 小端单声道）
export function buildWavHeader(pcmByteLength, sampleRate = OUTPUT_AUDIO_RATE, channels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcmByteLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcmByteLength, 40);
  return header;
}

// 把 Base64 PCM 片段拼成完整 WAV 音频的 Base64
// Seeduplex 的 pcm 下行实际为 32bit float（小端、24000Hz 单声道），
// 浏览器 <audio> 对 WAV float32 支持不一（Safari 不播），且按 16bit 播放会爆音。
// 因此统一转换为 16bit 有符号 PCM 再组 WAV 头。
export function assembleWavBase64(chunks, sampleRate = OUTPUT_AUDIO_RATE) {
  const raw = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk, "base64")));
  if (raw.length % 4 !== 0) {
    // 若上游恰好输出 16bit 小端（如未来格式变化），则原样透传
    return Buffer.concat([buildWavHeader(raw.length, sampleRate), raw]).toString("base64");
  }
  const count = raw.length / 4;
  const pcm16 = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) {
    const f = raw.readFloatLE(i * 4);
    const v = Math.max(-1, Math.min(1, f));
    pcm16.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return Buffer.concat([buildWavHeader(pcm16.length, sampleRate), pcm16]).toString("base64");
}

export function parseDownstreamEvent(payload) {
  let event = payload;
  if (typeof payload === "string") {
    try {
      event = JSON.parse(payload);
    } catch {
      return { type: "unknown" };
    }
  }
  if (!event || typeof event !== "object") return { type: "unknown" };
  const type = String(event.type || "");
  const transcript = String(event.utterance || event.text || (type.includes("audio.delta") ? "" : event.delta) || "");
  switch (type) {
    case "session.created":
      return { type, sessionId: event.session?.id || "" };
    case "session.updated":
    case "session.closed":
      return { type };
    case "conversation.item.input_audio_transcription.started":
      return { type, itemId: event.item_id || "" };
    case "conversation.item.input_audio_transcription.delta":
      return { type, text: transcript };
    case "conversation.item.input_audio_transcription.completed":
      return { type, itemId: event.item_id || "", text: transcript };
    case "response.output_text.delta":
      return { type, text: transcript };
    case "response.output_text.done":
      return { type, text: transcript };
    case "response.output_audio.started":
      return { type, ttsType: event.tts_type || "default" };
    case "response.output_audio.delta":
      return { type, audio: extractBase64Audio(event) };
    case "response.output_audio.done":
      return { type, statusCode: String(event.status_code || "") };
    case "response.function_call_arguments.done":
      return { type, calls: (Array.isArray(event.items) ? event.items : [event]).map(item => ({
        callId: typeof item?.call_id === "string" ? item.call_id : "",
        name: typeof item?.name === "string" ? item.name : "",
        arguments: typeof item?.arguments === "string" ? item.arguments : JSON.stringify(item?.arguments || {}),
      })).filter(item => item.callId) };
    case "response.done":
      return { type };
    case "response.canceled":
      return { type };
    case "error":
      return { type, code: event.code, message: event.message || "" };
    default:
      return { type };
  }
}

export function buildAudioAppend(pcm, { eventId } = {}) {
  return {
    type: "input_audio_buffer.append",
    ...(eventId ? { event_id: eventId } : {}),
    audio: Buffer.from(pcm).toString("base64"),
  };
}

export function buildAudioCommit() {
  return { type: "input_audio_buffer.commit" };
}

export function buildMute(muted) {
  return { type: muted ? "input_audio_mute.commit" : "input_audio_unmute.commit" };
}

export function buildGreet(text) {
  return { type: "speech_text_buffer.commit", text: String(text || "").slice(0, 200) };
}

export function buildCancel() {
  return { type: "response.cancel" };
}

export function buildSessionUpdate({ instructions, voice }) {
  return {
    type: "session.update",
    session: {
      ...(instructions !== undefined ? { instructions: withBrandHints(instructions) } : {}),
      ...(voice ? { audio: { output: { format: { type: OUTPUT_AUDIO_TYPE, rate: OUTPUT_AUDIO_RATE }, voice } } } : {}),
    },
  };
}

export function buildSessionClose() {
  return { type: "session.close" };
}

export function buildToolResult({ callId, ok = true, calls }) {
  return {
    type: "conversation.item.create",
    items: (calls || [{ callId, ok }]).filter(call => call.callId).map(call => ({
      call_id: call.callId,
      role: "tool",
      content: [{ type: "input_text", text: JSON.stringify({ ok: call.ok !== false }) }],
    })),
  };
}

export class SeeduplexSession {
  constructor({ config, instructions, voice, context = [], onTranscript, onText, onAudioStart, onAudioDelta, onAudioDone, onCancel, onCancelAcknowledged, onFunctionCall, onDone, onError, onReady }) {
    this.config = config;
    this.instructions = instructions;
    this.voice = voice;
    this.context = context;
    this.onTranscript = onTranscript;
    this.onText = onText;
    this.onAudioStart = onAudioStart;
    this.onCancel = onCancel;
    this.onCancelAcknowledged = onCancelAcknowledged;
    this.onAudioDelta = onAudioDelta;
    this.onAudioDone = onAudioDone;
    this.onFunctionCall = onFunctionCall;
    this.onDone = onDone;
    this.onError = onError;
    this.onReady = onReady;
    this.requestId = randomUUID();
    this.socket = null;
    this.ready = false;
    this.closed = false;
    this.sessionId = "";
    this.audioChunks = [];
    this.audioStartedAt = 0;
    this.textBuffer = "";
    this.replyText = "";
    this.acceptAudio = true;
    this.outputActive = false;
    this.awaitingCancelAck = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.config.endpoint, {
        headers: { "X-Api-Key": this.config.apiKey },
        handshakeTimeout: 8_000,
        perMessageDeflate: false,
      });
      this.socket = socket;
      const fail = (error) => {
        clearTimeout(this.readyTimer);
        this.resolveReady = null;
        if (!this.ready) reject(error);
        this.onError?.(error);
      };
      this.readyTimer = setTimeout(() => {
        fail(new Error("Seeduplex session readiness timeout"));
        socket.close();
      }, 10_000);
      this.resolveReady = () => {
        clearTimeout(this.readyTimer);
        this.ready = true;
        this.onReady?.();
        resolve();
      };

      socket.once("open", () => {
        const tools = [buildFunctionCallTool()];
        socket.send(JSON.stringify(buildSessionCreate(this.config, {
          instructions: this.instructions,
          voice: this.voice,
          context: this.context,
          tools,
        })));
      });

      socket.on("message", (data) => {
        try {
          const event = parseDownstreamEvent(String(data));
          this._dispatch(event);
        } catch (error) {
          fail(error);
        }
      });
      socket.once("error", fail);
      socket.once("close", (code) => {
        clearTimeout(this.readyTimer);
        if (!this.ready) reject(new Error(`Seeduplex closed before ready (${code})`));
        this.ready = false;
        if (!this.closed) fail(new Error(`Seeduplex connection closed (${code})`));
      });
    });
  }

  _dispatch(event) {
    switch (event.type) {
      case "session.created":
        this.sessionId = event.sessionId;
        if (!this.ready && !this.closed) this.resolveReady?.();
        break;
      case "session.closed":
        this.failStalled("upstream session closed");
        break;
      case "conversation.item.input_audio_transcription.started":
        clearTimeout(this.responseTimer);
        this.textBuffer = "";
        break;
      case "conversation.item.input_audio_transcription.delta":
        this.textBuffer += event.text;
        this.onTranscript?.({ text: this.textBuffer, final: false });
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.armResponseTimeout();
        this.onTranscript?.({ text: event.text || this.textBuffer, final: true });
        this.textBuffer = "";
        break;
      case "response.output_text.delta":
        this.replyText += event.text;
        if (this.acceptAudio) this.onText?.({ text: this.replyText, final: false });
        break;
      case "response.output_text.done":
        this.replyText = event.text || this.replyText;
        if (this.acceptAudio) this.onText?.({ text: this.replyText, final: true });
        break;
      case "response.output_audio.started":
        if (this.awaitingCancelAck) break;
        this.acceptAudio = true;
        // TTSSentenceStart can repeat inside one reply. Preserve scheduled audio
        // and accumulated PCM until the turn-level output_audio.done event.
        if (!this.outputActive) {
          this.outputActive = true;
          this.audioChunks = [];
          this.audioStartedAt = Date.now();
          this.onAudioStart?.();
          if (this.replyText) this.onText?.({ text: this.replyText, final: false });
        }
        break;
      case "response.output_audio.delta":
        if (!this.acceptAudio || !event.audio) break;
        this.armResponseTimeout();
        // Streaming consumers do not need a second, full-turn audio copy.
        if (!this.onAudioDelta) this.audioChunks.push(event.audio);
        this.onAudioDelta?.({ audio: event.audio, pending: this.audioChunks.length });
        break;
      case "response.output_audio.done":
        if (!this.acceptAudio) break;
        clearTimeout(this.responseTimer);
        this.onAudioDone?.({
          audio: this.onAudioDelta ? "" : assembleWavBase64(this.audioChunks),
          text: this.replyText,
          startedAt: this.audioStartedAt,
          statusCode: event.statusCode,
        });
        this.replyText = "";
        this.audioChunks = [];
        this.outputActive = false;
        break;
      case "response.canceled":
        clearTimeout(this.cancelTimer);
        this.awaitingCancelAck = false;
        this.cancelOutput();
        this.onCancelAcknowledged?.();
        break;
      case "response.function_call_arguments.done":
        if (!event.calls?.length) { this.failStalled("missing function call identifiers"); break; }
        this.sendToolResults(event.calls.map(call => {
          try { return { callId: call.callId, ok: this.onFunctionCall?.(call) !== false }; }
          catch { return { callId: call.callId, ok: false }; }
        }));
        break;
      case "response.done":
        this.onDone?.();
        break;
      case "error":
        this.onError?.(new Error(`Seeduplex ${event.code}: ${event.message}`));
        break;
      default:
        break;
    }
  }

  armResponseTimeout() {
    clearTimeout(this.responseTimer);
    if (this.closed || this.muted) return;
    this.responseTimer = setTimeout(() => this.failStalled("response timeout"), this.config?.responseTimeoutMs || 15_000);
    this.responseTimer.unref?.();
  }

  failStalled(reason) {
    if (this.closed) return;
    this.close();
    this.cancelOutput();
    this.onError?.(new Error(`Seeduplex ${reason}`));
  }

  sendAudio(pcm) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN || !pcm?.byteLength) return;
    this.socket.send(JSON.stringify(buildAudioAppend(pcm)));
  }

  commit() {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildAudioCommit()));
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) clearTimeout(this.responseTimer);
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildMute(muted)));
  }

  greet(text) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.armResponseTimeout();
    this.socket.send(JSON.stringify(buildGreet(text)));
  }

  interrupt() {
    clearTimeout(this.responseTimer);
    this.cancelOutput();
    if (this.awaitingCancelAck || !this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.awaitingCancelAck = true;
    this.cancelTimer = setTimeout(() => this.failStalled("cancel acknowledgement timeout"), this.config?.cancelTimeoutMs || 2000);
    this.cancelTimer.unref?.();
    this.socket.send(JSON.stringify(buildCancel()));
  }

  cancelOutput() {
    this.acceptAudio = false;
    this.outputActive = false;
    this.audioChunks = [];
    this.replyText = "";
    this.onCancel?.();
  }

  update({ instructions, voice }) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildSessionUpdate({ instructions, voice })));
  }

  sendToolResult(callId) {
    this.sendToolResults([{ callId }]);
  }

  sendToolResults(calls) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    const result = buildToolResult({ calls });
    if (result.items.length) this.socket.send(JSON.stringify(result));
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.readyTimer);
    clearTimeout(this.cancelTimer);
    clearTimeout(this.responseTimer);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(buildSessionClose()));
      const socket = this.socket;
      setTimeout(() => socket.close(1000), 180).unref();
    } else {
      this.socket?.close();
    }
  }
}

export const seeduplexInternals = {
  DEFAULT_ENDPOINT,
  DEFAULT_MODEL,
  buildSessionCreate,
  buildFunctionCallTool,
  buildAudioAppend,
  buildAudioCommit,
  buildMute,
  buildGreet,
  buildCancel,
  buildSessionClose,
  buildSessionUpdate,
  buildToolResult,
  parseDownstreamEvent,
  assembleWavBase64,
  buildWavHeader,
};
