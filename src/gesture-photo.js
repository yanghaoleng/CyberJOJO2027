import { getContextualCaption } from "./contextual-caption.js";

export function respondToCameraGesture(gesture, { playAnimation, capturePhoto }) {
  let animationPlayed = false;
  try { animationPlayed = Boolean(playAnimation?.()); } catch { /* Renderer failure must not lose the photo. */ }
  if (gesture === "thumbs_up") capturePhoto();
  return animationPlayed;
}

export async function resolveGestureCaption({ identifyPartner, characterLabel, timeoutMs = 2500 }) {
  const controller = new AbortController();
  let timer;
  try {
    const partner = await Promise.race([
      Promise.resolve().then(() => identifyPartner?.(controller.signal)).catch(() => null),
      new Promise((resolve) => { timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs); }),
    ]);
    return getContextualCaption({ gesture: "thumbs_up", characterLabel, interactionPartner: partner });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export async function encodePhoto(canvas) {
  // A fresh canvas is owned by each capture; another shutter cannot overwrite it.
  for (const [type, quality] of [["image/jpeg", .94], ["image/jpeg", .85], ["image/png", undefined]]) {
    const blob = await new Promise((resolve, reject) => {
      try { canvas.toBlob(resolve, type, quality); } catch (error) { reject(error); }
    });
    if (blob?.size) return blob;
  }
  throw new Error("Photo encoding failed");
}
