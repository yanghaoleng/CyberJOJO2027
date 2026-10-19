export const clampTilt = (value) => Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
const angleDelta = (value, origin) => ((value - origin + 540) % 360) - 180;

// Use the first reading as neutral, so holding a phone upright feels natural.
export function orientationTilt(reading, neutral, screenAngle = 0) {
  if (![reading?.beta, reading?.gamma, neutral?.beta, neutral?.gamma].every(Number.isFinite)) return null;
  const horizontal = angleDelta(reading.gamma, neutral.gamma) / 25;
  const vertical = angleDelta(reading.beta, neutral.beta) / 25;
  const radians = screenAngle * Math.PI / 180;
  return {
    x: clampTilt(horizontal * Math.cos(radians) + vertical * Math.sin(radians)),
    y: clampTilt(vertical * Math.cos(radians) - horizontal * Math.sin(radians)),
  };
}

export function pointerTilt(clientX, clientY, rect) {
  return {
    x: clampTilt((clientX - rect.left) / Math.max(1, rect.width) * 2 - 1),
    y: clampTilt((clientY - rect.top) / Math.max(1, rect.height) * 2 - 1),
  };
}
