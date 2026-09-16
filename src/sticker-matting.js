export const MAX_STICKER_EDGE = 1280;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getStickerCropBox(width, height, bbox, padding = 0.14) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const source = Array.isArray(bbox) && bbox.length === 4 ? bbox : [0, 0, 1, 1];
  const [x, y, boxWidth, boxHeight] = source.map(Number);
  const normalized = [x, y, boxWidth, boxHeight].every(Number.isFinite)
    ? source : [0, 0, 1, 1];
  const rawWidth = clamp(normalized[2], 0.04, 1) * safeWidth;
  const rawHeight = clamp(normalized[3], 0.04, 1) * safeHeight;
  const extra = Math.max(rawWidth, rawHeight) * Math.max(0, padding);
  const cropWidth = Math.min(safeWidth, rawWidth + extra * 2);
  const cropHeight = Math.min(safeHeight, rawHeight + extra * 2);
  const xCenter = clamp((normalized[0] + normalized[2] / 2) * safeWidth, 0, safeWidth);
  const yCenter = clamp((normalized[1] + normalized[3] / 2) * safeHeight, 0, safeHeight);
  return {
    x: clamp(xCenter - cropWidth / 2, 0, safeWidth - cropWidth),
    y: clamp(yCenter - cropHeight / 2, 0, safeHeight - cropHeight),
    width: cropWidth,
    height: cropHeight,
  };
}

function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("贴纸没有准备好")), type, quality);
  });
}

async function cropCapture(source, bbox) {
  // Image.decode also works on iOS versions with incomplete createImageBitmap.
  const url = URL.createObjectURL(source);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const crop = getStickerCropBox(image.naturalWidth, image.naturalHeight, bbox);
    const scale = Math.min(1, MAX_STICKER_EDGE / Math.max(crop.width, crop.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(canvas, "image/jpeg", 0.96);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function getMattingApiUrl() {
  if (import.meta.env?.VITE_JOCAM_MATTING_URL) return import.meta.env.VITE_JOCAM_MATTING_URL;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:8787/matting";
  return `${window.location.origin}/api/matting`;
}

export async function createStickerFromCapture(source, bbox, { onProgress, signal } = {}) {
  if (!(source instanceof Blob)) throw new Error("还没有可做成贴纸的照片");
  const crop = await cropCapture(source, bbox);
  onProgress?.({ status: "matting" });
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 33_000);
  try {
    const response = await fetch(getMattingApiUrl(), { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: crop, signal: controller.signal });
    if (!response.ok) throw Object.assign(new Error("贴纸暂时没有做好"), { status: response.status });
    const sticker = await response.blob();
    if (sticker.type !== "image/png" || sticker.size < 100) throw new Error("没有收到透明贴纸");
    onProgress?.({ status: "ready" });
    return sticker;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
