import { DOMI_WORD_VOICE_SOURCE, configureCharacterPlayback } from "../server/character-voice-policy.js";
const SILENT_AUDIO = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

export async function requestDomiSpeech(text, { signal, fetchImpl = fetch } = {}) {
  const content = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!content) throw new Error("Empty DOMI speech");
  const base = import.meta.env?.VITE_SPEECH_API_URL || (typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://127.0.0.1:8787/speech" : "/api/speech");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 18000);
  try {
    const response = await fetchImpl(base, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: content, character: "lvdou" }), signal: controller.signal });
    if (!response.ok) throw new Error("DOMI speech unavailable");
    const message = await response.json();
    if (!message.ok || message.character !== "lvdou" || message.voiceSource !== DOMI_WORD_VOICE_SOURCE || !message.audio || message.audio.length > 2700000) throw new Error("Invalid DOMI voice response");
    return message;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

// For card and note playback. Failures stay visible instead of switching voice.
export function createDomiSpeechPlayback({ onProgress, onEnded, onError } = {}) {
  let audio = null, controller = null, url = "", timer = null, generation = 0;
  const stop = () => {
    generation++;
    controller?.abort(); controller = null;
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio = null; }
    clearInterval(timer); timer = null;
    if (url) URL.revokeObjectURL(url); url = "";
  };
  return { stop, async play(text, savedAudio) {
    stop(); const current = generation; const requestController = new AbortController(); controller = requestController;
    const deadline = setTimeout(() => requestController.abort(), 18000);
    try {
      // Unlock this element during the tap, before waiting for TTS. Safari
      // otherwise treats the subsequent play as unrelated to the user's tap.
      const playbackAudio = new Audio(SILENT_AUDIO); audio = playbackAudio;
      playbackAudio.dataset.character = "lvdou";
      playbackAudio.dataset.voiceKind = "synthesized";
      playbackAudio.dataset.speechText = String(text || "");
      configureCharacterPlayback(playbackAudio, "lvdou");
      playbackAudio.muted = true;
      playbackAudio.play()?.catch(() => {});
      const blob = savedAudio instanceof Blob ? savedAudio : null;
      let source = blob;
      if (!source) {
        const message = await requestDomiSpeech(text, { signal: controller.signal });
        const bytes = Uint8Array.from(atob(message.audio), char => char.charCodeAt(0));
        source = new Blob([bytes], { type: message.mime || "audio/mpeg" });
      }
      if (current !== generation) return;
      url = URL.createObjectURL(source); audio.src = url; audio.muted = false;
      configureCharacterPlayback(audio, "lvdou");
      audio.addEventListener("ended", () => { if (current === generation) { stop(); onEnded?.(); } }, { once: true });
      audio.addEventListener("error", () => { if (current === generation) { stop(); onError?.(); } }, { once: true });
      await audio.play();
      if (current === generation) timer = setInterval(() => onProgress?.(audio?.currentTime || 0, audio?.duration || 0), 200);
    } catch { if (current === generation) { stop(); onError?.(); } }
    finally { clearTimeout(deadline); }
  } };
}
