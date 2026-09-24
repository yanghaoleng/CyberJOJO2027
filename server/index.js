import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { buildCharacterInstructions, getArkConfig, inferCharacterResponse, inferLeaveNote, parseCharacterSignal, sanitizeConversationContext } from "./ark-command.js";
import { buildStoryInstructions, getStoryArc, STORY_ARC_DAYS } from "./story-arc.js";
import { correctBrandTranscript } from "./brand-lexicon.js";
import { detectCharacterSwitchCommand } from "./character-switch-command.js";
import { getVolcAsrConfig, VolcAsrSession } from "./volc-asr.js";
import { getVolcTtsConfig, synthesizeSpeech } from "./volc-tts.js";
import { createVisionRequestHandler } from "./vision-route.js";
import { createSummaryRequestHandler } from "./summary-route.js";
import { createGameplayRequestHandler } from "./gameplay-route.js";
import { createMattingRequestHandler } from "./matting-route.js";
import { getSeeduplexConfig, SeeduplexSession } from "./seeduplex-session.js";

const PORT = Number(process.env.PORT || 8787);
const MAX_SESSION_MS = Number(process.env.JOCAM_MAX_SESSION_MS || 0);
const MAX_CONNECTIONS_PER_IP = Number(process.env.JOCAM_MAX_CONNECTIONS_PER_IP || 2);
const STORY_CLOSING_MS = 3 * 60_000;
const LEAVE_NOTE_IDLE_MS = Number(process.env.JOCAM_LEAVE_NOTE_IDLE_MS || 75_000);
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
let seeduplexConfig;
try {
  asrConfig = getVolcAsrConfig();
  arkConfig = getArkConfig();
  ttsConfig = getVolcTtsConfig();
  seeduplexConfig = getSeeduplexConfig();
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

const OPENING_TEXT = "嗨，我来啦！";
const buildOpeningText = (storyDayValue, storyAgeGroupValue, character = "jiaojiao") => {
  if (character === "lvdou") return "Hi, I'm Domi! What interesting thing can you spot around you today?";
  if (storyDayValue > STORY_ARC_DAYS) return `${OPENING_TEXT} 今天有什么新鲜事想跟我聊聊？`;
  const arc = getStoryArc(storyDayValue, storyAgeGroupValue);
  return `${OPENING_TEXT} 对了，${arc.opening}`;
};
const GESTURE_PROMPTS = Object.freeze({
  thumbs_up: "用户刚刚对你比了一个赞。高兴地回赞他，像朋友之间打招呼一样自然。",
  victory: "用户刚刚对你比了一个胜利手势，请自然回应这个动作。",
  ok: "用户刚刚对你比了一个 OK 手势，请自然回应这个动作。",
  heart_small: "用户刚刚对你比了一个单手小爱心。高兴地回他一个爱心。",
  heart_large: "用户刚刚用两只手比了一个大爱心。开心地回应这份喜欢。",
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
  let seeduplex = null;
  let started = false;
  let activated = false;
  let upstreamReady = false;
  let openingSent = false;
  let warmupTimer = null;
  let storyDay = 1;
  let storyAgeGroup = "mid";
  let sessionStartedAt = 0;
  let storyClosingSent = false;
  let leaveNoteTimer = null;
  const storyInstructions = (closing = false) => activeCharacter === "lvdou"
    ? "Help the child discover one visible, safe everyday object. Invite them to show it, say its English name, and collect a cutout word card. Never claim to see an object without a camera observation. Speak only English."
    : buildStoryInstructions(storyDay, storyAgeGroup, { closing, context });
  const armLeaveNote = () => {
    if (closed || leaveNoteTimer) return;
    leaveNoteTimer = setTimeout(() => { leaveNoteTimer = null; void generateLeaveNote(); }, LEAVE_NOTE_IDLE_MS);
  };
  const disarmLeaveNote = () => {
    if (leaveNoteTimer) { clearTimeout(leaveNoteTimer); leaveNoteTimer = null; }
  };
  let closed = false;
  let activeCharacter = "jiaojiao";
  let pendingSwitchGreeting = "";
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
    seeduplex?.interrupt();
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
        switchToCharacter(requestedCharacter, true);
        return;
      }
      void runInference(merged);
    }, 850);
    pendingSpeechTimer.unref?.();
  };

  const generateLeaveNote = async () => {
    if (closed || !started || interactionMode !== "none" || !context.entries.length) return;
    const noteCharacter = activeCharacter;
    try {
      const text = await inferLeaveNote(noteCharacter, arkConfig, context, noteCharacter === "lvdou" ? "" : getStoryArc(storyDay, storyAgeGroup).hook);
      if (closed || !text) return;
      const audio = await synthesizeSpeech(text, noteCharacter, ttsConfig, fetch);
      if (closed) return;
      context.entries = [...context.entries, { role: "assistant", text: String(text).slice(0, 1000) }].slice(-16);
      sendJson(client, { type: "leave_note", text, character: noteCharacter, sessionId, mime: "audio/mpeg", audio: audio.toString("base64") });
    } catch (error) {
      if (closed || error.name === "AbortError") return;
      console.error("Leave note generation failed", { name: error.name, message: error.message });
    }
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
      const closing = !storyClosingSent && Date.now() - sessionStartedAt >= STORY_CLOSING_MS;
      if (closing) storyClosingSent = true;
      const response = await inferCharacterResponse(text, responseCharacter, arkConfig, null, context, controller.signal, storyInstructions(closing));
      if (closed || expectedEpoch !== epoch || interactionMode !== "none") return;
      if (!response?.text) throw new Error("Ark returned an empty character response");
      context.entries = [...context.entries, { role: "user", text: String(text).slice(0, 1000) }, { role: "assistant", text: response.text }].slice(-16);
      if (response.action) sendJson(client, { type: "action", action: response.action });
      if (response.story?.thread && response.story.thread !== "none") {
        sendJson(client, { type: "story", ...response.story });
      }
      await sendSpeech(response.text, { character: responseCharacter, expectedEpoch, signal: controller.signal });
      armLeaveNote();
    } catch (error) {
      if (expectedEpoch !== epoch || closed || error.name === "AbortError") return;
      console.error("Character response failed", { name: error.name });
      sendJson(client, { type: "ai", state: "unavailable" });
      sendJson(client, { type: "ai", state: "idle" });
    } finally {
      if (inferenceController === controller) inferenceController = null;
    }
  };

  const runClassicTurn = (text, character = activeCharacter) => {
    if (!seeduplex) {
      void runInference(text, character);
      return;
    }
    seeduplex.interrupt();
    seeduplex.setMuted(true);
    void runInference(text, character).finally(() => seeduplex?.setMuted(false));
  };

  const switchToCharacter = (requestedCharacter, notifyClient = false) => {
    if (requestedCharacter === activeCharacter) return;
    activeCharacter = requestedCharacter;
    disarmLeaveNote();
    cancelPending();
    if (notifyClient) sendJson(client, { type: "character_switch", character: requestedCharacter });
    const greeting = requestedCharacter === "lvdou"
      ? "Hi, I'm Domi! Show me something you found, and we'll make a word card."
      : "我来啦！最近读了哪本绘本？想不想一起看看里面的角色？";
    if (seeduplex) {
      pendingSwitchGreeting = greeting;
      seeduplex.update({ instructions: buildCharacterInstructions(activeCharacter, storyInstructions(false)),
        voice: seeduplexConfig.voices[activeCharacter] || ttsConfig.voices[activeCharacter] });
    } else {
      void sendSpeech(greeting, { character: requestedCharacter }).catch((error) => console.error("Switch greeting failed", { name: error.name }));
    }
  };

  const endSession = () => {
    if (closed) return;
    closed = true;
    clearTimeout(warmupTimer);
    cancelPending();
    clearPendingSpeech();
    asr?.close();
    seeduplex?.close();
    if (leaveNoteTimer) { clearTimeout(leaveNoteTimer); leaveNoteTimer = null; }
    activeByIp.set(ip, Math.max(0, (activeByIp.get(ip) || 1) - 1));
    if (!activeByIp.get(ip)) activeByIp.delete(ip);
  };

  const hardStop = MAX_SESSION_MS > 0 ? setTimeout(() => {
    sendJson(client, { type: "error", code: "SESSION_LIMIT", message: "语音会话已达到时长上限" });
    client.close(1000);
  }, MAX_SESSION_MS) : null;
  hardStop?.unref();

  const greetWhenActive = () => {
    if (!activated || !upstreamReady || openingSent || closed) return;
    openingSent = true;
    sessionStartedAt = Date.now();
    clearTimeout(warmupTimer);
    if (seeduplex) {
      seeduplex.setMuted(interactionMode !== "none");
      seeduplex.greet(buildOpeningText(storyDay, storyAgeGroup, activeCharacter));
    } else {
      sendSpeech(buildOpeningText(storyDay, storyAgeGroup, activeCharacter), { opening: true, character: activeCharacter }).catch((error) => {
        console.error("Opening speech failed", { name: error.name });
      });
    }
  };

  client.on("message", async (data, isBinary) => {
    try {
    if (isBinary) {
      if (!activated) return;
      if (seeduplex) seeduplex.sendAudio(data);
      else asr?.sendAudio(data);
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
    if (message.type === "activate") {
      if (!started || closed || activated) return;
      activated = true;
      if (Number.isInteger(message.storyDay)) storyDay = Math.min(STORY_ARC_DAYS + 1, Math.max(1, message.storyDay));
      if (seeduplex) {
        seeduplex.instructions = buildCharacterInstructions(activeCharacter, storyInstructions(false));
        seeduplex.update({ instructions: seeduplex.instructions });
      }
      clearTimeout(warmupTimer);
      greetWhenActive();
      return;
    }
    if (message.type === "character") {
      if (Number.isInteger(message.storyDay)) storyDay = Math.min(STORY_ARC_DAYS + 1, Math.max(1, message.storyDay));
      switchToCharacter(normalizeCharacter(message.character));
      if (seeduplex) seeduplex.update({ instructions: buildCharacterInstructions(activeCharacter, storyInstructions(false)) });
      return;
    }
    if (message.type === "context") {
      context = sanitizeConversationContext(message);
      if (seeduplex) {
        seeduplex.instructions = buildCharacterInstructions(activeCharacter, storyInstructions(false));
        seeduplex.update({ instructions: seeduplex.instructions });
      }
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
      disarmLeaveNote();
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
      if (requestedCharacter) { switchToCharacter(requestedCharacter, true); return; }
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
      runClassicTurn(activeCharacter === "lvdou"
        ? `The child showed something that visually appears to be ${label} (${category}). Reply only in English, help name it in English, and do not invent unseen details.`
        : `孩子拿到镜头前的物品看起来是${label}（${category}）。请自然接着聊，别声称看见了没提供的细节。`);
      return;
    }
    if (message.type === "resume_conversation") {
      if (!started || closed) return;
      const entry = recentGameplayTranscripts.get(message.transcriptId);
      if (!entry || Date.now() - entry.createdAt > 30_000) return;
      recentGameplayTranscripts.delete(message.transcriptId);
      cancelPending();
      interactionMode = "none";
      if (seeduplex) {
        seeduplex.setMuted(false);
        return;
      }
      void runInference(entry.text);
      return;
    }
    if (message.type === "cancel") { cancelPending(); return; }
    if (message.type === "interaction_mode") {
      if (!["none", "toy", "find", "feed"].includes(message.mode)) return;
      if (interactionMode === message.mode) return;
      cancelPending();
      interactionMode = message.mode;
      seeduplex?.setMuted(message.mode !== "none");
      return;
    }
    if (message.type === "local_speech" || message.type === "scene_speech") {
      if (!started || Date.now() - lastLocalSpeechAt < 700) return;
      const originalText = String(message.text || "").replace(/\s+/g, " ").trim().slice(0, 80);
      const text = activeCharacter === "lvdou" && /[\u3400-\u9fff]/.test(originalText)
        ? "Let's look closely. What do you notice?" : originalText;
      if (!text) return;
      lastLocalSpeechAt = Date.now();
      localSpeechSequence += 1;
      if (message.type === "scene_speech" && interactionMode === "none") {
        cancelPending();
        context.entries = [...context.entries, { role: "assistant", text }].slice(-16);
        if (seeduplex) {
          seeduplex.update({ instructions: `${buildCharacterInstructions(activeCharacter, storyInstructions(false))}\n刚才镜头观察得到的描述：${text}。后续谈到这个物品时参考它，不要编造其他视觉细节。` });
          seeduplex.greet(text);
          return;
        }
      }
      void sendSpeech(text, { local: true }).catch((error) => console.error("Interaction speech failed", { name: error.name }));
      return;
    }
    if (message.type === "interaction" && message.kind === "gesture") {
      const prompt = GESTURE_PROMPTS[message.gesture];
      if (started && prompt) runClassicTurn(prompt, message.character || activeCharacter);
      return;
    }
    if (message.type !== "start" || started) return;
    started = true;
    activated = message.deferGreeting !== true;
    if (!activated) warmupTimer = setTimeout(() => client.close(1000, "cover warmup expired"), 30_000);
    activeCharacter = normalizeCharacter(message.character);
    if (Number.isInteger(Number(message.storyDay))) {
      storyDay = Math.min(STORY_ARC_DAYS + 1, Math.max(1, Number(message.storyDay)));
    }
    if (["low", "mid", "high"].includes(message.ageGroup)) {
      storyAgeGroup = message.ageGroup;
    }
    openingSent = message.resume === true;
    if (activated) sessionStartedAt = Date.now();
    if (message.inputMode === "text" || message.textOnly === true) {
      sendJson(client, { type: "ready", inputMode: "text", sessionId });
      return;
    }
    if (seeduplexConfig?.enabled) {
      let speechStreamId = "";
      seeduplex = new SeeduplexSession({
        config: seeduplexConfig,
        instructions: buildCharacterInstructions(activeCharacter, storyInstructions(false)),
        voice: seeduplexConfig.voices[activeCharacter] || ttsConfig.voices[activeCharacter],
        context: context.entries,
        onTranscript: (transcript) => {
          if (!activated) return;
          const corrected = correctBrandTranscript(transcript.text);
          const normalizedTranscript = { ...transcript, text: corrected.text.slice(0, 1000),
            id: transcript.final ? `dialogue-${randomUUID()}` : undefined,
            sessionId, source: interactionMode === "none" ? "child_speech" : "gameplay" };
          sendJson(client, { type: "transcript", ...normalizedTranscript });
          if (transcript.final && interactionMode === "none") {
            const requestedCharacter = detectCharacterSwitchCommand(normalizedTranscript.text);
            if (requestedCharacter && requestedCharacter !== activeCharacter) {
              switchToCharacter(requestedCharacter, true);
              return;
            }
          }
          if (transcript.final && corrected.corrections.length) {
            const applied = corrected.corrections.reduce((sum, item) => sum + item.occurrences, 0);
            correctionMetrics.applied += applied;
            correctionMetrics.lastAppliedAt = new Date().toISOString();
            console.info("ASR brand correction", {
              rules: corrected.corrections.map(({ heard, brandTerm, occurrences }) => ({ heard, brandTerm, occurrences })),
            });
          }
          if (transcript.final) {
            disarmLeaveNote();
            if (interactionMode !== "none") {
              recentGameplayTranscripts.set(normalizedTranscript.id, { text: normalizedTranscript.text, createdAt: Date.now() });
              if (recentGameplayTranscripts.size > 8) recentGameplayTranscripts.delete(recentGameplayTranscripts.keys().next().value);
              return;
            }
            context.entries = [...context.entries, { role: "user", text: String(corrected.text).replace(/\s+/g, " ").trim().slice(0, 1000) }].slice(-16);
          }
        },
        onAudioStart: () => {
          if (!activated) return;
          speechStreamId = randomUUID();
          sendJson(client, { type: "speech_start", streamId: speechStreamId, character: activeCharacter, sampleRate: 24_000 });
        },
        onText: ({ text }) => { if (activated) sendJson(client, { type: "speech_text", text, character: activeCharacter }); },
        onAudioDelta: ({ audio }) => {
          if (activated && !closed && speechStreamId) sendJson(client, { type: "speech_chunk", streamId: speechStreamId, audio });
        },
        onCancel: () => {
          sendJson(client, { type: "speech_cancel", streamId: speechStreamId });
          speechStreamId = "";
        },
        onCancelAcknowledged: () => {
          if (!pendingSwitchGreeting || closed) return;
          const greeting = pendingSwitchGreeting;
          pendingSwitchGreeting = "";
          seeduplex.greet(greeting);
        },
        onAudioDone: ({ text }) => {
          if (!activated || closed) return;
          const cleanText = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1000);
          sendJson(client, { type: "speech_end", streamId: speechStreamId, text: cleanText, character: activeCharacter, sessionId });
          if (cleanText) context.entries = [...context.entries, { role: "assistant", text: cleanText }].slice(-16);
          armLeaveNote();
        },
        onFunctionCall: ({ name, arguments: raw }) => {
          if (!activated || name !== "respond_as_character") return false;
          const signal = parseCharacterSignal(raw);
          if (signal.action) sendJson(client, { type: "action", action: signal.action });
          if (signal.thread !== "none") sendJson(client, { type: "story", thread: signal.thread });
          return true;
        },
        onError: (error) => {
          console.error("Seeduplex session failed", { name: error.name, message: error.message });
          sendJson(client, { type: "error", code: "ASR_UNAVAILABLE", message: "语音连接中断，正在重连，请再说一次。" });
          // Close the bridge as well: an open browser socket must not hide a
          // dead upstream. The client reconnects with its saved conversation.
          client.close(1011, "voice upstream unavailable");
        },
        onReady: () => {
          upstreamReady = true;
          // Cover connections may have been created before local journal data
          // and today's visit arrived. Apply the latest context before greeting.
          seeduplex?.update({ instructions: buildCharacterInstructions(activeCharacter, storyInstructions(false)) });
          sendJson(client, { type: "ready", transport: "seeduplex" });
          seeduplex?.setMuted(!activated || interactionMode !== "none");
          greetWhenActive();
        },
      });
      try {
        await seeduplex.connect();
      } catch {
        client.close(1011);
      }
      return;
    }
    asr = new VolcAsrSession({
      config: asrConfig,
      onReady: () => {
        upstreamReady = true;
        sendJson(client, { type: "ready" });
        greetWhenActive();
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
          disarmLeaveNote();
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
