import { useEffect, useRef, useState } from "react";
import {
  SCENE_SAMPLE_INTERVAL_MS,
  advanceSceneGate,
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
  return "https://rive.mikeywa.site/jocam/api/vision";
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

  useEffect(() => {
    onReactionRef.current = onReaction;
  }, [onReaction]);

  useEffect(() => {
    activeCharacterRef.current = activeCharacter;
  }, [activeCharacter]);

  useEffect(() => {
    if (!enabled) {
      gateRef.current = createSceneGate(performance.now());
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
        const response = await fetch(getVisionApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, character: activeCharacterRef.current }),
          signal: requestController.signal,
        });
        if (!response.ok) throw new Error(`Vision request failed (${response.status})`);
        const result = await response.json();
        if (!result?.ok) throw new Error("Vision response was not successful");
        gateRef.current = finishSceneRequest(gateRef.current, fingerprint, true);
        setVisionState("idle");

        if (!result.evaluable || !result.text) return;
        const now = Date.now();
        if (!forceReaction && !shouldShowSceneReaction(reactionHistoryRef.current, result.repeatKey, now)) return;
        reactionHistoryRef.current.set(result.repeatKey, now);
        const reaction = {
          id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
          text: String(result.text).slice(0, 42),
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
        gateRef.current = finishSceneRequest(gateRef.current, fingerprint, false);
        if (!cancelled && error.name !== "AbortError") {
          console.warn("Camera scene analysis unavailable", error);
          setVisionState("unavailable");
        }
      } finally {
        window.clearTimeout(requestTimeout);
        requestController = null;
      }
    };

    const sample = ({ immediate = false } = {}) => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || gateRef.current.inFlight) return;
      try {
        const fingerprint = captureFingerprint(video, fingerprintCanvasRef.current);
        const update = immediate
          ? beginImmediateSceneRequest(gateRef.current, fingerprint, performance.now())
          : advanceSceneGate(gateRef.current, fingerprint, performance.now());
        gateRef.current = update.state;
        if (update.shouldRequest) void analyzeStableScene(update.fingerprint, { forceReaction: immediate });
      } catch (error) {
        console.warn("Camera scene sampling unavailable", error);
      }
    };

    sample({ immediate: true });
    const interval = window.setInterval(sample, SCENE_SAMPLE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      requestController?.abort();
      gateRef.current = createSceneGate(performance.now());
    };
  }, [enabled, videoRef]);

  useEffect(() => () => {
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
  }, []);

  return { visionState, sceneReaction };
}

export const cameraSceneInternals = {
  FINGERPRINT_HEIGHT,
  FINGERPRINT_WIDTH,
  REACTION_VISIBLE_MS,
  captureFingerprint,
  captureVisionImage,
  getVisionApiUrl,
};
