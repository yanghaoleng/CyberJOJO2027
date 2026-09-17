import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { getArkConfig, inferCharacterResponse, sanitizeConversationContext } from "./ark-command.js";
import { correctBrandTranscript } from "./brand-lexicon.js";
import { detectCharacterSwitchCommand } from "./character-switch-command.js";
import { getVolcAsrConfig, VolcAsrSession } from "./volc-asr.js";
import { getVolcTtsConfig, synthesizeSpeech } from "./volc-tts.js";
import { createVisionRequestHandler } from "./vision-route.js";
import { createSummaryRequestHandler } from "./summary-route.js";
import { createGameplayRequestHandler } from "./gameplay-route.js";
import { createMattingRequestHandler } from "./matting-route.js";

const PORT = Number(process.env.PORT || 8787);
const MAX_SESSION_MS = Number(process.env.JOCAM_MAX_SESSION_MS || 0);
const MAX_CONNECTIONS_PER_IP = Number(process.env.JOCAM_MAX_CONNECTIONS_PER_IP || 2);
const allowedOrigins = new Set((process.env.JOCAM_ALLOWED_ORIGINS || [
  "https://mikeywa.site",
  "https://www.mikeywa.site",
  "https://rive.mikeywa.site",
  "https://cyberjojo.mikeywa.site",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].join(",")).split(",").map((value) => value.trim()).filter(Boolean));

let asrConfig;
let arkConfig;
let ttsConfig;
try {
  asrConfig = getVolcAsrConfig();
  arkConfig = getArkConfig();
  ttsConfig = getVolcTtsConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const activeByIp = new Map();
const correctionMetrics = { applied: 0, lastAppliedAt: null };
const handleVisionRequest = createVisionRequestHandler({
  allowedOrigins,
  arkConfig,
  enrichResponse: async (assessment, body) => {
    try {
      const character = normalizeCharacter(body.character);
      const audio = await synthesizeSpeech(assessment.text, character, ttsConfig);
      return {
        character,
        mime: "audio/mpeg",
        audio: audio.toString("base64"),
      };
    } catch (error) {
      console.error("Camera reaction speech failed", { name: error.name, message: error.message });
      return {};
    }
  },
});
const handleSummaryRequest = createSummaryRequestHandler({ allowedOrigins, arkConfig });
const handleGameplayRequest = createGameplayRequestHandler({ allowedOrigins, arkConfig });
const handleMattingRequest = createMattingRequestHandler({ allowedOrigins });
const server = http.createServer(async (request, response) => {
  if (await handleMattingRequest(request, response)) return;
  if (await handleGameplayRequest(request, response)) return;
  if (await handleVisionRequest(request, response)) return;
  if (await handleSummaryRequest(request, response)) return;
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({
      ok: true,
      service: "jocam-voice",
      brandLexicon: {
        hotwordCount: asrConfig.hotwords.length,
        correctionsApplied: correctionMetrics.applied,
        lastCorrectionAt: correctionMetrics.lastAppliedAt,
      },
      tts: {
        enabled: true,
        resourceId: ttsConfig.resourceId,
        voices: ttsConfig.voices,
        voiceProfiles: ttsConfig.voiceProfiles,
      },
      vision: {
        enabled: true,
        model: arkConfig.visionModel,
        fallbackModel: arkConfig.visionFallbackModel,
      },
      conversationSummary: {
        enabled: true,
        model: arkConfig.summaryModel,
        fallbackModel: arkConfig.summaryFallbackModel,
      },
    }));
    return;
  }
  response.writeHead(404);
  response.end();
});
const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });

function sendJson(socket, payload) {
  if (socket.readyState === 1) socket.send(JSON.stringify(payload));
}

const OPENING_TEXT = "我来啦。今天有没有一件想跟我说说的事？";
const GESTURE_PROMPTS = Object.freeze({
  thumbs_up: "用户刚刚对你比了一个赞，请自然回应这个动作。",
  victory: "用户刚刚对你比了一个胜利手势，请自然回应这个动作。",
  ok: "用户刚刚对你比了一个 OK 手势，请自然回应这个动作。",
  heart_small: "用户刚刚对你比了一个单手小爱心，请自然回应这个动作。",
  heart_large: "用户刚刚用两只手比了一个大爱心，请自然回应这个动作。",
});

