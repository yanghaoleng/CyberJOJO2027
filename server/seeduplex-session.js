import { randomUUID } from "node:crypto";
import WebSocket from "ws";

/**
 * 豆包实时语音模型 3.0（Seeduplex）全双工端到端语音会话。
 * 协议：wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue
 * 把 ASR + LLM + TTS 三个环节合并为一路 WebSocket S2S，
 * 上行音频（16k PCM）直接送模型，下行直接拿流式语音（ogg_opus 24k）。
 */

const DEFAULT_ENDPOINT = "wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue";
const DEFAULT_MODEL = "1.2.6.1";
const DEFAULT_VOICES = Object.freeze({
  jiaojiao: "zh_male_tiancaitongsheng_uranus_bigtts",
  lvdou: "zh_male_naiqimengwa_uranus_bigtts",
});
// 输出改 PCM（24000Hz 16bit 小端）：服务端组装 WAV 头，浏览器 <audio> 全平台可播
// （ogg_opus 在 iOS Safari 的 <audio> 上不支持，会导致实时对话无声）
const OUTPUT_AUDIO_TYPE = "pcm";
const OUTPUT_AUDIO_RATE = 24_000;

export function getSeeduplexConfig(env = process.env) {
  const apiKey = String(env.SEEDUPLEX_API_KEY || env.VOLC_SPEECH_API_KEY || "").trim();
  if (!apiKey) return null;
  return {
    enabled: true,
    endpoint: env.SEEDUPLEX_ENDPOINT || DEFAULT_ENDPOINT,
    apiKey,
    model: env.SEEDUPLEX_MODEL || DEFAULT_MODEL,
    voices: {
      jiaojiao: env.JOCAM_SEEDUPLEX_JIAOJIAO_VOICE || env.JOCAM_TTS_JIAOJIAO_VOICE || DEFAULT_VOICES.jiaojiao,
      lvdou: env.JOCAM_SEEDUPLEX_LVDOU_VOICE || env.JOCAM_TTS_LVDOU_VOICE || DEFAULT_VOICES.lvdou,
    },
  };
}

export function buildSessionCreate(config, { instructions, voice, context = [], tools = [] }) {
  const history = Array.isArray(context) ? context.slice(0, 40).map((entry) => ({
    role: entry.role === "assistant" ? "assistant" : "user",
    text: String(entry.text || "").slice(0, 1000),
  })).filter((entry) => entry.text) : [];
  return {
    type: "session.create",
    session: {
      model: config.model,
      instructions: String(instructions || "").slice(0, 12_000),
      audio: {
        input: { format: { type: "pcm", rate: 16_000 } },
        output: {
          format: { type: OUTPUT_AUDIO_TYPE, rate: OUTPUT_AUDIO_RATE },
          voice,
        },
      },
      ...(history.length ? { dialog_context: history } : {}),
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
  const transcript = (event.utterance || event.text || "").replace(/\s+/g, " ").trim();
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
      return { type, callId: event.call_id || "", name: event.name || "", arguments: event.arguments || "" };
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
      ...(instructions !== undefined ? { instructions: String(instructions || "").slice(0, 12_000) } : {}),
      ...(voice ? { audio: { output: { format: { type: OUTPUT_AUDIO_TYPE, rate: OUTPUT_AUDIO_RATE }, voice } } } : {}),
    },
  };
}

export function buildSessionClose() {
  return { type: "session.close" };
}

export function buildToolResult({ callId, ok = true }) {
  return {
    type: "conversation.item.create",
    items: [{
      call_id: callId,
      role: "tool",
      content: [{ type: "input_text", text: JSON.stringify({ ok }) }],
    }],
  };
}

export class SeeduplexSession {
  constructor({ config, instructions, voice, context = [], onTranscript, onText, onAudioDelta, onAudioDone, onFunctionCall, onDone, onError, onReady }) {
    this.config = config;
    this.instructions = instructions;
    this.voice = voice;
    this.context = context;
    this.onTranscript = onTranscript;
    this.onText = onText;
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
        if (!this.ready) reject(error);
        this.onError?.(error);
      };

      socket.once("open", () => {
        const tools = [buildFunctionCallTool()];
        socket.send(JSON.stringify(buildSessionCreate(this.config, {
          instructions: this.instructions,
          voice: this.voice,
          context: this.context,
          tools,
        })));
        this.ready = true;
        this.onReady?.();
        resolve();
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
        this.ready = false;
        if (!this.closed && code !== 1000) fail(new Error(`Seeduplex connection closed (${code})`));
      });
    });
  }

  _dispatch(event) {
    switch (event.type) {
      case "session.created":
        this.sessionId = event.sessionId;
        break;
      case "conversation.item.input_audio_transcription.started":
        this.textBuffer = "";
        break;
      case "conversation.item.input_audio_transcription.delta":
        this.textBuffer += event.text;
        this.onTranscript?.({ text: event.text, final: false });
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.onTranscript?.({ text: event.text, final: true });
        break;
      case "response.output_text.delta":
        this.replyText += event.text;
        this.onText?.({ text: event.text, final: false });
        break;
      case "response.output_text.done":
        this.onText?.({ text: event.text, final: true });
        break;
      case "response.output_audio.started":
        this.audioChunks = [];
        this.audioStartedAt = Date.now();
        break;
      case "response.output_audio.delta":
        if (event.audio) this.audioChunks.push(event.audio);
        this.onAudioDelta?.({ audio: event.audio, pending: this.audioChunks.length });
        break;
      case "response.output_audio.done":
        this.onAudioDone?.({
          audio: assembleWavBase64(this.audioChunks),
          text: this.replyText,
          startedAt: this.audioStartedAt,
          statusCode: event.statusCode,
        });
        this.replyText = "";
        this.audioChunks = [];
        break;
      case "response.function_call_arguments.done":
        this.onFunctionCall?.({ callId: event.callId, name: event.name, arguments: event.arguments });
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

  sendAudio(pcm) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN || !pcm?.byteLength) return;
    this.socket.send(JSON.stringify(buildAudioAppend(pcm)));
  }

  commit() {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildAudioCommit()));
  }

  setMuted(muted) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildMute(muted)));
  }

  greet(text) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildGreet(text)));
  }

  interrupt() {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildCancel()));
  }

  update({ instructions, voice }) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildSessionUpdate({ instructions, voice })));
  }

  sendToolResult(callId) {
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(buildToolResult({ callId })));
  }

  close() {
    if (this.closed) return;
    this.closed = true;
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
