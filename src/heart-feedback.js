export const HEART_FEEDBACK_DURATION_MS = 3_200;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function getHeartFeedbackFrame(elapsedMs, durationMs = HEART_FEEDBACK_DURATION_MS) {
  const progress = clamp(elapsedMs / durationMs, 0, 1);
  const enter = clamp(progress / 0.15, 0, 1);
  const leave = clamp((1 - progress) / 0.2, 0, 1);
  const envelope = Math.min(enter, leave);
  return {
    progress,
    opacity: envelope,
    scale: 0.88 + enter * 0.22 + Math.sin(progress * Math.PI * 8) * 0.035,
    glow: 0.22 + envelope * 0.48,
  };
}

function heartPath(context, centerX, centerY, size) {
  const lobe = size * 0.52;
  context.beginPath();
  context.moveTo(centerX, centerY + size * 0.82);
  context.bezierCurveTo(centerX - size * 1.18, centerY + size * 0.2, centerX - size * 0.98, centerY - size * 0.76, centerX - lobe, centerY - size * 0.42);
  context.bezierCurveTo(centerX - size * 0.18, centerY - size * 0.72, centerX, centerY - size * 0.3, centerX, centerY - size * 0.04);
  context.bezierCurveTo(centerX, centerY - size * 0.3, centerX + size * 0.18, centerY - size * 0.72, centerX + lobe, centerY - size * 0.42);
  context.bezierCurveTo(centerX + size * 0.98, centerY - size * 0.76, centerX + size * 1.18, centerY + size * 0.2, centerX, centerY + size * 0.82);
  context.closePath();
}

export function getFaceHeartPlacement(face, width, height) {
  if (!face || !Number.isFinite(face.right) || !Number.isFinite(face.top)) return null;
  const size = clamp(Math.min(width, height) * 0.078, 24, 72);
  const horizontalExtent = size * 1.22;
  const topExtent = size * 0.8;
  const bottomExtent = size * 0.9;
  return {
    size,
    x: clamp(face.right * width + size * 0.52, horizontalExtent, width - horizontalExtent),
    y: clamp(face.top * height + size * 0.2, topExtent, height - bottomExtent),
  };
}

/** A single-hand finger heart stays beside the child's face, never as a veil. */
export function drawFaceHeartFeedback(context, width, height, elapsedMs, face) {
  const frame = getHeartFeedbackFrame(elapsedMs);
  const placement = getFaceHeartPlacement(face, width, height);
  if (frame.opacity <= 0 || !placement) return;
  const size = placement.size * frame.scale;
  context.save();
  context.globalAlpha = frame.opacity;
  context.shadowColor = "rgba(255, 69, 142, 0.92)";
  context.shadowBlur = size * (0.24 + frame.glow);
  heartPath(context, placement.x, placement.y, size);
  const gradient = context.createLinearGradient(placement.x, placement.y - size, placement.x, placement.y + size);
  gradient.addColorStop(0, "#ffe1ee");
  gradient.addColorStop(0.5, "#ff69a6");
  gradient.addColorStop(1, "#d81d69");
  context.fillStyle = gradient;
  context.fill();
  context.restore();
}

/** Drawn before the segmented child, so the heart remains behind their body. */
export function drawLargeHeartFeedback(context, width, height, elapsedMs) {
  const frame = getHeartFeedbackFrame(elapsedMs);
  if (frame.opacity <= 0) return;
  const size = Math.min(width, height) * 0.31 * frame.scale;
  const centerX = width * 0.54;
  const centerY = height * 0.43;
  context.save();
  context.fillStyle = `rgba(8, 7, 19, ${0.48 * frame.opacity})`;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = frame.opacity;
  context.shadowColor = "rgba(255, 72, 143, 0.92)";
  context.shadowBlur = size * (0.32 + frame.glow);
  heartPath(context, centerX, centerY, size);
  const gradient = context.createLinearGradient(centerX, centerY - size, centerX, centerY + size);
  gradient.addColorStop(0, "#ffb4d2");
  gradient.addColorStop(0.48, "#ff4f96");
  gradient.addColorStop(1, "#ca185f");
  context.fillStyle = gradient;
  context.fill();
  context.restore();
}

// Retained as a stable export for integrations that intentionally request the
// old full-screen large-heart treatment.
export const drawHeartFeedback = drawLargeHeartFeedback;