function normalizeCharacter(value) {
  return value === "lvdou" ? "lvdou" : "jiaojiao";
}

server.on("upgrade", (request, socket, head) => {
  const path = new URL(request.url || "/", "http://localhost").pathname;
  const origin = request.headers.origin || "";
  const ip = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown").split(",")[0].trim();
  if (!path.endsWith("/voice") || !allowedOrigins.has(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  if ((activeByIp.get(ip) || 0) >= MAX_CONNECTIONS_PER_IP) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  websocketServer.handleUpgrade(request, socket, head, (client) => {
    client.clientIp = ip;
    websocketServer.emit("connection", client, request);
  });
});

websocketServer.on("connection", (client) => {
  const ip = client.clientIp;
  activeByIp.set(ip, (activeByIp.get(ip) || 0) + 1);
  let asr = null;
  let started = false;
  let closed = false;
  let activeCharacter = "jiaojiao";
  let interactionMode = "none";
  let context = { entries: [], moments: [] };
  let epoch = 0;
  let inferenceController = null;
  let lastLocalSpeechAt = 0;
  let localSpeechSequence = 0;
  let lastTextAt = 0;
  let pendingSpeechParts = [];
  let pendingSpeechTimer = null;
  const recentGameplayTranscripts = new Map();
  const acceptedTextMessages = new Map();
  const sessionId = randomUUID();

  const cancelPending = () => {
    epoch += 1;
    inferenceController?.abort();
    sendJson(client, { type: "ai", state: "idle" });
  };

  const clearPendingSpeech = () => {
    if (pendingSpeechTimer) clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
    pendingSpeechParts = [];
  };

  const queueSpeechTurn = (text) => {
    const content = String(text || "").trim();
    if (!content || interactionMode !== "none") return;
    if (!pendingSpeechParts.includes(content)) pendingSpeechParts.push(content);
    if (pendingSpeechTimer) clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = setTimeout(() => {
      const parts = pendingSpeechParts;
      pendingSpeechParts = [];
      pendingSpeechTimer = null;
      const merged = parts.join("；").slice(0, 1000);
      if (!merged || closed || interactionMode !== "none") return;
      const requestedCharacter = detectCharacterSwitchCommand(merged);
      if (requestedCharacter) {
        activeCharacter = requestedCharacter;
        sendJson(client, { type: "character_switch", character: requestedCharacter });
        return;
      }
      void runInference(merged);
    }, 850);
    pendingSpeechTimer.unref?.();
  };

  const sendSpeech = async (text, { opening = false, character = activeCharacter, local = false, expectedEpoch = epoch, expectedLocalSequence = localSpeechSequence, signal } = {}) => {
    const speechCharacter = normalizeCharacter(character);
    const audio = await synthesizeSpeech(text, speechCharacter, ttsConfig, fetch, signal);
    if (closed || expectedEpoch !== epoch || (local && expectedLocalSequence !== localSpeechSequence)) return;
    if (!opening && !local) sendJson(client, { type: "ai", state: "speaking" });
    sendJson(client, {
      type: "speech",
      text,
      character: speechCharacter,
      opening,
      local,
      sessionId,
      mime: "audio/mpeg",
      audio: audio.toString("base64"),
    });
  };

  const runInference = async (text, character = activeCharacter) => {
    const responseCharacter = normalizeCharacter(character);
    if (!text || closed || interactionMode !== "none") return;
    // A child changing their mind is more important than finishing an old turn.
    // Abort immediately instead of making the new turn wait behind Ark or TTS.
    if (inferenceController) {
      epoch += 1;
      inferenceController.abort();
    }
    const expectedEpoch = epoch;
    const controller = new AbortController();
    inferenceController = controller;
    try {
      sendJson(client, { type: "ai", state: "thinking" });
      const response = await inferCharacterResponse(text, responseCharacter, arkConfig, null, context, controller.signal);
      if (closed || expectedEpoch !== epoch || interactionMode !== "none") return;
      if (!response?.text) throw new Error("Ark returned an empty character response");
      context.entries = [...context.entries, { role: "user", text: String(text).slice(0, 1000) }, { role: "assistant", text: response.text }].slice(-16);
      if (response.action) sendJson(client, { type: "action", action: response.action });
      if (response.story?.thread && response.story.thread !== "none") {
        sendJson(client, { type: "story", ...response.story });
      }
      await sendSpeech(response.text, { character: responseCharacter, expectedEpoch, signal: controller.signal });
    } catch (error) {
      if (expectedEpoch !== epoch || closed || error.name === "AbortError") return;
      console.error("Character response failed", { name: error.name });
      sendJson(client, { type: "ai", state: "unavailable" });
      sendJson(client, { type: "ai", state: "idle" });
    } finally {
      if (inferenceController === controller) inferenceController = null;
    }
  };

  const endSession = () => {
    if (closed) return;
    closed = true;
    cancelPending();
    clearPendingSpeech();
    asr?.close();
    activeByIp.set(ip, Math.max(0, (activeByIp.get(ip) || 1) - 1));
    if (!activeByIp.get(ip)) activeByIp.delete(ip);
  };

  const hardStop = MAX_SESSION_MS > 0 ? setTimeout(() => {
    sendJson(client, { type: "error", code: "SESSION_LIMIT", message: "语音会话已达到时长上限" });
    client.close(1000);
  }, MAX_SESSION_MS) : null;
  hardStop?.unref();

  client.on("message", async (data, isBinary) => {
    try {
    if (isBinary) {
      asr?.sendAudio(data);
      return;
    }
    let message;
    try {
      message = JSON.parse(data.toString("utf8"));
    } catch {
      return;
    }
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      sendJson(client, { type: "error", code: "INVALID_MESSAGE", message: "这条消息没有识别成功，请再试一次。" });
      return;
    }
    if (message.type === "character") {
      activeCharacter = normalizeCharacter(message.character);
      return;
    }
    if (message.type === "context") {
      context = sanitizeConversationContext(message);
      return;
    }
    if (message.type === "text") {
      if (!started || closed) return;
      const clientMessageId = /^[\w.:-]{1,80}$/.test(String(message.clientMessageId || "")) ? message.clientMessageId : "";
      if (clientMessageId && acceptedTextMessages.has(clientMessageId)) {
        sendJson(client, acceptedTextMessages.get(clientMessageId));
        return;
      }
      if (Date.now() - lastTextAt < 700) {
        sendJson(client, { type: "error", code: "TEXT_RATE_LIMIT", message: "等一下，再告诉我下一句。", clientMessageId });
        return;
      }
      const text = String(message.text || "").replace(/\s+/g, " ").trim().slice(0, 1000);
      if (!text) { sendJson(client, { type: "error", code: "INVALID_TEXT", message: "先写一句想说的话吧。", clientMessageId }); return; }
      lastTextAt = Date.now();
      const transcript = { type: "transcript", text, final: true, id: `dialogue-${clientMessageId || randomUUID()}`,
        sessionId, clientMessageId, inputMode: "text", source: interactionMode === "none" ? "child_speech" : "gameplay" };
      if (clientMessageId) {
        acceptedTextMessages.set(clientMessageId, transcript);
        if (acceptedTextMessages.size > 64) acceptedTextMessages.delete(acceptedTextMessages.keys().next().value);
      }
      sendJson(client, transcript);
      if (interactionMode !== "none") {
        recentGameplayTranscripts.set(transcript.id, { text, createdAt: Date.now() });
        if (recentGameplayTranscripts.size > 8) recentGameplayTranscripts.delete(recentGameplayTranscripts.keys().next().value);
        return;
      }
      const requestedCharacter = detectCharacterSwitchCommand(text);
      if (requestedCharacter) { activeCharacter = requestedCharacter; sendJson(client, { type: "character_switch", character: requestedCharacter }); return; }
      void runInference(text);
      return;
    }
    if (message.type === "clear_memory") {
      cancelPending();
      clearPendingSpeech();
      context = { entries: [], moments: [] };
      recentGameplayTranscripts.clear();
      acceptedTextMessages.clear();
      return;
    }
    if (message.type === "story_observation") {
      if (!started || closed) return;
      const observation = message.observation && typeof message.observation === "object" ? message.observation : {};
      const label = String(observation.label || "").replace(/\s+/g, " ").trim().slice(0, 48);
      const category = ["book", "food", "plant", "animal", "object"].includes(observation.category) ? observation.category : "object";
      if (!label) return;
      void runInference(`孩子拿到镜头前的物品看起来是${label}（${category}）。请自然接着聊，别声称看见了没提供的细节。`);
      return;
    }
    if (message.type === "resume_conversation") {
      if (!started || closed) return;
      const entry = recentGameplayTranscripts.get(message.transcriptId);
      if (!entry || Date.now() - entry.createdAt > 30_000) return;
      recentGameplayTranscripts.delete(message.transcriptId);
      cancelPending();
      interactionMode = "none";
      void runInference(entry.text);
      return;
    }
    if (message.type === "cancel") { cancelPending(); return; }
    if (message.type === "interaction_mode") {
      if (!["none", "toy", "find", "feed"].includes(message.mode)) return;
      cancelPending();
      interactionMode = message.mode;
      return;
    }
    if (message.type === "local_speech") {
      if (!started || Date.now() - lastLocalSpeechAt < 700) return;
      const text = String(message.text || "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (!text) return;
      lastLocalSpeechAt = Date.now();
      localSpeechSequence += 1;
      void sendSpeech(text, { local: true }).catch((error) => console.error("Interaction speech failed", { name: error.name }));
      return;
    }
    if (message.type === "interaction" && message.kind === "gesture") {
      const prompt = GESTURE_PROMPTS[message.gesture];
      if (started && prompt) runInference(prompt, message.character || activeCharacter);
      return;
    }
    if (message.type !== "start" || started) return;
    started = true;
    activeCharacter = normalizeCharacter(message.character);
    if (message.inputMode === "text" || message.textOnly === true) {
      sendJson(client, { type: "ready", inputMode: "text", sessionId });
      return;
    }
    asr = new VolcAsrSession({
      config: asrConfig,
      onReady: () => {
        sendJson(client, { type: "ready" });
        sendSpeech(OPENING_TEXT, { opening: true, character: activeCharacter }).catch((error) => {
          console.error("Opening speech failed", { name: error.name, message: error.message });
        });
      },
      onTranscript: (transcript) => {
        const corrected = correctBrandTranscript(transcript.text);
        const normalizedTranscript = { ...transcript, text: corrected.text.slice(0, 1000),
          id: transcript.final ? `dialogue-${randomUUID()}` : undefined,
          sessionId, source: interactionMode === "none" ? "child_speech" : "gameplay" };
        sendJson(client, { type: "transcript", ...normalizedTranscript });
        if (transcript.final && corrected.corrections.length) {
          const applied = corrected.corrections.reduce((sum, item) => sum + item.occurrences, 0);
          correctionMetrics.applied += applied;
          correctionMetrics.lastAppliedAt = new Date().toISOString();
          console.info("ASR brand correction", {
            rules: corrected.corrections.map(({ heard, brandTerm, occurrences }) => ({ heard, brandTerm, occurrences })),
          });
        }
        if (transcript.final) {
          if (interactionMode !== "none") {
            recentGameplayTranscripts.set(normalizedTranscript.id, { text: normalizedTranscript.text, createdAt: Date.now() });
            if (recentGameplayTranscripts.size > 8) recentGameplayTranscripts.delete(recentGameplayTranscripts.keys().next().value);
            return;
          }
          queueSpeechTurn(corrected.text);
        }
      },
      onError: (error) => {
        console.error("ASR session failed", { name: error.name, message: error.message });
        sendJson(client, { type: "error", code: "ASR_UNAVAILABLE", message: "语音识别暂时不可用" });
      },
    });
    try {
      await asr.connect();
    } catch {
      client.close(1011);
    }
    } catch (error) {
      console.error("Voice message rejected", { name: error.name });
      sendJson(client, { type: "error", code: "INVALID_MESSAGE", message: "这条消息没有识别成功，请再试一次。" });
    }
  });

  client.once("close", () => {
    if (hardStop) clearTimeout(hardStop);
    endSession();
  });
  client.once("error", endSession);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`JOCAM voice bridge listening on 127.0.0.1:${PORT}`);
});

function shutdown() {
  websocketServer.clients.forEach((client) => client.close(1001));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
