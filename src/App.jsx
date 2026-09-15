import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowClockwise,
  ArrowsLeftRight,
  CaretDown,
  Check,
  DownloadSimple,
  ImagesSquare,
  LockSimple,
  MagnifyingGlass,
  PictureInPicture,
  PlayCircle,
  X,
} from "@phosphor-icons/react";
import {
  Rive as CanvasRive,
  Layout as CanvasLayout,
  Fit as CanvasFit,
  Alignment as CanvasAlignment,
  RuntimeLoader as CanvasRuntimeLoader,
  EventType as CanvasEventType,
} from "@rive-app/canvas";
import {
  Rive as WebGLRive,
  Layout as WebGLLayout,
  Fit as WebGLFit,
  Alignment as WebGLAlignment,
  RuntimeLoader as WebGLRuntimeLoader,
  EventType as WebGLEventType,
} from "@rive-app/webgl2";
import { FaceLandmarker, FilesetResolver, GestureRecognizer, ImageSegmenter } from "@mediapipe/tasks-vision";
import { Calligraph } from "calligraph";
import QRCode from "qrcode";
import { createUISFX } from "uisfx";
import {
  CAMERA_GESTURES,
  advanceGestureTracker,
  classifyCameraGesture,
  createGestureTracker,
} from "./gesture-recognition.js";
import {
  getFrontCameraLensKind,
  getMinimumCameraZoom,
  selectWidestFrontCamera,
  shouldMirrorCamera,
} from "./camera-selection.js";
import {
  GESTURE_OUTLINE_DURATION_MS,
  GESTURE_OUTLINE_PADDING_PX,
  GESTURE_OUTLINE_RADIUS_PX,
  createOutlineOffsets,
  getRainbowOutlineHue,
  shouldOutlineGesture,
} from "./reaction-outline.js";
import {
  MEDIA_LIBRARY_LIMIT,
  loadMediaCaptures,
  storeMediaCapture,
} from "./media-library.js";
import useDailyJournal from "./journal/useDailyJournal.js";
import JournalDay from "./journal/JournalDay.jsx";
import { loadFriends } from "./friends/friend-store.js";
import { requestGameplay } from "./gameplay/gameplay-api.js";
import { createCharacterInteraction } from "./character-interaction.js";
import { CHARACTER_TIMELINES, resolveCharacterAnimation } from "./character-animations.js";
import { drawHeartFeedback, HEART_FEEDBACK_DURATION_MS } from "./heart-feedback.js";
const FriendCollection = lazy(() => import("./friends/FriendCollection.jsx"));
import { getContextualCaption } from "./contextual-caption.js";
import { createShutterSamples } from "./camera-feedback.js";
import { getFrontCameraPipRect, hasLiveVideoTrack } from "./dual-camera.js";
import {
  DEFAULT_PERSON_MASK_THRESHOLD,
  DEFAULT_PERSON_MIN_RATIO,
  getBackgroundCategoryIndex,
  hasConfidentMaskArea,
  hasSegmentedSubject,
} from "./subject-segmentation.js";
import { getNextVisionThrottle, getThrottledInterval } from "./vision-performance.js";
import { TypingIndicator } from "./components/amicro/typing-indicator.jsx";
import { CharacterCaptionBubble } from "./components/character-caption-bubble.jsx";
import { drawCharacterCaption } from "./character-caption.js";
import {
  endCharacterEchoGate,
  isCharacterEchoGateActive,
  startCharacterEchoGate,
} from "./voice-input-gate.js";
import {
  getUserSpeechBubblePlacement,
  getUserSpeechBubbleSizing,
} from "./speech-bubble-layout.js";
import {
  CHARACTER_LEFT_OVERFLOW_RATIO,
  getCharacterScaleMultiplier,
  getTabletThinkingIndicatorPosition,
  isTabletViewport,
} from "./device-layout.js";
import { useCameraSceneAnalysis } from "./use-camera-scene-analysis.js";

const BASE_URL = import.meta.env.BASE_URL;

const WELCOME_HEADLINES = [
  ["今天有没有一件", "想跟我说说的事？"],
  ["一件开心的事", "也值得慢慢说完"],
  ["把你发现的", "带给叫叫看看"],
  ["看不清的时候", "我们一起靠近一点"],
  ["一个小小手势", "也会有回应"],
];

const WELCOME_CHARACTER_DELAY_MS = 76;
const WELCOME_ANIMATION_SETTLE_MS = 420;
const WELCOME_HEADLINE_HOLD_MS = 3_000;

const WAITING_VOICE_LINES = {
  recognizing: ["我听到你说的了，让我想想", "收到啦，我先听清楚这句话"],
  thinking: ["我正在思考", "让我来想一想，马上告诉你"],
};

function ProgressiveCalligraphLine({ text, start, lineIndex, onComplete }) {
  const characters = Array.from(text);
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(0);

  useEffect(() => {
    if (!start) return undefined;
    if (visibleCharacterCount < characters.length) {
      const revealTimer = window.setTimeout(() => {
        setVisibleCharacterCount((current) => Math.min(current + 1, characters.length));
      }, visibleCharacterCount === 0 ? 110 : WELCOME_CHARACTER_DELAY_MS);
      return () => window.clearTimeout(revealTimer);
    }

    if (!onComplete) return undefined;
    const completeTimer = window.setTimeout(
      () => onComplete(lineIndex),
      WELCOME_ANIMATION_SETTLE_MS,
    );
    return () => window.clearTimeout(completeTimer);
  }, [characters.length, lineIndex, onComplete, start, visibleCharacterCount]);

  return (
    <Calligraph
      className="welcome-headline-line"
      as="span"
      variant="text"
      animation="smooth"
      initial
      trend={1}
      drift={{ x: 8, y: 12 }}
      autoSize={false}
      aria-hidden="true"
    >
      {characters.slice(0, visibleCharacterCount).join("")}
    </Calligraph>
  );
}

function ProgressiveCalligraphHeadline({ lines, onComplete }) {
  const [activeLineIndex, setActiveLineIndex] = useState(0);

  const handleLineComplete = useCallback((lineIndex) => {
    if (lineIndex < lines.length - 1) {
      setActiveLineIndex(lineIndex + 1);
      return;
    }
    onComplete?.();
  }, [lines.length, onComplete]);

  return lines.map((line, lineIndex) => (
    <ProgressiveCalligraphLine
      key={lineIndex}
      text={line}
      start={lineIndex <= activeLineIndex}
      lineIndex={lineIndex}
      onComplete={handleLineComplete}
    />
  ));
}

async function preferWidestFrontCamera(mediaDevices, stream, videoConstraints) {
  let activeTrack = stream.getVideoTracks()[0];
  let lensMode = getFrontCameraLensKind(activeTrack?.label);

  try {
    const currentDeviceId = activeTrack?.getSettings?.().deviceId || "";
    const devices = await mediaDevices.enumerateDevices();
    const preferredCamera = selectWidestFrontCamera(devices, currentDeviceId);

    if (preferredCamera && preferredCamera.device.deviceId !== currentDeviceId) {
      try {
        const preferredStream = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: preferredCamera.device.deviceId },
            width: videoConstraints.width,
            height: videoConstraints.height,
          },
        });
        const preferredTrack = preferredStream.getVideoTracks()[0];
        if (!preferredTrack) throw new Error("The selected front camera returned no video track");
        activeTrack?.stop();
        if (activeTrack) stream.removeTrack(activeTrack);
        activeTrack = preferredTrack;
        stream.addTrack(preferredTrack);
        lensMode = preferredCamera.lensKind;
      } catch (preferredCameraError) {
        console.warn("Preferred front wide camera unavailable; using the system default front camera", preferredCameraError);
      }
    }
  } catch (cameraDiscoveryError) {
    console.warn("Front camera lens details are unavailable; using the system-selected camera", cameraDiscoveryError);
  }

  try {
    const minimumZoom = getMinimumCameraZoom(activeTrack?.getCapabilities?.());
    if (minimumZoom !== null && activeTrack?.applyConstraints) {
      await activeTrack.applyConstraints({ advanced: [{ zoom: minimumZoom }] });
      if (lensMode === "default") lensMode = "minimum-zoom";
    }
  } catch (zoomError) {
    console.warn("The active camera did not accept its minimum zoom constraint", zoomError);
  }

  return { stream, lensMode };
}

const GESTURE_OUTLINE_OFFSETS = createOutlineOffsets(GESTURE_OUTLINE_RADIUS_PX);

function createGestureOutlineBuffers() {
  return {
    silhouette: document.createElement("canvas"),
    mask: document.createElement("canvas"),
    paint: document.createElement("canvas"),
    cacheKey: "",
  };
}

function resizeRenderCanvas(canvas, width, height) {
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
}

function prepareGestureOutlineMask(buffers, sourceMask, rect, targetWidth, targetHeight, revision, mirrored) {
  const paddedWidth = targetWidth + GESTURE_OUTLINE_PADDING_PX * 2;
  const paddedHeight = targetHeight + GESTURE_OUTLINE_PADDING_PX * 2;
  const cacheKey = [
    revision,
    targetWidth,
    targetHeight,
    Math.round(rect.x),
    Math.round(rect.y),
    Math.round(rect.width),
    Math.round(rect.height),
    mirrored ? "mirrored" : "direct",
  ].join(":");
  if (buffers.cacheKey === cacheKey) return;

  resizeRenderCanvas(buffers.silhouette, paddedWidth, paddedHeight);
  resizeRenderCanvas(buffers.mask, paddedWidth, paddedHeight);
  resizeRenderCanvas(buffers.paint, paddedWidth, paddedHeight);
  const silhouetteContext = buffers.silhouette.getContext("2d");
  const maskContext = buffers.mask.getContext("2d");
  if (!silhouetteContext || !maskContext) return;

  silhouetteContext.clearRect(0, 0, paddedWidth, paddedHeight);
  silhouetteContext.save();
  if (mirrored) {
    silhouetteContext.translate(
      GESTURE_OUTLINE_PADDING_PX + targetWidth,
      GESTURE_OUTLINE_PADDING_PX,
    );
    silhouetteContext.scale(-1, 1);
  } else {
    silhouetteContext.translate(GESTURE_OUTLINE_PADDING_PX, GESTURE_OUTLINE_PADDING_PX);
  }
  silhouetteContext.imageSmoothingEnabled = true;
  silhouetteContext.imageSmoothingQuality = "high";
  silhouetteContext.drawImage(sourceMask, rect.x, rect.y, rect.width, rect.height);
  silhouetteContext.restore();

  maskContext.clearRect(0, 0, paddedWidth, paddedHeight);
  maskContext.globalCompositeOperation = "source-over";
  for (const offset of GESTURE_OUTLINE_OFFSETS) {
    maskContext.drawImage(buffers.silhouette, offset.x, offset.y);
  }
  maskContext.globalCompositeOperation = "destination-out";
  maskContext.drawImage(buffers.silhouette, 0, 0);
  maskContext.globalCompositeOperation = "source-over";
  buffers.cacheKey = cacheKey;
}

function paintGestureOutline(buffers, timestamp) {
  const context = buffers.paint.getContext("2d");
  if (!context) return buffers.paint;
  context.clearRect(0, 0, buffers.paint.width, buffers.paint.height);
  context.globalCompositeOperation = "source-over";
  context.drawImage(buffers.mask, 0, 0);
  context.globalCompositeOperation = "source-in";
  const gradient = context.createLinearGradient(
    0,
    buffers.paint.height,
    buffers.paint.width,
    0,
  );
  for (let index = 0; index <= 8; index += 1) {
    gradient.addColorStop(
      index / 8,
      `hsl(${getRainbowOutlineHue(timestamp, index)}, 96%, 62%)`,
    );
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, buffers.paint.width, buffers.paint.height);
  context.globalCompositeOperation = "source-over";
  return buffers.paint;
}

function drawGestureOutline(
  context,
  buffers,
  sourceMask,
  rect,
  targetWidth,
  targetHeight,
  revision,
  timestamp,
  mirrored,
) {
  prepareGestureOutlineMask(
    buffers,
    sourceMask,
    rect,
    targetWidth,
    targetHeight,
    revision,
    mirrored,
  );
  const paint = paintGestureOutline(buffers, timestamp);
  const position = -GESTURE_OUTLINE_PADDING_PX;

  context.save();
  context.shadowColor = `hsl(${getRainbowOutlineHue(timestamp)}, 98%, 66%)`;
  context.shadowBlur = 12;
  context.drawImage(paint, position, position);
  context.restore();
  context.drawImage(paint, position, position);
}

const VOICE_ACTIONS = {
  praise: { animation: "TalkingEmotion_Praise", toast: "送你一个赞" },
  surprised: { animation: "TalkingEmotion_Surprised", toast: "做了个惊讶表情" },
  think: { animation: "TalkingEmotion_Think", toast: "正在认真思考" },
  happy: { animation: "TalkingEmotion_Happy", toast: "开心地笑了" },
  frighten: { animation: "TalkingEmotion_Frighten", toast: "吓了一跳" },
  curious: { animation: "TalkingEmotion_Curious", toast: "好奇地看过来" },
};
const GESTURE_ACTIONS = {
  [CAMERA_GESTURES.THUMBS_UP]: {
    animation: "TalkingEmotion_Praise",
    toast: "也给你点个赞",
  },
  [CAMERA_GESTURES.VICTORY]: {
    animation: "TalkingEmotion_Happy",
    toast: "和你一起比个耶",
  },
  [CAMERA_GESTURES.OK]: {
    animation: "TalkingEmotion_Sure",
    toast: "收到你的 OK",
  },
  [CAMERA_GESTURES.FINGER_HEART]: {
    animation: CHARACTER_TIMELINES.HEART_FULL_BODY,
    toast: "接住你的比心",
  },
};
const SILENT_AUDIO_DATA_URL = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";
const FRAME_SIZES = {
  portrait: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
};
const RIVE_SOURCE_SIZE = { width: 1200, height: 640 };
const RIVE_VISIBLE_SOURCE = { y: 96, width: 950, height: 544 };
const RIVE_DEFAULT_CROP_X = 72;
const RIVE_EDGE_PADDING = 4;
const RIVE_ANALYSIS_SIZE = { width: 600, height: 320 };
const RIVE_SCALE = 0.512;
const RIVE_DISPLAY_MULTIPLIER = 1.25;
const RIVE_LANDSCAPE_MULTIPLIER = 1.35;
const CAPTION_VERTICAL_OFFSET_RATIO = 0.02;
const DEFAULT_RIVE_ANIMATION = "Start_Dial";
const SECOND_RIVE_ANIMATION = "TalkingEmotion_Think";
const CLICK_RIVE_ANIMATION = "TalkingEmotion_Praise";
const RIVE_POSITION_ANIMATION = "Ipad";
const RIVE_MOUTH_ANIMATION = "Talking_Normal";
const COVER_RIVE_PLAYBACK_RATE = 0.25;
const CAMERA_RIVE_PLAYBACK_RATE = 0.8;
const RIVE_CAPTURE_ADVANCE_FRAMES = 4;
const MAX_RANDOM_DAY = 520;
const VOLUME_SHUTTER_KEYS = new Set([
  "AudioVolumeUp",
  "AudioVolumeDown",
  "VolumeUp",
  "VolumeDown",
]);
const VOLUME_SHUTTER_KEY_CODES = new Set([174, 175]);
const CAPTION_MODES = {
  together: { prefix: "我和叫叫一起阅读的", dayPrefix: "第", suffix: "天" },
  streak: { prefix: "坚持连续学习叫叫阅读", dayPrefix: "第", suffix: "天" },
};
const RENDER_INTERVAL_MS = 33;
const SEGMENT_INTERVAL_MS = 150;
const SUBJECT_SEGMENT_INTERVAL_MS = 1_700;
const SUBJECT_FALLBACK_DELAY_MS = 1_000;
const FACE_INTERVAL_MS = 120;
const GESTURE_INTERVAL_MS = 180;
const FACE_MISSING_TIMEOUT_MS = 850;
const PERSON_MASK_THRESHOLD = DEFAULT_PERSON_MASK_THRESHOLD;
const PERSON_MIN_MASK_RATIO = DEFAULT_PERSON_MIN_RATIO;
const PERSON_MISSING_FRAME_LIMIT = 3;
const PERSON_FEATHER_RANGE_PX = 5;
const LONG_PRESS_MS = 430;
const MAX_RECORDING_MS = 15_000;
const CORE_LOAD_ASSETS = [
  { key: "riveFile", path: "media/jiaojiao.riv?v=a4301637", bytes: 6_447_356, retain: true },
  { key: "visionWasm", path: "mediapipe/wasm/vision_wasm_internal.wasm", bytes: 11_756_954, retain: false },
  { key: "visionLoader", path: "mediapipe/wasm/vision_wasm_internal.js", bytes: 323_377, retain: false },
  { key: "segmentModel", path: "mediapipe/selfie_segmenter.tflite", bytes: 249_537, retain: true },
  { key: "subjectModel", path: "mediapipe/deeplab_v3.tflite", bytes: 2_780_176, retain: true },
  { key: "faceModel", path: "mediapipe/face_landmarker.task", bytes: 3_758_596, retain: true },
  { key: "gestureModel", path: "mediapipe/gesture_recognizer.task", bytes: 8_373_440, retain: true },
];
const RIVE_RUNTIME_ASSETS = {
  canvas: [
    { key: "riveWasm", path: "rive/canvas.wasm", bytes: 1_808_114, retain: false },
    { key: "riveFallback", path: "rive/canvas_fallback.wasm", bytes: 1_818_434, retain: false },
  ],
  webgl2: [
    { key: "riveWasm", path: "rive/rive.wasm", bytes: 2_004_858, retain: false },
    { key: "riveFallback", path: "rive/rive_fallback.wasm", bytes: 2_015_300, retain: false },
  ],
};
const RIVE_RUNTIMES = {
  canvas: {
    Rive: CanvasRive,
    Layout: CanvasLayout,
    Fit: CanvasFit,
    Alignment: CanvasAlignment,
    RuntimeLoader: CanvasRuntimeLoader,
    EventType: CanvasEventType,
  },
  webgl2: {
    Rive: WebGLRive,
    Layout: WebGLLayout,
    Fit: WebGLFit,
    Alignment: WebGLAlignment,
    RuntimeLoader: WebGLRuntimeLoader,
    EventType: WebGLEventType,
  },
};

function getLoadAssets(rendererMode) {
  const runtimeKey = rendererMode === "canvas" ? "canvas" : "webgl2";
  return [CORE_LOAD_ASSETS[0], ...RIVE_RUNTIME_ASSETS[runtimeKey], ...CORE_LOAD_ASSETS.slice(1)];
}
const CHARACTERS = {
  jiaojiao: { label: "叫叫", path: "media/jiaojiao.riv?v=a4301637" },
  lvdou: { label: "绿豆", path: "media/lvdou.riv?v=b7105cd1" },
};
const CHARACTER_TAP_WINDOW_MS = 720;
const CHARACTER_EXIT_DURATION_MS = 300;
const CHARACTER_ENTER_DURATION_MS = 430;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getRandomValue(max, excludedValue) {
  if (!Number.isFinite(excludedValue)) return Math.floor(Math.random() * max) + 1;
  const value = Math.floor(Math.random() * (max - 1)) + 1;
  return value >= excludedValue ? value + 1 : value;
}

function getCaptionText(mode, value) {
  const caption = CAPTION_MODES[mode] || CAPTION_MODES.together;
  return `${caption.prefix}${caption.dayPrefix} ${value} ${caption.suffix}`;
}

function getViewportOrientation() {
  if (typeof window === "undefined") return "portrait";
  const isLandscape = window.matchMedia?.("(orientation: landscape)").matches
    ?? window.innerWidth > window.innerHeight;
  return isLandscape ? "landscape" : "portrait";
}

function getIsMobileDevice() {
  if (typeof window === "undefined") return false;
  const navigatorMobile = window.navigator.userAgentData?.mobile;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
  const iPadDesktopMode = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return Boolean(navigatorMobile || mobileUserAgent || iPadDesktopMode || window.matchMedia?.("(pointer: coarse)").matches);
}

