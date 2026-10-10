import { synthesizeSpeech } from "./volc-tts.js";
import { DOMI_WORD_VOICE_SOURCE } from "./character-voice-policy.js";

export function createSpeechRequestHandler({ allowedOrigins, ttsConfig, synthesize = synthesizeSpeech, now = Date.now } = {}) {
  const active = new Set(), recent = new Map();
  return async (request, response) => {
    if (new URL(request.url || "/", "http://localhost").pathname !== "/speech") return false;
    const origin = String(request.headers.origin || "");
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" };
    const send = (status, body) => { response.writeHead(status, headers); response.end(JSON.stringify(body)); };
    if (!allowedOrigins?.has(origin)) { send(403, { ok: false, code: "ORIGIN_NOT_ALLOWED" }); return true; }
    Object.assign(headers, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    if (request.method === "OPTIONS") { response.writeHead(204, headers); response.end(); return true; }
    if (request.method !== "POST" || !/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) { send(415, { ok: false }); return true; }
    const ip = String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
    const time = now();
    for (const [key, at] of recent) if (time - at > 60000) recent.delete(key);
    if (active.has(ip) || (recent.has(ip) && time - recent.get(ip) < 700)) { send(429, { ok: false, code: "SPEECH_RATE_LIMIT" }); return true; }
    active.add(ip);
    try {
      let size = 0; const chunks = [];
      for await (const chunk of request) { size += chunk.byteLength; if (size > 8192) throw Object.assign(new Error("Body too large"), { status: 413 }); chunks.push(chunk); }
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
      if (!body || body.character !== "lvdou" || typeof body.text !== "string" || !body.text.trim() || body.text.length > 1000) throw Object.assign(new Error("Invalid speech"), { status: 400 });
      recent.set(ip, time);
      const text = body.text.replace(/\s+/g, " ").trim();
      const audio = await synthesize(text, "lvdou", ttsConfig);
      send(200, { ok: true, character: "lvdou", text, voiceSource: DOMI_WORD_VOICE_SOURCE, mime: "audio/mpeg", audio: audio.toString("base64") });
    } catch (error) { send(error.status || 502, { ok: false, code: "SPEECH_UNAVAILABLE" }); }
    finally { active.delete(ip); }
    return true;
  };
}
