import { useEffect, useRef, useState, useCallback } from "react";
import { requestScene } from "./scene-request.js";
import {
  beginImmediateSceneRequest,
  createSceneFingerprint,
  createSceneGate,
  finishSceneRequest,
  getVisionCaptureSize,
  shouldShowSceneReaction,
} from "./scene-analysis.js";

const REACTION_VISIBLE_MS = 5_800;
const FINGERPRINT_WIDTH = 64;
const FINGERPRINT_HEIGHT = 40;

function getVisionApiUrl() {
  const configured = import.meta.env.VITE_JOCAM_VISION_URL;
  if (configured) return configured;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8787/vision";
  }
  return new URL("api/vision", window.location.href).href;
}

function createFrameCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function captureFingerprint(video, canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return createSceneFingerprint(context.getImageData(0, 0, canvas.width, canvas.height));
}

function captureVisionImage(video, canvas) {
  const size = getVisionCaptureSize(video.videoWidth, video.videoHeight);
  if (!size.width || !size.height) return "";
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(video, 0, 0, size.width, size.height);
  let image = canvas.toDataURL("image/jpeg", 0.68);
  if (image.length > 230_000) image = canvas.toDataURL("image/jpeg", 0.52);
  return image.length <= 240_000 ? image : "";
}

export function useCameraSceneAnalysis({
  enabled,
  videoRef,
  activeCharacter,
  onReaction,
}) {
  const [visionState, setVisionState] = useState("idle");
  const [sceneReaction, setSceneReaction] = useState(null);
  const onReactionRef = useRef(onReaction);
  const activeCharacterRef = useRef(activeCharacter);
  const gateRef = useRef(createSceneGate());
  const reactionHistoryRef = useRef(new Map());
  const reactionTimerRef = useRef(null);
  const fingerprintCanvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const analyzeStableSceneRef = useRef(null);
  const pendingRequestRef = useRef(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    onReactionRef.current = onReaction;
  }, [onReaction]);

  useEffect(() => {
    activeCharacterRef.current = activeCharacter;
  }, [activeCharacter]);

  useEffect(() => {
    if (!enabled) {
      gateRef.current = createSceneGate(performance.now());
      pendingRequestRef.current = false;
      setVisionState("idle");
      return undefined;
    }

    let cancelled = false;
    let requestController = null;
    gateRef.current = createSceneGate(performance.now());
    if (!fingerprintCanvasRef.current) {
      fingerprintCanvasRef.current = createFrameCanvas(FINGERPRINT_WIDTH, FINGERPRINT_HEIGHT);
    }
    if (!captureCanvasRef.current) captureCanvasRef.current = createFrameCanvas(1, 1);

    const analyzeStableScene = async (fingerprint, { forceReaction = false } = {}) => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || cancelled) {
        gateRef.current = finishSceneRequest(gateRef.current, fingerprint, false);
        return;
      }
      const image = captureVisionImage(video, captureCanvasRef.current);
      if (!image) {
        gateRef.current = finishSceneRequest(gateRef.current, fingerprint, false);
        return;
      }

      requestController = new AbortController();
      const requestTimeout = window.setTimeout(() => requestController?.abort(), 11_000);
      setVisionState("analyzing");
      try {
        const result = await requestScene(getVisionApiUrl(), { image, character: activeCharacterRef.current }, { signal: requestController.signal });
        if (cancelled) return;
        gateRef.current = finishSceneRequest(gateRef.current, fingerprint, true);
        setVisionState("idle");
        if (pendingRequestRef.current) return;

        if (!result.evaluable || !result.text) {
          result.text = "我还没看清，把它靠近镜头一点，再让我看看吧。";
          result.action = "curious";
        }
        const now = Date.now();
        if (!forceReaction && !shouldShowSceneReaction(reactionHistoryRef.current, result.repeatKey, now)) return;
        reactionHistoryRef.current.set(result.repeatKey, now);
        const reaction = {
          id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
          text: String(result.text).slice(0, 200),
          subject: String(result.subject || "").slice(0, 24),
          category: result.category,
          tone: result.tone,
          action: result.action,
          repeatKey: result.repeatKey,
          confidence: result.confidence,
          character: activeCharacterRef.current,
          audio: result.audio || "",
          mime: result.mime || "audio/mpeg",
        };
        setSceneReaction(reaction);
        onReactionRef.current?.(reaction);
        if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
        reactionTimerRef.current = window.setTimeout(() => {
          reactionTimerRef.current = null;
          setSceneReaction((current) => current?.id === reaction.id ? null : current);
        }, REACTION_VISIBLE_MS);
      } catch (error) {
        if (cancelled) return;
        gateRef.current = finishSceneRequest(gateRef.current, fingerprint, false);
        if (!pendingRequestRef.current) {
          console.warn("Camera scene analysis unavailable", error);
          setVisionState("unavailable");
          onReactionRef.current?.({ text: "刚才没看成功，再给我看一下好吗？", character: activeCharacterRef.current, action: "curious" });
        }
      } finally {
        window.clearTimeout(requestTimeout);
        requestController = null;
        if (!cancelled && pendingRequestRef.current) {
          pendingRequestRef.current = false;
          window.queueMicrotask(() => triggerRef.current?.());
        }
      }
    };

    analyzeStableSceneRef.current = analyzeStableScene;

    // Wait for the child's invitation; do not compete with the opening greeting.
    return () => {
      cancelled = true;
      pendingRequestRef.current = false;
      requestController?.abort();
      analyzeStableSceneRef.current = null;
      gateRef.current = createSceneGate(performance.now());
    };
  }, [enabled, videoRef]);

  const triggerSceneAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!analyzeStableSceneRef.current) return;
    if (gateRef.current.inFlight) { pendingRequestRef.current = true; return; }
    if (!video || video.readyState < 2) return;
    try {
      const fingerprint = captureFingerprint(video, fingerprintCanvasRef.current);
      const update = beginImmediateSceneRequest(gateRef.current, fingerprint, performance.now());
      gateRef.current = update.state;
      if (update.shouldRequest) void analyzeStableSceneRef.current?.(update.fingerprint, { forceReaction: true });
    } catch (error) {
      console.warn("Camera scene sampling unavailable", error);
    }
  }, [videoRef]);
  triggerRef.current = triggerSceneAnalysis;

  useEffect(() => () => {
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
  }, []);

  return { visionState, sceneReaction, triggerSceneAnalysis };
}

export const cameraSceneInternals = {
  FINGERPRINT_HEIGHT,
  FINGERPRINT_WIDTH,
  REACTION_VISIBLE_MS,
  captureFingerprint,
  captureVisionImage,
  getVisionApiUrl,
};
