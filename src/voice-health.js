// Silence is healthy. Only missing transport/capture progress or a stalled
// utterance is treated as a fault; no audio or conversation text is retained.
export class VoiceHealth {
  constructor(now = 0) {
    this.lastPacket = now;
    this.lastPong = now;
    this.lastPing = 0;
    this.pendingPing = null;
    this.voicedMs = 0;
    this.voiceStarted = null;
    this.lastTranscript = now;
  }
  packet(now, rms, gated, durationMs) {
    this.lastPacket = now;
    if (gated || rms < 0.018) return;
    if (this.voiceStarted === null) this.voiceStarted = now;
    this.voicedMs += Math.min(durationMs, 100);
  }
  transcript(now) {
    this.lastTranscript = now;
    this.voiceStarted = null;
    this.voicedMs = 0;
  }
  pong(now, id) {
    if (id !== this.pendingPing?.id) return;
    this.lastPong = now;
    this.pendingPing = null;
  }
  check(now, { visible, online, ready, capture, trackLive = true, trackMuted = false, contextState = "running" }) {
    if (!visible) {
      this.lastPacket = now;
      this.pendingPing = null;
      this.lastPing = now;
      this.transcript(now);
      return null;
    }
    if (!online) return "network_offline";
    if (capture && (!trackLive || trackMuted)) return "microphone_interrupted";
    if (capture && (contextState !== "running" || now - this.lastPacket > 6000)) return "microphone_paused";
    if (this.pendingPing && now - this.pendingPing.at > 8000) return "connection_timeout";
    if (ready && this.voicedMs >= 1400 && this.voiceStarted !== null && now - Math.max(this.voiceStarted, this.lastTranscript) > 18000) return "recognition_timeout";
    return null;
  }
  ping(now) {
    if (this.pendingPing || now - this.lastPing < 10000) return null;
    const id = String(now);
    this.lastPing = now;
    this.pendingPing = { id, at: now };
    return id;
  }
}

export const VOICE_ISSUES = {
  network_offline: "网络断开了，连上后我会继续听",
  connection_timeout: "语音连接慢了，我正在重新连接",
  connection_closed: "语音连接断开了，我正在重新连接",
  recognition_timeout: "收音还在，识别暂时没回应，我正在恢复",
  microphone_paused: "浏览器暂停了收音，点一下恢复",
  microphone_interrupted: "麦克风中断了，点一下恢复",
  recognition_stalled: "这句话还没识别完，我正在恢复",
  response_timeout: "回应等得有点久，我正在恢复",
  speech_failed: "声音没播出来，可以再说一次",
  playback_blocked: "浏览器暂停了声音，点一下恢复",
  model_failed: "回应暂时没成功，可以再说一次",
};

export function appendVoiceLog(log, event, details = {}, at = new Date().toISOString()) {
  // Explicit allowlist prevents transcript text, provider payloads or credentials
  // from accidentally entering a downloadable diagnostic report.
  const safe = {};
  for (const key of ["stage", "code", "attempt", "delayMs", "closeCode", "contextState", "trackState", "bufferedBytes", "transport"]) {
    if (["string", "number", "boolean"].includes(typeof details[key])) safe[key] = typeof details[key] === "string" ? details[key].slice(0, 80) : details[key];
  }
  return [...log, { at, event: String(event).slice(0, 60), ...safe }].slice(-120);
}