function getIsTabletDevice() {
  if (typeof window === "undefined") return false;
  return isTabletViewport({
    width: window.innerWidth,
    height: window.innerHeight,
    isMobileDevice: getIsMobileDevice(),
  });
}

function getRiveRendererMode() {
  if (typeof window === "undefined") return "canvas";
  const userAgent = window.navigator.userAgent || "";
  const isAppleWebKit = /AppleWebKit/i.test(userAgent)
    && !/(Chrome|Chromium|Edg|OPR|SamsungBrowser)/i.test(userAgent);
  if (isAppleWebKit) return "canvas";
  try {
    const probeCanvas = document.createElement("canvas");
    if (!probeCanvas.getContext("webgl2")) return "canvas";
    const offscreenCanvas = new OffscreenCanvas(2, 2);
    return offscreenCanvas.getContext("webgl2") ? "webgl2-offscreen" : "webgl2-direct";
  } catch {
    return "canvas";
  }
}

function getShareUrl() {
  if (typeof window === "undefined") return "https://mikeywa.site/jocam/";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.href;
}

function getCoverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function downsampleToPcm16(floatSamples, inputSampleRate, outputSampleRate = 16_000) {
  if (!floatSamples?.length || inputSampleRate < outputSampleRate) return new Int16Array();
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.floor(floatSamples.length / ratio));
  const output = new Int16Array(outputLength);
  let outputIndex = 0;
  let inputIndex = 0;
  while (outputIndex < outputLength) {
    const nextInputIndex = Math.min(floatSamples.length, Math.round((outputIndex + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let index = inputIndex; index < nextInputIndex; index += 1) {
      sum += floatSamples[index];
      count += 1;
    }
    const sample = clamp(sum / Math.max(count, 1), -1, 1);
    output[outputIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    outputIndex += 1;
    inputIndex = nextInputIndex;
  }
  return output;
}

function getVoiceSocketUrl() {
  const configured = import.meta.env.VITE_JOCAM_VOICE_URL;
  if (configured) return configured;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "ws://127.0.0.1:8787/voice";
  return "wss://rive.mikeywa.site/jocam/api/voice";
}

function splitBubbleText(context, text, maxWidth) {
  const allCharacters = Array.from(String(text || "").replace(/\s+/g, " ").trim());
  const characters = allCharacters;
  const lines = [""];
  for (const character of characters) {
    const current = lines.at(-1);
    if (context.measureText(current + character).width <= maxWidth || !current) {
      lines[lines.length - 1] = current + character;
    } else if (lines.length < 2) {
      lines.push(character);
    } else {
      lines.push(character);
    }
  }
  return lines;
}

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawSpeechSemicircle(context, {
  centerX,
  edgeY,
  height,
  width,
}) {
  const halfWidth = width / 2;

  context.beginPath();
  context.ellipse(centerX, edgeY, halfWidth, height, 0, 0, Math.PI);
  context.closePath();
  context.fill();
}

function drawCameraSource(context, source, rect, targetWidth, mirrored) {
  if (!mirrored) {
    context.drawImage(source, rect.x, rect.y, rect.width, rect.height);
    return;
  }
  context.save();
  context.translate(targetWidth, 0);
  context.scale(-1, 1);
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

function chooseRecordingMimeType() {
  if (!window.MediaRecorder) return "";
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getFileExtension(type) {
  return type.includes("mp4") ? "mp4" : "webm";
}

function getMediaTransitionName(id) {
  return `jocam-media-${String(id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function getTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function createCaptureId(type) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${type}-${randomPart}`;
}

function formatCaptureDate(createdAt) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function formatTimelineDay(dayKey) {
  const [year, month, day] = String(dayKey).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  const prefix = dayKey === todayKey ? "今天" : dayKey === yesterdayKey ? "昨天" : "";
  const calendar = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
  return prefix ? `${prefix} · ${calendar}` : `${year}年${calendar}`;
}

function getConversationSummaryApiUrl() {
  const configured = import.meta.env.VITE_JOCAM_SUMMARY_URL;
  if (configured) return configured;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:8787/conversation-summary";
  }
  return `${window.location.origin}/api/conversation-summary`;
}

function formatMediaDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function fetchAsset(asset, onProgress) {
  const response = await fetch(`${BASE_URL}${asset.path}`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Failed to load ${asset.path}`);

  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    onProgress(asset.key, asset.bytes);
    return asset.retain ? buffer : null;
  }

  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    if (asset.retain) chunks.push(value);
    onProgress(asset.key, Math.min(asset.bytes, loaded));
  }

  onProgress(asset.key, asset.bytes);
  if (!asset.retain) return null;

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

async function saveBlob(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function applyRivePlaybackRate(instance, playbackRateRef) {
  const advance = instance?.advanceAndReportChanges?.bind(instance);
  if (!advance) return;
  instance.advanceAndReportChanges = (elapsedTime) => {
    advance(elapsedTime * playbackRateRef.current);
  };
}

function App() {
  const [isMobileDevice] = useState(getIsMobileDevice);
  const [isTabletDevice, setIsTabletDevice] = useState(getIsTabletDevice);
  const [shareUrl] = useState(getShareUrl);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [day, setDay] = useState(() => getRandomValue(MAX_RANDOM_DAY));
  const [captionMode, setCaptionMode] = useState("together");
  const paddedDay = String(day).padStart(2, "0");

  const videoRef = useRef(null);
  const pipVideoRef = useRef(null);
  const outputCanvasRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const riveCanvasRef = useRef(null);
  const riveCaptureCanvasRef = useRef(null);
  const foregroundCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const gestureOutlineBuffersRef = useRef(null);
  const takePhotoRef = useRef(null);
  const autoCaptureTimerRef = useRef(null);
  const lastAutoCaptureAtRef = useRef(0);
  const guideAudioRef = useRef(null);
  const characterEchoGateUntilRef = useRef(0);
  const riveRef = useRef(null);
  const rivePlaybackRateRef = useRef(COVER_RIVE_PLAYBACK_RATE);
  const segmenterRef = useRef(null);
  const subjectSegmenterRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const gestureRecognizerRef = useRef(null);
  const gestureTrackerRef = useRef(createGestureTracker());
  const streamRef = useRef(null);
  const pipStreamRef = useRef(null);
  const pipRequestIdRef = useRef(0);
  const voiceSocketRef = useRef(null);
  const voiceAudioGraphRef = useRef(null);
  const voiceIntentionalCloseRef = useRef(false);
  const voiceReadyRef = useRef(false);
  const voiceReadyPromiseRef = useRef(null);
  const voiceReadyResolveRef = useRef(null);
  const voiceSessionGenerationRef = useRef(0);
  const pendingTextRef = useRef(null);
  const textSendingRef = useRef(false);
  const lastTextAttemptRef = useRef(null);
  const speechClearTimerRef = useRef(null);
  const speechTextRef = useRef("");
  const speechBubbleOverlayRef = useRef(null);
  const synthesizedSpeechQueueRef = useRef([]);
  const synthesizedAudioUrlRef = useRef("");
  const welcomeHeadlineTimerRef = useRef(null);
  const mouthAnchorRef = useRef(null);
  const lastFaceSeenAtRef = useRef(0);
  const frameRef = useRef(0);
  const lastRenderAtRef = useRef(0);
  const lastSegmentAtRef = useRef(0);
  const lastSubjectSegmentAtRef = useRef(0);
  const lastFaceAtRef = useRef(0);
  const lastGestureAtRef = useRef(0);
  const visionThrottleRef = useRef(1);
  const maskReadyRef = useRef(false);
  const personPresentRef = useRef(false);
  const personMissingFramesRef = useRef(0);
  const personAbsentSinceRef = useRef(0);
  const personMaskRevisionRef = useRef(0);
  const gestureEffectUntilRef = useRef(0);
  const gestureEffectTimerRef = useRef(null);
  const recordingRef = useRef(false);
  const recorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);
  const recordingDayRef = useRef(paddedDay);
  const recordingCaptionModeRef = useRef(captionMode);
  const recordingCaptionRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const pointerDownRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const autoStopTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const cameraReadyRef = useRef(false);
  const mediaPreviewRef = useRef(null);
  const mediaLibraryRef = useRef([]);
  const gameplayModeRef = useRef("");
  const storyFocusRef = useRef(null);
  const inspectStoryRef = useRef(null);
  const gameplayTargetRef = useRef(null);
  const characterInteractionRef = useRef(null);
  const gameplayFrameCanvasRef = useRef(null);
  const characterDrawRectRef = useRef(null);
  const journalContextRef = useRef(() => ({ entries: [], moments: [] }));
  const startGameplayRef = useRef(null);
  const gameSpeechEpochRef = useRef(0);
  const mediaLibraryOpenRef = useRef(false);
  const mediaLibraryGridRef = useRef(null);
  const mediaLibraryCloseTimerRef = useRef(null);
  const mediaPreviewCloseTimerRef = useRef(null);
  const mediaLibrarySwipeRef = useRef({ active: false, startX: 0, startY: 0, dragY: 0 });
  const mediaPreviewSwipeRef = useRef({ active: false, pointerId: null, startX: 0, startY: 0 });
  const shutterAudioContextRef = useRef(null);
  const uiSfxRef = useRef(null);
  const flashTimerRef = useRef(null);
  const riveAnimationsRef = useRef([]);
  const riveAnimationIndexRef = useRef(0);
  const riveAnimationNameRef = useRef(DEFAULT_RIVE_ANIMATION);
  const riveMouthPlaybackRef = useRef(null);
  const rivePlayPraiseRef = useRef(null);
  const rivePlayAnimationRef = useRef(null);
  const riveMarkCaptureRef = useRef(null);
  const rivePrepareCaptureRef = useRef(null);
  const riveCaptureMomentRef = useRef(null);
  const riveCropXRef = useRef(RIVE_DEFAULT_CROP_X);
  const riveCropTimeoutsRef = useRef([]);
  const riveCharacterEventCleanupRef = useRef(null);
  const riveLoadCharacterRef = useRef(null);
  const jiaojiaoBufferRef = useRef(null);
  const lvdouBufferRef = useRef(null);
  const lvdouLoadPromiseRef = useRef(null);
  const lvdouIdleHandleRef = useRef(null);
  const characterOffsetXRef = useRef(0);
  const characterTransitionFrameRef = useRef(0);
  const characterSwitchingRef = useRef(false);
  const switchCharacterToRef = useRef(null);
  const characterTapCountRef = useRef(0);
  const characterLastTapAtRef = useRef(0);

  const [engineState, setEngineState] = useState("loading");
  const [engineMessage, setEngineMessage] = useState("正在准备叫叫");
  const [loadProgress, setLoadProgress] = useState(2);
  const [riveReady, setRiveReady] = useState(false);
  const [segmenterReady, setSegmenterReady] = useState(false);
  const [faceLandmarkerReady, setFaceLandmarkerReady] = useState(false);
  const [gestureRecognizerReady, setGestureRecognizerReady] = useState(false);
  const [lastRecognizedGesture, setLastRecognizedGesture] = useState("");
  const [activeGestureEffect, setActiveGestureEffect] = useState("");
  const [cameraState, setCameraState] = useState("idle");
  const [cameraError, setCameraError] = useState("");
  const [cameraLensMode, setCameraLensMode] = useState("default");
  const [pipVisible, setPipVisible] = useState(false);
  const [pipOpening, setPipOpening] = useState(false);
  const [voiceState, setVoiceState] = useState("idle");
  const [aiState, setAiState] = useState("idle");
  const [speechText, setSpeechText] = useState("");
  const [characterBubble, setCharacterBubble] = useState(null);
  const [welcomeHeadlineIndex, setWelcomeHeadlineIndex] = useState(0);

  useEffect(() => {
    if (!WAITING_VOICE_LINES[aiState]) return;
    const socket = voiceSocketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    const lines = WAITING_VOICE_LINES[aiState];
    socket.send(JSON.stringify({ type: "local_speech", text: lines[Math.floor(Math.random() * lines.length)] }));
  }, [aiState]);

  const scheduleNextWelcomeHeadline = useCallback(() => {
    if (welcomeHeadlineTimerRef.current) window.clearTimeout(welcomeHeadlineTimerRef.current);
    welcomeHeadlineTimerRef.current = window.setTimeout(() => {
      welcomeHeadlineTimerRef.current = null;
      setWelcomeHeadlineIndex((current) => (current + 1) % WELCOME_HEADLINES.length);
    }, WELCOME_HEADLINE_HOLD_MS);
  }, []);

  useEffect(() => {
    if (cameraState !== "ready") return undefined;
    if (welcomeHeadlineTimerRef.current) window.clearTimeout(welcomeHeadlineTimerRef.current);
    welcomeHeadlineTimerRef.current = null;
    return undefined;
  }, [cameraState]);

  useEffect(() => () => {
    if (welcomeHeadlineTimerRef.current) window.clearTimeout(welcomeHeadlineTimerRef.current);
  }, []);

  useEffect(() => {
    if (isMobileDevice) return undefined;
    let cancelled = false;
    QRCode.toDataURL(shareUrl, {
      width: 288,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#251d08", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrCodeUrl(url);
    }).catch((error) => {
      console.warn("QR code generation failed", error);
    });
    return () => {
      cancelled = true;
    };
  }, [isMobileDevice, shareUrl]);
  const [facingMode, setFacingMode] = useState("user");
  const [frameOrientation, setFrameOrientation] = useState(getViewportOrientation);
  const [riveAnimationName, setRiveAnimationName] = useState(DEFAULT_RIVE_ANIMATION);
  const [riveRendererMode, setRiveRendererMode] = useState(getRiveRendererMode);
  const [activeCharacter, setActiveCharacter] = useState("jiaojiao");
  const [characterSwitching, setCharacterSwitching] = useState(false);
  const [personLayer, setPersonLayer] = useState("behind");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [flashMode, setFlashMode] = useState("");
  const [toast, setToast] = useState("");
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaPreviewClosing, setMediaPreviewClosing] = useState(false);
  const [mediaPreviewDirection, setMediaPreviewDirection] = useState("open");
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [friends, setFriends] = useState([]);
  const [gameplayMode, setGameplayMode] = useState("");
  const [gameplayMenuOpen, setGameplayMenuOpen] = useState(false);
  const [gameplayTranscript, setGameplayTranscript] = useState(null);
  const [gameplayCharacterRect, setGameplayCharacterRect] = useState(null);
  const [libraryTab, setLibraryTab] = useState("days");
  const [textComposerOpen, setTextComposerOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [textSending, setTextSending] = useState(false);
  const [gameplayReaction, setGameplayReaction] = useState(null);
  const [storyFocus, setStoryFocus] = useState(null);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryClosing, setMediaLibraryClosing] = useState(false);
  const [mediaLibraryDragY, setMediaLibraryDragY] = useState(0);
  const [mediaLibraryDragging, setMediaLibraryDragging] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [videoDurations, setVideoDurations] = useState({});
  const frameSize = FRAME_SIZES[frameOrientation];

  const setHiddenStoryFocus = useCallback((next) => {
    storyFocusRef.current = next;
    setStoryFocus(next);
  }, []);

  useEffect(() => {
    mediaPreviewRef.current = mediaPreview;
  }, [mediaPreview]);

  useEffect(() => {
    mediaLibraryRef.current = mediaLibrary;
  }, [mediaLibrary]);

  useEffect(() => {
    mediaLibraryOpenRef.current = mediaLibraryOpen;
  }, [mediaLibraryOpen]);

  useEffect(() => {
    const socket = voiceSocketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "character", character: activeCharacter }));
  }, [activeCharacter]);

  useEffect(() => {
    let cancelled = false;
    loadMediaCaptures().then((captures) => {
      if (cancelled) return;
      const loadedCaptures = captures
        .filter((capture) => capture?.blob instanceof Blob)
        .map((capture) => ({ ...capture, url: URL.createObjectURL(capture.blob) }));
      setMediaLibrary((current) => {
        const currentIds = new Set(current.map(({ id }) => id));
        const uniqueLoaded = loadedCaptures.filter(({ id }) => !currentIds.has(id));
        return [...current, ...uniqueLoaded]
          .sort((left, right) => right.createdAt - left.createdAt)
          .slice(0, MEDIA_LIBRARY_LIMIT);
      });
    }).catch((error) => {
      console.warn("Local media library unavailable", error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearCharacterSpeech = useCallback(() => {
    gameSpeechEpochRef.current += 1;
    synthesizedSpeechQueueRef.current = [];
    guideAudioRef.current?.pause();
    if (synthesizedAudioUrlRef.current) URL.revokeObjectURL(synthesizedAudioUrlRef.current);
    synthesizedAudioUrlRef.current = "";
    window.speechSynthesis?.cancel();
    setCharacterBubble(null);
    setAiState("idle");
  }, []);
  const replaceCharacterBubble = useCallback((text, character = activeCharacter) => {
    const content = String(text || "").trim();
    if (!content) return;
    const rect = characterDrawRectRef.current;
    const canvas = outputCanvasRef.current;
    const anchor = rect && canvas?.width && canvas?.height
      ? {
          x: clamp(rect.mouthX / canvas.width, 0.16, 0.84),
          y: clamp(rect.mouthY / canvas.height, 0.16, 0.72),
        }
      : null;
    // A new key removes the old line before replaying the entrance motion.
    setCharacterBubble({ id: crypto.randomUUID(), text: content, character, tone: "speech", anchor });
  }, [activeCharacter]);
  const speakCharacterFallback = useCallback((text) => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    characterEchoGateUntilRef.current = startCharacterEchoGate();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    const releaseGate = () => {
      characterEchoGateUntilRef.current = endCharacterEchoGate(performance.now());
    };
    utterance.onend = releaseGate;
    utterance.onerror = releaseGate;
    window.speechSynthesis.speak(utterance);
  }, []);
  const handleMemoryChange = useCallback((context, { reset } = {}) => {
    if (reset) clearCharacterSpeech();
    const socket = voiceSocketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    if (reset) socket.send(JSON.stringify({ type: "clear_memory" }));
    socket.send(JSON.stringify({ type: "context", ...context }));
  }, [clearCharacterSpeech]);
  const journal = useDailyJournal({ captures: mediaLibrary, friends, libraryOpen: mediaLibraryOpen,
    sessionActive: cameraState === "ready", onMemoryChange: handleMemoryChange });
  const { entries: conversationEntries, records: conversationSummaries, states: conversationSummaryStates,
    entriesByDay: conversationEntriesByDay, timeline: mediaTimeline, recordMessage: recordConversationMessage } = journal;
  journalContextRef.current = journal.getContext;
  useEffect(() => { let alive = true; loadFriends().then((records) => { if (alive) setFriends(records); }).catch(() => {}); return () => { alive = false; }; }, []);

  useEffect(() => {
    const orientationQuery = window.matchMedia("(orientation: landscape)");
    const syncOrientation = () => {
      setIsTabletDevice(getIsTabletDevice());
      if (!recordingRef.current) setFrameOrientation(getViewportOrientation());
    };

    syncOrientation();
    orientationQuery.addEventListener?.("change", syncOrientation);
    window.addEventListener("orientationchange", syncOrientation);
    window.addEventListener("resize", syncOrientation);
    return () => {
      orientationQuery.removeEventListener?.("change", syncOrientation);
      window.removeEventListener("orientationchange", syncOrientation);
      window.removeEventListener("resize", syncOrientation);
    };
  }, []);

  const showToast = useCallback((message) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2_600);
  }, []);

  const unlockShutterSound = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!shutterAudioContextRef.current || shutterAudioContextRef.current.state === "closed") {
      shutterAudioContextRef.current = new AudioContextClass();
    }
    if (shutterAudioContextRef.current.state === "suspended") {
      shutterAudioContextRef.current.resume().catch(() => {});
    }
    return shutterAudioContextRef.current;
  }, []);

  const unlockInterfaceSounds = useCallback(async () => {
    if (!uiSfxRef.current) {
      uiSfxRef.current = createUISFX({
        pack: "glass",
        preferences: {},
      });
    }
    try {
      await uiSfxRef.current.unlock();
    } catch {
      // Safari can defer audio activation until a later trusted touch.
    }
    return uiSfxRef.current;
  }, []);

  const playInterfaceSound = useCallback((cue) => {
    try {
      uiSfxRef.current?.play(cue);
    } catch {
      // Interface sounds should never block camera controls.
    }
  }, []);

  const playShutterSound = useCallback(() => {
    const context = unlockShutterSound();
    if (!context) return;
    const play = () => {
      try {
      const samples = createShutterSamples(context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      const source = context.createBufferSource();
      const highPass = context.createBiquadFilter();
      const gain = context.createGain();
      highPass.type = "highpass";
      highPass.frequency.value = 620;
      gain.gain.value = 0.28;
      source.buffer = buffer;
      source.connect(highPass);
      highPass.connect(gain);
      gain.connect(context.destination);
      source.start();
      } catch (error) {
        console.warn("Shutter sound unavailable", error);
      }
    };

    if (context.state === "suspended") {
      context.resume().then(play).catch(() => {});
      return;
    }
    play();
  }, [unlockShutterSound]);

  const stopPipCamera = useCallback(() => {
    pipRequestIdRef.current += 1;
    pipStreamRef.current?.getTracks().forEach((track) => track.stop());
    pipStreamRef.current = null;
    if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
    setPipVisible(false);
    setPipOpening(false);
  }, []);

  const startPipCamera = useCallback(async (mainStream = streamRef.current) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, mainInterrupted: false };
    }

    const requestId = pipRequestIdRef.current + 1;
    pipRequestIdRef.current = requestId;
    pipStreamRef.current?.getTracks().forEach((track) => track.stop());
    pipStreamRef.current = null;
    setPipVisible(false);
    setPipOpening(true);
    let pipStream;
    try {
      const pipConstraints = {
        facingMode: { exact: "user" },
        width: { ideal: 720 },
        height: { ideal: 960 },
      };
      pipStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: pipConstraints,
      });
      const preferredCamera = await preferWidestFrontCamera(
        navigator.mediaDevices,
        pipStream,
        pipConstraints,
      );
      pipStream = preferredCamera.stream;
      if (requestId !== pipRequestIdRef.current) {
        pipStream.getTracks().forEach((track) => track.stop());
        return { ok: false, mainInterrupted: false, cancelled: true };
      }

      const pipVideo = pipVideoRef.current;
      if (!pipVideo) throw new Error("Front camera preview is unavailable");
      pipStreamRef.current = pipStream;
      pipVideo.srcObject = pipStream;
      await pipVideo.play();
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      if (mainStream && !hasLiveVideoTrack(mainStream)) {
        const interruption = new Error("Opening the front camera interrupted the rear camera");
        interruption.name = "DualCameraInterruptionError";
        throw interruption;
      }

      const pipTrack = pipStream.getVideoTracks()[0];
      pipTrack?.addEventListener("ended", () => {
        if (pipRequestIdRef.current !== requestId) return;
        pipStreamRef.current = null;
        if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
        setPipVisible(false);
        setPipOpening(false);
      }, { once: true });
      setPipVisible(true);
      return { ok: true, mainInterrupted: false };
    } catch (error) {
      pipStream?.getTracks().forEach((track) => track.stop());
      if (pipStreamRef.current === pipStream) pipStreamRef.current = null;
      if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
      setPipVisible(false);
      const mainInterrupted = error?.name === "DualCameraInterruptionError"
        || Boolean(mainStream && !hasLiveVideoTrack(mainStream));
      console.warn("Front camera picture-in-picture unavailable", error);
      return { ok: false, mainInterrupted, error };
    } finally {
      if (requestId === pipRequestIdRef.current) setPipOpening(false);
    }
  }, []);

  const addMediaCapture = useCallback((capture, { automatic = false } = {}) => {
    const item = {
      ...capture,
      id: createCaptureId(capture.type),
      createdAt: Date.now(),
      url: URL.createObjectURL(capture.blob),
    };
    setMediaLibrary((current) => {
      const next = [item, ...current].slice(0, MEDIA_LIBRARY_LIMIT);
      for (const staleItem of current.slice(MEDIA_LIBRARY_LIMIT - 1)) {
        if (staleItem.url) URL.revokeObjectURL(staleItem.url);
      }
      return next;
    });
    storeMediaCapture(item).catch((error) => {
      console.warn("Capture could not be persisted to the local media library", error);
      showToast("作品已保留在本次相机中");
    });
    showToast(automatic ? "已自动拍下这一刻" : capture.type === "video" ? "短视频已加入作品" : "照片已加入作品");
    return item;
  }, [showToast]);

  const scheduleAutoCapture = useCallback((reason, delay = 360) => {
    if (autoCaptureTimerRef.current) window.clearTimeout(autoCaptureTimerRef.current);
    autoCaptureTimerRef.current = window.setTimeout(() => {
      autoCaptureTimerRef.current = null;
      const now = performance.now();
      if (
        recordingRef.current
        || mediaPreviewRef.current
        || mediaLibraryOpenRef.current
        || now - lastAutoCaptureAtRef.current < 1_200
      ) return;
      lastAutoCaptureAtRef.current = now;
      takePhotoRef.current?.({ automatic: true, reason });
    }, delay);
  }, []);

  const preloadLvdou = useCallback(() => {
    if (lvdouBufferRef.current) return Promise.resolve(lvdouBufferRef.current);
    if (lvdouLoadPromiseRef.current) return lvdouLoadPromiseRef.current;

    lvdouLoadPromiseRef.current = fetch(`${BASE_URL}${CHARACTERS.lvdou.path}`, {
      cache: "force-cache",
      priority: "low",
    }).then((response) => {
      if (!response.ok) throw new Error(`绿豆文件加载失败 (${response.status})`);
      return response.arrayBuffer();
    }).then((buffer) => {
      lvdouBufferRef.current = buffer;
      return buffer;
    }).catch((error) => {
      lvdouLoadPromiseRef.current = null;
      console.warn("绿豆后台加载失败", error);
      throw error;
    });

    return lvdouLoadPromiseRef.current;
  }, []);

  const animateCharacterOffset = useCallback((targetOffset, duration, easing = "enter") => (
    new Promise((resolve) => {
      if (characterTransitionFrameRef.current) {
        window.cancelAnimationFrame(characterTransitionFrameRef.current);
      }
      const startOffset = characterOffsetXRef.current;
      const startedAt = performance.now();
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const activeDuration = reducedMotion ? 1 : duration;

      const tick = (timestamp) => {
        const progress = clamp((timestamp - startedAt) / activeDuration, 0, 1);
        const easedProgress = easing === "exit"
          ? progress ** 3
          : 1 - ((1 - progress) ** 4);
        characterOffsetXRef.current = startOffset
          + (targetOffset - startOffset) * easedProgress;
        if (progress < 1) {
          characterTransitionFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }
        characterTransitionFrameRef.current = 0;
        characterOffsetXRef.current = targetOffset;
        resolve();
      };

      characterTransitionFrameRef.current = window.requestAnimationFrame(tick);
    })
  ), []);

  const unlockVoicePlayback = useCallback(() => {
    const audio = guideAudioRef.current;
    if (!audio) return;
    audio.dataset.voiceKind = "unlock";
    audio.src = SILENT_AUDIO_DATA_URL;
    audio.muted = true;
    const playback = audio.play();
    playback?.then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    }).catch(() => {
      audio.muted = false;
    });
  }, []);

  const playNextSynthesizedSpeech = useCallback(() => {
    const audio = guideAudioRef.current;
    if (!audio || (!audio.paused && audio.dataset.voiceKind === "synthesized")) return;
    const message = synthesizedSpeechQueueRef.current.shift();
    if (!message) {
      setCharacterBubble(null);
      setAiState((current) => current === "thinking" ? current : "idle");
      return;
    }

    if (synthesizedAudioUrlRef.current) URL.revokeObjectURL(synthesizedAudioUrlRef.current);
    let bytes;
    try {
      const decoded = window.atob(String(message.audio || ""));
      bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    } catch (error) {
      console.warn("Synthesized speech could not be decoded", error);
      window.queueMicrotask(playNextSynthesizedSpeech);
      return;
    }
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: message.mime || "audio/mpeg" }));
    synthesizedAudioUrlRef.current = objectUrl;
    audio.pause();
    audio.src = objectUrl;
    audio.volume = 1;
    audio.muted = false;
    audio.dataset.voiceKind = "synthesized";
    audio.dataset.character = message.character || "jiaojiao";
    audio.dataset.opening = message.opening ? "true" : "false";
    audio.dataset.speechText = String(message.text || "");
    if (!message.local && message.text) replaceCharacterBubble(message.text, message.character || activeCharacter);
    setAiState("speaking");
    const playback = audio.play();
    playback?.catch((error) => {
      console.warn("Synthesized speech could not start", error);
      setAiState((current) => current === "thinking" ? current : "idle");
      window.queueMicrotask(playNextSynthesizedSpeech);
    });
  }, [activeCharacter, replaceCharacterBubble]);

  const enqueueSynthesizedSpeech = useCallback((message) => {
    if (!message?.audio) return;
    synthesizedSpeechQueueRef.current.push(message);
    playNextSynthesizedSpeech();
  }, [playNextSynthesizedSpeech]);

  const notifyVoiceInteraction = useCallback((gesture) => {
    const socket = voiceSocketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: "interaction",
      kind: "gesture",
      gesture,
      character: activeCharacter,
    }));
  }, [activeCharacter]);

  const handleGestureResult = useCallback((result, timestamp) => {
    const candidate = classifyCameraGesture(result);
    const update = advanceGestureTracker(gestureTrackerRef.current, candidate, timestamp);
    gestureTrackerRef.current = update.state;
    if (
      !update.trigger
      || mediaPreviewRef.current
      || mediaLibraryOpenRef.current
      || characterSwitchingRef.current
      || gameplayModeRef.current
    ) return;

    const action = GESTURE_ACTIONS[update.trigger];
    if (!action || !rivePlayAnimationRef.current?.(action.animation)) return;
    setLastRecognizedGesture(update.trigger);
    const effectDuration = update.trigger === CAMERA_GESTURES.HEART
      ? HEART_FEEDBACK_DURATION_MS
      : GESTURE_OUTLINE_DURATION_MS;
    if (shouldOutlineGesture(update.trigger) || update.trigger === CAMERA_GESTURES.HEART) {
      gestureEffectUntilRef.current = timestamp + effectDuration;
      setActiveGestureEffect(update.trigger);
      if (gestureEffectTimerRef.current) window.clearTimeout(gestureEffectTimerRef.current);
      gestureEffectTimerRef.current = window.setTimeout(() => {
        gestureEffectTimerRef.current = null;
        gestureEffectUntilRef.current = 0;
        setActiveGestureEffect("");
      }, effectDuration);
      scheduleAutoCapture(`gesture:${update.trigger}`);
    }
    notifyVoiceInteraction(update.trigger);
    showToast(`${CHARACTERS[activeCharacter].label}${action.toast}`);
  }, [activeCharacter, notifyVoiceInteraction, scheduleAutoCapture, showToast]);

  const handleSceneReaction = useCallback((reaction) => {
    const action = VOICE_ACTIONS[reaction.action];
    if (action) rivePlayAnimationRef.current?.(action.animation);
    recordConversationMessage({
      role: "assistant",
      text: reaction.text,
      source: "scene_comment",
      character: reaction.character || activeCharacter,
    });
    replaceCharacterBubble(reaction.text, reaction.character || activeCharacter);
    if (reaction.audio) {
      enqueueSynthesizedSpeech({
        ...reaction,
        opening: false,
      });
    }
  }, [activeCharacter, enqueueSynthesizedSpeech, recordConversationMessage, replaceCharacterBubble]);

  const { visionState: sceneVisionState, sceneReaction } = useCameraSceneAnalysis({
    enabled: cameraState === "ready" && !recording && !mediaPreview && !mediaLibraryOpen && !gameplayMode && !storyFocus,
    videoRef,
    activeCharacter,
    onReaction: handleSceneReaction,
  });

  const contextualCaption = useMemo(() => getContextualCaption({
    gesture: activeGestureEffect,
    sceneReaction,
    characterLabel: CHARACTERS[activeCharacter].label,
    fallbackMode: captionMode,
    day,
  }), [activeCharacter, activeGestureEffect, captionMode, day, sceneReaction]);
  const stopVoiceSession = useCallback(() => {
    voiceSessionGenerationRef.current += 1;
    voiceReadyRef.current = false;
    voiceReadyResolveRef.current?.(null);
    voiceReadyResolveRef.current = null;
    voiceReadyPromiseRef.current = null;
    pendingTextRef.current?.finish(false, "连接已中断，文字还在，可以再试一次。");
    voiceIntentionalCloseRef.current = true;
    const graph = voiceAudioGraphRef.current;
    voiceAudioGraphRef.current = null;
    if (graph) {
      graph.processor.onaudioprocess = null;
      graph.source.disconnect();
      graph.processor.disconnect();
      graph.silent.disconnect();
      graph.context.close().catch(() => {});
    }
    const socket = voiceSocketRef.current;
    voiceSocketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "camera closed");
    if (speechClearTimerRef.current) window.clearTimeout(speechClearTimerRef.current);
    synthesizedSpeechQueueRef.current = [];
    guideAudioRef.current?.pause();
    if (synthesizedAudioUrlRef.current) {
      URL.revokeObjectURL(synthesizedAudioUrlRef.current);
      synthesizedAudioUrlRef.current = "";
    }
    speechTextRef.current = "";
    mouthAnchorRef.current = null;
    setSpeechText("");
    setCharacterBubble(null);
    setVoiceState("idle");
    setAiState("idle");
  }, []);

  const startVoiceSession = useCallback(async (stream, { textOnly = false } = {}) => {
    const audioTrack = textOnly ? null : stream?.getAudioTracks?.()[0];

    stopVoiceSession();
    const generation = voiceSessionGenerationRef.current;
    voiceIntentionalCloseRef.current = false;
    setVoiceState("connecting");

    try {
      let processor = null;
      let inputSampleRate = 16_000;
      if (audioTrack) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is unavailable");
      const context = new AudioContextClass();
      await context.resume();
      if (generation !== voiceSessionGenerationRef.current) { void context.close(); return null; }
      inputSampleRate = context.sampleRate;
      const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
      processor = context.createScriptProcessor(4096, 1, 1);
      const silent = context.createGain();
      silent.gain.value = 0;
      source.connect(processor);
      processor.connect(silent);
      silent.connect(context.destination);
      voiceAudioGraphRef.current = { context, source, processor, silent };
      }

      const socket = new WebSocket(getVoiceSocketUrl());
      socket.binaryType = "arraybuffer";
      voiceSocketRef.current = socket;
      let readyTimer = null;
      let finishedReady = false;
      const readyPromise = new Promise((resolve) => {
        voiceReadyResolveRef.current = (value) => {
          if (finishedReady) return;
          finishedReady = true;
          if (readyTimer) window.clearTimeout(readyTimer);
          resolve(value);
        };
      });
      const settleReady = voiceReadyResolveRef.current;
      voiceReadyPromiseRef.current = readyPromise;
      readyTimer = window.setTimeout(() => {
        settleReady(null);
        if (voiceSocketRef.current === socket) {
          voiceReadyRef.current = false;
          setVoiceState("unavailable");
          socket.close(1000, "session readiness timeout");
        }
      }, 12_000);
      if (processor) processor.onaudioprocess = (event) => {
        if (socket.readyState !== WebSocket.OPEN || isCharacterEchoGateActive(characterEchoGateUntilRef.current, performance.now())) return;
        const samples = event.inputBuffer.getChannelData(0);
        const pcm = downsampleToPcm16(samples, inputSampleRate);
        if (pcm.byteLength) socket.send(pcm.buffer);
      };

      socket.addEventListener("open", () => {
        if (voiceSocketRef.current !== socket) return;
        socket.send(JSON.stringify({
          type: "start",
          inputMode: audioTrack ? "voice" : "text",
          sampleRate: 16_000,
          language: "zh-CN",
          character: activeCharacter,
        }));
        socket.send(JSON.stringify({ type: "context", ...journalContextRef.current() }));
        socket.send(JSON.stringify({ type: "interaction_mode", mode: gameplayModeRef.current || "none" }));
      });
      socket.addEventListener("message", (event) => {
        if (voiceSocketRef.current !== socket) return;
        if (typeof event.data !== "string") return;
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === "ready") {
          voiceReadyRef.current = true;
          settleReady(socket);
          setVoiceState("listening");
          return;
        }
        if (message.type === "transcript") {
          if (isCharacterEchoGateActive(characterEchoGateUntilRef.current, performance.now())) return;
          const text = String(message.text || "").trim().slice(0, 1000);
          if (!text) return;
          if (!message.final) setAiState("recognizing");
          // Keep listening while the character speaks. Once ASR hears a real
          // partial utterance, stop the old audio and abandon its unfinished turn.
          // Browser echo cancellation keeps the synthesized voice from becoming
          // a transcript on supported devices; two characters avoids reacting to
          // a one-syllable echo artifact.
          const activeAudio = guideAudioRef.current;
          if (!message.final && text.length >= 2 && activeAudio?.dataset.voiceKind === "synthesized" && !activeAudio.paused) {
            clearCharacterSpeech();
            socket.send(JSON.stringify({ type: "cancel" }));
          }
          if (message.final) {
            if (message.clientMessageId && pendingTextRef.current?.id === message.clientMessageId) pendingTextRef.current.finish(true);
            if (/^(?:没有|没找到|不找了|不想找|算了|先不看了)[。！!，, ]*$/.test(text)) {
              setHiddenStoryFocus(null);
            } else if (["waiting", "framing"].includes(storyFocusRef.current?.phase)) {
              inspectStoryRef.current?.();
            }
            recordConversationMessage({ ...message, role: "user", text, source: "child_speech", character: activeCharacter });
          }
          speechTextRef.current = text.slice(0, 42);
          setSpeechText(text.slice(0, 42));
          if (speechClearTimerRef.current) window.clearTimeout(speechClearTimerRef.current);
          speechClearTimerRef.current = window.setTimeout(() => {
            speechTextRef.current = "";
            setSpeechText("");
          }, message.final ? 3_600 : 2_400);
          return;
        }
        if (message.type === "action") {
          if (gameplayModeRef.current) return;
          const action = VOICE_ACTIONS[message.action];
          if (!action || !rivePlayAnimationRef.current?.(action.animation)) return;
          showToast(action.toast);
          scheduleAutoCapture(`voice:${message.action}`, 420);
          return;
        }
        if (message.type === "story") {
          if (message.thread === "inspect") setHiddenStoryFocus({ phase: "waiting" });
          return;
        }
        if (message.type === "character_switch") {
          const requestedCharacter = CHARACTERS[message.character] ? message.character : null;
          if (requestedCharacter) void switchCharacterToRef.current?.(requestedCharacter);
          return;
        }
        if (message.type === "ai") {
          setAiState(["recognizing", "thinking", "speaking", "unavailable"].includes(message.state) ? message.state : "idle");
          return;
        }
        if (message.type === "speech") {
          if (gameplayModeRef.current && !message.local) return;
          if (!message.opening && !message.local) {
            recordConversationMessage({
              role: "assistant",
              text: message.text,
              character: message.character || activeCharacter,
            });
          }
          enqueueSynthesizedSpeech(message);
          return;
        }
        if (message.type === "error") {
          if (message.clientMessageId && pendingTextRef.current?.id === message.clientMessageId) pendingTextRef.current.finish(false, message.message);
          if (!["TEXT_RATE_LIMIT", "TURN_QUEUE_FULL", "INVALID_TEXT", "LOCAL_SPEECH_RATE_LIMIT"].includes(message.code)) setVoiceState("unavailable");
          showToast(message.message || "语音识别暂时不可用");
          if (message.code === "ASR_UNAVAILABLE" && audioTrack) void startVoiceSession(stream, { textOnly: true });
        }
      });
      socket.addEventListener("error", () => {
        if (voiceSocketRef.current !== socket) return;
        voiceReadyRef.current = false;
        settleReady(null);
        pendingTextRef.current?.finish(false, "连接没有成功，文字还在，可以再试一次。");
        setVoiceState("unavailable");
      });
      socket.addEventListener("close", () => {
        if (voiceSocketRef.current !== socket) return;
        voiceReadyRef.current = false;
        settleReady(null);
        pendingTextRef.current?.finish(false, "连接已断开，文字还在，可以再试一次。");
        if (!voiceIntentionalCloseRef.current) setVoiceState("unavailable");
      });
      return readyPromise;
    } catch (error) {
      if (generation !== voiceSessionGenerationRef.current) return null;
      console.warn("Voice session unavailable", error);
      setVoiceState("unavailable");
      if (audioTrack) return startVoiceSession(stream, { textOnly: true });
      return null;
    }
  }, [activeCharacter, clearCharacterSpeech, enqueueSynthesizedSpeech, recordConversationMessage, scheduleAutoCapture, setHiddenStoryFocus, showToast, stopVoiceSession]);

  const updateMask = useCallback((result) => {
    const masks = result.confidenceMasks;
    if (!masks?.length) return;

    const labels = segmenterRef.current?.getLabels?.() || [];
    const personIndex = labels.findIndex((label) => /person|selfie|human/i.test(label));
    const mask = masks[personIndex >= 0 ? personIndex : masks.length - 1];
    const values = mask.getAsFloat32Array();
    const personPresent = hasConfidentMaskArea(values, PERSON_MASK_THRESHOLD, PERSON_MIN_MASK_RATIO);
    personPresentRef.current = personPresent;
    if (!personPresent) {
      personMissingFramesRef.current += 1;
      if (personMissingFramesRef.current === 1) personAbsentSinceRef.current = performance.now();
      if (personMissingFramesRef.current >= PERSON_MISSING_FRAME_LIMIT) maskReadyRef.current = false;
      return;
    }
    personMissingFramesRef.current = 0;
    personAbsentSinceRef.current = 0;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    if (maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) {
      maskCanvas.width = mask.width;
      maskCanvas.height = mask.height;
    }

    const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
    const imageData = maskContext.createImageData(mask.width, mask.height);

    for (let index = 0; index < values.length; index += 1) {
      const offset = index * 4;
      imageData.data[offset] = 255;
      imageData.data[offset + 1] = 255;
      imageData.data[offset + 2] = 255;
      imageData.data[offset + 3] = values[index] >= PERSON_MASK_THRESHOLD ? 255 : 0;
    }

    maskContext.putImageData(imageData, 0, 0);
    maskReadyRef.current = true;
    personMaskRevisionRef.current += 1;
  }, []);

  const updateSubjectMask = useCallback((result) => {
    if (personPresentRef.current) return;
    const categoryMask = result.categoryMask;
    if (!categoryMask) return;
    const values = categoryMask.getAsUint8Array();
    const labels = subjectSegmenterRef.current?.getLabels?.() || [];
    const backgroundIndex = getBackgroundCategoryIndex(labels);
    if (!hasSegmentedSubject(values, backgroundIndex)) {
      maskReadyRef.current = false;
      return;
    }

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    if (maskCanvas.width !== categoryMask.width || maskCanvas.height !== categoryMask.height) {
      maskCanvas.width = categoryMask.width;
      maskCanvas.height = categoryMask.height;
    }
    const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });
    const imageData = maskContext.createImageData(categoryMask.width, categoryMask.height);
    for (let index = 0; index < values.length; index += 1) {
      const offset = index * 4;
      imageData.data[offset] = 255;
      imageData.data[offset + 1] = 255;
      imageData.data[offset + 2] = 255;
      imageData.data[offset + 3] = values[index] === backgroundIndex ? 0 : 255;
    }
    maskContext.putImageData(imageData, 0, 0);
    maskReadyRef.current = true;
    personMaskRevisionRef.current += 1;
  }, []);

  const updateMouthAnchor = useCallback((result) => {
    const landmarks = result?.faceLandmarks?.[0];
    const outputCanvas = outputCanvasRef.current;
    const video = videoRef.current;
    if (!landmarks?.length || !outputCanvas || !video?.videoWidth) {
      if (performance.now() - lastFaceSeenAtRef.current > FACE_MISSING_TIMEOUT_MS) {
        mouthAnchorRef.current = null;
      }
      return;
    }

    const mouthPoints = [13, 14, 61, 291].map((index) => landmarks[index]).filter(Boolean);
    const eyePoints = [33, 133, 362, 263].map((index) => landmarks[index]).filter(Boolean);
    if (!mouthPoints.length || !eyePoints.length) return;
    const normalizedX = mouthPoints.reduce((sum, point) => sum + point.x, 0) / mouthPoints.length;
    const normalizedY = mouthPoints.reduce((sum, point) => sum + point.y, 0) / mouthPoints.length;
    const normalizedEyeY = eyePoints.reduce((sum, point) => sum + point.y, 0) / eyePoints.length;
    const targetWidth = outputCanvas.width;
    const targetHeight = outputCanvas.height;
    const rect = getCoverRect(video.videoWidth, video.videoHeight, targetWidth, targetHeight);
    const unmirroredX = rect.x + normalizedX * rect.width;
    const displayX = shouldMirrorCamera(facingMode) ? targetWidth - unmirroredX : unmirroredX;
    const next = {
      x: clamp(displayX / targetWidth, 0.02, 0.98),
      y: clamp((rect.y + normalizedY * rect.height) / targetHeight, 0.02, 0.98),
      eyeY: clamp((rect.y + normalizedEyeY * rect.height) / targetHeight, 0.02, 0.98),
    };
    const current = mouthAnchorRef.current;
    mouthAnchorRef.current = current
      ? {
          x: current.x * 0.55 + next.x * 0.45,
          y: current.y * 0.55 + next.y * 0.45,
          eyeY: current.eyeY * 0.55 + next.eyeY * 0.45,
        }
      : next;
    lastFaceSeenAtRef.current = performance.now();
  }, [facingMode]);

  const drawSpeechBubble = useCallback((context, targetWidth, targetHeight, includeCanvasText = true) => {
    const text = speechTextRef.current;
    const anchor = mouthAnchorRef.current;
    const overlay = speechBubbleOverlayRef.current;
    if (!text || (!anchor && facingMode !== "environment")) {
      if (overlay) overlay.hidden = true;
      return;
    }

    const {
      fontSize,
      maxBubbleWidth,
      horizontalPadding,
      verticalPadding,
    } = getUserSpeechBubbleSizing({ targetWidth, targetHeight, isTabletDevice });
    context.save();
    context.font = `700 ${fontSize}px "Mohr Rounded", "PingFang SC", sans-serif`;
    const maxTextWidth = maxBubbleWidth - horizontalPadding * 2;
    const lines = splitBubbleText(context, text, maxTextWidth);
    const measuredTextWidth = Math.max(
      fontSize,
      ...lines.map((line) => context.measureText(line).width),
    );
    const bubbleWidth = clamp(
      measuredTextWidth + horizontalPadding * 2,
      fontSize * 3.2,
      maxBubbleWidth,
    );
    const textWidth = bubbleWidth - horizontalPadding * 2;
    const lineHeight = fontSize * 1.12;
    const bubbleHeight = Math.max(fontSize * 2.15, lines.length * lineHeight + verticalPadding * 2);
    const tailHeight = fontSize * 0.4;
    const tailWidth = tailHeight * 2;
    const placement = getUserSpeechBubblePlacement({
      facingMode,
      anchor,
      targetWidth,
      targetHeight,
      bubbleWidth,
      bubbleHeight,
      tailHeight,
      fontSize,
    });
    if (!placement) {
      if (overlay) overlay.hidden = true;
      context.restore();
      return;
    }
    const { bubbleX, bubbleY } = placement;
    const left = bubbleX - bubbleWidth / 2;
    const top = bubbleY - bubbleHeight / 2;
    const bottom = top + bubbleHeight;
    if (overlay) {
      const outputCanvas = outputCanvasRef.current;
      const displayScaleX = (outputCanvas?.clientWidth || targetWidth) / targetWidth;
      const displayScaleY = (outputCanvas?.clientHeight || targetHeight) / targetHeight;
      const textDisplayScale = isTabletDevice
        ? Math.min(displayScaleX, displayScaleY)
        : displayScaleY;
      overlay.style.left = `${bubbleX * displayScaleX}px`;
      overlay.style.top = `${bubbleY * displayScaleY}px`;
      overlay.style.width = `${bubbleWidth * displayScaleX}px`;
      overlay.style.height = `${bubbleHeight * displayScaleY}px`;
      overlay.style.paddingInline = `${horizontalPadding * displayScaleX}px`;
      overlay.style.paddingBlock = isTabletDevice ? `${verticalPadding * displayScaleY}px` : "";
      overlay.style.fontSize = `${fontSize * textDisplayScale}px`;
      overlay.style.setProperty("--speech-tail-width", `${tailWidth * displayScaleX}px`);
      overlay.style.setProperty("--speech-tail-height", `${tailHeight * displayScaleY}px`);
      overlay.hidden = includeCanvasText;
    }
    if (!includeCanvasText) {
      context.restore();
      return;
    }
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(0, 0, 0, 0.2)";
    context.shadowBlur = 14;
    drawSpeechSemicircle(context, {
      centerX: bubbleX,
      edgeY: bottom - 1,
      height: tailHeight,
      width: tailWidth,
    });

    roundedRectPath(context, left, top, bubbleWidth, bubbleHeight, bubbleHeight / 2);
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(0, 0, 0, 0.2)";
    context.shadowBlur = 14;
    context.fill();
    context.shadowColor = "transparent";
    if (includeCanvasText) {
      context.fillStyle = "#111111";
      context.textAlign = "center";
      context.textBaseline = "middle";
      lines.forEach((line, index) => {
        const y = bubbleY + (index - (lines.length - 1) / 2) * lineHeight;
        context.fillText(line, bubbleX, y, textWidth);
      });
    }

    context.restore();
  }, [facingMode, isTabletDevice]);

  const drawCaption = useCallback((context, targetWidth, targetHeight) => {
    const activeCaption = recordingRef.current && recordingCaptionRef.current
      ? recordingCaptionRef.current
      : contextualCaption;
    const centerX = targetWidth / 2;
    const isLandscape = targetHeight < targetWidth;
    const portraitCaptionScale = isLandscape ? 1 : 1.25;
    const verticalOffset = targetHeight * CAPTION_VERTICAL_OFFSET_RATIO;
    const firstLineY = (isLandscape ? 48 : 104) + verticalOffset;
    const dayLineY = (isLandscape ? 108 : 172) + verticalOffset;
    const labelFontSize = (isLandscape ? 35 : 33) * portraitCaptionScale;
    const dayLabelFontSize = labelFontSize * 1.25;
    const numberFontSize = (isLandscape ? 64 : 60) * 1.25 * portraitCaptionScale;
    const gap = 8 * portraitCaptionScale;
    const labelFont = `700 ${labelFontSize}px "Mohr Rounded", "PingFang SC", sans-serif`;
    const dayLabelFont = `700 ${dayLabelFontSize}px "Mohr Rounded", "PingFang SC", sans-serif`;
    const numberFont = `700 ${numberFontSize}px "Mohr Rounded", "PingFang SC", sans-serif`;

    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";

    context.font = labelFont;
    context.lineWidth = 10 * portraitCaptionScale;
    context.strokeStyle = "rgba(20, 22, 15, 0.52)";
    context.strokeText(activeCaption.firstLine, centerX, firstLineY);
    context.fillStyle = "#f8f8f1";
    context.fillText(activeCaption.firstLine, centerX, firstLineY);

    if (activeCaption.kind === "subject") {
      const subjectFontSize = (isLandscape ? 56 : 52) * portraitCaptionScale;
      let subjectFont = `700 ${subjectFontSize}px "Mohr Rounded", "PingFang SC", sans-serif`;
      context.font = subjectFont;
      const measuredWidth = context.measureText(activeCaption.secondLine).width;
      if (measuredWidth > targetWidth * 0.86) {
        subjectFont = `700 ${subjectFontSize * ((targetWidth * 0.86) / measuredWidth)}px "Mohr Rounded", "PingFang SC", sans-serif`;
        context.font = subjectFont;
      }
      context.lineWidth = 12 * portraitCaptionScale;
      context.strokeStyle = "rgba(20, 22, 15, 0.52)";
      context.strokeText(activeCaption.secondLine, centerX, dayLineY);
      context.fillStyle = "#ffd84d";
      context.fillText(activeCaption.secondLine, centerX, dayLineY);
      context.restore();
      return;
    }

    context.textAlign = "left";
    context.font = dayLabelFont;
    const dayPrefixWidth = context.measureText(activeCaption.dayPrefix).width;
    const suffixWidth = context.measureText(activeCaption.suffix).width;
    context.font = numberFont;
    const numberWidth = context.measureText(activeCaption.day).width;
    let cursorX = centerX - ((dayPrefixWidth + numberWidth + suffixWidth + gap * 2) / 2);

    const drawDayLabel = (copy) => {
      context.font = dayLabelFont;
      context.lineWidth = 11 * portraitCaptionScale;
      context.strokeStyle = "rgba(20, 22, 15, 0.52)";
      context.strokeText(copy, cursorX, dayLineY);
      context.fillStyle = "#f8f8f1";
      context.fillText(copy, cursorX, dayLineY);
      cursorX += context.measureText(copy).width;
    };

    drawDayLabel(activeCaption.dayPrefix);
    cursorX += gap;
    context.font = numberFont;
    context.lineWidth = (activeCaption.mode === "streak" ? 14 : 11) * portraitCaptionScale;
    context.strokeStyle = activeCaption.mode === "streak" ? "#fffdf8" : "rgba(20, 22, 15, 0.52)";
    context.strokeText(activeCaption.day, cursorX, dayLineY);
    context.fillStyle = activeCaption.mode === "streak" ? "#ef3f37" : "#ffd84d";
    context.fillText(activeCaption.day, cursorX, dayLineY);
    cursorX += numberWidth + gap;
    drawDayLabel(activeCaption.suffix);
    context.restore();
  }, [contextualCaption]);

  const drawRiveLayer = useCallback((outputContext, outputCanvas, welcomeMode = false, riveCanvasOverride = null) => {
    const riveCanvas = riveCanvasOverride || riveCanvasRef.current;
    const targetWidth = outputCanvas.width;
    const targetHeight = outputCanvas.height;

    if (riveReady && riveCanvas?.width && riveCanvas?.height) {
      const displayWidth = outputCanvas.clientWidth || targetWidth;
      const displayHeight = outputCanvas.clientHeight || targetHeight;
      const displayScale = Math.max(displayWidth / targetWidth, displayHeight / targetHeight);
      const visibleTargetWidth = Math.min(targetWidth, displayWidth / displayScale);
      const baseScale = Math.min(
        (targetHeight * RIVE_SCALE) / RIVE_VISIBLE_SOURCE.height,
        visibleTargetWidth / RIVE_VISIBLE_SOURCE.width,
      );
      const isPortraitWelcome = welcomeMode && targetHeight > targetWidth;
      const isDesktopLandscape = !isMobileDevice && targetWidth > targetHeight;
      const orientationMultiplier = targetWidth > targetHeight ? RIVE_LANDSCAPE_MULTIPLIER : 1;
      const welcomeMultiplier = isPortraitWelcome ? 1.45 : 1;
      const preferredScale = baseScale
        * RIVE_DISPLAY_MULTIPLIER
        * orientationMultiplier
        * welcomeMultiplier
        * getCharacterScaleMultiplier(isTabletDevice);
      const desktopSafeScale = (
        visibleTargetWidth * (1 + CHARACTER_LEFT_OVERFLOW_RATIO)
      ) / RIVE_VISIBLE_SOURCE.width;
      const scale = isDesktopLandscape
        ? Math.min(preferredScale, desktopSafeScale)
        : preferredScale;
      const riveWidth = RIVE_VISIBLE_SOURCE.width * scale;
      const riveHeight = RIVE_VISIBLE_SOURCE.height * scale;
      const riveX = -visibleTargetWidth * CHARACTER_LEFT_OVERFLOW_RATIO + characterOffsetXRef.current;
      const riveY = targetHeight - riveHeight - (isPortraitWelcome ? targetHeight * 0.12 : 0);
      const cropDisplayX = 0; // The camera canvas uses object-position: left bottom.
      const cropDisplayY = targetHeight * displayScale - displayHeight;
      const anchor = characterInteractionRef.current?.getMouthAnchor?.();
      const mouthSourceX = anchor ? anchor.x * RIVE_SOURCE_SIZE.width : (riveCropXRef.current + RIVE_VISIBLE_SOURCE.width * 0.53);
      const mouthSourceY = anchor ? anchor.y * RIVE_SOURCE_SIZE.height : (RIVE_VISIBLE_SOURCE.y + RIVE_VISIBLE_SOURCE.height * 0.44);
      characterDrawRectRef.current = {
        x: riveX * displayScale - cropDisplayX, y: riveY * displayScale - cropDisplayY,
        width: riveWidth * displayScale, height: riveHeight * displayScale,
        mouthX: (riveX + (mouthSourceX - riveCropXRef.current) * scale) * displayScale - cropDisplayX,
        mouthY: (riveY + (mouthSourceY - RIVE_VISIBLE_SOURCE.y) * scale) * displayScale - cropDisplayY,
      };
      outputContext.drawImage(
        riveCanvas,
        riveCropXRef.current,
        RIVE_VISIBLE_SOURCE.y,
        RIVE_VISIBLE_SOURCE.width,
        RIVE_VISIBLE_SOURCE.height,
        riveX,
        riveY,
        riveWidth,
        riveHeight,
      );
    }
  }, [isMobileDevice, isTabletDevice, riveReady]);

  const renderWelcomeFrame = useCallback(() => {
    const outputCanvas = outputCanvasRef.current;
    if (!outputCanvas) return;
    const outputContext = outputCanvas.getContext("2d", { alpha: false });
    outputContext.fillStyle = "#211c10";
    outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    drawRiveLayer(outputContext, outputCanvas, true);
  }, [drawRiveLayer]);

  const drawFrontCameraPip = useCallback((context, targetWidth, targetHeight) => {
    const pipVideo = pipVideoRef.current;
    if (!pipVisible || !pipVideo || pipVideo.readyState < 2) return;
    const pipRect = getFrontCameraPipRect(targetWidth, targetHeight);
    const sourceWidth = pipVideo.videoWidth || 720;
    const sourceHeight = pipVideo.videoHeight || 960;
    const coverRect = getCoverRect(sourceWidth, sourceHeight, pipRect.width, pipRect.height);
    const borderWidth = Math.max(4, Math.round(pipRect.width * 0.025));

    context.save();
    context.shadowColor = "rgba(10, 8, 3, 0.34)";
    context.shadowBlur = Math.max(14, Math.round(pipRect.width * 0.09));
    roundedRectPath(
      context,
      pipRect.x - borderWidth,
      pipRect.y - borderWidth,
      pipRect.width + borderWidth * 2,
      pipRect.height + borderWidth * 2,
      pipRect.radius + borderWidth,
    );
    context.fillStyle = "#ffd84d";
    context.fill();
    context.restore();

    context.save();
    roundedRectPath(context, pipRect.x, pipRect.y, pipRect.width, pipRect.height, pipRect.radius);
    context.clip();
    context.translate(pipRect.x + pipRect.width, pipRect.y);
    context.scale(-1, 1);
    context.drawImage(
      pipVideo,
      coverRect.x,
      coverRect.y,
      coverRect.width,
      coverRect.height,
    );
    context.restore();
  }, [pipVisible]);

  const renderFrame = useCallback((
    includeCaption = recordingRef.current,
    riveCanvasOverride = null,
    includeSpeechText = true,
  ) => {
    const video = videoRef.current;
    const outputCanvas = outputCanvasRef.current;
    const foregroundCanvas = foregroundCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;

    if (!video || !outputCanvas || !foregroundCanvas || video.readyState < 2) return;
    const outputContext = outputCanvas.getContext("2d", { alpha: false });
    const foregroundContext = foregroundCanvas.getContext("2d");
    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const targetWidth = outputCanvas.width;
    const targetHeight = outputCanvas.height;
    const rect = getCoverRect(sourceWidth, sourceHeight, targetWidth, targetHeight);
    const timestamp = performance.now();
    const mirrored = shouldMirrorCamera(facingMode);

    outputContext.fillStyle = "#181b14";
    outputContext.fillRect(0, 0, targetWidth, targetHeight);
    drawCameraSource(outputContext, video, rect, targetWidth, mirrored);

    if (activeGestureEffect === CAMERA_GESTURES.HEART && timestamp < gestureEffectUntilRef.current) {
      drawHeartFeedback(outputContext, targetWidth, targetHeight, HEART_FEEDBACK_DURATION_MS - (gestureEffectUntilRef.current - timestamp));
    }

    const drawPerson = () => {
      if (!maskReadyRef.current || !maskCanvas?.width || !maskCanvas?.height) return;
      if (timestamp < gestureEffectUntilRef.current) {
        if (!gestureOutlineBuffersRef.current) {
          gestureOutlineBuffersRef.current = createGestureOutlineBuffers();
        }
        drawGestureOutline(
          outputContext,
          gestureOutlineBuffersRef.current,
          maskCanvas,
          rect,
          targetWidth,
          targetHeight,
          personMaskRevisionRef.current,
          timestamp,
          mirrored,
        );
      }
      foregroundContext.clearRect(0, 0, targetWidth, targetHeight);
      foregroundContext.globalCompositeOperation = "source-over";
      foregroundContext.drawImage(video, rect.x, rect.y, rect.width, rect.height);
      foregroundContext.save();
      foregroundContext.globalCompositeOperation = "destination-in";
      foregroundContext.imageSmoothingEnabled = false;
      if ("filter" in foregroundContext) {
        foregroundContext.filter = `blur(${PERSON_FEATHER_RANGE_PX / 2}px)`;
      }
      foregroundContext.drawImage(maskCanvas, rect.x, rect.y, rect.width, rect.height);
      foregroundContext.restore();
      drawCameraSource(outputContext, foregroundCanvas, {
        x: 0,
        y: 0,
        width: targetWidth,
        height: targetHeight,
      }, targetWidth, mirrored);
    };

    if (personLayer === "behind") drawPerson();

    drawRiveLayer(outputContext, outputCanvas, false, riveCanvasOverride);

    if (personLayer === "front") drawPerson();

    drawFrontCameraPip(outputContext, targetWidth, targetHeight);
    if (includeCaption) drawCaption(outputContext, targetWidth, targetHeight);
    drawSpeechBubble(outputContext, targetWidth, targetHeight, includeSpeechText);
    if (includeSpeechText) {
      drawCharacterCaption(
        outputContext,
        characterBubble?.text,
        targetWidth,
        targetHeight,
        { isTabletDevice },
      );
    }
  }, [characterBubble, drawCaption, drawFrontCameraPip, drawRiveLayer, drawSpeechBubble, facingMode, isTabletDevice, personLayer]);

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      try {
        setEngineState("loading");
        setEngineMessage("正在下载叫叫和人像模型");
        let activeRiveRendererMode = riveRendererMode;
        const configureRiveRuntime = (rendererMode) => {
          const runtimeKey = rendererMode === "canvas" ? "canvas" : "webgl2";
          const runtime = RIVE_RUNTIMES[runtimeKey];
          const runtimeAssets = RIVE_RUNTIME_ASSETS[runtimeKey];
          runtime.RuntimeLoader.setWasmUrl(`${BASE_URL}${runtimeAssets[0].path}`);
          runtime.RuntimeLoader.setWasmFallbackUrl(`${BASE_URL}${runtimeAssets[1].path}`);
          return runtime;
        };
        configureRiveRuntime(activeRiveRendererMode);
        const loadAssets = getLoadAssets(activeRiveRendererMode);
        const loadTotalBytes = loadAssets.reduce((total, asset) => total + asset.bytes, 0);

        const loadedByKey = Object.fromEntries(loadAssets.map((asset) => [asset.key, 0]));
        const onProgress = (key, loaded) => {
          loadedByKey[key] = loaded;
          const totalLoaded = Object.values(loadedByKey).reduce((total, value) => total + value, 0);
          const percent = Math.round(3 + (totalLoaded / loadTotalBytes) * 78);
          if (!cancelled) setLoadProgress(clamp(percent, 3, 81));
        };

        const downloads = await Promise.all(loadAssets.map((asset) => fetchAsset(asset, onProgress)));
        if (cancelled) return;
        const riveBuffer = downloads[loadAssets.findIndex((asset) => asset.key === "riveFile")];
        const modelBuffer = downloads[loadAssets.findIndex((asset) => asset.key === "segmentModel")];
        const subjectModelBuffer = downloads[loadAssets.findIndex((asset) => asset.key === "subjectModel")];
        const faceModelBuffer = downloads[loadAssets.findIndex((asset) => asset.key === "faceModel")];
        const gestureModelBuffer = downloads[loadAssets.findIndex((asset) => asset.key === "gestureModel")];

        setLoadProgress(84);
        setEngineMessage("正在唤醒叫叫");

        const loadRiveCharacter = (characterBuffer) => new Promise((resolve) => {
          riveCropTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
          riveCropTimeoutsRef.current = [];
          riveCropXRef.current = RIVE_DEFAULT_CROP_X;
          setRiveReady(false);
          const runtime = configureRiveRuntime(activeRiveRendererMode);
          const {
            Rive: RiveClass,
            Layout: RiveLayout,
            Fit: RiveFit,
            Alignment: RiveAlignment,
            EventType: RiveEventType,
          } = runtime;
          const useOffscreenRenderer = activeRiveRendererMode === "webgl2-offscreen";
          const existingInstance = riveRef.current;
          if (existingInstance) {
            characterInteractionRef.current?.dispose();
            characterInteractionRef.current = null;
            riveCharacterEventCleanupRef.current?.();
            riveCharacterEventCleanupRef.current = null;
            let settled = false;
            const finish = (loaded) => {
              if (settled) return;
              settled = true;
              existingInstance.off(RiveEventType.Load, handleLoad);
              existingInstance.off(RiveEventType.LoadError, handleLoadError);
              resolve(loaded);
            };
            const handleLoad = () => finish(true);
            const handleLoadError = () => finish(false);
            existingInstance.on(RiveEventType.Load, handleLoad);
            existingInstance.on(RiveEventType.LoadError, handleLoadError);
            try {
              existingInstance.load({
                buffer: characterBuffer,
                autoplay: false,
                useOffscreenRenderer,
              });
            } catch (error) {
              console.warn("Rive character reload failed", error);
              finish(false);
            }
            return;
          }
          const instance = new RiveClass({
            buffer: characterBuffer,
            canvas: riveCanvasRef.current,
            autoplay: false,
            useOffscreenRenderer,
            layout: new RiveLayout({ fit: RiveFit.Contain, alignment: RiveAlignment.BottomCenter }),
            onLoad: () => {
              if (cancelled) {
                instance.cleanup();
                resolve(false);
                return;
              }
              characterInteractionRef.current?.dispose();
              characterInteractionRef.current = createCharacterInteraction(instance);
              characterInteractionRef.current.install();
              const animations = instance.animationNames || [];
              const talkingAnimations = animations.filter((name) => (
                name.startsWith("TalkingEmotion") && !name.endsWith("表情")
              ));
              const animationOrder = [...new Set([
                DEFAULT_RIVE_ANIMATION,
                SECOND_RIVE_ANIMATION,
                CLICK_RIVE_ANIMATION,
                CHARACTER_TIMELINES.HEART_FULL_BODY,
                ...talkingAnimations,
              ])].filter((name) => animations.includes(name));
              riveAnimationsRef.current = animationOrder;
              riveAnimationIndexRef.current = 0;

              const analysisCanvas = document.createElement("canvas");
              analysisCanvas.width = RIVE_ANALYSIS_SIZE.width;
              analysisCanvas.height = RIVE_ANALYSIS_SIZE.height;
              const analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });

              const scheduleCropAnalysis = () => {
                riveCropTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
                riveCropTimeoutsRef.current = [];
                let unionMinX = RIVE_SOURCE_SIZE.width;
                let unionMaxX = -1;

                const analyze = () => {
                  const riveCanvas = riveCanvasRef.current;
                  if (cancelled || !analysisContext || !riveCanvas?.width) return;
                  analysisContext.clearRect(0, 0, analysisCanvas.width, analysisCanvas.height);
                  analysisContext.drawImage(riveCanvas, 0, 0, analysisCanvas.width, analysisCanvas.height);
                  const pixels = analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height).data;
                  let minX = analysisCanvas.width;
                  let maxX = -1;

                  for (let y = 0; y < analysisCanvas.height; y += 2) {
                    for (let x = 0; x < analysisCanvas.width; x += 1) {
                      if (pixels[(y * analysisCanvas.width + x) * 4 + 3] <= 8) continue;
                      minX = Math.min(minX, x);
                      maxX = Math.max(maxX, x);
                    }
                  }

                  if (maxX < 0) return;
                  const sourceScale = RIVE_SOURCE_SIZE.width / analysisCanvas.width;
                  unionMinX = Math.min(unionMinX, minX * sourceScale);
                  unionMaxX = Math.max(unionMaxX, maxX * sourceScale);
                  const maxCropX = RIVE_SOURCE_SIZE.width - RIVE_VISIBLE_SOURCE.width;
                  const leftAlignedX = unionMinX - RIVE_EDGE_PADDING;
                  const rightSafeX = unionMaxX + RIVE_EDGE_PADDING - RIVE_VISIBLE_SOURCE.width;
                  const analyzedCropX = clamp(Math.max(leftAlignedX, rightSafeX), 0, maxCropX);
                  riveCropXRef.current = Math.max(riveCropXRef.current, analyzedCropX);
                };

                riveCropTimeoutsRef.current = [32, 140, 280, 440, 620, 800, 940].map((delay) => (
                  window.setTimeout(analyze, delay)
                ));
              };

              let activeAnimationName = null;
              let switchingAnimation = false;
              let completionQueued = false;

              const getActiveAnimation = (name = activeAnimationName) => (
                instance.animator?.animations?.find((animation) => animation.name === name) || null
              );

              const playAtIndex = (index) => {
                if (riveRef.current !== instance) return;
                const availableAnimations = riveAnimationsRef.current;
                if (!availableAnimations.length) return;
                const normalizedIndex = (index + availableAnimations.length) % availableAnimations.length;
                const nextAnimation = availableAnimations[normalizedIndex];
                const speaking = guideAudioRef.current
                  && !guideAudioRef.current.paused
                  && guideAudioRef.current.dataset.voiceKind === "synthesized";
                const playbackAnimations = [RIVE_POSITION_ANIMATION, nextAnimation];
                if (speaking && gameplayModeRef.current !== "feed") playbackAnimations.push(RIVE_MOUTH_ANIMATION);
                switchingAnimation = true;
                try {
                  instance.stop();
                  instance.play(playbackAnimations);
                  activeAnimationName = nextAnimation;
                  const positionAnimation = getActiveAnimation(RIVE_POSITION_ANIMATION);
                  if (positionAnimation?.instance) {
                    const positionFps = Math.max(positionAnimation.animation?.fps || 60, 1);
                    positionAnimation.instance.time = (positionAnimation.animation?.duration || positionFps) / positionFps;
                    positionAnimation.instance.apply(1);
                    instance.artboard?.advance?.(0);
                  }
                } finally {
                  switchingAnimation = false;
                }
                riveAnimationIndexRef.current = normalizedIndex;
                riveAnimationNameRef.current = nextAnimation;
                setRiveAnimationName(nextAnimation);
                scheduleCropAnalysis();
              };

              const playRandom = () => {
                const availableAnimations = riveAnimationsRef.current;
                if (!availableAnimations.length) return;
                const offset = availableAnimations.length > 1
                  ? Math.floor(Math.random() * (availableAnimations.length - 1)) + 1
                  : 0;
                playAtIndex(riveAnimationIndexRef.current + offset);
              };

              const queueNextAfterCompletion = (event) => {
                if (
                  cancelled
                  || riveRef.current !== instance
                  || switchingAnimation
                  || completionQueued
                  || !activeAnimationName
                  || gameplayModeRef.current
                ) return;
                const completedAnimation = event.type === RiveEventType.Loop
                  ? event.data?.animation
                  : Array.isArray(event.data) && event.data.includes(activeAnimationName)
                    ? activeAnimationName
                    : null;
                if (completedAnimation !== activeAnimationName) return;
                completionQueued = true;
                queueMicrotask(() => {
                  completionQueued = false;
                  if (!cancelled && riveRef.current === instance) playRandom();
                });
              };

              instance.on(RiveEventType.Loop, queueNextAfterCompletion);
              instance.on(RiveEventType.Stop, queueNextAfterCompletion);
              riveCharacterEventCleanupRef.current?.();
              riveCharacterEventCleanupRef.current = () => {
                instance.off(RiveEventType.Loop, queueNextAfterCompletion);
                instance.off(RiveEventType.Stop, queueNextAfterCompletion);
              };

              riveMouthPlaybackRef.current = (speaking) => {
                if (gameplayModeRef.current === "feed") speaking = false;
                const mouthAnimation = getActiveAnimation(RIVE_MOUTH_ANIMATION);
                if (speaking && !mouthAnimation) {
                  instance.play(RIVE_MOUTH_ANIMATION);
                } else if (!speaking && mouthAnimation) {
                  instance.stop(RIVE_MOUTH_ANIMATION);
                }
              };
              if (
                guideAudioRef.current
                && !guideAudioRef.current.paused
                && guideAudioRef.current.dataset.voiceKind === "synthesized"
              ) {
                riveMouthPlaybackRef.current(true);
              }

              riveMarkCaptureRef.current = () => {
                const animation = getActiveAnimation();
                if (!animation?.instance || !activeAnimationName) return null;
                const fps = Math.max(animation.animation?.fps || 30, 1);
                const finalFrame = animation.animation?.workEnd || animation.animation?.duration || 0;
                return {
                  animationName: activeAnimationName,
                  time: animation.time,
                  duration: finalFrame / fps,
                  fps,
                };
              };

              rivePrepareCaptureRef.current = (captureMoment) => {
                const sourceCanvas = riveCanvasRef.current;
                if (!sourceCanvas?.width || !captureMoment) return sourceCanvas;

                try {
                  let animation = getActiveAnimation(captureMoment.animationName);
                  if (!animation) {
                    const captureIndex = riveAnimationsRef.current.indexOf(captureMoment.animationName);
                    if (captureIndex < 0) return sourceCanvas;
                    playAtIndex(captureIndex);
                    animation = getActiveAnimation(captureMoment.animationName);
                  }
                  if (!animation?.instance) return sourceCanvas;

                  const fps = Math.max(captureMoment.fps || animation.animation?.fps || 30, 1);
                  const finalFrame = animation.animation?.workEnd || animation.animation?.duration || 0;
                  const duration = captureMoment.duration || finalFrame / fps;
                  const frameDuration = 1 / fps;
                  const lastDetailedFrame = Math.max(0, duration - frameDuration);
                  const captureTime = clamp(
                    captureMoment.time + RIVE_CAPTURE_ADVANCE_FRAMES * frameDuration,
                    0,
                    lastDetailedFrame,
                  );
                  animation.time = captureTime;
                  animation.apply(1);
                  instance.artboard?.advance?.(0);

                  const cameraStage = sourceCanvas.closest(".camera-stage");
                  if (cameraStage) {
                    cameraStage.dataset.riveCaptureAnimation = captureMoment.animationName;
                    cameraStage.dataset.riveCaptureFromTime = captureMoment.time.toFixed(4);
                    cameraStage.dataset.riveCaptureTime = captureTime.toFixed(4);
                    cameraStage.dataset.riveCaptureFps = String(fps);
                  }

                  const renderer = instance.renderer;
                  if (renderer && instance.artboard) {
                    renderer.clear();
                    renderer.save();
                    instance.alignRenderer();
                    instance.artboard.draw(renderer);
                    renderer.restore();
                    renderer.flush();
                    instance.runtime?.resolveAnimationFrame?.();
                  }

                  const captureCanvas = riveCaptureCanvasRef.current || document.createElement("canvas");
                  riveCaptureCanvasRef.current = captureCanvas;
                  if (captureCanvas.width !== sourceCanvas.width || captureCanvas.height !== sourceCanvas.height) {
                    captureCanvas.width = sourceCanvas.width;
                    captureCanvas.height = sourceCanvas.height;
                  }
                  const captureContext = captureCanvas.getContext("2d");
                  captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
                  captureContext.drawImage(sourceCanvas, 0, 0);
                  return captureCanvas;
                } catch (error) {
                  console.warn("Rive capture frame preparation failed", error);
                  return sourceCanvas;
                }
              };

              rivePlayPraiseRef.current = () => {
                const praiseIndex = riveAnimationsRef.current.indexOf(CLICK_RIVE_ANIMATION);
                if (praiseIndex < 0) return false;
                playAtIndex(praiseIndex);
                return true;
              };
              rivePlayAnimationRef.current = (animationName) => {
                const resolvedName = resolveCharacterAnimation(animationName, riveAnimationsRef.current);
                const animationIndex = riveAnimationsRef.current.indexOf(resolvedName);
                if (animationIndex < 0) return false;
                playAtIndex(animationIndex);
                return true;
              };
              playAtIndex(0);
              setRiveReady(true);
              setLoadProgress((value) => Math.max(value, 92));
              resolve(true);
            },
            onLoadError: () => {
              try {
                instance.cleanup();
              } catch (error) {
                console.warn("Rive renderer cleanup failed", error);
              }
              if (riveRef.current === instance) riveRef.current = null;
              resolve(false);
            },
          });
          applyRivePlaybackRate(instance, rivePlaybackRateRef);
          riveRef.current = instance;
        });
        riveLoadCharacterRef.current = loadRiveCharacter;
        jiaojiaoBufferRef.current = riveBuffer;
        const prepareRive = (async () => {
          let loaded = false;
          try {
            loaded = await loadRiveCharacter(riveBuffer);
          } catch (error) {
            console.warn("Preferred Rive renderer failed", error);
          }
          if (loaded || activeRiveRendererMode === "canvas") return loaded;

          riveCharacterEventCleanupRef.current?.();
          riveCharacterEventCleanupRef.current = null;
          try {
            characterInteractionRef.current?.dispose();
      characterInteractionRef.current = null;
      riveRef.current?.cleanup();
          } catch (error) {
            console.warn("WebGL2 cleanup before Canvas fallback failed", error);
          }
          riveRef.current = null;
          activeRiveRendererMode = "canvas";
          setRiveRendererMode("canvas");
          setEngineMessage("正在使用兼容模式唤醒叫叫");
          configureRiveRuntime("canvas");
          try {
            return await loadRiveCharacter(riveBuffer);
          } catch (error) {
            console.warn("Canvas Rive fallback failed", error);
            return false;
          }
        })();

        const prepareVision = (async () => {
          let segmenterLoaded = false;
          let subjectSegmenterLoaded = false;
          let faceLoaded = false;
          let gestureLoaded = false;
          try {
            const vision = await FilesetResolver.forVisionTasks(`${BASE_URL}mediapipe/wasm`);
            if (cancelled) return { segmenterLoaded, subjectSegmenterLoaded, faceLoaded, gestureLoaded };
            try {
              const segmenter = await ImageSegmenter.createFromOptions(vision, {
                baseOptions: {
                  modelAssetBuffer: new Uint8Array(modelBuffer),
                  delegate: "CPU",
                },
                runningMode: "VIDEO",
                outputConfidenceMasks: true,
                outputCategoryMask: false,
              });
              if (cancelled) segmenter.close();
              else {
                segmenterRef.current = segmenter;
                setSegmenterReady(true);
                segmenterLoaded = true;
                setLoadProgress((value) => Math.max(value, 94));
              }
            } catch (error) {
              console.warn("Person segmentation unavailable", error);
            }

            try {
              const subjectSegmenter = await ImageSegmenter.createFromOptions(vision, {
                baseOptions: {
                  modelAssetBuffer: new Uint8Array(subjectModelBuffer),
                  delegate: "CPU",
                },
                runningMode: "VIDEO",
                outputConfidenceMasks: false,
                outputCategoryMask: true,
              });
              if (cancelled) subjectSegmenter.close();
              else {
                subjectSegmenterRef.current = subjectSegmenter;
                subjectSegmenterLoaded = true;
              }
            } catch (error) {
              console.warn("General subject segmentation unavailable", error);
            }

            try {
              const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                  modelAssetBuffer: new Uint8Array(faceModelBuffer),
                  delegate: "CPU",
                },
                runningMode: "VIDEO",
                numFaces: 1,
                minFaceDetectionConfidence: 0.5,
                minFacePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
                outputFaceBlendshapes: false,
                outputFacialTransformationMatrixes: false,
              });
              if (cancelled) faceLandmarker.close();
              else {
                faceLandmarkerRef.current = faceLandmarker;
                setFaceLandmarkerReady(true);
                faceLoaded = true;
                setLoadProgress((value) => Math.max(value, 97));
              }
            } catch (error) {
              console.warn("Face landmark tracking unavailable", error);
            }

            try {
              const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                  modelAssetBuffer: new Uint8Array(gestureModelBuffer),
                  delegate: "CPU",
                },
                runningMode: "VIDEO",
                numHands: 2,
                minHandDetectionConfidence: 0.55,
                minHandPresenceConfidence: 0.55,
                minTrackingConfidence: 0.55,
                cannedGesturesClassifierOptions: {
                  scoreThreshold: 0.62,
                  categoryAllowlist: ["Thumb_Up", "Victory"],
                },
              });
              if (cancelled) gestureRecognizer.close();
              else {
                gestureRecognizerRef.current = gestureRecognizer;
                setGestureRecognizerReady(true);
                gestureLoaded = true;
                setLoadProgress((value) => Math.max(value, 99));
              }
            } catch (error) {
              console.warn("Hand gesture tracking unavailable", error);
            }
          } catch (error) {
            console.warn("MediaPipe vision runtime unavailable", error);
          }
          return { segmenterLoaded, subjectSegmenterLoaded, faceLoaded, gestureLoaded };
        })();

        const [riveLoaded, visionLoaded] = await Promise.all([prepareRive, prepareVision]);
        if (cancelled) return;
        if (!riveLoaded) throw new Error("Rive failed to initialize");
        setLoadProgress(100);
        setEngineState("ready");
        setEngineMessage(
          visionLoaded.segmenterLoaded && visionLoaded.subjectSegmenterLoaded && visionLoaded.faceLoaded && visionLoaded.gestureLoaded
            ? "叫叫、主体、嘴部与手势跟踪都准备好了"
            : "叫叫准备好了，部分识别能力稍后重试",
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Jocam preparation failed", error);
        setEngineState("error");
        setEngineMessage("叫叫没有成功到场，请刷新重试");
      }
    };

    prepare();

    return () => {
      cancelled = true;
      riveCropTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      riveCropTimeoutsRef.current = [];
      riveCharacterEventCleanupRef.current?.();
      riveCharacterEventCleanupRef.current = null;
      characterInteractionRef.current?.dispose();
      characterInteractionRef.current = null;
      riveRef.current?.cleanup();
      riveRef.current = null;
      riveLoadCharacterRef.current = null;
      rivePlayPraiseRef.current = null;
      rivePlayAnimationRef.current = null;
      riveMouthPlaybackRef.current = null;
      riveMarkCaptureRef.current = null;
      rivePrepareCaptureRef.current = null;
      riveCaptureMomentRef.current = null;
      jiaojiaoBufferRef.current = null;
      lvdouBufferRef.current = null;
      lvdouLoadPromiseRef.current = null;
      if (characterTransitionFrameRef.current) {
        window.cancelAnimationFrame(characterTransitionFrameRef.current);
        characterTransitionFrameRef.current = 0;
      }
      if (lvdouIdleHandleRef.current) {
        const { id, type } = lvdouIdleHandleRef.current;
        if (type === "idle") window.cancelIdleCallback?.(id);
        else window.clearTimeout(id);
        lvdouIdleHandleRef.current = null;
      }
      segmenterRef.current?.close();
      segmenterRef.current = null;
      subjectSegmenterRef.current?.close();
      subjectSegmenterRef.current = null;
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
      gestureRecognizerRef.current?.close();
      gestureRecognizerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const nextPlaybackRate = cameraState === "ready"
      ? CAMERA_RIVE_PLAYBACK_RATE
      : COVER_RIVE_PLAYBACK_RATE;
    if (rivePlaybackRateRef.current === nextPlaybackRate) return;
    rivePlaybackRateRef.current = nextPlaybackRate;
  }, [cameraState]);

  useEffect(() => {
    const loop = (timestamp) => {
      const video = videoRef.current;
      if (cameraState === "ready" && video?.readyState >= 2) {
        const visionThrottle = visionThrottleRef.current;
        const personSegmentationDue = segmenterRef.current
          && timestamp - lastSegmentAtRef.current >= getThrottledInterval(SEGMENT_INTERVAL_MS, visionThrottle);
        const faceTrackingDue = faceLandmarkerRef.current
          && timestamp - lastFaceAtRef.current >= getThrottledInterval(FACE_INTERVAL_MS, visionThrottle);
        const gestureTrackingDue = gestureRecognizerRef.current
          && timestamp - lastGestureAtRef.current >= getThrottledInterval(GESTURE_INTERVAL_MS, visionThrottle);
        const subjectSegmentationDue = subjectSegmenterRef.current
          && !personPresentRef.current
          && personMissingFramesRef.current >= PERSON_MISSING_FRAME_LIMIT
          && personAbsentSinceRef.current > 0
          && timestamp - personAbsentSinceRef.current >= SUBJECT_FALLBACK_DELAY_MS
          && timestamp - lastSubjectSegmentAtRef.current >= getThrottledInterval(SUBJECT_SEGMENT_INTERVAL_MS, visionThrottle);
        const runVisionTask = (task, label) => {
          const startedAt = performance.now();
          try {
            task();
          } catch (error) {
            console.warn(label, error);
          } finally {
            visionThrottleRef.current = getNextVisionThrottle(
              visionThrottleRef.current,
              performance.now() - startedAt,
            );
          }
        };

        if (faceTrackingDue) {
          lastFaceAtRef.current = timestamp;
          runVisionTask(() => {
            updateMouthAnchor(faceLandmarkerRef.current.detectForVideo(video, timestamp));
          }, "Face landmark frame failed");
        } else if (gestureTrackingDue) {
          lastGestureAtRef.current = timestamp;
          runVisionTask(() => {
            handleGestureResult(gestureRecognizerRef.current.recognizeForVideo(video, timestamp), timestamp);
          }, "Hand gesture frame failed");
        } else if (personSegmentationDue) {
          lastSegmentAtRef.current = timestamp;
          runVisionTask(() => {
            segmenterRef.current.segmentForVideo(video, timestamp, updateMask);
          }, "Person segmentation frame failed");
        } else if (subjectSegmentationDue) {
          lastSubjectSegmentAtRef.current = timestamp;
          runVisionTask(() => {
            subjectSegmenterRef.current.segmentForVideo(video, timestamp, updateSubjectMask);
          }, "General subject segmentation frame failed");
        }
        if (timestamp - lastRenderAtRef.current >= RENDER_INTERVAL_MS) {
          lastRenderAtRef.current = timestamp;
          renderFrame(recordingRef.current, null, recordingRef.current);
        }
      } else if (riveReady) {
        if (timestamp - lastRenderAtRef.current >= RENDER_INTERVAL_MS) {
          lastRenderAtRef.current = timestamp;
          renderWelcomeFrame();
        }
      }
      frameRef.current = window.requestAnimationFrame(loop);
    };

    frameRef.current = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [cameraState, handleGestureResult, renderFrame, renderWelcomeFrame, riveReady, updateMask, updateMouthAnchor, updateSubjectMask]);

  useEffect(() => () => {
    cameraReadyRef.current = false;
    stopVoiceSession();
    stopPipCamera();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current);
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (gestureEffectTimerRef.current) window.clearTimeout(gestureEffectTimerRef.current);
    if (autoCaptureTimerRef.current) window.clearTimeout(autoCaptureTimerRef.current);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    if (mediaLibraryCloseTimerRef.current) window.clearTimeout(mediaLibraryCloseTimerRef.current);
    if (mediaPreviewCloseTimerRef.current) window.clearTimeout(mediaPreviewCloseTimerRef.current);
    guideAudioRef.current?.pause();
    shutterAudioContextRef.current?.close().catch(() => {});
    shutterAudioContextRef.current = null;
    uiSfxRef.current?.destroy?.().catch(() => {});
    uiSfxRef.current = null;
    for (const item of mediaLibraryRef.current) {
      if (item.url) URL.revokeObjectURL(item.url);
    }
  }, [stopPipCamera, stopVoiceSession]);

  const openCamera = useCallback(async (
    nextFacingMode = facingMode,
    { attemptPip = nextFacingMode === "environment" } = {},
  ) => {
    cameraReadyRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("error");
      setCameraError("当前浏览器不支持相机，请用最新版 Safari 或 Chrome 打开");
      return;
    }

    setCameraState("opening");
    setCameraError("");
    setCameraLensMode("default");
    setCameraMenuOpen(false);
    setMediaLibraryOpen(false);
    mediaLibraryOpenRef.current = false;
    setMediaLibraryClosing(false);
    setMediaLibraryDragging(false);
    setMediaLibraryDragY(0);
    setMediaPreview(null);
    mediaPreviewRef.current = null;
    setMediaPreviewClosing(false);
    if (mediaLibraryCloseTimerRef.current) window.clearTimeout(mediaLibraryCloseTimerRef.current);
    if (mediaPreviewCloseTimerRef.current) window.clearTimeout(mediaPreviewCloseTimerRef.current);
    maskReadyRef.current = false;
    personPresentRef.current = false;
    personMissingFramesRef.current = 0;
    personAbsentSinceRef.current = 0;
    lastRenderAtRef.current = 0;
    lastSegmentAtRef.current = 0;
    lastSubjectSegmentAtRef.current = 0;
    lastFaceAtRef.current = 0;
    lastGestureAtRef.current = 0;
    visionThrottleRef.current = 1;
    personMaskRevisionRef.current = 0;
    gestureEffectUntilRef.current = 0;
    gestureOutlineBuffersRef.current = null;
    if (gestureEffectTimerRef.current) window.clearTimeout(gestureEffectTimerRef.current);
    gestureEffectTimerRef.current = null;
    if (autoCaptureTimerRef.current) window.clearTimeout(autoCaptureTimerRef.current);
    autoCaptureTimerRef.current = null;
    gestureTrackerRef.current = createGestureTracker();
    setLastRecognizedGesture("");
    setActiveGestureEffect("");
    stopVoiceSession();
    stopPipCamera();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    let stream;
    try {
      const videoConstraints = {
        facingMode: { ideal: nextFacingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
      const acquireMainStream = async () => {
        try {
          return {
            stream: await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: { ideal: 1 },
                echoCancellation: { ideal: true },
                noiseSuppression: { ideal: true },
                autoGainControl: { ideal: true },
              },
              video: videoConstraints,
            }),
            microphoneUnavailable: false,
          };
        } catch (mediaError) {
          console.warn("Microphone permission unavailable; continuing with camera only", mediaError);
          return {
            stream: await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints }),
            microphoneUnavailable: true,
          };
        }
      };
      let acquired = await acquireMainStream();
      stream = acquired.stream;
      let microphoneUnavailable = acquired.microphoneUnavailable;

      if (nextFacingMode === "user") {
        const preferredCamera = await preferWidestFrontCamera(navigator.mediaDevices, stream, videoConstraints);
        stream = preferredCamera.stream;
        setCameraLensMode(preferredCamera.lensMode);
      }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      let pipResult = null;
      if (nextFacingMode === "environment" && attemptPip) {
        pipResult = await startPipCamera(stream);
        if (pipResult.mainInterrupted) {
          stopPipCamera();
          stream.getTracks().forEach((track) => track.stop());
          acquired = await acquireMainStream();
          stream = acquired.stream;
          microphoneUnavailable = acquired.microphoneUnavailable;
          streamRef.current = stream;
          video.srcObject = stream;
          await video.play();
        }
      }
      setFacingMode(nextFacingMode);
      cameraReadyRef.current = true;
      setCameraState("ready");
      if (!lvdouBufferRef.current && !lvdouLoadPromiseRef.current && !lvdouIdleHandleRef.current) {
        const loadInBackground = () => {
          lvdouIdleHandleRef.current = null;
          preloadLvdou().catch(() => {});
        };
        if ("requestIdleCallback" in window) {
          lvdouIdleHandleRef.current = {
            id: window.requestIdleCallback(loadInBackground, { timeout: 2_200 }),
            type: "idle",
          };
        } else {
          lvdouIdleHandleRef.current = {
            id: window.setTimeout(loadInBackground, 900),
            type: "timeout",
          };
        }
      }
      startVoiceSession(stream, { textOnly: microphoneUnavailable });
      if (microphoneUnavailable) showToast("相机已打开，也可以点右上角打字聊天");
      if (pipResult && !pipResult.ok) {
        showToast("当前设备暂不支持前后双摄，已保留后摄主画面");
      } else if (!segmenterReady) {
        showToast("相机已打开，人像识别还在准备");
      }
    } catch (error) {
      cameraReadyRef.current = false;
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const denied = error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name);
      const missing = error instanceof DOMException && ["NotFoundError", "OverconstrainedError"].includes(error.name);
      setCameraState("error");
      setCameraError(
        denied
          ? "需要相机权限才能和叫叫合拍。请在浏览器设置中允许后重试。"
          : missing
            ? "没有找到可用的相机"
            : "相机暂时打不开，请稍后再试",
      );
    }
  }, [facingMode, preloadLvdou, segmenterReady, showToast, startPipCamera, startVoiceSession, stopPipCamera, stopVoiceSession]);

  const enterCamera = useCallback(() => {
    unlockShutterSound();
    void unlockInterfaceSounds().then((sounds) => sounds?.play("open"));
    unlockVoicePlayback();
    openCamera("user");
  }, [openCamera, unlockInterfaceSounds, unlockShutterSound, unlockVoicePlayback]);

  const switchCamera = useCallback(() => {
    if (recordingRef.current) return;
    playInterfaceSound("toggle-on");
    openCamera(facingMode === "user" ? "environment" : "user");
  }, [facingMode, openCamera, playInterfaceSound]);

  const togglePipCamera = useCallback(async () => {
    if (recordingRef.current || facingMode !== "environment" || pipOpening) return;
    if (pipVisible) {
      playInterfaceSound("toggle-off");
      stopPipCamera();
      showToast("前摄小窗已关闭");
      return;
    }
    const result = await startPipCamera(streamRef.current);
    if (result.ok) {
      playInterfaceSound("toggle-on");
      showToast("前摄小窗已打开，拍照和录像都会保留");
      return;
    }
    if (result.mainInterrupted) {
      await openCamera("environment", { attemptPip: false });
    }
    showToast("当前设备暂不支持同时打开前后摄像头");
  }, [facingMode, openCamera, pipOpening, pipVisible, playInterfaceSound, showToast, startPipCamera, stopPipCamera]);

  const switchRiveAnimation = useCallback(() => {
    if (!rivePlayPraiseRef.current?.()) return;
    playInterfaceSound("reaction");
    showToast(`${CHARACTERS[activeCharacter].label}正在夸夸你`);
  }, [activeCharacter, playInterfaceSound, showToast]);

  const switchCharacterTo = useCallback(async (nextCharacter) => {
    if (!CHARACTERS[nextCharacter]) return;
    if (characterSwitchingRef.current || recordingRef.current) return;
    if (nextCharacter === activeCharacter) {
      showToast(`${CHARACTERS[nextCharacter].label}已经在这里啦`);
      return;
    }
    playInterfaceSound("select");
    let nextBuffer;
    try {
      if (nextCharacter === "lvdou" && !lvdouBufferRef.current) {
        showToast("绿豆正在悄悄赶来");
      }
      nextBuffer = nextCharacter === "lvdou"
        ? await preloadLvdou()
        : jiaojiaoBufferRef.current;
    } catch {
      showToast("绿豆暂时没有加载好，请再试一次");
      return;
    }
    if (!nextBuffer || !riveLoadCharacterRef.current) return;

    characterSwitchingRef.current = true;
    setCharacterSwitching(true);
    const outputWidth = outputCanvasRef.current?.width || frameSize.width;
    const offscreenLeft = -outputWidth * 1.18;
    const previousBuffer = activeCharacter === "jiaojiao"
      ? jiaojiaoBufferRef.current
      : lvdouBufferRef.current;

    try {
      await animateCharacterOffset(offscreenLeft, CHARACTER_EXIT_DURATION_MS, "exit");
      const loaded = await riveLoadCharacterRef.current(nextBuffer);
      if (!loaded) throw new Error("Rive character failed to initialize");
      setActiveCharacter(nextCharacter);
      characterOffsetXRef.current = offscreenLeft;
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await animateCharacterOffset(0, CHARACTER_ENTER_DURATION_MS, "enter");
      showToast(nextCharacter === "lvdou" ? "绿豆来啦" : "叫叫回来啦");
    } catch (error) {
      console.warn("角色切换失败", error);
      if (previousBuffer) await riveLoadCharacterRef.current(previousBuffer);
      characterOffsetXRef.current = offscreenLeft;
      await animateCharacterOffset(0, CHARACTER_ENTER_DURATION_MS, "enter");
      showToast("角色切换没有成功，请再试一次");
    } finally {
      characterSwitchingRef.current = false;
      setCharacterSwitching(false);
    }
  }, [activeCharacter, animateCharacterOffset, frameSize.width, playInterfaceSound, preloadLvdou, showToast]);

  useEffect(() => {
    switchCharacterToRef.current = switchCharacterTo;
    return () => {
      if (switchCharacterToRef.current === switchCharacterTo) switchCharacterToRef.current = null;
    };
  }, [switchCharacterTo]);

  const switchCharacter = useCallback(() => {
    const nextCharacter = activeCharacter === "jiaojiao" ? "lvdou" : "jiaojiao";
    return switchCharacterTo(nextCharacter);
  }, [activeCharacter, switchCharacterTo]);

  const handleCharacterTap = useCallback(() => {
    if (characterSwitchingRef.current || gameplayModeRef.current) return;
    const now = performance.now();
    if (now - characterLastTapAtRef.current > CHARACTER_TAP_WINDOW_MS) {
      characterTapCountRef.current = 0;
    }
    characterLastTapAtRef.current = now;
    characterTapCountRef.current += 1;

    if (characterTapCountRef.current >= 3) {
      characterTapCountRef.current = 0;
      switchCharacter();
      return;
    }
    if (characterTapCountRef.current === 1) switchRiveAnimation();
  }, [switchCharacter, switchRiveAnimation]);

  const switchCaption = useCallback(() => {
    if (recordingRef.current) return;
    playInterfaceSound("toggle-on");
    setCaptionMode((current) => (current === "together" ? "streak" : "together"));
    setDay((current) => getRandomValue(MAX_RANDOM_DAY, current));
    showToast("已切换字幕和阅读天数");
  }, [playInterfaceSound, showToast]);

  const togglePersonLayer = useCallback(() => {
    setPersonLayer((current) => {
      const next = current === "front" ? "behind" : "front";
      playInterfaceSound(next === "front" ? "toggle-on" : "toggle-off");
      showToast(next === "front" ? "人像已切到叫叫前面" : "人像已切到叫叫后面");
      return next;
    });
  }, [playInterfaceSound, showToast]);

  const toggleCameraMenu = useCallback(() => {
    const next = !cameraMenuOpen;
    setCameraMenuOpen(next);
    playInterfaceSound(next ? "expand" : "collapse");
  }, [cameraMenuOpen, playInterfaceSound]);

  const openMediaLibrary = useCallback(() => {
    if (mediaLibraryCloseTimerRef.current) {
      window.clearTimeout(mediaLibraryCloseTimerRef.current);
      mediaLibraryCloseTimerRef.current = null;
    }
    setCameraMenuOpen(false);
    setMediaLibraryClosing(false);
    setMediaLibraryDragging(false);
    setMediaLibraryDragY(0);
    mediaLibraryOpenRef.current = true;
    setMediaLibraryOpen(true);
    playInterfaceSound("open");
  }, [playInterfaceSound]);

  const closeMediaLibrary = useCallback(() => {
    if (!mediaLibraryOpenRef.current || mediaLibraryClosing) return;
    setMediaLibraryDragging(false);
    setMediaLibraryDragY(0);
    setMediaLibraryClosing(true);
    playInterfaceSound("close");
    if (mediaLibraryCloseTimerRef.current) window.clearTimeout(mediaLibraryCloseTimerRef.current);
    mediaLibraryCloseTimerRef.current = window.setTimeout(() => {
      mediaLibraryCloseTimerRef.current = null;
      mediaLibraryOpenRef.current = false;
      setMediaLibraryOpen(false);
      setMediaLibraryClosing(false);
    }, 280);
  }, [mediaLibraryClosing, playInterfaceSound]);

  const openMediaPreview = useCallback((item, direction = "open") => {
    if (!item) return;
    playInterfaceSound(direction === "next" ? "forward" : direction === "previous" ? "back" : "open");
    if (mediaPreviewCloseTimerRef.current) {
      window.clearTimeout(mediaPreviewCloseTimerRef.current);
      mediaPreviewCloseTimerRef.current = null;
    }
    const commit = () => {
      flushSync(() => {
        setMediaPreviewClosing(false);
        setMediaPreviewDirection(direction);
        mediaPreviewRef.current = item;
        setMediaPreview(item);
      });
    };
    if (direction === "open" && mediaLibraryOpenRef.current && document.startViewTransition) {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  }, [playInterfaceSound]);

  const closePreview = useCallback(() => {
    if (!mediaPreviewRef.current || mediaPreviewClosing) return;
    playInterfaceSound("close");
    if (mediaLibraryOpenRef.current && document.startViewTransition) {
      document.startViewTransition(() => {
        flushSync(() => {
          mediaPreviewRef.current = null;
          setMediaPreview(null);
          setMediaPreviewClosing(false);
          setMediaPreviewDirection("open");
        });
      });
      return;
    }
    setMediaPreviewClosing(true);
    if (mediaPreviewCloseTimerRef.current) window.clearTimeout(mediaPreviewCloseTimerRef.current);
    mediaPreviewCloseTimerRef.current = window.setTimeout(() => {
      mediaPreviewCloseTimerRef.current = null;
      mediaPreviewRef.current = null;
      setMediaPreview(null);
      setMediaPreviewClosing(false);
      setMediaPreviewDirection("open");
    }, 240);
  }, [mediaPreviewClosing, playInterfaceSound]);

  const onMediaLibraryTouchStart = useCallback((event) => {
    if (event.touches.length !== 1 || (mediaLibraryGridRef.current?.scrollTop || 0) > 1) return;
    const touch = event.touches[0];
    mediaLibrarySwipeRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      dragY: 0,
    };
  }, []);

  const onMediaLibraryTouchMove = useCallback((event) => {
    const swipe = mediaLibrarySwipeRef.current;
    if (!swipe.active || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - swipe.startX;
    const deltaY = touch.clientY - swipe.startY;
    if (deltaY <= 0 || Math.abs(deltaX) > deltaY) return;
    if (event.cancelable) event.preventDefault();
    swipe.dragY = Math.min(148, deltaY * 0.58);
    setMediaLibraryDragging(true);
    setMediaLibraryDragY(swipe.dragY);
  }, []);

  const finishMediaLibraryTouch = useCallback(() => {
    const swipe = mediaLibrarySwipeRef.current;
    mediaLibrarySwipeRef.current = { active: false, startX: 0, startY: 0, dragY: 0 };
    setMediaLibraryDragging(false);
    if (swipe.dragY >= 72) {
      closeMediaLibrary();
      return;
    }
    setMediaLibraryDragY(0);
  }, [closeMediaLibrary]);

  const showAdjacentPreview = useCallback((step) => {
    const current = mediaPreviewRef.current;
    if (!current) return;
    const items = mediaLibraryRef.current;
    const currentIndex = items.findIndex(({ id }) => id === current.id);
    const nextItem = items[currentIndex + step];
    if (!nextItem) return;
    openMediaPreview(nextItem, step > 0 ? "next" : "previous");
  }, [openMediaPreview]);

  const onMediaPreviewPointerDown = useCallback((event) => {
    if (mediaPreviewRef.current?.type !== "photo" || event.target.closest?.("button, video")) return;
    mediaPreviewSwipeRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events used in previews do not always own an active pointer.
    }
  }, []);

  const onMediaPreviewPointerUp = useCallback((event) => {
    const swipe = mediaPreviewSwipeRef.current;
    if (!swipe.active || swipe.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
    mediaPreviewSwipeRef.current = { active: false, pointerId: null, startX: 0, startY: 0 };
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const horizontal = Math.abs(deltaX);
    const vertical = Math.abs(deltaY);
    if (vertical >= 58 && vertical > horizontal) {
      closePreview();
      return;
    }
    if (horizontal >= 58 && horizontal > vertical) {
      showAdjacentPreview(deltaX < 0 ? 1 : -1);
    }
  }, [closePreview, showAdjacentPreview]);

  const onMediaPreviewPointerCancel = useCallback(() => {
    mediaPreviewSwipeRef.current = { active: false, pointerId: null, startX: 0, startY: 0 };
  }, []);

  const takePhoto = useCallback(({ automatic = false, reason = "manual" } = {}) => {
    const canvas = outputCanvasRef.current;
    if (!canvas || cameraState !== "ready" || recordingRef.current) return;
    const captureMoment = riveCaptureMomentRef.current || riveMarkCaptureRef.current?.();
    riveCaptureMomentRef.current = null;
    const captureRiveCanvas = rivePrepareCaptureRef.current?.(captureMoment) || riveCanvasRef.current;
    renderFrame(true, captureRiveCanvas, true);

    const photoCanvas = photoCanvasRef.current || document.createElement("canvas");
    photoCanvasRef.current = photoCanvas;
    if (photoCanvas.width !== canvas.width || photoCanvas.height !== canvas.height) {
      photoCanvas.width = canvas.width;
      photoCanvas.height = canvas.height;
    }
    const photoContext = photoCanvas.getContext("2d", { alpha: false });
    if (!photoContext) {
      showToast("照片生成失败，请再试一次");
      return;
    }
    photoContext.drawImage(canvas, 0, 0);
    playShutterSound();
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setFlashMode(automatic ? "automatic" : "manual");
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setFlashMode("");
    }, 280);

    photoCanvas.toBlob((blob) => {
      if (!blob) {
        showToast("照片生成失败，请再试一次");
        return;
      }
      addMediaCapture({
        type: "photo",
        blob,
        day: paddedDay,
        captionMode,
        captionText: contextualCaption.text,
        source: reason,
      }, {
        automatic,
      });
    }, "image/jpeg", 0.94);
  }, [addMediaCapture, cameraState, captionMode, contextualCaption.text, paddedDay, playShutterSound, renderFrame, showToast]);

  useEffect(() => {
    takePhotoRef.current = takePhoto;
  }, [takePhoto]);

  useEffect(() => {
    const onVolumeShutter = (event) => {
      const keyCode = event.keyCode || event.which;
      const isVolumeKey = VOLUME_SHUTTER_KEYS.has(event.key)
        || VOLUME_SHUTTER_KEYS.has(event.code)
        || VOLUME_SHUTTER_KEY_CODES.has(keyCode);

      if (
        !isVolumeKey
        || event.repeat
        || cameraState !== "ready"
        || recordingRef.current
        || mediaPreviewRef.current
        || mediaLibraryOpenRef.current
      ) return;

      event.preventDefault();
      riveCaptureMomentRef.current = riveMarkCaptureRef.current?.() || null;
      takePhoto();
    };

    window.addEventListener("keydown", onVolumeShutter, true);
    return () => window.removeEventListener("keydown", onVolumeShutter, true);
  }, [cameraState, takePhoto]);

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    playInterfaceSound("stop");
    recordingRef.current = false;
    setRecording(false);
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (autoStopTimerRef.current) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setFrameOrientation(getViewportOrientation());
  }, [playInterfaceSound]);

  const startRecording = useCallback(() => {
    riveCaptureMomentRef.current = null;
    setCameraMenuOpen(false);
    const canvas = outputCanvasRef.current;
    const mimeType = chooseRecordingMimeType();
    if (!canvas?.captureStream || !window.MediaRecorder || !mimeType) {
      showToast("当前浏览器暂不支持网页录像，可以先拍照");
      return;
    }

    try {
      const stream = canvas.captureStream(30);
      streamRef.current?.getAudioTracks().forEach((track) => stream.addTrack(track.clone()));
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      recordingChunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || mimeType });
        if (!blob.size) {
          showToast("录像没有成功保存，请再试一次");
          return;
        }
        addMediaCapture({
          type: "video",
          blob,
          day: recordingDayRef.current,
          captionMode: recordingCaptionModeRef.current,
          captionText: recordingCaptionRef.current?.text,
          source: "manual",
          durationMs: Math.max(0, performance.now() - recordingStartedAtRef.current),
        });
      };

      recordingDayRef.current = paddedDay;
      recordingCaptionModeRef.current = captionMode;
      recordingCaptionRef.current = contextualCaption;
      recordingStartedAtRef.current = performance.now();
      recordingRef.current = true;
      setRecording(true);
      setRecordingTime(0);
      playInterfaceSound("start");
      recorder.start(250);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(performance.now() - recordingStartedAtRef.current);
      }, 100);
      autoStopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (error) {
      console.warn("Recording failed", error);
      showToast("录像启动失败，可以先拍照");
    }
  }, [addMediaCapture, captionMode, contextualCaption, paddedDay, playInterfaceSound, showToast, stopRecording]);

  const onShutterPointerDown = useCallback((event) => {
    if (cameraState !== "ready") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerDownRef.current = true;
    longPressTriggeredRef.current = false;
    riveCaptureMomentRef.current = riveMarkCaptureRef.current?.() || null;
    longPressTimerRef.current = window.setTimeout(() => {
      if (!pointerDownRef.current) return;
      longPressTriggeredRef.current = true;
      startRecording();
    }, LONG_PRESS_MS);
  }, [cameraState, startRecording]);

  const onShutterPointerUp = useCallback((event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointerDownRef.current = false;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (recordingRef.current) {
      riveCaptureMomentRef.current = null;
      stopRecording();
    } else if (!longPressTriggeredRef.current) {
      takePhoto();
    }
  }, [stopRecording, takePhoto]);

  const onShutterPointerCancel = useCallback(() => {
    pointerDownRef.current = false;
    riveCaptureMomentRef.current = null;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    if (recordingRef.current) stopRecording();
  }, [stopRecording]);

  const savePreview = useCallback(async () => {
    if (!mediaPreview) return;
    const previewDay = mediaPreview.day || paddedDay;
    const previewCaptionMode = mediaPreview.captionMode || captionMode;
    const previewCaptionText = mediaPreview.captionText || getCaptionText(previewCaptionMode, previewDay);
    const extension = mediaPreview.type === "photo" ? "jpg" : getFileExtension(mediaPreview.blob.type);
    await saveBlob(
      mediaPreview.blob,
      `我和叫叫-第${previewDay}天-${getTimestamp()}.${extension}`,
      previewCaptionText,
    );
    playInterfaceSound("success");
  }, [captionMode, mediaPreview, paddedDay, playInterfaceSound]);

  const latestMedia = mediaLibrary[0] || null;
  const captureGameplayFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight || video.readyState < 2) throw new Error("相机还没准备好");
    const output = outputCanvasRef.current;
    const displayWidth = output.clientWidth, displayHeight = output.clientHeight;
    if (!displayWidth || !displayHeight) throw new Error("相机还没准备好");
    const scale = Math.min(1, 640 / Math.max(displayWidth, displayHeight));
    const canvas = gameplayFrameCanvasRef.current || document.createElement("canvas");
    gameplayFrameCanvasRef.current = canvas;
    canvas.width = Math.round(displayWidth * scale); canvas.height = Math.round(displayHeight * scale);
    const context = canvas.getContext("2d");
    const displayScale = Math.max(displayWidth / output.width, displayHeight / output.height);
    const cropBottom = output.height * displayScale - displayHeight;
    // Match both the video's centered cover and the output canvas's left/bottom cover.
    // The JPEG is already mirrored exactly as displayed, so later point mapping is direct.
    context.setTransform(scale * displayScale, 0, 0, scale * displayScale, 0, -cropBottom * scale);
    const rect = getCoverRect(video.videoWidth, video.videoHeight, output.width, output.height);
    drawCameraSource(context, video, rect, output.width, shouldMirrorCamera(facingMode));
    context.resetTransform();
    let quality = 0.78;
    let image = canvas.toDataURL("image/jpeg", quality);
    while (image.length > 230_000 && quality > 0.3) { quality -= 0.1; image = canvas.toDataURL("image/jpeg", quality); }
    const blob = await (await fetch(image)).blob();
    return { image, blob, width: canvas.width, height: canvas.height, mirrored: false };
  }, [facingMode]);

  const inspectStoryObject = useCallback(async () => {
    const activeFocus = storyFocusRef.current;
    if (!activeFocus || activeFocus.phase === "checking") return;
    setHiddenStoryFocus({ phase: "checking" });
    const askToFrame = () => {
      const text = "我还没看清，把它放进白色虚线框里好吗？";
      setGameplayReaction({ action: "curious", text, id: crypto.randomUUID(), character: activeCharacter });
      replaceCharacterBubble(text);
      const socket = voiceSocketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "local_speech", text }));
      else speakCharacterFallback(text);
    };
    try {
      const frame = await captureGameplayFrame();
      const result = await requestGameplay({
        source: "observe", image: frame.image, roundId: crypto.randomUUID(), frameId: crypto.randomUUID(), character: activeCharacter,
      });
      if (!result.evaluable || !result.label || !result.category) {
        setHiddenStoryFocus({ phase: "framing" });
        askToFrame();
        return;
      }
      setHiddenStoryFocus(null);
      const socket = voiceSocketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "story_observation", observation: { label: result.label, category: result.category } }));
      }
    } catch {
      setHiddenStoryFocus({ phase: "framing" });
      askToFrame();
    }
  }, [activeCharacter, captureGameplayFrame, replaceCharacterBubble, setHiddenStoryFocus, speakCharacterFallback]);
  inspectStoryRef.current = inspectStoryObject;

  const startGameplay = useCallback(async (mode) => {
    gameplayModeRef.current = mode;
    clearCharacterSpeech();
    setGameplayMenuOpen(false); setTextComposerOpen(false); setGameplayTranscript(null); setGameplayReaction(null);
    gameplayTargetRef.current = null;
    characterInteractionRef.current?.reset();
    const socket = voiceSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "interaction_mode", mode: mode || "none" }));
    if (mode === "feed" && activeCharacter !== "jiaojiao") await switchCharacterTo("jiaojiao");
    if (gameplayModeRef.current !== mode) return;
    setGameplayMode(mode);
    if (mode) rivePlayAnimationRef.current?.("TalkingEmotion_Expectation");
    else rivePlayAnimationRef.current?.("TalkingEmotion_Normal");
  }, [activeCharacter, clearCharacterSpeech, switchCharacterTo]);
  startGameplayRef.current = startGameplay;
  useEffect(() => {
    if (cameraState !== "ready") { gameplayModeRef.current = ""; setGameplayMode(""); setGameplayMenuOpen(false); }
  }, [cameraState]);
  useEffect(() => {
    if (!gameplayMode) return undefined;
    const sync = () => {
      const next = characterDrawRectRef.current;
      if (!next) return;
      setGameplayCharacterRect((old) => !old || ["x", "y", "width", "height", "mouthX", "mouthY"].some((key) => Math.abs(next[key] - old[key]) > 1) ? { ...next } : old);
    };
    sync(); const timer = setInterval(sync, 100);
    return () => clearInterval(timer);
  }, [gameplayMode]);
  const handleGameplayTarget = useCallback((target) => {
    gameplayTargetRef.current = target;
    const rect = characterDrawRectRef.current;
    if (!target || !rect) { characterInteractionRef.current?.reset(); return; }
    characterInteractionRef.current?.update({
      x: clamp((target.x - rect.mouthX) / Math.max(rect.width * 0.45, 1), -1, 1),
      y: clamp((target.y - rect.mouthY) / Math.max(rect.height * 0.4, 1), -1, 1),
      mouthOpen: target.mouthOpen, chewing: target.chewing,
    });
  }, []);
  const handleGameplayReaction = useCallback((value, actionName) => {
    const reaction = typeof value === "string" ? { text: value, action: actionName || "happy" } : value;
    if (!reaction?.text) return;
    const action = VOICE_ACTIONS[reaction.action];
    if (action && !gameplayTargetRef.current?.chewing) rivePlayAnimationRef.current?.(action.animation);
    setGameplayReaction({ ...reaction, id: crypto.randomUUID(), character: activeCharacter });
    replaceCharacterBubble(reaction.text);
    const socket = voiceSocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "local_speech", text: reaction.text }));
    else speakCharacterFallback(reaction.text);
  }, [activeCharacter, replaceCharacterBubble, speakCharacterFallback]);
  const handleGameplayFound = useCallback(() => scheduleAutoCapture("gameplay:find", 420), [scheduleAutoCapture]);
  const analyzeToy = useCallback((image, { signal } = {}) => requestGameplay({ source: "toy", image,
    roundId: crypto.randomUUID(), frameId: crypto.randomUUID(), character: activeCharacter }, { signal }), [activeCharacter]);
  const handleFriendSaved = useCallback((friend) => setFriends((current) => [friend, ...current.filter((item) => item.id !== friend.id)]), []);
  const submitTypedMessage = useCallback(async (event) => {
    event.preventDefault(); const text = textDraft.trim(); if (!text) return;
    if (textSendingRef.current) return;
    textSendingRef.current = true; setTextSending(true);
    const attempt = lastTextAttemptRef.current?.text === text ? lastTextAttemptRef.current : { id: crypto.randomUUID(), text };
    lastTextAttemptRef.current = attempt;
    try {
      let socket = voiceSocketRef.current;
      if (!voiceReadyRef.current || socket?.readyState !== WebSocket.OPEN) {
        const waitingSocket = socket;
        if (socket && socket.readyState < WebSocket.CLOSING && voiceReadyPromiseRef.current) socket = await voiceReadyPromiseRef.current;
        if (!socket || socket !== voiceSocketRef.current || socket.readyState !== WebSocket.OPEN || !voiceReadyRef.current) {
          if (!cameraReadyRef.current) throw new Error("相机已关闭，文字还在。");
          const connecting = voiceSocketRef.current;
          socket = connecting && connecting !== waitingSocket && connecting.readyState < WebSocket.CLOSING && voiceReadyPromiseRef.current
            ? await voiceReadyPromiseRef.current : await startVoiceSession(streamRef.current, { textOnly: true });
        }
      }
      if (!socket || socket !== voiceSocketRef.current || socket.readyState !== WebSocket.OPEN || !voiceReadyRef.current) throw new Error("连接没有成功，文字还在，可以再试一次。");
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => pendingTextRef.current?.id === attempt.id && pendingTextRef.current.finish(false, "这句话还没送到，请再试一次。"), 8_000);
        const pending = { id: attempt.id, finish: (ok, message) => {
          window.clearTimeout(timer);
          if (pendingTextRef.current === pending) pendingTextRef.current = null;
          if (ok) resolve(); else reject(new Error(message || "发送没有成功，文字还在。"));
        } };
        pendingTextRef.current = pending;
        try { socket.send(JSON.stringify({ type: "text", text, clientMessageId: attempt.id })); }
        catch { pending.finish(false, "连接已断开，文字还在，可以再试一次。"); }
      });
      lastTextAttemptRef.current = null;
      setTextDraft(""); setTextComposerOpen(false);
    } catch (error) {
      showToast(error.message || "这句话没有送到，文字还在。");
      if (cameraReadyRef.current) setTextComposerOpen(true);
    } finally { textSendingRef.current = false; setTextSending(false); }
  }, [showToast, startVoiceSession, textDraft]);

  const formattedRecordingTime = `${String(Math.floor(recordingTime / 1000)).padStart(2, "0")}.${Math.floor((recordingTime % 1000) / 100)}`;
  const readyForCamera = engineState !== "error";
  const activeRivePlaybackRate = cameraState === "ready" ? CAMERA_RIVE_PLAYBACK_RATE : COVER_RIVE_PLAYBACK_RATE;
  const thinkingIndicatorPosition = isTabletDevice
    ? getTabletThinkingIndicatorPosition(frameOrientation)
    : null;

  return (
    <main className={`app-shell is-${frameOrientation} ${isMobileDevice ? "is-mobile-device" : "is-desktop-device"} ${isTabletDevice ? "is-tablet-device" : ""}`}>
      <section
        className={`camera-stage is-${frameOrientation} ${cameraState === "ready" ? "is-live" : ""} ${riveReady ? "is-rive-ready" : ""} ${characterSwitching ? "is-character-switching" : ""}`}
        data-frame-orientation={frameOrientation}
        data-gameplay-mode={gameplayMode || "none"}
        data-rive-animation={riveAnimationName}
        data-rive-playback-rate={activeRivePlaybackRate}
        data-rive-renderer={riveRendererMode}
        data-rive-switch-mode="on-complete"
        data-rive-position-basis={RIVE_POSITION_ANIMATION}
        data-rive-mouth-animation={RIVE_MOUTH_ANIMATION}
        data-rive-capture-offset-frames={RIVE_CAPTURE_ADVANCE_FRAMES}
        data-character={activeCharacter}
        data-character-switching={characterSwitching ? "true" : "false"}
        data-person-layer={personLayer}
        data-face-tracking={faceLandmarkerReady ? "ready" : "unavailable"}
        data-gesture-tracking={gestureRecognizerReady ? "ready" : "unavailable"}
        data-last-gesture={lastRecognizedGesture || "none"}
        data-gesture-effect={activeGestureEffect || "none"}
        data-gesture-outline="rainbow-mask"
        data-camera-lens={cameraLensMode}
        data-pip-camera={facingMode === "environment" ? (pipVisible ? "visible" : pipOpening ? "opening" : "hidden") : "inactive"}
        data-media-count={mediaLibrary.length}
        data-camera-menu={cameraMenuOpen ? "open" : "closed"}
        data-voice-state={voiceState}
        data-ai-state={aiState}
        data-scene-vision-state={sceneVisionState}
        data-reading-day={day}
        data-caption-mode={captionMode}
        aria-label="和叫叫合拍相机"
      >
        <audio
          ref={guideAudioRef}
          className="guide-audio"
          preload="none"
          playsInline
          onPlay={() => {
            if (guideAudioRef.current?.dataset.voiceKind !== "synthesized") return;
            characterEchoGateUntilRef.current = startCharacterEchoGate();
            riveMouthPlaybackRef.current?.(true);
          }}
          onPause={() => {
            characterEchoGateUntilRef.current = endCharacterEchoGate(performance.now());
            riveMouthPlaybackRef.current?.(false);
          }}
          onEnded={() => {
            playNextSynthesizedSpeech();
          }}
          aria-hidden="true"
        />
        <span className="sr-only" aria-live="polite">{speechText}</span>
        <div className="viewfinder">
          <video ref={videoRef} className="camera-source" playsInline muted aria-hidden="true" />
          <video ref={pipVideoRef} className="camera-source pip-camera-source" playsInline muted aria-hidden="true" />
          <canvas ref={riveCanvasRef} className="rive-source" width={RIVE_SOURCE_SIZE.width} height={RIVE_SOURCE_SIZE.height} aria-hidden="true" />
          <canvas ref={foregroundCanvasRef} className="render-source" width={frameSize.width} height={frameSize.height} aria-hidden="true" />
          <canvas ref={maskCanvasRef} className="render-source" width="256" height="256" aria-hidden="true" />
          <canvas ref={outputCanvasRef} className="camera-output" width={frameSize.width} height={frameSize.height} aria-label="实时合拍画面" />
          <div ref={speechBubbleOverlayRef} className="speech-bubble-text" hidden aria-hidden="true">
            <Calligraph
              className="speech-bubble-calligraph"
              variant="text"
              animation="smooth"
              initial
              trend={-1}
              drift={{ x: 8, y: 6 }}
              stagger={0.014}
              autoSize={false}
            >
              {speechText}
            </Calligraph>
          </div>
          {!gameplayMode && <CharacterCaptionBubble reaction={characterBubble} canvasRendered={recording} />}
          {storyFocus?.phase === "framing" && (
            <div className="dialogue-focus-frame" aria-live="polite" aria-label="把物品放进白色虚线框里">
              <span className="sr-only">把物品放进白色虚线框里</span>
            </div>
          )}

          {cameraState === "ready" && ["recognizing", "thinking"].includes(aiState) && (
            <div
              className="character-thinking-indicator"
              data-character={activeCharacter}
              style={thinkingIndicatorPosition
                ? {
                    left: `${thinkingIndicatorPosition.left}%`,
                    bottom: `${thinkingIndicatorPosition.bottom}%`,
                  }
                : undefined}
            >
              <TypingIndicator label={aiState === "recognizing" ? "正在识别你说的话" : "正在思考"} />
            </div>
          )}

          {cameraState === "ready" && riveReady && (
            <button
              className="jiaojiao-hit-area"
              type="button"
              disabled={characterSwitching}
              onClick={handleCharacterTap}
              aria-label={`当前角色${CHARACTERS[activeCharacter].label}，单击播放夸夸动作，连续点击三次切换角色；当前动作 ${riveAnimationName}`}
            />
          )}

          {cameraState === "ready" && !gameplayMode && (
            <button
              className={`live-caption is-${contextualCaption.mode} ${recording ? "is-canvas-rendered" : ""}`}
              type="button"
              disabled={recording}
              onClick={switchCaption}
              aria-label={`${contextualCaption.text}，点击切换默认字幕和数值`}
            >
              <span className="caption-line caption-line-copy">{contextualCaption.firstLine}</span>
              {contextualCaption.kind === "subject" ? (
                <span className="caption-line caption-line-subject">{contextualCaption.secondLine}</span>
              ) : (
                <span className="caption-line caption-line-day">
                  <span>{contextualCaption.dayPrefix}</span>
                  <Calligraph
                    className="reading-day"
                    variant="number"
                    animation="bouncy"
                    initial
                    trend={1}
                    aria-label={`${day}`}
                  >
                    {contextualCaption.day}
                  </Calligraph>
                  <span>{contextualCaption.suffix}</span>
                </span>
              )}
            </button>
          )}

          {cameraState === "ready" && engineState === "loading" && (
            <div className="live-loading" role="progressbar" aria-label="合拍素材加载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={loadProgress}>
              <span>叫叫正在到场</span>
              <strong>{loadProgress}%</strong>
              <i><b style={{ transform: `scaleX(${loadProgress / 100})` }} /></i>
            </div>
          )}

          {flashMode && <div className={`camera-flash is-${flashMode}`} aria-hidden="true" />}
        </div>

        {cameraState === "ready" && (
          <div className="control-deck">
            <div className="capture-toolbar" aria-label="拍摄工具">
              <div className="capture-side capture-side-left">
                <button
                  className={`media-library-entry ${latestMedia ? "has-media" : ""}`}
                  type="button"
                  disabled={recording}
                  onClick={() => { startGameplay(""); openMediaLibrary(); }}
                  aria-label={mediaLibrary.length ? `打开作品列表，共 ${mediaLibrary.length} 个作品` : "打开作品列表"}
                >
                  {latestMedia ? (
                    <>
                      {latestMedia.type === "photo" ? (
                        <img src={latestMedia.url} alt="最近拍摄的照片" />
                      ) : (
                        <video src={latestMedia.url} muted playsInline preload="metadata" aria-label="最近拍摄的短视频" />
                      )}
                      {latestMedia.type === "video" && <PlayCircle className="media-entry-play" size={19} weight="fill" aria-hidden="true" />}
                      <span className="media-entry-count">{mediaLibrary.length}</span>
                    </>
                  ) : (
                    <ImagesSquare size={24} weight="bold" aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="capture-controls">
                <span className="capture-hint">{gameplayMode ? "先完成这一轮，再来合影" : "轻点拍照 · 按住录像"}</span>
                <button
                  className={`shutter ${recording ? "is-recording" : ""}`}
                  type="button"
                  disabled={Boolean(gameplayMode)}
                  aria-label={recording ? "松开结束录像" : "轻点拍照，长按录像"}
                  onPointerDown={onShutterPointerDown}
                  onPointerUp={onShutterPointerUp}
                  onPointerCancel={onShutterPointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span className="shutter-core" />
                  {recording && <span className="recording-time">{formattedRecordingTime}</span>}
                </button>
                <span className="capture-limit">最长 15 秒</span>
              </div>

              <div className="capture-side capture-side-right">
                {facingMode === "environment" && (
                  <button
                    className={`round-control pip-control ${pipVisible ? "is-active" : ""} ${pipOpening ? "is-opening" : ""}`}
                    type="button"
                    disabled={recording || pipOpening}
                    aria-pressed={pipVisible}
                    aria-label={pipVisible ? "关闭前置摄像头小窗" : "显示前置摄像头小窗"}
                    onClick={togglePipCamera}
                  >
                    <PictureInPicture size={21} weight={pipVisible ? "fill" : "bold"} aria-hidden="true" />
                    <span className="pip-control-state" aria-hidden="true">{pipVisible ? "×" : "+"}</span>
                  </button>
                )}
                <div className="camera-menu-wrap">
                  <button
                    className={`round-control camera-menu-trigger ${cameraMenuOpen ? "is-active" : ""}`}
                    type="button"
                    disabled={recording}
                    aria-expanded={cameraMenuOpen}
                    aria-haspopup="menu"
                    aria-label={cameraMenuOpen ? "收起相机设置菜单" : "展开相机设置菜单"}
                    onClick={toggleCameraMenu}
                  >
                    <CaretDown className="camera-menu-chevron" size={24} weight="bold" aria-hidden="true" />
                  </button>
                  {cameraMenuOpen && (
                    <div className="camera-menu-popover" role="menu" aria-label="相机设置">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!segmenterReady}
                        onClick={() => {
                          togglePersonLayer();
                          setCameraMenuOpen(false);
                        }}
                      >
                        <ArrowsLeftRight size={19} weight="bold" aria-hidden="true" />
                        <span>{personLayer === "front" ? "切换为鸡在前" : "切换为人在前"}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setCameraMenuOpen(false);
                          switchCamera();
                        }}
                      >
                        <ArrowClockwise size={20} weight="bold" aria-hidden="true" />
                        <span>翻转镜头</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {cameraState !== "ready" && (
          <>
            <nav className="welcome-corner-links" aria-label="了解更多">
              <a href={`${import.meta.env.BASE_URL}changelog/`}>更新日志</a>
              <span aria-hidden="true">·</span>
              <a href={`${import.meta.env.BASE_URL}assets/`}>资源</a>
            </nav>
          <div className="welcome-panel">
            <div className="welcome-copy">
              <span className="welcome-icon"><img src="favicon-512.webp" alt="JOJO Cam" /></span>
              <h1
                className="welcome-headline"
                aria-live="polite"
                aria-label={WELCOME_HEADLINES[welcomeHeadlineIndex].join("")}
              >
                <ProgressiveCalligraphHeadline
                  key={welcomeHeadlineIndex}
                  lines={WELCOME_HEADLINES[welcomeHeadlineIndex]}
                  onComplete={scheduleNextWelcomeHeadline}
                />
              </h1>
            </div>

            {cameraState === "error" && <p className="camera-error" role="alert">{cameraError}</p>}

            <button
              className="open-camera-button"
              type="button"
              disabled={!readyForCamera || cameraState === "opening"}
              onClick={enterCamera}
            >
              {cameraState === "opening" ? (
                <><span className="button-loader" />正在打开相机</>
              ) : (
                <><MagnifyingGlass size={21} weight="bold" />开始和叫叫聊聊</>
              )}
            </button>

            <div className={`engine-status is-${engineState}`} role="status">
              {engineState === "ready" ? <Check size={15} weight="bold" /> : <span className="status-pulse" />}
              <span>{engineMessage}</span>
            </div>
            {engineState === "loading" && (
              <div className="load-progress" role="progressbar" aria-label="页面资源加载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={loadProgress}>
                <div className="load-progress-copy">
                  <span>准备和叫叫聊聊</span>
                  <strong>{loadProgress}%</strong>
                </div>
                <span className="load-progress-track"><i style={{ transform: `scaleX(${loadProgress / 100})` }} /></span>
              </div>
            )}
            <p className="privacy-note">
              <LockSimple size={14} weight="fill" />
              <span>AI 识物和相册小记会按需发送压缩画面；对话文字仅在本机留作日记，并发送给豆包 Mini 生成小记；本站不保存原图和原始音频</span>
            </p>
          </div>
          </>
        )}

        {toast && <div className="camera-toast" role="status">{toast}</div>}

        {mediaLibraryOpen && (
          <div
            className={`media-library-panel ${mediaLibraryClosing ? "is-closing" : ""} ${mediaLibraryDragging ? "is-dragging" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="我的合拍作品"
            style={{ "--library-drag-y": `${mediaLibraryDragY}px` }}
            onTouchStart={onMediaLibraryTouchStart}
            onTouchMove={onMediaLibraryTouchMove}
            onTouchEnd={finishMediaLibraryTouch}
            onTouchCancel={finishMediaLibraryTouch}
          >
            <header className="media-library-header">
              <div>
                <strong>我的合拍</strong>
                <span>{mediaLibrary.length ? `${mediaLibrary.length} 个作品 · 仅保存在本机` : "作品仅保存在本机"}</span>
              </div>
              <button type="button" onClick={closeMediaLibrary} aria-label="关闭作品列表">
                <X size={25} weight="bold" aria-hidden="true" />
              </button>
            </header>
            <nav className="library-tabs" aria-label="相册分类"><button type="button" aria-pressed={libraryTab === "days"} onClick={() => setLibraryTab("days")}>时光小记</button><button type="button" aria-pressed={libraryTab === "friends"} onClick={() => setLibraryTab("friends")}>朋友收藏{friends.length ? ` · ${friends.length}` : ""}</button></nav>
            {libraryTab === "friends" ? <div className="media-library-timeline" ref={mediaLibraryGridRef}><Suspense fallback={<p>朋友们正在到场…</p>}><FriendCollection friends={friends} onChange={setFriends} /></Suspense></div> : mediaTimeline.length ? (
              <div className="media-library-timeline" ref={mediaLibraryGridRef}>
                {mediaTimeline.map(({ dayKey, items }, dayIndex) => {
                  const entries = conversationEntriesByDay.get(dayKey) || [];
                  const summaryRecord = conversationSummaries[dayKey];
                  const summaryState = conversationSummaryStates[dayKey] || "idle";
                  const summaryText = summaryRecord?.summary
                    || (summaryState === "error"
                      ? "这次没能整理出来，下次打开相册会再试一次。"
                      : entries.length
                        ? "叫叫正在回想这一天聊过的内容…"
                        : "叫叫正在翻看这一天的作品…");
                  return (
                    <section className="media-timeline-day" key={dayKey} style={{ "--timeline-day-index": dayIndex }}>
                      <header className="media-timeline-day-header">
                        <span className="media-timeline-marker" aria-hidden="true" />
                        <div>
                          <strong>{formatTimelineDay(dayKey)}</strong>
                          <span>{items.length ? `${items.length} 个作品` : "今天聊过的小事"}</span>
                        </div>
                      </header>
                      <div className="media-day-grid">
                        {items.map((item) => (
                          <button
                            className={`media-library-card is-${item.type}`}
                            type="button"
                            key={item.id}
                            onClick={() => openMediaPreview(item)}
                            aria-label={`打开${item.type === "photo" ? "照片" : "短视频"}，${formatCaptureDate(item.createdAt)}`}
                          >
                            <span
                              className="media-library-visual"
                              style={{
                                viewTransitionName: mediaPreview?.id === item.id
                                  ? "none"
                                  : getMediaTransitionName(item.id),
                              }}
                            >
                              {item.type === "photo" ? (
                                <img src={item.url} alt="" />
                              ) : (
                                <video
                                  src={item.url}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  aria-hidden="true"
                                  onLoadedMetadata={(event) => {
                                    const durationMs = Math.round((event.currentTarget.duration || 0) * 1_000);
                                    if (!durationMs) return;
                                    setVideoDurations((current) => current[item.id] === durationMs
                                      ? current
                                      : { ...current, [item.id]: durationMs });
                                  }}
                                />
                              )}
                              {item.type === "video" && (
                                <span className="media-video-badge" aria-hidden="true">
                                  <PlayCircle size={15} weight="fill" />
                                  <span>{formatMediaDuration(item.durationMs || videoDurations[item.id])}</span>
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                      <JournalDay record={summaryRecord || { dayKey }} state={summaryState}
                        onChange={journal.updateMoment} onForget={journal.forgetMoment} onRetry={() => journal.retry(dayKey)} />
                      {friends.some((friend) => new Date(friend.createdAt).toLocaleDateString() === new Date(`${dayKey}T12:00:00`).toLocaleDateString()) && <button className="day-friends-link" type="button" onClick={() => setLibraryTab("friends")}>看看这天认识的新朋友 →</button>}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="media-library-empty">
                <ImagesSquare size={42} weight="duotone" aria-hidden="true" />
                <strong>把今天的小事留下来</strong>
                <span>拍张照片，或和叫叫聊聊今天</span>
              </div>
            )}
          </div>
        )}

        {mediaPreview && (
          <div
            className={`media-preview is-${mediaPreview.type} ${mediaPreviewClosing ? "is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={mediaPreview.type === "photo" ? "照片预览" : "录像预览"}
            onPointerDown={onMediaPreviewPointerDown}
            onPointerUp={onMediaPreviewPointerUp}
            onPointerCancel={onMediaPreviewPointerCancel}
          >
            <div className="preview-media-carousel">
              <div className="preview-media-wrap">
                <div
                  className={`preview-media-clip is-${mediaPreviewDirection}`}
                  key={mediaPreview.id}
                  style={{
                    viewTransitionName: mediaPreviewDirection === "open"
                      ? getMediaTransitionName(mediaPreview.id)
                      : "none",
                  }}
                >
                  {mediaPreview.type === "photo" ? (
                    <img
                      src={mediaPreview.url}
                      alt={mediaPreview.captionText || getCaptionText(mediaPreview.captionMode || captionMode, mediaPreview.day || paddedDay)}
                    />
                  ) : (
                    <video src={mediaPreview.url} playsInline controls autoPlay loop />
                  )}
                </div>
                <button className="preview-close" type="button" onClick={closePreview} aria-label="关闭预览">
                  <X size={28} weight="bold" />
                </button>
              </div>
            </div>
            <div className="preview-actions">
              <div>
                <strong>{mediaPreview.type === "photo" ? "这一刻拍好了" : "这一段录好了"}</strong>
                <span>{mediaPreview.captionText || getCaptionText(mediaPreview.captionMode || captionMode, mediaPreview.day || paddedDay)}</span>
                <small>{formatCaptureDate(mediaPreview.createdAt)}{mediaPreview.type === "photo" ? " · 左右滑切换，上下滑返回" : ""}</small>
              </div>
              <button type="button" onClick={savePreview}>
                <DownloadSimple size={20} weight="bold" />
                分享
              </button>
            </div>
          </div>
        )}
      </section>

      {!isMobileDevice && (
        <aside className="desktop-note">
          <span className="desktop-kicker">推荐使用移动设备</span>
          <h2>扫码和叫叫合影</h2>
          <p>用手机或 Pad 打开，取景框会自动放大，更适合拍照和录像。</p>
          <div className="desktop-qr">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt={`打开 ${shareUrl} 的二维码`} />
            ) : (
              <span role="status">正在生成二维码</span>
            )}
          </div>
          <span className="desktop-domain">{shareUrl.replace(/^https?:\/\//, "")}</span>
        </aside>
      )}
    </main>
  );
}

export default App;
