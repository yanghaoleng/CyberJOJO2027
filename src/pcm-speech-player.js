// Seeduplex output is mono float32 little-endian PCM at 24 kHz.
// Schedule chunks on one audio clock instead of waiting for a complete WAV.
export class PcmSpeechPlayer {
  constructor(context, { onStart = () => {}, onEnd = () => {} } = {}) {
    this.context = context;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.sources = new Set();
    this.streamId = "";
    this.playing = false;
    this.tail = new Uint8Array();
  }

  start(streamId, sampleRate = 24000) {
    this.stop();
    this.streamId = streamId;
    this.sampleRate = sampleRate;
    this.nextTime = 0;
    this.finished = false;
    void this.context.resume().catch(() => {});
  }

  append(streamId, base64) {
    if (!streamId || streamId !== this.streamId || this.finished) return;
    const decoded = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bytes = new Uint8Array(this.tail.length + decoded.length);
    bytes.set(this.tail); bytes.set(decoded, this.tail.length);
    const frames = Math.floor(bytes.length / 4);
    this.tail = bytes.slice(frames * 4);
    if (!frames) return;
    const buffer = this.context.createBuffer(1, frames, this.sampleRate);
    const samples = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < frames; i++) {
      const value = view.getFloat32(i * 4, true);
      samples[i] = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
      if (this.finished && !this.sources.size) this.stop();
    };
    const at = Math.max(this.context.currentTime + 0.035, this.nextTime);
    source.start(at);
    this.nextTime = at + frames / this.sampleRate;
    if (!this.playing) { this.playing = true; this.onStart(); }
  }

  end(streamId) {
    if (streamId !== this.streamId) return;
    this.finished = true;
    if (!this.sources.size) this.stop();
  }

  stop() {
    for (const source of this.sources) {
      source.onended = null;
      source.stop(); source.disconnect();
    }
    this.sources.clear();
    this.tail = new Uint8Array();
    this.streamId = "";
    const wasPlaying = this.playing;
    this.playing = false;
    if (wasPlaying) this.onEnd();
  }
}
