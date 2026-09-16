export const BIREFNET_MODEL = "onnx-community/BiRefNet-ONNX";
export const MAX_STICKER_EDGE = 1280;

let backgroundRemoverPromise = null;

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
  const image = await createImageBitmap(source);
  try {
    const crop = getStickerCropBox(image.width, image.height, bbox);
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
    image.close?.();
  }
}

async function getBackgroundRemover(onProgress) {
  if (!backgroundRemoverPromise) {
    backgroundRemoverPromise = import("@huggingface/transformers").then(async ({ env, pipeline }) => {
      // This runs once, only after an object is recognised. Keeping it out of the
      // initial bundle preserves the camera's first-open time.
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 1));
      return pipeline("background-removal", BIREFNET_MODEL, {
        device: "wasm",
        dtype: "fp32",
        progress_callback: onProgress,
      });
    });
  }
  return backgroundRemoverPromise;
}

export async function createStickerFromCapture(source, bbox, { onProgress } = {}) {
  if (!(source instanceof Blob)) throw new Error("还没有可做成贴纸的照片");
  const crop = await cropCapture(source, bbox);
  onProgress?.({ status: "model" });
  const removeBackground = await getBackgroundRemover(onProgress);
  onProgress?.({ status: "matting" });
  const sticker = await removeBackground(crop);
  onProgress?.({ status: "ready" });
  return sticker.toBlob("image/png");
}
