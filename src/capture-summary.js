export const CAPTURE_SUMMARY_LIMIT = 4;
export const CAPTURE_SUMMARY_IMAGE_MAX_LENGTH = 210_000;

function sortChronologically(captures = []) {
  return [...captures].sort((left, right) => Number(left?.createdAt || 0) - Number(right?.createdAt || 0));
}

export function selectRepresentativeCaptures(captures = [], limit = CAPTURE_SUMMARY_LIMIT) {
  const sorted = sortChronologically(captures);
  const count = Math.max(0, Math.min(Number(limit) || 0, sorted.length));
  if (!count) return [];
  if (sorted.length <= count) return sorted;
  if (count === 1) return [sorted[Math.floor((sorted.length - 1) / 2)]];

  const selected = [];
  for (let index = 0; index < count; index += 1) {
    selected.push(sorted[Math.round((index * (sorted.length - 1)) / (count - 1))]);
  }
  return selected;
}

export function createCaptureFingerprint(captures = []) {
  let hash = 2166136261;
  for (const capture of sortChronologically(captures)) {
    const value = [
      capture?.id || "",
      capture?.type || "",
      capture?.createdAt || 0,
      capture?.durationMs || 0,
      capture?.blob?.size || 0,
      capture?.blob?.type || "",
    ].join("|");
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${captures.length}-${(hash >>> 0).toString(36)}`;
}

function waitForMediaEvent(element, eventName, timeoutMs = 3_000) {
  return new Promise((resolve, reject) => {
    let timer = null;
    const finish = (error) => {
      if (timer) window.clearTimeout(timer);
      element.removeEventListener(eventName, onReady);
      element.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onReady = () => finish();
    const onError = () => finish(new Error(`Capture ${eventName} failed`));
    element.addEventListener(eventName, onReady, { once: true });
    element.addEventListener("error", onError, { once: true });
    timer = window.setTimeout(() => finish(new Error(`Capture ${eventName} timed out`)), timeoutMs);
  });
}

function getCaptureUrl(capture) {
  if (capture?.url) return { url: capture.url, revoke: false };
  if (capture?.blob instanceof Blob) return { url: URL.createObjectURL(capture.blob), revoke: true };
  throw new Error("Capture has no readable media source");
}

async function loadPhoto(capture) {
  const { url, revoke } = getCaptureUrl(capture);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    if (image.decode) await image.decode();
    else await waitForMediaEvent(image, "load");
    return {
      element: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => {
        image.src = "";
        if (revoke) URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    if (revoke) URL.revokeObjectURL(url);
    throw error;
  }
}

async function loadVideoFrame(capture) {
  const { url, revoke } = getCaptureUrl(capture);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    video.load();
    if (video.readyState < 2) await waitForMediaEvent(video, "loadeddata", 4_000);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const targetTime = Math.min(0.8, Math.max(0, duration * 0.24));
    if (targetTime > 0.04 && Math.abs(video.currentTime - targetTime) > 0.04) {
      video.currentTime = targetTime;
      await waitForMediaEvent(video, "seeked", 2_500);
    }
    return {
      element: video,
      width: video.videoWidth,
      height: video.videoHeight,
      cleanup: () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
        if (revoke) URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    video.removeAttribute("src");
    if (revoke) URL.revokeObjectURL(url);
    throw error;
  }
}

async function loadCaptureFrame(capture) {
  return capture?.type === "video" ? loadVideoFrame(capture) : loadPhoto(capture);
}

function drawCover(context, source, sourceWidth, sourceHeight, x, y, width, height) {
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const sourceX = (sourceWidth - cropWidth) / 2;
  const sourceY = (sourceHeight - cropHeight) / 2;
  context.drawImage(source, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height);
}

function getTileRects(count, size, gap) {
  if (count <= 1) return [{ x: 0, y: 0, width: size, height: size }];
  if (count === 2) {
    const width = (size - gap) / 2;
    return [
      { x: 0, y: 0, width, height: size },
      { x: width + gap, y: 0, width, height: size },
    ];
  }
  if (count === 3) {
    const width = (size - gap) / 2;
    const height = (size - gap) / 2;
    return [
      { x: 0, y: 0, width, height: size },
      { x: width + gap, y: 0, width, height },
      { x: width + gap, y: height + gap, width, height },
    ];
  }
  const tileSize = (size - gap) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: (index % 2) * (tileSize + gap),
    y: Math.floor(index / 2) * (tileSize + gap),
    width: tileSize,
    height: tileSize,
  }));
}

export async function createCaptureSummaryCollage(captures = []) {
  if (typeof document === "undefined" || typeof Image === "undefined") return "";
  const selected = selectRepresentativeCaptures(captures);
  if (!selected.length) return "";

  const frames = (await Promise.all(selected.map(async (capture) => {
    try {
      const frame = await loadCaptureFrame(capture);
      return frame.width && frame.height ? frame : (frame.cleanup(), null);
    } catch {
      return null;
    }
  }))).filter(Boolean);
  if (!frames.length) return "";

  const size = 512;
  const gap = 6;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    frames.forEach(({ cleanup }) => cleanup());
    return "";
  }

  context.fillStyle = "#181818";
  context.fillRect(0, 0, size, size);
  const rects = getTileRects(frames.length, size, gap);
  frames.forEach((frame, index) => {
    const rect = rects[index];
    drawCover(context, frame.element, frame.width, frame.height, rect.x, rect.y, rect.width, rect.height);
  });
  frames.forEach(({ cleanup }) => cleanup());

  for (const quality of [0.62, 0.52, 0.42, 0.34]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= CAPTURE_SUMMARY_IMAGE_MAX_LENGTH) return dataUrl;
  }
  return "";
}
