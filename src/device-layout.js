export const TABLET_CHARACTER_SCALE_MULTIPLIER = 0.64;

export function isTabletViewport({ width, height, isMobileDevice }) {
  if (!isMobileDevice || !Number.isFinite(width) || !Number.isFinite(height)) return false;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  return shortEdge >= 600 && longEdge <= 1_400;
}

export function getCharacterScaleMultiplier(isTabletDevice) {
  return isTabletDevice ? TABLET_CHARACTER_SCALE_MULTIPLIER : 1;
}
