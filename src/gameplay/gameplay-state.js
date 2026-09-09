export const FOOD_LABELS = Object.freeze({ apple: "苹果", cake: "蛋糕", noodles: "面条" });
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getMouthTarget(characterRect, stage) {
  if (!characterRect || !Number.isFinite(characterRect.width) || !Number.isFinite(characterRect.height)) return null;
  const { x = 0, y = 0, width, height } = characterRect;
  if (width <= 0 || height <= 0) return null;
  return {
    x: clamp(Number.isFinite(characterRect.mouthX) ? characterRect.mouthX : x + width * 0.55, 0, stage.width),
    y: clamp(Number.isFinite(characterRect.mouthY) ? characterRect.mouthY : y + height * 0.4, 0, stage.height),
    radius: clamp(Math.min(width, height) * 0.14, 26, 64),
  };
}

export function isNearMouth(point, mouth, extra = 0) {
  return Boolean(point && mouth && Math.hypot(point.x - mouth.x, point.y - mouth.y) <= mouth.radius + extra);
}

export function rawPointFromStage(point, frame, stage) {
  const scale = Math.max(stage.width / frame.width, stage.height / frame.height);
  const scaledWidth = frame.width * scale, scaledHeight = frame.height * scale;
  const displayX = (point.x + (scaledWidth - stage.width) / 2) / scaledWidth;
  return { x: clamp(frame.mirrored ? 1 - displayX : displayX, 0, 1), y: clamp((point.y + (scaledHeight - stage.height) / 2) / scaledHeight, 0, 1) };
}

export function stageBoxFromRaw(bbox, frame, stage) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
    || bbox[2] <= 0 || bbox[3] <= 0 || bbox[0] + bbox[2] > 1.001 || bbox[1] + bbox[3] > 1.001) return null;
  const scale = Math.max(stage.width / frame.width, stage.height / frame.height);
  const width = frame.width * scale, height = frame.height * scale;
  return { x: (frame.mirrored ? 1 - bbox[0] - bbox[2] : bbox[0]) * width - (width - stage.width) / 2,
    y: bbox[1] * height - (height - stage.height) / 2, width: bbox[2] * width, height: bbox[3] * height };
}

export function advanceFrameStability(previous, signature, now) {
  if (!signature?.length) return { signature: null, count: 0, since: now, steady: false };
  let difference = 1;
  if (previous?.signature?.length === signature.length) {
    difference = signature.reduce((sum, value, index) => sum + Math.abs(value - previous.signature[index]), 0) / signature.length / 255;
  }
  const same = difference < 0.045;
  const count = same ? (previous?.count || 0) + 1 : 1;
  const since = same ? previous.since : now;
  return { signature, count, since, steady: count >= 3 && now - since >= 900 };
}

export function createRoundGuard() {
  let revision = 0;
  return { next: () => ++revision, isCurrent: (token) => token === revision, cancel: () => { revision += 1; } };
}

export async function frameSignature(frame) {
  const image = new Image();
  image.src = frame.image;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 18; canvas.height = 12;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, 18, 12);
  const data = context.getImageData(0, 0, 18, 12).data;
  const signature = [];
  for (let offset = 0; offset < data.length; offset += 4) signature.push(data[offset], data[offset + 1], data[offset + 2]);
  return signature;
}
