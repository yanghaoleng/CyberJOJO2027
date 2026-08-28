import http from "node:http";
import { WebSocketServer } from "ws";
import { getArkConfig, inferCharacterResponse } from "./ark-command.js";
import { correctBrandTranscript } from "./brand-lexicon.js";
import { getVolcAsrConfig, VolcAsrSession } from "./volc-asr.js";
import { getVolcTtsConfig, synthesizeSpeech } from "./volc-tts.js";
import { createVisionRequestHandler } from "./vision-route.js";

const PORT = Number(process.env.PORT || 8787);
const MAX_SESSION_MS = Number(process.env.JOCAM_MAX_SESSION_MS || 5 * 60_000);
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
const server = http.createServer(async (request, response) => {
  if (await handleVisionRequest(request, response)) return;
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

const OPENING_TEXT = "我来啦！看镜头，我们一起拍张照片吧！";
const GESTURE_PROMPTS = Object.freeze({
  thumbs_up: "用户刚刚对你比了一个赞，请自然回应这个动作。",
  victory: "用户刚刚对你比了一个胜利手势，请自然回应这个动作。",
  ok: "用户刚刚对你比了一个 OK 手势，请自然回应这个动作。",
  finger_heart: "用户刚刚对你比了一个爱心手势，请自然回应这个动作。",
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
  let inferenceRunning = false;
  let queuedPrompt = null;
  let lastInferenceAt = 0;
  let activeCharacter = "jiaojiao";

  const sendSpeech = async (text, { opening = false, character = activeCharacter } = {}) => {
    const speechCharacter = normalizeCharacter(character);
    const audio = await synthesizeSpeech(text, speechCharacter, ttsConfig);
    if (!opening) sendJson(client, { type: "ai", state: "speaking" });
    sendJson(client, {
      type: "speech",
      text,
      character: speechCharacter,
      opening,
      mime: "audio/mpeg",
      audio: audio.toString("base64"),
    });
  };

  const runInference = async (text, character = activeCharacter) => {
    const responseCharacter = normalizeCharacter(character);
    if (!text) return;
    if (inferenceRunning || Date.now() - lastInferenceAt < 1_200) {
      queuedPrompt = { text, character: responseCharacter };
      return;
    }
    inferenceRunning = true;
    lastInferenceAt = Date.now();
    try {
      sendJson(client, { type: "ai", state: "thinking" });
      const response = await inferCharacterResponse(text, responseCharacter, arkConfig);
      if (!response?.text) throw new Error("Ark returned an empty character response");
      if (response.action) sendJson(client, { type: "action", action: response.action });
      await sendSpeech(response.text, { character: responseCharacter });
    } catch (error) {
      console.error("Character response failed", { name: error.name, message: error.message });
      sendJson(client, { type: "ai", state: "unavailable" });
      sendJson(client, { type: "ai", state: "idle" });
    } finally {
      inferenceRunning = false;
      if (queuedPrompt) {
        const next = queuedPrompt;
        queuedPrompt = null;
        setTimeout(() => runInference(next.text, next.character), 1_250).unref();
      }
    }
  };

  const endSession = () => {
    if (closed) return;
    closed = true;
    asr?.close();
    activeByIp.set(ip, Math.max(0, (activeByIp.get(ip) || 1) - 1));
    if (!activeByIp.get(ip)) activeByIp.delete(ip);
  };

  const hardStop = setTimeout(() => {
    sendJson(client, { type: "error", code: "SESSION_LIMIT", message: "语音会话已达到时长上限" });
    client.close(1000);
  }, MAX_SESSION_MS);
  hardStop.unref();

  client.on("message", async (data, isBinary) => {
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
    if (message.type === "character") {
      activeCharacter = normalizeCharacter(message.character);
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
        const normalizedTranscript = { ...transcript, text: corrected.text };
        sendJson(client, { type: "transcript", ...normalizedTranscript });
        if (transcript.final && corrected.corrections.length) {
          const applied = corrected.corrections.reduce((sum, item) => sum + item.occurrences, 0);
          correctionMetrics.applied += applied;
          correctionMetrics.lastAppliedAt = new Date().toISOString();
          console.info("ASR brand correction", {
            rules: corrected.corrections.map(({ heard, brandTerm, occurrences }) => ({ heard, brandTerm, occurrences })),
          });
        }
        if (transcript.final) runInference(corrected.text);
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
  });

  client.once("close", () => {
    clearTimeout(hardStop);
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
